# Modèle opérationnel — CMS SARIS (as-built)

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document « as-built » : il décrit **qui opère** la plateforme CMS SARIS (le système est
> développé et déployé pour la soutenance) et **comment** se mènent l'exploitation courante, la
> sauvegarde, la synchronisation, les mises à jour, la gestion des incidents, le support et
> l'hébergement. Les faits techniques citent le chemin de code de référence dans le monorepo
> `CMS/APP/CMS-SARIS/`. Les chiffres canoniques (rôles, permissions, paramètres) ne sont pas
> redéfinis ici : ils sont référencés par identifiant (`PM-xx`, `D-xxx`). Source de vérité :
> [[_SOURCE_systeme]], [[registre_decisions]], [[parametres_metier]],
> [[exigences_non_fonctionnelles]], [[plan_modules]].
>
> Convention d'honnêteté : tout point non vérifié à la source au moment de la rédaction est
> marqué « à confirmer ». Les **délais cibles** sont **indicatifs** (objectifs d'exploitation,
> non contractuels) sauf lorsqu'ils renvoient à un paramètre `PM-xx` mesuré dans le code.

---

## 1. Rôles d'exploitation

L'exploitation de la plateforme repose sur le modèle de rôles réduit (voir [[registre_decisions]]
D-003, et [[parametres_metier]] PM-46 : 4 rôles au brief — divergence « 3 vs 4 » à régulariser dans
le code). Deux rôles concentrent l'exploitation : **ADMIN_SYSTEME** (exploitation technique et
gouvernance) et **MEDECIN_CHEF** (supervision clinique). `MEDECIN` et `INFIRMIER` sont des rôles
d'usage, pas d'exploitation.

### 1.1 ADMIN_SYSTEME — exploitant système

Super-administrateur disposant de l'intégralité du catalogue de permissions (D-004 ; ≈110, voir
[[parametres_metier]] PM-47). Il porte les responsabilités d'exploitation suivantes, toutes
appliquées dans le module `admin` (`apps/api/src/modules/admin`) :

- **Comptes utilisateurs** — création, modification, désactivation/suppression
  (`utilisateurs.controller.ts`, permissions `utilisateur.{read,create,update,delete}`).
  Garde-fous métier : impossible de désactiver **son propre** compte, ni le **dernier
  ADMIN_SYSTEME actif** (`utilisateurs.service.ts` `setStatut`, exceptions 409).
- **Rôles & permissions** — gestion des rôles et de la matrice rôle→permissions
  (`roles.service.ts`), plus **dérogations par utilisateur** (GRANT/REVOKE,
  `utilisateur.manage_permissions`).
- **Paramètres système** — politique de mot de passe, durée de session, notifications,
  sauvegardes : catalogue `ParametresService` (`apps/api/src/modules/parametres`), édité via
  l'écran Paramètres (voir [[parametres_metier]] PM-07 à PM-13, PM-37 à PM-41).
- **Supervision de la synchronisation** — écran admin Synchronisation (postes, file terrain,
  sauvegardes, volumétrie ; §3).
- **Audit & sécurité** — consultation du journal d'audit persistant (`JournalAudit`, D-014),
  IP réelle + géolocalisation.
- **Annonces & mises à jour** — diffusion d'annonces et d'annonces de mise à jour desktop (§4,
  D-017).

> Réserve as-built : l'accès **clinique complet** d'ADMIN_SYSTEME est **temporaire** (mise au
> point) ; une réduction « gouvernance pure » est prévue (D-004) sans pour l'instant être
> appliquée.

### 1.2 MEDECIN_CHEF — superviseur clinique

Admin médical et superviseur (voir [[_SOURCE_systeme]]). Côté exploitation clinique :

- **Supervision** — appartient, avec ADMIN_SYSTEME, à l'ensemble « supervision » qui **voit tout le
  clinique du site** (consultations et historique de triage non filtrés par initiateur, contrairement
  aux soignants ordinaires — D-007).
- **Verrou de confidentialité** — peut **verrouiller un dossier** (`patient.lock`, D-006) ;
  pour un appelant hors supervision le contenu clinique est dépouillé et une bannière
  « Verrouillé » s'affiche.
