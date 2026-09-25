import "server-only";
import type { Store } from "@/lib/db/store";
import type { EmailEventType } from "@/lib/types";
import { daysAgoIso } from "@/lib/utils";

/**
 * Metrics are always derived from rows (counts), never stored as counters, so they can't drift.
 * Campaign-scoped variants filter by campaign_id / campaign membership.
 */

export interface FunnelMetrics {
  leadsFound: number;
  qualified: number;
  approved: number;
  sent: number;
  delivered: number;
  bounced: number;
  replies: number;
  positive: number;
  meetings: number;
}

const QUALIFIED_STATUSES = ["qualified", "draft_ready", "approved", "contacted", "replied", "meeting"] as const;

async function eventCount(store: Store, type: EmailEventType, campaignId?: string) {
  return store.count("email_events", { eq: { type, ...(campaignId ? { campaign_id: campaignId } : {}) } });
}

export async function workspaceMetrics(store: Store): Promise<FunnelMetrics> {
  const [leadsFound, qualified, approved, sent, delivered, bounced, replies, positive, meetings] = await Promise.all([
    store.count("leads"),
    store.count("leads", { in: { status: [...QUALIFIED_STATUSES] } }),
    store.count("email_messages"),
    store.count("email_messages", { eq: { status: "sent" } }),
    eventCount(store, "delivered"),
    eventCount(store, "bounced"),
    eventCount(store, "replied"),
    eventCount(store, "positive_reply"),
    eventCount(store, "meeting_booked"),
  ]);
  return { leadsFound, qualified, approved, sent, delivered, bounced, replies, positive, meetings };
}

export async function campaignMetrics(store: Store, campaignId: string): Promise<FunnelMetrics> {
  const members = await store.list("campaign_leads", { eq: { campaign_id: campaignId } });
  const leadIds = members.map((m) => m.lead_id);
  const [qualified, approved, sent, delivered, bounced, replies, positive, meetings] = await Promise.all([
    leadIds.length ? store.count("leads", { in: { id: leadIds, status: [...QUALIFIED_STATUSES] } }) : 0,
    store.count("email_messages", { eq: { campaign_id: campaignId } }),
    store.count("email_messages", { eq: { campaign_id: campaignId, status: "sent" } }),
    eventCount(store, "delivered", campaignId),
    eventCount(store, "bounced", campaignId),
    eventCount(store, "replied", campaignId),
    eventCount(store, "positive_reply", campaignId),
    eventCount(store, "meeting_booked", campaignId),
  ]);
  return { leadsFound: leadIds.length, qualified, approved, sent, delivered, bounced, replies, positive, meetings };
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  sent: number;
  replies: number;
  leads: number;
}

/** Per-day activity for the last N days. */
export async function dailySeries(store: Store, days = 14): Promise<DailyPoint[]> {
  const since = daysAgoIso(days - 1);
  const [messages, events, leads] = await Promise.all([
    store.list("email_messages", { eq: { status: "sent" }, gte: { sent_at: since }, limit: 5000 }),
    store.list("email_events", { eq: { type: "replied" }, gte: { created_at: since }, limit: 5000 }),
    store.list("leads", { gte: { created_at: since }, limit: 5000 }),
  ]);
  const key = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const points = new Map<string, DailyPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const k = key(daysAgoIso(i));
    points.set(k, { date: k, sent: 0, replies: 0, leads: 0 });
  }
  const bump = (iso: string | null, field: "sent" | "replies" | "leads") => {
    const p = iso ? points.get(key(iso)) : undefined;
    if (p) p[field]++;
  };
  for (const m of messages) bump(m.sent_at, "sent");
  for (const e of events) bump(e.created_at, "replies");
  for (const l of leads) bump(l.created_at, "leads");
  return [...points.values()];
}

export async function statusBreakdown(store: Store) {
  const leads = await store.list("leads", { limit: 10000 });
  const counts = new Map<string, number>();
  for (const l of leads) counts.set(l.status, (counts.get(l.status) ?? 0) + 1);
  return [...counts.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
}

export async function scoreDistribution(store: Store) {
  const leads = await store.list("leads", { notNull: ["score"], limit: 10000 });
  const buckets = [
    { label: "0–34", min: 0, max: 34, count: 0 },
    { label: "35–54", min: 35, max: 54, count: 0 },
    { label: "55–74", min: 55, max: 74, count: 0 },
    { label: "75–100", min: 75, max: 100, count: 0 },
  ];
  for (const l of leads) buckets.find((b) => l.score! >= b.min && l.score! <= b.max)!.count++;
  return buckets.map(({ label, count }) => ({ label, count }));
}
