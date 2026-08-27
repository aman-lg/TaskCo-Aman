-- ─────────────────────────────────────────────
-- Typing indicator, take two. The original implementation used Supabase
-- Realtime *presence* (channel.track/presenceState) — live-tested with two
-- real logged-in sessions, and confirmed the sender's own track() call
-- consistently succeeds and is visible on their own client, but the
-- presence diff does not reliably reach the other person even on a
-- healthy, still-subscribed channel. That's a channel-layer reliability
-- gap, not an app bug, and there's no client-side retry that fixes it
-- (verified: reconfirmed 100% failure across repeated live runs even with
-- a short re-broadcast heartbeat).
--
-- This replaces it with the same mechanism already proven reliable for
-- messages: a real row + postgres_changes, which benefits from the
-- realtime auth-refresh fix and the periodic resync fallback already
-- built for messages. "Typing" is just "this row's updated_at is recent"
-- — no explicit stop signal needed, so no delete policy either.
-- ─────────────────────────────────────────────

create table public.typing_status (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  updated_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.typing_status enable row level security;

create policy typing_status_select on public.typing_status for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy typing_status_insert on public.typing_status for insert to authenticated
  with check (user_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy typing_status_update on public.typing_status for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
