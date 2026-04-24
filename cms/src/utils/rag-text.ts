export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function htmlToRagLinearText(html: string): string {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, (_m, src: string) => {
    const url = String(src || "").trim();
    if (!url || url.startsWith("data:")) {
      return "\n\n![figure](встроенное-изображение)\n\n";
    }
    return `\n\n![figure](${url})\n\n`;
  });
  s = s.replace(/<\/p>/gi, "\n\n").replace(/<br\s*\/?>/gi, "\n").replace(/<\/h[1-6]>/gi, "\n\n").replace(/<\/div>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Strapi blocks (richtext) или строка HTML */
export function richTextToPlain(data: unknown): string {
  if (typeof data === "string") {
    return stripHtml(data);
  }
  if (Array.isArray(data)) {
    return data.map(richTextToPlain).filter(Boolean).join("\n");
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.text === "string") {
      return o.text;
    }
    if (Array.isArray(o.children)) {
      return richTextToPlain(o.children);
    }
  }
  return "";
}

export function chunkText(text: string, maxLen: number): string[] {
  const t = text.trim();
  if (!t) {
    return [];
  }
  const chunks: string[] = [];
  for (let i = 0; i < t.length; i += maxLen) {
    const part = t.slice(i, i + maxLen).trim();
    if (part) {
      chunks.push(part);
    }
  }
  return chunks;
}
