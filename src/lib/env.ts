import "server-only";

/**
 * Central, validated access to environment variables.
 * Anything optional degrades to a clearly-labelled demo implementation instead of crashing.
 */

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  appUrl: (read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  anthropicApiKey: read("ANTHROPIC_API_KEY"),
  anthropicModel: read("ANTHROPIC_MODEL") ?? "claude-opus-5",
  googlePlacesApiKey: read("GOOGLE_PLACES_API_KEY"),
  resendWebhookSecret: read("RESEND_WEBHOOK_SECRET"),
  cronSecret: read("CRON_SECRET"),
  appSecret: read("APP_SECRET"),
  encryptionKey: read("ENCRYPTION_KEY"),
  crawlerContact: read("CRAWLER_CONTACT_URL"),
  demoModeFlag: read("DEMO_MODE"),
  isProduction: process.env.NODE_ENV === "production",
};

/** Supabase is the real backend; without it the app runs on the in-memory demo store. */
export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/**
 * Demo mode = no Supabase. Refused in production unless explicitly enabled with DEMO_MODE=true,
 * so a mis-configured deploy fails loudly instead of silently serving throwaway data.
 */
export function isDemoMode(): boolean {
  if (supabaseConfigured) return false;
  if (env.isProduction && env.demoModeFlag !== "true") {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or DEMO_MODE=true for a throwaway demo.",
    );
  }
  return true;
}

export const aiConfigured = Boolean(env.anthropicApiKey);

const DEV_SECRET = "leadpilot-dev-secret-do-not-use-in-production";

/** Secret for HMAC tokens (unsubscribe links, demo session). */
export function appSecret(): string {
  if (env.appSecret) return env.appSecret;
  if (env.isProduction && supabaseConfigured) throw new Error("APP_SECRET must be set in production.");
  return DEV_SECRET;
}
