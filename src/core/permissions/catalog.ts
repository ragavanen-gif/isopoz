/**
 * Miroir TypeScript du catalogue de permissions (aligné sur supabase/seed.sql).
 * Sert au typage (`PermissionKey`) côté app. La source de vérité runtime reste
 * la base (table `permissions` + RLS).
 */
export const PERMISSION_KEYS = [
  "clients.view", "clients.create", "clients.edit", "clients.delete",
  "requests.view", "requests.create", "requests.edit", "requests.delete", "requests.assign",
  "quotes.view", "quotes.create", "quotes.edit", "quotes.delete", "quotes.send", "quotes.validate",
  "projects.view", "projects.create", "projects.edit", "projects.delete",
  "planning.view", "planning.create", "planning.edit", "planning.delete",
  "teams.view", "teams.create", "teams.edit", "teams.delete",
  "employees.view", "employees.create", "employees.edit", "employees.delete",
  "ephemeral.view", "ephemeral.create", "ephemeral.edit", "ephemeral.validate",
  "equipment.view", "equipment.create", "equipment.edit", "equipment.delete",
  "invoices.view", "invoices.create", "invoices.edit", "invoices.delete", "invoices.send", "invoices.mark_paid",
  "payments.view", "payments.create", "payments.edit", "payments.delete",
  "reminders.view", "reminders.create", "reminders.send",
  "suppliers.view", "suppliers.create", "suppliers.edit", "suppliers.delete",
  "orders.view", "orders.create", "orders.edit", "orders.delete",
  "negotiations.view", "negotiations.create", "negotiations.edit",
  "documents.view", "documents.upload", "documents.edit", "documents.delete", "documents.download",
  "templates.view", "templates.create", "templates.edit", "templates.delete",
  "hr.view", "hr.manage",
  "analytics.view",
  "admin.users", "admin.roles", "admin.permissions", "admin.settings", "admin.audit",
  "portal.self",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_MODULES: Record<string, string> = {
  clients: "Clients",
  requests: "Demandes",
  quotes: "Devis",
  projects: "Chantiers",
  planning: "Planning",
  teams: "Équipes",
  employees: "Salariés",
  ephemeral: "Éphémères",
  equipment: "Matériel",
  invoices: "Factures",
  payments: "Paiements",
  reminders: "Relances",
  suppliers: "Fournisseurs",
  orders: "Commandes",
  negotiations: "Négociations",
  documents: "Documents",
  templates: "Modèles",
  hr: "RH",
  analytics: "Analyses",
  admin: "Administration",
  portal: "Portail salarié",
};
