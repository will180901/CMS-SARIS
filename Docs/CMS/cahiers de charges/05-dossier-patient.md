# Document 05 - Dossier Patient

> **Statut de réalisation : RÉALISÉ.** Le module Dossier Patient est entièrement codé et fonctionnel dans CMS SARIS. Ce document décrit l'état réel de l'application (as-built) : identité administrative (avec photo), contacts d'urgence, allergies, antécédents, alertes médicales, catégorie + historique de catégorie, rattachements ayant-droit (CDI et sous-traitant), constantes vitales agrégées, détection de doublons et génération de documents imprimables. Les éléments non encore exposés (suivi grossesse complet, habitudes de vie structurées, et la **fusion de doublons** — dont la structure de données et la permission sont en place, mais le flux d'exécution n'est pas encore exposé) sont signalés comme **EXTENSION FUTURE**.

## 1. Objectif

Centraliser toutes les informations administratives et médicales utiles à la prise en charge d'un patient au sein du centre médico-social, et les rendre disponibles en temps réel aux points de soin (triage, consultation, prescription, sorties critiques).

Le dossier patient constitue le référentiel unique du patient : un patient ne possède qu'un seul dossier principal, identifié par un numéro patient unique. Toutes les données médicales et administratives s'y rattachent, et les changements sensibles (catégorie, statut, fusion) sont tracés et historisés.

## 2. Acteurs concernés

| Acteur | Rôle technique | Implication |
|---|---|---|
| Infirmier | `INFIRMIER` | Recherche, création, lecture du dossier, saisie des données médicales selon périmètre. |
| Infirmier délégué | `INFIRMIER_DELEGUE` | Idem infirmier, selon dérogations accordées. |
| Médecin chef | `MEDECIN_CHEF` | Lecture et validation des données médicales sensibles, changement de catégorie, archivage. |
| Administrateur médical | `ADMIN_MEDICAL` | Corrections encadrées, fusion de doublons, archivage. |
| Agent RH | `AGENT_RH` | Gestion des rattachements ayant-droit / sous-traitant (partie administrative). |
| Administrateur système | `ADMIN_SYSTEME` | Super-administrateur, accès complet au catalogue (110 permissions). |

> Les permissions sont granulaires (catalogue `packages/types/src/permissions.ts`) et chaque rôle reçoit un sous-ensemble ; des dérogations individuelles GRANT/REVOKE peuvent être accordées par compte.

## 3. Données manipulées

Le module s'appuie sur **11 tables Prisma** dédiées au dossier patient (sur les 78 du schéma global). Les noms exacts proviennent de `packages/db/prisma/schema.prisma`.

