import { requirePermission } from "@/core/auth/session";
import { createEmployeeAction } from "@/modules/employees/actions";
import { EmployeeForm } from "@/modules/employees/employee-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewEmployeePage({ searchParams }: PageProps<"/personnel/salaries/nouveau">) {
  await requirePermission("employees.create");
  const sp = await searchParams;
  const defaultType = sp.type === "ephemere" ? "ephemere" : sp.type === "cdd" ? "cdd" : "cdi";
  return (
    <>
      <PageHeader title="Nouveau salarié" description="Créer une fiche salarié (CDI, CDD ou éphémère)." />
      <EmployeeForm action={createEmployeeAction} submitLabel="Créer le salarié" defaultType={defaultType} />
    </>
  );
}
