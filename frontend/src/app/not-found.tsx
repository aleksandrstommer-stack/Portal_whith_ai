import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Страница не найдена</h1>
      <p className="max-w-md text-muted-foreground">Похоже, ссылка устарела или страница временно недоступна.</p>
      <Button asChild>
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
