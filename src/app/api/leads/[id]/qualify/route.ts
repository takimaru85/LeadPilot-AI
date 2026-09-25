import { ok, RATE, withAuth } from "@/lib/api";
import { qualify } from "@/lib/services/leads";

export const maxDuration = 120;

export const POST = withAuth<RouteContext<"/api/leads/[id]/qualify">>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    return ok(await qualify(ctx, id));
  },
  { rate: RATE.ai },
);
