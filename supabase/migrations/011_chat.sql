-- Migration 011: Real-time chat system (Phase 1 — core messaging)
-- Run in Supabase SQL Editor after 010_project_members.sql
-- NOTE: Also create a Storage bucket named 'chat-attachments' (authenticated access) in the Supabase Dashboard

-- ─────────────────────────────────────────────
-- Extend profiles: last seen timestamp
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- ─────────────────────────────────────────────
-- conversations  (type: 'direct' | 'group' | 'self')
-- 'self' = the personal notes inbox, one per user, created automatically
-- ─────────────────────────────────────────────
CREATE TABLE public.conversations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  text        NOT NULL DEFAULT 'direct'
                                    CHECK (type IN ('direct', 'group', 'self')),
  name                  text,
  description           text,
  avatar_url            text,
  created_by            uuid        NOT NULL REFERENCES public.profiles(id),
  last_message_at       timestamptz,
  admin_only_messages   boolean     NOT NULL DEFAULT false,
  slow_mode_seconds     int,
  invite_link           text        UNIQUE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conv_last_msg ON public.conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_conv_creator  ON public.conversations(created_by);
-- Enforce one self-conversation per user
CREATE UNIQUE INDEX idx_conv_self_per_user ON public.conversations(created_by) WHERE type = 'self';

-- ─────────────────────────────────────────────
-- conversation_members
-- ─────────────────────────────────────────────
CREATE TABLE public.conversation_members (
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('owner', 'admin', 'member')),
  added_by        uuid        REFERENCES public.profiles(id),
  added_at        timestamptz NOT NULL DEFAULT now(),
  last_read_at    timestamptz,
  is_muted        boolean     NOT NULL DEFAULT false,
  muted_until     timestamptz,
  is_pinned       boolean     NOT NULL DEFAULT false,
  is_archived     boolean     NOT NULL DEFAULT false,
  is_banned       boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX idx_cm_user ON public.conversation_members(user_id);
CREATE INDEX idx_cm_conv ON public.conversation_members(conversation_id);

-- ─────────────────────────────────────────────
-- messages
-- ─────────────────────────────────────────────
CREATE TABLE public.messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  type              text        NOT NULL DEFAULT 'text'
                                CHECK (type IN ('text','image','video','audio','voice_note','document','sticker','gif','poll','system','contact')),
  content           text,
  reply_to_id       uuid        REFERENCES public.messages(id) ON DELETE SET NULL,
  forwarded_from_id uuid        REFERENCES public.messages(id) ON DELETE SET NULL,
  is_forwarded      boolean     NOT NULL DEFAULT false,
  metadata          jsonb,
  is_edited         boolean     NOT NULL DEFAULT false,
  edited_at         timestamptz,
  deleted_at        timestamptz,
  deleted_for_me    uuid[]      NOT NULL DEFAULT '{}',
  is_view_once      boolean     NOT NULL DEFAULT false,
  viewed_by         uuid[]      NOT NULL DEFAULT '{}',
  disappears_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_conv   ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_msg_sender ON public.messages(sender_id);
CREATE INDEX idx_msg_reply  ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- message_reads  (delivery + read receipts)
-- ─────────────────────────────────────────────
CREATE TABLE public.message_reads (
  message_id    uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  delivered_at  timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz,
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_mr_msg  ON public.message_reads(message_id);
CREATE INDEX idx_mr_user ON public.message_reads(user_id);

-- ─────────────────────────────────────────────
-- message_reactions
-- ─────────────────────────────────────────────
CREATE TABLE public.message_reactions (
  message_id  uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  emoji       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_react_msg ON public.message_reactions(message_id);

-- ─────────────────────────────────────────────
-- message_edits  (history)
-- ─────────────────────────────────────────────
CREATE TABLE public.message_edits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  old_content text        NOT NULL,
  edited_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_edit_msg ON public.message_edits(message_id);

-- ─────────────────────────────────────────────
-- message_pins
-- ─────────────────────────────────────────────
CREATE TABLE public.message_pins (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id      uuid        NOT NULL REFERENCES public.messages(id)      ON DELETE CASCADE,
  pinned_by       uuid        NOT NULL REFERENCES public.profiles(id),
  pinned_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  UNIQUE (conversation_id, message_id)
);
CREATE INDEX idx_pin_conv ON public.message_pins(conversation_id);

-- ─────────────────────────────────────────────
-- message_stars  (saved messages — personal)
-- ─────────────────────────────────────────────
CREATE TABLE public.message_stars (
  message_id  uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  starred_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_star_user ON public.message_stars(user_id);

-- ─────────────────────────────────────────────
-- polls  (phase 2 UI, schema included now)
-- ─────────────────────────────────────────────
CREATE TABLE public.polls (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  question     text        NOT NULL,
  is_anonymous boolean     NOT NULL DEFAULT false,
  is_multiple  boolean     NOT NULL DEFAULT false,
  closes_at    timestamptz,
  closed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.poll_options (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  text      text NOT NULL,
  position  int  NOT NULL DEFAULT 0
);
CREATE INDEX idx_popt ON public.poll_options(poll_id, position);

CREATE TABLE public.poll_votes (
  poll_id    uuid        NOT NULL REFERENCES public.polls(id)         ON DELETE CASCADE,
  option_id  uuid        NOT NULL REFERENCES public.poll_options(id)  ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  voted_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, option_id, user_id)
);
CREATE INDEX idx_pvote ON public.poll_votes(poll_id);

-- ─────────────────────────────────────────────
-- RLS helper function
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id
      AND user_id = auth.uid()
      AND is_banned = false
  );
$$;

-- ─────────────────────────────────────────────
-- Enable RLS on all chat tables
-- ─────────────────────────────────────────────
ALTER TABLE public.conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_edits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_pins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_stars        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes           ENABLE ROW LEVEL SECURITY;

-- ── conversations ────────────────────────────
CREATE POLICY conv_select ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id));
CREATE POLICY conv_insert ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY conv_update ON public.conversations FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.conversation_members
            WHERE conversation_id = id AND user_id = auth.uid() AND role IN ('owner','admin'))
  );
