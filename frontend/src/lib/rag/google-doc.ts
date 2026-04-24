/**
 * Импорт из Google Docs без OAuth: документ должен быть доступен
 * по ссылке с правом «Читатель» (или «Все в интернете, у кого есть ссылка»).
 * Экспорт в HTML сохраняет ссылки на встроенные изображения (строки ![figure](url) в тексте для RAG).
 */

export function extractGoogleDocId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (fromUrl?.[1]) {
    return fromUrl[1];
  }
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }
  throw new Error("Не удалось распознать ID документа. Вставьте ссылку или ID из URL /document/d/…/…");
}

export async function fetchGoogleDocPlainText(documentId: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/export?format=txt`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PortalRAG/1.0)",
      Accept: "text/plain,*/*",
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(
      `Google Docs вернул HTTP ${res.status}. Откройте доступ: «Настройки доступа» → «Всем, у кого есть ссылка» → читатель.`
    );
  }
  if (body.includes("accounts.google.com") && body.includes("<html")) {
    throw new Error(
      "Документ недоступен без входа. Сделайте его читаемым по ссылке или используйте публичный экспорт."
    );
  }
  return body.trim();
}

export async function fetchGoogleDocHtml(documentId: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/export?format=html`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PortalRAG/1.0)",
      Accept: "text/html,*/*",
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(
      `Google Docs (HTML) вернул HTTP ${res.status}. Откройте доступ: «Настройки доступа» → «Всем, у кого есть ссылка» → читатель.`
    );
  }
  if (body.includes("accounts.google.com") && body.includes("<html")) {
    throw new Error(
      "Документ недоступен без входа. Сделайте его читаемым по ссылке или используйте публичный экспорт."
    );
  }
  return body;
}
