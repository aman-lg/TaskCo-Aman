import { type NextRequest } from "next/server";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/utils/validate";

const BUCKET = "form-response-files";
const DEFAULT_MAX_MB = 10;
const HARD_CAP_BYTES = 25 * 1024 * 1024; // matches the bucket's own file_size_limit

// POST /api/forms/[id]/upload — stage a file for an upload-type question
// before the final submit (multipart: question_id + file). Not wrapped in
// withAuth: a no-login form must accept this from an anonymous visitor too,
// same as the booking flow — this route does its own optional-auth check
// based on the form's own requires_login flag.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: formId } = await context.params;
  if (!isValidUUID(formId)) return ApiError.badRequest("Invalid form id");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: form } = await (admin as any)
    .from("forms")
    .select("id, requires_login, is_published")
    .eq("id", formId)
    .maybeSingle();
  if (!form || !form.is_published) return ApiError.notFound("Form not found");

  if (form.requires_login) {
    const { data: { user } } = await getAuthUser();
    if (!user) return ApiError.unauthorized();
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return ApiError.badRequest("Multipart form data required");

  const questionId = formData.get("question_id");
  if (typeof questionId !== "string" || !isValidUUID(questionId)) return ApiError.badRequest("Invalid question id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: question } = await (admin as any)
    .from("form_questions")
    .select("id, question_type, config")
    .eq("id", questionId)
    .eq("form_id", formId)
    .maybeSingle();
  if (!question || question.question_type !== "upload") return ApiError.badRequest("Not an upload question");

  const file = formData.get("file");
  if (!(file instanceof File)) return ApiError.badRequest("No file provided");
  if (file.size === 0) return ApiError.badRequest("Empty file");

  const maxBytes = Math.min(
    (question.config?.max_size_mb ?? DEFAULT_MAX_MB) * 1024 * 1024,
    HARD_CAP_BYTES
  );
  if (file.size > maxBytes) {
    return ApiError.badRequest(`File too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`);
  }

  const allowedMime: string[] | undefined = question.config?.allowed_mime;
  if (allowedMime && allowedMime.length > 0 && !allowedMime.includes(file.type)) {
    return ApiError.badRequest("File type not allowed for this question");
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const path = `${formId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadErr) {
    console.error("[forms/[id]/upload]", uploadErr);
    return ApiError.internal();
  }

  return ok({
    file_storage_path: path,
    file_name: file.name,
    file_size: file.size,
    file_mime: file.type || null,
  });
}
