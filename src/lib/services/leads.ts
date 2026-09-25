import "server-only";
import { generateEmails, qualifyLead } from "@/lib/ai";
import { HttpError } from "@/lib/api";
import type { AppContext } from "@/lib/auth/session";
import { lintEmail } from "@/lib/compliance/email-lint";
import { emailFacts } from "@/lib/compliance/facts";
import { StoreError } from "@/lib/db/store";
import { enrichWebsite } from "@/lib/leads/enrich";
import type { DiscoveredBusiness } from "@/lib/leads/providers";
import type { ConsentBasis, EmailDraft, Icp, Lead, Product, Qualification } from "@/lib/types";
import { emailType, isValidEmail, normalizeDomain, normalizeUrl } from "@/lib/utils";
import { actorOf, recordAudit } from "./audit";

const QUALIFIABLE: Lead["status"][] = ["new", "qualified", "disqualified", "skipped"];

// ───────────────────────────────────────── adding leads
export interface AddResult {
  added: Lead[];
  duplicates: string[];
  suppressed: string[];
}

export async function addLeads(
  ctx: AppContext,
  items: (DiscoveredBusiness & { email?: string | null; contact_name?: string | null; contact_title?: string | null; consent_basis?: ConsentBasis })[],
  opts: { icpId: string | null; searchId: string | null },
): Promise<AddResult> {
  const { store } = ctx;
  const result: AddResult = { added: [], duplicates: [], suppressed: [] };
  const domainSuppressions = new Set((await store.list("suppressions", { eq: { kind: "domain" } })).map((s) => s.value));
  const seen = new Set<string>();

  for (const item of items) {
    const domain = item.domain ?? normalizeDomain(item.website) ?? (item.email ? normalizeDomain(item.email) : null);
    if (domain) {
      if (seen.has(domain) || (await store.first("leads", { eq: { domain } }))) {
        result.duplicates.push(item.company_name);
        continue;
      }
      if (domainSuppressions.has(domain)) {
        result.suppressed.push(item.company_name);
        continue;
      }
      seen.add(domain);
    }
    const email = item.email && isValidEmail(item.email) ? item.email.trim().toLowerCase() : null;
    try {
      const lead = await store.insert("leads", {
        icp_id: opts.icpId, search_id: opts.searchId, company_name: item.company_name.trim(), domain,
        website: normalizeUrl(item.website), industry: item.industry ?? "", location: item.location ?? "", description: item.description ?? "",
        phone: item.phone, email, email_type: email ? emailType(email) : null, email_source_url: email ? item.source_url : null,
        contact_name: item.contact_name ?? null, contact_title: item.contact_title ?? null,
        source: item.source, source_ref: item.source_ref, source_url: item.source_url,
        consent_basis: item.consent_basis ?? "unknown", status: "new",
      });
      result.added.push(lead);
    } catch (e) {
      if (e instanceof StoreError && e.code === "conflict") result.duplicates.push(item.company_name);
      else throw e;
    }
  }
  return result;
}

// ───────────────────────────────────────── enrichment
export async function enrichLead(ctx: AppContext, leadId: string) {
  const { store } = ctx;
  const lead = await store.get("leads", leadId);
  if (!lead) throw new StoreError("Lead not found", "not_found");
  if (!lead.website) throw new HttpError(422, "This lead has no website to check.");

  const r = await enrichWebsite(lead.website);
  if (!r.ok) {
    await recordAudit(store, actorOf(ctx), {
      action: "lead.enrich_stopped", summary: `Website check stopped for ${lead.company_name}: ${r.reason}`,
      entityType: "lead", entityId: lead.id, leadId: lead.id,
    });
    return { lead, result: r };
  }

  const ws = ctx.workspace;
  const best = r.emails.find((e) => e.type === "role") ?? (ws.role_emails_only ? undefined : r.emails[0]);
  const patch: Partial<Lead> = {
    site_excerpt: [r.title, r.description, r.excerpt].filter(Boolean).join("\n"),
    description: lead.description || r.description || "",
    enriched_at: new Date().toISOString(),
  };
  // Never overwrite an address the user supplied; only fill a gap with a published one.
  if (!lead.email && best) {
    patch.email = best.email;
    patch.email_type = best.type;
    patch.email_source_url = best.sourceUrl;
    patch.consent_basis = "conspicuous_publication";
  }
  const updated = await store.update("leads", lead.id, patch);
  await recordAudit(store, actorOf(ctx), {
    action: "lead.enriched",
    summary: `Checked ${r.pages.length} public page(s) for ${lead.company_name}${patch.email ? `; found published address ${patch.email}` : ""}`,
    entityType: "lead", entityId: lead.id, leadId: lead.id,
    metadata: { pages: r.pages, emails_found: r.emails.map((e) => e.email), notes: r.notes },
  });
  return { lead: updated, result: r };
}

// ───────────────────────────────────────── qualification
async function contextFor(ctx: AppContext, lead: Lead): Promise<{ icp: Icp | null; product: Product | null }> {
  const icp = lead.icp_id ? await ctx.store.get("icps", lead.icp_id) : await ctx.store.first("icps", { order: { column: "updated_at", ascending: false } });
  const product = icp?.product_id ? await ctx.store.get("products", icp.product_id) : await ctx.store.first("products", { order: { column: "updated_at", ascending: false } });
  return { icp, product };
}

