import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { AiError } from "@/lib/ai/claude";
import { getContext, type AppContext } from "@/lib/auth/session";
import { StoreError } from "@/lib/db/store";
import { rateLimit } from "@/lib/rate-limit";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const ok = <T,>(data: T, init?: ResponseInit) => NextResponse.json({ data }, init);
export const fail = (status: number, error: string, details?: unknown) => NextResponse.json({ error, details }, { status });

export function toErrorResponse(e: unknown) {
  if (e instanceof HttpError) return fail(e.status, e.message, e.details);
  if (e instanceof ZodError) {
    return fail(400, "Please check the highlighted fields.", e.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  if (e instanceof StoreError) {
    const status = { conflict: 409, not_found: 404, forbidden: 403, backend: 500 }[e.code];
    return fail(status, e.code === "backend" ? "Database error. Please try again." : e.message);
  }
  if (e instanceof AiError) {
    const status = { config: 503, refusal: 422, rate_limit: 429, invalid_output: 502, unavailable: 503 }[e.kind];
    return fail(status, e.message);
  }
  console.error("[api] unhandled error", e);
  return fail(500, "Something went wrong. Please try again.");
}

export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

type Handler<R> = (req: Request, ctx: AppContext, route: R) => Promise<Response>;

/**
 * Wraps a route handler: requires a signed-in workspace member, optionally rate limits,
 * and maps known errors to consistent JSON responses.
 */
export function withAuth<R = unknown>(handler: Handler<R>, opts?: { rate?: { bucket: string; limit: number; windowMs: number } }) {
  return async (req: Request, route: R) => {
    try {
      const ctx = await getContext();
      if (!ctx) return fail(401, "Please sign in.");
      if (opts?.rate) {
        const r = rateLimit(`${ctx.user.id}:${opts.rate.bucket}`, opts.rate.limit, opts.rate.windowMs);
        if (!r.ok) return fail(429, `Too many requests. Try again in ${Math.ceil(r.retryAfterMs / 1000)}s.`);
      }
      return await handler(req, ctx, route);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

/** Standard rate-limit budgets. */
export const RATE = {
  ai: { bucket: "ai", limit: 30, windowMs: 60_000 },
  search: { bucket: "search", limit: 10, windowMs: 60_000 },
  send: { bucket: "send", limit: 20, windowMs: 60_000 },
  crawl: { bucket: "crawl", limit: 20, windowMs: 60_000 },
} as const;