- **Délégation de prescription** — accorde/retire la délégation permettant à un INFIRMIER de
  prescrire (D-011, `DelegationPrescription`).

### 1.3 Rôles d'usage (rappel, hors exploitation)

- **MEDECIN** — clinique (ses consultations) ; **INFIRMIER** — triage + consultation/prescription
  déléguée. Ces rôles n'administrent pas la plateforme.

| Activité d'exploitation | ADMIN_SYSTEME | MEDECIN_CHEF |
|---|---|---|
| Comptes, rôles, permissions | ✓ | — |
| Paramètres système | ✓ | — |
| Audit / sécurité | ✓ | — |
| Supervision synchronisation | ✓ | — |
| Annonces & mises à jour | ✓ | — |
| Supervision clinique (voir tout le site) | ✓ | ✓ |
| Verrou de dossier (`patient.lock`) | ✓ | ✓ |
| Délégation de prescription | ✓ | ✓ |

---

## 2. Sauvegardes & restauration

Mécanisme « as-built » de sauvegarde de **configuration** (jamais les données cliniques/patients —
voir mémoire refonte synchronisation), porté par `apps/api/src/modules/admin/synchronisation.service.ts`
et exposé dans l'écran admin Synchronisation (zone « Sauvegardes de configuration »).

### 2.1 Contenu sauvegardé

Le périmètre d'une sauvegarde (`declencherSauvegarde`) est un **dump JSON de la configuration** :
sites, catégories patient, motifs, pathologies, médicaments, types d'examen + paramètres système
(upsert par id) + matrice rôles→permissions (par code). Stocké dans `SauvegardeSysteme.contenuJson`
avec sa taille. **Les données cliniques et patients ne sont jamais incluses.**

### 2.2 Planification (cron quotidien)

- **Sauvegarde automatique quotidienne** : `@Cron(EVERY_DAY_AT_2AM)` (`synchronisation.service.ts`,
  `sauvegardeAutomatique` → `declencherSauvegarde(null, 'AUTOMATIQUE')`).
- **Rétention** : les **30** sauvegardes les plus récentes sont conservées (`RETENTION_MAX = 30`,
  `appliquerRetention` supprime au-delà). Délai cible : rétention glissante ≈ 30 jours de
  sauvegardes quotidiennes (indicatif).
- ⚠️ Cohérence à régulariser : la mémoire refonte synchronisation citait « garde 30 » ;
  le code confirme bien **30**.

### 2.3 Restauration non destructive

- **Endpoint** : `POST /synchronisation/sauvegardes/:id/restaurer`
  (`synchronisation.controller.ts`, permission `synchronisation.restore`).
- **Comportement** : `restaurerSauvegarde(id)` ré-applique les valeurs du snapshot par **transaction
  d'upsert NON destructive** — elle ne supprime pas les lignes créées depuis la sauvegarde ; les rôles
  sont réinitialisés par code. Confirmation par Modal côté UI.
- Chaque sauvegarde/restauration est tracée (audit best-effort, `JournalAudit`, module
  `synchronisation`).

### 2.4 Crons connexes (rétention système)

- **Purge des tombstones** soft-delete : `@Cron(EVERY_DAY_AT_3AM)`
  (`apps/api/src/modules/sync/tombstone-purge.cron.ts`), au-delà de **90 jours**, avec garde-fou
  `deletedAt < min(SyncState.lastPulledAt)` (voir [[exigences_non_fonctionnelles]] ENF-03-04,
  [[parametres_metier]] PM-36).
- **Purge des notifications** expirées : `@Cron(EVERY_DAY_AT_4AM)`
  (`notification-purge.cron.ts`), rétention `notif.retention_jours` ([[parametres_metier]] PM-37).

> Note d'exploitation : ces crons s'exécutent **sur le central** (serveur de vérité). Sur un poste
> desktop en mode local, c'est la base SQLite répliquée qui fait foi pour le travail hors-ligne ;
> la rétention serveur s'applique au central.

---

## 3. Supervision de la synchronisation

L'écran admin Synchronisation (`apps/web/src/modules/admin/pages/SynchronisationPage.tsx`) est
l'outil d'exploitation de l'offline-first (D-001, D-016). Il s'organise en **trois zones** (voir
mémoire refonte synchronisation) :

