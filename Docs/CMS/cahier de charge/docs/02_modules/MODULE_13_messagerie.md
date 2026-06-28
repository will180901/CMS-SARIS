# Module 13 — Messagerie interne chiffrée

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** V1 · **Historique** : v1.0 création

> Document « as-built » : il documente le module **réellement développé** sous `apps/api/src/modules/messagerie` (backend NestJS) et `apps/web/src/modules/messagerie` (frontend React). Décision fondatrice : [[registre_decisions]] **D-012**. Termes alignés sur [[glossaire]] ; chiffres référencés via [[parametres_metier]] (PM-14 à PM-19, PM-45) ; entités via [[modele_donnees_global]] ; collaborations via [[plan_modules]] (C-8, C-9).

---

## 1. Mission et périmètre

### 1.1 Mission

Fournir aux utilisateurs du CMS une **messagerie interne sécurisée façon WhatsApp Web** : échanges directs (1↔1) et de groupe entre agents d'un **même site**, contenu et pièces jointes **chiffrés AES-256-GCM au repos** ([[parametres_metier]] PM-45), expérience temps réel (présence, accusés, saisie en cours) via le flux SSE des notifications. Le module sert la coordination interne du centre médico-social, indispensable au fonctionnement multi-poste (D-012).

Source code : `apps/api/src/modules/messagerie/{messagerie.controller.ts, messagerie.service.ts, dto/messagerie.dto.ts, messagerie.module.ts}` ; frontend `apps/web/src/modules/messagerie/`.

### 1.2 Dans le périmètre (vérifié dans le code)

- Conversations **DIRECT** (1↔1, auto-retrouvées) et **GROUPE** (titre + participants).
- Envoi de messages **texte et/ou pièces jointes** (images, vidéos, audio, PDF/Office/texte).
- **Réponses / citations** (`replyToId`), **réactions emoji** (toggle), **mentions** `@[Nom](userId)`.
- **Accusés de lecture à 3 états** (envoyé / remis / lu) et **présence en ligne** (en ligne / vu à).
- **Édition** et **suppression « pour tout le monde »** dans une fenêtre de **15 min** ([[parametres_metier]] PM-14) ; **suppression « pour moi »** (masque) à tout moment ; variantes multiples (batch).
- **Quitter** une conversation ; suppression automatique de la conversation devenue vide.
- **Indicateur « en train d'écrire / d'enregistrer un message vocal »** (éphémère, non persisté).
- **Cloisonnement strict par site** (anti-IDOR cross-site), **rate-limit par utilisateur**, sanitation des noms de fichier, **rejet des exécutables** par magic-bytes, **chiffrement at-rest** des pièces jointes.

### 1.3 Hors périmètre (explicite)

- **Audit** : la messagerie n'est **volontairement pas journalisée** par l'`AuditInterceptor` (volume + sémantique) — voir [[registre_decisions]] D-014. Aucun `@Audit` sur le controller.
- **Annonces / notifications de cloche** : portées par le module `notification` (voir [[glossaire]] « Annonce ») ; la messagerie ne fait qu'**émettre** des notifications ciblées (C-8).
- **Communication externe** (e-mail, SMS, push hors application) : non couverte.
- **Messagerie avec des patients** : exclue ; les contacts sont les **comptes `Utilisateur` actifs du même site** uniquement.
- **Administration des règles fines de média côté serveur** (durée vidéo, compression image) : appliquées **côté client** (voir RM-13-10) ; le backend ne valide que MIME, taille, nombre et magic-bytes.
- **Chiffrement de bout-en-bout (E2EE)** : non implémenté. Le chiffrement est **at-rest** (clé serveur) ; le serveur déchiffre pour les participants autorisés.
- **Résolution de conflits de synchronisation côté client** : hors module (voir [[registre_decisions]] D-016).

---

## 2. Acteurs et rôles

Le module applique la garde `@RequirePermissions` sur 4 permissions (`packages/types/src/permissions.ts`) :

