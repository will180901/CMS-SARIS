# Module 14 — Notifications & Annonces

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » : le module est **développé et déployé**. Les faits décrits ci-dessous sont
> recoupés sur le code réel sous `apps/api/src/modules/notification` (backend) et
> `apps/web/src/components/layout/NotificationDrawer.tsx` (frontend). Termes alignés sur le
> [[glossaire]], décisions sur le [[registre_decisions]], chiffres sur [[parametres_metier]], modules et
> contrats sur [[plan_modules]]. Vérité de référence : [[_SOURCE_systeme]].

---

## 1. Mission et périmètre

### 1.1 Mission

Le module **Notifications & Annonces** (`NotificationModule`, répertoire `apps/api/src/modules/notification`)
assure deux fonctions complémentaires :

1. **Cloche & feed personnel** — diffuser à chaque utilisateur, en **temps réel** (SSE) et en **historique**
   persistant, les notifications qui le concernent (événements cliniques, administratifs, sorties critiques),
   avec gestion de l'état « lu » et de la suppression « pour moi ».
2. **Annonces** — permettre à un administrateur de **diffuser une annonce** à tout un site ou à l'ensemble des
   sites, y compris les **annonces de mise à jour** portant un lien d'installation de l'application desktop
   (cf. [[registre_decisions]] D-017).

Le module est en outre le **socle technique du temps réel** de l'application : il porte le flux SSE unique
(`/notifications/stream`), la **présence en ligne** (`PresenceService`) et l'**interceptor de rafraîchissement
live** (`LiveRefreshInterceptor`) consommés par la messagerie, les accusés de réception et le rafraîchissement
silencieux des listes. À ce titre il est importé par la plupart des modules métier (cf. [[plan_modules]] §4,
contrat **C-8**).

### 1.2 Périmètre couvert (as-built)

- **Émission** de notifications individuelles ou diffusées par les modules métier via `NotificationService.emit()`
  (collaboration par service exporté, contrat [[plan_modules]] C-8).
- **Catégorisation** et **filtrage par réglage** : `clinique`, `sortie`, `administratif`, `systeme` — chaque
  catégorie consulte une bascule de [[parametres_metier]] (PM-38 à PM-41) avant émission.
