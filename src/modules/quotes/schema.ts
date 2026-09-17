import { z } from "zod";

export const QUOTE_STATUSES = [
  "brouillon", "envoye", "en_attente", "accepte", "refuse", "expire", "annule",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  en_attente: "En attente",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  annule: "Annulé",
};

/** Transitions autorisées (cf. docs/03). */
export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  brouillon: ["envoye", "annule"],
  envoye: ["en_attente", "accepte", "refuse", "expire", "annule"],
  en_attente: ["accepte", "refuse", "expire", "annule"],
  accepte: [],
  refuse: [],
  expire: ["annule"],
  annule: [],
};

/** Les lignes ne sont éditables que dans ces statuts. */
export const QUOTE_EDITABLE_STATUSES: QuoteStatus[] = ["brouillon", "envoye", "en_attente"];

export const quoteMetaSchema = z.object({
  subject: z.string().max(300).optional().or(z.literal("")),
  issueDate: z.string().optional().or(z.literal("")),
  validUntil: z.string().optional().or(z.literal("")),
  paymentTerms: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});
export type QuoteMetaInput = z.infer<typeof quoteMetaSchema>;

export const quoteItemSchema = z.object({
  kind: z.enum(["prestation", "produit"]),
  label: z.string().min(1).max(300),
  description: z.string().max(2000).optional().default(""),
  qty: z.number().min(0),
  unitPriceCents: z.number().int().min(0),
  discountBps: z.number().int().min(0).max(10000),
  vatBps: z.number().int().min(0).max(10000),
});
export type QuoteItemInput = z.infer<typeof quoteItemSchema>;

export const quoteItemsSchema = z.array(quoteItemSchema).max(200);

export type Quote = {
  id: string;
  reference: string | null;
  client_id: string;
  request_id: string | null;
  project_id: string | null;
  issue_date: string;
  valid_until: string | null;
  subject: string | null;
  status: QuoteStatus;
  payment_terms: string | null;
  notes: string | null;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
};

export type QuoteItem = {
  id: string;
  position: number;
  kind: "prestation" | "produit";
  label: string;
  description: string | null;
  qty: number;
  unit_price_cents: number;
  discount_bps: number;
  vat_bps: number;
  line_total_cents: number;
};

/** Calcul d'aperçu côté client (le serveur reste la source de vérité). */
export function computeLineHT(qty: number, unitPriceCents: number, discountBps: number): number {
  return Math.round(qty * unitPriceCents * (1 - discountBps / 10000));
}
