-- ─────────────────────────────────────────────
-- Voice calls: a "call" is just a special message type in the existing
-- chat pipeline — created via POST /api/chat/conversations/[id]/calls,
-- which creates a Daily.co room server-side and stores its URL in
-- message.metadata. Delivery, realtime, and resync all reuse the
-- messages table/pipeline exactly as-is; no new table needed.
-- ─────────────────────────────────────────────

alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type in ('text','image','video','audio','voice_note','document','sticker','gif','poll','system','contact','call'));
