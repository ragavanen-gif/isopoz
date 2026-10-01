import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";

export type EstimationProject = {
  id: string;
  name: string;
  client_id: string | null;
  plan_path: string | null;
  plan_filename: string | null;
  scale_factor: number | null;
  measurements: Measurement[];
  updated_at: string;
};

export type Measurement = {
  id: string;
  category: string;
  color: string;
  points: { x: number; y: number }[];
  lengthM: number;
  status: "manuel" | "detecte" | "a_verifier" | "confirme";
  prestationId?: string | null;
  note?: string;
};

export type Prestation = {
  id: string;
  name: string;
  family: "hydraulique" | "aeraulique" | "autre";
  network_type: string | null;
  dimension: string | null;
  thickness: string | null;
  material: string | null;
  insulation_class: string | null;
  finish: string | null;
  unit: "ml" | "m2" | "u" | "forfait";
  price_supply_cents: number;
  price_install_cents: number;
  margin_bps: number;
};

export async function listEstimationProjects() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("estimation_projects")
    .select("id, name, plan_filename, scale_factor, updated_at, measurements")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  return (data ?? []) as Pick<EstimationProject, "id" | "name" | "plan_filename" | "scale_factor" | "updated_at" | "measurements">[];
}

export async function getEstimationProject(id: string): Promise<EstimationProject | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("estimation_projects")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return { ...(data as EstimationProject), measurements: (data.measurements as Measurement[]) ?? [] };
}

export async function listPrestations(): Promise<Prestation[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("estimation_prestations")
    .select("*")
    .is("deleted_at", null)
    .order("family")
    .order("name");
  return (data ?? []) as Prestation[];
}
