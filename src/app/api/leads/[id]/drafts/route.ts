import { ok, RATE, withAuth } from "@/lib/api";
import { generateDrafts } from "@/lib/services/leads";

export const maxDuration = 120;

/** Generate (or regenerate) the three email variants for a lead. Replaces unsent drafts. */
export const POST = withAuth<RouteContext<"/api/leads/[id]/drafts">>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    return ok(await generateDrafts(ctx, id), { status: 201 });
  },
  { rate: RATE.ai },
);
