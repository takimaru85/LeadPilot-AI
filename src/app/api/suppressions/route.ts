import { ok, parseJson, withAuth } from "@/lib/api";
import { StoreError } from "@/lib/db/store";
import { actorOf } from "@/lib/services/audit";
import { addSuppression } from "@/lib/services/suppressions";
import { SuppressionInput } from "@/lib/validation";

export const GET = withAuth(async (_req, { store }) => ok(await store.list("suppressions", { order: { column: "created_at", ascending: false }, limit: 1000 })));

/** Add emails and/or domains. There is intentionally no DELETE: suppressions are permanent in-app. */
export const POST = withAuth(async (req, ctx) => {
  const { values, reason } = await parseJson(req, SuppressionInput);
  const added: string[] = [];
  const invalid: string[] = [];
  for (const value of values) {
    try {
      const s = await addSuppression(ctx.store, actorOf(ctx), { value, reason, source: "manual" });
      added.push(s.value);
    } catch (e) {
      if (e instanceof StoreError && e.code === "conflict") invalid.push(value);
      else throw e;
    }
  }
  return ok({ added, invalid });
});
