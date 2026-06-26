# Document 18 - Messagerie interne chiffrée

> **Statut de réalisation : RÉALISÉ.** Le module de messagerie interne est entièrement codé et fonctionnel dans CMS SARIS. Ce document décrit l'état réel de l'application (as-built) : conversations individuelles et de groupe cloisonnées par site, messages chiffrés AES-256-GCM au repos, réponses/citations, édition et suppression à deux niveaux, réactions emoji, accusés de lecture à trois états, présence temps réel et partage de médias riches (images, vidéos, audio, documents). Les finitions livrées au-delà du socle initial — **notes vocales avec envoi direct et lecture à vitesse variable**, **album média en bulle unique**, **aperçu avant envoi**, **lecteur média plein-cadre au clic**, **rogneur vidéo** et **liste de réactions personnalisable persistée** — sont décrites en détail au §5. Ce document agrège la documentation existante de la messagerie et y renvoie ; il en constitue le point d'entrée.

## 1. Objectif et positionnement

La messagerie interne est un service transversal de communication professionnelle, disponible pour l'ensemble des rôles de l'application. Elle permet au personnel d'un même site d'échanger des messages textuels, des médias et des notes vocales sans recourir à un outil externe, en conservant la confidentialité des échanges au sein du système d'information du centre médico-social.

Le module ne fait pas partie des huit modules du périmètre MVP : il a été ajouté comme module transversal, au même titre que les notifications temps réel et les conditions générales d'utilisation. Son ergonomie reprend les codes éprouvés d'une messagerie grand public moderne (liste de conversations à gauche, fil à droite, bulles colorées, accusés de lecture, réactions, médias en album) afin de réduire l'effort d'apprentissage pour un personnel non informaticien, tout en respectant le système de design SARIS et les contraintes de sécurité de l'application.

Trois principes structurent le module :

- **Cloisonnement par site.** Un utilisateur ne peut converser qu'avec des collègues de son propre site et n'accède qu'aux conversations dont il est membre (anti-IDOR cross-site).
- **Confidentialité au repos.** Le contenu des messages et des pièces jointes est chiffré en base en AES-256-GCM ; il n'est jamais stocké en clair.
- **Temps réel.** Réception des messages, accusés de lecture, présence et badge de non-lus sont propagés instantanément via le flux SSE applicatif.

## 2. Où la messagerie est documentée

La messagerie est transverse : sa documentation est répartie entre plusieurs cahiers des charges et fiches de stack. Le présent document agrège ces angles et y renvoie. Les deux références normatives sont le **document 13 §11** (règles métier fonctionnelles) et le **document 14 §11** (dictionnaire des données) ; ce document ne les remplace pas mais les complète par le détail des finitions livrées.

| Document / section | Angle | Profondeur |
|---|---|---|
| 01 §12 | Architecture transversale | Moyenne |
| 02 (sécurité, administration, audit) | Permissions + chiffrement + durcissement | Profonde |
| 10 §4.10 | Modèle de données (6 tables) | Moyenne |
| 11 Scénario 9 | Recette / tests | Moyenne |
| 12 WF-19 | Workflow utilisateur | Moyenne |
| **13 §11** | **Règles métier (RÉFÉRENCE fonctionnelle)** | Profonde |
| **14 §11** | **Dictionnaire des 6 tables (RÉFÉRENCE données)** | Profonde |
| 16 §4.1 | Périmètre développé | Moyenne |
| 17 §3.2 / 3.4 / 5 | Exigences non-fonctionnelles (chiffrement, durcissement, temps réel) | Moyenne |
| 09 §5.5 | Outil de ré-encryption (offline) | Superficielle |
| stack/05 §9-10 | Chiffrement AES-256-GCM + durcissement | Profonde |
| stack/02 | Backend (`message-crypto`, multer, `PresenceService`) | Moyenne |
| stack/01 §3 | Frontend (ergonomie type messagerie moderne) | Moyenne |
| stack/03 §3.2 | 6 tables messagerie (+ 2 notifications = 8) | Moyenne |
| stack/00 §3.3 | Synthèse médias riches | Moyenne |

## 3. Architecture technique (synthèse)

L'architecture suit le modèle général de l'application : frontend React 19 (`apps/web/src/modules/messagerie`), backend NestJS 11 (`apps/api/src/modules/messagerie`), persistance PostgreSQL via Prisma 6.

