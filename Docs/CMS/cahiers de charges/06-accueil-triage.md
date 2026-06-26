# Document 06 - Accueil et Triage

> **État de réalisation : RÉALISÉ (as-built).** Ce document décrit le module Accueil/Triage tel qu'il est effectivement codé dans l'application CMS SARIS. Les écarts par rapport à la conception initiale sont signalés explicitement (notamment le retrait de la notion de priorité de l'interface et la simplification du cycle de statuts de la visite).

## 1. Objectif

Ouvrir et organiser chaque passage patient au CMS. Le triage est la porte d'entrée obligatoire avant toute consultation ou acte prescrit : aucune consultation ne peut exister sans une visite préalablement ouverte au triage.

Le module assure quatre fonctions essentielles, toutes implémentées :

1. **Ouverture de visite** rattachée à un patient identifié, un site et un motif issu du référentiel.
2. **Saisie des constantes vitales** avec calcul automatique de l'IMC et coloration des valeurs anormales (alertes visuelles).
3. **File d'attente en temps réel** alimentée par flux d'événements serveur (SSE), partagée entre les postes.
4. **Orientation soignant** vers le médecin chef ou un infirmier délégué, puis clôture ou annulation encadrée.

L'ensemble fonctionne **hors ligne (offline-first)** : l'ouverture d'une visite et la saisie des constantes restent possibles en cas de coupure réseau, puis sont rejouées automatiquement à la reconnexion.

## 2. Acteurs concernés

| Rôle | Implication au triage |
|---|---|
| `INFIRMIER` | Ouvre les visites, saisit les constantes, oriente le patient, clôture/annule (sans prescription). |
| `INFIRMIER_DELEGUE` | Mêmes droits de triage que l'infirmier, plus la prise en charge avec délégation de prescription. |
| `MEDECIN_CHEF` | Consulte la file, reçoit les orientations, prend les visites en consultation. |
| `ADMIN_MEDICAL` | Supervision, correction encadrée d'une visite clôturée, suppression définitive. |
| `ADMIN_SYSTEME` | Super-administrateur (accès complet au catalogue de permissions). |

## 3. Données manipulées

Le module repose sur **3 tables Prisma dédiées** (sur les 78 du schéma global), enrichies par les tables des modules Dossier patient, Référentiels et Acteurs.

| Table | Rôle |
|---|---|
| `Visite` | Passage patient : patient, site, motif principal, statut, soignant assigné, notes d'accueil, type de clôture, dates d'ouverture/clôture, indicateur `creerHorsLigne`, `version`. |
| `ConstanteVitale` | Mesures rattachées à la visite : température, tensions systolique/diastolique, fréquence cardiaque, SpO₂, poids, taille, IMC, glycémie, auteur de la saisie. |
| `VisiteEvenement` | Journal d'audit de la visite : une ligne par changement de statut, de soignant, de notes (et `PRIORITE_CHANGE`, conservé en base mais non exposé dans l'UI). |

Données consommées en lecture depuis les autres modules :

