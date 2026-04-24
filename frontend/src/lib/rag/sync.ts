import type { Pool } from "pg";

import { chunkText, stripHtml } from "@/lib/rag/chunk";
import { ollamaEmbed } from "@/lib/rag/ollama";
import { toVectorParam } from "@/lib/rag/schema";
import { fetchKnowledgeDocuments } from "@/lib/queries";

export async function syncKnowledgeFromStrapi(pool: Pool): Promise<number> {
  const docs = await fetchKnowledgeDocuments(100);
  await pool.query("TRUNCATE portal_rag_chunks");

  let inserted = 0;
  for (const item of docs.data) {
    const { title, abstract, body } = item.attributes;
    const plain = [title, abstract ?? "", stripHtml(body)].filter(Boolean).join("\n\n").trim();
    const parts = chunkText(plain, 900);
    if (parts.length === 0) {
      continue;
    }
    for (const content of parts) {
      const embedding = await ollamaEmbed(content.slice(0, 8000));
      const meta = {
        strapiId: item.id,
        title,
        slug: item.attributes.slug,
      };
      await pool.query(
        `INSERT INTO portal_rag_chunks (content, metadata, embedding) VALUES ($1, $2::jsonb, $3::vector)`,
        [content, JSON.stringify(meta), toVectorParam(embedding)]
      );
      inserted += 1;
    }
  }
  return inserted;
}
