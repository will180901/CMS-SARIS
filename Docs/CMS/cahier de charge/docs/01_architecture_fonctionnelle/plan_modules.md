# Plan des modules — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document « as-built » (le système est développé et déployé). Il décrit les modules **réellement présents** dans le backend NestJS sous `apps/api/src/modules` et leurs dépendances **telles que déclarées dans le code** (champ `imports` de chaque `@Module`). Toute description fonctionnelle reste alignée sur le brief canonique [[_SOURCE_systeme]] et renvoie au document de domaines [[carte_domaines]].

---

## 1. Objet et périmètre

CMS SARIS est un **monolithe NestJS modulaire** : un seul processus serveur, mais découpé en modules métier indépendants enregistrés dans le module racine `AppModule` (`apps/api/src/modules` ; racine déclarée dans `apps/api/src/app.module.ts`). Ce document recense ces modules, leur mission, leur domaine d'appartenance et leur graphe de dépendances.

Le périmètre couvre **uniquement les modules backend** (NestJS). Les couches transverses techniques `PrismaModule` (accès base via `apps/api/src/prisma`) et l'`AuditInterceptor` global (`apps/api/src/common/interceptors/audit.interceptor.ts`, enregistré comme `APP_INTERCEPTOR` dans `AppModule`) sont mentionnées car elles conditionnent les dépendances, mais ne sont pas des modules métier au sens fonctionnel.

> Note de cadrage (honnêteté as-built) : le brief [[_SOURCE_systeme]] cite des modules `acteurs` et un module dédié `parametres` exposé comme zone fonctionnelle. Dans le code, **il n'existe pas de répertoire `modules/acteurs`** ; la gestion du personnel et des délégations est portée par `personnel`. Le répertoire `modules/parametres` **existe** mais n'est pas importé directement dans `AppModule` : c'est un module **support** (service de configuration) consommé par `security`, `notification` et `admin`. Ces deux points sont documentés tels quels ci-dessous.

---

## 2. Inventaire des modules (réel)

Seize modules métier sont enregistrés dans `AppModule`, plus le module support `ParametresModule` (importé en cascade). La colonne « Domaine » renvoie à [[carte_domaines]].

### 2.1 Modules enregistrés dans `AppModule`

