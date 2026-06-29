# _SOURCE — Brief système canonique (CMS SARIS, tel que CONSTRUIT)

> Référence interne unique pour la rédaction du cahier des charges. Les faits ci-dessous
> sont la VÉRITÉ « as-built » (le système est développé et déployé). Tout document doit
> s'y aligner (mêmes noms de modules, mêmes rôles, mêmes chiffres). En cas de doute, lire
> le code (chemins ci-dessous) — ne jamais inventer.

## Identité
- **Nom** : CMS SARIS — Centre Médico-Social de SARIS.
- **Domaine** : gestion clinique médico-sociale **multi-site** pour les **travailleurs (et ayants droit / riverains / sous-traitants)** de la société **SARIS-CONGO** (sucrerie, Congo-Brazzaville). Sites : **Moutela** et **Nkayi**.
- **Contexte** : projet de **soutenance** (stage à SARIS). Déploiement cloud pour la démo ; cible réelle = réseau SARIS plus tard.
- **Remplace** : un suivi « façon Jeannette » sur Excel + papier.

## Architecture (offline-first multi-poste)
- **Serveur central (cloud)** = source de vérité : **API NestJS sur Render** (`https://cms-saris-api.onrender.com`) + **PostgreSQL sur Neon**.
- **Site web public** (React/Vite PWA) sur Render (`https://cms-saris-web.onrender.com`) : client direct du central, marche de partout, offline léger (service worker + file de rejeu IndexedDB chiffrée).
- **Application desktop (Electron, Windows)** mode `local` : **backend NestJS + base SQLite EMBARQUÉS** → fonctionne **hors-ligne** ; se **synchronise** avec le central (LWW). « Online-first » : en ligne le renderer parle au central (temps réel) ; hors-ligne il bascule sur le backend local.
- **Monorepo pnpm** : `apps/api` (NestJS), `apps/web` (React), `apps/desktop` (Electron), `packages/db` (Prisma : schéma PG + schéma SQLite généré), `packages/types`, `packages/ui`. Racine réelle : `CMS/APP/CMS-SARIS/`.

## Stack technique
- **Frontend** : React 19, Vite, Tailwind v4, Zustand (stores), React Query (cache serveur), react-i18next (**bilingue FR/EN strict**), VitePWA. Design system « SARIS » (CSS vars, inline styles, 0 gradient, radius ≤ 10px).
- **Backend** : NestJS 11, Prisma 6, PostgreSQL (central) / SQLite (desktop). Auth JWT (access + refresh, session unique par utilisateur), TOTP 2FA (chiffré AES-256-GCM at-rest), permissions par rôle (guard `@RequirePermissions`).
- **Desktop** : Electron 33 (Node 20.18), electron-builder + installeur NSIS sur-mesure, auto-update electron-updater, stockage sécurisé DPAPI.
- **Sync** : module `sync/` (pull/push, LWW sur `updatedAt` + `baseUpdatedAt`, tombstones soft-delete, cron purge), `SyncState` curseur par poste.

## Rôles (3 — système réduit, NE PAS remettre 6/7)
1. **ADMIN_SYSTEME** — super-administrateur (tout le catalogue de permissions, gouvernance + clinique).
2. **MEDECIN_CHEF** — admin médical + supervision (voit tout le clinique du site, peut **verrouiller** un dossier). **MEDECIN n'est PAS un rôle** : c'est une **profession** du personnel médical (TypePersonnel) mappée au rôle MEDECIN_CHEF (tout médecin reçoit le rôle MEDECIN_CHEF).
3. **INFIRMIER** — triage + consultation/prescription déléguée.
> Supervision = {ADMIN_SYSTEME, MEDECIN_CHEF}. Catégories de patients (pilotent les droits aux bons) : ASSURE_CDI, ayant droit, RIVERAIN, sous-traitant, etc. (référentiel `CategoriePatient`).

