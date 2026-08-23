"use client";

import { useState } from "react";
import { Pin, X, ChevronDown, ChevronUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessagePin {
  id: string;
  conversation_id: string;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
  expires_at?: string | null;
  message?: {
    id: string;
    content: string | null;
    type: string;
    sender?: {
      full_name?: string | null;
      email?: string | null;
    } | null;
  } | null;
}

interface PinnedMessageBarProps {
  pins: MessagePin[];
  onUnpin?: (pinId: string) => void;
  onScrollToMessage?: (messageId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPreview(pin: MessagePin): string {
  const msg = pin.message;
  if (!msg) return "Pinned message";
  if (msg.type === "image") return "Photo";
  if (msg.type === "video") return "Video";
  if (msg.type === "audio" || msg.type === "voice_note") return "Audio";
  if (msg.type === "document") return "Document";
  if (msg.type === "poll") return "Poll";
  if (msg.type === "sticker") return "Sticker";
  if (msg.type === "gif") return "GIF";
  if (msg.type === "system") return msg.content ?? "System message";
  return msg.content?.slice(0, 80) ?? "Pinned message";
}

function getSenderName(pin: MessagePin): string | null {
  const sender = pin.message?.sender;
  if (!sender) return null;
  return sender.full_name ?? sender.email ?? null;
}

// ---------------------------------------------------------------------------
// PinnedMessageBar
// ---------------------------------------------------------------------------

export default function PinnedMessageBar({
  pins,
  onUnpin,
  onScrollToMessage,
}: PinnedMessageBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (!pins || pins.length === 0) return null;

  const firstPin = pins[0];
  const hasMultiple = pins.length > 1;

  const handlePinClick = (pin: MessagePin) => {
    if (onScrollToMessage && pin.message_id) {
      onScrollToMessage(pin.message_id);
    }
  };

  return (
    <div
      style={{
        borderBottom: "1px solid var(--line-soft)",
        backgroundColor: "var(--panel-bg)",
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* Collapsed / summary row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 12px",
          cursor: "pointer",
        }}
        onClick={() => handlePinClick(firstPin)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handlePinClick(firstPin);
        }}
      >
        {/* Pin icon accent */}
        <div
          style={{
            flexShrink: 0,
            width: "3px",
            alignSelf: "stretch",
            borderRadius: "2px",
            backgroundColor: "var(--accent-brand)",
          }}
        />

        <Pin
          size={14}
          style={{ color: "var(--accent-brand)", flexShrink: 0 }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {hasMultiple && !expanded ? (
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--ink)",
                fontFamily: "var(--font-display)",
              }}
            >
              {pins.length} pinned messages
            </span>
          ) : (
            <>
              {getSenderName(firstPin) && (
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--accent-brand)",
                    fontFamily: "var(--font-display)",
                    lineHeight: 1.2,
                    marginBottom: "1px",
                  }}
                >
                  {getSenderName(firstPin)}
                </div>
              )}
              <div
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {getPreview(firstPin)}
              </div>
            </>
          )}
        </div>

        {/* Right actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexShrink: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onUnpin && !expanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnpin(firstPin.id);
              }}
              title="Unpin"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "6px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--clr-red-bg)";
                e.currentTarget.style.color = "var(--clr-red)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <X size={14} />
            </button>
          )}

          {hasMultiple && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              title={expanded ? "Collapse" : "Show all pinned"}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "6px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--navy-l)";
                e.currentTarget.style.color = "var(--navy)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded list */}
      {expanded && hasMultiple && (
        <div
          style={{
            borderTop: "1px solid var(--line-soft)",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {pins.map((pin, idx) => (
            <div
              key={pin.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderTop: idx === 0 ? undefined : "1px solid var(--line-soft)",
                cursor: "pointer",
                transition: "background 0.12s",
              }}
              onClick={() => handlePinClick(pin)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handlePinClick(pin);
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--navy-l)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div
                style={{
                  flexShrink: 0,
                  width: "3px",
                  height: "32px",
                  borderRadius: "2px",
                  backgroundColor: "var(--accent-brand)",
                }}
              />

              <Pin
                size={12}
                style={{ color: "var(--accent-brand)", flexShrink: 0 }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                {getSenderName(pin) && (
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--accent-brand)",
                      fontFamily: "var(--font-display)",
                      marginBottom: "1px",
                    }}
                  >
                    {getSenderName(pin)}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getPreview(pin)}
                </div>
              </div>

              {onUnpin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpin(pin.id);
                  }}
                  title="Unpin"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    borderRadius: "6px",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--clr-red-bg)";
                    e.currentTarget.style.color = "var(--clr-red)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
