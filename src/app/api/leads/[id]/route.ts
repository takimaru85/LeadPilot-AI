import { fail, ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import type { Lead } from "@/lib/types";
import { emailType, normalizeDomain, normalizeUrl } from "@/lib/utils";
import { LeadPatch } from "@/lib/validation";

type Ctx = RouteContext<"/api/leads/[id]">;

export const GET = withAuth<Ctx>(async (_req, { store }, route) => {
  const { id } = await route.params;
  const lead = await store.get("leads", id);
  return lead ? ok(lead) : fail(404, "Lead not found.");
});

export const PATCH = withAuth<Ctx>(async (req, ctx, route) => {
  const { id } = await route.params;
  const input = await parseJson(req, LeadPatch);
  const before = await ctx.store.get("leads", id);
  if (!before) return fail(404, "Lead not found.");
  if (before.status === "do_not_contact" && input.status && input.status !== "do_not_contact") {
    return fail(409, "Do Not Contact can't be lifted from the app.");
  }
  const patch: Partial<Lead> = { ...input } as Partial<Lead>;
  if (input.website !== undefined) {
    patch.website = normalizeUrl(input.website);
    patch.domain = normalizeDomain(input.website) ?? before.domain;
  }
  if (input.email !== undefined) {
    patch.email = input.email || null;
    patch.email_type = input.email ? emailType(input.email) : null;
    patch.email_source_url = input.email ? null : before.email_source_url; // user-entered: no public source
  }
  for (const k of ["contact_name", "contact_title"] as const) if (input[k] !== undefined) patch[k] = input[k] || null;
  const lead = await ctx.store.update("leads", id, patch);
  await recordAudit(ctx.store, actorOf(ctx), {
    action: "lead.updated", summary: `Updated ${lead.company_name} (${Object.keys(input).join(", ")})`, entityType: "lead", entityId: id, leadId: id,
  });
  return ok(lead);
});

export const DELETE = withAuth<Ctx>(async (_req, ctx, route) => {
  const { id } = await route.params;
  const lead = await ctx.store.get("leads", id);
  if (!lead) return fail(404, "Lead not found.");
  await ctx.store.remove("leads", id);
  await recordAudit(ctx.store, actorOf(ctx), { action: "lead.deleted", summary: `Deleted lead ${lead.company_name}`, entityType: "lead", entityId: id });
  return ok({ id });
});
