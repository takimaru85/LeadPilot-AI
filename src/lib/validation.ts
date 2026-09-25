import { z } from "zod";
import { EVENT_TYPES, LEAD_STATUSES } from "@/lib/types";

const text = (max: number) => z.string().trim().max(max);

/**
 * PATCH schema from a create schema: every field optional and NO defaults applied.
 * (Zod 4's .partial() still fills .default() values for missing keys, which would silently
 * overwrite stored data on partial updates.)
 */
export function patchSchema<S extends z.ZodObject>(schema: S) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([k, v]) => {
      const t = v as z.ZodType;
      return [k, (t instanceof z.ZodDefault ? (t.unwrap() as z.ZodType) : t).optional()];
    }),
  );
  return z.object(shape) as unknown as z.ZodType<Partial<z.output<S>>>;
}
const list = z.array(z.string().trim().min(1).max(120)).max(30).default([]);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v) || /^[^\s/]+\.[^\s]+$/.test(v), "Enter a valid URL")
  .default("");

export const ProductInput = z.object({
  name: text(120).min(1, "Product name is required"),
  description: text(2000).default(""),
  target_customer: text(500).default(""),
  industry: text(200).default(""),
  location: text(200).default(""),
  company_size: text(100).default(""),
  customer_problem: text(1000).default(""),
  why_buy: text(1000).default(""),
  website_url: optionalUrl,
  pricing: text(500).default(""),
});

export const IcpInput = z.object({
  name: text(120).min(1, "Give this profile a name"),
  product_id: z.string().uuid().nullable().default(null),
  industries: list,
  business_types: list,
  locations: list,
  company_sizes: list,
  job_titles: list,
  pain_points: list,
  buying_signals: list,
  keywords: list,
});

export const SearchInput = z.object({
  provider: z.enum(["google_places", "demo"]),
  query: text(120).min(2, "Enter what kind of business to look for"),
  location: text(120).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  icp_id: z.string().uuid().nullable().default(null),
});

export const ManualLeadInput = z.object({
  company_name: text(200).min(1, "Company name is required"),
  website: optionalUrl,
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email")]).default(""),
  contact_name: text(120).default(""),
  contact_title: text(120).default(""),
  industry: text(120).default(""),
  location: text(200).default(""),
  description: text(1000).default(""),
  consent_basis: z.enum(["conspicuous_publication", "legitimate_interest", "existing_relationship", "consent", "unknown"]).default("unknown"),
  icp_id: z.string().uuid().nullable().default(null),
});

export const CsvImportInput = z.object({
  csv: z.string().min(1, "The file is empty").max(2_000_000, "CSV must be under 2 MB"),
  icp_id: z.string().uuid().nullable().default(null),
  consent_basis: z.enum(["conspicuous_publication", "legitimate_interest", "existing_relationship", "consent"]),
  attest: z.literal(true, { message: "Confirm the data was obtained lawfully" }),
});

export const LeadPatch = z.object({
  company_name: text(200).min(1).optional(),
  website: optionalUrl.optional(),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email()]).optional(),
  contact_name: text(120).optional(),
  contact_title: text(120).optional(),
  industry: text(120).optional(),
  location: text(200).optional(),
  description: text(1000).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  consent_basis: z.enum(["conspicuous_publication", "legitimate_interest", "existing_relationship", "consent", "unknown"]).optional(),
});

export const BulkLeadAction = z.object({
  action: z.enum(["qualify", "generate", "skip", "enrich", "add_to_campaign"]),
  ids: z.array(z.string().uuid()).min(1, "Select at least one lead").max(25, "Bulk actions are limited to 25 leads at a time"),
  campaign_id: z.string().uuid().optional(),
});

export const LeadEventInput = z.object({
  type: z.enum(EVENT_TYPES).refine((t) => ["replied", "positive_reply", "meeting_booked"].includes(t), "Only replies and meetings can be logged manually"),
  detail: text(500).default(""),
});

