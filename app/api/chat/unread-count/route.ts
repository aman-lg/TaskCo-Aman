import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { getTotalUnreadCount } from "@/lib/queries/chat";

// GET /api/chat/unread-count — total unread messages across all
// conversations, for the sidebar's Chat nav badge.
export const GET = withAuth(async (_req: NextRequest, { user }) => {
  const supabase = await createClient();
  try {
    const count = await getTotalUnreadCount(supabase, user.id);
    return ok({ count });
  } catch (err) {
    console.error("[chat/unread-count]", err);
    return ApiError.internal();
  }
});
