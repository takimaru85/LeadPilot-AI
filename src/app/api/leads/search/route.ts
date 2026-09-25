import { fail, ok, parseJson, RATE, withAuth } from "@/lib/api";
import { getProvider, ProviderError } from "@/lib/leads/providers";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { addLeads } from "@/lib/services/leads";
import { SearchInput } from "@/lib/validation";

export const maxDuration = 60;

/** Discover public business listings and add new ones as leads (deduplicated by domain). */
export const POST = withAuth(
  async (req, ctx) => {
    const input = await parseJson(req, SearchInput);
    const provider = getProvider(input.provider);
    if (!provider) return fail(400, "That lead source isn't configured.");

    const search = await ctx.store.insert("lead_searches", {
      icp_id: input.icp_id, provider: provider.id, query: input.query, location: input.location, status: "running",
    });
    try {
      const found = await provider.search({ query: input.query, location: input.location, limit: input.limit });
      const res = await addLeads(ctx, found, { icpId: input.icp_id, searchId: search.id });
      await ctx.store.update("lead_searches", search.id, { status: "completed", result_count: found.length, added_count: res.added.length });
      await recordAudit(ctx.store, actorOf(ctx), {
        action: "leads.search",
        summary: `Searched “${input.query}”${input.location ? ` in ${input.location}` : ""} via ${provider.label} — ${res.added.length} added, ${res.duplicates.length} duplicates`,
        entityType: "lead_search", entityId: search.id, metadata: { provider: provider.id },
      });
      return ok({ search_id: search.id, found: found.length, added: res.added, duplicates: res.duplicates, suppressed: res.suppressed });
    } catch (e) {
      const message = e instanceof ProviderError ? e.message : "The lead source failed. Please try again.";
      await ctx.store.update("lead_searches", search.id, { status: "failed", error: message });
      if (!(e instanceof ProviderError)) console.error("[search]", e);
      return fail(502, message);
    }
  },
  { rate: RATE.search },
);