### 3.1 Synchronisation terrain (file de rejeu offline)

- Bandeau d'**état de connectivité** (En ligne / Hors ligne via le badge réel `/health`, D-018,
  [[parametres_metier]] PM-20 à PM-22), **N mutations en attente** et **dernière synchro**.
- Bouton « Synchroniser maintenant » (cycle de rejeu).
- **File de rejeu** (mutations IndexedDB côté web) : « Réessayer les rejetées » / « Purger les
  rejetées » (`apps/web/src/lib/sync.ts` : `listMutations`, `retryRejected`, `purgeMutations`).

### 3.2 Postes en ligne & conflits

- La synchronisation repose sur **Last-Write-Wins** (`updatedAt` + `baseUpdatedAt`), curseur
  `SyncState` par poste, tombstones soft-delete (D-015, D-016 ;
  `apps/api/src/modules/sync/sync.service.ts`).
- **Réserve as-built** : il n'existe **pas d'UI client de résolution de conflits** — les conflits
  sont **journalisés côté serveur** et présentés à la supervision (D-016). La résolution
  manuelle champ-à-champ n'est pas proposée.
- Délais cibles (indicatifs, paramétrés) : sonde de joignabilité ≈ **4 s** (PM-32), synchro de
  sécurité périodique ≈ **5 min** (PM-33), backoff borné 5 → 60 s sur échec (PM-35).

### 3.3 Volumétrie

- Compteurs par module (chips) + journaux audit/auth, pour superviser la croissance des données.

---

## 4. Mises à jour applicatives

Diffusion des mises à jour de l'application **desktop** sans infrastructure lourde ni migration
(D-017). Deux mécanismes complémentaires :

### 4.1 Annonce de mise à jour (pilotée par l'admin)

- L'ADMIN_SYSTEME saisit un **lien de téléchargement** + une **version** → une notification de type
  **`MISE_A_JOUR`**, portée **TOUS**, niveau Avertissement, est diffusée (réutilise les champs
  existants de `Notification` — **aucune table/migration dédiée**, D-017).
- Côté client : bouton « **Télécharger et installer** ». Sur le **web**, le bouton ouvre l'URL.
- Sur le **desktop**, le bridge télécharge l'installeur puis le **lance après fermeture de
  l'application** (libération du mutex). L'installeur **NSIS « intelligent »** propose
  désinstaller / réinstaller-mettre à jour / annuler et **refuse de s'exécuter si l'app tourne**
  (`apps/desktop/installer/cms-saris.nsi`).

### 4.2 Auto-update (complémentaire)

- **electron-updater** assure l'auto-mise à jour desktop (voir mémoire client de bureau Electron,
  [[_SOURCE_systeme]] : Electron 33 / Node 20.18). L'annonce pilotée par l'admin (4.1) donne le
  **contrôle manuel** ; l'auto-update est conservé en complément.
- Délai cible (indicatif) : prise en compte d'une mise à jour au **prochain redémarrage** du poste
  (l'installeur exige l'app fermée).

> Réserve : la **signature de code** (certificat OV/EV) n'est pas résolue → SmartScreen « éditeur
> inconnu » au premier lancement (voir [[exigences_non_fonctionnelles]] ENF-04 note honnêteté).
> Le re-packaging réel impose l'URL Render et les clés du central.

---

## 5. Gestion des incidents

### 5.1 Perte de connexion réseau → mode local

- En cas d'indisponibilité du central, chaque poste **desktop continue en autonomie** sur sa base
  SQLite (mode dégradé local), sans interruption du travail clinique ; la synchronisation reprend
  **automatiquement** au retour du central (D-001, D-020 ; [[exigences_non_fonctionnelles]]
  ENF-03-02, ENF-01-04).
- Le **badge de connectivité réel** ping `/health` avec anti-clignotement (D-018) ; le desktop
  bascule central ⇄ local avec hystérésis ([[parametres_metier]] PM-24 à PM-26).
