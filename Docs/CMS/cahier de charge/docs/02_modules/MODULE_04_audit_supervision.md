# MODULE 04 — Audit & Supervision système

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » : le système est développé et déployé (voir [[_SOURCE_systeme]]). Tous les faits renvoient au code réel sous `CMS/APP/CMS-SARIS/`. Les chiffres ne sont pas redéfinis ici : ils sont référencés par identifiant `PM-xx` ([[parametres_metier]]) et les choix structurants par `D-xxx` ([[registre_decisions]]). Termes alignés sur le [[glossaire]] et le [[plan_modules]].

---

## 1. Mission et périmètre

### 1.1 Mission

Le module **Audit & Supervision** réunit les capacités transverses de **traçabilité** et de **pilotage opérationnel** du système :

1. **Journal d'audit métier** — journaliser de façon persistante et automatique chaque mutation sensible (création/modification/suppression) des contrôleurs annotés, avec acteur, action, module, entité, IP réelle et statut (cf. **Audit**, [[glossaire]]).
2. **Journal d'authentification** — historiser les événements de connexion (login, logout, TOTP, changements de mot de passe, échecs) avec IP, géolocalisation dérivée et navigateur.
3. **Supervision de la synchronisation** — exposer aux administrateurs l'état des **postes locaux** (en ligne / hors-ligne, dernière synchro), l'**activité récente** (journaux de cycles) et les **conflits** détectés par la résolution LWW (cf. **Synchronisation**, [[glossaire]] ; D-016).
4. **Sauvegardes & restauration de la configuration** — déclencher, planifier (cron quotidien) et restaurer de façon **non destructive** un instantané de la **configuration** (référentiels, matrice rôles→permissions, paramètres système).
5. **Volumétrie** — fournir des compteurs de référence par module (utilisateurs, patients, visites, consultations, journaux…) pour le suivi d'échelle.

Le code correspondant est porté par :
- `apps/api/src/modules/admin/audit.controller.ts` + `audit.service.ts` (lecture des journaux) ;
- `apps/api/src/common/interceptors/audit.interceptor.ts` (écriture transverse, contrat **C-11**) ;
- `apps/api/src/modules/admin/synchronisation.controller.ts` + `synchronisation.service.ts` (sauvegardes/restauration/volumétrie/ré-encryption) ;
- `apps/api/src/modules/sync/sync.controller.ts` + `sync-supervision.service.ts` (supervision des postes/cycles/conflits côté serveur central) ;
- Frontend : `apps/web/src/modules/admin/pages/AuditPage.tsx` et `SynchronisationPage.tsx`.

### 1.2 Hors-périmètre (explicite)

- **Écriture des journaux par une route dédiée** : interdit. Le journal d'audit n'est écrit que par l'`AuditInterceptor` global (ou par les écritures explicites avant/après des services d'administration). Règle R-SEC-018 documentée dans `audit.interceptor.ts`.
- **Audit de la messagerie** : volontairement **non journalisée** (volume + sémantique), cf. D-014. Le module messagerie [[MODULE_13_messagerie]] n'est pas annoté `@Audit`.
- **Moteur de synchronisation (pull/push, LWW, tombstones)** : appartient au module `sync` documenté ailleurs ([[MODULE_16_synchronisation]], D-015, D-016). Le présent module n'en couvre que la **supervision** (lecture) et l'**audit**.
- **UI de résolution manuelle des conflits** : **absente**. Les conflits sont journalisés et affichés en lecture seule ; il n'existe pas d'écran de résolution interactive (réserve actée en D-016). La table `ResolutionConflit` existe mais aucun flux de résolution n'est exposé (à confirmer).
- **Sauvegarde des données cliniques / patients** : **jamais** incluse ni restaurée (intégrité + confidentialité). Seule la **configuration** est sauvegardée (`synchronisation.service.ts`, constante `CONFIG_TABLES`).
- **Configuration système** (mots de passe, sessions, notifications, sauvegardes) : éditée par le module **Paramètres** (support `ParametresModule`, [[plan_modules]]) ; hors de cette spec.
- **Détection automatique d'anomalies** : la table `AlerteAnomalie` existe en base mais aucun flux applicatif ne l'alimente ni ne l'expose (dormant — à confirmer).

