import "server-only";
import type { Store } from "@/lib/db/store";
import type { Campaign, EmailDraft, Lead, SendingAccount, Workspace } from "@/lib/types";
import { daysAgoIso, emailDomain, isValidEmail, startOfDayIso } from "@/lib/utils";

/**
 * The single gate every email passes through — at approval time and again at send time
 * (a suppression or pause can land in between). Limits are computed from the database,
 * so they hold across server instances.
 */
export interface GuardInput {
  workspace: Workspace;
  lead: Lead;
  draft: EmailDraft;
  account: SendingAccount | null;
  campaign: Campaign | null;
  /** The queued message being processed, excluded from duplicate checks. */
  messageId?: string;
}

export interface GuardResult {
  /** Reasons the email must not be sent. */
  blocking: string[];
  /** Not blocked, but must wait (rate / daily limits). */
  deferUntil: Date | null;
  deferReason: string | null;
}

/** Warm-up: new accounts start at 5/day and gain 3/day until the configured limit. */
export function effectiveDailyLimit(account: SendingAccount, now = new Date()): number {
  if (!account.warmup_enabled) return account.daily_limit;
  const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(account.created_at).getTime()) / 86_400_000));
  return Math.min(account.daily_limit, 5 + ageDays * 3);
}

export async function checkSendable(store: Store, input: GuardInput, now = new Date()): Promise<GuardResult> {
  const { workspace: ws, lead, draft, account, campaign } = input;
  const blocking: string[] = [];

  // Sender identity is legally required in the footer.
  if (!ws.postal_address.trim()) blocking.push("Add your business postal address in Settings — it's required in every email footer.");
  if (!ws.sender_name.trim() && !ws.sender_company.trim()) blocking.push("Add your sender name or company in Settings.");

  // Recipient.
  const email = lead.email?.trim().toLowerCase() ?? "";
  if (!isValidEmail(email)) blocking.push("This lead has no valid public email address.");
  if (ws.role_emails_only && lead.email_type === "personal") {
    blocking.push("This is a personal address. Your workspace only allows role addresses (info@, hello@…) — change this in Settings if you have a lawful basis.");
  }
  if (lead.status === "do_not_contact") blocking.push("Lead is marked Do Not Contact.");
  if (draft.status === "skipped" || draft.status === "sent") blocking.push(`Draft is already ${draft.status}.`);

  if (email) {
    const domain = emailDomain(email);
    const sup = await store.first("suppressions", { in: { value: [email, domain] } });
    if (sup) blocking.push(`${sup.kind === "domain" ? `Domain ${sup.value}` : "This address"} is on the suppression list (${sup.reason}).`);

    // Duplicate prevention: one first-touch per company within the dedupe window.
    const since = daysAgoIso(ws.dedupe_window_days, now);
    const prior = await store.list("email_messages", {
      eq: { to_domain: domain },
      in: { status: ["queued", "sending", "sent"] },
      gte: { created_at: since },
      limit: 5,
    });
    const dup = prior.find((m) => m.id !== input.messageId && m.draft_id !== draft.id);
    if (dup) {
      blocking.push(
        dup.to_email === email
          ? `Already emailed ${email} on ${new Date(dup.created_at).toLocaleDateString("en-AU")} (within your ${ws.dedupe_window_days}-day window).`
          : `Someone at ${domain} (${dup.to_email}) was already emailed within your ${ws.dedupe_window_days}-day window.`,
      );
    }
  }

  // Campaign state.
  if (campaign?.status === "paused") blocking.push(`Campaign “${campaign.name}” is paused.`);
  if (campaign?.status === "completed") blocking.push(`Campaign “${campaign.name}” is completed.`);

  // Account.
  if (!account) blocking.push("No sending account connected. Add one under Email → Accounts.");
  else if (account.status === "needs_auth") blocking.push(`Sending account “${account.label}” needs to be re-connected.`);
  else if (account.status === "paused") blocking.push(`Sending account “${account.label}” is paused.`);

  if (blocking.length || !account) return { blocking, deferUntil: null, deferReason: null };

  // Limits → defer, never drop.
  const dayStart = startOfDayIso(now);
  const tomorrow = new Date(dayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const sentToday = await store.count("email_messages", { eq: { account_id: account.id, status: "sent" }, gte: { sent_at: dayStart } });
  const limit = effectiveDailyLimit(account, now);
  if (sentToday >= limit) {
    return { blocking, deferUntil: tomorrow, deferReason: `Daily limit for “${account.label}” reached (${limit}${account.warmup_enabled && limit < account.daily_limit ? ", warming up" : ""}).` };
  }
  const workspaceToday = await store.count("email_messages", { eq: { status: "sent" }, gte: { sent_at: dayStart } });
  if (workspaceToday >= ws.daily_send_cap) {
    return { blocking, deferUntil: tomorrow, deferReason: `Workspace daily cap reached (${ws.daily_send_cap}).` };
  }
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const lastMinute = await store.count("email_messages", { eq: { account_id: account.id, status: "sent" }, gte: { sent_at: minuteAgo } });
  if (lastMinute >= account.per_minute_limit) {
    return { blocking, deferUntil: new Date(now.getTime() + 60_000), deferReason: "Per-minute rate limit — queued for the next minute." };
  }
  return { blocking, deferUntil: null, deferReason: null };
}