- **Feed REST** par utilisateur : liste, compteur de non-lus, marquage lu / tout lu.
- **Suppression « pour moi »** (masquage personnel) : unitaire, en lot, ou tout supprimer.
- **Suppression définitive** d'une notification (réservée à l'administrateur système).
- **Annonces** diffusées (portée SITE ou TOUS) et **annonces de mise à jour** (lien + version, bouton
  d'installation desktop / téléchargement web).
- **Flux SSE** authentifié par jeton en query, filtré par audience (site + permission), avec connexion/déconnexion
  de **présence**.
- **Présence en ligne** (en mémoire) + persistance `Utilisateur.lastSeenAt`, et notion « regarde la conversation »
  (TTL court, PM-19) au service de la messagerie.
- **Événements temps réel non persistés** : `broadcastLive` (rafraîchissement de listes), `pushLive`
  (accusés/co-participants), `pushSessionRevoked` (session unique, cf. [[registre_decisions]] D-021).
- **Purge planifiée** des notifications anciennes selon la rétention configurée (PM-37), sur le serveur central
  uniquement.

### 1.3 Hors périmètre (explicite)

- **Notifications push externes** (e-mail, SMS, push navigateur/OS) : non implémentées ; tout reste **in-app**
  (cloche + SSE). *À confirmer si une cible push est envisagée ultérieurement.*
- **Messagerie interne** (conversations, messages, médias chiffrés) : module **distinct** `messagerie`
  (voir [[MODULE_13_messagerie]]). Le présent module ne porte que le **transport temps réel** et les **notifications**
  associées (nouveau message / réaction), pas le contenu des conversations.
- **Journal d'audit** : couche transverse distincte (`@Audit` + `AuditInterceptor`, [[registre_decisions]] D-014) ;
  la messagerie et les notifications ne sont pas auditées (cf. D-014).
- **Réglages de notification** (bascules `notif.*`) : **lus** par ce module mais **édités** par le module
  `parametres` / écran Paramètres (voir [[parametres_metier]] §6).
- **Auto-update silencieux** du desktop (electron-updater) : mécanisme complémentaire au bridge, hors de ce module
  (cf. [[registre_decisions]] D-017).
- **UI de résolution de conflits de synchronisation** : hors périmètre (cf. [[registre_decisions]] D-016).

---

## 2. Acteurs et rôles

Rôles de référence : [[glossaire]] « Rôle », groupe **SUPERVISION** = { ADMIN_SYSTEME, MEDECIN_CHEF }.
Permissions vérifiées dans `packages/types/src/permissions.ts`.

| Acteur | Permissions notification | Capacités dans le module |
|--------|--------------------------|--------------------------|
| **ADMIN_SYSTEME** | `notification.read`, `notification.update`, `notification.create`, `notification.delete` | Tout : recevoir, lire, supprimer « pour moi », **émettre des annonces** (SITE / TOUS), **publier une annonce de mise à jour**, **supprimer définitivement** une notification. |
| **MEDECIN_CHEF** | `notification.read`, `notification.update` *(`create`/`delete` réservés à ADMIN_SYSTEME — cf. commentaire `permissions.ts` l.410)* | Recevoir, lire / tout lire, supprimer « pour moi ». *Émission d'annonce et suppression définitive : à confirmer selon l'attribution réelle du rôle (le code réserve `create`/`delete` à l'admin système).* |
| **MEDECIN** | `notification.read`, `notification.update` | Recevoir, lire / tout lire, supprimer « pour moi ». |
| **INFIRMIER** | `notification.read`, `notification.update` | Recevoir, lire / tout lire, supprimer « pour moi ». |

> Le bouton « Nouvelle annonce » du panneau n'apparaît que si l'utilisateur détient `notification.create`
> (`NotificationDrawer.tsx`, `canAnnonce = has('notification.create')`).

**Visibilité par audience** (qui reçoit quoi) — `NotificationService.visibleFor` / `whereFor` :
- Notification **ciblée** (`destinataireId` renseigné) : visible **uniquement** par sa cible.
- Notification **diffusée** (`destinataireId` null) : visible si le **site** correspond (ou diffusion globale
  `siteId = null`) **et** si l'utilisateur détient la **permission requise** (`requiredPermission`, le cas échéant).
- L'**auteur** d'une action ne reçoit **pas** la notification de sa propre action (anti-bruit).

> La **catégorie de patient** n'intervient pas dans ce module (elle pilote les droits aux bons, non les
> notifications — cf. [[registre_decisions]] D-009).

---

## 3. Exigences fonctionnelles

> IDs `EF-14-xx`. Chaque exigence est atomique et vérifiable. Source : code cité au §1.

| ID | Exigence |
|----|----------|
| **EF-14-01** | Le système expose un **flux SSE** unique `GET /notifications/stream` poussant en temps réel les notifications visibles par l'utilisateur connecté. |
| **EF-14-02** | Le flux SSE s'authentifie par **jeton JWT passé en query** (`?token=`), `EventSource` ne pouvant porter d'en-tête `Authorization` ; un jeton absent ou invalide est rejeté (`401`). |
| **EF-14-03** | Le système fournit le **feed** des notifications de l'utilisateur (`GET /notifications`), trié par date décroissante, borné (défaut 40, max 100), avec l'état **lu** par notification. |
| **EF-14-04** | Le système fournit le **compteur de non-lus** (`GET /notifications/unread-count`) calculé sur les notifications visibles (cap 100). |
| **EF-14-05** | L'utilisateur peut **marquer une notification lue** (`PATCH /notifications/:id/read`) et **tout marquer lu** (`POST /notifications/read-all`). |
| **EF-14-06** | L'utilisateur peut **supprimer « pour moi »** une notification (`POST /notifications/:id/dismiss`), **en lot** (`POST /notifications/dismiss-many`, ≤ 200) ou **tout** (`POST /notifications/dismiss-all`) ; la notification disparaît de **son** feed sans affecter les autres destinataires. |
| **EF-14-07** | Un administrateur (`notification.create`) peut **émettre une annonce diffusée** (`POST /notifications/annonce`) de portée **SITE** (son site) ou **TOUS** (tous les sites). |
| **EF-14-08** | Une annonce comportant un **lien de téléchargement** (`lienTelechargement`) devient une **annonce de mise à jour** : type d'entité `MISE_A_JOUR`, niveau par défaut **AVERTISSEMENT**, version associée éventuelle. |
| **EF-14-09** | Le feed affiche pour une annonce de mise à jour un **bouton d'installation** : sur **desktop** il télécharge et lance l'installeur (bridge), sur **web** il ouvre le lien de téléchargement dans un nouvel onglet. |
| **EF-14-10** | Un administrateur (`notification.delete`) peut **supprimer définitivement** une notification (`DELETE /notifications/:id`), ses lectures étant supprimées au préalable. |
| **EF-14-11** | Le système n'émet une notification d'une **catégorie** donnée (`clinique`, `sortie`, `administratif`) que si la **bascule** de réglage correspondante est active ([[parametres_metier]] PM-38 à PM-41) ; la catégorie `systeme` est toujours émise. |
| **EF-14-12** | L'émission d'une notification est **best-effort** : une erreur d'émission **ne fait jamais échouer** l'action métier déclenchante (le service journalise et renvoie `null`). |
| **EF-14-13** | Le système expose `NotificationService` aux autres modules pour émettre des notifications (`emit`) et diffuser des événements temps réel **non persistés** (`broadcastLive`, `pushLive`). |
| **EF-14-14** | Le système tient la **présence en ligne** d'un utilisateur tant qu'au moins une connexion SSE est ouverte, persiste `lastSeenAt` à la connexion/déconnexion, et prévient les co-participants de ses conversations à la connexion (accusés « remis »). |
| **EF-14-15** | À l'ouverture d'une connexion SSE, le système déclenche un événement `MESSAGE_STATUS` vers les co-participants des conversations de l'utilisateur (mise à jour des accusés). |
| **EF-14-16** | Le système diffuse un événement `SESSION_REVOKED` ciblé aux connexions SSE d'un utilisateur dont une session a été révoquée (session unique, [[registre_decisions]] D-021) ; seul l'ancien poste se déconnecte (comparaison de `sid`). |
| **EF-14-17** | Le système **purge** quotidiennement les notifications dont l'âge dépasse la **rétention configurée** ([[parametres_metier]] PM-37), **uniquement sur le serveur central** (les postes locaux SQLite ne purgent pas). |
| **EF-14-18** | Le feed peut être **marqué lu pour une entité** (ex. une conversation) afin de vider la cloche des notifications « nouveau message / réaction » dès l'ouverture de la conversation concernée (`markReadForEntite`). |
| **EF-14-19** | Le panneau de notifications (`NotificationDrawer`) affiche chaque notification avec son **niveau** (icône/teinte : INFO, SUCCES, AVERTISSEMENT, CRITIQUE), un **horodatage relatif** localisé, et un **indicateur visuel** des non-lus. |
| **EF-14-20** | Un clic sur une notification la **marque lue** et, si elle porte un **lien interne** (route `/…`), **navigue** vers ce lien ; les liens HTTP de mise à jour ne déclenchent pas la navigation (gérés par leur bouton dédié). |
| **EF-14-21** | Le bouton de **rafraîchissement live silencieux** (`LiveRefreshInterceptor`) diffuse, après toute mutation réussie d'un contrôleur annoté `@LiveRefresh`, un événement `LIVE_*` (sans cloche ni son) éventuellement **cloisonné par site**. |

---

## 4. Cas d'utilisation

> IDs `CU-14-xx`. Critères au format « Étant donné / Quand / Alors ».

### CU-14-01 — Recevoir une notification en temps réel

- **Acteur** : tout utilisateur authentifié (`notification.read`).
- **Déclencheur** : un module métier appelle `NotificationService.emit()` (ex. nouvelle visite, consultation,
  sortie critique).
- **Scénario nominal** : l'utilisateur a une connexion SSE ouverte → la notification visible par son audience
  arrive sur le flux ; le compteur de cloche s'incrémente, le feed se met à jour.
- **Scénarios d'erreur** : émission en échec → action métier non impactée, aucune notification (EF-14-12) ;
  catégorie désactivée dans les réglages → notification non émise (EF-14-11).
- **Hors-ligne** : sur **poste local** (desktop offline), la notification est produite par le **backend embarqué**
  et présentée localement ; la propagation cross-poste se fait à la **synchronisation** (cf. [[MODULE_16_synchronisation]]).
- **Critères** :
  - *Étant donné* un utilisateur du site A connecté en SSE,
  - *Quand* une notification diffusée de site A le concernant est émise,
  - *Alors* elle apparaît dans son flux et son feed sans rechargement, et n'est pas reçue par un utilisateur d'un
    autre site (sauf diffusion globale).

### CU-14-02 — Consulter et marquer ses notifications lues

- **Acteur** : tout utilisateur (`notification.read`, `notification.update`).
- **Déclencheur** : ouverture du panneau de notifications.
- **Scénario nominal** : le feed se charge (≤ 40), l'utilisateur clique une notification (→ marquée lue, navigation
  si lien interne) ou clique « Tout marquer lu » (→ toutes ses non-lues passent lues).
