import type { LintFinding } from "@/lib/types";

/**
 * Deterministic checks run on every generated or edited email before it can be approved.
 * Errors block approval; warnings are shown to the reviewer.
 * The goal is honest outreach: no fake familiarity, no invented research, no deceptive subjects.
 */

const FAKE_FAMILIARITY: [RegExp, string][] = [
  [/\bas (we|i) (discussed|mentioned|spoke)\b/i, "Implies a prior conversation"],
  [/\b(following|circling) (up|back) on (our|my) (call|conversation|chat|meeting)\b/i, "Implies a prior conversation"],
  [/\bgreat (talking|chatting|speaking) (to|with) you\b/i, "Implies a prior conversation"],
  [/\b(hope you remember|you may remember me|long time no)\b/i, "Implies an existing relationship"],
  [/\b(i'?ve been|i have been) (following|a fan of|admiring)\b/i, "Claims a personal history with the company"],
  [/\bmy friend\b/i, "Fake familiarity"],
];

const RESEARCH_CLAIMS: [RegExp, string][] = [
  [/\bi (noticed|saw|came across|stumbled upon|was (browsing|looking at|checking out))\b/i, "Claims the sender personally looked at something"],
  [/\bi (researched|analy[sz]ed|audited|reviewed) your\b/i, "Claims the sender researched the company"],
  [/\bafter (researching|reviewing|analy[sz]ing) your\b/i, "Claims the sender researched the company"],
];

const PRESSURE: [RegExp, string][] = [
  [/\b(act now|limited time|urgent|last chance|don'?t miss out|once in a lifetime)\b/i, "High-pressure language"],
  [/\b(guarantee[sd]?|100%|risk[- ]free|no[- ]brainer)\b/i, "Absolute or unverifiable claim"],
  [/!!+/, "Multiple exclamation marks"],
];

export interface LintContext {
  /** All text the email is allowed to draw facts from (lead + product + sender data). */
  facts: string;
}

export function lintEmail(subject: string, body: string, ctx: LintContext): LintFinding[] {
  const out: LintFinding[] = [];
  const s = subject.trim();
  const b = body.trim();

  if (!s) out.push({ level: "error", code: "subject_empty", message: "Subject is empty." });
  if (!b) out.push({ level: "error", code: "body_empty", message: "Body is empty." });
  if (s.length > 90) out.push({ level: "warning", code: "subject_long", message: "Subject is longer than 90 characters." });
  if (/^\s*(re|fwd?|fw)\s*:/i.test(s)) {
    out.push({ level: "error", code: "subject_deceptive", message: "Subject starts with Re:/Fwd: — implies a prior thread (deceptive under anti-spam law)." });
  }
  if (s.length > 8 && s === s.toUpperCase() && /[A-Z]/.test(s)) {
    out.push({ level: "warning", code: "subject_caps", message: "Subject is all caps." });
  }
  const wordCount = b.split(/\s+/).filter(Boolean).length;
  if (wordCount > 220) out.push({ level: "warning", code: "body_long", message: `Body is ${wordCount} words; aim for under 150.` });

  if (/\[[^\]]{1,40}\]|\{\{[^}]*\}\}|<[A-Z_ ]{3,}>/.test(`${s}\n${b}`)) {
    out.push({ level: "error", code: "placeholder", message: "Contains an unfilled placeholder such as [Name] or {{company}}." });
  }

  for (const [re, msg] of FAKE_FAMILIARITY) {
    if (re.test(b) || re.test(s)) out.push({ level: "error", code: "fake_familiarity", message: `${msg}: “${(b.match(re) ?? s.match(re))![0]}”.` });
  }
  for (const [re, msg] of RESEARCH_CLAIMS) {
    if (re.test(b)) {
      out.push({
        level: "warning",
        code: "research_claim",
        message: `${msg}: “${b.match(re)![0]}”. Keep it only if you personally did this.`,
      });
    }
  }
  for (const [re, msg] of PRESSURE) {
    if (re.test(b) || re.test(s)) out.push({ level: "warning", code: "pressure", message: `${msg}: “${(b.match(re) ?? s.match(re))![0]}”.` });
  }

  // Figures that don't appear in any source data are likely invented.
  const facts = ctx.facts.toLowerCase();
  const figures = `${s} ${b}`.match(/\b\d[\d,.]*\s?(%|percent|x\b|k\b|m\b)?/gi) ?? [];
  const unsupported = [...new Set(figures.map((f) => f.trim().replace(/[.,]+$/, "")))].filter((f) => f.length > 1 && !facts.includes(f.toLowerCase().replace(/\s/g, "")) && !facts.includes(f.toLowerCase()));
  if (unsupported.length) {
    out.push({
      level: "warning",
      code: "unsupported_figure",
      message: `Contains figures not found in the lead or product data: ${unsupported.slice(0, 4).join(", ")}. Check they are accurate.`,
    });
  }

  return out;
}

export const hasBlockingFindings = (f: LintFinding[]) => f.some((x) => x.level === "error");
