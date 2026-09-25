@AGENTS.md

# LeadPilot AI — project notes

- All data access goes through `Store` (`src/lib/db/store.ts`); keep `SupabaseStore` and `MemoryStore` behaviour identical (defaults, unique constraints, null ordering). Update `supabase/migrations`, `src/lib/types.ts` and `MemoryStore` DEFAULTS together.
- Every email send must go through `approveAndSend` / `processMessage` (`src/lib/email/queue.ts`) and `checkSendable`. Never add bulk or automatic sending.
- PATCH schemas: use `patchSchema()` in `src/lib/validation.ts` — Zod 4 `.partial()` still applies `.default()` values.
- Lead data must be public, sourced (`source`, `source_url`, `email_source_url`) and never guessed.
- Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
