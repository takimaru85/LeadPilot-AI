import { ok, parseJson, RATE, withAuth } from "@/lib/api";
import { approveAndSend } from "@/lib/email/queue";
import { ApproveInput } from "@/lib/validation";

export const maxDuration = 60;

/** Approve & Send one specific draft. Requires `confirm: true` from the review screen. */
export const POST = withAuth<RouteContext<"/api/drafts/[id]/approve">>(
  async (req, ctx, route) => {
    const { id } = await route.params;
    const input = await parseJson(req, ApproveInput);
    return ok(await approveAndSend(ctx, id, { subject: input.subject, body: input.body }));
  },
  { rate: RATE.send },
);