| # | Module (classe) | Répertoire | Mission (1 phrase) |
|---|-----------------|------------|--------------------|
| 1 | `SecurityModule` | `security` | Authentifier (JWT access/refresh, session unique, TOTP 2FA) et autoriser (gardes `JwtAuthGuard` / `PermissionsGuard` / `RolesGuard`) toutes les requêtes. |
| 2 | `ReferentielsModule` | `referentiels` | Gérer les référentiels métier (catégories patient, motifs, pathologies, médicaments, types d'examen et de consultation, types de certificat). |
| 3 | `PersonnelModule` | `personnel` | Gérer le personnel médical, les délégations et les sociétés sous-traitantes (controllers Personnel / Delegations / SousTraitants). |
| 4 | `PatientModule` | `patient` | Tenir le dossier patient centralisé cross-site (identité, allergies, antécédents, alertes, ayants droit, verrou de confidentialité). |
| 5 | `TriageModule` | `triage` | Enregistrer les visites et constantes vitales et tenir la file d'attente par ordre d'arrivée. |
| 6 | `ConsultationModule` | `consultation` | Conduire la consultation pilotée par la décision, sa clôture guidée, les certificats et le repos. |
| 7 | `BonExamenModule` | `bon-examen` | Émettre et suivre les bons d'examen (et la saisie des résultats). |
| 8 | `BonPharmacieModule` | `bon-pharmacie` | Émettre les bons de pharmacie (dispensation selon catégorie/droits). |
| 9 | `EmployeModule` | `employe` | Tenir le registre des employés SARIS (main-d'œuvre patiente) ; service réutilisé par le dossier patient. |
| 10 | `SortiesCritiquesModule` | `sorties-critiques` | Gérer les évacuations / sorties critiques (controller `Evacuations`). |
| 11 | `AdminModule` | `admin` | Administrer le système : utilisateurs, rôles/permissions, audit, paramètres, supervision de synchronisation. |
| 12 | `DashboardModule` | `dashboard` | Calculer les KPI et statistiques par rôle (type × pathologie × catégorie) et alimenter les exports. |
| 13 | `NotificationModule` | `notification` | Diffuser notifications et annonces en temps réel (cloche + SSE) et tenir la présence en ligne. |
| 14 | `MessagerieModule` | `messagerie` | Fournir la messagerie interne chiffrée façon WhatsApp Web, cloisonnée par site, en temps réel. |
| 15 | `SyncModule` | `sync` | Synchroniser les postes offline-first avec le central (pull/push LWW, tombstones) et superviser la file terrain. |
| 16 | `HealthController` (hors module) | `health` | Exposer la sonde publique `/health` (liveness). *Controller direct dans `AppModule`, pas un module métier.* |

### 2.2 Module support

| # | Module (classe) | Répertoire | Mission (1 phrase) |
|---|-----------------|------------|--------------------|
| S1 | `ParametresModule` | `parametres` | Fournir le service de configuration système (mots de passe, sessions, notifications, sauvegardes) aux modules qui en dépendent. **Non importé directement dans `AppModule`** ; tiré en cascade par `security`, `notification`, `admin`. |

---

## 3. Domaines d'appartenance

Le rattachement aux domaines fonctionnels est détaillé dans [[carte_domaines]]. Synthèse :

- **Domaine Sécurité & Accès** : `security`, `admin`, `parametres`.
- **Domaine Référentiels & Personnel** : `referentiels`, `personnel`, `employe`.
- **Domaine Parcours de soin clinique** : `patient`, `triage`, `consultation`, `bon-examen`, `bon-pharmacie`, `sorties-critiques`.
- **Domaine Pilotage & Statistiques** : `dashboard`.
- **Domaine Communication & Temps réel** : `notification`, `messagerie`.
- **Domaine Offline-first & Synchronisation** : `sync`.

---

## 4. Dépendances inter-modules (réelles)

Les dépendances ci-dessous reflètent **exactement** le champ `imports` de chaque `@Module` dans le code. `PrismaModule` est noté car il porte l'accès base (et donc l'ordre des couches), mais reste une infrastructure transverse.

| Module | Dépend de (imports déclarés) | Source |
|--------|------------------------------|--------|
| `SecurityModule` | `ParametresModule` (+ Passport/JWT infra) | `security/security.module.ts` |
| `ParametresModule` | `PrismaModule` | `parametres/parametres.module.ts` |
| `ReferentielsModule` | `SecurityModule` | `referentiels/referentiels.module.ts` |
| `PersonnelModule` | `PrismaModule` | `personnel/personnel.module.ts` |
| `EmployeModule` | `SecurityModule` | `employe/employe.module.ts` |
| `PatientModule` | `PrismaModule`, `NotificationModule`, `EmployeModule` | `patient/patient.module.ts` |
| `TriageModule` | `PrismaModule`, `NotificationModule` | `triage/triage.module.ts` |
| `ConsultationModule` | `PrismaModule`, `NotificationModule` | `consultation/consultation.module.ts` |
| `BonExamenModule` | `SecurityModule` | `bon-examen/bon-examen.module.ts` |
| `BonPharmacieModule` | `SecurityModule` | `bon-pharmacie/bon-pharmacie.module.ts` |
| `SortiesCritiquesModule` | `SecurityModule`, `NotificationModule` | `sorties-critiques/sorties-critiques.module.ts` |
| `DashboardModule` | `SecurityModule` | `dashboard/dashboard.module.ts` |
| `NotificationModule` | `SecurityModule`, `ParametresModule` | `notification/notification.module.ts` |
| `MessagerieModule` | `SecurityModule`, `NotificationModule` | `messagerie/messagerie.module.ts` |
| `SyncModule` | `SecurityModule`, `NotificationModule` | `sync/sync.module.ts` |
| `AdminModule` | `SecurityModule`, `PrismaModule`, `ParametresModule`, `NotificationModule` | `admin/admin.module.ts` |

**Couches transverses (par interceptor global, pas par `imports`)** :
- **Audit** : toute mutation des controllers annotés `@Audit(...)` est journalisée par l'`AuditInterceptor` global (`APP_INTERCEPTOR`). Ce n'est donc **pas** une dépendance `imports` — la liaison est implicite et globale.
- **Notification (SSE temps réel)** : au-delà des `imports` explicites ci-dessus, le `LiveRefreshInterceptor` (provider du `NotificationModule`) rafraîchit en direct les listes des controllers annotés.

> Observation as-built : tous les modules ne dépendent **pas** uniformément de `NotificationModule` ou `SecurityModule` par `imports`. Les modules cliniques `patient`/`triage`/`consultation` importent `PrismaModule` directement (pas `SecurityModule`), la protection des routes s'appuyant sur les gardes exportées globalement via `SecurityModule` enregistré en amont dans `AppModule`. Le brief évoque « tous → Notification / Audit / Sync » comme **intention transverse** ; la réalité du code est plus ciblée et est documentée ci-dessus sans embellissement.

---

## 5. Démonstration d'acyclicité du graphe

### 5.1 Principe

Un graphe de dépendances de modules NestJS **doit** être acyclique : une dépendance circulaire directe entre modules provoquerait un `forwardRef` ou une erreur d'injection au démarrage. Aucun `forwardRef` n'est présent dans les modules métier inventoriés (vérifié sur les fichiers `*.module.ts`). On démontre l'acyclicité par **tri topologique** : si un ordre linéaire respectant toutes les arêtes existe, le graphe est sans cycle.

### 5.2 Niveaux topologiques

On classe chaque module par « profondeur » (un module est au niveau N+1 si toutes ses dépendances sont de niveau ≤ N).

- **Niveau 0 (infrastructure)** : `PrismaModule` (aucune dépendance métier).
- **Niveau 1** : `ParametresModule` → dépend uniquement de `PrismaModule (N0)`.
- **Niveau 2** : `SecurityModule` → dépend de `ParametresModule (N1)`.
- **Niveau 3** : `NotificationModule` → dépend de `SecurityModule (N2)` + `ParametresModule (N1)`.
- **Niveau 4 (modules feuilles / métier)** : tous les autres modules, dont les dépendances pointent exclusivement vers des niveaux ≤ 3 :
  - `ReferentielsModule`, `EmployeModule`, `BonExamenModule`, `BonPharmacieModule`, `DashboardModule` → `SecurityModule (N2)`.
  - `PersonnelModule` → `PrismaModule (N0)`.
  - `TriageModule`, `ConsultationModule` → `PrismaModule (N0)` + `NotificationModule (N3)`.
  - `PatientModule` → `PrismaModule (N0)` + `NotificationModule (N3)` + `EmployeModule (N4 ; voir ci-dessous)`.
  - `SortiesCritiquesModule`, `MessagerieModule`, `SyncModule` → `SecurityModule (N2)` + `NotificationModule (N3)`.
  - `AdminModule` → `SecurityModule (N2)` + `PrismaModule (N0)` + `ParametresModule (N1)` + `NotificationModule (N3)`.

### 5.3 Cas particulier `PatientModule → EmployeModule`

`PatientModule` importe `EmployeModule`, et `EmployeModule` n'importe que `SecurityModule` (N2). Ces deux modules sont au « niveau 4 » fonctionnellement, mais l'arête est **orientée dans un seul sens** : `patient → employe`. Aucune arête `employe → patient` n'existe (vérifié : `employe.module.ts` n'importe pas `patient`). Il n'y a donc pas de cycle ; on peut ordonner `employe` strictement avant `patient`.

