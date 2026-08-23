-- ─────────────────────────────────────────────
-- Fix: deleting a project always failed with a 500.
--
-- log_activity()'s DELETE branch for 'projects' set v_project_id := OLD.id,
-- then inserted a new activity_log row referencing that project_id. But
-- activity_log.project_id has `references public.projects(id)`, and by the
-- time this AFTER DELETE trigger's INSERT runs, the project row is already
-- gone — violating its own foreign key and failing the whole DELETE.
--
-- Fix: log the deletion with project_id = NULL instead (the column is
-- nullable). The project's own row (and its cascade-deleted activity_log
-- history) is gone either way; this only affects the final "deleted" audit
-- entry, which can no longer point at a project that no longer exists.
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
        v_project_id := null; -- fix: OLD.id no longer exists by the time this INSERT runs
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
