import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchVacancies } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Вакансии",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Полная занятость",
  part_time: "Частичная",
  contract: "Контракт",
  internship: "Стажировка",
};

export default async function VacanciesPage() {
  const vacancies = await fetchVacancies();

  return (
    <div className="container space-y-8 py-10">
      <PageHeader title="Вакансии" description="Открытые позиции и требования по ролям." />

      {vacancies.data.length === 0 ? (
        <EmptyState
          title="Открытых вакансий пока нет"
          description="Новые позиции появятся здесь после публикации."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {vacancies.data.map((vacancy) => (
            <Link key={vacancy.id} href={`/vacancies/${vacancy.attributes.slug}`}>
              <Card className="h-full transition hover:border-primary/40 hover:shadow-portal">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{EMPLOYMENT_LABELS[vacancy.attributes.employmentType]}</Badge>
                    <span>{vacancy.attributes.location}</span>
                  </div>
                  <CardTitle className="text-xl">{vacancy.attributes.title}</CardTitle>
                  <CardDescription>
                    {vacancy.attributes.department?.data?.attributes.name
                      ? `Подразделение: ${vacancy.attributes.department.data.attributes.name}`
                      : "Подразделение уточняется"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
