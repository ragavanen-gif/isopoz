# Déploiement ISOPoz (Supabase + Vercel)

Ordre : **1. Supabase** (base + secrets) → **2. Git** (repo) → **3. Vercel** (hébergement).

---

## 1. Supabase (base de données)

1. Créer un projet sur [supabase.com](https://supabase.com) (région Europe conseillée, ex. `eu-west-3`).
2. **SQL Editor** → exécuter dans l'ordre, un fichier à la fois :
   - `supabase/migrations/0001_core.sql`
   - `supabase/migrations/0002_commercial.sql`
   - `supabase/migrations/0003_storage.sql`
   - `supabase/migrations/0004_operations.sql`
   - `supabase/migrations/0005_finance.sql`
   - `supabase/seed.sql`
3. **Créer le premier Super Admin** : Authentication → Users → *Add user* (email + mot de passe), puis dans SQL Editor (adapter l'email) :
   ```sql
   update public.users set is_super_admin = true where email = 'TON_EMAIL';
   insert into public.user_roles (user_id, role_id)
     select u.id, r.id from public.users u, public.roles r
     where u.email = 'TON_EMAIL' and r.name = 'super_admin'
     on conflict do nothing;
   ```
4. **Récupérer les clés** : Settings → API →
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY`

> Sécurité : activer les **backups** (Database → Backups). La `service_role` ne doit jamais être exposée côté client (elle n'est utilisée que dans les Server Actions).

---

## 2. Dépôt Git

`isopoz/` est déjà un dépôt Git indépendant. Créer un repo distant (GitHub) et pousser :

```bash
cd isopoz
git branch -M main
git remote add origin https://github.com/<toi>/isopoz.git
git push -u origin main
```

---

## 3. Vercel (hébergement)

### Option A — Dashboard (recommandé)
1. [vercel.com/new](https://vercel.com/new) → *Import* le repo `isopoz`.
2. Framework détecté : **Next.js**. Root Directory : racine du repo (`.`).
3. **Environment Variables** (Production + Preview) :
   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | (Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon public) |
   | `SUPABASE_SERVICE_ROLE_KEY` | (service_role — secret) |
4. *Deploy*. Build : `next build` (Turbopack) — géré automatiquement.

### Option B — CLI
```bash
cd isopoz
npx vercel        # login + lier le projet
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel --prod # déploiement production
```

---

## 4. Après le premier déploiement
- Se connecter avec le compte Super Admin créé à l'étape 1.3.
- Créer les autres utilisateurs et attribuer les rôles depuis **Administration → Utilisateurs**.
- Vérifier : Clients → Demande → Devis → PDF, puis Chantier → Facture → Paiement.

### Notes techniques
- Runtime **Node.js** requis (génération PDF `@react-pdf/renderer` + `proxy`). Aucune route en Edge — rien à configurer.
- Auth par email/mot de passe via formulaire interne : pas de redirect OAuth à configurer côté Supabase.
- Les buckets Storage `client-docs` / `hr-docs` sont privés ; les téléchargements passent par des URL signées générées côté serveur.
