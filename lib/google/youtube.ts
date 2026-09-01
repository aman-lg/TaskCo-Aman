// SERVER ONLY — never import from "use client" files.
// Thin wrapper over the YouTube Data API v3 + YouTube Analytics API v2 —
// same "plain fetch, no SDK" approach as lib/google/calendar.ts.

const YOUTUBE_DATA_API = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";

export interface YoutubeChannel {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string;
}

export async function getMyChannel(accessToken: string): Promise<YoutubeChannel | null> {
  const params = new URLSearchParams({ part: "snippet,contentDetails", mine: "true" });
  const res = await fetch(`${YOUTUBE_DATA_API}/channels?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`YouTube channels.list failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const channel = json.items?.[0];
  if (!channel) {
    // TEMP DEBUG — surfaces the raw response instead of a bare null so the
    // callback's existing error-message passthrough shows exactly what
    // Google returned (see chat: diagnosing "no_channel_found" when the
    // user says the account does have a channel — likely mine=true not
    // resolving to a Brand Account channel the login only *manages*).
    throw new Error(`channels.list?mine=true returned no items. Raw: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return {
    channelId: channel.id,
    title: channel.snippet?.title ?? "Untitled channel",
    thumbnailUrl: channel.snippet?.thumbnails?.default?.url ?? null,
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads,
  };
}

// ─── Video list (paginated) ─────────────────────────────────────────────────

export async function listUploadsVideoIds(accessToken: string, uploadsPlaylistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`${YOUTUBE_DATA_API}/playlistItems?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`YouTube playlistItems.list failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of json.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return ids;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// PT4M13S -> 253
function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, h, min, s] = m;
  return (Number(h ?? 0) * 3600) + (Number(min ?? 0) * 60) + Number(s ?? 0);
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string | null;
  publishedAt: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  tags: string[];
  categoryId: string | null;
}

// Batched — videos.list accepts up to 50 ids per call.
export async function getVideoMetadata(accessToken: string, videoIds: string[]): Promise<VideoMetadata[]> {
  const out: VideoMetadata[] = [];
  for (const batch of chunk(videoIds, 50)) {
    const params = new URLSearchParams({ part: "snippet,contentDetails", id: batch.join(",") });
    const res = await fetch(`${YOUTUBE_DATA_API}/videos?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`YouTube videos.list failed (${res.status}): ${await res.text()}`);
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const v of json.items ?? []) {
      out.push({
        videoId: v.id,
        title: v.snippet?.title ?? "(untitled)",
        description: v.snippet?.description ?? null,
        publishedAt: v.snippet?.publishedAt,
        thumbnailUrl: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
        durationSeconds: parseIsoDuration(v.contentDetails?.duration),
        tags: v.snippet?.tags ?? [],
        categoryId: v.snippet?.categoryId ?? null,
      });
    }
  }
  return out;
}

// videoCategories.list needs a regionCode; "US" is a reasonable universal
// default since categories are only used here as a topic-type label, not
// for anything region-sensitive.
export async function getCategoryNames(accessToken: string, categoryIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(categoryIds.filter(Boolean)));
  const map = new Map<string, string>();
  if (uniqueIds.length === 0) return map;
  for (const batch of chunk(uniqueIds, 50)) {
    const params = new URLSearchParams({ part: "snippet", id: batch.join(","), regionCode: "US" });
    const res = await fetch(`${YOUTUBE_DATA_API}/videoCategories?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) continue; // non-critical — falls back to no category name
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of json.items ?? []) map.set(c.id, c.snippet?.title ?? c.id);
  }
  return map;
}

// ─── Analytics (private, owner-only) ────────────────────────────────────────
// Everything the public Data API can't provide — shares, impressions, CTR —
// plus views/likes/comments again from the analytics side (used instead of
// videos.list's public `statistics`, so this is the one call that supplies
// every metric this feature needs).

export interface VideoAnalytics {
  videoId: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  impressionsCtr: number | null;
}

export async function getVideoAnalytics(
  accessToken: string,
  videoIds: string[],
  channelId: string
): Promise<Map<string, VideoAnalytics>> {
  const result = new Map<string, VideoAnalytics>();
  const metrics = "views,likes,comments,shares,impressions,impressionsCtr";

  for (const batch of chunk(videoIds, 50)) {
    const params = new URLSearchParams({
      ids: `channel==${channelId}`,
      startDate: "2005-01-01",
      endDate: new Date().toISOString().slice(0, 10),
      dimensions: "video",
      metrics,
      filters: `video==${batch.join(",")}`,
      maxResults: "50",
    });
    const res = await fetch(`${YOUTUBE_ANALYTICS_API}/reports?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      // Impressions/shares aren't available for every video (old videos,
      // Shorts, anything never surfaced in suggested/home feed) — a 400 here
      // for a batch is expected sometimes, not fatal to the whole sync.
      console.error(`[youtube analytics] batch failed (${res.status})`, await res.text().catch(() => ""));
      continue;
    }
    const json = await res.json();
    const columns: string[] = (json.columnHeaders ?? []).map((c: { name: string }) => c.name);
    const videoIdx = columns.indexOf("video");
    for (const row of json.rows ?? []) {
      const videoId = row[videoIdx];
      const get = (name: string) => {
        const idx = columns.indexOf(name);
        return idx === -1 ? null : row[idx];
      };
      result.set(videoId, {
        videoId,
        views: get("views"),
        likes: get("likes"),
        comments: get("comments"),
        shares: get("shares"),
        impressions: get("impressions"),
        impressionsCtr: get("impressionsCtr"),
      });
    }
  }
  return result;
}
