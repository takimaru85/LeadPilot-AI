import { describe, expect, it } from "vitest";
import { isPathAllowed, parseRobots } from "./robots";

describe("robots.txt", () => {
  const txt = `
User-agent: *
Disallow: /private
Allow: /private/public
Disallow: /*.pdf$

User-agent: LeadPilotBot
User-agent: OtherBot
Disallow: /contact
`;

  it("uses the most specific matching group", () => {
    const rules = parseRobots(txt, "LeadPilotBot");
    expect(isPathAllowed(rules, "/contact")).toBe(false);
    expect(isPathAllowed(rules, "/private")).toBe(true); // our group doesn't mention /private
  });

  it("falls back to * with longest-match and Allow on ties", () => {
    const rules = parseRobots(txt, "SomeOtherCrawler");
    expect(isPathAllowed(rules, "/private/x")).toBe(false);
    expect(isPathAllowed(rules, "/private/public/page")).toBe(true);
    expect(isPathAllowed(rules, "/brochure.pdf")).toBe(false);
    expect(isPathAllowed(rules, "/brochure.pdf?x=1")).toBe(true); // $ anchors the end
    expect(isPathAllowed(rules, "/")).toBe(true);
  });

  it("treats empty Disallow as allow-all and Disallow: / as block-all", () => {
    expect(isPathAllowed(parseRobots("User-agent: *\nDisallow:", "LeadPilotBot"), "/anything")).toBe(true);
    expect(isPathAllowed(parseRobots("User-agent: *\nDisallow: /", "LeadPilotBot"), "/")).toBe(false);
  });

  it("allows everything when there are no rules", () => {
    expect(isPathAllowed(parseRobots("", "LeadPilotBot"), "/contact")).toBe(true);
  });
});
