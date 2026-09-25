import "server-only";
import { HttpError } from "@/lib/api";
import type { AppContext } from "@/lib/auth/session";
import { hasBlockingFindings, lintEmail } from "@/lib/compliance/email-lint";
import { emailFacts } from "@/lib/compliance/facts";
import type { Store } from "@/lib/db/store";
import { StoreError } from "@/lib/db/store";
import { actorOf, recordAudit, SYSTEM_ACTOR } from "@/lib/services/audit";
import { addSuppression } from "@/lib/services/suppressions";
import type { EmailDraft, EmailMessage, SendingAccount } from "@/lib/types";
import { emailDomain } from "@/lib/utils";
import { composeEmail } from "./compose";
import { checkSendable } from "./guard";
import { getTransport } from "./transports";

const BACKOFF_MINUTES = [1, 5, 30, 120];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;

async function resolveAccount(store: Store, campaignAccountId: string | null): Promise<SendingAccount | null> {
  if (campaignAccountId) {
    const a = await store.get("sending_accounts", campaignAccountId);
    if (a) return a;
  }
  return store.first("sending_accounts", { eq: { status: "active" }, order: { column: "created_at", ascending: true } });
}

async function loadGraph(store: Store, draft: EmailDraft) {
  const [lead, workspace, campaign] = await Promise.all([
    store.get("leads", draft.lead_id),
    store.getWorkspace(),
    draft.campaign_id ? store.get("campaigns", draft.campaign_id) : Promise.resolve(null),
  ]);
  if (!lead || !workspace) throw new StoreError("Lead or workspace not found", "not_found");
  return { lead, workspace, campaign };
}

/**
 * Human approval → queue → immediate send attempt. Nothing reaches this function
 * without an explicit click on “Approve & Send” for one specific draft.
 */
export async function approveAndSend(ctx: AppContext, draftId: string, edits?: { subject?: string; body?: string }) {
  const { store } = ctx;
  let draft = await store.get("email_drafts", draftId);
  if (!draft) throw new StoreError("Draft not found", "not_found");
  if (draft.status === "sent") throw new HttpError(409, "This draft has already been sent.");

  const { lead, workspace, campaign } = await loadGraph(store, draft);
  if (edits && (edits.subject !== undefined || edits.body !== undefined)) {
    draft = await store.update("email_drafts", draft.id, {
      subject: edits.subject ?? draft.subject, body: edits.body ?? draft.body, edited: true,
    });
  }

  const product = campaign?.product_id ? await store.get("products", campaign.product_id) : await store.first("products", { order: { column: "created_at" } });
  const q = draft.qualification_id ? await store.get("lead_qualifications", draft.qualification_id) : null;
  const findings = lintEmail(draft.subject, draft.body, { facts: emailFacts(product, workspace, lead, q) });
  draft = await store.update("email_drafts", draft.id, { warnings: findings });
  if (hasBlockingFindings(findings)) {
    throw new HttpError(422, "Fix the flagged problems before sending.", findings.filter((f) => f.level === "error").map((f) => f.message));
  }

  const account = await resolveAccount(store, campaign?.sending_account_id ?? null);
  const guard = await checkSendable(store, { workspace, lead, draft, account, campaign });
  if (guard.blocking.length) throw new HttpError(422, "This email can't be sent.", guard.blocking);

  const composed = composeEmail(workspace, lead, draft, account!.from_email, account!.from_name);
  let message: EmailMessage;
  try {
    message = await store.insert("email_messages", {
      draft_id: draft.id, lead_id: lead.id, campaign_id: draft.campaign_id, account_id: account!.id,
      to_email: composed.to.toLowerCase(), to_domain: emailDomain(composed.to), subject: composed.subject, body_text: composed.text,
      status: "queued", next_attempt_at: (guard.deferUntil ?? new Date()).toISOString(),
    });
  } catch (e) {
    if (e instanceof StoreError && e.code === "conflict") throw new HttpError(409, "This draft is already queued.");
    throw e;
  }

  await store.update("email_drafts", draft.id, { status: "approved" });
  // The other variants for this lead are no longer needed.
  const siblings = await store.list("email_drafts", { eq: { lead_id: lead.id, status: "draft" } });
  for (const s of siblings) await store.update("email_drafts", s.id, { status: "skipped" });
  await store.update("leads", lead.id, { status: "approved" });
  await recordAudit(store, actorOf(ctx), {
    action: "email.approved",
    summary: `Approved “${draft.subject}” for ${lead.email}${draft.edited ? " (edited)" : ""}`,
    entityType: "email_message", entityId: message.id, leadId: lead.id,
    metadata: { draft_id: draft.id, variant: draft.variant, account_id: account!.id },
  });

  if (guard.deferUntil) {
    return { message, outcome: "deferred" as const, note: guard.deferReason };
  }
  const processed = await processMessage(store, message.id);
  return { message: processed.message, outcome: processed.outcome, note: processed.note };
}

type ProcessOutcome = "sent" | "deferred" | "retrying" | "failed" | "blocked" | "skipped";

