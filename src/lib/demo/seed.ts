import "server-only";
import { heuristicEmails, heuristicQualify, heuristicStructureIcp, HEURISTIC_MODEL } from "@/lib/ai/heuristics";
import { emailFacts } from "@/lib/compliance/facts";
import { lintEmail } from "@/lib/compliance/email-lint";
import { MemoryStore, persistDemoDb, type DemoDb } from "@/lib/db/memory-store";
import { composeEmail } from "@/lib/email/compose";
import type { Lead, TenantTable, Workspace } from "@/lib/types";
import { emailType } from "@/lib/utils";
import { DEMO_CATALOG } from "./catalog";

export const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER = { id: "00000000-0000-4000-8000-0000000000aa", email: "demo@leadpilot.example", name: "Alex Morgan" };

const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();

/** Seeds a realistic, fully fictional workspace so every screen can be exercised without external APIs. */
export async function seedDemo(db: DemoDb): Promise<void> {
  const now = new Date().toISOString();
  const ws: Workspace = {
    id: DEMO_WORKSPACE_ID,
    name: "Northlight Web Studio (demo)",
    sender_name: "Alex Morgan",
    sender_company: "Northlight Web Studio",
    sender_title: "Founder",
    postal_address: "PO Box 123, Brisbane QLD 4001, Australia",
    reply_to: "alex@northlight.example",
    website: "https://northlight.example",
    daily_send_cap: 50,
    dedupe_window_days: 90,
    role_emails_only: true,
    created_by: DEMO_USER.id,
    created_at: ago(21),
    updated_at: now,
  };
  db.workspaces.push(ws);
  const store = new MemoryStore(db, ws.id);

  /** Seed-only: rewrite timestamps so charts and activity have history. */
  const backdate = (table: TenantTable, id: string, patch: Record<string, unknown>) => {
    const row = (db[table] as { id: string }[]).find((r) => r.id === id);
    if (row) Object.assign(row, patch);
  };
  const audit = async (action: string, summary: string, when: string, entity: { type: string; id: string | null; lead?: string | null }) => {
    const a = await store.insert("audit_log", {
      actor_id: DEMO_USER.id, actor_label: DEMO_USER.name, action, entity_type: entity.type, entity_id: entity.id,
      lead_id: entity.lead ?? null, summary, metadata: {},
    });
    backdate("audit_log", a.id, { created_at: when });
  };

  const product = await store.insert("products", {
    name: "WordPress Website Care & Rebuilds",
    description: "Fast, mobile-friendly WordPress websites for healthcare practices, with online booking integration and ongoing care plans.",
    target_customer: "independent dental and allied health practices",
    industry: "Dental / healthcare",
    location: "Australia",
    company_size: "1–50 employees",
    customer_problem: "Outdated, slow or hard-to-update websites that make it harder for new patients to find the practice and book.",
    why_buy: "Practices get a modern site with online booking in 4–6 weeks, without having to manage developers.",
    website_url: "https://northlight.example",
    pricing: "Rebuilds from $6,500; care plans from $149/month",
  });
  backdate("products", product.id, { created_at: ago(20) });
  await audit("product.created", `Created product “${product.name}”`, ago(20), { type: "product", id: product.id });

  const icpInputs = {
    name: "Independent dental clinics — Australia",
    industries: ["Dental"],
    business_types: ["Dental clinic", "Orthodontist", "Paediatric dentist"],
    locations: ["Australia"],
    company_sizes: ["1–50 employees"],
    job_titles: ["Practice Owner", "Principal Dentist", "Practice Manager"],
    pain_points: ["Outdated website", "No online booking", "Hard to update content"],
    buying_signals: ["Old copyright year on website", "Phone-only booking", "New location or rebrand"],
    keywords: ["online booking", "WordPress"],
  };
  const icp = await store.insert("icps", {
    ...icpInputs,
    product_id: product.id,
    structured: heuristicStructureIcp(product, icpInputs),
    structured_by: HEURISTIC_MODEL,
  });
  await audit("icp.structured", `Structured ICP “${icp.name}”`, ago(20), { type: "icp", id: icp.id });

  const search = await store.insert("lead_searches", {
    icp_id: icp.id, provider: "demo", query: "dental clinic", location: "Australia", status: "completed", result_count: 14, added_count: 14,
  });
  backdate("lead_searches", search.id, { created_at: ago(18) });
  await audit("leads.search", "Searched “dental clinic” in Australia — 14 leads added", ago(18), { type: "lead_search", id: search.id });

  const account = await store.insert("sending_accounts", {
    provider: "sandbox", label: "Demo sandbox (no real email is sent)", from_email: "alex@northlight.example", from_name: "Alex Morgan",
    daily_limit: 30, per_minute_limit: 2, warmup_enabled: true, status: "active",
  });

  const campaign = await store.insert("campaigns", {
    name: "WordPress Website Outreach",
    description: "Offer website rebuilds with online booking to independent dental practices showing signs of an outdated site.",
    audience: "Dental clinics in Australia",
    product_id: product.id, icp_id: icp.id, sending_account_id: account.id, status: "running",
  });
  backdate("campaigns", campaign.id, { created_at: ago(17) });
  await audit("campaign.created", `Created campaign “${campaign.name}”`, ago(17), { type: "campaign", id: campaign.id });

  // Leads: the Australian dental practices + two physios for contrast.
  const picks = DEMO_CATALOG.filter((b) => b.country === "Australia").slice(0, 14);
  const leads: Lead[] = [];
  for (const [i, b] of picks.entries()) {
    const enriched = i < 12;
    const lead = await store.insert("leads", {
      icp_id: icp.id, search_id: search.id, company_name: b.company_name, domain: b.domain, website: `https://${b.domain}`,
      industry: b.industry, location: `${b.city}, ${b.region}, ${b.country}`, description: b.description,
      site_excerpt: enriched ? b.site_text : null, phone: b.phone,
      // Emails only exist once the public website has been checked (enrichment).
      email: enriched ? b.email : null, email_type: enriched && b.email ? emailType(b.email) : null,
      email_source_url: enriched && b.email ? `https://${b.domain}/contact` : null,
      contact_name: enriched ? b.contact_name : null, contact_title: enriched ? b.contact_title : null,
      source: "demo", source_ref: `demo:${b.domain}`, source_url: `https://${b.domain}`,
      consent_basis: enriched && b.email ? "conspicuous_publication" : "unknown", status: "new",
      enriched_at: enriched ? ago(17) : null,
    });
    backdate("leads", lead.id, { created_at: ago(18, i) });
    leads.push(lead);
  }

  // Qualify the first ten.
  for (const [i, lead] of leads.slice(0, 10).entries()) {
    const q = heuristicQualify(product, icp, lead);
    const row = await store.insert("lead_qualifications", { lead_id: lead.id, ...q, model: HEURISTIC_MODEL });
    backdate("lead_qualifications", row.id, { created_at: ago(16, i) });
    const updated = await store.update("leads", lead.id, {
      score: q.score, fit: q.fit, reason: q.reason, status: q.matches_icp && q.fit !== "none" ? "qualified" : "disqualified",
    });
    leads[i] = updated;
    await audit("lead.qualified", `Qualified ${lead.company_name}: ${q.fit} fit (${q.score})`, ago(16, i), { type: "lead", id: lead.id, lead: lead.id });
  }

  const byName = (name: string) => leads.find((l) => l.company_name === name)!;
  const makeDrafts = async (lead: Lead, when: string) => {
    const q = (await store.first("lead_qualifications", { eq: { lead_id: lead.id }, order: { column: "created_at", ascending: false } }))!;
    const { emails } = heuristicEmails(product, ws, lead, q);
    const facts = emailFacts(product, ws, lead, q);
    const drafts = [];
    for (const e of emails) {
      const d = await store.insert("email_drafts", {
        lead_id: lead.id, campaign_id: campaign.id, qualification_id: q.id, variant: e.variant, subject: e.subject, body: e.body,
        personalization_used: e.personalization_used, warnings: lintEmail(e.subject, e.body, { facts }), status: "draft", model: HEURISTIC_MODEL,
      });
      backdate("email_drafts", d.id, { created_at: when, updated_at: when });
      drafts.push(d);
    }
    await store.update("leads", lead.id, { status: "draft_ready" });
    return drafts;
  };

  const send = async (lead: Lead, daysAgo: number, outcome: "delivered" | "bounced" | "replied" | "positive" | "meeting") => {
    const drafts = await makeDrafts(lead, ago(daysAgo, 2));
    const d = drafts[0];
    await store.update("email_drafts", d.id, { status: "sent" });
    for (const other of drafts.slice(1)) await store.update("email_drafts", other.id, { status: "skipped" });
    const composed = composeEmail(ws, lead, d, account.from_email, account.from_name);
    const msg = await store.insert("email_messages", {
      draft_id: d.id, lead_id: lead.id, campaign_id: campaign.id, account_id: account.id, to_email: lead.email!, to_domain: lead.domain!,
      subject: composed.subject, body_text: composed.text, status: "sent", attempts: 1, provider_message_id: `sandbox_${d.id.slice(0, 8)}`,
      sent_at: ago(daysAgo),
    });
    backdate("email_messages", msg.id, { created_at: ago(daysAgo) });
    await audit("email.sent", `Approved and sent “${d.subject}” to ${lead.email}`, ago(daysAgo), { type: "email_message", id: msg.id, lead: lead.id });
    const ev = async (type: "delivered" | "bounced" | "replied" | "positive_reply" | "meeting_booked", after: number, detail: string | null = null) => {
      const e = await store.insert("email_events", { message_id: msg.id, lead_id: lead.id, campaign_id: campaign.id, type, detail });
      backdate("email_events", e.id, { created_at: ago(daysAgo - after) });
    };
    let status: Lead["status"] = "contacted";
    if (outcome === "bounced") {
      await ev("bounced", 0, "550 5.1.1 Mailbox does not exist");
      await store.insert("suppressions", { value: lead.email!, kind: "email", reason: "bounced", source: "provider_webhook" });
    } else {
      await ev("delivered", 0);
      if (outcome === "replied" || outcome === "positive" || outcome === "meeting") {
        await ev("replied", 1, "Reply received");
        status = "replied";
      }
      if (outcome === "positive" || outcome === "meeting") await ev("positive_reply", 1, "Interested — asked for examples");
      if (outcome === "meeting") {
        await ev("meeting_booked", 2, "Intro call booked");
        status = "meeting";
      }
    }
    await store.update("leads", lead.id, { status, last_contacted_at: ago(daysAgo) });
  };

  await send(byName("Harbourside Family Dental"), 9, "meeting");
  await send(byName("Kingsford Dental Care"), 6, "positive");
  await send(byName("Southbank Dental Studio"), 4, "replied");
  await send(byName("Perth Hills Dental"), 3, "delivered");
  await send(byName("Gold Coast Kids Dentistry"), 2, "bounced");
  await makeDrafts(byName("Canberra Smile Centre"), ago(0, 5));
  await makeDrafts(byName("Northside Orthodontics"), ago(0, 3));

  const skipped = byName("Adelaide Central Dental");
  await store.update("leads", skipped.id, { status: "skipped" });
  await audit("lead.skipped", `Skipped ${skipped.company_name}`, ago(1), { type: "lead", id: skipped.id, lead: skipped.id });

  // A recipient who unsubscribed via a previous campaign.
  await store.insert("suppressions", { value: "info@geelongdental.example", kind: "email", reason: "unsubscribed", source: "unsubscribe_link" });
  await store.update("leads", byName("Geelong Coastal Dental").id, { status: "do_not_contact" });

  for (const lead of leads.slice(0, 12)) {
    await store.insert("campaign_leads", { campaign_id: campaign.id, lead_id: lead.id });
  }
  persistDemoDb();
}
