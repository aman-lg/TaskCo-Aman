-- Migration 003: Functions + Triggers
-- Run order: after 002_tables.sql

-- ─────────────────────────────────────────────
-- Mirror new auth users into profiles
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- updated_at maintenance
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_projects_updated
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger trg_tasks_updated
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger trg_events_updated
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- Collaborator check for checklist/link RLS
-- ─────────────────────────────────────────────
create or replace function public.is_task_collaborator(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.created_by = auth.uid()
  )
  or exists (
    select 1 from public.task_assignees a
    where a.task_id = p_task_id and a.user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────
-- Notify assignee on task assignment
-- ─────────────────────────────────────────────
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_name text;
begin
  select name into v_task_name from public.tasks where id = new.task_id;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    new.user_id,
    'task_assigned',
    'New task assigned',
    v_task_name,
    'task',
    new.task_id
  );
  return new;
end;
$$;

create trigger trg_notify_task_assigned
  after insert on public.task_assignees
  for each row execute function public.notify_task_assigned();

-- ─────────────────────────────────────────────
-- Activity log trigger (projects + tasks + task_assignees)
-- ─────────────────────────────────────────────
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_type text;
  v_entity_id   uuid;
  v_project_id  uuid;
  v_action      text;
  v_metadata    jsonb;
begin
  -- Determine entity type
  case TG_TABLE_NAME
    when 'projects'       then v_entity_type := 'project';
    when 'tasks'          then v_entity_type := 'task';
    when 'task_assignees' then v_entity_type := 'task_assignee';
    else v_entity_type := TG_TABLE_NAME;
  end case;

  -- Determine action + IDs
  if TG_OP = 'INSERT' then
    v_action := 'created';
    case TG_TABLE_NAME
      when 'projects' then
        v_entity_id  := NEW.id;
        v_project_id := NEW.id;
        v_metadata   := jsonb_build_object('title', NEW.title, 'status', NEW.status);
      when 'tasks' then
        v_entity_id  := NEW.id;
        v_project_id := NEW.project_id;
        v_metadata   := jsonb_build_object('name', NEW.name, 'status', NEW.status);
      when 'task_assignees' then
        v_action     := 'assigned';
        v_entity_id  := NEW.task_id;
        v_project_id := (select project_id from public.tasks where id = NEW.task_id);
        v_metadata   := jsonb_build_object('assignee_id', NEW.user_id);
    end case;

  elsif TG_OP = 'UPDATE' then
    case TG_TABLE_NAME
      when 'projects' then
        v_entity_id  := NEW.id;
        v_project_id := NEW.id;
        if OLD.status <> NEW.status then
          v_action   := 'status_changed';
          v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
        else
          v_action   := 'updated';
          v_metadata := jsonb_build_object('title', NEW.title);
        end if;
      when 'tasks' then
        v_entity_id  := NEW.id;
        v_project_id := NEW.project_id;
        if OLD.status <> NEW.status then
          v_action   := 'status_changed';
          v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status);
        else
          v_action   := 'updated';
          v_metadata := jsonb_build_object('name', NEW.name);
        end if;
      else
        return NEW;
    end case;

  elsif TG_OP = 'DELETE' then
    v_action := 'deleted';
    case TG_TABLE_NAME
      when 'projects' then
        v_entity_id  := OLD.id;
        v_project_id := OLD.id;
        v_metadata   := jsonb_build_object('title', OLD.title);
      when 'tasks' then
        v_entity_id  := OLD.id;
        v_project_id := OLD.project_id;
        v_metadata   := jsonb_build_object('name', OLD.name);
      when 'task_assignees' then
        v_action     := 'unassigned';
        v_entity_id  := OLD.task_id;
        v_project_id := (select project_id from public.tasks where id = OLD.task_id);
        v_metadata   := jsonb_build_object('assignee_id', OLD.user_id);
    end case;
  end if;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, project_id, metadata)
  values (auth.uid(), v_action, v_entity_type, v_entity_id, v_project_id, v_metadata);

  return coalesce(NEW, OLD);
end;
$$;

create trigger trg_log_projects
  after insert or update or delete on public.projects
  for each row execute function public.log_activity();

create trigger trg_log_tasks
  after insert or update or delete on public.tasks
  for each row execute function public.log_activity();

create trigger trg_log_task_assignees
  after insert or delete on public.task_assignees
  for each row execute function public.log_activity();
