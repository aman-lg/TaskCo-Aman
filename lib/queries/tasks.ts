import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

export type AssigneeProfile = {
  user_id: string;
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

export type ChecklistCount = { id: string; is_done: boolean };

export type TaskWithMeta = Database["public"]["Tables"]["tasks"]["Row"] & {
  creator: { id: string; full_name: string | null; avatar_url: string | null } | null;
  task_assignees: AssigneeProfile[];
  task_checklist_items: ChecklistCount[];
};

export type ChecklistItem = Database["public"]["Tables"]["task_checklist_items"]["Row"];

export async function getTasksForProject(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<TaskWithMeta[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `*,
       creator:profiles!created_by(id, full_name, avatar_url),
       task_assignees(user_id, assignee:profiles!user_id(id, full_name, avatar_url)),
       task_checklist_items(id, is_done)`
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TaskWithMeta[];
}

export async function getAllTasks(supabase: SupabaseClient<Database>): Promise<TaskWithMeta[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `*,
       creator:profiles!created_by(id, full_name, avatar_url),
       task_assignees(user_id, assignee:profiles!user_id(id, full_name, avatar_url)),
       task_checklist_items(id, is_done)`
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TaskWithMeta[];
}

export type TaskDetail = Database["public"]["Tables"]["tasks"]["Row"] & {
  creator: { id: string; full_name: string | null; avatar_url: string | null } | null;
  task_assignees: AssigneeProfile[];
  task_checklist_items: ChecklistItem[];
};

export async function getTaskById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<TaskDetail | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `*,
       creator:profiles!created_by(id, full_name, avatar_url),
       task_assignees(user_id, assignee:profiles!user_id(id, full_name, avatar_url)),
       task_checklist_items(id, content, is_done, position, created_at)`
    )
    .eq("id", id)
    .single();
  if (error) return null;
  return data as unknown as TaskDetail;
}
