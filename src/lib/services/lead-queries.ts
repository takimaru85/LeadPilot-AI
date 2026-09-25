import "server-only";
import type { Query, Store } from "@/lib/db/store";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";

export interface LeadFilters {
  q: string;
  status: LeadStatus | "all";
  minScore: number | null;
  campaign: string | null;
  sort: "created_at" | "score" | "company_name" | "last_contacted_at";
  page: number;
}

export const PAGE_SIZE = 25;

export function parseLeadFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const s = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? "";
  const status = s("status");
  const sort = s("sort");
  const min = Number(s("min_score"));
  return {
    q: s("q").slice(0, 100),
    status: (LEAD_STATUSES as readonly string[]).includes(status) ? (status as LeadStatus) : "all",
    minScore: Number.isFinite(min) && min > 0 ? Math.min(100, min) : null,
    campaign: /^[0-9a-f-]{36}$/i.test(s("campaign")) ? s("campaign") : null,
    sort: (["created_at", "score", "company_name", "last_contacted_at"] as const).find((x) => x === sort) ?? "created_at",
    page: Math.max(1, Number(s("page")) || 1),
  };
}

export async function listLeads(store: Store, f: LeadFilters): Promise<{ leads: Lead[]; total: number; page: number; pageSize: number }> {
  const q: Query<Lead> = {};
  if (f.status !== "all") q.eq = { status: f.status };
  if (f.minScore !== null) q.gte = { score: f.minScore };
  if (f.q) q.search = { columns: ["company_name", "industry", "location", "email", "contact_name", "domain"], term: f.q };
  if (f.campaign) {
    const members = await store.list("campaign_leads", { eq: { campaign_id: f.campaign } });
    q.in = { id: members.map((m) => m.lead_id) };
    if (!members.length) return { leads: [], total: 0, page: 1, pageSize: PAGE_SIZE };
  }
  const total = await store.count("leads", q);
  const leads = await store.list("leads", {
    ...q,
    order: { column: f.sort, ascending: f.sort === "company_name" },
    limit: PAGE_SIZE,
    offset: (f.page - 1) * PAGE_SIZE,
  });
  return { leads, total, page: f.page, pageSize: PAGE_SIZE };
}
