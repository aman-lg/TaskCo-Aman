"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Link as LinkIcon, BarChart3, FileText } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface FormRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  requires_login: boolean;
  has_rating_subject: boolean;
  is_published: boolean;
  created_at: string;
}

export function FormsListClient({ initialForms }: { initialForms: FormRow[] }) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [requiresLogin, setRequiresLogin] = useState(true);
  const [hasRatingSubject, setHasRatingSubject] = useState(false);
  const [creating, setCreating] = useState(false);

  async function createForm() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setCreating(true);
    const res = await fetch("/api/forms", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, requires_login: requiresLogin, has_rating_subject: hasRatingSubject }),
    });
    const json = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) { toast.error(json?.error?.message ?? "Couldn't create form"); return; }
    setForms((prev) => [json.data, ...prev]);
    setOpen(false);
    setTitle(""); setRequiresLogin(true); setHasRatingSubject(false);
    router.push(`/forms/${json.data.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold text-white self-start"
        style={{ background: "var(--navy)" }}
      >
        <Plus className="w-4 h-4" /> Create Form
      </button>

      {forms.length === 0 ? (
        <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-fine)" }}>No forms yet.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-bg)" }}>
          <ul>
            {forms.map((f) => (
              <li key={f.id} className="border-t first:border-t-0 px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--line)" }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/forms/${f.id}`} className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink)" }}>{f.title}</Link>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: f.is_published ? "var(--clr-green)" : "var(--text-muted)", background: f.is_published ? "var(--clr-green-bg)" : "var(--line)" }}>
                      {f.is_published ? "Published" : "Draft"}
                    </span>
                    {!f.requires_login && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: "var(--navy)", background: "var(--navy-l)" }}>No login</span>
                    )}
                  </div>
                  {f.description && <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{f.description}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Link href={`/form/${f.slug}`} target="_blank" className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "var(--text-muted)" }} title="Open fill link">
                    <LinkIcon className="w-4 h-4" />
                  </Link>
                  <Link href={`/forms/${f.id}/responses`} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "var(--text-muted)" }} title="Responses">
                    <FileText className="w-4 h-4" />
                  </Link>
                  {f.has_rating_subject && (
                    <Link href={`/forms/${f.id}/results`} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "var(--text-muted)" }} title="Results">
                      <BarChart3 className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Form</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <input placeholder="Form title" value={title} onChange={(e) => setTitle(e.target.value)}
              className="h-9 px-3 rounded-lg text-[13.5px]" style={{ border: "1px solid var(--line)", background: "var(--page-bg)", color: "var(--ink)" }} />
            <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={requiresLogin} onChange={(e) => setRequiresLogin(e.target.checked)} />
              Requires login to fill
            </label>
            <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={hasRatingSubject}
                onChange={(e) => { setHasRatingSubject(e.target.checked); if (e.target.checked) setRequiresLogin(true); }} />
              Rating form (each response rates one team member)
            </label>
          </div>
          <DialogFooter>
            <button onClick={() => void createForm()} disabled={creating}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-60" style={{ background: "var(--navy)" }}>
              {creating ? "Creating…" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
