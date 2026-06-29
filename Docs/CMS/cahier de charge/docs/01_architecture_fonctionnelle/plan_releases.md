# Plan de releases — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document « as-built » (le système est développé et déployé). Il reconstitue **a posteriori** le plan de versions du produit tel qu'il EXISTE aujourd'hui, à partir du code (`apps/api/src/modules`, `apps/web/src`, `apps/desktop/electron`, `packages/db/prisma/schema.prisma`, `packages/types/src/permissions.ts`) et de la traçabilité interne du projet. Il ne planifie pas du « à faire » : il **classe** ce qui est livré par jalon logique et indique l'état réel. Source de vérité : [[_SOURCE_systeme]]. Modules : [[plan_modules]]. Domaines : [[carte_domaines]].

---

## 1. Objet et avertissement de méthode

CMS SARIS n'a **pas** été construit selon un plan de versions formel publié à l'avance : c'est un projet de soutenance développé en continu sur une seule branche `main` (la branche `feat/offline-first` a été fusionnée puis supprimée). Ce document **reconstruit** trois jalons cohérents — **MVP**, **V1**, **V2/évolutions** — par regroupement fonctionnel des modules et fonctionnalités réellement présents.

> Honnêteté (as-built) : le découpage MVP / V1 / V2 ci-dessous est une **lecture de structuration a posteriori**, pas une trace de releases taguées. Le numéro de version qui existe réellement dans le code est celui de l'**application desktop** (`apps/desktop/package.json` = **1.4.1** au 2026-06-26) ; il ne recouvre pas le même périmètre que les jalons MVP/V1/V2 de ce plan. Tout élément dont l'appartenance à un jalon est un choix de présentation est signalé.

### 1.1 Convention MoSCoW

Chaque fonctionnalité est classée selon la priorité **MoSCoW** *relative à son jalon* :

- **Must** — indispensable au jalon ; sans elle le jalon n'a pas de sens.
- **Should** — importante, attendue, mais le jalon reste utilisable sans.
- **Could** — utile, confort ; ajoutée parce que le coût était faible.
- **Won't (this time)** — explicitement **hors périmètre** (décision de retrait), documentée pour mémoire.

### 1.2 Convention d'état réel

- **Livré** — présent et vérifié dans le code (typecheck/tests/E2E selon la fiche mémoire citée).
- **Livré (à valider)** — code présent, mais une vérification finale dépend d'une action externe (test utilisateur, repackaging, certificat de signature).
- **Structure prête (non exposé)** — tables/champs présents mais aucun flux/endpoint exposé.

---

## 2. Jalon MVP — Cœur clinique

**Intention** : remplacer le suivi « façon Jeannette » (Excel + papier) par un parcours de soin numérique complet sur un site, avec gestion des accès. C'est le socle métier ; tout le reste s'y greffe.

**État global du jalon : Livré.**

### 2.1 Périmètre MoSCoW

