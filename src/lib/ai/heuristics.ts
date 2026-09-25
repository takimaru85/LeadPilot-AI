import type { DraftVariant, Evidence, Icp, Lead, Product, StructuredIcp, Workspace } from "@/lib/types";
import type { EmailSetOutput, QualificationOutput } from "./schemas";

/**
 * Deterministic stand-ins for the Claude calls, used when ANTHROPIC_API_KEY is not set.
 * They follow the same rules as the prompts — evidence must come from lead data, needs are
 * phrased as possibilities — so the rest of the app behaves identically. Output is labelled
 * with model "demo-heuristic" everywhere it is shown.
 */
export const HEURISTIC_MODEL = "demo-heuristic";

const stems = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3)
    .map((w) => w.replace(/(ies|s)$/, ""));

// ─────────────────────────────────────────────── ICP
export function heuristicStructureIcp(product: Product | null, icp: Pick<Icp, "industries" | "business_types" | "locations" | "company_sizes" | "job_titles" | "pain_points" | "buying_signals" | "keywords">): StructuredIcp {
  const industries = icp.industries.length ? icp.industries : product?.industry ? [product.industry] : [];
  const types = icp.business_types.length ? icp.business_types : industries;
  const locations = icp.locations.length ? icp.locations : product?.location ? [product.location] : [];
  const pains = icp.pain_points.length ? icp.pain_points : product?.customer_problem ? [product.customer_problem] : [];
  return {
    summary: `${types.join(", ") || "Businesses"}${locations.length ? ` in ${locations.join(", ")}` : ""}${
      icp.company_sizes.length ? ` (${icp.company_sizes.join(", ")})` : ""
    } that may be experiencing: ${pains.slice(0, 2).join("; ") || "the problem your product solves"}.`,
    industries,
    business_types: types,
    locations,
    company_size: icp.company_sizes.join(", ") || product?.company_size || "Any",
    decision_makers: icp.job_titles.length ? icp.job_titles : ["Owner", "Manager"],
    pain_points: pains,
    buying_signals: icp.buying_signals,
    disqualifiers: ["Already has a recent solution in place", "Outside the target locations", "No public business contact"],
    keywords: icp.keywords,
    search_queries: types.slice(0, 5),
  };
}

// ─────────────────────────────────────────────── qualification
interface Signal {
  re: RegExp;
  claim: (m: RegExpMatchArray) => string;
  need: (m: RegExpMatchArray) => string;
  subject: string;
  weight: number;
}

const THIS_YEAR = new Date().getFullYear();

const POSITIVE: Signal[] = [
  {
    re: /(?:©|copyright|last updated)\s*(20\d\d)/i,
    claim: (m) => `Website shows “${m[0]}”`,
    need: (m) => `The website may not have had a significant update since around ${m[1]}.`,
    subject: "Website refresh",
    weight: 0,
  },
  {
    re: /no online booking|call (us )?to (book|make)|book (by|via) phone|enquiries via phone only|book via phone|phone only/i,
    claim: () => "Website asks customers to phone to book or enquire",
    need: () => "Customers may not be able to book or enquire online, which can mean missed after-hours enquiries.",
    subject: "Online booking",
    weight: 12,
  },
  {
    re: /not optimi[sz]ed for mobile/i,
    claim: () => "Website is noted as not optimised for mobile",
    need: () => "Mobile visitors may find the site hard to use.",
    subject: "Mobile website",
    weight: 10,
  },
  {
    re: /under construction|currently unavailable/i,
    claim: (m) => `Part of the website is “${m[0]}”`,
    need: () => "Part of the website appears unfinished or broken.",
    subject: "Website",
    weight: 12,
  },
  {
    re: /rebrand|previous brand/i,
    claim: () => "Business has rebranded; some pages still show the previous brand",
    need: () => "The website may not fully reflect the new brand yet.",
    subject: "Your new brand online",
    weight: 10,
  },
  {
    re: /second clinic|new location|we'?ve moved|now open/i,
    claim: (m) => `Website mentions “${m[0]}”`,
    need: () => "A new location often means website, maps and booking details need updating.",
    subject: "Your new location",
    weight: 8,
  },
  {
    re: /separate website|different branding/i,
    claim: () => "Locations use separate websites with different branding",
    need: () => "Multiple inconsistent websites can be costly to maintain and confusing for customers.",
    subject: "One website for all locations",
    weight: 10,
  },
  { re: /slow-loading/i, claim: () => "Website has a slow-loading section", need: () => "Slow pages can put visitors off.", subject: "Website speed", weight: 6 },
  { re: /pdf download/i, claim: () => "Key information is only available as a PDF download", need: () => "Important information may be hard to read on phones.", subject: "Website", weight: 5 },
];

