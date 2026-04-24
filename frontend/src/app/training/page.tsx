import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchTrainingCourses } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Обучение",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Базовый",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export default async function TrainingIndexPage() {
  const courses = await fetchTrainingCourses();
  const sorted = [...courses.data].sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Обучение и развитие"
        description="Каталог программ обучения и повышения квалификации."
      />

      {sorted.length === 0 ? (
        <EmptyState title="Курсов пока нет" description="Курсы появятся здесь после публикации." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((course) => (
            <Link key={course.id} href={`/training/${course.attributes.slug}`}>
              <Card className="h-full transition hover:border-primary/40 hover:shadow-portal">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{LEVEL_LABELS[course.attributes.level] ?? course.attributes.level}</Badge>
                    <span>{course.attributes.durationHours ?? 0} ч.</span>
                  </div>
                  <CardTitle className="text-lg">{course.attributes.title}</CardTitle>
                  <CardDescription>{course.attributes.summary}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
