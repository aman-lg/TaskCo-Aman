-- ─────────────────────────────────────────────
-- Fix: deleting a project that has tasks in it still 500'd.
--
-- Migration 015 fixed logging the *project's own* deletion, but missed that
-- deleting a project cascades (ON DELETE CASCADE) to its tasks — and each of
-- those cascaded task deletions fires this same trigger, which set
-- v_project_id := OLD.project_id. By the time that fires, the parent project
-- row is already gone (it was deleted first, before its cascade), so the
-- activity_log.project_id foreign key violates again, just one level down.
--
-- Fix: only use OLD.project_id for a deleted task if that project still
-- actually exists — true for a standalone task delete, false when the task
-- was cascade-deleted along with its parent project.
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
  case TG_TABLE_NAME
    when 'projects'       then v_entity_type := 'project';
    when 'tasks'          then v_entity_type := 'task';
    when 'task_assignees' then v_entity_type := 'task_assignee';
    else v_entity_type := TG_TABLE_NAME;
  end case;

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
        v_project_id := null; -- OLD.id no longer exists by the time this INSERT runs
        v_metadata   := jsonb_build_object('title', OLD.title);
      when 'tasks' then
        v_entity_id  := OLD.id;
        -- fix: only reference the parent project if it still exists — it
        -- won't if this task was cascade-deleted along with that project
        if exists (select 1 from public.projects where id = OLD.project_id) then
          v_project_id := OLD.project_id;
        else
          v_project_id := null;
        end if;
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
