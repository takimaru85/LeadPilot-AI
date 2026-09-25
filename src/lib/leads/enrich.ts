import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { demoBusinessByDomain } from "@/lib/demo/catalog";
import { env } from "@/lib/env";
import { emailType, normalizeDomain, normalizeUrl, truncate } from "@/lib/utils";
import { isPathAllowed, parseRobots } from "./robots";

/**
 * Polite, public-only website enrichment.
 * - Identifies itself honestly and honours robots.txt (RFC 9309).
 * - Never logs in, never submits forms, and stops at login walls, CAPTCHAs, 401/403/429.
 * - Only keeps email addresses published on the company's own domain — nothing is guessed.
 * - SSRF-safe: refuses private/loopback/link-local targets, re-checked on every redirect.
 */

export const CRAWLER_TOKEN = "LeadPilotBot";
const USER_AGENT = `${CRAWLER_TOKEN}/1.0 (+${env.crawlerContact ?? `${env.appUrl}/bot`})`;
const PAGE_TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_000_000;
const MAX_PAGES = 3;
const POLITE_DELAY_MS = 1_000;

export interface FoundEmail {
  email: string;
  type: "role" | "personal";
  sourceUrl: string;
}

export type EnrichResult =
  | { ok: true; pages: string[]; title: string | null; description: string | null; excerpt: string; emails: FoundEmail[]; notes: string[] }
  | { ok: false; reason: string; notes: string[] };

class StopCrawl extends Error {}

export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function assertPublicHost(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new StopCrawl("Only http(s) websites can be checked.");
  if (url.port && !["80", "443"].includes(url.port)) throw new StopCrawl("Non-standard ports are not crawled.");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new StopCrawl("Private hosts are not crawled.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new StopCrawl(`Couldn't resolve ${host}.`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new StopCrawl("Website resolves to a private network address.");
}

async function politeFetch(url: URL, rootHost: string, accept = "text/html"): Promise<{ status: number; url: URL; body: string; type: string }> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(current);
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, current);
      if (normalizeDomain(next.hostname) !== rootHost) throw new StopCrawl(`Redirects to another site (${next.hostname}); not followed.`);
      current = next;
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    const reader = res.body?.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        if (received > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    return { status: res.status, url: current, body: Buffer.concat(chunks).toString("utf8"), type };
  }
  throw new StopCrawl("Too many redirects.");
}

const CAPTCHA_MARKERS = /g-recaptcha|h-captcha|hcaptcha\.com|cf-challenge|challenges\.cloudflare\.com|attention required! \| cloudflare|verify you are (a )?human|captcha-delivery/i;
const LOGIN_MARKERS = /<input[^>]+type=["']?password/i;

function textOf(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|section|footer|header)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&copy;/g, "©").replace(/&#169;/g, "©").replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function extractEmails(html: string, text: string, domain: string, sourceUrl: string): FoundEmail[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    try {
      found.add(decodeURIComponent(m[1]).toLowerCase());
    } catch {
      /* malformed escape in href — ignore */
    }
  }
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) found.add(m[0].toLowerCase());
  return [...found]
    .filter((e) => !/\.(png|jpe?g|gif|svg|webp)$/.test(e))
    .filter((e) => {
      const d = e.split("@")[1];
      return d === domain || d.endsWith(`.${domain}`); // published on the company's own domain only
    })
    .map((email) => ({ email, type: emailType(email), sourceUrl }));
}

function demoEnrich(domain: string): EnrichResult | null {
  const b = demoBusinessByDomain(domain);
  if (!b) return null;
  return {
    ok: true,
    pages: [`https://${domain}/ (demo snapshot)`],
    title: b.company_name,
    description: b.description,
    excerpt: b.site_text,
    emails: b.email ? [{ email: b.email, type: emailType(b.email), sourceUrl: `https://${domain}/contact` }] : [],
    notes: ["Fictional demo website — no network request made."],
  };
}

