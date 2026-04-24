import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StrapiRichText } from "@/components/strapi-rich-text";
import { fetchVirtualReception } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Виртуальная приёмная",
};

export default async function ReceptionPage() {
  const reception = await fetchVirtualReception();
  const data = reception.data?.attributes;

  if (!data) {
    return (
      <div className="container py-16">
        <Card>
          <CardHeader>
            <CardTitle>Контент ещё не опубликован</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Раздел пока пуст. Добавьте и опубликуйте материалы.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl space-y-8 py-10">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
        <p className="text-lg text-muted-foreground">{data.lead}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Горячая линия</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{data.hotline}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Почта</CardTitle>
          </CardHeader>
          <CardContent>
            <a className="text-lg font-semibold text-primary hover:underline" href={`mailto:${data.email}`}>
              {data.email}
            </a>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/applications">Оставить обращение</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/chat">Спросить у ИИ</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Подробности</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <StrapiRichText html={data.body} className="text-base" />
          <StrapiRichText html={data.schedule} className="text-base" />
        </CardContent>
      </Card>
    </div>
  );
}
