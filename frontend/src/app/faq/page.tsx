import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StrapiRichText } from "@/components/strapi-rich-text";
import { fetchFaqItems } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Вопросы и ответы",
};

export default async function FaqPage() {
  const faq = await fetchFaqItems();
  const sorted = [...faq.data].sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0));

  const grouped = sorted.reduce<Record<string, typeof sorted>>((acc, item) => {
    const key = item.attributes.category || "Общее";
    acc[key] = acc[key] ? [...acc[key], item] : [item];
    return acc;
  }, {});

  return (
    <div className="container space-y-8 py-10">
      <PageHeader title="Частые вопросы" description="Ответы на популярные вопросы сотрудников." />

      {sorted.length === 0 ? (
        <EmptyState
          title="Список вопросов пока пуст"
          description="Материалы появятся здесь после добавления."
        />
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category} className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{category}</h2>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                  <Card key={item.id} className="transition hover:border-primary/25 hover:shadow-portal">
                    <CardHeader>
                      <CardTitle className="text-base leading-snug">{item.attributes.question}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StrapiRichText html={item.attributes.answer} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
