import { PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { listProviders } from "@/lib/leads/providers";
import { FindLeadsClient } from "./find-leads-client";

export const metadata = { title: "Find Leads" };

export default async function FindLeadsPage() {
  const { store } = await requireContext();
  const [icps, searches] = await Promise.all([
    store.list("icps", { order: { column: "created_at" } }),
    store.list("lead_searches", { order: { column: "created_at", ascending: false }, limit: 8 }),
  ]);
  const providers = listProviders().map((p) => ({ id: p.id, label: p.label, description: p.description, available: p.available }));
  return (
    <>
      <PageHeader
        eyebrow="Step 3"
        title="Find leads"
        description="Search public business listings, import a list you already have, or add a company by hand. Duplicates and suppressed domains are skipped automatically."
      />
      <FindLeadsClient
        providers={providers}
        icps={icps.map((i) => ({ id: i.id, name: i.name, queries: i.structured?.search_queries ?? i.business_types, locations: i.structured?.locations ?? i.locations }))}
        searches={searches}
      />
    </>
  );
}
