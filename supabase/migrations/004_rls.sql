-- Migration 004: Row Level Security
-- Run order: after 003_functions_triggers.sql

-- Enable RLS on every table
alter table public.profiles             enable row level security;
alter table public.projects             enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_assignees       enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_links           enable row level security;
alter table public.task_time_entries    enable row level security;
alter table public.attendance_sessions  enable row level security;
alter table public.calendar_events      enable row level security;
alter table public.notifications        enable row level security;
alter table public.activity_log         enable row level security;

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─────────────────────────────────────────────
-- projects (team-read / owner-write)
-- ─────────────────────────────────────────────
create policy projects_select on public.projects
  for select to authenticated using (true);

create policy projects_insert on public.projects
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy projects_update on public.projects
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy projects_delete on public.projects
  for delete to authenticated
  using (owner_id = auth.uid());

-- ─────────────────────────────────────────────
-- tasks (team-read / creator-or-assignee-write)
-- ─────────────────────────────────────────────
create policy tasks_select on public.tasks
  for select to authenticated using (true);

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (created_by = auth.uid());

create policy tasks_update on public.tasks
  for update to authenticated
  using (created_by = auth.uid() or public.is_task_collaborator(id))
  with check (created_by = auth.uid() or public.is_task_collaborator(id));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (created_by = auth.uid());

-- ─────────────────────────────────────────────
-- task_assignees
-- ─────────────────────────────────────────────
create policy ta_select on public.task_assignees
  for select to authenticated using (true);

create policy ta_insert on public.task_assignees
  for insert to authenticated
  with check (assigned_by = auth.uid());

create policy ta_delete on public.task_assignees
  for delete to authenticated
  using (assigned_by = auth.uid() or user_id = auth.uid());

-- ─────────────────────────────────────────────
-- task_checklist_items (collaborator-write)
-- ─────────────────────────────────────────────
create policy tci_select on public.task_checklist_items
  for select to authenticated using (true);

create policy tci_insert on public.task_checklist_items
  for insert to authenticated
  with check (public.is_task_collaborator(task_id));

create policy tci_update on public.task_checklist_items
  for update to authenticated
  using (public.is_task_collaborator(task_id))
  with check (public.is_task_collaborator(task_id));

create policy tci_delete on public.task_checklist_items
  for delete to authenticated
  using (public.is_task_collaborator(task_id));

-- ─────────────────────────────────────────────
-- task_links (collaborator-write)
-- ─────────────────────────────────────────────
create policy tl_select on public.task_links
  for select to authenticated using (true);

create policy tl_insert on public.task_links
  for insert to authenticated
  with check (public.is_task_collaborator(task_id));

create policy tl_update on public.task_links
  for update to authenticated
  using (public.is_task_collaborator(task_id))
  with check (public.is_task_collaborator(task_id));

create policy tl_delete on public.task_links
  for delete to authenticated
  using (public.is_task_collaborator(task_id));

-- ─────────────────────────────────────────────
-- task_time_entries (own only)
-- ─────────────────────────────────────────────
create policy tte_select on public.task_time_entries
  for select to authenticated using (true);

create policy tte_insert on public.task_time_entries
  for insert to authenticated
  with check (user_id = auth.uid());

create policy tte_update on public.task_time_entries
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy tte_delete on public.task_time_entries
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- attendance_sessions (personal — own only)
-- ─────────────────────────────────────────────
create policy attend_all on public.attendance_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- calendar_events (personal — own only)
-- ─────────────────────────────────────────────
create policy events_all on public.calendar_events
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- notifications (personal; no client insert)
-- ─────────────────────────────────────────────
create policy notif_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notif_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notif_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- activity_log (team-read; no client writes)
-- ─────────────────────────────────────────────
create policy activity_select on public.activity_log
  for select to authenticated using (true);
