import Papa from "papaparse";
import { fail, ok, parseJson, withAuth } from "@/lib/api";
import type { DiscoveredBusiness } from "@/lib/leads/providers";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { addLeads } from "@/lib/services/leads";
import { isValidEmail, normalizeDomain, normalizeUrl } from "@/lib/utils";
import { CsvImportInput } from "@/lib/validation";

const MAX_ROWS = 1000;
const ALIASES: Record<string, string[]> = {
  company_name: ["company", "company_name", "business", "business_name", "name", "organisation", "organization"],
  website: ["website", "url", "site", "domain", "web"],
  email: ["email", "email_address", "business_email"],
  contact_name: ["contact", "contact_name", "full_name", "person"],
  contact_title: ["title", "job_title", "contact_title", "role", "position"],
  industry: ["industry", "category", "sector", "type"],
  location: ["location", "city", "address", "region", "country"],
  description: ["description", "notes", "about"],
  phone: ["phone", "telephone", "phone_number"],
};

/**
 * CSV import. The user attests the data was obtained lawfully and chooses the consent basis;
 * no column is ever treated as consent by itself.
 */
export const POST = withAuth(async (req, ctx) => {
  const input = await parseJson(req, CsvImportInput);
  const parsed = Papa.parse<Record<string, string>>(input.csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"),
  });
  if (!parsed.data.length) return fail(400, "No rows found. Make sure the first line contains column headers.");
  if (parsed.data.length > MAX_ROWS) return fail(400, `Please import at most ${MAX_ROWS} rows at a time.`);

  const headers = parsed.meta.fields ?? [];
  const col = (field: string) => headers.find((h) => ALIASES[field].includes(h));
  if (!col("company_name")) return fail(400, "A “company” (or “company_name”) column is required.");

  const errors: { row: number; message: string }[] = [];
  const items: (DiscoveredBusiness & { email: string | null; contact_name: string | null; contact_title: string | null })[] = [];
  parsed.data.forEach((r, i) => {
    const get = (f: string) => (col(f) ? String(r[col(f)!] ?? "").trim() : "");
    const name = get("company_name");
    if (!name) return errors.push({ row: i + 2, message: "Missing company name" });
    const email = get("email");
    if (email && !isValidEmail(email)) return errors.push({ row: i + 2, message: `Invalid email “${email}”` });
    const website = normalizeUrl(get("website"));
    items.push({
      company_name: name.slice(0, 200), website, domain: normalizeDomain(website ?? email), industry: get("industry").slice(0, 120),
      location: get("location").slice(0, 200), description: get("description").slice(0, 1000), phone: get("phone") || null,
      email: email ? email.toLowerCase() : null, contact_name: get("contact_name") || null, contact_title: get("contact_title") || null,
      source: "csv_import", source_ref: null, source_url: null,
    });
  });

  const res = await addLeads(ctx, items.map((it) => ({ ...it, consent_basis: input.consent_basis })), { icpId: input.icp_id, searchId: null });
  await recordAudit(ctx.store, actorOf(ctx), {
    action: "leads.imported",
    summary: `Imported ${res.added.length} leads from CSV (${res.duplicates.length} duplicates, ${errors.length} invalid rows)`,
    entityType: "lead_import", metadata: { consent_basis: input.consent_basis, attested: true, rows: parsed.data.length },
  });
  return ok({ added: res.added.length, duplicates: res.duplicates.length, suppressed: res.suppressed.length, errors: errors.slice(0, 50) });
});
