import { ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { IcpInput } from "@/lib/validation";

export const GET = withAuth(async (_req, { store }) => ok(await store.list("icps", { order: { column: "created_at" } })));

export const POST = withAuth(async (req, ctx) => {
  const input = await parseJson(req, IcpInput);
  const icp = await ctx.store.insert("icps", input);
  await recordAudit(ctx.store, actorOf(ctx), { action: "icp.created", summary: `Created ICP “${icp.name}”`, entityType: "icp", entityId: icp.id });
  return ok(icp, { status: 201 });
});
