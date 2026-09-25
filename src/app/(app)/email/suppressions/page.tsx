import { Ban } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, table } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";
import { AddSuppressions } from "./add-suppressions";

export const metadata = { title: "Suppression list" };

const REASON_TONE = { unsubscribed: "amber", bounced: "red", complained: "red", manual: "neutral", do_not_contact: "red" } as const;

export default async function SuppressionsPage() {
  const { store } = await requireContext();
  const rows = await store.list("suppressions", { order: { column: "created_at", ascending: false }, limit: 1000 });
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="overflow-hidden xl:col-span-2">
        <CardHeader title="Suppressed addresses & domains" description="Checked before every send — at approval and again at delivery. Suppressions can't be removed from the app." />
        {rows.length === 0 ? (
          <EmptyState icon={<Ban className="h-5 w-5" />} title="No suppressions yet" description="Unsubscribes, hard bounces and complaints are added automatically." />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr><th className={table.th}>Email / domain</th><th className={table.th}>Reason</th><th className={table.th}>Source</th><th className={table.th}>Added</th></tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className={table.tr}>
                    <td className={`${table.td} font-medium`}>{s.value}{s.kind === "domain" && <Badge className="ml-2">Whole domain</Badge>}</td>
                    <td className={table.td}><Badge tone={REASON_TONE[s.reason]}>{s.reason.replace(/_/g, " ")}</Badge></td>
                    <td className={`${table.td} text-[13px] text-zinc-500`}>{s.source.replace(/_/g, " ")}</td>
                    <td className={`${table.td} text-[13px] text-zinc-500`}>{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AddSuppressions />
    </div>
  );
}
