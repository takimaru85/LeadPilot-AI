import type { Lead, Product, Qualification, Workspace } from "@/lib/types";

/** Every piece of text an email is allowed to draw facts from. Used by the email linter. */
export function emailFacts(product: Product | null, ws: Workspace, lead: Lead, q?: Pick<Qualification, "evidence" | "potential_need"> | null): string {
  return [
    product && Object.values(product).join(" "),
    ws.sender_name, ws.sender_company, ws.sender_title, ws.website, ws.postal_address,
    lead.company_name, lead.industry, lead.location, lead.description, lead.site_excerpt, lead.contact_name, lead.contact_title, lead.website,
    q?.potential_need,
    ...(q?.evidence ?? []).map((e) => e.claim),
  ]
    .filter(Boolean)
    .join(" \n ");
}
