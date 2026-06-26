# Documentation professionnelle CMS SARIS — Cahier des charges & état réalisé

Ce dossier contient la documentation complète du projet **CMS SARIS** (Centre Médical SARIS-CONGO), rédigée en vue de la soutenance.

La source historique consolidée n'est plus maintenue : les documents numérotés **00 à 18**
(ainsi que la présente page d'index) font désormais foi pour le périmètre et l'état réel du projet.

Cette documentation sert de version de travail professionnelle pour :

- cadrer le périmètre fonctionnel ;
- guider la conception fonctionnelle ;
- guider la conception technique ;
- piloter le développement ;
- préparer la soutenance.

> **Note de lecture importante — document de spécification vs. application livrée.**
> Les documents numérotés (00 à 17) décrivent la **spécification cible** telle qu'elle a été
> cadrée au démarrage. L'application réellement développée (le code livré dans
> `CMS/APP/CMS-SARIS`) **couvre l'intégralité de cette spécification et la dépasse** sur
> plusieurs points (messagerie interne chiffrée, notifications temps réel, conditions
> d'utilisation versionnées, sauvegarde/restauration réelle de configuration, rotation de
> clés de chiffrement). La présente page d'index a été mise à jour pour refléter cet
> **état réel « as-built »**. Les écarts entre la spécification d'origine et le produit final
> sont signalés explicitement dans les sections ci-dessous.

---

## Ordre de lecture

### Partie 1 — Vision et architecture (lire en premier)

1. [Document 00 — Vision et Périmètre](./00-vision-perimetre-mvp.md)
2. [Document 01 — Architecture Fonctionnelle Globale](./01-architecture-fonctionnelle-globale.md)

### Partie 2 — Spécifications fonctionnelles par module

3. [Document 02 — Sécurité, Administration et Audit](./02-securite-administration-audit.md)
4. [Document 03 — Référentiels et Droits](./03-referentiels-droits.md)
5. [Document 04 — Acteurs Administratifs](./04-acteurs-administratifs.md)
6. [Document 05 — Dossier Patient](./05-dossier-patient.md)
7. [Document 06 — Accueil et Triage](./06-accueil-triage.md)
8. [Document 07 — Consultation et Actes Prescrits](./07-consultation-actes-prescrits.md)
9. [Document 08 — Sorties Critiques](./08-sorties-critiques.md)
10. [Document 09 — Synchronisation Offline-First](./09-synchronisation-offline-first.md)
11. [Document 18 — Messagerie interne chiffrée](./18-messagerie-interne-chiffree.md) — *module transversal, documentation « as-built » ; point d'entrée agrégeant les sections messagerie des autres documents*

### Partie 3 — Modèle de données et règles

12. [Document 10 — Modèle de Données Consolidé](./10-modele-donnees-consolide.md)
13. [Document 13 — Règles Métier Exhaustives (~430 règles)](./13-regles-metier-exhaustives.md)
14. [Document 14 — Dictionnaire Détaillé des Tables](./14-dictionnaire-donnees-78-tables.md) — *spécification 71 tables ; le schéma livré en compte **79** (voir « Modèle de données réel » ci-dessous)*

### Partie 4 — Processus et workflows

15. [Document 12 — Workflows Détaillés (WF-01 à WF-20)](./12-workflows-detailles.md)

### Partie 5 — Qualité, tests et traçabilité

16. [Document 11 — Recette et Tests](./11-recette-tests.md)
17. [Document 15 — Matrice de Traçabilité](./15-matrice-tracabilite.md)
18. [Document 17 — Exigences Non-Fonctionnelles](./17-exigences-non-fonctionnelles.md)

### Partie 6 — Périmètre de développement

19. [Document 16 — Périmètre de Développement (modules codés vs documentés)](./16-perimetre-developpement.md)

---

## Périmètre fonctionnel réel (état « as-built »)

L'application livrée couvre **l'ensemble des domaines métier spécifiés** et y ajoute des
modules transversaux non prévus au cadrage initial. Tous les modules ci-dessous sont
**réellement codés** (backend NestJS + frontend React), protégés par permissions et audités.

### Domaines métier (tous codés)

