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
import { Button } from "@/components/ui/button";
import { StrapiRichText } from "@/components/strapi-rich-text";
import { fetchVacancyBySlug } from "@/lib/queries";

type PageProps = {
  params: { slug: string };
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Полная занятость",
  part_time: "Частичная",
  contract: "Контракт",
  internship: "Стажировка",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const res = await fetchVacancyBySlug(params.slug);
  const vacancy = res.data[0];

  if (!vacancy) {
    return { title: "Вакансия" };
  }

  return {
    title: vacancy.attributes.title,
    description: `${vacancy.attributes.location} · ${EMPLOYMENT_LABELS[vacancy.attributes.employmentType]}`,
  };
}

export default async function VacancyPage({ params }: PageProps) {
  const res = await fetchVacancyBySlug(params.slug);
  const vacancy = res.data[0];

  if (!vacancy) {
    notFound();
  }

  return (
    <div className="container max-w-3xl space-y-6 py-10">
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
              <Link href="/vacancies">Вакансии</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{vacancy.attributes.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{EMPLOYMENT_LABELS[vacancy.attributes.employmentType]}</Badge>
        <span>{vacancy.attributes.location}</span>
        {vacancy.attributes.salaryRange ? <span>{vacancy.attributes.salaryRange}</span> : null}
      </div>

      <div className="space-y-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{vacancy.attributes.title}</h1>
        {vacancy.attributes.department?.data ? (
          <p className="text-muted-foreground">Команда: {vacancy.attributes.department.data.attributes.name}</p>
        ) : null}
      </div>

      <StrapiRichText html={vacancy.attributes.body} className="text-base" />

      <Button asChild>
        <Link href="/applications">Откликнуться через форму</Link>
      </Button>
    </div>
  );
}
