"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client-api";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ demo, next, linkError }: { demo: boolean; next: string; linkError: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (demo) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Try LeadPilot</h1>
        <p className="mt-1 text-sm text-zinc-500">Supabase isn&apos;t configured, so the app is running with a local demo workspace full of fictional sample data.</p>
        <Notice tone="blue" className="mt-5" icon={<FlaskConical className="h-4 w-4" />}>
          Demo emails go to a sandbox — nothing is ever delivered. Add Supabase keys to <code className="text-xs">.env.local</code> for real accounts.
        </Notice>
        <Button
          className="mt-6 w-full"
          size="lg"
          loading={loading}
          onClick={async () => {
            setLoading(true);
            try {
              await api("/api/auth/demo", { method: "POST" });
              router.push(next);
              router.refresh();
            } catch (e) {
              toast.error(e);
              setLoading(false);
            }
          }}
        >
          Enter demo workspace
        </Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        setSent(true);
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data: { full_name: name } } });
        if (error) throw error;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      toast.error(err, "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Mail className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Check your email</h1>
        <p className="mt-1 text-sm text-zinc-500">We sent a link to {email}. Open it on this device to continue.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{mode === "signup" ? "Create your account" : "Sign in"}</h1>
        <p className="mt-1 text-sm text-zinc-500">{mode === "signup" ? "Start finding people who need your product." : "Welcome back."}</p>
      </div>
      {linkError && <Notice tone="red">That sign-in link is invalid or has expired. Please try again.</Notice>}
      {mode === "signup" && (
        <Field label="Your name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </Field>
      )}
      <Field label="Work email" htmlFor="email">
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </Field>
      {mode !== "magic" && (
        <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </Field>
      )}
      <Button type="submit" className="w-full" size="lg" loading={loading}>
        {mode === "signup" ? "Create account" : mode === "magic" ? "Email me a sign-in link" : "Sign in"}
      </Button>
      <div className="flex justify-between text-[13px]">
        <button type="button" className="text-brand-700 hover:underline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "I have an account" : "Create an account"}
        </button>
        {mode !== "signup" && (
          <button type="button" className="text-zinc-500 hover:text-zinc-800" onClick={() => setMode(mode === "magic" ? "signin" : "magic")}>
            {mode === "magic" ? "Use password" : "Email me a link instead"}
          </button>
        )}
      </div>
    </form>
  );
}
