# Document 07 - Consultation et Actes Prescrits

> **État de réalisation : RÉALISÉ (as-built).** Ce document décrit le module *Consultation et actes prescrits* tel qu'il est effectivement implémenté dans CMS SARIS. Les éléments relevant d'une évolution ultérieure sont explicitement signalés comme **Extension future**.

---

## 1. Objectif

Gérer la consultation médicale et les actes prescrits associés : examen clinique, diagnostic, conclusion et décision médicale, **ordonnance** (avec contrôles de sécurité allergies / contre-indications / grossesse) puis **validation**, **bon d'examen** et saisie des **résultats**, et **suivi chronique**. Le module produit également des **documents A4 imprimables** (ordonnance, bon d'examen) avec aperçu intégré, et gère la **prescription par délégation** de manière codée et tracée.

Le module est intégralement codé (back-end NestJS + front-end React), persisté en base PostgreSQL via Prisma et soumis à journalisation d'audit.

---

## 2. Acteurs concernés

| Rôle | Périmètre sur le module |
|---|---|
| **MEDECIN_CHEF** | Accès complet : consultation, diagnostic, prescription, bon d'examen, résultats, suivi chronique, validation et annulation d'ordonnance, impression. |
| **INFIRMIER_DELEGUE** | Consultation, diagnostic, examen clinique, prescription **limitée par la délégation** (médicaments autorisés), création/validation d'ordonnance, bon d'examen, saisie de résultats, suivi chronique. |
| **INFIRMIER** | Création de consultation (envoi en consultation), saisie de l'examen clinique / constantes, lecture et saisie de résultats d'examen ; **pas de prescription**. |
| **ADMIN_MEDICAL** | Lecture (consultation, ordonnance, bon d'examen, suivi chronique) et corrections encadrées selon dérogations. |
| **ADMIN_SYSTEME** | Super-administrateur : dispose de l'ensemble du catalogue de permissions, donc accès complet au module. |

Le contrôle d'accès s'appuie sur le catalogue de **110 permissions** et le système de **6 rôles**, complété par des dérogations individuelles (GRANT / REVOKE).

---

## 3. Données manipulées

Le module mobilise **8 tables Prisma** dédiées (groupe « Consultation / actes ») :

| Table | Rôle |
|---|---|
| `Consultation` | Acte de consultation rattaché à une visite et à un soignant. |
| `DiagnosticConsultation` | Diagnostics posés (principal / secondaire, certitude). |
| `Ordonnance` | En-tête d'ordonnance rattachée à la consultation. |
| `LigneOrdonnance` | Lignes de prescription (médicament, posologie, durée, voie). |
| `BonExamen` | Demande d'examen complémentaire. |
| `LigneExamen` | Types d'examen demandés sur un bon. |
| `ResultatExamen` | Résultats rattachés au bon d'examen. |
| `SuiviChronique` | Suivi d'une pathologie chronique. |

Tables externes mobilisées (référentiels et acteurs) : `PathologieReference`, `MedicamentReference`, `ContreIndicationMedicament`, `TypeExamen`, `EtablissementReference`, `DelegationPrescription`, `DelegationMedicamentAutorise`, ainsi que `Visite`, `ConstanteVitale` et les données du dossier patient (allergies, antécédents, alertes, suivi de grossesse).

### 3.1 Champs réels des tables principales

**`Consultation`**
`id`, `visiteId`, `soignantId`, `delegationId?`, `statut` (`OUVERTE` / `CLOTUREE` / `ANNULEE`), `examenClinique?`, `conclusion?`, `decisionMedicale?`, `version`, `createdAt`, `closedAt?`, `pickedUpById?`, `pickedUpAt?` (verrou souple « consultation en main »).

**`DiagnosticConsultation`**
`id`, `consultationId`, `pathologieId`, `type` (défaut `PRINCIPAL`), `certitude` (défaut `CONFIRME`).

**`Ordonnance`**
`id`, `consultationId`, `prescripteurId`, `delegationId?`, `statut` (défaut `BROUILLON`), `motifAnnulation?`, `createdAt`.

**`LigneOrdonnance`**
`id`, `ordonnanceId`, `medicamentId`, `posologie`, `duree`, `voieAdmin`, `instructions?`, `justification?` (justification obligatoire en cas de contre-indication relative).

**`BonExamen`**
`id`, `consultationId`, `indicationClinik`, `etablissementId?`, `statut` (défaut `EN_ATTENTE`), `motifAnnulation?`, `createdAt`.

**`LigneExamen`**
`id`, `bonId`, `typeExamenId`.

**`ResultatExamen`**
`id`, `bonId`, `laboratoire?`, `contenu`, `interpretation?`, `statut` (défaut `RECU`), `saisiePar`, `createdAt`.

**`SuiviChronique`**
`id`, `patientId?`, `consultationId?`, `pathologieId`, `frequenceSuivi?`, `objectifs?`, `statut` (défaut `ACTIF`), `motifCloture?`, `motifAnnulation?`, `createdAt`, `closedAt?`.

**`DelegationPrescription`** (acteurs)
`id`, `medecinChefId`, `infirmierId`, `dateDebut`, `dateFin`, `statut` (défaut `ACTIVE`), `perimetre?`, avec liste `DelegationMedicamentAutorise` (médicaments explicitement autorisés).

---

## 4. Processus principal (réalisé)

1. Le soignant ouvre une consultation depuis la file d'attente / la visite active (verrou souple `pickedUpBy` pour signaler la prise en main).
2. Le système affiche le dossier patient, les **alertes médicales**, les **allergies**, les **antécédents**, les **constantes** et l'historique.
3. Le soignant saisit l'**examen clinique** (`examenClinique`).
4. Il pose un ou plusieurs **diagnostics** (principal et secondaires, niveau de certitude) à partir du référentiel de pathologies.
5. Il renseigne la **conclusion** et la **décision médicale**.
6. **Si prescription** : il crée une ordonnance, ajoute les lignes (médicaments de référence, posologie, durée, voie). Le système exécute les **contrôles de sécurité** (allergies, contre-indications, grossesse) puis l'ordonnance est **validée**.
7. **Si examen** : il crée un **bon d'examen** (indication clinique, établissement, types d'examen), puis suit le retour et **saisit le résultat** rattaché au bon.
8. **Si pathologie chronique** : il rattache un **suivi chronique** (pathologie, fréquence, objectifs).
9. La consultation est **clôturée** (`closedAt`).
10. Les actes prescrits sont **imprimables au format A4** avec aperçu intégré (logo réel de la structure).

