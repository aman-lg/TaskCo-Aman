import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

export type ActivityEntry = {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  project_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string | null; avatar_url: string | null } | null;
};

export async function getProjectActivity(
  supabase: SupabaseClient<Database>,
  projectId: string,
  limit = 50
): Promise<ActivityEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("activity_log")
    .select("*, actor:profiles!actor_id(full_name, avatar_url)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityEntry[];
}