- **Chiffrement au repos.** Les contenus de message et les pièces jointes sont chiffrés en AES-256-GCM (`node:crypto`) par le module `apps/api/src/common/crypto/message-crypto.ts`. Le détail de l'algorithme, du versionnage des clés et de l'outil de ré-encryption figure au document 02 et dans la fiche stack/05 §9-10.
- **Temps réel.** La réception des messages, les changements d'accusé de réception (événement `MESSAGE_STATUS`), la présence et le badge de non-lus passent par le flux SSE applicatif partagé avec les notifications. Côté client, les événements SSE invalident les caches react-query concernés. Un intervalle de rafraîchissement (filet de sécurité) reste actif au cas où le flux SSE serait indisponible.
- **Stockage des pièces jointes.** Les pièces jointes sont reçues en mémoire (multer `memoryStorage`, pas d'écriture disque), validées (taille, MIME, signature binaire), chiffrées, puis stockées chiffrées en base (champ `contenuChiffre` en base64). Elles sont restituées déchiffrées à la demande via un point d'accès dédié.

Cette section est volontairement synthétique : se référer au document 02 (sécurité) et aux fiches stack/02 et stack/05 pour le détail d'implémentation.

## 4. Modèle de données

Le module repose sur **6 tables Prisma** (sur les 78 du schéma global). Les noms exacts proviennent de `packages/db/prisma/schema.prisma`. Pour le détail des champs, contraintes, index et règles de cascade, se reporter au **dictionnaire 14 §11** (référence normative des données).

| Table | Rôle |
|---|---|
| `Conversation` | Conversation individuelle (`DIRECT`) ou de groupe (`GROUPE`), rattachée à un site. |
| `ConversationParticipant` | Membre d'une conversation, avec son curseur de lecture (`lastReadAt`) servant aux accusés. |
| `Message` | Message chiffré au repos (`contenuChiffre`), avec citation (`replyToId`), édition (`editedAt`) et suppression globale (`deletedAt`). |
| `MessageMasque` | Masquage d'un message pour un utilisateur précis (« supprimer pour moi »). |
| `MessageReaction` | Réaction emoji d'un utilisateur sur un message (bascule, unicité par utilisateur et emoji). |
| `MessagePieceJointe` | Pièce jointe chiffrée (image, vidéo, audio ou document), avec nom de fichier, type MIME et taille en clair. |

## 5. Catalogue fonctionnel complet

Cette section décrit l'ensemble des fonctionnalités telles qu'elles sont effectivement codées. Elle insiste sur les finitions livrées qui n'étaient pas encore détaillées dans les autres documents.

### 5.1 Conversations

Deux types de conversations coexistent : individuelle (`DIRECT`, entre deux utilisateurs) et de groupe (`GROUPE`, avec un titre).

- **Démarrage d'une conversation individuelle.** La création (`getOrCreateDirect`) rejette tout destinataire absent, non `ACTIF`, ou situé sur un site différent (`dest.siteId !== siteId`). Le message d'erreur est uniforme (`NotFoundException`) afin de ne pas révéler l'existence d'un compte d'un autre site.
- **Création d'un groupe.** La création (`createGroup`) vérifie que tous les participants appartiennent au même site et sont `ACTIF`. Un groupe est plafonné à **50 participants** (contrôlé en DTO et revalidé côté service).
- **Cloisonnement systématique.** Tout accès à une conversation (lister les messages, envoyer, consulter les détails, réagir) passe par `assertParticipant`, qui valide l'appartenance via la clé composite `conversationId_utilisateurId`.
- **Suppression côté carte.** Un utilisateur peut retirer une conversation de sa liste depuis le menu de la carte, sans affecter les autres participants.

### 5.2 Messages

- **Envoi optimiste.** Le message s'affiche immédiatement dans le fil avant l'accusé serveur ; les messages sont paginés (`MESSAGE_PAGE_SIZE = 50` par page).
- **Réponses et citations.** Un message peut citer un message précédent (`replyToId`). Le service vérifie que le message cité appartient à la même conversation et n'est pas supprimé ; un aperçu de citation est tronqué à 120 caractères.
- **Édition ≤ 15 min.** L'auteur peut modifier son message dans une fenêtre de 15 minutes (`EDIT_DELETE_WINDOW_MS = 900 000 ms`) ; le champ `editedAt` est renseigné.
- **Suppression à deux niveaux.**
  - *Pour tout le monde* : réservée à l'auteur, dans la même fenêtre de 15 minutes ; suppression douce via `deletedAt`.
  - *Pour moi* : toujours possible, sans limite de temps ; crée une entrée `MessageMasque (messageId, utilisateurId)`. Le listage filtre les messages masqués pour l'utilisateur courant.
- **Suppression multiple.** Le masquage en lot (`batchHideForMe`) et la suppression en lot (`batchDelete`) sont bornés à 200 messages distincts, traités en meilleur effort.
- **Taille du contenu.** Un message textuel est borné à 5000 caractères (DTO).

### 5.3 Réactions emoji

Un message peut recevoir des réactions emoji, par bascule (un nouveau clic sur la même réaction la retire).

- **Liste de réactions rapides.** Six réactions par défaut sont proposées : `QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']`.
- **Liste personnalisable persistée.** L'utilisateur peut ajouter ses propres emojis de réaction via le sélecteur. Ces réactions personnalisées sont stockées en `localStorage` sous la clé `saris.reactions.custom`. La fonction `addCustomReaction` ajoute l'emoji en tête de liste (motif *unshift*), refuse les doublons et les emojis déjà présents dans les six défauts, et plafonne la liste à six emojis personnalisés. Le menu de réactions affiche alors `[...QUICK_REACTIONS, ...custom]`.
- **Affichage.** Les réactions apparaissent sous le message sous forme de pastilles (chip) avec compteur ; les emojis sont rendus via Twemoji à partir de la planche Apple locale.
- **Notification à l'auteur.** Toute réaction émet une notification de type `MESSAGE`, niveau `INFO`, à l'auteur du message d'origine (titre « Nouvelle réaction », corps « *{nom}* a réagi *{emoji}* à votre message »), sauf lorsqu'un utilisateur réagit à son propre message. La notification renvoie vers la conversation concernée.
- **Côté serveur.** `toggleReaction` valide l'emoji (`trim`, borné à 16 caractères) et crée ou supprime la réaction dans la table `MessageReaction` (clé composite `messageId_utilisateurId_emoji`).

> **Note — emojis Apple locaux.** Le sélecteur d'emojis (`EmojiPicker`) repose sur `emoji-mart` avec le jeu de données Apple et une planche d'images auto-hébergée (`/emoji/apple-64.png`), référencée en URL absolue. Aucun appel à un CDN externe n'est effectué (fonctionnement hors-ligne total). Le thème du sélecteur suit la classe `.dark` de l'application, et non la préférence du système d'exploitation.

### 5.4 Accusés de lecture et présence

Chaque message affiche un accusé de réception à **trois états** :

| État | Affichage | Condition |
|---|---|---|
| Envoyé | ✓ | Le message est enregistré côté serveur, ni remis ni lu. |
| Remis | ✓✓ (gris) | Au moins un destinataire est joignable : il est en ligne, ou son `lastSeenAt` est postérieur à la création du message, ou son `lastReadAt` l'est. |
| Lu | ✓✓ (bleu) | Au moins un destinataire a lu le message (`lastReadAt >= createdAt`). |

- **Calcul du statut.** Le service détermine `remis` selon la règle `this.presence.isOnline(utilisateurId) || lastSeenAt >= createdAt || lastReadAt >= createdAt`, et `vu` lorsque `luPar > 0`. Le message expose `remis`, `remisPar`, `vu`, `luPar` et `luParTous`.
- **Propagation temps réel.** Tout changement d'état pousse un événement SSE `MESSAGE_STATUS` (non persisté) vers les expéditeurs concernés ; côté client, la réception de cet événement invalide la requête du fil.
- **Présence.** Le `PresenceService` maintient en mémoire un compteur de connexions par utilisateur (`connect`/`disconnect`) ; `isOnline` renvoie « compteur > 0 ». À la connexion au flux SSE, la présence est activée et les coparticipants sont notifiés ; à la déconnexion, `lastSeenAt` est persisté. L'en-tête de conversation affiche « en ligne » ou « vu à … ».
- **Auto-marquage lu et badge.** À l'ouverture d'un fil, `listMessages` met à jour `lastReadAt = now` pour le participant ; le badge de non-lus est invalidé immédiatement (sans attendre le rafraîchissement réseau), ce qui le décrémente de façon instantanée. Seuls les messages plus récents que l'ancien curseur de lecture génèrent un `MESSAGE_STATUS`.

### 5.5 Notes vocales

L'enregistrement et l'envoi d'une note vocale se font en un seul geste, sans étape de relecture intermédiaire (composant `VoiceRecorder`).

- **Enregistrement.** `MediaRecorder` utilise le premier codec disponible parmi `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/webm`, `audio/mp4`. Une onde d'amplitude temps réel est calculée (`AnalyserNode`, `fftSize = 1024`, lecture du pic normalisé du signal time-domain), ré-échantillonnée vers exactement **44 barres** (`BARS = 44`) toutes les 80 ms (`SAMPLE_MS`). Les barres varient de 3 px (silence) à environ 26 px (volume maximal). Un point rouge clignotant (animation `saris-rec-pulse`) et un chronomètre (`tabular-nums`, mis à jour ~1 s) indiquent l'enregistrement en cours.
- **Limite de durée.** L'enregistrement est borné à `MAX_SEC = 300` secondes (5 minutes) ; l'atteinte de la limite déclenche l'arrêt et l'envoi automatiques.
- **Envoi direct.** Le bouton « Envoyer » positionne le mode interne sur `send` puis arrête l'enregistrement ; à l'arrêt (`onstop`), si le blob est non vide, un fichier `note-vocale-{mm}m{ss}s.{ext}` est créé et transmis directement via le callback `onSend`, sans modal ni lecteur de confirmation. L'extension dérive du MIME (`mp4 → m4a`, `ogg → ogg`, sinon `webm`).
- **Annulation.** Le bouton corbeille positionne le mode sur `cancel` puis arrête l'enregistrement ; à l'arrêt, aucun fichier n'est créé et le callback d'annulation est appelé (idem si le blob est vide).
- **Erreur micro.** En cas d'accès microphone refusé, le message « Micro inaccessible — autorisez l'accès au microphone. » s'affiche en rouge et disparaît automatiquement après 1,6 s.

**Lecture sur la bulle** (composant `VoiceNotePlayer`). La note vocale est restituée par un lecteur compact aligné sur le thème de la bulle :

- Onde visuelle de **36 barres** (`WAVE_BARS = 36`) décodée via la Web Audio API : le contenu est récupéré, décodé (`decodeAudioData`), découpé en 36 blocs dont la moyenne RMS est normalisée entre 0 et 1. La durée est lue depuis le buffer décodé (fiable, contourne le bug WebM où `duration === Infinity`). Un `AudioContext` est partagé entre tous les lecteurs (optimisation).
- Bouton lecture/pause circulaire (36 × 36 px), durée formatée (`MM:SS`), tête de lecture (pastille) déplaçable, et possibilité de chercher une position en cliquant sur l'onde.
- **Vitesse de lecture** : un bouton de vitesse, visible uniquement pendant la lecture, fait basculer entre les trois vitesses `VOICE_SPEEDS = [1, 1.5, 2]` (affichées « 1× », « 1,5× », « 2× ») et applique immédiatement `playbackRate`.
- La palette s'adapte au contexte : sur la bulle de l'utilisateur, blanc et teal `--ap-600` ; sur une bulle reçue, `--ap-400`/`--ap-500` sur fond `--fond-surface-2`.

### 5.6 Partage de médias

La messagerie prend en charge les images, vidéos, audio et documents, avec des règles de validation et plusieurs surfaces dédiées (aperçu, album, lecteur, rogneur). Les règles communes sont centralisées dans `mediaUtils.ts`.

**Règles de validation (`LIMITS`).**

| Type | Taille maximale | Contrainte additionnelle |
|---|---|---|
| Image | 8 Mo | Compression automatique canvas si dimension > 1920 px ou taille > 8 Mo (ré-encodage JPEG itératif ; les GIF animés ne sont pas recompressés). |
| Vidéo | 16 Mo | Durée maximale `VIDEO_MAX_SEC = 120` s (2 minutes) ; au-delà, rognage obligatoire. |
| Audio | 16 Mo | — |
| Document | 16 Mo | — |

Un message peut regrouper au maximum **10 fichiers**.

**Aperçu avant envoi** (`MediaPreview`). Avant l'envoi, une modale d'aperçu se positionne en `absolute; inset: 0` au sein du fil (zone de droite uniquement, sans portail vers le `body`) : la liste des conversations reste visible. Elle reprend les tokens de couleur SARIS (cohérence clair/sombre).

- En-tête fixe (56 px) avec nom du fichier courant, taille, durée et index (« 1/5 fichiers »), bouton de fermeture.
- Zone d'aperçu principale par type : image (`<img>` contain), vidéo (lecteur natif `controls`), audio (icône + lecteur natif), document (icône + nom).
- Bande de miniatures (56 × 56 px), bouton « + » d'ajout (désactivé à 10 fichiers), champ de légende (Entrée valide l'envoi), bouton d'envoi circulaire.
- Le processus prépare chaque fichier de façon asynchrone : compression d'image, extraction de la durée des vidéos/audio. Une note de succès (verte) indique la compression réalisée (« compressée · X → Y ») ; une erreur bloquante (rouge) désactive l'envoi.

