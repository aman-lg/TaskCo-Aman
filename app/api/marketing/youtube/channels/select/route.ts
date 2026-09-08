import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidYoutubeAccessToken } from "@/lib/google/youtube-connection";
import { getChannelById } from "@/lib/google/youtube";

const selectChannelSchema = z.object({
  channel_id: z.string().min(1, "Channel ID is required").max(64, "Max 64 characters"),
});

// POST /api/marketing/youtube/channels/select — repoint the existing
// org-wide connection at a different channel_id (from the list returned by
// GET /channels), reusing the same stored access/refresh token rather than
// requiring reconnection through Google's consent screen again.
export const POST = withAdmin(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = selectChannelSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const accessToken = await getValidYoutubeAccessToken();
  if (!accessToken) return ApiError.badRequest("YouTube isn't connected yet.");

  const channel = await getChannelById(accessToken, parsed.data.channel_id);
  if (!channel) return ApiError.badRequest("That channel couldn't be found.");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn, error: connErr } = await (admin as any)
    .from("youtube_connections")
    .select("id")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (connErr) { console.error("[youtube/channels/select] load connection", connErr); return ApiError.internal(); }
  if (!conn) return ApiError.badRequest("YouTube isn't connected yet.");

  const { error } = await (admin as any)
    .from("youtube_connections")
    .update({
      channel_id: channel.channelId,
      channel_title: channel.title,
      channel_thumbnail_url: channel.thumbnailUrl,
      uploads_playlist_id: channel.uploadsPlaylistId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);
  if (error) { console.error("[youtube/channels/select] update failed", error); return ApiError.internal(); }

  return ok({ channelId: channel.channelId, channelTitle: channel.title });
});
