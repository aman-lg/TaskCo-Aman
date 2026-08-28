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

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";
import type { FunctionDeclaration } from "@/lib/ai/gemini";
import { embedContent } from "@/lib/ai/gemini";
import { getAllTasks, getTaskStats } from "@/lib/queries/tasks";
import { getProjects } from "@/lib/queries/projects";
import { createTaskSchema, updateTaskSchema } from "@/lib/validations/tasks";
import { findOrgUnits, getUsersInUnitTree } from "@/lib/queries/org";

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
    description: "Look up a person's user id by (partial) name or email. Call this before assigning a task if you only have a name.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Partial or full name/email." } },
      required: ["query"],
    },
  },
  {
    name: "find_department",
    description:
      "Look up a department/sub-department's id by (partial) name. Call this before create_task/assign_task " +
      "whenever the user names a department or sub-department instead of (or in addition to) a specific person " +
      "— e.g. 'assign this to the design team', 'give it to everyone in Engineering'.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Partial or full department/sub-department name." } },
      required: ["query"],
    },
  },
  {
    name: "get_department_members",
    description:
      "List everyone in a department/sub-department (and anyone in units nested under it) — call find_department " +
      "first to get its id, then this to get the actual user ids to pass as assignee_ids/user_ids.",
    parameters: {
      type: "OBJECT",
      properties: { unit_id: { type: "STRING", description: "A department/sub-department's id, from find_department." } },
      required: ["unit_id"],
    },
  },
  {
    name: "create_task",
    description:
      "Propose creating a new task. Requires project_id — call find_project first if you don't have it. " +
      "If the user named people and/or a department to assign it to, resolve them first (find_person / " +
      "find_department + get_department_members) and pass their ids as assignee_ids — never put names, " +
      "department labels, or 'assigned to X' text into the description field. " +
      "This does not create anything immediately: it shows the user a confirm/cancel card.",
    parameters: {
      type: "OBJECT",
      properties: {
        project_id: { type: "STRING" },
        name: { type: "STRING" },
        description: { type: "STRING" },
        deadline: { type: "STRING", description: "ISO 8601 datetime, if mentioned." },
        urgency: { type: "STRING", enum: ["low", "medium", "high", "urgent"] },
        assignee_ids: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "User ids to assign this task to, already resolved via find_person/get_department_members.",
        },
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
    description:
      "Propose assigning one or more people to an EXISTING task. Resolve names/departments first " +
      "(find_person, or find_department + get_department_members) — never guess ids. Never executes immediately.",
    parameters: {
      type: "OBJECT",
      properties: {
        task_id: { type: "STRING" },
        user_ids: { type: "ARRAY", items: { type: "STRING" }, description: "One or more user ids to assign." },
      },
      required: ["task_id", "user_ids"],
    },
  },
];

export const SYSTEM_INSTRUCTION = `You are Tasko, the AI assistant built into TaskCo (a task/project management app).
Answer questions using the provided tools — never invent task/project data or ids.
When the user asks you to create/update/assign something, call the matching tool; it will show them a
confirm/cancel card and nothing happens until they confirm, so it's fine to propose it directly once you
have enough information. If you're missing a project/person's id, call find_project/find_person first.
If the user names a department or sub-department to assign work to, call find_department then
get_department_members to resolve it to real user ids — never write department/person names into a task's
description as a substitute for actually assigning it; assignee_ids (create_task) and user_ids (assign_task)
are exactly for this.
If a name is ambiguous (multiple matches), ask the user to clarify instead of guessing.
Keep answers concise and concrete — cite task/project and people's names, not raw ids, in your replies.`;

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

    case "find_department": {
      const query = String(args.query ?? "").trim();
      const units = await findOrgUnits(supabase, query);
      return units.map((u) => ({ id: u.id, name: u.name, parent: u.parentName }));
    }

    case "get_department_members": {
      const unitId = String(args.unit_id ?? "");
      if (!unitId) return [];
      return getUsersInUnitTree(supabase, unitId);
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
      const { assignee_ids, ...taskFields } = args;
      const parsed = createTaskSchema.safeParse(taskFields);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

      const assigneesParsed = z.array(z.string().uuid()).max(200).optional().safeParse(assignee_ids);
      if (!assigneesParsed.success) return { ok: false, error: "Invalid assignee_ids" };
      const assigneeIds = Array.from(new Set(assigneesParsed.data ?? []));

      const assigneeCount = assigneeIds.length > 0 ? ` and assign it to ${assigneeIds.length} ${assigneeIds.length === 1 ? "person" : "people"}` : "";
      return {
        ok: true,
        data: { ...parsed.data, assignee_ids: assigneeIds },
        summary: `Create task "${parsed.data.name}"${parsed.data.urgency !== "medium" ? ` (${parsed.data.urgency} urgency)` : ""}${parsed.data.deadline ? ` due ${new Date(parsed.data.deadline).toLocaleDateString()}` : ""}${assigneeCount}`,
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
      const { task_id, user_ids } = args;
      if (typeof task_id !== "string") return { ok: false, error: "task_id is required" };
      const parsed = z.array(z.string().uuid()).min(1).max(200).safeParse(user_ids);
      if (!parsed.success) return { ok: false, error: "At least one valid user_id is required" };
      const userIds = Array.from(new Set(parsed.data));
      return {
        ok: true,
        data: { task_id, user_ids: userIds },
        summary: `Assign this task to ${userIds.length} ${userIds.length === 1 ? "person" : "people"}`,
      };
    }
    default:
      return { ok: false, error: `Unknown write tool: ${name}` };
  }
}
