import { beforeEach, describe, expect, it } from "vitest";
import { emptyDb, MemoryStore, type DemoDb } from "@/lib/db/memory-store";
import type { EmailDraft, Lead, SendingAccount, Workspace } from "@/lib/types";
import { checkSendable, effectiveDailyLimit } from "./guard";

const WS = "11111111-1111-4111-8111-111111111111";
let db: DemoDb;
let store: MemoryStore;
let ws: Workspace;
let lead: Lead;
let draft: EmailDraft;
let account: SendingAccount;

beforeEach(async () => {
  db = emptyDb();
  ws = {
    id: WS, name: "Test", sender_name: "Alex", sender_company: "Co", sender_title: "", postal_address: "1 Street, City",
    reply_to: "", website: "", daily_send_cap: 50, dedupe_window_days: 90, role_emails_only: true, created_by: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  db.workspaces.push(ws);
  store = new MemoryStore(db, WS);
  lead = await store.insert("leads", { company_name: "Acme Dental", domain: "acme.example", email: "info@acme.example", email_type: "role", source: "manual" });
  draft = await store.insert("email_drafts", { lead_id: lead.id, variant: "professional", subject: "Hi", body: "Body", model: "test", status: "approved" });
  account = await store.insert("sending_accounts", { provider: "sandbox", label: "Sandbox", from_email: "me@co.example", daily_limit: 30, per_minute_limit: 2, warmup_enabled: false });
});

const input = () => ({ workspace: ws, lead, draft, account, campaign: null });

async function sent(to: string, minutesAgo = 5) {
  const d = await store.insert("email_drafts", { lead_id: lead.id, variant: "concise", subject: "x", body: "x", model: "t", status: "sent" });
  const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return store.insert("email_messages", {
    draft_id: d.id, lead_id: lead.id, account_id: account.id, to_email: to, to_domain: to.split("@")[1], subject: "x", body_text: "x", status: "sent", sent_at: at,
  });
}

describe("checkSendable", () => {
  it("allows a clean send", async () => {
    expect(await checkSendable(store, input())).toEqual({ blocking: [], deferUntil: null, deferReason: null });
  });

  it("blocks without a postal address", async () => {
    ws.postal_address = "";
    expect((await checkSendable(store, input())).blocking.join()).toMatch(/postal address/);
  });

  it("blocks suppressed emails and domains", async () => {
    await store.insert("suppressions", { value: "acme.example", kind: "domain", reason: "manual" });
    expect((await checkSendable(store, input())).blocking.join()).toMatch(/suppression list/);
  });

  it("blocks personal addresses when role-only is on", async () => {
    lead = { ...lead, email: "jane@acme.example", email_type: "personal" };
    expect((await checkSendable(store, input())).blocking.join()).toMatch(/personal address/);
    ws.role_emails_only = false;
    expect((await checkSendable(store, input())).blocking).toEqual([]);
  });

  it("prevents contacting the same company twice within the window", async () => {
    await sent("sales@acme.example", 60 * 24 * 10);
    expect((await checkSendable(store, input())).blocking.join()).toMatch(/already emailed within/);
  });

  it("blocks paused campaigns and missing accounts", async () => {
    const r = await checkSendable(store, { ...input(), account: null, campaign: { name: "C", status: "paused" } as never });
    expect(r.blocking.join()).toMatch(/paused/);
    expect(r.blocking.join()).toMatch(/No sending account/);
  });

  it("defers (never drops) when the per-minute limit is hit", async () => {
    await sent("a@other1.example", 0.2);
    await sent("b@other2.example", 0.3);
    const r = await checkSendable(store, input());
    expect(r.blocking).toEqual([]);
    expect(r.deferUntil).toBeInstanceOf(Date);
    expect(r.deferReason).toMatch(/Per-minute/);
  });

  it("defers when the workspace daily cap is reached", async () => {
    ws.daily_send_cap = 1;
    await sent("a@other1.example", 30);
    expect((await checkSendable(store, input())).deferReason).toMatch(/Workspace daily cap/);
  });
});

describe("effectiveDailyLimit (warm-up)", () => {
  it("ramps from 5/day by 3/day up to the limit", () => {
    const base = { ...account, warmup_enabled: true, daily_limit: 30 };
    const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    expect(effectiveDailyLimit({ ...base, created_at: day(0) })).toBe(5);
    expect(effectiveDailyLimit({ ...base, created_at: day(3) })).toBe(14);
    expect(effectiveDailyLimit({ ...base, created_at: day(60) })).toBe(30);
    expect(effectiveDailyLimit({ ...base, warmup_enabled: false, created_at: day(0) })).toBe(30);
  });
});
