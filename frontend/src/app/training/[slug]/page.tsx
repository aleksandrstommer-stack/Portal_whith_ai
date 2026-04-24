import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { StrapiRichText } from "@/components/strapi-rich-text";
import { fetchTrainingCourseBySlug } from "@/lib/queries";

type PageProps = {
  params: { slug: string };
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Базовый",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const res = await fetchTrainingCourseBySlug(params.slug);
  const course = res.data[0];

  if (!course) {
    return { title: "Курс" };
  }

  return {
    title: course.attributes.title,
    description: course.attributes.summary,
  };
}

export default async function TrainingCoursePage({ params }: PageProps) {
  const res = await fetchTrainingCourseBySlug(params.slug);
  const course = res.data[0];

  if (!course) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Главная</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/training">Обучение</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{course.attributes.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{LEVEL_LABELS[course.attributes.level] ?? course.attributes.level}</Badge>
        <span>{course.attributes.durationHours ?? 0} академических часов</span>
      </div>

      <div className="space-y-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{course.attributes.title}</h1>
        <p className="text-lg text-muted-foreground">{course.attributes.summary}</p>
      </div>

      <StrapiRichText html={course.attributes.body} className="text-base" />
    </div>
  );
}
