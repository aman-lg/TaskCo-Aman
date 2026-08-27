"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, Table2 } from "lucide-react";
import { BulkTaskDialog } from "./bulk-task-dialog";

interface Props {
  projects: { id: string; title: string }[];
}

export function NewTaskButton({ projects }: Props) {
  const [open, setOpen] = useState(false);

  if (projects.length === 0) return null;

  return (
    <>
      <Link
        href="/tasks/bulk-assign"
        className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-bold transition-colors duration-150 border border-[var(--line)] text-[var(--text-secondary)] hover:bg-[var(--line-soft)]"
      >
        <Table2 className="h-4 w-4" /> Bulk Assign (Grid)
      </Link>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-bold text-white transition-colors duration-150 bg-[var(--navy)] hover:bg-[var(--navy-hover)]"
      >
        <UserPlus className="h-4 w-4" /> Assign Task
      </button>
      <BulkTaskDialog open={open} onClose={() => setOpen(false)} projects={projects} />
    </>
  );
}