/** Send (or re-try) one queued message. Safe to call repeatedly; re-checks every guard. */
export async function processMessage(store: Store, messageId: string, now = new Date()): Promise<{ message: EmailMessage; outcome: ProcessOutcome; note: string | null }> {
  let msg = await store.get("email_messages", messageId);
  if (!msg) throw new StoreError("Message not found", "not_found");
  if (msg.status !== "queued") return { message: msg, outcome: "skipped", note: `Message is ${msg.status}.` };

  const draft = await store.get("email_drafts", msg.draft_id);
  if (!draft) {
    msg = await store.update("email_messages", msg.id, { status: "failed", error: "Draft was deleted." });
    return { message: msg, outcome: "failed", note: msg.error };
  }
  const { lead, workspace, campaign } = await loadGraph(store, draft);
  const account = msg.account_id ? await store.get("sending_accounts", msg.account_id) : null;

  const guard = await checkSendable(store, { workspace, lead, draft: { ...draft, status: "approved" }, account, campaign, messageId: msg.id }, now);
  if (guard.blocking.length) {
    msg = await store.update("email_messages", msg.id, { status: "blocked", error: guard.blocking.join(" ") });
    await store.update("email_drafts", draft.id, { status: "blocked" });
    await recordAudit(store, SYSTEM_ACTOR, {
      action: "email.blocked", summary: `Blocked email to ${msg.to_email}: ${guard.blocking[0]}`,
      entityType: "email_message", entityId: msg.id, leadId: lead.id,
    });
    return { message: msg, outcome: "blocked", note: msg.error };
  }
  if (guard.deferUntil) {
    msg = await store.update("email_messages", msg.id, { next_attempt_at: guard.deferUntil.toISOString(), error: guard.deferReason });
    return { message: msg, outcome: "deferred", note: guard.deferReason };
  }

  msg = await store.update("email_messages", msg.id, { status: "sending", attempts: msg.attempts + 1 });
  const composed = composeEmail(workspace, lead, draft, account!.from_email, account!.from_name);
  const result = await getTransport(account!).send({ ...composed, subject: msg.subject, text: msg.body_text });

  if (result.ok) {
    const sentAt = new Date().toISOString();
    msg = await store.update("email_messages", msg.id, { status: "sent", sent_at: sentAt, provider_message_id: result.providerMessageId, error: null });
    await store.update("email_drafts", draft.id, { status: "sent" });
    await store.update("leads", lead.id, { status: "contacted", last_contacted_at: sentAt });
    if (account!.last_error) await store.update("sending_accounts", account!.id, { last_error: null, status: "active" });
    await recordAudit(store, SYSTEM_ACTOR, {
      action: "email.sent", summary: `Sent “${msg.subject}” to ${msg.to_email} via ${account!.label}`,
      entityType: "email_message", entityId: msg.id, leadId: lead.id, metadata: { provider_message_id: result.providerMessageId },
    });
    return { message: msg, outcome: "sent", note: null };
  }

  // Failure handling.
  await store.update("sending_accounts", account!.id, { last_error: result.error });
  if (result.bounce) {
    await store.insert("email_events", { message_id: msg.id, lead_id: lead.id, campaign_id: msg.campaign_id, type: "bounced", detail: result.error });
    await addSuppression(store, SYSTEM_ACTOR, { value: msg.to_email, reason: "bounced", source: "smtp_response" });
  }
  const retry = !result.permanent && msg.attempts < MAX_ATTEMPTS;
  if (retry) {
    const next = new Date(now.getTime() + BACKOFF_MINUTES[Math.min(msg.attempts - 1, BACKOFF_MINUTES.length - 1)] * 60_000);
    msg = await store.update("email_messages", msg.id, { status: "queued", next_attempt_at: next.toISOString(), error: result.error });
    return { message: msg, outcome: "retrying", note: `Temporary failure; retrying at ${next.toLocaleTimeString("en-AU")}. ${result.error}` };
  }
  msg = await store.update("email_messages", msg.id, { status: "failed", error: result.error });
  await store.update("email_drafts", draft.id, { status: "failed" });
  await recordAudit(store, SYSTEM_ACTOR, {
    action: "email.failed", summary: `Failed to send to ${msg.to_email}: ${result.error}`,
    entityType: "email_message", entityId: msg.id, leadId: lead.id,
  });
  return { message: msg, outcome: "failed", note: result.error };
}

/** Cron entry point: process due queued messages across all workspaces. */
export async function processDueMessages(serviceStore: Store, limit = 25) {
  const now = new Date();
  const due = await serviceStore.list("email_messages", {
    eq: { status: "queued" },
    lte: { next_attempt_at: now.toISOString() },
    order: { column: "next_attempt_at", ascending: true },
    limit,
  });
  const results: { id: string; outcome: ProcessOutcome }[] = [];

  // A message stuck in "sending" means a worker died mid-send. We can't know whether it went out,
  // so never resend automatically — mark it failed for a human to check.
  const stuck = await serviceStore.list("email_messages", {
    eq: { status: "sending" },
    lte: { updated_at: new Date(now.getTime() - 10 * 60_000).toISOString() },
    limit: 50,
  });
  for (const m of stuck) {
    await serviceStore.forWorkspace(m.workspace_id).update("email_messages", m.id, {
      status: "failed",
      error: "Send interrupted; delivery unknown. Check your mailbox's Sent folder before retrying.",
    });
    results.push({ id: m.id, outcome: "failed" });
  }

  for (const m of due) {
    try {
      const r = await processMessage(serviceStore.forWorkspace(m.workspace_id), m.id, now);
      results.push({ id: m.id, outcome: r.outcome });
    } catch (e) {
      console.error("[queue] processing failed", m.id, e);
      results.push({ id: m.id, outcome: "failed" });
    }
  }
  return results;
}
