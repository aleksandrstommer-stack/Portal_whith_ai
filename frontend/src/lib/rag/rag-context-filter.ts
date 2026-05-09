import type { Pool } from "pg";

export type RagRow = { id: number; content: string; metadata: unknown; dist: number };

const HR_BUT_NOT_POS = /30[\s-]*60[\s-]*90|процесс адаптац|адаптаци[яи] на 30|hr:\s*процес/i;
const POS_KEYWORDS = /касс|1с|ккм|кассов|драйв|тест[\s-]*драйв|z[\s-]*отчет|фиск/iu;

/**
 * Вопрос про кассу/1С/драйв — выкидываем чанки, которые с высокой вероятностью чисто HR/адаптация
 * (вектор иногда тянет «30-60-90» рядом с «1С» в общих вопросах).
 */
export function filterOffTopicRows(rows: RagRow[], question: string): RagRow[] {
  if (rows.length === 0) return rows;
  const off = (process.env.RAG_FILTER_OFF_TOPIC || "").toLowerCase();
  if (off === "0" || off === "false" || off === "off") {
    return rows;
  }
  const aboutPos = /касс|1с|ккм|драйв|тест|кассир|z[\s-]*отчет|кассов/i.test(question);
  if (!aboutPos) return rows;
  const kept = rows.filter((r) => {
    if (!HR_BUT_NOT_POS.test(r.content)) return true;
    return POS_KEYWORDS.test(r.content);
  });
  return kept.length > 0 ? kept : rows;
}

/** Сильное совпадение по продукту «тест драйв(ер)». */
export async function fetchProductPhraseRows(pool: Pool, question: string): Promise<RagRow[]> {
  const pats: string[] = [];
  if (/тест/i.test(question) && /драйв/i.test(question)) {
    pats.push("%тест%драйв%");
  }
  if (/тест/i.test(question) && /драйвер/i.test(question)) {
    pats.push("%тест%драйвер%");
  }
  if (pats.length === 0) return [];
  const or = pats.map((_, i) => `content ILIKE $${i + 1}`).join(" OR ");
  const { rows } = await pool.query<RagRow>(
    `SELECT id, content, metadata, 0.001::float AS dist
     FROM portal_rag_chunks
     WHERE ${or}
     LIMIT 10`,
    pats
  );
  return rows;
}

/**
 * Склейка: сначала фразовые и keyword-хиты, затем векторные (без дубля id).
 * Дистанции: фраза 0.001, keyword 0.01, вектор — из поиска.
 */
export function mergeRagByPriority(phrase: RagRow[], keyword: RagRow[], vector: RagRow[]): RagRow[] {
  const m = new Map<number, RagRow>();
  for (const r of vector) {
    m.set(r.id, { ...r });
  }
  for (const r of keyword) {
    m.set(r.id, { ...r, dist: 0.01 });
  }
  for (const r of phrase) {
    m.set(r.id, { ...r, dist: 0.001 });
  }
  const order: number[] = [];
  const s = new Set<number>();
  for (const r of phrase) {
    if (!s.has(r.id)) {
      s.add(r.id);
      order.push(r.id);
    }
  }
  for (const r of keyword) {
    if (!s.has(r.id)) {
      s.add(r.id);
      order.push(r.id);
    }
  }
  for (const r of vector) {
    if (!s.has(r.id)) {
      s.add(r.id);
      order.push(r.id);
    }
  }
  return order.map((id) => m.get(id)!);
}
