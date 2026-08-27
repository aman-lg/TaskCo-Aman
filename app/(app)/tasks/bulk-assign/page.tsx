import { createClient } from "@/lib/supabase/server";
import { getProjects } from "@/lib/queries/projects";
import { BulkAssignGrid } from "@/components/tasks/bulk-assign-grid";

export default async function BulkAssignPage() {
  const supabase = await createClient();
  const projects = await getProjects(supabase);

  return (
    <BulkAssignGrid projects={projects.map((p) => ({ id: p.id, title: p.title }))} />
  );
}
