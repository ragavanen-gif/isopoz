"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { toCents } from "@/lib/format";
import { sanitizeFilename } from "@/core/documents/storage";

const nn = (v?: string | null) => (v && v !== "" ? v : null);
type R = { ok: true; id?: string } | { ok: false; error: string };

/** Crée un projet de métré en important un plan PDF. */
export async function createEstimationProjectAction(_prev: R | null, formData: FormData): Promise<R> {
  const user = await requirePermission("tools.manage");
  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("plan");
  if (!name) return { ok: false, error: "Nom du projet requis." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Plan PDF requis." };
  if (file.type !== "application/pdf") return { ok: false, error: "Le plan doit être un PDF." };
  if (file.size > 40 * 1024 * 1024) return { ok: false, error: "PDF trop volumineux (max 40 Mo)." };

  const admin = createAdminClient();
  const path = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("plans").upload(path, buf, { contentType: "application/pdf", upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const { data, error } = await admin
    .from("estimation_projects")
    .insert({ name, plan_path: path, plan_filename: file.name, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Échec." };

  await writeAudit({ userId: user.id, action: "estimation.create", entityType: "estimation_project", entityId: data.id });
  revalidatePath("/outils/chiffrage");
  redirect(`/outils/chiffrage/${data.id}`);
}

/** Enregistre les mesures + l'échelle d'un projet (appelé par l'éditeur). */
export async function saveEstimationAction(projectId: string, scaleFactor: number | null, measurementsJson: string): Promise<R> {
  const user = await requirePermission("tools.manage");
  let measurements: unknown;
  try { measurements = JSON.parse(measurementsJson); } catch { return { ok: false, error: "Données invalides." }; }
  if (!Array.isArray(measurements)) return { ok: false, error: "Format invalide." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("estimation_projects")
    .update({ scale_factor: scaleFactor, measurements })
    .eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  await writeAudit({ userId: user.id, action: "estimation.save", entityType: "estimation_project", entityId: projectId });
  revalidatePath(`/outils/chiffrage/${projectId}`);
  return { ok: true };
}

export async function deleteEstimationProjectAction(id: string) {
  const user = await requirePermission("tools.manage");
  const admin = createAdminClient();
  await admin.from("estimation_projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await writeAudit({ userId: user.id, action: "estimation.delete", entityType: "estimation_project", entityId: id });
  revalidatePath("/outils/chiffrage");
  redirect("/outils/chiffrage");
}

// ---- Bibliothèque de prestations ----
const prestationSchema = z.object({
  name: z.string().min(1).max(200),
  family: z.enum(["hydraulique", "aeraulique", "autre"]),
  networkType: z.string().max(120).optional().or(z.literal("")),
  dimension: z.string().max(60).optional().or(z.literal("")),
  thickness: z.string().max(60).optional().or(z.literal("")),
  material: z.string().max(120).optional().or(z.literal("")),
  insulationClass: z.string().max(60).optional().or(z.literal("")),
  finish: z.string().max(120).optional().or(z.literal("")),
  unit: z.enum(["ml", "m2", "u", "forfait"]),
  priceSupply: z.string().optional().or(z.literal("")),
  priceInstall: z.string().optional().or(z.literal("")),
  margin: z.string().optional().or(z.literal("")),
});

export async function savePrestationAction(id: string | null, formData: FormData): Promise<void> {
  const user = await requirePermission("tools.manage");
  const parsed = prestationSchema.safeParse({
    name: formData.get("name"), family: formData.get("family"), networkType: formData.get("networkType"),
    dimension: formData.get("dimension"), thickness: formData.get("thickness"), material: formData.get("material"),
    insulationClass: formData.get("insulationClass"), finish: formData.get("finish"), unit: formData.get("unit"),
    priceSupply: formData.get("priceSupply"), priceInstall: formData.get("priceInstall"), margin: formData.get("margin"),
  });
  if (!parsed.success) return;
  const d = parsed.data;
  const row = {
    name: d.name.trim(), family: d.family, network_type: nn(d.networkType), dimension: nn(d.dimension),
    thickness: nn(d.thickness), material: nn(d.material), insulation_class: nn(d.insulationClass), finish: nn(d.finish),
    unit: d.unit, price_supply_cents: d.priceSupply ? toCents(d.priceSupply) : 0,
    price_install_cents: d.priceInstall ? toCents(d.priceInstall) : 0,
    margin_bps: d.margin ? Math.round(parseFloat(d.margin.replace(",", ".")) * 100) : 0,
  };
  const admin = createAdminClient();
  if (id) await admin.from("estimation_prestations").update(row).eq("id", id);
  else await admin.from("estimation_prestations").insert({ ...row, created_by: user.id });
  await writeAudit({ userId: user.id, action: id ? "prestation.update" : "prestation.create", entityType: "estimation_prestation", entityId: id });
  revalidatePath("/outils/chiffrage/prestations");
}

export async function deletePrestationAction(id: string) {
  await requirePermission("tools.manage");
  await createAdminClient().from("estimation_prestations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/outils/chiffrage/prestations");
}
