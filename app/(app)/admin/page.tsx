import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminUsersClient } from "@/components/admin/admin-users-client";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, email, avatar_url, is_admin, created_at")
    .order("created_at", { ascending: true });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>User Management</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          View all registered users, their tasks, and manage admin access.
        </p>
      </div>
      <AdminUsersClient users={users ?? []} currentUserId={user.id} />
    </div>
  );
}
