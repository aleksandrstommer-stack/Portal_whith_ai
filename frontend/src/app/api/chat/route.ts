import { randomUUID } from "node:crypto";

import type { Pool } from "pg";
import { NextResponse } from "next/server";

import { ollamaChat, ollamaEmbed } from "@/lib/rag/ollama";
import { getRagPool } from "@/lib/rag/pool";
import { countRagChunks, ensureChatAnalyticsSchema, ensureRagSchema, toVectorParam } from "@/lib/rag/schema";
import { importGoogleDocToVector } from "@/lib/rag/import-google-doc";
import { syncKnowledgeFromStrapi } from "@/lib/rag/sync";
import { collapseConsecutiveDuplicateBlocks, dedupeMarkdownImageLines } from "@/lib/rag/answer-cleanup";
import { getStrapiPublicBaseUrl } from "@/lib/strapi-urls";

export const runtime = "nodejs";
export const maxDuration = 120;

const CHAT_SYSTEM_PROMPT = `Ты — корпоративный AI-ассистент компании.
Ты работаешь только с переданным контекстом (фрагменты из векторной базы: документы, инструкции, материалы).

=== ГЛАВНОЕ ===
1) Сначала найди в контексте факты, шаги, названия из материалов, которые относятся к вопросу.
2) Сформируй ответ списком шагов или пунктов из этих фактов. Не сокращай ответ до «заглушек», если в контексте есть конкретика.
3) Если в контексте нет прямой информации по вопросу, напиши одной-двумя фразами по-русски, что в базе знаний нет подходящей инструкции, и чего не хватает. Не придумывай сценарии, кнопки и модули.
4) Не ссылайся на «системного администратора» и IT, если в релевантных фрагментах это явно не указано.
5) Игнорируй в контексте фрагменты на другие темы (например HR, если вопрос про кассу/1С), если они не помогают на вопрос.
6) Язык ответа — только русский. Запрещено использовать английские слова, латиницу, кроме обозначений из самого контекста (1С, ККМ, наименования из документа).
7) Не используй слова: clarification, ensure, also, please, summary и им подобные.
8) Не дублируй один и тот же ответ, один и тот же абзац, один и тот же нумерованный список и один и тот же шаг — напиши один раз.
9) Не вставляй в ответ длинные перечни картинок: достаточно ссылки из контекста по смыслу, без повторов.

=== ОФОРМЛЕНИЕ (без обязательных заголовков «короткий/подробно») ===
- Нумерованные или маркированные шаги
- Краткое вступление 1–2 предложения только если оно несёт смысл
- Без пустой воды

=== ПРИОРИТЕТ ===
Точность и опора на фрагменты > длина ответа`;

type ChatBody = {
  question?: string;
};

type RagRow = { id: number; content: string; metadata: unknown; dist: number };

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

function mergeByVectorThenKeyword(vec: RagRow[], kw: RagRow[]): RagRow[] {
  const byId = new Map<number, RagRow>();
  for (const r of kw) {
    byId.set(r.id, r);
  }
  for (const r of vec) {
    if (!byId.has(r.id)) {
      byId.set(r.id, r);
    }
  }
  return Array.from(byId.values());
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
  return `Операционный вопрос по 1С/кассе. Перескажи только то, что есть в контексте: формы, кнопки, типовые сценарии. Если в фрагментах нет настройки ККМ/драйвера/версии ПО, которую спрашивают, напиши, что в материалах нет шагов для этого варианта, и предложи одну формулировку уточнения — только по-русски, без «администраторов» из воздуха.`;
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
       LIMIT 32`,
      [vec]
    );

    const kwRows = await fetchKeywordRows(pool, ilikeTermsFromQuestion(question));
    const merged = mergeByVectorThenKeyword(vecRows, kwRows);
    merged.sort((a, b) => a.dist - b.dist);

    const { rows: afterCutoff, lowConfidence } = takeRelevantRows(merged);
    const ranked = rankRowsByQuestion(afterCutoff, question).slice(0, 10);
    const context = ranked.map((r) => r.content).join("\n---\n");
    const imageUrls = extractImageUrls(context);
    const runtimeInstruction = buildRuntimeInstruction(question);
    const confidenceBlock = lowConfidence
      ? `Внимание: релевантные фрагменты в базе найдены с трудом. Не обобщай. Если по смыслу вопроса в контексте нет шагов — скажи честно по-русски, без английских слов, задай максимум одно уточнение, без выдуманных контактов.

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