### 5.4 Conclusion

Un ordre topologique valide existe, par exemple :

`Prisma → Parametres → Security → Notification → {Referentiels, Employe, Bon-Examen, Bon-Pharmacie, Dashboard, Personnel} → Patient → {Triage, Consultation, Sorties-Critiques, Messagerie, Sync, Admin}`

Toutes les arêtes du tableau §4 vont d'un module **vers un module placé plus tôt** dans cet ordre (dépendance vers un niveau inférieur ou égal sans retour). **Le graphe est donc acyclique (DAG).** Aucune dépendance circulaire n'a été constatée dans le code.

---

## 6. Contrats d'interface principaux

Les contrats ci-dessous décrivent les **collaborations fonctionnelles** entre modules (transmission de données / appels de service / événements). Ils s'appuient sur les `imports` réels et sur les services exportés (`exports` des `@Module`). Les détails de payload relèvent des specs de module (Phase 2) ; ici on nomme et on situe le contrat.

| ID | Contrat | Émetteur → Récepteur | Nature (as-built) |
|----|---------|----------------------|-------------------|
| **C-1** | Création de visite et constantes | `Triage` → (dossier `Patient`) | Le triage rattache la visite à un patient existant (dédup) ; `TriageService` exporté, consommé par le parcours. La visite passe en file d'attente. |
| **C-2** | Prise en charge de la visite | `Triage` → `Consultation` | La consultation reprend une visite triée ; transition d'état de la visite (mise en file / clôture à l'envoi). Couplage via la donnée `Visite`, pas par `imports` direct entre les deux modules. |
| **C-3** | Enregistrement des actes cliniques | `Consultation` → (dossier `Patient`) | Les actes, certificats et repos issus de la consultation alimentent le dossier patient (timeline, alertes). |
| **C-4** | Émission de documents cliniques | `Consultation` → `BonExamen` / `BonPharmacie` / `SortiesCritiques` | Depuis la décision de consultation, émission de bons d'examen, bons de pharmacie et déclenchement d'évacuation. |
| **C-5** | Saisie des résultats d'examen | `BonExamen` → (dossier `Patient`) | Les résultats d'examen reviennent au dossier (saisie infirmière). |
| **C-6** | Référentiels consommés | `Referentiels` → modules cliniques | Catégories patient, motifs, pathologies, médicaments, types d'examen/consultation fournis aux flux `patient`/`triage`/`consultation`/`bon-*`. |
| **C-7** | Identité employé | `Employe` → `Patient` | `EmployeService` exporté et injecté dans `PatientService` (enregistrement dynamique de la main-d'œuvre comme patient). |
| **C-8** | Notification temps réel | `Patient`, `Triage`, `Consultation`, `SortiesCritiques`, `Messagerie`, `Sync`, `Admin` → `Notification` | Émission de notifications/annonces et invalidations live (SSE) ; `NotificationModule` importé par ces modules. |
| **C-9** | Authentification & autorisation | `Security` → tous les controllers protégés | Gardes JWT + permissions appliquées globalement ; `SecurityModule` exporte `JwtAuthGuard`, `PermissionsGuard`, `RolesGuard`. |
| **C-10** | Configuration système | `Parametres` → `Security`, `Notification`, `Admin` | `ParametresService` (mots de passe, sessions, notifications, sauvegardes) consommé par ces modules. |
| **C-11** | Journalisation d'audit | Controllers `@Audit(...)` → `AuditInterceptor` (global) | Audit transverse par interceptor `APP_INTERCEPTOR`, **pas** par `imports`. Couvre les mutations des controllers cliniques et de configuration. |
| **C-12** | Synchronisation offline-first | Tables marquées sync ↔ `Sync` | Pull/push LWW (sur `updatedAt`/`baseUpdatedAt`), tombstones soft-delete, curseur `SyncState` par poste ; supervision de la file terrain via `Admin`. |
| **C-13** | KPI & statistiques | données cliniques → `Dashboard` | Agrégations en lecture (type × pathologie × catégorie) pour les KPI par rôle et exports CSV/PDF. |

> Honnêteté : les contrats **C-2, C-3, C-4, C-5, C-6, C-13** sont des collaborations **par la donnée** (lecture/écriture des mêmes entités Prisma) plutôt que par `imports` NestJS direct entre les deux modules nommés. Ils sont réels mais transitent par la base (`PrismaModule`) et les états d'entités, ce qui explique l'absence d'arête `imports` correspondante au §4. Le couplage explicite par `imports` se limite à : `patient→employe` (C-7), les `→notification` (C-8), `→security` (C-9), `→parametres` (C-10).

---

## 7. Tableau récapitulatif : module ↔ domaine ↔ dépendances

| Module | Domaine ([[carte_domaines]]) | Dépendances directes (imports) | Contrats principaux |
|--------|------------------------------|--------------------------------|---------------------|
| `security` | Sécurité & Accès | `parametres` | C-9, C-10 |
| `parametres` *(support)* | Sécurité & Accès | `prisma` | C-10 |
| `admin` | Sécurité & Accès | `security`, `prisma`, `parametres`, `notification` | C-9, C-10, C-11, C-12 |
| `referentiels` | Référentiels & Personnel | `security` | C-6, C-9 |
| `personnel` | Référentiels & Personnel | `prisma` | C-9 (gardes globales) |
| `employe` | Référentiels & Personnel | `security` | C-7, C-9 |
| `patient` | Parcours de soin clinique | `prisma`, `notification`, `employe` | C-1, C-3, C-5, C-7, C-8 |
| `triage` | Parcours de soin clinique | `prisma`, `notification` | C-1, C-2, C-8 |
| `consultation` | Parcours de soin clinique | `prisma`, `notification` | C-2, C-3, C-4, C-8 |
| `bon-examen` | Parcours de soin clinique | `security` | C-4, C-5 |
| `bon-pharmacie` | Parcours de soin clinique | `security` | C-4 |
| `sorties-critiques` | Parcours de soin clinique | `security`, `notification` | C-4, C-8 |
| `dashboard` | Pilotage & Statistiques | `security` | C-13 |
| `notification` | Communication & Temps réel | `security`, `parametres` | C-8 |
| `messagerie` | Communication & Temps réel | `security`, `notification` | C-8, C-9 |
| `sync` | Offline-first & Synchronisation | `security`, `notification` | C-8, C-12 |

---

## 8. Renvois

- Vérité de référence : [[_SOURCE_systeme]].
- Cartographie des domaines : [[carte_domaines]].
- Détail des permissions par rôle : voir le catalogue `packages/types/src/permissions.ts` (~110 permissions, 3 rôles).
- Synchronisation offline-first : module `sync` (LWW, tombstones, `SyncState`).

> Tous les faits techniques de ce document sont issus de la lecture de `apps/api/src/app.module.ts` et des fichiers `apps/api/src/modules/*/*.module.ts` (champs `imports`/`exports`/`controllers`). Les éléments non confirmés par le code sont signalés « à confirmer » ou explicitement nuancés.
