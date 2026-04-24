"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import type { EmployeeAttributes, StrapiEntity } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type EmployeesBoardProps = {
  employees: StrapiEntity<EmployeeAttributes>[];
};

type Grouped = Record<
  string,
  {
    label: string;
    items: StrapiEntity<EmployeeAttributes>[];
  }
>;

function getDepartmentMeta(employee: StrapiEntity<EmployeeAttributes>) {
  const department = employee.attributes.department?.data;
  const slug = department?.attributes.slug ?? "unknown";
  const name = department?.attributes.name ?? "Без отдела";

  return { slug, name };
}

export function EmployeesBoard({ employees }: EmployeesBoardProps) {
  const [query, setQuery] = useState("");
  const [departmentSlug, setDepartmentSlug] = useState<string>("all");

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const employee of employees) {
      const { slug, name } = getDepartmentMeta(employee);
      map.set(slug, name);
    }

    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "ru"));
  }, [employees]);

  const grouped = useMemo(() => {
    const filtered = employees.filter((employee) => {
      const { slug } = getDepartmentMeta(employee);
      const haystack = `${employee.attributes.fullName} ${employee.attributes.jobTitle} ${employee.attributes.email ?? ""}`.toLowerCase();
      const matchesQuery = haystack.includes(query.trim().toLowerCase());
      const matchesDepartment = departmentSlug === "all" || slug === departmentSlug;

      return matchesQuery && matchesDepartment;
    });

    const next: Grouped = {};

    for (const employee of filtered) {
      const { slug, name } = getDepartmentMeta(employee);
      const key = slug;

      if (!next[key]) {
        next[key] = { label: name, items: [] };
      }

      next[key].items.push(employee);
    }

    for (const group of Object.values(next)) {
      group.items.sort((a, b) => (a.attributes.sortOrder ?? 0) - (b.attributes.sortOrder ?? 0));
    }

    return next;
  }, [departmentSlug, employees, query]);

  const sortedGroupKeys = useMemo(() => Object.keys(grouped).sort((a, b) => grouped[a].label.localeCompare(grouped[b].label, "ru")), [grouped]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Поиск и фильтры</CardTitle>
          <CardDescription>Найдите коллегу по ФИО, роли или отделу.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="employee-search">Поиск</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="employee-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Например: инженер, HR, почта…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Отдел</Label>
            <Select value={departmentSlug} onValueChange={setDepartmentSlug}>
              <SelectTrigger>
                <SelectValue placeholder="Все отделы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все отделы</SelectItem>
                {departmentOptions.map(([slug, name]) => (
                  <SelectItem key={slug} value={slug}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8">
        {sortedGroupKeys.map((key) => {
          const group = grouped[key];

          return (
            <section key={key} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>
                  <p className="text-sm text-muted-foreground">{group.items.length} сотрудников в выборке</p>
                </div>
                <Badge variant="secondary">{group.items.length}</Badge>
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((employee) => (
                  <Card key={employee.id} className="overflow-hidden">
                    <CardHeader className="space-y-1">
                      <CardTitle className="text-base">{employee.attributes.fullName}</CardTitle>
                      <CardDescription>{employee.attributes.jobTitle}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      {employee.attributes.email ? <div>{employee.attributes.email}</div> : null}
                      {employee.attributes.phone ? <div>{employee.attributes.phone}</div> : null}
                      {employee.attributes.office ? <div>{employee.attributes.office}</div> : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {sortedGroupKeys.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Никого не нашли — попробуйте изменить фильтры.</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
