function candidateBaseUrls(): string[] {
  const list = process.env.OLLAMA_BASE_URLS?.trim();
  if (list) {
    const parsed = list
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  const single = process.env.OLLAMA_BASE_URL?.trim().replace(/\/$/, "");
  return [single || "http://127.0.0.1:11434"];
}

async function isReachable(base: string, timeoutMs = 2000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/`, { method: "HEAD", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

type OllamaCallOptions = {
  timeoutMs?: number;
};

type OllamaChatOptions = {
  timeoutMs?: number;
  numPredict?: number;
  numCtx?: number;
  temperature?: number;
};

async function withOllamaFallback<T>(
  path: string,
  buildInit: () => RequestInit,
  callOptions?: OllamaCallOptions
): Promise<{ raw: string; base: string; json: T }> {
  const discovered = candidateBaseUrls();
  const reachability = await Promise.all(discovered.map((base) => isReachable(base)));
  const bases = discovered.filter((_base, i) => reachability[i]);
  if (bases.length === 0) {
    throw new Error(`Ollama недоступен: не удалось подключиться к адресам ${discovered.join(", ")}`);
  }
  const errors: string[] = [];

  for (const base of bases) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      const timeoutMs = Math.max(1000, callOptions?.timeoutMs ?? 90000);
      timer = setTimeout(() => controller.abort(new Error(`timeout ${timeoutMs}ms`)), timeoutMs);
      const init = buildInit();
      const res = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
      clearTimeout(timer);
      const raw = await res.text();
      if (!res.ok) {
        errors.push(`${base}: HTTP ${res.status} — ${raw.slice(0, 220)}`);
        continue;
      }
      const json = JSON.parse(raw) as T;
      return { raw, base, json };
    } catch (error) {
      if (timer) clearTimeout(timer);
      errors.push(`${base}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Ollama недоступен ни по одному адресу: ${errors.join(" | ")}`);
}

export async function ollamaEmbed(text: string): Promise<number[]> {
  const model = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
  const { json, base } = await withOllamaFallback<{ embedding?: number[] }>("/api/embeddings", () => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
  }));
  if (!json.embedding?.length) {
    throw new Error(`Ollama (${base}): пустой embedding в ответе`);
  }
  return json.embedding;
}

export async function ollamaChat(messages: { role: string; content: string }[], options?: OllamaChatOptions): Promise<string> {
  const model = process.env.OLLAMA_CHAT_MODEL || "llama3.2";
  const { json, base } = await withOllamaFallback<{ message?: { content?: string } }>("/api/chat", () => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        num_predict: options?.numPredict ?? 220,
        num_ctx: options?.numCtx ?? 2048,
        temperature: options?.temperature ?? 0.2,
      },
      keep_alive: "10m",
    }),
  }), { timeoutMs: options?.timeoutMs ?? 120000 });
  const text = json.message?.content?.trim();
  if (!text) {
    throw new Error(`Ollama (${base}): пустой ответ модели`);
  }
  return text;
}
