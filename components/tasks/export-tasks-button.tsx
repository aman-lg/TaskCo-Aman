"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export interface TaskExportRow {
  Project: string;
  Task: string;
  Status: string;
  Urgency: string;
  Assignees: string;
  Checklist: string;
  Deadline: string;
  "Created By": string;
  "Created At": string;
}

interface ExportTasksButtonProps {
  rows: TaskExportRow[];
}

export function ExportTasksButton({ rows }: ExportTasksButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (rows.length === 0 || isExporting) return;
    setIsExporting(true);
    try {
      // Lazy-loaded — keeps the xlsx library out of the initial page bundle.
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 22 }, { wch: 36 }, { wch: 12 }, { wch: 10 },
        { wch: 24 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 12 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `taskco-tasks-${date}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting || rows.length === 0}
      className="h-9 px-4 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        color: "var(--ink)",
        background: "var(--surface-bg)",
        boxShadow: "0 0 0 1px var(--line)",
      }}
      onMouseEnter={(e) => {
        if (!isExporting) e.currentTarget.style.background = "var(--panel-bg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--surface-bg)";
      }}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export to Excel
    </button>
  );
}