**Album en bulle unique** (`MediaGrid` / `MediaThumb`). À l'affichage, plusieurs médias d'un même message sont regroupés en album dans une seule bulle, selon une grille paramétrique :

| Nombre de médias | Disposition |
|---|---|
| 1 | Affichage naturel (`single`), image jusqu'à 300 × 360 px. |
| 2 et 4 | Grille 2 colonnes (cellules carrées, mode `cover`). |
| 3 | Grille 3 colonnes. |
| > 4 | 4 premiers affichés ; la 4ᵉ cellule porte un voile « +N » (médias restants). |

La grille a une largeur fixe de 300 px (espacement 2 px). Les audio et documents joints sortent de l'album et s'affichent en cartes sous celui-ci ; une légende textuelle éventuelle figure dans la même bulle. Les médias sont chargés en différé (hook `usePiece`, react-query). Un clic sur une cellule ouvre le lecteur plein-cadre.

**Lecteur média au clic** (`MediaViewer`). Le clic sur un média ouvre un lecteur plein-cadre rendu en `absolute; inset: 0` (zone de droite uniquement), avec les tokens SARIS. Il affiche selon le type : vidéo (`<video controls autoPlay>`), image (`contain`), audio (`<audio controls>`) ou document (icône + bouton de téléchargement). L'en-tête propose la fermeture et le téléchargement. Le contenu est chargé déchiffré depuis le point d'accès `GET /messagerie/pieces-jointes/{pieceId}`.

**Rognage vidéo.** Lorsqu'une vidéo dépasse 2 minutes ou 16 Mo, le rognage est obligatoire ; un rogneur intégré (`FilmstripTrimBar`) permet d'extraire un segment :

- Timeline de 58 px avec une pellicule de 12 vignettes (extraites par seek), des voiles assombrissant les zones hors sélection, deux poignées de bornage et une fenêtre de sélection déplaçable d'un bloc ; une tête de lecture matérialise la position courante. La durée sélectionnable est bornée par `videoMaxSpan = min(120 s, 16 Mo × 0,9 / débit, durée réelle)`, avec une longueur minimale de 0,5 s.
- **Découpe rapide par défaut** : `trimVideoFast` s'appuie sur **ffmpeg.wasm** (cœur ESM auto-hébergé sous `/public/ffmpeg/`, ~31 Mo, chargé à la demande puis mis en cache par le service worker, aucun CDN). La commande `-ss <start> -i input -t <span> -c copy` découpe par copie de flux, sans ré-encodage : opération quasi instantanée, qualité d'origine préservée, taille proportionnelle à la durée. Le drapeau `+faststart` est appliqué aux conteneurs MP4/MOV. Le fichier est renommé `…-extrait.ext`.
- **Repli** : si ffmpeg.wasm n'est pas disponible, `trimVideo` ré-encode en temps réel via `MediaRecorder` (WebM VP8/VP9 + Opus), à un débit borné entre 300 kbit/s et 4 Mbit/s, calculé selon un budget de taille (82 % de la limite vidéo).

> **Note — pièges médias.** La fonction `mediaDuration` applique un délai de garde de 5 s et force un seek (`currentTime = 1e7`) pour contourner le cas WebM où la durée reste `Infinity`. Le rogneur n'est pas testable en automatisation lorsque l'onglet est en arrière-plan (le décodage vidéo est suspendu) : son comportement se valide au premier plan.

### 5.7 Liens, emojis et pagination

- **Liens cliquables.** Les URL contenues dans un message sont rendues cliquables après assainissement.
- **Emojis locaux.** L'ensemble des emojis (bulles, réactions, sélecteur) est rendu à partir d'une planche Apple auto-hébergée, sans dépendance à un CDN externe (fonctionnement hors-ligne).
- **Pagination.** Les messages sont paginés (`MESSAGE_PAGE_SIZE = 50`) ; le chargement des conversations, des non-lus et du fil est piloté par react-query avec des durées de fraîcheur courtes, complétées par le temps réel SSE.

## 6. Sécurité et durcissement (synthèse)

Cette section synthétise les mesures de sécurité spécifiques à la messagerie. Le détail figure au document 02 et dans la fiche stack/05.

