import Link from "next/link";
import { requirePermission } from "@/core/auth/session";
import { listUsers } from "@/modules/admin/queries";
import { CreateUserForm } from "@/modules/admin/create-user-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";

export default async function UsersPage() {
  await requirePermission("admin.users");
  const users = await listUsers();

  return (
    <>
      <PageHeader title="Utilisateurs" description={`${users.length} utilisateur(s)`} />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Nouvel utilisateur</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      <Table>
        <THead>
          <TR>
            <TH>Nom</TH>
            <TH>Email</TH>
            <TH>Rôles</TH>
            <TH>Statut</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {users.map((u) => (
            <TR key={u.id}>
              <TD className="font-medium">
                {u.full_name ?? "—"}
                {u.is_super_admin && <Badge tone="primary" className="ml-2">Super Admin</Badge>}
              </TD>
              <TD>{u.email}</TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  {u.roles.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    u.roles.map((r) => <Badge key={r.id}>{r.name}</Badge>)
                  )}
                </div>
              </TD>
              <TD>
                <StatusBadge status={u.status} />
              </TD>
              <TD className="text-right">
                <Link
                  href={`/administration/utilisateurs/${u.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  Gérer
                </Link>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </>
  );
}
