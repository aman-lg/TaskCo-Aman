-- Migration 005: Reporting Views + RPC
-- Run order: after 004_rls.sql
-- Views use security_invoker = on so personal-table RLS is respected

-- ─────────────────────────────────────────────
-- v_task_total_time
-- Total effort seconds per task (includes running timers via coalesce)
-- ─────────────────────────────────────────────
create view public.v_task_total_time with (security_invoker = on) as
select
  task_id,
  coalesce(
    sum(
      extract(epoch from (coalesce(ended_at, now()) - started_at))
    )::bigint,
    0
  ) as total_seconds
from public.task_time_entries
group by task_id;

-- ─────────────────────────────────────────────
-- v_daily_attendance
-- Per-user, per-IST-day worked + extra seconds
-- ─────────────────────────────────────────────
create view public.v_daily_attendance with (security_invoker = on) as
select
  user_id,
  ist_date,
  coalesce(
    sum(
      extract(epoch from (coalesce(check_out_at, now()) - check_in_at))
    )::bigint,
    0
  ) as worked_seconds,
  greatest(
    0,
    coalesce(
      sum(
        extract(epoch from (coalesce(check_out_at, now()) - check_in_at))
      )::bigint,
      0
    ) - 8 * 3600
  ) as extra_seconds
from public.attendance_sessions
group by user_id, ist_date;

-- ─────────────────────────────────────────────
-- get_my_dashboard()
-- Flat/team-wide counts via RLS (caller sees what their RLS allows)
-- ─────────────────────────────────────────────
create or replace function public.get_my_dashboard()
returns json
language sql
stable
security invoker
as $$
  select json_build_object(
    'total_tasks',   (select count(*) from public.tasks),
    'urgent_tasks',  (select count(*) from public.tasks
                      where urgency in ('high', 'urgent') and status <> 'done'),
    'pending_tasks', (select count(*) from public.tasks where status <> 'done'),
    'project_count', (select count(*) from public.projects where status = 'active')
  );
$$;