- **Scénarios d'erreur** : notification introuvable au marquage → `404` ; perte de réseau → feed indisponible
  (réessai).
- **Critères** :
  - *Étant donné* une notification non lue dans le feed,
  - *Quand* l'utilisateur la clique,
  - *Alors* son état passe « lu », le compteur de non-lus décroît, et si elle porte un lien `/…` l'application
    navigue vers la cible.

### CU-14-03 — Supprimer des notifications « pour moi »

- **Acteur** : tout utilisateur (`notification.read`).
- **Déclencheur** : corbeille au survol, multi-sélection, ou « Tout supprimer ».
- **Scénario nominal** : la (les) notification(s) sont **masquées** du feed de cet utilisateur (`NotificationLecture.masque = true`),
  sans suppression réelle ni effet pour les autres destinataires.
- **Scénarios d'erreur** : ids inconnus dans un lot → **ignorés silencieusement** (pas d'échec du lot) ;
  lot tronqué au-delà de 200.
- **Critères** :
  - *Étant donné* une notification visible par deux utilisateurs,
  - *Quand* l'un la supprime « pour moi »,
  - *Alors* elle disparaît de son feed à lui seul et reste visible pour l'autre.

### CU-14-04 — Émettre une annonce diffusée

- **Acteur** : ADMIN_SYSTEME (`notification.create`).
- **Déclencheur** : bouton « Nouvelle annonce » → formulaire (titre ≤ 120, message ≤ 1000, niveau, portée
  SITE/TOUS).
