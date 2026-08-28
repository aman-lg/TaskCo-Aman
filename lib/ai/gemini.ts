// SERVER ONLY — never import from "use client" files.
// Thin fetch wrapper over the Gemini REST API (generateContent + embedContent),
// same "avoid pulling in a full SDK" approach as lib/google/calendar.ts.

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

// "-latest" aliases so this doesn't need updating every time Google retires
// a dated model version (gemini-2.5-flash / text-embedding-004, this code's
// original choices, were both already retired for new API keys by the time
// this was tested live).
export const CHAT_MODEL = "gemini-flash-latest";
export const EMBEDDING_MODEL = "gemini-embedding-001";
// gemini-embedding-001 defaults to 3072-dim output; pin it to 768 to match
// the ai_embeddings.embedding vector(768) column.
export const EMBEDDING_DIMENSIONS = 768;

function requireApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing required env var: GEMINI_API_KEY");
  return key;
}

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  // Present on a model-turn part that did internal reasoning (any part, not
  // just functionCall) — replaying that exact part verbatim on the next
  // turn is REQUIRED for a functionCall part, or the API 400s with "Function
  // call is missing a thought_signature" (confirmed live). Simplest correct
  // handling: never rebuild parts by hand — carry the whole part forward.
  thoughtSignature?: string;
}

// Function results go in a "user"-role content entry (a functionResponse
// part, not text) — this API version 400s on role: "function" ("Role
// 'function' is not supported"), confirmed live against the current API.
export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface GenerateContentArgs {
  contents: GeminiContent[];
  systemInstruction?: string;
  tools?: FunctionDeclaration[];
  model?: string;
}

export interface GenerateContentResult {
  text: string | null;
  functionCall: { name: string; args: Record<string, unknown> } | null;
  // The exact part the model returned for the function call, thoughtSignature
  // and all — push this back verbatim on the next turn's model-role content,
  // never a hand-rebuilt { functionCall } object.
  functionCallPart: GeminiPart | null;
}

export async function generateContent({
  contents,
  systemInstruction,
  tools,
  model = CHAT_MODEL,
}: GenerateContentArgs): Promise<GenerateContentResult> {
  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
  if (tools && tools.length > 0) {
    body.tools = [{ functionDeclarations: tools }];
  }

  const res = await fetch(`${GEMINI_API}/models/${model}:generateContent?key=${requireApiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini generateContent failed (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  const parts: GeminiPart[] = json?.candidates?.[0]?.content?.parts ?? [];

  const textPart = parts.find((p) => typeof p.text === "string");
  const callPart = parts.find((p) => p.functionCall);

  return {
    text: textPart?.text ?? null,
    functionCall: callPart?.functionCall ?? null,
    functionCallPart: callPart ?? null,
  };
}

export async function embedContent(text: string, model: string = EMBEDDING_MODEL): Promise<number[]> {
  const res = await fetch(`${GEMINI_API}/models/${model}:embedContent?key=${requireApiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: EMBEDDING_DIMENSIONS }),
  });

  if (!res.ok) {
    throw new Error(`Gemini embedContent failed (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  const values = json?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Gemini embedContent returned no embedding values");
  return values;
}
