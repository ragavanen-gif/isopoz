"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { createAdminClient } from "@/core/supabase/admin";
import { writeAudit } from "@/core/audit/write";
import { toCents } from "@/lib/format";
import { sanitizeFilename } from "@/core/documents/storage";

const nn = (v?: string | null) => (v && v !== "" ? v : null);

// ---- Paramètres du site ----
export async function updateSiteSettingsAction(formData: FormData) {
  const user = await requirePermission("admin.settings");
  const admin = createAdminClient();
  await admin.from("site_settings").update({
    company_name: String(formData.get("company_name") ?? "ISOPoz"),
    tagline: String(formData.get("tagline") ?? ""),
    hero_title: String(formData.get("hero_title") ?? ""),
    hero_subtitle: String(formData.get("hero_subtitle") ?? ""),
    about_title: String(formData.get("about_title") ?? ""),
    about_text: String(formData.get("about_text") ?? ""),
    phone: nn(String(formData.get("phone") ?? "")),
    email: nn(String(formData.get("email") ?? "")),
    address: nn(String(formData.get("address") ?? "")),
    cta_text: String(formData.get("cta_text") ?? ""),
    simulator_enabled: formData.get("simulator_enabled") === "on",
    simulator_title: String(formData.get("simulator_title") ?? ""),
  }).eq("id", true);
  await writeAudit({ userId: user.id, action: "site.settings", entityType: "site", entityId: null });
  revalidatePath("/administration/site");
  revalidatePath("/", "layout");
}

// ---- Avis ----
export async function saveReviewAction(id: string | null, formData: FormData) {
  const user = await requirePermission("admin.settings");
  const admin = createAdminClient();
  const row = {
    author_name: String(formData.get("author_name") ?? "").trim(),
    author_role: nn(String(formData.get("author_role") ?? "")),
    rating: Math.min(5, Math.max(1, Number(formData.get("rating") ?? 5))),
    content: String(formData.get("content") ?? "").trim(),
    published: formData.get("published") === "on",
    position: Number(formData.get("position") ?? 0),
  };
  if (id) await admin.from("reviews").update(row).eq("id", id);
  else await admin.from("reviews").insert(row);
  await writeAudit({ userId: user.id, action: id ? "review.update" : "review.create", entityType: "review", entityId: id });
  revalidatePath("/administration/site/avis");
  revalidatePath("/avis"); revalidatePath("/");
}
export async function deleteReviewAction(id: string) {
  await requirePermission("admin.settings");
  await createAdminClient().from("reviews").delete().eq("id", id);
  revalidatePath("/administration/site/avis"); revalidatePath("/avis"); revalidatePath("/");
}

// ---- Réalisations (avec upload image) ----
export async function saveRealisationAction(id: string | null, _prev: unknown, formData: FormData) {
  const user = await requirePermission("admin.settings");
  const admin = createAdminClient();
  const row: Record<string, unknown> = {
    title: String(formData.get("title") ?? "").trim(),
    description: nn(String(formData.get("description") ?? "")),
    location: nn(String(formData.get("location") ?? "")),
    published: formData.get("published") === "on",
    position: Number(formData.get("position") ?? 0),
  };
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) return { ok: false as const, error: "Image trop lourde (max 8 Mo)." };
    const path = `realisations/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from("site-media").upload(path, buf, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false as const, error: upErr.message };
    row.image_path = path;
  }
  if (id) await admin.from("realisations").update(row).eq("id", id);
  else await admin.from("realisations").insert(row);
  await writeAudit({ userId: user.id, action: id ? "realisation.update" : "realisation.create", entityType: "realisation", entityId: id });
  revalidatePath("/administration/site/realisations");
  revalidatePath("/realisations"); revalidatePath("/");
  return { ok: true as const };
}
export async function deleteRealisationAction(id: string) {
  await requirePermission("admin.settings");
  await createAdminClient().from("realisations").delete().eq("id", id);
  revalidatePath("/administration/site/realisations"); revalidatePath("/realisations");
}

// ---- Services du simulateur ----
export async function saveServiceAction(id: string | null, formData: FormData) {
  const user = await requirePermission("admin.settings");
  const admin = createAdminClient();
  const row = {
    name: String(formData.get("name") ?? "").trim(),
    description: nn(String(formData.get("description") ?? "")),
    unit_label: String(formData.get("unit_label") ?? "m²"),
    unit_price_cents: toCents(String(formData.get("unit_price") ?? "0")),
    active: formData.get("active") === "on",
    position: Number(formData.get("position") ?? 0),
  };
  if (id) await admin.from("simulator_services").update(row).eq("id", id);
  else await admin.from("simulator_services").insert(row);
  await writeAudit({ userId: user.id, action: id ? "service.update" : "service.create", entityType: "simulator_service", entityId: id });
  revalidatePath("/administration/site/simulateur"); revalidatePath("/");
}
export async function deleteServiceAction(id: string) {
  await requirePermission("admin.settings");
  await createAdminClient().from("simulator_services").delete().eq("id", id);
  revalidatePath("/administration/site/simulateur"); revalidatePath("/");
}

// ---- Leads ----
export async function setLeadStatusAction(id: string, status: string) {
  await requirePermission("admin.settings");
  await createAdminClient().from("leads").update({ status }).eq("id", id);
  revalidatePath("/administration/site/leads");
}
