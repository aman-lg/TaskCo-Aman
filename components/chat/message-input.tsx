"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Paperclip,
  Smile,
  Mic,
  Send,
  X,
  FileText,
  ImageIcon,
  BarChart2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PollCreator from "./poll-creator";
import type { ChatMessage } from "@/types/chat";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageInputProps {
  conversationId: string;
  currentUserId: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  onMessageSent?: (msg: ChatMessage) => void;
  onMessageEdited?: (msg: ChatMessage) => void;
  sendTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  adminOnly?: boolean;
  isAdmin?: boolean;
}

// ---------------------------------------------------------------------------
// Emoji constants
// ---------------------------------------------------------------------------

const FREQUENT_EMOJIS = [
  "😊", "❤️", "😂", "👍", "🎉",
  "😢", "😮", "🔥", "👀", "✅",
  "😍", "🙏", "😎", "🤔", "💯",
  "👋", "😅", "🥳", "😭", "🤣",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageInput({
  conversationId,
  currentUserId,
  replyTo,
  onClearReply,
  editingMessage = null,
  onCancelEdit,
  onMessageSent,
  onMessageEdited,
  sendTyping: sendTypingProp,
  disabled = false,
  adminOnly = false,
  isAdmin = false,
}: MessageInputProps) {
  const sendTyping = sendTypingProp ?? (() => {});
  const [text, setText] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingHeartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Auto-grow textarea
  // -------------------------------------------------------------------------

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineH = 24;
    const maxH = lineH * 6 + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  // -------------------------------------------------------------------------
  // Editing an existing message — prefill the box with its current content
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content ?? "");
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  // -------------------------------------------------------------------------
  // Close emoji picker on outside click
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!showEmojis) return;
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojis(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojis]);

  // -------------------------------------------------------------------------
  // Typing broadcast
  // -------------------------------------------------------------------------

  function stopTypingHeartbeat() {
    if (typingHeartbeatRef.current) {
      clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);

    if (val.length > 0) {
      sendTyping(true);
      // Realtime delivery is best-effort even on a healthy channel (see
      // the resync fallback on the messages side of this same issue).
      // Re-sending on a short heartbeat while actively typing gives each
      // attempt more chances to land, instead of relying on a single
      // upsert per burst of keystrokes.
      if (!typingHeartbeatRef.current) {
        typingHeartbeatRef.current = setInterval(() => sendTyping(true), 1500);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => { sendTyping(false); stopTypingHeartbeat(); }, 2000);
    } else {
      sendTyping(false);
      stopTypingHeartbeat();
    }
  }

  function handleBlur() {
    sendTyping(false);
    stopTypingHeartbeat();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }

  // -------------------------------------------------------------------------
  // Send text message
  // -------------------------------------------------------------------------

  async function saveEdit() {
    const content = text.trim();
    if (!content || !editingMessage || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/chat/messages/${editingMessage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? "Failed to edit message");
      }
      const respData = await res.json().catch(() => ({}));
      if (respData?.data?.message && onMessageEdited) {
        onMessageEdited(respData.data.message as ChatMessage);
      }
      setText("");
      onCancelEdit?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to edit message");
    } finally {
      setIsSending(false);
    }
  }

  async function sendMessage(
    overrideContent?: string,
    type: string = "text",
    metadata?: Record<string, unknown>
  ) {
    if (editingMessage) { await saveEdit(); return; }

    const content = overrideContent ?? text.trim();
    if (!content && type === "text") return;
    if (isSending) return;

    setIsSending(true);
    try {
      const body: Record<string, unknown> = {
        type,
        content,
      };
      if (replyTo) body.reply_to_id = replyTo.id;
      if (metadata) body.metadata = metadata;

      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? "Failed to send message");
      }

      const respData = await res.json().catch(() => ({}));
      if (respData?.data?.message && onMessageSent) {
        onMessageSent(respData.data.message as ChatMessage);
      }

      setText("");
      onClearReply();
      sendTyping(false);

      // scroll to bottom — dispatch custom event that the chat window listens to
      window.dispatchEvent(new CustomEvent("chat:scroll-to-bottom"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  // -------------------------------------------------------------------------
  // File upload helper
  // -------------------------------------------------------------------------

  async function uploadFile(file: File): Promise<{ url: string; name: string; size: number; mime: string }> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/chat/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error?.message ?? "Upload failed");
    }

    const { data } = await res.json();
    return data;
  }

  // -------------------------------------------------------------------------
  // Media/Document upload
  // -------------------------------------------------------------------------

  async function handleFileSelected(
    e: React.ChangeEvent<HTMLInputElement>,
    isMedia: boolean
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await uploadAndSend(file, isMedia);
  }

  async function uploadAndSend(file: File, isMedia: boolean) {
    setIsUploading(true);
    try {
      const uploaded = await uploadFile(file);
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const msgType = isMedia ? (isImage ? "image" : isVideo ? "video" : "document") : "document";

      await sendMessage(
        uploaded.name,
        msgType,
        {
          url: uploaded.url,
          filename: uploaded.name,
          size: uploaded.size,
          mime: uploaded.mime,
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  // Pasting a screenshot/copied image directly into the message box sends it
  // as an image attachment, same as picking one via the paperclip menu.
  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        // Clipboard image files often have no name/extension — give them one.
        const named = new File([file], file.name || `pasted-image-${Date.now()}.png`, { type: file.type });
        await uploadAndSend(named, true);
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Voice note recording
  // -------------------------------------------------------------------------

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        // Stop tracks
        recorder.stream.getTracks().forEach((t) => t.stop());

        setIsRecording(false);
        setRecordingSeconds(0);
        mediaRecorderRef.current = null;

        if (blob.size < 1000) {
          resolve();
          return;
        }

        setIsUploading(true);
        try {
          const uploaded = await uploadFile(file);
          await sendMessage(
            "Voice note",
            "voice_note",
            {
              url: uploaded.url,
              filename: uploaded.name,
              size: uploaded.size,
              mime: uploaded.mime,
              duration: recordingSeconds,
            }
          );
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to send voice note");
        } finally {
          setIsUploading(false);
        }

        resolve();
      };

      recorder.stop();
    });
  }

  function formatRecordingTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // -------------------------------------------------------------------------
  // Poll creation
  // -------------------------------------------------------------------------

  async function handlePollSubmit(pollData: {
    question: string;
    options: string[];
    is_anonymous: boolean;
    is_multiple: boolean;
    closes_at?: string;
  }) {
    await sendMessage(
      pollData.question,
      "poll",
      {
        poll: pollData,
      }
    );
    setShowPollCreator(false);
  }

  // -------------------------------------------------------------------------
  // Admin-only guard
  // -------------------------------------------------------------------------

  if (adminOnly && !isAdmin) {
    return (
      <div
        style={{
          borderTop: "1px solid var(--line)",
          background: "var(--panel-bg)",
          padding: "12px 20px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 13,
          fontFamily: "var(--font-display)",
        }}
      >
        Only admins can send messages
      </div>
    );
  }

  const canSend = !disabled && !isUploading;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* Poll Creator Dialog */}
      <PollCreator
        open={showPollCreator}
        onClose={() => setShowPollCreator(false)}
        onSubmit={handlePollSubmit}
      />

      <div
        style={{
          borderTop: "1px solid var(--line)",
          background: "var(--panel-bg)",
          padding: "8px 12px",
          flexShrink: 0,
        }}
      >
        {/* Editing bar */}
        {editingMessage && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-bg)",
              border: "1px solid var(--line-soft)",
              borderRadius: 8,
              padding: "6px 10px",
              marginBottom: 8,
            }}
          >
            <Pencil size={14} style={{ color: "var(--navy)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--navy)", fontFamily: "var(--font-display)" }}>
                Editing message
              </div>
            </div>
            <button
              onClick={() => { setText(""); onCancelEdit?.(); }}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 4,
                color: "var(--text-muted)", display: "flex", alignItems: "center", borderRadius: 4,
              }}
              aria-label="Cancel edit"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Reply preview bar */}
        {!editingMessage && replyTo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-bg)",
              border: "1px solid var(--line-soft)",
              borderRadius: 8,
              padding: "6px 10px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 3,
                alignSelf: "stretch",
                borderRadius: 2,
                background: "var(--navy)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--navy)",
                  fontFamily: "var(--font-display)",
                  marginBottom: 2,
                }}
              >
                Reply
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {replyTo.type === "text"
                  ? replyTo.content
                  : `[${replyTo.type}]`}
              </div>
            </div>
            <button
              onClick={onClearReply}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
              }}
              aria-label="Clear reply"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Recording state */}
        {isRecording ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 4px",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--clr-red)",
                animation: "pulse 1s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: "var(--clr-red)",
                fontSize: 14,
                fontFamily: "var(--font-display)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatRecordingTime(recordingSeconds)}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              Recording voice note…
            </span>
            <button
              onClick={() => void stopRecording()}
              style={{
                background: "var(--clr-red)",
                border: "none",
                borderRadius: "50%",
                width: 36,
                height: 36,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                flexShrink: 0,
              }}
              aria-label="Stop recording"
            >
              <Send size={16} />
            </button>
          </div>
        ) : (
          /* Normal input row */
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            {/* Left: attachment + emoji */}
            <div style={{ display: "flex", gap: 2, paddingBottom: 4, flexShrink: 0 }}>
              {/* Attachment dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={!canSend}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: canSend ? "pointer" : "not-allowed",
                    padding: "6px",
                    color: "var(--text-muted)",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    opacity: canSend ? 1 : 0.5,
                  }}
                  aria-label="Attach file"
                >
                  <Paperclip size={20} />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start">
                  {/* This app's DropdownMenuItem wraps @base-ui/react's Menu.Item,
                      whose action prop is onClick — not onSelect. onSelect is a
                      real React DOM prop, but it maps to the native text-selection
                      event, which never fires on a menu item div. All three items
                      here were silently dead for every real user interaction
                      (mouse and keyboard) until this was caught by testing the
                      actual click path end to end instead of just the resulting
                      API calls. */}
                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon size={15} style={{ marginRight: 8, color: "var(--navy)" }} />
                    Photo / Video
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => docInputRef.current?.click()}
                  >
                    <FileText size={15} style={{ marginRight: 8, color: "var(--accent-brand)" }} />
                    Document
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowPollCreator(true)}
                  >
                    <BarChart2 size={15} style={{ marginRight: 8, color: "var(--clr-green)" }} />
                    Poll
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Emoji picker toggle */}
              <div style={{ position: "relative" }} ref={emojiRef}>
                <button
                  disabled={!canSend}
                  onClick={() => setShowEmojis((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: canSend ? "pointer" : "not-allowed",
                    padding: "6px",
                    color: showEmojis ? "var(--navy)" : "var(--text-muted)",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    opacity: canSend ? 1 : 0.5,
                  }}
                  aria-label="Emoji picker"
                >
                  <Smile size={20} />
                </button>

                {showEmojis && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: 0,
                      background: "var(--surface-bg)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 10,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: 4,
                      zIndex: 50,
                      width: 190,
                    }}
                  >
                    {FREQUENT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setText((t) => t + emoji);
                          textareaRef.current?.focus();
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 22,
                          padding: "4px",
                          borderRadius: 6,
                          lineHeight: 1,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "var(--navy-l)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "none";
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onPaste={(e) => void handlePaste(e)}
              disabled={!canSend}
              rows={1}
              placeholder={
                isUploading
                  ? "Uploading…"
                  : disabled
                  ? "You cannot send messages here"
                  : editingMessage
                  ? "Edit message…"
                  : "Type a message…"
              }
              style={{
                flex: 1,
                resize: "none",
                border: "1px solid var(--line)",
                borderRadius: 20,
                padding: "8px 14px",
                fontSize: 14,
                fontFamily: "inherit",
                color: "var(--ink)",
                background: "var(--surface-bg)",
                outline: "none",
                lineHeight: "24px",
                overflowY: "auto",
                maxHeight: `${24 * 6 + 16}px`,
                minHeight: 40,
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--navy)";
              }}
              onBlurCapture={(e) => {
                e.currentTarget.style.borderColor = "var(--line)";
              }}
            />

            {/* Right: send or mic */}
            <div style={{ paddingBottom: 4, flexShrink: 0 }}>
              {text.trim().length > 0 ? (
                <button
                  onClick={() => void sendMessage()}
                  disabled={!canSend || isSending}
                  aria-label="Send message"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#19183B",
                    border: "none",
                    cursor: canSend && !isSending ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    opacity: canSend && !isSending ? 1 : 0.5,
                    transition: "opacity 0.15s, transform 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (canSend && !isSending)
                      (e.currentTarget as HTMLButtonElement).style.transform =
                        "scale(1.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform =
                      "scale(1)";
                  }}
                >
                  <Send size={16} />
                </button>
              ) : (
                <button
                  onMouseDown={() => void startRecording()}
                  onMouseUp={() => void stopRecording()}
                  onMouseLeave={() => {
                    if (isRecording) void stopRecording();
                  }}
                  onTouchStart={() => void startRecording()}
                  onTouchEnd={() => void stopRecording()}
                  disabled={!canSend}
                  aria-label="Hold to record voice note"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: isRecording
                      ? "var(--clr-red)"
                      : "var(--navy-l)",
                    border: "none",
                    cursor: canSend ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isRecording ? "white" : "var(--navy)",
                    opacity: canSend ? 1 : 0.5,
                    transition: "background 0.15s",
                  }}
                >
                  <Mic size={18} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={(e) => void handleFileSelected(e, true)}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
        style={{ display: "none" }}
        onChange={(e) => void handleFileSelected(e, false)}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
