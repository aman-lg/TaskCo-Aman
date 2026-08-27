"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  ChatMessage, MessageReaction, MessageRead,
  TypingUser, ConversationMember,
} from "@/types/chat";

// ─── useChatRealtime ────────────────────────────────────────────────────────
// Subscribes to all realtime events for a single open conversation.

interface UseChatRealtimeOptions {
  conversationId: string;
  currentUserId: string;
  onNewMessage: (msg: ChatMessage) => void;
  onMessageUpdated: (msg: ChatMessage) => void;
  onMessageDeleted: (id: string) => void;
  onReactionChange: (messageId: string, reaction: MessageReaction, deleted: boolean) => void;
  onReadUpdate: (read: MessageRead) => void;
  onTyping: (users: TypingUser[]) => void;
  onMemberChange?: (member: ConversationMember) => void;
}

export function useChatRealtime({
  conversationId,
  currentUserId,
  onNewMessage,
  onMessageUpdated,
  onMessageDeleted,
  onReactionChange,
  onReadUpdate,
  onTyping,
  onMemberChange,
}: UseChatRealtimeOptions): { sendTyping: (isTyping: boolean) => void } {
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Stable callback refs so listeners don't need to re-subscribe
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageUpdatedRef = useRef(onMessageUpdated);
  const onMessageDeletedRef = useRef(onMessageDeleted);
  const onReactionChangeRef = useRef(onReactionChange);
  const onReadUpdateRef = useRef(onReadUpdate);
  const onTypingRef = useRef(onTyping);
  const onMemberChangeRef = useRef(onMemberChange);

  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);
  useEffect(() => { onMessageUpdatedRef.current = onMessageUpdated; }, [onMessageUpdated]);
  useEffect(() => { onMessageDeletedRef.current = onMessageDeleted; }, [onMessageDeleted]);
  useEffect(() => { onReactionChangeRef.current = onReactionChange; }, [onReactionChange]);
  useEffect(() => { onReadUpdateRef.current = onReadUpdate; }, [onReadUpdate]);
  useEffect(() => { onTypingRef.current = onTyping; }, [onTyping]);
  useEffect(() => { onMemberChangeRef.current = onMemberChange; }, [onMemberChange]);

  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    let cancelled = false;

    const channel = supabase.channel(`chat:${conversationId}`);

    // ── messages ──────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("postgres_changes" as any, {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload: { new: ChatMessage }) => {
      onNewMessageRef.current(payload.new);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("postgres_changes" as any, {
      event: "UPDATE",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload: { new: ChatMessage }) => {
      if (payload.new.deleted_at) {
        onMessageDeletedRef.current(payload.new.id);
      } else {
        onMessageUpdatedRef.current(payload.new);
      }
    });

    // ── reactions ─────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("postgres_changes" as any, {
      event: "INSERT",
      schema: "public",
      table: "message_reactions",
    }, (payload: { new: MessageReaction }) => {
      onReactionChangeRef.current(payload.new.message_id, payload.new, false);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("postgres_changes" as any, {
      event: "DELETE",
      schema: "public",
      table: "message_reactions",
    }, (payload: { old: MessageReaction }) => {
      onReactionChangeRef.current(payload.old.message_id, payload.old, true);
    });

    // ── reads ─────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("postgres_changes" as any, {
      event: "*",
      schema: "public",
      table: "message_reads",
    }, (payload: { new: MessageRead }) => {
      if (payload.new) onReadUpdateRef.current(payload.new);
    });

    // ── typing ────────────────────────────────────────────────────────────
    // A real row + postgres_changes instead of presence — see
    // 038_typing_status.sql for why presence didn't work out. "Typing"
    // just means "this user has a row updated in the last few seconds";
    // there's no explicit stop event, each sighting just (re)starts a local
    // timer that drops them from the list if nothing refreshes it in time.
    const typingUsersMap = new Map<string, string | null>();
    function noteTyping(userId: string, name: string | null) {
      if (userId === currentUserId) return;
      typingUsersMap.set(userId, name);
      onTypingRef.current(Array.from(typingUsersMap, ([user_id, n]) => ({ user_id, name: n })));

      const existing = typingTimersRef.current.get(userId);
      if (existing) clearTimeout(existing);
      typingTimersRef.current.set(userId, setTimeout(() => {
        typingUsersMap.delete(userId);
        typingTimersRef.current.delete(userId);
        onTypingRef.current(Array.from(typingUsersMap, ([user_id, n]) => ({ user_id, name: n })));
      }, 3000));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("postgres_changes" as any, {
      event: "INSERT",
      schema: "public",
      table: "typing_status",
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload: { new: { user_id: string } }) => {
      noteTyping(payload.new.user_id, null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("postgres_changes" as any, {
      event: "UPDATE",
      schema: "public",
      table: "typing_status",
      filter: `conversation_id=eq.${conversationId}`,
    }, (payload: { new: { user_id: string } }) => {
      noteTyping(payload.new.user_id, null);
    });

    // Explicitly sync the Realtime socket's auth token before subscribing —
    // subscribing while the session is still loading opens the channel as
    // `anon`, and RLS then silently drops every event for it.
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      typingTimersRef.current.forEach(clearTimeout);
      typingTimersRef.current.clear();
    };
  }, [conversationId, currentUserId]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      // No explicit "stop" call needed — see 038_typing_status.sql; the
      // receiving side just lets a stale row time out on its own.
      if (!isTyping) return;
      fetch(`/api/chat/conversations/${conversationId}/typing`, { method: "POST" }).catch(() => {});
    },
    [conversationId],
  );

  return { sendTyping };
}

