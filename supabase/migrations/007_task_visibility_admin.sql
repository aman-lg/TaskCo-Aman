-- Migration 007: Task visibility per-user + admin role
-- Run order: after 006_checklist_activity.sql

-- ─────────────────────────────────────────────
-- 1. Add is_admin to profiles
-- ─────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ─────────────────────────────────────────────
-- 2. Helper: is current user an admin?
-- ─────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ─────────────────────────────────────────────
-- 3. Update tasks SELECT policy
--    Users see: tasks they created OR are assigned to OR admins see all
-- ─────────────────────────────────────────────
drop policy if exists tasks_select on public.tasks;

create policy tasks_select on public.tasks
  for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.task_assignees
      where task_id = tasks.id and user_id = auth.uid()
    )
    or public.is_admin()
  );

-- ─────────────────────────────────────────────
-- 4. Update task_assignees SELECT policy
--    Users see assignee rows for tasks they can access
-- ─────────────────────────────────────────────
drop policy if exists ta_select on public.task_assignees;

create policy ta_select on public.task_assignees
  for select to authenticated
  using (
    user_id = auth.uid()
    or assigned_by = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.tasks
      where tasks.id = task_id and tasks.created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 5. Update task_checklist_items SELECT policy
-- ─────────────────────────────────────────────
drop policy if exists tci_select on public.task_checklist_items;

create policy tci_select on public.task_checklist_items
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tasks
      where tasks.id = task_id
        and (
          tasks.created_by = auth.uid()
          or exists (
            select 1 from public.task_assignees
            where task_id = tasks.id and user_id = auth.uid()
          )
        )
    )
  );

-- ─────────────────────────────────────────────
-- 6. Allow admins to update any profile's is_admin field
-- ─────────────────────────────────────────────
drop policy if exists profiles_update on public.profiles;

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