| Permission | Libellé | Usage |
|------------|---------|-------|
| `messagerie.read` | Consulter la messagerie interne | contacts, conversations, messages, pièces jointes, détails, non-lus |
| `messagerie.create` | Envoyer un message | démarrer/créer conversation, envoyer, réagir, typing |
| `messagerie.update` | Modifier un message | éditer son propre message (≤ 15 min) |
| `messagerie.delete` | Supprimer un message | supprimer pour tous (≤ 15 min) / pour moi / batch |

Ces 4 permissions sont incluses dans le **baseline commun à TOUS les rôles** (`COMMS_BASELINE`, `permissions.ts`). Tous les rôles de [[registre_decisions]] D-003 en disposent : **ADMIN_SYSTEME**, **MEDECIN_CHEF**, **INFIRMIER** (et **MEDECIN** dans la cible documentaire 4-rôles). La règle codée : « chacun peut lire/écrire/éditer/supprimer SES propres messages ».

> Honnêteté as-built : il n'existe **pas de privilège de supervision** dans la messagerie. Un médecin-chef ou un admin **ne voit pas** les conversations des autres ; le cloisonnement est **par participant**, identique pour tous les rôles (≠ supervision clinique des modules 07/08/09). Les catégories de patient ne s'appliquent pas (acteurs = comptes utilisateurs).

---

## 3. Exigences fonctionnelles

| ID | Exigence | Vérifiable par |
|----|----------|----------------|
| **EF-13-01** | Le système liste les **contacts** contactables = comptes `Utilisateur` **ACTIF du même site**, hors soi-même, triés par login ; chaque contact expose nom affiché, login et rôle. | `GET /messagerie/contacts` (`listContacts`) |
| **EF-13-02** | Le système liste **mes conversations** avec, par conversation : type, titre (nom de l'interlocuteur en direct, titre en groupe), aperçu du dernier message, auteur, horodatage, nombre de **non-lus**, présence de l'interlocuteur (direct). | `GET /messagerie/conversations` |
| **EF-13-03** | Une conversation **directe** n'apparaît dans la liste (des deux côtés) qu'à partir du **premier message** ; un groupe est visible dès sa création. | `listConversations` (filtre `GROUPE \|\| dernierMessage`) |
| **EF-13-04** | Le système fournit un **compteur global de messages non lus** (badge sidebar). | `GET /messagerie/unread-count` |
| **EF-13-05** | L'utilisateur **démarre ou retrouve** une conversation directe avec un agent (idempotent : pas de doublon de conversation directe). | `POST /messagerie/conversations` (`getOrCreateDirect`) |
| **EF-13-06** | L'utilisateur **crée un groupe** (titre obligatoire ≤ 120 car., 1 à 50 participants du même site). Le créateur est ajouté d'office. | `POST /messagerie/groupes` |
| **EF-13-07** | L'utilisateur **quitte** une conversation ; si plus aucun participant, la conversation et ses messages sont supprimés. | `POST /messagerie/conversations/:id/quitter` |
| **EF-13-08** | Le système renvoie les **messages d'une conversation** déchiffrés, **paginés** (50 par page, curseur `before`) en ordre chronologique avec `hasMore`, et **marque la conversation lue**. | `GET /messagerie/conversations/:id/messages` |
| **EF-13-09** | L'utilisateur **envoie un message** texte (≤ 5000 car.) **et/ou** jusqu'à 10 pièces jointes ([[parametres_metier]] PM-15, PM-16), avec citation optionnelle (`replyToId`). | `POST /messagerie/conversations/:id/messages` |
| **EF-13-10** | Le système **télécharge une pièce jointe déchiffrée** (data URL) pour un participant autorisé uniquement. | `GET /messagerie/pieces-jointes/:id` |
| **EF-13-11** | Le système fournit les **détails d'un message** : statut par destinataire (remis / lu / en ligne, horodatage de lecture). | `GET /messagerie/messages/:id/details` |
| **EF-13-12** | L'utilisateur **ajoute/retire (toggle)** une **réaction emoji** sur un message ; les réactions sont agrégées par emoji avec compteur et indicateur « la mienne ». | `POST /messagerie/messages/:id/reactions` |
| **EF-13-13** | L'utilisateur **modifie son propre message** dans la fenêtre de 15 min ([[parametres_metier]] PM-14) ; le message est marqué « modifié ». | `PATCH /messagerie/messages/:id` |
| **EF-13-14** | L'utilisateur **supprime pour tout le monde** son propre message dans la fenêtre de 15 min (suppression logique). | `DELETE /messagerie/messages/:id` |
| **EF-13-15** | L'utilisateur **supprime pour lui-même** n'importe quel message (masque), individuellement ou par lot (≤ 200). | `POST /messagerie/messages/:id/masquer`, `POST /messagerie/messages/batch-masquer` |
| **EF-13-16** | L'utilisateur **supprime pour tout le monde par lot** (≤ 200, ses messages éligibles ≤ 15 min ; best-effort). | `POST /messagerie/messages/batch-delete` |
| **EF-13-17** | Le système signale en temps réel **« en train d'écrire »** (ou **« d'enregistrer un message vocal »**) aux autres participants (éphémère, non persisté). | `POST /messagerie/conversations/:id/typing` |
| **EF-13-18** | Le système **émet une notification ciblée** à chaque message reçu (sans recopier le contenu) ; les **mentions** déclenchent une notification de niveau **AVERTISSEMENT** même si le destinataire regarde la conversation. | `sendMessage` → C-8 ([[plan_modules]]) |
| **EF-13-19** | Le système calcule des **accusés à 3 états** : envoyé, **remis** (destinataire en ligne ou `lastSeenAt`/`lastReadAt` ≥ date du message), **lu** (`lastReadAt` ≥ date du message) ; en groupe, « lu par tous » quand tous les autres l'ont lu. | `listMessages` / `getMessageDetails` |
| **EF-13-20** | Le contenu de message **et** les pièces jointes sont **stockés chiffrés** (jamais en clair en base) et déchiffrés uniquement à la lecture par un participant autorisé. | `encryptMessage` / `encryptBytes` (champs `contenuChiffre`) |
| **EF-13-21** | Le système **refuse les fichiers exécutables** (magic-bytes MZ/ELF/Mach-O/`#!`) et les **MIME non autorisés**, et **assainit le nom de fichier** (anti path-traversal, ≤ 200 car.). | `assertSafeBinary`, `ALLOWED_MIME`, `sanitizeFilename` |
| **EF-13-22** | Toute opération est **cloisonnée au site et au participant** : impossible d'écrire à un agent d'un autre site, de lire/agir sur une conversation dont on n'est pas membre, ou sur une pièce jointe d'une conversation tierce. | `getOrCreateDirect` (siteId), `assertParticipant` |

