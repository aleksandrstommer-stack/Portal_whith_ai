import type { Metadata } from "next";

import { ApplicationForm } from "@/app/applications/application-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Заявки и обращения",
};

export default function ApplicationsPage() {
  return (
    <div className="container max-w-3xl space-y-8 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Заявки и обращения</h1>
        <p className="text-muted-foreground">Оставьте заявку, и она будет передана ответственным сотрудникам.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Подсказка</CardTitle>
          <CardDescription>
            Для интеграции с маршрутизацией заявок можно подключить электронную почту, Jira Service Management или внутреннюю BPM‑систему.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Заполняйте форму подробно, чтобы ускорить обработку обращения.
        </CardContent>
      </Card>

      <ApplicationForm />
    </div>
  );
}
