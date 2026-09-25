/**
 * Sliding-window rate limiter for API abuse protection (AI calls, searches, crawling).
 * In-memory, so limits are per server instance — adequate as a safety net; use a shared store
 * (e.g. Upstash Redis) if you need strict global limits. Email sending limits do NOT rely on
 * this: they are enforced from the database in src/lib/email/guard.ts.
 */
const g = globalThis as unknown as { __leadpilotRate?: Map<string, number[]> };
const hits = (g.__leadpilotRate ??= new Map<string, number[]>());

export function rateLimit(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterMs: windowMs - (now - recent[0]) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}
