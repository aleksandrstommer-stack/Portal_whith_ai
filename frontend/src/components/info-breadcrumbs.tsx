import Link from "next/link";

import type { InfoPageAttributes, StrapiEntity } from "@/lib/types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type InfoBreadcrumbsProps = {
  sectionHref: string;
  sectionLabel: string;
  page: StrapiEntity<InfoPageAttributes>;
};

export function InfoBreadcrumbs({ sectionHref, sectionLabel, page }: InfoBreadcrumbsProps) {
  const parent = page.attributes.parent?.data;

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Главная</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={sectionHref}>{sectionLabel}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {parent ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`${sectionHref}/${parent.attributes.slug}`}>{parent.attributes.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        ) : null}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{page.attributes.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
