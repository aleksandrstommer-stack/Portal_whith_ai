import { InfoSidebar } from "@/components/info-sidebar";
import { getCachedInfoPages } from "@/lib/queries";

export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  const res = await getCachedInfoPages("compliance");

  return (
    <div className="container py-10">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:items-start">
        <InfoSidebar title="Комплаенс" basePath="/compliance" pages={res.data} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
