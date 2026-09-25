import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Id, TenantTable, Workspace } from "@/lib/types";
import { StoreError, type Insert, type Patch, type Query, type Row, type Store } from "./store";

/**
 * Supabase backend. With a user-session client every query is additionally
 * enforced by row-level security; the explicit workspace_id filter is defence in depth.
 * With the service-role client (cron, webhooks, unsubscribe) RLS is bypassed, so callers
 * must scope with forWorkspace() before touching tenant data.
 */

// Generated DB types are optional; we type rows with our own domain types instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any;

function sanitizeSearch(term: string): string {
  // PostgREST .or() syntax uses , ( ) as separators and * % as wildcards.
  return term.replace(/[,()*%\\]/g, " ").trim();
}

function fail(error: { code?: string; message: string }): never {
  if (error.code === "23505") throw new StoreError(error.message, "conflict");
  if (error.code === "42501") throw new StoreError(error.message, "forbidden");
  throw new StoreError(error.message, "backend");
}

export class SupabaseStore implements Store {
  readonly backend = "supabase" as const;
  constructor(
    private readonly client: Client,
    readonly workspaceId: Id | null,
  ) {}

  forWorkspace(id: Id): Store {
    return new SupabaseStore(this.client, id);
  }

  private filter<N extends TenantTable>(b: Builder, q: Query<Row<N>> = {}): Builder {
    if (this.workspaceId) b = b.eq("workspace_id", this.workspaceId);
    for (const [k, v] of Object.entries(q.eq ?? {})) b = v === null ? b.is(k, null) : b.eq(k, v);
    for (const [k, v] of Object.entries(q.neq ?? {})) b = v === null ? b.not(k, "is", null) : b.neq(k, v);
    for (const [k, v] of Object.entries(q.in ?? {})) b = b.in(k, v as unknown[]);
    for (const [k, v] of Object.entries(q.gte ?? {})) b = b.gte(k, v);
    for (const [k, v] of Object.entries(q.lte ?? {})) b = b.lte(k, v);
    for (const k of q.isNull ?? []) b = b.is(k as string, null);
    for (const k of q.notNull ?? []) b = b.not(k as string, "is", null);
    if (q.search) {
      const term = sanitizeSearch(q.search.term);
      if (term) b = b.or(q.search.columns.map((c) => `${String(c)}.ilike.%${term}%`).join(","));
    }
    return b;
  }

  async list<N extends TenantTable>(table: N, q: Query<Row<N>> = {}) {
    let b = this.filter(this.client.from(table).select("*"), q);
    if (q.order) b = b.order(q.order.column as string, { ascending: q.order.ascending ?? true, nullsFirst: false });
    if (q.limit !== undefined) {
      const from = q.offset ?? 0;
      b = b.range(from, from + q.limit - 1);
    }
    const { data, error } = await b;
    if (error) fail(error);
    return (data ?? []) as Row<N>[];
  }

  async first<N extends TenantTable>(table: N, q?: Query<Row<N>>) {
    return (await this.list(table, { ...q, limit: 1 }))[0] ?? null;
  }

  async get<N extends TenantTable>(table: N, id: Id) {
    return this.first(table, { eq: { id } as Partial<Row<N>> });
  }

  async count<N extends TenantTable>(table: N, q?: Query<Row<N>>) {
    const { count, error } = await this.filter(this.client.from(table).select("id", { count: "exact", head: true }), q);
    if (error) fail(error);
    return count ?? 0;
  }

  async insert<N extends TenantTable>(table: N, values: Insert<N>) {
    const row = this.workspaceId ? { ...values, workspace_id: this.workspaceId } : values;
    const { data, error } = await this.client.from(table).insert(row as Record<string, unknown>).select("*").single();
    if (error) fail(error);
    return data as Row<N>;
  }

  async update<N extends TenantTable>(table: N, id: Id, patch: Patch<N>) {
    let b = this.client.from(table).update(patch as Record<string, unknown>).eq("id", id);
    if (this.workspaceId) b = b.eq("workspace_id", this.workspaceId);
    const { data, error } = await b.select("*").maybeSingle();
    if (error) fail(error);
    if (!data) throw new StoreError(`${table} ${id} not found`, "not_found");
    return data as Row<N>;
  }

  async remove<N extends TenantTable>(table: N, id: Id) {
    let b = this.client.from(table).delete().eq("id", id);
    if (this.workspaceId) b = b.eq("workspace_id", this.workspaceId);
    const { error } = await b;
    if (error) fail(error);
  }

  async getWorkspace(id?: Id): Promise<Workspace | null> {
    const wid = id ?? this.workspaceId;
    if (!wid) return null;
    const { data, error } = await this.client.from("workspaces").select("*").eq("id", wid).maybeSingle();
    if (error) fail(error);
    return (data as Workspace | null) ?? null;
  }

  async updateWorkspace(patch: Partial<Omit<Workspace, "id" | "created_at">>): Promise<Workspace> {
    if (!this.workspaceId) throw new StoreError("No workspace", "forbidden");
    const { data, error } = await this.client.from("workspaces").update(patch).eq("id", this.workspaceId).select("*").single();
    if (error) fail(error);
    return data as Workspace;
  }
}
