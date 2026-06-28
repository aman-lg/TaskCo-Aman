"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2, Calendar, AlertCircle, GripVertical } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";
import type { Task } from "@/types";
import type { TaskWithMeta } from "@/lib/queries/tasks";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskWithChecklist = TaskWithMeta;

const COLUMNS: { id: TaskStatus; label: string; colorToken: string }[] = [
  { id: "todo",        label: "To Do",       colorToken: "--status-todo" },
  { id: "in_progress", label: "In Progress",  colorToken: "--status-in-progress" },
  { id: "done",        label: "Done",         colorToken: "--status-done" },
];

const URGENCY_TOKEN: Record<string, string> = {
  low:    "--urgency-low",
  medium: "--urgency-medium",
  high:   "--urgency-high",
  urgent: "--urgency-urgent",
};
const URGENCY_BG_TOKEN: Record<string, string> = {
  low:    "--urgency-low-bg",
  medium: "--urgency-medium-bg",
  high:   "--urgency-high-bg",
  urgent: "--urgency-urgent-bg",
};

interface Props {
  tasks: TaskWithChecklist[];
  projectId: string;
  currentUserId: string;
}

export function KanbanBoard({ tasks, projectId, currentUserId }: Props) {
  const router = useRouter();
  const [addingIn, setAddingIn] = useState<TaskStatus | null>(null);
  const [detailTask, setDetailTask] = useState<TaskWithChecklist | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  // Sync detailTask with updated tasks from server
  useEffect(() => {
    setDetailTask((prev) => {
      if (!prev) return null;
      return tasks.find((t) => t.id === prev.id) ?? prev;
    });
  }, [tasks]);

  async function deleteTask(task: Task) {
    if (!confirm(`Delete "${task.name}"?`)) return;
    await fetch(`/api/tasks/${task.id}`, { method: "DELETE", credentials: "same-origin" });
    router.refresh();
  }

  async function moveTask(task: Task, newStatus: TaskStatus) {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    const targetCol = over.id as TaskStatus;
    if (!task || task.status === targetCol) return;
    moveTask(task, targetCol);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 items-start overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <KanbanColumn
                key={col.id}
                col={col}
                tasks={colTasks}
                activeId={activeId}
                currentUserId={currentUserId}
                onAddClick={() => setAddingIn(col.id)}
                onOpen={(task) => setDetailTask(task)}
                onEdit={(task) => setEditTask(task)}
                onDelete={deleteTask}
                onMove={moveTask}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCardOverlay task={activeTask} />
          )}
        </DragOverlay>
      </DndContext>

      <TaskFormDialog
        open={!!addingIn}
        onClose={() => setAddingIn(null)}
        projectId={projectId}
        defaultStatus={addingIn ?? "todo"}
      />

      {editTask && (
        <TaskFormDialog
          open={!!editTask}
          onClose={() => setEditTask(null)}
          projectId={projectId}
          task={editTask}
        />
      )}

      <TaskDetailSheet
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        currentUserId={currentUserId}
      />
    </>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

interface ColumnProps {
  col: typeof COLUMNS[number];
  tasks: TaskWithChecklist[];
  activeId: string | null;
  currentUserId: string;
  onAddClick: () => void;
  onOpen: (task: TaskWithChecklist) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
}

