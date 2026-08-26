"use client";

import { useEffect } from "react";
import { X, FileText } from "lucide-react";

interface Props {
  url: string;
  filename?: string | null;
  mime?: string | null;
  onClose: () => void;
}

const OFFICE_EXTENSIONS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

function isPdf(mime?: string | null, filename?: string | null) {
  return mime === "application/pdf" || filename?.toLowerCase().endsWith(".pdf") === true;
}

function isOfficeDoc(mime?: string | null, filename?: string | null) {
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext && OFFICE_EXTENSIONS.includes(ext)) return true;
  return !!mime && (
    mime.includes("officedocument") || mime === "application/msword" || mime === "application/vnd.ms-excel" || mime === "application/vnd.ms-powerpoint"
  );
}

/**
 * Embeds a PDF (natively, via iframe — every browser can render these on its
 * own) or an Office document (via Microsoft's public viewer, since no
 * browser can render .doc/.docx/.xls/.xlsx itself) instead of linking out to
 * the raw file. No download affordance, no visible file URL in the UI — the
 * file's URL is only ever used as the iframe's src attribute, same as any
 * embedded image already is elsewhere in the app.
 */
export function DocumentViewer({ url, filename, mime, onClose }: Props) {
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

  const pdf = isPdf(mime, filename);
  const office = !pdf && isOfficeDoc(mime, filename);
  const embedSrc = pdf ? url : office ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-[13px] font-medium truncate max-w-[calc(100%-60px)]" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-display)" }}>
          {filename ?? "Document"}
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
        {embedSrc ? (
          <iframe
            src={embedSrc}
            className="w-full h-full rounded-lg"
            style={{ border: "none", background: "#fff" }}
            title={filename ?? "Document preview"}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <FileText className="h-10 w-10" style={{ color: "rgba(255,255,255,0.4)" }} />
            <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.6)" }}>
              Preview not available for this file type.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
