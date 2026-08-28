"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { formatLastSeen } from "@/lib/utils/chat";

interface Props {
  scope: "tasks" | "dashboard";
  projectId?: string;
  title?: string;
}

export function AiInsightsCard({ scope, projectId, title = "Tasko's take" }: Props) {
  const router = useRouter();
  const [content, setContent] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);
  const [navigating, setNavigating] = useState(false);

  async function discussWithTasko() {
    setNavigating(true);
    try {
      const res = await fetch("/api/chat/conversations", { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aiConv = (json.data ?? []).find((c: any) => c.type === "ai");
      router.push(aiConv ? `/chat/${aiConv.id}` : "/chat");
    } catch {
      router.push("/chat");
    } finally {
      setNavigating(false);
    }
  }

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true);
    setErrored(false);
    try {
      const params = new URLSearchParams({ scope });
      if (projectId) params.set("project_id", projectId);
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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, projectId]);

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--accent-bg)" }}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent-brand)" }} />
          </span>
          <span className="text-[13px] font-semibold" style={{ color: "var(--navy)", fontFamily: "var(--font-display)" }}>{title}</span>
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
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{content}</p>
          <div className="flex items-center justify-between mt-2.5">
            {generatedAt && (
              <span className="text-[10.5px]" style={{ color: "var(--text-fine)" }}>Updated {formatLastSeen(generatedAt)}</span>
            )}
            <button
              onClick={() => void discussWithTasko()}
              disabled={navigating}
              className="text-[11.5px] font-semibold underline decoration-dotted disabled:opacity-50"
              style={{ color: "var(--accent-brand)" }}
            >
              Discuss with Tasko
            </button>
          </div>
        </>
      )}
    </div>
  );
}