---

## 5. Contrôles de sécurité à la prescription (réalisé)

Lors de l'ajout d'une ligne d'ordonnance, le système croise le médicament avec le dossier patient :

| Situation détectée | Comportement |
|---|---|
| **Allergie absolue** | Ligne **bloquée** : le médicament ne peut pas être prescrit. |
| **Contre-indication relative** | **Justification obligatoire** (`LigneOrdonnance.justification`) pour autoriser la ligne. |
| **Grossesse active** | **Contrôle renforcé** : le système alerte le prescripteur selon le suivi de grossesse du dossier. |
| **Prescription par infirmier délégué** | Liste de médicaments **limitée** aux médicaments autorisés de la délégation active. |

Les contre-indications proviennent du référentiel `ContreIndicationMedicament` ; le statut de grossesse et les allergies proviennent du dossier patient.

---

## 6. Délégation de prescription (réalisée — codée)

La prescription par délégation est entièrement codée et tracée :

- Une **délégation** (`DelegationPrescription`) lie un médecin-chef à un infirmier délégué, avec dates de début / fin, statut et périmètre.
- Elle porte une liste explicite de **médicaments autorisés** (`DelegationMedicamentAutorise`).
- Une ordonnance et une consultation peuvent référencer la délégation utilisée (`delegationId`), assurant la traçabilité de l'acte prescrit par délégation.
- La gestion des délégations (création, modification, révocation, suppression) est exposée via le module **Acteurs administratifs** et protégée par les permissions `delegation.*`.

---

## 7. Documents A4 imprimables (réalisé)

Le module génère des documents au **gabarit A4 unifié** de l'application (logo réel, monochrome, aperçu intégré dans la zone de droite) :

