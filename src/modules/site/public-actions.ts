"use server";

import { z } from "zod";
import { createAdminClient } from "@/core/supabase/admin";
import { notifyByPermission } from "@/core/notifications/create";

type Result = { ok: true } | { ok: false; error: string };

const contactSchema = z.object({
  name: z.string().min(1, "Nom requis").max(160),
  email: z.string().email("Email invalide"),
  phone: z.string().max(40).optional().or(z.literal("")),
  message: z.string().min(1, "Message requis").max(4000),
});

/** Formulaire de contact public → crée un lead + notifie les gestionnaires. */
export async function submitContactAction(_prev: Result | null, formData: FormData): Promise<Result> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"), email: formData.get("email"),
    phone: formData.get("phone"), message: formData.get("message"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  const admin = createAdminClient();
  const { error } = await admin.from("leads").insert({
    source: "contact", name: parsed.data.name, email: parsed.data.email,
    phone: parsed.data.phone || null, message: parsed.data.message,
  });
  if (error) return { ok: false, error: "Une erreur est survenue. Réessayez." };

  await notifyByPermission("admin.settings", {
    type: "lead.contact", title: "🔔 Nouveau message de contact",
    body: `${parsed.data.name} — ${parsed.data.email}`,
  });
  return { ok: true };
}

const simulatorSchema = z.object({
  name: z.string().min(1).max(160),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal("")),
  estimateCents: z.number().int().min(0),
  lines: z.array(z.object({ service: z.string(), qty: z.number(), amountCents: z.number() })),
});

/** Soumission du simulateur → lead avec l'estimation. */
export async function submitSimulatorAction(payloadJson: string): Promise<Result> {
  let raw: unknown;
  try { raw = JSON.parse(payloadJson); } catch { return { ok: false, error: "Données invalides." }; }
  const parsed = simulatorSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Veuillez renseigner votre nom et un email valide." };

  const admin = createAdminClient();
  const { error } = await admin.from("leads").insert({
    source: "simulator", name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone || null,
    estimate_cents: parsed.data.estimateCents,
    simulator_data: { lines: parsed.data.lines },
    message: `Estimation simulateur : ${(parsed.data.estimateCents / 100).toFixed(2)} €`,
  });
  if (error) return { ok: false, error: "Une erreur est survenue. Réessayez." };

  await notifyByPermission("admin.settings", {
    type: "lead.simulator", title: "🔔 Nouvelle demande via le simulateur",
    body: `${parsed.data.name} — estimation ${(parsed.data.estimateCents / 100).toFixed(2)} €`,
  });
  return { ok: true };
}
