export type PoStatus = "brouillon" | "envoyee" | "negociation" | "recue" | "annulee";

export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  negociation: "En négociation",
  recue: "Reçue",
  annulee: "Annulée",
};

export const PO_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  brouillon: ["envoyee", "annulee"],
  envoyee: ["negociation", "recue", "annulee"],
  negociation: ["recue", "annulee"],
  recue: [],
  annulee: [],
};

export const PO_EDITABLE_STATUSES: PoStatus[] = ["brouillon", "envoyee", "negociation"];

export function poStatusTone(s: string): "neutral" | "primary" | "warning" | "success" | "danger" {
  return s === "recue" ? "success" : s === "annulee" ? "neutral" : s === "negociation" ? "warning" : s === "envoyee" ? "primary" : "neutral";
}