export async function enrichWebsite(website: string): Promise<EnrichResult> {
  const notes: string[] = [];
  const normalized = normalizeUrl(website);
  const domain = normalizeDomain(website);
  if (!normalized || !domain) return { ok: false, reason: "Invalid website URL.", notes };
  if (domain.endsWith(".example")) return demoEnrich(domain) ?? { ok: false, reason: "Unknown demo website.", notes };

  const root = new URL(normalized);
  root.pathname = "/";
  try {
    // robots.txt — 4xx means no restrictions; 5xx/unreachable means assume full disallow (RFC 9309 §2.3.1).
    let rules: ReturnType<typeof parseRobots> = [];
    try {
      const r = await politeFetch(new URL("/robots.txt", root), domain, "text/plain");
      if (r.status >= 500) return { ok: false, reason: "robots.txt is unavailable (server error); not crawling.", notes };
      if (r.status === 200) rules = parseRobots(r.body, CRAWLER_TOKEN);
    } catch (e) {
      if (e instanceof StopCrawl) throw e;
      return { ok: false, reason: "Couldn't reach the website.", notes };
    }
    if (!isPathAllowed(rules, "/")) return { ok: false, reason: "The site's robots.txt asks crawlers not to visit it. Respecting that.", notes };

    const queue: string[] = ["/"];
    const visited: string[] = [];
    const seenPaths = new Set<string>();
    let title: string | null = null;
    let description: string | null = null;
    const texts: string[] = [];
    const emails = new Map<string, FoundEmail>();

    while (queue.length && visited.length < MAX_PAGES) {
      const path = queue.shift()!;
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);
      if (!isPathAllowed(rules, path)) {
        notes.push(`Skipped ${path} (disallowed by robots.txt).`);
        continue;
      }
      if (visited.length) await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
      const page = await politeFetch(new URL(path, root), domain);
      visited.push(page.url.toString());

      if ([401, 403].includes(page.status)) throw new StopCrawl("Access is restricted (401/403). Not attempting to get around it.");
      if (page.status === 429) throw new StopCrawl("The site asked us to slow down (429). Stopping.");
      if (page.status >= 400) {
        notes.push(`${path} returned ${page.status}.`);
        continue;
      }
      if (!page.type.includes("html")) continue;
      if (CAPTCHA_MARKERS.test(page.body)) throw new StopCrawl("The site shows a CAPTCHA / bot challenge. Not bypassing it.");
      if (LOGIN_MARKERS.test(page.body) && path !== "/") {
        notes.push(`${path} is behind a login; skipped.`);
        continue;
      }

      const text = textOf(page.body);
      if (path === "/") {
        title = page.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
        description =
          page.body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
          page.body.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ??
          null;
        // Queue likely contact/about pages linked from the homepage (same site only).
        for (const m of page.body.matchAll(/href=["']([^"'#]+)["']/gi)) {
          try {
            const u = new URL(m[1], root);
            if (normalizeDomain(u.hostname) === domain && /contact|about/i.test(u.pathname) && !queue.includes(u.pathname)) queue.push(u.pathname);
          } catch {
            /* ignore malformed hrefs */
          }
        }
        if (!queue.length) queue.push("/contact", "/contact-us");
      }
      texts.push(truncate(text, path === "/" ? 1500 : 600));
      for (const e of extractEmails(page.body, text, domain, page.url.toString())) emails.set(e.email, e);
    }

    return {
      ok: true,
      pages: visited,
      title,
      description,
      excerpt: truncate(texts.join("\n…\n"), 2400),
      emails: [...emails.values()].sort((a, b) => (a.type === b.type ? 0 : a.type === "role" ? -1 : 1)),
      notes,
    };
  } catch (e) {
    if (e instanceof StopCrawl) return { ok: false, reason: e.message, notes };
    if ((e as Error).name === "TimeoutError") return { ok: false, reason: "The website took too long to respond.", notes };
    return { ok: false, reason: "Couldn't fetch the website.", notes };
  }
}
