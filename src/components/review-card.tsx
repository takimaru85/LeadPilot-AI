"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Pencil, RefreshCw, Send, ShieldAlert, ShieldCheck, SkipForward } from "lucide-react";
import { ModelBadge, ScorePill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/form";
import { Badge, Card, Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import type { ReviewItem } from "@/lib/services/review";
import type { EmailDraft } from "@/lib/types";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = { google_places: "Google Places", csv_import: "CSV import", manual: "Added manually", website: "Company website", demo: "Sample data (fictional)" };

export function ReviewCard({ item, showCompanyLink = true }: { item: ReviewItem; showCompanyLink?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, element: confirmDialog } = useConfirm();
  const { lead, drafts, qualification, suppression, account, preflight } = item;
  const [active, setActive] = useState(drafts[0]?.id);
  const draft = drafts.find((d) => d.id === active) ?? drafts[0];
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  if (!draft) return null;

  const select = (d: EmailDraft) => {
    setActive(d.id);
    setSubject(d.subject);
    setBody(d.body);
    setEditing(false);
  };

  const errors = draft.warnings.filter((w) => w.level === "error");
  const warnings = draft.warnings.filter((w) => w.level === "warning");
  const blocked = preflight.blocking.length > 0 || errors.length > 0;

  const act = async (name: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(name);
    try {
      await fn();
      if (success) toast.success(success);
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = () =>
    act("save", async () => {
      await api(`/api/drafts/${draft.id}`, { method: "PATCH", body: { subject, body } });
      setEditing(false);
    }, "Draft updated — checks re-run");

  const approve = async () => {
    const ok = await confirm({
      title: "Send this email?",
      body: (
        <div className="space-y-2">
          <p>
            <span className="font-medium text-zinc-900">“{editing ? subject : draft.subject}”</span> will be sent to{" "}
            <span className="font-medium text-zinc-900">{lead.email}</span> from {account?.from_email ?? "your sending account"}.
          </p>
          {account?.provider === "sandbox" && <p className="text-xs text-amber-700">Sandbox account — recorded as sent, not delivered.</p>}
          <p className="text-xs text-zinc-500">A compliant footer with your postal address and a one-click unsubscribe link is added automatically.</p>
        </div>
      ),
      confirmLabel: "Approve & Send",
    });
    if (!ok) return;
    setBusy("send");
    try {
      const r = await api<{ outcome: string; note: string | null }>(`/api/drafts/${draft.id}/approve`, {
        body: { confirm: true, ...(editing ? { subject, body } : {}) },
      });
      if (r.outcome === "sent") toast.success(`Sent to ${lead.email}`);
      else if (r.outcome === "deferred" || r.outcome === "retrying") toast.info("Approved and queued", r.note ? [r.note] : undefined);
      else toast.error(new Error(r.note ?? `Not sent (${r.outcome})`));
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      {confirmDialog}
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {showCompanyLink ? (
              <Link href={`/leads/${lead.id}`} className="truncate text-[15px] font-semibold hover:text-brand-700">{lead.company_name}</Link>
            ) : (
              <span className="text-[15px] font-semibold">Email draft</span>
            )}
            <ScorePill score={lead.score} />
            {item.campaign && <Badge tone="brand">{item.campaign.name}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{lead.industry} · {lead.location}</p>
        </div>
        <div className="inline-flex shrink-0 rounded-lg bg-zinc-100 p-1" role="tablist" aria-label="Email variant">
          {drafts.map((d) => (
            <button key={d.id} role="tab" aria-selected={d.id === draft.id} onClick={() => select(d)} className={cn("rounded-md px-3 py-1 text-[13px] font-medium capitalize", d.id === draft.id ? "bg-white text-zinc-900 shadow-card" : "text-zinc-500 hover:text-zinc-800")}>
              {d.variant === "concise" ? "Very concise" : d.variant}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px]">
        <div className="space-y-4 p-5">
          <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-[13px]">
            <dt className="text-zinc-500">Recipient</dt>
            <dd className="min-w-0 text-zinc-800">
              {lead.email ?? <span className="text-red-600">No public email</span>}
              {lead.email_type && <Badge className="ml-2" tone={lead.email_type === "role" ? "neutral" : "amber"}>{lead.email_type === "role" ? "Role address" : "Personal address"}</Badge>}
              {lead.contact_name && <span className="text-zinc-500"> · {lead.contact_name}{lead.contact_title ? `, ${lead.contact_title}` : ""}</span>}
            </dd>
            <dt className="text-zinc-500">Company</dt>
            <dd className="text-zinc-800">{lead.company_name}{lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 text-zinc-500 hover:text-brand-700">{lead.domain}<ExternalLink className="h-3 w-3" /></a>}</dd>
            <dt className="text-zinc-500">Subject</dt>
            <dd>{editing ? <Input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" /> : <span className="font-medium text-zinc-900">{draft.subject}</span>}</dd>
          </dl>

          {editing ? (
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-[inherit] text-[13.5px]" aria-label="Email body" />
          ) : (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap text-zinc-800">{draft.body}</div>
          )}
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer select-none hover:text-zinc-700">Footer added automatically</summary>
            <pre className="mt-2 rounded-md bg-zinc-50 px-3 py-2 font-sans whitespace-pre-wrap">{item.footerPreview}</pre>
          </details>

          {(errors.length > 0 || warnings.length > 0) && (
            <div className="space-y-2">
              {errors.map((w, i) => <Notice key={`e${i}`} tone="red" icon={<ShieldAlert className="h-4 w-4" />}>{w.message}</Notice>)}
              {warnings.map((w, i) => <Notice key={`w${i}`} tone="amber" icon={<AlertTriangle className="h-4 w-4" />}>{w.message}</Notice>)}
            </div>
          )}
        </div>

        <aside className="space-y-5 border-t border-zinc-100 bg-zinc-50/40 p-5 text-[13px] lg:border-t-0 lg:border-l">
          <section>
            <h3 className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Pre-send checks</h3>
            {preflight.blocking.length ? (
              <ul className="space-y-1.5">
                {preflight.blocking.map((b) => <li key={b} className="flex gap-2 text-red-700"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{b}</li>)}
              </ul>
            ) : (
              <ul className="space-y-1.5 text-zinc-600">
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{suppression ? "Suppressed" : "Not on suppression list"}</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Not contacted recently</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Unsubscribe link &amp; postal address included</li>
                {preflight.deferReason ? (
                  <li className="flex gap-2 text-amber-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{preflight.deferReason} Will queue.</li>
                ) : (
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Within sending limits{item.accountLimit ? ` (${item.accountLimit}/day)` : ""}</li>
                )}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Personalization used</h3>
            {draft.personalization_used.length ? (
              <ul className="space-y-2">
                {draft.personalization_used.map((p, i) => (
                  <li key={i}>
                    <div className="text-zinc-800">{p.value}</div>
                    <div className="text-xs text-zinc-500">{p.field.replace(/_/g, " ")} · {p.source}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-zinc-500">Generic — no company-specific facts.</p>}
          </section>
          <section>
            <h3 className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Source of lead</h3>
            <p className="text-zinc-700">{SOURCE_LABEL[lead.source] ?? lead.source}</p>
            {lead.email_source_url && <p className="mt-0.5 truncate text-xs text-zinc-500">Email published at {lead.email_source_url}</p>}
            {qualification && <p className="mt-2 text-xs text-zinc-500">Angle: {qualification.outreach_angle}</p>}
          </section>
          <section className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">From {account ? `${account.label}` : "—"}</span>
            <ModelBadge model={draft.model} />
          </section>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3">
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="secondary" size="sm" onClick={saveEdit} loading={busy === "save"}>Save edits</Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setSubject(draft.subject); setBody(draft.body); }}>Cancel</Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          )}
          <Button variant="secondary" size="sm" loading={busy === "regen"} onClick={() => act("regen", () => api(`/api/leads/${lead.id}/drafts`, { method: "POST" }), "Generated fresh drafts")}>
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </Button>
          <Button variant="ghost" size="sm" loading={busy === "skip"} onClick={() => act("skip", () => api(`/api/leads/${lead.id}/skip`, { method: "POST" }), `Skipped ${lead.company_name}`)}>
            <SkipForward className="h-3.5 w-3.5" /> Skip
          </Button>
        </div>
        <Button onClick={approve} loading={busy === "send"} disabled={blocked || !lead.email} title={blocked ? "Resolve the issues above first" : undefined}>
          <Send className="h-4 w-4" /> Approve &amp; Send
        </Button>
      </div>
    </Card>
  );
}
