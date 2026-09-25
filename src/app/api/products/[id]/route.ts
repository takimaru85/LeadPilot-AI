import { ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { ProductPatch } from "@/lib/validation";

type Ctx = RouteContext<"/api/products/[id]">;

export const PATCH = withAuth<Ctx>(async (req, ctx, route) => {
  const { id } = await route.params;
  const input = await parseJson(req, ProductPatch);
  const product = await ctx.store.update("products", id, input);
  await recordAudit(ctx.store, actorOf(ctx), { action: "product.updated", summary: `Updated product “${product.name}”`, entityType: "product", entityId: id });
  return ok(product);
});

export const DELETE = withAuth<Ctx>(async (_req, ctx, route) => {
  const { id } = await route.params;
  await ctx.store.remove("products", id);
  await recordAudit(ctx.store, actorOf(ctx), { action: "product.deleted", summary: "Deleted a product", entityType: "product", entityId: id });
  return ok({ id });
});