export async function qualify(ctx: AppContext, leadId: string): Promise<{ lead: Lead; qualification: Qualification }> {
  const { store } = ctx;
  const lead = await store.get("leads", leadId);
  if (!lead) throw new StoreError("Lead not found", "not_found");
  const { icp, product } = await contextFor(ctx, lead);
  if (!product) throw new HttpError(422, "Set up your product first (Setup → Product).");

  const { data, model } = await qualifyLead(product, icp, lead);
  const qualification = await store.insert("lead_qualifications", { lead_id: lead.id, ...data, model });
  const updated = await store.update("leads", lead.id, {
    score: data.score, fit: data.fit, reason: data.reason,
    ...(QUALIFIABLE.includes(lead.status) ? { status: data.matches_icp && data.fit !== "none" ? "qualified" : "disqualified" } : {}),
  });
  await recordAudit(store, actorOf(ctx), {
    action: "lead.qualified", summary: `Qualified ${lead.company_name}: ${data.fit} fit (${data.score})`,
    entityType: "lead", entityId: lead.id, leadId: lead.id, metadata: { model },
  });
  return { lead: updated, qualification };
}

export async function latestQualification(ctx: AppContext, leadId: string) {
  return ctx.store.first("lead_qualifications", { eq: { lead_id: leadId }, order: { column: "created_at", ascending: false } });
}

// ───────────────────────────────────────── drafts
export async function generateDrafts(ctx: AppContext, leadId: string, campaignId?: string | null): Promise<EmailDraft[]> {
  const { store, workspace } = ctx;
  let lead = await store.get("leads", leadId);
  if (!lead) throw new StoreError("Lead not found", "not_found");
  if (lead.status === "do_not_contact") throw new HttpError(422, "This lead is marked Do Not Contact.");
  if (!workspace.sender_name && !workspace.sender_company) throw new HttpError(422, "Add your sender name and company in Settings first — they're used in the signature.");

  let q = await latestQualification(ctx, lead.id);
  if (!q) ({ lead, qualification: q } = await qualify(ctx, lead.id));
  if (q.fit === "none") throw new HttpError(422, "This lead was qualified as not a fit. Re-qualify it if the data has changed.");

  const { product } = await contextFor(ctx, lead);
  if (!product) throw new HttpError(422, "Set up your product first.");

  if (campaignId === undefined) {
    const membership = await store.first("campaign_leads", { eq: { lead_id: lead.id }, order: { column: "created_at", ascending: false } });
    campaignId = membership?.campaign_id ?? null;
  }

  const { data, model } = await generateEmails(product, workspace, lead, q);
  const facts = emailFacts(product, workspace, lead, q);

  // Regenerate replaces unsent drafts; approved/sent history is kept.
  for (const old of await store.list("email_drafts", { eq: { lead_id: lead.id, status: "draft" } })) await store.remove("email_drafts", old.id);

  const drafts: EmailDraft[] = [];
  for (const variant of ["professional", "friendly", "concise"] as const) {
    const e = data.emails.find((x) => x.variant === variant);
    if (!e) continue;
    drafts.push(
      await store.insert("email_drafts", {
        lead_id: lead.id, campaign_id: campaignId, qualification_id: q.id, variant, subject: e.subject.trim(), body: e.body.trim(),
        personalization_used: e.personalization_used, warnings: lintEmail(e.subject, e.body, { facts }), status: "draft", model,
      }),
    );
  }
  if (["new", "qualified", "skipped"].includes(lead.status)) await store.update("leads", lead.id, { status: "draft_ready" });
  await recordAudit(store, actorOf(ctx), {
    action: "email.generated", summary: `Generated ${drafts.length} email drafts for ${lead.company_name}`,
    entityType: "lead", entityId: lead.id, leadId: lead.id, metadata: { model },
  });
  return drafts;
}

export async function editDraft(ctx: AppContext, draftId: string, patch: { subject: string; body: string }) {
  const { store, workspace } = ctx;
  const draft = await store.get("email_drafts", draftId);
  if (!draft) throw new StoreError("Draft not found", "not_found");
  if (!["draft", "blocked", "failed"].includes(draft.status)) throw new HttpError(409, `A ${draft.status} draft can't be edited.`);
  const lead = (await store.get("leads", draft.lead_id))!;
  const { product } = await contextFor(ctx, lead);
  const q = draft.qualification_id ? await store.get("lead_qualifications", draft.qualification_id) : null;
  const warnings = lintEmail(patch.subject, patch.body, { facts: emailFacts(product, workspace, lead, q) });
  const updated = await store.update("email_drafts", draft.id, { ...patch, edited: true, warnings, status: "draft" });
  await recordAudit(store, actorOf(ctx), {
    action: "email.edited", summary: `Edited ${draft.variant} draft for ${lead.company_name}`, entityType: "email_draft", entityId: draft.id, leadId: lead.id,
  });
  return updated;
}

export async function skipLead(ctx: AppContext, leadId: string) {
  const { store } = ctx;
  const lead = await store.get("leads", leadId);
  if (!lead) throw new StoreError("Lead not found", "not_found");
  for (const d of await store.list("email_drafts", { eq: { lead_id: lead.id, status: "draft" } })) await store.update("email_drafts", d.id, { status: "skipped" });
  const updated = lead.status === "do_not_contact" ? lead : await store.update("leads", lead.id, { status: "skipped" });
  await recordAudit(store, actorOf(ctx), { action: "lead.skipped", summary: `Skipped ${lead.company_name}`, entityType: "lead", entityId: lead.id, leadId: lead.id });
  return updated;
}
