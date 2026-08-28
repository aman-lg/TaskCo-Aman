"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Link2, Upload, Loader2, FileText, Trash2, Eye, ExternalLink, HardDrive } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { DriveFilePicker, type DrivePickedFile } from "@/components/shared/drive-file-picker";

const PREVIEWABLE_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];

function isPreviewable(nameOrUrl: string, mime: string | null) {
  const ext = nameOrUrl.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  if (ext && PREVIEWABLE_EXTENSIONS.includes(ext)) return true;
  return !!mime && (mime === "application/pdf" || mime.includes("officedocument") || mime === "application/msword" || mime === "application/vnd.ms-excel" || mime === "application/vnd.ms-powerpoint");
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TaskFile {
  id: string;
  kind: "file" | "link";
  name: string;
  url: string | null;
  storage_path: string | null;
  size: number | null;
  mime: string | null;
  added_by: string | null;
}

interface Props {
  taskId: string;
  currentUserId: string;
  canManage: boolean;
}

export function TaskFilesPanel({ taskId, currentUserId, canManage }: Props) {
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [docViewer, setDocViewer] = useState<{ url: string; name: string; mime: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/files`, { credentials: "same-origin" });
    if (res.ok) {
      const { data } = await res.json();
      setFiles(data ?? []);
    }
    setLoading(false);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tasks/${taskId}/files`, { method: "POST", credentials: "same-origin", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body?.error?.message ?? "Failed to upload file"); return; }
      setFiles(prev => [body.data, ...prev]);
      toast.success("File uploaded");
    } finally {
      setUploading(false);
    }
  }

  async function handleAttachDriveFile(drive: DrivePickedFile) {
    const res = await fetch(`/api/tasks/${taskId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ kind: "link", name: drive.name, url: drive.url, mime: drive.mime, size: drive.size ?? undefined }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.message ?? "Failed to attach file");
    setFiles(prev => [body.data, ...prev]);
    toast.success("Attached from Google Drive");
  }

  async function handleOpen(file: TaskFile) {
    if (file.kind === "link") {
      if (file.url && isPreviewable(file.url, file.mime)) setDocViewer({ url: file.url, name: file.name, mime: file.mime });
      else window.open(file.url ?? "#", "_blank", "noopener,noreferrer");
      return;
    }
    setOpeningId(file.id);
    try {
      const res = await fetch(`/api/tasks/${taskId}/files/${file.id}`, { credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body?.error?.message ?? "Failed to open file"); return; }
      if (isPreviewable(file.name, file.mime)) setDocViewer({ url: body.data.url, name: file.name, mime: file.mime });
      else window.open(body.data.url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/files/${deleteTarget.id}`, { method: "DELETE", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body?.error?.message ?? "Failed to delete"); return; }
      setFiles(prev => prev.filter(f => f.id !== deleteTarget.id));
      toast.success("Removed");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.8px]" style={{ color: "var(--text-muted)" }}>Files</p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
            style={{ background: "var(--navy-l)", color: "var(--navy)" }}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <button
            onClick={() => setShowDrivePicker(true)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold"
            style={{ background: "var(--navy-l)", color: "var(--navy)" }}
          >
            <HardDrive className="h-3.5 w-3.5" /> Drive
          </button>
        </div>
      </div>

      <DriveFilePicker open={showDrivePicker} onClose={() => setShowDrivePicker(false)} onAttach={handleAttachDriveFile} />

      {loading ? (
        <div className="flex items-center gap-2 py-2" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading files…</span>
        </div>
      ) : files.length === 0 ? (
        <p className="text-[13px] py-2" style={{ color: "var(--text-fine)" }}>No files yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {files.map(f => {
            const canDelete = canManage || f.added_by === currentUserId;
            return (
              <div key={f.id} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl" style={{ background: "var(--panel-bg)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--navy-l)", color: "var(--navy)" }}>
                  {f.kind === "link" ? <Link2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                </div>
                <button onClick={() => handleOpen(f)} disabled={openingId === f.id} className="flex-1 min-w-0 text-left">
                  <p className="text-[12.5px] font-medium truncate flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                    {f.name}
                    {(f.kind === "file" && isPreviewable(f.name, f.mime)) || (f.kind === "link" && f.url && isPreviewable(f.url, f.mime))
                      ? <Eye className="h-3 w-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                      : <ExternalLink className="h-3 w-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />}
                  </p>
                  <p className="text-[10.5px] truncate" style={{ color: "var(--text-muted)" }}>
                    {f.kind === "file" ? formatSize(f.size) : f.url}
                  </p>
                </button>
                {openingId === f.id && <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" style={{ color: "var(--text-muted)" }} />}
                {canDelete && (
                  <button onClick={() => setDeleteTarget(f)} className="p-1.5 rounded-lg flex-shrink-0 hover:bg-[var(--clr-red-bg)]" style={{ color: "var(--clr-red)" }} title="Remove">
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
        description={deleteTarget?.kind === "file" ? "This permanently deletes the uploaded file." : "This removes the link from the task."}
        confirmLabel="Remove"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />

      {docViewer && (
        <DocumentViewer url={docViewer.url} filename={docViewer.name} mime={docViewer.mime} onClose={() => setDocViewer(null)} />
      )}
    </div>
  );
}
