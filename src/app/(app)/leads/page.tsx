import { Search, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { listLeads, parseLeadFilters } from "@/lib/services/lead-queries";
import { LeadTable } from "./lead-table";

export const metadata = { title: "Leads" };

export default async function LeadsPage(props: PageProps<"/leads">) {
  const { store } = await requireContext();
  const filters = parseLeadFilters(await props.searchParams);
  const [{ leads, total, page, pageSize }, campaigns, anyLeads] = await Promise.all([
    listLeads(store, filters),
    store.list("campaigns", { order: { column: "created_at", ascending: false } }),
    store.count("leads"),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every company you've found, with where its data came from and why it may need you."
        actions={<ButtonLink href="/find-leads"><Search className="h-4 w-4" /> Find leads</ButtonLink>}
      />
      {anyLeads === 0 ? (
        <Card>
          <EmptyState icon={<Users className="h-5 w-5" />} title="No leads yet" description="Search public business listings, import a CSV, or add a company by hand." action={<ButtonLink href="/find-leads">Find your first leads</ButtonLink>} />
        </Card>
      ) : (
        <LeadTable leads={leads} total={total} page={page} pageSize={pageSize} filters={filters} campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status }))} />
      )}
    </>
  );
}
