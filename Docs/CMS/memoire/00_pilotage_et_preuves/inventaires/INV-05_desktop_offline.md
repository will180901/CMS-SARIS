# INV-05 — Inventaire du client de bureau et du fonctionnement hors-ligne

> **Statut** : extrait · **Date d'extraction** : 2026-08-10
> **Sources** : `apps/desktop/` (Electron, installateur, scripts), `apps/api/src/modules/sync/`, `packages/types/src/sync-conflict.ts`, `apps/desktop/README.md`
> **Nature de la preuve** : `IMPLÉMENTÉ`, sauf mentions explicites en § 8.

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| Mécanismes hors-ligne | **2, de conception différente** — file de mutations rejouées côté web (§ 6), synchronisation par deltas côté poste autonome (§ 5) |
| Modes de fonctionnement du client de bureau | **2** — `remote` (client léger) et `local` (autonome, hors-ligne) |
| Modèles synchronisés | **52** sur les 88 du schéma (§ 5.2) |
| Routes de synchronisation | **14** (12 sur `SyncController`, 2 sur `SyncReadyController`) |
| Stratégie de conflit | **Last-Write-Wins** sur `updatedAt`, avec détection de concurrence par `baseUpdatedAt` |
| Propagation des suppressions | **Tombstones** (`deletedAt`), sur 47 modèles |
| Base locale | SQLite, schéma **identique** au central (88 modèles) |
| Canal temps réel | SSE « sonnette », **sans transport de données** |
| Installateur | NSIS sur-mesure, 2-en-1, par utilisateur (sans droits administrateur) |
| Mise à jour | `electron-updater` via GitHub Releases |

---

## 2. Les deux modes

### 2.1 Mode `remote` — client léger (défaut)

Le poste dialogue avec l'API centrale en HTTPS. Aucun serveur ni base embarqués. C'est l'équivalent de bureau de l'application web, avec les avantages du poste : session persistante sécurisée, mise à jour automatique, intégration Windows.

### 2.2 Mode `local` — autonome, hors-ligne d'abord

Le poste embarque en plus :

| Élément | Détail |
|---|---|
| API NestJS compilée | Processus **forké**, à l'écoute sur `127.0.0.1` **uniquement** — jamais exposé au réseau du poste |
| Base SQLite | `%APPDATA%\CMS SARIS\cms-saris.db` (+ `-wal`, `-shm`) |
| Base modèle | `seed.db` — schéma pré-migré, **aucune donnée**, copiée au premier lancement |
| Client Prisma SQLite | Livré en ressource externe (`sqlite-client`) |

Au démarrage, l'application sonde `/health/ping` pour déterminer si le central est joignable, puis bascule entre interlocuteur local et distant. La synchronisation part ensuite d'elle-même.

**Activation** : `config.json` → `{ "mode": "local", "serverUrl": "https://<central>" }`, ou variables `SARIS_MODE=local` et `SERVER_URL=…`.

### 2.3 Résolution de l'URL du serveur

Par ordre de priorité décroissante :

1. variable d'environnement `SARIS_API_URL` (déploiement piloté, GPO) ;
2. `%APPDATA%\CMS SARIS\config.json` (écran de connexion, ou menu *Fichier → Paramètres du serveur…*) ;
3. valeur figée au build (`SARIS_DEFAULT_API_URL`) ;
4. à défaut, l'écran **« Connexion au serveur »** au premier lancement.

> ⚠️ Le code exige explicitement **HTTPS en production** : une URL `http://` non-loopback ferait transiter jetons d'authentification et données patient **en clair**. À reprendre tel quel au chapitre 7 (sécurité).

---

## 3. Intégration Windows

