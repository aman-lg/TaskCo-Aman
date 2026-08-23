"use client";

import { useEffect, useCallback, useRef } from "react";
import { X, Download, Forward } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MediaViewerProps {
  src: string;
  type: "image" | "video";
  filename?: string;
  onClose: () => void;
  onForward?: () => void;
}

// ---------------------------------------------------------------------------
// MediaViewer
// ---------------------------------------------------------------------------

export default function MediaViewer({
  src,
  type,
  filename,
  onClose,
  onForward,
}: MediaViewerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // ESC key closes
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  // Swipe-down to close on touch devices
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // swipe down > 80px with more vertical than horizontal movement
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = filename ?? (type === "image" ? "image" : "video");
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        {/* Filename */}
        <span
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.875rem",
            fontFamily: "var(--font-display)",
            maxWidth: "calc(100% - 140px)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {filename ?? (type === "image" ? "Image" : "Video")}
        </span>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onForward && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onForward();
              }}
              title="Forward"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                color: "rgba(255,255,255,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
              }
            >
              <Forward size={18} />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            title="Download"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "8px",
              padding: "8px",
              cursor: "pointer",
              color: "rgba(255,255,255,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
          >
            <Download size={18} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "8px",
              padding: "8px",
              cursor: "pointer",
              color: "rgba(255,255,255,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Media area — click on the overlay (not the media) closes */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          minHeight: 0,
        }}
      >
        {type === "image" ? (
          <img
            src={src}
            alt={filename ?? "Image"}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: "4px",
              userSelect: "none",
              WebkitUserDrag: "none",
            } as React.CSSProperties}
            draggable={false}
          />
        ) : (
          <video
            src={src}
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: "4px",
              outline: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
