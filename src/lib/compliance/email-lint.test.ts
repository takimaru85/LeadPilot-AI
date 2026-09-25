import { describe, expect, it } from "vitest";
import { hasBlockingFindings, lintEmail } from "./email-lint";

const facts = "Harbourside Family Dental © 2016 call to book WordPress rebuilds 4–6 weeks";
const codes = (s: string, b: string) => lintEmail(s, b, { facts }).map((f) => `${f.level}:${f.code}`);

describe("lintEmail", () => {
  it("passes an honest, specific email", () => {
    const f = lintEmail(
      "Online booking at Harbourside Family Dental",
      "Hi team,\n\nHarbourside Family Dental's website footer shows © 2016. I don't know whether that matters to you.\n\nWould a short example help?\n\nAlex",
      { facts },
    );
    expect(f).toEqual([]);
  });

  it("blocks deceptive Re:/Fwd: subjects", () => {
    expect(codes("Re: your website", "Hello")).toContain("error:subject_deceptive");
    expect(codes("FWD: quick one", "Hello")).toContain("error:subject_deceptive");
  });

  it("blocks fake familiarity", () => {
    expect(codes("Hello", "As we discussed last week, here it is.")).toContain("error:fake_familiarity");
    expect(codes("Hello", "Great talking to you yesterday!")).toContain("error:fake_familiarity");
  });

  it("warns (not blocks) on research claims", () => {
    const f = lintEmail("Hello", "I noticed your site is slow.", { facts });
    expect(f.map((x) => x.code)).toContain("research_claim");
    expect(hasBlockingFindings(f)).toBe(false);
  });

  it("blocks unfilled placeholders", () => {
    expect(codes("Hi [First Name]", "Body")).toContain("error:placeholder");
    expect(codes("Hello", "Hi {{company}}")).toContain("error:placeholder");
  });

  it("flags figures that aren't in the source data", () => {
    expect(codes("Hello", "We improved bookings by 300% for 50 clinics.")).toContain("warning:unsupported_figure");
    expect(codes("Hello", "Your footer shows © 2016.")).not.toContain("warning:unsupported_figure");
  });

  it("flags pressure language", () => {
    expect(codes("Act now", "Limited time offer!!")).toContain("warning:pressure");
  });

  it("requires subject and body", () => {
    expect(hasBlockingFindings(lintEmail("", "", { facts }))).toBe(true);
  });
});
