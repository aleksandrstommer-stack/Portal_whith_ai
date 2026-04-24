import type { Pool } from "pg";

import { getEmbeddingDimensions } from "@/lib/rag/pool";

export async function ensureRagSchema(pool: Pool): Promise<void> {
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("vector") || msg.includes("extension")) {
      throw new Error(
        "В Postgres нет расширения vector. В корне проекта в .env укажите POSTGRES_IMAGE=pgvector/pgvector:pg16, выполните: docker compose down && docker compose pull postgres && docker compose up -d. Если образ уже был postgres:16-alpine с данными, после смены образа обычно достаточно up; иначе docker compose down -v (удалит данные Strapi)."
      );
    }
    throw error;
  }
  const dim = getEmbeddingDimensions();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_rag_chunks (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      embedding vector(${dim}) NOT NULL
    )
  `);
}

export async function ensureChatAnalyticsSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portal_chat_feedback (
      id BIGSERIAL PRIMARY KEY,
      interaction_id TEXT NOT NULL UNIQUE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sources JSONB NOT NULL DEFAULT '[]'::jsonb,
      helped BOOLEAN,
      rating SMALLINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      feedback_at TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_portal_chat_feedback_created_at
    ON portal_chat_feedback (created_at DESC)
  `);
}

export async function countRagChunks(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM portal_rag_chunks");
  return Number.parseInt(rows[0]?.count ?? "0", 10);
}

export function toVectorParam(embedding: number[]): string {
  return `[${embedding.map((n) => Number(n).toFixed(8)).join(",")}]`;
}
