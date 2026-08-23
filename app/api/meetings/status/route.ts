import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "host";
}

/**
 * GET /api/meetings/status
 * Returns Google Calendar connection status + the host's public booking slug,
 * generating and persisting one on first call if the profile doesn't have one yet.
 */
export const GET = withAuth(async (_req: NextRequest, { user }) => {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: profile } = await db
    .from("profiles")
    .select("full_name, booking_slug")
    .eq("id", user.id)
    .single();

  let slug: string | null = profile?.booking_slug ?? null;
  if (!slug) {
    const base = slugify(profile?.full_name || user.email?.split("@")[0] || "host");
    for (let attempt = 0; attempt < 5 && !slug; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await db.from("profiles").update({ booking_slug: candidate }).eq("id", user.id);
      if (!error) {
        slug = candidate;
      } else if (error.code !== "23505") {
        console.error("[meetings/status] slug assign failed", error);
        break;
      }
    }
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: connection } = await (admin as any)
    .from("google_calendar_connections")
    .select("google_email, connected_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return ok({
    connected: !!connection,
    googleEmail: connection?.google_email ?? null,
    bookingSlug: slug,
  });
});
