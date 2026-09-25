"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AtSign, FlaskConical, KeyRound, Mail, Pause, Play, PlugZap, Plus, Server, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Badge, Card, CardBody, CardHeader, EmptyState, Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import type { PublicSendingAccount } from "@/lib/services/accounts";
import type { EmailProvider } from "@/lib/types";
import { cn } from "@/lib/utils";

const PROVIDERS: { id: EmailProvider; label: string; icon: typeof Mail; blurb: string }[] = [
  { id: "smtp", label: "SMTP", icon: Server, blurb: "Any mailbox with SMTP access — incl. Google Workspace or Microsoft 365 with an app password." },
  { id: "resend", label: "Resend", icon: AtSign, blurb: "Transactional provider with delivery, bounce and complaint webhooks." },
  { id: "gmail", label: "Gmail / Google Workspace (OAuth)", icon: Mail, blurb: "Requires a Google Cloud OAuth app with gmail.send scope (see README)." },
  { id: "microsoft", label: "Microsoft 365 (OAuth)", icon: Mail, blurb: "Requires an Entra ID app with Mail.Send permission (see README)." },
  { id: "sandbox", label: "Sandbox", icon: FlaskConical, blurb: "Records emails as sent without delivering. For testing the workflow." },
];

interface Row { account: PublicSendingAccount; sentToday: number; effectiveLimit: number }

