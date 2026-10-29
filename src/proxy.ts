import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie and sends logged-out visitors to /login.
// Public pages: /privacidade must be reachable without login (Meta links to it).
const PUBLIC_PATHS = new Set(["/login", "/privacidade"]);
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (!data.user && !isApi && !PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    // API routes answer 401 themselves; cron and OAuth callback have their own checks.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/instagram/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
