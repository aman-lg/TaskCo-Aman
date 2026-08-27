"use client";

import type { TypingUser } from "@/types/chat";

interface Props {
  typingUsers: TypingUser[];
  isGroup: boolean;
}

export function TypingIndicator({ typingUsers, isGroup }: Props) {
  if (typingUsers.length === 0) return null;

  // In a 1:1 chat there's only ever one person it could be — the header
  // already names them right next to "typing…", so this bar just says
  // "typing…" too instead of repeating a name. Groups need the name since
  // it's not obvious who.
  let label: string;
  if (!isGroup) {
    label = "typing…";
  } else if (typingUsers.length === 1) {
    label = `${typingUsers[0].name ?? "Someone"} is typing`;
  } else if (typingUsers.length === 2) {
    label = `${typingUsers[0].name ?? "Someone"} and ${typingUsers[1].name ?? "someone"} are typing`;
  } else {
    label = `${typingUsers[0].name ?? "Someone"} and ${typingUsers.length - 1} others are typing`;
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5"
      style={{ minHeight: 28 }}
    >
      {/* Animated dots */}
      <div className="flex items-center gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-[5px] h-[5px] rounded-full animate-bounce"
            style={{
              background: "var(--text-muted)",
              animationDelay: `${i * 150}ms`,
              animationDuration: "600ms",
            }}
          />
        ))}
      </div>
      <span className="text-[12px] italic" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}
