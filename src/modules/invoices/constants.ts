// Constantes factures (client/serveur).

export type InvoiceStatus =
  | "brouillon" | "envoyee" | "en_attente" | "partiellement_payee"
  | "payee" | "en_retard" | "annulee";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  en_attente: "En attente",
  partiellement_payee: "Partiellement payée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

/**
 * Statut effectif pour l'affichage et les analyses : dérive « en retard » de
 * l'échéance sans stockage (évite un cron). Le statut « payee » et les états
 * manuels (brouillon/annulée) priment.
 */
export function effectiveStatus(
  base: InvoiceStatus,
  totalCents: number,
  paidCents: number,
  dueDate: string | null,
): InvoiceStatus {
  if (base === "brouillon" || base === "annulee") return base;
  if (totalCents > 0 && paidCents >= totalCents) return "payee";
  const overdue = dueDate ? dueDate < new Date().toISOString().slice(0, 10) : false;
  if (overdue) return "en_retard";
  if (paidCents > 0) return "partiellement_payee";
  return "en_attente";
}
