# ISOPoz — Roadmap & état d'avancement

Développement incrémental (CDC §42). Chaque phase doit rester compatible avec le workflow central et le système de permissions.

## Phase 0 — Fondations techniques ✅
- [x] Scaffold Next.js 16 + TS + Tailwind v4 + UI primitives
- [x] Clients Supabase (browser/server/admin) + proxy (ex-middleware) auth
- [x] Schéma SQL noyau (users, roles, permissions, RLS helpers)
- [x] Seed permissions + rôles (+ procédure super admin)
- [x] Charte UI (thème, sidebar dynamique, layout)

## Phase 1 — Fondations métier ✅
- [x] Authentification (login, session, logout) — reset mot de passe : à ajouter
- [x] Utilisateurs (création, activation/désactivation, rôles) — admin
- [x] Rôles & permissions (attribution par rôle) — admin. Overrides par utilisateur : socle en base, UI à ajouter
- [x] Clients (CRUD + fiche client + dashboard + soft delete). Contacts : lecture faite, gestion CRUD à ajouter
- [x] Dashboard (KPI de base ; agrégats CA branchés en Phase 4)

## Phase 2 — Workflow commercial ✅ (documents fichiers : partiel)
- [x] Demandes clients (CRUD, statuts/transitions, **conversion en devis** sans ressaisie)
- [x] Devis (lignes éditables, **totaux recalculés serveur** via `recompute_quote_totals`, statuts, envoi, validation, sync statut demande)
- [x] Modèles de documents (versionnés, règle 10) + **moteur de variables `{{...}}`** + aperçu
- [x] Gestion documentaire (Phase 2b) : **upload Supabase Storage** (buckets privés) avec classement automatique Client→Année→Type, **génération PDF de devis** (@react-pdf/renderer), **téléchargement par URL signée** après contrôle serveur. Reste : génération PDF facture (Phase 4), documents RH (Phase 3).

## Phase 3 — Chantiers ✅ (RH/portail : partiel)
- [x] Chantiers : **création depuis un devis accepté** (montant figé), statuts + timeline (`project_events`), **coûts réels + marge/taux** (CDC §20)
- [x] Planning : créneaux par chantier, affectations salariés, **détection de conflits** (fonction SQL `schedule_conflicts`)
- [x] Salariés CDI/CDD + **éphémères** (journées, validation, rémunération = Σ jours validés × tarif) + Équipes (chef + membres)
- [x] Matériel : catalogue CRUD + **réservations avec contrôle de disponibilité** (chevauchements)
- [~] Tables `leave_requests`/`material_requests` + documents RH/fiches de paie créées ; **portail salarié + UI demandes/paie** à faire (Phase 3b)

## Phase 4 — Finance ✅
- [x] Factures : **créées depuis un chantier** (reprend les lignes du devis), statuts, envoi, totaux serveur (`recompute_invoice_totals`)
- [x] Paiements : enregistrement + **statut dérivé** (payée/partielle/en retard via `refresh_invoice_status` + échéance)
- [x] Relances : niveaux 1-3, vue impayés dédiée
- [x] Analyses CA : **CA facturé vs encaissé** (distincts), par mois, par client, restant à encaisser, en retard, **rentabilité chantiers**

## Phase 5 — Achats ✅
- [x] Fournisseurs (CRUD + fiche + commandes liées)
- [x] Commandes fournisseur (lignes, totaux serveur `recompute_po_totals`, statuts, lien chantier)
- [x] Négociations (historique fournisseur/ISOPoz + **prix final + économie** calculée)
- [~] Produits / réceptions : tables `products`/`goods_receipts` créées ; catalogue & bons de réception dédiés à ajouter au besoin

## Site vitrine public + simulateur ✅ (migration 0009)
- [x] Charte **couleurs du logo ISOPOZ** (marine `#22304C`, orange `#E8641C`, gris ardoise) + logo dans en-tête site / login
- [x] Pages publiques (route group `(site)`, sans auth) : Accueil, Nos réalisations, Avis clients, À propos, Contact
- [x] **Simulateur d'estimation configurable** depuis l'admin (prestations + tarifs) → génère un lead
- [x] Formulaire de contact → lead + notification
- [x] Gestion depuis l'admin (`admin.settings`) : contenu du site, avis, réalisations (upload photo, bucket public `site-media`), prestations du simulateur, demandes reçues (leads)

## Phase 6 — Automatisation (partiel)
- [x] **Notifications in-app** : cloche + compteur non-lus (Topbar), page `/notifications`, ciblage par permission (`users_with_permission`), création auto sur nouvelle demande & devis accepté
- [x] **Cron quotidien** (Vercel, `/api/cron/daily`, sécurisé par `CRON_SECRET`) : expire les devis périmés + alerte impayés (relances)
- [x] Rapports : couverts par le module Analyses (Phase 4)
- [x] **Envoi d'emails (Phase 6b)** via SMTP Hostinger (`nodemailer`) : devis (PDF joint), facture (PDF joint), relance — boutons sur les fiches. PDF facture généré (`invoice-pdf.tsx`).
- [ ] Connexion email → demandes entrantes (nécessite un service d'email entrant / webhook — Phase 6c)

---
_État au 2026-09-21 : **Phases 0 à 6 livrées** (Phase 6 : notifications + cron ; emails Resend et email→demande restent en 6b), en PRODUCTION sur https://isopoz.fr. Build Turbopack OK, typecheck OK. Reste : Phase 6b (emails Resend, email entrant→demandes, PDF facture auto) et Phase 3b (portail salarié + paie/RH). Migrations à jour dans `supabase/deploy_all.sql` (0001-0007)._
