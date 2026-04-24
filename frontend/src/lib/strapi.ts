import "server-only";

function getStrapiBaseUrl() {
  return process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "http://127.0.0.1:1337";
}

export class StrapiHttpError extends Error {
  status: number;
  body?: string;

  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "StrapiHttpError";
    this.status = status;
    this.body = body;
  }
}

export async function strapiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getStrapiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new StrapiHttpError(`Strapi request failed: ${response.status}`, response.status, text);
  }

  return (await response.json()) as T;
}

export function buildStrapiQuery(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    searchParams.set(key, String(value));
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}
