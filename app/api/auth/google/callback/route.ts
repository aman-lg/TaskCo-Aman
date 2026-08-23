import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, getGoogleUserEmail } from "@/lib/google/calendar";

/**
 * GET /api/auth/google/callback
 * Google redirects the browser here after consent. Not wrapped in withAuth()
 * since a failure here should redirect the browser back into the app with a
 * readable error, not return a JSON error body.
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const redirectTo = (path: string) => NextResponse.redirect(`${appUrl}${path}`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo("/meetings?error=oauth_state_mismatch");
  }

  const { data: { user } } = await getAuthUser();
  if (!user) return redirectTo("/login");

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      // We always pass prompt=consent specifically so Google returns a refresh_token
      // here; if it's still missing, surface a clear error instead of half-connecting.
      return redirectTo("/meetings?error=no_refresh_token");
    }
    const googleEmail = await getGoogleUserEmail(tokens.access_token);

    const admin = createAdminClient();
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("google_calendar_connections")
      .upsert(
        {
          user_id: user.id,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          token_expiry: expiry,
          google_email: googleEmail,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) {
      console.error("[google/callback] upsert failed", error);
      return redirectTo("/meetings?error=save_failed");
    }

    const res = redirectTo("/meetings?connected=1");
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (err) {
    console.error("[google/callback]", err);
    return redirectTo("/meetings?error=connect_failed");
  }
}
