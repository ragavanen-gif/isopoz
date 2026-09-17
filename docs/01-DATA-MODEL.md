# ISOPoz — Modèle de données (points 2 & 3)

Base **PostgreSQL**. Conventions :
- Clés primaires `uuid` (`gen_random_uuid()`).
- `created_at`, `updated_at` (`timestamptz`) sur toutes les tables ; `created_by` (FK users) sur les tables métier.
- Montants stockés en **centimes (`bigint`)** pour éviter les erreurs de flottant ; TVA en points de base (`integer`, ex. 2000 = 20 %).
- Statuts via **enums Postgres** (voir `03-WORKFLOWS.md`).
- Numéros métier (DEV-2026-087, FAC-2026-103, CH-2026-042…) : colonne `reference` unique, générée par séquence annuelle (voir §Numérotation).
- Suppressions : **soft delete** (`deleted_at`) sur les entités importantes ; jamais de hard delete côté app (règle sécurité).

## 1. Relation centrale

```
clients
  └─< customer_requests (demande)
        └─< quotes (devis)  ──1:1 possible──> projects (chantier)
              └─< quote_items
projects (chantier)
  ├─< project_employees        (affectations salariés)
  ├─< project_equipment        (réservations matériel)
  ├─< project_costs            (coûts réels)
  ├─< project_events           (historique/timeline)
  ├─< schedules ─< schedule_assignments
  └─< invoices (facture)
        ├─< invoice_items
        ├─< payments (paiement)
        └─< reminders (relance)
```
Toute donnée « qui concerne un client » porte, directement ou par transitivité, un `client_id` (règle 1).

## 2. Noyau — utilisateurs, rôles, permissions

| Table | Colonnes clés | Notes |
|---|---|---|
| `users` | id, email, full_name, phone, status(active/disabled), is_super_admin, employee_id? | Lié à `auth.users` de Supabase (id partagé). |
| `roles` | id, name, description, is_system | Ex. super_admin, gestionnaire, salarie, ephemere. |
| `permissions` | id, key (`clients.create`…), module, label | Catalogue figé en seed (voir `02`). |
| `role_permissions` | role_id, permission_id | Permissions par rôle. |
| `user_roles` | user_id, role_id | Un user peut cumuler des rôles. |
| `user_permissions` | user_id, permission_id, granted(bool) | Override individuel (grant/deny) — permet la granularité par utilisateur exigée. |

Permission effective = (permissions des rôles) ∪ (overrides `granted=true`) − (overrides `granted=false`). Super admin bypass tout.

## 3. Clients

| Table | Colonnes clés |
|---|---|
| `clients` | id, reference, name (raison sociale), type(particulier/pro), address, postal_code, city, country, phone, email, website, siret, vat_number, notes |
| `client_contacts` | id, client_id, name, role, email, phone, is_primary |

Le **dashboard client** (CA total, CA année, CA mois, factures en attente/retard, nb chantiers/devis) est calculé par des **vues SQL agrégées**, pas stocké (évite la désynchro).

## 4. Demandes & Devis

| Table | Colonnes clés |
|---|---|
| `customer_requests` | id, reference, client_id, received_at, subject, description, manager_id (FK users), status(enum), source(manual/email) |
| `request_attachments` | id, request_id, document_id | Pièces jointes (→ documents). |
| `quotes` | id, reference, client_id, request_id?, project_id?, issue_date, valid_until, subject, status(enum), payment_terms, notes, subtotal_cents, vat_cents, total_cents |
| `quote_items` | id, quote_id, position, kind(prestation/produit), label, description, qty, unit_price_cents, discount_bps, vat_bps, line_total_cents |

Totaux recalculés serveur à chaque modification (jamais confiance au client).

## 5. Chantiers

| Table | Colonnes clés |
|---|---|
| `projects` | id, reference, client_id, quote_id (règle 5 : réf. devis conservée), address, start_date, end_date_planned, end_date_actual, manager_id, team_lead_id?, status(enum), description, quote_total_cents (figé) |
| `project_employees` | id, project_id, employee_id, role_on_site | Affectations. |
| `project_equipment` | id, project_id, equipment_id, qty, reserved_from, reserved_to, status | Réservations. |
| `project_costs` | id, project_id, category(labor/equipment/goods/transport/other), label, amount_cents, incurred_at | Coûts réels → marge. |
| `project_events` | id, project_id, at, type, message, user_id | Timeline (créé/équipe affectée/démarré/terminé…). |

**Marge chantier** = `quote_total_cents − Σ project_costs` (vue SQL). Taux = marge / devis.

## 6. Planning & Équipes

| Table | Colonnes clés |
|---|---|
| `teams` | id, name, team_lead_id |
| `team_members` | team_id, employee_id |
| `schedules` | id, project_id, date, start_time, end_time, notes |
| `schedule_assignments` | id, schedule_id, employee_id, equipment_id? | Affectation d'un salarié/matériel à un créneau. |

**Détection de conflits** : contrainte + requête serveur qui vérifie qu'un `employee_id` n'a pas deux `schedule_assignments` sur des créneaux qui se chevauchent le même jour (idem matériel via `project_equipment`/quantités). Renvoie un avertissement bloquant/non bloquant selon paramètre.

