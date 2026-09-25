import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Card, EmptyState, PageHeader, table } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const { store } = await requireContext();
  const entries = await store.list("audit_log", { order: { column: "created_at", ascending: false }, limit: 200 });
  return (
    <>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-800"><ArrowLeft className="h-3.5 w-3.5" /> Settings</Link>
      <PageHeader title="Audit log" description="Append-only record of every approval, send, edit, import, suppression and settings change. Latest 200 entries." />
      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No activity yet" />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr><th className={table.th}>When</th><th className={table.th}>Who</th><th className={table.th}>Action</th><th className={table.th}>Details</th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className={table.tr}>
                    <td className={`${table.td} text-[13px] whitespace-nowrap text-zinc-500`}>{formatDate(e.created_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                    <td className={`${table.td} text-[13px] whitespace-nowrap`}>{e.actor_label}</td>
                    <td className={table.td}><code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">{e.action}</code></td>
                    <td className={`${table.td} text-[13px] text-zinc-700`}>{e.lead_id ? <Link href={`/leads/${e.lead_id}`} className="hover:text-brand-700">{e.summary}</Link> : e.summary}</td>
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
