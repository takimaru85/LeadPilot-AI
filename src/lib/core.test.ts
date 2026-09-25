import { describe, expect, it } from "vitest";
import { heuristicEmails, heuristicQualify } from "@/lib/ai/heuristics";
import { hasBlockingFindings, lintEmail } from "@/lib/compliance/email-lint";
import { decryptSecret, encryptSecret, parseUnsubscribeToken, unsubscribeToken } from "@/lib/crypto";
import { applyQuery, emptyDb, MemoryStore } from "@/lib/db/memory-store";
import { StoreError } from "@/lib/db/store";
import type { Icp, Lead, Product, Workspace } from "@/lib/types";
import { CampaignPatch, ProductPatch } from "@/lib/validation";

describe("PATCH schemas (regression: Zod .partial() applied defaults)", () => {
  it("does not fill defaults for missing keys", () => {
    expect(CampaignPatch.parse({ status: "paused" })).toEqual({ status: "paused" });
    expect(ProductPatch.parse({ name: "X" })).toEqual({ name: "X" });
  });
});

describe("unsubscribe tokens & secrets", () => {
  it("round-trips and rejects tampering", () => {
    const t = unsubscribeToken("ws-1", "Info@Acme.example");
    expect(parseUnsubscribeToken(t)).toEqual({ workspaceId: "ws-1", email: "info@acme.example" });
    const [payload, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify(["ws-2", "info@acme.example"])).toString("base64url");
    expect(parseUnsubscribeToken(`${forged}.${sig}`)).toBeNull();
    expect(parseUnsubscribeToken(`${payload}.x${sig.slice(1)}`)).toBeNull();
  });

  it("encrypts credentials with AES-GCM", () => {
    const enc = encryptSecret("app-password");
    expect(enc).not.toContain("app-password");
    expect(decryptSecret(enc)).toBe("app-password");
    expect(() => decryptSecret(enc.slice(0, -2) + "AA")).toThrow();
  });
});

describe("memory store", () => {
  it("sorts nulls last in both directions (regression)", () => {
    const rows = [{ s: null }, { s: 5 }, { s: 9 }] as { s: number | null }[];
    expect(applyQuery(rows, { order: { column: "s", ascending: false } }).map((r) => r.s)).toEqual([9, 5, null]);
    expect(applyQuery(rows, { order: { column: "s", ascending: true } }).map((r) => r.s)).toEqual([5, 9, null]);
  });

  it("enforces unique constraints like Postgres", async () => {
    const db = emptyDb();
    const store = new MemoryStore(db, "ws");
    await store.insert("leads", { company_name: "A", domain: "a.example", source: "manual" });
    await expect(store.insert("leads", { company_name: "B", domain: "a.example", source: "manual" })).rejects.toBeInstanceOf(StoreError);
    await store.insert("leads", { company_name: "C", domain: null, source: "manual" });
    await store.insert("leads", { company_name: "D", domain: null, source: "manual" }); // nulls never conflict
    expect(await store.count("leads")).toBe(3);
  });
});

describe("heuristic AI stand-ins", () => {
  const product = {
    name: "WordPress Rebuilds", target_customer: "dental practices", industry: "Dental", location: "Australia",
    customer_problem: "Outdated websites.", why_buy: "Modern sites in 4 weeks.",
  } as Product;
  const icp = { industries: ["Dental"], business_types: ["Dental clinic"], locations: ["Australia"], keywords: [], buying_signals: [], structured: null } as unknown as Icp;
  const lead = {
    company_name: "Harbour Dental", industry: "Dental clinic", location: "Sydney, NSW, Australia", description: "",
    site_excerpt: "Call to book an appointment. © 2016 Harbour Dental.", website: "https://harbour.example", source: "demo",
    contact_name: "Dr Priya Raman", email_source_url: null, source_url: null,
  } as unknown as Lead;
  const ws = { sender_name: "Alex", sender_company: "Studio", sender_title: "", website: "" } as Workspace;

  it("only cites evidence present in the data and never claims certainty", () => {
    const q = heuristicQualify(product, icp, lead);
    expect(q.score).toBeLessThanOrEqual(90);
    expect(q.fit).toBe("strong");
    for (const e of q.evidence) expect(e.claim.length).toBeGreaterThan(0);
    expect(q.evidence.some((e) => e.claim.includes("© 2016"))).toBe(true);
    expect(q.unknowns.length).toBeGreaterThan(0);
  });

  it("rejects industry mismatches", () => {
    const q = heuristicQualify(product, icp, { ...lead, industry: "Law firm", company_name: "Collins Law", site_excerpt: null });
    expect(q.fit).toBe("none");
    expect(q.matches_icp).toBe(false);
  });

  it("writes three variants that pass the compliance linter", () => {
    const q = heuristicQualify(product, icp, lead);
    const { emails } = heuristicEmails(product, ws, lead, q);
    expect(emails.map((e) => e.variant)).toEqual(["professional", "friendly", "concise"]);
    const facts = `${Object.values(product).join(" ")} ${lead.site_excerpt} ${lead.company_name}`;
    for (const e of emails) {
      expect(e.body).toContain("Hi Dr Raman");
      expect(hasBlockingFindings(lintEmail(e.subject, e.body, { facts }))).toBe(false);
      expect(e.body).not.toMatch(/I noticed|I came across/i);
    }
  });
});
