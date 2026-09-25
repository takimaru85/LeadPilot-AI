import { redirect } from "next/navigation";
import Link from "next/link";
import { getContext } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  if (await getContext()) redirect("/dashboard");
  const demo = isDemoMode();
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-7 shadow-card">
        <LoginForm demo={demo} next={next} linkError={sp.error === "link"} />
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-zinc-500">
        By continuing you agree to use LeadPilot only for legitimate B2B outreach that respects anti-spam and privacy law.
      </p>
    </div>
  );
}
