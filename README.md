# LeadPilot AI

**Find the people who need your product — and email them, responsibly.**

LeadPilot is a B2B prospecting and outreach app: describe what you sell, define your ideal customer, discover
relevant businesses from public sources, let AI explain *why* each one may need you (with evidence), and send
short, honest, personalised emails — each one reviewed and approved by you.

It is deliberately **not** a bulk-email tool. There is no "send to all" button; every email passes a compliance
gate twice (at approval and at delivery).

---

## Features

| Area | What's there |
|---|---|
| **Product & ICP** | Product form (what you sell, problem, why customers buy, pricing) and an ICP builder (industry, type, location, size, decision makers, pain points, buying signals, keywords). AI turns rough notes into a structured ICP with search queries and disqualifiers. |
| **Lead discovery** | Google Places (New) Text Search, CSV import (with lawful-source attestation and consent basis), manual add, and a fictional sample-data provider. Deduplicated by domain; suppressed domains skipped. |
| **Website enrichment** | Polite crawler: honest User-Agent, robots.txt (RFC 9309), stops at login walls, CAPTCHAs, 401/403/429; SSRF-safe; max 3 pages; keeps only emails **published on the company's own domain**, preferring role addresses. |
| **AI qualification** | Score (0–100), fit, matches-ICP, potential need (phrased as a possibility), reason, evidence list **with sources**, unknowns, recommended outreach angle. |
| **Email generation** | Three variants (professional / friendly / very concise), personalisation data used + sources, compliance lint (fake familiarity, `Re:` subjects, placeholders, pressure language, invented figures). |
| **Review** | Recipient, company, subject, body, personalisation used, lead source, suppression status, pre-send checks, footer preview. **Approve & Send / Edit / Regenerate / Skip.** Confirmation dialog on every send. |
| **Sending** | SMTP (Nodemailer) and Resend fully working; Gmail / Microsoft 365 OAuth adapters stubbed (see below); sandbox transport. Credentials AES-256-GCM encrypted. |
| **Safeguards** | Daily per-account limits with warm-up ramp, per-minute throttle, workspace daily cap, retries with backoff, bounce handling (SMTP 5.1.x + Resend webhook), complaint handling, RFC 8058 one-click unsubscribe, permanent suppression list, duplicate prevention (per company, configurable window), role-address-only default, audit log. |
| **Campaigns** | Draft → Running ⇄ Paused → Completed. Metrics: leads, qualified, approved, sent, delivered, bounced, replies, positive, meetings. Pausing holds queued mail. |
| **Dashboard & analytics** | KPIs, 14/30-day activity chart, funnel, score distribution, status breakdown, campaign comparison, recent leads, recent activity. |
| **Demo mode** | With no Supabase keys the app runs on an in-memory store seeded with realistic, **fictional** data on `.example` domains — every screen works before any API is connected. |

---

## Tech stack

Next.js 16 (App Router, Turbopack, `proxy.ts`) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Supabase
(Auth + Postgres + RLS) · Anthropic SDK (Claude, structured outputs) · Zod 4 · Nodemailer · Resend · Recharts ·
Vitest.

## Architecture

```
src/
  app/
    page.tsx                 Landing page
    login/                   Supabase email+password / magic link (or demo sign-in)
    auth/callback/           Supabase email-link callback
    unsubscribe/             Public confirm-to-unsubscribe page
    (app)/                   Authenticated app (sidebar shell)
      dashboard/ setup/ find-leads/ leads/ leads/[id]/ campaigns/ campaigns/[id]/
      email/ (review queue) email/outbox/ email/accounts/ email/suppressions/
      analytics/ settings/ settings/audit/
    api/                     Route handlers (JSON, Zod-validated, auth-wrapped, rate-limited)
  components/                UI primitives (ui/), review card, charts, app shell, status badges
  lib/
    db/                      Store interface + Supabase and in-memory implementations
    auth/session.ts          getContext(): user + workspace + store (Supabase or demo)
    ai/                      Claude calls (claude.ts, index.ts), schemas, demo heuristics
    leads/                   Discovery providers, website enrichment, robots.txt parser
    email/                   Composer (footer + List-Unsubscribe), guard, queue/worker, transports
    compliance/              Email linter, fact extraction
    services/                Leads, review, metrics, suppressions, audit, unsubscribe
    validation.ts            All request schemas
  proxy.ts                   Session refresh + optimistic auth redirect
supabase/migrations/         SQL schema, RLS policies, bootstrap function
```

