import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/marketing/youtube/status
// Connection state (youtube_connections has no client RLS policies at all,
// so this has to go through the admin client, same as the connection itself
// is only ever written server-side) + last sync time, so the page knows
// whether to show "Connect YouTube" or the dashboard.
export const GET = withAdmin(async () => {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn, error: connErr } = await (admin as any)
    .from("youtube_connections")
    .select("channel_id, channel_title, channel_thumbnail_url, connected_at")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (connErr) { console.error("[marketing/youtube/status]", connErr); return ApiError.internal(); }

  if (!conn) return ok({ connected: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latest } = await (admin as any)
    .from("youtube_videos")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ok({
    connected: true,
    channelId: conn.channel_id,
    channelTitle: conn.channel_title,
    channelThumbnailUrl: conn.channel_thumbnail_url,
    connectedAt: conn.connected_at,
    lastSyncedAt: latest?.synced_at ?? null,
  });
});
