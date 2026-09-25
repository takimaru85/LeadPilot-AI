import { fail, ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { SendingAccountPatch } from "@/lib/validation";
import { redact } from "@/lib/services/accounts";

type Ctx = RouteContext<"/api/sending-accounts/[id]">;

export const PATCH = withAuth<Ctx>(async (req, ctx, route) => {
  const { id } = await route.params;
  const input = await parseJson(req, SendingAccountPatch);
  const before = await ctx.store.get("sending_accounts", id);
  if (!before) return fail(404, "Account not found.");
  if (input.status === "active" && before.status === "needs_auth") return fail(409, "This account must be connected before it can be activated.");
  const account = await ctx.store.update("sending_accounts", id, input);
  await recordAudit(ctx.store, actorOf(ctx), {
    action: "sending_account.updated", summary: `Updated sending account “${account.label}” (${Object.keys(input).join(", ")})`, entityType: "sending_account", entityId: id,
  });
  return ok(redact(account));
});

export const DELETE = withAuth<Ctx>(async (_req, ctx, route) => {
  const { id } = await route.params;
  const account = await ctx.store.get("sending_accounts", id);
  if (!account) return fail(404, "Account not found.");
  const queued = await ctx.store.count("email_messages", { eq: { account_id: id, status: "queued" } });
  if (queued) return fail(409, `${queued} queued email(s) use this account. Pause it instead, or wait for the queue to clear.`);
  await ctx.store.remove("sending_accounts", id);
  await recordAudit(ctx.store, actorOf(ctx), { action: "sending_account.deleted", summary: `Removed sending account “${account.label}”`, entityType: "sending_account", entityId: id });
  return ok({ id });
});
