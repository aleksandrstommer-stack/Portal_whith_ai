import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { NextResponse } from "next/server";

import { ollamaChat, ollamaEmbed } from "@/lib/rag/ollama";
import { getRagPool } from "@/lib/rag/pool";
import { countRagChunks, ensureChatAnalyticsSchema, ensureRagSchema, toVectorParam } from "@/lib/rag/schema";
import { importGoogleDocToVector } from "@/lib/rag/import-google-doc";
import { syncKnowledgeFromStrapi } from "@/lib/rag/sync";
import { collapseConsecutiveDuplicateBlocks, dedupeMarkdownImageLines } from "@/lib/rag/answer-cleanup";
import {
  type RagRow,
  fetchProductPhraseRows,
  filterOffTopicRows,
  mergeRagByPriority,
} from "@/lib/rag/rag-context-filter";
import { diversifyChunksRoundRobin } from "@/lib/rag/diversify-sources";
import { getStrapiPublicBaseUrl } from "@/lib/strapi-urls";

export const runtime = "nodejs";
export const maxDuration = 120;

const CHAT_SYSTEM_PROMPT = `Ты — корпоративный AI-ассистент компании.
Ниже — фрагменты из базы знаний (они могут относиться к разным документам/файлам). Используй все релевантные фрагменты; не ограничивайся условным «первым» файлом и не домысливай там, где ответ есть в других фрагментах. Остальное полностью игнорируй (не перечисляй и не комментируй «что ещё было в фрагментах»).

=== ГЛАВНОЕ ===
1) Дай прямой ответ: нумерованные шаги / пункты из релевантных фрагментов, без раздувания.
2) ЗАПРЕЩЕНО в ответе: «в контексте», «указано в контексте», «в materials», «по materials», «состав фрагментах», «процесс адаптации 30-60-90», «HR:», если вопрос про кассу/1С/драйв/ККМ и в релевантных к ответу фрагментах об этом нет. Не пересказывай чужие темы.
3) ЗАПРЕЩЕНО: английские слова (materials, context, clarification, ensure, summary и т.д.). Только русский, кроме имён продуктов/ПО из самого фрагмента (1С, Тест Драйв, ККМ).
4) Если по теме вопроса в релевантных фрагментах нет шагов — 2–3 фразы: «В базе знаний нет отдельной инструкции по …; можно уточнить …» — без ссылок на адаптацию и HR.
5) Не ссылайся на «системного администратора» и IT из воздуха.
6) Не дублируй одни и те же абзацы, списки и шаги. Не повторяй один и тот же шаг в списке дважды.
7) Картинки: если в релевантных фрагментах есть ссылки-иллюстрации, можно использовать 1–3 по смыслу, не списком на десятки строк.

=== ПРИОРИТЕТ ===
Прямой ответ по делу, без мета-обсуждения базы`;

type ChatBody = {
  question?: string;
};

function contextChunkCount(): number {
  const raw = process.env.RAG_CONTEXT_MAX_CHUNKS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) {
      return Math.min(24, Math.max(6, n));
    }
  }
  return 12;
}

function maxCosineDistanceForContext(): number {
  const raw = process.env.RAG_MAX_COSINE_DISTANCE?.trim();
  if (raw) {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n) && n > 0 && n < 2) return n;
  }
  return 0.58;
}

/**
 * Косинусная дистанция (pgvector <=>): чем меньше, тем ближе. Отсекаем слабые попаданий.
 */
function takeRelevantRows(rows: RagRow[]): { rows: RagRow[]; lowConfidence: boolean } {
  if (rows.length === 0) return { rows: [], lowConfidence: true };
  const best = Math.min(...rows.map((r) => r.dist));
  const cap = maxCosineDistanceForContext();
  const loose = cap + 0.12;
  const strict = rows.filter((r) => r.dist <= cap);
  if (strict.length > 0) {
    return { rows: strict, lowConfidence: best > cap * 0.9 };
  }
  const soft = rows.filter((r) => r.dist <= Math.min(loose, best + 0.18));
  return {
    rows: soft.length > 0 ? soft : rows.slice(0, 5),
    lowConfidence: true,
  };
}