---

## 4. Cas d'utilisation

### CU-13-01 — Démarrer une conversation directe et envoyer un message
- **Acteur** : tout utilisateur disposant de `messagerie.create`.
- **Déclencheur** : l'utilisateur choisit un contact via « Nouveau message ».
- **Scénario nominal** : sélection du contact → `getOrCreateDirect` retrouve ou crée la conversation directe → envoi du premier message (texte/PJ) → le message est chiffré, persisté, l'interlocuteur est notifié (C-8) et la conversation apparaît des deux côtés.
- **Scénarios d'erreur** : contact d'un **autre site / inactif / inexistant** → `404 « Destinataire introuvable »` (message uniforme, ne révèle pas l'existence du compte) ; conversation avec soi-même → `400` ; message vide (ni texte ni PJ) → `400 « Message vide »`.
- **Hors-ligne** : non couvert en temps réel — voir §8 (la messagerie est cloisonnée par site et transite par la synchronisation périodique en mode local).
- **Critères** : *Étant donné* un agent du même site, *Quand* j'envoie un premier message, *Alors* la conversation directe existe sans doublon et le destinataire reçoit une notification (sans le contenu).

### CU-13-02 — Créer un groupe
- **Acteur** : utilisateur (`messagerie.create`).
- **Déclencheur** : « Nouveau groupe » avec titre + sélection de participants.
- **Scénario nominal** : titre non vide (≤ 120) + 1 à 50 participants **actifs du même site** → groupe créé, créateur inclus, visible immédiatement.
- **Scénarios d'erreur** : titre vide → `400` ; aucun participant valide → `400` ; > 50 → `400` ; un participant hors site/inactif → `400 « introuvables ou hors de votre site »`.
- **Critères** : *Étant donné* une sélection valide, *Quand* je crée le groupe, *Alors* tous les membres voient le groupe dès sa création.

### CU-13-03 — Lire un fil et générer les accusés
- **Acteur** : participant (`messagerie.read`).
- **Déclencheur** : ouverture d'une conversation.
- **Scénario nominal** : `listMessages` renvoie 50 messages déchiffrés (curseur `before` pour les plus anciens), masque ceux « supprimés pour moi », met à jour `lastReadAt`, marque lues les notifications liées et **pousse en direct** un `MESSAGE_STATUS` aux expéditeurs concernés (leurs ✓✓ passent au bleu).
- **Scénarios d'erreur** : non-membre → `403 « Vous ne participez pas à cette conversation »`.
- **Critères** : *Étant donné* des messages non lus, *Quand* j'ouvre la conversation, *Alors* mes non-lus tombent à 0 et l'expéditeur voit l'accusé « lu » en temps réel.

### CU-13-04 — Répondre, mentionner, réagir
- **Acteur** : participant (`messagerie.create`).
- **Déclencheur** : citation d'un message, mention `@`, ou clic sur un emoji.
- **Scénario nominal** : la citation n'est retenue que si le message cité appartient à la **même conversation** et n'est pas supprimé ; une mention `@[Nom](userId)` génère une notification **AVERTISSEMENT** au mentionné ; une réaction est un **toggle** (re-cliquer retire), notifiant l'auteur (sauf sur son propre message).
- **Scénarios d'erreur** : emoji vide → `400` ; réaction sur message inexistant/supprimé → `404` ; non-membre → `403`.
- **Critères** : *Étant donné* un message d'autrui, *Quand* je réagis deux fois au même emoji, *Alors* la réaction est posée puis retirée (`active: true` puis `false`).

### CU-13-05 — Modifier ou supprimer son message
- **Acteur** : expéditeur (`messagerie.update` / `messagerie.delete`).
- **Déclencheur** : action « Modifier » / « Supprimer pour tout le monde ».
- **Scénario nominal** : dans la fenêtre de 15 min ([[parametres_metier]] PM-14), édition (re-chiffrée, `editedAt` posé) ou suppression logique (`deletedAt`).
- **Scénarios d'erreur** : message d'autrui → `403` ; au-delà de 15 min → `403 « délai dépassé »` ; édition vide → `400` ; message introuvable/déjà supprimé → `404`.
- **Critères** : *Étant donné* un message vieux de plus de 15 min, *Quand* je tente de le modifier, *Alors* l'action est refusée.

### CU-13-06 — Supprimer « pour moi »
- **Acteur** : participant (`messagerie.delete`).
- **Déclencheur** : « Supprimer pour moi » (un message ou plusieurs).
- **Scénario nominal** : création/upsert d'un `MessageMasque` ; le message disparaît de **ma** vue uniquement, sans limite d'âge ni de propriété. La variante batch traite jusqu'à 200 ids en best-effort.
- **Scénarios d'erreur** : message d'une conversation tierce → `403` (via `assertParticipant`) ; introuvable/supprimé → `404`.
- **Critères** : *Étant donné* un message reçu, *Quand* je le masque, *Alors* il n'apparaît plus pour moi mais reste visible pour les autres.

### CU-13-07 — Partager des pièces jointes
- **Acteur** : participant (`messagerie.create`).
- **Déclencheur** : ajout de fichiers à un envoi.
- **Scénario nominal** : jusqu'à 10 fichiers ≤ 16 Mio ([[parametres_metier]] PM-15, PM-16), MIME autorisé, **non exécutables** ; chaque fichier est chiffré et stocké en base (aucun fichier sur disque) ; lecture via `GET /pieces-jointes/:id` (data URL déchiffrée) réservée aux participants.
- **Scénarios d'erreur** : MIME interdit → `400 « Type de fichier non autorisé »` ; magic-bytes exécutable → `400 « Fichier exécutable non autorisé »` ; > 16 Mio ou > 10 fichiers → rejet multer ; pièce d'une conversation tierce → `403`.
- **Hors-ligne** : les pièces jointes voyagent avec le dump SQL (stockées en base) — cf. synchronisation.
- **Critères** : *Étant donné* un `.exe` renommé en `.pdf`, *Quand* je l'envoie, *Alors* il est rejeté.

### CU-13-08 — Indicateur de saisie en cours
- **Acteur** : participant (`messagerie.create`).
- **Déclencheur** : frappe au clavier / enregistrement vocal en cours.
- **Scénario nominal** : `POST .../typing?kind=text|audio` pousse un évènement SSE éphémère (`TYPING` / `TYPING_AUDIO`) aux autres participants ; rien n'est persisté.
- **Scénarios d'erreur** : non-membre → l'évènement est silencieusement ignoré ; dépassement du quota (240/min) → `429`.
- **Critères** : *Étant donné* que je tape, *Quand* j'émets l'évènement, *Alors* les autres voient « en train d'écrire » sans trace en base.

---

## 5. Données du module

Renvoi : [[modele_donnees_global]]. Entités propres (schéma `packages/db/prisma/schema.prisma`) :

| Entité | Rôle | Champs notables |
|--------|------|-----------------|
| `Conversation` | Fil DIRECT ou GROUPE | `type` (DIRECT/GROUPE), `titre?`, `siteId?`, `createdById?`, `updatedAt` (tri), soft-delete `deletedAt`. |
| `ConversationParticipant` | Membre d'un fil | `lastReadAt?` (accusés/non-lus), `joinedAt`, `@@unique(conversationId, utilisateurId)`. |
| `Message` | Message | `contenuChiffre` (AES-256-GCM, jamais en clair), `replyToId?` (citation, `SetNull`), `editedAt?`, `deletedAt?`. |
| `MessagePieceJointe` | Pièce jointe chiffrée | `nomFichier`, `mimeType`, `taille` (octets en clair), `contenuChiffre` (octets chiffrés base64), soft-delete. |
| `MessageReaction` | Réaction emoji | `emoji`, `@@unique(messageId, utilisateurId, emoji)`, soft-delete (tombstone ressuscitable). |
| `MessageMasque` | Suppression « pour moi » | `@@unique(messageId, utilisateurId)` ; cascade DB sur le message. |

Notes as-built : tous ces modèles portent `updatedAt`/`deletedAt` et des index pour la **synchronisation offline-first** ([[registre_decisions]] D-015/D-016). Le déchiffrement utilise des **clés versionnées** (`v2:keyId`, [[parametres_metier]] PM-45). Le **nom affiché** d'un agent provient de `personnelMedical` (prénom + nom) sinon du `login` de l'`Utilisateur`.

---

## 6. Règles métier

| ID | Règle | Source / paramètre |
|----|-------|--------------------|
| **RM-13-01** | Un message est **modifiable et supprimable « pour tout le monde »** uniquement dans une fenêtre de **15 min** après sa création, et **par son seul auteur**. | [[parametres_metier]] PM-14 (`EDIT_DELETE_WINDOW_MS`) |
| **RM-13-02** | La **suppression « pour moi »** (masque) est possible **à tout âge** et **sur tout message** d'une conversation où l'on participe (pas de contrainte de propriété). | `hideForMe` |
| **RM-13-03** | Un message **vide** (ni texte ni pièce jointe) est refusé. Le texte est borné à **5000 caractères** (DTO). | `sendMessage`, `SendMessageDto` |
| **RM-13-04** | Un envoi accepte au plus **10 pièces jointes** de **16 Mio** chacune ; MIME limité (images jpeg/png/webp/gif, vidéo, audio, PDF/Office/texte). | [[parametres_metier]] PM-15, PM-16 ; `ALLOWED_MIME` |
| **RM-13-05** | Un fichier dont les **octets de tête** trahissent un exécutable/script est **rejeté** quel que soit le MIME déclaré ; le nom de fichier est **assaini** et borné à 200 caractères. | `assertSafeBinary`, `sanitizeFilename` |
| **RM-13-06** | Le **contenu** et les **pièces jointes** sont **chiffrés AES-256-GCM au repos** ; déchiffrés seulement pour un participant autorisé. | [[parametres_metier]] PM-45 |
| **RM-13-07** | Une conversation **directe** est **idempotente** : une seule existe par paire d'utilisateurs ; impossible avec soi-même. | `getOrCreateDirect` |
| **RM-13-08** | Un **groupe** compte **1 à 50 participants** (hors créateur compté à part), titre ≤ 120 car. ; tous doivent être **actifs et du même site**. | `createGroup`, `CreateGroupDto` |
| **RM-13-09** | Toute action requiert d'être **participant** de la conversation (sinon `403`) et tout destinataire direct doit être **actif et du même site** (sinon `404` uniforme). | `assertParticipant`, cloisonnement siteId |
| **RM-13-10** | Les **règles fines de média** (durée vidéo ≤ 2 min, compression image) sont **appliquées côté client** ; le backend ne contrôle que MIME/taille/nombre/magic-bytes. | [[parametres_metier]] PM-17 ; `mediaUtils.ts` |
| **RM-13-11** | L'**aperçu** d'un message (liste de conversations, citation) est **tronqué** (≤ 80 car. liste, ≤ 120 car. citation/notif) ; une pièce jointe seule affiche « 📎 <nom> ». | [[parametres_metier]] PM-18 |
| **RM-13-12** | Un message est **« remis »** si le destinataire est en ligne ou si `lastSeenAt`/`lastReadAt` ≥ date du message ; **« lu »** si `lastReadAt` ≥ date du message ; en groupe **« lu par tous »** quand tous les autres l'ont lu. | `listMessages`, `getMessageDetails` |
| **RM-13-13** | Une **mention** déclenche une notification **AVERTISSEMENT** au mentionné même s'il regarde la conversation ; un message simple chez un participant qui **regarde** le fil produit un live **silencieux** (pas de cloche). | `sendMessage`, présence `isViewing` |
| **RM-13-14** | Une **réaction** est un **toggle** ; sa pose ressuscite un éventuel tombstone (re-réaction au même emoji possible après retrait). | `toggleReaction` |
| **RM-13-15** | La présence « regarde la conversation » expire après **45 s** sans rafraîchissement (TTL). | [[parametres_metier]] PM-19 (`VIEWING_TTL_MS`) |
| **RM-13-16** | Quitter une conversation retire le participant ; si **plus aucun participant**, la conversation **et ses messages** sont supprimés (suppression explicite, le soft-delete ayant neutralisé la cascade DB). | `leaveConversation` |
| **RM-13-17** | Le **rate-limit est appliqué par utilisateur** : 150 req/min par défaut, **40 envois/min**, **240 typing/min** (HTTP 429 au dépassement). | `@Throttle` + `UserThrottlerGuard` |

> Toute valeur chiffrée renvoie à [[parametres_metier]] ; aucune n'est redéfinie ici.

---

## 7. Interfaces

### 7.1 Consommé

- **C-9 — Authentification & autorisation** ([[plan_modules]]) : toutes les routes sont protégées par `JwtAuthGuard` + `PermissionsGuard` (exportés par `SecurityModule`) et `UserThrottlerGuard`. Le `siteId` et l'`id` utilisateur proviennent du jeton.
- **C-8 — Notification temps réel** ([[plan_modules]]) : `NotificationService` (notifications ciblées, `markReadForEntite`, `pushLive`) et `PresenceService` (`isOnline`, `isViewing`, `setViewing`) du `NotificationModule`. Voir [[modele_donnees_global]] (entité `Notification`).
- **Couche crypto** : helpers `message-crypto` (`encryptMessage`/`decryptMessage`, `encryptBytes`/`decryptBytes`) — clés versionnées ([[parametres_metier]] PM-45).
- **Référentiel comptes** : `Utilisateur` (statut, siteId, `lastSeenAt`) et `PersonnelMedical` (nom/prénom/rôle) pour le nom affiché et le cloisonnement.

### 7.2 Exposé

- **API REST** `/messagerie/*` (voir §3 pour la liste des endpoints) — déchiffrement à la lecture pour participants autorisés.
- **Service** : `MessagerieService` est **exporté** par `MessagerieModule` (réutilisable), mais **aucun autre module ne l'importe** à ce jour (vérifié : pas d'arête entrante au [[plan_modules]]).
- **Évènements temps réel** (via `NotificationService.pushLive`, canal SSE) : `MESSAGE_NEW`, `MESSAGE_STATUS`, `TYPING`, `TYPING_AUDIO`.
- **Lien profond** : les notifications pointent vers `/messagerie?c=<conversationId>`.

