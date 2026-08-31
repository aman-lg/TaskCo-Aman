import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidYoutubeAccessToken } from "@/lib/google/youtube-connection";
import { getMyChannel, listUploadsVideoIds, getVideoMetadata, getCategoryNames, getVideoAnalytics } from "@/lib/google/youtube";

// POST /api/marketing/youtube/sync
// Manual, admin-triggered pull — no scheduled job. Lists every uploaded
// video, fetches metadata (Data API) and every stat this feature needs —
// views/likes/comments/shares/impressions/CTR — from the Analytics API in
// one pass (see lib/google/youtube.ts for why that's all one call rather
// than Data API stats + a separate Analytics call), then upserts the merged
// rows. Safe to re-run any time; it's a full resync, not incremental.
export const POST = withAdmin(async () => {
  const accessToken = await getValidYoutubeAccessToken();
  if (!accessToken) return ApiError.badRequest("YouTube isn't connected yet.");

  const channel = await getMyChannel(accessToken);
  if (!channel) return ApiError.internal();

  const videoIds = await listUploadsVideoIds(accessToken, channel.uploadsPlaylistId);
  if (videoIds.length === 0) {
    return ok({ synced_count: 0, synced_at: new Date().toISOString() });
  }

  const [metadata, analytics] = await Promise.all([
    getVideoMetadata(accessToken, videoIds),
    getVideoAnalytics(accessToken, videoIds, channel.channelId),
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

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from("youtube_videos").upsert(rows, { onConflict: "video_id" });
  if (error) { console.error("[youtube/sync] upsert failed", error); return ApiError.internal(); }

  return ok({ synced_count: rows.length, synced_at: syncedAt });
});
