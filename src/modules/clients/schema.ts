import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(200),
  type: z.enum(["pro", "particulier"]).default("pro"),
  address: z.string().max(300).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  country: z.string().max(120).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  website: z.string().max(200).optional().or(z.literal("")),
  siret: z.string().max(20).optional().or(z.literal("")),
  vatNumber: z.string().max(30).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export type ClientInput = z.infer<typeof clientSchema>;

export type Client = {
  id: string;
  reference: string | null;
  name: string;
  type: "pro" | "particulier";
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  siret: string | null;
  vat_number: string | null;
  notes: string | null;
  created_at: string;
};

/** Normalise les champs vides en null pour la base. */
export function toDbClient(input: ClientInput) {
  const nn = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
  return {
    name: input.name.trim(),
    type: input.type,
    address: nn(input.address),
    postal_code: nn(input.postalCode),
    city: nn(input.city),
    country: nn(input.country) ?? "France",
    phone: nn(input.phone),
    email: nn(input.email),
    website: nn(input.website),
    siret: nn(input.siret),
    vat_number: nn(input.vatNumber),
    notes: nn(input.notes),
  };
}
