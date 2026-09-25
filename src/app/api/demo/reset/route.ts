import { fail, ok, withAuth } from "@/lib/api";
import { resetDemoDb } from "@/lib/db/memory-store";
import { seedDemo } from "@/lib/demo/seed";

/** Demo only: wipe and re-seed the in-memory workspace. */
export const POST = withAuth(async (_req, ctx) => {
  if (!ctx.demo) return fail(404, "Not available.");
  await seedDemo(resetDemoDb());
  return ok({ reset: true });
});
