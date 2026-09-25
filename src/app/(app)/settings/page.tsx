import { CheckCircle2, CircleDashed } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/auth/session";
import { aiConfigured, env, supabaseConfigured } from "@/lib/env";
import { DemoReset, WorkspaceForm } from "./workspace-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { workspace, demo } = await requireContext();
  const integrations = [
    { name: "Database & auth (Supabase)", ok: supabaseConfigured, detail: supabaseConfigured ? "Connected" : "Demo store in use — set NEXT_PUBLIC_SUPABASE_URL / ANON_KEY" },
    { name: "AI (Claude)", ok: aiConfigured, detail: aiConfigured ? `Model ${env.anthropicModel}` : "Demo heuristics — set ANTHROPIC_API_KEY" },
    { name: "Lead source: Google Places", ok: Boolean(env.googlePlacesApiKey), detail: env.googlePlacesApiKey ? "Enabled" : "Set GOOGLE_PLACES_API_KEY" },
    { name: "Background worker (Vercel Cron)", ok: Boolean(env.cronSecret), detail: env.cronSecret ? "Protected by CRON_SECRET" : "Set CRON_SECRET to process queued emails" },
    { name: "Resend webhooks (bounces & complaints)", ok: Boolean(env.resendWebhookSecret), detail: env.resendWebhookSecret ? "Signature verified" : "Set RESEND_WEBHOOK_SECRET" },
    { name: "Background jobs & unsubscribe (service role)", ok: !supabaseConfigured || Boolean(env.supabaseServiceRoleKey), detail: supabaseConfigured ? (env.supabaseServiceRoleKey ? "Configured" : "Set SUPABASE_SERVICE_ROLE_KEY") : "Demo store" },
  ];
  return (
    <>
      <PageHeader title="Settings" description="Sender identity, compliance defaults and integrations." actions={<ButtonLink href="/settings/audit" variant="secondary">Audit log</ButtonLink>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <WorkspaceForm workspace={workspace} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Integrations" description="Configured with environment variables." />
            <ul className="divide-y divide-zinc-100">
              {integrations.map((i) => (
                <li key={i.name} className="flex gap-3 px-5 py-3">
                  {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />}
                  <div>
                    <div className="text-[13px] font-medium text-zinc-800">{i.name}</div>
                    <div className="text-xs text-zinc-500">{i.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
            <CardBody className="border-t border-zinc-100 text-xs text-zinc-500">Sending accounts are managed under <a className="text-brand-700 hover:underline" href="/email/accounts">Email → Sending accounts</a>. Product &amp; ICP under <a className="text-brand-700 hover:underline" href="/setup">Product &amp; ICP</a>.</CardBody>
          </Card>
          {demo && <DemoReset />}
        </div>
      </div>
    </>
  );
}
