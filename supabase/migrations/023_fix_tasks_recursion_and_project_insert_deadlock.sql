-- ─────────────────────────────────────────────
-- Fix two more issues surfaced by testing the lockdown end-to-end:
--
-- 1. "infinite recursion detected in policy for relation tasks"
--    tasks_select checks "am I an assignee?" by querying task_assignees.
--    022's ta_select checks project membership by querying tasks. Each
--    policy's inner query fires the OTHER table's policy, which fires the
--    first again — a mutual recursion between two different tables, same
--    failure mode as the project_members self-recursion, just spread across
--    two policies instead of one.
--    Fix: route the assignee check through a SECURITY DEFINER function too,
--    same pattern as is_project_member — its internal query doesn't
--    re-trigger ta_select, breaking the cycle from the tasks_select side.
--
-- 2. "new row violates row-level security policy for table projects" on
--    creating a project. Same root cause as the conversations bug fixed
--    earlier this session: creating a project does .select() to get its id
--    back (needed immediately to add the creator as a project_members row),
--    which requires the new row to pass projects_select for the RETURNING
--    clause — but that member row doesn't exist yet; it's created by an
--    AFTER INSERT trigger that hasn't run relative to RETURNING. Fix: let
--    the owner see their own project directly, independent of membership,
--    exactly like conversations' created_by = auth.uid() fix.
-- ─────────────────────────────────────────────

create or replace function public.is_task_assignee(check_task_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.task_assignees
    where task_id = check_task_id and user_id = auth.uid()
  );
$$;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_task_assignee(tasks.id)
    or public.is_project_member(tasks.project_id)
    or public.is_admin()
  );

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_project_member(id)
    or public.is_admin()
  );
