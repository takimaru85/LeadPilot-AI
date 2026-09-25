import type { Id, Tables, TenantTable, Workspace } from "@/lib/types";

/**
 * A deliberately small query language that both backends implement:
 * Supabase (production, RLS-enforced) and the in-memory demo store.
 * Keeping it small keeps the two implementations honest.
 */
export interface Query<T> {
  eq?: Partial<T>;
  neq?: Partial<T>;
  in?: { [K in keyof T]?: ReadonlyArray<T[K]> };
  gte?: { [K in keyof T]?: T[K] };
  lte?: { [K in keyof T]?: T[K] };
  isNull?: ReadonlyArray<keyof T>;
  notNull?: ReadonlyArray<keyof T>;
  /** Case-insensitive substring match across any of the given text columns. */
  search?: { columns: ReadonlyArray<keyof T>; term: string };
  order?: { column: keyof T; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export type Row<N extends TenantTable> = Tables[N];
export type Insert<N extends TenantTable> = Partial<Omit<Tables[N], "id" | "created_at" | "updated_at">>;
export type Patch<N extends TenantTable> = Partial<Omit<Tables[N], "id" | "workspace_id" | "created_at">>;

export interface Store {
  /** null for the unscoped service store used by cron jobs and webhooks. */
  readonly workspaceId: Id | null;
  readonly backend: "supabase" | "memory";

  list<N extends TenantTable>(table: N, q?: Query<Row<N>>): Promise<Row<N>[]>;
  first<N extends TenantTable>(table: N, q?: Query<Row<N>>): Promise<Row<N> | null>;
  get<N extends TenantTable>(table: N, id: Id): Promise<Row<N> | null>;
  count<N extends TenantTable>(table: N, q?: Query<Row<N>>): Promise<number>;
  insert<N extends TenantTable>(table: N, values: Insert<N>): Promise<Row<N>>;
  update<N extends TenantTable>(table: N, id: Id, patch: Patch<N>): Promise<Row<N>>;
  remove<N extends TenantTable>(table: N, id: Id): Promise<void>;

  getWorkspace(id?: Id): Promise<Workspace | null>;
  updateWorkspace(patch: Partial<Omit<Workspace, "id" | "created_at">>): Promise<Workspace>;

  /** Same backend, scoped to another workspace (service store only). */
  forWorkspace(id: Id): Store;
}

export class StoreError extends Error {
  constructor(
    message: string,
    readonly code: "conflict" | "not_found" | "forbidden" | "backend",
  ) {
    super(message);
    this.name = "StoreError";
  }
}

export function requireWorkspace(store: Store): Id {
  if (!store.workspaceId) throw new StoreError("This operation needs a workspace-scoped store", "forbidden");
  return store.workspaceId;
}
