import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, History, Mail, Sparkles, UserRound } from "lucide-react";
import { ReviewCard } from "@/components/review-card";
import { FitBadge, LeadStatusBadge, MessageStatusBadge, ModelBadge, ScorePill } from "@/components/status";
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { buildReviewItem, sortVariants } from "@/lib/services/review";
import { formatDate, formatRelative } from "@/lib/utils";
import { LeadActions } from "./lead-actions";

const SOURCE_LABEL: Record<string, string> = { google_places: "Google Places listing", csv_import: "CSV import", manual: "Added manually", website: "Company website", demo: "Sample data (fictional)" };
const CONSENT_LABEL: Record<string, string> = {
  conspicuous_publication: "Address published by the business",
  legitimate_interest: "Legitimate interest (B2B)",
  existing_relationship: "Existing relationship",
  consent: "Consent",
  unknown: "Not recorded",
};

export async function generateMetadata(props: PageProps<"/leads/[id]">) {
  const { id } = await props.params;
  const ctx = await requireContext();
  const lead = await ctx.store.get("leads", id);
  return { title: lead?.company_name ?? "Lead" };
}

export default async function LeadDetailPage(props: PageProps<"/leads/[id]">) {
  const { id } = await props.params;
  const ctx = await requireContext();
  const { store } = ctx;
  const lead = await store.get("leads", id);
  if (!lead) notFound();

  const [qualifications, drafts, messages, events, audit, memberships, campaigns] = await Promise.all([
    store.list("lead_qualifications", { eq: { lead_id: id }, order: { column: "created_at", ascending: false }, limit: 5 }),
    store.list("email_drafts", { eq: { lead_id: id }, order: { column: "created_at", ascending: false } }),
    store.list("email_messages", { eq: { lead_id: id }, order: { column: "created_at", ascending: false } }),
    store.list("email_events", { eq: { lead_id: id }, order: { column: "created_at", ascending: false } }),
    store.list("audit_log", { eq: { lead_id: id }, order: { column: "created_at", ascending: false }, limit: 30 }),
    store.list("campaign_leads", { eq: { lead_id: id } }),
    store.list("campaigns", { order: { column: "created_at", ascending: false } }),
  ]);
  const q = qualifications[0] ?? null;
  const openDrafts = sortVariants(drafts.filter((d) => d.status === "draft"));
  const review = openDrafts.length ? await buildReviewItem(ctx, lead, openDrafts) : null;
  const inCampaigns = campaigns.filter((c) => memberships.some((m) => m.campaign_id === c.id));

  const timeline = [
    ...audit.map((a) => ({ at: a.created_at, text: a.summary, who: a.actor_label, kind: "audit" as const })),
    ...events.map((e) => ({ at: e.created_at, text: `${e.type.replace(/_/g, " ")}${e.detail ? ` — ${e.detail}` : ""}`, who: "Email event", kind: "event" as const })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-800"><ArrowLeft className="h-3.5 w-3.5" /> Leads</Link>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.company_name}</h1>
            <LeadStatusBadge status={lead.status} />
            <FitBadge fit={lead.fit} />
          </div>
          <p className="mt-1.5 text-sm text-zinc-500">
            {lead.industry || "Unknown industry"} · {lead.location || "Unknown location"}
            {inCampaigns.length > 0 && <> · {inCampaigns.map((c) => <Link key={c.id} href={`/campaigns/${c.id}`} className="ml-1 text-brand-700 hover:underline">{c.name}</Link>)}</>}
          </p>
        </div>
        <LeadActions
          lead={{ id: lead.id, company_name: lead.company_name, status: lead.status, website: lead.website, email: lead.email, contact_name: lead.contact_name, contact_title: lead.contact_title, consent_basis: lead.consent_basis }}
          hasQualification={!!q}
          hasSent={messages.some((m) => m.status === "sent")}
          campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>

      {lead.status === "do_not_contact" && <Notice tone="red" className="mb-6" title="Do not contact">This company opted out or was marked Do Not Contact. No email can be sent.</Notice>}
      {lead.source === "demo" && <Notice tone="blue" className="mb-6">Fictional sample business on a reserved .example domain — safe to experiment with.</Notice>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-600" /> AI qualification</span>}
              description={q ? `Qualified ${formatRelative(q.created_at)}${qualifications.length > 1 ? ` · ${qualifications.length} runs` : ""}` : "Why this company may need your product"}
              action={q && <ModelBadge model={q.model} />}
            />
            {!q ? (
              <EmptyState title="Not qualified yet" description="Qualify this lead to see how well it matches your ideal customer, with evidence." />
            ) : (
              <CardBody className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><div className="text-xs text-zinc-500">Lead score</div><div className="mt-1"><ScorePill score={q.score} /></div></div>
                  <div><div className="text-xs text-zinc-500">Fit</div><div className="mt-1"><FitBadge fit={q.fit} /></div></div>
                  <div><div className="text-xs text-zinc-500">Matches ICP</div><div className="mt-1 text-sm font-medium">{q.matches_icp ? "Yes" : "No"}</div></div>
                </div>
                <div>
                  <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Why they match</div>
                  <p className="mt-1 text-sm text-zinc-800">{q.reason}</p>
                </div>
                <div>
                  <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Potential pain point</div>
                  <p className="mt-1 text-sm text-zinc-800">{q.potential_need}</p>
                </div>
                <div>
                  <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Evidence</div>
                  {q.evidence.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {q.evidence.map((e, i) => (
                        <li key={i} className="flex flex-col gap-0.5 rounded-lg bg-zinc-50 px-3 py-2 text-[13px] sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-zinc-800">{e.claim}</span>
                          <span className="shrink-0 text-xs text-zinc-500">{e.source}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-sm text-zinc-500">No supporting evidence found in the available data.</p>}
                </div>
                {q.unknowns.length > 0 && (
                  <div>
                    <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase">What we don&apos;t know</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-zinc-600">{q.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
                  </div>
                )}
                <div className="rounded-lg border border-brand-100 bg-brand-50/50 px-4 py-3">
                  <div className="text-xs font-medium tracking-wide text-brand-700 uppercase">Recommended outreach angle</div>
                  <p className="mt-1 text-sm text-brand-950">{q.outreach_angle}</p>
                </div>
              </CardBody>
            )}
          </Card>

          <div id="drafts" className="scroll-mt-20 space-y-4">
            {review ? (
              <ReviewCard item={review} showCompanyLink={false} />
            ) : (
              <Card>
                <CardHeader title={<span className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand-600" /> Email draft</span>} />
                <EmptyState
                  title={messages.length ? "No open drafts" : "No draft yet"}
                  description={lead.status === "do_not_contact" ? "Emails can't be drafted for Do Not Contact leads." : "Generate three short, personal variants to review."}
                />
              </Card>
            )}
            {messages.length > 0 && (
              <Card>
                <CardHeader title="Sent emails" />
                <ul className="divide-y divide-zinc-100">
                  {messages.map((m) => (
                    <li key={m.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{m.subject}</span>
                        <MessageStatusBadge status={m.status} />
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">To {m.to_email} · {m.sent_at ? `sent ${formatDate(m.sent_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : `attempts: ${m.attempts}`}</div>
                      {m.error && m.status !== "sent" && <div className="mt-1 text-xs text-red-600">{m.error}</div>}
                      <details className="mt-2 text-xs text-zinc-500">
                        <summary className="cursor-pointer">Show email</summary>
                        <pre className="mt-2 rounded-md bg-zinc-50 p-3 font-sans text-[13px] whitespace-pre-wrap text-zinc-700">{m.body_text}</pre>
                      </details>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-zinc-400" /> Company</span>} />
            <CardBody className="space-y-3 text-[13px]">
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">{lead.domain} <ExternalLink className="h-3 w-3" /></a>
              )}
              {lead.description && <p className="text-zinc-700">{lead.description}</p>}
              <dl className="grid grid-cols-[84px_1fr] gap-y-1.5">
                <dt className="text-zinc-500">Industry</dt><dd>{lead.industry || "—"}</dd>
                <dt className="text-zinc-500">Location</dt><dd>{lead.location || "—"}</dd>
                <dt className="text-zinc-500">Phone</dt><dd>{lead.phone || "—"}</dd>
                <dt className="text-zinc-500">Website</dt><dd>{lead.enriched_at ? `Checked ${formatRelative(lead.enriched_at)}` : "Not checked"}</dd>
              </dl>
              {lead.site_excerpt && (
                <details>
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700">Public website text captured</summary>
                  <p className="mt-2 max-h-48 overflow-auto rounded-md bg-zinc-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-zinc-600">{lead.site_excerpt}</p>
                </details>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-zinc-400" /> Contact</span>} />
            <CardBody className="space-y-3 text-[13px]">
              {lead.email ? (
                <div>
                  <div className="font-medium text-zinc-900">{lead.email}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    <Badge tone={lead.email_type === "role" ? "neutral" : "amber"}>{lead.email_type === "role" ? "Role address" : "Personal address"}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500">{lead.email_source_url ? <>Published at <a className="underline" href={lead.email_source_url} target="_blank" rel="noreferrer">{lead.email_source_url}</a></> : "Entered by a user"}</p>
                </div>
              ) : (
                <p className="text-zinc-500">No public business email found. Check the website, or add one the business published.</p>
              )}
              <dl className="grid grid-cols-[84px_1fr] gap-y-1.5">
                <dt className="text-zinc-500">Name</dt><dd>{lead.contact_name ?? "Not publicly listed"}</dd>
                <dt className="text-zinc-500">Title</dt><dd>{lead.contact_title ?? "—"}</dd>
                <dt className="text-zinc-500">Basis</dt><dd>{CONSENT_LABEL[lead.consent_basis]}</dd>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Source attribution" />
            <CardBody className="text-[13px]">
              <p className="text-zinc-800">{SOURCE_LABEL[lead.source]}</p>
              {lead.source_url && <a href={lead.source_url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-brand-700 hover:underline">{lead.source_url}</a>}
              <p className="mt-1 text-xs text-zinc-500">Added {formatDate(lead.created_at)}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><History className="h-4 w-4 text-zinc-400" /> Activity</span>} />
            <CardBody>
              {timeline.length === 0 ? (
                <p className="text-sm text-zinc-500">No activity yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-zinc-200 pl-4">
                  {timeline.map((t, i) => (
                    <li key={i} className="relative">
                      <span className={`absolute top-1.5 -left-[21px] h-2 w-2 rounded-full ring-4 ring-white ${t.kind === "event" ? "bg-emerald-400" : "bg-brand-400"}`} />
                      <p className="text-[13px] text-zinc-700 first-letter:uppercase">{t.text}</p>
                      <p className="text-xs text-zinc-400">{t.who} · {formatRelative(t.at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