- **Scénario nominal** : l'annonce est créée comme notification de type `ANNONCE`, `destinataireId = null`,
  `siteId` = site de l'admin (SITE) ou `null` (TOUS) ; elle est poussée en SSE à tous les destinataires éligibles,
  **l'auteur excepté**.
- **Scénarios d'erreur** : titre/message manquants → validation refusée (DTO) ; utilisateur sans
  `notification.create` → `403`.
- **Critères** :
  - *Étant donné* un admin du site A,
  - *Quand* il émet une annonce de portée SITE,
  - *Alors* tous les utilisateurs du site A (sauf lui) la reçoivent, et aucun utilisateur du site B.

### CU-14-05 — Publier une annonce de mise à jour de l'application

- **Acteur** : ADMIN_SYSTEME (`notification.create`).
- **Déclencheur** : dans le formulaire d'annonce, case « Annonce de mise à jour » cochée → champs lien
  d'installeur (`.exe`) + version ; pré-réglage portée **TOUS** + niveau **AVERTISSEMENT**.
- **Scénario nominal** : la notification est marquée `entiteType = MISE_A_JOUR`, `lien =` URL de l'installeur,
  `entiteId =` version ; le feed affiche un bouton d'installation. Sur desktop, le bouton télécharge l'installeur
  via le **bridge** puis lance l'installation après fermeture de l'application ; sur web, il ouvre l'URL.
