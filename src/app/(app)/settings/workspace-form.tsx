"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import type { Workspace } from "@/lib/types";

export function WorkspaceForm({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({
    name: workspace.name,
    sender_name: workspace.sender_name,
    sender_title: workspace.sender_title,
    sender_company: workspace.sender_company,
    website: workspace.website,
    reply_to: workspace.reply_to,
    postal_address: workspace.postal_address,
    daily_send_cap: String(workspace.daily_send_cap),
    dedupe_window_days: String(workspace.dedupe_window_days),
    role_emails_only: workspace.role_emails_only,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/workspace", { method: "PATCH", body: f });
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <Card>
        <CardHeader title="Sender identity" description="Used in every email signature and footer." />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Workspace name"><Input value={f.name} onChange={set("name")} required /></Field>
          <Field label="Your name"><Input value={f.sender_name} onChange={set("sender_name")} /></Field>
          <Field label="Your title"><Input value={f.sender_title} onChange={set("sender_title")} placeholder="Founder" /></Field>
          <Field label="Company"><Input value={f.sender_company} onChange={set("sender_company")} /></Field>
          <Field label="Website"><Input value={f.website} onChange={set("website")} placeholder="https://yourcompany.com" /></Field>
          <Field label="Reply-to address" hint="Where replies (and manual unsubscribe requests) go."><Input type="email" value={f.reply_to} onChange={set("reply_to")} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Compliance" description="Defaults that protect your recipients and your sending reputation." />
        <CardBody className="space-y-4">
          <Field label="Business postal address" required hint="Required by anti-spam laws (CAN-SPAM, Spam Act, PECR). Emails can't be sent without it.">
            <Textarea rows={2} value={f.postal_address} onChange={set("postal_address")} placeholder="Street, city, postcode, country" />
          </Field>
          {!f.postal_address.trim() && <Notice tone="amber">Add a postal address to enable sending.</Notice>}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Workspace daily send cap" hint="Across all accounts. 1–500."><Input value={f.daily_send_cap} onChange={set("daily_send_cap")} inputMode="numeric" /></Field>
            <Field label="Duplicate window (days)" hint="Don't email the same company again within this period."><Input value={f.dedupe_window_days} onChange={set("dedupe_window_days")} inputMode="numeric" /></Field>
          </div>
          <Checkbox
            checked={f.role_emails_only}
            onChange={set("role_emails_only")}
            label="Only email role addresses (info@, hello@, reception@…)"
            description="Recommended. Named personal addresses need a stronger lawful basis in many countries (e.g. GDPR/PECR, Australia's inferred-consent rules)."
          />
        </CardBody>
        <div className="flex justify-end border-t border-zinc-100 px-5 py-3">
          <Button type="submit" loading={saving}>Save settings</Button>
        </div>
      </Card>
    </form>
  );
}

export function DemoReset() {
  const router = useRouter();
  const toast = useToast();
  const { confirm, element } = useConfirm();
  const [loading, setLoading] = useState(false);
  return (
    <Card>
      {element}
      <CardHeader title="Demo workspace" description="Wipe your changes and restore the sample data." />
      <CardBody>
        <Button
          variant="secondary"
          loading={loading}
          onClick={async () => {
            if (!(await confirm({ title: "Reset demo data?", body: "All demo leads, drafts and history return to the original sample.", confirmLabel: "Reset", danger: true }))) return;
            setLoading(true);
            try {
              await api("/api/demo/reset", { method: "POST" });
              toast.success("Demo data reset");
              router.push("/dashboard");
              router.refresh();
            } catch (e) {
              toast.error(e);
            } finally {
              setLoading(false);
            }
          }}
        >
          <RotateCcw className="h-4 w-4" /> Reset demo data
        </Button>
      </CardBody>
    </Card>
  );
}
