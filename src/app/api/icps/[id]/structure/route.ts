import { structureIcp } from "@/lib/ai";
import { fail, ok, RATE, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";

export const maxDuration = 120;

/** AI: turn the rough ICP inputs + product into a structured profile. */
export const POST = withAuth<RouteContext<"/api/icps/[id]/structure">>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    const icp = await ctx.store.get("icps", id);
    if (!icp) return fail(404, "ICP not found.");
    const product = icp.product_id ? await ctx.store.get("products", icp.product_id) : null;
    const { data, model } = await structureIcp(product, icp);
    const updated = await ctx.store.update("icps", id, { structured: data, structured_by: model });
    await recordAudit(ctx.store, actorOf(ctx), { action: "icp.structured", summary: `Structured ICP “${icp.name}”`, entityType: "icp", entityId: id, metadata: { model } });
    return ok(updated);
  },
  { rate: RATE.ai },
);