### 7.3 Frontend (parcours)

`apps/web/src/modules/messagerie/` — page **split-panel** style Triage (`MessageriePage.tsx`) : liste de conversations (recherche + non-lus) à gauche, fil (`MessageThread.tsx`) à droite ; popover « Nouveau message » (direct ou groupe) ; sur mobile, un seul panneau à la fois. Temps réel branché sur le flux SSE des notifications. Composants médias : `MediaPreview`, `MediaViewer`, `PieceJointe`, `VoiceRecorder`, emojis Apple servis depuis un **sprite local** (`twemoji.tsx`, `EmojiPicker.tsx`), rogneur vidéo (`ffmpegTrim.ts`).

---

## 8. Exigences non fonctionnelles spécifiques

- **Confidentialité au repos** : contenu et pièces jointes chiffrés AES-256-GCM, clés versionnées rotatives ([[parametres_metier]] PM-45) ; aucun fichier sur disque (tout en base, voyage avec le dump SQL).
- **Cloisonnement / anti-IDOR** : double contrôle systématique site (écriture directe) + participant (lecture/action) ; message d'erreur **uniforme** pour ne pas divulguer l'existence d'un compte.
- **Anti-abus** : rate-limit **par utilisateur** (RM-13-17), sanitation de nom de fichier, rejet des exécutables par magic-bytes.
- **Performance** : non-lus et compteur global calculés en **une requête SQL** (pas de N+1) ; messages paginés (50/page).
- **Temps réel** : présence, accusés et saisie via SSE (latence faible quand le réseau est présent — [[registre_decisions]] D-020).
- **Cloisonnement de synchronisation** : la messagerie est **cloisonnée par site** dans la synchronisation (≠ dossier patient global) — voir [[registre_decisions]] D-005/D-016. En mode desktop `local`, hors-ligne, les échanges inter-postes transitent par la synchronisation périodique ; en ligne (online-first, D-020) le renderer parle au central pour le temps réel.
- **i18n** : interface bilingue FR/EN (react-i18next) ; messages d'erreur backend en français.

