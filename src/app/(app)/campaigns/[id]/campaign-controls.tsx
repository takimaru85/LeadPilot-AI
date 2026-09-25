"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck, Mail, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import type { Campaign, CampaignStatus } from "@/lib/types";
import { CampaignForm } from "../new-campaign";

type Opt = { id: string; name: string };

export function CampaignControls({ campaign, readyForReview, products, icps, accounts }: { campaign: Campaign; readyForReview: number; products: Opt[]; icps: Opt[]; accounts: Opt[] }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, element } = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const setStatus = async (status: CampaignStatus, label: string) => {
    if (status === "completed" && !(await confirm({ title: "Mark campaign completed?", body: "Completed campaigns can't be restarted, and their drafts can no longer be sent.", confirmLabel: "Complete" }))) return;
    setBusy(status);
    try {
      await api(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: { status } });
      toast.success(label);
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {element}
      {readyForReview > 0 && campaign.status === "running" && <ButtonLink href="/email"><Mail className="h-4 w-4" /> Review {readyForReview}</ButtonLink>}
      {campaign.status === "draft" && <Button onClick={() => setStatus("running", "Campaign started — drafts in it can now be approved")} loading={busy === "running"}><Play className="h-4 w-4" /> Start</Button>}
      {campaign.status === "running" && <Button variant="secondary" onClick={() => setStatus("paused", "Campaign paused — queued emails are held")} loading={busy === "paused"}><Pause className="h-4 w-4" /> Pause</Button>}
      {campaign.status === "paused" && <Button onClick={() => setStatus("running", "Campaign resumed")} loading={busy === "running"}><Play className="h-4 w-4" /> Resume</Button>}
      {campaign.status !== "completed" && <Button variant="secondary" onClick={() => setStatus("completed", "Campaign completed")} loading={busy === "completed"}><CheckCheck className="h-4 w-4" /> Complete</Button>}
      <Button variant="secondary" size="icon" className="h-9 w-9" onClick={() => setEditing(true)} aria-label="Edit campaign"><Pencil className="h-4 w-4" /></Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="Delete campaign"
        onClick={async () => {
          if (!(await confirm({ title: "Delete campaign?", body: "Leads stay in your lead list. Campaigns with sent email can't be deleted.", confirmLabel: "Delete", danger: true }))) return;
          try {
            await api(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
            toast.success("Campaign deleted");
            router.push("/campaigns");
          } catch (e) {
            toast.error(e);
          }
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit campaign">
        <CampaignForm
          products={products}
          icps={icps}
          accounts={accounts}
          initial={campaign}
          submitLabel="Save changes"
          loading={busy === "edit"}
          onSubmit={async (body) => {
            setBusy("edit");
            try {
              await api(`/api/campaigns/${campaign.id}`, { method: "PATCH", body });
              toast.success("Campaign updated");
              setEditing(false);
              router.refresh();
            } catch (e) {
              toast.error(e);
            } finally {
              setBusy(null);
            }
          }}
        />
      </Dialog>
    </div>
  );
}