---

## 2. Acteurs et rôles

Rôles du système (3 d'habilitation : ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER — cf. [[glossaire]], PM-46, D-003. « MEDECIN » n'est pas un rôle mais une profession du personnel mappée au rôle MEDECIN_CHEF) :

| Rôle | Audit (`audit.read`) | Supervision/Sauvegardes (`synchronisation.read/execute/restore`) |
|------|----------------------|------------------------------------------------------------------|
| **ADMIN_SYSTEME** | Oui (catalogue complet, D-004) | Oui (lecture + exécution + restauration) |
| **MEDECIN_CHEF** | **Oui** (`audit.read` présent au catalogue, `permissions.ts` l. 373) | **Non** (aucune permission `synchronisation.*`) |
| **INFIRMIER** | Non | Non |

> Vérifié dans `packages/types/src/permissions.ts` : `MEDECIN_CHEF` possède `audit.read` mais **pas** les permissions de synchronisation ; seul `ADMIN_SYSTEME` détient `synchronisation.read/execute/restore`. La granularité exacte des permissions (`audit.read`, `synchronisation.read`, `synchronisation.execute`, `synchronisation.restore`) est définie en l. 146–155 / 306–315.

- **Système (acteur non humain)** : l'audit peut journaliser une entrée sans utilisateur (`utilisateurId = null`) — sauvegarde automatique, action interne ; affiché « Système » côté UI.
- Aucun rôle « catégorie de patient » n'intervient dans ce module (transverse, non clinique).

---

## 3. Exigences fonctionnelles (EF-04-xx)