## Modules fonctionnels (noms canoniques)
- **Triage / file d'attente** (`apps/api/src/modules/triage`) — visites, constantes vitales, file par ordre d'arrivée (PAS de priorité).
- **Consultation** (`modules/consultation`) — consultation pilotée par la décision, clôture guidée, type de consultation, certificat, repos.
- **Patients / Dossier** (`modules/patient`) — dossier **centralisé cross-site** (suit le patient tous sites) ; identité, allergies, antécédents, alertes, mode de vie, données emploi ; **verrou de confidentialité** médecin-chef ; ayants droit par matricule.
- **Documents cliniques** — ordonnance, bon d'examen, **bon de pharmacie**, certificat, évacuation (imprimables, gabarit A4 SARIS).
- **Sorties critiques / Évacuations** (`modules/...evacuation`).
- **Référentiels** (`modules/referentiels`) — catégories patient, motifs, pathologies, médicaments, types d'examen, types de consultation, sociétés sous-traitantes, employés SARIS.
- **Acteurs / Personnel & RH** (`modules/personnel`, `modules/acteurs`) — personnel médical, habilitations, absences.
- **Accès & habilitations** (`modules/admin` roles/utilisateurs) — utilisateurs, rôles, permissions (~110), récupération de compte, sessions.
- **Messagerie interne** (`modules/messagerie`) — chat chiffré AES-256-GCM façon WhatsApp Web (groupes, médias, réactions, accusés, présence), cloisonnée par site, temps réel SSE.
- **Notifications & Annonces** (`modules/notification`) — cloche + SSE ; annonces admin ; **annonces de mise à jour** (lien d'installation desktop).
- **Tableau de bord & Statistiques** (`modules/dashboard`) — KPI par rôle, stats type×pathologie×catégorie, exports CSV/PDF.
- **Synchronisation** (`modules/sync` + écran admin) — supervision postes, file terrain, sauvegardes config, volumétrie.
- **Paramètres** (`modules/parametres`) — config système (mots de passe, sessions, notifications, sauvegardes).
- **Audit & sécurité** — journal d'audit persistant (`@Audit` + interceptor), IP réelle + géo, conditions d'utilisation (CGU).

## Données (échelle) — VÉRIFIÉ dans le code
- **87 tables/modèles Prisma** (`grep -c "^model " schema.prisma` = 87). UUID majoritaire. Colonnes sync : `updatedAt`, `deletedAt` (soft-delete), index. Schéma : `packages/db/prisma/schema.prisma` (PG) ; `packages/db/prisma/sqlite/schema.prisma` (desktop).
- **110 permissions** (const `PERMISSIONS` dans `packages/types/src/permissions.ts`). 3 rôles.
- ⚠️ Le module backend `acteurs` N'EXISTE PAS : `personnel` (personnel médical + délégations + sociétés sous-traitantes) et `employe` (registre des employés SARIS) le couvrent. `parametres` est un module SUPPORT (non importé dans AppModule, tiré par security/notification/admin). Cf. [[plan_modules]].

## Exigences non fonctionnelles clés (as-built)
- **Offline-first** : desktop pleinement opérationnel hors-ligne, sync à la reconnexion.
- **Sécurité** : JWT + session unique + révocation immédiate ; TOTP 2FA ; chiffrement at-rest (TOTP, messagerie) ; audit ; CORS strict ; rate-limit login (10/min/IP) ; trust proxy.
- **Confidentialité** : dossier centralisé mais activité scopée à l'initiateur (consultations/triage par soignant) ; verrou médecin-chef ; rideau de confidentialité (flou) sur les zones cliniques.
- **i18n** : bilingue FR/EN strict. **Responsive** mobile (drawer sidebar, splits empilés).
- **Documents A4** imprimables. **Temps réel** SSE (notifs, messagerie, présence, invalidations live).

## Conventions de rédaction (méthodo ULAMU — generic_prompt_v2)
- En-tête par doc : version, date (2026-06-26), statut, historique.
- **Identifiants** : décisions **D-xxx**, paramètres métier **PM-xx**, exigences **EF-NN-xx**, règles **RM-NN-xx**, cas d'usage **CU-NN-xx** (critères « Étant donné / Quand / Alors »), contrats d'interface **C-x**.
- **Une seule source de vérité** : un chiffre/terme défini une fois (référentiel/glossaire) et référencé `[[...]]` ailleurs. Liens Obsidian `[[...]]`.
- **Honnêteté** : documenter ce qui EXISTE (as-built). Marquer « à confirmer » si incertain. Pas d'invention.
- Pas de code dans les specs de module (Phase 2) ; les choix techniques vont en Phase 3 (ADR).

## Pointeurs (où lire la vérité)
- Code : `CMS/APP/CMS-SARIS/apps/{api,web,desktop}`, `packages/{db,types,ui}`.
- Mémoire projet (faits décisionnels) : `C:\Users\bouwa\.claude\projects\D--parcours-mes-projets-perso-A-realiser-CMS-SARIS\memory\` (fiches `project_*.md`).
- Anciens docs (référence, NE PAS copier aveuglément — beaucoup ont changé) : `Docs/CMS/cahiers de charges_ancien`, `Docs/CMS/charte graphique`.
