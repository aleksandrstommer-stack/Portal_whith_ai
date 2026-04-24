import { NextResponse } from "next/server";

import { getRagPool } from "@/lib/rag/pool";
import { ensureRagSchema } from "@/lib/rag/schema";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = getRagPool();
    await ensureRagSchema(pool);
    const { rows } = await pool.query<{ testkey: string; testtitle: string | null; testquestionscount: number }>(
      `SELECT
         metadata->>'testKey' AS testKey,
         MAX(NULLIF(metadata->>'testTitle', '')) AS testTitle,
         COALESCE(MAX((NULLIF(metadata->>'testQuestionsCount', ''))::int), 15) AS testQuestionsCount
       FROM portal_rag_chunks
       WHERE COALESCE(metadata->>'testKey', '') <> ''
       GROUP BY metadata->>'testKey'
       ORDER BY metadata->>'testKey'`
    );

    const tests = rows.map((r) => ({
      key: r.testkey,
      title: r.testtitle || r.testkey,
      questionsCount:
        Number.isFinite(Number(r.testquestionscount)) && Number(r.testquestionscount) >= 3 && Number(r.testquestionscount) <= 20
          ? Number(r.testquestionscount)
          : 15,
    }));

    return NextResponse.json({ tests });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
