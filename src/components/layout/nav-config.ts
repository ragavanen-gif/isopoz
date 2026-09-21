import type { PermissionKey } from "@/core/permissions/catalog";

export type NavItem = {
  label: string;
  href: string;
  /** Permission requise pour afficher l'item (absente = toujours visible si authentifié). */
  permission?: PermissionKey;
};

export type NavGroup = {
  label: string;
  icon: string; // nom d'icône lucide (résolu côté composant)
  items: NavItem[];
};

/**
 * Arbre de navigation (CDC §39). Le rendu filtre selon les permissions effectives :
 * un groupe sans item visible est masqué. Un salarié ne voit que le portail.
 */
export const NAV: NavGroup[] = [
  {
    label: "Tableau de bord",
    icon: "LayoutDashboard",
    items: [{ label: "Dashboard", href: "/dashboard" }],
  },
  {
    label: "Mon espace",
    icon: "UserCircle",
    items: [
      { label: "Accueil", href: "/portail", permission: "portal.self" },
      { label: "Mes demandes", href: "/portail/demandes", permission: "portal.self" },
      { label: "Mes fiches de paie", href: "/portail/paie", permission: "portal.self" },
    ],
  },
  {
    label: "Clients",
    icon: "Users",
    items: [
      { label: "Clients", href: "/clients", permission: "clients.view" },
      { label: "Demandes", href: "/demandes", permission: "requests.view" },
    ],
  },
  {
    label: "Commercial",
    icon: "FileText",
    items: [
      { label: "Devis", href: "/commercial/devis", permission: "quotes.view" },
      { label: "Factures", href: "/commercial/factures", permission: "invoices.view" },
      { label: "Paiements", href: "/commercial/paiements", permission: "payments.view" },
      { label: "Relances", href: "/commercial/relances", permission: "reminders.view" },
    ],
  },
  {
    label: "Chantiers",
    icon: "HardHat",
    items: [{ label: "Chantiers", href: "/chantiers", permission: "projects.view" }],
  },
  {
    label: "Planning",
    icon: "Calendar",
    items: [{ label: "Planning", href: "/planning", permission: "planning.view" }],
  },
  {
    label: "Personnel",
    icon: "UserCog",
    items: [
      { label: "Salariés", href: "/personnel/salaries", permission: "employees.view" },
      { label: "Éphémères", href: "/personnel/ephemeres", permission: "ephemeral.view" },
      { label: "Équipes", href: "/personnel/equipes", permission: "teams.view" },
    ],
  },
  {
    label: "Matériel",
    icon: "Wrench",
    items: [{ label: "Matériel", href: "/materiel", permission: "equipment.view" }],
  },
  {
    label: "Achats",
    icon: "Package",
    items: [
      { label: "Fournisseurs", href: "/achats/fournisseurs", permission: "suppliers.view" },
      { label: "Commandes", href: "/achats/commandes", permission: "orders.view" },
    ],
  },
  {
    label: "Documents",
    icon: "FolderOpen",
    items: [
      { label: "Documents", href: "/documents", permission: "documents.view" },
      { label: "Modèles", href: "/documents/modeles", permission: "templates.view" },
    ],
  },
  {
    label: "Analyse",
    icon: "BarChart3",
    items: [{ label: "Chiffre d'affaires", href: "/analyse", permission: "analytics.view" }],
  },
  {
    label: "Administration",
    icon: "Settings",
    items: [
      { label: "Utilisateurs", href: "/administration/utilisateurs", permission: "admin.users" },
      { label: "Rôles", href: "/administration/roles", permission: "admin.roles" },
      { label: "Site internet", href: "/administration/site", permission: "admin.settings" },
      { label: "Journal d'activité", href: "/administration/journal", permission: "admin.audit" },
      { label: "Paramètres", href: "/administration/parametres", permission: "admin.settings" },
    ],
  },
];
