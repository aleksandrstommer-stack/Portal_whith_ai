import { NextResponse } from "next/server";

import { importWordDocxToVector, WORD_IMPORT_MAX_BYTES } from "@/lib/rag/import-word";
import { getRagPool } from "@/lib/rag/pool";

export const runtime = "nodejs";
export const maxDuration = 300;

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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ожидается multipart/form-data с полем file (.docx)." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Добавьте файл: поле form-data с именем file (документ Word .docx)." }, { status: 400 });
  }

  const name = "name" in file && typeof file.name === "string" ? file.name : "";
  if (!name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "Нужен файл с расширением .docx (Office Open XML)." }, { status: 400 });
  }

  const titleField = form.get("title");
  const title = typeof titleField === "string" ? titleField.trim() : name.replace(/\.docx$/i, "") || undefined;
  const testKeyField = form.get("testKey");
  const testTitleField = form.get("testTitle");
  const testKey = typeof testKeyField === "string" ? testKeyField.trim() : undefined;
  const testTitle = typeof testTitleField === "string" ? testTitleField.trim() : undefined;

  const ab = await file.arrayBuffer();
  if (ab.byteLength > WORD_IMPORT_MAX_BYTES) {
    return NextResponse.json({ error: `Файл больше ${WORD_IMPORT_MAX_BYTES / (1024 * 1024)} МБ.` }, { status: 400 });
  }

  const buffer = Buffer.from(ab);

  try {
    const pool = getRagPool();
    const result = await importWordDocxToVector(pool, buffer, { title, testKey, testTitle });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
