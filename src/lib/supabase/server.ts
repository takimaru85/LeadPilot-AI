import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/** Supabase client bound to the signed-in user's session (RLS applies). */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; proxy.ts refreshes the session.
        }
      },
    },
  });
}

/**
 * Service-role client: bypasses RLS. Only for server-side jobs without a user
 * (cron queue worker, provider webhooks, public unsubscribe endpoint).
 */
export function createSupabaseServiceClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for background jobs, webhooks and unsubscribe handling.");
  }
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
