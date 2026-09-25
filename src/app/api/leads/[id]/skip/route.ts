import { ok, withAuth } from "@/lib/api";
import { skipLead } from "@/lib/services/leads";

export const POST = withAuth<RouteContext<"/api/leads/[id]/skip">>(async (_req, ctx, route) => {
  const { id } = await route.params;
  return ok(await skipLead(ctx, id));
});
