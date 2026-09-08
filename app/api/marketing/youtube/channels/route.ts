import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidYoutubeAccessToken } from "@/lib/google/youtube-connection";
import { listMyChannels } from "@/lib/google/youtube";

// GET /api/marketing/youtube/channels
// Every channel the currently-connected token can actually see via
// channels.list?mine=true, plus which one is currently connected — the
// "mapping" tool for when the wrong channel got connected (e.g. the token
// resolves to a personal channel instead of the intended content channel).
// If only one channel ever shows here, that's not a code problem: it means
// this Google login genuinely can't see any other channel, which is a
// Google-account-permissions question, not something this endpoint can fix.
export const GET = withAdmin(async () => {
  const accessToken = await getValidYoutubeAccessToken();
  if (!accessToken) return ApiError.badRequest("YouTube isn't connected yet.");

  const channels = await listMyChannels(accessToken);

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (admin as any)
    .from("youtube_connections")
    .select("channel_id")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ok({
    connectedChannelId: conn?.channel_id ?? null,
    channels: channels.map((c) => ({ channelId: c.channelId, title: c.title, thumbnailUrl: c.thumbnailUrl })),
  });
});
