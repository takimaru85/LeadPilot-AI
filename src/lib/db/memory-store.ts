import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Id, Tables, TenantTable, Workspace } from "@/lib/types";
import { StoreError, type Insert, type Patch, type Query, type Row, type Store } from "./store";

/**
 * In-memory demo backend. Mirrors the SQL defaults and unique constraints from
 * supabase/migrations/0001_init.sql so demo behaviour matches production.
 * State lives on globalThis (survives hot reload) and is persisted to .data/demo-store.json
 * so a dev-server restart keeps your test data. Never used when Supabase is configured.
 */

type Db = { [N in keyof Tables]: Tables[N][] };

const DEFAULTS: { [N in TenantTable]: () => Partial<Tables[N]> } = {
  products: () => ({
    description: "", target_customer: "", industry: "", location: "", company_size: "",
    customer_problem: "", why_buy: "", website_url: "", pricing: "",
  }),
  icps: () => ({
    product_id: null, industries: [], business_types: [], locations: [], company_sizes: [], job_titles: [],
    pain_points: [], buying_signals: [], keywords: [], structured: null, structured_by: null,
  }),
  lead_searches: () => ({ icp_id: null, location: "", status: "completed", result_count: 0, added_count: 0, error: null }),
  leads: () => ({
    icp_id: null, search_id: null, domain: null, website: null, industry: "", location: "", description: "", site_excerpt: null,
    phone: null, email: null, email_type: null, email_source_url: null, contact_name: null, contact_title: null,
    source_ref: null, source_url: null, consent_basis: "unknown", status: "new", score: null, fit: null,
    reason: null, enriched_at: null, last_contacted_at: null,
  }),
  lead_qualifications: () => ({ evidence: [], unknowns: [] }),
  campaigns: () => ({ description: "", audience: "", product_id: null, icp_id: null, sending_account_id: null, status: "draft" }),
  campaign_leads: () => ({}),
  sending_accounts: () => ({
    from_name: "", config: {}, secret_encrypted: null, daily_limit: 30, per_minute_limit: 2,
    warmup_enabled: true, status: "active", last_error: null,
  }),
  email_drafts: () => ({
    campaign_id: null, qualification_id: null, personalization_used: [], warnings: [], status: "draft", edited: false,
  }),
  email_messages: () => ({
    campaign_id: null, account_id: null, status: "queued", attempts: 0, next_attempt_at: new Date().toISOString(),
    provider_message_id: null, error: null, sent_at: null,
  }),
  email_events: () => ({ message_id: null, lead_id: null, campaign_id: null, detail: null }),
  suppressions: () => ({ source: "manual" }),
  audit_log: () => ({ actor_id: null, entity_id: null, lead_id: null, metadata: {} }),
};

/** Unique constraints from the SQL schema (null values never conflict, as in Postgres). */
const UNIQUE: Partial<{ [N in TenantTable]: (keyof Tables[N])[][] }> = {
  leads: [["workspace_id", "domain"]],
  suppressions: [["workspace_id", "value"]],
  campaign_leads: [["campaign_id", "lead_id"]],
  email_messages: [["draft_id"]],
};

const HAS_UPDATED_AT = new Set<TenantTable>(["products", "icps", "leads", "campaigns", "sending_accounts", "email_drafts", "email_messages"]);

const DATA_FILE = path.join(process.cwd(), ".data", "demo-store.json");

function emptyDb(): Db {
  return {
    workspaces: [], products: [], icps: [], lead_searches: [], leads: [], lead_qualifications: [], campaigns: [],
    campaign_leads: [], sending_accounts: [], email_drafts: [], email_messages: [], email_events: [], suppressions: [], audit_log: [],
  };
}

const g = globalThis as unknown as { __leadpilotDemoDb?: Db; __leadpilotDemoSave?: NodeJS.Timeout };

/** Loads persisted demo state, or an empty DB that the caller seeds (see src/lib/demo/seed.ts). */
export function demoDb(): Db {
  if (!g.__leadpilotDemoDb) {
    let loaded: Db | null = null;
    try {
      if (fs.existsSync(DATA_FILE)) loaded = { ...emptyDb(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
    } catch {
      loaded = null; // corrupt file: reseed
    }
    g.__leadpilotDemoDb = loaded ?? emptyDb();
  }
  return g.__leadpilotDemoDb;
}

export function resetDemoDb(): Db {
  g.__leadpilotDemoDb = emptyDb();
  persist();
  return g.__leadpilotDemoDb;
}

export function persistDemoDb() {
  persist();
}

function persist() {
  if (g.__leadpilotDemoSave) clearTimeout(g.__leadpilotDemoSave);
  g.__leadpilotDemoSave = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(g.__leadpilotDemoDb));
    } catch {
      // Read-only filesystem (e.g. serverless demo): stay in memory only.
    }
  }, 150);
}

const clone = <T,>(v: T): T => structuredClone(v);

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1; // nulls last
  if (b === null || b === undefined) return -1;
  return a < b ? -1 : 1;
}

