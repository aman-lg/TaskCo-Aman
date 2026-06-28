import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, err } from "@/lib/api/response";
import { isAppError } from "@/lib/api/errors";
import type { User } from "@supabase/supabase-js";

type HandlerFn = (req: NextRequest, ctx: { user: User; params?: Record<string, string> }) => Promise<Response>;

export function withAuth(fn: HandlerFn) {
  return async (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return ApiError.unauthorized();

      const params = context?.params ? await context.params : undefined;
      return await fn(req, { user, params });
    } catch (e) {
      if (isAppError(e)) return err(e.message, e.status, e.code);
      console.error("[API Error]", e);
      return ApiError.internal();
    }
  };
}

export function withAdmin(fn: HandlerFn) {
  return withAuth(async (req, ctx) => {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("is_admin")
      .eq("id", ctx.user.id)
      .single();
    if (!profile?.is_admin) return ApiError.forbidden();
    return fn(req, ctx);
  });
}
