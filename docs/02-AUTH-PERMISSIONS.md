# ISOPoz — Auth, rôles & permissions (points 4, 5, 12)

## 1. Authentification (Supabase Auth)

- Email + mot de passe. Mots de passe **hashés par Supabase** (jamais stockés en clair).
- Sessions via cookies httpOnly gérées par `@supabase/ssr` (middleware refresh de token, comme sur GO PRESTA).
- Le Super Admin crée les utilisateurs (invite ou création directe côté admin) ; pas d'auto-inscription publique (ERP interne).
- Limitation des tentatives de connexion (rate limit — Supabase + garde applicative).
- `middleware.ts` protège tout `(app)` et `(portal)` : pas de session → redirect `/login`.

Chaque `auth.users` a une ligne miroir dans `public.users` (même `id`) via trigger, portant `is_super_admin`, `status`, lien `employee_id`.

## 2. Modèle de permissions granulaires

Deux niveaux combinés (ni « rôles seuls », ni « permissions seules ») :

1. **Rôles** = ensembles de permissions par défaut (`role_permissions`).
2. **Overrides utilisateur** (`user_permissions.granted`) = ajout/retrait fin par personne.

```
permission_effective(user) =
    (⋃ permissions de ses rôles)
  ∪ (overrides granted = true)
  ∖ (overrides granted = false)

super_admin → toutes les permissions (bypass)
```

### Catalogue de permissions (seed figé)

Format `module.action`. Le Super Admin attribue individuellement (CDC §4).

```
clients.view|create|edit|delete
requests.view|create|edit|delete|assign
quotes.view|create|edit|delete|send|validate
projects.view|create|edit|delete
planning.view|create|edit|delete
teams.view|create|edit|delete
employees.view|create|edit|delete
ephemeral.view|create|edit|validate            # valider journées éphémères
equipment.view|create|edit|delete
invoices.view|create|edit|delete|send|mark_paid
payments.view|create|edit|delete
reminders.view|create|send
suppliers.view|create|edit|delete
orders.view|create|edit|delete
negotiations.view|create|edit
documents.view|upload|edit|delete|download
templates.view|create|edit|delete
hr.view|manage                                 # documents RH (très restreint)
analytics.view                                  # CA, rentabilité
admin.users|roles|permissions|settings|audit    # administration
portal.self                                     # accès portail salarié (planning/paie perso)
```

### Rôles livrés par défaut (seed)
- **super_admin** : `is_super_admin=true`, bypass.
- **gestionnaire** : tout le périmètre opérationnel (clients, requests, quotes, projects, planning, teams, equipment, invoices, payments, reminders, suppliers, orders, negotiations, documents, templates, analytics) — **sans** `admin.*` ni `hr.manage` par défaut.
- **salarie** : `portal.self` + lecture de son planning/équipe/chantier.
- **ephemere** : minimal (souvent pas de compte ; géré comme `employees.type=ephemere`).

## 3. Contrôle côté serveur (règle 9 — le point critique)

### 3a. Couche applicative
`src/core/permissions/` expose :
```ts
requireAuth(): Promise<SessionUser>          // sinon throw/redirect
requirePermission(user, "quotes.create")     // sinon 403
can(user, key): boolean                       // test non bloquant
```
**Toute** Server Action / route handler mutante commence par `const user = await requireAuth(); requirePermission(user, "…")`. Aucune exception.

### 3b. RLS Postgres (dernier rempart, infranchissable)
Chaque table métier a des policies. Deux fonctions SQL helper :
```sql
auth_is_super_admin() returns boolean         -- lit public.users
auth_has_permission(perm text) returns boolean-- calcule la permission effective de auth.uid()
```
Exemple policy (`quotes`) :
```sql
alter table quotes enable row level security;

create policy quotes_select on quotes for select
  using ( auth_is_super_admin() or auth_has_permission('quotes.view') );

create policy quotes_insert on quotes for insert
  with check ( auth_is_super_admin() or auth_has_permission('quotes.create') );

create policy quotes_update on quotes for update
  using ( auth_is_super_admin() or auth_has_permission('quotes.edit') );
```
Ainsi, même un appel direct à l'API PostgREST avec la clé anon d'un utilisateur sans droit est **refusé par la base** — pas seulement par l'UI (CDC §35).

Le client **service_role** (admin) contourne les RLS : réservé aux Server Actions APRÈS `requirePermission`, jamais exposé au navigateur.

### 3c. Cas RH & données sensibles (séparation stricte, CDC §29)
- `payslips`, `employee_documents` : policy « l'utilisateur voit ses propres lignes (`employee_id` lié à son `user_id`) **ou** possède `hr.manage` ». Un salarié ne peut jamais lire les fiches d'un autre.
- Bucket Storage `hr-docs` privé ; accès via signed URL générée seulement après contrôle serveur.

## 4. Menu & UI dynamiques

- Hook `useCan(key)` (permissions chargées à la session) → masque items de menu et boutons.
- La sidebar est générée depuis un arbre de navigation annoté de permissions ; un salarié ne voit que le portail.
- **Rappel** : l'UI n'est jamais la sécurité (principe 3). Le masquage est un confort ; RLS + `requirePermission` protègent.
