"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { formatLastSeen } from "@/lib/utils/chat";

// Forked from components/shared/ai-insights-card.tsx rather than widening
// its scope prop (a closed "tasks" | "dashboard" union used elsewhere) —
// this also renders multi-paragraph structured analysis (whitespace-pre-line)
// instead of that one's single summary paragraph, and has no "Discuss with
// Tasko" deep-link (there's no task/project to act on here).
export function YoutubeAiAnalysisCard() {
  const [content, setContent] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setErrored(false);
    try {
      const params = new URLSearchParams({ scope: "marketing_youtube" });
      if (force) params.set("force", "1");
      const res = await fetch(`/api/ai/insights?${params.toString()}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErrored(true); return; }
      setContent(json.data?.content ?? null);
      setGeneratedAt(json.data?.generated_at ?? null);
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--accent-bg)" }}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent-brand)" }} />
          </span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--navy)", fontFamily: "var(--font-display)" }}>Tasko's take</span>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="p-1.5 rounded-md disabled:opacity-40"
          style={{ color: "var(--text-muted)" }}
          title="Refresh"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {loading ? (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Thinking…</p>
      ) : errored ? (
        <p className="text-[13px]" style={{ color: "var(--text-fine)" }}>Insights are temporarily unavailable.</p>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{content}</p>
          {generatedAt && (
            <span className="block mt-2.5 text-[10.5px]" style={{ color: "var(--text-fine)" }}>Updated {formatLastSeen(generatedAt)}</span>
          )}
        </>
      )}
    </div>
  );
}
