import { fail, ok, withAuth } from "@/lib/api";
import { getTransport } from "@/lib/email/transports";
import { actorOf, recordAudit } from "@/lib/services/audit";

/** Verifies credentials/connection without sending an email. */
export const POST = withAuth<RouteContext<"/api/sending-accounts/[id]/test">>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    const account = await ctx.store.get("sending_accounts", id);
    if (!account) return fail(404, "Account not found.");
    const r = await getTransport(account).verify();
    await ctx.store.update("sending_accounts", id, { last_error: r.ok ? null : (r.error ?? "Verification failed"), ...(r.ok && account.status === "error" ? { status: "active" } : {}) });
    await recordAudit(ctx.store, actorOf(ctx), {
      action: "sending_account.tested", summary: `Connection test for “${account.label}”: ${r.ok ? "OK" : r.error}`, entityType: "sending_account", entityId: id,
    });
    return ok(r);
  },
  { rate: { bucket: "account-test", limit: 10, windowMs: 60_000 } },
);
