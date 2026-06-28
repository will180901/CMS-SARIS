# Carte des domaines — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Ce document découpe le système **tel que construit** (as-built) en **domaines fonctionnels**
> (bounded contexts), recherchant une **forte cohésion** interne et un **faible couplage** entre
> domaines. Il s'appuie sur le brief canonique [[_SOURCE_systeme]], le glossaire [[glossaire]],
> et le code réel (`apps/api/src/modules`, `apps/web/src/modules`). Le détail module par module
> est traité dans [[plan_modules]]. Les chiffres et termes ne sont définis qu'une fois (ici par
> référence) — voir [[glossaire]] pour les définitions canoniques.

## 1. Principes de découpage

- **Cohésion** : un domaine regroupe les modules qui partagent un même langage métier et un même
  cycle de vie de données.
- **Couplage faible** : les domaines communiquent par des frontières explicites — identifiants
  (UUID, matricule), événements temps réel (SSE), et le journal de synchronisation — plutôt que
  par accès direct aux données internes d'un autre domaine.
- **Source unique** : le **Dossier patient** est l'agrégat central cross-site ; les autres domaines
  cliniques s'y rattachent par référence. Voir [[_SOURCE_systeme]] §Données.
- **Honnêteté** : seuls les domaines effectivement présents dans le code sont listés. Les noms
  techniques de modules cités proviennent de `apps/api/src/modules` et `apps/web/src/modules`.

## 2. Vue d'ensemble (11 domaines)

| # | Domaine | Mission (résumé) | Modules code principaux |
|---|---------|------------------|-------------------------|
| D-01 | Accueil & Triage | Recevoir le patient, file par ordre d'arrivée, constantes | `triage` |
| D-02 | Soins (Consultation & documents) | Consultation pilotée par la décision, documents cliniques | `consultation`, `bon-examen`, `bon-pharmacie`, `sorties-critiques` |
| D-03 | Dossier patient | Agrégat patient centralisé cross-site, verrou de confidentialité | `patient` |
| D-04 | Référentiels | Données de référence pilotant les règles métier | `referentiels`, `employe` |
| D-05 | Acteurs & RH | Personnel soignant, habilitations, absences | `personnel`, acteurs (web) |
| D-06 | Accès & Sécurité | Utilisateurs, rôles, permissions, auth, audit, CGU | `admin` (roles/utilisateurs), `auth` (web), `security` |
| D-07 | Communication | Messagerie chiffrée, notifications, annonces | `messagerie`, `notification` |
| D-08 | Pilotage | Tableaux de bord par rôle, statistiques, exports | `dashboard` |
| D-09 | Synchronisation & Offline | Sync multi-poste LWW, file terrain, sauvegardes | `sync`, `admin/synchronisation` |
| D-10 | Administration & Paramètres | Config système, paramètres globaux | `parametres`, `admin/parametres` |
| D-11 | Audit | Journal d'audit persistant, IP/géo, traçabilité | `admin/audit`, interceptor `@Audit` |

> Note : « Audit » est présenté comme domaine transversal distinct (D-11) car il intercepte les
> mutations de plusieurs domaines ; il est techniquement hébergé dans le module `admin`.

## 3. Domaines en détail

### D-01 — Accueil & Triage
- **Mission** : enregistrer l'arrivée d'un patient, créer la **visite**, saisir les **constantes
  vitales**, et alimenter la **file d'attente par ordre d'arrivée** (PAS de notion de priorité,
  cf. [[_SOURCE_systeme]] et mémoire « priorité supprimée »).
- **Modules** : `apps/api/src/modules/triage`, `apps/web/src/modules/triage`.
- **Frontières** : crée/identifie le patient (déduplication) en s'appuyant sur le **Dossier patient**
  (D-03) ; ne porte pas la décision clinique. Une visite triée alimente la file consommée par les Soins.
- **Interactions principales** :
  - → **Dossier patient (D-03)** : recherche/création d'identité, lecture des alertes et antécédents.
  - → **Soins (D-02)** : transmet la visite en file ; la prise en charge fait passer la main au médecin/infirmier.
  - → **Référentiels (D-04)** : motifs de consultation, catégorie de patient.
  - → **Synchronisation (D-09)** : visites et constantes soft-deletables et synchronisées.

### D-02 — Soins (Consultation & documents)
- **Mission** : conduire la **consultation pilotée par la décision** (états cohérents, clôture
  guidée), produire les **documents cliniques imprimables** (ordonnance, bon d'examen, **bon de
  pharmacie**, certificat, repos) et gérer les **évacuations / sorties critiques**.
- **Modules** : `consultation`, `bon-examen`, `bon-pharmacie`, `sorties-critiques` (API & web).
- **Frontières** : l'activité clinique est **scopée à l'initiateur** (consultations par soignant) ;
  la **supervision** (ADMIN_SYSTEME, MEDECIN_CHEF) peut voir/verrouiller. Les documents sont des
  livrables rattachés à une consultation. Le **bon de pharmacie** et certains droits dépendent de
  la **catégorie de patient** (D-04).
