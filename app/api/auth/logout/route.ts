import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout
 *
 * Signs the current user out server-side so the HttpOnly auth cookies set by
 * @supabase/ssr are cleared on the response.  Client-only signOut() cannot
 * remove HttpOnly cookies, which would leave a dangling session visible to the
 * proxy/middleware even after the user believes they have logged out.
 *
 * Security notes:
 *  - POST-only: GET requests return 405.  A GET endpoint could be abused via
 *    <img src="/api/auth/logout"> or link-prefetch CSRF vectors.
 *  - Idempotent: returns 200 even when there is no active session, so callers
 *    don't need to special-case "already signed out" states.
 *  - scope:"local" signs out only this browser session; other devices are
 *    unaffected.  Change to "global" to invalidate all refresh tokens.
 *  - No sensitive data is included in the response body.
 *  - Does NOT use withAuth() — requiring a valid session before allowing
 *    sign-out creates a deadlock when the session is partially expired.
 */
export async function POST(_req: NextRequest) {
  const supabase = await createClient();

  // signOut instructs @supabase/ssr to set expired Set-Cookie headers,
  // effectively clearing the session from the browser.
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    // Log server-side for observability but do not surface details to the
    // client — "No session" is a normal state, not an error worth retrying.
    console.warn("[logout] signOut returned error:", error.message);
  }

  return NextResponse.json({ data: { success: true } });
}
