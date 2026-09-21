import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(limit = 50): Promise<Notification[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, entity_type, entity_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createServerClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

/** Chemin cliquable d'une notification selon l'entité liée. */
export function notificationHref(n: Notification): string | null {
  if (!n.entity_id) return null;
  switch (n.entity_type) {
    case "customer_request": return `/demandes/${n.entity_id}`;
    case "quote": return `/commercial/devis/${n.entity_id}`;
    case "invoice": return `/commercial/factures/${n.entity_id}`;
    case "project": return `/chantiers/${n.entity_id}`;
    case "purchase_order": return `/achats/commandes/${n.entity_id}`;
    default: return null;
  }
}
