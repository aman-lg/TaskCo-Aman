import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";

const BUCKET = "task-files";
const SIGNED_URL_TTL = 600; // 10 minutes — same as project files, gives the embedded viewer time to load

// GET /api/tasks/[id]/files/[fileId] — resolve to a short-lived signed URL.
// Generated only after confirming the caller can see the row
// (task_files_select already gates that at the RLS layer).
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const taskId = params?.id;
  const fileId = params?.fileId;
  if (!isValidUUID(taskId) || !isValidUUID(fileId)) return ApiError.badRequest("Invalid ID");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from("task_files")
    .select("id, storage_path, name")
    .eq("id", fileId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (error) {
    console.error("[tasks/[id]/files/[fileId] GET]", error);
    return ApiError.internal();
  }
  if (!row) return ApiError.notFound("File not found");

  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL, { download: row.name });

  if (signErr || !signed) {
    console.error("[tasks/[id]/files/[fileId] GET signedUrl]", signErr);
    return ApiError.internal();
  }
  return ok({ url: signed.signedUrl });
});

// DELETE /api/tasks/[id]/files/[fileId]
// task_files_delete (uploader, task creator, or admin) gates the row delete;
// the storage object is only removed after that row delete actually succeeds.
export const DELETE = withAuth(async (_req: NextRequest, { params }) => {
  const taskId = params?.id;
  const fileId = params?.fileId;
  if (!isValidUUID(taskId) || !isValidUUID(fileId)) return ApiError.badRequest("Invalid ID");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deleted, error } = await (supabase as any)
    .from("task_files")
    .delete()
    .eq("id", fileId)
    .eq("task_id", taskId)
    .select("storage_path")
    .maybeSingle();

  if (error) {
    console.error("[tasks/[id]/files/[fileId] DELETE]", error);
    return ApiError.internal();
  }
  if (!deleted) return ApiError.notFound("File not found");

  const admin = createAdminClient();
  const { error: removeErr } = await admin.storage.from(BUCKET).remove([deleted.storage_path]);
  if (removeErr) console.error("[tasks/[id]/files/[fileId] DELETE storage]", removeErr);

  return ok({ deleted: true });
});
