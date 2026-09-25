import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-zinc-200/80 bg-white shadow-card", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export type Tone = "neutral" | "brand" | "green" | "amber" | "red" | "blue" | "violet";
const tones: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({ tone = "neutral", className, children, dot }: { tone?: Tone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] font-medium text-zinc-500">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between text-[13px] font-medium text-zinc-500">
        {label}
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>
      <div className="mt-2 text-[28px] leading-none font-semibold tracking-tight text-zinc-900 tabular-nums">{value}</div>
      {hint && <div className="mt-2 text-xs text-zinc-500">{hint}</div>}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Notice({ tone = "amber", title, children, className, icon }: { tone?: "amber" | "blue" | "red" | "green"; title?: ReactNode; children?: ReactNode; className?: string; icon?: ReactNode }) {
  const t = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    blue: "bg-sky-50 border-sky-200 text-sky-900",
    red: "bg-red-50 border-red-200 text-red-900",
    green: "bg-emerald-50 border-emerald-200 text-emerald-900",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", t, className)}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn("opacity-90", title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

/** Table styling shared across list views. */
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full text-left text-sm",
  thead: "border-b border-zinc-100 bg-zinc-50/60 text-[12px] font-medium tracking-wide text-zinc-500 uppercase",
  th: "px-4 py-2.5 font-medium whitespace-nowrap",
  tr: "border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60",
  td: "px-4 py-3 align-middle",
};