export const DraftEdit = z.object({
  subject: text(200).min(1, "Subject is required"),
  body: text(5000).min(1, "Body is required"),
});

export const ApproveInput = z.object({
  subject: text(200).min(1).optional(),
  body: text(5000).min(1).optional(),
  confirm: z.literal(true, { message: "Sending requires explicit confirmation" }),
});

export const CampaignInput = z.object({
  name: text(120).min(1, "Campaign name is required"),
  description: text(1000).default(""),
  audience: text(200).default(""),
  product_id: z.string().uuid().nullable().default(null),
  icp_id: z.string().uuid().nullable().default(null),
  sending_account_id: z.string().uuid().nullable().default(null),
});
export const CampaignPatch = patchSchema(
  CampaignInput.extend({ status: z.enum(["draft", "running", "paused", "completed"]) }),
);
export const ProductPatch = patchSchema(ProductInput);
export const IcpPatch = patchSchema(IcpInput);
export const CampaignLeadsInput = z.object({ lead_ids: z.array(z.string().uuid()).min(1).max(500) });

export const SendingAccountInput = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("smtp"),
    label: text(80).min(1),
    from_email: z.string().trim().toLowerCase().email(),
    from_name: text(80).default(""),
    host: text(200).min(1, "SMTP host is required"),
    port: z.coerce.number().int().min(1).max(65535).default(587),
    secure: z.boolean().default(false),
    username: text(200).min(1, "Username is required"),
    password: z.string().min(1, "Password is required").max(500),
    daily_limit: z.coerce.number().int().min(1).max(500).default(30),
    per_minute_limit: z.coerce.number().int().min(1).max(30).default(2),
    warmup_enabled: z.boolean().default(true),
  }),
  z.object({
    provider: z.literal("resend"),
    label: text(80).min(1),
    from_email: z.string().trim().toLowerCase().email(),
    from_name: text(80).default(""),
    api_key: z.string().trim().min(10, "Resend API key is required").max(200),
    daily_limit: z.coerce.number().int().min(1).max(500).default(30),
    per_minute_limit: z.coerce.number().int().min(1).max(30).default(2),
    warmup_enabled: z.boolean().default(true),
  }),
  z.object({
    provider: z.enum(["gmail", "microsoft", "sandbox"]),
    label: text(80).min(1),
    from_email: z.string().trim().toLowerCase().email(),
    from_name: text(80).default(""),
    daily_limit: z.coerce.number().int().min(1).max(500).default(30),
    per_minute_limit: z.coerce.number().int().min(1).max(30).default(2),
    warmup_enabled: z.boolean().default(true),
  }),
]);
export const SendingAccountPatch = z.object({
  label: text(80).min(1).optional(),
  from_name: text(80).optional(),
  daily_limit: z.coerce.number().int().min(1).max(500).optional(),
  per_minute_limit: z.coerce.number().int().min(1).max(30).optional(),
  warmup_enabled: z.boolean().optional(),
  status: z.enum(["active", "paused"]).optional(),
});

export const SuppressionInput = z.object({
  values: z.array(z.string().trim().min(3).max(254)).min(1).max(1000),
  reason: z.enum(["manual", "do_not_contact", "unsubscribed", "bounced", "complained"]).default("manual"),
});

export const WorkspacePatch = z.object({
  name: text(120).min(1).optional(),
  sender_name: text(120).optional(),
  sender_company: text(120).optional(),
  sender_title: text(120).optional(),
  postal_address: text(300).optional(),
  reply_to: z.union([z.literal(""), z.string().trim().toLowerCase().email()]).optional(),
  website: optionalUrl.optional(),
  daily_send_cap: z.coerce.number().int().min(1).max(500).optional(),
  dedupe_window_days: z.coerce.number().int().min(1).max(3650).optional(),
  role_emails_only: z.boolean().optional(),
});
