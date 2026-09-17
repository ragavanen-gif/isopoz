# ISOPoz

ERP métier interne : **Client → Demande → Devis → Chantier → Planning → Équipe/Matériel → Facture → Paiement → Analyse → Archivage**.

Stack : Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + RLS + Storage) · Vercel.

## Documentation d'architecture

Voir `docs/` (à lire avant de coder) :
`00-ARCHITECTURE` · `01-DATA-MODEL` · `02-AUTH-PERMISSIONS` · `03-WORKFLOWS` · `04-API` · `05-DOCUMENTS-STORAGE` · `06-SECURITY` · `07-ROADMAP`.

## Mise en route

### 1. Créer le projet Supabase
1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécuter dans l'ordre :
   - `supabase/migrations/0001_core.sql`
   - `supabase/migrations/0002_commercial.sql`
   - `supabase/migrations/0003_storage.sql` (crée les buckets privés `client-docs` / `hr-docs`)
   - `supabase/migrations/0004_operations.sql` (chantiers, planning, équipes, salariés, matériel)
   - `supabase/migrations/0005_finance.sql` (factures, paiements, relances)
   - `supabase/seed.sql`

### 2. Variables d'environnement
Copier `.env.example` en `.env.local` et renseigner depuis **Settings → API** :
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # secret, jamais exposé au client
```

### 3. Créer le premier Super Admin
1. **Authentication → Users → Add user** : créer un compte (email + mot de passe).
2. Dans **SQL Editor**, adapter l'email et exécuter :
```sql
update public.users set is_super_admin = true where email = 'admin@isopoz.fr';
insert into public.user_roles (user_id, role_id)
  select u.id, r.id from public.users u, public.roles r
  where u.email = 'admin@isopoz.fr' and r.name = 'super_admin'
  on conflict do nothing;
```

### 4. Lancer
```bash
npm run dev        # http://localhost:3002 (via dev.sh : gère le PATH node)
```
> `node` n'étant pas dans le PATH système, utiliser `./dev.sh` (ou `npm run dev` si le PATH est configuré). Le build : `node node_modules/next/dist/bin/next build`.

## État — Phase 1 livrée
- ✅ Authentification (Supabase Auth, sessions, proxy de protection des routes)
- ✅ Permissions granulaires : rôles + overrides, **vérifiées côté serveur (RLS + requirePermission)**
- ✅ Menu latéral dynamique selon les permissions
- ✅ Clients (CRUD complet, fiche client, dashboard, soft delete)
- ✅ Administration : utilisateurs (création, statut, rôles), rôles & permissions, journal d'activité
- ✅ Dashboard

## Phase 2 + 2b livrées
- ✅ Demandes clients (CRUD, statuts, **conversion en devis** sans ressaisie)
- ✅ Devis (lignes, **totaux recalculés serveur**, statuts, envoi, validation)
- ✅ Modèles de documents versionnés + **moteur de variables `{{...}}`**
- ✅ Documents : **upload Storage** (classement auto Client→Année→Type), **génération PDF de devis**, **téléchargement par URL signée**

## Phase 3 livrée
- ✅ Chantiers : **créés depuis un devis accepté**, statuts + timeline, **coûts réels & marge**
- ✅ Planning : créneaux + affectations avec **détection de conflits**
- ✅ Salariés CDI/CDD + **éphémères** (journées, validation, rémunération) + Équipes
- ✅ Matériel : catalogue + **réservations avec contrôle de disponibilité**

## Phase 4 livrée
- ✅ Factures **depuis un chantier** (reprend les lignes du devis), statuts, envoi
- ✅ Paiements + **statut dérivé** (payée / partielle / en retard)
- ✅ Relances (niveaux) + vue impayés
- ✅ Analyses : **CA facturé vs encaissé**, par mois/client, rentabilité chantiers

Phases 5-6 : voir `docs/07-ROADMAP.md`. Les modules non développés affichent un écran « en préparation ».

## Sécurité
Les permissions sont appliquées **côté base (RLS)** et **côté serveur** (`requirePermission`), jamais uniquement en masquant l'UI. Voir `docs/06-SECURITY.md`.
