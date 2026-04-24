/**
 * Снятие повторов в ответе LLM: один и тот же абзац/блок, продублированный 2+ раза подряд.
 */
export function collapseConsecutiveDuplicateBlocks(text: string): string {
  if (!text) return text;
  const parts = text.split(/\n{2,}/);
  const out: string[] = [];
  let prevNorm = "";
  for (const part of parts) {
    const n = part.trim().replace(/\s+/g, " ");
    if (n.length < 10) {
      out.push(part);
      continue;
    }
    if (n === prevNorm) {
      continue;
    }
    prevNorm = n;
    out.push(part);
  }
  return out.join("\n\n");
}

/**
 * Убирает повторы строк вида ![...](тот же url) — оставляет первое вхождение.
 */
export function dedupeMarkdownImageLines(text: string): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^(\s*!\[[^\]]*\]\()([^)]+)(\)\s*)$/);
    if (m) {
      const url = m[2].trim();
      if (seen.has(url)) {
        continue;
      }
      seen.add(url);
    }
    lines.push(line);
  }
  return lines.join("\n");
}
