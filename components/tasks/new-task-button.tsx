"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { BulkTaskDialog } from "./bulk-task-dialog";

interface Props {
  projects: { id: string; title: string }[];
}

export function NewTaskButton({ projects }: Props) {
  const [open, setOpen] = useState(false);

  if (projects.length === 0) return null;

  return (
    <>
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
