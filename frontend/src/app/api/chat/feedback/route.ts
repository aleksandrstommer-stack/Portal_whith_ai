import { NextResponse } from "next/server";

import { getRagPool } from "@/lib/rag/pool";
import { ensureChatAnalyticsSchema } from "@/lib/rag/schema";

export const runtime = "nodejs";

type Body = {
  interactionId?: string;
  helped?: boolean;
  rating?: number;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const interactionId = (body.interactionId || "").trim();
  const helped = body.helped;
  const rating = Number(body.rating);

  if (!interactionId) {
    return NextResponse.json({ error: "interactionId обязателен." }, { status: 400 });
  }
  if (typeof helped !== "boolean") {
    return NextResponse.json({ error: "Укажите, помог ли ответ (да/нет)." }, { status: 400 });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
    return NextResponse.json({ error: "Оценка должна быть от 1 до 10." }, { status: 400 });
  }

  try {
    const pool = getRagPool();
    await ensureChatAnalyticsSchema(pool);
    const result = await pool.query(
      `UPDATE portal_chat_feedback
       SET helped = $2, rating = $3, feedback_at = NOW()
       WHERE interaction_id = $1`,
      [interactionId, helped, Math.round(rating)]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Диалог для оценки не найден." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
