import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container space-y-8 py-10">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, sectionIdx) => (
          <div key={sectionIdx} className="space-y-4">
            <Skeleton className="h-7 w-56" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((__, idx) => (
                <div key={idx} className="rounded-xl border bg-card p-6">
                  <Skeleton className="h-6 w-11/12" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
