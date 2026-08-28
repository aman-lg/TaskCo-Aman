// SERVER ONLY — never import from "use client" files.
// Thin fetch wrapper over the Gemini REST API (generateContent + embedContent),
// same "avoid pulling in a full SDK" approach as lib/google/calendar.ts.

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

export const CHAT_MODEL = "gemini-2.5-flash";
export const EMBEDDING_MODEL = "text-embedding-004";

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
}

export interface GeminiContent {
  role: "user" | "model" | "function";
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
  };
}

export async function embedContent(text: string, model: string = EMBEDDING_MODEL): Promise<number[]> {
  const res = await fetch(`${GEMINI_API}/models/${model}:embedContent?key=${requireApiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });

  if (!res.ok) {
    throw new Error(`Gemini embedContent failed (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  const values = json?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Gemini embedContent returned no embedding values");
  return values;
}