export function applyQuery<T extends object>(rows: T[], q: Query<T> = {}): T[] {
  let out = rows.filter((r) => {
    const rec = r as Record<string, unknown>;
    for (const [k, v] of Object.entries(q.eq ?? {})) if (rec[k] !== v) return false;
    for (const [k, v] of Object.entries(q.neq ?? {})) if (rec[k] === v) return false;
    for (const [k, vs] of Object.entries(q.in ?? {})) if (!(vs as unknown[]).includes(rec[k])) return false;
    for (const [k, v] of Object.entries(q.gte ?? {})) if (rec[k] === null || cmp(rec[k], v) < 0) return false;
    for (const [k, v] of Object.entries(q.lte ?? {})) if (rec[k] === null || cmp(rec[k], v) > 0) return false;
    for (const k of q.isNull ?? []) if (rec[k as string] !== null && rec[k as string] !== undefined) return false;
    for (const k of q.notNull ?? []) if (rec[k as string] === null || rec[k as string] === undefined) return false;
    if (q.search && q.search.term.trim()) {
      const term = q.search.term.trim().toLowerCase();
      const hit = q.search.columns.some((c) => String(rec[c as string] ?? "").toLowerCase().includes(term));
      if (!hit) return false;
    }
    return true;
  });
  if (q.order) {
    const { column, ascending = true } = q.order;
    out = [...out].sort((a, b) => {
      const av = (a as Record<string, unknown>)[column as string];
      const bv = (b as Record<string, unknown>)[column as string];
      // Nulls always last in either direction (matches the Supabase store's nullsFirst: false).
      if (av === null || av === undefined || bv === null || bv === undefined) return cmp(av, bv);
      const c = cmp(av, bv);
      return ascending ? c : -c;
    });
  }
  const offset = q.offset ?? 0;
  if (offset || q.limit !== undefined) out = out.slice(offset, q.limit !== undefined ? offset + q.limit : undefined);
  return out;
}

export class MemoryStore implements Store {
  readonly backend = "memory" as const;
  constructor(
    private readonly db: Db,
    readonly workspaceId: Id | null,
  ) {}

  forWorkspace(id: Id): Store {
    return new MemoryStore(this.db, id);
  }

  private scoped<N extends TenantTable>(table: N, q: Query<Row<N>> = {}): Query<Row<N>> {
    if (!this.workspaceId) return q;
    return { ...q, eq: { ...(q.eq ?? {}), workspace_id: this.workspaceId } as Partial<Row<N>> };
  }

  private rows<N extends TenantTable>(table: N): Row<N>[] {
    return this.db[table] as Row<N>[];
  }

  async list<N extends TenantTable>(table: N, q?: Query<Row<N>>) {
    return clone(applyQuery(this.rows(table), this.scoped(table, q)));
  }

  async first<N extends TenantTable>(table: N, q?: Query<Row<N>>) {
    return (await this.list(table, { ...q, limit: 1 }))[0] ?? null;
  }

  async get<N extends TenantTable>(table: N, id: Id) {
    return this.first(table, { eq: { id } as Partial<Row<N>> });
  }

  async count<N extends TenantTable>(table: N, q?: Query<Row<N>>) {
    const filters: Query<Row<N>> = { ...q, limit: undefined, offset: undefined, order: undefined };
    return applyQuery(this.rows(table), this.scoped(table, filters)).length;
  }

  private checkUnique<N extends TenantTable>(table: N, row: Row<N>) {
    for (const cols of UNIQUE[table] ?? []) {
      const rec = row as unknown as Record<string, unknown>;
      if (cols.some((c) => rec[c as string] === null || rec[c as string] === undefined)) continue;
      const clash = this.rows(table).find(
        (r) => (r as { id: Id }).id !== (row as { id: Id }).id && cols.every((c) => (r as unknown as Record<string, unknown>)[c as string] === rec[c as string]),
      );
      if (clash) throw new StoreError(`Duplicate ${table} (${cols.join(", ")})`, "conflict");
    }
  }

  async insert<N extends TenantTable>(table: N, values: Insert<N>) {
    const now = new Date().toISOString();
    const workspace_id = this.workspaceId ?? (values as { workspace_id?: Id }).workspace_id;
    if (!workspace_id) throw new StoreError("workspace_id is required", "forbidden");
    const row = {
      ...DEFAULTS[table](),
      ...clone(values),
      id: crypto.randomUUID(),
      workspace_id,
      created_at: now,
      ...(HAS_UPDATED_AT.has(table) ? { updated_at: now } : {}),
    } as unknown as Row<N>;
    this.checkUnique(table, row);
    this.rows(table).push(row);
    persist();
    return clone(row);
  }

  async update<N extends TenantTable>(table: N, id: Id, patch: Patch<N>) {
    const rows = this.rows(table);
    const idx = rows.findIndex(
      (r) => (r as { id: Id }).id === id && (!this.workspaceId || (r as { workspace_id: Id }).workspace_id === this.workspaceId),
    );
    if (idx < 0) throw new StoreError(`${table} ${id} not found`, "not_found");
    const next = {
      ...rows[idx],
      ...clone(patch),
      ...(HAS_UPDATED_AT.has(table) ? { updated_at: new Date().toISOString() } : {}),
    } as Row<N>;
    this.checkUnique(table, next);
    rows[idx] = next;
    persist();
    return clone(next);
  }

  async remove<N extends TenantTable>(table: N, id: Id) {
    const rows = this.rows(table);
    const idx = rows.findIndex(
      (r) => (r as { id: Id }).id === id && (!this.workspaceId || (r as { workspace_id: Id }).workspace_id === this.workspaceId),
    );
    if (idx >= 0) rows.splice(idx, 1);
    persist();
  }

  async getWorkspace(id?: Id): Promise<Workspace | null> {
    const wid = id ?? this.workspaceId;
    return clone(this.db.workspaces.find((w) => w.id === wid) ?? null);
  }

  async updateWorkspace(patch: Partial<Omit<Workspace, "id" | "created_at">>): Promise<Workspace> {
    const w = this.db.workspaces.find((x) => x.id === this.workspaceId);
    if (!w) throw new StoreError("workspace not found", "not_found");
    Object.assign(w, clone(patch), { updated_at: new Date().toISOString() });
    persist();
    return clone(w);
  }
}

export type { Db as DemoDb };
export { emptyDb };
