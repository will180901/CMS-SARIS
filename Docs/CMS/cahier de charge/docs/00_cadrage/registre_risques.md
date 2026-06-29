# Registre des risques — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document du cahier des charges **as-built** : il recense les risques pesant sur le système
> **tel qu'il est construit et déployé** (central cloud sur Render/Neon + clients desktop
> offline-first), et les **mitigations DÉJÀ en place** dans le code. Quand une mitigation
> n'est que partielle ou prévue, c'est explicitement indiqué (« à confirmer » / « partiel »).
> Source de vérité : [[_SOURCE_systeme]]. Voir aussi [[plan_modules]],
> [[exigences_non_fonctionnelles]], [[MODULE_16_synchronisation]], [[MODULE_04_audit_supervision]].

---

## 1. Objet et portée

Ce registre couvre les risques **techniques, de données, de sécurité et d'exploitation**
spécifiques à l'architecture **offline-first multi-poste** de CMS SARIS et à son contexte de
**soutenance** (hébergement cloud en plans gratuits, données de santé réelles façon démo). Il
ne couvre pas les risques projet/planning ni les risques juridiques détaillés (réglementation
santé), qui relèvent d'autres documents.

Chaque risque porte un identifiant **R-xx**. Les mitigations renvoient, quand c'est pertinent,
aux décisions **D-xxx**, exigences **EF-NN-xx** et règles **RM-NN-xx** des autres documents.

**Échelle utilisée** — Probabilité : Faible / Moyenne / Élevée. Impact : Faible / Moyen /
Élevé / Critique.

---

## 2. Registre des risques