- **Scénarios d'erreur** : lien vide alors que la case est cochée → soumission désactivée ; échec de
  téléchargement desktop → message d'erreur (toast).
- **Hors-ligne** : l'**installation** suppose la disponibilité de l'URL de téléchargement (réseau) ; l'**annonce**
  elle-même reste consultable hors-ligne sur le poste local une fois reçue.
- **Critères** :
  - *Étant donné* une annonce de mise à jour publiée pour TOUS,
  - *Quand* un poste desktop la reçoit et l'utilisateur clique « Télécharger et installer »,
  - *Alors* l'installeur est téléchargé puis lancé après fermeture de l'application (cf. [[registre_decisions]] D-017).

### CU-14-06 — Présence en ligne et accusés de réception

- **Acteur** : tout utilisateur (au service de la messagerie).
- **Déclencheur** : ouverture / fermeture de la connexion SSE.
- **Scénario nominal** : à l'ouverture, l'utilisateur est marqué **en ligne** (compteur de connexions),
  `lastSeenAt` est mis à jour, et un événement `MESSAGE_STATUS` est poussé à ses co-participants ; à la fermeture
  du dernier flux, il repasse hors-ligne et `lastSeenAt` est ré-horodaté.
- **Scénarios d'erreur** : déconnexion réseau brutale → décrément de présence au `finalize` du flux ; reconnexions
  multiples → comptage par connexions (en ligne tant que ≥ 1).
- **Critères** :
  - *Étant donné* un utilisateur avec une seule connexion SSE,
  - *Quand* cette connexion se ferme,
  - *Alors* il est considéré hors-ligne et `lastSeenAt` reflète l'instant de déconnexion.

### CU-14-07 — Déconnexion immédiate sur session unique

- **Acteur** : système (déclenché par un nouveau login du même utilisateur).
- **Déclencheur** : `NotificationService.pushSessionRevoked(userId, sids)` appelé par le module sécurité lors d'une
  révocation de session (cf. [[registre_decisions]] D-021).
- **Scénario nominal** : un événement `SESSION_REVOKED` (niveau CRITIQUE) est poussé aux connexions SSE de
  l'utilisateur ; chaque poste compare **son** `sid` à la liste des sids révoqués → l'ancien poste se déconnecte,
  le nouveau (absent de la liste) reste connecté.
- **Scénarios d'erreur** : liste de sids vide → aucun événement émis.
- **Critères** :
  - *Étant donné* deux postes connectés au même compte,
  - *Quand* un troisième login révoque les sessions,
  - *Alors* les postes révoqués reçoivent `SESSION_REVOKED` et se déconnectent, l'auteur du nouveau login restant
    actif.

### CU-14-08 — Purge des notifications anciennes

- **Acteur** : système (tâche planifiée).
- **Déclencheur** : cron quotidien (serveur central uniquement).
- **Scénario nominal** : les notifications dont `createdAt` est antérieur au seuil dérivé de la rétention
  ([[parametres_metier]] PM-37) sont supprimées (lectures en cascade) ; le nombre supprimé est journalisé.
- **Scénarios d'erreur** : rétention non définie / < 1 → aucune purge ; exécution sur base **SQLite** (poste local)
  → la tâche se retire (no-op).
- **Critères** :
  - *Étant donné* une rétention de N jours sur le central,
  - *Quand* la tâche s'exécute,
  - *Alors* les notifications de plus de N jours sont supprimées et aucune purge n'a lieu sur les postes locaux.

---

## 5. Données du module

> Modèle global : [[modele_donnees_global]]. Entités propres au module (schéma `packages/db/prisma/schema.prisma`,
> à recouper) :

