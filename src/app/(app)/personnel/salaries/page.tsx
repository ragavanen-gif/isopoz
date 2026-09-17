import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission, getSessionUser, userCan } from "@/core/auth/session";
import { listEmployees } from "@/modules/employees/queries";
import { employeeTypeLabel } from "@/modules/employees/schema";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";

export default async function SalariesPage() {
  await requirePermission("employees.view");
  const user = await getSessionUser();
  const employees = await listEmployees();
  const canCreate = user ? userCan(user, "employees.create") : false;

  return (
    <>
      <PageHeader
        title="Salariés"
        description={`${employees.length} salarié(s)`}
        actions={canCreate && (
          <Link href="/personnel/salaries/nouveau"><Button><Plus /> Nouveau salarié</Button></Link>
        )}
      />
      {employees.length === 0 ? (
        <EmptyState message="Aucun salarié." />
      ) : (
        <Table>
          <THead><TR><TH>Nom</TH><TH>Type</TH><TH>Email</TH><TH>Téléphone</TH><TH>Statut</TH></TR></THead>
          <TBody>
            {employees.map((e) => (
              <TR key={e.id}>
                <TD>
                  <Link href={`/personnel/salaries/${e.id}`} className="font-medium text-primary hover:underline">
                    {e.last_name.toUpperCase()} {e.first_name}
                  </Link>
                </TD>
                <TD><Badge tone={e.type === "ephemere" ? "warning" : "info"}>{employeeTypeLabel(e.type)}</Badge></TD>
                <TD>{e.email ?? "—"}</TD>
                <TD>{e.phone ?? "—"}</TD>
                <TD><StatusBadge status={e.status} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