**Journal d'audit métier**
- **EF-04-01** — Toute mutation HTTP (POST / PUT / PATCH / DELETE) sur un contrôleur/route annoté `@Audit('module','Entité')` DOIT produire une entrée `JournalAudit` (action dérivée de la méthode : POST→CREATE, PUT/PATCH→UPDATE, DELETE→DELETE).
- **EF-04-02** — L'entrée d'audit DOIT enregistrer : utilisateur (ou null), action, module, type d'entité, identifiant d'entité (paramètre de route `:id` si présent), IP réelle, et statut **SUCCES** ou **ERREUR** selon l'issue de la requête.
- **EF-04-03** — Les requêtes **GET** (et toute méthode non mutante) NE DOIVENT PAS être auditées.
- **EF-04-04** — L'échec d'écriture du journal NE DOIT JAMAIS faire échouer la requête métier (journalisation best-effort, l'erreur est seulement loggée).
- **EF-04-05** — Les services d'administration qui s'auto-auditent avec un diff avant/après (`avantJson`/`apresJson`) NE DOIVENT PAS être doublement annotés (anti-double comptage, D-014).
- **EF-04-06** — Le module DOIT exposer la **lecture filtrée** du journal d'audit : par module, action, utilisateur, type d'entité, identifiant d'entité, et plage de dates (`dateMin`/`dateMax`).
- **EF-04-07** — La réponse de lecture DOIT renvoyer à la fois le **lot** d'entrées (trié par date décroissante, plafonné) et le **total réel** d'entrées correspondant aux filtres (pour des compteurs UI justes).
- **EF-04-08** — Les bornes de date « jour seul » (`AAAA-MM-JJ`) DOIVENT être inclusives : `dateMax` couvre jusqu'à 23:59:59.999 du jour.

**Journal d'authentification**
- **EF-04-09** — Le module DOIT exposer la lecture filtrée du journal d'authentification : par utilisateur, résultat (ex. `SUCCES_LOGIN`, `ECHEC_MOT_DE_PASSE`, `ECHEC_CODE_TOTP`…) et plage de dates.
- **EF-04-10** — Chaque entrée d'authentification lue DOIT être enrichie d'une **localisation** dérivée de l'IP (ville + coordonnées, cache PM-44) et le navigateur DOIT être lisible (parsing user-agent côté UI).
- **EF-04-11** — Le détail d'une action auditée DOIT être consultable (résumé en français, diff lisible des champs modifiés, vue technique JSON), en masquant le bruit technique (`id`, `createdAt`, `passwordHash`, etc.).

**Supervision de la synchronisation**
- **EF-04-12** — Le serveur central DOIT enregistrer chaque cycle de synchro reçu d'un poste : mise à jour du poste (dernière synchro), création d'un `JournalSynchronisation`, des `ConflitSynchronisation` détaillés, et de l'état `SyncState`.
- **EF-04-13** — Le module DOIT exposer un écran de supervision **scopé par site** présentant : la liste des **postes** (en ligne/hors-ligne + dernière synchro), l'**activité récente** (30 derniers journaux), les **conflits en attente** (50 derniers).
- **EF-04-14** — Un poste DOIT être considéré « en ligne » s'il s'est synchronisé dans la fenêtre récente (3 minutes, `ONLINE_WINDOW_MS` dans `sync-supervision.service.ts`).
- **EF-04-15** — Tout cycle enregistré DOIT déclencher un rafraîchissement **temps réel** (SSE) de l'écran de supervision, restreint aux porteurs de `synchronisation.read`.
- **EF-04-16** — L'enregistrement de supervision NE DOIT PAS s'exécuter sur un poste local SQLite (no-op si `DATABASE_PROVIDER = sqlite`), la supervision étant une fonction du **serveur central** uniquement.

**Sauvegardes & restauration de configuration**
- **EF-04-17** — Le module DOIT permettre de **déclencher manuellement** une sauvegarde de la configuration (référentiels listés, matrice rôles→permissions par code, paramètres système).
- **EF-04-18** — Une sauvegarde automatique DOIT s'exécuter **quotidiennement** (cron, voir RM-04-06) avec **rétention** des 30 plus récentes.
- **EF-04-19** — Le module DOIT permettre de **restaurer** une sauvegarde de façon **non destructive** (upsert des référentiels/paramètres par `id` ; réécriture de la matrice rôles→permissions par `code`), sans supprimer les lignes créées depuis.
- **EF-04-20** — Une sauvegarde sans contenu restaurable (entrée historique sans `contenuJson`, ou contenu corrompu) DOIT être refusée à la restauration avec un message explicite (`400`).
- **EF-04-21** — Le module DOIT exposer la liste des sauvegardes (métadonnées seules : type, statut, taille, dates, déclencheur) **sans** renvoyer le contenu JSON volumineux, et indiquer si chaque sauvegarde est **restaurable**.

**Volumétrie**
- **EF-04-22** — Le module DOIT exposer des compteurs de volumétrie par module (utilisateurs, sites, personnel, patients, visites, consultations, ordonnances, bons d'examen, évacuations) ainsi que le total des journaux d'audit et d'authentification.

**Synchronisation des données (mode local)**
- **EF-04-23** — En mode local (desktop), le module DOIT exposer l'état du client de synchro (activé, en ligne, dernier pull/push) et permettre de **forcer** un cycle (`POST /sync/run`, perm `synchronisation.execute`).
- **EF-04-24** — Sur le client web, le module DOIT exposer l'état de la **file de rejeu offline** (IndexedDB) et permettre de la synchroniser, rejouer les mutations rejetées et purger les rejetées (zone « Synchronisation terrain »).

**Ré-encryption messagerie (maintenance post-rotation de clé)**
- **EF-04-25** — Le module DOIT exposer une opération de **ré-encryption** des messages et pièces jointes vers la clé courante (idempotente, non destructive, perm `synchronisation.execute`), pour permettre le retrait d'une ancienne clé après rotation (cf. [[MODULE_13_messagerie]] ; D-012).

---

## 4. Cas d'utilisation (CU-04-xx)

### CU-04-01 — Consulter le journal d'audit métier
- **Acteur** : ADMIN_SYSTEME, MEDECIN_CHEF (`audit.read`).
- **Déclencheur** : ouverture de la page Audit, onglet « Actions métier ».
- **Scénario nominal** : l'acteur applique des filtres (utilisateur, module, période) → le backend renvoie le lot trié par date décroissante + le total réel → l'UI pagine, affiche les libellés humanisés et un compteur d'onglet juste.
- **Scénarios d'erreur** : sans `audit.read` → `403`. Période incohérente → bornes recadrées côté UI (heure max ≥ heure min le même jour).
- **Hors-ligne** : non applicable (lecture serveur central ; en mode local le backend embarqué peut répondre selon les données présentes — à confirmer).
- **Critères** : *Étant donné* un utilisateur avec `audit.read` *quand* il filtre par module = « patient » *alors* seules les entrées d'audit du module patient sont renvoyées, avec un total cohérent.

### CU-04-02 — Inspecter le détail d'une action auditée
- **Acteur** : porteur de `audit.read`.
- **Déclencheur** : clic sur une ligne d'audit.
- **Scénario nominal** : ouverture d'un panneau latéral à 3 onglets (Résumé / Changements / Technique) ; le diff avant/après est affiché champ par champ, les permissions sont regroupées Module→Sous-section→actions, le bruit technique est masqué.
- **Scénarios d'erreur** : absence de `avantJson`/`apresJson` → onglets « Changements » et « Technique » désactivés, message « pas de données de comparaison ».
- **Critères** : *Étant donné* une entrée `UPDATE` avec diff *quand* l'acteur l'ouvre *alors* les champs modifiés sont listés en français lisible (valeur avant → valeur après).

### CU-04-03 — Consulter le journal d'authentification
- **Acteur** : porteur de `audit.read`.
- **Déclencheur** : onglet « Authentifications ».
- **Scénario nominal** : filtres (utilisateur, résultat, période) → chaque ligne montre login, résultat coloré (succès/avertissement/échec), IP, localisation (ville) et navigateur lisible.
- **Scénarios d'erreur** : sans `audit.read` → `403`. IP non géolocalisable → localisation masquée (« inconnue »).
- **Hors-ligne** : non applicable.
- **Critères** : *Étant donné* un échec de mot de passe enregistré *quand* l'acteur filtre sur `ECHEC_MOT_DE_PASSE` *alors* la ligne apparaît en tonalité « erreur » avec l'IP et la localisation.

### CU-04-04 — Journalisation automatique d'une mutation (transverse)
- **Acteur** : tout utilisateur effectuant une mutation sur un contrôleur annoté `@Audit`.
- **Déclencheur** : POST/PUT/PATCH/DELETE réussi ou en échec.
- **Scénario nominal** : l'`AuditInterceptor` écrit une entrée `JournalAudit` (statut SUCCES) après succès.
- **Scénarios d'erreur** : la requête métier lève une exception → entrée écrite avec statut **ERREUR**, puis l'exception est propagée intacte. Échec d'écriture du journal → seulement loggé, requête non impactée.
- **Hors-ligne** : sur backend embarqué (mode local), l'écriture vise la base SQLite locale ; la propagation au central suit la synchro (à confirmer selon l'allow-list soft-delete/sync).
- **Critères** : *Étant donné* une suppression refusée (409) *quand* elle est traitée *alors* une entrée d'audit de statut ERREUR est créée et l'erreur 409 est renvoyée à l'appelant.

### CU-04-05 — Superviser les postes et conflits de synchronisation
- **Acteur** : ADMIN_SYSTEME (`synchronisation.read`).
- **Déclencheur** : onglet « Supervision » de la page Synchronisation.
- **Scénario nominal** : affichage des postes du **site** (en ligne/hors-ligne, dernière synchro), de l'activité récente (cycles avec nb mutations / conflits) et des conflits en attente ; rafraîchissement temps réel à chaque nouveau cycle.
- **Scénarios d'erreur** : aucun poste → état vide explicite. Sans `synchronisation.read` → `403`. Session sans `siteId` → `401`.
- **Hors-ligne** : la supervision est une fonction du serveur central ; un poste local SQLite n'enregistre pas (EF-04-16).
- **Critères** : *Étant donné* un poste synchronisé il y a moins de 3 minutes *quand* l'écran charge *alors* le poste est marqué « en ligne ».

### CU-04-06 — Déclencher une sauvegarde de configuration
- **Acteur** : ADMIN_SYSTEME (`synchronisation.execute`).
- **Déclencheur** : bouton « Lancer une sauvegarde ».
- **Scénario nominal** : création d'une entrée EN_COURS → construction du snapshot (référentiels + rôles/permissions + paramètres) → passage REUSSIE avec taille + contenu → application de la rétention (30) → audit + rafraîchissement live.
- **Scénarios d'erreur** : échec de construction → entrée ECHEC + audit ECHEC + `409` avec message.
- **Hors-ligne** : non applicable (configuration du serveur central).
- **Critères** : *Étant donné* la matrice rôles→permissions courante *quand* la sauvegarde réussit *alors* le snapshot contient les codes de permission par rôle et la sauvegarde est marquée restaurable.

### CU-04-07 — Restaurer une sauvegarde de configuration
- **Acteur** : ADMIN_SYSTEME (`synchronisation.restore`).
- **Déclencheur** : action « Restaurer » sur une sauvegarde restaurable, confirmée par modale.
- **Scénario nominal** : dans une transaction, upsert des référentiels/paramètres par `id`, puis réinitialisation de la matrice rôles→permissions par `code` ; audit RESTORE ; rafraîchissement live (sync + référentiels).
- **Scénarios d'erreur** : sauvegarde introuvable → `404` ; contenu absent ou corrompu → `400` (EF-04-20). Restauration **non destructive** : les lignes créées depuis le snapshot ne sont pas supprimées.
- **Hors-ligne** : non applicable.
- **Critères** : *Étant donné* un rôle dont les permissions ont été modifiées après la sauvegarde *quand* la restauration s'exécute *alors* ses permissions reviennent à l'état du snapshot, et les nouveaux référentiels ajoutés depuis subsistent.

### CU-04-08 — Consulter la volumétrie du système
- **Acteur** : ADMIN_SYSTEME (`synchronisation.read`).
- **Déclencheur** : onglet « Volumétrie ».
- **Scénario nominal** : affichage des compteurs par module + totaux des journaux d'audit et d'authentification, avec total agrégé.
- **Critères** : *Étant donné* N consultations en base *quand* l'écran charge *alors* la pastille « consultations » affiche N.

### CU-04-09 — Synchroniser la file terrain (offline-first, web)
- **Acteur** : ADMIN_SYSTEME (zone terrain ; déclenchement local).
- **Déclencheur** : bouton « Synchroniser » de la zone Terrain.
- **Scénario nominal** : la file de rejeu IndexedDB est poussée ; les mutations passent PENDING→SENT→APPLIED ; le badge en ligne/hors-ligne reflète l'état réseau réel (ping /health, D-018 ; PM-20/22/23).
- **Scénarios d'erreur** : mutation rejetée → statut REJECTED, possibilité de rejouer ou purger les rejetées.
- **Hors-ligne** : c'est le cœur du cas — les écritures effectuées hors-ligne sont mises en file et rejouées à la reconnexion (cf. [[strategie_offline_sync]]).
- **Critères** : *Étant donné* deux écritures faites hors-ligne *quand* la connexion revient et que l'acteur synchronise *alors* les deux mutations passent à APPLIED.

### CU-04-10 — Ré-encrypter la messagerie après rotation de clé
- **Acteur** : ADMIN_SYSTEME (`synchronisation.execute`).
- **Déclencheur** : action « Ré-encrypter la messagerie » (maintenance).
- **Scénario nominal** : parcours par lots des messages et pièces jointes, déchiffrement avec une clé du trousseau et réécriture vers la clé courante (idempotent) ; audit REENCRYPT ; renvoi du nombre d'éléments mis à jour.
- **Scénarios d'erreur** : ligne illisible (clé absente) → laissée intacte et comptée à part (non destructif).
- **Critères** : *Étant donné* des messages chiffrés avec une ancienne clé *quand* l'opération s'exécute *alors* ils sont réécrits vers la clé courante sans perte.

---

## 5. Données du module

Renvoi au modèle global : [[modele_donnees_global]]. Entités propres / mobilisées par le module (vérifiées dans `packages/db/prisma/schema.prisma`) :

| Entité | Rôle dans le module | Champs notables |
|--------|---------------------|-----------------|
| **JournalAudit** | Trace des mutations métier | `utilisateurId?`, `action`, `module`, `entiteType?`, `entiteId?`, `avantJson?`, `apresJson?`, `ipAdresse?`, `statut`, `createdAt` |
| **JournalAuthentification** | Trace des connexions | `utilisateurId?`, `login`, `resultat`, `ipAdresse?`, `userAgent?`, `createdAt` (localisation calculée à la lecture) |
| **SauvegardeSysteme** | Sauvegardes de configuration | `type`, `statut`, `declenchePar?`, `perimetre?`, `contenuJson?`, `taille?`, `finishedAt?`, `message?` |
| **PosteLocal** | Poste desktop suivi | `siteId`, `libelle`, `derniereSyncAt?` |
| **JournalSynchronisation** | Cycle de synchro reçu | `posteLocalId`, `startedAt`, `finishedAt?`, `statut`, `nbMutations`, `nbConflits` |
| **ConflitSynchronisation** | Conflit LWW détaillé | `journalId`, `entiteType`, `entiteId`, `typeConflit`, `valeurLocale`, `valeurServeur`, `statut` (EN_ATTENTE par défaut) |
| **SyncState** | Curseur de synchro par poste×site | `posteLocalId`, `siteId`, `lastPulledAt`, `lastPushedAt?` (unique poste+site) |
| **FileMutation** | File de rejeu (offline) | `mutationUuid` (unique), `posteLocalId`, `module`, `entiteType`, `entiteId`, `action`, `payloadJson` |

> Entités **dormantes** liées (non exploitées par un flux applicatif au moment de la rédaction, **à confirmer**) : `AlerteAnomalie`, `ResolutionConflit`.

La volumétrie (EF-04-22) agrège en lecture d'autres entités du domaine clinique/accès (Utilisateur, Patient, Visite, Consultation, Ordonnance, BonExamen, Evacuation, Site, PersonnelMedical) — détaillées dans leurs modules respectifs.

---

## 6. Règles métier (RM-04-xx)

- **RM-04-01** — Le journal d'audit n'est écrit **que** par l'`AuditInterceptor` global ou par les écritures explicites des services d'administration ; **jamais** par une route d'écriture exposée (règle R-SEC-018, `audit.interceptor.ts`).
- **RM-04-02** — L'action auditée est dérivée de la méthode HTTP : POST→CREATE, PUT/PATCH→UPDATE, DELETE→DELETE ; toute autre méthode (dont GET) n'est pas auditée.
- **RM-04-03** — La journalisation est **best-effort** : un échec d'écriture du journal ne remonte jamais en erreur métier.
- **RM-04-04** — La messagerie n'est **pas** auditée (D-014).
- **RM-04-05** — Les lectures de journaux sont plafonnées : `limit` borné à **[1 … 500]**, défaut 100 (`audit.service.ts`) ; le `total` renvoyé reste le décompte réel non plafonné.
- **RM-04-06** — La sauvegarde automatique s'exécute **quotidiennement** selon le cron du service (`AUTO_BACKUP_CRON = EVERY_DAY_AT_2AM`, exposé à l'UI comme « tous les jours à 02h00 »). *Note de cohérence : ce module utilise un cron à 02h00 ; la purge des tombstones du module `sync` est à 03h00 (PM-36). Valeur du backup à confirmer comme PM dédié dans [[parametres_metier]] (non encore référencée).*
- **RM-04-07** — La **rétention** des sauvegardes conserve les **30** plus récentes (`RETENTION_MAX`, `synchronisation.service.ts`) ; au-delà, les plus anciennes sont supprimées.
- **RM-04-08** — Une sauvegarde ne couvre **que** la configuration (référentiels listés `CONFIG_TABLES`, matrice rôles→permissions, paramètres) ; les données cliniques/patients sont **exclues** par principe.
- **RM-04-09** — La restauration est **non destructive** : upsert par `id` des référentiels/paramètres et réécriture de la matrice rôles par `code`, dans une transaction (timeout 30 s) ; aucune suppression de lignes hors snapshot.
- **RM-04-10** — Une sauvegarde n'est **restaurable** que si `statut = REUSSIE` et `taille > 0` (sinon : refus `400` / marquée non restaurable côté UI).
- **RM-04-11** — Un **poste** est « en ligne » s'il s'est synchronisé dans les **3 dernières minutes** (`ONLINE_WINDOW_MS`, `sync-supervision.service.ts`).
- **RM-04-12** — La supervision de synchro est **scopée par site** : le `siteId` est résolu depuis le **JWT** (jamais depuis la requête) ; aucun poste/conflit d'un autre site n'est exposé (anti-IDOR, cohérent avec [[MODULE_01_securite_authentification]]).
- **RM-04-13** — L'enregistrement de supervision est **inactif** sur un poste local SQLite (no-op si `DATABASE_PROVIDER = sqlite`) : seul le serveur central enregistre postes/journaux/conflits.
- **RM-04-14** — Le journal d'authentification est **enrichi à la lecture** d'une localisation géo dérivée de l'IP, avec cache (TTL **1 h**, PM-44) ; aucune coordonnée n'est stockée dans la table.
- **RM-04-15** — Les bornes de date « jour seul » sont **inclusives** (jusqu'à 23:59:59.999 pour `dateMax`).
- **RM-04-16** — La ré-encryption messagerie est **idempotente et non destructive** : une ligne n'est réécrite que si elle a pu être déchiffrée et qu'elle n'est pas déjà à la clé courante (cf. D-012 ; clé courante format `v2:keyId`, PM-45).

---

## 7. Interfaces (exposé / consommé)

Renvoi aux contrats globaux : [[plan_modules]] §6.

### 7.1 Endpoints exposés

**Audit** (`/admin/audit`, gardes JWT + permissions) :
- `GET /admin/audit/actions` — `audit.read` — lecture filtrée du journal d'audit (module, action, utilisateur, entité, dates, limit).
- `GET /admin/audit/authentifications` — `audit.read` — lecture filtrée du journal d'authentification (utilisateur, résultat, dates, limit).

**Synchronisation / sauvegardes** (`/synchronisation`) :
- `GET /synchronisation/status` — `synchronisation.read` — volumétrie + journaux + dernière sauvegarde + planification.
- `GET /synchronisation/sauvegardes` — `synchronisation.read` — historique (métadonnées).
- `POST /synchronisation/sauvegardes/manuelle` — `synchronisation.execute` — déclenche une sauvegarde.
- `POST /synchronisation/sauvegardes/:id/restaurer` — `synchronisation.restore` — restauration non destructive.
- `POST /synchronisation/messagerie/rechiffrer` — `synchronisation.execute` — ré-encryption vers la clé courante.

**Supervision de synchro** (`/sync`, scope site via JWT) :
- `GET /sync/supervision` — `synchronisation.read` — postes, activité, conflits du site.
- `GET /sync/status` — `synchronisation.read` — état serveur + client.
- `POST /sync/run` — `synchronisation.execute` — force un cycle (mode local).

### 7.2 Interfaces consommées

- **C-9 / [[MODULE_01_securite_authentification]]** — gardes `JwtAuthGuard` + `PermissionsGuard` (et résolution du `siteId` depuis le JWT) appliquées à tous les endpoints du module.
- **C-11 (Audit transverse)** — l'`AuditInterceptor` global (`APP_INTERCEPTOR`) lit la métadonnée `@Audit` posée sur les contrôleurs cliniques et de configuration et écrit `JournalAudit`.
- **C-8 (Temps réel)** — `NotificationService.broadcastLive(...)` consommé pour rafraîchir la supervision (`SYNC_ACTIVITY`, restreint à `synchronisation.read`) et l'écran de sauvegardes (`LIVE_SYNC`, `LIVE_REFERENTIELS`).
- **C-10 (Configuration)** — `ParametresService` (via `AdminModule`) fournit les paramètres système inclus dans le snapshot de sauvegarde.
- **C-12 (Synchronisation)** — le service `SyncSupervisionService.record(...)` est appelé par le moteur `sync` (push) pour tracer chaque cycle ; lecture par `getSupervision`.
- **Crypto messagerie** — `currentKeyId()` / `reencryptToCurrent()` (`common/crypto/message-crypto`) pour la ré-encryption (cf. [[MODULE_13_messagerie]]).
- **Géo** — `resolveGeo(ip)` (`common/geo/geo.util`) pour l'enrichissement des authentifications (PM-44).

---

## 8. Exigences non fonctionnelles spécifiques

- **Non-intrusivité de l'audit** : l'interception ne doit jamais altérer ni ralentir significativement la requête métier (écriture asynchrone best-effort, RM-04-03).
- **Confidentialité des journaux** : lecture réservée à `audit.read` ; le diff masque les champs sensibles (`passwordHash`, etc., EF-04-11).
- **Cloisonnement par site** de la supervision (RM-04-12) — pas de fuite cross-site.
- **Intégrité de la restauration** : transactionnelle, non destructive, bornée (timeout 30 s) — pas d'état partiel (RM-04-09).
- **Robustesse offline** : la supervision et les sauvegardes sont des fonctions du **serveur central** ; un poste local ne tente pas de les exécuter (RM-04-13), évitant des écritures incohérentes hors-ligne.
- **Temps réel** : l'écran de supervision se met à jour par SSE sans rechargement (C-8), restreint aux administrateurs.
- **i18n** : libellés FR/EN stricts ; humanisation des codes techniques (action, module, statut, entité) côté UI (`@/config/labels`), aucun code brut affiché.

---

## 9. Risques et points ouverts

- **Permissions de supervision** : seul `ADMIN_SYSTEME` détient `synchronisation.read/execute/restore` ; `MEDECIN_CHEF` a `audit.read` mais **pas** la supervision de synchro. À confirmer si la supervision doit être étendue à `MEDECIN_CHEF` (cf. D-004, réduction d'ADMIN_SYSTEME prévue).
- **Cron de sauvegarde non paramétré dans [[parametres_metier]]** : la valeur « 02h00 quotidien » (RM-04-06) et la rétention « 30 » (RM-04-07) sont codées et non encore référencées par un `PM-xx`. À régulariser (créer les PM dédiés et y renvoyer).
- **Pas d'UI de résolution de conflits** : les conflits sont affichés en lecture seule (D-016) ; la table `ResolutionConflit` est dormante. Décision de produit à confirmer si une résolution interactive est attendue.
- **`AlerteAnomalie` dormante** : modèle présent sans flux d'alimentation/affichage — à confirmer (supprimer, ou implémenter une détection d'anomalies).
- **Comportement de l'audit en mode local (SQLite)** : l'écriture vise la base locale ; la propagation au central dépend de l'allow-list soft-delete/sync — **à confirmer** (les journaux sont-ils synchronisés ou locaux ?).
- **Localisation à la lecture seulement** : la géo n'est pas figée à l'instant de l'authentification (recalculée via cache PM-44) ; un changement de base GeoIP modifierait l'affichage rétrospectivement.
- **Sauvegarde = configuration uniquement** : aucune sauvegarde des données cliniques n'est assurée par ce module ; la continuité des données repose sur PostgreSQL (Neon) et la synchro multi-poste (D-001, D-002). À documenter comme limite assumée.

---

*Sources de vérité : [[_SOURCE_systeme]], [[registre_decisions]], [[parametres_metier]], [[plan_modules]], [[glossaire]]. Faits techniques vérifiés dans `apps/api/src/modules/admin/{audit,synchronisation}.{controller,service}.ts`, `apps/api/src/common/interceptors/audit.interceptor.ts`, `apps/api/src/modules/sync/{sync.controller,sync-supervision.service}.ts`, `apps/web/src/modules/admin/pages/{AuditPage,SynchronisationPage}.tsx`, `packages/db/prisma/schema.prisma`, `packages/types/src/permissions.ts`.*
