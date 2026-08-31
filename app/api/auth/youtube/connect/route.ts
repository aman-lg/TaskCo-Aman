import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { getYoutubeAuthUrl } from "@/lib/google/youtube-connection";

function getRedirectUri(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  return `${base}/api/auth/youtube/callback`;
}

/**
 * GET /api/auth/youtube/connect
 * Admin-only (this is a shared, org-wide channel connection, not a personal
 * one like Calendar's). Redirects to Google's consent screen; a CSRF token
 * is stamped in an httpOnly cookie and echoed back as `state`, verified in
 * the callback before it's trusted.
 */
export const GET = withAdmin(async (req: NextRequest) => {
  const state = crypto.randomUUID();
  const authUrl = getYoutubeAuthUrl(state, getRedirectUri(req));

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("youtube_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
});
