import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/auth/session";
import { supabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (supabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.delete(DEMO_COOKIE);
  return res;
}
