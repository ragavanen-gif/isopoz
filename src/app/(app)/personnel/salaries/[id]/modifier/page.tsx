import { notFound } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { getEmployee } from "@/modules/employees/queries";
import { updateEmployeeAction } from "@/modules/employees/actions";
import { EmployeeForm } from "@/modules/employees/employee-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function EditEmployeePage({ params }: PageProps<"/personnel/salaries/[id]/modifier"> ) {
  await requirePermission("employees.edit");
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();
  return (
    <>
      <PageHeader title="Modifier le salarié" description={`${employee.last_name} ${employee.first_name}`} />
      <EmployeeForm action={updateEmployeeAction.bind(null, id)} employee={employee} submitLabel="Enregistrer" />
    </>
  );
}
