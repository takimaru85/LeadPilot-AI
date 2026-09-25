import { ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { IcpPatch } from "@/lib/validation";

type Ctx = RouteContext<"/api/icps/[id]">;

export const PATCH = withAuth<Ctx>(async (req, ctx, route) => {
  const { id } = await route.params;
  const input = await parseJson(req, IcpPatch);
  const icp = await ctx.store.update("icps", id, input);
  await recordAudit(ctx.store, actorOf(ctx), { action: "icp.updated", summary: `Updated ICP “${icp.name}”`, entityType: "icp", entityId: id });
  return ok(icp);
});

export const DELETE = withAuth<Ctx>(async (_req, ctx, route) => {
  const { id } = await route.params;
  await ctx.store.remove("icps", id);
  await recordAudit(ctx.store, actorOf(ctx), { action: "icp.deleted", summary: "Deleted an ICP", entityType: "icp", entityId: id });
  return ok({ id });
});
