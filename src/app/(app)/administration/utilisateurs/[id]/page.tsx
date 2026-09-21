import { notFound } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createClient as createServerClient } from "@/core/supabase/server";
import { listRoles, getUserRoleIds } from "@/modules/admin/queries";
import { setUserRolesAction, setUserStatusAction, setUserEmployeeAction } from "@/modules/admin/actions";
import { listEmployees } from "@/modules/employees/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge, StatusBadge } from "@/components/ui/badge";

export default async function UserDetailPage({ params }: PageProps<"/administration/utilisateurs/[id]">) {
  await requirePermission("admin.users");
  const { id } = await params;

  const supabase = await createServerClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, email, full_name, status, is_super_admin, employee_id")
    .eq("id", id)
    .maybeSingle();
  if (!user) notFound();

  const [roles, userRoleIds, employees] = await Promise.all([listRoles(), getUserRoleIds(id), listEmployees()]);
  const saveRoles = setUserRolesAction.bind(null, id);
  const saveEmployee = setUserEmployeeAction.bind(null, id);
  const nextStatus = user.status === "active" ? "disabled" : "active";
  const toggleStatus = setUserStatusAction.bind(null, id, nextStatus);

  return (
    <>
      <PageHeader
        title={user.full_name ?? user.email}
        description={user.email}
        actions={<StatusBadge status={user.status} />}
      />

      {user.is_super_admin && (
        <p className="mb-6 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          Super Admin — dispose de toutes les permissions (bypass).
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rôles</CardTitle>
            <CardDescription>
              Les rôles définissent les permissions par défaut. La granularité fine par
              utilisateur se gère via les overrides (à venir).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveRoles} className="space-y-3">
              {roles.map((r) => (
                <label key={r.id} className="flex items-start gap-3 rounded-md border border-border p-3">
                  <input
                    type="checkbox"
                    name="roleIds"
                    value={r.id}
                    defaultChecked={userRoleIds.has(r.id)}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    <span className="font-medium">{r.name}</span>
                    {r.is_system && <Badge className="ml-2">Système</Badge>}
                    {r.description && (
                      <span className="block text-sm text-muted-foreground">{r.description}</span>
                    )}
                  </span>
                </label>
              ))}
              <Button type="submit">Enregistrer les rôles</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={toggleStatus}>
              <Button type="submit" variant={user.status === "active" ? "secondary" : "primary"}>
                {user.status === "active" ? "Désactiver le compte" : "Réactiver le compte"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Un compte désactivé ne peut plus se connecter.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Fiche salarié liée</CardTitle>
            <CardDescription>
              Relier ce compte à une fiche salarié active son portail personnel (planning, demandes, fiches de paie).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveEmployee} className="flex flex-wrap items-end gap-2">
              <Select name="employeeId" defaultValue={user.employee_id ?? ""} className="max-w-xs">
                <option value="">Aucune (pas de portail)</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.last_name} {e.first_name}</option>)}
              </Select>
              <Button type="submit">Enregistrer</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
