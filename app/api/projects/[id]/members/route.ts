import { type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

const addSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
});

// GET /api/projects/[id]/members — list members with profile info
export const GET = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid project ID");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("project_members")
    .select("user_id, added_at, profile:profiles!user_id(id, full_name, avatar_url, email)")
    .eq("project_id", id)
    .order("added_at", { ascending: true });

  if (error) {
    console.error("[projects/members GET]", error);
    return ApiError.internal();
  }
  return ok(data ?? []);
});

// POST /api/projects/[id]/members — add a member
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid project ID");

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("project_members")
    .insert({ project_id: id, user_id: parsed.data.user_id, added_by: user.id });

  if (error) {
    console.error("[projects/members POST]", error);
    if (error.code === "23505") return ApiError.badRequest("User is already a member of this project.");
    return ApiError.internal();
  }
  return ok({ project_id: id, user_id: parsed.data.user_id });
});

// DELETE /api/projects/[id]/members?user_id=... — remove a member
export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid project ID");

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId || !isValidUUID(userId)) return ApiError.badRequest("Invalid user_id param");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("project_members")
    .delete()
    .eq("project_id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("[projects/members DELETE]", error);
    return ApiError.internal();
  }
  return ok({ removed: true });
});
