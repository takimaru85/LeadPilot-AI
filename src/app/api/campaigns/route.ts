import { ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { CampaignInput } from "@/lib/validation";

export const GET = withAuth(async (_req, { store }) => ok(await store.list("campaigns", { order: { column: "created_at", ascending: false } })));

export const POST = withAuth(async (req, ctx) => {
  const input = await parseJson(req, CampaignInput);
  const campaign = await ctx.store.insert("campaigns", { ...input, status: "draft" });
  await recordAudit(ctx.store, actorOf(ctx), { action: "campaign.created", summary: `Created campaign “${campaign.name}”`, entityType: "campaign", entityId: campaign.id });
  return ok(campaign, { status: 201 });
});
