import type { Metadata } from "next";

import { InfoDocumentPage } from "@/components/info-document-page";
import { getCachedInfoPageBySlug } from "@/lib/queries";

type PageProps = {
  params: { slug: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const res = await getCachedInfoPageBySlug(params.slug);
  const page = res.data[0];

  if (!page || page.attributes.section !== "official") {
    return { title: "Документ" };
  }

  return {
    title: page.attributes.title,
    description: page.attributes.summary ?? undefined,
  };
}

export default function OfficialDocumentPage({ params }: PageProps) {
  return (
    <InfoDocumentPage slug={params.slug} section="official" basePath="/official" sectionLabel="Официальная информация" />
  );
}
