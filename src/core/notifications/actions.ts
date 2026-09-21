"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/core/auth/session";
import { createClient as createServerClient } from "@/core/supabase/server";

export async function markNotificationReadAction(id: string) {
  await requireAuth();
  const supabase = await createServerClient();
  // RLS : l'utilisateur ne peut mettre à jour que ses propres notifications.
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const user = await requireAuth();
  const supabase = await createServerClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).eq("user_id", user.id);
  revalidatePath("/notifications");
}