- **Ordonnance** imprimable (permission `ordonnance.print`).
- **Bon d'examen** imprimable.

Ces documents s'inscrivent dans le système documentaire transversal de CMS SARIS (ordonnance, bon d'examen, évacuation, accident du travail, suivi, synthèse de dossier).

---

## 8. Cas alternatifs (réalisés)

- Allergie absolue : médicament **bloqué**.
- Contre-indication relative : **justification obligatoire**.
- Grossesse active : **contrôle renforcé**.
- Infirmier délégué : liste de médicaments **limitée** par la délégation.
- Résultat d'examen reçu après clôture : **ajout rattaché au bon d'examen** (un résultat est toujours lié à `bonId`).
- Consultation laissée ouverte : signalement / suivi via le statut `OUVERTE`.

---

## 9. Règles métier (réalisées)

- Une consultation **doit être rattachée à une visite**.
- Une consultation ne peut être clôturée **sans diagnostic ou conclusion**.
- Une ordonnance **doit être rattachée à une consultation**.
- Une ordonnance **validée** n'est pas modifiée directement (annulation tracée via `motifAnnulation`).
- Une **contre-indication absolue bloque** la ligne ; une **contre-indication relative exige une justification**.
- La **grossesse active** influence les contrôles de prescription.
- Les examens portent une **indication clinique** obligatoire (`indicationClinik`).
- Un **résultat d'examen est toujours rattaché** à son bon d'origine.
- La **délivrance physique** de médicaments est **hors périmètre** (voir Extensions futures).

---

## 10. États et statuts (réalisés)

**Consultation** (`enum StatutConsultation`) :
- `OUVERTE`
- `CLOTUREE`
- `ANNULEE`

> Note d'implémentation : l'énumération réelle ne comporte pas d'état `EN_COURS` distinct ; la prise en main est gérée par le verrou souple `pickedUpBy` / `pickedUpAt`.

**Ordonnance** (`statut`, valeur par défaut `BROUILLON`) :
- `BROUILLON`
- `VALIDEE`
- `ANNULEE`

**Bon d'examen** (`statut`, valeur par défaut `EN_ATTENTE`) :
- `EN_ATTENTE`
- `VALIDE`
- `RECU` (après saisie du résultat)
- `ANNULE`

**Résultat d'examen** (`statut`, valeur par défaut `RECU`).

**Suivi chronique** (`statut`, valeur par défaut `ACTIF`) :
- `ACTIF`
- `CLOTURE`
- `ANNULE`

---

## 11. Écrans réalisés

