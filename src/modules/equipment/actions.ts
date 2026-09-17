"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { equipmentSchema, type EquipmentInput } from "./index";
import { toCents } from "@/lib/format";

type Result = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const nn = (v?: string | null) => (v && v !== "" ? v : null);

function parse(formData: FormData) {
  return equipmentSchema.safeParse({
    name: formData.get("name"),
    reference: formData.get("reference"),
    category: formData.get("category"),
    quantity: formData.get("quantity") ?? 1,
    condition: formData.get("condition"),
    location: formData.get("location"),
    status: formData.get("status") ?? "available",
    value: formData.get("value"),
    purchaseDate: formData.get("purchaseDate"),
    notes: formData.get("notes"),
  });
}

function toDb(d: EquipmentInput) {
  return {
    name: d.name.trim(),
    reference: nn(d.reference),
    category: nn(d.category),
    quantity: d.quantity,
    condition: nn(d.condition),
    location: nn(d.location),
    status: d.status,
    value_cents: d.value ? toCents(d.value) : null,
    purchase_date: nn(d.purchaseDate),
    notes: nn(d.notes),
  };
}

export async function createEquipmentAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requirePermission("equipment.create");
  const parsed = parse(formData);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Formulaire invalide.", fieldErrors: fe };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("equipment").insert(toDb(parsed.data)).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Échec." };
  await writeAudit({ userId: user.id, action: "equipment.create", entityType: "equipment", entityId: data.id });
  revalidatePath("/materiel");
  redirect(`/materiel/${data.id}`);
}

export async function updateEquipmentAction(id: string, _prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requirePermission("equipment.edit");
  const parsed = parse(formData);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Formulaire invalide.", fieldErrors: fe };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("equipment").update(toDb(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({ userId: user.id, action: "equipment.update", entityType: "equipment", entityId: id });
  revalidatePath(`/materiel/${id}`);
  redirect(`/materiel/${id}`);
}

export async function deleteEquipmentAction(id: string) {
  const user = await requirePermission("equipment.delete");
  const admin = createAdminClient();
  await admin.from("equipment").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await writeAudit({ userId: user.id, action: "equipment.delete", entityType: "equipment", entityId: id });
  revalidatePath("/materiel");
  redirect("/materiel");
}
