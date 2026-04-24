import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/news", label: "Новости" },
  { href: "/employees", label: "Сотрудники" },
  { href: "/official", label: "Официальная информация" },
  { href: "/compliance", label: "Комплаенс" },
  { href: "/personnel", label: "Кадры" },
  { href: "/training", label: "Обучение" },
  { href: "/vacancies", label: "Вакансии" },
  { href: "/faq", label: "Вопросы и ответы" },
  { href: "/applications", label: "Заявки" },
  { href: "/links", label: "Ссылки" },
  { href: "/reception", label: "Приёмная" },
] as const;

function NavLinks({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  return (
    <nav className={cn("flex flex-col gap-1 text-sm font-medium lg:flex-row lg:items-center lg:gap-6", className)}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className="rounded-md px-2 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:px-0 lg:py-0 lg:hover:bg-transparent"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-secondary/70">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/25">
              P
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Корпоративный портал</div>
              <div className="text-xs text-muted-foreground">единая точка входа</div>
            </div>
          </Link>
        </div>

        <div className="hidden lg:block">
          <NavLinks className="flex-row items-center gap-5 text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex border-border/80 bg-card/70">
            <Link href="/chat">ИИ‑чат</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Открыть меню">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px]">
              <SheetHeader>
                <SheetTitle>Разделы</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <NavLinks />
              </div>
              <div className="mt-6">
                <Button asChild className="w-full">
                  <Link href="/chat">ИИ‑чат</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
