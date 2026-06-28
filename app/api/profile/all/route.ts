import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

// GET /api/profile/all — return all profiles (id, name, avatar, email)
// Used for member pickers in project/task forms.
export const GET = withAuth(async () => {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[profile/all GET]", error);
    return ApiError.internal();
  }
  return ok(data ?? []);
});
