import { fail, ok, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";

/** Skip a single draft variant (the lead stays as-is). */
export const POST = withAuth<RouteContext<"/api/drafts/[id]/skip">>(async (_req, ctx, route) => {
  const { id } = await route.params;
  const draft = await ctx.store.get("email_drafts", id);
  if (!draft) return fail(404, "Draft not found.");
  if (draft.status !== "draft") return fail(409, `A ${draft.status} draft can't be skipped.`);
  const updated = await ctx.store.update("email_drafts", id, { status: "skipped" });
  await recordAudit(ctx.store, actorOf(ctx), { action: "email.skipped", summary: `Skipped ${draft.variant} draft “${draft.subject}”`, entityType: "email_draft", entityId: id, leadId: draft.lead_id });
  return ok(updated);
});
