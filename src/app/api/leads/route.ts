import { ok, parseJson, withAuth } from "@/lib/api";
import { listLeads, parseLeadFilters } from "@/lib/services/lead-queries";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { addLeads } from "@/lib/services/leads";
import { normalizeDomain } from "@/lib/utils";
import { ManualLeadInput } from "@/lib/validation";

/** GET /api/leads?q=&status=&min_score=&campaign=&page= */
export const GET = withAuth(async (req, ctx) => {
  const filters = parseLeadFilters(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listLeads(ctx.store, filters));
});

/** Manually add one lead. The user is responsible for the source of any contact details they enter. */
export const POST = withAuth(async (req, ctx) => {
  const input = await parseJson(req, ManualLeadInput);
  const res = await addLeads(
    ctx,
    [{
      company_name: input.company_name, website: input.website || null, domain: normalizeDomain(input.website || input.email),
      industry: input.industry, location: input.location, description: input.description, phone: null,
      email: input.email || null, contact_name: input.contact_name || null, contact_title: input.contact_title || null,
      consent_basis: input.consent_basis, source: "manual", source_ref: null, source_url: null,
    }],
    { icpId: input.icp_id, searchId: null },
  );
  if (!res.added.length) {
    return ok({ added: 0, message: res.suppressed.length ? "That domain is on your suppression list." : "A lead for that domain already exists." }, { status: 409 });
  }
  await recordAudit(ctx.store, actorOf(ctx), {
    action: "lead.created", summary: `Added ${input.company_name} manually`, entityType: "lead", entityId: res.added[0].id, leadId: res.added[0].id,
  });
  return ok(res.added[0], { status: 201 });
});
