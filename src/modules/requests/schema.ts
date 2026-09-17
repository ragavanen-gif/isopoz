import { z } from "zod";

export const REQUEST_STATUSES = [
  "nouvelle", "a_traiter", "en_etude", "devis_a_preparer",
  "devis_envoye", "devis_accepte", "refusee", "annulee",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const requestSchema = z.object({
  clientId: z.string().uuid("Client requis"),
  subject: z.string().min(1, "Objet requis").max(300),
  description: z.string().max(5000).optional().or(z.literal("")),
  receivedAt: z.string().optional().or(z.literal("")),
  managerId: z.string().uuid().optional().or(z.literal("")),
});
export type RequestInput = z.infer<typeof requestSchema>;

export type CustomerRequest = {
  id: string;
  reference: string | null;
  client_id: string;
  received_at: string;
  subject: string;
  description: string | null;
  manager_id: string | null;
  source: "manual" | "email";
  status: RequestStatus;
};

/** Transitions autorisées côté serveur (machine à états, cf. docs/03). */
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  nouvelle: ["a_traiter", "annulee"],
  a_traiter: ["en_etude", "refusee", "annulee"],
  en_etude: ["devis_a_preparer", "refusee", "annulee"],
  devis_a_preparer: ["devis_envoye", "annulee"],
  devis_envoye: ["devis_accepte", "refusee", "annulee"],
  devis_accepte: [],
  refusee: [],
  annulee: [],
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  nouvelle: "Nouvelle",
  a_traiter: "À traiter",
  en_etude: "En étude",
  devis_a_preparer: "Devis à préparer",
  devis_envoye: "Devis envoyé",
  devis_accepte: "Devis accepté",
  refusee: "Refusée",
  annulee: "Annulée",
};
