import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { getGoogleAuthUrl } from "@/lib/google/calendar";

function getRedirectUri(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  return `${base}/api/auth/google/callback`;
}

/**
 * GET /api/auth/google/connect
 * Redirects the logged-in user to Google's OAuth consent screen. A random
 * CSRF token is stamped in an httpOnly cookie and echoed back as `state` —
 * verified in the callback before we trust the redirect.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const state = crypto.randomUUID();
  const authUrl = getGoogleAuthUrl(state, getRedirectUri(req));

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes — plenty for the consent-screen round trip
    path: "/",
  });
  return res;
});
