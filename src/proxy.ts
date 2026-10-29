import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "session"; // same as src/lib/auth.ts, kept here so the proxy stays database-free

// Optimistic check only (no database): sends visitors without a session cookie to /login.
// Pages and API routes validate the session itself through currentUser().
// Public pages: /privacidade must be reachable without login (Meta links to it).
const PUBLIC_PATHS = new Set(["/login", "/privacidade"]);

export function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (!request.cookies.has(SESSION_COOKIE) && !isApi && !PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // API routes answer 401 themselves; cron and OAuth callback have their own checks.
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/instagram/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
