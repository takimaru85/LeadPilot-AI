import { fail, ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import type { Lead } from "@/lib/types";
import { LeadEventInput } from "@/lib/validation";

const LABEL = { replied: "a reply", positive_reply: "a positive reply", meeting_booked: "a booked meeting" } as Record<string, string>;

/** Manually log a reply / positive reply / meeting until inbox sync is connected. */
export const POST = withAuth<RouteContext<"/api/leads/[id]/events">>(async (req, ctx, route) => {
  const { id } = await route.params;
  const input = await parseJson(req, LeadEventInput);
  const lead = await ctx.store.get("leads", id);
  if (!lead) return fail(404, "Lead not found.");
  const lastMessage = await ctx.store.first("email_messages", { eq: { lead_id: id, status: "sent" }, order: { column: "sent_at", ascending: false } });
  if (!lastMessage) return fail(409, "No email has been sent to this lead yet.");

  const types = input.type === "meeting_booked" ? ["meeting_booked"] : input.type === "positive_reply" ? ["replied", "positive_reply"] : ["replied"];
  for (const type of types) {
    const exists = await ctx.store.first("email_events", { eq: { lead_id: id, type: type as never } });
    if (exists && type !== "meeting_booked") continue;
    await ctx.store.insert("email_events", {
      message_id: lastMessage.id, lead_id: id, campaign_id: lastMessage.campaign_id, type: type as never, detail: input.detail || null,
    });
  }
  const status: Lead["status"] = input.type === "meeting_booked" ? "meeting" : lead.status === "meeting" ? "meeting" : "replied";
  const updated = await ctx.store.update("leads", id, { status });
  await recordAudit(ctx.store, actorOf(ctx), {
    action: `lead.${input.type}`, summary: `Logged ${LABEL[input.type]} from ${lead.company_name}${input.detail ? `: ${input.detail}` : ""}`,
    entityType: "lead", entityId: id, leadId: id,
  });
  return ok(updated);
});
