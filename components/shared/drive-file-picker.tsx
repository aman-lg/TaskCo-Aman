"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search, HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface DrivePickedFile {
  name: string;
  url: string;
  mime: string;
  size: number | null;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  size?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAttach: (file: DrivePickedFile) => Promise<void> | void;
}

type ConnState = "checking" | "connected" | "not_connected" | "scope_missing";

export function DriveFilePicker({ open, onClose, onAttach }: Props) {
  const [connState, setConnState] = useState<ConnState>("checking");
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(q: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/google/drive?q=${encodeURIComponent(q)}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error?.code === "not_connected") setConnState("not_connected");
        else if (json?.error?.code === "drive_scope_missing") setConnState("scope_missing");
        else toast.error(json?.error?.message ?? "Couldn't load Google Drive");
        setFiles([]);
        return;
      }
      setConnState("connected");
      setFiles(json.data?.files ?? []);
    } catch {
      toast.error("Couldn't load Google Drive");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void search("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(value), 350);
  }

  async function handleAttach(file: DriveFile) {
    setAttachingId(file.id);
    try {
      await onAttach({
        name: file.name,
        url: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
        mime: file.mimeType,
        size: file.size ? Number(file.size) : null,
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach file");
    } finally {
      setAttachingId(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ background: "var(--surface-bg)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" style={{ color: "var(--navy)" }} />
            <span className="text-[14px] font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Google Drive
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md" style={{ color: "var(--text-muted)" }} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {connState === "not_connected" || connState === "scope_missing" ? (
          <div className="p-6 text-center">
            <p className="text-[13px] mb-3" style={{ color: "var(--text-secondary)" }}>
              {connState === "scope_missing"
                ? "Your Google connection needs to be renewed to allow Drive access."
                : "Connect Google to browse and attach files from your Drive."}
            </p>
            <a
              href="/api/auth/google/connect"
              className="inline-block px-4 py-2 rounded-lg text-[13px] font-semibold"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {connState === "scope_missing" ? "Reconnect Google" : "Connect Google"}
            </a>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="flex items-center gap-2 rounded-lg px-2.5" style={{ background: "var(--panel-bg)" }}>
                <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Search your Drive…"
                  className="w-full bg-transparent py-2 text-[13px] outline-none"
                  style={{ color: "var(--ink)" }}
                />
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-muted)" }} />
                </div>
              ) : files.length === 0 ? (
                <p className="text-center py-8 text-[13px]" style={{ color: "var(--text-fine)" }}>No files found.</p>
              ) : (
                files.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={attachingId !== null}
                    onClick={() => void handleAttach(f)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:opacity-90 disabled:opacity-50"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {f.iconLink ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.iconLink} alt="" className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <HardDrive className="w-5 h-5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                    )}
                    <span className="flex-1 min-w-0 truncate text-[13px]" style={{ color: "var(--ink)" }}>{f.name}</span>
                    {attachingId === f.id && <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
