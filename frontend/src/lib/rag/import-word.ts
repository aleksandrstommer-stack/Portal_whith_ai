import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

import mammoth from "mammoth";
import type { Pool } from "pg";

import { chunkText, htmlToRagLinearText } from "@/lib/rag/chunk";
import { ollamaEmbed } from "@/lib/rag/ollama";
import { ensureRagSchema, toVectorParam } from "@/lib/rag/schema";

export const WORD_IMPORT_MAX_BYTES = 15 * 1024 * 1024;

export type WordImportResult = {
  documentId: string;
  chunks: number;
  characters: number;
  warnings: string[];
};

export type WordImportOptions = {
  title?: string;
  testKey?: string;
  testTitle?: string;
};

function extForContentType(contentType: string): string {
  const ct = (contentType || "").toLowerCase().split(";")[0].trim();
  if (ct === "image/png") return "png";
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
  if (ct === "image/gif") return "gif";
  if (ct === "image/webp") return "webp";
  if (ct === "image/svg+xml") return "svg";
  return "bin";
}

async function ragMediaDir(): Promise<string> {
  const dir = join(process.cwd(), "public", "rag-media");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function importWordDocxToVector(
  pool: Pool,
  buffer: Buffer,
  options?: WordImportOptions
): Promise<WordImportResult> {
  const title = options?.title?.trim();
  const testKey = options?.testKey?.trim();
  const testTitle = options?.testTitle?.trim();
  if (buffer.length === 0) {
    throw new Error("Пустой файл.");
  }
  if (buffer.length > WORD_IMPORT_MAX_BYTES) {
    throw new Error(`Файл слишком большой (макс. ${WORD_IMPORT_MAX_BYTES / (1024 * 1024)} МБ).`);
  }

  const documentId = createHash("sha256")
    .update(new Uint8Array(buffer))
    .digest("hex")
    .slice(0, 24);
  const mediaDir = await ragMediaDir();

  const { value: html, messages } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imgBuf = await image.readAsBuffer();
        const name = `${randomUUID()}.${extForContentType(image.contentType)}`;
        await writeFile(join(mediaDir, name), new Uint8Array(imgBuf));
        return { src: `/rag-media/${name}` };
      }),
    }
  );

  const plain = htmlToRagLinearText(html);
  const parts = chunkText(plain, 900);
  if (parts.length === 0) {
    throw new Error("В документе нет текста для индексации.");
  }

  await ensureRagSchema(pool);

  await pool.query(`DELETE FROM portal_rag_chunks WHERE metadata->>'source' = $1 AND metadata->>'documentId' = $2`, [
    "word-docx",
    documentId,
  ]);

  const displayTitle = title?.trim() || `Word ${documentId.slice(0, 8)}…`;
  const warnings = messages.filter((m) => m.type === "warning").map((m) => m.message);

  for (const content of parts) {
    const embedding = await ollamaEmbed(content.slice(0, 8000));
    const meta = {
      source: "word-docx",
      documentId,
      title: displayTitle,
      testKey: testKey || null,
      testTitle: testTitle || null,
    };
    await pool.query(
      `INSERT INTO portal_rag_chunks (content, metadata, embedding) VALUES ($1, $2::jsonb, $3::vector)`,
      [content, JSON.stringify(meta), toVectorParam(embedding)]
    );
  }

  return { documentId, chunks: parts.length, characters: plain.length, warnings };
}
