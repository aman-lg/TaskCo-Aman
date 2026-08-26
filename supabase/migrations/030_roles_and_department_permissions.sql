-- ─────────────────────────────────────────────
-- Two independent role dimensions:
--   1. Company-wide rank on profiles.role: ceo / manager / team_member.
--      "Admin" is deliberately NOT a value here — it stays the existing
--      is_admin flag, per explicit decision to avoid two overlapping
--      concepts of "admin".
--   2. Department-scoped position on org_unit_members.unit_role: lead /
--      facilitator / member. Team Lead and Team Facilitator are properties
--      of a SPECIFIC department membership, not a global attribute of the
--      person — someone can lead Engineering while just being a plain
--      member of Sales.
--
-- Visibility rules requested:
--   - ceo, manager, admin: see every project/task/activity, company-wide.
--   - A department's Team Lead / Team Facilitator: see the to-dos (tasks,
--     by created_by or assignment) of every OTHER member of that same
--     department, plus enough project-level visibility to actually reach
--     those tasks in the UI (kanban lives under a project page).
--   - Team assignment itself already has zero role-based restriction
--     (ta_insert only requires assigned_by = auth.uid(), no ownership or
--     rank check) — matches "anyone can allocate tasks to anybody" as-is,
--     no change needed there.
-- ─────────────────────────────────────────────

create type public.company_role as enum ('ceo', 'manager', 'team_member');
alter table public.profiles add column role public.company_role not null default 'team_member';

create type public.unit_role as enum ('lead', 'facilitator', 'member');
alter table public.org_unit_members add column unit_role public.unit_role not null default 'member';

-- ceo/manager/admin all get the same broad, company-wide read visibility.
create or replace function public.has_global_visibility()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin or role in ('ceo', 'manager') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Is auth.uid() a Team Lead/Facilitator of any department that target_user_id
-- also belongs to? (Self-joins org_unit_members only — no cross-table
-- reference back into anything RLS-sensitive, so no recursion risk.)
create or replace function public.is_dept_lead_of(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.org_unit_members leader
    join public.org_unit_members member on member.unit_id = leader.unit_id
    where leader.user_id = auth.uid()
      and leader.unit_role in ('lead', 'facilitator')
      and member.user_id = target_user_id
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
    or public.is_dept_lead_of(tasks.created_by)
    or exists (
      select 1 from public.task_assignees ta
      where ta.task_id = tasks.id and public.is_dept_lead_of(ta.user_id)
    )
  );

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_project_member(id)
    or public.is_admin()
    or public.has_global_visibility()
    or exists (
      select 1 from public.tasks t
      where t.project_id = projects.id
        and (
          public.is_dept_lead_of(t.created_by)
          or exists (
            select 1 from public.task_assignees ta
            where ta.task_id = t.id and public.is_dept_lead_of(ta.user_id)
          )
        )
    )
  );

drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select to authenticated
  using (
    actor_id = auth.uid()
    or public.is_admin()
    or public.has_global_visibility()
    or (project_id is not null and public.is_project_member(activity_log.project_id))
    or public.is_dept_lead_of(activity_log.actor_id)
  );
