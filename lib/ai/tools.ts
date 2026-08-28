// SERVER ONLY — never import from "use client" files.
// Tool declarations + dispatcher for Ask Tasko's Gemini function-calling loop.
//
// Read tools execute immediately (they only ever SELECT, under the acting
// user's own session — same RLS as if they'd browsed the app themselves).
// Write tools NEVER execute here — see app/api/chat/conversations/[id]/ai-reply
// and app/api/chat/ai-actions/[id]/confirm: a write tool call only ever
// produces a proposed ai_actions row; the actual mutation happens later, if
// and only if the user clicks Confirm, re-validated against the exact same
// Zod schemas the human "create task" form uses.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";
import type { FunctionDeclaration } from "@/lib/ai/gemini";
import { embedContent } from "@/lib/ai/gemini";
import { getAllTasks, getTaskStats } from "@/lib/queries/tasks";
import { getProjects } from "@/lib/queries/projects";
import { createTaskSchema, updateTaskSchema, assignTaskSchema } from "@/lib/validations/tasks";

type Client = SupabaseClient<Database>;

export const WRITE_TOOL_NAMES = new Set(["create_task", "update_task", "assign_task"]);

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "list_tasks",
    description:
      "List tasks, optionally filtered by status and/or assigned-to-me. Use this for questions like " +
      "'what are my tasks', 'what's still in progress', 'what's overdue'.",
    parameters: {
      type: "OBJECT",
      properties: {
        status: { type: "STRING", enum: ["todo", "in_progress", "done"], description: "Filter by status." },
        assigned_to_me: { type: "BOOLEAN", description: "Only tasks assigned to the person asking." },
        overdue_only: { type: "BOOLEAN", description: "Only tasks whose deadline has passed and are not done." },
      },
    },
  },
  {
    name: "search_tasks",
    description: "Keyword-search task names and descriptions. Use for 'find the task about X'.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Search text." } },
      required: ["query"],
    },
  },
  {
    name: "semantic_search",
    description:
      "Fuzzy/semantic search over task and project descriptions when a keyword search wouldn't work well " +
      "— e.g. 'what did we decide about the client's logo', 'anything about the Q3 launch'.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Natural-language question or topic." },
        project_id: { type: "STRING", description: "Optional — restrict to one project's id." },
      },
      required: ["query"],
    },
  },
  {
    name: "find_project",
    description: "Look up a project's id by (partial) title. Call this before create_task/get_project_summary if you only have a project name.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Partial or full project title." } },
      required: ["query"],
    },
  },
  {
    name: "get_project_summary",
    description: "Get a project's details plus a status breakdown of its tasks.",
    parameters: {
      type: "OBJECT",
      properties: { project_id: { type: "STRING", description: "The project's id." } },
      required: ["project_id"],
    },
  },
  {
    name: "find_person",
    description: "Look up a person's user id by (partial) name or email. Call this before assign_task if you only have a name.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Partial or full name/email." } },
      required: ["query"],
    },
  },
  {
    name: "create_task",
    description:
      "Propose creating a new task. Requires project_id — call find_project first if you don't have it. " +
      "This does not create anything immediately: it shows the user a confirm/cancel card.",
    parameters: {
      type: "OBJECT",
      properties: {
        project_id: { type: "STRING" },
        name: { type: "STRING" },
        description: { type: "STRING" },
        deadline: { type: "STRING", description: "ISO 8601 datetime, if mentioned." },
        urgency: { type: "STRING", enum: ["low", "medium", "high", "urgent"] },
      },
      required: ["project_id", "name"],
    },
  },
  {
    name: "update_task",
    description: "Propose updating an existing task's fields (e.g. changing status, deadline, urgency). Never executes immediately.",
    parameters: {
      type: "OBJECT",
      properties: {
        task_id: { type: "STRING" },
        name: { type: "STRING" },
        description: { type: "STRING" },
        deadline: { type: "STRING" },
        urgency: { type: "STRING", enum: ["low", "medium", "high", "urgent"] },
        status: { type: "STRING", enum: ["todo", "in_progress", "done"] },
      },
      required: ["task_id"],
    },
  },
  {
    name: "assign_task",
    description: "Propose assigning a person to a task. Requires both ids — call find_person/search_tasks first if needed. Never executes immediately.",
    parameters: {
      type: "OBJECT",
      properties: {
        task_id: { type: "STRING" },
        user_id: { type: "STRING" },
      },
      required: ["task_id", "user_id"],
    },
  },
];

