/**
 * Strapi, как его видит браузер (картинки /rag-media, /uploads в JSON ответов API).
 * Не использовать docker-имя strapi:1337 — с клиента оно не резолвится.
 * На сервере в .env: STRAPI_PUBLIC_URL или NEXT_PUBLIC_STRAPI_URL=http://<IP-или-домен>:1337
 */
export function getStrapiPublicBaseUrl(): string {
  const u = process.env.STRAPI_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_STRAPI_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return "http://127.0.0.1:1337";
}

/**
 * Вызовы Strapi с сервера Next.js (в Docker — обычно http://strapi:1337).
 */
export function getStrapiServerRequestBaseUrl(): string {
  const u =
    process.env.STRAPI_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_STRAPI_URL?.trim() ||
    process.env.STRAPI_PUBLIC_URL?.trim();
  return (u || "http://127.0.0.1:1337").replace(/\/$/, "");
}
