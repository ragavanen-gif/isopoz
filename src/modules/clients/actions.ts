"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { clientSchema, toDbClient } from "./schema";

type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function parseForm(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") ?? "pro",
    address: formData.get("address"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
    country: formData.get("country"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    website: formData.get("website"),
    siret: formData.get("siret"),
    vatNumber: formData.get("vatNumber"),
    notes: formData.get("notes"),
  });
}

function zodFieldErrors(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createClientAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("clients.create");
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Formulaire invalide.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const admin = createAdminClient();
  const year = new Date().getFullYear();
  const { data: reference } = await admin.rpc("next_reference", {
    p_scope: "client",
    p_prefix: "CLI",
    p_year: year,
  });

  const { data, error } = await admin
    .from("clients")
    .insert({ ...toDbClient(parsed.data), reference, created_by: user.id })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Échec de création." };

  await writeAudit({
    userId: user.id,
    action: "client.create",
    entityType: "client",
    entityId: data.id,
    after: parsed.data,
  });

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(
  clientId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePermission("clients.edit");
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { ok: false, error: "Formulaire invalide.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const admin = createAdminClient();
  const { data: before } = await admin.from("clients").select("*").eq("id", clientId).single();

  const { error } = await admin.from("clients").update(toDbClient(parsed.data)).eq("id", clientId);
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    userId: user.id,
    action: "client.update",
    entityType: "client",
    entityId: clientId,
    before,
    after: parsed.data,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function deleteClientAction(clientId: string): Promise<void> {
  const user = await requirePermission("clients.delete");
  const admin = createAdminClient();
  // Soft delete (jamais de suppression physique côté app).
  await admin.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", clientId);
  await writeAudit({
    userId: user.id,
    action: "client.delete",
    entityType: "client",
    entityId: clientId,
  });
  revalidatePath("/clients");
  redirect("/clients");
}
