import { fail, ok, parseJson, withAuth } from "@/lib/api";
import { StoreError } from "@/lib/db/store";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { CampaignLeadsInput } from "@/lib/validation";

type Ctx = RouteContext<"/api/campaigns/[id]/leads">;

export const POST = withAuth<Ctx>(async (req, ctx, route) => {
  const { id } = await route.params;
  const { lead_ids } = await parseJson(req, CampaignLeadsInput);
  const campaign = await ctx.store.get("campaigns", id);
  if (!campaign) return fail(404, "Campaign not found.");
  let added = 0;
  for (const lead_id of lead_ids) {
    try {
      await ctx.store.insert("campaign_leads", { campaign_id: id, lead_id });
      added++;
    } catch (e) {
      if (!(e instanceof StoreError && e.code === "conflict")) throw e;
    }
  }
  await recordAudit(ctx.store, actorOf(ctx), { action: "campaign.leads_added", summary: `Added ${added} leads to “${campaign.name}”`, entityType: "campaign", entityId: id });
  return ok({ added });
});

export const DELETE = withAuth<Ctx>(async (req, ctx, route) => {
  const { id } = await route.params;
  const { lead_ids } = await parseJson(req, CampaignLeadsInput);
  const rows = await ctx.store.list("campaign_leads", { eq: { campaign_id: id }, in: { lead_id: lead_ids } });
  for (const r of rows) await ctx.store.remove("campaign_leads", r.id);
  await recordAudit(ctx.store, actorOf(ctx), { action: "campaign.leads_removed", summary: `Removed ${rows.length} leads from a campaign`, entityType: "campaign", entityId: id });
  return ok({ removed: rows.length });
});