export function AccountsClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, element } = useConfirm();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>, msg?: string) => {
    setBusy(key);
    try {
      await fn();
      if (msg) toast.success(msg);
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {element}
      <Card>
        <CardHeader title="Sending accounts" description="Emails go out from your own mailbox or provider. Limits apply per account and across the workspace." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Connect account</Button>} />
        {rows.length === 0 ? (
          <EmptyState icon={<PlugZap className="h-5 w-5" />} title="No sending account" description="Connect SMTP or Resend to send approved emails — or add a sandbox to test." action={<Button onClick={() => setOpen(true)}>Connect account</Button>} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map(({ account: a, sentToday, effectiveLimit }) => {
              const p = PROVIDERS.find((x) => x.id === a.provider)!;
              const pct = Math.min(100, Math.round((sentToday / effectiveLimit) * 100));
              return (
                <li key={a.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600"><p.icon className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.label}</span>
                        <Badge tone={a.status === "active" ? "green" : a.status === "paused" ? "amber" : "red"} dot>{a.status === "needs_auth" ? "Needs connection" : a.status}</Badge>
                        {a.provider === "sandbox" && <Badge tone="amber">No real delivery</Badge>}
                      </div>
                      <div className="text-[13px] text-zinc-500">{a.from_name ? `${a.from_name} · ` : ""}{a.from_email} · {p.label}</div>
                      {a.last_error && <div className="mt-1 text-xs text-red-600">Last error: {a.last_error}</div>}
                    </div>
                  </div>
                  <div className="w-full lg:w-56">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Today {sentToday}/{effectiveLimit}</span>
                      <span>{a.per_minute_limit}/min{a.warmup_enabled && effectiveLimit < a.daily_limit ? " · warming up" : ""}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className={cn("h-full rounded-full", pct >= 100 ? "bg-amber-500" : "bg-brand-500")} style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" loading={busy === `t${a.id}`} onClick={() => act(`t${a.id}`, async () => {
                      const r = await api<{ ok: boolean; error?: string }>(`/api/sending-accounts/${a.id}/test`, { method: "POST" });
                      if (!r.ok) throw new Error(r.error ?? "Connection failed");
                    }, "Connection OK")}>Test</Button>
                    {a.status !== "needs_auth" && (
                      <Button size="sm" variant="secondary" loading={busy === `p${a.id}`} onClick={() => act(`p${a.id}`, () => api(`/api/sending-accounts/${a.id}`, { method: "PATCH", body: { status: a.status === "paused" ? "active" : "paused" } }), a.status === "paused" ? "Account resumed" : "Account paused")}>
                        {a.status === "paused" ? <><Play className="h-3.5 w-3.5" /> Resume</> : <><Pause className="h-3.5 w-3.5" /> Pause</>}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" aria-label="Remove account" onClick={async () => {
                      if (await confirm({ title: `Remove ${a.label}?`, body: "Stored credentials are deleted. Sent history is kept.", confirmLabel: "Remove", danger: true })) {
                        await act(`d${a.id}`, () => api(`/api/sending-accounts/${a.id}`, { method: "DELETE" }), "Account removed");
                      }
                    }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Deliverability & compliance" />
        <CardBody className="grid gap-4 text-[13px] text-zinc-600 md:grid-cols-3">
          <div><div className="font-medium text-zinc-800">Authenticate your domain</div>Set up SPF, DKIM and DMARC for the From domain, or providers will reject or junk your mail.</div>
          <div><div className="font-medium text-zinc-800">Warm up slowly</div>New accounts start at 5 emails/day and add 3/day until your limit. Keep per-minute sending low.</div>
          <div><div className="font-medium text-zinc-800">Automatic protection</div>One-click unsubscribe headers, suppression checks, duplicate prevention and bounce handling on every send.</div>
        </CardBody>
      </Card>

      <ConnectDialog open={open} onClose={() => setOpen(false)} onDone={() => { setOpen(false); router.refresh(); }} />
    </div>
  );
}

function ConnectDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [provider, setProvider] = useState<EmailProvider>("smtp");
  const [f, setF] = useState({ label: "", from_email: "", from_name: "", host: "", port: "587", secure: false, username: "", password: "", api_key: "", daily_limit: "30", per_minute_limit: "2", warmup_enabled: true });
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const oauth = provider === "gmail" || provider === "microsoft";

  const submit = async () => {
    setLoading(true);
    try {
      const base = { provider, label: f.label || f.from_email, from_email: f.from_email, from_name: f.from_name, daily_limit: f.daily_limit, per_minute_limit: f.per_minute_limit, warmup_enabled: f.warmup_enabled };
      const body = provider === "smtp" ? { ...base, host: f.host, port: f.port, secure: f.secure, username: f.username, password: f.password } : provider === "resend" ? { ...base, api_key: f.api_key } : base;
      await api("/api/sending-accounts", { body });
      toast.success(oauth ? "Account added — finish OAuth setup to activate it" : "Account connected. Use “Test” to verify it.");
      onDone();
    } catch (e) {
      toast.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Connect a sending account" size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={loading}>Connect</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <button key={p.id} type="button" onClick={() => setProvider(p.id)} className={cn("rounded-lg border p-3 text-left", provider === p.id ? "border-brand-400 bg-brand-50/50 ring-1 ring-brand-400" : "border-zinc-200 hover:border-zinc-300")}>
              <div className="flex items-center gap-2 text-sm font-medium"><p.icon className="h-4 w-4 text-zinc-500" /> {p.label}</div>
              <div className="mt-1 text-xs text-zinc-500">{p.blurb}</div>
            </button>
          ))}
        </div>
        {oauth && (
          <Notice tone="amber" icon={<KeyRound className="h-4 w-4" />} title="OAuth not configured yet">
            The account will be saved as “Needs connection” and can&apos;t send until OAuth is set up. Meanwhile you can connect the same mailbox via SMTP with an app password.
          </Notice>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From email" required><Input type="email" value={f.from_email} onChange={set("from_email")} placeholder="you@yourdomain.com" /></Field>
          <Field label="From name"><Input value={f.from_name} onChange={set("from_name")} placeholder="Alex Morgan" /></Field>
          <Field label="Label" className="sm:col-span-2"><Input value={f.label} onChange={set("label")} placeholder="Work mailbox" /></Field>
          {provider === "smtp" && (
            <>
              <Field label="SMTP host" required><Input value={f.host} onChange={set("host")} placeholder="smtp.gmail.com" /></Field>
              <Field label="Port"><Input value={f.port} onChange={set("port")} inputMode="numeric" /></Field>
              <Field label="Username" required><Input value={f.username} onChange={set("username")} autoComplete="off" /></Field>
              <Field label="Password / app password" required hint="Encrypted at rest (AES-256-GCM)."><Input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" /></Field>
              <Checkbox className="sm:col-span-2" checked={f.secure} onChange={set("secure")} label="Use implicit TLS (port 465)" description="Leave off for STARTTLS on port 587." />
            </>
          )}
          {provider === "resend" && (
            <Field label="Resend API key" required className="sm:col-span-2" hint="Encrypted at rest. Verify your domain in Resend first.">
              <Input type="password" value={f.api_key} onChange={set("api_key")} autoComplete="off" placeholder="re_…" />
            </Field>
          )}
          <Field label="Daily limit" hint="Hard cap per day for this account."><Input value={f.daily_limit} onChange={set("daily_limit")} inputMode="numeric" /></Field>
          <Field label="Per-minute limit"><Input value={f.per_minute_limit} onChange={set("per_minute_limit")} inputMode="numeric" /></Field>
          <Checkbox className="sm:col-span-2" checked={f.warmup_enabled} onChange={set("warmup_enabled")} label="Warm-up ramp" description="Start at 5/day and increase by 3/day until the daily limit." />
        </div>
      </div>
    </Dialog>
  );
}
