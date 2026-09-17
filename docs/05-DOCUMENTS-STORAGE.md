# ISOPoz — Documents, modèles & stockage fichiers (points 8, 9)

## 1. Modèles de documents (CDC §13)
- `document_templates` + `document_template_versions` (versionné).
- Types : devis standard, devis chantier, facture standard, contrat, bon de commande, bon de livraison, courrier, relance.
- Scope : `company` (créés par Super Admin, communs) ou `personal` (gestionnaire si permission `templates.create`).
- Corps du modèle avec **variables dynamiques** `{{...}}`.

### Moteur de templating (`src/core/documents/`)
Rendu par substitution de variables résolues depuis les entités liées :
```
{{client.nom}} {{client.adresse}} {{client.email}}
{{date}} {{numero}} {{gestionnaire.nom}}
{{prestations}} {{total_ht}} {{tva}} {{total_ttc}}
```
- Contexte assemblé serveur depuis client/devis/chantier/facture.
- `prestations` = table rendue depuis les items.
- Sortie HTML → **PDF** (génération serveur) stocké dans Storage + ligne `documents`.

### Immuabilité (règle 10)
Générer un document **copie la version courante** du modèle dans le document produit. Modifier un modèle plus tard ne touche aucun document déjà généré.

## 2. Classement automatique (CDC §28-29)

**Documents clients** :
```
Client → Année → Type → Document
client-docs/{client_id}/{année}/{doc_type}/{uuid}-{nom}.pdf
```
**Documents RH** (séparés, accès strict) :
```
Salarié → Année → Type → Document
hr-docs/{employee_id}/{année}/{doc_type}/{uuid}-{nom}.pdf
```
Le classement est **déduit automatiquement** à l'insertion (`documents.client_id`/`employee_id` + `year` + `doc_type`), pas saisi par l'utilisateur. La navigation documentaire lit ces colonnes (pas l'arborescence physique).

## 3. Stockage fichiers (Supabase Storage)
- **Deux buckets privés** : `client-docs`, `hr-docs`. Aucun accès public.
- Accès en lecture uniquement via **signed URL** générée par un route handler, **après** contrôle serveur :
  - client-docs : permission `documents.download` + périmètre client.
  - hr-docs : `hr.manage` **ou** le salarié propriétaire (`employee_id` lié à `user_id`).
- Upload via Server Action `documents.upload` : validation type MIME + taille, nom assaini, chemin calculé automatiquement.
- Métadonnées en base (`documents`), fichier en Storage — la base est la source de vérité du classement et des droits.

## 4. Validation des fichiers
- Types autorisés par `doc_type` (pdf, images, docx…), taille max, extension vs MIME cohérents.
- Noms de fichiers assainis (pas d'accents/espaces problématiques dans les chemins — cf. règle slug GO PRESTA).
