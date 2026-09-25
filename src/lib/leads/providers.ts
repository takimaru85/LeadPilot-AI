import "server-only";
import { DEMO_CATALOG } from "@/lib/demo/catalog";
import { env } from "@/lib/env";
import type { LeadSource } from "@/lib/types";
import { normalizeDomain, normalizeUrl } from "@/lib/utils";

/**
 * Lead discovery providers return COMPANY-level public listings. No provider returns
 * personal data; emails are found later, only on the company's own website (enrich.ts).
 */
export interface DiscoveredBusiness {
  company_name: string;
  website: string | null;
  domain: string | null;
  industry: string;
  location: string;
  description: string;
  phone: string | null;
  source: LeadSource;
  source_ref: string | null;
  source_url: string | null;
}

export interface SearchParams {
  query: string;
  location: string;
  limit: number;
}

export interface LeadProvider {
  id: "google_places" | "demo";
  label: string;
  description: string;
  available: boolean;
  search(p: SearchParams): Promise<DiscoveredBusiness[]>;
}

export class ProviderError extends Error {}

// ───────────────────────────────────────── Google Places (New) Text Search
// Terms note: Google Maps Platform restricts storing Places content. place_id may be stored
// indefinitely; other fields should be refreshed (see README → Data sources).
const PLACES_FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.websiteUri", "places.nationalPhoneNumber",
  "places.primaryTypeDisplayName", "places.editorialSummary", "places.googleMapsUri", "places.businessStatus",
].join(",");

interface PlacesResponse {
  places?: {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    primaryTypeDisplayName?: { text: string };
    editorialSummary?: { text: string };
    googleMapsUri?: string;
    businessStatus?: string;
  }[];
  error?: { message: string };
}

const googlePlaces: LeadProvider = {
  id: "google_places",
  label: "Google Places",
  description: "Public business listings from Google Maps (name, website, address, category).",
  available: Boolean(env.googlePlacesApiKey),
  async search({ query, location, limit }) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env.googlePlacesApiKey!, "X-Goog-FieldMask": PLACES_FIELDS },
      body: JSON.stringify({ textQuery: location ? `${query} in ${location}` : query, pageSize: Math.min(limit, 20) }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as PlacesResponse;
    if (!res.ok) throw new ProviderError(`Google Places error: ${json.error?.message ?? res.statusText}`);
    return (json.places ?? [])
      .filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY" && p.displayName?.text)
      .map((p) => ({
        company_name: p.displayName!.text,
        website: normalizeUrl(p.websiteUri),
        domain: normalizeDomain(p.websiteUri),
        industry: p.primaryTypeDisplayName?.text ?? query,
        location: p.formattedAddress ?? location,
        description: p.editorialSummary?.text ?? "",
        phone: p.nationalPhoneNumber ?? null,
        source: "google_places" as const,
        source_ref: p.id,
        source_url: p.googleMapsUri ?? null,
      }));
  },
};

// ───────────────────────────────────────── Demo (fictional)
const demo: LeadProvider = {
  id: "demo",
  label: "Sample data (fictional)",
  description: "Fictional businesses on .example domains for testing the workflow. Emails can never be delivered.",
  available: true,
  async search({ query, location, limit }) {
    const q = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, ""));
    const loc = location.toLowerCase().trim();
    return DEMO_CATALOG.filter((b) => {
      const hay = `${b.company_name} ${b.industry} ${b.description}`.toLowerCase();
      const place = `${b.city} ${b.region} ${b.country}`.toLowerCase();
      return (q.length === 0 || q.some((w) => hay.includes(w))) && (!loc || loc.split(/[,\s]+/).some((l) => l.length > 1 && place.includes(l)));
    })
      .slice(0, limit)
      .map((b) => ({
        company_name: b.company_name,
        website: `https://${b.domain}`,
        domain: b.domain,
        industry: b.industry,
        location: `${b.city}, ${b.region}, ${b.country}`,
        description: b.description,
        phone: b.phone,
        source: "demo" as const,
        source_ref: `demo:${b.domain}`,
        source_url: `https://${b.domain}`,
      }));
  },
};

export function listProviders(): LeadProvider[] {
  return [googlePlaces, demo];
}

export function getProvider(id: string): LeadProvider | undefined {
  return listProviders().find((p) => p.id === id && p.available);
}
