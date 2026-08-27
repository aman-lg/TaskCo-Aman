import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAllTasks } from "@/lib/queries/tasks";
import { getProjects } from "@/lib/queries/projects";
import { TasksGrid } from "@/components/tasks/tasks-grid";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await getAuthUser();

  const [tasks, projects] = await Promise.all([
    getAllTasks(supabase),
    getProjects(supabase),
  ]);

  return (
    <TasksGrid
      tasks={tasks}
      projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      currentUserName={(user?.user_metadata?.full_name as string | null) ?? user?.email ?? "You"}
    />
  );
}
