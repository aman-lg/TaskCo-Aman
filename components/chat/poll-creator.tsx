"use client";

import { useState } from "react";
import { Plus, X, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PollCreatorProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (poll: {
    question: string;
    options: string[];
    is_anonymous: boolean;
    is_multiple: boolean;
    closes_at?: string;
  }) => void;
}

// ---------------------------------------------------------------------------
// Toggle component
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "10px 0",
        textAlign: "left",
      }}
    >
      {/* Track */}
      <div
        style={{
          position: "relative",
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? "#19183B" : "var(--line)",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.2s",
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            fontFamily: "var(--font-display)",
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginTop: 1,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PollCreator({ open, onClose, onSubmit }: PollCreatorProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isMultiple, setIsMultiple] = useState(false);
  const [closesAt, setClosesAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -------------------------------------------------------------------------
  // Option management
  // -------------------------------------------------------------------------

  function addOption() {
    if (options.length >= 10) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
    // Clear any error for this option
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`option_${index}`];
      return next;
    });
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    // Clear option error when user types
    if (errors[`option_${index}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`option_${index}`];
        return next;
      });
    }
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!question.trim()) {
      newErrors.question = "Question is required";
    } else if (question.trim().length > 255) {
      newErrors.question = "Question must be 255 characters or fewer";
    }

    const nonEmptyOptions = options.filter((o) => o.trim().length > 0);
    if (nonEmptyOptions.length < 2) {
      newErrors.options = "At least 2 options are required";
    }

    options.forEach((opt, i) => {
      if (opt.trim().length === 0) {
        newErrors[`option_${i}`] = "Option cannot be empty";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        question: question.trim(),
        options: options.map((o) => o.trim()).filter(Boolean),
        is_anonymous: isAnonymous,
        is_multiple: isMultiple,
        closes_at: closesAt || undefined,
      });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setQuestion("");
    setOptions(["", ""]);
    setIsAnonymous(false);
    setIsMultiple(false);
    setClosesAt("");
    setErrors({});
    setIsSubmitting(false);
    onClose();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart2 size={18} style={{ color: "var(--clr-green)" }} />
                Create Poll
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* ---------------------------------------------------------------- */}
          {/* Question                                                          */}
          {/* ---------------------------------------------------------------- */}
          <div style={{ marginTop: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: 6,
                fontFamily: "var(--font-display)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Question <span style={{ color: "var(--clr-red)" }}>*</span>
            </label>
            <textarea
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (errors.question) setErrors((prev) => { const n = { ...prev }; delete n.question; return n; });
              }}
              placeholder="Ask a question…"
              maxLength={255}
              rows={2}
              style={{
                width: "100%",
                resize: "none",
                border: `1px solid ${errors.question ? "var(--clr-red)" : "var(--line)"}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 14,
                fontFamily: "inherit",
                color: "var(--ink)",
                background: "var(--surface-bg)",
                outline: "none",
                lineHeight: "20px",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => {
                if (!errors.question) e.currentTarget.style.borderColor = "var(--navy)";
              }}
              onBlur={(e) => {
                if (!errors.question) e.currentTarget.style.borderColor = "var(--line)";
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              {errors.question ? (
                <span style={{ fontSize: 11, color: "var(--clr-red)" }}>
                  {errors.question}
                </span>
              ) : (
                <span />
              )}
              <span style={{ fontSize: 11, color: "var(--text-fine)" }}>
                {question.length}/255
              </span>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Options                                                           */}
          {/* ---------------------------------------------------------------- */}
          <div style={{ marginTop: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: 6,
                fontFamily: "var(--font-display)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Options <span style={{ color: "var(--clr-red)" }}>*</span>
            </label>

            {errors.options && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--clr-red)",
                  marginBottom: 6,
                }}
              >
                {errors.options}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {options.map((opt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Option number pill */}
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--navy-l)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--navy)",
                      flexShrink: 0,
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {i + 1}
                  </div>

                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    style={{
                      flex: 1,
                      height: 36,
                      border: `1px solid ${errors[`option_${i}`] ? "var(--clr-red)" : "var(--line)"}`,
                      borderRadius: 8,
                      padding: "0 10px",
                      fontSize: 13,
                      fontFamily: "inherit",
                      color: "var(--ink)",
                      background: "var(--surface-bg)",
                      outline: "none",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => {
                      if (!errors[`option_${i}`]) e.currentTarget.style.borderColor = "var(--navy)";
                    }}
                    onBlur={(e) => {
                      if (!errors[`option_${i}`]) e.currentTarget.style.borderColor = "var(--line)";
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    aria-label={`Remove option ${i + 1}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: options.length <= 2 ? "var(--panel-bg)" : "var(--clr-red-bg)",
                      border: "none",
                      cursor: options.length <= 2 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: options.length <= 2 ? "var(--text-fine)" : "var(--clr-red)",
                      flexShrink: 0,
                      opacity: options.length <= 2 ? 0.4 : 1,
                      transition: "opacity 0.15s",
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 10,
                  background: "none",
                  border: "1px dashed var(--line)",
                  borderRadius: 8,
                  padding: "7px 12px",
                  fontSize: 13,
                  color: "var(--navy)",
                  cursor: "pointer",
                  fontFamily: "var(--font-display)",
                  width: "100%",
                  justifyContent: "center",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--navy-l)";
                  e.currentTarget.style.borderColor = "var(--navy)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.borderColor = "var(--line)";
                }}
              >
                <Plus size={14} />
                Add option
                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                  ({options.length}/10)
                </span>
              </button>
            )}
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Toggles                                                           */}
          {/* ---------------------------------------------------------------- */}
          <div
            style={{
              marginTop: 16,
              borderTop: "1px solid var(--line-soft)",
              paddingTop: 4,
            }}
          >
            <Toggle
              checked={isAnonymous}
              onChange={setIsAnonymous}
              label="Anonymous poll"
              description="Voter names will be hidden from everyone"
            />
            <div style={{ borderTop: "1px solid var(--line-soft)" }} />
            <Toggle
              checked={isMultiple}
              onChange={setIsMultiple}
              label="Multiple choice"
              description="Allow selecting more than one option"
            />
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Poll deadline                                                     */}
          {/* ---------------------------------------------------------------- */}
          <div style={{ marginTop: 12 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: 6,
                fontFamily: "var(--font-display)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Poll deadline
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 400,
                  marginLeft: 6,
                  color: "var(--text-muted)",
                  textTransform: "none",
                  letterSpacing: 0,
                }}
              >
                optional
              </span>
            </label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              style={{
                height: 36,
                width: "100%",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "0 10px",
                fontSize: 13,
                fontFamily: "inherit",
                color: closesAt ? "var(--ink)" : "var(--text-muted)",
                background: "var(--surface-bg)",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--navy)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
            />
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Footer                                                            */}
          {/* ---------------------------------------------------------------- */}
          <DialogFooter style={{ marginTop: 20 }}>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              style={{ background: "#19183B", color: "white" }}
            >
              {isSubmitting ? "Creating…" : "Create Poll"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