// ─── useConversationListRealtime ─────────────────────────────────────────────
// Notifies when any conversation the user belongs to gets a new message.

export function useConversationListRealtime(
  currentUserId: string,
  onUpdate: (conversationId?: string, lastMessageAt?: string) => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();
    let cancelled = false;

    const channel = supabase.channel(`conv-list:${currentUserId}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("postgres_changes" as any, {
      event: "INSERT",
      schema: "public",
      table: "messages",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, (payload: any) => {
      onUpdateRef.current(
        payload?.new?.conversation_id as string | undefined,
        payload?.new?.created_at as string | undefined,
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.on("postgres_changes" as any, {
      event: "*",
      schema: "public",
      table: "conversation_members",
      filter: `user_id=eq.${currentUserId}`,
    }, () => {
      onUpdateRef.current();
    });

    // See useChatRealtime above for why this awaits the session first.
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel.subscribe();
    })();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [currentUserId]);
}

// ─── useOnlinePresence ────────────────────────────────────────────────────────
// Tracks the current user as online and returns the set of online user IDs.

export function useOnlinePresence(
  currentUserId: string,
  name: string | null,
): Set<string> {
  // Was a plain ref mutated in place — mutating a ref never triggers a
  // re-render, so consumers (e.g. the online dot in ChatHeader) only ever
  // reflected presence changes incidentally, whenever something ELSE
  // happened to re-render them. useState makes it actually reactive.
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();

    const channel = supabase.channel("online-users", {
      config: { presence: { key: currentUserId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnline(new Set(Object.keys(state)));
    });

    channel.on("presence", { event: "join" }, ({ key }: { key: string }) => {
      setOnline((prev) => new Set(prev).add(key));
    });

    channel.on("presence", { event: "leave" }, ({ key }: { key: string }) => {
      setOnline((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });

    // last_seen_at was only ever read (chat-header, info panel, sidebar) and
    // never written anywhere in the codebase — it was permanently null for
    // every user, which is why "Last Active" never had anything to show.
    // Stamp it now, and keep it fresh with a heartbeat while this hook is
    // mounted (i.e. while the user has the app open), so going offline still
    // leaves a reasonably recent timestamp behind (worst case, stale by one
    // heartbeat interval — there's no reliable "goodbye" signal on tab close).
    function touchLastSeen() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", currentUserId).then();
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) supabase.realtime.setAuth(session.access_token);
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online: true, name });
          touchLastSeen();
        }
      });
    });

    const heartbeat = setInterval(touchLastSeen, 60_000);

    return () => {
      clearInterval(heartbeat);
      touchLastSeen();
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [currentUserId, name]);

  return online;
}

// ─── useTypingBroadcast ───────────────────────────────────────────────────────
// Debounced helper: sends typing=true on keypress, typing=false after 3s idle.

export function useTypingBroadcast(
  sendTyping: (isTyping: boolean) => void,
): { onKeyPress: () => void; onBlur: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const onKeyPress = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(true);
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(false);
    }, 3000);
  }, [sendTyping]);

  const onBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(false);
    }
  }, [sendTyping]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { onKeyPress, onBlur };
}