| Table | Contenu | État |
|---|---|---|
| `Patient` | Dossier principal : numéro patient unique, site de création, catégorie, statut, version, audit. | RÉALISÉ |
| `IdentitePatient` | Identité administrative : nom, prénom, date de naissance, sexe, téléphone, adresse, photo (`photoUrl`). | RÉALISÉ |
| `ContactUrgence` | Contact d'urgence : nom, prénom, téléphone, lien de parenté. | RÉALISÉ |
| `AllergiePatient` | Allergies : substance, gravité, confirmation, statut. | RÉALISÉ |
| `AntecedentPatient` | Antécédents : type, description, statut. | RÉALISÉ |
| `AlerteMedicale` | Alertes médicales : type, message, gravité, statut, date de résolution. | RÉALISÉ |
| `HistoriqueCategoriePatient` | Historique des changements de catégorie : ancienne / nouvelle catégorie, date d'effet, motif, auteur. | RÉALISÉ |
| `FusionDossierPatient` | Traçabilité de la fusion de doublons : dossier source, dossier cible, auteur, date. | Structure RÉALISÉE (flux d'exécution : EXTENSION) |
| `PreSaisieMedicale` | Données médicales pré-saisies (non validées) rattachées au patient / à une visite. | RÉALISÉ (table) |
| `SuiviGrossesse` | Suivi de grossesse : date prévue d'accouchement, statut, devenir. | EXTENSION FUTURE (table présente, suivi complet hors périmètre) |
| `ConsultationPrenatale` | Consultations prénatales rattachées à un suivi de grossesse. | EXTENSION FUTURE |

Tables connexes consommées par le dossier :

- `ConstanteVitale` (module Triage) : constantes agrégées et affichées dans la synthèse et l'onglet Constantes.
- `RattachementAyantDroitCdi`, `HistoriqueRattachementAyantDroit`, `RattachementSousTraitant`, `HistoriqueRattachementSousTraitant` (module Acteurs) : rattachements gérés depuis le dossier patient.
- `CategoriePatient` et `DroitCategoriePatient` (Référentiels) : catégorie courante et droits associés.

> **Note — Habitudes de vie.** Les habitudes de vie ne disposent pas (encore) d'une table structurée dédiée ; elles peuvent être consignées via les antécédents / pré-saisie. Une structuration dédiée est une **EXTENSION FUTURE**.

## 4. Processus principal (implémenté)

1. L'utilisateur recherche le patient (liste paginée, recherche serveur).
2. Si le patient existe, il ouvre le dossier (synthèse + onglets).
3. Si le patient n'existe pas, il lance la création ; un **contrôle de doublon** est exécuté (`GET /patients/similar`) et propose les dossiers ressemblants avant validation.
4. Les données administratives (identité, photo, contact d'urgence, rattachements) et médicales (allergies, antécédents, alertes) sont complétées.
5. Les alertes critiques (allergie absolue, alerte médicale active, grossesse active) sont remontées aux points de soin via l'endpoint des **alertes cliniques** (`GET /patients/:id/alertes-cliniques`).
6. Le dossier est enrichi à chaque visite (constantes, consultations, documents).
7. Les changements sensibles (catégorie, statut, fusion) sont historisés et **audités** (interceptor global `@Audit` → `JournalAudit`, avec IP et géolocalisation).

## 5. Cas alternatifs (implémentés)

- **Doublon probable** : la détection de similarité présente les dossiers proches ; l'utilisateur confirme la création ou ouvre le dossier existant.
- **Patient décédé / archivé** : changement de statut (`PATCH /patients/:id/statut`) ; le dossier n'accepte plus de nouvelle visite ordinaire.
- **Catégorie modifiée** : changement via `PATCH /patients/:id/categorie` avec historisation obligatoire (`HistoriqueCategoriePatient` : ancienne / nouvelle catégorie, date d'effet, motif, auteur).
- **Allergie absolue** : remontée en alerte forte lors de la prescription (contrôle d'allergies dans le module Consultation/Ordonnance).
- **Grossesse active** : remontée en alerte clinique (table `SuiviGrossesse` ; suivi complet en extension future).
- **Suppression de dossier** : suppression sûre `409-safe` (`DELETE /patients/:id`) refusée si le dossier porte un historique médical, conformément aux règles métier.

## 6. Règles métier (en vigueur)

- Un patient possède un **seul dossier principal**, identifié par un numéro patient **unique**.
- Un dossier ne peut **pas** être supprimé s'il a un historique médical (suppression `409-safe`).
- Les allergies et antécédents sont **visibles en consultation** (consommés par le module Consultation/Prescription).
- Le contact d'urgence est requis pour les cas critiques (sorties critiques : évacuation, accident du travail).
- Un changement de catégorie conserve **ancienne catégorie, nouvelle catégorie, date d'effet, auteur et motif**.
- La **structure de fusion de doublons** est en place (table `FusionDossierPatient` source / cible, statut `FUSIONNE`, permission `patient.merge` affectée à l'administrateur médical) ; le **flux d'exécution n'est pas encore exposé** (EXTENSION FUTURE). À terme, une fusion conservera l'historique des deux dossiers et passera le dossier source au statut `FUSIONNE`.
- Toute mutation sensible est **journalisée** (audit persistant, IP + géolocalisation).

## 7. États et statuts

**Dossier patient** (`StatutPatient`) :

- `ACTIF`
- `ARCHIVE`
- `DECEDE`
- `FUSIONNE`

**Alerte médicale** (champ `statut`) :

- `ACTIVE`
- `RESOLUE` (avec `resolvedAt`)
- `ANNULEE`

**Allergie** (champ `statut`) : `ACTIVE` (par défaut) / résolue-annulée selon usage ; champ `confirme` (booléen) et `gravite`.

**Antécédent** (champ `statut`) : `ACTIF` par défaut.

**Suivi grossesse** (champ `statut`) — *EXTENSION FUTURE* :

- `ACTIF` / `EN_COURS`
- `CLOTURE`
- `INTERROMPU`

## 8. Écrans réalisés

Le dossier est présenté en **synthèse + onglets** (composants `apps/web/src/modules/patients/components/dossier/`) :

| Écran / Onglet | Composant | État |
|---|---|---|
| Recherche et liste patients | Liste paginée + recherche serveur | RÉALISÉ |
| Création de dossier (avec contrôle de doublon) | Flux de création + `similar` | RÉALISÉ |
| Identité et catégorie (+ photo) | `IdentiteTab.tsx` | RÉALISÉ |
| Antécédents et allergies | `AntecedentsTab.tsx` | RÉALISÉ |
| Alertes médicales | `AlertesTab.tsx` | RÉALISÉ |
| Constantes vitales | `ConstantesTab.tsx` | RÉALISÉ |
| Consultations | `ConsultationsTab.tsx` | RÉALISÉ |
| Historique de catégorie | `HistoriqueTab.tsx` | RÉALISÉ |
| Frise chronologique du dossier | `TimelineTab.tsx` | RÉALISÉ |
| Rattachements (CDI / sous-traitant) | `RattementsTab.tsx` | RÉALISÉ |
| Documents générés | `DocumentsTab.tsx` | RÉALISÉ |
| Aperçu / impression du dossier (A4) | `DossierPrintModal.tsx` | RÉALISÉ |
| Confirmation de suppression (409-safe) | `ConfirmDeleteModal.tsx` | RÉALISÉ |
| Fusion de doublons | Structure + permission `patient.merge` en place ; flux non encore exposé | EXTENSION |
| Suivi grossesse / consultation prénatale | — | EXTENSION FUTURE |
| Habitudes de vie structurées | — | EXTENSION FUTURE |

## 9. Notifications et alertes (réalisées)

- **Doublon probable** : à la création, via la détection de similarité.
- **Allergie critique** : remontée en alerte clinique et contrôlée en prescription.
- **Alerte médicale active** : affichée aux points de soin (endpoint alertes cliniques).
- **Grossesse active** : remontée en alerte clinique (suivi complet = extension future).
- **Contact d'urgence manquant** : signalé pour les cas critiques.
- **Catégorie modifiée / dossier archivé** : tracés (historique + audit).

Les invalidations de données du dossier sont propagées en **temps réel** via le flux SSE global (notifications temps réel → invalidations react-query, mécanisme LIVE silencieux).

## 10. Permissions (catalogue réel)

Permissions dédiées au patient (préfixe `patient.`) du catalogue (110 permissions au total) :

| Permission technique | Action | Profils typiques |
|---|---|---|
| `patient.read` | Lire un dossier | Infirmier, médecin chef, agents autorisés |
| `patient.create` | Créer un dossier (avec contrôle de doublon) | Infirmier, médecin chef |
| `patient.update` | Modifier identité, photo, allergies, antécédents, alertes | Infirmier, médecin chef selon périmètre |
| `patient.change_category` | Changer la catégorie (historisée) | Médecin chef |
| `patient.archive` | Changer le statut (archiver / décédé) | Médecin chef, admin médical |
| `patient.merge` | Fusionner des doublons | Administrateur médical |
| `patient.delete` | Supprimer un dossier (409-safe) | Administrateur médical |
| `patient.rattachement.manage` | Gérer les rattachements ayant-droit (CDI / sous-traitant) | Agent RH, admin médical |

> Toutes les mutations du contrôleur patient sont protégées par `@RequirePermissions` et journalisées par l'interceptor `@Audit('patient', 'Patient')`.

## 11. Dépendances

- **Triage** : ouvre les visites depuis le dossier ; alimente les constantes vitales agrégées dans le dossier.
- **Consultation** : lit alertes, antécédents et historique ; rattache consultations et pré-saisies.
- **Prescription / Ordonnance** : lit allergies, contre-indications et grossesse pour les contrôles de sécurité.
- **Sorties critiques** : lisent contact d'urgence et historique (évacuation, accident du travail).
- **Acteurs administratifs** : alimentent les rattachements et peuvent déclencher un changement de catégorie.
- **Référentiels** : catégories patients et leurs droits.
- **Audit / Sécurité** : toutes les mutations sont auditées (IP + géolocalisation).

## 12. Critères d'acceptation (vérifiés)

- La recherche et la détection de similarité limitent les doublons à la création. ✔
- Le dossier affiche clairement les alertes critiques aux points de soin. ✔
- Les constantes sont historisées et consultables. ✔
- Une catégorie modifiée conserve l'historique complet (ancienne/nouvelle, date, motif, auteur). ✔
- La fusion de doublons dispose de sa structure de traçabilité (`FusionDossierPatient`) ; le flux d'exécution reste une **extension** à venir. ⏳
- La suppression est refusée (409) si un historique médical existe. ✔
- Un suivi grossesse actif influence la prescription. ◻ *(alerte clinique réalisée ; suivi complet = extension future).*

## 13. Points de risque et limites

- **Doublons** : risque majeur si la recherche est faible ; mitigé par la détection de similarité, mais la confirmation reste humaine.
- **Distinction pré-saisie / validé** : les données médicales pré-saisies (`PreSaisieMedicale`, champ `valide`) doivent rester distinguées des données validées.
- **Densité d'information** : la présentation en onglets évite la surcharge d'un écran unique.
- **Tests** : pas de suite de tests automatisés étendue à ce jour (quelques tests E2E navigateur manuels, vérification de typage `tsc` et build) — à considérer comme une limite et une extension future, non comme un acquis.
- **Suivi grossesse / habitudes de vie** : tables présentes mais expérience complète non exposée (extension future).

## 14. Synthèse de réalisation

| Bloc fonctionnel | État |
|---|---|
| Identité administrative (+ photo) | RÉALISÉ |
| Contact d'urgence | RÉALISÉ |
| Allergies (CRUD) | RÉALISÉ |
| Antécédents (CRUD) | RÉALISÉ |
| Alertes médicales (CRUD) | RÉALISÉ |
| Catégorie + historique de catégorie | RÉALISÉ |
| Fusion de doublons (structure + permission) | EXTENSION — flux non encore exposé |
| Détection de doublons à la création | RÉALISÉ |
| Rattachements ayant-droit (CDI / sous-traitant) | RÉALISÉ |
| Constantes vitales agrégées | RÉALISÉ |
| Alertes cliniques aux points de soin | RÉALISÉ |
| Documents générés / impression A4 | RÉALISÉ |
| Suppression 409-safe + audit | RÉALISÉ |
| Suivi grossesse complet / consultation prénatale | EXTENSION FUTURE |
| Habitudes de vie structurées | EXTENSION FUTURE |
