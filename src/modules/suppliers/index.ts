import "server-only";
import { z } from "zod";
import { createClient as createServerClient } from "@/core/supabase/server";

export const supplierSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  contact: z.string().max(120).optional().or(z.literal("")),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  siret: z.string().max(20).optional().or(z.literal("")),
  vatNumber: z.string().max(30).optional().or(z.literal("")),
  paymentTerms: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  siret: string | null;
  vat_number: string | null;
  payment_terms: string | null;
  notes: string | null;
};

export async function listSuppliers(): Promise<Supplier[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("suppliers").select("*").is("deleted_at", null).order("name");
  return (data ?? []) as Supplier[];
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("suppliers").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  return (data as Supplier) ?? null;
}
