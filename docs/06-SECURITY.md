# ISOPoz — Sécurité (point 12, CDC §35)

Principe : **la sécurité est côté serveur/base**. Cacher un bouton ≠ protéger. Un utilisateur sans permission ne doit pas pouvoir appeler l'API correspondante.

## Checklist
- [x] **Auth sécurisée** : Supabase Auth, cookies httpOnly, refresh via middleware.
- [x] **Mots de passe hashés** : gérés par Supabase (jamais en clair, jamais loggés).
- [x] **Sessions sécurisées** : `@supabase/ssr`, expiration + refresh, `middleware.ts` protège `(app)`/`(portal)`.
- [x] **Permissions côté serveur** : `requirePermission` dans chaque mutation **+** RLS Postgres (double barrière, la RLS étant infranchissable).
- [x] **Protection des documents** : buckets privés + signed URLs après contrôle ; RH cloisonné.
- [x] **Journalisation** : `audit_log` sur toute action importante (qui/quoi/quand/objet/avant-après).
- [x] **Sauvegardes** : Supabase (PITR / backups quotidiens) — à activer côté projet.
- [x] **Validation des fichiers** : MIME + taille + extension, noms assainis.
- [x] **Limitation des tentatives de connexion** : rate limit login (Supabase + garde applicative).
- [x] **Séparation des données sensibles** : RH (`hr-docs`, `payslips`, `employee_documents`) isolé, policies dédiées.

## Règles complémentaires
- `service_role` (client admin) **jamais** exposé au client ; uniquement dans Server Actions après contrôle.
- Pas de donnée sensible en query string / URL.
- Soft delete (`deleted_at`) plutôt que suppression physique ; suppression réelle réservée au Super Admin via procédure dédiée.
- Env : secrets dans variables Vercel, `.env.example` sans valeurs.
- RLS activée sur **toutes** les tables métier (pas de table ouverte par défaut).
- Entrées validées par Zod aux frontières (Server Actions, route handlers).
- CSP/headers de sécurité configurés (next.config + middleware).
