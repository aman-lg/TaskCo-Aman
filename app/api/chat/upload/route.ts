import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB, matches the bucket's own file_size_limit
const BUCKET = "chat-attachments";

/**
 * POST /api/chat/upload
 * Uploads a chat attachment (photo, video, document, voice note) and returns
 * its public URL. Uses the admin client for the actual storage write —
 * withAuth() already gates this to logged-in users, so no separate storage
 * RLS policy is needed; the bucket itself is public (unguessable UUID paths).
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const formData = await req.formData().catch(() => null);
  if (!formData) return ApiError.badRequest("Multipart form data required");

  const file = formData.get("file");
  if (!(file instanceof File)) return ApiError.badRequest("No file provided");
  if (file.size === 0) return ApiError.badRequest("Empty file");
  if (file.size > MAX_SIZE) return ApiError.badRequest("File too large (max 25MB)");

  const admin = createAdminClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const path = `${user.id}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadErr) {
    console.error("[chat/upload]", uploadErr);
    return ApiError.internal();
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  return ok({
    url: pub.publicUrl,
    name: file.name,
    size: file.size,
    mime: file.type || "application/octet-stream",
  });
});
