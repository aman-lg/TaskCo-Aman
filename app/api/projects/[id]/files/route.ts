import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { addProjectLinkSchema } from "@/lib/validations/project-files";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB, matches the bucket's file_size_limit
const BUCKET = "project-files";

// GET /api/projects/[id]/files — list files/links attached to a project.
// RLS on project_files mirrors projects_select, so this naturally 404s (empty list)
// for non-members rather than needing a manual membership check here.
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const projectId = params?.id;
  if (!isValidUUID(projectId)) return ApiError.badRequest("Invalid project ID");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("project_files")
    .select("id, kind, name, url, storage_path, size, mime, created_at, added_by, profile:profiles!added_by(full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[projects/[id]/files GET]", error);
    return ApiError.internal();
  }
  return ok(data ?? []);
});

// POST /api/projects/[id]/files — add a link (JSON) or upload a file (multipart).
// Membership is enforced by the RLS-scoped client doing the actual insert — if the
// caller isn't a member/owner, project_files_insert rejects it and this returns 500/403
// via the error branch, never silently succeeding.
export const POST = withAuth(async (req: NextRequest, { user, params }) => {
  const projectId = params?.id;
  if (!isValidUUID(projectId)) return ApiError.badRequest("Invalid project ID");

  const supabase = await createClient();
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const parsed = addProjectLinkSchema.safeParse(body);
    if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("project_files")
      .insert({
        project_id: projectId,
        added_by: user.id,
        kind: "link",
        name: parsed.data.name,
        url: parsed.data.url,
      })
      .select("id, kind, name, url, storage_path, size, mime, created_at, added_by")
      .single();

    if (error) {
      console.error("[projects/[id]/files POST link]", error);
      return ApiError.internal();
    }
    return ok(data, 201);
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return ApiError.badRequest("Multipart form data or JSON body required");

  const file = formData.get("file");
  if (!(file instanceof File)) return ApiError.badRequest("No file provided");
  if (file.size === 0) return ApiError.badRequest("Empty file");
  if (file.size > MAX_SIZE) return ApiError.badRequest("File too large (max 25MB)");

  // Membership check up front, matching project_files_insert's RLS condition exactly
  // (owner or member — NOT projects_select's broader admin-can-view-everything clause,
  // which would wrongly let this pass for an admin who isn't actually a member, only to
  // fail later at the DB insert after the storage object was already written).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase as any)
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return ApiError.notFound("Project not found");

  let canWrite = project.owner_id === user.id;
  if (!canWrite) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberRow } = await (supabase as any)
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    canWrite = !!memberRow;
  }
  if (!canWrite) return ApiError.forbidden("You don't have access to this project");

  const admin = createAdminClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const path = `${projectId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadErr) {
    console.error("[projects/[id]/files POST upload]", uploadErr);
    return ApiError.internal();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("project_files")
    .insert({
      project_id: projectId,
      added_by: user.id,
      kind: "file",
      name: file.name,
      storage_path: path,
      size: file.size,
      mime: file.type || "application/octet-stream",
    })
    .select("id, kind, name, url, storage_path, size, mime, created_at, added_by")
    .single();

  if (error) {
    console.error("[projects/[id]/files POST insert]", error);
    // Row insert failed (e.g. not actually a member) — remove the orphaned storage object.
    await admin.storage.from(BUCKET).remove([path]);
    return ApiError.internal();
  }

  return ok(data, 201);
});
