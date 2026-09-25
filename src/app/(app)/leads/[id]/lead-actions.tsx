"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, FolderPlus, Globe, Mail, MessageSquareReply, MoreHorizontal, Pencil, Sparkles, ThumbsUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import type { Lead } from "@/lib/types";

type LeadLite = Pick<Lead, "id" | "company_name" | "status" | "website" | "email" | "contact_name" | "contact_title" | "consent_basis">;

export function LeadActions({ lead, hasQualification, hasSent, campaigns }: { lead: LeadLite; hasQualification: boolean; hasSent: boolean; campaigns: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, element } = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [form, setForm] = useState({ email: lead.email ?? "", contact_name: lead.contact_name ?? "", contact_title: lead.contact_title ?? "", website: lead.website ?? "", consent_basis: lead.consent_basis });
  const dnc = lead.status === "do_not_contact";

  const run = async (name: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(name);
    try {
      await fn();
      toast.success(success);
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const logEvent = async (type: "replied" | "positive_reply" | "meeting_booked", label: string) => {
    const ok = await confirm({ title: `Log ${label}?`, body: `Records ${label} from ${lead.company_name} for reporting.`, confirmLabel: "Log it" });
    if (ok) await run(type, () => api(`/api/leads/${lead.id}/events`, { body: { type } }), `Logged ${label}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {element}
      <Button variant="secondary" onClick={() => run("enrich", () => api(`/api/leads/${lead.id}/enrich`, { method: "POST" }).then((r) => {
        const res = (r as { result: { ok: boolean; reason?: string } }).result;
        if (!res.ok) throw new Error(res.reason);
      }), "Website checked")} loading={busy === "enrich"} disabled={!lead.website}>
        <Globe className="h-4 w-4" /> Check website
      </Button>
      <Button variant="secondary" onClick={() => run("qualify", () => api(`/api/leads/${lead.id}/qualify`, { method: "POST" }), "Lead qualified")} loading={busy === "qualify"}>
        <Sparkles className="h-4 w-4" /> {hasQualification ? "Re-qualify" : "Qualify"}
      </Button>
      <Button onClick={() => run("drafts", () => api(`/api/leads/${lead.id}/drafts`, { method: "POST" }), "Drafts ready for review")} loading={busy === "drafts"} disabled={dnc}>
        <Mail className="h-4 w-4" /> Generate email
      </Button>
      <Menu
        trigger={(p) => <Button {...p} variant="secondary" size="icon" className="h-9 w-9" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>}
        items={[
          { label: "Edit contact details", icon: <Pencil />, onSelect: () => setEditOpen(true) },
          { label: "Add to campaign", icon: <FolderPlus />, onSelect: () => setCampaignOpen(true), disabled: !campaigns.length },
          { label: "Log reply", icon: <MessageSquareReply />, onSelect: () => logEvent("replied", "a reply"), disabled: !hasSent },
          { label: "Log positive reply", icon: <ThumbsUp />, onSelect: () => logEvent("positive_reply", "a positive reply"), disabled: !hasSent },
          { label: "Log meeting booked", icon: <CalendarCheck />, onSelect: () => logEvent("meeting_booked", "a booked meeting"), disabled: !hasSent },
          {
            label: "Delete lead", icon: <Trash2 />, danger: true,
            onSelect: async () => {
              if (await confirm({ title: `Delete ${lead.company_name}?`, body: "Removes the lead, its drafts and history. Suppressions are kept.", confirmLabel: "Delete", danger: true })) {
                await run("delete", () => api(`/api/leads/${lead.id}`, { method: "DELETE" }), "Lead deleted");
                router.push("/leads");
              }
            },
          },
        ]}
      />

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit contact details"
        description="Only enter details the business published or gave you. Never guess an email address."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button loading={busy === "edit"} onClick={() => run("edit", () => api(`/api/leads/${lead.id}`, { method: "PATCH", body: form }), "Lead updated").then(() => setEditOpen(false))}>Save</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Business email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name"><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
            <Field label="Job title"><Input value={form.contact_title} onChange={(e) => setForm({ ...form, contact_title: e.target.value })} /></Field>
          </div>
          <Field label="Website"><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label="Basis for contact">
            <Select value={form.consent_basis} onChange={(e) => setForm({ ...form, consent_basis: e.target.value as Lead["consent_basis"] })}>
              <option value="conspicuous_publication">Address published by the business</option>
              <option value="legitimate_interest">Legitimate interest (B2B)</option>
              <option value="existing_relationship">Existing relationship</option>
              <option value="consent">Consent</option>
              <option value="unknown">Not recorded</option>
            </Select>
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        title="Add to campaign"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCampaignOpen(false)}>Cancel</Button>
            <Button loading={busy === "campaign"} onClick={() => run("campaign", () => api(`/api/campaigns/${campaignId}/leads`, { body: { lead_ids: [lead.id] } }), "Added to campaign").then(() => setCampaignOpen(false))}>Add</Button>
          </>
        }
      >
        <Field label="Campaign">
          <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      </Dialog>
    </div>
  );
}
