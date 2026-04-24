export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** HTML (экспорт Google Docs, mammoth из Word) → линейный текст с markdown-картинками для RAG и чата. */
export function htmlToRagLinearText(html: string): string {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, "\n\n![figure]($1)\n\n");
  s = s.replace(/<\/p>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n").replace(/<\/h[1-6]>/gi, "\n\n").replace(/<\/div>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return s;
}

const SINGLE_IMAGE_MD = /^!\[[^\]]*\]\([^)]+\)\s*$/;

export function chunkText(text: string, maxLen: number): string[] {
  const t = text.trim();
  if (!t) {
    return [];
  }
  const paragraphs = t.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current) {
      chunks.push(current);
      current = "";
    }
  };

  for (const p of paragraphs) {
    if (p.length > maxLen && SINGLE_IMAGE_MD.test(p)) {
      flush();
      chunks.push(p);
      continue;
    }
    if (p.length > maxLen) {
      flush();
      for (let i = 0; i < p.length; i += maxLen) {
        const part = p.slice(i, i + maxLen).trim();
        if (part) {
          chunks.push(part);
        }
      }
      continue;
    }
    const joined = current ? `${current}\n\n${p}` : p;
    if (joined.length <= maxLen) {
      current = joined;
    } else {
      flush();
      current = p;
    }
  }
  flush();
  return chunks;
}
