# Vision — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document de cadrage « as-built » : il décrit la vision du système **tel qu'il est développé et déployé**. Référence de vérité : [[_SOURCE_systeme]]. Voir aussi le [[glossaire]] (terme unique) et la [[plan_modules]].

---

## 1. Problème résolu

Le Centre Médico-Social (CMS) de **SARIS-CONGO** (sucrerie, Congo-Brazzaville) assure les soins de premier recours pour les **travailleurs** de la société et les personnes qui leur sont rattachées (ayants droit, sous-traitants, riverains), sur **deux sites distants** : **Moutela** et **Nkayi**.

Avant CMS SARIS, ce suivi était tenu « à la main » : un fonctionnement **Excel + papier** (le « suivi façon Jeannette »). Ce mode pose plusieurs problèmes documentés dans le recueil de l'existant :

- **Pas de dossier patient unique** : un même patient vu sur les deux sites n'a pas d'historique consolidé.
- **Multi-site non synchronisé** : aucune cohérence automatique entre Moutela et Nkayi ; ressaisies, divergences, pertes.
- **Réseau instable** : sur site, l'outil doit pouvoir fonctionner **même hors connexion**, ce qu'Excel/papier « gère » au prix de la fragmentation.
- **Droits par catégorie tenus de tête** : seuls certaines catégories de patients (assurés CDI et leurs ayants droit) ont droit aux bons de pharmacie et d'examen ; cette règle reposait sur la vigilance humaine.
- **Traçabilité faible** : pas de journal des actes, des accès, ni des décisions médicales.

CMS SARIS **remplace ce suivi Excel/papier** par une application médico-sociale **offline-first multi-poste**, qui couvre le parcours patient de l'arrivée au CMS jusqu'à la décision médicale finale, tout en sécurisant accès, droits, traces et synchronisation entre les sites.

## 2. Proposition de valeur

| Axe | Apport de CMS SARIS |
|---|---|
| **Dossier unique cross-site** | Le dossier patient suit le patient sur les deux sites ; identité, allergies, antécédents, alertes, données d'emploi consolidés (`apps/api/src/modules/patient`). |
| **Offline-first multi-poste** | L'application de bureau (Electron, backend + base SQLite embarqués) fonctionne **hors-ligne** et se **synchronise** avec le serveur central à la reconnexion, réconciliation « dernier écrit gagne » (LWW) (`apps/api/src/modules/sync`, `apps/desktop/electron`). |
| **Parcours guidé** | Triage par ordre d'arrivée → consultation pilotée par la décision → documents cliniques imprimables (`modules/triage`, `modules/consultation`). |
| **Droits pilotés par la catégorie** | Les bons (pharmacie, examen) sont automatiquement réservés aux catégories couvertes (assurés CDI + ayants droit), garde appliquée côté serveur (`apps/api/src/common/droits-categorie.ts`). |
| **Sécurité & traçabilité** | Authentification JWT à session unique, 2FA TOTP chiffrée, permissions par rôle (~110), journal d'audit persistant, IP réelle + géolocalisation hors-ligne. |
| **Collaboration interne** | Messagerie chiffrée façon WhatsApp Web, cloisonnée par site, temps réel ; notifications et annonces (`modules/messagerie`, `modules/notification`). |
| **Pilotage** | Tableaux de bord et statistiques par rôle, exports CSV/PDF (`modules/dashboard`). |

## 3. Bénéficiaires

CMS SARIS s'adresse à **quatre rôles** (système réduit — voir [[MODULE_02_acces_habilitations]]) :

| Rôle | Bénéfice principal |
|---|---|
| **ADMIN_SYSTEME** | Super-administrateur : gouvernance (comptes, rôles, permissions, sessions, paramètres, synchronisation, audit) et accès clinique complet. |
| **MEDECIN_CHEF** | Admin médical + supervision : voit l'ensemble du clinique de son site, peut **verrouiller** un dossier en confidentialité. |
| **MEDECIN** | Conduit ses propres consultations et prescriptions. |
| **INFIRMIER** | Réalise le triage, les constantes et la consultation/prescription (prescription via délégation). |

> Supervision = { ADMIN_SYSTEME, MEDECIN_CHEF }.

**Bénéficiaires finaux indirects** : les **patients** du CMS — travailleurs SARIS (assurés CDI, CDD), **ayants droit** rattachés par matricule, personnel de **sociétés sous-traitantes**, et **riverains**. Les catégories de patients (`référentiel CategoriePatient`) pilotent les droits aux bons.

> Contexte d'usage : projet de **soutenance** (stage à SARIS), déployé sur le cloud pour la démonstration ; la cible réelle est le réseau interne SARIS, ultérieurement.

## 4. Périmètre du MVP livré

Le système livré couvre les modules fonctionnels suivants (noms canoniques — détaillés dans [[plan_modules]] et les fiches `02_modules/`) :

