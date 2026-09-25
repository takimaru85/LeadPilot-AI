import Link from "next/link";
import { ActivityChart, FunnelChart, SimpleBarChart } from "@/components/charts";
import { CampaignStatusBadge, leadStatusLabel } from "@/components/status";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, table } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { campaignMetrics, dailySeries, scoreDistribution, statusBreakdown, workspaceMetrics } from "@/lib/services/metrics";
import type { LeadStatus } from "@/lib/types";

export const metadata = { title: "Analytics" };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default async function AnalyticsPage() {
  const { store } = await requireContext();
  const [m, series, statuses, scores, campaigns] = await Promise.all([
    workspaceMetrics(store),
    dailySeries(store, 30),
    statusBreakdown(store),
    scoreDistribution(store),
    store.list("campaigns", { order: { column: "created_at", ascending: false } }),
  ]);
  const perCampaign = await Promise.all(campaigns.map(async (c) => ({ c, m: await campaignMetrics(store, c.id) })));

  return (
    <>
      <PageHeader title="Analytics" description="Quality over quantity: watch reply and positive-response rates, not just volume." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Qualification rate" value={pct(m.qualified, m.leadsFound)} hint={`${m.qualified} of ${m.leadsFound} leads`} />
        <Stat label="Delivery rate" value={pct(m.delivered, m.sent)} hint={`${m.bounced} bounced`} />
        <Stat label="Reply rate" value={pct(m.replies, m.sent)} hint={`${m.replies} replies`} />
        <Stat label="Positive rate" value={pct(m.positive, m.sent)} hint={`${m.meetings} meetings booked`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Sent vs replies" description="Last 30 days" />
          <CardBody><ActivityChart data={series} height={260} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Funnel" />
          <CardBody>
            <FunnelChart
              height={260}
              data={[
                { label: "Leads", value: m.leadsFound },
                { label: "Qualified", value: m.qualified },
                { label: "Sent", value: m.sent },
                { label: "Delivered", value: m.delivered },
                { label: "Replies", value: m.replies },
                { label: "Meetings", value: m.meetings },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Lead score distribution" description="Qualified leads by score band" />
          <CardBody><SimpleBarChart data={scores.map((s) => ({ label: s.label, value: s.count }))} /></CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Leads by status" />
          <CardBody><SimpleBarChart color="#7f88fb" data={statuses.map((s) => ({ label: leadStatusLabel(s.status as LeadStatus), value: s.count }))} /></CardBody>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Campaign comparison" />
        {perCampaign.length === 0 ? (
          <EmptyState title="No campaigns yet" />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  {["Campaign", "Status", "Leads", "Qualified", "Sent", "Delivered", "Bounced", "Replies", "Reply rate", "Meetings"].map((h) => <th key={h} className={table.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {perCampaign.map(({ c, m: cm }) => (
                  <tr key={c.id} className={table.tr}>
                    <td className={table.td}><Link href={`/campaigns/${c.id}`} className="font-medium hover:text-brand-700">{c.name}</Link></td>
                    <td className={table.td}><CampaignStatusBadge status={c.status} /></td>
                    {[cm.leadsFound, cm.qualified, cm.sent, cm.delivered, cm.bounced, cm.replies].map((v, i) => <td key={i} className={`${table.td} tabular-nums`}>{v}</td>)}
                    <td className={`${table.td} tabular-nums`}>{pct(cm.replies, cm.sent)}</td>
                    <td className={`${table.td} tabular-nums`}>{cm.meetings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
