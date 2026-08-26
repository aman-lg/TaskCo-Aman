-- ─────────────────────────────────────────────
-- Project documents: either an uploaded file or a plain external link,
-- attached to a project. Visibility mirrors projects_select exactly
-- (owner, project_member, or admin) — a document is only as visible as
-- the project it belongs to.
-- ─────────────────────────────────────────────

create table public.project_files (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  added_by     uuid not null references public.profiles(id),
  kind         text not null check (kind in ('file', 'link')),
  name         text not null,
  storage_path text,
  url          text,
  size         bigint,
  mime         text,
  created_at   timestamptz not null default now(),
  constraint project_files_kind_fields check (
    (kind = 'file' and storage_path is not null and url is null)
    or
    (kind = 'link' and url is not null and storage_path is null)
  )
);

create index idx_project_files_project on public.project_files(project_id, created_at desc);

alter table public.project_files enable row level security;

create policy project_files_select on public.project_files for select to authenticated
  using (
    exists (select 1 from public.projects p where p.id = project_files.project_id and p.owner_id = auth.uid())
    or public.is_project_member(project_files.project_id)
    or public.is_admin()
  );

create policy project_files_insert on public.project_files for insert to authenticated
  with check (
    added_by = auth.uid()
    and (
      exists (select 1 from public.projects p where p.id = project_files.project_id and p.owner_id = auth.uid())
      or public.is_project_member(project_files.project_id)
    )
  );

create policy project_files_delete on public.project_files for delete to authenticated
  using (
    added_by = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_files.project_id and p.owner_id = auth.uid())
    or public.is_admin()
  );

-- Log project-file activity the same way projects/tasks already do.
create or replace function public.log_project_file_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return coalesce(NEW, OLD);
  end if;

  if TG_OP = 'INSERT' then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, project_id, metadata)
    values (auth.uid(), 'added', 'project_file', NEW.id, NEW.project_id, jsonb_build_object('name', NEW.name, 'kind', NEW.kind));
  elsif TG_OP = 'DELETE' then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, project_id, metadata)
    values (auth.uid(), 'removed', 'project_file', OLD.id, OLD.project_id, jsonb_build_object('name', OLD.name, 'kind', OLD.kind));
  end if;
  return coalesce(NEW, OLD);
end;
$$;

create trigger trg_log_project_files
  after insert or delete on public.project_files
  for each row execute function public.log_project_file_activity();

-- Private bucket — every read/write goes through the app's API routes, which
-- check project membership before touching storage (no direct client access,
-- so no storage.objects RLS policies are needed).
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 26214400)
on conflict (id) do nothing;
