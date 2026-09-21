import Link from "next/link";
import { requireAuth } from "@/core/auth/session";
import { listNotifications, notificationHref } from "@/core/notifications/queries";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/core/notifications/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { dateTimeFr } from "@/lib/format";

export default async function NotificationsPage() {
  await requireAuth();
  const notifications = await listNotifications();
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`${notifications.filter((n) => !n.read_at).length} non lue(s)`}
        actions={hasUnread && (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="secondary" size="sm">Tout marquer comme lu</Button>
          </form>
        )}
      />
      {notifications.length === 0 ? (
        <EmptyState message="Aucune notification." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const href = notificationHref(n);
            const content = (
              <Card className={`p-4 ${!n.read_at ? "border-l-4 border-l-primary" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{dateTimeFr(n.created_at)}</p>
                  </div>
                  {!n.read_at && (
                    <form action={markNotificationReadAction.bind(null, n.id)}>
                      <Button type="submit" variant="ghost" size="sm">Marquer lu</Button>
                    </form>
                  )}
                </div>
              </Card>
            );
            return href ? (
              <Link key={n.id} href={href} className="block">{content}</Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