| Élément | Emplacement / mécanisme |
|---|---|
| Origine du frontend | Schéma applicatif privilégié **`app://cms-saris`** — origine stable, autorisée en CORS côté serveur, indispensable au flux SSE |
| Installation | `%LOCALAPPDATA%\Programs\CMS SARIS` — **par utilisateur, sans droits administrateur** |
| Configuration | `%APPDATA%\CMS SARIS\config.json` |
| Secrets | `%APPDATA%\CMS SARIS\secure.bin`, chiffré **DPAPI**, lié au compte Windows |
| Base locale | `%APPDATA%\CMS SARIS\cms-saris.db` |
| Journaux | `%APPDATA%\CMS SARIS\logs\` et `backend.log` |
| Verrou d'instance | Mutex `cg.sariscongo.cms` |

### 3.1 Stockage de la session — différence Web / Desktop

| Canal | Stockage | Conséquence |
|---|---|---|
| **Web** | `sessionStorage` | Session **éphémère**, effacée à la fermeture du navigateur |
| **Desktop** | Coffre **DPAPI** (`secure.bin`) | Session **persistante** au redémarrage — « rester connecté » sécurisé, jeton jamais en clair |

C'est l'une des différences fonctionnelles Web/Desktop les plus nettes : à documenter explicitement au chapitre 8, le modèle de mémoire l'exige.

### 3.2 Installateur et désinstallation

- Installateur **NSIS sur-mesure** (`installer/cms-saris.nsi`), assistant à deux zones, double barre de progression, panneau animé, charte SARIS.
- **2-en-1** : détecte une installation existante et propose *Réinstaller* ou *Désinstaller*, sinon installe.
- **Refuse de s'exécuter si l'application tourne** (vérification du mutex) — évite de corrompre la base SQLite en verrou WAL.
- **Désinstallation sans trace** : supprime la base et ses annexes (`-wal`, `-shm`, `-journal`), les journaux, puis `%APPDATA%\CMS SARIS` et `%LOCALAPPDATA%\CMS SARIS` en entier.

> Le code avertit de ne **pas** produire l'installateur avec `electron-builder` seul : il génèrerait un assistant générique **sous le même nom de fichier**, écrasant silencieusement l'installateur sur-mesure. Anecdote de packaging utile au chapitre 8.

### 3.3 Mise à jour automatique

Canal : **GitHub Releases** (`electron-updater`). Au démarrage, vérification silencieuse ; si une version plus récente existe, une bulle apparaît au-dessus du menu utilisateur : *« Mise à jour disponible vX.Y.Z »* → **Mettre à jour** (téléchargement avec pourcentage) → **Redémarrer**. Actif uniquement en build empaqueté.

Chaîne : `electron/updater.ts` → IPC `saris:update-status` → `electron/preload.ts` (`window.saris.updates`) → `hooks/useAppUpdates.ts` → `components/layout/UpdateBubble.tsx`.

---

## 4. Architecture des fichiers desktop

| Fichier | Rôle |
|---|---|
| `electron/main.ts` | Processus principal, fenêtres, bascule connecté/autonome (`initBackend`, sonde `/health/ping`) |
| `electron/preload.ts` | Pont sécurisé `window.saris` (mises à jour, session, téléchargements) |
| `electron/config.ts` | Lecture/écriture de `config.json`, résolution du mode et de l'URL |
| `electron/backend.ts` · `backend-entry.ts` | Démarrage et supervision du processus API forké |
| `electron/db-init.ts` | Copie de `seed.db` au premier lancement, initialisation SQLite |
| `electron/sync-auth.ts` | Authentification du poste auprès du central pour la synchronisation |
| `electron/updater.ts` | Mise à jour automatique |
| `electron/server-config.html` · `sync-setup.html` | Écrans natifs de configuration (hors application React) |
| `installer/cms-saris.nsi` · `installer.nsh` · `build-installer.mjs` | Installateur NSIS sur-mesure |
| `scripts/build-local.mjs` | Pipeline complet du mode autonome (renderer → Electron → API → Prisma SQLite → `seed.db` → empaquetage) |
| `scripts/copy-renderer.mjs` · `gen-installer-*.mjs` · `strip-white-bg.mjs` | Utilitaires de build et d'habillage |

---

## 5. Le moteur de synchronisation

### 5.1 Les 14 routes

| Verbe / Chemin | Rôle |
|---|---|
| `GET /sync/pull` | Deltas du site depuis un horodatage donné, tombstones inclus, paginés |
| `POST /sync/push` | Envoi d'un lot de modifications ; réponse `applied` / `skipped` / `conflicts` |
| `POST /sync/heartbeat` | Signe de vie du poste |
| `POST /sync/poste` · `GET /sync/poste/:id` | Enregistrement et lecture d'un poste local |
| `GET /sync/status` | État de synchronisation |
| `POST /sync/run` | Déclenchement d'un cycle |
| `GET /sync/supervision` | Vue d'ensemble du parc de postes |
| `GET /sync/supervision/activite` | Activité récente |
| `GET /sync/supervision/postes/:id` · `PATCH` · `DELETE` | Détail, mise à jour et retrait d'un poste |
| `POST /sync/now` · `GET /sync/ready` | Déclenchement manuel et état de préparation (côté poste local) |

### 5.2 Les 52 modèles synchronisés et leur portée

**42 en portée globale** — chaque poste détient la totalité :

`Site` · `CategoriePatient` · `DroitCategoriePatient` · `MotifConsultation` · `PathologieReference` · `MedicamentReference` · `TypeExamen` · `EtablissementReference` · `SocieteSousTraitante` · `EmployeSaris` · `Role` · `Permission` · `PersonnelMedical` · `Utilisateur` · `RolePermission` · `UtilisateurRole` · `UtilisateurPermission` · `Patient` · `IdentitePatient` · `ContactUrgence` · `DonneesEmploi` · `ModeViePatient` · `AllergiePatient` · `AntecedentPatient` · `AlerteMedicale` · `PreSaisieMedicale` · `SuiviGrossesse` · `SuiviChronique` · `RattachementAyantDroitCdi` · `RattachementSousTraitant` · `Visite` · `ConstanteVitale` · `Consultation` · `DiagnosticConsultation` · `Ordonnance` · `LigneOrdonnance` · `BonExamen` · `LigneExamen` · `ResultatExamen` · `BonPharmacie` · `LigneBonPharmacie` · `ConsultationPrenatale` · `Evacuation`

**3 par site** : `PlanningPermutation` · `PresenceJournaliere` · `Conversation`

**7 par chemin de relation** (portée dérivée d'une entité parente) : `Site` · `DelegationPrescription` · `ConversationParticipant` · `Message` · `MessageReaction` · `MessageMasque` · `MessagePieceJointe`

> **Décision d'architecture majeure, à expliquer au chapitre 7.** Le dossier patient et tout le parcours de soin sont en portée **globale**, pas cloisonnés par site. Motif inscrit dans le code : *c'est ce qui rend la continuité cross-site possible même hors-ligne — un travailleur muté est retrouvé sur n'importe quel poste, zéro doublon.* La confidentialité reste assurée par le **verrou de dossier** du médecin chef, appliqué aussi par le backend local.
>
> C'est la réponse technique directe au problème de terrain « multi-site non synchronisé, ressaisies, divergences ».

**36 modèles ne sont pas synchronisés** : journaux d'audit et d'authentification, notifications et lectures, sessions, codes de secours, configuration TOTP, préférences, paramètres système, sauvegardes, rapports générés, alertes, et les tables de la synchronisation elle-même. Ce sont des données **locales à leur instance** — à justifier au chapitre 7, sinon l'absence paraît fortuite.

### 5.3 Résolution des conflits — logique pure, testée

Le cœur de la résolution est une fonction **sans entrée/sortie, déterministe**, réutilisée des deux côtés (PostgreSQL central et SQLite local) et couverte par un test unitaire.

| Situation | Décision |
|---|---|
| Aucun enregistrement existant | `apply` — création |
| Entrant plus récent, serveur inchangé depuis la base du client | `apply` |
| Entrant plus récent, serveur **modifié** depuis | `conflict`, gagnant = **entrant** |
| Entrant plus ancien, serveur inchangé depuis la base | `skip` |
| Entrant plus ancien, serveur **modifié** depuis | `conflict`, gagnant = **existant** |
| Horodatages strictement égaux | `skip` — renvoi idempotent |

Points structurants :

- **Jamais de blocage.** Aucun verrou distribué : impossible et non souhaitable entre machines hors-ligne. Un conflit est **tranché** puis **journalisé pour revue**, jamais mis en attente.
- **`baseUpdatedAt`** est la version sur laquelle le poste a commencé son édition. Sans elle, on retombe sur un LWW pur, sans détection fine.
- **Une suppression est une mutation comme une autre** : le tombstone porte son propre `updatedAt` et entre dans le même arbitrage.
- **`diffFields`** isole les champs réellement divergents, pour classer le conflit au journal.
- L'application d'une enveloppe fait un `upsert` **puis restaure l'horodatage source en SQL brut** — sans quoi `@updatedAt` ré-horodaterait l'enregistrement et casserait tout le raisonnement LWW.

### 5.4 Le canal temps réel « sonnette »

Le central expose un flux SSE qui **ne transporte aucune donnée** : uniquement *« il y a du neuf, et voici qui l'a produit »*. Les postes abonnés déclenchent alors une synchronisation, qui repasse par les contrôles d'accès habituels.

| Mécanisme | Raison inscrite dans le code |
|---|---|
| Canal muet | *Un canal muet ne peut pas fuiter.* |
| Filtrage par origine | Le poste à l'origine de l'écriture n'est pas réveillé pour son propre travail |
| **Battement** régulier | Un canal silencieux est coupé par les intermédiaires réseau (hébergeur, proxys d'entreprise) au bout d'une minute environ. Sans battement, 200 postes se reconnecteraient sans cesse pour zéro information |
| Battement de **type différent** de la sonnerie | Sinon le poste synchroniserait à chaque battement — on aurait réinventé l'interrogation périodique qu'on cherchait à supprimer |
| Greffe sur le flux de notifications | Les écritures faites depuis le **navigateur** branché sur le central ne passent pas par `/sync/push` : sans cela, personne ne sonnerait |

C'est un raisonnement d'ingénierie complet et défendable : il mérite une place au chapitre 7 et un diagramme de séquence dédié.

### 5.5 Purges planifiées

| Tâche | Objet |
|---|---|
| `tombstone-purge.cron.ts` | Purge des marques de suppression devenues inutiles |
| `notification-purge.cron.ts` | Purge des notifications anciennes |

---

## 6. Le hors-ligne côté WEB — un **second** mécanisme, distinct

> ⚠️ **Point capital, à ne pas confondre dans le mémoire.** CMS SARIS ne possède pas *un* mécanisme hors-ligne mais **deux**, de conception différente, qui répondent à deux contraintes différentes. Les décrire comme un seul serait une erreur factuelle.

| | **Web (PWA)** | **Desktop mode `local`** |
|---|---|---|
| Stockage local | IndexedDB, via Dexie | SQLite, via le backend NestJS embarqué |
| Lectures hors-ligne | Service worker, stratégie *réseau d'abord* avec repli sur cache | Vraies requêtes sur la base locale |
| Écritures hors-ligne | **File de mutations rejouées** | Écriture directe en base locale |
| Réconciliation | **Rejeu des requêtes HTTP** dans l'ordre | **Delta pull/push + LWW** (§ 5) |
| Autonomie réelle | Partielle : dépend du cache | Complète : le poste est un serveur |

### 6.1 Stratégie « rejeu de requêtes » (web)

- Hors connexion, **toute écriture** (POST, PATCH, PUT, DELETE) est capturée dans IndexedDB, table `file_mutations`, sous la forme `{ méthode, chemin, corps }`.
- Au retour du réseau, les mutations sont **rejouées dans l'ordre** (tri par `ordreLocal` croissant) vers les **routes réelles** de l'API.
- Conséquence de conception, explicitement revendiquée dans le code : le rejeu **réutilise toute la validation, toutes les permissions et toute la logique métier du serveur**. Il n'existe **aucun moteur d'application parallèle** côté client — donc aucun risque de divergence de règles.

**Trois garanties énoncées et vérifiables** :

| Garantie | Mécanisme |
|---|---|
| Pas de perte | Une mutation reste `PENDING` tant que le serveur n'a pas répondu 2xx, ou ne l'a pas explicitement rejetée en 4xx |
| Ordre respecté | Tri par `ordreLocal` croissant avant rejeu |
| Idempotence | Chaque mutation porte un `mutationUuid` unique |

Les lectures, elles, sont servies par le service worker ; le cycle de synchronisation se contente de signaler sa fin, et le rafraîchissement de l'affichage passe par l'invalidation du cache React Query.

Chaque mutation est classée automatiquement par **module** (patients, triage, consultations, sorties critiques, référentiels, acteurs, messagerie) et par **action** (`CREATE`, `UPDATE`, `DELETE`, `CLOSE`) — une clôture ou une annulation étant reconnue comme une transition de cycle de vie, pas comme une simple mise à jour.

### 6.2 Chiffrement de la file hors-ligne

Le corps des mutations en attente contient des données patient en clair (nom, motif, examen, conclusion). Il est donc **chiffré en AES-256-GCM dans le navigateur**.

| Contexte | Racine de confiance |
|---|---|
| **Desktop** | Clé de 32 octets conservée dans le coffre **DPAPI**, importée en clé non exportable à l'usage |
| **Web pur** | Clé AES-GCM 256 **non exportable**, générée puis persistée telle quelle dans IndexedDB — le matériel de clé n'est jamais exposé au JavaScript |

> Le code **documente lui-même la limite** du cas web : ce chiffrement protège contre l'inspection occasionnelle d'IndexedDB, pas contre un attaquant capable d'exécuter du code dans la page. Cette honnêteté doit être reprise telle quelle au chapitre 7 — c'est exactement ce qu'un jury attend.

### 6.3 Application web progressive (PWA)

| Élément | Valeur |
|---|---|
| Affichage | `standalone`, orientation portrait |
| Icônes | 192 et 512 pixels, plus une variante *maskable* |
| Pré-cache | Tout le bundle applicatif — l'application se charge **intégralement sans réseau** |
| Plafond de pré-cache relevé | 6 Mio (le sprite d'émojis ≈ 4,4 Mo et le bundle ≈ 3 Mo dépassent le défaut de 2 Mio, qui faisait échouer le build) |
| Lectures API | *Réseau d'abord*, délai réseau 5 s, repli sur le cache — 400 entrées, conservation 7 jours |
| Exclusions du cache | `/health`, `/auth`, et le flux temps réel `/notifications/stream` |
| Polices et images | *Cache d'abord puis revalidation*, 80 entrées, 30 jours |
| Navigation | Repli sur `index.html` (application à page unique), sauf `/api` et `/health` |
| Désactivation | PWA inactive en build **desktop** et en développement (évite les surprises de cache pendant le rechargement à chaud) |

### 6.4 Détection de la connectivité — une leçon de terrain

L'indicateur « En ligne / Hors ligne » **ne se fie pas** à `navigator.onLine`, qui indique seulement la présence d'un réseau, pas la joignabilité du serveur. Un ping périodique de `/health/ping` est effectué : au montage, toutes les 8 secondes, au retour du réseau et au retour du focus.

> ⚠️ Le code interdit explicitement de sonder `/health` : c'est le chemin de contrôle de santé déclaré à l'hébergeur, qui peut répondre 503 pendant une transition d'instance **alors que toutes les autres routes fonctionnent**. Incident constaté en production le **2026-07-05** : badge « Hors ligne » affiché à tort. `/health/ping` est un chemin dédié, jamais sondé par l'hébergeur.
>
> Excellent matériau pour le chapitre 8 § 8.4 (difficultés rencontrées) : le problème, le diagnostic et la correction sont tous documentés.

### 6.5 Le double jeton du mode autonome

En mode `local`, le poste parle au **central** quand il est en ligne, et à son **backend embarqué** quand il ne l'est plus. Ce sont **deux autorités d'authentification distinctes**, chacune signant ses jetons avec son propre secret : un jeton du central est rejeté par le backend local, et réciproquement.

Le poste s'authentifie donc **auprès des deux**, au moment de la connexion, quand les identifiants sont disponibles. La session conserve quatre jetons : accès et rafraîchissement pour le central, accès et rafraîchissement pour le backend local.

> Pourquoi pas simplement partager le secret du central ? Le code répond : *il finirait dans chaque installateur, extractible, et permettrait de forger des jetons pour le serveur de production.* Raisonnement de sécurité à reprendre au chapitre 7.
>
> Avant ce correctif, la bascule ne changeait que l'URL : le jeton du central partait vers le backend local, qui répondait 401 — hors-ligne, toute action tournait en boucle puis déconnectait. **Le hors-ligne ne pouvait pas fonctionner.**

---

## 7. Différences Web / Desktop — tableau de synthèse

Le modèle de mémoire exige que ces différences soient explicites (chapitre 8).

| Capacité | Web | Desktop `remote` | Desktop `local` |
|---|:---:|:---:|:---:|
| Fonctionne sans connexion | ⬜ | ⬜ | ✅ |
| Base de données embarquée | ⬜ | ⬜ | ✅ SQLite |
| Session persistante au redémarrage | ⬜ (`sessionStorage`) | ✅ DPAPI | ✅ DPAPI |
| Mise à jour automatique | ⬜ (rechargement) | ✅ | ✅ |
| Barre de titre native, intégration Windows | ⬜ | ✅ | ✅ |
| Bulle d'état de synchronisation | ⬜ | ⬜ | ✅ |
| Notifications temps réel (SSE) | ✅ | ✅ | ✅ |
| Installation requise | ⬜ | ✅ | ✅ |

---

## 8. Alimente

| Destination | Usage |
|---|---|
| Fiche UML-DEP-01 → Figure 7.7 | Diagramme de déploiement : serveur central, postes, réseau, bases |
| Fiche UML-CMP-01 → Figure 7.6 | Composants : application, backend embarqué, base locale, moteur de synchronisation |
| Fiche UML-SEQO → Figures 7.3/7.4 | Séquence objets d'un cycle de synchronisation avec conflit |
| Chapitre 7 § 7.1 | Architecture technique et justification de l'offline-first |
| Chapitre 8 § 8.1 | Environnement de déploiement, installation |
| Chapitre 8 § 8.2 | Différences Web / Desktop |
| INV-07 | Parcours « synchronisation d'un poste local » |

---

## 9. Écarts et points de vigilance

| # | Constat | Statut | Conséquence documentaire |
|---|---|---|---|
| E-01 | Le pipeline du mode autonome est décrit comme **« vérifié statiquement »** : chemins, noms de fichiers et options cohérents de bout en bout, **mais à valider par un build réel** sur la machine cible (moteurs Prisma SQLite après `asarUnpack`, démarrage effectif du processus forké, premier lancement avec copie de `seed.db`). | `PARTIELLEMENT IMPLÉMENTÉ` | **Ne pas écrire que le mode autonome est déployé et éprouvé.** Formulation exacte à retenir : implémenté et vérifié statiquement, validation d'exécution restant à faire. C'est une limite à assumer au chapitre 8 et en conclusion. |
| E-02 | La **signature de code Authenticode** est documentée comme indispensable en production médicale (SmartScreen, antivirus, refus de mise à jour non signée), mais la configuration est **préparée et commentée**, pas active. | `NON IMPLÉMENTÉ / PERSPECTIVE` | À porter en perspective de la conclusion, pas en fonctionnalité livrée. |
| E-03 | Le dépôt de publication des mises à jour est figé sur un compte GitHub personnel. | `À CONFIRMER` | Vérifier avant soutenance qu'il s'agit bien du canal de diffusion retenu ; ne pas exposer d'URL personnelle dans le mémoire. |
| E-04 | Le code signale une **validation d'exécution requise** sur la synchronisation : ordre des clés étrangères parent→enfant, chaînes de portée, liaison des dates selon le moteur. | `PARTIELLEMENT IMPLÉMENTÉ` | Doit figurer au chapitre 8 § 8.3 (tests) comme test d'intégration **prévu et non exécuté**, jamais comme réussi. |
| E-05 | 52 modèles sur 88 sont synchronisés. Le README de l'application ne donne pas ce chiffre. | — | Retenir 52 ; la liste complète est au § 5.2. |
