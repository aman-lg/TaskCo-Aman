import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidYoutubeAccessToken } from "@/lib/google/youtube-connection";
import { getChannelById, listUploadsVideoIds, getVideoMetadata, getCategoryNames, getVideoAnalytics } from "@/lib/google/youtube";

// POST /api/marketing/youtube/sync
// Manual, admin-triggered pull — no scheduled job. Reads the channel this
// connection is actually pointed at (channel_id/uploads_playlist_id stored
// on youtube_connections, set at connect time or via the channel picker in
// app/api/marketing/youtube/channels/select) rather than re-deriving it from
// channels.list?mine=true on every run — that re-derivation is what silently
// undid a manually-picked channel before this fix. Lists every uploaded
// video, fetches metadata (Data API) and every stat this feature needs —
// views/likes/comments/shares/impressions/CTR — from the Analytics API in
// one pass (see lib/google/youtube.ts for why that's all one call rather
// than Data API stats + a separate Analytics call), then upserts the merged
// rows. Safe to re-run any time; it's a full resync, not incremental.
export const POST = withAdmin(async () => {
  const accessToken = await getValidYoutubeAccessToken();
  if (!accessToken) return ApiError.badRequest("YouTube isn't connected yet.");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn, error: connErr } = await (admin as any)
    .from("youtube_connections")
    .select("id, channel_id, channel_title, uploads_playlist_id")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (connErr) { console.error("[youtube/sync] load connection", connErr); return ApiError.internal(); }
  if (!conn) return ApiError.badRequest("YouTube isn't connected yet.");

  const channelId = conn.channel_id as string;
  let uploadsPlaylistId = conn.uploads_playlist_id as string | null;

  // Backfill for a connection row created before uploads_playlist_id existed.
  if (!uploadsPlaylistId) {
    const channel = await getChannelById(accessToken, channelId);
    if (!channel) return ApiError.internal();
    uploadsPlaylistId = channel.uploadsPlaylistId;
    await (admin as any).from("youtube_connections").update({ uploads_playlist_id: uploadsPlaylistId }).eq("id", conn.id);
  }

  const videoIds = await listUploadsVideoIds(accessToken, uploadsPlaylistId);
  if (videoIds.length === 0) {
    // TEMP DEBUG — diagnosing a real "0 videos synced" report. Surfacing
    // which channel/playlist the token actually resolved to (not an error,
    // just extra fields on a successful response) so this is visible in the
    // browser without server-log access. Revert once diagnosed (see chat).
    return ok({
      synced_count: 0,
      synced_at: new Date().toISOString(),
      debug_channel_id: channelId,
      debug_channel_title: conn.channel_title,
      debug_uploads_playlist_id: uploadsPlaylistId,
    });
  }

  const [metadata, analytics] = await Promise.all([
    getVideoMetadata(accessToken, videoIds),
    getVideoAnalytics(accessToken, videoIds, channelId),
  ]);

  const categoryNames = await getCategoryNames(accessToken, metadata.map((m) => m.categoryId ?? "").filter(Boolean));

  const syncedAt = new Date().toISOString();
  const rows = metadata.map((m) => {
    const stats = analytics.get(m.videoId);
    return {
      video_id: m.videoId,
      title: m.title,
      description: m.description,
      published_at: m.publishedAt,
      thumbnail_url: m.thumbnailUrl,
      duration_seconds: m.durationSeconds,
      tags: m.tags,
      category_name: m.categoryId ? (categoryNames.get(m.categoryId) ?? null) : null,
      views: stats?.views ?? null,
      likes: stats?.likes ?? null,
      comments: stats?.comments ?? null,
      shares: stats?.shares ?? null,
      impressions: stats?.impressions ?? null,
      impressions_ctr: stats?.impressionsCtr ?? null,
      synced_at: syncedAt,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("youtube_videos").upsert(rows, { onConflict: "video_id" });
  if (error) { console.error("[youtube/sync] upsert failed", error); return ApiError.internal(); }

  return ok({ synced_count: rows.length, synced_at: syncedAt });
});
