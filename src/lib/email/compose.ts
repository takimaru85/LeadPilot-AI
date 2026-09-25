import "server-only";
import { unsubscribeToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import type { EmailDraft, Lead, Workspace } from "@/lib/types";

export interface ComposedEmail {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  headers: Record<string, string>;
}

/** Human-facing page (confirm button). */
export function unsubscribeUrl(workspaceId: string, email: string) {
  return `${env.appUrl}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(workspaceId, email))}`;
}

/** RFC 8058 one-click endpoint: mail clients POST here directly. */
export function oneClickUnsubscribeUrl(workspaceId: string, email: string) {
  return `${env.appUrl}/api/unsubscribe?t=${encodeURIComponent(unsubscribeToken(workspaceId, email))}`;
}

/**
 * Footer required on every outreach email: who is sending, a real postal address,
 * why the recipient is getting it, and a working unsubscribe link.
 */
export function complianceFooter(ws: Workspace, lead: Pick<Lead, "email" | "source">, url: string) {
  const why =
    lead.source === "csv_import" || lead.source === "manual"
      ? "You're receiving this because your business address was provided to us as a potential contact."
      : "You're receiving this because this address is published as a business contact on your website or business listing.";
  return [
    "—",
    [ws.sender_company || ws.sender_name, ws.postal_address].filter(Boolean).join(" · "),
    why,
    `Not relevant? Unsubscribe with one click: ${url}`,
  ].join("\n");
}

export function composeEmail(ws: Workspace, lead: Lead, draft: Pick<EmailDraft, "subject" | "body">, fromEmail: string, fromName: string): ComposedEmail {
  if (!lead.email) throw new Error("Lead has no email address");
  const url = unsubscribeUrl(ws.id, lead.email);
  return {
    to: lead.email,
    from: fromName ? `${fromName.replace(/[<>"]/g, "")} <${fromEmail}>` : fromEmail,
    replyTo: ws.reply_to || undefined,
    subject: draft.subject.trim(),
    text: `${draft.body.trim()}\n\n${complianceFooter(ws, lead, url)}\n`,
    headers: {
      // RFC 8058 one-click unsubscribe — required by Gmail/Yahoo bulk-sender rules.
      "List-Unsubscribe": `<${oneClickUnsubscribeUrl(ws.id, lead.email)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
