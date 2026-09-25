"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  if (state === "done") {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="h-5 w-5" /> You&apos;ve been unsubscribed.
      </div>
    );
  }
  return (
    <>
      <Button
        className="mt-6 w-full"
        size="lg"
        loading={state === "loading"}
        onClick={async () => {
          setState("loading");
          const res = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
          setState(res?.ok ? "done" : "error");
        }}
      >
        Unsubscribe
      </Button>
      {state === "error" && <p className="mt-3 text-sm text-red-600">Something went wrong. Please reply to the email to be removed.</p>}
    </>
  );
}
