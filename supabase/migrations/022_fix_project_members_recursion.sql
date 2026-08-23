-- ─────────────────────────────────────────────
-- Fix: "infinite recursion detected in policy for relation project_members"
--
-- pm_select's policy checked membership by querying project_members from
-- WITHIN its own policy on project_members — a classic self-referential RLS
-- trap. Evaluating the policy required re-evaluating the same policy for the
-- inner query, forever. This broke every policy from 021 that checks project
-- membership (projects, tasks, task_assignees, task_checklist_items,
-- task_links, activity_log all query project_members internally), since
-- their inner EXISTS against project_members hit the same recursive policy.
--
-- Fix: route the membership check through a SECURITY DEFINER function,
-- exactly like is_conversation_member() already does for chat (proven
-- working in this exact codebase). The function's internal query executes
-- as its owner (the table owner), which isn't subject to RLS at all here
-- (FORCE ROW LEVEL SECURITY is off), so there's nothing left to recurse on.
-- ─────────────────────────────────────────────

create or replace function public.is_project_member(check_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = check_project_id and user_id = auth.uid()
  );
$$;

drop policy if exists pm_select on public.project_members;
create policy pm_select on public.project_members for select to authenticated
  using (
    auth.uid() = user_id
    or public.is_project_member(project_id)
  );

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    public.is_project_member(id)
    or public.is_admin()
  );

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.task_assignees where task_id = tasks.id and user_id = auth.uid())
    or public.is_project_member(tasks.project_id)
    or public.is_admin()
  );

drop policy if exists ta_select on public.task_assignees;
create policy ta_select on public.task_assignees for select to authenticated
  using (
    user_id = auth.uid()
    or assigned_by = auth.uid()
    or exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id and public.is_project_member(t.project_id)
    )
    or public.is_admin()
  );

drop policy if exists tci_select on public.task_checklist_items;
create policy tci_select on public.task_checklist_items for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = task_checklist_items.task_id
        and (
          t.created_by = auth.uid()
          or exists (select 1 from public.task_assignees ta where ta.task_id = t.id and ta.user_id = auth.uid())
          or public.is_project_member(t.project_id)
        )
    )
  );

drop policy if exists tl_select on public.task_links;
create policy tl_select on public.task_links for select to authenticated
  using (
    public.is_task_collaborator(task_id)
    or public.is_admin()
    or exists (
      select 1 from public.tasks t
      where t.id = task_links.task_id and public.is_project_member(t.project_id)
    )
  );

drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select to authenticated
  using (
    actor_id = auth.uid()
    or public.is_admin()
    or (project_id is not null and public.is_project_member(activity_log.project_id))
  );
