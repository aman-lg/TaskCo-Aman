"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { YoutubeConnectCard } from "./youtube-connect-card";
import { YoutubeVideoTable, type YoutubeVideoRow } from "./youtube-video-table";
import { YoutubeAiAnalysisCard } from "./youtube-ai-analysis-card";

interface Status {
  connected: boolean;
  channelTitle?: string;
  channelThumbnailUrl?: string | null;
  lastSyncedAt?: string | null;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SocialMediaPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [videos, setVideos] = useState<YoutubeVideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/marketing/youtube/status", { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    if (res.ok) setStatus(json.data);
    return json?.data as Status | undefined;
  }, []);

  const loadVideos = useCallback(async () => {
    const res = await fetch("/api/marketing/youtube/videos", { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    if (res.ok) setVideos(json.data?.videos ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await loadStatus();
      if (s?.connected) await loadVideos();
      setLoading(false);
    })();
  }, [loadStatus, loadVideos]);

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/marketing/youtube/sync", { method: "POST", credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json?.error?.message ?? "Sync failed"); return; }
      toast.success(`Synced ${json.data.synced_count} videos`);
      await loadStatus();
      await loadVideos();
    } catch {
      toast.error("Sync failed — check your connection");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl p-8 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Loading…</div>;
  }

  if (!status?.connected) {
    return <YoutubeConnectCard />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {status.channelThumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={status.channelThumbnailUrl} alt="" className="w-9 h-9 rounded-full" />
          )}
          <div>
            <p className="text-[14px] font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>{status.channelTitle}</p>
            <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Last synced {timeAgo(status.lastSyncedAt)}</p>
          </div>
        </div>
        <button
          onClick={() => void syncNow()}
          disabled={syncing}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--navy)" }}
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? "Syncing…" : "Sync Now"}
        </button>
      </div>

      <YoutubeAiAnalysisCard />
      <YoutubeVideoTable videos={videos} />
    </div>
  );
}
