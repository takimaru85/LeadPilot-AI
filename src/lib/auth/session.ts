import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sign, verify } from "@/lib/crypto";
import { demoDb, MemoryStore } from "@/lib/db/memory-store";
import type { Store } from "@/lib/db/store";
import { SupabaseStore } from "@/lib/db/supabase-store";
import { DEMO_USER, DEMO_WORKSPACE_ID, seedDemo } from "@/lib/demo/seed";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";

export const DEMO_COOKIE = "lp_demo_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface AppContext {
  user: SessionUser;
  workspace: Workspace;
  store: Store;
  demo: boolean;
}

// ───────────────────────────────────────── demo backend
const g = globalThis as unknown as { __leadpilotSeeding?: Promise<void> };

async function ensureDemoSeeded() {
  const db = demoDb();
  if (db.workspaces.length) return db;
  g.__leadpilotSeeding ??= seedDemo(db).finally(() => {
    g.__leadpilotSeeding = undefined;
  });
  await g.__leadpilotSeeding;
  return db;
}

export function demoSessionValue() {
  return `${DEMO_USER.id}.${sign(DEMO_USER.id, "demo-session")}`;
}

async function demoContext(): Promise<AppContext | null> {
  const jar = await cookies();
  const raw = jar.get(DEMO_COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  if (!id || !sig || id !== DEMO_USER.id || !verify(id, sig, "demo-session")) return null;
  const db = await ensureDemoSeeded();
  const store = new MemoryStore(db, DEMO_WORKSPACE_ID);
  const workspace = await store.getWorkspace();
  if (!workspace) return null;
  return { user: DEMO_USER, workspace, store, demo: true };
}

// ───────────────────────────────────────── supabase backend
async function supabaseContext(): Promise<AppContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "User";
  let { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) {
    const { data: wsId, error } = await supabase.rpc("bootstrap_workspace", { ws_name: `${name}'s workspace`, full_name: name });
    if (error) throw new Error(`Could not create workspace: ${error.message}`);
    membership = { workspace_id: wsId as string };
  }
  const store = new SupabaseStore(supabase, membership.workspace_id);
  const workspace = await store.getWorkspace();
  if (!workspace) return null;
  return { user: { id: user.id, email: user.email ?? "", name }, workspace, store, demo: false };
}

/** Current user + workspace, or null when signed out. Deduplicated per request. */
export const getContext = cache(async (): Promise<AppContext | null> => {
  await connection(); // always per-request: never prerender authenticated content
  return isDemoMode() ? demoContext() : supabaseContext();
});

/** For pages: redirect to /login when signed out. */
export async function requireContext(): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * Unscoped store for jobs without a user (queue worker, webhooks, unsubscribe).
 * Call .forWorkspace(id) before touching tenant rows.
 */
export async function getServiceStore(): Promise<Store> {
  if (isDemoMode()) return new MemoryStore(await ensureDemoSeeded(), null);
  return new SupabaseStore(createSupabaseServiceClient(), null);
}
