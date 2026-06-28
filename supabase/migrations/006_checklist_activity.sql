-- ─────────────────────────────────────────────
-- Migration 006: extend activity log to cover task_checklist_items
-- Run in Supabase SQL editor.
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
    when 'projects'             then v_entity_type := 'project';
    when 'tasks'                then v_entity_type := 'task';
    when 'task_assignees'       then v_entity_type := 'task_assignee';
    when 'task_checklist_items' then v_entity_type := 'checklist_item';
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
      when 'task_checklist_items' then
        v_entity_id  := NEW.id;
        v_project_id := (select project_id from public.tasks where id = NEW.task_id);
        v_metadata   := jsonb_build_object('content', NEW.content, 'task_id', NEW.task_id);
      else return NEW;
    end case;

  elsif TG_OP = 'UPDATE' then
    case TG_TABLE_NAME
      when 'projects' then
        v_entity_id  := NEW.id;
        v_project_id := NEW.id;
        if OLD.status <> NEW.status then
          v_action   := 'status_changed';
          v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status, 'title', NEW.title);
        else
          v_action   := 'updated';
          v_metadata := jsonb_build_object('title', NEW.title);
        end if;
      when 'tasks' then
        v_entity_id  := NEW.id;
        v_project_id := NEW.project_id;
        if OLD.status <> NEW.status then
          v_action   := 'status_changed';
          v_metadata := jsonb_build_object('from', OLD.status, 'to', NEW.status, 'name', NEW.name);
        else
          v_action   := 'updated';
          v_metadata := jsonb_build_object('name', NEW.name);
        end if;
      when 'task_checklist_items' then
        v_entity_id  := NEW.id;
        v_project_id := (select project_id from public.tasks where id = NEW.task_id);
        if OLD.is_done <> NEW.is_done then
          v_action   := case when NEW.is_done then 'checked' else 'unchecked' end;
          v_metadata := jsonb_build_object('content', NEW.content, 'task_id', NEW.task_id);
        else
          return NEW;
        end if;
      else return NEW;
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
      when 'task_checklist_items' then
        v_entity_id  := OLD.id;
        v_project_id := (select project_id from public.tasks where id = OLD.task_id);
        v_metadata   := jsonb_build_object('content', OLD.content, 'task_id', OLD.task_id);
      else return OLD;
    end case;
  end if;

  if v_entity_id is null then
    return coalesce(NEW, OLD);
  end if;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, project_id, metadata)
  values (auth.uid(), v_action, v_entity_type, v_entity_id, v_project_id, v_metadata);

  return coalesce(NEW, OLD);
end;
$$;

-- Add trigger for checklist items (other triggers already exist)
drop trigger if exists trg_log_checklist_items on public.task_checklist_items;
create trigger trg_log_checklist_items
  after insert or update or delete on public.task_checklist_items
  for each row execute function public.log_activity();
