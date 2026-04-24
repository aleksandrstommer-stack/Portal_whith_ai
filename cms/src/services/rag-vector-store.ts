import type { LoadedStrapi } from "@strapi/strapi";
import { Pool } from "pg";

import { chunkText, richTextToPlain } from "../utils/rag-text";
import { buildVectorKnowledgeImportedText } from "./vector-knowledge-source";

let pool: Pool | null = null;

function getEmbeddingDim(): number {
  const n = Number.parseInt(process.env.RAG_EMBEDDING_DIM ?? "768", 10);
  return Number.isFinite(n) && n >= 32 ? n : 768;
}

function getConnectionString(): string {
  const explicit = process.env.RAG_DATABASE_URL;
  if (explicit) {
    return explicit;
  }
  const client = process.env.DATABASE_CLIENT;
  const host = process.env.DATABASE_HOST ?? "127.0.0.1";
  const port = process.env.DATABASE_PORT ?? "5432";
  const name = process.env.DATABASE_NAME ?? "strapi";
  const user = process.env.DATABASE_USERNAME ?? "strapi";
  const pass = process.env.DATABASE_PASSWORD ?? "";
  if (client === "postgres" || client === "postgresql") {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}`;
  }
  throw new Error("RAG: задайте RAG_DATABASE_URL или postgres DATABASE_*");
}

export function getRagPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getConnectionString(), max: 4 });
  }
  return pool;
}

async function ensureSchema(p: Pool): Promise<void> {
  try {
    await p.query("CREATE EXTENSION IF NOT EXISTS vector");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("vector") || msg.includes("extension")) {
      throw new Error(
        "В Postgres нет расширения vector: в .env задайте POSTGRES_IMAGE=pgvector/pgvector:pg16, затем docker compose down && docker compose up -d (при необходимости docker compose down -v)."
      );
    }
    throw e;
  }
  const dim = getEmbeddingDim();
  await p.query(`
    CREATE TABLE IF NOT EXISTS portal_rag_chunks (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      embedding vector(${dim}) NOT NULL
    )
  `);
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((n) => Number(n).toFixed(8)).join(",")}]`;
}

async function ollamaEmbed(text: string): Promise<number[]> {
  const model = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
  const basesRaw = process.env.OLLAMA_BASE_URLS?.trim();
  const bases = basesRaw
    ? basesRaw
        .split(",")
        .map((s) => s.trim().replace(/\/$/, ""))
        .filter(Boolean)
    : [(process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "")];

  const errors: string[] = [];
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text.slice(0, 8000) }),
      });
      const raw = await res.text();
      if (!res.ok) {
        errors.push(`${base}: HTTP ${res.status} ${raw.slice(0, 160)}`);
        continue;
      }
      const json = JSON.parse(raw) as { embedding?: number[] };
      if (!json.embedding?.length) {
        errors.push(`${base}: пустой embedding`);
        continue;
      }
      return json.embedding;
    } catch (error) {
      errors.push(`${base}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Ollama недоступен ни по одному адресу: ${errors.join(" | ")}`);
}

const SOURCE = "strapi-vector-knowledge";

export async function removeVectorKnowledgeChunks(strapi: LoadedStrapi, strapiId: number): Promise<void> {
  try {
    const p = getRagPool();
    await ensureSchema(p);
    await p.query(`DELETE FROM portal_rag_chunks WHERE metadata->>'source' = $1 AND (metadata->>'strapiId')::int = $2`, [
      SOURCE,
      strapiId,
    ]);
  } catch (e) {
    strapi.log.warn(`rag-vector-store: remove failed: ${e instanceof Error ? e.message : e}`);
  }
}

export type VectorKnowledgeEntity = {
  id: number;
  title?: string;
  body?: unknown;
  publishedAt?: string | Date | null;
  slug?: string;
  testKey?: string | null;
  testTitle?: string | null;
  testQuestionsCount?: number | null;
  googleDocUrl?: string | null;
};

export async function indexVectorKnowledgeEntry(strapi: LoadedStrapi, entity: VectorKnowledgeEntity): Promise<void> {
  const p = getRagPool();
  await ensureSchema(p);

  if (!entity.publishedAt) {
    await removeVectorKnowledgeChunks(strapi, entity.id);
    strapi.log.info(`rag-vector-store: запись ${entity.id} не опубликована — чанки удалены`);
    return;
  }

  const imported = await buildVectorKnowledgeImportedText(strapi, entity.id);
  const plain = [entity.title ?? "", richTextToPlain(entity.body), imported].filter(Boolean).join("\n\n").trim();
  const parts = chunkText(plain, 900);
  if (parts.length === 0) {
    strapi.log.warn(`rag-vector-store: пустой текст для id=${entity.id}`);
    return;
  }

  await p.query(`DELETE FROM portal_rag_chunks WHERE metadata->>'source' = $1 AND (metadata->>'strapiId')::int = $2`, [
    SOURCE,
    entity.id,
  ]);

  for (const content of parts) {
    const embedding = await ollamaEmbed(content);
    const configuredQuestionsCount = Number(entity.testQuestionsCount ?? 15);
    const meta = {
      source: SOURCE,
      strapiId: entity.id,
      title: entity.title ?? "",
      slug: entity.slug ?? "",
      testKey: entity.testKey?.trim() || null,
      testTitle: entity.testTitle?.trim() || null,
      testQuestionsCount:
        Number.isFinite(configuredQuestionsCount) && configuredQuestionsCount >= 3 && configuredQuestionsCount <= 20
          ? Math.round(configuredQuestionsCount)
          : 15,
    };
    await p.query(
      `INSERT INTO portal_rag_chunks (content, metadata, embedding) VALUES ($1, $2::jsonb, $3::vector)`,
      [content, JSON.stringify(meta), toVectorLiteral(embedding)]
    );
  }

  strapi.log.info(`rag-vector-store: проиндексировано id=${entity.id}, чанков=${parts.length}`);
}
