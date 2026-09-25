"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Accessible modal built on the native <dialog> element. */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-pop backdrop:bg-zinc-900/30 backdrop:backdrop-blur-[2px]",
        { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" }[size],
      )}
    >
      {open && (
        <div>
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
            </div>
            <button onClick={onClose} className="focus-ring rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          {children && <div className="px-6 py-4">{children}</div>}
          {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Confirmation dialog for irreversible actions. */
export function useConfirm() {
  const [state, setState] = useState<{ title: ReactNode; body?: ReactNode; confirmLabel: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
  const confirm = (opts: { title: ReactNode; body?: ReactNode; confirmLabel?: string; danger?: boolean }) =>
    new Promise<boolean>((resolve) => setState({ confirmLabel: "Confirm", ...opts, resolve }));
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const element = (
    <Dialog
      open={!!state}
      onClose={() => close(false)}
      title={state?.title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
            {state?.confirmLabel}
          </Button>
        </>
      }
    >
      {state?.body && <div className="text-sm text-zinc-600">{state.body}</div>}
    </Dialog>
  );
  return { confirm, element };
}
