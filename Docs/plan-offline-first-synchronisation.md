# Plan d'architecture — Mode offline-first & synchronisation (CMS SARIS)

> **Statut : CONCEPTION (cible).** Ce document décrit l'évolution vers un fonctionnement
> **offline-first à base locale**, au-delà du mode **centralisé** actuel (le poste/web
> dialogue avec un serveur distant ; voir doc 09 « Synchronisation Offline-First » pour
> l'état réel actuel). Il sert de feuille de route et de référence de soutenance.

---

## 1. Objectif & motivation

**Contexte.** Les centres médico-sociaux (Congo) peuvent perdre la connexion Internet à
tout moment. Aujourd'hui, si le serveur distant est injoignable, le poste ne peut plus
travailler normalement — **un centre ne doit jamais être bloqué par une coupure réseau.**

**Objectifs.**
- **Travail 100 % hors-ligne** : créer/consulter/modifier patients, visites, consultations… sans réseau.
- **Synchronisation automatique** dès que la connexion revient, **sans action de l'utilisateur**.
- **Pas de perte ni de conflit dangereux** de données médicales.
- **Zéro installation côté utilisateur** : la base locale est **embarquée dans l'application** (rien à installer, pas d'admin).
- **Données finalement centralisées** sur le serveur (source de vérité consolidée, multi-sites).

---

## 2. Principe directeur — « local-first »

Chaque poste **lit et écrit dans sa propre base locale**. Le réseau devient une
**commodité** (pour synchroniser), plus une **dépendance** (pour travailler). Le serveur
central reste la **source de vérité consolidée** : il agrège les données de tous les postes
et de tous les sites, et c'est lui que la version web utilise.

---

## 3. Architecture cible

```
   POSTE A (centre 1)                    SERVEUR CENTRAL (hébergeur)
 ┌─────────────────────────┐           ┌────────────────────────────┐
 │ Frontend React (Electron)│           │ API NestJS                 │
 │        │                 │   sync    │        │                   │
 │ Backend NestJS EMBARQUÉ  │◀────────▶ │   PostgreSQL (vérité)      │
 │        │                 │  HTTPS    │                            │
 │   SQLite (local, fichier)│           └────────────────────────────┘
 └─────────────────────────┘                      ▲
                                                   │ sync
   POSTE B (centre 2)  … (idem, SQLite local) ─────┘     +  Web → directement sur le serveur
```

| | **Serveur central** | **Poste utilisateur (local)** |
|---|---|---|
| Base | **PostgreSQL** (robuste, multi-utilisateurs) | **SQLite** (fichier unique, **embarqué dans le `.exe`**) |
| Logique métier | NestJS (API distante) | **NestJS embarqué** (même code) |
| Installation | une fois, sur l'hébergeur | **aucune** — livrée avec l'app |
| Rôle | centralisation, web | travail hors-ligne, performance |

---

## 4. Décisions techniques (avec justification et état réel du code)

### 4.1 Base locale : SQLite via Prisma (schéma bi-cible)
SQLite est le bon choix pour une base **embarquée** : un seul fichier, aucun serveur,
aucun port, aucune installation. **Prisma sait cibler SQLite ET PostgreSQL** → on réutilise
le **même modèle de données** (79 tables).
**Points d'attention SQLite (à traiter) :** les **enums** Prisma deviennent du texte (sans
impact fonctionnel) ; les **tableaux scalaires** (`String[]`, etc.) **ne sont pas supportés**
par SQLite → à convertir en `Json` ou en table de liaison ; les champs **`Json`** sont
supportés (stockés en texte). *(72 champs `[]` existent dans le schéma — en grande majorité
des **relations** (supportées) ; seuls les éventuels tableaux **scalaires** sont concernés.)*

### 4.2 Backend NestJS **embarqué** dans le poste (réutilisation de la logique)
Toute la logique métier (validation DTO, permissions/RBAC, règles, audit, chiffrement) vit
aujourd'hui **dans le serveur NestJS**. Pour travailler hors-ligne, cette logique doit tourner
**en local**. La voie propre : **embarquer le backend NestJS dans l'application Electron**,
pointant sur le SQLite local.
- ✅ **Réutilise 100 % du code existant** (pas de réécriture de la logique en frontend).
- Hors-ligne : `Frontend → NestJS local → SQLite`.
- En ligne : un **moteur de synchro** réconcilie SQLite ↔ PostgreSQL central.
- *Alternative écartée :* réimplémenter validation/règles/permissions côté frontend → duplication massive, risque d'incohérence (dangereux en médical).

