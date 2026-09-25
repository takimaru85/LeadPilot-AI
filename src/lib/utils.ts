import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalise a URL or host to a bare lowercase domain without www. Returns null if unparsable. */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("@")) s = s.split("@").pop()!;
  try {
    const url = new URL(/^[a-z]+:\/\//.test(s) ? s : `https://${s}`);
    const host = url.hostname.replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

export function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;
export function isValidEmail(s: string | null | undefined): s is string {
  return !!s && EMAIL_RE.test(s.trim());
}

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@").pop() ?? "";
}

/** Role mailboxes: addresses for a function, not a person. Preferred for B2B first contact. */
const ROLE_LOCAL_PARTS = new Set([
  "info", "hello", "hi", "contact", "enquiries", "enquiry", "inquiries", "admin", "office", "reception",
  "bookings", "booking", "appointments", "sales", "support", "team", "mail", "general", "practice", "studio",
]);
export function emailType(email: string): "role" | "personal" {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  return ROLE_LOCAL_PARTS.has(local) ? "role" : "personal";
}

export function splitList(input: string | string[] | undefined | null): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : input.split(/[,\n;]/);
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function startOfDayIso(d = new Date()): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

export function daysAgoIso(days: number, from = new Date()): string {
  return new Date(from.getTime() - days * 86_400_000).toISOString();
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-AU", opts).format(new Date(iso));
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}
