"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { supplierSchema, type SupplierInput } from "./index";

type Result = { ok: true; id: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const nn = (v?: string | null) => (v && v !== "" ? v : null);

function parse(formData: FormData) {
  return supplierSchema.safeParse({
    name: formData.get("name"),
    contact: formData.get("contact"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    siret: formData.get("siret"),
    vatNumber: formData.get("vatNumber"),
    paymentTerms: formData.get("paymentTerms"),
    notes: formData.get("notes"),
  });
}

function toDb(d: SupplierInput) {
  return {
    name: d.name.trim(),
    contact: nn(d.contact),
    email: nn(d.email),
    phone: nn(d.phone),
    address: nn(d.address),
    siret: nn(d.siret),
    vat_number: nn(d.vatNumber),
    payment_terms: nn(d.paymentTerms),
    notes: nn(d.notes),
  };
}

export async function createSupplierAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requirePermission("suppliers.create");
  const parsed = parse(formData);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Formulaire invalide.", fieldErrors: fe };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("suppliers").insert({ ...toDb(parsed.data), created_by: user.id }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Échec." };
  await writeAudit({ userId: user.id, action: "supplier.create", entityType: "supplier", entityId: data.id });
  revalidatePath("/achats/fournisseurs");
  redirect(`/achats/fournisseurs/${data.id}`);
}

export async function updateSupplierAction(id: string, _prev: Result | null, formData: FormData): Promise<Result> {
  const user = await requirePermission("suppliers.edit");
  const parsed = parse(formData);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Formulaire invalide.", fieldErrors: fe };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("suppliers").update(toDb(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await writeAudit({ userId: user.id, action: "supplier.update", entityType: "supplier", entityId: id });
  revalidatePath(`/achats/fournisseurs/${id}`);
  redirect(`/achats/fournisseurs/${id}`);
}

export async function deleteSupplierAction(id: string) {
  const user = await requirePermission("suppliers.delete");
  const admin = createAdminClient();
  await admin.from("suppliers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await writeAudit({ userId: user.id, action: "supplier.delete", entityType: "supplier", entityId: id });
  revalidatePath("/achats/fournisseurs");
  redirect("/achats/fournisseurs");
}
