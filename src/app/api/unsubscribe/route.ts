import { NextResponse, type NextRequest } from "next/server";
import { processUnsubscribe } from "@/lib/services/unsubscribe";

/**
 * RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). Mail providers POST here directly.
 * GET is intentionally not an unsubscribe action (link scanners would trigger it); the
 * /unsubscribe page shows a confirm button instead.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? (await req.formData().catch(() => null))?.get("t")?.toString() ?? "";
  try {
    const r = await processUnsubscribe(token);
    if (!r.ok) return NextResponse.json({ error: "Invalid or expired link." }, { status: 400 });
    return NextResponse.json({ data: { unsubscribed: true } });
  } catch (e) {
    console.error("[unsubscribe]", e);
    return NextResponse.json({ error: "Could not process unsubscribe. Please reply to the email instead." }, { status: 500 });
  }
}
