import { ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { ProductInput } from "@/lib/validation";

export const GET = withAuth(async (_req, { store }) => ok(await store.list("products", { order: { column: "created_at" } })));

export const POST = withAuth(async (req, ctx) => {
  const input = await parseJson(req, ProductInput);
  const product = await ctx.store.insert("products", input);
  await recordAudit(ctx.store, actorOf(ctx), { action: "product.created", summary: `Created product “${product.name}”`, entityType: "product", entityId: product.id });
  return ok(product, { status: 201 });
});
