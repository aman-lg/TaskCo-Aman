import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

/**
 * AppLayout — server component.
 *
 * Fetches the authenticated user once at layout render time so the Topbar can
 * show the correct name/avatar without a client-side useEffect waterfall.
 * The client boundary is pushed down to <AppShell>, which owns sidebar
 * collapse state and the logout action.
 *
 * Security: getUser() verifies the JWT with the Supabase Auth server on every
 * call — it does not trust the client-accessible session cookie directly.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dbProfile } = user ? await (supabase as any)
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single() : { data: null };

  const profile = user
    ? {
        name:    (user.user_metadata?.full_name as string | null) ?? null,
        email:   user.email ?? null,
        avatar:  (user.user_metadata?.avatar_url as string | null) ?? null,
        isAdmin: (dbProfile as { is_admin: boolean } | null)?.is_admin ?? false,
      }
    : null;

  return <AppShell profile={profile}>{children}</AppShell>;
}
