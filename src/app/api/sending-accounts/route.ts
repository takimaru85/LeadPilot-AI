import { ok, parseJson, withAuth } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { redact } from "@/lib/services/accounts";
import { actorOf, recordAudit } from "@/lib/services/audit";
import type { SendingAccount } from "@/lib/types";
import { SendingAccountInput } from "@/lib/validation";

export const GET = withAuth(async (_req, { store }) => ok((await store.list("sending_accounts", { order: { column: "created_at" } })).map(redact)));

export const POST = withAuth(async (req, ctx) => {
  const input = await parseJson(req, SendingAccountInput);
  const base = {
    provider: input.provider, label: input.label, from_email: input.from_email, from_name: input.from_name,
    daily_limit: input.daily_limit, per_minute_limit: input.per_minute_limit, warmup_enabled: input.warmup_enabled,
  };
  let account: SendingAccount;
  if (input.provider === "smtp") {
    account = await ctx.store.insert("sending_accounts", {
      ...base, config: { host: input.host, port: input.port, secure: input.secure, username: input.username },
      secret_encrypted: encryptSecret(input.password), status: "active",
    });
  } else if (input.provider === "resend") {
    account = await ctx.store.insert("sending_accounts", { ...base, config: {}, secret_encrypted: encryptSecret(input.api_key), status: "active" });
  } else {
    // Gmail / Microsoft need OAuth (not yet wired); sandbox never delivers.
    account = await ctx.store.insert("sending_accounts", { ...base, config: {}, status: input.provider === "sandbox" ? "active" : "needs_auth" });
  }
  await recordAudit(ctx.store, actorOf(ctx), {
    action: "sending_account.created", summary: `Connected ${input.provider} account “${account.label}” (${account.from_email})`, entityType: "sending_account", entityId: account.id,
  });
  return ok(redact(account), { status: 201 });
});
