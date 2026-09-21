import { requireAuth, userCan } from "@/core/auth/session";
import { PermissionProvider } from "@/core/permissions/context";
import { getUnreadCount } from "@/core/notifications/queries";
import { NAV, type NavGroup } from "@/components/layout/nav-config";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireAuth();
  const unreadCount = await getUnreadCount();

  // Filtrage du menu selon les permissions effectives (CDC §38 : menu dynamique).
  const groups: NavGroup[] = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || userCan(user, item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <PermissionProvider
      isSuperAdmin={user.isSuperAdmin}
      permissions={Array.from(user.permissions)}
    >
      <div className="flex min-h-screen">
        <Sidebar groups={groups} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar fullName={user.fullName} email={user.email} unreadCount={unreadCount} />
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </PermissionProvider>
  );
}
