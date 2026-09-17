# ISOPoz — Architecture technique

> ERP métier interne. Cycle central : **Client → Demande → Devis → Chantier → Planning → Équipe/Matériel → Facture → Paiement → Analyse → Archivage**.
> Ce document répond aux 12 points de la section 44 du cahier des charges. À lire avant de coder.

## Sommaire de la documentation

| Fichier | Contenu |
|---|---|
| `00-ARCHITECTURE.md` | Vue d'ensemble, stack, principes, structure front/back (points 1, 10, 11) |
| `01-DATA-MODEL.md` | Modèle de données, entités, relations (points 2, 3) |
| `02-AUTH-PERMISSIONS.md` | Authentification, rôles, permissions granulaires, RLS (points 4, 5, 12) |
| `03-WORKFLOWS.md` | Workflows métier et machines à états (point 6) |
| `04-API.md` | Conventions API, endpoints, contrôle serveur (point 7) |
| `05-DOCUMENTS-STORAGE.md` | Modèles de documents, variables, classement, stockage fichiers (points 8, 9) |
| `06-SECURITY.md` | Règles de sécurité détaillées (point 12) |
| `07-ROADMAP.md` | Découpage en phases et état d'avancement |

---

## 1. Principes directeurs (non négociables)

1. **Tout est lié au client.** Aucune donnée métier orpheline. La chaîne `Client → Demande → Devis → Chantier → Facture → Paiement` est matérialisée par des clés étrangères, jamais par de la duplication.
2. **Zéro ressaisie.** Une entité créée depuis une autre hérite de ses données par référence (une demande → devis → chantier → facture propagent client, adresse, prestations).
3. **Permissions vérifiées côté serveur.** L'UI cache les boutons ; la base (RLS) + la couche API refusent l'action. Cacher ≠ protéger.
4. **Séparation CA facturé / trésorerie encaissée.** Deux notions distinctes, jamais mélangées dans les analyses.
5. **Immuabilité de l'historique.** Un document généré fige le contenu du modèle à l'instant T (règle 10). Modifier un modèle n'altère pas les documents passés.
6. **Traçabilité.** Toute action importante écrit dans `audit_log` (qui, quoi, quand, sur quel objet, avant/après si pertinent).
7. **Modularité.** Chaque domaine (clients, devis, chantiers, finance, achats…) est un module isolé côté code, relié par le noyau (auth, permissions, audit, notifications).

---

## 2. Stack technique

| Couche | Choix | Rôle |
|---|---|---|
| Framework | **Next.js 16** (App Router, RSC + Server Actions) | Front + back unifiés |
| Langage | **TypeScript** (strict) | Typage bout-en-bout |
| UI | **Tailwind CSS + Shadcn (base-ui)** | Design system sobre, responsive |
| Base de données | **PostgreSQL (Supabase)** | Données relationnelles + RLS |
| Auth | **Supabase Auth** | Sessions sécurisées, mots de passe hashés (bcrypt/scrypt géré par Supabase) |
| Autorisation | **RLS Postgres + policies + couche service** | Permissions granulaires côté serveur |
| Stockage fichiers | **Supabase Storage** (buckets privés + signed URLs) | Documents clients, RH, pièces jointes |
| Emails | **Resend** | Envoi devis/factures/relances (Phase 6) |
| Hébergement | **Vercel** | Déploiement, crons, edge |
| Validation | **Zod** | Schémas partagés client/serveur |
| Données/formulaires | **React Hook Form + Zod** | Formulaires typés |
| Tables/graphes | **TanStack Table + Recharts** | Tableaux filtrables, KPI, graphiques |
| Dates | **date-fns** (locale fr) | Manipulation, formats FR |

**Pourquoi cette stack pour un ERP à permissions :** Supabase fournit nativement Auth + Postgres RLS + Storage privé. Les RLS deviennent le socle des permissions serveur (règle 9), impossible à contourner via un appel API direct. C'est l'atout décisif pour ce cahier des charges.

