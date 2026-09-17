// Constantes chantiers (client/serveur).

export type ProjectStatus =
  | "a_planifier" | "planifie" | "en_preparation" | "en_cours" | "suspendu"
  | "termine" | "a_facturer" | "facture" | "cloture" | "annule";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  a_planifier: "À planifier",
  planifie: "Planifié",
  en_preparation: "En préparation",
  en_cours: "En cours",
  suspendu: "Suspendu",
  termine: "Terminé",
  a_facturer: "À facturer",
  facture: "Facturé",
  cloture: "Clôturé",
  annule: "Annulé",
};

export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  a_planifier: ["planifie", "annule"],
  planifie: ["en_preparation", "annule"],
  en_preparation: ["en_cours", "annule"],
  en_cours: ["suspendu", "termine"],
  suspendu: ["en_cours", "annule"],
  termine: ["a_facturer"],
  a_facturer: ["facture"],
  facture: ["cloture"],
  cloture: [],
  annule: [],
};

export const COST_CATEGORIES = [
  { value: "labor", label: "Main-d'œuvre" },
  { value: "equipment", label: "Matériel" },
  { value: "goods", label: "Marchandises" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Autres" },
] as const;

export function costCategoryLabel(v: string) {
  return COST_CATEGORIES.find((c) => c.value === v)?.label ?? v;
}
