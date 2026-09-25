// Domain types. Mirrors supabase/migrations/0001_init.sql — keep the two in sync.

export type Id = string;
export type Timestamp = string; // ISO-8601

export interface Workspace {
  id: Id;
  name: string;
  sender_name: string;
  sender_company: string;
  sender_title: string;
  postal_address: string;
  reply_to: string;
  website: string;
  daily_send_cap: number;
  dedupe_window_days: number;
  role_emails_only: boolean;
  created_by: Id | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Product {
  id: Id;
  workspace_id: Id;
  name: string;
  description: string;
  target_customer: string;
  industry: string;
  location: string;
  company_size: string;
  customer_problem: string;
  why_buy: string;
  website_url: string;
  pricing: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface StructuredIcp {
  summary: string;
  industries: string[];
  business_types: string[];
  locations: string[];
  company_size: string;
  decision_makers: string[];
  pain_points: string[];
  buying_signals: string[];
  disqualifiers: string[];
  keywords: string[];
  search_queries: string[];
}

export interface Icp {
  id: Id;
  workspace_id: Id;
  product_id: Id | null;
  name: string;
  industries: string[];
  business_types: string[];
  locations: string[];
  company_sizes: string[];
  job_titles: string[];
  pain_points: string[];
  buying_signals: string[];
  keywords: string[];
  structured: StructuredIcp | null;
  structured_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type LeadSource = "google_places" | "csv_import" | "manual" | "website" | "demo";
export type ConsentBasis =
  | "conspicuous_publication"
  | "legitimate_interest"
  | "existing_relationship"
  | "consent"
  | "unknown";
export const LEAD_STATUSES = [
  "new",
  "qualified",
  "disqualified",
  "draft_ready",
  "approved",
  "contacted",
  "replied",
  "meeting",
  "skipped",
  "do_not_contact",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type Fit = "strong" | "moderate" | "weak" | "none";

export interface LeadSearch {
  id: Id;
  workspace_id: Id;
  icp_id: Id | null;
  provider: string;
  query: string;
  location: string;
  status: "running" | "completed" | "failed";
  result_count: number;
  added_count: number;
  error: string | null;
  created_at: Timestamp;
}

export interface Lead {
  id: Id;
  workspace_id: Id;
  icp_id: Id | null;
  search_id: Id | null;
  company_name: string;
  domain: string | null;
  website: string | null;
  industry: string;
  location: string;
  description: string;
  /** Public website text captured during enrichment; qualification evidence must come from here or other lead fields. */
  site_excerpt: string | null;
  phone: string | null;
  email: string | null;
  email_type: "role" | "personal" | null;
  email_source_url: string | null;
  contact_name: string | null;
  contact_title: string | null;
  source: LeadSource;
  source_ref: string | null;
  source_url: string | null;
  consent_basis: ConsentBasis;
  status: LeadStatus;
  score: number | null;
  fit: Fit | null;
  reason: string | null;
  enriched_at: Timestamp | null;
  last_contacted_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Evidence {
  claim: string;
  source: string;
}

export interface Qualification {
  id: Id;
  workspace_id: Id;
  lead_id: Id;
  score: number;
  fit: Fit;
  matches_icp: boolean;
  potential_need: string;
  reason: string;
  evidence: Evidence[];
  unknowns: string[];
  outreach_angle: string;
  model: string;
  created_at: Timestamp;
}

export type CampaignStatus = "draft" | "running" | "paused" | "completed";
export interface Campaign {
  id: Id;
  workspace_id: Id;
  name: string;
  description: string;
  audience: string;
  product_id: Id | null;
  icp_id: Id | null;
  sending_account_id: Id | null;
  status: CampaignStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CampaignLead {
  id: Id;
  workspace_id: Id;
  campaign_id: Id;
  lead_id: Id;
  created_at: Timestamp;
}

export type EmailProvider = "smtp" | "resend" | "gmail" | "microsoft" | "sandbox";
export interface SendingAccount {
  id: Id;
  workspace_id: Id;
  provider: EmailProvider;
  label: string;
  from_email: string;
  from_name: string;
  config: Record<string, string | number | boolean>;
  secret_encrypted: string | null;
  daily_limit: number;
  per_minute_limit: number;
  warmup_enabled: boolean;
  status: "active" | "paused" | "error" | "needs_auth";
  last_error: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type DraftVariant = "professional" | "friendly" | "concise";
export type DraftStatus = "draft" | "approved" | "skipped" | "sent" | "failed" | "blocked";
export interface PersonalizationItem {
  field: string;
  value: string;
  source: string;
}
export interface LintFinding {
  level: "error" | "warning";
  code: string;
  message: string;
}
export interface EmailDraft {
  id: Id;
  workspace_id: Id;
  lead_id: Id;
  campaign_id: Id | null;
  qualification_id: Id | null;
  variant: DraftVariant;
  subject: string;
  body: string;
  personalization_used: PersonalizationItem[];
  warnings: LintFinding[];
  status: DraftStatus;
  model: string;
  edited: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type MessageStatus = "queued" | "sending" | "sent" | "failed" | "blocked";
export interface EmailMessage {
  id: Id;
  workspace_id: Id;
  draft_id: Id;
  lead_id: Id;
  campaign_id: Id | null;
  account_id: Id | null;
  to_email: string;
  to_domain: string;
  subject: string;
  body_text: string;
  status: MessageStatus;
  attempts: number;
  next_attempt_at: Timestamp;
  provider_message_id: string | null;
  error: string | null;
  sent_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export const EVENT_TYPES = [
  "delivered",
  "bounced",
  "complained",
  "replied",
  "positive_reply",
  "meeting_booked",
  "unsubscribed",
] as const;
export type EmailEventType = (typeof EVENT_TYPES)[number];
export interface EmailEvent {
  id: Id;
  workspace_id: Id;
  message_id: Id | null;
  lead_id: Id | null;
  campaign_id: Id | null;
  type: EmailEventType;
  detail: string | null;
  created_at: Timestamp;
}

export type SuppressionReason = "unsubscribed" | "bounced" | "complained" | "manual" | "do_not_contact";
export interface Suppression {
  id: Id;
  workspace_id: Id;
  value: string;
  kind: "email" | "domain";
  reason: SuppressionReason;
  source: string;
  created_at: Timestamp;
}

export interface AuditEntry {
  id: Id;
  workspace_id: Id;
  actor_id: Id | null;
  actor_label: string;
  action: string;
  entity_type: string;
  entity_id: Id | null;
  lead_id: Id | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: Timestamp;
}

/** Table name → row type. Used by the store to type every query. */
export interface Tables {
  workspaces: Workspace;
  products: Product;
  icps: Icp;
  lead_searches: LeadSearch;
  leads: Lead;
  lead_qualifications: Qualification;
  campaigns: Campaign;
  campaign_leads: CampaignLead;
  sending_accounts: SendingAccount;
  email_drafts: EmailDraft;
  email_messages: EmailMessage;
  email_events: EmailEvent;
  suppressions: Suppression;
  audit_log: AuditEntry;
}
export type TableName = keyof Tables;
/** Tenant tables: everything except workspaces itself. */
export type TenantTable = Exclude<TableName, "workspaces">;
