import "server-only";
import type { Store } from "@/lib/db/store";
import { StoreError } from "@/lib/db/store";
import type { Suppression, SuppressionReason } from "@/lib/types";
import { isValidEmail, normalizeDomain } from "@/lib/utils";
import { recordAudit } from "./audit";

/**
 * Add an email or domain to the suppression list. Idempotent. Suppressions are never
 * lifted through the app — only by an admin directly in the database.
 */
export async function addSuppression(
  store: Store,
  actor: { id: string | null; label: string },
  input: { value: string; reason: SuppressionReason; source: string },
): Promise<Suppression> {
  const raw = input.value.trim().toLowerCase();
  const kind: Suppression["kind"] = raw.includes("@") ? "email" : "domain";
  const value = kind === "email" ? raw : normalizeDomain(raw);
  if (!value || (kind === "email" && !isValidEmail(value))) throw new StoreError(`“${input.value}” is not a valid email address or domain.`, "conflict");

  const existing = await store.first("suppressions", { eq: { value } });
  if (existing) return existing;

  let row: Suppression;
  try {
    row = await store.insert("suppressions", { value, kind, reason: input.reason, source: input.source });
  } catch (e) {
    if (e instanceof StoreError && e.code === "conflict") return (await store.first("suppressions", { eq: { value } }))!;
    throw e;
  }

  // Leads with this address/domain become Do Not Contact for hard opt-outs.
  if (["unsubscribed", "complained", "do_not_contact"].includes(input.reason)) {
    const leads =
      kind === "email" ? await store.list("leads", { eq: { email: value } }) : await store.list("leads", { eq: { domain: value } });
    for (const l of leads) await store.update("leads", l.id, { status: "do_not_contact" });
  }
  await recordAudit(store, actor, {
    action: "suppression.added",
    summary: `Suppressed ${value} (${input.reason})`,
    entityType: "suppression",
    entityId: row.id,
    metadata: { source: input.source },
  });
  return row;
}
