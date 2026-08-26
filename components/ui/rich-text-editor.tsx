"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function EditorSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rte-wrap", className)} aria-hidden="true">
      <div
        style={{
          height: 37,
          borderBottom: "1px solid var(--line-soft)",
          background: "var(--surface-muted, var(--line-soft))",
          opacity: 0.6,
        }}
      />
      <div style={{ minHeight: 90 }} />
    </div>
  );
}

// CKEditor 5's classic build touches `window`/`document` as soon as it is
// evaluated, so it must never be imported during SSR. next/dynamic with
// `ssr: false` defers loading the real editor (and the CKEditor + build
// packages it needs) to the browser only.
const CKEditorField = dynamic(
  async () => {
    const [{ CKEditor }, { default: ClassicEditor }] = await Promise.all([
      import("@ckeditor/ckeditor5-react"),
      import("@ckeditor/ckeditor5-build-classic"),
    ]);

    function Field({ value, onChange, placeholder, className }: RichTextEditorProps) {
      // CKEditor is an uncontrolled component: `data` only seeds the
      // initial content. Keep it in sync with external `value` changes
      // (e.g. `reset()` from react-hook-form when editing a different
      // record) without fighting the user's own typing, mirroring the
      // previous Tiptap wrapper's sync effect.
      const editorRef = useRef<{ getData(): string; setData(data: string): void } | null>(null);

      useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const current = editor.getData();
        const next = value || "";
        if (next !== current) {
          editor.setData(next);
        }
      }, [value]);

      return (
        <div className={cn("rte-wrap", className)}>
          <CKEditor
            editor={ClassicEditor}
            data={value || ""}
            config={{
              placeholder,
              toolbar: {
                items: [
                  "heading",
                  "|",
                  "bold",
                  "italic",
                  "|",
                  "bulletedList",
                  "numberedList",
                  "|",
                  "link",
                  "blockQuote",
                  "|",
                  "undo",
                  "redo",
                ],
              },
            }}
            onReady={(editor) => {
              editorRef.current = editor;
            }}
            onChange={(_event, editor) => {
              onChange(editor.getData());
            }}
          />
        </div>
      );
    }

    return Field;
  },
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  },
);

export function RichTextEditor(props: RichTextEditorProps) {
  return <CKEditorField {...props} />;
}