- **Triage / file d'attente** — visites, constantes vitales, file **par ordre d'arrivée** (pas de notion de priorité).
- **Consultation** — consultation pilotée par la décision, clôture guidée, type de consultation.
- **Patients / Dossier** — dossier centralisé cross-site, identité, allergies, antécédents, alertes, mode de vie, données d'emploi ; verrou de confidentialité médecin-chef ; ayants droit par matricule.
- **Documents cliniques** — ordonnance, bon d'examen, **bon de pharmacie**, évacuation (imprimables, gabarit A4 SARIS).
- **Évacuations** (sorties critiques).
- **Référentiels** — catégories patient, motifs, pathologies, médicaments, types d'examen, types de consultation, sociétés sous-traitantes, registre des employés SARIS.
- **Accès & habilitations** — utilisateurs, rôles, permissions (~110), récupération de compte, sessions ; personnel médical, habilitations, absences.
- **Messagerie interne** — chat chiffré AES-256-GCM, cloisonné par site, temps réel SSE.
- **Notifications & Annonces** — cloche + SSE, annonces admin, annonces de mise à jour (lien d'installation desktop).
- **Tableau de bord & Statistiques** — KPI par rôle, stats type × pathologie × catégorie, exports CSV/PDF.
- **Synchronisation** — supervision des postes, file terrain, sauvegardes de configuration, volumétrie.
- **Paramètres** — configuration système (mots de passe, sessions, notifications, sauvegardes).
- **Audit & sécurité** — journal d'audit persistant, IP réelle + géolocalisation, conditions d'utilisation (CGU).

**Échelle de données (as-built)** : 87 tables Prisma (UUID majoritaire, colonnes de synchronisation `updatedAt`/`deletedAt`) ; 110 permissions (`packages/types/src/permissions.ts`). Schémas : `packages/db/prisma/schema.prisma` (PostgreSQL central) et `packages/db/prisma/sqlite/schema.prisma` (desktop).

> **À confirmer** : la trajectoire d'alignement au recueil de l'existant a fait évoluer le périmètre clinique (recentrage sur le cœur métier : catégories pilotant les droits aux bons, bon de pharmacie distinct de l'ordonnance ; retrait du certificat, des suivis chronique/grossesse et accident du travail comme branches de décision). Le périmètre clinique exact (décisions de consultation, documents actifs) doit être figé dans [[MODULE_09_consultation]] sur la base du code courant — ne pas se fier au seul présent document.

## 5. Anti-périmètre (ce que le système N'EST PAS)

Pour cadrer les attentes et éviter le glissement de périmètre, CMS SARIS **n'est explicitement pas** :

- **Un Dossier Patient Informatisé (DPI) hospitalier complet** : pas de spécialités, blocs opératoires, hospitalisation, plateaux techniques, imagerie intégrée. C'est un outil de **soins de premier recours** en centre médico-social.
- **Un système de facturation / d'assurance** : pas de tarification, de facturation patient, ni de transmission CNSS/organismes d'assurance. Les « droits » modélisés sont des **droits d'accès aux prestations** (bons), pas des droits financiers.
- **Une plateforme de télémédecine** : pas de téléconsultation, de visioconférence clinique, ni de prise en charge à distance. La messagerie interne est un outil de **collaboration entre soignants**, pas un canal patient.
- **Un système de gestion de stock / pharmacie physique** : pas de délivrance physique de médicaments, ni de gestion de stocks, réapprovisionnement ou commandes. Le **bon de pharmacie** est un **bon de droit** (voucher) ; la délivrance réelle reste hors système.
- **Un laboratoire / SGL** : pas de transmission automatique aux laboratoires ni d'intégration d'automates ; le **bon d'examen** est une demande, la saisie de résultat reste manuelle.
- **Un SIRH / outil RH d'entreprise** : pas de paie, de planning RH d'entreprise, ni de gestion de carrière. Le registre des employés SARIS sert uniquement à **reconnaître les ayants droit par matricule** ; les habilitations/absences gérées concernent le **personnel soignant du CMS**, à minima.
- **Un moteur de reporting directionnel centralisé** : pas de reporting agrégé inter-établissements ni d'entrepôt décisionnel ; les statistiques restent **opérationnelles et site-filtrées**.

> Source de l'anti-périmètre : recueil de l'existant et hors-périmètre MVP (cf. contexte global CMS SARIS « Hors périmètre MVP strict » : délivrance physique de médicaments, gestion des stocks, reporting agrégé directionnel, moteur centralisé d'exports, transmission automatique CNSS/SIRH/laboratoires).

## 6. Objectifs de la soutenance

CMS SARIS est livré dans le cadre d'une **soutenance de stage** à SARIS-CONGO. Les objectifs démontrables sont :

1. **Prouver l'offline-first multi-poste** : montrer un poste de bureau travaillant **hors-ligne** (backend + SQLite embarqués) puis se **synchronisant** avec le serveur central cloud (API NestJS sur Render, PostgreSQL sur Neon) — réconciliation LWW, soft-delete, tombstones.
2. **Dérouler le parcours clinique** : triage par ordre d'arrivée → consultation pilotée par la décision → documents imprimables (A4 SARIS), de bout en bout.
3. **Démontrer le cœur métier** : la **catégorie de patient pilote les droits** (bons de pharmacie et d'examen réservés aux assurés CDI et ayants droit), avec garde appliquée côté serveur.
4. **Attester la sécurité** : authentification JWT à session unique, 2FA TOTP, permissions par rôle, journal d'audit, chiffrement at-rest (TOTP, messagerie).
5. **Illustrer la collaboration & le pilotage** : messagerie temps réel chiffrée, notifications/annonces, tableaux de bord et statistiques avec exports.
6. **Montrer une mise en ligne réelle** : un central cloud opérationnel (web public PWA + API + base) et un installeur de bureau Windows, validant la faisabilité d'un déploiement sur le réseau SARIS.

> La cible réelle (déploiement on-premise sur le réseau SARIS) est **postérieure à la soutenance** et conditionnée à la validation par SARIS. Voir [[modele_operationnel]].