- Délai cible (indicatif) : retour à la synchro **immédiat** à la reconnexion (sonde ≈ 4 s,
  PM-32) ; au 1ᵉʳ remplissage d'un poste vide, « prêt » ≈ 23 s mesuré (ENF-01-04).
- **RPO = 0 mutation perdue** : toute mutation hors-ligne reste en file `PENDING` jusqu'à pousse
  acceptée (ENF-01-03).

### 5.2 Perte de clé de chiffrement

- **Réserve critique** : ne jamais changer `TOTP_ENC_KEY` après enrôlement, sinon les secrets TOTP
  deviennent **indéchiffrables** (D-013). Pour la messagerie, la clé est **versionnée**
  (`v2:keyId`) avec lecture rétro-compatible v1, ce qui permet la **rotation** sans perte de
  l'historique (D-012, [[parametres_metier]] PM-45) ; un outil de ré-encryption v1→v2 existe
  (endpoint `POST /synchronisation/messagerie/rechiffrer`, voir mémoire système robuste).
- En pratique d'exploitation : **conserver les clés du central** (TOTP/messagerie) comme secrets
  durables (environnement Render, jamais dans le dépôt — D-002). Un `migrate reset` réinitialise par
  nature les enrôlements TOTP.

### 5.3 Compte bloqué → récupération par l'admin

L'ADMIN_SYSTEME dispose d'outils de récupération (tous gardés par `utilisateur.reset_password`,
`apps/api/src/modules/admin/utilisateurs.controller.ts`) :

- **Réinitialiser le mot de passe** : `POST :id/reset-password`.
- **Débloquer / réactiver un compte** : `setStatut` (statut `ACTIF`) **réinitialise les compteurs**
  (`tentativesEchec = 0`, `blocageJusquA = null`, `blocageMinutes = 0`) — `utilisateurs.service.ts`.
  Rappel du blocage : **5 tentatives** ([[parametres_metier]] PM-07), 1ᵉʳ blocage **15 min** avec
  escalade ×4 (PM-08).
- **Retirer la 2FA** (téléphone perdu) : `POST :id/totp/reset`.
- **Régénérer les codes de secours** : `POST :id/backup-codes` (renvoyés une seule fois).
- **Forcer la déconnexion** : `POST :id/sessions/revoke` (révoque toutes les sessions actives) —
  combiné à la **révocation immédiate** (D-021, ENF-04-03) qui déconnecte par SSE
  (`SESSION_REVOKED`).
- **Garde-fous** : on ne peut désactiver ni son propre compte ni le **dernier ADMIN_SYSTEME actif**.

> Délai cible (indicatif) : récupération d'un compte (déblocage / reset mot de passe / reset 2FA)
> **immédiate** dès l'action admin ; effet sur les sessions au **prochain appel** (révocation
> immédiate).

### 5.4 Session indésirable / poste compromis

- **Session unique par utilisateur** (D-021) : un nouveau login révoque les autres sessions
  applicatives. Exemption : les sessions de **synchronisation desktop** (`posteLocalId`) ne sont pas
  révoquées, pour ne pas casser la synchro (ENF-04-02).

---

## 6. Support utilisateur & onboarding

### 6.1 Conditions d'utilisation (CGU)

- L'acceptation des **CGU** est **tracée** (masque CGU sur le compte) et **bloque l'accès** tant
  qu'elle n'est pas faite (CguGate) — D-014/sécurité, [[exigences_non_fonctionnelles]] ENF-04-12,
  voir mémoire système robuste. Modale CGU au login et dans les paramètres.

### 6.2 Création et remise des comptes

- Les comptes sont créés par l'ADMIN_SYSTEME (§1.1) avec un mot de passe conforme à la politique
  ([[parametres_metier]] PM-09 à PM-13). La 2FA TOTP est **self-service** avec récupération admin
  (D-013) ; elle n'est **pas obligatoire pour tous** (décision non prise).
- Cloisonnement : les comptes `Utilisateur` (login hors-ligne) et la messagerie restent **par site**
  (D-005) ; le dossier patient est **global** (continuité des soins).

### 6.3 Formation & aides intégrées

- **i18n bilingue FR/EN strict** (ENF-06), **rideau de confidentialité** sur poste partagé
  (ENF-05-04), **responsive** mobile (ENF-07) facilitent la prise en main.
