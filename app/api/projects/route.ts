import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createProjectSchema } from "@/lib/validations/projects";

/**
 * GET /api/projects
 * Returns all projects (team-read RLS â€” every authenticated user sees all projects).
 * Ordered by created_at descending; owner profile embedded.
 */
export const GET = withAuth(async (_req: NextRequest) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, owner:profiles!owner_id(id, full_name, avatar_url)")
    .order("created_at", { ascending: false });

  if (error) { console.error("[projects GET]", error); return ApiError.internal(); }
  return ok(data ?? []);
});

/**
 * POST /api/projects
 * Creates a new project. owner_id is set to the authenticated user â€” cannot be overridden.
 *
 * Security:
 *   - withAuth() verifies JWT before handler runs
 *   - owner_id is injected server-side (body value ignored if supplied)
 *   - RLS INSERT policy enforces owner_id = auth.uid() at the DB level
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  if (!body) return ApiError.badRequest("Request body is required");

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return ApiError.badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("projects")
    .insert({ ...parsed.data, owner_id: user.id })
    .select("*, owner:profiles!owner_id(id, full_name, avatar_url)")
    .single();

  if (error) { console.error("[projects POST]", error); return ApiError.internal(); }
  return ok(data, 201);
});
