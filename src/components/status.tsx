import type { CampaignStatus, DraftStatus, Fit, LeadStatus, MessageStatus } from "@/lib/types";
import { Badge, type Tone } from "./ui/primitives";

const LEAD: Record<LeadStatus, [string, Tone]> = {
  new: ["New", "neutral"],
  qualified: ["Qualified", "brand"],
  disqualified: ["Not a fit", "neutral"],
  draft_ready: ["Draft ready", "violet"],
  approved: ["Approved", "blue"],
  contacted: ["Contacted", "blue"],
  replied: ["Replied", "green"],
  meeting: ["Meeting", "green"],
  skipped: ["Skipped", "neutral"],
  do_not_contact: ["Do not contact", "red"],
};
export const leadStatusLabel = (s: LeadStatus) => LEAD[s][0];

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const [label, tone] = LEAD[status];
  return <Badge tone={tone} dot>{label}</Badge>;
}

const FIT: Record<Fit, [string, Tone]> = { strong: ["Strong fit", "green"], moderate: ["Moderate fit", "brand"], weak: ["Weak fit", "amber"], none: ["Not a fit", "neutral"] };
export function FitBadge({ fit }: { fit: Fit | null }) {
  if (!fit) return <Badge>Not qualified</Badge>;
  const [label, tone] = FIT[fit];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-zinc-400">—</span>;
  const color = score >= 75 ? "bg-emerald-500" : score >= 55 ? "bg-brand-500" : score >= 35 ? "bg-amber-400" : "bg-zinc-300";
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-zinc-100">
        <span className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </span>
      <span className="text-[13px] font-medium text-zinc-700">{score}</span>
    </span>
  );
}

const CAMPAIGN: Record<CampaignStatus, Tone> = { draft: "neutral", running: "green", paused: "amber", completed: "blue" };
export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge tone={CAMPAIGN[status]} dot>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}

const MSG: Record<MessageStatus, Tone> = { queued: "amber", sending: "blue", sent: "green", failed: "red", blocked: "red" };
export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  return <Badge tone={MSG[status]} dot>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}

const DRAFT: Record<DraftStatus, Tone> = { draft: "violet", approved: "blue", skipped: "neutral", sent: "green", failed: "red", blocked: "red" };
export function DraftStatusBadge({ status }: { status: DraftStatus }) {
  return <Badge tone={DRAFT[status]}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}

export function ModelBadge({ model }: { model: string }) {
  return model === "demo-heuristic" ? <Badge tone="amber">Demo heuristics</Badge> : <Badge tone="violet">AI · {model}</Badge>;
}
