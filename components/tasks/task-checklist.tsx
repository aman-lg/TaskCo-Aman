"use client";

import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Check } from "lucide-react";

interface Item {
  id: string;
  content: string;
  is_done: boolean;
  position: number;
}

interface Props {
  taskId: string;
  items: Item[];
}

export function TaskChecklist({ taskId, items }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const done = items.filter((i) => i.is_done).length;

  async function toggleItem(item: Item) {
    await fetch(`/api/tasks/${taskId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ is_done: !item.is_done }),
    });
    router.refresh();
  }

  async function deleteItem(itemId: string) {
    await fetch(`/api/tasks/${taskId}/checklist/${itemId}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    router.refresh();
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    setSaving(true);
    await fetch(`/api/tasks/${taskId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ content: newContent.trim(), position: items.length }),
    });
    setNewContent("");
    setSaving(false);
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.8px]" style={{ color: "var(--text-muted)" }}>
            Checklist
          </span>
          {items.length > 0 && (
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--accent-bg)", color: "var(--accent-d)" }}>
              {done}/{items.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-1 text-[12px] font-semibold transition-opacity duration-100 hover:opacity-70"
          style={{ color: "var(--navy)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add item
        </button>
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.round((done / items.length) * 100)}%`,
              background: done === items.length ? "var(--clr-green)" : "var(--accent-brand)",
            }}
          />
        </div>
      )}

      {/* Items */}
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {[...items]
            .sort((a, b) => a.position - b.position)
            .map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-colors duration-100"
                style={{ background: "transparent" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--line-soft)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <button
                  type="button"
                  onClick={() => toggleItem(item)}
                  className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors duration-100"
                  style={{
                    borderColor: item.is_done ? "var(--clr-green)" : "var(--line)",
                    background: item.is_done ? "var(--clr-green)" : "transparent",
                  }}
                  aria-label={item.is_done ? "Mark incomplete" : "Mark complete"}
                >
                  {item.is_done && <Check className="h-2.5 w-2.5 text-white" />}
                </button>
                <span
                  className="flex-1 text-[13px] leading-snug"
                  style={{
                    color: item.is_done ? "var(--text-muted)" : "var(--ink)",
                    textDecoration: item.is_done ? "line-through" : "none",
                  }}
                >
                  {item.content}
                </span>
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity duration-100"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Delete checklist item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
        </ul>
      )}

      {/* Add item form */}
      {adding && (
        <form onSubmit={addItem} className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="New item…"
            className="flex-1 h-9 px-3 rounded-lg border text-[13px] outline-none transition-[border-color] duration-150"
            style={{
              borderColor: "var(--line)",
              background: "var(--surface-bg)",
              color: "var(--ink)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--navy)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          />
          <button
            type="submit"
            disabled={saving || !newContent.trim()}
            className="h-9 px-4 rounded-full text-[13px] font-semibold text-white disabled:opacity-50 transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-needle)]"
            style={{ background: "var(--navy)" }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewContent(""); }}
            className="h-9 px-3 rounded-full text-[13px] font-semibold border transition-colors duration-150"
            style={{ borderColor: "var(--line)", color: "var(--text-secondary)", background: "transparent" }}
          >
            Cancel
          </button>
        </form>
      )}

      {items.length === 0 && !adding && (
        <p className="text-[13px] py-1" style={{ color: "var(--text-muted)" }}>
          No checklist items yet.
        </p>
      )}
    </div>
  );
}
