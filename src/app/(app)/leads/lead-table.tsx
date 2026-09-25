"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Eye, FolderPlus, Globe, Mail, MoreHorizontal, Search, SkipForward, Sparkles, X } from "lucide-react";
import { LeadStatusBadge, ScorePill, leadStatusLabel } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { Card, EmptyState, table } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import type { LeadFilters } from "@/lib/services/lead-queries";
import { LEAD_STATUSES, type CampaignStatus, type Lead } from "@/lib/types";
import { cn, formatRelative, truncate } from "@/lib/utils";

type BulkAction = "qualify" | "generate" | "skip" | "enrich" | "add_to_campaign";
const ACTION_LABEL: Record<BulkAction, string> = { qualify: "Qualified", generate: "Generated drafts for", skip: "Skipped", enrich: "Checked websites of", add_to_campaign: "Added to campaign:" };

export function LeadTable({ leads, total, page, pageSize, filters, campaigns }: {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  filters: LeadFilters;
  campaigns: { id: string; name: string; status: CampaignStatus }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [campaignFor, setCampaignFor] = useState<string[] | null>(null);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [q, setQ] = useState(filters.q);
  const [pending, startTransition] = useTransition();

  // Reset the selection whenever a new page of leads arrives (render-time state adjustment).
  const [prevLeads, setPrevLeads] = useState(leads);
  if (leads !== prevLeads) {
    setPrevLeads(leads);
    setSelected(new Set());
  }

  const setParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in updates)) next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  // Debounced search box → URL.
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => setParam({ q: q || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const run = async (action: BulkAction, ids: string[], campaign?: string) => {
    setBusy(action);
    try {
      const r = await api<{ results: { id: string; ok: boolean; error?: string }[] }>("/api/leads/bulk", { body: { action, ids, campaign_id: campaign } });
      const okCount = r.results.filter((x) => x.ok).length;
      const errors = [...new Set(r.results.filter((x) => !x.ok).map((x) => x.error ?? "Failed"))];
      const campaignName = campaign ? campaigns.find((c) => c.id === campaign)?.name : "";
      if (okCount) toast.success(`${ACTION_LABEL[action]} ${action === "add_to_campaign" ? `${campaignName} (${okCount})` : `${okCount} lead${okCount > 1 ? "s" : ""}`}`, errors.slice(0, 3));
      else toast.error(new Error(errors[0] ?? "Nothing was updated"));
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const allOnPage = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(leads.map((l) => l.id)));
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const ids = [...selected];
  const filtered = filters.q || filters.status !== "all" || filters.minScore || filters.campaign;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, industry, location, email…" className="pl-9" aria-label="Search leads" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={filters.status} onChange={(e) => setParam({ status: e.target.value === "all" ? null : e.target.value })} aria-label="Status" className="sm:w-40">
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{leadStatusLabel(s)}</option>)}
          </Select>
          <Select value={filters.minScore ?? ""} onChange={(e) => setParam({ min_score: e.target.value || null })} aria-label="Minimum score" className="sm:w-36">
            <option value="">Any score</option>
            <option value="35">Score 35+</option>
            <option value="55">Score 55+</option>
            <option value="75">Score 75+</option>
          </Select>
          <Select value={filters.campaign ?? ""} onChange={(e) => setParam({ campaign: e.target.value || null })} aria-label="Campaign" className="sm:w-44">
            <option value="">All campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={filters.sort} onChange={(e) => setParam({ sort: e.target.value })} aria-label="Sort" className="sm:w-40">
            <option value="created_at">Newest first</option>
            <option value="score">Highest score</option>
            <option value="company_name">Company A–Z</option>
            <option value="last_contacted_at">Last contacted</option>
          </Select>
        </div>
      </div>

      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50/60 px-4 py-2.5">
          <span className="mr-2 text-sm font-medium text-brand-900">{ids.length} selected</span>
          <Button size="sm" variant="secondary" loading={busy === "enrich"} onClick={() => run("enrich", ids)}><Globe className="h-3.5 w-3.5" /> Check websites</Button>
          <Button size="sm" variant="secondary" loading={busy === "qualify"} onClick={() => run("qualify", ids)}><Sparkles className="h-3.5 w-3.5" /> Qualify</Button>
          <Button size="sm" variant="secondary" loading={busy === "generate"} onClick={() => run("generate", ids)}><Mail className="h-3.5 w-3.5" /> Generate emails</Button>
          <Button size="sm" variant="secondary" onClick={() => setCampaignFor(ids)} disabled={!campaigns.length}><FolderPlus className="h-3.5 w-3.5" /> Add to campaign</Button>
          <Button size="sm" variant="ghost" loading={busy === "skip"} onClick={() => run("skip", ids)}><SkipForward className="h-3.5 w-3.5" /> Skip</Button>
          <button className="ml-auto rounded p-1 text-brand-700 hover:bg-brand-100" onClick={() => setSelected(new Set())} aria-label="Clear selection"><X className="h-4 w-4" /></button>
        </div>
      )}

      {leads.length === 0 ? (
        <EmptyState title="No leads match these filters" description={filtered ? "Try clearing a filter." : undefined} action={filtered && <Button variant="secondary" onClick={() => { setQ(""); router.push(pathname); }}>Clear filters</Button>} />
      ) : (
        <div className={cn(table.wrap, pending && "opacity-60 transition-opacity")}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={cn(table.th, "w-10")}><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on page" className="h-4 w-4 accent-brand-600" /></th>
                <th className={table.th}>Company</th>
                <th className={table.th}>Contact</th>
                <th className={table.th}>Industry</th>
                <th className={table.th}>Location</th>
                <th className={table.th}>Lead score</th>
                <th className={table.th}>Reason</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>Last contact</th>
                <th className={cn(table.th, "text-right")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className={cn(table.tr, selected.has(l.id) && "bg-brand-50/40")}>
                  <td className={table.td}><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.company_name}`} className="h-4 w-4 accent-brand-600" /></td>
                  <td className={cn(table.td, "min-w-[12rem]")}>
                    <Link href={`/leads/${l.id}`} className="font-medium text-zinc-900 hover:text-brand-700">{l.company_name}</Link>
                    <div className="text-xs text-zinc-500">{l.domain ?? "No website"}</div>
                  </td>
                  <td className={cn(table.td, "min-w-[10rem]")}>
                    {l.email ? (
                      <>
                        <div className="text-[13px] text-zinc-700">{l.contact_name ?? (l.email_type === "role" ? "General inbox" : "—")}</div>
                        <div className="text-xs text-zinc-500">{l.email}</div>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-400">No public email</span>
                    )}
                  </td>
                  <td className={cn(table.td, "text-[13px] whitespace-nowrap text-zinc-600")}>{l.industry || "—"}</td>
                  <td className={cn(table.td, "text-[13px] text-zinc-600")}>{truncate(l.location || "—", 28)}</td>
                  <td className={table.td}><ScorePill score={l.score} /></td>
                  <td className={cn(table.td, "max-w-[16rem] text-[13px] text-zinc-600")} title={l.reason ?? undefined}>{l.reason ? truncate(l.reason, 70) : <span className="text-zinc-400">Not qualified</span>}</td>
                  <td className={table.td}><LeadStatusBadge status={l.status} /></td>
                  <td className={cn(table.td, "text-[13px] whitespace-nowrap text-zinc-500")}>{formatRelative(l.last_contacted_at)}</td>
                  <td className={cn(table.td, "text-right")}>
                    <Menu
                      trigger={(p) => <button {...p} className="focus-ring rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label={`Actions for ${l.company_name}`}><MoreHorizontal className="h-4 w-4" /></button>}
                      items={[
                        { label: "View", icon: <Eye />, onSelect: () => router.push(`/leads/${l.id}`) },
                        { label: "Qualify", icon: <Sparkles />, onSelect: () => run("qualify", [l.id]) },
                        { label: "Generate email", icon: <Mail />, onSelect: () => run("generate", [l.id]), disabled: l.status === "do_not_contact" },
                        { label: "Review & approve", icon: <Mail />, onSelect: () => router.push(`/leads/${l.id}#drafts`), disabled: l.status !== "draft_ready" },
                        { label: "Add to campaign", icon: <FolderPlus />, onSelect: () => setCampaignFor([l.id]), disabled: !campaigns.length },
                        { label: "Skip", icon: <SkipForward />, onSelect: () => run("skip", [l.id]) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-[13px] text-zinc-500">
        <span>{total} lead{total === 1 ? "" : "s"}{pages > 1 && ` · page ${page} of ${pages}`}</span>
        {pages > 1 && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })}>Previous</Button>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setParam({ page: String(page + 1) })}>Next</Button>
          </div>
        )}
      </div>

      <Dialog
        open={!!campaignFor}
        onClose={() => setCampaignFor(null)}
        title="Add to campaign"
        description={`${campaignFor?.length ?? 0} lead(s) will be added. Nothing is sent automatically.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCampaignFor(null)}>Cancel</Button>
            <Button loading={busy === "add_to_campaign"} disabled={!campaignId} onClick={async () => { await run("add_to_campaign", campaignFor!, campaignId); setCampaignFor(null); }}>Add</Button>
          </>
        }
      >
        <Field label="Campaign">
          <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
          </Select>
        </Field>
      </Dialog>
    </Card>
  );
}
