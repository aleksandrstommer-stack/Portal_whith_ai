import type { Pool } from "pg";

import { chunkText, htmlToRagLinearText } from "@/lib/rag/chunk";
import { extractGoogleDocId, fetchGoogleDocHtml } from "@/lib/rag/google-doc";
import { ollamaEmbed } from "@/lib/rag/ollama";
import { ensureRagSchema, toVectorParam } from "@/lib/rag/schema";

export type GoogleDocImportResult = {
  documentId: string;
  chunks: number;
  characters: number;
};

export type GoogleDocImportOptions = {
  title?: string;
  testKey?: string;
  testTitle?: string;
};

export async function importGoogleDocToVector(
  pool: Pool,
  documentIdOrUrl: string,
  options?: GoogleDocImportOptions
): Promise<GoogleDocImportResult> {
  const title = options?.title?.trim();
  const testKey = options?.testKey?.trim();
  const testTitle = options?.testTitle?.trim();
  const documentId = extractGoogleDocId(documentIdOrUrl);
  await ensureRagSchema(pool);

  const html = await fetchGoogleDocHtml(documentId);
  const plain = htmlToRagLinearText(html);
  const parts = chunkText(plain, 900);
  if (parts.length === 0) {
    throw new Error("Документ пустой или не удалось получить текст.");
  }

  await pool.query(`DELETE FROM portal_rag_chunks WHERE metadata->>'source' = $1 AND metadata->>'documentId' = $2`, [
    "google-doc",
    documentId,
  ]);

  for (const content of parts) {
    const embedding = await ollamaEmbed(content.slice(0, 8000));
    const meta = {
      source: "google-doc",
      documentId,
      title: title ?? `Google Doc ${documentId}`,
      testKey: testKey || null,
      testTitle: testTitle || null,
    };
    await pool.query(
      `INSERT INTO portal_rag_chunks (content, metadata, embedding) VALUES ($1, $2::jsonb, $3::vector)`,
      [content, JSON.stringify(meta), toVectorParam(embedding)]
    );
  }

  return { documentId, chunks: parts.length, characters: plain.length };
}