**Data access.** Every server path goes through the small `Store` interface (`src/lib/db/store.ts`). In
production it's `SupabaseStore` using the signed-in user's session, so **Postgres row-level security** enforces
tenancy; the explicit `workspace_id` filter is defence in depth. Jobs without a user (cron, webhooks, unsubscribe)
use the service-role client and must scope with `forWorkspace()`. The in-memory `MemoryStore` mirrors the SQL
defaults and unique constraints so the demo behaves like production.

**Sending pipeline.** `Approve & Send` → lint (errors block) → `checkSendable` guard → insert `email_messages`
(unique per draft) → immediate attempt. Limits never drop mail: they defer it (`next_attempt_at`). Transient
failures retry at 1 / 5 / 30 / 120 min; permanent failures fail; hard bounces are suppressed. The Vercel Cron
worker (`/api/cron/send-queue`) processes deferred and retrying messages and **only ever sends messages a human
approved**. Messages stuck in `sending` are marked failed, never resent automatically.

## Database schema

See [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Tables:

| Table | Purpose |
|---|---|
| `workspaces`, `workspace_members`, `profiles` | Tenancy, sender identity, postal address, compliance defaults (daily cap, dedupe window, role-only). |
| `products`, `icps` | What you sell; ideal customer profile (raw inputs + AI-structured JSON). |
| `lead_searches` | Every discovery run (provider, query, counts, errors). |
| `leads` | Company-level record + optional public contact, `source`/`source_ref`/`source_url`, `email_source_url`, `consent_basis`, website excerpt, score/fit/status. Unique per `(workspace, domain)`. |
| `lead_qualifications` | AI qualification history with evidence and unknowns. |
| `campaigns`, `campaign_leads` | Campaigns and membership. |
| `sending_accounts` | Provider, non-secret config, encrypted secret, limits, warm-up, status. |
| `email_drafts` | Variants, personalisation used, lint findings, status. |
| `email_messages` | Queue + sent log (unique per draft), attempts, retry time, provider id, error. |
| `email_events` | delivered / bounced / complained / replied / positive_reply / meeting_booked / unsubscribed. |
| `suppressions` | Email or domain, reason, source. Members can add, **not delete** (RLS). |
| `audit_log` | Append-only (insert + select only via RLS). |

Metrics are computed with count queries over these rows — never stored counters — so they can't drift.

## Environment variables

Copy `.env.example` to `.env.local`. Everything is optional for local demo use.

| Variable | Required for | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Production | Used in unsubscribe links. |
| `APP_SECRET` | Production | HMAC for unsubscribe links. `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Production | 32 bytes base64. `openssl rand -base64 32`. Changing it makes stored credentials unreadable. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real accounts & data | Without them: demo mode (refused in production unless `DEMO_MODE=true`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron, webhooks, unsubscribe | Server-only. Never expose it. |
| `ANTHROPIC_API_KEY` | Real AI | Without it: labelled demo heuristics. |
| `ANTHROPIC_MODEL` | Optional | Default `claude-opus-5`. |
| `GOOGLE_PLACES_API_KEY` | Google Places discovery | Enable "Places API (New)". |
| `CRAWLER_CONTACT_URL` | Recommended | Put in the crawler User-Agent so site owners can contact you. |
| `RESEND_WEBHOOK_SECRET` | Resend bounces/complaints | Webhook URL: `/api/webhooks/resend`, events: delivered, bounced, complained. |
| `CRON_SECRET` | Queue worker | Vercel sends it as `Authorization: Bearer …`. |

## Run locally

Requires Node 20+ (tested on Node 24).

```bash
npm install
cp .env.example .env.local      # optional — leave empty for demo mode
npm run dev                     # http://localhost:3000 → "Find My First Leads" → "Enter demo workspace"
```

Checks:

```bash
npm test            # Vitest: guard, linter, robots.txt, SSRF, tokens/crypto, store, heuristics
npm run typecheck
npm run lint
npm run build
```

Demo data lives in `.data/demo-store.json` (git-ignored). Reset it from **Settings → Reset demo data** or delete
the file.

### Connecting Supabase

1. Create a project at supabase.com.
2. SQL Editor → paste and run `supabase/migrations/0001_init.sql`.
3. Authentication → URL configuration: set Site URL to your app URL and add `…/auth/callback` to redirect URLs.
4. Put the URL, anon key and service-role key in `.env.local`, restart `npm run dev`, and create an account.
   A workspace is created on first sign-in (`bootstrap_workspace`).

## Deploy to Vercel

1. Push to GitHub (`git remote add origin … && git push -u origin main`).
2. Vercel → New Project → import the repo (framework auto-detected).
3. Add the environment variables above (Production + Preview). Set `NEXT_PUBLIC_APP_URL` to the Vercel URL.
4. Deploy. Then update Supabase Auth URLs to the production domain.
5. Cron: `vercel.json` runs the queue worker **daily** (the Hobby plan limit). On Pro, change the schedule to
   `*/10 * * * *` so deferred/retried emails go out promptly. Approved emails are always attempted immediately;
   the cron only handles deferrals and retries.
6. Resend: add the webhook `https://<domain>/api/webhooks/resend` and copy its signing secret to
   `RESEND_WEBHOOK_SECRET`.

## Integrations still needed

- **Gmail / Google Workspace OAuth** — needs a Google Cloud OAuth client with `gmail.send`; Google requires app
  verification for this scope before external users can connect. Until then, connect Gmail via SMTP with an app
  password. Adapter slot: `src/lib/email/transports.ts` (`oauthPending`).
- **Microsoft 365 OAuth** — Entra ID app with `Mail.Send`; same adapter slot.
- **Reply detection** — replies are logged manually on the lead page. Next: Gmail/Graph API or IMAP polling, or
  Resend inbound.
- **Additional data providers** — Apollo, Hunter, OpenCorporates, etc. plug into `src/lib/leads/providers.ts`.
  Check each provider's terms and the privacy law of your recipients before adding contact-level data.

## Compliance notes (not legal advice)

- **Australia (Spam Act 2003)** — commercial email needs consent. *Inferred consent* can apply when a business
  address is conspicuously published, isn't accompanied by a "no marketing" statement, and your message relates to
  the recipient's business role. Hence the role-address default, `consent_basis` on every lead and
  `email_source_url` provenance.
- **UK/EU (PECR/GDPR)** — B2B to corporate addresses usually rests on legitimate interest; named individuals
  (`jane@…`) are personal data. Keep "role addresses only" on unless you've done the assessment.
- **US (CAN-SPAM)** — accurate headers, non-deceptive subjects, a postal address and a working opt-out honoured
  within 10 business days (LeadPilot honours it immediately).
- **Google Places terms** — Maps content may only be cached under Google's terms; `place_id` may be stored
  indefinitely, other fields should be refreshed. Consider a periodic refresh job for production use.
- Every email carries a footer with sender, postal address, why the recipient is receiving it and a one-click
  unsubscribe link, plus `List-Unsubscribe` and `List-Unsubscribe-Post` headers (Gmail/Yahoo bulk-sender rules).
- Authenticate your sending domain with SPF, DKIM and DMARC.

## What to build next

1. Reply detection (Gmail/Graph/IMAP) with positive/negative classification — closes the metrics loop.
2. Gmail and Microsoft 365 OAuth sending.
3. Follow-up step (one polite follow-up, human-approved, auto-cancelled on reply/unsubscribe).
4. Team roles and invitations (schema already has `workspace_members.role`).
5. Durable job queue (Supabase `pg_cron` / Inngest / QStash) and a shared rate limiter (Upstash) for scale.
6. Google Places data refresh job + more discovery providers.
7. Data subject tools: export/erase a contact across all tables.
8. Generated Supabase types (`supabase gen types`) for end-to-end typed queries.
9. Prompt evals for qualification and email quality before changing models or prompts.
