import { requireContext } from "@/lib/auth/session";
import { effectiveDailyLimit } from "@/lib/email/guard";
import { redact } from "@/lib/services/accounts";
import { startOfDayIso } from "@/lib/utils";
import { AccountsClient } from "./accounts-client";

export const metadata = { title: "Sending accounts" };

export default async function AccountsPage() {
  const { store } = await requireContext();
  const accounts = await store.list("sending_accounts", { order: { column: "created_at" } });
  const today = startOfDayIso();
  const rows = await Promise.all(
    accounts.map(async (a) => ({
      account: redact(a),
      sentToday: await store.count("email_messages", { eq: { account_id: a.id, status: "sent" }, gte: { sent_at: today } }),
      effectiveLimit: effectiveDailyLimit(a),
    })),
  );
  return <AccountsClient rows={rows} />;
}
