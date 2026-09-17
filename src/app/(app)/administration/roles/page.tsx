import { requirePermission } from "@/core/auth/session";
import { listRoles, listPermissions, getRolePermissionIds } from "@/modules/admin/queries";
import { setRolePermissionsAction } from "@/modules/admin/actions";
import { PERMISSION_MODULES } from "@/core/permissions/catalog";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function RolesPage() {
  await requirePermission("admin.roles");
  const [roles, permissions] = await Promise.all([listRoles(), listPermissions()]);

  // Groupe les permissions par module pour un affichage lisible.
  const byModule = new Map<string, typeof permissions>();
  for (const p of permissions) {
    const arr = byModule.get(p.module) ?? [];
    arr.push(p);
    byModule.set(p.module, arr);
  }

  const rolesWithPerms = await Promise.all(
    roles.map(async (r) => ({ role: r, permIds: await getRolePermissionIds(r.id) })),
  );

  return (
    <>
      <PageHeader
        title="Rôles & permissions"
        description="Attribuez les permissions granulaires à chaque rôle."
      />

      <div className="space-y-6">
        {rolesWithPerms.map(({ role, permIds }) => {
          const save = setRolePermissionsAction.bind(null, role.id);
          return (
            <Card key={role.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {role.name}
                  {role.is_system && <Badge>Système</Badge>}
                </CardTitle>
                {role.description && <CardDescription>{role.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                {role.name === "super_admin" ? (
                  <p className="text-sm text-muted-foreground">
                    Le Super Admin dispose de toutes les permissions (bypass). Rien à configurer.
                  </p>
                ) : (
                  <form action={save} className="space-y-4">
                    {Array.from(byModule.entries()).map(([module, perms]) => (
                      <div key={module}>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {PERMISSION_MODULES[module] ?? module}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                          {perms.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="permIds"
                                value={p.id}
                                defaultChecked={permIds.has(p.id)}
                                className="size-4"
                              />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <Button type="submit">Enregistrer {role.name}</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
