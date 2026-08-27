export type ConversationType = "direct" | "group" | "self";
export type MessageType =
  | "text" | "image" | "video" | "audio" | "voice_note"
  | "document" | "sticker" | "gif" | "poll" | "system" | "contact";
export type MemberRole = "owner" | "admin" | "member";

export interface ChatProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  last_seen_at?: string | null;
  /** Job title from their org_unit_members placement, if any. */
  title?: string | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  last_message_at: string | null;
  admin_only_messages: boolean;
  slow_mode_seconds: number | null;
  invite_link: string | null;
  created_at: string;
  updated_at: string;
  // computed
  members?: ConversationMember[];
  last_message?: ChatMessage | null;
  unread_count?: number;
  other_user?: ChatProfile | null;
  my_member?: ConversationMember | null;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  added_by: string | null;
  added_at: string;
  last_read_at: string | null;
  is_muted: boolean;
  muted_until: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  is_banned: boolean;
  profile?: ChatProfile;
}

export interface MessageMetadata {
  url?: string;
  filename?: string;
  size?: number;
  mime?: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  waveform?: number[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  type: MessageType;
  content: string | null;
  reply_to_id: string | null;
  forwarded_from_id: string | null;
  is_forwarded: boolean;
  metadata: MessageMetadata | null;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_for_me: string[];
  is_view_once: boolean;
  viewed_by: string[];
  disappears_at: string | null;
  created_at: string;
  updated_at: string;
  // computed
  sender?: ChatProfile | null;
  reply_to?: ChatMessage | null;
  reactions?: MessageReaction[];
  reads?: MessageRead[];
  poll?: Poll | null;
}

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profile?: ChatProfile;
}

export interface MessageRead {
  message_id: string;
  user_id: string;
  delivered_at: string;
  read_at: string | null;
}

export interface MessageEdit {
  id: string;
  message_id: string;
  old_content: string;
  edited_at: string;
}

export interface MessagePin {
  id: string;
  conversation_id: string;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
  expires_at: string | null;
  message?: ChatMessage;
}

export interface Poll {
  id: string;
  message_id: string;
  question: string;
  is_anonymous: boolean;
  is_multiple: boolean;
  closes_at: string | null;
  closed_at: string | null;
  created_at: string;
  options?: PollOption[];
  user_votes?: string[];
}

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  position: number;
  vote_count?: number;
}

export interface PollVote {
  poll_id: string;
  option_id: string;
  user_id: string;
  voted_at: string;
}

export interface TypingUser {
  user_id: string;
  name: string | null;
}

export interface NewConversationPayload {
  type: ConversationType;
  member_ids: string[];
  name?: string;
  description?: string;
}

export interface SendMessagePayload {
  content?: string;
  type: MessageType;
  reply_to_id?: string;
  forwarded_from_id?: string;
  is_forwarded?: boolean;
  metadata?: MessageMetadata;
  disappears_at?: string;
}

export interface RealtimeMessageEvent {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: ChatMessage | null;
  old: { id: string } | null;
}

export interface RealtimeReactionEvent {
  eventType: "INSERT" | "DELETE";
  new: MessageReaction | null;
  old: { message_id: string; user_id: string } | null;
}

export interface RealtimeReadEvent {
  eventType: "INSERT" | "UPDATE";
  new: MessageRead | null;
}
