import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

export type ProjectWithOwner = Database["public"]["Tables"]["projects"]["Row"] & {
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

export async function getProjects(supabase: SupabaseClient<Database>): Promise<ProjectWithOwner[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*, owner:profiles!owner_id(id, full_name, avatar_url)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectWithOwner[];
}

export async function getProjectById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<ProjectWithOwner | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*, owner:profiles!owner_id(id, full_name, avatar_url)")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as ProjectWithOwner;
}
