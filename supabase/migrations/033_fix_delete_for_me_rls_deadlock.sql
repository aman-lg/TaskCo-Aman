-- ─────────────────────────────────────────────
-- "Delete for me" failed with "new row violates row-level security policy"
-- even for the message's own sender — reproduced live, isolated to exactly
-- the deleted_for_me column (every other column updates fine). Root cause:
-- PostgREST's UPDATE always evaluates the row against the SELECT policy
-- (for its internal RETURNING, independent of the client's Prefer header),
-- and msg_select correctly excludes any row where auth.uid() = ANY
-- (deleted_for_me) — so the instant you add yourself to that array, the
-- resulting row fails to "return" for you, and Postgres rejects the whole
-- write. Same family as the insert-then-return deadlocks hit twice already
-- this session (projects, conversations) — except there the fix was "let
-- the actor always see their own row"; here that's exactly backwards, since
-- losing visibility is the entire point of deleting a message for yourself.
--
-- Fix: do this write through a SECURITY DEFINER function instead of a
-- direct table UPDATE. Its internal UPDATE runs as the function owner and
-- bypasses RLS entirely, so there's no RETURNING-vs-SELECT-policy conflict
-- to hit. Membership is checked explicitly inside the function since RLS
-- no longer does it for this path.
-- ─────────────────────────────────────────────

create or replace function public.mark_message_deleted_for_me(target_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  select conversation_id into v_conversation_id
  from public.messages
  where id = target_message_id;

  if v_conversation_id is null then
    raise exception 'Message not found';
  end if;

  if not public.is_conversation_member(v_conversation_id) then
    raise exception 'Not a member of this conversation';
  end if;

  update public.messages
  set deleted_for_me = case
    when auth.uid() = any(deleted_for_me) then deleted_for_me
    else deleted_for_me || auth.uid()
  end
  where id = target_message_id;
end;
$$;

grant execute on function public.mark_message_deleted_for_me(uuid) to authenticated;