---

## 9. Risques et points ouverts

- **Pas d'E2EE** : le serveur déchiffre (clé serveur). Acceptable pour le contexte interne, mais à signaler si une exigence de confidentialité de bout-en-bout émerge. *(point ouvert)*
- **Pas d'audit des échanges** (D-014) : volontaire ; aucune traçabilité des messages dans `JournalAudit`. À reconfirmer si une obligation réglementaire l'impose.
- **Latence hors-ligne** : en mode local pur, la propagation inter-postes dépend de la cadence de synchronisation ([[parametres_metier]] PM-32/PM-33) ; le temps réel exige le central (D-020).
- **Comptage des permissions** : le décompte vérifié est **110** ([[parametres_metier]] PM-47) — sans incidence sur les 4 permissions du module, présentes et vérifiées.
- **Présence en mémoire** : `PresenceService` (en ligne / regarde) est un état **non persisté** ; à la reconnexion ou au redémarrage serveur, les accusés « remis » retombent sur `lastSeenAt`/`lastReadAt`. *(comportement attendu, à documenter pour l'exploitation)*
- **Rôle MEDECIN au catalogue** : divergence 3 vs 4 rôles ([[registre_decisions]] D-003) — sans effet ici (baseline messagerie appliqué à **tous** les rôles existants).

---

*Source de vérité : code `apps/api/src/modules/messagerie` + `apps/web/src/modules/messagerie` ; décision [[registre_decisions]] D-012. Termes : [[glossaire]]. Chiffres : [[parametres_metier]]. Entités : [[modele_donnees_global]]. Contrats : [[plan_modules]].*
