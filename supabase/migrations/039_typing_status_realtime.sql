-- ─────────────────────────────────────────────
-- 038 created typing_status but never added it to the supabase_realtime
-- publication (every other realtime table — messages, message_reads,
-- polls, etc. — has this in 011_chat.sql; this one was missed). Without
-- it, Postgres never streams changes to Supabase Realtime at all, so
-- postgres_changes subscriptions on this table silently never fire —
-- confirmed live: the POST that upserts a row succeeds every time (200,
-- correct row in the table), but nothing ever reaches the other person.
-- ─────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'typing_status'
  ) then
    alter publication supabase_realtime add table public.typing_status;
  end if;
end $$;
