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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

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

    const channel = supabase.channel(`chat:${conversationId}`, {
      config: { presence: { key: currentUserId } },
    });

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

    // ── presence: typing ──────────────────────────────────────────────────
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ typing?: boolean; name?: string }>();
      const typingList: TypingUser[] = [];
      for (const [uid, presences] of Object.entries(state)) {
        if (uid === currentUserId) continue;
        const latest = (presences as Array<{ typing?: boolean; name?: string }>)[0];
        if (latest?.typing) {
          typingList.push({ user_id: uid, name: latest.name ?? null });
        }
      }
      onTypingRef.current(typingList);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channelRef.current = channel as any;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      typingTimersRef.current.forEach(clearTimeout);
      typingTimersRef.current.clear();
    };
  }, [conversationId, currentUserId]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current) return;
      channelRef.current.track({ typing: isTyping });
    },
    [],
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) supabase.realtime.setAuth(session.access_token);
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online: true, name });
        }
      });
    });

    return () => {
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
