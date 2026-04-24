import { notFound } from "next/navigation";

import { InfoBreadcrumbs } from "@/components/info-breadcrumbs";
import { StrapiRichText } from "@/components/strapi-rich-text";
import { getCachedInfoPageBySlug } from "@/lib/queries";
import type { InfoPageAttributes } from "@/lib/types";

type InfoDocumentPageProps = {
  slug: string;
  section: InfoPageAttributes["section"];
  basePath: string;
  sectionLabel: string;
};

export async function InfoDocumentPage({ slug, section, basePath, sectionLabel }: InfoDocumentPageProps) {
  const res = await getCachedInfoPageBySlug(slug);
  const page = res.data[0];

  if (!page || page.attributes.section !== section) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <InfoBreadcrumbs sectionHref={basePath} sectionLabel={sectionLabel} page={page} />

      <div className="space-y-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{page.attributes.title}</h1>
        {page.attributes.summary ? <p className="text-lg text-muted-foreground">{page.attributes.summary}</p> : null}
      </div>

      <StrapiRichText html={page.attributes.body} className="text-base" />
    </div>
  );
}
