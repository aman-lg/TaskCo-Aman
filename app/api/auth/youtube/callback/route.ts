import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens } from "@/lib/google/youtube-connection";
import { getMyChannel } from "@/lib/google/youtube";

/**
 * GET /api/auth/youtube/callback
 * Google redirects the browser here after consent. Not wrapped in
 * withAuth()/withAdmin() — a failure here should redirect the browser back
 * into the app with a readable error, not return a JSON error body. The
 * connect step already required admin, and this table has no client RLS
 * policies at all, so there's no privilege a non-admin could gain by
 * reaching this URL directly without ever having started the flow.
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const redirectTo = (path: string) => NextResponse.redirect(`${appUrl}${path}`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("youtube_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo("/marketing?error=oauth_state_mismatch");
  }

  const { data: { user } } = await getAuthUser();
  if (!user) return redirectTo("/login");

  try {
    const redirectUri = `${appUrl}/api/auth/youtube/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      return redirectTo("/marketing?error=no_refresh_token");
    }

    const channel = await getMyChannel(tokens.access_token);
    if (!channel) {
      return redirectTo("/marketing?error=no_channel_found");
    }

    const admin = createAdminClient();
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    // One connection, org-wide — clear out any previous connection before
    // inserting the new one rather than trying to key an upsert off
    // anything (there's no natural unique column to upsert on: reconnecting
    // as the same channel is the common case, but reconnecting as a
    // *different* channel is equally valid and should just replace it).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("youtube_connections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("youtube_connections").insert({
      channel_id: channel.channelId,
      channel_title: channel.title,
      channel_thumbnail_url: channel.thumbnailUrl,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry,
      connected_by: user.id,
    });
    if (error) {
      console.error("[youtube/callback] insert failed", error);
      return redirectTo("/marketing?error=save_failed");
    }

    const res = redirectTo("/marketing?connected=1");
    res.cookies.delete("youtube_oauth_state");
    return res;
  } catch (err) {
    console.error("[youtube/callback]", err);
    return redirectTo("/marketing?error=connect_failed");
  }
}
