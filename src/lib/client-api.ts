"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }

  /** Flattens validation / guard details into readable lines. */
  get lines(): string[] {
    if (Array.isArray(this.details)) {
      return this.details.map((d) => (typeof d === "string" ? d : d?.path ? `${d.path}: ${d.message}` : (d?.message ?? String(d))));
    }
    return [];
  }
}

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("Network error — check your connection.", 0);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status, json.details);
  return json.data as T;
}
