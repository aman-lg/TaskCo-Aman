-- ─────────────────────────────────────────────
-- msg_select excluded any row with deleted_at set, but the app's own UI
-- (message-bubble.tsx) is built to render those rows as a "This message was
-- deleted" placeholder, not remove them — the RLS policy was hiding them
-- from existence instead. Worse: because Realtime's postgres_changes
-- authorization re-checks this same SELECT policy against a row's NEW state,
-- the UPDATE that sets deleted_at made the row fail the policy for
-- EVERYONE the instant it was deleted, so the deletion event never reached
-- any other member's client at all — "delete for everyone" only ever
-- applied locally for the person who clicked it, and only until their next
-- refetch, which then also lost the row entirely instead of showing the
-- placeholder.
--
-- Fix: keep deleted-for-everyone messages selectable (content is already
-- nulled out server-side, so there's nothing sensitive left to expose) —
-- only "deleted for me" should actually remove a row from what a given user
-- can see, which is what NOT (auth.uid() = ANY(deleted_for_me)) already did
-- correctly on its own.
-- ─────────────────────────────────────────────

drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated
  using (
    public.is_conversation_member(conversation_id)
    and not (auth.uid() = any(deleted_for_me))
  );
