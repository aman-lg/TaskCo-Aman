import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

export type AssigneeProfile = {
  user_id: string;
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

export type ChecklistCount = { id: string; is_done: boolean; content: string | null; position: number | null };

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
       task_checklist_items(id, is_done, content, position)`
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
       task_checklist_items(id, is_done, content, position)`
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TaskWithMeta[];
}

export async function getTaskStats(supabase: SupabaseClient<Database>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("tasks").select("id, status, deadline");
  if (error) throw new Error(error.message);
  type Row = { id: string; status: string | null; deadline: string | null };
  const tasks = (data ?? []) as Row[];
  const today = new Date().toDateString();
  const completed = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const todo = tasks.filter((t) => t.status === "todo").length;

  // Deadline counts grouped by date (past 14 + future 14 days)
  const deadlineDateMap: Record<string, { pending: number; done: number }> = {};
  for (const t of tasks) {
    if (!t.deadline) continue;
    const d = t.deadline.slice(0, 10);
    if (!deadlineDateMap[d]) deadlineDateMap[d] = { pending: 0, done: 0 };
    if (t.status === "done") deadlineDateMap[d].done++;
    else deadlineDateMap[d].pending++;
  }

  return {
    total: tasks.length,
    completed,
    inProgress,
    todo,
    pending: inProgress + todo,
    dueToday: tasks.filter((t) => t.deadline && new Date(t.deadline).toDateString() === today).length,
    deadlineDates: tasks
      .filter((t) => t.deadline)
      .map((t) => ({ date: t.deadline!.slice(0, 10), done: t.status === "done" })),
    statusBreakdown: [
      { name: "Done", value: completed, color: "var(--clr-green)" },
      { name: "In Progress", value: inProgress, color: "var(--accent-brand)" },
      { name: "To Do", value: todo, color: "var(--line)" },
    ],
  };
}

export type TodayTask = {
  id: string;
  name: string;
  status: string;
  urgency: string | null;
  deadline: string | null;
  project_id: string;
};

export async function getTodayTasks(supabase: SupabaseClient<Database>): Promise<TodayTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("tasks")
    .select("id, name, status, urgency, deadline, project_id")
    .neq("status", "done")
    .order("urgency", { ascending: false });
  if (error) return [];
  type Row = { id: string; name: string; status: string; urgency: string | null; deadline: string | null; project_id: string };
  const rows = (data ?? []) as Row[];
  const todayStr = new Date().toDateString();
  // Show tasks due today + in_progress tasks (max 10)
  const dueToday = rows.filter((t) => t.deadline && new Date(t.deadline).toDateString() === todayStr);
  const inProgress = rows.filter((t) => t.status === "in_progress" && !dueToday.find((d) => d.id === t.id));
  return [...dueToday, ...inProgress].slice(0, 10);
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
