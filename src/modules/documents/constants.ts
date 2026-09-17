// Constantes partagées client/serveur (pas de server-only ici).

export const DOC_TYPES = [
  { value: "devis", label: "Devis" },
  { value: "facture", label: "Facture" },
  { value: "contrat", label: "Contrat" },
  { value: "bon_commande", label: "Bon de commande" },
  { value: "bon_livraison", label: "Bon de livraison" },
  { value: "courrier", label: "Courrier" },
  { value: "relance", label: "Relance" },
] as const;

export function docTypeLabel(v: string): string {
  return DOC_TYPES.find((d) => d.value === v)?.label ?? v;
}
