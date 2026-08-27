-- ─────────────────────────────────────────────
-- Task attachments: an uploaded file attached to a task. Visibility
-- mirrors tasks_select (creator, assignee, or project member) — an
-- attachment is only as visible as the task it belongs to. Mirrors
-- project_files (026_project_files.sql) exactly, one level down.
-- ─────────────────────────────────────────────

create table public.task_files (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  added_by     uuid not null references public.profiles(id),
  name         text not null,
  storage_path text not null,
  size         bigint,
  mime         text,
  created_at   timestamptz not null default now()
);

create index idx_task_files_task on public.task_files(task_id, created_at desc);

alter table public.task_files enable row level security;

create policy task_files_select on public.task_files for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_files.task_id
        and (
          t.created_by = auth.uid()
          or exists (select 1 from public.task_assignees ta where ta.task_id = t.id and ta.user_id = auth.uid())
          or public.is_project_member(t.project_id)
        )
    )
    or public.is_admin()
  );

create policy task_files_insert on public.task_files for insert to authenticated
  with check (
    added_by = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_files.task_id
        and (
          t.created_by = auth.uid()
          or exists (select 1 from public.task_assignees ta where ta.task_id = t.id and ta.user_id = auth.uid())
          or public.is_project_member(t.project_id)
        )
    )
  );

create policy task_files_delete on public.task_files for delete to authenticated
  using (
    added_by = auth.uid()
    or exists (select 1 from public.tasks t where t.id = task_files.task_id and t.created_by = auth.uid())
    or public.is_admin()
  );

-- Private bucket — every read/write goes through the app's API routes, which
-- check task visibility before touching storage (no direct client access,
-- so no storage.objects RLS policies are needed).
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 26214400)
on conflict (id) do nothing;