| Entité | Rôle dans le module |
|--------|---------------------|
| **Notification** | Enregistrement persistant d'une notification : `type`, `niveau`, `titre`, `message`, `destinataireId` (null = diffusion), `siteId` (null = global), `requiredPermission`, `entiteType`, `entiteId`, `lien`, `createdById`, `createdAt`. Réutilisée pour les **annonces** et les **mises à jour** (`entiteType = MISE_A_JOUR`, `lien` = URL installeur, `entiteId` = version) — sans table dédiée (cf. [[registre_decisions]] D-017). |
| **NotificationLecture** | État par utilisateur d'une notification : `notificationId`, `utilisateurId`, et masque `masque` (« supprimé pour moi »). Clé unique `(notificationId, utilisateurId)`. Porte à la fois le **lu** (présence d'une ligne) et le **masquage** personnel. |
| **Utilisateur.lastSeenAt** | Dernière présence persistée (mise à jour à la connexion/déconnexion SSE), au service des accusés et du statut « vu à ». |

**États en mémoire (non persistés)** — `PresenceService` :
- **présence** : compteur de connexions SSE ouvertes par utilisateur (en ligne si ≥ 1) ;
- **« regarde la conversation »** : carte `userId → { convId, at }` à **TTL court** ([[parametres_metier]] PM-19),
  pour ne pas faire sonner la cloche d'un message d'une conversation déjà à l'écran.

**Événements temps réel non persistés** (poussés sur le flux, jamais écrits en base) : `LIVE_*` (refresh listes),
`MESSAGE_STATUS` (accusés), `SESSION_REVOKED` (session unique).

> Type d'événement conservé en lecture seule pour l'audit historique : `PRIORITE_CHANGE` (la priorité a été retirée,
> cf. [[registre_decisions]] D-008) — sans impact fonctionnel sur ce module.

---

## 6. Règles métier

> IDs `RM-14-xx`. Toute valeur chiffrée renvoie à [[parametres_metier]] (`PM-xx`), jamais en dur.

| ID | Règle |
|----|-------|
| **RM-14-01** | Une notification **ciblée** (`destinataireId` non nul) n'est visible que par sa cible ; une notification **diffusée** n'est visible que par les utilisateurs du **site** concerné (ou global) **détenant** la `requiredPermission` éventuelle. |
| **RM-14-02** | L'**auteur** d'une action (`createdById`) ne reçoit jamais la notification de **sa propre** action (filtré en lecture et en flux). |
| **RM-14-03** | Une notification de catégorie `clinique` / `sortie` / `administratif` n'est émise que si la **bascule globale** `notif.app_enabled` **et** la bascule de catégorie correspondante sont actives ([[parametres_metier]] PM-38 à PM-41) ; `systeme` est toujours émise. En cas de paramètre absent/illisible, l'émission est **autorisée** par défaut. |
| **RM-14-04** | L'émission est **best-effort** : toute erreur est journalisée et **n'interrompt pas** le flux métier appelant (`emit` renvoie `null`). |
| **RM-14-05** | L'état **lu** est **par utilisateur** (ligne `NotificationLecture`), compatible avec les diffusions (une même notification peut être lue par les uns et non par les autres). |
| **RM-14-06** | La **suppression « pour moi »** masque la notification du feed de l'utilisateur (`masque = true`) **sans** la supprimer ni l'affecter pour autrui ; un lot ignore silencieusement les ids inexistants et est **borné à 200**. |
| **RM-14-07** | La **suppression définitive** (`DELETE`) requiert `notification.delete` (ADMIN_SYSTEME) ; les `NotificationLecture` associées sont supprimées d'abord. |
| **RM-14-08** | L'**émission d'annonce** requiert `notification.create` ; la portée **TOUS** met `siteId = null` (visible de tous les sites), **SITE** met `siteId =` site de l'auteur. |
| **RM-14-09** | Une annonce devient **mise à jour** dès qu'un `lienTelechargement` est fourni : `entiteType = MISE_A_JOUR`, niveau par défaut **AVERTISSEMENT**, version reportée dans `entiteId` (cf. [[registre_decisions]] D-017). |
| **RM-14-10** | Le **feed** est trié par date décroissante et **borné** (défaut 40, plafond 100) ; le **compteur de non-lus** est calculé sur un maximum de 100 notifications. |
| **RM-14-11** | Un utilisateur est **en ligne** tant qu'au moins une connexion SSE est ouverte ; `lastSeenAt` est ré-horodaté à chaque connexion et déconnexion. |
| **RM-14-12** | La détection « regarde la conversation » expire après le **TTL** [[parametres_metier]] PM-19 ; au-delà, la cloche peut sonner pour un nouveau message de cette conversation. |
| **RM-14-13** | La **purge** ne s'exécute que sur le **serveur central** (jamais sur un poste local SQLite) et ne supprime que les notifications d'âge supérieur à la **rétention** [[parametres_metier]] PM-37 (aucune purge si rétention < 1 jour). |
| **RM-14-14** | Le flux **SSE** s'authentifie par **jeton en query** et n'est ouvert que pour un jeton valide portant `sub` + `siteId` ; il ne pousse que les notifications passant le filtre d'audience (RM-14-01/02). |
| **RM-14-15** | Un événement `LIVE_*` marqué « siteScoped » n'est diffusé qu'aux clients du **même site** que l'auteur de la mutation (évite une tempête de rafraîchissement cross-site). |

