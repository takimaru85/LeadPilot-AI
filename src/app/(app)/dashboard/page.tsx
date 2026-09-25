import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Mail, Megaphone, MessageSquareReply, Search, Sparkles, ThumbsUp, Users } from "lucide-react";
import { ActivityChart, FunnelChart } from "@/components/charts";
import { LeadStatusBadge, ScorePill } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, table } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { dailySeries, workspaceMetrics } from "@/lib/services/metrics";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { store, workspace, user } = await requireContext();
  const [m, series, recentLeads, activity, campaigns, products, icps, accounts, reviewCount] = await Promise.all([
    workspaceMetrics(store),
    dailySeries(store, 14),
    store.list("leads", { order: { column: "created_at", ascending: false }, limit: 6 }),
    store.list("audit_log", { order: { column: "created_at", ascending: false }, limit: 8 }),
    store.count("campaigns"),
    store.count("products"),
    store.count("icps"),
    store.count("sending_accounts"),
    store.count("leads", { eq: { status: "draft_ready" } }),
  ]);

  const checklist = [
    { done: products > 0, label: "Describe what you sell", href: "/setup" },
    { done: icps > 0, label: "Define your ideal customer", href: "/setup#icp" },
    { done: Boolean(workspace.postal_address && (workspace.sender_name || workspace.sender_company)), label: "Add sender identity & postal address", href: "/settings" },
    { done: accounts > 0, label: "Connect a sending account", href: "/email/accounts" },
    { done: m.leadsFound > 0, label: "Find your first leads", href: "/find-leads" },
  ];
  const remaining = checklist.filter((c) => !c.done).length;

  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`}
        description="Here's how your outreach is going. Relevant, reviewed emails beat volume every time."
        actions={
          <>
            <ButtonLink href="/find-leads" variant="secondary"><Search className="h-4 w-4" /> Find leads</ButtonLink>
            {reviewCount > 0 && <ButtonLink href="/email"><Mail className="h-4 w-4" /> Review {reviewCount} draft{reviewCount > 1 ? "s" : ""}</ButtonLink>}
          </>
        }
      />

      {remaining > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
            <div className="lg:w-64">
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand-600" /> Get set up</div>
              <p className="mt-1 text-[13px] text-zinc-500">{remaining} step{remaining > 1 ? "s" : ""} left before your first send.</p>
            </div>
            <ol className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="flex h-full items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] hover:border-brand-200 hover:bg-brand-50/40">
                    {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-zinc-300" />}
                    <span className={c.done ? "text-zinc-400 line-through" : "text-zinc-700"}>{c.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total leads" value={m.leadsFound} icon={<Users className="h-4 w-4" />} />
        <Stat label="Qualified" value={m.qualified} hint={m.leadsFound ? `${Math.round((m.qualified / m.leadsFound) * 100)}% of leads` : undefined} icon={<Sparkles className="h-4 w-4" />} />
        <Stat label="Emails sent" value={m.sent} icon={<Mail className="h-4 w-4" />} />
        <Stat label="Replies" value={m.replies} hint={m.sent ? `${Math.round((m.replies / m.sent) * 100)}% reply rate` : undefined} icon={<MessageSquareReply className="h-4 w-4" />} />
        <Stat label="Positive responses" value={m.positive} hint={m.meetings ? `${m.meetings} meeting${m.meetings > 1 ? "s" : ""} booked` : undefined} icon={<ThumbsUp className="h-4 w-4" />} />
        <Stat label="Campaigns" value={campaigns} icon={<Megaphone className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Activity" description="Emails sent and replies received, last 14 days" />
          <CardBody>
            {m.sent === 0 && m.replies === 0 ? (
              <EmptyState title="No emails sent yet" description="Once you approve and send your first email, activity shows up here." />
            ) : (
              <ActivityChart data={series} />
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Outreach funnel" description="From discovery to conversation" />
          <CardBody>
            <FunnelChart
              data={[
                { label: "Leads found", value: m.leadsFound },
                { label: "Qualified", value: m.qualified },
                { label: "Approved", value: m.approved },
                { label: "Sent", value: m.sent },
                { label: "Replies", value: m.replies },
                { label: "Meetings", value: m.meetings },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Recent leads" action={<ButtonLink href="/leads" variant="ghost" size="sm">View all <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>} />
          {recentLeads.length === 0 ? (
            <EmptyState icon={<Users className="h-5 w-5" />} title="No leads yet" description="Search public business listings or import a CSV to get started." action={<ButtonLink href="/find-leads">Find leads</ButtonLink>} />
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <tbody>
                  {recentLeads.map((l) => (
                    <tr key={l.id} className={table.tr}>
                      <td className={table.td}>
                        <Link href={`/leads/${l.id}`} className="font-medium text-zinc-900 hover:text-brand-700">{l.company_name}</Link>
                        <div className="text-xs text-zinc-500">{l.industry} · {l.location}</div>
                      </td>
                      <td className={table.td}><ScorePill score={l.score} /></td>
                      <td className={`${table.td} text-right`}><LeadStatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" action={<ButtonLink href="/settings/audit" variant="ghost" size="sm">Audit log</ButtonLink>} />
          <CardBody>
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">Nothing yet.</p>
            ) : (
              <ol className="space-y-4">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug text-zinc-700">
                        {a.lead_id ? <Link href={`/leads/${a.lead_id}`} className="hover:text-brand-700">{a.summary}</Link> : a.summary}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">{a.actor_label} · {formatRelative(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
