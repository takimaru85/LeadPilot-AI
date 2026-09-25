import { ok, parseJson, withAuth } from "@/lib/api";
import { editDraft } from "@/lib/services/leads";
import { DraftEdit } from "@/lib/validation";

export const PATCH = withAuth<RouteContext<"/api/drafts/[id]">>(async (req, ctx, route) => {
  const { id } = await route.params;
  return ok(await editDraft(ctx, id, await parseJson(req, DraftEdit)));
});