---

## 7. Interfaces

> Contrats : [[plan_modules]] §6. Le module **expose** `NotificationService` et `PresenceService`
> (`exports` du `NotificationModule`) et **importe** `SecurityModule` (auth SSE) + `ParametresModule` (réglages).

### 7.1 Interfaces exposées (ce que le module fournit)

| Cible | Interface | Nature |
|-------|-----------|--------|
| Tous les utilisateurs (clients web/desktop) | REST `/notifications` (feed, unread-count, read, read-all, dismiss*, annonce, delete) + SSE `/notifications/stream` | API HTTP/SSE. |
| Modules métier émetteurs ([[plan_modules]] C-8) | `NotificationService.emit()` (notification persistée + catégorie/réglage), `broadcastLive()` / `pushLive()` (temps réel non persisté) | Service NestJS exporté. Émetteurs réels (vérifiés) : `consultation`, `triage`, `patient` (catégorie `clinique`), `sorties-critiques` (`sortie`), `admin` utilisateurs/rôles (`administratif`). |
| Module `messagerie` ([[MODULE_13_messagerie]]) | `PresenceService` (en ligne / vu, « regarde la conversation ») + `pushLive('MESSAGE_STATUS')` | Service exporté + événements SSE. |
| Module `security` ([[MODULE_01_securite_authentification]]) | `pushSessionRevoked()` (session unique, [[registre_decisions]] D-021) | Service exporté + événement SSE. |
| Contrôleurs annotés `@LiveRefresh` | `LiveRefreshInterceptor` (global, no-op sinon) | Interceptor `APP_INTERCEPTOR` diffusant `broadcastLive` après mutation réussie. |

### 7.2 Interfaces consommées (ce dont le module dépend)

| Source | Interface | Usage |
|--------|-----------|-------|
| `SecurityModule` ([[plan_modules]] C-9) | `JwtService` (vérif. jeton SSE) + gardes `JwtAuthGuard` / `PermissionsGuard` | Authentification du flux et des routes REST. |
| `ParametresModule` ([[plan_modules]] C-10) | `ParametresService.getBool/getNumber` | Bascules de catégorie (PM-38–41) et rétention (PM-37). |
| `PrismaService` | Accès `Notification`, `NotificationLecture`, `Utilisateur`, `ConversationParticipant` | Persistance et lectures. |
| Bridge desktop (`apps/desktop`) | `desktopBridge().installFromUrl()` | Téléchargement + lancement de l'installeur d'une annonce de mise à jour (frontend). |

### 7.3 Contrat principal

