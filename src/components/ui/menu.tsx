"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Lightweight dropdown menu: click outside or Escape closes. */
export function Menu({ trigger, items, align = "right" }: { trigger: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode; items: MenuItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      {trigger({ onClick: () => setOpen((o) => !o), "aria-expanded": open })}
      {open && (
        <div role="menu" className={cn("absolute z-30 mt-1 min-w-[12rem] rounded-xl border border-zinc-200 bg-white p-1 shadow-pop", align === "right" ? "right-0" : "left-0")}>
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm disabled:opacity-40",
                it.danger ? "text-red-600 hover:bg-red-50" : "text-zinc-700 hover:bg-zinc-100",
              )}
            >
              {it.icon && <span className="text-zinc-400 [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
