import { withAuth } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile (id, email, full_name, avatar_url).
 * Used by client components that need to know the current user's identity.
 */
export const GET = withAuth(async (_req, { user }) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const profile = data as { id: string; full_name: string | null; avatar_url: string | null } | null;

  return ok({
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
  });
});
