import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCachedInfoPages } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Официальная информация",
};

export default async function OfficialIndexPage() {
  const res = await getCachedInfoPages("official");
  const pages = [...res.data].sort((a, b) => (a.attributes.navOrder ?? 0) - (b.attributes.navOrder ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Официальная информация"
        description="Выберите документ в боковой навигации или откройте карточку ниже."
      />

      {pages.length === 0 ? (
        <EmptyState title="Документов пока нет" description="Материалы появятся после публикации." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pages.map((page) => (
            <Link key={page.id} href={`/official/${page.attributes.slug}`}>
              <Card className="h-full transition hover:border-primary/40 hover:shadow-portal">
                <CardHeader>
                  <CardTitle className="text-lg">{page.attributes.title}</CardTitle>
                  {page.attributes.summary ? <CardDescription>{page.attributes.summary}</CardDescription> : null}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
