import Link from "next/link";
import { Megaphone } from "lucide-react";
import { CampaignStatusBadge } from "@/components/status";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { campaignMetrics } from "@/lib/services/metrics";
import { formatDate } from "@/lib/utils";
import { NewCampaignButton } from "./new-campaign";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const { store } = await requireContext();
  const [campaigns, products, icps, accounts] = await Promise.all([
    store.list("campaigns", { order: { column: "created_at", ascending: false } }),
    store.list("products"),
    store.list("icps"),
    store.list("sending_accounts"),
  ]);
  const metrics = await Promise.all(campaigns.map((c) => campaignMetrics(store, c.id)));
  const options = {
    products: products.map((p) => ({ id: p.id, name: p.name })),
    icps: icps.map((i) => ({ id: i.id, name: i.name })),
    accounts: accounts.map((a) => ({ id: a.id, name: `${a.label} (${a.from_email})` })),
  };

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Group leads around one offer and audience. Campaigns organise and measure outreach — they never send on their own."
        actions={<NewCampaignButton {...options} />}
      />
      {campaigns.length === 0 ? (
        <Card><EmptyState icon={<Megaphone className="h-5 w-5" />} title="No campaigns yet" description="Create a campaign like “WordPress Website Outreach — dental clinics in Australia”." action={<NewCampaignButton {...options} />} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c, i) => {
            const m = metrics[i];
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="group">
                <Card className="h-full p-5 transition group-hover:border-brand-200 group-hover:shadow-pop">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold group-hover:text-brand-700">{c.name}</h2>
                    <CampaignStatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 text-[13px] text-zinc-500">{c.audience || "No audience set"}</p>
                  <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
                    {[["Leads", m.leadsFound], ["Sent", m.sent], ["Replies", m.replies], ["Meetings", m.meetings]].map(([l, v]) => (
                      <div key={l as string} className="rounded-lg bg-zinc-50 py-2">
                        <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                        <dt className="text-[11px] text-zinc-500">{l}</dt>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-xs text-zinc-400">Created {formatDate(c.created_at)}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