### 4.3 Identifiants UUID — ✅ déjà en place
**76/79 tables utilisent `@default(uuid())`.** C'est un **atout majeur** : chaque poste
**génère ses propres identifiants hors-ligne sans risque de collision** lors de la
remontée vers le serveur. (Avec des entiers auto-incrémentés, ce serait impossible.)

### 4.4 Horodatage & versionnage — ⚠️ prérequis à compléter
La synchro delta et la détection de conflit reposent sur un **`updatedAt` par enregistrement**.
Aujourd'hui : `createdAt` sur ~46 tables, mais **`updatedAt` sur seulement 9**. 
**Prérequis :** ajouter `updatedAt DateTime @updatedAt` (et un compteur de version optionnel)
à **toutes les tables synchronisées** (migration unique).

---

## 5. Modèle de synchronisation

### 5.1 Détection en ligne / hors-ligne
Sonde périodique du serveur (`GET /health`) + état du flux SSE. Bascule automatique :
hors-ligne → file d'attente locale ; retour en ligne → déclenchement de la synchro.

### 5.2 Cycle de synchronisation (à la reconnexion + périodique)
Le poste mémorise un **curseur `lastSyncAt`**. À chaque cycle :
1. **PULL** : « donne-moi tout ce qui a changé sur le serveur **depuis `lastSyncAt`** (pour mon **site**) » → application locale des deltas.
2. **PUSH** : envoi des **changements locaux** depuis le dernier push (avec `updatedAt`/version).
3. Mise à jour de `lastSyncAt`.

### 5.3 Détection de conflit (PAS de verrou)
> **Point d'expert capital :** on ne peut **pas verrouiller** un enregistrement entre des
> machines hors-ligne (un poste déconnecté ne peut rien verrouiller sur le serveur). Le
> mécanisme fiable est la **détection optimiste** : au moment du PUSH, on **compare la
> version** (`updatedAt`/n° de version) de l'enregistrement local à celle du serveur. Si le
> serveur a une version **plus récente non vue** par le poste → **conflit**.

### 5.4 Résolution de conflit
- **Par défaut : « dernière écriture gagne »** (horodatée), avec **conservation de la version
  perdante dans le journal d'audit** (jamais de perte silencieuse).
- **Données médicales sensibles** (constantes, diagnostics…) : option **« signalement »** →
  l'enregistrement en conflit est marqué pour **revue humaine** plutôt que d'écraser.
- **Granularité** : par **enregistrement** (simple) au début ; **par champ** (fusion fine) en évolution.
- Règle **par domaine** à définir (cf. §14).

### 5.5 Suppressions → tombstones — ⚠️
Les suppressions sont aujourd'hui **« dures »** (`deletedAt` sur 1 seule table). Or une
suppression dure **ne peut pas se synchroniser** (rien à transmettre). Deux options :
- **Soft-delete généralisé** (`deletedAt` partout) — simple, traçable ; **recommandé** ; **ou**
- **Journal de changements** (table `SyncChangeLog` : entité, id, opération, date) qui
  enregistre aussi les suppressions à propager.

### 5.6 Cloisonnement par site
20 tables portent `siteId`. La synchro est **scopée par site** : un poste ne synchronise
**que les données de son centre** (sécurité + volume réduit). Le serveur agrège tous les sites.

### 5.7 Ordre & idempotence
Grâce aux **UUID**, les opérations sont **rejouables** sans doublon (un PUSH renvoyé deux
fois n'crée pas deux enregistrements). Les deltas sont appliqués de façon **idempotente**.

---

## 6. Protocole de synchronisation (esquisse)

| Endpoint | Rôle |
|---|---|
| `GET /sync/pull?since=<lastSyncAt>&siteId=<id>` | Renvoie tous les deltas serveur depuis `since` (par entité) |
| `POST /sync/push` | Reçoit un **lot** de deltas locaux ; renvoie les conflits éventuels + nouvel `lastSyncAt` |

**Format d'un delta** : `{ entite, id, op: 'upsert'|'delete', version, updatedAt, donnees }`.
Le PUSH est **transactionnel par lot** ; en cas de conflit, le serveur renvoie la version
serveur pour que le poste applique la résolution.

---

## 7. Sécurité
- Synchro authentifiée (**JWT**), **HTTPS** obligatoire, cloisonnement **par site** appliqué côté serveur (anti-IDOR — déjà en place).
- La **messagerie reste chiffrée** au repos (AES-256-GCM, déjà en place) — le contenu chiffré se synchronise tel quel.
- **Option : chiffrement de la base locale** (SQLCipher) si les postes sont peu sécurisés physiquement (cf. §14).

---

## 8. Migrations de schéma
Le schéma évoluera. Chaque **SQLite local doit être migré** à l'installation et à chaque
mise à jour de l'app (Prisma migrate ciblant SQLite, exécuté par le backend embarqué au
démarrage). Le versionnage du schéma local est suivi pour éviter les divergences.

