import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container flex flex-col gap-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="font-medium text-foreground">Корпоративный портал</div>
          <p>Контент управляется в Strapi. Портал оптимизирован для ежедневной работы сотрудников.</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link className="hover:text-foreground" href="/official">
            Документы
          </Link>
          <Link className="hover:text-foreground" href="/applications">
            Обращения
          </Link>
          <Link className="hover:text-foreground" href="/chat">
            ИИ‑чат
          </Link>
        </div>
      </div>
    </footer>
  );
}
