"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { StrapiEntity, TrainingCourseAttributes } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrainingSidebarProps = {
  courses: StrapiEntity<TrainingCourseAttributes>[];
};

export function TrainingSidebar({ courses }: TrainingSidebarProps) {
  const pathname = usePathname();
  const activeSlug = pathname.startsWith("/training/") ? pathname.replace("/training/", "") : undefined;

  const sorted = [...courses].sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0));

  return (
    <aside className="rounded-xl border border-sidebar-border bg-sidebar p-4 shadow-sm lg:sticky lg:top-24">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Программы</div>
      <ul className="space-y-1 text-sm">
        {sorted.map((course) => {
          const slug = course.attributes.slug;
          const isActive = activeSlug === slug;

          return (
            <li key={course.id}>
              <Link
                href={`/training/${slug}`}
                className={cn(
                  "block rounded-md px-2 py-2 transition hover:bg-muted",
                  isActive && "bg-muted font-medium text-foreground",
                )}
              >
                {course.attributes.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
