import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StrapiRichText } from "@/components/strapi-rich-text";
import { formatRuDate } from "@/lib/format";
import { strapiFetch } from "@/lib/strapi";
import type { NewsArticleAttributes, StrapiListResponse } from "@/lib/types";

type PageProps = {
  params: { slug: string };
};

async function fetchArticle(slug: string) {
  const qs = new URLSearchParams({
    "filters[slug][$eq]": slug,
    publicationState: "live",
  });

  return strapiFetch<StrapiListResponse<NewsArticleAttributes>>(`/api/news-articles?${qs.toString()}`);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const res = await fetchArticle(params.slug);
  const article = res.data[0];

  if (!article) {
    return { title: "Новость не найдена" };
  }

  return {
    title: article.attributes.title,
    description: article.attributes.excerpt,
  };
}

export default async function NewsArticlePage({ params }: PageProps) {
  const res = await fetchArticle(params.slug);
  const article = res.data[0];

  if (!article) {
    notFound();
  }

  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/news">
          Новости
        </Link>
        <span>/</span>
        <span>{formatRuDate(article.attributes.publishedAt)}</span>
        {article.attributes.featured ? <Badge>Избранное</Badge> : null}
      </div>

      <div className="space-y-4">
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{article.attributes.title}</h1>
        <p className="text-lg text-muted-foreground">{article.attributes.excerpt}</p>
      </div>

      <StrapiRichText html={article.attributes.body} className="text-base" />

      <Button asChild variant="outline">
        <Link href="/news">Назад к ленте</Link>
      </Button>
    </div>
  );
}
