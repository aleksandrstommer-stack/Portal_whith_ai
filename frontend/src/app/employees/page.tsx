import type { Metadata } from "next";

import { EmployeesBoard } from "@/components/employees-board";
import { PageHeader } from "@/components/page-shell";
import { fetchEmployees } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Сотрудники",
};

export default async function EmployeesPage() {
  const employees = await fetchEmployees();

  return (
    <div className="container space-y-8 py-10">
      <PageHeader
        title="Сотрудники"
        description="Каталог сотрудников с поиском, фильтрами и группировкой по отделам."
      />

      <EmployeesBoard employees={employees.data} />
    </div>
  );
}
