import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/utils/validate";
import { generateContent, type GeminiContent, type GeminiPart } from "@/lib/ai/gemini";
import {
  TOOL_DECLARATIONS,
  SYSTEM_INSTRUCTION,
  WRITE_TOOL_NAMES,
  executeReadTool,
  validateWriteTool,
} from "@/lib/ai/tools";

const HISTORY_LIMIT = 20;
const MAX_TOOL_ITERATIONS = 5;

interface HistoryRow {
  sender_id: string | null;
  type: string;
  content: string | null;
  metadata: {
    is_ai?: boolean;
    action_summary?: string;
    transcript?: string;
    url?: string;
    mime?: string;
  } | null;
}

const TYPE_PLACEHOLDER: Record<string, string> = {
  image: "[sent an image]",
  video: "[sent a video]",
  document: "[sent a document]",
  poll: "[created a poll]",
  call: "[started a voice call]",
  sticker: "[sent a sticker]",
  gif: "[sent a gif]",
  contact: "[shared a contact]",
};

// Only the MOST RECENT voice message gets its actual audio bytes fetched and
// sent to Gemini — otherwise every follow-up turn would re-fetch and re-pay
// for the same audio again. Older voice messages in history fall back to
// their transcript (free, browser-captured) or a bare placeholder.
async function audioPartsFor(row: HistoryRow): Promise<GeminiPart[]> {
  if (row.metadata?.transcript) {
    return [{ text: `[voice message] "${row.metadata.transcript}"` }];
  }
  if (row.metadata?.url) {
    try {
      const res = await fetch(row.metadata.url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        return [
          { inlineData: { mimeType: row.metadata.mime ?? "audio/webm", data: buf.toString("base64") } },
          { text: "[The user sent you this voice message — listen to it and respond to what they're asking.]" },
        ];
      }
    } catch (err) {
      console.error("[ai-reply] failed to fetch audio for context", err);
    }
  }
  return [{ text: "[sent a voice message that couldn't be loaded]" }];
}

async function historyToContents(rows: HistoryRow[]): Promise<GeminiContent[]> {
  const contents: GeminiContent[] = [];
  const lastIndex = rows.length - 1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.type === "ai_action") {
      contents.push({ role: "model", parts: [{ text: row.metadata?.action_summary ?? "(proposed an action)" }] });
      continue;
    }

    const isAi = row.sender_id === null && row.metadata?.is_ai;
    if (isAi) {
      if (!row.content) continue;
      contents.push({ role: "model", parts: [{ text: row.content }] });
      continue;
    }

    if (row.type === "audio" || row.type === "voice_note") {
      const parts = i === lastIndex
        ? await audioPartsFor(row)
        : [{ text: row.metadata?.transcript ? `[voice message] "${row.metadata.transcript}"` : "[sent a voice message]" }];
      contents.push({ role: "user", parts });
      continue;
    }

    if (row.type !== "text") {
      contents.push({ role: "user", parts: [{ text: TYPE_PLACEHOLDER[row.type] ?? `[sent a ${row.type}]` }] });
      continue;
    }

    if (!row.content) continue;
    contents.push({ role: "user", parts: [{ text: row.content }] });
  }

  return contents;
}

// POST /api/chat/conversations/[id]/ai-reply
// Runs one Ask Tasko turn: reads recent history, calls Gemini with tools,
// executes read tools inline, and for a write tool proposes an ai_actions
// row + an "ai_action" confirm/cancel message instead of ever mutating data
// directly. Only usable on the caller's own "ai"-type conversation.
export const POST = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = (ctx.params as unknown as { id: string });
  if (!isValidUUID(id)) return ApiError.badRequest("Invalid conversation ID.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ApiError.unauthorized();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv } = await (supabase as any)
    .from("conversations")
    .select("id, type, created_by")
    .eq("id", id)
    .single();

  if (!conv || conv.type !== "ai" || conv.created_by !== user.id) {
    return ApiError.forbidden("Not your Tasko conversation.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: historyRows, error: historyErr } = await (supabase as any)
    .from("messages")
    .select("sender_id, type, content, metadata")
    .eq("conversation_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyErr) { console.error("[ai-reply]", historyErr); return ApiError.internal(); }

  const contents = await historyToContents(((historyRows ?? []) as HistoryRow[]).reverse());
  if (contents.length === 0) return ApiError.badRequest("Nothing to reply to.");

  let finalText: string | null = null;
  let pendingAction: { name: string; data: Record<string, unknown>; summary: string } | null = null;

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await generateContent({
        contents,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: TOOL_DECLARATIONS,
      });

      if (!result.functionCall) {
        finalText = result.text ?? "I'm not sure how to answer that.";
        break;
      }

      const { name, args } = result.functionCall;

      // Must be the exact part the model returned (thoughtSignature and
      // all) — a hand-rebuilt { functionCall: { name, args } } part 400s on
      // the next turn ("missing a thought_signature"), confirmed live.
      const modelTurn = { role: "model" as const, parts: [result.functionCallPart!] };

      if (WRITE_TOOL_NAMES.has(name)) {
        const validation = validateWriteTool(name, args);
        if (!validation.ok) {
          contents.push(modelTurn);
          contents.push({ role: "user", parts: [{ functionResponse: { name, response: { error: validation.error } } }] });
          continue;
        }
        pendingAction = { name, data: validation.data!, summary: validation.summary! };
        break;
      }

      const toolResult = await executeReadTool(supabase, user.id, name, args);
      contents.push(modelTurn);
      contents.push({ role: "user", parts: [{ functionResponse: { name, response: { result: toolResult } } }] });
    }
  } catch (err) {
    console.error("[ai-reply] Gemini call failed", err);
    return ApiError.internal();
  }

  if (!finalText && !pendingAction) {
    finalText = "I looked into that but couldn't come to a clear answer — could you rephrase?";
  }

  const admin = createAdminClient();

  if (pendingAction) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: message, error: msgErr } = await (admin as any)
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: null,
        type: "ai_action",
        content: pendingAction.summary,
        metadata: { is_ai: true, action_type: pendingAction.name, action_summary: pendingAction.summary, action_status: "pending" },
      })
      .select("*")
      .single();

    if (msgErr || !message) { console.error("[ai-reply] message insert failed", msgErr); return ApiError.internal(); }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: action, error: actionErr } = await (admin as any)
      .from("ai_actions")
      .insert({
        message_id: message.id,
        conversation_id: id,
        user_id: user.id,
        action_type: pendingAction.name,
        payload: pendingAction.data,
        status: "pending",
      })
      .select("id")
      .single();

    if (actionErr || !action) { console.error("[ai-reply] action insert failed", actionErr); return ApiError.internal(); }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("messages")
      .update({ metadata: { is_ai: true, action_id: action.id, action_type: pendingAction.name, action_summary: pendingAction.summary, action_status: "pending" } })
      .eq("id", message.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: finalMessage } = await (admin as any).from("messages").select("*").eq("id", message.id).single();
    return ok({ message: finalMessage });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: message, error: msgErr } = await (admin as any)
    .from("messages")
    .insert({ conversation_id: id, sender_id: null, type: "text", content: finalText, metadata: { is_ai: true } })
    .select("*")
    .single();

  if (msgErr || !message) { console.error("[ai-reply] message insert failed", msgErr); return ApiError.internal(); }

  return ok({ message });
});
