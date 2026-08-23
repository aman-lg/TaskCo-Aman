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
const AUTH_CALLBACK_PATHS = ["/auth/callback", "/auth/confirm"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });

  const { user } = await updateSession(request, response);

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthCallback = AUTH_CALLBACK_PATHS.some((p) => pathname.startsWith(p));

  if (isAuthCallback) return response;

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublic) {
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
