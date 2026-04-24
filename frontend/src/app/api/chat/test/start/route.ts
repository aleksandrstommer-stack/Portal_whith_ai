import { NextResponse } from "next/server";

import { ollamaChat } from "@/lib/rag/ollama";
import { getRagPool } from "@/lib/rag/pool";
import { ensureRagSchema } from "@/lib/rag/schema";
import { getStrapiPublicBaseUrl, getStrapiServerRequestBaseUrl } from "@/lib/strapi-urls";

export const runtime = "nodejs";
export const maxDuration = 120;

const TEST_SYSTEM_PROMPT = `Ты — корпоративный тренер и методист обучения.
Твоя задача:
- создавать вопросы для тестирования сотрудников
- проверять знания по базе знаний компании
Ты работаешь на основе переданного контекста (документы, инструкции и материалы базы знаний компании).
Каждый документ относится к определенному тесту.

=== ОСНОВНЫЕ ПРАВИЛА ===
1. ИСПОЛЬЗУЙ ТОЛЬКО КОНТЕКСТ
- Не придумывай факты
- Все вопросы должны строго соответствовать переданным документам
2. ГЕНЕРИРУЙ РЕАЛЬНЫЕ ВОПРОСЫ
Вопросы должны проверять:
- понимание процессов
- знание действий
- знание ролей и ответственности
- знание документов
3. НЕ ДЕЛАЙ СЛИШКОМ ПРОСТЫЕ ВОПРОСЫ
Плохо:
"Как называется документ?"
Хорошо:
"Что должен сделать сотрудник, если ...?"
4. НЕ ДУБЛИРУЙ ВОПРОСЫ
- избегай повторов
- делай разнообразные формулировки
5. СЛОЖНОСТЬ
- средний уровень по умолчанию
6. ЯЗЫК
- русский
- понятный
- без лишней воды

=== ФОРМАТ ДЛЯ API ===
Верни строго JSON-массив объектов формата:
{"question":"...","expected":"..."}
Где:
- question: качественный, связный, практический вопрос
- expected: эталонный ответ (1-3 предложения), проверяемый и конкретный
Запрещено:
- markdown
- слово "фрагмент"
- служебные маркеры изображений
- любой текст вне JSON

=== ПРИОРИТЕТ ===
Качество вопросов > количество`;

type Body = {
  fullName?: string;
  testKey?: string;
  questionsCount?: number;
};

type TestQuestion = {
  question: string;
  expected: string;
};

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
  const matches = Array.from(text.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi));
  const relativeMatches = Array.from(text.matchAll(/!\[[^\]]*\]\((\/[^)\s]+)\)/gi));
  return Array.from(new Set([...matches.map((m) => m[1]), ...relativeMatches.map((m) => toPublicImageUrl(m[1]))]));
}

function normalizeMarkdownImageUrls(text: string): string {
  return text.replace(/!\[([^\]]*)\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)/gi, (_m, alt: string, url: string) => {
    return `![${alt}](${toPublicImageUrl(url)})`;
  });
}

function cleanForTest(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\((?:[^)]*|встроенное-изображение)\)/gi, " ")
    .replace(/\bвстроенное-изображение\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackQuestionsFromContext(context: string, count: number): TestQuestion[] {
  const imageUrls = extractImageUrls(context);
  const normalizedContext = cleanForTest(context);
  const sentences = normalizedContext
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 70 && s.length <= 260 && !/рис\.|рисунок|иллюстрац/i.test(s));
  const uniqueSentences = Array.from(new Set(sentences));
  const questions: TestQuestion[] = [];
  const templates = [
    "Опишите правильный порядок действий сотрудника в этой рабочей ситуации.",
    "Какие требования и ограничения нужно обязательно соблюсти?",
    "Какие ошибки в этом процессе недопустимы и почему?",
    "Что должен сделать новый сотрудник в этой ситуации по инструкции компании?",
  ];

  for (let i = 0; i < uniqueSentences.length; i += 1) {
    const normalized = uniqueSentences[i].replace(/^[-*•\d)\s]+/, "").trim();
    if (!normalized) continue;
    const maybeImage = imageUrls[i % Math.max(imageUrls.length, 1)];
    questions.push({
      question:
        `${templates[i % templates.length]}\nСитуация: ${normalized}` +
        (maybeImage ? `\n\n![Иллюстрация](${maybeImage})` : ""),
      expected: normalized,
    });
    if (questions.length >= count) break;
  }

  return questions.slice(0, count);
}

function isWeakQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return (
    q.length < 30 ||
    q.includes("этому кейсу") ||
    q.includes("в этом процессе") ||
    q.includes("по этому пункту") ||
    q.includes("по этому кейсу")
  );
}

function questionQualityScore(question: string): number {
  let score = 0;
  const q = question.trim();
  if (q.length >= 30) score += 1;
  if (q.length >= 70) score += 1;
  if (/\?|что|как|какие|какой|должен|нужно/i.test(q)) score += 1;
  if (/(сотрудник|действ|шаг|ситуац|инструкц|процедур|ответствен)/i.test(q)) score += 1;
  if (!/(фрагмент|этому кейсу|в этом процессе|по этому пункту)/i.test(q)) score += 1;
  return score;
}

function isAcceptableQuestion(question: string): boolean {
  return questionQualityScore(question) >= 3 && !isWeakQuestion(question);
}

function improveQuestionText(question: string, expected: string): string {
  if (!isWeakQuestion(question)) return question;
  const fact = cleanForTest(expected).slice(0, 220);
  return `Сотрудник столкнулся с рабочей ситуацией. Что он должен сделать по инструкции компании?\nСитуация: ${fact}`;
}

