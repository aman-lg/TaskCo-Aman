-- ─────────────────────────────────────────────
-- Performance: missing indexes on commonly-filtered columns
-- ─────────────────────────────────────────────

-- Projects list filters by status (active/on_hold/completed/archived) in the UI;
-- this was an unindexed column, forcing a full table scan as the table grows.
create index if not exists idx_projects_status on public.projects(status);

-- Notifications are listed per-user ordered by recency; the existing
-- (user_id, is_read) index doesn't cover the ORDER BY, so Postgres had to
-- sort separately. Replacing it with a composite that includes created_at
-- lets the same index serve the filter and the sort in one pass.
drop index if exists idx_notif_user_read;
create index if not exists idx_notif_user_read on public.notifications(user_id, is_read, created_at desc);
