"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type SourceMeta = {
  source?: string;
  title?: string;
  documentId?: string;
  url?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceMeta[];
  imageUrls?: string[];
  interactionId?: string;
};

type TestOption = {
  key: string;
  title: string;
  questionsCount?: number;
};

type TestSession = {
  attemptId: number;
  testKey: string;
  testTitle: string;
  questions: Array<{ question: string; expected?: string }>;
};

type ContentPart = { type: "text"; value: string } | { type: "img"; alt: string; src: string };

/** Стабильный ID в браузере: не все окружения дают globalThis.crypto.randomUUID (старые Safari, нестандартные WebView, HTTP). */
function newMessageId(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isSafeAssistantImageSrc(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) {
    return true;
  }
  try {
    const u = new URL(src);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function splitMarkdownImages(content: string): ContentPart[] {
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts: ContentPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", value: content.slice(last, m.index) });
    }
    parts.push({ type: "img", alt: m[1], src: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    parts.push({ type: "text", value: content.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ type: "text", value: content });
  }
  return parts;
}

function AssistantMessageBody({ content }: { content: string }) {
  const parts = splitMarkdownImages(content);
  return (
    <div className="space-y-2 whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.type === "text" ? (
          <Fragment key={i}>{part.value}</Fragment>
        ) : isSafeAssistantImageSrc(part.src) ? (
          <SmartAssistantImage key={i} src={part.src} alt={part.alt || "Иллюстрация"} />
        ) : (
          <span key={i} className="text-muted-foreground">
            {`![${part.alt}](недопустимый URL)`}
          </span>
        )
      )}
    </div>
  );
}

