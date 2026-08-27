"use client";

import { useEffect } from "react";
import { X, Phone } from "lucide-react";

interface Props {
  roomUrl: string;
  onClose: () => void;
}

/**
 * Embeds a Daily.co room via iframe — Daily's hosted call page already
 * has its own mute/leave controls, so this wrapper only needs a title bar
 * and a fallback close button, same shape as DocumentViewer.
 */
export function CallModal({ roomUrl, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-display)" }}>
          <Phone className="h-3.5 w-3.5" /> Voice call
        </span>
        <button
          onClick={onClose}
          className="p-2 rounded-lg transition-colors"
          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 px-4 pb-4">
        <iframe
          src={roomUrl}
          className="w-full h-full rounded-lg"
          style={{ border: "none", background: "#111" }}
          title="Voice call"
          allow="microphone; camera; autoplay; display-capture"
        />
      </div>
    </div>
  );
}