- **Interactions principales** :
  - ← **Accueil & Triage (D-01)** : reçoit la visite triée et la prend en charge (verrou de prise en charge).
  - → **Dossier patient (D-03)** : écrit consultations, prescriptions, alertes cliniques auto, timeline.
  - → **Référentiels (D-04)** : pathologies, médicaments, types d'examen, types de consultation, types de certificat.
  - → **Communication (D-07)** : notification ciblée à l'envoi (selon flux cible clinique).
  - → **Pilotage (D-08)** : alimente les stats type × pathologie × catégorie.

### D-03 — Dossier patient
- **Mission** : maintenir l'**agrégat patient centralisé cross-site** (suit le patient sur tous les
  sites) : identité, **matricule**, catégorie, allergies, antécédents, alertes, mode de vie, données
  emploi, **ayants droit par matricule**, et **verrou de confidentialité** du médecin-chef.
- **Modules** : `apps/api/src/modules/patient`, `apps/web/src/modules/patients`.
- **Frontières** : **source de vérité de l'identité** consommée par tous les domaines cliniques ;
  ne porte pas l'acte clinique lui-même (délégué à D-01/D-02). Lectures cliniques cloisonnées par
  site et confidentialité par médecin (cf. mémoire audit confidentialité).
- **Interactions principales** :
  - ↔ **Accueil & Triage (D-01)** et **Soins (D-02)** : fournit l'identité, agrège l'historique.
  - → **Référentiels (D-04)** : catégorie de patient (pilote les droits aux bons).
  - → **Synchronisation (D-09)** : agrégat soft-delete bi-cible, synchronisé LWW.

### D-04 — Référentiels
- **Mission** : gérer les **données de référence** qui pilotent les règles métier : catégories
  patient, motifs, pathologies, médicaments, types d'examen, types de consultation, types de
  certificat, **sociétés sous-traitantes**, **employés SARIS**.
- **Modules** : `referentiels`, `employe` (API) ; `referentiels` (web).
- **Frontières** : domaine de configuration métier (CRUD géré en interface, pas seulement par seed).
  Ne contient aucune donnée clinique nominale. La **catégorie de patient** est le pivot des droits
  aux bons (règle métier centrale du recueil).
- **Interactions principales** :
  - → **Dossier patient (D-03)**, **Triage (D-01)**, **Soins (D-02)** : fournit les listes de valeurs.
  - → **Synchronisation (D-09)** : référentiels synchronisés (interceptor live de rafraîchissement).

### D-05 — Acteurs & RH
- **Mission** : gérer le **personnel soignant** (acteurs médicaux), leurs **habilitations/aptitudes**
  et leurs **absences**.
- **Modules** : `apps/api/src/modules/personnel` (+ habilitations/absences greffées), acteurs (web).
- **Frontières** : décrit *qui soigne* (côté ressources humaines médicales) ; distinct du domaine
  **Accès & Sécurité** (D-06) qui décrit *qui peut se connecter et avec quels droits*. Un acteur
  peut être relié à un compte utilisateur, mais les deux notions restent séparées.
- **Interactions principales** :
  - → **Accès & Sécurité (D-06)** : un personnel peut être rattaché à un utilisateur/rôle.
  - → **Pilotage (D-08)** : KPI RH (effectif par rôle, habilitations actives, absences récentes).
  - → **Référentiels (D-04)** : sociétés sous-traitantes pour le personnel concerné.

### D-06 — Accès & Sécurité
- **Mission** : gérer les **utilisateurs**, les **4 rôles** (cf. [[_SOURCE_systeme]] §Rôles), les
  **~110 permissions**, l'**authentification** (JWT access+refresh, **session unique**, **TOTP 2FA**
  chiffré), la **récupération de compte** (codes de secours), la **gestion des sessions** et
  l'acceptation des **CGU**.
- **Modules** : `admin` (roles/utilisateurs), `auth` (web), `security` (API).
- **Frontières** : autorité de l'identité numérique et des droits ; n'intervient pas dans le métier
  clinique sinon via le **guard de permissions** (`@RequirePermissions`). Le catalogue de permissions
  est défini dans `packages/types/src/permissions.ts`.
- **Interactions principales** :
  - → **Tous les domaines** : applique les permissions à chaque mutation/lecture.
  - ↔ **Acteurs & RH (D-05)** : association compte ↔ personnel.
  - → **Audit (D-11)** : authentifie l'acteur des actions journalisées.

