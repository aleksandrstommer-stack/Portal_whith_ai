import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

import mammoth from "mammoth";
import type { LoadedStrapi } from "@strapi/strapi";

import { htmlToRagLinearText } from "../utils/rag-text";

type DocxMedia = {
  url?: string | null;
  mime?: string | null;
};

type EntityLike = {
  googleDocUrl?: string | null;
  docxFile?: DocxMedia | null;
};

function extractGoogleDocId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  throw new Error("Не удалось распознать ID Google Docs.");
}

async function loadGoogleDoc(urlOrId: string): Promise<string> {
  const id = extractGoogleDocId(urlOrId);
  const url = `https://docs.google.com/document/d/${encodeURIComponent(id)}/export?format=html`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PortalRAG/1.0)",
      Accept: "text/html,*/*",
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Google Docs вернул HTTP ${res.status}`);
  }
  return htmlToRagLinearText(body);
}

async function loadDocx(media: DocxMedia): Promise<string> {
  const fileUrl = media.url?.trim();
  if (!fileUrl) return "";
  if (!fileUrl.toLowerCase().endsWith(".docx")) return "";

  const rel = fileUrl.startsWith("/") ? fileUrl.slice(1) : fileUrl;
  const abs = join(process.cwd(), "public", rel);
  const buf = await readFile(abs);
  const mediaDir = join(process.cwd(), "public", "rag-media");
  await mkdir(mediaDir, { recursive: true });
  const { value: html } = await mammoth.convertToHtml(
    { buffer: buf },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imgBuf = await image.readAsBuffer();
        const ext = image.contentType?.includes("png")
          ? "png"
          : image.contentType?.includes("jpeg") || image.contentType?.includes("jpg")
            ? "jpg"
            : image.contentType?.includes("gif")
              ? "gif"
              : image.contentType?.includes("webp")
                ? "webp"
                : "bin";
        const filename = `${randomUUID()}.${ext}`;
        await writeFile(join(mediaDir, filename), new Uint8Array(imgBuf));
        return { src: `/rag-media/${filename}` };
      }),
    }
  );
  return htmlToRagLinearText(html);
}

export async function buildVectorKnowledgeImportedText(strapi: LoadedStrapi, id: number): Promise<string> {
  const entry = (await strapi.entityService.findOne("api::vector-knowledge.vector-knowledge", id, {
    populate: { docxFile: true },
    fields: ["googleDocUrl"],
  })) as EntityLike | null;

  if (!entry) return "";
  const parts: string[] = [];

  if (entry.googleDocUrl?.trim()) {
    try {
      parts.push(await loadGoogleDoc(entry.googleDocUrl));
    } catch (e) {
      strapi.log.warn(`vector-source: google docs import failed id=${id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (entry.docxFile?.url) {
    try {
      parts.push(await loadDocx(entry.docxFile));
    } catch (e) {
      strapi.log.warn(`vector-source: docx import failed id=${id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  return parts.filter(Boolean).join("\n\n").trim();
}
