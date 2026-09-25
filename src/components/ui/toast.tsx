"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { ApiError } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  title: string;
  lines?: string[];
}

const Ctx = createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-3), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.kind === "error" ? 9000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto flex gap-3 rounded-xl border bg-white p-4 text-sm shadow-pop", t.kind === "error" ? "border-red-200" : "border-zinc-200")}>
            {t.kind === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : t.kind === "error" ? <AlertCircle className="h-5 w-5 shrink-0 text-red-500" /> : <Info className="h-5 w-5 shrink-0 text-brand-500" />}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-zinc-900">{t.title}</div>
              {t.lines?.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px] text-zinc-600">
                  {t.lines.slice(0, 5).map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} className="h-6 w-6 shrink-0 rounded text-zinc-400 hover:text-zinc-700" aria-label="Dismiss">
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return {
    success: (title: string, lines?: string[]) => ctx.push({ kind: "success", title, lines }),
    info: (title: string, lines?: string[]) => ctx.push({ kind: "info", title, lines }),
    error: (e: unknown, fallback = "Something went wrong") => {
      if (e instanceof ApiError) ctx.push({ kind: "error", title: e.message, lines: e.lines });
      else ctx.push({ kind: "error", title: e instanceof Error ? e.message : fallback });
    },
  };
}