function toPublicImageUrl(url: string): string {
  const base = getStrapiPublicBaseUrl();
  const trimmed = (url || "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/^https?:\/\/strapi:1337/i, base);
  }
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return trimmed;
}

function extractImageUrls(text: string): string[] {
  const matches = Array.from(text.matchAll(/!\[[^\]]*\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)/gi));
  return Array.from(new Set(matches.map((m) => toPublicImageUrl(m[1]))));
}

function normalizeMarkdownImageUrls(text: string): string {
  return text.replace(/!\[([^\]]*)\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)/gi, (_m, alt: string, url: string) => {
    return `![${alt}](${toPublicImageUrl(url)})`;
  });
}

/** Слова из вопроса для гибридного ILIKE: названия вроде «тест драйв» плохо ловятся одним вектором. */
function ilikeTermsFromQuestion(q: string): string[] {
  const lower = q.toLowerCase();
  const words = (lower.match(/[a-zа-яё0-9]+/gi) || [])
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
  if (lower.includes("1с") || lower.includes("1c") || /1[сc]\b/i.test(q)) {
    words.push("1с");
  }
  const uniq = [...new Set(words)].sort((a, b) => b.length - a.length);
  return uniq.slice(0, 5);
}

async function fetchKeywordRows(pool: Pool, terms: string[]): Promise<RagRow[]> {
  if (terms.length === 0) return [];
  const or = terms.map((_, i) => `content ILIKE $${i + 1}`).join(" OR ");
  const args = terms.map((t) => `%${t}%`);
  const { rows } = await pool.query<RagRow>(
    `SELECT id, content, metadata, 0.01::float AS dist
     FROM portal_rag_chunks
     WHERE ${or}
     LIMIT 14`,
    args
  );
  return rows;
}

function tokenizeForRank(input: string): string[] {
  return (input.toLowerCase().match(/[a-zа-я0-9_-]+/gi) || []).filter(
    (t) => t.length >= 3 || t === "1с" || t === "1c"
  );
}

function rankRowsByQuestion(rows: RagRow[], question: string): RagRow[] {
  const qTokens = new Set(tokenizeForRank(question));
  if (qTokens.size === 0) return rows;
  return [...rows].sort((a, b) => {
    const aTokens = tokenizeForRank(a.content).slice(0, 120);
    const bTokens = tokenizeForRank(b.content).slice(0, 120);
    const aHits = aTokens.reduce((acc, t) => acc + (qTokens.has(t) ? 1 : 0), 0);
    const bHits = bTokens.reduce((acc, t) => acc + (qTokens.has(t) ? 1 : 0), 0);
    if (aHits !== bHits) return bHits - aHits;
    return a.dist - b.dist;
  });
}

function buildRuntimeInstruction(question: string): string {
  const lower = question.toLowerCase();
  const isCashier1c =
    lower.includes("1с") || lower.includes("касс") || lower.includes("z-отчет") || lower.includes("z отчет") || lower.includes("закрыти");
  if (!isCashier1c) return "";
  return `Вопрос по 1С/кассе. Опиши шаги из релевантных фрагментов. Если в них нет настройки под запрос — кратко скажи, что в базе нет такой ветки инструкции, и один уточняющий вопрос — по-русски. Не ссылайся на HR и адаптацию, если в релевантных к ответу фрагментах об этом нет.`;
}