---

## 9. Réutilisation vs construction

| Déjà en place (réutilisé) | À construire |
|---|---|
| Schéma Prisma (79 tables), **UUID** | Cible **SQLite** du schéma (bi-cible + caveats) |
| Logique NestJS complète (règles, RBAC, audit, chiffrement) | **Embarquement** du backend dans Electron |
| Flux **SSE**, file de rejeu **IndexedDB** (offline léger) | **Moteur de synchro** pull/push + conflits |
| `createdAt`, cloisonnement `siteId` | **`updatedAt` partout** + **tombstones**/soft-delete |

---

## 10. Prérequis (chantier préparatoire — à faire en premier)
1. **Ajouter `updatedAt @updatedAt`** à toutes les tables synchronisées (migration).
2. **Stratégie de suppression** : soft-delete généralisé **ou** `SyncChangeLog` (tombstones).
3. **Revue bi-cible SQLite** : convertir les éventuels **tableaux scalaires** (→ `Json`/relation) ; vérifier enums/Json.
4. **Curseur de sync** : table/champ `lastSyncAt` côté poste + index sur `updatedAt`.

---

## 11. Feuille de route (incrémentale, chaque phase livrable & testable)

- **Phase 0 — Prérequis** : `updatedAt` partout, tombstones/soft-delete, schéma bi-cible.
- **Phase 1 — Base locale** : backend NestJS embarqué + **SQLite local** → l'app fonctionne **100 % hors-ligne** (lecture/écriture), **sans** sync encore.
- **Phase 2 — Synchro** : moteur **pull/push** + détection de conflit (version) + résolution « dernière écriture gagne » + tombstones + scope par site.
- **Phase 3 — Durcissement** : résolution fine (par champ / signalement médical), gros volumes & perf, reprise après échec, chiffrement base locale (option), tableau de bord de synchro.

---

## 12. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Synchro bidirectionnelle = l'un des problèmes les plus durs | Incrémental (phases), UUID + `updatedAt`, conflits optimistes (pas de verrou) |
| Conflits sur données médicales | « Dernière écriture gagne » **+ audit** ; **signalement** pour les champs sensibles |
| Divergence de schéma poste/serveur | Migrations Prisma versionnées appliquées au démarrage |
| Packaging Node+NestJS dans Electron (taille, démarrage) | Backend local minimal, lancement en arrière-plan |
| Limitations SQLite (arrays, enums) | Revue bi-cible en Phase 0 |
| Volume de données / perf sync | Sync **delta** (depuis `lastSyncAt`) + scope **par site** + pagination |

---

## 13. Estimation d'effort (ordre de grandeur, honnête)
C'est le **plus gros chantier** du projet — **plusieurs semaines**, par phases. 
**Pour la soutenance :** présenter la **version centralisée actuelle** (fonctionnelle,
démontrable) **et ce plan** comme la **feuille de route offline-first** — c'est une preuve de
vision d'architecture, sans risquer une fonctionnalité de synchro à moitié finie le jour J.

---

## 14. Décisions à trancher
1. **Périmètre de la 1ʳᵉ livraison offline** : tous les modules, ou d'abord les **critiques** (patients, triage, consultation) ?
2. **Suppressions** : soft-delete généralisé **ou** journal de changements (tombstones) ?
3. **Résolution de conflit par domaine** : où « dernière écriture gagne » suffit-il, où faut-il un **signalement** ?
4. **Chiffrement de la base locale** (SQLCipher) : oui/non selon la sécurité physique des postes ?
5. **Fréquence de synchro** : à la reconnexion seulement, ou aussi périodique (ex. toutes les N minutes) ?
