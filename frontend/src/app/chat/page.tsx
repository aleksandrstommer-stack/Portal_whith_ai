import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StrapiRichText } from "@/components/strapi-rich-text";
import { ChatPanel } from "@/app/chat/chat-panel";
import { fetchKnowledgeDocuments } from "@/lib/queries";
import { fetchRagSources } from "@/lib/rag/sources";

export const metadata: Metadata = {
  title: "ИИ‑чат",
};

export default async function ChatPage() {
  const docs = await fetchKnowledgeDocuments(50);
  const ragSources = await fetchRagSources(40);

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-8 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">ИИ‑ассистент</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.7fr)_minmax(240px,0.3fr)] lg:items-start">
        <ChatPanel />

        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Документы базы знаний</CardTitle>
            <CardDescription>Материалы, на основе которых ассистент формирует ответы.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <details open>
              <summary className="cursor-pointer text-sm font-medium text-primary">Актуальные загруженные материалы</summary>
              <div className="mt-3 space-y-2">
                {ragSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">В векторной базе пока нет загруженных материалов.</p>
                ) : (
                  ragSources.map((item, idx) => (
                    <div key={`${item.title}-${idx}`} className="rounded-md border bg-card/60 px-3 py-2 text-sm">
                      <div className="font-medium">{item.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="outline">{item.source || "vector"}</Badge>
                        {item.testKey ? <Badge variant="secondary">{item.testKey}</Badge> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </details>

            <details>
              <summary className="cursor-pointer text-sm font-medium text-primary">Раздел Документы базы знаний</summary>
              <div className="mt-3 space-y-4">
                {docs.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Документы ещё не заведены.</p>
                ) : (
                  docs.data.map((doc) => (
                    <div key={doc.id} className="rounded-lg border bg-card/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">{doc.attributes.title}</div>
                        {doc.attributes.tags ? <Badge variant="outline">{doc.attributes.tags}</Badge> : null}
                      </div>
                      {doc.attributes.abstract ? <p className="mt-2 text-sm text-muted-foreground">{doc.attributes.abstract}</p> : null}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-primary">Показать текст</summary>
                        <div className="mt-2">
                          <StrapiRichText html={doc.attributes.body} />
                        </div>
                      </details>
                    </div>
                  ))
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