- **C-8 — Notification temps réel** ([[plan_modules]]) : les modules `patient`, `triage`, `consultation`,
  `sorties-critiques`, `messagerie`, `sync`, `admin` **importent** `NotificationModule` et émettent
  notifications / invalidations live (SSE). Le présent module en est le **récepteur/diffuseur**.

---

## 8. Exigences non fonctionnelles spécifiques

- **Temps réel** : transport unique **SSE** (un seul flux par poste), partagé par notifications, présence,
  accusés et rafraîchissement de listes (évite la multiplication des connexions). Auth par jeton en query
  (contrainte `EventSource`).
- **Robustesse** : l'émission de notification ne doit **jamais** rompre le flux métier (best-effort, RM-14-04).
- **Confidentialité** : filtrage d'audience strict (site + permission + non-auto-notification) en **lecture** et
  en **flux** (RM-14-01/02), aligné sur le cloisonnement par site du [[glossaire]] « Site ».
- **Offline-first** : le module fonctionne sur le **backend embarqué** du poste local (notifications produites et
  consultées hors-ligne) ; la **purge** est réservée au central (RM-14-13). La cohérence cross-poste passe par la
  **synchronisation** (cf. [[MODULE_16_synchronisation]], [[registre_decisions]] D-015/D-016).
- **Rétention** : purge planifiée quotidienne, paramétrable ([[parametres_metier]] PM-37), exécutée côté central.
- **i18n** : libellés du panneau **bilingues FR/EN** (react-i18next) ; le **contenu** des notifications est dans la
  langue produite par le module émetteur (à confirmer pour une internationalisation systématique des messages).
- **Design SARIS** : panneau latéral 460px, tokens CSS (niveaux INFO/SUCCES/AVERTISSEMENT/CRITIQUE), sons UI
  discrets, conforme au design system (cf. [[_SOURCE_systeme]]).

---

## 9. Risques et points ouverts

- **Attribution `create`/`delete`** : le code réserve `notification.create` et `notification.delete` à
  **ADMIN_SYSTEME** (`permissions.ts` l.410). La capacité d'annonce d'un **MEDECIN_CHEF** est donc **à confirmer**
  selon l'attribution effective de ces permissions au rôle (cf. divergence rôles [[registre_decisions]] D-003).
- **Jeton SSE en query** : nécessité fonctionnelle (`EventSource`), mais le jeton transite en URL — atténué par
  HTTPS ; veiller à ne pas le journaliser côté serveur/proxy (à confirmer dans la configuration de logs).
- **Présence en mémoire** : `PresenceService` est **non persistant et mono-instance** ; en cas de scale-out
  multi-instances du central, la présence devrait être centralisée (Redis ou équivalent). Aujourd'hui mono-instance
  (Render), donc sans impact ; **à surveiller** au passage à l'échelle.
- **Internationalisation des messages** : les `titre`/`message` sont produits par les émetteurs ; leur traduction
  systématique FR/EN n'est pas garantie au niveau du module (à confirmer).
- **Push externe absent** : aucune notification hors application (e-mail/SMS/push OS) ; si un soignant n'a pas
  l'application ouverte, il ne voit la notification qu'à sa prochaine session — acceptable pour le périmètre actuel,
  **à réévaluer** si une alerte « hors application » devient nécessaire.
- **Distinction modèle de données** : les noms exacts et la cardinalité des entités `Notification` /
  `NotificationLecture` sont à recouper finement avec `schema.prisma` au moment de la consolidation de
  [[modele_donnees_global]] (la présente spec liste les champs vus dans le service).

---

*Sources : `apps/api/src/modules/notification/{notification.controller,notification.service,presence.service,notification-purge.cron,notification.module}.ts`, `dto/annonce.dto.ts`, `apps/api/src/common/interceptors/live-refresh.interceptor.ts`, `apps/web/src/components/layout/NotificationDrawer.tsx`, `packages/types/src/permissions.ts`. Alignement : [[_SOURCE_systeme]], [[glossaire]], [[plan_modules]], [[parametres_metier]], [[registre_decisions]].*