| Domaine | État | Contenu principal |
|---|---|---|
| Sécurité & Authentification | **Codé** | JWT + refresh (7 j), 2FA TOTP (secret chiffré AES-256-GCM, 8 codes de secours), blocage progressif des comptes, politique de mot de passe paramétrable, sessions multiples révocables |
| Mon compte (« Me ») | **Codé** | Préférences (thème, densité, langue, page d'accueil), gestion des sessions, activation/désactivation 2FA, acceptation des CGU |
| Administration & Gouvernance | **Codé** | CRUD utilisateurs multi-site, rôles & permissions, dérogations individuelles GRANT/REVOKE, audit métier + audit d'authentification, paramètres système, synchronisation & sauvegardes |
| Acteurs administratifs | **Codé** | Personnel médical, délégations de prescription (médecin → infirmier, plage de dates + médicaments autorisés), sous-traitants |
| Référentiels | **Codé** | Sites, motifs de consultation, pathologies (marquage chronique), médicaments, catégories patients, types d'examen |
| Accueil & Triage | **Codé** | File d'attente par ordre d'arrivée, machine d'états de la visite, constantes vitales (TA, FC, T°, SpO2, poids, taille, IMC auto), badges d'alertes critiques |
| Dossier patient | **Codé** | Identité, photo, détection de doublons, allergies, antécédents, alertes médicales, historique de catégorie, rattachements ayant-droit (CDI) et sous-traitants |
| Consultation & Actes prescrits | **Codé** | Examen clinique, diagnostics (principal/secondaire), ordonnances + lignes de prescription, conclusion, clôture avec décision finale, verrou souple anti-collision |
| Bon d'examen | **Codé** | Cycle EN_ATTENTE → VALIDE → REÇU → CONSULTÉ, indication clinique, lignes d'examen, saisie de résultats |
| Sorties critiques | **Codé** | Évacuations (destination, transport, suivi) et accidents du travail (lésion, tiers, assurances, suivi) |
| Suivi chronique | **Codé** | Ouverture depuis consultation ou dossier, visites de suivi, clôture motivée |
| Tableaux de bord par rôle | **Codé** | Page adaptative selon le persona (clinique / admin-médical / admin-système / agent-RH) ; cockpit AGENT_RH dédié (endpoint `GET /dashboard/agent-rh` : effectif par rôle, patientèle par catégorie, nouveaux dossiers sur 7 j, sociétés sous-traitantes actives), ADMIN_MEDICAL enrichi (tendance des dossiers), KPI temps réel (refetch + invalidation SSE) ; les 6 rôles disposent de `dashboard.read` |
| Génération de documents imprimables | **Codé** | Ordonnance A4 et bon d'examen A4 (gabarit unifié, impression côté navigateur, sans dépendance serveur PDF) |

### Modules transversaux ajoutés (au-delà de la spécification d'origine)

| Module | État | Apport |
|---|---|---|
| **Messagerie interne chiffrée** | **Codé** | Conversations directes et de groupe, chiffrement **AES-256-GCM** du contenu et des pièces jointes, cloisonnement par site, pièces jointes (images/vidéos/audio/PDF/Office, 10 fichiers × 16 Mo, vérification des octets de signature, sanitisation des noms), réactions emoji, accusés de lecture, présence en ligne, indicateurs temps réel « en train d'écrire » (texte) **et** « en train d'enregistrer un message vocal » (note vocale, micro + onde) via endpoint `/typing` (`kind=text\|audio`), conversation directe créée par le 1ᵉʳ message (et non à l'ouverture), suppression de conversation via modale SARIS (plus de `confirm()` natif), suppression deux niveaux (« pour moi » / « pour tout le monde »), anti-flood |
| **Notifications temps réel (SSE)** | **Codé** | Flux `Server-Sent Events`, types (clinique / sortie / administratif / système), niveaux (INFO / SUCCÈS / AVERTISSEMENT / CRITIQUE), ciblage individuel ou diffusion filtrée par site + permission, invalidation live de l'interface, présence des utilisateurs |
| **Conditions d'utilisation (CGU)** | **Codé** | Version serveur `v1-2026.06`, acceptation tracée et horodatée, porte bloquante au login, re-demande automatique à chaque incrément de version |
| **Sauvegarde / restauration de configuration** | **Codé** | Snapshot JSON de la **configuration uniquement** (référentiels, matrice rôles↔permissions, paramètres), restauration non destructive (upsert), tâche planifiée quotidienne (02 h 00), rétention des 30 dernières, jamais de données cliniques |
| **Rotation / versioning des clés de chiffrement** | **Codé** | Format `v2:<keyId>:…`, trousseau de clés `MESSAGE_ENC_KEYS` (compatible secret Vault/Kubernetes), legacy `v1` toujours lisible, outil de ré-encryption post-rotation |
| **Offline-first & PWA** | **Codé** | Service Worker (Workbox), cache `NetworkFirst` des lectures API, file de rejeu IndexedDB (Dexie) avec idempotence par UUID, moteur de synchronisation et indicateur réseau |
| **Application de bureau Windows (Electron)** | **Codé** | Installateur **NSIS** réellement buildable (`pnpm --filter @cms-saris/desktop dist` → `CMS SARIS-Setup-<v>.exe`, ~91 Mo), assistant guidé (`oneClick:false`) **sans droits administrateur** (`perMachine:false`), URL serveur figeable au build (`SARIS_DEFAULT_API_URL` → `defaults.json`, zéro écran de config), **2 modes** (connecté à un serveur distant / autonome avec API + SQLite embarqués) ; le renderer **est** le build web (même code, 100 % identique) |
| **Interface responsive mobile/tablette** | **Codé** | Hook `useMediaQuery` + breakpoints (mobile < 768 px, tablette 768–1023 px, desktop ≥ 1024 px) ; sidebar → **drawer** mobile (bouton hamburger) sous 768 px ; split-panels (messagerie, triage, patients, consultation, rôles) empilés en **un panneau à la fois** sous 1024 px avec bouton Retour ; sidebar dossier/visite en bandeau, onglets scrollables, modales adaptatives ; **15 pages adaptées** (l'application était 100 % desktop-first auparavant) |

---

## Modèle de données réel

| Élément | Spécification d'origine | Application livrée |
|---|---|---|
| Nombre de tables | 71 tables cibles (Document 14) | **79 tables** (`packages/db/prisma/schema.prisma`) |

Le solde net est de **+8 tables** (79 − 71) : certaines tables de la cible initiale ont été
regroupées, renommées ou portées par d'autres tables, tandis que les modules transversaux
ajoutés introduisent les tables suivantes (voir le décompte détaillé au Document 14 §1) :

- **Messagerie (6 tables)** : `Conversation`, `ConversationParticipant`, `Message`,
  `MessagePieceJointe`, `MessageReaction`, `MessageMasque` ;
- **Notifications (2 tables)** : `Notification`, `NotificationLecture` ;
- **Configuration système** : `ParametreSysteme` (paramètres de sauvegarde, etc.) ;
- **Synchronisation offline-first** : `SyncState` (curseur de synchronisation par poste et par entité, mode local SQLite).

Des champs ont par ailleurs été ajoutés à des tables existantes pour porter ces
fonctionnalités (ex. `PreferenceUtilisateur.cguAccepteeLe` / `cguVersion`,
`Visite.typeCloture`, `Consultation.pickedUpById`).

> Le Document 14 décrit le dictionnaire **cible à 71 tables**. Pour l'application livrée,
> la référence faisant foi est le schéma Prisma à **79 tables**.

---

## Sécurité & permissions (état réel)

| Élément | Valeur réelle |
|---|---|
| Authentification | JWT (access + refresh 7 j, rotation) + 2FA TOTP (otplib) |
| Hachage des mots de passe / refresh tokens | bcrypt |
| Chiffrement des messages, pièces jointes et secrets TOTP | AES-256-GCM |
| Catalogue de permissions | **110 permissions** granulaires par module |
| Rôles | **6 rôles** : `ADMIN_SYSTEME` (tous droits), `ADMIN_MEDICAL`, `MEDECIN_CHEF`, `INFIRMIER`, `INFIRMIER_DELEGUE`, `AGENT_RH` |
| Formule des permissions effectives | `(permissions des rôles ∪ GRANTs) − REVOKEs` |
| Audit | `JournalAudit` (mutations métier, via intercepteur global `@Audit`) + `JournalAuthentification` (login/logout/TOTP, IP + géolocalisation) |
| Durcissement HTTP | Helmet, CORS restreint, `ValidationPipe` global (whitelist + transform) |
| Géolocalisation IP | ip-api.com (priorité) avec repli hors-ligne `geoip-lite`, `trust proxy` configurable |

---

## Règle de périmètre — extensions futures (hors application)

L'application couvre l'ensemble du périmètre clinique et administratif spécifié. Restent
**volontairement hors périmètre** et constituent des **extensions futures** :

- la délivrance physique des médicaments ;
- la gestion des stocks de pharmacie ;
- le réapprovisionnement ;
- le reporting agrégé directionnel (au-delà du tableau de bord opérationnel) ;
- le moteur centralisé d'exports ;
- la transmission automatique CNSS.

Les documents peuvent mentionner ces sujets uniquement comme limites ou extensions futures.

---

## Statut de complétude

Le tableau distingue désormais l'état de la **documentation** (DOCUMENTÉ) de l'état du
**produit logiciel** (CODÉ). **Tous les domaines métier sont à la fois documentés et codés.**

| Élément | Documentation | Code livré |
|---|---|---|
| Vision et périmètre | Complet | — |
| Spécifications des modules métier | Complet | **Codé (tous)** |
| Modèle de données | Complet (71 tables cibles) | **Codé — 79 tables** |
| Règles métier (~430 règles, 8 groupes) | Complet | **Codé** |
| Workflows détaillés (20 workflows) | Complet | **Codé** |
| Sécurité, administration et audit | Complet | **Codé** |
| Acteurs administratifs | Complet | **Codé** |
| Dossier patient | Complet | **Codé** |
| Accueil et triage | Complet | **Codé** |
| Consultation et actes prescrits | Complet | **Codé** |
| Sorties critiques | Complet | **Codé** |
| Suivi chronique | Complet | **Codé** |
| Synchronisation offline-first & sauvegardes | Complet | **Codé** |
| Application de bureau Windows (Electron / NSIS) | *Hors spécification d'origine* | **Codé (installateur buildable, 2 modes)** |
| Interface responsive mobile/tablette | *Hors spécification d'origine* | **Codé (15 pages adaptées)** |
| Tableaux de bord par rôle | Documenté | **Codé (clinique / admin-médical / admin-système / agent-RH)** |
| Messagerie interne chiffrée (+ indicateurs « en train d'écrire » texte & audio) | **Documenté — Document 18 (as-built)** | **Codé** |
| Notifications temps réel (SSE) | *Hors spécification d'origine* | **Codé** |
| Conditions d'utilisation (CGU) versionnées | *Hors spécification d'origine* | **Codé** |
| Rotation / versioning des clés de chiffrement | *Hors spécification d'origine* | **Codé** |
| Documents imprimables (ordonnance, bon d'examen) | Documenté | **Codé** |
| Recette et tests | Complet | Couverture minimale (E2E de base ; pas de tests unitaires) |
| Matrice de traçabilité (48 besoins, 52 tests) | Complet | — |
| Exigences non-fonctionnelles | Complet | **Appliqué (PWA, sécurité, géo-IP)** |
| Périmètre de développement | Complet | — |
| Maquettes écran | Hors périmètre documentation | Interfaces réelles implémentées (design system SARIS) |
| Spécification d'interfaces techniques | Voir dossier `stack-technique/` | — |

---

## Pile technique réelle

L'application est un **monorepo pnpm + Turbo**, type-safe et offline-first.

### Socle & frontend

| Couche | Technologie | Version |
|---|---|---|
| Gestionnaire de paquets | pnpm | 9.15.9 |
| Orchestration monorepo | Turbo | 2.9.4 |
| Langage | TypeScript | 5.9.3 |
| Framework UI | **React** | **19.2.4** |
| Outil de build | Vite | 7.3.2 |
| CSS | Tailwind CSS v4 | 4.2.1 |
| Routage | react-router-dom | 7.15.1 |
| État | Zustand | 5.0.13 |
| Données réseau | TanStack Query | 5.x |
| Composants | shadcn/ui + Radix UI | — |
| Base locale (offline) | Dexie (IndexedDB) | 4.4.2 |
| PWA | vite-plugin-pwa (Workbox) | 1.3.0 |

### Backend & données

| Couche | Technologie | Version |
|---|---|---|
| Framework | NestJS | 11.x |
| ORM | Prisma | 6.19.3 |
| Base de données | PostgreSQL | — |
| Authentification | Passport JWT + @nestjs/jwt | — |
| 2FA | otplib (TOTP) | 13.4.0 |
| Hachage | bcrypt | 6.0.0 |
| Planification | @nestjs/schedule (`@Cron`) | 6.1.3 |
| Limitation de débit | @nestjs/throttler | 6.5.0 |
| Sécurité HTTP | helmet | 8.1.0 |
| Géolocalisation IP | geoip-lite (repli) | 2.0.2 |
| Traitement d'images | sharp | 0.34.5 |

> ⚠️ **Mise à jour notable par rapport aux décisions techniques initiales :** le frontend
> repose sur **React 19** (et non React 18) et **Tailwind CSS v4**. Les fiches du dossier
> `stack-technique/` qui mentionnent encore React 18 sont à lire à la lumière de cet état réel.

---

## Documents connexes

Le dossier `../stack-technique/` contient les décisions techniques d'implémentation :

- `00-synthese.md` — Tableau récapitulatif de toute la stack
- `01-frontend.md` — React (19) + Vite + Tailwind v4 + shadcn/ui
- `02-backend.md` — NestJS + TypeScript
- `03-base-de-donnees.md` — PostgreSQL + Prisma + Dexie.js
- `04-offline-sync.md` — Moteur de synchronisation offline
- `05-securite.md` — JWT + bcrypt + TOTP + chiffrement AES-256-GCM
- `06-monorepo.md` — Turborepo + pnpm