---

## 3. Modèle d'exécution & contrôle des permissions

Trois niveaux de défense, du plus profond au plus superficiel :

```
┌─────────────────────────────────────────────┐
│ 1. RLS Postgres (dernier rempart)             │  ← infranchissable même en cas de bug applicatif
│    policies par table selon permissions user  │
├─────────────────────────────────────────────┤
│ 2. Couche service / Server Actions            │  ← assert de permission avant toute mutation
│    requireAuth() + can(user, "quotes.create") │
├─────────────────────────────────────────────┤
│ 3. UI (menu + boutons dynamiques)             │  ← confort, jamais sécurité
│    useCan("quotes.create") masque le bouton   │
└─────────────────────────────────────────────┘
```

Le client Supabase **admin** (service_role) n'est utilisé QUE dans les Server Actions/API, après contrôle de permission explicite. Le client **utilisateur** (anon key + session) est soumis aux RLS. Voir `02-AUTH-PERMISSIONS.md`.

---

## 4. Structure du dépôt (front + back, points 10 & 11)

Next.js unifie front et back : les **Server Actions** et **route handlers** sont le backend, les **RSC/Client Components** le frontend. Organisation par domaine métier (modularité, principe 7) :

```
isopoz/
├── docs/                          # cette documentation d'architecture
├── supabase/
│   ├── migrations/                # SQL versionné (schéma, RLS, seeds permissions)
│   └── seed.sql                   # données initiales (super admin, permissions catalog)
├── src/
│   ├── app/
│   │   ├── (auth)/                # login, mot de passe oublié
│   │   ├── (app)/                 # espace authentifié (layout + sidebar dynamique)
│   │   │   ├── dashboard/
│   │   │   ├── clients/
│   │   │   ├── demandes/
│   │   │   ├── commercial/        # devis, factures, paiements, relances
│   │   │   ├── chantiers/
│   │   │   ├── planning/
│   │   │   ├── personnel/         # CDI/CDD, éphémères, équipes, absences, demandes
│   │   │   ├── materiel/
│   │   │   ├── achats/            # fournisseurs, commandes, négociations
│   │   │   ├── documents/         # + modèles
│   │   │   ├── analyse/           # CA, clients, chantiers, rentabilité
│   │   │   └── administration/    # utilisateurs, rôles, permissions, paramètres
│   │   ├── (portal)/              # portail salarié (planning perso, fiches paie, demandes)
│   │   └── api/                   # route handlers (webhooks, exports, crons)
│   ├── modules/                   # logique métier par domaine (le "backend")
│   │   ├── clients/{schema.ts,service.ts,queries.ts,actions.ts}
│   │   ├── quotes/…
│   │   ├── projects/…
│   │   └── …                      # même structure par module
│   ├── core/                      # noyau transverse
│   │   ├── auth/                  # session, requireAuth, requirePermission
│   │   ├── permissions/           # catalogue, can(), hooks useCan()
│   │   ├── audit/                 # writeAudit()
│   │   ├── notifications/
│   │   ├── documents/             # moteur de templating {{variables}}
│   │   └── supabase/              # clients (browser, server, admin)
│   ├── components/                # UI partagée (shadcn + composants métier)
│   │   ├── ui/                    # primitives shadcn
│   │   ├── layout/                # sidebar dynamique, topbar, recherche globale
│   │   └── data/                  # DataTable, KPI cards, StatusBadge, charts
│   └── lib/                       # utils (dates, format €, cn…)
├── .env.example
└── ...
```

**Convention par module** (chaque dossier de `src/modules/*`) :
- `schema.ts` — schémas Zod + types (source de vérité des validations)
- `queries.ts` — lectures (RSC, soumises RLS)
- `service.ts` — logique métier pure et réutilisable
- `actions.ts` — Server Actions (mutations) : `requirePermission` → validation Zod → mutation → `writeAudit` → `revalidatePath`

Voir les autres fichiers de `docs/` pour le détail de chaque point.