export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "Пустой вопрос" }, { status: 400 });
  }

  try {
    const pool = getRagPool();
    await ensureRagSchema(pool);
    await ensureChatAnalyticsSchema(pool);

    let total = await countRagChunks(pool);
    const bootstrapDoc = process.env.RAG_BOOTSTRAP_GOOGLE_DOC_ID?.trim();
    if (total === 0 && bootstrapDoc) {
      await importGoogleDocToVector(pool, bootstrapDoc);
      total = await countRagChunks(pool);
    }
    if (total === 0) {
      total = await syncKnowledgeFromStrapi(pool);
    }

    if (total === 0) {
      return NextResponse.json(
        {
          error:
            "Нет чанков: импортируйте Google Doc (POST /api/rag/import-google-doc), Word (POST /api/rag/import-word), задайте RAG_BOOTSTRAP_GOOGLE_DOC_ID или добавьте Knowledge documents в Strapi.",
        },
        { status: 400 }
      );
    }

    const qEmb = await ollamaEmbed(question.slice(0, 8000));
    const vec = toVectorParam(qEmb);

    const { rows: vecRows } = await pool.query<RagRow>(
      `SELECT id, content, metadata, embedding <=> $1::vector AS dist
       FROM portal_rag_chunks
       ORDER BY embedding <=> $1::vector ASC
       LIMIT 56`,
      [vec]
    );

    const phraseRows = await fetchProductPhraseRows(pool, question);
    const kwRows = await fetchKeywordRows(pool, ilikeTermsFromQuestion(question));
    const merged = mergeRagByPriority(phraseRows, kwRows, vecRows);
    merged.sort((a, b) => a.dist - b.dist);

    const { rows: afterCutoff, lowConfidence } = takeRelevantRows(merged);
    let ranked = rankRowsByQuestion(afterCutoff, question);
    ranked = filterOffTopicRows(ranked, question);
    ranked = ranked.slice(0, 48);
    ranked = diversifyChunksRoundRobin(ranked, contextChunkCount());
    const hasStrongRag = phraseRows.length + kwRows.length > 0;
    const context = ranked.map((r) => r.content).join("\n---\n");
    const imageUrls = extractImageUrls(context);
    const runtimeInstruction = buildRuntimeInstruction(question);
    const confidenceBlock =
      !hasStrongRag && lowConfidence
        ? `Совпадения с базой слабые. Ответь кратко по-русски: либо шаги из фрагментов, либо что инструкции в базе не найдено; без обсуждения состава «контекста», без латиницы.

`
        : "";
    let answer = await ollamaChat(
      [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `${confidenceBlock}Контекст:
${context}

Вопрос пользователя:
${question}

${runtimeInstruction}`,
        },
      ],
      { temperature: 0.12, timeoutMs: 120000 }
    );

    answer = collapseConsecutiveDuplicateBlocks(answer);

    const hasMarkdownImage = /!\[[^\]]*\]\([^)]+\)/.test(answer);
    if (imageUrls.length > 0 && !hasMarkdownImage) {
      const extra = imageUrls
        .slice(0, 3)
        .map((u) => `![Иллюстрация](${u})`)
        .join("\n");
      answer = `${answer}\n\nИллюстрации из материалов:\n${extra}`;
    }
    answer = normalizeMarkdownImageUrls(answer);
    answer = dedupeMarkdownImageLines(answer);
    answer = answer.replace(/\n\s*Иллюстрации из материалов:\s*$/i, "");
    answer = collapseConsecutiveDuplicateBlocks(answer);

    const uniqueForPayload = Array.from(new Set(imageUrls));
    const imageUrlsForClient = uniqueForPayload.filter((u) => u && !answer.includes(u)).slice(0, 6);

    const interactionId = randomUUID();
    await pool.query(
      `INSERT INTO portal_chat_feedback (interaction_id, question, answer, sources)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [interactionId, question, answer, JSON.stringify(ranked.map((r) => r.metadata))]
    );

    return NextResponse.json({
      interactionId,
      answer,
      imageUrls: imageUrlsForClient,
      sources: ranked.map((r) => r.metadata),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("RAG_DATABASE_URL") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
