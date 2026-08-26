-- ─────────────────────────────────────────────
-- 030's new tasks_select/projects_select clauses queried tasks/task_assignees
-- directly with a raw EXISTS instead of routing through a SECURITY DEFINER
-- function — reproduced live: "infinite recursion detected in policy for
-- relation task_assignees" on a plain project insert. Same root cause as the
-- project_members/tasks recursion fixed earlier this session (022/023):
-- a policy's inline subquery against another RLS-protected table re-triggers
-- that table's own policy, which references back, forever.
--
-- Fix: consolidate the "is auth.uid() a dept lead/facilitator of this task's
-- creator or any of its assignees" check into one SECURITY DEFINER function.
-- Its internal queries run as the function owner and bypass RLS entirely,
-- exactly like is_project_member/is_task_assignee/is_dept_lead_of already do.
-- ─────────────────────────────────────────────

create or replace function public.is_dept_lead_of_task(check_task_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = check_task_id
      and (
        public.is_dept_lead_of(t.created_by)
        or exists (
          select 1 from public.task_assignees ta
          where ta.task_id = t.id and public.is_dept_lead_of(ta.user_id)
        )
      )
  );
$$;

create or replace function public.project_has_lead_visible_task(check_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.project_id = check_project_id and public.is_dept_lead_of_task(t.id)
  );
$$;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_task_assignee(tasks.id)
    or public.is_project_member(tasks.project_id)
    or public.is_admin()
    or public.has_global_visibility()
    or public.is_dept_lead_of_task(tasks.id)
  );

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_project_member(id)
    or public.is_admin()
    or public.has_global_visibility()
    or public.project_has_lead_visible_task(id)
  );
