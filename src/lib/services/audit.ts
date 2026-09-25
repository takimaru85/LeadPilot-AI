import "server-only";
import type { Store } from "@/lib/db/store";

export interface AuditInput {
  action: string;
  summary: string;
  entityType: string;
  entityId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Append-only audit trail. Failures are logged, never thrown — an audit hiccup must not undo the action. */
export async function recordAudit(store: Store, actor: { id: string | null; label: string }, a: AuditInput) {
  try {
    await store.insert("audit_log", {
      actor_id: actor.id,
      actor_label: actor.label,
      action: a.action,
      entity_type: a.entityType,
      entity_id: a.entityId ?? null,
      lead_id: a.leadId ?? null,
      summary: a.summary,
      metadata: a.metadata ?? {},
    });
  } catch (e) {
    console.error("[audit] failed to record", a.action, e);
  }
}

export const actorOf = (ctx: { user: { id: string; name: string; email: string } }) => ({ id: ctx.user.id, label: ctx.user.name || ctx.user.email });
export const SYSTEM_ACTOR = { id: null, label: "System" };
