import { Pool } from "pg";

let pool: Pool | null = null;

export function getRagPool(): Pool {
  const url = process.env.RAG_DATABASE_URL;
  if (!url) {
    throw new Error("Не задан RAG_DATABASE_URL (PostgreSQL с расширением vector).");
  }
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 5 });
  }
  return pool;
}

export function getEmbeddingDimensions(): number {
  const raw = process.env.RAG_EMBEDDING_DIM ?? "768";
  const dim = Number.parseInt(raw, 10);
  if (!Number.isFinite(dim) || dim < 32) {
    return 768;
  }
  return dim;
}
