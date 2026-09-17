import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  primary: "bg-primary/10 text-primary",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Badge de statut métier. Mappe les enums de statut vers un libellé FR + une teinte.
 */
const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // request_status
  nouvelle: { label: "Nouvelle", tone: "info" },
  a_traiter: { label: "À traiter", tone: "warning" },
  en_etude: { label: "En étude", tone: "info" },
  devis_a_preparer: { label: "Devis à préparer", tone: "warning" },
  devis_envoye: { label: "Devis envoyé", tone: "primary" },
  devis_accepte: { label: "Devis accepté", tone: "success" },
  refusee: { label: "Refusée", tone: "danger" },
  annulee: { label: "Annulée", tone: "neutral" },
  // quote_status
  brouillon: { label: "Brouillon", tone: "neutral" },
  envoye: { label: "Envoyé", tone: "primary" },
  en_attente: { label: "En attente", tone: "warning" },
  accepte: { label: "Accepté", tone: "success" },
  refuse: { label: "Refusé", tone: "danger" },
  expire: { label: "Expiré", tone: "neutral" },
  annule: { label: "Annulé", tone: "neutral" },
  // project_status
  a_planifier: { label: "À planifier", tone: "warning" },
  planifie: { label: "Planifié", tone: "info" },
  en_preparation: { label: "En préparation", tone: "info" },
  en_cours: { label: "En cours", tone: "primary" },
  suspendu: { label: "Suspendu", tone: "warning" },
  termine: { label: "Terminé", tone: "success" },
  a_facturer: { label: "À facturer", tone: "warning" },
  facture: { label: "Facturé", tone: "info" },
  cloture: { label: "Clôturé", tone: "neutral" },
  // invoice_status
  envoyee: { label: "Envoyée", tone: "primary" },
  partiellement_payee: { label: "Partiellement payée", tone: "warning" },
  payee: { label: "Payée", tone: "success" },
  en_retard: { label: "En retard", tone: "danger" },
  annulee_f: { label: "Annulée", tone: "neutral" },
  // generic
  active: { label: "Actif", tone: "success" },
  disabled: { label: "Désactivé", tone: "neutral" },
  pending: { label: "En attente", tone: "warning" },
  accepted: { label: "Acceptée", tone: "success" },
  refused: { label: "Refusée", tone: "danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
