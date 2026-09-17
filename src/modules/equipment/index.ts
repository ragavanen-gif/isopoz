import "server-only";
import { z } from "zod";
import { createClient as createServerClient } from "@/core/supabase/server";

export const equipmentSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  reference: z.string().max(100).optional().or(z.literal("")),
  category: z.string().max(100).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(0).default(1),
  condition: z.string().max(100).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  status: z.enum(["available", "maintenance", "retired"]).default("available"),
  value: z.string().optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
export type EquipmentInput = z.infer<typeof equipmentSchema>;

export type Equipment = {
  id: string;
  name: string;
  reference: string | null;
  category: string | null;
  quantity: number;
  condition: string | null;
  location: string | null;
  status: "available" | "maintenance" | "retired";
  value_cents: number | null;
  purchase_date: string | null;
  notes: string | null;
};

export const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  maintenance: "En maintenance",
  retired: "Retiré",
};

export async function listEquipment(): Promise<Equipment[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("equipment").select("*").is("deleted_at", null).order("name");
  return (data ?? []) as Equipment[];
}

export async function getEquipment(id: string): Promise<Equipment | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("equipment").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  return (data as Equipment) ?? null;
}