function extractJsonArray(raw: string): TestQuestion[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Array<{ question?: string; expected?: string }>;
    return parsed
      .map((q) => ({ question: (q.question || "").trim(), expected: (q.expected || "").trim() }))
      .filter((q) => q.question.length > 5 && q.expected.length > 0);
  } catch {
    return [];
  }
}

function compactContext(chunks: string[]): string {
  const perChunkMax = 800;
  const totalMax = 8500;
  let total = 0;
  const out: string[] = [];
  for (const chunk of chunks) {
    const cleaned = cleanForTest(chunk);
    if (!cleaned) continue;
    const piece = cleaned.slice(0, perChunkMax);
    const next = total + piece.length;
    if (next > totalMax) break;
    out.push(piece);
    total = next;
  }
  return out.join("\n---\n");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const fullName = (body.fullName || "").trim();
  const testKey = (body.testKey || "").trim();

  if (!fullName) return NextResponse.json({ error: "Укажите ФИО сотрудника." }, { status: 400 });
  if (!testKey) return NextResponse.json({ error: "Укажите ключ теста." }, { status: 400 });

  try {
    const pool = getRagPool();
    await ensureRagSchema(pool);

    const { rows } = await pool.query<{ content: string; testtitle: string | null; testquestionscount: number | null }>(
      `SELECT
         content,
         NULLIF(metadata->>'testTitle', '') AS testTitle,
         (NULLIF(metadata->>'testQuestionsCount', ''))::int AS testQuestionsCount
       FROM portal_rag_chunks
       WHERE metadata->>'testKey' = $1
       ORDER BY id DESC
       LIMIT 24`,
      [testKey]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Для выбранного теста нет материалов в векторной базе." }, { status: 400 });
    }

    const testTitle = rows.find((r) => r.testtitle)?.testtitle || testKey;
    const configuredCount = rows.find((r) => typeof r.testquestionscount === "number")?.testquestionscount ?? 15;
    const normalizedConfiguredCount =
      Number.isFinite(configuredCount) && configuredCount >= 3 && configuredCount <= 20 ? Math.round(configuredCount) : 15;
    const effectiveQuestionsCount =
      body.questionsCount == null
        ? normalizedConfiguredCount
        : Math.min(Math.max(Number(body.questionsCount || normalizedConfiguredCount), 3), 20);
    const rawContext = rows.map((r) => r.content).join("\n---\n");
    const imageUrls = extractImageUrls(rawContext);
    const context = compactContext(rows.map((r) => r.content));
    let questions: TestQuestion[] = [];
    try {
      const generationPrompts = [
        `Контекст для теста:
${context}

Сгенерируй ${effectiveQuestionsCount} вопросов для теста "${testTitle}".`,
        `Контекст для теста:
${context}

Сгенерируй строго ${effectiveQuestionsCount} вопросов.
Каждый вопрос должен быть конкретным и привязанным к рабочей ситуации.
Запрещены общие формулировки вроде "по этому кейсу" или "в этом процессе".`,
      ];

      for (const userPrompt of generationPrompts) {
        const raw = await ollamaChat([
          { role: "system", content: TEST_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ]);
        const parsed = extractJsonArray(raw)
          .slice(0, effectiveQuestionsCount)
          .map((q) => ({ ...q, question: improveQuestionText(q.question, q.expected) }))
          .filter((q) => q.expected.length > 20)
          .filter((q) => isAcceptableQuestion(q.question));
        if (parsed.length >= Math.ceil(effectiveQuestionsCount * 0.5)) {
          questions = parsed.slice(0, effectiveQuestionsCount);
          break;
        }
      }
    } catch {
      questions = [];
    }

    if (questions.length < effectiveQuestionsCount) {
      const supplement = fallbackQuestionsFromContext(context, effectiveQuestionsCount)
        .filter((q) => !questions.some((x) => x.question === q.question));
      questions = [...questions, ...supplement].slice(0, effectiveQuestionsCount);
    }

    if (imageUrls.length > 0) {
      questions = questions.map((q, index) => {
        if (/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i.test(q.question)) return q;
        const image = imageUrls[index % imageUrls.length];
        return { ...q, question: `${q.question}\n\n![Иллюстрация](${image})` };
      });
    }
    questions = questions.map((q) => ({ ...q, question: normalizeMarkdownImageUrls(q.question) }));

    if (questions.length < Math.min(6, effectiveQuestionsCount)) {
      return NextResponse.json(
        { error: "Не удалось сформировать качественный тест по этим материалам. Уточните/добавьте материалы и повторите." },
        { status: 502 }
      );
    }

    const createRes = await fetchWithTimeout(`${getStrapiServerRequestBaseUrl()}/api/knowledge-test-attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          fullName,
          testKey,
          testTitle,
          status: "in_progress",
          questions,
          answers: [],
          totalQuestions: questions.length,
          correctAnswers: 0,
          startedAt: new Date().toISOString(),
        },
      }),
      cache: "no-store",
    }, 15000);
    const createText = await createRes.text();
    if (!createRes.ok) {
      return NextResponse.json({ error: `Не удалось сохранить попытку теста: ${createText.slice(0, 400)}` }, { status: 502 });
    }
    const createJson = JSON.parse(createText) as { data?: { id?: number } };
    const attemptId = createJson.data?.id;
    if (!attemptId) {
      return NextResponse.json({ error: "Попытка создана, но не получен идентификатор." }, { status: 502 });
    }

    return NextResponse.json({
      attemptId,
      testKey,
      testTitle,
      questions: questions.map((q) => ({ question: q.question, expected: q.expected })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
