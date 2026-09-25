import { HttpError, ok, parseJson, RATE, toErrorResponse, withAuth } from "@/lib/api";
import { StoreError } from "@/lib/db/store";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { enrichLead, generateDrafts, qualify, skipLead } from "@/lib/services/leads";
import { BulkLeadAction } from "@/lib/validation";

export const maxDuration = 300;

/**
 * Bulk actions over up to 25 leads. Deliberately excludes sending: every email still
 * needs its own review and approval.
 */
export const POST = withAuth(
  async (req, ctx) => {
    const { action, ids, campaign_id } = await parseJson(req, BulkLeadAction);
    const results: { id: string; ok: boolean; error?: string }[] = [];

    if (action === "add_to_campaign") {
      if (!campaign_id) throw new HttpError(400, "Choose a campaign.");
      const campaign = await ctx.store.get("campaigns", campaign_id);
      if (!campaign) throw new StoreError("Campaign not found", "not_found");
      for (const id of ids) {
        try {
          await ctx.store.insert("campaign_leads", { campaign_id, lead_id: id });
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: e instanceof StoreError && e.code === "conflict", error: e instanceof StoreError && e.code === "conflict" ? "Already in campaign" : "Failed" });
        }
      }
      await recordAudit(ctx.store, actorOf(ctx), {
        action: "campaign.leads_added", summary: `Added ${results.filter((r) => r.ok).length} leads to “${campaign.name}”`, entityType: "campaign", entityId: campaign_id,
      });
      return ok({ results });
    }

    for (const id of ids) {
      try {
        if (action === "qualify") await qualify(ctx, id);
        else if (action === "generate") await generateDrafts(ctx, id);
        else if (action === "enrich") {
          const r = await enrichLead(ctx, id);
          if (!r.result.ok) throw new HttpError(422, r.result.reason);
        } else if (action === "skip") await skipLead(ctx, id);
        results.push({ id, ok: true });
      } catch (e) {
        const body = await toErrorResponse(e).json();
        results.push({ id, ok: false, error: body.error });
        if (e instanceof Error && e.name === "AiError" && /rate limit|API key/i.test(e.message)) break; // no point continuing
      }
    }
    return ok({ results });
  },
  { rate: { bucket: "bulk", limit: 6, windowMs: RATE.ai.windowMs } },
);