- **Chiffrement au repos.** Contenus de message et pièces jointes chiffrés en AES-256-GCM (`message-crypto.ts`), avec clé dérivée par scrypt et format versionné `v2:<keyId>:<iv>:<tag>:<ciphertext>`.
- **Rotation et versionnage de clé.** Trousseau multi-clés via `MESSAGE_ENC_KEYS` (avec une clé courante `MESSAGE_ENC_KEY_CURRENT`), clés Vault-ready via `MESSAGE_ENC_KEYS_FILE`, compatibilité de lecture du format v1 historique. Outil de ré-encryption v1 → v2 non destructif (endpoint `POST /synchronisation/messagerie/rechiffrer`, cf. document 09 §5.5). Un avertissement est émis au démarrage si une clé de production faible ou par défaut est détectée.
- **Rate-limit.** Lecture plafonnée à 150 requêtes/min/utilisateur sur l'ensemble du contrôleur ; envoi de message plafonné à **40 requêtes/min/utilisateur** (isolation par `userId` via `UserThrottlerGuard`).
- **Anti-IDOR et cloisonnement par site.** Toute opération vérifie l'appartenance du demandeur à la conversation (`assertParticipant`) ; la création de conversation rejette les destinataires d'un autre site avec un message d'erreur uniforme.
- **Contrôle des fichiers.** Réception en mémoire (multer `memoryStorage`), limites 16 Mo × 10 fichiers, liste blanche de types MIME (images, vidéo, audio, PDF, texte/CSV, Office), assainissement du nom de fichier (anti path-traversal, bornage à 200 caractères) et validation par signature binaire (`assertSafeBinary`) rejetant les exécutables (`MZ`, `ELF`, Mach-O, `#!`) quelle que soit l'extension déclarée.

## 7. Permissions

L'accès à la messagerie est régi par quatre permissions du catalogue (`packages/types/src/permissions.ts`), faisant partie de la base commune à tous les rôles :

| Permission | Portée |
|---|---|
| `messagerie.read` | Lister les conversations, messages, contacts, pièces jointes et détails. |
| `messagerie.create` | Démarrer une conversation, envoyer un message, réagir. |
| `messagerie.update` | Modifier son propre message (≤ 15 min). |
| `messagerie.delete` | Supprimer un message (pour tous ≤ 15 min, ou pour moi sans limite). |

## 8. Recette

La recette du module est décrite au **document 11, Scénario 9** : envoi et réception, chiffrement effectif en base, conversation de groupe, pièces jointes, réactions, accusés de lecture à trois états, présence, suppression à deux niveaux et durcissement (rate-limit, anti-IDOR). S'y reporter pour le protocole de test détaillé.

## 9. Spécification visuelle (guide de reproduction)

Cette section est un guide de reproduction visuelle autonome. Elle décrit l'interface de la messagerie avec assez de précision (dimensions en pixels, couleurs en hexadécimal, rayons, états) pour la réimplémenter dans un autre projet — potentiellement une autre pile technique — sans accès au code source de SARIS. Le principe directeur est celui d'une messagerie moderne : **liste des conversations à gauche, fil de discussion à droite**, design sobre et monochrome rehaussé d'un **accent teal**, coins arrondis de **10 px au maximum**, et **aucune ombre lourde** (les ombres restent fines, et sont remplacées par des bordures en mode sombre).

### 9.1 Palette et tokens