CREATE POLICY conv_delete ON public.conversations FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ── conversation_members ─────────────────────
-- Allow users to see their OWN rows (needed for ensureSelfConversation lookup)
-- AND allow seeing co-members' rows once a member
CREATE POLICY cm_select ON public.conversation_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_member(conversation_id));
CREATE POLICY cm_insert ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.conversation_members cm2
               WHERE cm2.conversation_id = conversation_members.conversation_id
                 AND cm2.user_id = auth.uid() AND cm2.role IN ('owner','admin'))
  );
CREATE POLICY cm_update ON public.conversation_members FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.conversation_members cm2
               WHERE cm2.conversation_id = conversation_members.conversation_id
                 AND cm2.user_id = auth.uid() AND cm2.role IN ('owner','admin'))
  );
CREATE POLICY cm_delete ON public.conversation_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.conversation_members cm2
               WHERE cm2.conversation_id = conversation_members.conversation_id
                 AND cm2.user_id = auth.uid() AND cm2.role IN ('owner','admin'))
  );

-- ── messages ────────────────────────────────
CREATE POLICY msg_select ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_conversation_member(conversation_id)
    AND deleted_at IS NULL
    AND NOT (auth.uid() = ANY(deleted_for_me))
  );
CREATE POLICY msg_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(conversation_id));
CREATE POLICY msg_update ON public.messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.conversation_members
               WHERE conversation_id = messages.conversation_id
                 AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- ── message_reads ────────────────────────────
CREATE POLICY mr_select ON public.message_reads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m
                 WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)));
CREATE POLICY mr_insert ON public.message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY mr_update ON public.message_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ── message_reactions ────────────────────────
CREATE POLICY react_select ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m
                 WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)));
CREATE POLICY react_insert ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY react_delete ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── message_edits ────────────────────────────
CREATE POLICY edit_select ON public.message_edits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m
                 WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)));

-- ── message_pins ─────────────────────────────
CREATE POLICY pin_select ON public.message_pins FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));
CREATE POLICY pin_insert ON public.message_pins FOR INSERT TO authenticated
  WITH CHECK (pinned_by = auth.uid() AND public.is_conversation_member(conversation_id));
CREATE POLICY pin_delete ON public.message_pins FOR DELETE TO authenticated
  USING (
    pinned_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.conversation_members
               WHERE conversation_id = message_pins.conversation_id
                 AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- ── message_stars ────────────────────────────
CREATE POLICY star_all ON public.message_stars FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── polls ────────────────────────────────────
CREATE POLICY poll_sel ON public.polls FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = polls.message_id AND public.is_conversation_member(m.conversation_id)));
CREATE POLICY poll_ins ON public.polls FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = polls.message_id AND m.sender_id = auth.uid()));
CREATE POLICY poll_upd ON public.polls FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = polls.message_id AND m.sender_id = auth.uid()));

CREATE POLICY popt_sel ON public.poll_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p JOIN public.messages m ON m.id = p.message_id
                 WHERE p.id = poll_options.poll_id AND public.is_conversation_member(m.conversation_id)));
CREATE POLICY popt_ins ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p JOIN public.messages m ON m.id = p.message_id
                      WHERE p.id = poll_options.poll_id AND m.sender_id = auth.uid()));

CREATE POLICY pvote_sel ON public.poll_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p JOIN public.messages m ON m.id = p.message_id
                 WHERE p.id = poll_votes.poll_id AND public.is_conversation_member(m.conversation_id)));
CREATE POLICY pvote_ins ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY pvote_del ON public.poll_votes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- Trigger: keep conversations.last_message_at fresh
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_conv_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conv_last_message();

-- ─────────────────────────────────────────────
-- Enable Realtime on all chat tables
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_pins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
