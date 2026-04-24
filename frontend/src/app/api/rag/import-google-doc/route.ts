import { NextResponse } from "next/server";

import { importGoogleDocToVector } from "@/lib/rag/import-google-doc";
import { getRagPool } from "@/lib/rag/pool";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  documentId?: string;
  url?: string;
  title?: string;
  testKey?: string;
  testTitle?: string;
};

function assertImportAllowed(request: Request): NextResponse | null {
  const secret = process.env.RAG_IMPORT_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    return NextResponse.json(
      { error: "Задайте RAG_IMPORT_SECRET в окружении фронтенда для защиты импорта." },
      { status: 503 }
    );
  }
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (token !== secret) {
      return NextResponse.json({ error: "Нужен заголовок Authorization: Bearer <RAG_IMPORT_SECRET>" }, { status: 401 });
    }
  }
  return null;
}

export async function POST(request: Request) {
  const denied = assertImportAllowed(request);
  if (denied) {
    return denied;
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const raw = typeof body.url === "string" && body.url.trim() ? body.url.trim() : body.documentId?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Укажите documentId или url (ссылка на Google Doc)." }, { status: 400 });
  }

  try {
    const pool = getRagPool();
    const result = await importGoogleDocToVector(pool, raw, {
      title: body.title,
      testKey: body.testKey,
      testTitle: body.testTitle,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
