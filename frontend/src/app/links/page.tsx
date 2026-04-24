import type { Metadata } from "next";

import { EmptyState, PageHeader } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchUsefulLinks } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Полезные ссылки",
};

export default async function LinksPage() {
  const links = await fetchUsefulLinks(100);

  const grouped = links.data.reduce<Record<string, typeof links.data>>((acc, link) => {
    const group = link.attributes.groupName || "Общее";
    acc[group] = acc[group] ? [...acc[group], link] : [link];
    return acc;
  }, {});

  return (
    <div className="container space-y-8 py-10">
      <PageHeader
        title="Полезные ссылки"
        description="Собранные ссылки на важные сервисы и ресурсы."
      />

      {links.data.length === 0 ? (
        <EmptyState title="Ссылки пока не добавлены" description="Список появится после добавления материалов." />
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([group, items]) => (
            <section key={group} className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">{group}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {items
                  .sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0))
                  .map((link) => (
                    <Card key={link.id} className="transition hover:border-primary/25 hover:shadow-portal">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          <a className="hover:text-primary" href={link.attributes.url}>
                            {link.attributes.title}
                          </a>
                        </CardTitle>
                        {link.attributes.description ? <CardDescription>{link.attributes.description}</CardDescription> : null}
                      </CardHeader>
                    </Card>
                  ))}
              </div>
              <Separator />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
