import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

// Cached per-request: every Server Component/Route Handler in the same
// request tree that calls createClient() gets back the same client instance
// instead of re-reading cookies() and re-instantiating the SDK each time.
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // In Server Components, cookies can't be set (read-only); ignore.
          }
        },
      },
    }
  );
});

// getUser() always re-validates the JWT against the Supabase Auth server
// (by design — it never trusts the local session cookie). Without this,
// the layout and every page/route handler that needs the user pay that
// network round trip separately. Caching per request collapses them to one.
export const getAuthUser = cache(async function getAuthUser() {
  const supabase = await createClient();
  return supabase.auth.getUser();
});