| ID | Risque | Probabilité | Impact | Mitigation (as-built) | Propriétaire |
|----|--------|-------------|--------|------------------------|--------------|
| **R-01** | **Connectivité internet instable / coupée** sur les postes du centre médical (réseau SARIS limité, démo cloud). | Élevée | Élevé | **Offline-first** : chaque poste desktop (Electron) embarque un **backend NestJS + base SQLite** et reste pleinement opérationnel hors-ligne ; reprise de la **synchronisation** automatique à la reconnexion (sondeur de joignabilité, déclenchement immédiat à la transition hors-ligne→en ligne). Le web public dispose d'un **offline léger** (service worker + file de rejeu IndexedDB). | Équipe technique |
| **R-02** | **Perte ou corruption de données** (panne poste, fichier SQLite endommagé, suppression accidentelle). | Moyenne | Critique | **Source de vérité centrale** (PostgreSQL Neon) répliquée sur chaque poste via la sync. **Soft-delete global** (`deletedAt`, tombstones) → aucune suppression physique immédiate, résurrection possible. **Sauvegarde de configuration** réelle (snapshot JSON) avec **cron quotidien** + rétention 30 dernières et **restauration non destructive**. **LWW** (last-write-wins sur `updatedAt`/`baseUpdatedAt`) protège contre l'écrasement concurrent. | Équipe technique |
| **R-03** | **Conflits de synchronisation** : deux postes modifient la même donnée hors-ligne. | Moyenne | Moyen | Résolution **LWW** déterministe (`resolveConflict` : horodatage + détection de vrai conflit via `baseUpdatedAt`, gestion des tombstones), push **idempotent**. **Journal des conflits** persistant (`ConflitSynchronisation`, valeurLocale/valeurServeur) exposé dans l'écran de **supervision** synchro (côté admin). Périmètre de réplication clarifié (dossier patient **global** tous sites, opérationnel **par site**) pour éviter les doublons de patient muté. | Équipe technique |
| **R-04** | **Fuite / accès non autorisé aux données de santé** (PII patients, données cliniques). | Moyenne | Critique | **RBAC** par rôle (3 rôles d'habilitation — ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER ; la profession « Médecin » est mappée au rôle MEDECIN_CHEF — 110 permissions, guard `@RequirePermissions`) ; **JWT** (access + refresh) avec **session unique** par utilisateur et **révocation immédiate** (vérif `sid` en base à chaque requête) ; **2FA TOTP** (secret chiffré AES-256-GCM at-rest) ; **chiffrement at-rest** de la messagerie (AES-256-GCM) et de la file de rejeu IndexedDB ; **verrou de confidentialité médecin-chef** sur un dossier ; **rideau de confidentialité** (flou) sur les zones cliniques ; **journal d'audit persistant** (`@Audit` + interceptor, IP réelle + géo) ; CORS strict ; rate-limit login (10/min/IP). | ADMIN_SYSTEME / Équipe technique |
| **R-05** | **Perte / divergence de la clé de chiffrement** (TOTP_ENC_KEY, MESSAGE_ENC_KEY) → 2FA et messages synchronisés **indéchiffrables**. | Faible | Critique | **Règle as-built** : les clés de chiffrement embarquées dans le desktop **DOIVENT matcher celles du central** et **ne jamais changer après enrôlement** (sinon perte de lisibilité des 2FA/messages déjà chiffrés). Secrets de prod stockés **hors dépôt** (Render env, `sync:false`). **Versioning/rotation** prévu (format `v2:keyId`, `MESSAGE_ENC_KEYS` + CURRENT, legacy v1 lisible) et outil de ré-encryption non destructif — la rotation reste une **opération maîtrisée**, pas un changement de clé subi. ⚠️ Clés actuellement **bakées dans l'asar** du desktop (extractibles) : à remplacer par les clés du déploiement réel ; clés **Vault-ready** (`MESSAGE_ENC_KEYS_FILE`). | ADMIN_SYSTEME |
| **R-06** | **Adoption faible par des utilisateurs peu à l'aise avec l'informatique** (personnel soignant). | Élevée | Élevé | **UI simple** (design system SARIS, parcours guidés triage→consultation→dossier) ; **codes techniques masqués** dans les vues cliniques (libellés humanisés, codes réservés aux référentiels) ; **bilingue FR/EN** ; **installeur grand public** (assistant NSIS, **sans droits admin/UAC**, URL serveur bakée → **zéro config** au 1er lancement) ; diffusion des mises à jour par **annonce admin + bouton « Télécharger et installer »** ; navigation rapide (fil d'Ariane), mémoire d'état par page, responsive mobile. | Équipe produit |
| **R-07** | **Dépendance à l'hébergeur** (URL centrale figée, changement d'hébergeur, déplacement du serveur). | Moyenne | Moyen | **URL centrale hybride et re-configurable** : URL **bakée** au build par défaut + **formulaire de saisie de secours** au 1er lancement (`server-config.html`) si l'URL bakée est absente, le central injoignable, ou en cas de changement d'hébergeur ; **re-modifiable à tout moment**. Résolution en cascade (`config.ts`) : env > `config.json` > defaults bakés > écran de saisie. | ADMIN_SYSTEME |
| **R-08** | **Mise en veille du plan gratuit** (Render/Neon free) → 1re requête lente (~50 s), faux « hors-ligne » au réveil. | Élevée | Moyen | **Badge en ligne/hors ligne** durci : ping de `/health` (vraie joignabilité, pas `navigator.onLine`), timeout 8 s + **anti-clignotement** (2 échecs consécutifs avant de basculer « Hors ligne ») → plus de faux « hors-ligne » au réveil. L'offline-first absorbe la latence côté desktop (le local répond pendant le réveil du central). **Atténuation prévue** : passer Render/Neon en plan `starter` pour un central permanent (D à prendre au déploiement réel). | ADMIN_SYSTEME |
| **R-09** | **Token expiré pendant le rejeu hors-ligne** → mutations en file perdues ou rejetées à tort. | Faible | Moyen | **Refresh proactif** du token avant expiration au moment du rejeu + **retry unique sur 401** (branche 401 prioritaire sur le 4xx générique) → une session expirée laisse la mutation **en attente** (jamais purgée à tort). | Équipe technique |
| **R-10** | **Token de session non révoqué hors-ligne** : un login fait hors-ligne échoue à la reconnexion (session inconnue du central). | Faible | Faible | Cas **rare** et documenté (login en ligne = cas nominal). Le backend embarqué **saute la vérif de session** (online-first : un token du central est accepté en local) ; hors-ligne le jeton **expire naturellement** (≤ `JWT_EXPIRES_IN`). Sessions de **synchro desktop** exemptées de la révocation « session unique » pour ne pas casser la sync. Piste : vérifier le token au switch avant bascule (à confirmer). | Équipe technique |
| **R-11** | **Installeur non signé** → SmartScreen / antivirus bloquent (« éditeur inconnu »), frein à l'installation. | Élevée | Moyen | Connu et **assumé en contexte soutenance** (contournement « Informations complémentaires → Exécuter quand même »). Installeur NSIS sur-mesure (per-user, désinstallation propre, refus si app lancée). **Mitigation réelle = certificat OV/EV** (bloquant **externe**, non automatisable) à acquérir avant diffusion large. | ADMIN_SYSTEME |
| **R-12** | **Incompatibilité backend embarqué (SQLite) vs central (PostgreSQL)** → fonctions cassées uniquement côté desktop. | Faible | Moyen | Schéma Prisma **double-cible** (PG + SQLite généré), helpers provider-aware (`CI` pour `mode:'insensitive'` PG-only, `$queryRaw` paramétrés bi-provider). Tests d'intégration exécutés **aussi sur le backend embarqué SQLite** (48/48). Règle as-built : tout nouveau `$queryRaw`/`mode:'insensitive'` doit être pensé PG+SQLite. | Équipe technique |

---

## 3. Risques résiduels et points à confirmer

- **R-05 / clés bakées** : les secrets (JWT, TOTP, messagerie) sont actuellement **embarqués dans
  l'asar** du desktop de test (build localhost). Avant toute diffusion réelle : rebuild avec les
  **clés du déploiement** et idéalement clés par fichier externe (Vault-ready). *À traiter au
  packaging de production.*
- **R-08 / plan gratuit** : décision de passer en plan payant non prise (hors périmètre soutenance).
- **R-03 / conflits** : il n'existe **pas d'UI de résolution manuelle** de conflit côté client ; le
  serveur les journalise et la supervision les affiche (LWW automatique). *Acceptable as-built ;
  à confirmer si une résolution manuelle est requise en exploitation.*
- **R-11 / signature** : bloquant **externe** (achat de certificat), hors maîtrise du code.

---

## 4. Propriétaires

- **ADMIN_SYSTEME** : risques de gouvernance, clés, hébergement, déploiement (R-05, R-07, R-08, R-11).
- **Équipe technique** : risques de plateforme, données et synchronisation (R-01, R-02, R-03, R-09,
  R-10, R-12) et co-propriétaire sécurité (R-04).
- **Équipe produit** : adoption utilisateur (R-06).

---

*Renvois : [[_SOURCE_systeme]] · [[plan_modules]] · [[exigences_non_fonctionnelles]] ·
[[MODULE_16_synchronisation]] · [[MODULE_04_audit_supervision]] · [[modele_operationnel]]*
