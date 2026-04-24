import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/page-shell";
import { formatRuDate } from "@/lib/format";
import { fetchNews } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Новости",
};

export default async function NewsPage() {
  const news = await fetchNews(50);

  return (
    <div className="container space-y-8 py-10">
      <PageHeader title="Новости" description="Актуальные новости и события компании." />

      {news.data.length === 0 ? (
        <EmptyState title="Новостей пока нет" description="Новые материалы появятся здесь после публикации." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {news.data.map((article) => (
            <Card key={article.id} className="overflow-hidden transition hover:border-primary/25 hover:shadow-portal">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{formatRuDate(article.attributes.publishedAt)}</span>
                  {article.attributes.featured ? <Badge>Избранное</Badge> : null}
                </div>
                <CardTitle className="text-xl leading-snug">
                  <Link className="hover:text-primary" href={`/news/${article.attributes.slug}`}>
                    {article.attributes.title}
                  </Link>
                </CardTitle>
                <CardDescription>{article.attributes.excerpt}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
