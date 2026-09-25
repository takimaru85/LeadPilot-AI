import Link from "next/link";
import { Send } from "lucide-react";
import { MessageStatusBadge } from "@/components/status";
import { Card, CardHeader, EmptyState, table } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";
import { ProcessQueueButton } from "./process-button";

export const metadata = { title: "Outbox" };

export default async function OutboxPage() {
  const { store } = await requireContext();
  const [messages, accounts, leads] = await Promise.all([
    store.list("email_messages", { order: { column: "created_at", ascending: false }, limit: 100 }),
    store.list("sending_accounts"),
    store.list("leads", { limit: 5000 }),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.label]));
  const leadName = new Map(leads.map((l) => [l.id, l.company_name]));
  const queued = messages.filter((m) => m.status === "queued").length;
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Outbox"
        description="Approved emails, their delivery status, and retries. Queued emails wait for sending limits or a retry window."
        action={queued > 0 && <ProcessQueueButton />}
      />
      {messages.length === 0 ? (
        <EmptyState icon={<Send className="h-5 w-5" />} title="No emails yet" description="Approved emails appear here." />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Recipient</th>
                <th className={table.th}>Subject</th>
                <th className={table.th}>Account</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>When</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className={table.tr}>
                  <td className={table.td}>
                    <Link href={`/leads/${m.lead_id}`} className="font-medium hover:text-brand-700">{leadName.get(m.lead_id) ?? "Deleted lead"}</Link>
                    <div className="text-xs text-zinc-500">{m.to_email}</div>
                  </td>
                  <td className={`${table.td} max-w-xs truncate text-[13px] text-zinc-700`}>{m.subject}</td>
                  <td className={`${table.td} text-[13px] text-zinc-600`}>{(m.account_id && accountName.get(m.account_id)) ?? "—"}</td>
                  <td className={table.td}>
                    <MessageStatusBadge status={m.status} />
                    {m.error && m.status !== "sent" && <div className="mt-1 max-w-[16rem] text-xs text-zinc-500">{m.error}</div>}
                    {m.attempts > 1 && <div className="text-xs text-zinc-400">{m.attempts} attempts</div>}
                  </td>
                  <td className={`${table.td} text-[13px] whitespace-nowrap text-zinc-500`}>
                    {m.sent_at ? formatDate(m.sent_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : m.status === "queued" ? `Next try ${formatDate(m.next_attempt_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : formatDate(m.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
