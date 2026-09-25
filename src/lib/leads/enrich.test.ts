import { describe, expect, it } from "vitest";
import { enrichWebsite, isPrivateIp } from "./enrich";

describe("SSRF protection", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111"])("allows %s", (ip) => expect(isPrivateIp(ip)).toBe(false));

  it("refuses localhost and non-http URLs without fetching", async () => {
    expect(await enrichWebsite("http://localhost:3000")).toMatchObject({ ok: false });
    expect(await enrichWebsite("ftp://example.com")).toMatchObject({ ok: false });
  });
});

describe("demo enrichment", () => {
  it("returns the fictional snapshot without network access", async () => {
    const r = await enrichWebsite("https://harboursidedental.example");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.emails[0]).toMatchObject({ email: "reception@harboursidedental.example", type: "role" });
    }
  });
});
