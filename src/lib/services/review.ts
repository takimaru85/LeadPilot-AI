import "server-only";
import type { AppContext } from "@/lib/auth/session";
import { complianceFooter } from "@/lib/email/compose";
import { checkSendable, effectiveDailyLimit } from "@/lib/email/guard";
import type { Campaign, EmailDraft, Lead, Qualification, Suppression } from "@/lib/types";
import { emailDomain } from "@/lib/utils";
import { redact, type PublicSendingAccount } from "./accounts";

export interface ReviewItem {
  lead: Lead;
  drafts: EmailDraft[];
  qualification: Qualification | null;
  suppression: Suppression | null;
  account: PublicSendingAccount | null;
  accountLimit: number | null;
  campaign: Pick<Campaign, "id" | "name" | "status"> | null;
  preflight: { blocking: string[]; deferReason: string | null };
  footerPreview: string;
}

/** Everything a human needs to decide whether to send: content, sources, and pre-send checks. */
export async function buildReviewItem(ctx: AppContext, lead: Lead, drafts: EmailDraft[]): Promise<ReviewItem> {
  const { store, workspace } = ctx;
  const draft = drafts[0];
  const [qualification, suppression, campaign] = await Promise.all([
    draft?.qualification_id ? store.get("lead_qualifications", draft.qualification_id) : store.first("lead_qualifications", { eq: { lead_id: lead.id }, order: { column: "created_at", ascending: false } }),
    lead.email ? store.first("suppressions", { in: { value: [lead.email.toLowerCase(), emailDomain(lead.email)] } }) : Promise.resolve(null),
    draft?.campaign_id ? store.get("campaigns", draft.campaign_id) : Promise.resolve(null),
  ]);
  const account =
    (campaign?.sending_account_id ? await store.get("sending_accounts", campaign.sending_account_id) : null) ??
    (await store.first("sending_accounts", { eq: { status: "active" }, order: { column: "created_at", ascending: true } }));
  const preflight = draft
    ? await checkSendable(store, { workspace, lead, draft, account, campaign })
    : { blocking: [], deferUntil: null, deferReason: null };
  return {
    lead,
    drafts,
    qualification,
    suppression,
    account: account ? redact(account) : null,
    accountLimit: account ? effectiveDailyLimit(account) : null,
    campaign: campaign ? { id: campaign.id, name: campaign.name, status: campaign.status } : null,
    preflight: { blocking: preflight.blocking, deferReason: preflight.deferReason },
    footerPreview: complianceFooter(workspace, lead, "‹one-click unsubscribe link›"),
  };
}

/** Review queue: leads with unsent drafts, newest first. */
export async function reviewQueue(ctx: AppContext, limit = 20): Promise<ReviewItem[]> {
  const drafts = await ctx.store.list("email_drafts", { eq: { status: "draft" }, order: { column: "created_at", ascending: false }, limit: 300 });
  const byLead = new Map<string, EmailDraft[]>();
  for (const d of drafts) byLead.set(d.lead_id, [...(byLead.get(d.lead_id) ?? []), d]);
  const items: ReviewItem[] = [];
  for (const [leadId, ds] of [...byLead.entries()].slice(0, limit)) {
    const lead = await ctx.store.get("leads", leadId);
    if (lead) items.push(await buildReviewItem(ctx, lead, sortVariants(ds)));
  }
  return items;
}

export function sortVariants(ds: EmailDraft[]) {
  const order = { professional: 0, friendly: 1, concise: 2 };
  return [...ds].sort((a, b) => order[a.variant] - order[b.variant]);
}
