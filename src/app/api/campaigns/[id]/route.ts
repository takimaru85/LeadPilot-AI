import { fail, ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import type { CampaignStatus } from "@/lib/types";
import { CampaignPatch } from "@/lib/validation";

type Ctx = RouteContext<"/api/campaigns/[id]">;

const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["running", "completed"],
  running: ["paused", "completed"],
  paused: ["running", "completed"],
  completed: [],
};

export const PATCH = withAuth<Ctx>(async (req, ctx, route) => {
  const { id } = await route.params;
  const input = await parseJson(req, CampaignPatch);
  const before = await ctx.store.get("campaigns", id);
  if (!before) return fail(404, "Campaign not found.");
  if (input.status && input.status !== before.status && !TRANSITIONS[before.status].includes(input.status)) {
    return fail(409, `A ${before.status} campaign can't be set to ${input.status}.`);
  }
  if (input.status === "running" && !(input.sending_account_id ?? before.sending_account_id)) {
    const any = await ctx.store.first("sending_accounts", { eq: { status: "active" } });
    if (!any) return fail(422, "Connect a sending account before starting a campaign.");
  }
  const campaign = await ctx.store.update("campaigns", id, input);
  await recordAudit(ctx.store, actorOf(ctx), {
    action: input.status && input.status !== before.status ? `campaign.${input.status}` : "campaign.updated",
    summary: input.status && input.status !== before.status ? `Campaign “${campaign.name}” is now ${input.status}` : `Updated campaign “${campaign.name}”`,
    entityType: "campaign", entityId: id,
  });
  return ok(campaign);
});

export const DELETE = withAuth<Ctx>(async (_req, ctx, route) => {
  const { id } = await route.params;
  const c = await ctx.store.get("campaigns", id);
  if (!c) return fail(404, "Campaign not found.");
  const sent = await ctx.store.count("email_messages", { eq: { campaign_id: id } });
  if (sent) return fail(409, "Campaigns with sent email can't be deleted — mark it completed instead.");
  await ctx.store.remove("campaigns", id);
  await recordAudit(ctx.store, actorOf(ctx), { action: "campaign.deleted", summary: `Deleted campaign “${c.name}”`, entityType: "campaign", entityId: id });
  return ok({ id });
});
