import { z } from "zod";

/** Structured-output schemas shared by the Claude implementation and the demo heuristics. */

export const StructuredIcpSchema = z.object({
  summary: z.string().describe("One or two sentences describing the ideal customer."),
  industries: z.array(z.string()),
  business_types: z.array(z.string()),
  locations: z.array(z.string()),
  company_size: z.string(),
  decision_makers: z.array(z.string()).describe("Job titles likely to own the buying decision."),
  pain_points: z.array(z.string()),
  buying_signals: z.array(z.string()).describe("Observable, public signals that suggest a company may need the product now."),
  disqualifiers: z.array(z.string()).describe("Signals that a company is NOT a fit."),
  keywords: z.array(z.string()),
  search_queries: z.array(z.string()).describe("3-6 short business-directory search queries, e.g. 'dental clinic'."),
});

export const QualificationSchema = z.object({
  matches_icp: z.boolean(),
  fit: z.enum(["strong", "moderate", "weak", "none"]),
  score: z.number().int().describe("0-100. How likely this company is to genuinely need the product, based only on evidence."),
  potential_need: z.string().describe("The problem they MIGHT have, phrased as a possibility, not a fact."),
  reason: z.string().describe("One sentence: why this lead is or isn't a fit."),
  evidence: z
    .array(z.object({ claim: z.string(), source: z.string().describe("Which provided field or source this came from.") }))
    .describe("Only facts present in the provided lead data. Empty if there is no supporting evidence."),
  unknowns: z.array(z.string()).describe("Important things we could not verify from the data."),
  outreach_angle: z.string().describe("A respectful, specific angle for a first email grounded in the evidence."),
});
export type QualificationOutput = z.infer<typeof QualificationSchema>;

export const EmailVariantSchema = z.object({
  variant: z.enum(["professional", "friendly", "concise"]),
  subject: z.string(),
  body: z.string().describe("Plain text. Greeting, opening, problem, value, low-pressure CTA, signature. No footer/unsubscribe — added automatically."),
  personalization_used: z.array(
    z.object({ field: z.string(), value: z.string(), source: z.string() }),
  ),
});
export const EmailSetSchema = z.object({ emails: z.array(EmailVariantSchema) });
export type EmailSetOutput = z.infer<typeof EmailSetSchema>;
