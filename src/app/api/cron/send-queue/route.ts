import { NextResponse, type NextRequest } from "next/server";
import { getServiceStore } from "@/lib/auth/session";
import { processDueMessages } from "@/lib/email/queue";
import { env } from "@/lib/env";

export const maxDuration = 300;

/**
 * Vercel Cron → processes approved emails that were deferred (limits) or are awaiting retry.
 * Only sends messages a human already approved. Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await processDueMessages(await getServiceStore());
  return NextResponse.json({ data: { processed: results.length, results } });
}
