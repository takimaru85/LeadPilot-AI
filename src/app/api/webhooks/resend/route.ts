import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServiceStore } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { SYSTEM_ACTOR, recordAudit } from "@/lib/services/audit";
import { addSuppression } from "@/lib/services/suppressions";

/** Svix signature verification (the scheme Resend webhooks use). */
function verifySvix(body: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay window
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

interface ResendEvent {
  type: string;
  data: { email_id?: string; bounce?: { message?: string; type?: string } };
}

/** Delivery, bounce and complaint events → email_events + automatic suppression. */
export async function POST(req: NextRequest) {
  if (!env.resendWebhookSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const body = await req.text();
  if (!verifySvix(body, req.headers, env.resendWebhookSecret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const event = JSON.parse(body) as ResendEvent;
  const emailId = event.data?.email_id;
  if (!emailId) return NextResponse.json({ data: { ignored: true } });

  const service = await getServiceStore();
  const msg = await service.first("email_messages", { eq: { provider_message_id: emailId } });
  if (!msg) return NextResponse.json({ data: { ignored: true } }); // not ours / already deleted
  const store = service.forWorkspace(msg.workspace_id);

  const map: Record<string, "delivered" | "bounced" | "complained" | undefined> = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
  };
  const type = map[event.type];
  if (!type) return NextResponse.json({ data: { ignored: true } });

  const dup = await store.first("email_events", { eq: { message_id: msg.id, type } });
  if (!dup) {
    await store.insert("email_events", {
      message_id: msg.id, lead_id: msg.lead_id, campaign_id: msg.campaign_id, type,
      detail: event.data.bounce?.message ?? null,
    });
  }
  // Soft/transient bounces are not suppressed; hard ("Permanent") bounces and complaints are.
  if ((type === "bounced" && event.data.bounce?.type !== "Transient") || type === "complained") {
    await addSuppression(store, SYSTEM_ACTOR, { value: msg.to_email, reason: type === "bounced" ? "bounced" : "complained", source: "resend_webhook" });
    await recordAudit(store, SYSTEM_ACTOR, {
      action: `email.${type}`, summary: `${type === "bounced" ? "Hard bounce" : "Spam complaint"} from ${msg.to_email} — suppressed`,
      entityType: "email_message", entityId: msg.id, leadId: msg.lead_id,
    });
  }
  return NextResponse.json({ data: { ok: true } });
}
