-- ─────────────────────────────────────────────
-- Full lockdown: projects/tasks are no longer visible to every authenticated
-- user by default — only to people actually involved with them.
--
-- Diagnosed first: migration 007 (task_visibility_admin) WAS already applied
-- — tasks_select already restricts to creator/assignee/admin. But migration
-- 010 (project_members) was NEVER applied — the project_members table didn't
-- exist at all, and projects_select was still the original `using (true)`
-- from 004_rls.sql (every authenticated user could see every project).
--
-- This migration:
--   1. Creates the project_members feature from scratch (010's content,
--      made idempotent) — the UI for managing members already exists
--      (ProjectMembersPanel), it just had no table to read/write.
--   2. Extends tasks/task_assignees/task_checklist_items/task_links, which
--      007 scoped to creator/assignee only, to ALSO recognize project
--      membership — otherwise adding someone as a project member would let
--      them see the project exists but none of its tasks, making the
--      project_members feature pointless for actual collaboration.
--   3. Locks down activity_log the same way (was also `using (true)`).
--   4. Tightens task_time_entries to owner + admin only (personal effort
--      log, not shared task content — kept separate from the task_links/
--      checklist treatment above).
-- ─────────────────────────────────────────────

-- ── 1. project_members (from 010_project_members.sql, idempotent) ──────────

create table if not exists public.project_members (
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  added_by    uuid not null references public.profiles(id),
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists idx_project_members_user    on public.project_members(user_id);
create index if not exists idx_project_members_project on public.project_members(project_id);

-- Backfill: every existing project owner becomes a member of their own project
insert into public.project_members (project_id, user_id, added_by)
select id, owner_id, owner_id from public.projects
on conflict do nothing;

create or replace function public.add_project_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, added_by)
  values (new.id, new.owner_id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created_add_owner on public.projects;
create trigger on_project_created_add_owner
  after insert on public.projects
  for each row execute function public.add_project_owner_as_member();

alter table public.project_members enable row level security;

drop policy if exists pm_select on public.project_members;
create policy pm_select on public.project_members for select to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.project_members pm2
               where pm2.project_id = project_members.project_id and pm2.user_id = auth.uid())
  );

drop policy if exists pm_insert on public.project_members;
create policy pm_insert on public.project_members for insert to authenticated
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists pm_delete on public.project_members;
create policy pm_delete on public.project_members for delete to authenticated
  using (
    (
      exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
      or public.is_admin()
    )
    and user_id != (select owner_id from public.projects where id = project_id)
  );

-- ── 2. projects — member/admin only ─────────────────────────────────────────

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    exists (select 1 from public.project_members pm where pm.project_id = id and pm.user_id = auth.uid())
    or public.is_admin()
  );

-- ── 3. tasks — extend 007's creator/assignee/admin to also include project members ──

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.task_assignees where task_id = tasks.id and user_id = auth.uid())
    or exists (select 1 from public.project_members where project_id = tasks.project_id and user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists ta_select on public.task_assignees;
create policy ta_select on public.task_assignees for select to authenticated
  using (
    user_id = auth.uid()
    or assigned_by = auth.uid()
    or exists (
      select 1 from public.tasks t
      join public.project_members pm on pm.project_id = t.project_id
      where t.id = task_assignees.task_id and pm.user_id = auth.uid()
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
          or exists (select 1 from public.project_members pm where pm.project_id = t.project_id and pm.user_id = auth.uid())
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
      join public.project_members pm on pm.project_id = t.project_id
      where t.id = task_links.task_id and pm.user_id = auth.uid()
    )
  );

-- ── 4. task_time_entries — personal effort log: owner + admin only, NOT
--       extended to project members (unlike the task content above) ────────

drop policy if exists tte_select on public.task_time_entries;
create policy tte_select on public.task_time_entries for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ── 5. activity_log — scoped to project members (or the actor's own entries,
--       which also covers the project_id=NULL "project deleted" audit rows) ──

drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select to authenticated
  using (
    actor_id = auth.uid()
    or public.is_admin()
    or (
      project_id is not null
      and exists (select 1 from public.project_members pm where pm.project_id = activity_log.project_id and pm.user_id = auth.uid())
    )
  );
