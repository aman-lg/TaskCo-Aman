import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

// GET /api/marketing/youtube/videos
// Cached rows only — this never calls YouTube itself, that's what Sync Now
// (POST .../sync) is for. Uses the caller's own session, not the admin
// client: youtube_videos_select's RLS policy (admin-only) is the real gate
// here, withAdmin() is just the fast-fail before hitting the DB at all.
export const GET = withAdmin(async () => {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("youtube_videos")
    .select("*")
    .order("published_at", { ascending: false });

  if (error) { console.error("[marketing/youtube/videos]", error); return ApiError.internal(); }
  return ok({ videos: data ?? [] });
});
