import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

// GET /api/admin/users/[id] — profile + all tasks for a user
export const GET = withAdmin(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid user id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;

  const [{ data: profile, error: pe }, { data: tasks, error: te }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, is_admin, created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("tasks")
      .select("id, name, status, urgency, deadline, created_at, project_id, projects(name)")
      .eq("created_by", id)
      .order("created_at", { ascending: false }),
  ]);

  if (pe) {
    console.error("[admin/users/[id] GET profile]", pe);
    return ApiError.internal();
  }
  if (!profile) return ApiError.notFound("User not found");
  if (te) {
    console.error("[admin/users/[id] GET tasks]", te);
    return ApiError.internal();
  }

  return ok({ profile, tasks: tasks ?? [] });
});

const patchSchema = z.object({
  is_admin: z.boolean(),
});

// PATCH /api/admin/users/[id] — toggle admin status
export const PATCH = withAdmin(async (req: NextRequest, { user, params }) => {
  const id = params?.id;
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid user id");
  if (id === user.id) return ApiError.badRequest("Cannot change your own admin status");

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;
  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: parsed.data.is_admin })
    .eq("id", id);

  if (error) {
    console.error("[admin/users/[id] PATCH]", error);
    return ApiError.internal();
  }

  return ok({ id, is_admin: parsed.data.is_admin });
});
