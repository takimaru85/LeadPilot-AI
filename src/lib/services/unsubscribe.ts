import "server-only";
import { getServiceStore } from "@/lib/auth/session";
import { parseUnsubscribeToken } from "@/lib/crypto";
import { addSuppression } from "./suppressions";

/**
 * Honour an unsubscribe immediately. Uses the service store (no user session) scoped to the
 * workspace encoded in the HMAC-signed token. Idempotent.
 */
export async function processUnsubscribe(token: string): Promise<{ ok: boolean; email?: string }> {
  const parsed = parseUnsubscribeToken(token);
  if (!parsed) return { ok: false };
  const store = (await getServiceStore()).forWorkspace(parsed.workspaceId);
  const already = await store.first("suppressions", { eq: { value: parsed.email } });
  if (!already) {
    await addSuppression(store, { id: null, label: "Recipient" }, { value: parsed.email, reason: "unsubscribed", source: "unsubscribe_link" });
    const lastMsg = await store.first("email_messages", { eq: { to_email: parsed.email }, order: { column: "created_at", ascending: false } });
    await store.insert("email_events", {
      message_id: lastMsg?.id ?? null, lead_id: lastMsg?.lead_id ?? null, campaign_id: lastMsg?.campaign_id ?? null, type: "unsubscribed", detail: "Unsubscribe link",
    });
  }
  return { ok: true, email: parsed.email };
}
