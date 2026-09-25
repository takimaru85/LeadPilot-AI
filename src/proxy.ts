import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie and does an optimistic redirect for signed-out
 * visitors. Real authorisation happens in getContext() and Postgres RLS — this is UX only.
 */
const APP_PREFIXES = ["/dashboard", "/setup", "/find-leads", "/leads", "/campaigns", "/email", "/analytics", "/settings"];

export async function proxy(request: NextRequest) {
  const isApp = APP_PREFIXES.some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Demo mode: the signed cookie is verified server-side; here we only check presence.
    if (isApp && !request.cookies.get("lp_demo_session")) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (isApp && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|api/unsubscribe|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
