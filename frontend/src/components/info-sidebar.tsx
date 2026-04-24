"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { InfoPageAttributes, StrapiEntity } from "@/lib/types";
import { cn } from "@/lib/utils";

type InfoSidebarProps = {
  title: string;
  basePath: string;
  pages: StrapiEntity<InfoPageAttributes>[];
};

export function InfoSidebar({ title, basePath, pages }: InfoSidebarProps) {
  const pathname = usePathname();
  const activeSlug = pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length + 1) : undefined;

  const sorted = [...pages].sort((a, b) => (a.attributes.navOrder ?? 0) - (b.attributes.navOrder ?? 0));

  return (
    <aside className="rounded-xl border border-sidebar-border bg-sidebar p-4 shadow-sm lg:sticky lg:top-24">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="space-y-1 text-sm">
        {sorted.map((page) => {
          const slug = page.attributes.slug;
          const isActive = activeSlug === slug;

          return (
            <li key={page.id}>
              <Link
                href={`${basePath}/${slug}`}
                className={cn(
                  "block rounded-md px-2 py-2 transition hover:bg-muted",
                  isActive && "bg-muted font-medium text-foreground",
                )}
              >
                {page.attributes.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
