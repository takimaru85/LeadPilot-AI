import { ok, RATE, withAuth } from "@/lib/api";
import { enrichLead } from "@/lib/services/leads";

export const maxDuration = 60;

/** Check the company's public website (robots.txt respected) for a description and published business email. */
export const POST = withAuth<RouteContext<"/api/leads/[id]/enrich">>(
  async (_req, ctx, route) => {
    const { id } = await route.params;
    const { lead, result } = await enrichLead(ctx, id);
    return ok({ lead, result });
  },
  { rate: RATE.crawl },
);