export const SYSTEM_INSTRUCTION = `You are Tasko, the AI assistant built into TaskCo (a task/project management app).
Answer questions using the provided tools — never invent task/project data or ids.
When the user asks you to create/update/assign something, call the matching tool; it will show them a
confirm/cancel card and nothing happens until they confirm, so it's fine to propose it directly once you
have enough information. If you're missing a project/person's id, call find_project/find_person first.
If a name is ambiguous (multiple matches), ask the user to clarify instead of guessing.
Keep answers concise and concrete — cite task/project names, not raw ids, in your replies.`;

// ─── Read tools (execute immediately) ──────────────────────────────────────

export async function executeReadTool(
  supabase: Client,
  currentUserId: string,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "list_tasks": {
      const tasks = await getAllTasks(supabase);
      let filtered = tasks;
      if (args.status) filtered = filtered.filter((t) => t.status === args.status);
      if (args.assigned_to_me) {
        filtered = filtered.filter((t) => t.task_assignees?.some((a) => a.user_id === currentUserId));
      }
      if (args.overdue_only) {
        const now = Date.now();
        filtered = filtered.filter((t) => t.status !== "done" && t.deadline && new Date(t.deadline).getTime() < now);
      }
      return filtered.slice(0, 30).map(summarizeTask);
    }

    case "search_tasks": {
      const query = String(args.query ?? "").trim();
      if (!query) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("tasks")
        .select("id, name, description, status, urgency, deadline, project:projects!project_id(id, title)")
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(15);
      return data ?? [];
    }

    case "semantic_search": {
      const query = String(args.query ?? "").trim();
      if (!query) return [];
      const embedding = await embedContent(query);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("match_ai_embeddings", {
        query_embedding: embedding,
        match_count: 8,
        filter_project_id: args.project_id ?? null,
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    }

    case "find_project": {
      const query = String(args.query ?? "").trim();
      const projects = await getProjects(supabase);
      const q = query.toLowerCase();
      return projects
        .filter((p) => p.title.toLowerCase().includes(q))
        .slice(0, 8)
        .map((p) => ({ id: p.id, title: p.title, status: p.status }));
    }

    case "get_project_summary": {
      const projectId = String(args.project_id ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: project } = await (supabase as any).from("projects").select("*").eq("id", projectId).single();
      if (!project) return { error: "Project not found" };
      const tasks = await getAllTasks(supabase);
      const projectTasks = tasks.filter((t) => t.project_id === projectId);
      return {
        title: project.title,
        description: project.description,
        status: project.status,
        deadline: project.deadline,
        task_count: projectTasks.length,
        by_status: {
          todo: projectTasks.filter((t) => t.status === "todo").length,
          in_progress: projectTasks.filter((t) => t.status === "in_progress").length,
          done: projectTasks.filter((t) => t.status === "done").length,
        },
        tasks: projectTasks.slice(0, 20).map(summarizeTask),
      };
    }

    case "find_person": {
      const query = String(args.query ?? "").trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(8);
      return data ?? [];
    }

    default:
      throw new Error(`Unknown read tool: ${name}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizeTask(t: any) {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    urgency: t.urgency,
    deadline: t.deadline,
    project_id: t.project_id,
    assignees: (t.task_assignees ?? []).map((a: { assignee?: { full_name: string | null } | null }) => a.assignee?.full_name).filter(Boolean),
  };
}

// ─── Write tools (validate only — never executed here) ────────────────────

export interface WriteToolValidation {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  summary?: string;
}

/** Validates a proposed write tool's args against the same Zod schema the human UI uses. */
export function validateWriteTool(name: string, args: Record<string, unknown>): WriteToolValidation {
  switch (name) {
    case "create_task": {
      const parsed = createTaskSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
      return {
        ok: true,
        data: parsed.data,
        summary: `Create task "${parsed.data.name}"${parsed.data.urgency !== "medium" ? ` (${parsed.data.urgency} urgency)` : ""}${parsed.data.deadline ? ` due ${new Date(parsed.data.deadline).toLocaleDateString()}` : ""}`,
      };
    }
    case "update_task": {
      const { task_id, ...fields } = args;
      if (typeof task_id !== "string") return { ok: false, error: "task_id is required" };
      const parsed = updateTaskSchema.safeParse(fields);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
      if (Object.keys(parsed.data).length === 0) return { ok: false, error: "No fields to update" };
      return {
        ok: true,
        data: { task_id, ...parsed.data },
        summary: `Update task: ${Object.entries(parsed.data).map(([k, v]) => `${k} → ${v}`).join(", ")}`,
      };
    }
    case "assign_task": {
      const { task_id, ...rest } = args;
      if (typeof task_id !== "string") return { ok: false, error: "task_id is required" };
      const parsed = assignTaskSchema.safeParse(rest);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
      return { ok: true, data: { task_id, ...parsed.data }, summary: `Assign this task to the selected person` };
    }
    default:
      return { ok: false, error: `Unknown write tool: ${name}` };
  }
}
