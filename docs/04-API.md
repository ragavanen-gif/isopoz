# ISOPoz — API & couche serveur (point 7)

Next.js App Router : le « backend » = **Server Actions** (mutations) + **route handlers** `app/api/*` (exports, webhooks, crons) + **queries RSC** (lectures). Pas d'API REST séparée à maintenir ; PostgREST de Supabase reste protégé par RLS pour d'éventuels accès directs.

## 1. Contrat d'une Server Action (mutation)
Toutes suivent le même pipeline (`src/modules/<domaine>/actions.ts`) :
```ts
export async function createQuote(input: unknown) {
  const user = await requireAuth();                 // 1. session
  requirePermission(user, "quotes.create");         // 2. autorisation serveur
  const data = quoteCreateSchema.parse(input);      // 3. validation Zod
  const quote = await quoteService.create(data, user); // 4. logique métier (totaux serveur, référence)
  await writeAudit(user, "quote.create", "quote", quote.id, null, quote); // 5. trace
  revalidatePath(`/clients/${data.clientId}`);       // 6. invalidation cache
  return { ok: true, id: quote.id };
}
```
Retour normalisé `{ ok: true, ... } | { ok: false, error, fieldErrors? }`. Jamais de logique de sécurité côté client.

## 2. Conventions
- **Lectures** dans des RSC via `queries.ts` (client Supabase utilisateur → RLS s'applique).
- **Écritures** via Server Actions (client admin **après** `requirePermission`).
- Validation partagée client/serveur par les mêmes schémas Zod (`schema.ts`).
- Montants recalculés serveur (jamais les totaux envoyés par le client).
- Pagination/tri/filtre passés en query params typés ; `DataTable` générique côté UI.

## 3. Route handlers (`app/api/*`)
| Endpoint | Usage |
|---|---|
| `POST /api/documents/generate` | Génère un document depuis un modèle (fige la version) et le range. |
| `GET /api/documents/[id]/download` | Signed URL après contrôle `documents.download` + périmètre client/RH. |
| `POST /api/webhooks/email` | (Phase 6) réception email → création demande + pièces jointes. |
| `GET /api/exports/*` | Exports CSV/PDF (CA, factures…). |
| `GET /api/cron/daily` | (Vercel Cron) expirations devis, passage factures en retard, notifications. |

## 4. Endpoints logiques par module (surface fonctionnelle)
- **clients** : list/get/create/update/soft-delete + `getClientDashboard` (vue agrégée).
- **requests** : CRUD + `assignManager` + `convertToQuote`.
- **quotes** : CRUD items, recompute totals, `send`, `validate`, `convertToProject`.
- **projects** : CRUD, `changeStatus`, `assignTeam/Employee/Equipment`, `addCost`, `getMargin`.
- **planning** : `createSchedule`, `assign`, `checkConflicts` (chevauchements salarié/matériel).
- **personnel** : employees CRUD, ephemeral workdays (`plan/realize/validate`), leave/material requests decisions.
- **finance** : invoices CRUD/`send`/`markPaid`, payments `record`, reminders `send`.
- **achats** : suppliers/products/orders CRUD, `addNegotiation`, `receiveGoods`.
- **documents** : upload, `generateFromTemplate`, templates CRUD (versionné).
- **analytics** : CA par période/client/chantier/prestation, facturé vs encaissé, rentabilité.
- **admin** : users, roles, role_permissions, user_permissions, settings, audit read.

## 5. Erreurs & sécurité API
- 401 si pas de session, 403 si permission manquante, 422 si validation Zod échoue.
- Pas de données sensibles en query string (principe sécurité).
- Rate limiting sur login et endpoints de génération/téléchargement.
