import type { RagRow } from "@/lib/rag/rag-context-filter";

/** Стабильный ключ «документ/источник» из metadata чанка. */
export function chunkSourceKey(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "__unknown__";
  const m = metadata as Record<string, unknown>;
  const slug = String(m.slug ?? "").trim();
  const docId = String(m.documentId ?? "").trim();
  const strapiId = m.strapiId != null ? `strapi:${m.strapiId}` : "";
  const vk =
    typeof m.vectorKnowledgeSlug === "string"
      ? m.vectorKnowledgeSlug
      : String(m.vectorKnowledgeId ?? "").trim();
  const title = String(m.title ?? "")
    .trim()
    .slice(0, 80);
  const source = String(m.source ?? "doc").trim();
  const label = slug || docId || vk || strapiId || title || "__na__";
  return `${source}|${label}`;
}

/**
 * После общей сортировки релевантности: по одному чанку с «раунда» на каждый источник,
 * чтобы в контекст попадали несколько загруженных файлов/записей, а не топ-N из одного.
 */
export function diversifyChunksRoundRobin(sorted: RagRow[], targetCount: number): RagRow[] {
  if (sorted.length === 0 || targetCount <= 0) return [];
  const buckets = new Map<string, RagRow[]>();
  for (const r of sorted) {
    const k = chunkSourceKey(r.metadata);
    if (!buckets.has(k)) {
      buckets.set(k, []);
    }
    buckets.get(k)!.push(r);
  }
  const keys = Array.from(buckets.keys());
  const idx = new Map(keys.map((k) => [k, 0]));
  const out: RagRow[] = [];
  const seenId = new Set<number>();

  while (out.length < targetCount) {
    let progressed = false;
    for (const k of keys) {
      const b = buckets.get(k)!;
      let i = idx.get(k)!;
      while (i < b.length && seenId.has(b[i].id)) {
        i += 1;
      }
      if (i >= b.length) {
        idx.set(k, i);
        continue;
      }
      const r = b[i];
      idx.set(k, i + 1);
      seenId.add(r.id);
      out.push(r);
      progressed = true;
      if (out.length >= targetCount) break;
    }
    if (!progressed) break;
  }

  return out;
}