function KanbanColumn({
  col, tasks, activeId, currentUserId, onAddClick, onOpen, onEdit, onDelete, onMove,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-[280px] sm:flex-1 sm:min-w-0 sm:w-auto flex flex-col gap-3 rounded-xl p-3 min-h-[200px] transition-colors duration-150"
      style={{
        background: isOver ? "var(--accent-bg)" : "var(--panel-bg)",
        border: `1px solid ${isOver ? "var(--accent-brand)" : "var(--line-soft)"}`,
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: `var(${col.colorToken})` }}
          />
          <span
            className="text-[12px] font-bold uppercase tracking-[0.8px]"
            style={{ color: "var(--text-muted)" }}
          >
            {col.label}
          </span>
          <span
            className="text-[11px] font-semibold px-1.5 rounded"
            style={{ background: "var(--line)", color: "var(--text-secondary)" }}
          >
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          className="p-1 rounded-lg transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
          aria-label={`Add task to ${col.label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Task cards */}
      <div className="flex flex-col gap-2.5">
        {tasks.map((task) => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            isDragging={activeId === task.id}
            currentUserId={currentUserId}
            onOpen={() => onOpen(task)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
            onMove={(s) => onMove(task, s)}
          />
        ))}
      </div>

      {tasks.length === 0 && (
        <p className="text-center text-[12px] py-6" style={{ color: "var(--text-fine)" }}>
          {activeId ? "Drop here" : "No tasks"}
        </p>
      )}
    </div>
  );
}

// ── Draggable card wrapper ────────────────────────────────────────────────────

interface DraggableCardProps {
  task: TaskWithChecklist;
  isDragging: boolean;
  currentUserId: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (status: TaskStatus) => void;
}

function DraggableTaskCard({ task, isDragging, ...rest }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const style: React.CSSProperties = {
    touchAction: "none",
    cursor: isDragging ? "grabbing" : "grab",
    opacity: isDragging ? 0 : 1,
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} {...rest} />
    </div>
  );
}

// ── Ghost overlay while dragging ──────────────────────────────────────────────

function TaskCardOverlay({ task }: { task: TaskWithChecklist }) {
  return (
    <div
      className="flex flex-col gap-2.5 p-3.5 rounded-xl border shadow-lg rotate-2 cursor-grabbing"
      style={{
        background: "var(--surface-bg)",
        borderColor: "var(--navy)",
        opacity: 0.95,
        width: 260,
      }}
    >
      <p className="text-[13px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
        {task.name}
      </p>
    </div>
  );
}

// ── Individual task card ──────────────────────────────────────────────────────

interface CardProps {
  task: TaskWithChecklist;
  currentUserId: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (status: TaskStatus) => void;
}

function TaskCard({ task, currentUserId, onOpen, onEdit, onDelete, onMove }: CardProps) {
  const isCreator = task.created_by === currentUserId;
  const urgencyColor = `var(${URGENCY_TOKEN[task.urgency ?? "medium"]})`;
  const urgencyBg = `var(${URGENCY_BG_TOKEN[task.urgency ?? "medium"]})`;

  const checklist = task.task_checklist_items ?? [];
  const doneCnt = checklist.filter((i) => i.is_done).length;
  const totalCnt = checklist.length;

  const deadline = task.deadline
    ? new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;
  const isPastDeadline =
    task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";

  const otherStatuses: TaskStatus[] = (["todo", "in_progress", "done"] as TaskStatus[]).filter(
    (s) => s !== task.status
  );
  const STATUS_LABEL: Record<TaskStatus, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  };

  return (
    <article
      className="group relative flex flex-col gap-2.5 p-3.5 rounded-xl border transition-shadow hover:shadow-[var(--shadow-soft)]"
      style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {/* Grip icon — visual hint only */}
      <div
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-40 transition-opacity duration-100"
        style={{ color: "var(--text-fine)" }}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* Dropdown menu — stops pointer propagation to prevent accidental drag */}
      {isCreator && (
        <div
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              className="p-1 rounded-lg transition-colors"
              style={{ color: "var(--text-muted)" }}
              aria-label="Task options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              {otherStatuses.map((s) => (
                <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                  Move → {STATUS_LABEL[s]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} style={{ color: "var(--clr-red)" }}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Task name */}
      <p className="text-[13px] font-semibold pr-5 pl-3 leading-snug" style={{ color: "var(--ink)" }}>
        {task.name}
      </p>

      {/* Description preview */}
      {task.description && (
        <p
          className="text-[12px] leading-snug line-clamp-2 pl-3"
          style={{ color: "var(--text-secondary)" }}
        >
          {task.description}
        </p>
      )}

      {/* Urgency badge */}
      <span
        className="self-start inline-flex items-center h-5 px-2 rounded text-[10px] font-bold"
        style={{ background: urgencyBg, color: urgencyColor }}
      >
        {(task.urgency ?? "medium").toUpperCase()}
      </span>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        {totalCnt > 0 && (
          <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            ☑ {doneCnt}/{totalCnt}
          </span>
        )}
        {deadline && (
          <span
            className="flex items-center gap-1 text-[11px] font-medium ml-auto"
            style={{ color: isPastDeadline ? "var(--clr-red)" : "var(--text-muted)" }}
          >
            {isPastDeadline
              ? <AlertCircle className="h-3 w-3" />
              : <Calendar className="h-3 w-3" />}
            {deadline}
          </span>
        )}
      </div>
    </article>
  );
}
