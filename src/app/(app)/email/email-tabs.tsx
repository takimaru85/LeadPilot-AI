"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/email", label: "Review queue" },
  { href: "/email/outbox", label: "Outbox" },
  { href: "/email/accounts", label: "Sending accounts" },
  { href: "/email/suppressions", label: "Suppression list" },
];

export function EmailTabs({ counts }: { counts: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto [scrollbar-width:none] border-b border-zinc-200" aria-label="Email sections">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap", active ? "border-brand-600 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800")}>
            {t.label}
            {counts[t.href] ? <span className="rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-600 tabular-nums">{counts[t.href]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
