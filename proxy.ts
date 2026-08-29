import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// /api/* is excluded from this middleware entirely (see matcher below) — every
// route handler already re-verifies the session itself via withAuth(), so
// running it here too was a second, wasted round trip to Supabase's Auth
// server on every single API call (mutations included). It was also actively
// wrong for API calls: this middleware's redirect-to-login response would get
// silently followed by fetch(), handing client code an HTML login page
// instead of the clean JSON 401 withAuth() returns. /book stays listed here
// only because it's a real page navigation route rendered by this app.
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/book"];
// Public no matter who's asking, and — unlike PUBLIC_PATHS — never bounces
// a logged-in visitor away. An auth page redirecting an already-logged-in
// user to /dashboard makes sense; a status page doing that wouldn't (you
// might check it specifically because you're logged in and something looks
// broken).
const ALWAYS_PUBLIC_PATHS = ["/status"];
const AUTH_CALLBACK_PATHS = ["/auth/callback", "/auth/confirm"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });

  const { user } = await updateSession(request, response);

  // "/" is the marketing homepage — public like the rest of PUBLIC_PATHS,
  // but checked with an exact match rather than startsWith(), which would
  // otherwise treat every path as public (everything starts with "/").
  const isHomepage = pathname === "/";
  const isAlwaysPublic = isHomepage || ALWAYS_PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPagePublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isPublic = isAlwaysPublic || isAuthPagePublic;
  const isAuthCallback = AUTH_CALLBACK_PATHS.some((p) => pathname.startsWith(p));

  if (isAuthCallback) return response;

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthPagePublic) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
