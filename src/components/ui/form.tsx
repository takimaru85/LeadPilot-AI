"use client";
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "focus-ring block w-full rounded-lg border-0 bg-white px-3 text-sm text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 transition focus:ring-2 focus:ring-brand-500 disabled:bg-zinc-50 disabled:text-zinc-500 aria-[invalid=true]:ring-red-300";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-9", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "py-2 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, "h-9 pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export function Field({ label, hint, error, children, className, htmlFor, required }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; className?: string; htmlFor?: string; required?: boolean }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, description, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 accent-brand-600 focus:ring-brand-500" {...props} />
      <label htmlFor={id} className="text-sm leading-snug">
        <span className="font-medium text-zinc-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>}
      </label>
    </div>
  );
}

/** Chip-style list input for ICP fields: Enter or comma adds, Backspace removes. */
export function ListInput({ value, onChange, placeholder, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (items.length) onChange([...new Set([...value, ...items])]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
  };
  const unused = suggestions.filter((s) => !value.includes(s));
  return (
    <div>
      <div className="focus-within:ring-brand-500 flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-zinc-200 ring-inset focus-within:ring-2">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 py-0.5 pr-1 pl-2 text-[13px] text-zinc-700">
            {v}
            <button type="button" className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 text-sm outline-none placeholder:text-zinc-400"
        />
      </div>
      {unused.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {unused.slice(0, 6).map((s) => (
            <button key={s} type="button" onClick={() => onChange([...value, s])} className="rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 hover:border-brand-300 hover:text-brand-700">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
