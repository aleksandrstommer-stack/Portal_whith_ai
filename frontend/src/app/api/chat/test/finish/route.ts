import { NextResponse } from "next/server";

import { ollamaChat } from "@/lib/rag/ollama";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  attemptId?: number;
  answers?: Array<{ question?: string; answer?: string; expected?: string }>;
};

type Graded = {
  question: string;
  answer: string;
  expected: string;
  correct: boolean;
  comment: string;
};

function strapiBase() {
  return process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://127.0.0.1:1337";
}

function extractJsonArray(raw: string): Graded[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Array<{
      question?: string;
      answer?: string;
      expected?: string;
      correct?: boolean;
      comment?: string;
    }>;
    return parsed.map((x) => ({
      question: (x.question || "").trim(),
      answer: (x.answer || "").trim(),
      expected: (x.expected || "").trim(),
      correct: Boolean(x.correct),
      comment: (x.comment || "").trim(),
    }));
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const attemptId = Number(body.attemptId || 0);
  const answers = (body.answers || [])
    .map((a) => ({ question: (a.question || "").trim(), answer: (a.answer || "").trim(), expected: (a.expected || "").trim() }))
    .filter((a) => a.question && a.answer);
  if (!attemptId || answers.length === 0) {
    return NextResponse.json({ error: "Нужны attemptId и ответы." }, { status: 400 });
  }

  try {
    let questions = answers
      .map((a) => ({ question: a.question, expected: a.expected || "" }))
      .filter((q) => q.question && q.expected);

    if (questions.length === 0) {
      const attemptRes = await fetch(`${strapiBase()}/api/knowledge-test-attempts/${attemptId}`, {
        cache: "no-store",
      });
      const attemptText = await attemptRes.text();
      if (!attemptRes.ok) {
        return NextResponse.json({ error: `Не удалось получить попытку: ${attemptText.slice(0, 300)}` }, { status: 502 });
      }
      const attemptJson = JSON.parse(attemptText) as {
        data?: { attributes?: { questions?: Array<{ question?: string; expected?: string }> } };
      };
      questions = (attemptJson.data?.attributes?.questions || [])
        .map((q) => ({ question: (q.question || "").trim(), expected: (q.expected || "").trim() }))
        .filter((q) => q.question && q.expected);
    }

    const merged = questions.map((q) => ({
      question: q.question,
      expected: q.expected,
      answer: answers.find((a) => a.question === q.question)?.answer || "",
    }));

    const raw = await ollamaChat([
      {
        role: "system",
        content:
          "Ты проверяющий теста. Верни ТОЛЬКО JSON-массив объектов {question,answer,expected,correct,comment}. correct true/false. Оценивай строго по expected.",
      },
      {
        role: "user",
        content: `Проверь ответы:\n${JSON.stringify(merged)}`,
      },
    ]);

    const graded = extractJsonArray(raw).filter((g) => g.question && g.expected);
    if (graded.length === 0) {
      return NextResponse.json({ error: "Не удалось проверить ответы теста." }, { status: 502 });
    }

    const total = graded.length;
    const correct = graded.filter((g) => g.correct).length;

    const updateRes = await fetch(`${strapiBase()}/api/knowledge-test-attempts/${attemptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          status: "completed",
          answers: graded,
          totalQuestions: total,
          correctAnswers: correct,
          finishedAt: new Date().toISOString(),
        },
      }),
      cache: "no-store",
    });
    const updateText = await updateRes.text();
    if (!updateRes.ok) {
      return NextResponse.json({ error: `Не удалось сохранить результаты: ${updateText.slice(0, 300)}` }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      totalQuestions: total,
      correctAnswers: correct,
      answers: graded,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
