import type { Conversation, ChatMessage, MessageRead } from "@/types/chat";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatHHMM(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysDiff(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.floor(
    (startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay
  );
}

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ---------------------------------------------------------------------------
// 1. formatMessageTime
// ---------------------------------------------------------------------------

export function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = daysDiff(date, now);

  if (diff === 0) {
    // Today — show HH:MM only
    return formatHHMM(date);
  }

  if (diff <= 6) {
    // Within the past 7 days — "Mon 14:32"
    return `${SHORT_DAY[date.getDay()]} ${formatHHMM(date)}`;
  }

  // Older — "15 Jun 14:32"
  return `${date.getDate()} ${SHORT_MON[date.getMonth()]} ${formatHHMM(date)}`;
}

// ---------------------------------------------------------------------------
// 2. formatLastSeen
// ---------------------------------------------------------------------------

export function formatLastSeen(isoString: string | null): string {
  if (!isoString) return "Never";

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffH = Math.floor(diffMin / 60);
  const diffDays = daysDiff(date, now);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffDays === 0) return `Today at ${formatHHMM(date)}`;
  if (diffDays === 1) return `Yesterday at ${formatHHMM(date)}`;

  // "15 Jun at 14:32"
  return `${date.getDate()} ${SHORT_MON[date.getMonth()]} at ${formatHHMM(date)}`;
}

// ---------------------------------------------------------------------------
// 3. formatFileSize
// ---------------------------------------------------------------------------

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ---------------------------------------------------------------------------
// 4. getConversationName
// ---------------------------------------------------------------------------

export function getConversationName(
  conv: Conversation,
  currentUserId: string
): string {
  if (conv.type === "self") return "My Notes";
  if (conv.type === "group") return conv.name ?? "Unnamed Group";
  // Direct — prefer denormalised other_user, fall back to members array
  if (conv.other_user) {
    return conv.other_user.full_name ?? conv.other_user.email ?? "Unknown";
  }
  const other = conv.members?.find((m) => m.user_id !== currentUserId);
  return other?.profile?.full_name ?? other?.profile?.email ?? "Unknown";
}

// ---------------------------------------------------------------------------
// 5. getConversationAvatar
// ---------------------------------------------------------------------------

export function getConversationAvatar(
  conv: Conversation,
  currentUserId: string
): string | null {
  if (conv.type === "self") return null;
  if (conv.type === "group") return conv.avatar_url ?? null;
  if (conv.other_user) return conv.other_user.avatar_url ?? null;
  const other = conv.members?.find((m) => m.user_id !== currentUserId);
  return other?.profile?.avatar_url ?? null;
}

// ---------------------------------------------------------------------------
// formatConversationTime  (for conversation list — shorter than full timestamp)
// ---------------------------------------------------------------------------

export function formatConversationTime(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diff = daysDiff(date, now);
  if (diff === 0) return formatHHMM(date);
  if (diff === 1) return "Yesterday";
  if (diff < 7) return SHORT_DAY[date.getDay()];
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// ---------------------------------------------------------------------------
// getLastMessagePreview
// ---------------------------------------------------------------------------

export function getLastMessagePreview(
  msg: ChatMessage | null | undefined,
  currentUserId: string
): string {
  if (!msg) return "No messages yet";
  if (msg.deleted_at) return "Message deleted";
  const prefix = msg.sender_id === currentUserId ? "You: " : "";
  switch (msg.type) {
    case "image":      return `${prefix}📷 Photo`;
    case "video":      return `${prefix}🎥 Video`;
    case "audio":      return `${prefix}🎵 Audio`;
    case "voice_note": return `${prefix}🎙 Voice note`;
    case "document":   return `${prefix}📄 ${(msg.metadata as { name?: string } | null)?.name ?? "Document"}`;
    case "poll":       return `${prefix}📊 Poll`;
    case "call":       return `${prefix}📞 Voice call`;
    case "sticker":    return `${prefix}😊 Sticker`;
    case "system":     return msg.content ?? "";
    default:           return `${prefix}${msg.content ?? ""}`;
  }
}

// ---------------------------------------------------------------------------
// canEditMessage / canDeleteForEveryone
// ---------------------------------------------------------------------------

export function canEditMessage(msg: ChatMessage, currentUserId: string): boolean {
  if (msg.sender_id !== currentUserId) return false;
  if (msg.type !== "text") return false;
  if (msg.is_forwarded) return false;
  return new Date(msg.created_at) > new Date(Date.now() - 15 * 60 * 1000);
}

export function canDeleteForEveryone(
  msg: ChatMessage,
  currentUserId: string,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (msg.sender_id !== currentUserId) return false;
  return new Date(msg.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// 6. getMemberColor
// ---------------------------------------------------------------------------

const MEMBER_COLORS: string[] = [
  "var(--navy)",
  "#5B5A9F",
  "#708993",
  "var(--accent-brand)",
  "#7C8F3E",
  "#9B5E3E",
  "#3E7C8F",
  "#8F3E6F",
];

export function getMemberColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return MEMBER_COLORS[hash % MEMBER_COLORS.length];
}

// ---------------------------------------------------------------------------
// 7. getMessageStatus
// ---------------------------------------------------------------------------

export function getMessageStatus(
  message: ChatMessage,
  currentUserId: string,
  memberCount: number
): "sent" | "delivered" | "read" {
  const reads: MessageRead[] = message.reads ?? [];

  // Only consider reads from other users
  const othersReads = reads.filter((r) => r.user_id !== currentUserId);

  if (othersReads.length === 0) return "sent";

  const otherCount = memberCount - 1; // exclude self
  const readCount = othersReads.filter((r) => r.read_at != null).length;

  if (readCount >= otherCount && otherCount > 0) return "read";

  const deliveredCount = othersReads.filter(
    (r) => r.delivered_at != null
  ).length;
  if (deliveredCount > 0) return "delivered";

  return "sent";
}

// ---------------------------------------------------------------------------
// 8. groupMessagesByDate
// ---------------------------------------------------------------------------

function dateLabel(date: Date): string {
  const now = new Date();
  const diff = daysDiff(date, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${date.getDate()} ${SHORT_MON[date.getMonth()]} ${date.getFullYear()}`;
}

export function groupMessagesByDate(
  messages: ChatMessage[]
): Array<{ date: string; messages: ChatMessage[] }> {
  const groups: Array<{ date: string; messages: ChatMessage[] }> = [];
  const seen = new Map<string, number>();

  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (seen.has(key)) {
      groups[seen.get(key)!].messages.push(msg);
    } else {
      seen.set(key, groups.length);
      groups.push({ date: dateLabel(d), messages: [msg] });
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// 9-11. MIME type guards
// ---------------------------------------------------------------------------

export function isImageMime(mime: string | undefined): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

export function isVideoMime(mime: string | undefined): boolean {
  if (!mime) return false;
  return mime.startsWith("video/");
}

export function isAudioMime(mime: string | undefined): boolean {
  if (!mime) return false;
  return mime.startsWith("audio/");
}