| Priorité | Fonctionnalité | Module(s) | État | Source |
|----------|----------------|-----------|------|--------|
| **Must** | Triage / file d'attente (visites, constantes vitales, file par ordre d'arrivée, dédup patient) | `triage`, `patient` | Livré | [[plan_modules]] ; `apps/api/src/modules/triage` (Brique 1) |
| **Must** | Consultation pilotée par la décision (clôture guidée, type de consultation, certificat, repos, prise en charge anti-double) | `consultation` | Livré | `apps/api/src/modules/consultation` (Brique 2) |
| **Must** | Dossier patient centralisé cross-site (identité, allergies, antécédents, alertes, mode de vie, ayants droit par matricule) | `patient`, `employe` | Livré | `apps/api/src/modules/patient` (Brique 3) |
| **Must** | Documents cliniques imprimables A4 (ordonnance, bon d'examen, bon de pharmacie, certificat, évacuation) | `consultation`, `bon-examen`, `bon-pharmacie`, `sorties-critiques` | Livré | (traçabilité interne) |
| **Must** | Accès & habilitations : utilisateurs, rôles, permissions (3 rôles, ~110 permissions), sessions | `admin`, `security` | Livré | `packages/types/src/permissions.ts` ; `apps/api/src/modules/admin` |
| **Must** | Référentiels métier (catégories patient, motifs, pathologies, médicaments, types d'examen/consultation/certificat) | `referentiels` | Livré | `apps/api/src/modules/referentiels` |
| **Should** | Personnel médical & RH (habilitations, absences, délégations, sociétés sous-traitantes) | `personnel` | Livré | `apps/api/src/modules/personnel` |
| **Should** | Cohérence dossier : timeline unifiée, historique des constantes, alertes cliniques auto, export PDF de synthèse | `patient`, `consultation` | Livré | `apps/api/src/modules/patient` (Brique 3) |
| **Should** | Authentification forte : JWT access/refresh, session unique, TOTP 2FA chiffré, récupération de compte | `security`, `admin` | Livré | `apps/api/src/modules/security` |
| **Could** | Catégorie patient pilotant les droits aux bons (CDI / ayant droit / riverain / sous-traitant) | `referentiels`, `bon-pharmacie` | Livré | [[_SOURCE_systeme]] |
| **Could** | Uniformisation design (Modal/EmptyState/StatusPill, 0 emoji UI, auto-enregistrement) | `apps/web` | Livré | `apps/web/src` (Brique 4) |
| **Won't** | Notion de priorité dans la file (file strictement par ordre d'arrivée) | `triage` | Retiré (colonnes DROP) | (traçabilité interne) |
| **Won't** | Suivi chronique / grossesse, accident du travail, certificat hors périmètre, modules RH étendus retirés lors de l'alignement recueil | divers | Retiré (scope-creep) | (traçabilité interne) |

### 2.2 Critères de succès chiffrés du MVP

Les seuils ci-dessous sont **constatés** (et non des objectifs futurs) sur l'état livré ; ils servent de critères d'acceptation du cœur clinique.

| ID | Critère | Cible | Mesure constatée | Source |
|----|---------|-------|------------------|--------|
| **EF-MVP-01** | Parcours triage → consultation → dossier vérifié de bout en bout | E2E au vert | **126/126** (refonte workflows) | (traçabilité interne) |
| **EF-MVP-02** | Tests unitaires backend au vert | 100 % | **44/44** | (traçabilité interne) |
| **EF-MVP-03** | Couverture CRUD modules vérifiée | 100 % | **19/19** | (traçabilité interne) |
| **EF-MVP-04** | E2E cliniques (parcours médecin) | au vert | **40/40** | (traçabilité interne) |
| **EF-MVP-05** | Erreurs de typage (`tsc`) sur api + web + desktop | 0 | **0** | (traçabilité interne) |
| **EF-MVP-06** | Catalogue de permissions (gouvernance des accès) | défini, unique | **~110** permissions, **3** rôles | `packages/types/src/permissions.ts` |
| **EF-MVP-07** | Dédup patient au triage (anti-doublon) | distance ≤ 2 + même date de naissance | Levenshtein ≤ 2, normalisation accents | (traçabilité interne) |
| **EF-MVP-08** | Documents cliniques imprimables au gabarit unifié | 5 documents | ordonnance, bon d'examen, bon de pharmacie, certificat, évacuation | (traçabilité interne) |

> Note sur les tests : il n'existe **pas** de suite de tests automatisés exhaustive sur tout le code (CI complète). Les chiffres ci-dessus sont des suites ciblées (unitaires purs + intégration CRUD + scénarios E2E navigateur) plus `tsc`. Présenté comme tel, sans embellissement.

---

## 3. Jalon V1 — Plateforme déployable (offline-first, communication, pilotage)

**Intention** : transformer le cœur clinique mono-poste en **plateforme multi-poste déployable** : fonctionnement hors-ligne et synchronisation, application de bureau, communication interne, temps réel, statistiques, et durcissement sécurité/audit pour un usage réel.

**État global du jalon : Livré (à valider) — le runtime est complet ; restent le test d'acceptation desktop par l'utilisateur et le repackaging avec l'URL/les clés du déploiement réel.**

### 3.1 Périmètre MoSCoW

| Priorité | Fonctionnalité | Module(s) | État | Source |
|----------|----------------|-----------|------|--------|
| **Must** | Offline-first : soft-delete bi-cible, sync pull/push LWW, tombstones, curseur `SyncState`, cron de purge | `sync` | Livré | `apps/api/src/modules/sync` |
| **Must** | Application desktop Electron (Windows) mode `local` : backend NestJS + SQLite embarqués, fonctionne hors-ligne | `apps/desktop` | Livré (à valider) | `apps/desktop/electron` |
| **Must** | Installeur NSIS sur-mesure + auto-update electron-updater (GitHub) | `apps/desktop` | Livré (à valider) | `apps/desktop/electron` |
| **Must** | Online-first / offline-fallback : en ligne le renderer parle au central (temps réel), hors-ligne bascule sur le backend local | `apps/desktop`, `apps/web` | Livré | `apps/desktop/electron` |
| **Must** | PWA web : service worker (NetworkFirst GET API) + file de rejeu IndexedDB chiffrée | `apps/web` | Livré | `apps/web/src` |
| **Should** | Messagerie interne chiffrée AES-256-GCM façon WhatsApp Web (groupes, médias, réactions, accusés, présence), cloisonnée par site, temps réel SSE | `messagerie` | Livré | `apps/api/src/modules/messagerie` |
| **Should** | Notifications & annonces temps réel (cloche + SSE), présence en ligne | `notification` | Livré | `apps/api/src/modules/notification` |
| **Should** | Tableau de bord & statistiques par rôle (type × pathologie × catégorie), exports CSV/PDF, sélecteur de période | `dashboard` | Livré | `apps/api/src/modules/dashboard` |
| **Should** | Synchronisation supervisée : écran admin (postes en ligne, file terrain, conflits, sauvegardes de config, volumétrie) + cron | `admin`, `sync` | Livré | `apps/api/src/modules/sync` |
| **Should** | Audit persistant (`@Audit` + interceptor global), IP réelle + géolocalisation hors-ligne, CGU versionnées bloquantes | transverse | Livré | (traçabilité interne) |
| **Could** | i18n bilingue FR/EN strict (react-i18next), bascule persistée sur le compte | `apps/web` | Livré | `apps/web/src` |
| **Could** | Responsive mobile (drawer sidebar, splits empilés), mémoire d'état par page, navigation rapide (fil d'Ariane + avant/arrière), rideau de confidentialité | `apps/web` | Livré | `apps/web/src` |
| **Could** | Codes techniques masqués des vues cliniques (appli non-IT), documents au design SARIS | `apps/web` | Livré | `apps/web/src` |
| **Won't** | UI de résolution de conflits côté client (le serveur les journalise, la supervision les affiche) | `sync` | Hors périmètre | (traçabilité interne) |
| **Won't** | Signature de code (certificat OV/EV) — bloquant externe pour SmartScreen / auto-update prod | `apps/desktop` | Hors périmètre (externe) | (traçabilité interne) |

