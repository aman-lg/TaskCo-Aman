"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Link2, Upload, Loader2, FileText, Trash2, Eye, ExternalLink,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentViewer } from "@/components/ui/document-viewer";

const PREVIEWABLE_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];

function isPreviewable(nameOrUrl: string, mime: string | null) {
  const ext = nameOrUrl.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  if (ext && PREVIEWABLE_EXTENSIONS.includes(ext)) return true;
  return !!mime && (mime === "application/pdf" || mime.includes("officedocument") || mime === "application/msword" || mime === "application/vnd.ms-excel" || mime === "application/vnd.ms-powerpoint");
}

interface ProjectFile {
  id: string;
  kind: "file" | "link";
  name: string;
  url: string | null;
  storage_path: string | null;
  size: number | null;
  mime: string | null;
  created_at: string;
  added_by: string | null;
  profile?: { full_name: string | null } | null;
}

interface Props {
  projectId: string;
  currentUserId: string;
  canManage: boolean; // owner or admin — uploader-only delete is still allowed regardless
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFilesPanel({ projectId, currentUserId, canManage }: Props) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [docViewer, setDocViewer] = useState<{ url: string; name: string; mime: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/files`, { credentials: "same-origin" });
    if (res.ok) {
      const { data } = await res.json();
      setFiles(data ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to upload file");
        return;
      }
      setFiles(prev => [body.data, ...prev]);
      toast.success("File uploaded");
    } finally {
      setUploading(false);
    }
  }

  async function handleAddLink() {
    if (!linkName.trim() || !linkUrl.trim()) return;
    setAddingLink(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ kind: "link", name: linkName.trim(), url: linkUrl.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to add link");
        return;
      }
      setFiles(prev => [body.data, ...prev]);
      setLinkName("");
      setLinkUrl("");
      setShowLinkForm(false);
      toast.success("Link added");
    } finally {
      setAddingLink(false);
    }
  }

  async function handleOpen(file: ProjectFile) {
    if (file.kind === "link") {
      // PDF/Word/Excel links preview in-app like uploads; anything else (a
      // Notion page, a Google Doc, etc.) can't be extension-detected and
      // still opens normally — this app doesn't control what that URL is.
      if (file.url && isPreviewable(file.url, file.mime)) {
        setDocViewer({ url: file.url, name: file.name, mime: file.mime });
      } else {
        window.open(file.url ?? "#", "_blank", "noopener,noreferrer");
      }
      return;
    }
    setOpeningId(file.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/files/${file.id}`, { credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to open file");
        return;
      }
      if (isPreviewable(file.name, file.mime)) {
        setDocViewer({ url: body.data.url, name: file.name, mime: file.mime });
      } else {
        window.open(body.data.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to delete");
        return;
      }
      setFiles(prev => prev.filter(f => f.id !== deleteTarget.id));
      toast.success("Removed");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Documents
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowLinkForm(v => !v)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold transition-colors"
            style={{
              background: showLinkForm ? "var(--navy)" : "var(--navy-l)",
              color: showLinkForm ? "#fff" : "var(--navy)",
            }}
          >
            <Link2 className="h-3.5 w-3.5" /> Add link
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
            style={{ background: "var(--navy-l)", color: "var(--navy)" }}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
        </div>
      </div>

      {showLinkForm && (
        <div
          className="mb-4 rounded-xl p-3 flex flex-col gap-2"
          style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
        >
          <input
            type="text"
            placeholder="Link name (e.g. Design spec)"
            value={linkName}
            onChange={e => setLinkName(e.target.value)}
            className="w-full h-8 px-3 rounded-lg text-[13px] outline-none"
            style={{ background: "var(--surface-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
          />
          <input
            type="url"
            placeholder="https://…"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !addingLink && handleAddLink()}
            className="w-full h-8 px-3 rounded-lg text-[13px] outline-none"
            style={{ background: "var(--surface-bg)", border: "1px solid var(--line)", color: "var(--ink)" }}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowLinkForm(false); setLinkName(""); setLinkUrl(""); }}
              className="h-7 px-3 rounded-lg text-[12px] font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddLink}
              disabled={addingLink || !linkName.trim() || !linkUrl.trim()}
              className="h-7 px-3 rounded-lg text-[12px] font-bold text-white disabled:opacity-40"
              style={{ background: "var(--navy)" }}
            >
              {addingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-2" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading documents…</span>
        </div>
      ) : files.length === 0 ? (
        <p className="text-[13px] py-3 text-center" style={{ color: "var(--text-fine)" }}>
          No documents yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {files.map(f => {
            const canDelete = canManage || f.added_by === currentUserId;
            return (
              <div
                key={f.id}
                className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl"
                style={{ background: "var(--panel-bg)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--navy-l)", color: "var(--navy)" }}
                >
                  {f.kind === "link" ? <Link2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <button
                  onClick={() => handleOpen(f)}
                  disabled={openingId === f.id}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-[13px] font-medium truncate flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                    {f.name}
                    {(f.kind === "file" && isPreviewable(f.name, f.mime)) || (f.kind === "link" && f.url && isPreviewable(f.url, f.mime))
                      ? <Eye className="h-3 w-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                      : <ExternalLink className="h-3 w-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                    {f.kind === "file" ? formatSize(f.size) : f.url}
                    {f.profile?.full_name ? ` · ${f.profile.full_name}` : ""}
                  </p>
                </button>
                {openingId === f.id && <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" style={{ color: "var(--text-muted)" }} />}
                {canDelete && (
                  <button
                    onClick={() => setDeleteTarget(f)}
                    className="p-1.5 rounded-lg transition-colors flex-shrink-0 hover:bg-[var(--clr-red-bg)]"
                    style={{ color: "var(--clr-red)" }}
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Remove "${deleteTarget?.name}"?`}
        description={deleteTarget?.kind === "file" ? "This permanently deletes the uploaded file." : "This removes the link from the project."}
        confirmLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />

      {docViewer && (
        <DocumentViewer
          url={docViewer.url}
          filename={docViewer.name}
          mime={docViewer.mime}
          onClose={() => setDocViewer(null)}
        />
      )}
    </div>
  );
}
