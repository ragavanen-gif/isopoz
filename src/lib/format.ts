import { format as formatDate } from "date-fns";
import { fr } from "date-fns/locale";

/** Formate des centimes en euros (ex: 128450000 -> "1 284 500,00 €"). */
export function euros(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

/** Convertit une saisie en euros (string/number) vers des centimes entiers. */
export function toCents(value: string | number): number {
  const n = typeof value === "string" ? parseFloat(value.replace(",", ".")) : value;
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** TVA en points de base -> pourcentage lisible (2000 -> "20 %"). */
export function vatLabel(bps: number): string {
  return `${bps / 100} %`;
}

export function dateFr(date: string | Date | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return formatDate(d, pattern, { locale: fr });
}

export function dateTimeFr(date: string | Date | null | undefined): string {
  return dateFr(date, "dd/MM/yyyy HH:mm");
}