- *Support de formation formalisé (guide utilisateur, parcours d'onboarding pas-à-pas)* :
  **à confirmer** — non identifié comme livrable dédié dans le code à la date du document. Le
  système remplace un suivi « façon Jeannette » Excel + papier ([[_SOURCE_systeme]]).

---

## 7. Hébergement

### 7.1 Topologie (Render + Neon)

- **Serveur central** = source de vérité + hub de synchro : **API NestJS sur Render**
  (`https://cms-saris-api.onrender.com`) + **PostgreSQL sur Neon** (D-002).
- **Site web public** (React/Vite PWA) servi en statique sur Render
  (`https://cms-saris-web.onrender.com`).
- Secrets de production (JWT, clés de chiffrement) saisis dans l'environnement Render — **jamais
  dans le dépôt** (D-002).

### 7.2 Veille du plan gratuit

- **Réserve d'exploitation** : le plan gratuit Render/Neon **met le service en veille** après
  inactivité → **première requête lente** (réveil). Le badge de connectivité tolère ce réveil
  (timeout sonde **8 s**, anti-clignotement 2 échecs — D-018, [[parametres_metier]] PM-21, PM-22).
- Délai cible (indicatif) : passage à un **plan payant** prévu pour un central **permanent** (non
  réalisé à la date du document) ; déploiement on-premise SARIS reporté post-soutenance (D-002).

### 7.3 Bascule d'URL (changement d'hébergeur)

- **URL du central HYBRIDE** (D-019) : **bakée au build** par défaut, **formulaire de secours**
  (`server-config.html`) si pas d'URL bakée / central injoignable / changement d'hébergeur, et
  **re-modifiable à tout moment**. Résolution : `env > config.json > defaults.json baké > écran de
  saisie` (`apps/desktop/electron/config.ts`). Il s'agit du `serverUrl` du mode `local`.
- Conséquence : changer d'hébergeur **n'impose pas de rebuild** des postes — l'exploitant saisit la
  nouvelle URL dans le formulaire de secours.

---

## 8. Synthèse des délais cibles (indicatifs)

| Domaine | Cible | Source / paramètre |
|---|---|---|
| Sauvegarde config | Quotidienne ~02 h 00 | §2.2 (`EVERY_DAY_AT_2AM`) |
| Rétention sauvegardes | 30 dernières | §2.2 (`RETENTION_MAX = 30`) |
| Purge tombstones | Quotidienne ~03 h 00, > 90 j | §2.4, PM-36 / ENF-03-04 |
| Purge notifications | Quotidienne ~04 h 00 | §2.4, PM-37 |
| Reprise synchro à la reconnexion | Immédiate (sonde ≈ 4 s) | §5.1, PM-32 |
| 1ᵉʳ remplissage poste vide | ≈ 23 s (mesuré E2E) | ENF-01-04 |
| RPO (perte de données) | 0 mutation perdue | §5.1, ENF-01-03 |
| Récupération compte (admin) | Immédiate | §5.3 |
| Révocation de session | Au prochain appel | §5.4, D-021 |
| Mise à jour desktop | Au prochain redémarrage | §4 |
| Réveil hébergement gratuit | 1ʳᵉ requête lente (tolérée 8 s) | §7.2, PM-21 |

> Tous les délais marqués « indicatifs » sont des objectifs d'exploitation, non contractuels ;
> ceux renvoyant à un `PM-xx` sont vérifiés dans le code. Aucun SLA p95 de latence n'a été mesuré
> sur le réseau SARIS réel (ENF-02). Toute valeur « à confirmer » doit être levée avant la
> version 1.0 finale.

---

## 9. Renvois

- Vérité de référence : [[_SOURCE_systeme]], [[registre_decisions]].
- Paramètres chiffrés : [[parametres_metier]] (PM-xx).
- Exigences non fonctionnelles : [[exigences_non_fonctionnelles]] (ENF-xx).
- Modules backend : [[plan_modules]].
- Mémoire projet : refonte synchronisation, vision déploiement,
  client de bureau Electron, offline-first, système robuste,
  TOTP persistance, ADMIN_SYSTEME super-admin.
