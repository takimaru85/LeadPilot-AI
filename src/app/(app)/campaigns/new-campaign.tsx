"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import type { Campaign } from "@/lib/types";

type Opt = { id: string; name: string };

export function CampaignForm({ products, icps, accounts, initial, onSubmit, submitLabel, loading }: {
  products: Opt[]; icps: Opt[]; accounts: Opt[];
  initial?: Partial<Campaign>;
  onSubmit: (v: Record<string, string | null>) => void;
  submitLabel: string;
  loading: boolean;
}) {
  const [v, setV] = useState({
    name: initial?.name ?? "",
    audience: initial?.audience ?? "",
    description: initial?.description ?? "",
    product_id: initial?.product_id ?? products[0]?.id ?? "",
    icp_id: initial?.icp_id ?? icps[0]?.id ?? "",
    sending_account_id: initial?.sending_account_id ?? accounts[0]?.id ?? "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...v, product_id: v.product_id || null, icp_id: v.icp_id || null, sending_account_id: v.sending_account_id || null });
      }}
      className="grid gap-4"
    >
      <Field label="Campaign name" required><Input value={v.name} onChange={set("name")} placeholder="WordPress Website Outreach" required /></Field>
      <Field label="Audience"><Input value={v.audience} onChange={set("audience")} placeholder="Dental clinics in Australia" /></Field>
      <Field label="Goal / notes"><Textarea rows={2} value={v.description} onChange={set("description")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product">
          <Select value={v.product_id} onChange={set("product_id")}><option value="">None</option>{products.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
        </Field>
        <Field label="Ideal customer profile">
          <Select value={v.icp_id} onChange={set("icp_id")}><option value="">None</option>{icps.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
        </Field>
      </div>
      <Field label="Send from" hint="Falls back to your first active account.">
        <Select value={v.sending_account_id} onChange={set("sending_account_id")}><option value="">Default account</option>{accounts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
      </Field>
      <div className="flex justify-end pt-2"><Button type="submit" loading={loading}>{submitLabel}</Button></div>
    </form>
  );
}

export function NewCampaignButton(props: { products: Opt[]; icps: Opt[]; accounts: Opt[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New campaign</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New campaign" description="Campaigns start as drafts. Starting one never sends email by itself.">
        <CampaignForm
          {...props}
          submitLabel="Create campaign"
          loading={loading}
          onSubmit={async (body) => {
            setLoading(true);
            try {
              const c = await api<Campaign>("/api/campaigns", { body });
              toast.success("Campaign created");
              setOpen(false);
              router.push(`/campaigns/${c.id}`);
            } catch (e) {
              toast.error(e);
            } finally {
              setLoading(false);
            }
          }}
        />
      </Dialog>
    </>
  );
}