### D-07 — Communication (messagerie & notifications)
- **Mission** : assurer la communication interne — **messagerie chiffrée AES-256-GCM façon WhatsApp
  Web** (conversations directes/groupes, médias, réactions, accusés, présence) **cloisonnée par
  site**, et les **notifications/annonces** (cloche + SSE, annonces admin, **annonces de mise à jour**
  avec lien d'installation desktop). Voir aussi la skill `messagerie-saris`.
- **Modules** : `messagerie`, `notification` (API) ; `messagerie`, `notifications` (web).
- **Frontières** : canal transversal ; ne porte pas de donnée clinique structurée (échanges libres).
  Cloisonnement strict par site (anti-IDOR cross-site, cf. mémoire système robuste).
- **Interactions principales** :
  - ← **Soins (D-02)** et autres : émettent des notifications ciblées.
  - → **Accès & Sécurité (D-06)** : présence basée sur `lastSeenAt`, droits d'accès.
  - → **Synchronisation/Temps réel** : diffusion SSE (notifs, messages, présence, invalidations live).

### D-08 — Pilotage (dashboard & stats)
- **Mission** : fournir les **tableaux de bord par rôle** et les **statistiques** (type × pathologie ×
  catégorie), avec **exports CSV/PDF** et sélecteur de période.
- **Modules** : `apps/api/src/modules/dashboard`, `apps/web/src/modules/dashboard`.
- **Frontières** : domaine **lecture seule / agrégation** ; ne modifie aucune donnée métier. Les KPI
  sont filtrés par site et par rôle (système réduit à 4 rôles → essentiellement vue clinique + vue
  admin-système, cf. mémoire réduction 4 rôles).
- **Interactions principales** :
  - ← **Soins (D-02)**, **Dossier patient (D-03)**, **Acteurs & RH (D-05)** : agrège les données.
  - → **Accès & Sécurité (D-06)** : visibilité conditionnée par permission `dashboard.read`.

### D-09 — Synchronisation & Offline
- **Mission** : garantir le fonctionnement **offline-first multi-poste** : **synchronisation LWW**
  (pull/push sur `updatedAt`/`baseUpdatedAt`, **tombstones soft-delete**, **cron de purge**), curseur
  `SyncState` par poste, supervision des postes, **file de rejeu terrain**, **sauvegardes de config**
  et **volumétrie**.
- **Modules** : `sync` (API), `admin/synchronisation` (API), écran admin (web).
- **Frontières** : couche **transversale d'infrastructure de données** ; ne crée pas de métier mais
  réplique les agrégats des autres domaines entre desktop (SQLite) et central (PostgreSQL/Neon).
- **Interactions principales** :
  - ↔ **Tous les domaines persistés** : applique le soft-delete bi-cible et la réplication.
  - → **Administration & Paramètres (D-10)** : sauvegardes/restaurations de configuration.
  - → **Communication (D-07)** : diffusion live des invalidations.

### D-10 — Administration & Paramètres
- **Mission** : gérer la **configuration système** : politiques de **mots de passe**, **sessions**,
  **notifications**, **sauvegardes** (sauvegarde réelle de config + restauration non destructive +
  cron quotidien + rétention).
- **Modules** : `parametres` (API), `admin/parametres` (API), web associé.
- **Frontières** : pilote le comportement global de la plateforme ; distinct d'**Accès & Sécurité**
  (D-06, qui gère identités/droits) — D-10 gère les *réglages*, pas les *personnes*.
- **Interactions principales** :
  - → **Accès & Sécurité (D-06)** : applique les politiques (mots de passe, sessions).
  - ↔ **Synchronisation (D-09)** : sauvegarde/restauration de la configuration.

### D-11 — Audit (transversal)
- **Mission** : journaliser de manière **persistante** les mutations métier (décorateur `@Audit` +
  `AuditInterceptor` global) avec **IP réelle + géolocalisation** hors-ligne et statut, pour la
  traçabilité réglementaire.
- **Modules** : `admin/audit` (API), interceptor global `APP_INTERCEPTOR`.
- **Frontières** : domaine **transversal en lecture/écriture de journal** ; il observe les autres
  domaines sans modifier leur métier. Les actions des comptes admin auto-audités sont exclues
  (cf. mémoire système robuste).
- **Interactions principales** :
  - ← **Tous les domaines de mutation** : intercepte les écritures des controllers cliniques/config.
  - → **Accès & Sécurité (D-06)** : rattache chaque action à un acteur authentifié.

## 4. Schéma des dépendances (synthèse)

- **Cœur clinique** : D-01 → D-02, tous deux ancrés sur D-03 (Dossier patient), alimentés par D-04
  (Référentiels) ; D-02 nourrit D-08 (Pilotage).
- **Transversaux** : D-06 (Accès & Sécurité) garde tout ; D-11 (Audit) observe tout ; D-09
  (Synchronisation) réplique tout ; D-07 (Communication) notifie partout.
- **Support** : D-05 (Acteurs & RH) et D-10 (Administration & Paramètres) configurent le contexte
  d'exploitation.

> Détail des modules, écrans et endpoints par domaine : [[plan_modules]]. Définitions des termes
> (visite, constante, matricule, catégorie de patient, supervision, LWW…) : [[glossaire]].

## 5. Points à confirmer

- Le module `security` (API) regroupe à confirmer : helpers de sécurité (IP/géo, rate-limit) — son
  périmètre exact est rattaché à D-06 mais pourrait recouper D-11 (à préciser dans [[plan_modules]]).
- La frontière exacte entre `personnel` (API) et le web « acteurs » est fonctionnelle (acteurs =
  vue unifiée) — à détailler côté plan de modules.
