import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { getNotifications, getUnreadCount } from "@/lib/queries/notifications";

export const GET = withAuth(async (_req: NextRequest, { user }) => {
  const supabase = await createClient();
  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(supabase, user.id),
      getUnreadCount(supabase, user.id),
    ]);
    return ok({ notifications, unreadCount });
  } catch (err) {
    console.error("[notifications GET]", err);
    return ApiError.internal();
  }
});
