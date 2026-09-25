import { cn } from "@/lib/utils";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-zinc-900", className)}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 12l6 6L20 6" opacity=".35" />
          <path d="M12 3l8 9-8 9" />
        </svg>
      </span>
      {!compact && <span className="text-[15px]">LeadPilot<span className="text-brand-600"> AI</span></span>}
    </span>
  );
}
