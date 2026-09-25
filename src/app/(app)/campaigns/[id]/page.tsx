import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { FunnelChart } from "@/components/charts";
import { CampaignStatusBadge, LeadStatusBadge, ScorePill } from "@/components/status";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, Stat, table } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { campaignMetrics } from "@/lib/services/metrics";
import { formatRelative } from "@/lib/utils";
import { CampaignControls } from "./campaign-controls";

export default async function CampaignDetail(props: PageProps<"/campaigns/[id]">) {
  const { id } = await props.params;
  const { store } = await requireContext();
  const campaign = await store.get("campaigns", id);
  if (!campaign) notFound();
  const [m, members, products, icps, accounts] = await Promise.all([
    campaignMetrics(store, id),
    store.list("campaign_leads", { eq: { campaign_id: id } }),
    store.list("products"),
    store.list("icps"),
    store.list("sending_accounts"),
  ]);
  const leads = members.length ? await store.list("leads", { in: { id: members.map((x) => x.lead_id) }, order: { column: "score", ascending: false } }) : [];
  const account = accounts.find((a) => a.id === campaign.sending_account_id);
  const readyForReview = leads.filter((l) => l.status === "draft_ready").length;
  const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <>
      <Link href="/campaigns" className="mb-4 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-800"><ArrowLeft className="h-3.5 w-3.5" /> Campaigns</Link>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="mt-1.5 text-sm text-zinc-500">
            Audience: {campaign.audience || "—"} · Sending from {account ? `${account.label}` : "default account"}
          </p>
          {campaign.description && <p className="mt-2 max-w-2xl text-sm text-zinc-600">{campaign.description}</p>}
        </div>
        <CampaignControls
          campaign={campaign}
          readyForReview={readyForReview}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          icps={icps.map((i) => ({ id: i.id, name: i.name }))}
          accounts={accounts.map((a) => ({ id: a.id, name: `${a.label} (${a.from_email})` }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Leads found" value={m.leadsFound} />
        <Stat label="Qualified leads" value={m.qualified} hint={rate(m.qualified, m.leadsFound)} />
        <Stat label="Emails approved" value={m.approved} />
        <Stat label="Emails sent" value={m.sent} />
        <Stat label="Delivered" value={m.delivered} hint={rate(m.delivered, m.sent)} />
        <Stat label="Bounced" value={m.bounced} hint={rate(m.bounced, m.sent)} />
        <Stat label="Replies" value={m.replies} hint={`${rate(m.replies, m.sent)} reply rate`} />
        <Stat label="Meetings / bookings" value={m.meetings} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title="Leads in this campaign"
            description={`${leads.length} lead${leads.length === 1 ? "" : "s"}${readyForReview ? ` · ${readyForReview} ready for review` : ""}`}
            action={<ButtonLink href={`/leads?campaign=${id}`} variant="ghost" size="sm">Open in lead table</ButtonLink>}
          />
          {leads.length === 0 ? (
            <EmptyState icon={<Users className="h-5 w-5" />} title="No leads yet" description="Select leads in the lead table and choose “Add to campaign”." action={<ButtonLink href="/leads">Go to leads</ButtonLink>} />
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.thead}>
                  <tr><th className={table.th}>Company</th><th className={table.th}>Score</th><th className={table.th}>Status</th><th className={table.th}>Last contact</th></tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className={table.tr}>
                      <td className={table.td}><Link href={`/leads/${l.id}`} className="font-medium hover:text-brand-700">{l.company_name}</Link><div className="text-xs text-zinc-500">{l.location}</div></td>
                      <td className={table.td}><ScorePill score={l.score} /></td>
                      <td className={table.td}><LeadStatusBadge status={l.status} /></td>
                      <td className={`${table.td} text-[13px] text-zinc-500`}>{formatRelative(l.last_contacted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Funnel" description="Optimised for relevance, not volume" />
          <CardBody>
            <FunnelChart
              height={280}
              data={[
                { label: "Leads", value: m.leadsFound },
                { label: "Qualified", value: m.qualified },
                { label: "Approved", value: m.approved },
                { label: "Sent", value: m.sent },
                { label: "Delivered", value: m.delivered },
                { label: "Replies", value: m.replies },
                { label: "Positive", value: m.positive },
                { label: "Meetings", value: m.meetings },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
