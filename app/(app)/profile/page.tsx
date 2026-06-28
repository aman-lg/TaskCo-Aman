import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/profile/profile-client";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, avatar_url, email, phone, created_at")
    .eq("id", user!.id)
    .single();

  return (
    <div className="max-w-[600px]">
      <h1 className="h1 mb-1" style={{ color: "var(--ink)" }}>Profile</h1>
      <p className="text-[14px] mb-8" style={{ color: "var(--text-muted)" }}>
        Manage your personal information
      </p>
      <ProfileClient
        profile={{
          id: user!.id,
          full_name: (profile as { full_name: string | null } | null)?.full_name ?? null,
          avatar_url: (profile as { avatar_url: string | null } | null)?.avatar_url ?? null,
          email: user!.email ?? null,
          phone: (profile as { phone: string | null } | null)?.phone ?? null,
        }}
      />
    </div>
  );
}