- **Dossier patient** : identité, catégorie + droits de prise en charge, allergies, antécédents, **alertes médicales actives** (affichées dans la barre latérale de la visite, avec mise en évidence des alertes `CRITIQUE`).
- **Référentiels** : motifs de consultation, catégories patients et droits associés, sites.
- **Acteurs administratifs** : personnel médical présent et délégations de prescription actives (pour l'orientation vers un infirmier délégué).

## 4. Processus principal (implémenté)

1. L'infirmier recherche le patient (recherche intégrée au tiroir *Nouvelle visite*) ou crée son dossier s'il est inconnu.
2. Il ouvre une visite : sélection du **motif principal** (référentiel) et du **site**.
3. Le système charge automatiquement la **catégorie, les droits** et les **alertes médicales** du patient.
4. L'infirmier saisit les **constantes vitales** ; l'**IMC est calculé en temps réel** à partir du poids et de la taille, avec classification affichée (Insuffisance pondérale / Normal / Surpoids / Obésité).
5. Les **valeurs anormales sont colorées automatiquement** (avertissement / danger) selon des seuils cliniques codés (voir §9).
6. Il ajoute les observations utiles dans les **notes d'accueil**.
7. Il **oriente** la visite vers le médecin chef ou un infirmier délégué (assignation d'un soignant).
8. Le patient rejoint la **file d'attente**, mise à jour **en temps réel** sur tous les postes.
9. Après consultation, la visite est **clôturée** ; le type de clôture distingue `AVEC_CONSULTATION` et `SANS_CONSULTATION`.

Chaque action structurante (changement de statut, de soignant, des notes) génère une ligne dans `VisiteEvenement`, assurant la traçabilité complète de la visite. Les mutations sont en outre journalisées par l'intercepteur d'audit global (`@Audit` → `JournalAudit`, avec IP et géolocalisation).

## 5. Cas alternatifs (couverts)

- **Patient inconnu** : création du dossier patient avant l'ouverture de la visite (parcours intégré).
- **Droits suspendus** : la catégorie et les droits sont affichés ; les restrictions sont visibles à l'ouverture.
- **Constantes anormales** : signalées visuellement (coloration) dans le formulaire et dans la barre latérale de suivi.
- **Patient avec alerte médicale active** : les alertes (dont les `CRITIQUE`) sont remontées dans la barre latérale.
- **Annulation** : la visite peut être annulée avec saisie d'un `motifAnnulation` (statut `ANNULEE`).
- **Coupure réseau** : ouverture de visite et saisie de constantes en mode hors ligne (`creerHorsLigne`), rejouées à la reconnexion.

## 6. Règles métier (appliquées)

- Aucune consultation ne peut exister sans visite ouverte (la consultation est rattachée à une `Visite`).
- Le **motif principal** doit provenir du référentiel `MotifConsultation`.
- Les **constantes** sont datées (`createdAt`) et rattachées à la visite ainsi qu'à l'auteur de la saisie (`saisiePar`).
- L'**IMC** est dérivé (poids/taille²) et stocké avec les constantes.
- Une orientation vers un infirmier délégué suppose une **délégation de prescription active** côté Acteurs.
- Une **visite clôturée** n'est plus modifiable sans correction encadrée (réservée à l'administrateur médical).
- Chaque transition est tracée dans `VisiteEvenement` ; le champ `version` supporte la cohérence offline/online.

## 7. États et statuts (as-built)

**Statut de la visite** — enum `StatutVisite` réellement implémenté (cycle simplifié à 4 états) :

| Valeur | Signification |
|---|---|
| `EN_ATTENTE` | Visite ouverte, en attente de prise en charge (présente dans la file). |
| `EN_COURS` | Visite prise en charge / en consultation. |
| `CLOTUREE` | Visite terminée (clôture `AVEC_CONSULTATION` ou `SANS_CONSULTATION`). |
| `ANNULEE` | Visite annulée (avec `motifAnnulation`). |

> **Note d'écart (conception → réalisation) :** le cahier des charges initial prévoyait six états (`OUVERTE`, `EN_ATTENTE_CONSULTATION`, `EN_CONSULTATION`, `EN_ATTENTE_CLOTURE`, `CLOTUREE`, `ANNULEE`). Le cycle a été **simplifié à 4 états** pour réduire les transitions inutiles et fiabiliser la synchronisation offline.

**Priorité — RETIRÉE de l'interface.** La notion de priorité (`NORMALE` / `PRIORITAIRE` / `URGENTE`) a été **supprimée de l'UI** : la file fonctionne désormais **par ordre d'arrivée**. Le type d'événement `PRIORITE_CHANGE` reste défini en base (`VisiteEvenement`) à des fins de compatibilité et d'extension, mais **n'est plus exposé ni modifiable** dans l'application. Cette colonne/typologie ne doit pas être réintroduite dans l'interface.

## 8. Écrans réalisés

- **Page Triage** (`TriagePage`) : vue principale avec liste des visites du jour et panneau latéral de détail.
- **Tiroir « Nouvelle visite »** (`NouvelleVisiteDrawer`) : recherche/création patient, choix du motif, saisie initiale des constantes.
- **Formulaire de constantes** (`ConstantesForm`) : saisie des mesures, **IMC calculé et classé en direct**, validation des plages (champs cohérents avec les DTO backend), coloration des anomalies.
- **Barre latérale de visite** (`VisiteSidebar`) : dernières constantes (avec sévérité colorée), IMC, compteur d'alertes médicales et antécédents du patient.
- **Carte d'actions** (`ActionsCard`) : ouverture/prise en charge, assignation de soignant (orientation), clôture, annulation, suppression.
- **File d'attente / tableau des visites du jour** : mise à jour temps réel.

## 9. Notifications et alertes (codées)

**Coloration automatique des constantes** (seuils implémentés) :

| Constante | Avertissement | Danger |
|---|---|---|
| Température | ≥ 37,5 °C | ≥ 38,5 °C |
| Tension systolique | ≥ 140 mmHg | ≥ 160 mmHg |
| SpO₂ | < 95 % | < 90 % |
| IMC (classification) | Surpoids (25–30) | Obésité (≥ 30) — Insuffisance pondérale (< 18,5) signalée en info |

Autres signalements :

- **Alertes médicales actives** du patient remontées dans la barre latérale, avec emphase sur les alertes `CRITIQUE`.
- **Droits / catégorie** affichés à l'ouverture (restrictions visibles).
- Le module est intégré au **flux de notifications temps réel** (SSE) et au mécanisme **LIVE** d'invalidation des caches (file et constantes rafraîchies sur tous les postes sans rechargement).

## 10. Permissions (catalogue réel)

Le module expose **7 permissions** dédiées (sur les 110 du catalogue `packages/types/src/permissions.ts`, module `visite`) :

| Permission | Libellé | INFIRMIER | INFIRMIER_DELEGUE | MEDECIN_CHEF | ADMIN_MEDICAL |
|---|---|:--:|:--:|:--:|:--:|
| `visite.read` | Consulter les visites de triage | ✔ | ✔ | ✔ | ✔ |
| `visite.create` | Ouvrir une visite | ✔ | ✔ | | ✔ |
| `visite.update` | Modifier une visite | ✔ | ✔ | | ✔ |
| `visite.assign_soignant` | Assigner un soignant (orientation) | ✔ | ✔ | | ✔ |
| `visite.cancel` | Annuler une visite | ✔ | ✔ | | ✔ |
| `visite.close` | Clôturer une visite | ✔ | ✔ | | ✔ |
| `visite.delete` | Supprimer définitivement une visite | | | | ✔ |

Les permissions sont attribuées par rôle, ajustables par **dérogations individuelles** (GRANT/REVOKE via `UtilisateurPermission`). La correction d'une visite clôturée et la suppression définitive relèvent de l'administration médicale.

> **Note d'écart :** la permission « Modifier priorité » du cahier initial **n'existe pas** dans le catalogue (notion de priorité retirée de l'UI).

## 11. Dépendances

- **Dossier patient** : identité, catégorie, droits, allergies, antécédents et alertes médicales.
- **Référentiels** : motifs de consultation, catégories et droits, sites.
- **Acteurs administratifs** : personnel médical et délégations de prescription (orientation vers infirmier délégué).
- **Consultation / actes** : consomme la file d'attente (la `Consultation` se rattache à la `Visite`).
- **Synchronisation offline-first** : PWA Workbox + file de rejeu IndexedDB (`apps/web/src/lib/sync.ts`) + `useSyncEngine`, garantissant la continuité hors ligne.

## 12. Critères d'acceptation (vérifiés)

- Une visite ne peut être ouverte pour un patient introuvable sans création préalable de dossier.
- Les constantes anormales sont mises en évidence (coloration) et l'IMC est calculé/classé automatiquement.
- La file d'attente se met à jour en temps réel (SSE / LIVE) sur tous les postes.
- Une visite clôturée ou annulée quitte la file active.
- Une coupure réseau ne bloque pas l'ouverture d'une visite ni la saisie des constantes (mode hors ligne + rejeu).
- Chaque transition de visite est tracée (`VisiteEvenement` + audit global).

## 13. Points de risque

- Le triage est un point critique du flux : sa fluidité conditionne le débit de tout le CMS.
- Les alertes doivent rester lisibles et hiérarchisées (privilégier les signaux `CRITIQUE`).
- Une procédure papier de secours doit exister hors application en cas de panne matérielle complète.

## 14. Limites et extensions futures

- **Seuils d'alerte non paramétrables** : les bornes cliniques (température, tension, SpO₂, IMC) sont actuellement codées ; une configuration par site/catégorie est une extension envisageable.
- **Priorité de file** : volontairement retirée de l'UI ; sa réactivation éventuelle (file priorisée) reste une extension, l'ossature DB étant conservée.
- **Tests automatisés** : la couverture repose sur la vérification de types (`tsc`), le build et des tests E2E navigateur manuels ; une suite de tests automatisés étendue reste à constituer (extension).
- **Suivi grossesse complet** et **planning/présence du personnel** : tables présentes au schéma mais hors périmètre fonctionnel actuel.
