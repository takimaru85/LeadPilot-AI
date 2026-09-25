import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { decryptSecret } from "@/lib/crypto";
import type { SendingAccount } from "@/lib/types";
import type { ComposedEmail } from "./compose";

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; permanent: boolean; bounce: boolean; error: string };

export interface EmailTransport {
  send(msg: ComposedEmail): Promise<SendResult>;
  /** Checks credentials without sending mail. */
  verify(): Promise<{ ok: boolean; error?: string }>;
}

function secretOf(account: SendingAccount): string {
  if (!account.secret_encrypted) throw new Error("No credentials stored for this account.");
  return decryptSecret(account.secret_encrypted);
}

/** Records the message as sent without delivering anything. Used by the demo and for dry runs. */
const sandbox: EmailTransport = {
  async send() {
    return { ok: true, providerMessageId: `sandbox_${crypto.randomUUID().slice(0, 12)}` };
  },
  async verify() {
    return { ok: true };
  },
};

function smtp(account: SendingAccount): EmailTransport {
  const make = () =>
    nodemailer.createTransport({
      host: String(account.config.host ?? ""),
      port: Number(account.config.port ?? 587),
      secure: Boolean(account.config.secure),
      auth: { user: String(account.config.username ?? account.from_email), pass: secretOf(account) },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  return {
    async send(msg) {
      try {
        const info = await make().sendMail({ from: msg.from, to: msg.to, replyTo: msg.replyTo, subject: msg.subject, text: msg.text, headers: msg.headers });
        return { ok: true, providerMessageId: info.messageId };
      } catch (e) {
        const err = e as { responseCode?: number; response?: string; message?: string; code?: string };
        const code = err.responseCode ?? 0;
        const text = err.response ?? err.message ?? "SMTP error";
        // 5xx = permanent. 550/551/553 with a 5.1.x enhanced code = recipient doesn't exist (hard bounce).
        const permanent = code >= 500 || err.code === "EAUTH" || err.code === "EENVELOPE";
        const bounce = [550, 551, 553].includes(code) && /5\.1\.\d|no such user|does not exist|unknown user|mailbox unavailable/i.test(text);
        return { ok: false, permanent, bounce, error: text.slice(0, 500) };
      }
    },
    async verify() {
      try {
        await make().verify();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  };
}

function resend(account: SendingAccount): EmailTransport {
  return {
    async send(msg) {
      const client = new Resend(secretOf(account));
      const { data, error } = await client.emails.send({
        from: msg.from, to: msg.to, replyTo: msg.replyTo, subject: msg.subject, text: msg.text, headers: msg.headers,
      });
      if (error || !data) {
        const transient = ["rate_limit_exceeded", "internal_server_error", "application_error", "concurrent_idempotent_requests"].includes(error?.name ?? "");
        return { ok: false, permanent: !transient, bounce: false, error: error?.message ?? "Resend error" };
      }
      return { ok: true, providerMessageId: data.id };
    },
    async verify() {
      try {
        const { error } = await new Resend(secretOf(account)).domains.list();
        return error ? { ok: false, error: error.message } : { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  };
}

/** Gmail / Microsoft 365 need OAuth apps registered by you; until then they refuse to send. */
function oauthPending(provider: string): EmailTransport {
  const error = `${provider} OAuth sending isn't configured yet. Connect this mailbox via SMTP with an app password, or add OAuth credentials (see README).`;
  return {
    async send() {
      return { ok: false, permanent: true, bounce: false, error };
    },
    async verify() {
      return { ok: false, error };
    },
  };
}

export function getTransport(account: SendingAccount): EmailTransport {
  switch (account.provider) {
    case "sandbox": return sandbox;
    case "smtp": return smtp(account);
    case "resend": return resend(account);
    case "gmail": return oauthPending("Gmail");
    case "microsoft": return oauthPending("Microsoft 365");
  }
}
