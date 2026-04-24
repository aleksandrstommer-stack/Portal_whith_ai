import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCachedInfoPages } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Кадровый раздел",
};

export default async function PersonnelIndexPage() {
  const res = await getCachedInfoPages("personnel");
  const pages = [...res.data].sort((a, b) => (a.attributes.navOrder ?? 0) - (b.attributes.navOrder ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader title="Кадровый раздел" description="Материалы для сотрудников с удобной боковой навигацией." />

      {pages.length === 0 ? (
        <EmptyState title="Материалов пока нет" description="Материалы появятся здесь после публикации." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pages.map((page) => (
            <Link key={page.id} href={`/personnel/${page.attributes.slug}`}>
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
