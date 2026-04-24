import type { LoadedStrapi } from "@strapi/strapi";

import { runBootstrap } from "./bootstrap";
import {
  indexVectorKnowledgeEntry,
  removeVectorKnowledgeChunks,
  type VectorKnowledgeEntity,
} from "./services/rag-vector-store";

const VECTOR_KB_UID = "api::vector-knowledge.vector-knowledge";

type VectorKbLifecycleEvent = {
  action: string;
  model?: { uid?: string };
  params?: unknown;
  result?: {
    id?: number;
    title?: string;
    body?: unknown;
    publishedAt?: string | Date | null;
    slug?: string;
    testKey?: string | null;
    testTitle?: string | null;
    testQuestionsCount?: number | null;
  };
};

export default {
  register() {},
  async bootstrap({ strapi }: { strapi: LoadedStrapi }) {
    await runBootstrap(strapi);

    strapi.db.lifecycles.subscribe(async (rawEvent) => {
      const event = rawEvent as VectorKbLifecycleEvent;
      if (event.model?.uid !== VECTOR_KB_UID) {
        return;
      }
      try {
        if (event.action === "afterCreate" || event.action === "afterUpdate") {
          const r = event.result;
          if (r && typeof r.id === "number") {
            await indexVectorKnowledgeEntry(strapi, r as VectorKnowledgeEntity);
          }
        } else if (event.action === "afterDelete") {
          const id = event.result?.id;
          if (typeof id === "number") {
            await removeVectorKnowledgeChunks(strapi, id);
          }
        }
      } catch (e) {
        strapi.log.error(`vector-knowledge lifecycle: ${e instanceof Error ? e.message : e}`);
      }
    });
  },
};
