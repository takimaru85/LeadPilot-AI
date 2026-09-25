import { ok, parseJson, withAuth } from "@/lib/api";
import { actorOf, recordAudit } from "@/lib/services/audit";
import { WorkspacePatch } from "@/lib/validation";

export const GET = withAuth(async (_req, { workspace }) => ok(workspace));

export const PATCH = withAuth(async (req, ctx) => {
  const input = await parseJson(req, WorkspacePatch);
  const ws = await ctx.store.updateWorkspace(input);
  await recordAudit(ctx.store, actorOf(ctx), {
    action: "workspace.updated", summary: `Updated settings: ${Object.keys(input).join(", ")}`, entityType: "workspace", entityId: ws.id,
    metadata: { changes: input },
  });
  return ok(ws);
});
