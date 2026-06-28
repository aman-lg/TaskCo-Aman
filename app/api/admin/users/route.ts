import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

// GET /api/admin/users — list all users with task counts
export const GET = withAdmin(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, is_admin, created_at");

  if (error) {
    console.error("[admin/users GET]", error);
    return ApiError.internal();
  }

  return ok(data ?? []);
});
