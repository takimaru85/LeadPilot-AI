"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, Building2, FileUp, Globe, Plus, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice, table } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import type { Lead, LeadSearch } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

interface ProviderInfo { id: string; label: string; description: string; available: boolean }
interface IcpInfo { id: string; name: string; queries: string[]; locations: string[] }

type Tab = "search" | "import" | "manual";

export function FindLeadsClient({ providers, icps, searches }: { providers: ProviderInfo[]; icps: IcpInfo[]; searches: LeadSearch[] }) {
  const [tab, setTab] = useState<Tab>("search");
  const tabs: { id: Tab; label: string; icon: typeof Search }[] = [
    { id: "search", label: "Search listings", icon: Search },
    { id: "import", label: "Import CSV", icon: FileUp },
    { id: "manual", label: "Add manually", icon: Plus },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <div className="inline-flex rounded-lg bg-zinc-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn("focus-ring inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium", tab === t.id ? "bg-white text-zinc-900 shadow-card" : "text-zinc-600 hover:text-zinc-900")}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        {tab === "search" && <SearchPanel providers={providers} icps={icps} />}
        {tab === "import" && <ImportPanel icps={icps} />}
        {tab === "manual" && <ManualPanel icps={icps} />}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="How leads are sourced" />
          <CardBody className="space-y-3 text-[13px] text-zinc-600">
            <p className="flex gap-2"><Building2 className="h-4 w-4 shrink-0 text-zinc-400" /> Company-level public listings only — names, websites, categories, locations.</p>
            <p className="flex gap-2"><Globe className="h-4 w-4 shrink-0 text-zinc-400" /> Emails come only from the company&apos;s own public website, fetched politely with robots.txt respected.</p>
            <p className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-zinc-400" /> Nothing is guessed or invented. Every field records its source.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent searches" />
          {searches.length === 0 ? (
            <CardBody><p className="text-sm text-zinc-500">No searches yet.</p></CardBody>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {searches.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-800">{s.query}{s.location && <span className="font-normal text-zinc-500"> · {s.location}</span>}</div>
                    <div className="text-xs text-zinc-500">{s.provider === "demo" ? "Sample data" : "Google Places"} · {formatRelative(s.created_at)}</div>
                  </div>
                  {s.status === "failed" ? <Badge tone="red">Failed</Badge> : <Badge tone={s.added_count ? "green" : "neutral"}>+{s.added_count}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function SearchPanel({ providers, icps }: { providers: ProviderInfo[]; icps: IcpInfo[] }) {
  const router = useRouter();
  const toast = useToast();
  const available = providers.filter((p) => p.available);
  const [provider, setProvider] = useState(available.find((p) => p.id === "google_places")?.id ?? available[0]?.id ?? "demo");
  const [icpId, setIcpId] = useState(icps[0]?.id ?? "");
  const icp = icps.find((i) => i.id === icpId);
  const [query, setQuery] = useState(icp?.queries[0] ?? "");
  const [location, setLocation] = useState(icp?.locations[0] ?? "");
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ found: number; added: Lead[]; duplicates: string[]; suppressed: string[] } | null>(null);
  const [processing, setProcessing] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const r = await api<{ found: number; added: Lead[]; duplicates: string[]; suppressed: string[] }>("/api/leads/search", {
        body: { provider, query, location, limit, icp_id: icpId || null },
      });
      setResult(r);
      router.refresh();
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  };

  const enrichAndQualify = async () => {
    if (!result?.added.length) return;
    setProcessing(true);
    try {
      const ids = result.added.slice(0, 25).map((l) => l.id);
      const enrich = await api<{ results: { ok: boolean }[] }>("/api/leads/bulk", { body: { action: "enrich", ids } });
      const qualify = await api<{ results: { ok: boolean; error?: string }[] }>("/api/leads/bulk", { body: { action: "qualify", ids } });
      const failed = qualify.results.filter((r) => !r.ok);
      toast.success(
        `Checked ${enrich.results.filter((r) => r.ok).length} websites and qualified ${qualify.results.length - failed.length} leads`,
        failed.slice(0, 3).map((f) => f.error ?? "Failed"),
      );
      router.push("/leads?sort=score");
    } catch (err) {
      toast.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const selected = providers.find((p) => p.id === provider);
  return (
    <>
      <Card>
        <CardHeader title="Search public business listings" description={selected?.description} />
        <form onSubmit={search}>
          <CardBody className="grid gap-4 md:grid-cols-6">
            <Field label="Source" className="md:col-span-2">
              <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                {providers.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.available}>
                    {p.label}{!p.available ? " (add API key)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ideal customer profile" className="md:col-span-4">
              <Select
                value={icpId}
                onChange={(e) => {
                  setIcpId(e.target.value);
                  const next = icps.find((i) => i.id === e.target.value);
                  if (next) {
                    setQuery(next.queries[0] ?? query);
                    setLocation(next.locations[0] ?? location);
                  }
                }}
              >
                <option value="">None</option>
                {icps.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Business type" className="md:col-span-3" htmlFor="q">
              <Input id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="dental clinic" required minLength={2} />
            </Field>
            <Field label="Location" className="md:col-span-2" htmlFor="loc">
              <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Brisbane, Australia" />
            </Field>
            <Field label="Max results" htmlFor="limit">
              <Select id="limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                {[5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            {icp && icp.queries.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 md:col-span-6">
                <span className="text-xs text-zinc-500">Suggested:</span>
                {icp.queries.map((q) => (
                  <button key={q} type="button" onClick={() => setQuery(q)} className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 hover:border-brand-300 hover:text-brand-700">{q}</button>
                ))}
              </div>
            )}
          </CardBody>
          <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
            <p className="text-xs text-zinc-500">{provider === "demo" ? "Sample data is fictional and can never be emailed." : "Results come from Google Places."}</p>
            <Button type="submit" loading={loading}><Search className="h-4 w-4" /> Search</Button>
          </div>
        </form>
      </Card>

      {result && (
        <Card>
          <CardHeader
            title={`${result.added.length} new lead${result.added.length === 1 ? "" : "s"} added`}
            description={`${result.found} found · ${result.duplicates.length} already in your leads${result.suppressed.length ? ` · ${result.suppressed.length} suppressed` : ""}`}
            action={
              result.added.length > 0 && (
                <Button onClick={enrichAndQualify} loading={processing}>
                  <Sparkles className="h-4 w-4" /> Check websites &amp; qualify
                </Button>
              )
            }
          />
          {result.added.length === 0 ? (
            <EmptyState title="No new leads" description="Try a broader business type or a different location." />
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.thead}>
                  <tr><th className={table.th}>Company</th><th className={table.th}>Industry</th><th className={table.th}>Location</th><th className={table.th}>Website</th></tr>
                </thead>
                <tbody>
                  {result.added.map((l) => (
                    <tr key={l.id} className={table.tr}>
                      <td className={table.td}><Link href={`/leads/${l.id}`} className="font-medium hover:text-brand-700">{l.company_name}</Link></td>
                      <td className={`${table.td} text-zinc-600`}>{l.industry}</td>
                      <td className={`${table.td} text-zinc-600`}>{l.location}</td>
                      <td className={`${table.td} text-zinc-500`}>{l.domain ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

function ImportPanel({ icps }: { icps: IcpInfo[] }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [icpId, setIcpId] = useState(icps[0]?.id ?? "");
  const [basis, setBasis] = useState("legitimate_interest");
  const [attest, setAttest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ added: number; duplicates: number; suppressed: number; errors: { row: number; message: string }[] } | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) return toast.error(new Error("CSV must be under 2 MB"));
    setFileName(f.name);
    setCsv(await f.text());
  };

  const submit = async () => {
    setLoading(true);
    try {
      const r = await api<typeof result>("/api/leads/import", { body: { csv, icp_id: icpId || null, consent_basis: basis, attest } });
      setResult(r);
      toast.success(`Imported ${r!.added} leads`);
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Import a CSV" description="Columns: company (required), website, email, contact_name, title, industry, location, description, phone." />
      <CardBody className="space-y-5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files[0]);
          }}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 px-6 py-10 text-center hover:border-brand-300 hover:bg-brand-50/30"
        >
          <FileUp className="h-6 w-6 text-zinc-400" />
          <span className="mt-2 text-sm font-medium text-zinc-700">{fileName || "Drop a CSV here or click to choose"}</span>
          <span className="mt-1 text-xs text-zinc-500">{csv ? `${csv.split(/\r?\n/).filter(Boolean).length - 1} rows` : "Up to 1,000 rows, 2 MB"}</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Ideal customer profile">
            <Select value={icpId} onChange={(e) => setIcpId(e.target.value)}>
              <option value="">None</option>
              {icps.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </Field>
          <Field label="Basis for contacting these businesses" hint="Recorded on every imported lead.">
            <Select value={basis} onChange={(e) => setBasis(e.target.value)}>
              <option value="legitimate_interest">Legitimate interest (B2B)</option>
              <option value="conspicuous_publication">Address conspicuously published by the business</option>
              <option value="existing_relationship">Existing business relationship</option>
              <option value="consent">They consented to be contacted</option>
            </Select>
          </Field>
        </div>
        <Checkbox
          checked={attest}
          onChange={(e) => setAttest(e.target.checked)}
          label="I confirm this list contains business contacts obtained lawfully"
          description="Not purchased from an unverified source, not scraped from behind a login, and no sensitive personal data."
        />
        {result && (
          <Notice tone={result.errors.length ? "amber" : "green"} title={`${result.added} added · ${result.duplicates} duplicates · ${result.suppressed} suppressed`}>
            {result.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-xs">
                {result.errors.slice(0, 5).map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
              </ul>
            )}
          </Notice>
        )}
      </CardBody>
      <div className="flex justify-between gap-3 border-t border-zinc-100 px-5 py-3">
        {result?.added ? <ButtonLink href="/leads" variant="ghost">View leads <ArrowRight className="h-4 w-4" /></ButtonLink> : <span />}
        <Button onClick={submit} loading={loading} disabled={!csv || !attest}>Import leads</Button>
      </div>
    </Card>
  );
}

function ManualPanel({ icps }: { icps: IcpInfo[] }) {
  const router = useRouter();
  const toast = useToast();
  const empty = { company_name: "", website: "", email: "", contact_name: "", contact_title: "", industry: "", location: "", description: "", consent_basis: "legitimate_interest", icp_id: icps[0]?.id ?? "" };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const lead = await api<Lead>("/api/leads", { body: { ...form, icp_id: form.icp_id || null } });
      toast.success(`Added ${lead.company_name}`);
      router.push(`/leads/${lead.id}`);
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Add a company" description="For businesses you already know. Only enter contact details the business published or gave you." />
      <form onSubmit={submit}>
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Company name" required><Input value={form.company_name} onChange={set("company_name")} required /></Field>
          <Field label="Website"><Input value={form.website} onChange={set("website")} placeholder="example.com" /></Field>
          <Field label="Business email" hint="Leave blank to find one on their website."><Input type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Contact name"><Input value={form.contact_name} onChange={set("contact_name")} /></Field>
          <Field label="Job title"><Input value={form.contact_title} onChange={set("contact_title")} /></Field>
          <Field label="Industry"><Input value={form.industry} onChange={set("industry")} /></Field>
          <Field label="Location"><Input value={form.location} onChange={set("location")} /></Field>
          <Field label="Basis for contact">
            <Select value={form.consent_basis} onChange={set("consent_basis")}>
              <option value="legitimate_interest">Legitimate interest (B2B)</option>
              <option value="conspicuous_publication">Address published by the business</option>
              <option value="existing_relationship">Existing relationship</option>
              <option value="consent">Consent</option>
            </Select>
          </Field>
          <Field label="Description" className="md:col-span-2"><Textarea rows={2} value={form.description} onChange={set("description")} /></Field>
        </CardBody>
        <div className="flex justify-end border-t border-zinc-100 px-5 py-3">
          <Button type="submit" loading={loading}>Add lead</Button>
        </div>
      </form>
    </Card>
  );
}
