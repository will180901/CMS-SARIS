# Document 01 - Architecture Fonctionnelle Globale

> **Statut du document : AS-BUILT (état réel de l'application).**
> Ce document décrit l'architecture fonctionnelle telle qu'elle est **réellement implémentée**
> dans le code de CMS SARIS, et non plus seulement la cible théorique du MVP. Les éléments encore
> hors périmètre sont identifiés explicitement dans la section « Périmètre et extensions futures ».

## 1. Objectif du document

Ce document décrit l'organisation fonctionnelle globale de l'application CMS SARIS. Il explique
comment les modules travaillent ensemble, quels processus transverses traversent tout le système, et
quels services techniques transversaux (sécurité, audit, temps réel, offline, sauvegarde) soutiennent
l'ensemble. Il sert de socle d'entrée au cahier des charges et au rapport de soutenance.

## 2. Architecture applicative réalisée

L'application est conçue comme un **monorepo** unique, organisé autour de :

- **une seule application frontend** (`apps/web`) — React 19 + Vite 7, PWA installable, offline-first ;
- **un seul backend** (`apps/api`) — NestJS 11, API REST + flux temps réel SSE ;
- **une seule base de données** relationnelle pilotée par **Prisma 6** (`packages/db`) — **79 tables** ;
- **des packages partagés** : `packages/types` (types et catalogue de permissions partagés
  front/back) et `packages/ui` (design system SARIS, composants) ;
- **des modules internes** clairement séparés dans le code comme dans la documentation.

Un module n'est donc pas une application séparée : c'est un domaine fonctionnel autonome avec ses
écrans, ses règles, ses données et ses permissions. L'orchestration du monorepo est assurée par
**pnpm workspaces + Turbo**.

| Couche | Technologie principale | Rôle |
|---|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, React Query, Zustand, Dexie (IndexedDB) | SPA / PWA offline-first, état réseau et cache local |
| Backend | NestJS 11, Passport JWT, Prisma 6, RxJS | API REST sécurisée, temps réel SSE, tâches planifiées |
| Données | PostgreSQL via Prisma (79 tables, 22 migrations) | Persistance, intégrité, traçabilité |
| Partagé | `@cms-saris/types` (110 permissions, types métier), design system SARIS | Cohérence front/back |

## 3. Cartographie des modules (état réel)

Le périmètre fonctionnel des **8 modules cibles du MVP** est **intégralement codé**. Il s'est enrichi
de **modules transversaux additionnels** réellement implémentés (messagerie, notifications temps réel,
tableau de bord, documents imprimables, conformité). Le code backend est organisé en **14 modules
NestJS** : `security`, `admin`, `parametres`, `referentiels`, `personnel`, `patient`, `triage`,
`consultation`, `bon-examen`, `sorties-critiques`, `suivi-chronique`, `messagerie`, `notification`,
`dashboard`.

### 3.1 Modules métier (périmètre MVP — tous RÉALISÉS)

| Module | Mission principale | Statut |
|---|---|---|
| Sécurité, Administration et Audit | Contrôler accès, permissions, traces, paramètres, sauvegardes. | ✅ Réalisé |
| Référentiels et Droits | Fournir les données stables (sites, motifs, pathologies, médicaments, catégories, examens) et les règles de droits par catégorie. | ✅ Réalisé |
| Synchronisation Offline-First | Assurer le fonctionnement sans réseau, la file de rejeu, la sauvegarde/restauration de configuration. | ✅ Réalisé |
| Acteurs Administratifs | Gérer personnel médical, délégations de prescription, sous-traitants, rattachements. | ✅ Réalisé |
| Dossier Patient | Centraliser identité, allergies, antécédents, alertes médicales, rattachements et historique. | ✅ Réalisé |
| Accueil et Triage | Ouvrir la visite, saisir constantes vitales, orienter le patient (file par ordre d'arrivée). | ✅ Réalisé |
| Consultation et Actes Prescrits | Poser diagnostic, décisions, ordonnances, bons d'examen, clôture. | ✅ Réalisé |
| Sorties Critiques | Gérer évacuations et accidents du travail avec suivi. | ✅ Réalisé |

### 3.2 Modules transversaux additionnels (RÉALISÉS, au-delà du MVP initial)

| Module | Mission principale | Statut |
|---|---|---|
| Messagerie interne chiffrée | Communication 1↔1 et groupes, chiffrée au repos (AES-256-GCM), pièces jointes, réactions, accusés de lecture. | ✅ Réalisé |
| Notifications temps réel (SSE) | Diffusion live des événements cliniques / administratifs, présence en ligne, invalidation de cache. | ✅ Réalisé |
| Tableau de bord (Dashboard) | KPI du jour, séries temporelles, patients à risque, état du personnel, cloisonné par site. | ✅ Réalisé |
| Suivi chronique | Ouverture/clôture de suivis de pathologies chroniques (depuis consultation ou dossier). | ✅ Réalisé |
| Documents imprimables A4 | Ordonnance et bon d'examen imprimables (gabarit unifié, impression côté client). | ✅ Réalisé |
| Conditions d'utilisation (CGU) | Versionnage et acceptation tracée, porte bloquante au login. | ✅ Réalisé |

## 4. Processus transversal : patient

Cycle de vie patient réellement implémenté :

1. Patient inconnu.
2. Recherche au triage ou par l'administration.
3. **Détection de doublons** (distance de Levenshtein sur nom/prénom normalisés) avant création.
4. Création du dossier (numéro de patient séquentiel, photo optionnelle compressée côté serveur).
5. Attribution d'une catégorie patient.
6. Vérification des droits associés à la catégorie à chaque visite.
7. Enrichissement du dossier : allergies (gravité), antécédents, alertes médicales (criticité),
   rattachements CDI / sous-traitants, constantes, consultations.
8. Changement possible de catégorie **avec historique daté**.
9. Archivage si décès, départ définitif ou erreur consolidée (statuts patient `ACTIF`, `ARCHIVE`,
   `DECEDE`, `FUSIONNE`).

## 5. Processus transversal : visite

Cycle de vie visite réellement implémenté :

1. Visite ouverte au triage (patient, site, motif principal, notes d'accueil).
2. Alertes critiques affichées en aperçu (allergies sévères et alertes `CRITIQUE` seulement).
3. Constantes vitales saisies (TA systolique/diastolique, FC, T°, SpO2, poids, taille, IMC auto-calculé).
4. Attribution d'un soignant responsable, orientation vers consultation.
5. Consultation réalisée.
6. Décision médicale enregistrée.
7. Actes ou sorties critiques rattachés si nécessaire.
8. Visite clôturée.

**Statuts réellement implémentés** (enum `StatutVisite`) :

- `EN_ATTENTE`
- `EN_COURS` (état qui ne recule pas : pas de retour en file)
- `CLOTUREE`
- `ANNULEE`

> Champ complémentaire `typeCloture` (AVEC_CONSULTATION / SANS_CONSULTATION) et journal d'événements
> de visite (`VisiteEvenement`) tracé à chaque changement de statut / soignant.
> Note : la notion de **priorité a été retirée** de l'interface — la file fonctionne par **ordre
> d'arrivée**. La colonne historique `priorite` a été **supprimée de la base** (migration `remove_priorite` : `DROP COLUMN` sur `Visite` et `MotifConsultation`).

## 6. Processus transversal : consultation

Cycle de vie consultation réellement implémenté :

1. Ouverture depuis la file d'attente.
2. Lecture du dossier et des alertes.
3. **Prise en charge** (verrou souple `pickedUpById`) pour éviter les éditions concurrentes.
4. Examen clinique (symptômes, observations).
5. Diagnostics (pathologie + type `PRINCIPAL` / `SECONDAIRE`).
6. Ordonnances (lignes médicament / posologie / durée / voie / instructions ; statut
   `EN_ATTENTE` → `VALIDEE`).
7. Bons d'examen rattachés.
8. Conclusion et décision médicale, puis clôture.

**Statuts réellement implémentés** (enum `StatutConsultation`) : `OUVERTE`, `CLOTUREE`, `ANNULEE`.

**Décisions de clôture réellement implémentées** : consultation simple, suivi chronique, évacuation,
accident du travail. (Le suivi de grossesse existe au niveau du schéma de données — tables
`SuiviGrossesse` / `ConsultationPrenatale` — mais n'est pas exposé comme parcours dédié dans
l'interface ; voir section 13.)

## 7. Processus transversal : droits et permissions

Les droits ne sont **pas codés en dur** dans les modules : ils proviennent du catalogue partagé
`packages/types` (**110 permissions**) et sont appliqués à chaque endpoint.

### 7.1 Droits patient (couverture par catégorie)

1. Identifier la catégorie actuelle du patient.
2. Vérifier son statut administratif.
3. Vérifier les droits associés à la catégorie (`DroitCategoriePatient`).
4. Appliquer les restrictions dans l'écran courant.
5. Tracer tout blocage sensible (audit).

### 7.2 Permissions applicatives (RBAC réel)

- **Formule des permissions effectives** : `(permissions des rôles ∪ GRANTs) − REVOKEs`. Le REVOKE
  individuel l'emporte toujours.
- **6 rôles** : `ADMIN_SYSTEME` (super-administrateur, catalogue complet — 110 perms),
  `ADMIN_MEDICAL` (gouvernance clinique : référentiels, personnel, lecture clinique),
  `MEDECIN_CHEF` (pleins droits cliniques), `INFIRMIER` (triage),
  `INFIRMIER_DELEGUE` (triage + prescription déléguée limitée), `AGENT_RH` (personnel et administratif).
- **Socle commun** à tous les rôles : `notification.read/update` + `messagerie.read/create/update/delete`.
- **Garde-fous** : impossible de retirer le dernier administrateur ou de se priver soi-même des
  permissions vitales.
- **Guards NestJS** : `JwtAuthGuard`, `PermissionsGuard` (`@RequirePermissions`, modes ANY/ALL),
  `RolesGuard`, `UserThrottlerGuard` (limitation de débit par utilisateur).

## 8. Processus transversal : offline-first et synchronisation

Chaque action métier importante peut être :

- exécutée localement (front PWA, cache IndexedDB via Dexie) ;
- stockée en **file de rejeu** (`file_mutations`) si le réseau est indisponible ;
- identifiée par un **UUID de mutation unique** (idempotence côté serveur) ;
- synchronisée au retour du réseau (rejeu trié par ordre local) ;
- auditée ;
- résolue en cas de conflit (statuts `PENDING` / `SENT` / `APPLIED` / `REJECTED` / `CONFLICT`).

**Réalisation technique** :

- **PWA** (`vite-plugin-pwa` / Workbox) : app shell pré-cachée ; runtime caching granulaire —
  *NetworkFirst* (timeout 5 s) sur les GET API avec repli cache 7 jours ; *StaleWhileRevalidate*
  sur polices/images ; *CacheFirst* sur `ffmpeg.wasm`. Repli SPA sur `/index.html`.
- **Moteur de synchronisation** (`sync.ts`) : `enqueueMutation`, `syncPush`, `syncPull` (extension),
  purge et relance des mutations rejetées.
- **Orchestration** : hook `useSyncEngine` (cycle au retour en ligne + périodique 30 s) et
  `useServerHealth` (ping `/health`, détection réseau).
- **Détection réseau** : stores Zustand `network.store` et `sync.store`, bandeau de synchronisation
  dans l'interface d'administration.

## 9. Service transversal : sécurité et authentification

- **Authentification JWT** : access token (TTL paramétrable) + refresh token (7 jours, rotation,
  hachés bcrypt en base). Payload : `sub`, `siteId`, `roles`, `permissions`, `personnelMedicalId`, `sid`.
- **Double authentification TOTP** (otplib) : secret **chiffré AES-256-GCM** (dérivation scrypt),
  8 codes de secours hachés bcrypt et à usage unique.
- **Mots de passe** : hachage bcrypt ; politique paramétrable (longueur, casse, chiffre, caractère
  spécial) ; **escalade dynamique du blocage** (durée multipliée à chaque tentative échouée).
- **Sessions** : table `SessionUtilisateur` (IP, user-agent, géolocalisation, révocation sélective ou
  en masse). Géolocalisation IP **double couche** : service externe ip-api.com (prioritaire, cache 1 h)
  avec **repli hors-ligne geoip-lite**. Support du reverse-proxy via `trust proxy` (variable
  `TRUST_PROXY`, à régler au déploiement).
- **Sécurité HTTP** : `helmet` (CSP, HSTS, X-Frame-Options…), CORS restreint au frontend,
  `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted` + `transform`).

## 10. Service transversal : audit et conformité

- **Audit métier persistant** : intercepteur global (`APP_INTERCEPTOR`) déclenché par l'annotation
  `@Audit('module', 'EntiteType')`. Toutes les mutations (POST/PATCH/PUT/DELETE) des contrôleurs
  cliniques et de configuration alimentent `JournalAudit` (utilisateur, action, module, type/identifiant
  d'entité, IP, statut SUCCES/ERREUR, horodatage). Stratégie *best-effort* : un échec de journalisation
  n'altère jamais la requête métier.
- **Audit d'authentification** : table dédiée `JournalAuthentification` (login, résultat, IP,
  user-agent, géolocalisation) — connexions, échecs, TOTP, codes de secours.
- **Conformité CGU** : version serveur `CGU_VERSION` (« v1-2026.06 »), acceptation tracée
  (`PreferenceUtilisateur.cguAccepteeLe` / `cguVersion`), **porte bloquante** au login (re-demande
  automatique si la version est incrémentée).
- **Consultation de l'audit** : filtres module / action / utilisateur / entité / plage de dates
  (bornes inclusives), plafonné à 500 résultats.

## 11. Service transversal : temps réel (SSE) et notifications

- **Flux SSE** `/notifications/stream` (EventSource, token JWT en query string) : pousse les
  événements en temps réel et maintient la **présence en ligne** (un utilisateur est en ligne tant
  qu'une connexion SSE est ouverte — `PresenceService`).
- **Notifications persistées** : types clinique / sortie / administratif / système ; niveaux
  `INFO` / `SUCCES` / `AVERTISSEMENT` / `CRITIQUE` ; ciblage individuel ou diffusion filtrée par site
  et permission requise. État « lu » par utilisateur, masquage « supprimer pour moi », rétention
  paramétrable (30 j par défaut).
- **Invalidation live silencieuse** (`broadcastLive`) : événements `LIVE_REFERENTIELS`, `LIVE_ACTEURS`,
  `LIVE_BONS_EXAMEN`, `LIVE_SYNC` déclenchent côté client l'invalidation des caches React Query
  **sans son ni toast**, assurant un rafraîchissement global cohérent entre postes.
- **Accusés de messagerie en temps réel** : événement `MESSAGE_STATUS` (✓ envoyé / ✓✓ remis / ✓✓ lu).

## 12. Service transversal : messagerie interne chiffrée

- **Chiffrement au repos AES-256-GCM** du contenu **et** des pièces jointes (format versionné
  `v2:<keyId>:…`, legacy `v1` lisible).
- **Rotation / versionnage des clés** : trousseau `MESSAGE_ENC_KEYS` (+ variante fichier
  `MESSAGE_ENC_KEYS_FILE` compatible Vault/secrets), clé de chiffrement courante
  `MESSAGE_ENC_KEY_CURRENT`, outil de **ré-encryption v1→v2** (`POST /synchronisation/messagerie/rechiffrer`,
  non destructif).
- **Conversations** : DIRECT (1↔1) et GROUPE (jusqu'à 50 participants), **cloisonnées par site**.
- **Durcissement** : limitation de débit (40 envois/min/utilisateur), pièces jointes (10 fichiers,
  16 Mo chacun) avec **vérification de signature binaire** (rejet des exécutables déguisés .exe/ELF/Mach-O/shell),
  sanitisation des noms de fichiers, whitelist MIME (images, vidéos, audio, PDF, Office, texte).
- **Fonctionnalités** : réactions emoji, citations/réponses, accusés de lecture, suppression à
  2 niveaux (« pour moi » via masque / « pour tout le monde » ≤ 15 min), édition ≤ 15 min,
  partage média avancé (compression image, rognage vidéo via `ffmpeg.wasm`).

## 13. Service transversal : sauvegarde et restauration

- **Périmètre de sauvegarde : configuration uniquement** — référentiels, matrice rôles↔permissions,
  paramètres système. Les **données cliniques / patients ne sont JAMAIS incluses** (confidentialité et
  intégrité).
- **Sauvegarde** : snapshot JSON (`contenuJson` + taille), manuelle ou automatique.
- **Restauration non destructive** : ré-application par *upsert* (aucune suppression), restauration de
  la matrice rôles↔permissions.
- **Automatisation** : cron quotidien à 02h00 (`@nestjs/schedule`), **rétention des 30 dernières**
  sauvegardes, audit et invalidation live à chaque opération.
- **Écran d'administration** en 3 zones : terrain (réseau + file de rejeu), sauvegardes (historique +
  restauration), volumétrie (compteurs par module).

## 14. Service transversal : design system SARIS

- **Tokens CSS** (couleurs, typographie, espacements, rayons, ombres) dans `packages/ui` :
  palette monochrome slate + accent **teal (`--ap-*`)** et **or Congo (`--as-*`)**, couleurs
  sémantiques désaturées, **mode clair/sombre** piloté par classe `.dark`.
- **Style** : effets de **glassmorphisme** (sidebar, cartes, en-tête, toasts), grain fractal subtil,
  **rayons plafonnés à 10 px** (interface fonctionnelle), ombres désactivées en mode sombre (hiérarchie
  par bordures).
- **Composants** : base shadcn/ui + Radix UI (accessibilité ARIA de base), icônes lucide-react,
  graphiques recharts, toasts sonner.
- **Polices variables** : Inter (corps), Plus Jakarta Sans (UI), Sora (titres), JetBrains Mono (code).
- **Règles de design strictes** : variables CSS et styles inline, **zéro dégradé**, cohérence stricte
  entre thèmes.

## 15. Matrice modules, acteurs et données (état réel)

| Module | Acteurs principaux | Données principales |
|---|---|---|
| Sécurité, Admin, Audit | Admin système, auditeur | utilisateurs, rôles, permissions (110), sessions, audit, sauvegardes |
| Référentiels et Droits | Admin médical | sites, catégories + droits, motifs, pathologies, médicaments, types d'examen |
| Synchronisation Offline | Admin système | mutations (file de rejeu), journaux sync, sauvegardes de configuration |
| Acteurs Administratifs | RH, médecin chef, admin médical | personnel médical, délégations de prescription, sous-traitants, rattachements |
| Dossier Patient | infirmier, médecin chef | patients, identité, allergies, antécédents, alertes médicales, rattachements |
| Accueil et Triage | infirmier | visites, constantes vitales, file d'attente (par ordre d'arrivée) |
| Consultation et Actes | médecin chef, infirmier délégué | consultations, diagnostics, ordonnances, bons d'examen |
| Sorties Critiques | médecin chef, RH (lecture limitée) | évacuations + suivi, accidents du travail + suivi |
| Suivi chronique | médecin chef | suivis de pathologies chroniques, visites de suivi |
| Messagerie | tous les rôles | conversations, messages chiffrés, pièces jointes, réactions |
| Notifications / Temps réel | tous les rôles | notifications, lectures, présence |
| Tableau de bord | tous (selon permissions) | KPI agrégés, séries temporelles, patients à risque |

## 16. Périmètre et extensions futures

**Réalisé** : l'intégralité du périmètre fonctionnel des 8 modules MVP, plus les modules transversaux
listés en §3.2.

**Hors périmètre / extensions futures** (non implémentés à ce jour) :

- gestion de **stock de médicaments** et **délivrance physique** (l'ordonnance est prescrite et
  imprimée, mais la dispensation n'est pas gérée) ;
- intégration aux organismes de couverture (**CNSS** et tiers payant externes) au-delà des droits par
  catégorie patient ;
- parcours dédié **suivi de grossesse** (les tables existent au schéma mais aucun écran/parcours
  spécifique n'est exposé) ;
- **internationalisation (i18n)** : l'interface est en français codé en dur (dictionnaire centralisé
  `labels.ts`), sans moteur de changement de langue à l'exécution ;
- **tests automatisés** : couverture actuelle limitée à 2 specs E2E backend (health, contrôle 401) ;
  pas de tests unitaires/intégration ni d'audit d'accessibilité (WCAG) formel.

## 17. Règles d'architecture documentaire

Chaque module doit documenter, dans une structure identique pour éviter le désordre :

- objectif ;
- acteurs ;
- données ;
- processus principal ;
- cas alternatifs ;
- règles métier ;
- états ;
- écrans ;
- alertes ;
- permissions ;
- dépendances ;
- critères d'acceptation ;
- risques.

## 18. Synthèse des chiffres clés (as-built)

| Indicateur | Valeur réelle |
|---|---|
| Modules backend (NestJS) | 14 |
| Tables de base de données (Prisma) | 78 |
| Migrations appliquées | 21 |
| Permissions au catalogue | 110 |
| Rôles applicatifs | 6 |
| Frontend | React 19 + Vite 7 + Tailwind 4 (PWA offline-first) |
| Backend | NestJS 11 + Prisma 6 + Passport JWT |
| Chiffrement messagerie / TOTP | AES-256-GCM (clés versionnées, rotation) |
| Temps réel | SSE (notifications, présence, invalidation live) |
| Sauvegarde | Configuration uniquement, cron quotidien 02h00, rétention 30 |