### 3.2 Architecture de déploiement V1 (rappel)

- **Serveur central (cloud)** = source de vérité : API NestJS sur **Render** + PostgreSQL sur **Neon**.
- **Site web public** (React/Vite PWA) sur Render : client direct du central, offline léger.
- **Application desktop** (Electron, Windows) : backend + SQLite embarqués, sync LWW avec le central.

Détails et décisions : [[_SOURCE_systeme]] §Architecture, [[exigences_non_fonctionnelles]].

### 3.3 Points de validation restants du jalon V1

| ID | Élément | Nature | Source |
|----|---------|--------|--------|
| **D-V1-01** | Test d'acceptation desktop par l'utilisateur (install + usage réel) | Action utilisateur | (traçabilité interne) |
| **D-V1-02** | Repackaging avec l'URL Render réelle + clés du central (les builds de test sont bakés sur localhost + clés DEV) | Action de build | (traçabilité interne) |
| **D-V1-03** | Réglage `TRUST_PROXY` au déploiement (IP réelle derrière proxy) | Action de config | (traçabilité interne) |
| **D-V1-04** | Certificat de signature de code (SmartScreen, auto-update prod) | Bloquant externe | (traçabilité interne) |

---

## 4. Jalon V2 — Durcissements & évolutions

**Intention** : robustesse de production et évolutions au-delà du déploiement de base : annonces de mise à jour, sécurité avancée de la messagerie, rotation et ré-encryption des clés, finitions médias, alignement sur le recueil de l'existant.

**État global du jalon : majoritairement Livré ; quelques chantiers cadrés mais partiels (signalés).**

### 4.1 Périmètre MoSCoW