const NEGATIVE: { re: RegExp; claim: string; weight: number }[] = [
  { re: /(?<!no )(book online|online booking)(?! form)/i, claim: "Website already offers online booking", weight: -10 },
  { re: /mobile-friendly/i, claim: "Website describes itself as mobile-friendly", weight: -8 },
];

function copyrightWeight(year: number) {
  const age = THIS_YEAR - year;
  return age >= 8 ? 22 : age >= 5 ? 15 : age >= 3 ? 6 : -10;
}

export function heuristicQualify(product: Product | null, icp: Icp | null, lead: Lead): QualificationOutput {
  const evidence: Evidence[] = [];
  const unknowns: string[] = [];
  const needs: string[] = [];
  const subjects: string[] = [];
  let score = 10;

  const leadText = `${lead.company_name} ${lead.industry} ${lead.description}`.toLowerCase();
  const target = icp?.structured ?? null;
  const industryTerms = [...(target?.industries ?? icp?.industries ?? []), ...(target?.business_types ?? icp?.business_types ?? []), product?.industry ?? ""]
    .flatMap(stems)
    .filter((w) => !["business", "compan", "service"].includes(w));
  const industryMatch = industryTerms.length === 0 || industryTerms.some((t) => leadText.includes(t));
  if (industryMatch && industryTerms.length) {
    score += 35;
    evidence.push({ claim: `Industry listed as “${lead.industry || "—"}”`, source: sourceLabel(lead) });
  }

  const locTerms = (target?.locations ?? icp?.locations ?? []).flatMap((l) => l.toLowerCase().split(/[,/]/).map((x) => x.trim())).filter(Boolean);
  const locationMatch = locTerms.length === 0 || locTerms.some((t) => lead.location.toLowerCase().includes(t));
  if (locationMatch && locTerms.length) {
    score += 15;
    evidence.push({ claim: `Located in ${lead.location}`, source: sourceLabel(lead) });
  }

  const site = `${lead.site_excerpt ?? ""} ${lead.description}`;
  const siteSource = lead.site_excerpt ? `Company website${lead.website ? ` (${lead.website})` : ""}` : sourceLabel(lead);
  for (const sig of POSITIVE) {
    const m = site.match(sig.re);
    if (!m) continue;
    const w = sig.weight || copyrightWeight(Number(m[1]));
    score += w;
    if (w > 0) {
      evidence.push({ claim: sig.claim(m), source: siteSource });
      needs.push(sig.need(m));
      subjects.push(sig.subject);
    }
  }
  for (const neg of NEGATIVE) {
    if (neg.re.test(site)) {
      score += neg.weight;
      evidence.push({ claim: neg.claim, source: siteSource });
    }
  }

  for (const kw of [...(icp?.keywords ?? []), ...(icp?.buying_signals ?? [])]) {
    if (kw.length > 3 && site.toLowerCase().includes(kw.toLowerCase())) {
      score += 4;
      evidence.push({ claim: `Website mentions keyword “${kw}”`, source: siteSource });
    }
  }

  if (!lead.site_excerpt) unknowns.push("Website content has not been checked yet — run enrichment for better evidence.");
  if (!lead.email) unknowns.push("No public business email address found.");
  unknowns.push("Whether they already work with a provider for this.");
  unknowns.push("Budget, timing and who makes the decision.");

  if (!industryMatch) score = Math.min(score, 25);
  if (!locationMatch) score = Math.min(score, 30);
  // Rule-based scoring is never certain: cap below 100.
  score = Math.max(0, Math.min(90, Math.round(score)));
  const fit = score >= 75 ? "strong" : score >= 55 ? "moderate" : score >= 35 ? "weak" : "none";
  const matches = industryMatch && locationMatch;

  const potential_need = needs[0]
    ? `${needs[0]}${needs[1] ? ` ${needs[1]}` : ""}`
    : matches
      ? `No specific public signal found; they match the target profile, so ${product?.customer_problem ? `they may face: ${product.customer_problem.replace(/\.$/, "").toLowerCase()}` : "the product may be relevant"}.`
      : "No evidence of a need in the available data.";

  const reason = !industryMatch
    ? `Industry (“${lead.industry}”) does not match the ideal customer profile.`
    : !locationMatch
      ? `Outside the target locations (${lead.location}).`
      : needs.length
        ? `Matches the profile and shows ${needs.length} public signal${needs.length > 1 ? "s" : ""} of a possible need.`
        : "Matches the profile, but no specific public signal of need was found.";

  const outreach_angle = !matches
    ? "Not recommended for outreach."
    : subjects.length
      ? `Lead with the observable fact (${evidence.find((e) => e.source === siteSource)?.claim.toLowerCase() ?? subjects[0].toLowerCase()}) and ask, without assuming, whether it's something they'd like to improve.`
      : "Keep it general: introduce the product briefly and ask whether it's relevant, without implying you know their situation.";

  return { matches_icp: matches, fit, score, potential_need, reason, evidence, unknowns, outreach_angle };
}

