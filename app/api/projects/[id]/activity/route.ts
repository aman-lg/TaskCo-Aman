import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { getProjectActivity } from "@/lib/queries/activity";

export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const projectId = params?.id;
  if (!projectId) return ApiError.badRequest("Project ID is required");

  const supabase = await createClient();
  try {
    const activities = await getProjectActivity(supabase, projectId);
    return ok(activities);
  } catch (e) {
    return ApiError.internal(e instanceof Error ? e.message : "Unknown error");
  }
});
