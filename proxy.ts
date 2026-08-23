import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// /book and /api/booking/ must stay public — the public booking page (and the
// availability/submission API routes it calls) is meant for unauthenticated
// visitors. Everything else under /api is still gated below. Note the trailing
// slash on /api/booking/ — without it this would also prefix-match the
// separate (host-only, authenticated) /api/bookings routes.
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/book", "/api/booking/"];
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