Tout le rendu repose sur un jeu de variables (« tokens »). Les recopier sous forme de variables CSS (ou l'équivalent dans la pile cible) garantit la cohérence clair/sombre. Le code SARIS lit ces valeurs via `var(--nom-du-token)` ; ci-dessous, chaque token est donné avec sa valeur claire et sa valeur sombre.

**Accent primaire teal (`--ap-*`) — boutons, bulles envoyées, liens d'état.**

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--ap-50` | `#E9EDF1` | `#262E38` | Tuiles d'icône, fond carte sélectionnée, fond réaction « la mienne ». |
| `--ap-100` | `#DBE1E8` | `#313A45` | Fond de l'icône de groupe. |
| `--ap-200` | `#C3CBD5` | `#3D4753` | Bordure de réaction « la mienne ». |
| `--ap-300` | `#A3ACB8` | `#5A6573` | Niveaux intermédiaires. |
| `--ap-400` | `#4E8BA4` | `#4E8BA4` | **Accent principal** : boutons, bulle envoyée, badge. Teal conservé en sombre. |
| `--ap-500` | `#3D7A92` | `#5B9BB0` | Survol de l'accent, onde de note vocale jouée. |
| `--ap-600` | `#586472` | `#98A6B5` | Icônes décoratives, accusé « lu », nom d'auteur en groupe. |
| `--ap-700` | `#3F4A58` | `#B7C0CB` | États actifs, titre de citation reçue. |

**Fonds, textes, bordures.**

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--fond-page` | `#F4F6F8` | `#0D1117` | Fond du fil de messages, fond global. |
| `--fond-surface` | `#FFFFFF` | `#161B22` | Cartes, bulles reçues, popovers, modales. |
| `--fond-surface-2` | `#F0F2F5` | `#1C2333` | Panneaux secondaires, survol de menu, chips « autres ». |
| `--texte-primaire` | `#242B34` | `#E6EDF3` | Corps de texte, titres. |
| `--texte-secondaire` | `#54606E` | `#8B949E` | Sous-titres, libellés d'actions. |
| `--texte-tertiaire` | `#98A2B2` | `#484F58` | Placeholders, horodatage, infos fines. |
| `--bordure-legere` | `rgba(15,23,42,0.08)` | `rgba(230,237,243,0.08)` | Séparateurs fins, bordure de bulle reçue. |
| `--bordure-normale` | `rgba(15,23,42,0.14)` | `rgba(230,237,243,0.14)` | Bordures d'input et de textarea. |
| `--bordure-forte` | `rgba(15,23,42,0.28)` | `rgba(230,237,243,0.28)` | Éléments actifs, onde non jouée. |

**Tokens sémantiques.**

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--erreur-accent` | `#9B4444` | `#CC6060` | Boutons de suppression, point d'enregistrement, corbeille. |
| `--erreur-fond` | `#F5EAEA` | `#2E1A1A` | Survol des actions destructives. |
| `--succes-accent` | `#3D7A5E` | `#56C47A` | Présence « en ligne ». |
| `--succes-fond` | `#EAF3EC` | `#1A2E20` | Note de compression réussie (aperçu média). |

**Échelle de rayons (alias plafonnés à 10 px).** `--radius-sm` 4 px (badges) ; `--radius-md` 6 px (boutons, inputs, avatar/icône de groupe) ; `--radius-lg` 8 px (cartes, tuiles d'icône) ; `--radius-xl` 10 px (modales, popovers de menu). Trois rayons spécifiques sortent de l'échelle car liés à des formes : **9999 px** (pastilles, cercles, badges), **20 px** (textarea du composeur), **12 px** (bulles de message et popovers).

**Polices.** Corps : `Plus Jakarta Sans` (repli Inter, `-apple-system`). Titres : `Sora` (repli Plus Jakarta). Monospace : `JetBrains Mono` (horloge d'en-tête). Tailles utilisées dans la messagerie : 18 px (titre de page, `h2`), 16 px (`h3`), 14 px (nom d'en-tête de fil, `h4`), 13 px (corps de message, `body-sm`), 12 px (aperçu de carte, `label`), 11 px (présence, citation, `caption`), 10 px (horodatage, `overline`), 10,5 px (séparateur de date). Graisses : 400 (atténué), 500 (normal), 600 (titres), 700 (actif / non-lu).

**Effets transversaux.** *Verre poli* : `color-mix(in srgb, var(--fond-surface) 82%, transparent)` + `backdrop-filter: blur(10px)`, appliqué à l'en-tête du fil (et 92 % + `blur(4px)` au séparateur de date). *Grain* : texture SVG (`feTurbulence`, `baseFrequency` ≈ 0,82, 2 octaves, alpha 0,28, taille 200 px), appliquée en surimpression sur le fond du fil ; désactivée sous `prefers-contrast: more`. *Ombres claires* : `--ombre-1` `0 1px 2px rgba(15,23,42,0.06)`, `--ombre-4` `0 8px 24px rgba(0,0,0,0.12)` ; toutes neutralisées en sombre (remplacées par des bordures). *Barre de défilement* : fine, pouce `--bordure-normale` (survol `--bordure-forte`), piste transparente.

### 9.2 Mise en page générale (split-panel)

La page est une colonne en pleine hauteur : un **en-tête global** (hauteur automatique, non rétractable) surmonte un **conteneur bipartite** qui occupe le reste de la hauteur (`flex: 1`, `min-height: 0` pour empêcher tout débordement).

```
┌──────────────────────────────────────────────────────────────┐
│ EN-TÊTE   [icône] Messagerie interne   HH:MM:SS · chiffrée     │
│                                          [ + Nouveau message ] │
├───────────────────────┬─┬────────────────────────────────────┤
│ PANNEAU GAUCHE        │ │ PANNEAU DROIT (fil)                  │
│  [ Rechercher…      ] │S│  [avatar]  Nom · présence            │
│ ┌───────────────────┐ │É├──────────────────────────────────── │
│ │ ConversationCard  │ │P│         ── Aujourd'hui ──            │
│ │ ConversationCard  │ │A│   [bulle reçue]                      │
│ │ …                 │ │R│              [bulle envoyée]  ✓✓     │
│ └───────────────────┘ │5│                              [ ↓ ]  │
│  280–560 px (360 déf.) │px│ ─────────────────────────────────  │
│                       │ │ [😊][sticker][📎] [ textarea ] [➤]  │
└───────────────────────┴─┴────────────────────────────────────┘
```

- **Panneau gauche** : largeur par défaut **360 px**, redimensionnable de **280 px à 560 px** (`flex-shrink: 0`). La largeur est un état mis à jour en direct au glissement de souris.
- **Séparateur** : 5 px de large, `cursor: col-resize`, `flex-shrink: 0`. Fond transparent au repos, `--ap-50` au survol et pendant le redimensionnement ; une ligne fine de 1 px (à 2 px du bord gauche) passe de `--bordure-legere` à `--ap-400` pendant le glissement. Le **double-clic réinitialise à 360 px**. Pendant le redimensionnement, `body { user-select: none }`.
- **Panneau droit (fil)** : occupe l'espace restant (`flex: 1`, `min-width: 0`). Son conteneur racine est en `position: relative` : c'est l'ancrage des overlays médias, qui se placent en `position: absolute; inset: 0` **à l'intérieur de la zone de droite uniquement** (la liste de gauche reste visible, à la manière d'une messagerie web). Les modales globales (détails, choix de suppression, confirmation) restent, elles, en `position: fixed; inset: 0`.

L'en-tête global comprend, à gauche, une tuile d'icône 36 × 36 px (`border-radius: 8px`, fond `--ap-50`), le titre « Messagerie interne » (18 px, graisse 600) et un sous-titre 13 px en `inline-flex` (gap 6 px) regroupant l'horloge monospace `HH:MM:SS`, un cadenas + « chiffrée » et un compteur de non-lus optionnel ; à droite, le bouton « Nouveau message » (hauteur 34 px, fond `--ap-400`, texte blanc, 13 px, gap 6 px). Marges d'en-tête : `padding: 16px 24px 0`, `margin-bottom: 16px`.

**Z-index.** 0 par défaut ; 3 pour le séparateur de date sticky ; 5 pour le bouton « descendre » ; 60 pour les overlays médias et les modales (62 pour le lecteur quand il se superpose à l'aperçu).

### 9.3 Panneau gauche — liste des conversations

Le panneau est une colonne : un **en-tête de recherche** fixe (`flex-shrink: 0`, `padding: 10px 12px`, `border-bottom: 1px solid var(--bordure-legere)`) au-dessus d'une **liste défilante** (`flex: 1`, `overflow-y: auto`, `min-height: 0`).

**Recherche.** Champ de 32 px de haut, 12 px de texte, `border-radius: 6px`, fond `--fond-surface`, bordure `--bordure-normale`. Icône loupe de 13 px en `position: absolute; left: 10px` (centrée verticalement, `pointer-events: none`, couleur `--texte-tertiaire`) ; le texte est donc indenté à gauche de 32 px. Un bouton « × » de 12 px apparaît à droite (`right: 8px`) dès qu'un texte est saisi.

**Anatomie d'une carte de conversation.** Disposition `flex` (`align-items: center`, gap 10 px), `padding: 10px 12px`, `border-bottom: 1px solid var(--bordure-legere)`, `cursor: pointer`, `transition: background 0.1s`. Hauteur implicite ≈ 60 px.

- **Avatar / icône de groupe** (40 × 40 px, `flex-shrink: 0`, `border-radius: 6px`). Pour une conversation directe, l'avatar affiche les initiales (graisse 700, ≈ 15 px) sur un fond de couleur **déterministe** dérivée d'un hachage du nom, choisie dans une palette de 8 paires fond/texte pastel : `#DBEAFE`/`#1D4ED8`, `#D1FAE5`/`#065F46`, `#FEF3C7`/`#92400E`, `#FCE7F3`/`#9D174D`, `#EDE9FE`/`#5B21B6`, `#E0F2FE`/`#0369A1`, `#FFE4E6`/`#9F1239`, `#ECFCCB`/`#3F6212`. Pour un groupe : fond `--ap-100`, icône « groupe » de 18 px en couleur `--ap-700`.
- **Contenu** (`flex: 1`, `min-width: 0`, colonne) en deux lignes.
  - *Ligne 1* : nom (13 px ; graisse **700 si non-lus**, sinon 600 ; couleur `--texte-primaire` ; ellipsis) et, à droite, l'heure (10 px, `--texte-tertiaire`, `flex-shrink: 0`) au format `HH:MM` (jour même), `Hier` ou `JJ/MM`.
  - *Ligne 2* (`margin-top: 2px`) : aperçu du dernier message (12 px ; graisse **600 + couleur `--texte-secondaire` si non-lu**, sinon 400 + `--texte-tertiaire` ; ellipsis ; préfixé « Vous : » ou « Nom : ») et, à droite, le badge de non-lus.
- **Badge non-lus** : `min-width: 18px`, hauteur 18 px, `padding: 0 5px`, `border-radius: 9999px`, fond `--ap-400`, texte blanc 10 px graisse 700 centré ; affiche `N` ou `99+`.
- **Kebab (menu)** : visible au survol ou menu ouvert, en `position: absolute; top: 8px; right: 8px`. Déclencheur 26 × 26 px (`border-radius: 6px`, fond `--fond-surface`, bordure `--bordure-legere`, ombre `0 1px 3px rgba(0,0,0,0.1)`, icône « plus vertical » 14 px). Le popover associé fait 210 px de large (`padding: 4px`, `border-radius: 10px`, ombre `--ombre-4`) et contient une ou deux lignes destructives (« Supprimer » / « Quitter ») : 100 % de large, `padding: 8px 10px`, `border-radius: 7px`, 13 px, couleur `--erreur-accent`, survol `--erreur-fond`, icône 14 px.

**États.** *Non sélectionnée* : fond transparent, `border-left: 3px solid transparent`. *Sélectionnée* : fond `--ap-50`, `border-left: 3px solid var(--ap-400)`. La transition de fond est de 0,1 s.

### 9.4 Panneau droit — en-tête, séparateurs, fil

Le panneau droit est une colonne en pleine hauteur : en-tête fixe, fil défilant, puis (optionnellement) barre de réponse / barre de sélection, et enfin composeur.

**En-tête du fil.** `display: flex`, `align-items: center`, gap 12 px, `padding: 12px 20px`, `flex-shrink: 0`, `border-bottom: 1px solid var(--bordure-legere)`, **effet de verre** (fond `color-mix(... 82% ...)` + `backdrop-filter: blur(10px)`). Il reprend l'avatar / l'icône de groupe (40 × 40 px) puis un bloc texte :

- **Nom** : 14 px, graisse 600, `--texte-primaire`, ellipsis.
- **Sous-titre de présence** : 11 px, ellipsis. En groupe : « X participants · nom1, nom2… » en `--texte-tertiaire`. En direct : « ● en ligne » (couleur `--succes-accent` `#3D7A5E`, graisse 600), ou « vu hier à HH:MM » / « vu le JJ/MM à HH:MM » en `--texte-tertiaire`, ou le rôle.

**Fil de messages.** `flex: 1`, `overflow-y: auto`, `min-height: 0`, `padding: 16px 20px`, fond `--fond-page`, `position: relative`, texture de grain en surimpression. Les messages sont regroupés par jour.

**Séparateur de date (sticky).** `position: sticky; top: 4px; z-index: 3`, centré, `margin: 6px 0 10px`, `pointer-events: none`. La pastille : `display: inline-block`, 10,5 px graisse 600, couleur `--texte-secondaire`, fond `color-mix(in srgb, var(--fond-surface) 92%, transparent)`, `backdrop-filter: blur(4px)`, `padding: 4px 12px`, `border-radius: 9999px`, ombre `0 1px 4px rgba(0,0,0,0.08)`. Libellé intelligent : « Aujourd'hui », « Hier », nom du jour (< 7 j), « Mercredi 5 juin » (> 7 j), avec l'année si différente.

**Bouton « descendre ».** Apparaît lorsque l'écart de défilement dépasse ≈ 220 px. `position: absolute; right: 24px`, `bottom: 86px` (ou 150 px si une barre de réponse est ouverte), 38 × 38 px, `border-radius: 9999px`, fond `--fond-surface`, bordure `--bordure-normale`, ombre `0 4px 12px rgba(0,0,0,0.12)`, couleur `--texte-secondaire`, `z-index: 5`, chevron-bas de 18 px, transition d'opacité 0,12 s.

### 9.5 Bulles de message

Chaque message est une enveloppe `flex` horizontale alignée à droite (envoyé) ou à gauche (reçu), gap 8 px. À l'intérieur, la bulle est une colonne (`position: relative`, `gap: 3px`, `max-width: 74 %` de la zone). En groupe, le nom de l'auteur précède la bulle (11 px, graisse 600, couleur `--ap-600`, `padding-left: 4px`), masqué dans les messages groupés.

**Envoyé vs reçu.**

| Propriété | Envoyé (le mien) | Reçu |
|---|---|---|
| Fond | `--ap-400` (`#4E8BA4`) | `--fond-surface` (`#FFFFFF`) |
| Texte | `#FFFFFF` | `--texte-primaire` (`#242B34`) |
| Alignement | `flex-end` (droite) | `flex-start` (gauche) |
| Rayon | 12 px, coin **bas-droit à 3 px** | 12 px, coin **bas-gauche à 3 px** |
| Bordure | aucune | `1px solid var(--bordure-legere)` |
| Ombre | aucune | `0 1px 1px rgba(0,0,0,0.04)` |
| `max-width` | 320 px avec médias, sinon auto | idem |
| Padding | `8px 12px` (texte seul) ou `5px 10px 7px` (média + texte) | idem |

L'opacité tombe à 0,75 pendant l'envoi optimiste (*pending*). Le **regroupement** (messages consécutifs du même auteur à moins de ~4 min) réduit la marge supérieure de 10 px à 2 px et conserve le coin à 3 px ; les messages de tête de groupe gardent leur marge de 10 px.

**Texte.** 13 px, `line-height: 1.45`, `white-space: pre-wrap`, `word-break: break-word`, couleur héritée de la bulle.

**Horodatage et métadonnées.** Ligne `flex` sous le contenu (`align-items: center`, gap 6 px, hauteur 15 px). Heure au format `HH:MM` (10 px, `--texte-tertiaire`), ou icône horloge 11 px + « envoi… » si *pending*. Le marqueur d'édition est « · modifié » (10 px, italique, `--texte-tertiaire`).

**Accusés à trois états** (uniquement sur les messages envoyés, hors *pending*) :

| État | Icône | Taille | Couleur |
|---|---|---|---|
| Envoyé | ✓ (`Check`) | 14 px | `--texte-tertiaire` |
| Remis | ✓✓ (`CheckCheck`) gris | 14 px | `--texte-tertiaire` |
| Lu | ✓✓ (`CheckCheck`) bleu | 14 px | `--ap-600` (`#586472`) |

Sous le dernier message envoyé, un reçu récapitulatif (10 px) affiche « Lu à HH:MM » / « Lu par N » (couleur `--ap-600`) ou « Remis » / « Remis à N » / « Envoyé » (couleur `--texte-tertiaire`).

**Citation / réponse** (en tête de bulle si le message en cite un autre). Carte `flex` (gap 8 px), `margin: 7px 8px 0` (ou `6px 6px 0` avec média), `padding: 5px 8px`, `border-radius: 6px`, `cursor: pointer` (clic = défilement vers le message d'origine). Fond `rgba(255,255,255,0.16)` (envoyé) ou `--fond-surface-2` (reçu). Une barre verticale de 3 px (`border-radius: 2px`, fond `rgba(255,255,255,0.6)` envoyé / `--ap-400` reçu) longe le bord gauche. Titre d'auteur 11 px graisse 700 ; aperçu 11 px, opacité 0,85, ellipsis, `max-width: 260px`.

**Édition en place.** Le texte est remplacé par un `<textarea>` (`min-width: 220px`, `resize: vertical`, `padding: 6px`, bordure `--bordure-normale`, `border-radius: 6px`, 13 px) suivi de boutons Annuler / Enregistrer (`flex`, gap 6 px, alignés à droite).

**Message supprimé.** Un message sans contenu visible (ni texte, ni média, ni citation, et hors édition) n'est pas rendu : il disparaît simplement du fil.

**Émoji seul (géant).** Si le message ne contient qu'un ou plusieurs emojis (sans pièce jointe ni citation), il est rendu sans bulle colorée : chaque graphème en 46 px, gap 2 px, `padding: 2px 6px`, et le chevron-menu est repositionné à `top: -2px; right: -2px`.

**Sélection multiple.** En mode sélection, une case ronde de 20 × 20 px (`border-radius: 9999px`, bordure 2 px `--ap-400`, fond `--ap-400` + coche blanche 13 px si cochée) précède (reçu) ou suit (envoyé) la bulle ; l'enveloppe sélectionnée prend un fond `color-mix(in srgb, var(--ap-400) 14%, transparent)`.

### 9.6 Barre de saisie et menu pièces jointes

Le composeur est une rangée `flex` alignée en bas (`align-items: flex-end`, gap 6 px, `padding: 12px 16px`, fond `--fond-surface`, `border-top: 1px solid var(--bordure-legere)`), masquée en mode sélection.

- **Boutons de contrôle** (emoji, stickers, pièces jointes) : 36 × 38 px, `border-radius: 9999px`, fond transparent, couleur `--texte-secondaire`, sans bordure. Les icônes mesurent ≈ 15–19 px.
- **Champ de saisie** : `flex: 1`, `min-height: 38px`, `max-height: 120px` (auto-grandissant, `resize: none`), `padding: 9px 14px`, `border-radius: 20px`, 13 px, `line-height: 1.4`, bordure `--bordure-normale`, fond `--fond-surface`. **Entrée** envoie, **Maj+Entrée** insère un saut de ligne.
- **Bouton d'action contextuel** (38 × 38 px, `border-radius: 9999px`) :
  - *Envoyer* (visible dès que le texte n'est pas vide) : fond `--ap-400`, icône 16 px blanche.
  - *Micro* (visible si le champ est vide) : fond transparent, couleur `--ap-600`, icône 19 px.

**Menu pièces jointes** (popover ouvert vers le haut, `side-offset: 8px`, aligné à gauche) : 210 px de large, `padding: 4px`, fond `--fond-surface`, bordure `--bordure-legere`, `border-radius: 10px`, ombre `0 8px 24px rgba(0,0,0,0.14)`. Trois rangées (« Photos et vidéos », « Audio », « Document ») : 100 % de large, `padding: 9px 10px`, 13 px, couleur `--texte-secondaire`, `border-radius: 7px`, gap 10 px, icône 15 px en `--ap-600`, survol `--fond-surface-2`. Les popovers d'emojis et de stickers s'ouvrent de la même manière (300–312 px de large) ; la grille de stickers est en 6 colonnes (gap 4 px, `max-height: 240px`), chaque sticker en bouton de 48 px (survol `transform: scale(1.12)`).

### 9.7 Note vocale (enregistreur et lecteur)

**Enregistreur** (remplace le composeur pendant l'enregistrement) : rangée `flex` (`align-items: center`, gap 8 px, `padding: 4px 6px`, `min-height: 38px`), de gauche à droite :

- **Corbeille** : 34 × 34 px, ronde, fond transparent, couleur `--erreur-accent`, icône 18 px (annule).
- **Point d'enregistrement** : 9 × 9 px, rond, fond `--erreur-accent`, animation `saris-rec-pulse` (1 s, opacité 1 → 0,25 → 1).
- **Onde d'amplitude** : `flex: 1`, hauteur 30 px, gap 2 px, **44 barres** ; chaque barre `flex: 1`, `max-width: 4px`, hauteur dynamique de 3 px (silence) à ~26 px (max), `border-radius: 9999px`, fond `--ap-400`, transition `height 0.08s linear`.
- **Chrono** : `M:SS`, 12,5 px, graisse 600, `tabular-nums`, `--texte-secondaire`, `min-width: 38px`, aligné à droite.
- **Bouton envoyer** : 38 × 38 px, rond, fond `--ap-400`, icône 16 px blanche (un loader `animate-spin` de 18 px s'affiche pendant l'initialisation).

**Lecteur sur bulle** : rangée `flex` (`align-items: center`, gap 9 px, largeur 250 px, `padding: 3px 2px`) :

- **Lecture / pause** : 36 × 36 px, ronde, icône 16 px. Sur bulle **envoyée** : fond `rgba(255,255,255,0.92)`, icône `--ap-600`. Sur bulle **reçue** : fond `--ap-400`, icône blanche.
- **Onde interactive** : `flex: 1`, hauteur 30 px, gap 2 px, **36 barres** ; chaque barre `flex: 1`, `max-width: 3px`, hauteur de 3 à ~24 px, `border-radius: 9999px`. Couleur des barres déjà jouées vs restantes — envoyé : blanc plein vs `rgba(255,255,255,0.42)` ; reçu : `--ap-500` vs `--bordure-forte`. Un clic sur l'onde repositionne la lecture (`onPointerDown` = seek).
- **Tête de lecture** : pastille de 10 × 10 px en `position: absolute` (gauche = fraction lue × 100 %, `transform: translate(-50%,-50%)`), fond blanc (envoyé) ou `--ap-500` (reçu), ombre `0 0 0 2px rgba(0,0,0,0.10)`.
- **Durée** : `M:SS`, 11 px, `tabular-nums`, alignée à droite, `min-width: 30px`.
- **Bouton vitesse** : visible **uniquement pendant la lecture**, hauteur 22 px, `padding: 0 7px`, `border-radius: 9999px`, 10,5 px graisse 700, `tabular-nums`. Sur envoyé : fond `rgba(255,255,255,0.22)`, texte blanc. Sur reçu : fond `--fond-surface-2`, texte `--ap-600`. Bascule « 1× » → « 1,5× » → « 2× ».

### 9.8 Réactions et sélecteur d'emoji

**Pastilles de réaction** (sous la bulle, `flex-wrap`, gap 4 px, `margin-top: 1px`) : chaque chip est en `inline-flex` (`align-items: center`, gap 4 px), hauteur 22 px, `padding: 0 7px`, `border-radius: 9999px`, 12 px. Si la réaction est celle de l'utilisateur : fond `--ap-50`, bordure 1 px `--ap-200`. Sinon : fond `--fond-surface-2`, bordure 1 px `--bordure-legere`. L'emoji est rendu en 15 px ; le compteur en 10 px graisse 600, couleur `--texte-secondaire`. Un clic bascule la réaction.

**Chevron-menu (coin de bulle)** : bouton 22 × 18 px en `position: absolute; top: 2px; right: 4px` (`-2px`/`-2px` en mode emoji géant), `border-radius: 6px`, chevron-bas 14 px. Fond `rgba(255,255,255,0.18)` (envoyé) / `--fond-surface-2` (reçu) ; couleur `rgba(255,255,255,0.95)` (envoyé) / `--texte-secondaire` (reçu). Opacité 0 au repos, 1 au survol ou menu ouvert (`transition: opacity 0.12s`).

**Popover du menu** : 248 px de large (ou auto quand le sélecteur d'emoji y est imbriqué), `padding: 0`, fond `--fond-surface`, bordure `--bordure-legere`, `border-radius: 12px`, ombre `0 8px 24px rgba(0,0,0,0.16)`, aligné côté bulle. Deux sections :

- **Réactions rapides** (`flex-wrap`, gap 2 px, `padding: 6px`, `border-bottom: 1px solid var(--bordure-legere)`) : six emojis par défaut (`👍 ❤️ 😂 😮 😢 🙏`) + jusqu'à six personnalisés + un bouton « + ». Chaque bouton 30 × 34 px, `border-radius: 7px`, fond transparent (ou `--ap-50` si déjà réagi), survol `--fond-surface-2` + `transform: scale(1.15)` (`transition: 0.08s`), emoji 22 px. Le bouton « + » : fond `--fond-surface-2`, icône « plus » 17 px, survol `--ap-50`.
- **Actions** (`padding: 4px`) : lignes 100 % de large (`flex`, gap 8 px, `padding: 7px 10px`, `border-radius: 7px`, 13 px, icône 14 px). Couleur `--texte-secondaire` (survol `--fond-surface-2`) ou `--erreur-accent` pour les actions destructives (survol `--erreur-fond`). Actions : Répondre, Copier, Détails, Sélectionner, Modifier, Supprimer.

**Sélecteur d'emoji.** Grille de 9 colonnes, bouton d'emoji 36 px, emoji 26 px, position de navigation en haut, recherche, deux lignes maximum de récents, position de teinte de peau en aperçu. Le thème suit la classe `.dark` de l'application (pas la préférence système). Les emojis sont rendus depuis une **planche d'images auto-hébergée** (`apple-64.png`), via `background-image` + `background-position` calculée en pourcentage, sans CDN externe. Tailles d'emoji selon le contexte : 15 px (réactions), 22 px (menu rapide), 26 px (sélecteur), 34 px (stickers), 46 px (emoji géant), 19 px (dans le texte).

### 9.9 Médias (album, aperçu, lecteur)

**Album en bulle.** Plusieurs médias d'un même message forment un album, dans une grille de **largeur fixe 300 px** et **gap 2 px**.

| Nombre | Disposition |
|---|---|
| 1 | Affichage naturel, jusqu'à 300 × 360 px (`object-fit: cover`). |
| 2 et 4 | Grille 2 colonnes, cellules carrées (`aspect-ratio: 1`, `cover`). |
| 3 | Grille 3 colonnes. |
| > 4 | 4 cellules ; la dernière porte un voile « +N » (fond `rgba(0,0,0,0.55)`, texte blanc 24 px graisse 700). |

Chaque vignette a un `border-radius` de 10 px et une bordure `--bordure-legere`. Un clic sur une cellule ouvre le lecteur plein-cadre.

**Cartes audio / document** (hors album, sous celui-ci). Carte 250 px (`padding: 9px`, `border-radius: 10px`, gap 10 px) : sur bulle « mienne » fond `--ap-50` / bordure `--ap-200`, sinon fond `--fond-surface` / bordure `--bordure-legere`, ombre `0 1px 2px rgba(0,0,0,0.05)`. Tuile d'icône 38 × 38 px (`border-radius: 8px`, fond `--ap-100` ou `--ap-50`, icône `--ap-600`), nom de fichier 12,5 px graisse 600 ellipsis, sous-titre 10,5 px `--texte-tertiaire`. La carte vidéo non développée fait 240 × 150 px (fond sombre `#0f172a`, bouton lecture circulaire 50 px translucide).

**Aperçu avant envoi (`MediaPreview`)** — overlay en `position: absolute; inset: 0; z-index: 60` **dans la zone de droite** (la liste reste visible), aux tokens SARIS.

- **En-tête** 56 px : bouton fermer 34 × 34 px (`border-radius: 8px`), titre 14 px graisse 600, infos 11 px `--texte-tertiaire` (taille, durée, « 1/5 fichiers »).
- **Scène** (`flex: 1`, `padding: 18px`, fond `--fond-page`) : image (`contain`, `border-radius: 12px`, ombre `0 10px 34px rgba(0,0,0,0.22)`) ; vidéo (`contain`, fond noir, `border-radius: 12px`) ; audio (cercle teal 104 px + lecteur natif 340 px + infos) ; document (icône carrée 104 px `border-radius: 20px` + nom).
- **Légende** : champ 42 px de haut, `border-radius: 9999px`, bordure `--bordure-normale`, fond `--fond-surface-2` (Entrée valide).
- **Bande de miniatures** : vignettes 56 × 56 px (`border-radius: 10px`, bordure 2,5 px — `--ap-400` active, `--erreur-accent` en erreur, sinon `--bordure-legere` ; la vignette active se relève de 2 px avec ombre), bouton « + » 56 × 56 px (bordure 1,5 px en tirets), bouton envoyer 54 × 54 px rond (`--ap-400` actif / `--fond-surface-2` inactif). Une note verte signale la compression (« compressée · X → Y ») ; une erreur rouge bloque l'envoi.
- **Rogneur vidéo (`FilmstripTrimBar`)** : pellicule sombre 58 px (`border-radius: 12px`, fond `#0b141a`) avec voiles sur les zones hors sélection, deux poignées 20 px (`--ap-400`, `cursor: ew-resize`), fenêtre de sélection déplaçable (bords `3px solid var(--ap-400)`) et tête de lecture blanche de 2 px. La timeline reste volontairement sombre même en thème clair.

**Lecteur au clic (`MediaViewer`)** — overlay `position: absolute; inset: 0; z-index: 62` dans la zone de droite. En-tête 56 px avec fermeture et **téléchargement** (boutons 34 × 34 px). Scène (`flex: 1`, `padding: 18px`, fond `--fond-page`) : image / vidéo en `contain` (`border-radius: 12px`, ombre prononcée), audio en lecteur natif 360 px, document en icône + bouton de téléchargement (`--ap-400`, texte blanc). Messages de chargement (`--texte-tertiaire`) et d'erreur (`--erreur-accent`) en 13 px avec icône 26 px.

### 9.10 Récapitulatif des composants

Cette table sert de liste de contrôle : chaque composant logique du module, son rôle visuel et ses repères dimensionnels clés.

| Composant logique | Rôle visuel | Repères clés |
|---|---|---|
| Page messagerie | Conteneur split-panel + en-tête global | colonne pleine hauteur ; en-tête `padding 16px 24px 0` |
| Séparateur redimensionnable | Ajuste la largeur des panneaux | 5 px, `col-resize`, défaut 360 px (280–560), double-clic = 360 |
| En-tête de recherche | Filtre la liste | champ 32 px, loupe 13 px à gauche, « × » à droite |
| Carte de conversation | Élément de liste (avatar, nom, aperçu, heure, badge) | `padding 10px 12px`, avatar 40 px, badge `--ap-400` |
| Kebab de carte | Menu contextuel (supprimer / quitter) | déclencheur 26 px, popover 210 px |
| En-tête de fil | Identité + présence du correspondant | verre `blur(10px)`, nom 14 px, présence 11 px |
| Séparateur de date | Repère temporel sticky | `top: 4px`, pastille 10,5 px, `blur(4px)` |
| Bulle de message | Contenu (texte/média/citation) coloré par sens | radius 12 px + coin 3 px, `max-width 74 %` |
| Métadonnées de bulle | Heure, « modifié », accusés ✓ / ✓✓ / ✓✓ bleu | 10 px ; lu = `--ap-600` |
| Carte de citation | Aperçu du message cité | barre 3 px, titre 11 px/700 |
| Bouton « descendre » | Saut en bas du fil | 38 px, `bottom 86/150px`, `z-index 5` |
| Composeur | Saisie + actions (emoji, PJ, envoi/micro) | textarea radius 20 px, boutons 36–38 px |
| Menu pièces jointes | Choix du type de média | popover 210 px, 3 rangées |
| Enregistreur vocal | Capture d'une note (corbeille, onde 44, chrono) | barres 3–26 px, point pulsant `--erreur-accent` |
| Lecteur vocal | Lecture sur bulle (onde 36, tête, vitesse) | play 36 px, tête 10 px, pilule vitesse 22 px |
| Pastille de réaction | Réaction agrégée + compteur | hauteur 22 px, pill, emoji 15 px |
| Chevron-menu + popover | Actions/réactions sur message | bouton 22 × 18 px, popover 248 px |
| Sélecteur d'emoji | Choix d'emoji (planche locale) | grille 9 col., emoji 26 px |
| Album média | Regroupement d'images/vidéos en bulle | grille 300 px, gap 2 px, « +N » au-delà de 4 |
| Carte audio / document | Pièce non visuelle en bulle | carte 250 px, tuile 38 px |
| Aperçu avant envoi | Validation + légende avant envoi | overlay zone droite, en-tête 56 px, vignettes 56 px |
| Rogneur vidéo | Extraction d'un segment | pellicule 58 px sombre, poignées 20 px `--ap-400` |
| Lecteur média | Visualisation plein-cadre au clic | overlay `z-index 62`, scène fond `--fond-page` |
| Modales (détails / suppression) | Dialogues centrés | `fixed inset 0`, voile `rgba(15,23,42,0.45)`, 340–380 px, radius 14 px |

## 10. Limites et extensions futures

L'implémentation est honnêtement bornée par les choix suivants :

- **Pas de chiffrement de bout en bout (E2EE).** Le chiffrement est au repos, côté serveur (at-rest) : le serveur déchiffre les contenus pour les restituer aux participants autorisés. Un chiffrement de bout en bout (les clés ne quittant jamais les terminaux) est une **extension future**.
- **Pas d'appels audio ou vidéo.** Le module couvre la messagerie asynchrone et les notes vocales enregistrées ; les appels en temps réel sont hors périmètre.
- **Recherche plein-texte limitée.** Le chiffrement des contenus au repos empêche une recherche plein-texte directe en base sur le corps des messages ; une recherche serveur sur le contenu chiffré n'est pas exposée.
- **Pas de transfert de message vers une autre conversation** ni d'épinglage de messages : extensions envisageables.