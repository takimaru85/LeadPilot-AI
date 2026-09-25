import { ok, RATE, withAuth } from "@/lib/api";
import { processMessage } from "@/lib/email/queue";

export const maxDuration = 120;

/** "Process queue now" for this workspace — handy locally where Vercel Cron doesn't run. */
export const POST = withAuth(
  async (_req, ctx) => {
    const due = await ctx.store.list("email_messages", {
      eq: { status: "queued" },
      lte: { next_attempt_at: new Date().toISOString() },
      order: { column: "next_attempt_at", ascending: true },
      limit: 10,
    });
    const results = [];
    for (const m of due) {
      const r = await processMessage(ctx.store, m.id);
      results.push({ id: m.id, outcome: r.outcome, note: r.note });
    }
    return ok({ processed: results.length, results });
  },
  { rate: RATE.send },
);
