import { getRagPool } from "@/lib/rag/pool";
import { ensureRagSchema } from "@/lib/rag/schema";

export type RagSourceItem = {
  title: string;
  source: string;
  testKey?: string;
};

export async function fetchRagSources(limit = 30): Promise<RagSourceItem[]> {
  const pool = getRagPool();
  await ensureRagSchema(pool);
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const { rows } = await pool.query<{ title: string | null; source: string | null; testkey: string | null }>(
    `SELECT
       NULLIF(metadata->>'title', '') AS title,
       NULLIF(metadata->>'source', '') AS source,
       NULLIF(metadata->>'testKey', '') AS testKey
     FROM portal_rag_chunks
     GROUP BY 1,2,3
     ORDER BY MAX(id) DESC
     LIMIT $1`,
    [safeLimit]
  );

  return rows
    .map((r) => ({
      title: (r.title || "").trim(),
      source: (r.source || "").trim(),
      testKey: r.testkey || undefined,
    }))
    .filter((r) => r.title.length > 0);
}