| Priorité | Fonctionnalité | Portée | État | Source |
|----------|----------------|--------|------|--------|
| **Must** | Sécurité avancée messagerie en prod : IDOR cross-site fermé, rate-limit par utilisateur, sanitization fichiers + anti-exécutable (magic-bytes), cap de groupe | `messagerie` | Livré | `apps/api/src/modules/messagerie` |
| **Must** | Audit de confidentialité des lectures cliniques (cloisonnement cross-site) | transverse | Livré (9 failles corrigées) | (traçabilité interne) |
| **Must** | Session unique + révocation immédiate (vérification du `sid` en base à chaque requête) | `security` | Livré | `apps/api/src/modules/security` |
| **Must** | File IndexedDB chiffrée au repos (AES-256-GCM, clé non-extractible) + token rafraîchi au rejeu | `apps/web`, `apps/desktop` | Livré | `apps/web/src` |
| **Should** | Rotation / versioning de la clé de chiffrement (format `v2:keyId`, `MESSAGE_ENC_KEYS` + courant, lecture legacy v1) | transverse | Livré | (traçabilité interne) |
| **Should** | Outil de ré-encryption v1 → v2 (endpoint non destructif) + clés « Vault-ready » (`MESSAGE_ENC_KEYS_FILE`) | `admin`/`sync` | Livré (run de masse non exécuté) | (traçabilité interne) |
| **Should** | Annonces administrateur + annonces de mise à jour (lien d'installation desktop) | `notification`, `apps/desktop` | Livré | [[_SOURCE_systeme]] |
| **Should** | Suppression non destructive (CRUD hard-delete 409-safe) sur tous les modules + permissions | transverse | Livré | (traçabilité interne) |
| **Could** | Partage médias sophistiqué (album, rogneur vidéo ffmpeg.wasm, notes vocales, emojis Apple offline, lecteurs à la demande) | `messagerie` | Livré (rogneur à valider au 1er plan) | `apps/api/src/modules/messagerie` |
| **Could** | Sauvegarde / restauration de la configuration (réelle, non destructive) + cron quotidien + rétention | `admin` | Livré | `apps/api/src/modules/admin` |
| **Could** | Dossier patient + parcours de soin synchronisés en **global** (continuité des soins multi-site sur chaque poste) | `sync` | Livré | `apps/api/src/modules/sync` |
| **Won't** | Fusion de dossiers patients (table + statut + permission présents, aucun flux exposé) | `patient` | Structure prête (non exposé) | (traçabilité interne) |
| **Won't** | KPI Absences / Habilitations dans les dashboards (tables sans gestion opérationnelle → toujours 0) | `dashboard` | Retiré | (traçabilité interne) |

### 4.2 Chantiers cadrés mais non finalisés (honnêteté)

| ID | Élément | État réel | Source |
|----|---------|-----------|--------|
| **D-V2-01** | Ré-encryption de masse v1 → v2 | Outil livré, **run de masse non exécuté** (à faire au jour d'une vraie rotation) | (traçabilité interne) |
| **D-V2-02** | Rogneur vidéo messagerie | Code livré, **non testable en automatisation** (onglet caché suspend le décodage) → à valider visuellement par l'utilisateur | (traçabilité interne) |
| **D-V2-03** | Flux cible clinique (confidentialité par médecin, verrou dossier non-suivi, notif ciblée à l'envoi, ayants droit par matricule) | Plan validé, décisions verrouillées ; implémentation partielle (verrou + scope global présents) | (traçabilité interne) |
| **D-V2-04** | Alignement recueil de l'existant — phase « cœur » (catégorie pilote les droits aux bons) | Phase 1 (retrait scope-creep) faite ; reste migration DROP des tables dormantes + pilotage catégorie complet | (traçabilité interne) |

---

## 5. Synthèse : modules par jalon

| Module ([[plan_modules]]) | Jalon de rattachement | Évolutions ultérieures |
|---------------------------|-----------------------|------------------------|
| `triage` | MVP | — |
| `consultation` | MVP | flux cible clinique (V2, partiel) |
| `patient` | MVP | dossier global synchronisé (V2) |
| `employe` | MVP | — |
| `bon-examen` | MVP | — |
| `bon-pharmacie` | MVP | pilotage par catégorie (V2, partiel) |
| `sorties-critiques` | MVP | — |
| `referentiels` | MVP | — |
| `personnel` | MVP | — |
| `security` | MVP | session unique + révocation immédiate (V2) |
| `admin` | MVP (accès) | supervision sync + sauvegardes (V1), ré-encryption (V2) |
| `sync` | V1 | dossier global synchronisé (V2) |
| `messagerie` | V1 | sécurité avancée + médias sophistiqués (V2) |
| `notification` | V1 | annonces admin + annonces de MAJ (V2) |
| `dashboard` | V1 | retrait KPI Absences/Habilitations (V2) |
| `apps/desktop` | V1 | online-first, auto-update, repackaging (V1/V2) |

---

## 6. Renvois

- Vérité de référence : [[_SOURCE_systeme]].
- Modules et dépendances : [[plan_modules]].
- Domaines fonctionnels : [[carte_domaines]].
- Exigences non fonctionnelles (sécurité, offline-first, i18n, responsive) : [[exigences_non_fonctionnelles]].
- Paramètres métier : [[parametres_metier]].
- Vision de déploiement (Render / Neon / desktop) : [[_SOURCE_systeme]] §Architecture.

> Tous les jalons et états de ce document reflètent l'état réel constaté dans le code et la mémoire projet au 2026-06-26. Le découpage MVP / V1 / V2 est une structuration a posteriori (le produit a été développé en continu) ; les éléments « à valider » et « non exposé » sont signalés sans embellissement.
