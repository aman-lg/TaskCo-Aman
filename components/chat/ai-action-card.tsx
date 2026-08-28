"use client";

import { useState } from "react";
import { Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/types/chat";

interface Props {
  message: ChatMessage;
  onResolved: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for your confirmation",
  confirmed: "Confirmed",
  executed: "Done",
  cancelled: "Cancelled",
  failed: "Failed",
};

export function AiActionCard({ message, onResolved }: Props) {
  const [busy, setBusy] = useState(false);
  const actionId = message.metadata?.action_id;
  const status = message.metadata?.action_status ?? "pending";
  const summary = message.metadata?.action_summary ?? message.content ?? "Proposed action";

  async function resolve(kind: "confirm" | "cancel") {
    if (!actionId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chat/ai-actions/${actionId}/${kind}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong");
      onResolved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-lg p-3 min-w-[220px] max-w-[280px]"
      style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent-brand)" }} />
        <span className="text-[11px] font-semibold" style={{ color: "var(--navy)" }}>Tasko wants to</span>
      </div>
      <p className="text-[13px] leading-snug" style={{ color: "var(--ink)" }}>{summary}</p>

      {status === "pending" ? (
        <div className="flex gap-2 mt-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => void resolve("confirm")}
            className="flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--navy)", color: "#fff" }}
          >
            <Check className="h-3.5 w-3.5" /> Confirm
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void resolve("cancel")}
            className="flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--surface-bg)", color: "var(--text-secondary)", border: "1px solid var(--line-soft)" }}
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      ) : (
        <p
          className="text-[11px] font-medium mt-2"
          style={{ color: status === "failed" ? "var(--clr-red)" : status === "cancelled" ? "var(--text-muted)" : "var(--clr-green)" }}
        >
          {STATUS_LABEL[status] ?? status}
        </p>
      )}
    </div>
  );
}
