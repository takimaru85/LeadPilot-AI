"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";

/** Processes due queued emails now (production uses Vercel Cron for this). */
export function ProcessQueueButton() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const r = await api<{ processed: number; results: { outcome: string; note: string | null }[] }>("/api/outbox/process", { method: "POST" });
          if (!r.processed) toast.info("Nothing is due yet", ["Queued emails are waiting for a sending limit or retry window."]);
          else toast.success(`Processed ${r.processed} email(s)`, r.results.map((x) => `${x.outcome}${x.note ? ` — ${x.note}` : ""}`));
          router.refresh();
        } catch (e) {
          toast.error(e);
        } finally {
          setLoading(false);
        }
      }}
    >
      <RefreshCw className="h-3.5 w-3.5" /> Process due emails
    </Button>
  );
}
