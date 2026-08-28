// SERVER ONLY — never import from "use client" files.
// Keeps ai_embeddings in sync with tasks/projects so Ask Tasko's
// semantic_search tool has something to search. Called fire-and-forget
// (never awaited by the caller's response path) from the task/project
// write routes — a failure here should never break the actual write.

import { createAdminClient } from "@/lib/supabase/admin";
import { embedContent } from "@/lib/ai/gemini";

export type EmbeddableEntity = "task" | "project";

export async function upsertEmbedding(
  entityType: EmbeddableEntity,
  entityId: string,
  projectId: string | null,
  content: string
): Promise<void> {
  try {
    const trimmed = content.trim();
    if (!trimmed) return;

    const embedding = await embedContent(trimmed);
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("ai_embeddings").upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        project_id: projectId,
        content: trimmed,
        embedding,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,entity_id" }
    );

    if (error) console.error("[upsertEmbedding] upsert failed", error);
  } catch (err) {
    // Best-effort — GEMINI_API_KEY may not be configured yet, or the API
    // call may transiently fail. Either way the task/project write itself
    // must not fail because of this.
    console.error("[upsertEmbedding] failed", err);
  }
}

export async function deleteEmbedding(entityType: EmbeddableEntity, entityId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("ai_embeddings").delete().eq("entity_type", entityType).eq("entity_id", entityId);
  } catch (err) {
    console.error("[deleteEmbedding] failed", err);
  }
}

export function taskEmbeddingContent(name: string, description: string | null | undefined): string {
  return description ? `${name}\n\n${description}` : name;
}

export function projectEmbeddingContent(title: string, description: string | null | undefined): string {
  return description ? `${title}\n\n${description}` : title;
}
