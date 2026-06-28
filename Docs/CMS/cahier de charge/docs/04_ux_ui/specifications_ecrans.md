# Spécifications des écrans / parcours — CMS SARIS (as-built)

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document « as-built » : il décrit les écrans **réellement présents** dans le frontend React
> sous `apps/web/src/modules` et `apps/web/src/components/layout`. Chaque parcours est décrit
> écran par écran (layout, composants, états, navigation, micro-interactions, responsive,
> accessibilité). Les chiffres et règles canoniques (4 rôles, ~110 permissions, offline-first)
> proviennent du brief [[_SOURCE_systeme]] ; les exigences transverses (responsive, temps réel,
> confidentialité) sont définies dans [[exigences_non_fonctionnelles]] et référencées ici sans
> redéfinition. Les modules backend sont renvoyés via [[plan_modules]].
>
> Convention d'honnêteté : tout fait cité pointe vers un fichier de code. Les points non vérifiés
> sont marqués « à confirmer ». Aucune capture, aucun comportement n'est inventé.

---

## EU-00 — Socle de navigation (commun à tous les écrans)

Référence : `apps/web/src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `TopHeader.tsx`,
`BreadcrumbBar.tsx`.

### EU-00-01 — Coquille applicative (`AppShell`)

Layout vertical : (optionnel) `DesktopTitleBar` (barre de titre custom en client Electron) →
rangée `Sidebar` + `<main>`. Le `<main>` contient le `TopHeader`
puis la zone de routes (`<Routes>`). Marge gauche du `<main>` = largeur du **rail** de sidebar
(`SIDEBAR_RAIL = 68 px`) sur bureau, `0` sur mobile.

- **Routes protégées** : chaque route est encadrée par `PermissionGate` (permission(s) requise(s),
  ex. `/triage` → `visite.read`, `/consultations` → `consultation.read`, `/admin/acces` →
  `utilisateur.read | role.read | delegation.read`). Source : `AppShell.tsx`.
- **Page d'accueil** : `RootRedirect` redirige `/` vers la page d'accueil préférée du compte
  (`PreferenceUtilisateur.pageAccueil`) **si** elle est connue ET autorisée, sinon vers la première
  page accessible selon l'ordre `dashboard › patients › triage › consultations › referentiels ›
  admin/acces`. Garantit qu'on n'atterrit jamais sur une route inexistante (le wildcard `*` renvoie
  aussi vers `RootRedirect`). Source : `AppShell.tsx` (`HOME_PERM`, `HOME_ORDER`).
- **CGU** : `CguGate` monté en tête du `<main>` bloque l'accès tant que les Conditions d'utilisation
  ne sont pas acceptées (cf. [[exigences_non_fonctionnelles]] ENF-04-12).

### EU-00-02 — Barre latérale (`Sidebar`) + drawer mobile

Largeur : **rail replié 68 px** (icônes seules) / **déployé 264 px** (labels). Sur **bureau**, le
déploiement se fait **au survol** (`onMouseEnter`/`onMouseLeave`) ou quand le menu utilisateur est
ouvert ; sur **mobile**, la sidebar est un **drawer** plein (264 px) coulissant depuis la gauche
(`translateX`), ouvert par le hamburger du `TopHeader`, fermé par un voile sombre cliquable ou à
chaque navigation. Source : `Sidebar.tsx` (`open`, `mobileNavOpen`, `useUiStore`).

- **Structure** : en-tête (logo `/icon-192.png` + nom du site abrégé) → navigation **par groupes**
  (Clinique / Administration médicale / Administration système / Système) → footer carte utilisateur.
- **Items** : filtrés par permission via `useNavigation()` ; item actif = fond `--ap-50`, texte
  `--ap-700`, barre d'accent gauche. Replié : `title` au survol (tooltip natif) et **pastille**
  rouge sur l'icône Messagerie s'il y a des non-lus. Déployé : **badge** numérique de non-lus
  (`99+` au-delà). Source : `Sidebar.tsx` (`messagerieUnread`, `useMessagerieUnread`).
- **Footer** : carte utilisateur (avatar, login, rôle principal coloré, icône stéthoscope si
  `personnelMedicalId`) ouvrant un `Popover` (profil étendu : rôles, nombre de permissions ;
  actions « Paramètres », « Se déconnecter »). `UpdateBubble` (bulle de mise à jour desktop)
  au-dessus.
- **Indicateurs vivants montés ici** : `useServerHealth()` (ping → En ligne/Hors ligne),
  `useSyncEngine()` (rejeu hors-ligne + compteur d'attente).

### EU-00-03 — Barre supérieure (`TopHeader`)

Bandeau fin (48 px, verre poli `backdrop-filter: blur`). De gauche à droite :

- **Mobile** : bouton **hamburger** (ouvre le drawer). **Bureau** : `BreadcrumbBar` (fil d'Ariane).
- **Statut connectivité** : pastille verte « En ligne » / orange « Hors ligne » (`useNetworkStore`).
- **File de synchronisation** : pastille bleue « N en attente » ou « Synchronisation… » (icône qui
  tourne) **uniquement** si `pendingCount > 0` ou sync en cours (`useSyncStore`).
- **Rideau de confidentialité** : interrupteur (`role="switch"` + `aria-checked`) qui bascule le
  flou global des zones cliniques (cf. EU-00-05).
- **Cloche notifications** : ouvre `NotificationDrawer` ; **point vert clignotant** (keyframes
  `saris-notif-blink`) si non-lus > 0. Source : `TopHeader.tsx`.
- Le flux temps réel SSE est monté **une seule fois** ici (`useNotificationStream`), de même que
  la bascule online-first desktop (`useApiEndpointSwitch`). Cf. [[exigences_non_fonctionnelles]]
  ENF-09.

### EU-00-04 — Fil d'Ariane + avant/arrière (`BreadcrumbBar`)

Masqué sur mobile. Composé de : flèches **◀ Précédent / ▶ Suivant** (rejouent l'historique via
`navigate(-1)` / `navigate(1)`, activées selon `index`/`length` du `navStack.store` — RR n'exposant
pas `canGoForward`) + **fil d'Ariane cliquable** `🏠 › Section ›
Détail`. Particularités :

- Un crumn n'est **cliquable** que s'il pointe vers une route connue (`KNOWN_ROUTES`).
- Les identifiants cuid/uuid sont **masqués** : un segment id sous `/patients/` affiche le **nom du
  patient** (lu dans le cache React Query via `usePatientDossier`, repli « Dossier »), sinon
  « Détail ». Source : `BreadcrumbBar.tsx` (`ID_RE`, `PatientCrumb`). → Accessibilité « public peu
  IT » : aucun code technique brut affiché.

### EU-00-05 — Rideau de confidentialité (`PrivacyCurtain`)

Enveloppe les zones de détail clinique (triage, consultation, messagerie). Voile **verre poli +
grain** (`backdrop-filter: blur(9px)`) **visible en permanence**, se dissipant **au survol**
(`onMouseEnter`/`onMouseLeave`, transition 0.28 s) avec un indice discret « masqué ». Piloté par
`privacy.store` (défaut activé). **Neutralisé sur tactile** (`useIsTouch` — pas de survol fiable).
Source : `PrivacyCurtain.tsx`. Cf. [[exigences_non_fonctionnelles]] ENF-05-04.

### EU-00-06 — Patterns transverses

- **Mémoire d'état par page** : `usePersistedState(pageKey, key, initial)` (drop-in `useState`
  persistant en `sessionStorage`) conserve filtres, recherche, onglet actif, sélection et largeur
  de panneau d'une page à l'autre. Branché sur Triage, Consultation, Dossier, Accès.
  Source : `apps/web/src/hooks/usePersistedState`.
- **Responsive** : `useIsMobile` / `useIsCompact` / `useIsTouch` (`useMediaQuery`). Sous le seuil
  compact (1024 px, cf. ENF-07-01), les **split-panels s'empilent** (un seul panneau visible, bouton
  Retour). Le redimensionnement des panneaux (poignée `col-resize`) est **désactivé** en compact.
- **i18n** : tous les libellés via `react-i18next` (FR/EN), cf. ENF-06.
- **États standardisés** : `EmptyState`, `Skeleton`, `StatusPill`, `Modal` du design system SARIS
  (`@/components/saris`).

---

## EU-01 — Parcours (a) : Accueil / Triage → file → nouvelle visite

Module backend : [[plan_modules]] (`TriageModule`). Écran : `modules/triage/pages/TriagePage.tsx`.

### EU-01-01 — Layout

Page plein écran à **deux colonnes** (split panel) :

1. **En-tête** : icône + titre « Triage », **horloge live** (`LiveClock`, re-render isolé chaque
   seconde) + compteur de visites affichées ; bouton **« Nouvelle visite »** (visible si
   `visite.create`).
2. **Panneau gauche (file)** : largeur **redimensionnable** (poignée `col-resize`, 280–620 px,
   double-clic = reset 380 px, persistée). Contient :
   - barre **recherche** (nom / numéro patient / motif) + bouton **Filtres** (popover : soignant
     assigné, motif principal, tri par heure d'arrivée) avec badge de compte de filtres actifs ;
   - **onglets de statut** toujours visibles (`role="tablist"`) : Actives / Clôturées / Annulées,
     chacun avec son **compteur** (chargés en parallèle, indépendants du filtre courant) ;
   - **liste scrollable** de `QueueCard`. Tri **par heure d'arrivée** (file par ordre d'arrivée,
     **pas de priorité**) ; les visites `EN_COURS` restent
     épinglées en tête.
3. **Panneau droit** : `VisiteDetail` (sous `PrivacyCurtain`), ou panneau de création, ou état vide.

### EU-01-02 — États

- **Chargement** : skeleton de 6 lignes (avatar + 2 barres + pastille) dans la file.
- **Vide (sans filtre)** : icône `ClipboardList` + « Aucune visite [statut] » + bouton « Voir toutes »
  (si filtre ≠ Actives) ou « Première visite » (si `visite.create`).
- **Vide (avec filtre)** : icône recherche + « Aucun résultat » + nombre de visites de l'onglet +
  bouton « Réinitialiser les filtres ».
- **Hors-ligne** : la création reste possible (mutation mise en file IndexedDB chiffrée, cf.
  [[exigences_non_fonctionnelles]] ENF-01) ; le bandeau global du `TopHeader` signale l'attente.

### EU-01-03 — Nouvelle visite (`NouvelleVisitePanel`)

Ouvert **inline** dans le panneau droit (pas une modale). Bascule `creating` qui **désélectionne**
la visite courante. Au succès, sélectionne la visite créée. Le triage **rattache à un patient
existant** (déduplication) avant d'ouvrir la visite (contrat C-1 de [[plan_modules]]). Source :
`components/NouvelleVisiteDrawer.tsx`, `SoignantPickerModal.tsx`, `ConstantesForm.tsx`.

### EU-01-04 — Navigation / responsive / micro-interactions

- **Compact** : un seul panneau à la fois. La file est masquée dès qu'un détail ou une création est
  ouvert ; bouton **« ◀ Retour à la file »** en tête du détail. Pas d'auto-sélection en compact.
- **Bureau** : auto-sélection de la première visite `EN_COURS` (sinon la première de la liste).
  Désélection automatique si l'item disparaît de la liste filtrée.
- **Micro-interactions** : survol des items de la file ; poignée de resize qui se colore à la
  saisie ; pastille `X` pour vider la recherche.
- **Mémoire d'état** : `filter`, `selectedId`, `search`, filtres avancés, `sortOrder`, `queueWidth`
  persistés par `usePersistedState('triage', …)`.

---

## EU-02 — Parcours (b) : Consultation pilotée par la décision → documents

Module backend : [[plan_modules]] (`ConsultationModule`). Écrans :
`modules/consultation/pages/ConsultationPage.tsx`, `components/ConsultationDetail.tsx`.

### EU-02-01 — Layout (liste + détail)

Split panel identique au triage : **file consultations** (largeur 240–480 px, resize **accessible
clavier** — `role="separator"`, flèches/Home/End, cf. EU-07) | **détail**. En-tête de file : titre,
compteur de consultations ouvertes, recherche, bouton **Filtres** (statut : Actives / Clôturées /
Annulées, chargement paresseux des listes non actives). Source : `ConsultationPage.tsx`.

- **Ouverture contextuelle** : une consultation peut être ouverte depuis le triage ou le dossier via
  `navigate(state.openConsultationId)` ; la page récupère son statut réel pour **positionner le bon
  filtre** (sinon une consultation clôturée resterait invisible). Un `state.openDocView` permet
  d'ouvrir directement une vue document précise. Source : `ConsultationPage.tsx`.

### EU-02-02 — Détail : parcours en 3 étapes (`ConsultationDetail`)

`PatientContextRail` (contexte patient, à gauche) + zone principale avec un **stepper** :

1. **Examen & diagnostic** (`ExamenSection` + `DiagnosticsCard`) — badge = nb diagnostics.
2. **Documents** — onglets internes `ordonnance | examens-c | sorties` ; badge = total ordonnances +
   bons d'examen + sortie. Les cartes d'édition (`OrdonnanceCard`, examens, évacuation) et leur
   **aperçu A4 intégré** s'affichent dans la zone de droite (cf. ENF-08-02).
3. **Décision médicale** (`DecisionSection`) — badge « fait » si décision posée.

**Pilotage par la décision** (`DECISIONS`) : `CLOTURE_SIMPLE`, `PRESCRIPTION`,
`EXAMEN_COMPLEMENTAIRE`, `EVACUATION`. Choisir une décision **bascule automatiquement** sur la vue
document correspondante (`docViewForDecision` : prescription→ordonnance, examen→examens-c,
évacuation→sorties). Source : `ConsultationDetail.tsx`.

**Clôture guidée** : la clôture est **bloquée** tant que les pré-requis de la décision ne sont pas
réunis (`blockers`) — ex. décision `PRESCRIPTION` sans ordonnance VALIDÉE, `EXAMEN_COMPLEMENTAIRE`
sans bon d'examen, `EVACUATION` sans évacuation active. Les blocages sont **affichés** avant le
bouton « Clôturer ».

### EU-02-03 — États

- **Chargement** : message « … » centré.
- **Erreur / introuvable** : message en couleur d'erreur (`consultation.notFound`).
- **Verrou souple** : si la consultation est déjà **prise en charge par un autre soignant**, bandeau
  d'avertissement (nom + depuis quand) avec bouton **« Reprendre »** ; les sections passent en
  lecture seule (`heldByOther`). Source : `ConsultationDetail.tsx`.
- **Vide (aucune sélection)** : `EmptyState` stéthoscope « Sélectionnez une consultation ».
- **Hors-ligne** : mutations mises en file (ENF-01).

### EU-02-04 — Navigation / responsive

- **Compact** : un panneau à la fois ; bouton « Retour » pastillé. Le détail passe en colonne
  (rail patient empilé). Stepper en scroll horizontal si trop étroit.
- **Mémoire d'état** : `filter`, `selectedId`, `search`, `queueWidth` (`usePersistedState
  ('consultation', …)`).

---

## EU-03 — Parcours (c) : Dossier patient (onglets, verrou, timeline)

Module backend : [[plan_modules]] (`PatientModule`). Écran :
`modules/patients/pages/DossierPage.tsx` (+ `components/dossier/*`).

### EU-03-01 — Layout

1. **Barre de navigation** : retour « Patients », nom du patient (ou numéro), `CategorieBadge`,
   badge **« Verrouillé »** si applicable, badge de statut (Archivé / Décédé), menu kebab
   (`MoreVertical`).
2. **Sidebar patient** (`DossierSidebar`, 268 px fixe / bandeau empilé en compact) : avatar +
   identité + catégorie ; sections Site/Statut, Contact d'urgence, compteurs (allergies actives,
   alertes médicales, antécédents — **danger** colorés si gravité), rattachements actifs ; bouton
   « Changer de catégorie ».
3. **Contenu principal** : bannières d'alerte + **onglets** (`SegmentedTabs`) + contenu de l'onglet.

### EU-03-02 — Onglets (`TABS`)

Identité · Alertes · Antécédents · Rattachements · **Chronologie** (timeline) · Consultations ·
Constantes · Documents · Historique (catégorie). Les onglets **cliniques** (Consultations,
Documents) sont **masqués** aux profils sans `consultation.read`. Badges de compte sur Alertes /
Antécédents / Rattachements. Source : `DossierPage.tsx` (`TABS`, filtrage `canViewClinique`).

- **Chronologie / Timeline** (`TimelineTab`) : fil chronologique des événements du dossier.
- **Bannières automatiques** : `AlerteBanner` (allergies sévères / alertes critiques) +
  `AlertesCliniquesBanner` (alertes **calculées** : interaction allergie↔médicament, constantes,
  chronique — `usePatientAlertesCliniques`, visible si lecture clinique).

### EU-03-03 — Verrou de confidentialité

- **Pose / retrait** : entrée kebab visible si `patient.lock` (médecin-chef) → `Modal` de
  verrouillage/déverrouillage avec **motif optionnel** (`Textarea`, 300 car.). Source :
  `DossierPage.tsx` (`showLock`, `setVerrou`).
- **Lecture d'un dossier verrouillé** : seuls **supervision** (`ADMIN_SYSTEME` / `MEDECIN_CHEF`)
  voient le contenu. Pour les autres, `lockedForMe` affiche `LockedDossier` : écran verre poli,
  cadenas, message « Dossier verrouillé » + motif. Cf. [[exigences_non_fonctionnelles]] ENF-05-03.

### EU-03-04 — États & actions

- **Chargement** : « Chargement du dossier… » centré.
- **Introuvable** : « Dossier introuvable » + bouton « Retour à la liste ».
- **Kebab** : Modifier l'identité, **Imprimer la synthèse** (`DossierPrintModal`, PDF A4),
  Changer de catégorie (si `patient.change_category`), Verrouiller/Déverrouiller (si `patient.lock`),
  Archiver/Réactiver (si `patient.archive` — `Modal` de confirmation), Supprimer (si `patient.delete`
  — `ConfirmDeleteModal` irréversible). Toutes les confirmations destructives passent par une modale.

### EU-03-05 — Responsive

Compact : sidebar empilée en bandeau pleine largeur, **un seul scroll** délégué au corps ; onglets en
scroll horizontal. Source : `DossierPage.tsx` (`isCompact`). **Mémoire d'état** : onglet actif
persisté (`usePersistedState('dossier', 'activeTab', …)`).

---

## EU-04 — Parcours (d) : Messagerie (split-panel façon WhatsApp Web)

Module backend : [[plan_modules]] (`MessagerieModule`). Écran :
`modules/messagerie/pages/MessageriePage.tsx` (+ `MessageThread`, `ConversationCard`, médias).

### EU-04-01 — Layout

Split panel : **liste des conversations** (gauche, largeur 280–560 px redimensionnable) | **fil**
(`MessageThread`, sous `PrivacyCurtain`). En-tête : titre, **horloge live**, mention **« Chiffré »**
(cadenas), compteur de non-lus, bouton **« Nouveau message »** (popover `NewConversationPanel` :
bascule **Direct** / **Groupe**, recherche d'agents, sélection multiple, création de groupe avec
titre). Source : `MessageriePage.tsx`.

- **Liste** : recherche par titre ; `ConversationCard` (sélection, kebab « supprimer / quitter »).
- **Fil** : bulles façon WhatsApp (réactions emoji Apple, accusés 3 états ✓/✓✓/✓✓ bleu, présence,
  médias en album, notes vocales, rogneur vidéo, aperçu **dans la zone de droite uniquement**).
  Détail technique complet dans la spécification du module de messagerie — non recopié ici.

### EU-04-02 — États

- **Chargement** : « Chargement… » centré.
- **Vide (liste)** : icône `MessageSquare` + « Aucune conversation » + invite à démarrer.
- **Vide (fil)** : `EmptyThread` (icône + invite + note « chiffré » + bouton « Nouveau message »).
- **Suppression / quitter groupe** : modale de confirmation **portalée** (`createPortal`,
  `role="dialog" aria-modal`), toasts « Conversation supprimée » / « Groupe quitté ».
- **Hors-ligne** : envoi mis en file ; les erreurs non « offline » remontent en toast (`isOfflineQueued`).
- **Cloisonnement par site** + temps réel SSE : cf. [[plan_modules]] et ENF-09.

### EU-04-03 — Navigation / responsive

- **Ouverture par URL** : paramètre `?c=<id>` sélectionne la conversation (`useSearchParams`).
- **Compact** : un panneau à la fois ; la liste est masquée quand un fil est ouvert, bouton **Retour**
  passé au `MessageThread` (`onBack`). Pas d'auto-sélection en compact.
- **Bureau** : auto-sélection de la première conversation. Poignée de resize (double-clic = 360 px).

---

## EU-05 — Parcours (e) : Accès & habilitations

Module backend : [[plan_modules]] (`AdminModule`, `PersonnelModule`). Écran :
`modules/admin/pages/AccesPage.tsx`. Route `/admin/acces` (les anciennes `/admin/utilisateurs` et
`/admin/roles` y **redirigent**).

### EU-05-01 — Layout

**Un seul corps unifié** : en-tête « Accès & habilitations » (icône `ShieldCheck`) + `SegmentedTabs`
intégrés. Les onglets sont **filtrés par permission** :

- **Utilisateurs** (si `utilisateur.read`) → `UtilisateursPage embedded`.
- **Rôles & permissions** (si `role.read`) → `RolesPage embedded`.
- **Personnel soignant** (si `personnel.read`) → `PersonnelSoignantTab` (création/édition/suppression
  selon `personnel.*`).
- **Délégations** (si `delegation.read`) → `DelegationsTab` (le médecin-chef gère ici ses
  délégations ; actions selon `delegation.create|update|revoke|delete`).

Les pages embarquées rendent leur **gros en-tête masqué** (mode `embedded`) — l'en-tête + onglets
unifiés le remplacent. Source : `AccesPage.tsx`.

### EU-05-02 — Composants & états

- **Utilisateurs** : `CreerUtilisateurDrawer`, `UtilisateurDrawer`, `ResetPasswordDialog`
  (récupération de compte, sessions, déconnexion forcée — cf. ENF-04-02/03).
- **Rôles** : éditeur de rôle (matrice de ~110 permissions) ; codes techniques **humanisés** pour
  l'affichage, zone d'édition soumise au rideau de confidentialité.
- Les états de liste (chargement / vide) reposent sur les composants du module Référentiels
  (`EmptyState`, `SkeletonRows`, `PaginationBar`). **À confirmer** au niveau micro-copie par onglet.

### EU-05-03 — Navigation / responsive

Onglet actif persisté (`usePersistedState('acces', 'tab', …)`) ; si l'onglet mémorisé n'est plus
autorisé, repli sur le premier disponible. En **compact**, le corps passe en scroll (`overflow:auto`).

---

## EU-06 — Parcours (f) : Synchronisation

Module backend : [[plan_modules]] (`SyncModule`, `AdminModule`). Écran :
`modules/admin/pages/SynchronisationPage.tsx`. Route `/synchronisation` (`synchronisation.read`).

### EU-06-01 — Layout

`PageHeader` (icône `RefreshCw`, action « Lancer une sauvegarde » si `synchronisation.execute`) +
`SegmentedTabs` regroupant **quatre zones** :

1. **Supervision** (`SupervisionZone` + `DataSyncZone`) : postes synchronisés (en ligne/hors ligne,
   dernière synchro), activité récente (journaux), conflits ; badge **« LIVE »** (temps réel). +
   synchronisation des données mode local (état serveur joignable, dernier pull/push, bouton
   « Forcer la synchronisation »).
2. **Terrain** (`SyncTerrainZone`) : bandeau d'état (En ligne/Hors ligne, en attente, dernière
   synchro, **Service Worker** actif/inactif) + **file de rejeu IndexedDB** (mutations PENDING/SENT/
   APPLIED/REJECTED/CONFLICT) avec actions « Réessayer les rejetées » / « Purger les rejetées ».
3. **Sauvegardes** (`SauvegardesZone`) : planification automatique (cron quotidien + rétention),
   dernière sauvegarde mise en avant, historique, **restauration** non destructive (si
   `synchronisation.restore`, `Modal` de confirmation). Cf. ENF-03-03.
4. **Volumétrie** (`VolumetrieZone`) : compteurs par module (icônes) + journaux audit /
   authentifications.

### EU-06-02 — États

- **Chargement** : `Skeleton` (grilles de cartes / lignes).
- **Vide** : `EmptyState` par section (« Aucun poste », « Aucune activité », « Aucun conflit »
  célébré par une coche, « File de rejeu vide », « Aucune sauvegarde » + bouton « Première
  sauvegarde »).
- **Erreur de synchro** : bandeau rouge `errorMessage` (`useSyncStore`).
- **Hors-ligne** : la zone Terrain reflète l'état réel ; le bouton « Forcer » est désactivé hors-ligne.

### EU-06-03 — Micro-interactions / codes lisibles

Statuts traduits via `StatusPill` (tons success/info/warning/error) ; **modules et actions
humanisés** (`labelModule`, `labelAction`, `humanizeCode`) — pas de code brut UPPER_SNAKE affiché au
public peu IT. Relatif temporel localisé (`relative()`). Tailles d'octets formatées
(`formatTaille`). **Limite connue** : certaines micro-copies des zones Terrain/Volumétrie/Sauvegardes
restent partiellement non traduites (cf. ENF-06-03, « à confirmer »).

---

## EU-07 — Accessibilité (transverse)

- **Clavier** : la poignée de redimensionnement de la file consultation est **focusable**
  (`role="separator"`, `tabIndex=0`, flèches/Home/End ajustent la largeur) — source
  `ConsultationPage.tsx`. Le redimensionnement triage/messagerie est souris uniquement (**à
  confirmer** pour le clavier).
- **ARIA** : interrupteur du rideau `role="switch"` + `aria-checked` ; onglets de statut triage
  `role="tablist"` / `role="tab"` + `aria-selected` ; modales `role="dialog" aria-modal`. Cf.
  ENF-07-02.
- **Codes masqués (public peu IT)** : identifiants jamais affichés bruts (fil d'Ariane → nom patient
  ou « Détail » ; référentiels/sync humanisés).
- **Contraste & conformité WCAG 2.1 AA** : couverts **partiellement** par le design system ;
  conformité formelle **non auditée — à confirmer** (cf. ENF-07-03).
- **Limite connue** : `DATA_TABLE_CARD` non adapté au responsive (sticky), cf. ENF-07-04.

---

## Traçabilité

| Parcours | Module ([[plan_modules]]) | Écran (code) | ENF liées |
| --- | --- | --- | --- |
| Socle navigation | (transverse) | `components/layout/*`, `PrivacyCurtain.tsx` | ENF-05, ENF-07, ENF-09 |
| (a) Triage | `TriageModule` | `modules/triage/pages/TriagePage.tsx` | ENF-01, ENF-07 |
| (b) Consultation | `ConsultationModule` | `modules/consultation/pages/ConsultationPage.tsx`, `ConsultationDetail.tsx` | ENF-05, ENF-08 |
| (c) Dossier | `PatientModule` | `modules/patients/pages/DossierPage.tsx` | ENF-05 (verrou) |
| (d) Messagerie | `MessagerieModule` | `modules/messagerie/pages/MessageriePage.tsx` | ENF-04-05, ENF-09 |
| (e) Accès | `AdminModule`, `PersonnelModule` | `modules/admin/pages/AccesPage.tsx` | ENF-04, ENF-05-05 |
| (f) Synchronisation | `SyncModule`, `AdminModule` | `modules/admin/pages/SynchronisationPage.tsx` | ENF-01, ENF-03 |

> Renvois : [[_SOURCE_systeme]] (vérité canonique), [[plan_modules]] (modules backend),
> [[exigences_non_fonctionnelles]] (ENF). Toute valeur « à confirmer » doit être levée avant la v1.0
> finale.
