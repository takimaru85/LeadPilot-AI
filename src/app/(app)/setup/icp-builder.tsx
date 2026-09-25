"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Target } from "lucide-react";
import { ModelBadge } from "@/components/status";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, ListInput } from "@/components/ui/form";
import { Card, CardBody, CardHeader, EmptyState, Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import type { Icp, Product } from "@/lib/types";

const LISTS = [
  { key: "industries", label: "Industry", placeholder: "Dental", hint: "Press Enter after each." },
  { key: "business_types", label: "Business type", placeholder: "Dental clinic, Orthodontist" },
  { key: "locations", label: "Location", placeholder: "Australia, Sydney" },
  { key: "company_sizes", label: "Company size", placeholder: "1–50 employees" },
  { key: "job_titles", label: "Decision maker", placeholder: "Practice Owner, Practice Manager" },
  { key: "pain_points", label: "Pain points", placeholder: "Outdated website" },
  { key: "buying_signals", label: "Buying signals", placeholder: "Old copyright year, phone-only booking", hint: "Things visible on a public website or listing." },
  { key: "keywords", label: "Keywords", placeholder: "online booking" },
] as const;
type ListKey = (typeof LISTS)[number]["key"];

export function IcpBuilder({ icp, product }: { icp: Icp | null; product: Product | null }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(icp?.name ?? (product ? `${product.target_customer || "Ideal customers"}` : ""));
  const [lists, setLists] = useState<Record<ListKey, string[]>>(() => Object.fromEntries(LISTS.map((l) => [l.key, icp?.[l.key] ?? []])) as Record<ListKey, string[]>);
  const [saving, setSaving] = useState(false);
  const [structuring, setStructuring] = useState(false);

  if (!product) {
    return (
      <Card>
        <EmptyState icon={<Target className="h-5 w-5" />} title="Define your ideal customer" description="Save your product first — the ideal customer profile builds on it." />
      </Card>
    );
  }

  const suggestions: Partial<Record<ListKey, string[]>> = {
    industries: product.industry ? [product.industry] : [],
    locations: product.location ? [product.location] : [],
    company_sizes: product.company_size ? [product.company_size] : [],
    pain_points: product.customer_problem ? [product.customer_problem.slice(0, 80)] : [],
  };

  const save = async (): Promise<Icp | null> => {
    setSaving(true);
    try {
      const body = { name, product_id: product.id, ...lists };
      const saved = await api<Icp>(icp ? `/api/icps/${icp.id}` : "/api/icps", { method: icp ? "PATCH" : "POST", body });
      toast.success("Ideal customer profile saved");
      router.refresh();
      return saved;
    } catch (e) {
      toast.error(e);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const structure = async () => {
    const saved = await save();
    if (!saved) return;
    setStructuring(true);
    try {
      await api(`/api/icps/${saved.id}/structure`, { method: "POST" });
      toast.success("AI structured your ideal customer profile");
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setStructuring(false);
    }
  };

  const s = icp?.structured;
  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader title={<span className="flex items-center gap-2"><Target className="h-4 w-4 text-brand-600" /> Ideal customer profile</span>} description="Rough notes are fine — AI turns them into a structured profile." />
        <CardBody className="space-y-5">
          <Field label="Profile name" htmlFor="icp-name">
            <Input id="icp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Independent dental clinics — Australia" />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            {LISTS.map((l) => (
              <Field key={l.key} label={l.label} hint={"hint" in l ? l.hint : undefined}>
                <ListInput value={lists[l.key]} onChange={(v) => setLists((x) => ({ ...x, [l.key]: v }))} placeholder={l.placeholder} suggestions={suggestions[l.key]} />
              </Field>
            ))}
          </div>
        </CardBody>
        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 px-5 py-3">
          <Button variant="secondary" onClick={save} loading={saving && !structuring} disabled={!name.trim()}>Save</Button>
          <Button onClick={structure} loading={structuring} disabled={!name.trim()}>
            <Sparkles className="h-4 w-4" /> Save &amp; structure with AI
          </Button>
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader title="Structured ICP" description="What LeadPilot uses to search and qualify." action={icp?.structured_by && <ModelBadge model={icp.structured_by} />} />
        <CardBody>
          {!s ? (
            <EmptyState title="Not structured yet" description="Click “Save & structure with AI” to generate a clear profile from your notes." className="py-10" />
          ) : (
            <div className="space-y-4 text-sm">
              <p className="leading-relaxed text-zinc-700">{s.summary}</p>
              {(
                [
                  ["Decision makers", s.decision_makers],
                  ["Pain points", s.pain_points],
                  ["Buying signals", s.buying_signals],
                  ["Disqualifiers", s.disqualifiers],
                  ["Suggested searches", s.search_queries],
                ] as const
              ).map(([label, items]) =>
                items.length ? (
                  <div key={label}>
                    <div className="mb-1.5 text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((i) => (
                        <span key={i} className="rounded-md bg-zinc-100 px-2 py-0.5 text-[13px] text-zinc-700">{i}</span>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
              <Notice tone="blue">Signals and disqualifiers only ever refer to public business information.</Notice>
              <ButtonLink href="/find-leads" className="w-full">Find matching leads</ButtonLink>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