## 7. Personnel & RH

| Table | Colonnes clés |
|---|---|
| `employees` | id, user_id?, first_name, last_name, email, phone, type(cdi/cdd/ephemere), daily_rate_cents (éphémères), status |
| `employee_contracts` | id, employee_id, type, start_date, end_date?, document_id |
| `employee_documents` | id, employee_id, year, doc_type, document_id | RH — accès très restreint. |
| `payslips` | id, employee_id, year, month, document_id, net_cents | Un salarié ne voit QUE les siens (RLS). |
| `ephemeral_workdays` | id, employee_id, project_id?, date, fraction(0.5/1.0), status(enum), validated_by | Journées éphémères → rémunération = Σ fraction validée × daily_rate. |
| `leave_requests` | id, employee_id, kind(repos/absence), date_from, date_to, reason, status(pending/accepted/refused), decided_by |
| `material_requests` | id, employee_id, project_id?, label, qty, status, decided_by |

## 8. Facturation, paiements, relances

| Table | Colonnes clés |
|---|---|
| `invoices` | id, reference, client_id, quote_id?, project_id?, issue_date, due_date, status(enum), payment_terms, subtotal_cents, vat_cents, total_cents |
| `invoice_items` | id, invoice_id, position, label, qty, unit_price_cents, vat_bps, line_total_cents |
| `payments` | id, invoice_id, paid_at, amount_cents, method, reference | Total payé, restant, statut recalculés. |
| `reminders` | id, invoice_id, level(1/2/3), sent_at, template_id?, channel | Relances. |

Statut facture dérivé : `total_payé` vs `total_cents` + `due_date` (payée / partielle / retard). **CA facturé** = Σ invoices (hors annulées) ; **CA encaissé** = Σ payments. Jamais confondus (principe 4).

## 9. Achats & fournisseurs

| Table | Colonnes clés |
|---|---|
| `suppliers` | id, name, contact, email, phone, address, siret, vat_number, payment_terms, notes |
| `products` | id, supplier_id?, name, reference, unit, last_price_cents | Catalogue marchandises. |
| `purchase_orders` | id, reference, supplier_id, project_id?, status, initial_total_cents, negotiated_total_cents |
| `purchase_order_items` | id, po_id, product_id?, label, qty, unit_price_cents, line_total_cents |
| `negotiations` | id, po_id, at, party(supplier/isopoz), amount_cents, note | Historique. Économie = initial − final. |
| `goods_receipts` | id, po_id, received_at, notes | Réceptions. |

## 10. Matériel

| Table | Colonnes clés |
|---|---|
| `equipment` | id, name, reference, category, quantity, condition, location, purchase_date, value_cents, notes |
| (réservations) | via `project_equipment` (§5) | Disponibilité = quantité − Σ réservations chevauchantes. |

## 11. Documents & modèles

| Table | Colonnes clés |
|---|---|
| `documents` | id, client_id?, employee_id?, year, doc_type, ref_date, reference?, name, storage_path, amount_cents?, status, created_by | Classement auto Client→Année→Type ou Salarié→Année→Type. |
| `document_templates` | id, name, doc_type, scope(company/personal), owner_id?, current_version_id | Modèles réutilisables. |
| `document_template_versions` | id, template_id, version, body (avec `{{variables}}`), created_by | Versionné : un doc généré fige la version utilisée (règle 10). |

`documents.client_id` XOR `employee_id` selon le domaine (client vs RH). Storage : buckets séparés `client-docs` / `hr-docs` (voir `05`).

## 12. Transverse

| Table | Colonnes clés |
|---|---|
| `notifications` | id, user_id, type, title, body, entity_type, entity_id, read_at | Respecte les permissions du destinataire. |
| `audit_log` | id, user_id, action, entity_type, entity_id, before(jsonb)?, after(jsonb)?, at | Traçabilité (règle 11). |
| `company_settings` | id (singleton), name, logo_path, address, siret, vat_number, default_vat_bps, quote_prefix, invoice_prefix… | Paramètres entreprise. |
| `number_sequences` | scope(quote/invoice/project/request/po), year, last_value | Numérotation atomique. |

## Numérotation (references)

Fonction SQL `next_reference(scope, year)` en transaction : incrémente `number_sequences.last_value` et renvoie `PREFIX-YYYY-NNN`. Garantit l'unicité et l'absence de trous concurrents.

## Enums (statuts) — voir `03-WORKFLOWS.md` pour les transitions
- `request_status` : nouvelle, a_traiter, en_etude, devis_a_preparer, devis_envoye, devis_accepte, refusee, annulee
- `quote_status` : brouillon, envoye, en_attente, accepte, refuse, expire, annule
- `project_status` : a_planifier, planifie, en_preparation, en_cours, suspendu, termine, a_facturer, facture, cloture, annule
- `invoice_status` : brouillon, envoyee, en_attente, partiellement_payee, payee, en_retard, annulee
- `workday_status` : planifiee, realisee, a_valider, validee, comptabilisee
- `leave_status` / `request_generic_status` : pending, accepted, refused