function SmartAssistantImage({ src, alt }: { src: string; alt: string }) {
  const [imgSrc, setImgSrc] = useState(src);
  const [triedFallback, setTriedFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <a
        href={imgSrc}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-md border px-3 py-2 text-sm text-primary hover:underline"
      >
        Открыть изображение
      </a>
    );
  }

  return (
    <a href={imgSrc} target="_blank" rel="noreferrer" className="block">
      {/* Динамические URL из Google / RAG — не next/image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt={alt}
        className="max-h-[620px] w-full rounded-md border object-contain bg-background"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          const strapiBase = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
          if (!triedFallback) {
            if (src.startsWith("/")) {
              setTriedFallback(true);
              setImgSrc(`${strapiBase.replace(/\/$/, "")}${src}`);
              return;
            }
            const replaced = src.replace(/^https?:\/\/strapi:1337/i, strapiBase.replace(/\/$/, ""));
            if (replaced !== src) {
              setTriedFallback(true);
              setImgSrc(replaced);
              return;
            }
          }
          setFailed(true);
        }}
      />
    </a>
  );
}

function isSafeSourceUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function ChatPanel() {
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Здравствуйте! Задайте вопрос по документам компании, и я помогу быстро найти ответ.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mode, setMode] = useState<"chat" | "test">("chat");
  const [tests, setTests] = useState<TestOption[]>([]);
  const [testFullName, setTestFullName] = useState("");
  const [selectedTestKey, setSelectedTestKey] = useState("");
  const [testSession, setTestSession] = useState<TestSession | null>(null);
  const [testIndex, setTestIndex] = useState(0);
  const [testDraft, setTestDraft] = useState("");
  const [testAnswers, setTestAnswers] = useState<Array<{ question: string; answer: string; expected?: string }>>([]);
  const [testResult, setTestResult] = useState<{ totalQuestions: number; correctAnswers: number } | null>(null);
  const [testStartSeconds, setTestStartSeconds] = useState(0);
  const [feedbackState, setFeedbackState] = useState<
    Record<string, { helped?: boolean; rating?: number; submitted?: boolean; submitting?: boolean; error?: string }>
  >({});

  const canSend = useMemo(() => draft.trim().length > 0 && !loading, [draft, loading]);

  useEffect(() => {
    const viewport = scrollRootRef.current?.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]");
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/chat/test/catalog");
        const payload = (await res.json()) as { tests?: TestOption[] };
        if (res.ok && payload.tests) {
          setTests(payload.tests);
          if (!selectedTestKey && payload.tests[0]) {
            setSelectedTestKey(payload.tests[0].key);
          }
        }
      } catch {
        // каталог тестов необязателен для общего чата
      }
    })();
  }, [selectedTestKey]);

  useEffect(() => {
    if (!(mode === "test" && loading && !testSession)) {
      setTestStartSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setTestStartSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [mode, loading, testSession]);

  const testStartStage = useMemo(() => {
    if (!(mode === "test" && loading && !testSession)) return null;
    if (testStartSeconds < 8) return "Ищем материалы для теста в базе знаний";
    if (testStartSeconds < 25) return "Формируем вопросы с помощью ИИ";
    if (testStartSeconds < 40) return "Проверяем формат и подготавливаем итоговый список";
    return "Сохраняем попытку теста и завершаем запуск";
  }, [mode, loading, testSession, testStartSeconds]);

  const selectedTest = useMemo(() => tests.find((t) => t.key === selectedTestKey) || null, [tests, selectedTestKey]);
  const selectedQuestionsCount = selectedTest?.questionsCount || 15;

  async function send() {
    if (!canSend) return;

    const text = draft.trim();
    const userMessage: Message = {
      id: newMessageId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setLoading(true);
    setLastError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const payload = (await res.json()) as { answer?: string; error?: string; sources?: SourceMeta[]; imageUrls?: string[] };
      if (!res.ok) {
        throw new Error(payload.error || `Ошибка сервера: ${res.status}`);
      }
      const assistantMessage: Message = {
        id: newMessageId(),
        role: "assistant",
        content: payload.answer || "Пустой ответ модели.",
        sources: payload.sources ?? [],
        imageUrls: payload.imageUrls ?? [],
        interactionId: (payload as { interactionId?: string }).interactionId,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function startTest() {
    const fullName = testFullName.trim();
    if (!fullName || !selectedTestKey) {
      setLastError("Укажите ФИО и выберите тест.");
      return;
    }
    setLoading(true);
    setLastError(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/chat/test/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, testKey: selectedTestKey }),
      });
      const payload = (await res.json()) as {
        error?: string;
        attemptId?: number;
        testKey?: string;
        testTitle?: string;
        questions?: Array<{ question: string; expected?: string }>;
      };
      if (!res.ok || !payload.attemptId || !payload.questions) {
        throw new Error(payload.error || "Не удалось запустить тест.");
      }
      setTestSession({
        attemptId: payload.attemptId,
        testKey: payload.testKey || selectedTestKey,
        testTitle: payload.testTitle || selectedTestKey,
        questions: payload.questions,
      });
      setTestIndex(0);
      setTestDraft("");
      setTestAnswers([]);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitCurrentAnswer() {
    if (!testSession) return;
    const answer = testDraft.trim();
    if (!answer) return;
    const question = testSession.questions[testIndex]?.question;
    if (!question) return;
    const expected = testSession.questions[testIndex]?.expected;
    const next = [...testAnswers, { question, answer, expected }];
    setTestAnswers(next);
    setTestDraft("");

    if (testIndex + 1 < testSession.questions.length) {
      setTestIndex((i) => i + 1);
      return;
    }

    setLoading(true);
    setLastError(null);
    try {
      const res = await fetch("/api/chat/test/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: testSession.attemptId, answers: next }),
      });
      const payload = (await res.json()) as { error?: string; totalQuestions?: number; correctAnswers?: number };
      if (!res.ok || !payload.totalQuestions) {
        throw new Error(payload.error || "Не удалось завершить тест.");
      }
      setTestResult({
        totalQuestions: payload.totalQuestions,
        correctAnswers: payload.correctAnswers || 0,
      });
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{mode === "chat" ? "Диалог" : "Тестирование"}</CardTitle>
            <CardDescription>
              {mode === "chat"
                ? "Спрашивайте о документах, инструкциях, процессах и материалах базы знаний."
                : "Выберите тест, пройдите вопросы и сохраните результат в системе."}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant={mode === "chat" ? "default" : "outline"} size="sm" onClick={() => setMode("chat")}>
              Чат
            </Button>
            <Button type="button" variant={mode === "test" ? "default" : "outline"} size="sm" onClick={() => setMode("test")}>
              Пройти тест
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "test" ? (
          <div className="space-y-4">
            {!testSession ? (
              <div className="space-y-3 rounded-xl border bg-card p-4">
                <Input
                  value={testFullName}
                  onChange={(e) => setTestFullName(e.target.value)}
                  placeholder="ФИО сотрудника"
                  disabled={loading}
                />
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedTestKey}
                  onChange={(e) => setSelectedTestKey(e.target.value)}
                  disabled={loading}
                >
                  {tests.length === 0 ? <option value="">Нет доступных тестов</option> : null}
                  {tests.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <div className="text-sm text-muted-foreground">
                  Количество вопросов для этого теста задается в админке: <span className="font-medium">{selectedQuestionsCount}</span>
                </div>
                <Button type="button" onClick={() => void startTest()} disabled={loading || tests.length === 0}>
                  {loading ? "Подготовка..." : "Начать тест"}
                </Button>
                {testStartStage ? (
                  <div className="space-y-1 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm">
                    <div className="inline-flex items-center gap-2 text-foreground">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary/70" />
                      {testStartStage}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Прошло: {testStartSeconds} сек. Обычно запуск занимает 20-90 сек, зависит от объема документа и ответа модели.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border bg-card p-4">
                {testResult ? (
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">{testSession.testTitle}</div>
                    <p className="text-sm text-muted-foreground">
                      Результат: {testResult.correctAnswers} из {testResult.totalQuestions}
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        setTestSession(null);
                        setTestResult(null);
                        setTestAnswers([]);
                        setTestDraft("");
                        setTestIndex(0);
                      }}
                    >
                      Пройти другой тест
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground">
                      Вопрос {testIndex + 1} из {testSession.questions.length}
                    </div>
                    <div className="font-medium">
                      <AssistantMessageBody content={testSession.questions[testIndex]?.question || ""} />
                    </div>
                    <Input
                      value={testDraft}
                      onChange={(e) => setTestDraft(e.target.value)}
                      placeholder="Ваш ответ"
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void submitCurrentAnswer();
                        }
                      }}
                    />
                    <Button type="button" onClick={() => void submitCurrentAnswer()} disabled={loading || !testDraft.trim()}>
                      {testIndex + 1 < testSession.questions.length ? "Следующий вопрос" : "Завершить тест"}
                    </Button>
                  </>
                )}
              </div>
            )}
            {lastError ? <p className="text-sm text-destructive">{lastError}</p> : null}
          </div>
        ) : (
          <>
        <ScrollArea
          className="h-[460px] rounded-md border border-border/70 bg-muted/25 p-4 sm:h-[500px]"
          ref={scrollRootRef}
        >
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground"
                    : "mr-auto max-w-[90%] rounded-2xl border bg-card px-4 py-3 text-sm text-card-foreground shadow-sm"
                }
              >
                {message.role === "assistant" ? (
                  <div className="space-y-3">
                    <AssistantMessageBody content={message.content} />
                    {message.imageUrls && message.imageUrls.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Array.from(new Set(message.imageUrls)).slice(0, 6).map((url, idx) => (
                          <SmartAssistantImage key={`${message.id}-img-${idx}`} src={url} alt="Иллюстрация" />
                        ))}
                      </div>
                    ) : null}
                    {message.sources && message.sources.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {Array.from(
                          new Map(
                            message.sources.map((source) => [
                              `${source.title || source.source || "Источник"}|${source.url || ""}`,
                              source,
                            ])
                          ).values()
                        )
                          .slice(0, 4)
                          .map((source, idx) => {
                            const label = source.title || source.source || "Источник";
                            const link = source.url && isSafeSourceUrl(source.url) ? source.url : null;
                            return link ? (
                              <a
                                key={`${message.id}-${idx}`}
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex"
                              >
                                <Badge variant="secondary" className="gap-1 text-[11px]">
                                  {label}
                                  <ExternalLink className="h-3 w-3" />
                                </Badge>
                              </a>
                            ) : (
                              <Badge key={`${message.id}-${idx}`} variant="secondary" className="gap-1 text-[11px]">
                                {label}
                              </Badge>
                            );
                          })}
                      </div>
                    ) : null}
                    {message.interactionId ? (
                      <div className="rounded-md border border-border/60 bg-muted/40 p-2 text-xs">
                        <div className="mb-2 text-muted-foreground">Ответ помог? Оцените качество от 1 до 10.</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={feedbackState[message.id]?.helped === true ? "default" : "outline"}
                            onClick={() =>
                              setFeedbackState((prev) => ({
                                ...prev,
                                [message.id]: { ...prev[message.id], helped: true, error: undefined },
                              }))
                            }
                            disabled={feedbackState[message.id]?.submitted || feedbackState[message.id]?.submitting}
                          >
                            Помогло
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={feedbackState[message.id]?.helped === false ? "default" : "outline"}
                            onClick={() =>
                              setFeedbackState((prev) => ({
                                ...prev,
                                [message.id]: { ...prev[message.id], helped: false, error: undefined },
                              }))
                            }
                            disabled={feedbackState[message.id]?.submitted || feedbackState[message.id]?.submitting}
                          >
                            Не помогло
                          </Button>
                          <select
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={feedbackState[message.id]?.rating ?? ""}
                            onChange={(e) =>
                              setFeedbackState((prev) => ({
                                ...prev,
                                [message.id]: { ...prev[message.id], rating: Number(e.target.value), error: undefined },
                              }))
                            }
                            disabled={feedbackState[message.id]?.submitted || feedbackState[message.id]?.submitting}
                          >
                            <option value="">Оценка</option>
                            {Array.from({ length: 10 }).map((_, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                {idx + 1}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            onClick={async () => {
                              const current = feedbackState[message.id] || {};
                              if (typeof current.helped !== "boolean" || !current.rating) {
                                setFeedbackState((prev) => ({
                                  ...prev,
                                  [message.id]: { ...current, error: "Выберите помогло/не помогло и оценку 1-10." },
                                }));
                                return;
                              }
                              setFeedbackState((prev) => ({
                                ...prev,
                                [message.id]: { ...current, submitting: true, error: undefined },
                              }));
                              try {
                                const res = await fetch("/api/chat/feedback", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    interactionId: message.interactionId,
                                    helped: current.helped,
                                    rating: current.rating,
                                  }),
                                });
                                const payload = (await res.json()) as { error?: string };
                                if (!res.ok) {
                                  throw new Error(payload.error || "Не удалось сохранить оценку.");
                                }
                                setFeedbackState((prev) => ({
                                  ...prev,
                                  [message.id]: { ...current, submitted: true, submitting: false, error: undefined },
                                }));
                              } catch (e) {
                                const msg = e instanceof Error ? e.message : String(e);
                                setFeedbackState((prev) => ({
                                  ...prev,
                                  [message.id]: { ...current, submitting: false, error: msg },
                                }));
                              }
                            }}
                            disabled={feedbackState[message.id]?.submitted || feedbackState[message.id]?.submitting}
                          >
                            {feedbackState[message.id]?.submitted
                              ? "Оценка сохранена"
                              : feedbackState[message.id]?.submitting
                                ? "Сохраняем..."
                                : "Оценить"}
                          </Button>
                        </div>
                        {feedbackState[message.id]?.error ? (
                          <p className="mt-1 text-xs text-destructive">{feedbackState[message.id]?.error}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  message.content
                )}
              </div>
            ))}
            {loading ? (
              <div className="mr-auto max-w-[90%] rounded-2xl border bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary/60" />
                  Модель формирует ответ...
                </span>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {lastError ? <p className="text-sm text-destructive">{lastError}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Введите вопрос по документам и инструкциям…"
            disabled={loading}
            className="bg-card"
          />
          <Button className="sm:w-32" disabled={!canSend} onClick={() => void send()} type="button">
            {loading ? "…" : "Отправить"}
          </Button>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
