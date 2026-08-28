import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { addTaskLinkSchema } from "@/lib/validations/task-files";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB, matches the bucket's file_size_limit
const BUCKET = "task-files";

// GET /api/tasks/[id]/files — list files attached to a task.
// RLS on task_files mirrors tasks_select, so this naturally returns an
// empty list for someone who can't see the task rather than needing a
// manual visibility check here.
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  const taskId = params?.id;
  if (!isValidUUID(taskId)) return ApiError.badRequest("Invalid task ID");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("task_files")
    .select("id, kind, name, url, storage_path, size, mime, created_at, added_by, profile:profiles!added_by(full_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[tasks/[id]/files GET]", error);
    return ApiError.internal();
  }
  return ok(data ?? []);
});

// POST /api/tasks/[id]/files — upload a file attachment (multipart).
// Membership is enforced up front to match task_files_insert's RLS
// condition exactly, so a rejected upload never leaves an orphaned
// storage object behind.
export const POST = withAuth(async (req: NextRequest, { user, params }) => {
  const taskId = params?.id;
  if (!isValidUUID(taskId)) return ApiError.badRequest("Invalid task ID");

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: task } = await (supabase as any)
    .from("tasks")
    .select("id, created_by, project_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return ApiError.notFound("Task not found");

  let canWrite = task.created_by === user.id;
  if (!canWrite) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assignee } = await (supabase as any)
      .from("task_assignees")
      .select("user_id")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .maybeSingle();
    canWrite = !!assignee;
  }
  if (!canWrite) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member } = await (supabase as any)
      .from("project_members")
      .select("user_id")
      .eq("project_id", task.project_id)
      .eq("user_id", user.id)
      .maybeSingle();
    canWrite = !!member;
  }
  if (!canWrite) return ApiError.forbidden("You don't have access to this task");

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const parsed = addTaskLinkSchema.safeParse(body);
    if (!parsed.success) return ApiError.badRequest(parsed.error.issues[0].message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("task_files")
      .insert({
        task_id: taskId,
        added_by: user.id,
        kind: "link",
        name: parsed.data.name,
        url: parsed.data.url,
        mime: parsed.data.mime ?? null,
        size: parsed.data.size ?? null,
      })
      .select("id, kind, name, url, storage_path, size, mime, created_at, added_by")
      .single();

    if (error) {
      console.error("[tasks/[id]/files POST link]", error);
      return ApiError.internal();
    }
    return ok(data, 201);
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return ApiError.badRequest("Multipart form data required");

  const file = formData.get("file");
  if (!(file instanceof File)) return ApiError.badRequest("No file provided");
  if (file.size === 0) return ApiError.badRequest("Empty file");
  if (file.size > MAX_SIZE) return ApiError.badRequest("File too large (max 25MB)");

  const admin = createAdminClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const path = `${taskId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadErr) {
    console.error("[tasks/[id]/files POST upload]", uploadErr);
    return ApiError.internal();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("task_files")
    .insert({
      task_id: taskId,
      added_by: user.id,
      kind: "file",
      name: file.name,
      storage_path: path,
      size: file.size,
      mime: file.type || null,
    })
    .select("id, kind, name, url, storage_path, size, mime, created_at, added_by")
    .single();

  if (error) {
    console.error("[tasks/[id]/files POST insert]", error);
    await admin.storage.from(BUCKET).remove([path]);
    return ApiError.internal();
  }
  return ok(data, 201);
});
