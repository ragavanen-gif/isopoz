import { z } from "zod";

export const EMPLOYEE_TYPES = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "ephemere", label: "Éphémère" },
] as const;

export function employeeTypeLabel(v: string) {
  return EMPLOYEE_TYPES.find((t) => t.value === v)?.label ?? v;
}

export const WORKDAY_STATUS_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  realisee: "Réalisée",
  a_valider: "À valider",
  validee: "Validée",
  comptabilisee: "Comptabilisée",
};

/** Une journée compte dans la rémunération dès qu'elle est validée/comptabilisée. */
export const WORKDAY_PAID_STATUSES = ["validee", "comptabilisee"];

export const employeeSchema = z.object({
  firstName: z.string().min(1, "Prénom requis").max(120),
  lastName: z.string().min(1, "Nom requis").max(120),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  type: z.enum(["cdi", "cdd", "ephemere"]),
  dailyRate: z.string().optional().or(z.literal("")), // euros, pour éphémères
  notes: z.string().max(2000).optional().or(z.literal("")),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  type: "cdi" | "cdd" | "ephemere";
  daily_rate_cents: number | null;
  status: "active" | "inactive";
  notes: string | null;
};

export type Workday = {
  id: string;
  employee_id: string;
  project_id: string | null;
  date: string;
  fraction: number;
  status: string;
};
