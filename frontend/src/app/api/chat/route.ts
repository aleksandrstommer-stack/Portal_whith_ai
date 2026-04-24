import { NextResponse } from "next/server";

import { ollamaChat, ollamaEmbed } from "@/lib/rag/ollama";
import { getRagPool } from "@/lib/rag/pool";
import { countRagChunks, ensureChatAnalyticsSchema, ensureRagSchema, toVectorParam } from "@/lib/rag/schema";
import { importGoogleDocToVector } from "@/lib/rag/import-google-doc";
import { syncKnowledgeFromStrapi } from "@/lib/rag/sync";

export const runtime = "nodejs";
export const maxDuration = 120;

const CHAT_SYSTEM_PROMPT = `Ты — корпоративный AI-ассистент компании.
Твоя роль:
- инженер технической поддержки
- HR-помощник
- навигатор по внутренним процессам компании
Ты работаешь на основе базы знаний (документы, инструкции и материалы базы знаний компании).
Тебе передаётся контекст из векторной базы знаний.

=== ОСНОВНЫЕ ПРАВИЛА ===
1. ОТВЕЧАЙ ТОЛЬКО НА ОСНОВЕ КОНТЕКСТА
- Используй только переданный контекст
- Если информации недостаточно — честно скажи:
  "В базе знаний нет точной информации по этому вопросу"
2. НЕ ПРИДУМЫВАЙ
- Не додумывай процессы, контакты или правила
- Не генерируй фейковые инструкции
3. ДАВАЙ ПРАКТИЧЕСКИЕ ОТВЕТЫ
Всегда стремись к формату:
- что сделать
- куда идти
- к кому обратиться
- какие документы нужны
4. СТРУКТУРИРУЙ ОТВЕТ
Используй формат:
Короткий ответ:
<1-2 предложения>
Подробно:
- шаг 1
- шаг 2
- шаг 3
Если нужно:
- Контакты / отдел
- Ссылки / документы (если есть в контексте)
5. ДЛЯ HR-ВОПРОСОВ
Отвечай:
- где взять справку
- как подать заявку
- в какой отдел идти
- какие документы нужны
6. ДЛЯ ТЕХНИЧЕСКИХ ВОПРОСОВ
Отвечай:
- что проверить
- возможные причины
- куда писать (IT, поддержка)
- какие шаги выполнить
7. ЕСЛИ ВОПРОС НЕПОНИМАТЕН
Задай уточняющий вопрос вместо ответа
8. ЯЗЫК
- Отвечай на русском
- Пиши просто и понятно
- Без канцелярщины
9. ТОН
- дружелюбный
- деловой
- как опытный сотрудник компании

=== ФОРМАТ ВЫВОДА ===
Всегда старайся:
- избегать длинных сплошных текстов
- использовать списки
- быть конкретным

=== ПРИОРИТЕТ ===
Точность > полнота > красота`;

type ChatBody = {
  question?: string;
};

type RagRow = { content: string; metadata: unknown; dist: number };

function strapiBase() {
  return process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_INTERNAL_URL || "http://127.0.0.1:1337";
}

function toPublicImageUrl(url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return `${strapiBase().replace(/\/$/, "")}${trimmed}`;
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

function tokenizeForRank(input: string): string[] {
  return (input.toLowerCase().match(/[a-zа-я0-9_-]+/gi) || []).filter((t) => t.length >= 3);
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
  return `Дополнительные правила для этого вопроса:
- Это операционный вопрос по 1С/кассе.
- Не выдумывай названия объектов, кнопок и обработок, если их нет в контексте.
- Не предлагай "обратиться к системному администратору", если это не указано в контексте явно.
- Дай только те шаги, которые подтверждаются фрагментами.
- Если в контексте не хватает данных для точного сценария, сначала задай 1 уточняющий вопрос.`;
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

    const { rows } = await pool.query<RagRow>(
      `SELECT content, metadata, embedding <=> $1::vector AS dist
       FROM portal_rag_chunks
       ORDER BY embedding <=> $1::vector ASC
       LIMIT 28`,
      [vec]
    );

    const ranked = rankRowsByQuestion(rows, question).slice(0, 10);
    const context = ranked.map((r) => r.content).join("\n---\n");
    const imageUrls = extractImageUrls(context);
    const runtimeInstruction = buildRuntimeInstruction(question);
    let answer = await ollamaChat([
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Контекст:
${context}

Вопрос пользователя:
${question}

${runtimeInstruction}`,
      },
    ], { numPredict: 520, numCtx: 3072, temperature: 0.15, timeoutMs: 120000 });

    if (imageUrls.length > 0 && !/!\[[^\]]*\]\((\/|https?:\/\/)/i.test(answer)) {
      answer = `${answer}\n\nИллюстрации из материалов:\n${imageUrls.slice(0, 3).map((u) => `![Иллюстрация](${u})`).join("\n")}`;
    }
    answer = normalizeMarkdownImageUrls(answer);
    answer = answer.replace(/\n\s*Иллюстрации из материалов:\s*$/i, "");

    const interactionId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO portal_chat_feedback (interaction_id, question, answer, sources)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [interactionId, question, answer, JSON.stringify(rows.map((r) => r.metadata))]
    );

    return NextResponse.json({
      interactionId,
      answer,
      imageUrls: imageUrls.slice(0, 6),
      sources: ranked.map((r) => r.metadata),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("RAG_DATABASE_URL") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
