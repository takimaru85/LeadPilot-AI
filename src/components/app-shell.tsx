"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, FlaskConical, LayoutDashboard, LogOut, Mail, Megaphone, Menu as MenuIcon, Search, Settings, Sparkles, Target, Users, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Menu } from "@/components/ui/menu";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/find-leads", label: "Find Leads", icon: Search },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/email", label: "Email", icon: Mail, badgeKey: "review" as const },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export interface ShellInfo {
  workspaceName: string;
  userName: string;
  userEmail: string;
  demo: boolean;
  aiMode: "claude" | "heuristic";
  aiModel: string;
  reviewCount: number;
  setupIncomplete: boolean;
}

function NavLinks({ info, onNavigate }: { info: ShellInfo; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "focus-ring group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(item.href) ? "bg-white text-zinc-900 shadow-card ring-1 ring-zinc-200/80" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
          )}
        >
          <item.icon className={cn("h-4 w-4", isActive(item.href) ? "text-brand-600" : "text-zinc-400 group-hover:text-zinc-600")} />
          {item.label}
          {item.badgeKey === "review" && info.reviewCount > 0 && (
            <span className="ml-auto rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white tabular-nums">{info.reviewCount}</span>
          )}
        </Link>
      ))}
      <div className="mt-4 border-t border-zinc-200/70 pt-4">
        <Link
          href="/setup"
          onClick={onNavigate}
          className={cn(
            "focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
            isActive("/setup") ? "bg-white text-zinc-900 shadow-card ring-1 ring-zinc-200/80" : "text-zinc-600 hover:bg-zinc-100",
          )}
        >
          <Target className="h-4 w-4 text-zinc-400" />
          Product &amp; ICP
          {info.setupIncomplete && <span className="ml-auto h-2 w-2 rounded-full bg-amber-400" title="Setup incomplete" />}
        </Link>
      </div>
    </nav>
  );
}

export function AppShell({ info, children }: { info: ShellInfo; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const signOut = async () => {
    await api("/api/auth/signout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  const sidebar = (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="mb-6 flex items-center justify-between px-2">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <button className="rounded-md p-1 text-zinc-500 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <NavLinks info={info} onNavigate={() => setOpen(false)} />
      <div className="mt-auto space-y-2 px-1 pt-6">
        <div className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2.5 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5 font-medium text-zinc-700">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            {info.aiMode === "claude" ? "Claude connected" : "AI: demo heuristics"}
          </div>
          <div className="mt-0.5 truncate">{info.aiMode === "claude" ? info.aiModel : "Add ANTHROPIC_API_KEY for real AI"}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-zinc-200/70 bg-zinc-50 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-zinc-900/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-zinc-50 shadow-pop">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-zinc-200/70 bg-white/85 px-4 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <MenuIcon className="h-5 w-5" />
            </button>
            <span className="truncate text-sm font-medium text-zinc-700">{info.workspaceName}</span>
            {info.demo && (
              <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 sm:inline-flex">
                <FlaskConical className="h-3 w-3" /> Demo data · emails are sandboxed
              </span>
            )}
          </div>
          <Menu
            trigger={(p) => (
              <button {...p} className="focus-ring flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-100">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                  {info.userName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-sm text-zinc-700 sm:block">{info.userName}</span>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>
            )}
            items={[
              { label: <span className="text-xs text-zinc-500">{info.userEmail}</span>, onSelect: () => undefined, disabled: true },
              { label: "Settings", icon: <Settings />, onSelect: () => router.push("/settings") },
              { label: "Sign out", icon: <LogOut />, onSelect: signOut },
            ]}
          />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
