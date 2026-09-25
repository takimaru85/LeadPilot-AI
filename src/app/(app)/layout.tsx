import { AppShell } from "@/components/app-shell";
import { requireContext } from "@/lib/auth/session";
import { aiConfigured, env } from "@/lib/env";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireContext();
  const [reviewCount, products, icps, accounts] = await Promise.all([
    ctx.store.count("leads", { eq: { status: "draft_ready" } }),
    ctx.store.count("products"),
    ctx.store.count("icps"),
    ctx.store.count("sending_accounts"),
  ]);
  const ws = ctx.workspace;
  return (
    <AppShell
      info={{
        workspaceName: ws.name,
        userName: ctx.user.name,
        userEmail: ctx.user.email,
        demo: ctx.demo,
        aiMode: aiConfigured ? "claude" : "heuristic",
        aiModel: env.anthropicModel,
        reviewCount,
        setupIncomplete: !products || !icps || !accounts || !ws.postal_address,
      }}
    >
      {children}
    </AppShell>
  );
}
