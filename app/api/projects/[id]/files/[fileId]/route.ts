import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";

const BUCKET = "project-files";
const SIGNED_URL_TTL = 60; // seconds — just long enough for the browser to follow the redirect

// GET /api/projects/[id]/files/[fileId] — resolve to an openable URL.
// Links return their url as-is; files get a short-lived signed URL from the
// private bucket, generated only after confirming the caller can see the row
// (project_files_select already gates that at the RLS layer).
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const projectId = params?.id;
  const fileId = params?.fileId;
  if (!isValidUUID(projectId) || !isValidUUID(fileId)) return ApiError.badRequest("Invalid ID");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from("project_files")
    .select("id, kind, url, storage_path, name")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("[projects/[id]/files/[fileId] GET]", error);
    return ApiError.internal();
  }
  if (!row) return ApiError.notFound("File not found");

  if (row.kind === "link") return ok({ url: row.url });

  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL, { download: row.name });

  if (signErr || !signed) {
    console.error("[projects/[id]/files/[fileId] GET signedUrl]", signErr);
    return ApiError.internal();
  }
  return ok({ url: signed.signedUrl });
});

// DELETE /api/projects/[id]/files/[fileId] — remove a link or file.
// project_files_delete (uploader, project owner, or admin) gates the row delete;
// the storage object is only removed after that row delete actually succeeds.
export const DELETE = withAuth(async (_req: NextRequest, { params }) => {
  const projectId = params?.id;
  const fileId = params?.fileId;
  if (!isValidUUID(projectId) || !isValidUUID(fileId)) return ApiError.badRequest("Invalid ID");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deleted, error } = await (supabase as any)
    .from("project_files")
    .delete()
    .eq("id", fileId)
    .eq("project_id", projectId)
    .select("kind, storage_path")
    .maybeSingle();

  if (error) {
    console.error("[projects/[id]/files/[fileId] DELETE]", error);
    return ApiError.internal();
  }
  if (!deleted) return ApiError.notFound("File not found");

  if (deleted.kind === "file" && deleted.storage_path) {
    const admin = createAdminClient();
    const { error: removeErr } = await admin.storage.from(BUCKET).remove([deleted.storage_path]);
    if (removeErr) console.error("[projects/[id]/files/[fileId] DELETE storage]", removeErr);
  }

  return ok({ deleted: true });
});
