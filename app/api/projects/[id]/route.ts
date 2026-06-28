import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { updateProjectSchema } from "@/lib/validations/projects";

/**
 * GET /api/projects/:id
 */
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) return ApiError.badRequest("Project ID is required");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, owner:profiles!owner_id(id, full_name, avatar_url)")
    .eq("id", id)
    .single();

  if (error || !data) return ApiError.notFound("Project not found");
  return ok(data);
});

/**
 * PATCH /api/projects/:id
 * Updates project fields. RLS enforces owner-only writes at the DB level.
 *
 * Security:
 *   - withAuth() verifies JWT
 *   - owner_id is never accepted in the body (omitted by updateProjectSchema)
 *   - If RLS blocks the update (user is not owner), Supabase returns 0 rows → 403
 */
export const PATCH = withAuth(async (req: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) return ApiError.badRequest("Project ID is required");

  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");

  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  if (Object.keys(parsed.data).length === 0) {
    return ApiError.badRequest("No fields to update");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("projects")
    .update(parsed.data)
    .eq("id", id)
    .select("*, owner:profiles!owner_id(id, full_name, avatar_url)")
    .single();

  if (error) {
    // PGRST116 = no rows matched → RLS blocked update (not the owner)
    if (error.code === "PGRST116") return ApiError.forbidden();
    return ApiError.internal(error.message);
  }
  if (!data) return ApiError.forbidden();
  return ok(data);
});

/**
 * DELETE /api/projects/:id
 * Deletes a project. RLS enforces owner-only deletes at the DB level.
 *
 * Security: same as PATCH — RLS blocks if user is not owner; 0 rows → 403.
 */
export const DELETE = withAuth(async (_req: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) return ApiError.badRequest("Project ID is required");

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("projects")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return ApiError.internal(error.message);
  if (count === 0) return ApiError.forbidden();
  return ok({ deleted: true });
});
