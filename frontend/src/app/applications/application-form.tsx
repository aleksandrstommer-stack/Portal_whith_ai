"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TOPICS = [
  { value: "hr", label: "Кадры и HR" },
  { value: "it", label: "ИТ и сервисы" },
  { value: "legal", label: "Юридический вопрос" },
  { value: "other", label: "Другое" },
] as const;

export function ApplicationForm() {
  const endpoint = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_STRAPI_URL;
    if (!base) return "";
    return `${base.replace(/\/$/, "")}/api/application-messages`;
  }, []);

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!endpoint) {
      setStatus("error");
      setErrorMessage("Не настроен NEXT_PUBLIC_STRAPI_URL.");
      return;
    }

    const formData = new FormData(event.currentTarget);

    const payload = {
      data: {
        fullName: String(formData.get("fullName") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        topic: String(formData.get("topic") || "other"),
        message: String(formData.get("message") || "").trim(),
        consent: formData.get("consent") === "on",
      },
    };

    setStatus("loading");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Ошибка ${response.status}`);
      }

      setStatus("success");
      event.currentTarget.reset();
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить обращение.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Форма обращения</CardTitle>
        <CardDescription>Заполните форму, и обращение уйдет в работу.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">ФИО</Label>
              <Input id="fullName" name="fullName" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Рабочая почта</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон (необязательно)</Label>
              <Input id="phone" name="phone" autoComplete="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic">Тема</Label>
              <select
                id="topic"
                name="topic"
                required
                defaultValue="other"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {TOPICS.map((topic) => (
                  <option key={topic.value} value={topic.value}>
                    {topic.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Сообщение</Label>
            <Textarea id="message" name="message" required minLength={10} placeholder="Опишите запрос максимально конкретно" />
          </div>

          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input className="mt-1" type="checkbox" name="consent" required />
            <span>Согласен(на) на обработку персональных данных в рамках корпоративного регламента.</span>
          </label>

          {status === "success" ? (
            <div className="rounded-md border border-primary/30 bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              Обращение отправлено. Мы свяжемся с вами по указанной почте.
            </div>
          ) : null}

          {status === "error" ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Отправка…" : "Отправить"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
