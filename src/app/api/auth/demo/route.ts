import { NextResponse } from "next/server";
import { DEMO_COOKIE, demoSessionValue } from "@/lib/auth/session";
import { fail } from "@/lib/api";
import { isDemoMode } from "@/lib/env";

/** Demo sign-in: only exists when Supabase isn't configured. */
export async function POST() {
  if (!isDemoMode()) return fail(404, "Demo mode is disabled.");
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(DEMO_COOKIE, demoSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
