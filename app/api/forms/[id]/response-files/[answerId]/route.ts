import { type NextRequest } from "next/server";
import { withAdmin } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";

const BUCKET = "form-response-files";
const SIGNED_URL_TTL = 600; // 10 minutes

// GET /api/forms/[id]/response-files/[answerId] — resolve an upload-type
// answer to a short-lived signed URL (admin only, mirrors task_files).
export const GET = withAdmin(async (_req: NextRequest, { params }) => {
  const formId = params?.id;
  const answerId = params?.answerId;
  if (!isValidUUID(formId) || !isValidUUID(answerId)) return ApiError.badRequest("Invalid id");

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (admin as any)
    .from("form_answers")
    .select("file_storage_path, response:form_responses!response_id(form_id)")
    .eq("id", answerId)
    .maybeSingle();

  if (error) { console.error("[forms/[id]/response-files/[answerId] GET]", error); return ApiError.internal(); }
  if (!row || row.response?.form_id !== formId || !row.file_storage_path) return ApiError.notFound("File not found");

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.file_storage_path, SIGNED_URL_TTL);
  if (signErr || !signed) { console.error("[forms/[id]/response-files/[answerId] signedUrl]", signErr); return ApiError.internal(); }

  return ok({ url: signed.signedUrl });
});
