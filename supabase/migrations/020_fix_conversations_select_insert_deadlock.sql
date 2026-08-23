-- ─────────────────────────────────────────────
-- The real root cause of "creating any conversation always fails":
--
-- Every insert into conversations does `.select().single()` afterward to get
-- the new row's id (needed immediately to insert the creator's own
-- conversation_members row). That .select() makes PostgREST issue
-- `INSERT ... RETURNING *`, and returning a row requires it to pass the
-- table's SELECT policy too — not just the INSERT policy.
--
-- conv_select was `using (is_conversation_member(id))`, which queries
-- conversation_members. But a brand-new conversation has no member row yet —
-- that's created in the NEXT step, using the id this insert is supposed to
-- return. Classic chicken-and-egg: can't see the row until you're a member,
-- can't become a member until you have the row's id. This surfaced as a
-- generic "violates row-level security policy" error on the INSERT itself,
-- which is what made it so hard to isolate — every other check (auth.uid()
-- resolution, policy text, grants, triggers, table structure) was correct.
--
-- Fix: let a conversation's own creator see it immediately, independent of
-- membership. This doesn't change steady-state visibility at all — the
-- creator is always added as a member seconds later anyway — it just closes
-- the gap during that single INSERT...RETURNING statement.
-- ─────────────────────────────────────────────

drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations for select to authenticated
  using (is_conversation_member(id) or created_by = auth.uid());

-- Restore the real insert check (a `with check (true)` was used transiently
-- while diagnosing — this puts back the correct, narrow one).
drop policy if exists conv_insert on public.conversations;
create policy conv_insert on public.conversations for insert to authenticated
  with check (created_by = auth.uid());

-- Clean up diagnostic-only artifacts created while investigating this — both
-- turned out to be unrelated to the real cause and are no longer needed.
drop function if exists public.debug_whoami();
drop function if exists public.matches_auth_uid(uuid);
