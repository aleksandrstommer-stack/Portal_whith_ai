import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  FileText,
  Link as LinkIcon,
  Mail,
  Megaphone,
  Newspaper,
  Phone,
  Sparkles,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StrapiRichText } from "@/components/strapi-rich-text";
import { formatRuDate } from "@/lib/format";
import {
  fetchAnnouncements,
  fetchHomeHero,
  fetchNews,
  fetchQuickActions,
  fetchUsefulLinks,
} from "@/lib/queries";
import { StrapiHttpError } from "@/lib/strapi";

function iconForQuickAction(icon: string) {
  const map = {
    mail: Mail,
    calendar: Calendar,
    user: User,
    file: FileText,
    link: LinkIcon,
    phone: Phone,
    sparkles: Sparkles,
  } as const;

  return map[icon as keyof typeof map] ?? LinkIcon;
}

export default async function HomePage() {
  try {
    const [hero, announcements, news, links, quickActions] = await Promise.all([
      fetchHomeHero(),
      fetchAnnouncements(4),
      fetchNews(4),
      fetchUsefulLinks(8),
      fetchQuickActions(8),
    ]);

    const heroData = hero.data?.attributes;

    return (
      <div className="space-y-16 pb-16">
        <section className="border-b border-border/70 bg-gradient-to-br from-secondary/80 via-background to-background">
          <div className="container py-14 md:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-6 animate-fade-in">
                {heroData?.badge ? (
                  <Badge variant="accent" className="w-fit">
                    {heroData.badge}
                  </Badge>
                ) : null}
                <div className="space-y-4">
                  <h1 className="portal-title text-3xl font-semibold text-foreground md:text-5xl">
                    {heroData?.headline ?? "Портал"}
                  </h1>
                  <p className="text-pretty text-lg text-muted-foreground md:text-xl">{heroData?.subheadline ?? ""}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {heroData?.primaryCtaLabel && heroData.primaryCtaHref ? (
                    <Button asChild size="lg">
                      <Link href={heroData.primaryCtaHref}>{heroData.primaryCtaLabel}</Link>
                    </Button>
                  ) : null}
                  {heroData?.secondaryCtaLabel && heroData.secondaryCtaHref ? (
                    <Button asChild size="lg" variant="outline">
                      <Link href={heroData.secondaryCtaHref}>{heroData.secondaryCtaLabel}</Link>
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/80 bg-card/85 px-3 py-1">Новости</span>
                  <span className="rounded-full border border-border/80 bg-card/85 px-3 py-1">Сотрудники</span>
                  <span className="rounded-full border border-border/80 bg-card/85 px-3 py-1">Документы</span>
                </div>
              </div>

              <Card className="portal-surface animate-fade-in border-primary/20 shadow-portal">
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Megaphone className="h-4 w-4" />
                    Объявления
                  </div>
                  <CardTitle className="text-xl">Актуальные сообщения</CardTitle>
                  <CardDescription>Важные объявления компании.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {announcements.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Объявлений пока нет.</p>
                  ) : (
                    announcements.data.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/80 bg-card/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{item.attributes.title}</div>
                          {item.attributes.priority === "high" ? (
                            <Badge variant="default">Важно</Badge>
                          ) : (
                            <Badge variant="secondary">Новость</Badge>
                          )}
                        </div>
                        <div className="mt-2 text-sm">
                          <StrapiRichText html={item.attributes.body} />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="container space-y-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Быстрые действия</h2>
              <p className="text-sm text-muted-foreground">Быстрый переход к основным разделам портала.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/applications">
                Создать обращение
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.data.map((action) => {
              const Icon = iconForQuickAction(action.attributes.icon);

              return (
                <Link key={action.id} href={action.attributes.href} className="group">
                  <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-portal">
                    <CardHeader className="space-y-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-base">{action.attributes.label}</CardTitle>
                      {action.attributes.hint ? <CardDescription>{action.attributes.hint}</CardDescription> : null}
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="container grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Новости</h2>
                <p className="text-sm text-muted-foreground">Материалы из коллекции «Новости».</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/news">
                  Все новости
                  <Newspaper className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {news.data.map((article) => (
                <Card key={article.id} className="overflow-hidden transition hover:border-primary/25 hover:shadow-portal">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{formatRuDate(article.attributes.publishedAt)}</span>
                      {article.attributes.featured ? <Badge>Избранное</Badge> : null}
                    </div>
                    <CardTitle className="text-lg leading-snug">
                      <Link className="hover:text-primary" href={`/news/${article.attributes.slug}`}>
                        {article.attributes.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>{article.attributes.excerpt}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Полезные ссылки</h2>
                <p className="text-sm text-muted-foreground">Подборка полезных внутренних и внешних ресурсов.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/links">Каталог</Link>
              </Button>
            </div>
            <Card className="portal-surface">
              <CardContent className="space-y-4 p-6">
                {Object.entries(
                  links.data.reduce<Record<string, typeof links.data>>((acc, link) => {
                    const group = link.attributes.groupName || "Общее";
                    acc[group] = acc[group] ? [...acc[group], link] : [link];
                    return acc;
                  }, {}),
                ).map(([group, items]) => (
                  <div key={group} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
                    <div className="space-y-2">
                      {items
                        .sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0))
                        .map((link) => (
                          <div key={link.id} className="flex items-start justify-between gap-3 rounded-md border bg-card/60 px-3 py-2">
                            <div>
                              <div className="font-medium">
                                <a className="hover:text-primary" href={link.attributes.url}>
                                  {link.attributes.title}
                                </a>
                              </div>
                              {link.attributes.description ? (
                                <div className="text-sm text-muted-foreground">{link.attributes.description}</div>
                              ) : null}
                            </div>
                            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                        ))}
                    </div>
                    <Separator />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    const message = error instanceof StrapiHttpError ? `Сервис контента временно недоступен (${error.status}).` : "Сервис контента временно недоступен.";

    return (
      <div className="container py-20">
        <Card>
          <CardHeader>
            <CardTitle>Не удалось загрузить главную страницу</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Попробуйте обновить страницу через пару минут или обратитесь к администратору портала.</p>
            <Button asChild>
              <Link href="/applications">Перейти к форме обращения</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
