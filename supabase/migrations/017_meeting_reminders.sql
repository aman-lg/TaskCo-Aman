-- ─────────────────────────────────────────────
-- Meeting reminders: notify the host 5 minutes before a confirmed meeting.
--
-- IMPORTANT: enable the "pg_cron" extension first via
--   Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable
-- before running this file — the CREATE EXTENSION statement below is a
-- fallback in case the SQL editor has permission to do it directly, but the
-- dashboard toggle is more reliable across projects.
-- ─────────────────────────────────────────────

create extension if not exists pg_cron;

alter type public.notification_type add value if not exists 'meeting_reminder';

-- Tracks whether the 5-minute-before reminder has already fired for this
-- booking, so the once-a-minute cron job below never double-notifies.
alter table public.bookings add column if not exists reminder_sent boolean not null default false;

create or replace function public.send_meeting_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  select
    b.host_id,
    'meeting_reminder',
    'Meeting starting soon',
    b.requester_name || ' — starts in 5 minutes',
    'booking',
    b.id
  from public.bookings b
  where b.status = 'confirmed'
    and b.reminder_sent = false
    and b.start_at between now() + interval '4 minutes' and now() + interval '6 minutes';

  update public.bookings
  set reminder_sent = true
  where status = 'confirmed'
    and reminder_sent = false
    and start_at between now() + interval '4 minutes' and now() + interval '6 minutes';
end;
$$;

-- Runs every minute; the 4-6 minute window above means each qualifying
-- booking gets exactly one reminder even though the job checks frequently.
select cron.schedule(
  'meeting-reminders-every-minute',
  '* * * * *',
  $$select public.send_meeting_reminders();$$
);
