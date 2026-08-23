"use client";

import { useState } from "react";
import { CheckSquare, Square, Circle, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { Poll } from "@/types/chat";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PollDisplayProps {
  poll: Poll;
  currentUserId: string;
  messageId: string;
  onVoteChange?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPollDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffH / 24);

  if (diffMs < 0) return "Closed";
  if (diffMin < 60) return `Closes in ${diffMin}m`;
  if (diffH < 24) return `Closes in ${diffH}h`;
  if (diffDays === 1) return "Closes tomorrow";

  return `Closes ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PollDisplay({
  poll,
  currentUserId,
  messageId,
  onVoteChange,
}: PollDisplayProps) {
  const [localVotes, setLocalVotes] = useState<string[]>(poll.user_votes ?? []);
  const [isVoting, setIsVoting] = useState(false);

  const isClosed = poll.closed_at != null;
  const options = poll.options ?? [];

  // Total votes across all options
  const totalVotes = options.reduce((sum, o) => sum + (o.vote_count ?? 0), 0);

  // Whether the current user has voted at all
  const hasVoted = localVotes.length > 0;

  // -------------------------------------------------------------------------
  // Vote handler
  // -------------------------------------------------------------------------

  async function handleVote(optionId: string) {
    if (isClosed || isVoting) return;

    let nextVotes: string[];

    if (poll.is_multiple) {
      // Toggle selection
      if (localVotes.includes(optionId)) {
        nextVotes = localVotes.filter((id) => id !== optionId);
      } else {
        nextVotes = [...localVotes, optionId];
      }
    } else {
      // Single choice — deselect if same, else replace
      nextVotes = localVotes.includes(optionId) ? [] : [optionId];
    }

    // Optimistic update
    setLocalVotes(nextVotes);
    setIsVoting(true);

    try {
      const res = await fetch(`/api/chat/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_ids: nextVotes }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to vote");
      }

      onVoteChange?.();
    } catch (err) {
      // Revert optimistic update
      setLocalVotes(poll.user_votes ?? []);
      toast.error(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setIsVoting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        minWidth: 220,
        maxWidth: 320,
      }}
    >
      {/* Question */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "inherit",
          fontFamily: "var(--font-display)",
          lineHeight: 1.35,
          marginBottom: 10,
        }}
      >
        {poll.question}
      </div>

      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {options.map((option) => {
          const isSelected = localVotes.includes(option.id);
          const voteCount = option.vote_count ?? 0;
          const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const canClick = !isClosed && !isVoting;

          return (
            <button
              key={option.id}
              type="button"
              disabled={!canClick}
              onClick={() => void handleVote(option.id)}
              style={{
                display: "block",
                width: "100%",
                background: "none",
                border: "none",
                padding: 0,
                cursor: canClick ? "pointer" : "default",
                textAlign: "left",
              }}
              aria-pressed={isSelected}
              aria-label={option.text}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                {/* Checkbox or radio icon */}
                <div
                  style={{
                    flexShrink: 0,
                    color: isSelected ? "var(--accent-brand)" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.15s",
                  }}
                >
                  {poll.is_multiple ? (
                    isSelected ? (
                      <CheckSquare size={15} />
                    ) : (
                      <Square size={15} />
                    )
                  ) : isSelected ? (
                    <CheckCircle size={15} />
                  ) : (
                    <Circle size={15} />
                  )}
                </div>

                {/* Option text */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "inherit",
                    fontWeight: isSelected ? 600 : 400,
                    lineHeight: 1.3,
                    transition: "font-weight 0.1s",
                  }}
                >
                  {option.text}
                </span>

                {/* Vote count */}
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    minWidth: 24,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.15)",
                  overflow: "hidden",
                  marginLeft: 23,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 2,
                    background: isSelected
                      ? "var(--accent-brand)"
                      : "rgba(255,255,255,0.45)",
                    transition: "width 0.35s ease",
                  }}
                />
              </div>

              {/* Voter names — only shown if !is_anonymous and names are available */}
              {!poll.is_anonymous && hasVoted && isSelected && (
                <div
                  style={{
                    marginLeft: 23,
                    marginTop: 3,
                    fontSize: 10,
                    color: "var(--text-fine)",
                    opacity: 0.8,
                  }}
                >
                  You voted
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer: total votes + status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.12)",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          {poll.is_anonymous && (
            <span style={{ marginLeft: 6 }}>· Anonymous</span>
          )}
          {poll.is_multiple && (
            <span style={{ marginLeft: 6 }}>· Multiple choice</span>
          )}
        </span>

        {/* Status badge */}
        {isClosed ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10,
              fontWeight: 600,
              color: "var(--clr-red)",
              background: "var(--clr-red-bg)",
              borderRadius: 4,
              padding: "2px 6px",
              fontFamily: "var(--font-display)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <XCircle size={10} />
            Closed
          </span>
        ) : poll.closes_at ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10,
              color: "var(--text-secondary)",
            }}
          >
            <Clock size={10} />
            {formatPollDate(poll.closes_at)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
