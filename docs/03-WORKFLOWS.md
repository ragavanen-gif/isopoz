# ISOPoz — Workflows métier & machines à états (point 6)

Chaque transition est appliquée **côté serveur** (Server Action) avec contrôle de permission + écriture `audit_log` + `project_events` le cas échéant. Les transitions non autorisées sont refusées (pas seulement grisées).

## 1. Workflow central (cycle de vie d'un dossier)

```
Client → Demande → Devis → [accepté] → Chantier → Planning → Équipe+Matériel
       → Réalisation → Coûts → Facture → Paiement → Analyse → Archivage
```
Propagation sans ressaisie (règle 8) :
- Demande → Devis : hérite client, objet, description, pièces jointes.
- Devis accepté → Chantier : hérite client, `quote_id`, prestations, montant (`quote_total_cents` figé), adresse.
- Chantier → Facture : hérite client, `project_id`, `quote_id`, lignes.
- Facture → Paiement : `invoice_id` obligatoire (règle 7).

## 2. Demande client (`request_status`)
```
nouvelle → a_traiter → en_etude → devis_a_preparer → devis_envoye → devis_accepte
              ↘ refusee        ↘ annulee
```
`devis_envoye`/`devis_accepte` sont synchronisés avec le statut du devis lié.

## 3. Devis (`quote_status`)
```
brouillon → envoye → en_attente → accepte
                               ↘ refuse
                               ↘ expire        (auto si valid_until dépassé)
        ↘ annule
```
- `send` (permission `quotes.send`) : brouillon → envoye.
- `validate` (permission `quotes.validate`) : → accepte → **débloque « Créer chantier »** (règle 4).
- Un devis accepté est verrouillé en édition (immuabilité commerciale).

## 4. Chantier (`project_status`)
```
a_planifier → planifie → en_preparation → en_cours → termine → a_facturer → facture → cloture
                                              ↘ suspendu (réversible → en_cours)
     ↘ annule
```
- Création possible uniquement depuis un devis `accepte`.
- `termine` déclenche la possibilité de facturer.
- Timeline `project_events` alimentée à chaque étape (créé, équipe affectée, matériel réservé, planning publié, démarré, terminé, facturé).

## 5. Facture (`invoice_status`)
```
brouillon → envoyee → en_attente → payee
                                 ↘ partiellement_payee → payee
                                 ↘ en_retard (auto si due_date < today et non payée)
       ↘ annulee
```
Statut dérivé automatiquement du cumul `payments` vs `total_cents` et de `due_date`. `mark_paid` (permission) possible manuellement.

## 6. Journée éphémère (`workday_status`)
```
planifiee → realisee → a_valider → validee → comptabilisee
                                 ↘ (refus renvoie à realisee/annule)
```
Rémunération = Σ(`fraction` des journées `validee`/`comptabilisee`) × `daily_rate_cents`. Validation par un user avec `ephemeral.validate`.

## 7. Demandes salarié (repos / matériel) (`pending → accepted|refused`)
```
pending → accepted
        ↘ refused
```
Décision par gestionnaire ; notification au salarié ; historique conservé.

## 8. Relances (`reminders`)
```
Facture en retard (due_date dépassée)
  → relance niveau 1 → niveau 2 → niveau 3
```
Chaque relance utilise un modèle (`document_templates` scope relance) ; trace `sent_at`.

## 9. Négociation fournisseur
```
prix fournisseur → proposition ISOPoz → contre-proposition → accord final
```
Chaque étape = ligne `negotiations`. Affiché : prix initial, prix final, économie.

## 10. Règles d'intégrité transverses
- **R4** : chantier créable seulement si devis `accepte`.
- **R5** : `projects.quote_id` non nul et immuable une fois créé.
- **R6** : `invoices.project_id`/`quote_id` renseignables et cohérents (même client).
- **R7** : `payments.invoice_id` obligatoire.
- **R8** : les créations dérivées pré-remplissent depuis la source.
- **R10** : générer un document copie la **version** du modèle → documents passés jamais altérés par une modif de modèle.
- **R11** : toute transition d'état écrit dans `audit_log`.