function sourceLabel(lead: Lead) {
  switch (lead.source) {
    case "google_places": return "Google Places listing";
    case "csv_import": return "Imported CSV";
    case "website": return "Company website";
    case "demo": return "Demo business directory";
    default: return "Manually entered";
  }
}

// ─────────────────────────────────────────────── emails
function greeting(lead: Lead) {
  if (lead.contact_name) {
    const parts = lead.contact_name.trim().split(/\s+/);
    if (/^(dr|prof)\.?$/i.test(parts[0]) && parts.length > 1) return `Hi ${parts[0]} ${parts[parts.length - 1]}`;
    return `Hi ${parts[0]}`;
  }
  return `Hi ${lead.company_name} team`;
}

function signature(ws: Workspace) {
  return [ws.sender_name, [ws.sender_title, ws.sender_company].filter(Boolean).join(", "), ws.website].filter(Boolean).join("\n");
}

export function heuristicEmails(product: Product, ws: Workspace, lead: Lead, q: QualificationOutput): EmailSetOutput {
  // Only need-signals make a good opening; keyword hits and "already has it" facts don't.
  const fact = q.evidence.find((e) => /website/i.test(e.source) && !/already|mobile-friendly|keyword/i.test(e.claim));
  const company = possessive(lead.company_name);
  const factSentence = fact ? factToSentence(lead.company_name, fact.claim) : `${lead.company_name} looks like the kind of business we work with.`;
  const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const uc = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  // With a concrete signal, describe the possible need; otherwise fall back to the seller's own
  // description of the problem, framed as general (never as something we know about them).
  const problem = fact
    ? q.potential_need.replace(/\.$/, "")
    : product.customer_problem
      ? `a common challenge for ${product.target_customer || "businesses like yours"} is ${lc(product.customer_problem.replace(/\.$/, ""))}`
      : "";
  const value = `${ws.sender_company || "We"} ${ws.sender_company ? "helps" : "help"} ${product.target_customer || "businesses like yours"} with ${product.name}${
    product.why_buy ? ` — ${product.why_buy.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}` : ""
  }.`;
  const sig = signature(ws);
  const subjectTopic = fact ? (/book/i.test(fact.claim) ? "Online booking" : /brand/i.test(fact.claim) ? "Your new brand online" : "Your website") : product.name;
  const used = [
    { field: "company_name", value: lead.company_name, source: sourceLabelFromLead(lead) },
    ...(fact ? [{ field: "evidence", value: fact.claim, source: fact.source }] : []),
    ...(lead.contact_name ? [{ field: "contact_name", value: lead.contact_name, source: lead.email_source_url ?? sourceLabelFromLead(lead) }] : []),
  ];
  const v = (variant: DraftVariant, subject: string, body: string) => ({ variant, subject, body, personalization_used: used });

  return {
    emails: [
      v(
        "professional",
        `${subjectTopic} at ${lead.company_name}`,
        `${greeting(lead)},\n\n${factSentence}${problem ? `\n\n${fact ? `For some businesses, that can mean: ${lc(problem)}.` : `${uc(problem)}.`} I don't know whether that's true for you, so please tell me if I'm off the mark.` : ""}\n\n${value}\n\nWould it be useful if I sent over a short example of how we've approached this? If it's not a priority, no problem at all.\n\nKind regards,\n${sig}`,
      ),
      v(
        "friendly",
        `Quick question about ${company} website`,
        `${greeting(lead)},\n\n${factSentence}${problem ? ` ${uc(problem)} — though you'd know better than me whether that matters for you.` : ""}\n\n${value}\n\nHappy to share a couple of ideas if that's helpful — just reply and let me know.\n\nCheers,\n${sig}`,
      ),
      v(
        "concise",
        `${subjectTopic} — ${lead.company_name}`,
        `${greeting(lead)},\n\n${factSentence} ${value}\n\nWorth a quick chat? If not, no worries.\n\n${sig}`,
      ),
    ],
  };
}

/** Turns an evidence claim ("Website shows …") into a neutral sentence about the company. */
function factToSentence(company: string, claim: string): string {
  const c = claim.replace(/\.$/, "");
  const own = possessive(company);
  if (/^Website /.test(c)) return `${own} website ${c.slice(8)}.`;
  if (/^Business /.test(c)) return `${company} ${c.slice(9).replace(/; /, ", and ")}.`;
  if (/^Part of the website/.test(c)) return `Part of ${own} website${c.slice(19)}.`;
  if (/^Locations /.test(c)) return `${own} locations ${c.slice(10)}.`;
  return `On ${own} website: ${c.charAt(0).toLowerCase()}${c.slice(1)}.`;
}

const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

function sourceLabelFromLead(lead: Lead) {
  return lead.source_url ?? sourceLabel(lead);
}
