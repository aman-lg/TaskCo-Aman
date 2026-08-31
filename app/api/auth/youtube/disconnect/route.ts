import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export const POST = withAdmin(async (_req: NextRequest) => {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("youtube_connections")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) { console.error("[youtube/disconnect]", error); return ApiError.internal(); }
  return ok({ disconnected: true });
});