- Consultation patient (dossier, alertes, constantes, historique).
- Examen clinique, diagnostic, conclusion et décision médicale.
- Prescription (ordonnance) avec contrôle de sécurité intégré.
- Bon d'examen et saisie des résultats.
- Suivi chronique.
- Aperçu et impression des documents A4 (ordonnance, bon d'examen) intégrés en zone de droite.

L'interface s'appuie sur la stack front réelle : **React 19 + Vite 7 + TypeScript + Tailwind v4 + shadcn/ui**, état via **Zustand**, données via **TanStack Query**, et rafraîchissement **temps réel** par flux SSE.

---

## 12. Notifications et temps réel (réalisé)

- Alertes de sécurité à la prescription : allergie, contre-indication, grossesse active.
- Mise à jour **temps réel** des écrans cliniques via le **flux SSE** (invalidations react-query, `@LiveRefresh` / `broadcastLive`).
- Les mutations du module sont **journalisées (audit)** via l'intercepteur global `@Audit` (`JournalAudit`, IP + géolocalisation).

---

## 13. Permissions (réalisées)

Le module est protégé par les permissions suivantes (catalogue de **110 permissions**) :

| Domaine | Permissions |
|---|---|
| Consultation | `consultation.read`, `consultation.create`, `consultation.update`, `consultation.close`, `consultation.cancel`, `consultation.delete`, `consultation.diagnose`, `consultation.examen` |
| Ordonnance | `ordonnance.read`, `ordonnance.create`, `ordonnance.validate`, `ordonnance.cancel`, `ordonnance.print` |
| Bon d'examen | `bon_examen.read`, `bon_examen.create`, `bon_examen.validate`, `bon_examen.cancel`, `bon_examen.delete`, `bon_examen.result` |
| Suivi chronique | `suivi_chronique.read`, `suivi_chronique.create`, `suivi_chronique.update`, `suivi_chronique.close`, `suivi_chronique.cancel`, `suivi_chronique.delete` |
| Délégation | `delegation.read`, `delegation.create`, `delegation.update`, `delegation.revoke`, `delegation.delete` |

### 13.1 Affectation par rôle (réelle)

| Action | Rôles autorisés |
|---|---|
| Ouvrir une consultation | MEDECIN_CHEF, INFIRMIER_DELEGUE, INFIRMIER |
| Saisir l'examen clinique | MEDECIN_CHEF, INFIRMIER_DELEGUE, INFIRMIER |
| Poser un diagnostic | MEDECIN_CHEF, INFIRMIER_DELEGUE |
| Prescrire (ordonnance) | MEDECIN_CHEF, INFIRMIER_DELEGUE (selon délégation) |
| Valider / imprimer une ordonnance | MEDECIN_CHEF, INFIRMIER_DELEGUE |
| Annuler une ordonnance validée | MEDECIN_CHEF |
| Créer un bon d'examen | MEDECIN_CHEF, INFIRMIER_DELEGUE |
| Saisir un résultat d'examen | MEDECIN_CHEF, INFIRMIER_DELEGUE, INFIRMIER |
| Suivi chronique (créer / modifier) | MEDECIN_CHEF, INFIRMIER_DELEGUE |
| Lecture seule | ADMIN_MEDICAL |

> ADMIN_SYSTEME dispose de l'intégralité du catalogue et accède donc à toutes ces actions.

---

## 14. Dépendances

- **Triage / Accueil** fournit la visite, les constantes et le motif.
- **Dossier patient** fournit allergies, antécédents, alertes médicales, statut de grossesse et historique.
- **Référentiels** fournit médicaments (+ contre-indications), pathologies, types d'examen et établissements.
- **Acteurs administratifs** fournit les délégations de prescription et leurs médicaments autorisés.
- **Sorties critiques** reçoit les décisions d'évacuation et d'accident du travail (relations `Evacuation` / `AccidentTravail` portées par la consultation).
- **Synchronisation** : les actes participent au modèle offline-first (PWA Workbox + file de rejeu IndexedDB) et à la sauvegarde système.

---

## 15. Critères d'acceptation (vérifiés)

- Une consultation s'ouvre uniquement à partir d'une visite active.
- Une ordonnance contrôle automatiquement allergies et contre-indications, et impose une justification pour les contre-indications relatives.
- Un infirmier délégué ne peut prescrire que dans le périmètre de médicaments autorisés par sa délégation.
- Un résultat d'examen est systématiquement rattaché au bon d'examen initial.
- Les ordonnances et bons d'examen sont imprimables au format A4 avec aperçu intégré.
- La délivrance physique de médicament n'est pas gérée (hors périmètre).

---

## 16. Points de risque (maîtrisés)

- Les contrôles de prescription assistent le soignant sans bloquer abusivement : seules les allergies absolues bloquent, les contre-indications relatives restant autorisées sous justification.
- L'écran de consultation reste réactif (temps réel SSE, requêtes ciblées TanStack Query).
- Le verrou souple `pickedUpBy` évite les prises en main concurrentes sans imposer un verrouillage dur.

---

## 17. Extensions futures (hors périmètre actuel)

- **Délivrance physique des médicaments** et gestion de stock / réapprovisionnement.
- **Export externe des résultats d'examen** (interfaçage laboratoire).
- **Suivi de grossesse complet** (le socle `SuiviGrossesse` / `ConsultationPrenatale` existe mais n'est pas un parcours complet).
- **Reporting directionnel agrégé** sur l'activité de consultation et de prescription.
- **Suite de tests automatisés étendue** : à ce jour, la validation repose sur des vérifications E2E navigateur manuelles, le typecheck `tsc` et le build ; il n'existe pas encore de couverture de tests automatisés exhaustive.
