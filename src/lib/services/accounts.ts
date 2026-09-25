import type { SendingAccount } from "@/lib/types";

export type PublicSendingAccount = Omit<SendingAccount, "secret_encrypted"> & { has_secret: boolean };

/** Never return the encrypted secret to the browser. */
export function redact(a: SendingAccount): PublicSendingAccount {
  const { secret_encrypted, ...rest } = a;
  return { ...rest, has_secret: Boolean(secret_encrypted) };
}
