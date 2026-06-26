# Décision Frontend — React 19 + TypeScript + Vite + shadcn/ui

> **Statut : RÉALISÉ (as-built).** Ce document décrit la pile frontend telle qu'elle
> est réellement implémentée dans le monorepo `CMS-SARIS` (apps/web + packages/ui),
> et non un simple choix d'architecture théorique. Les versions, dépendances et
> composants listés ci-dessous sont ceux effectivement présents dans le code.

## Choix retenu

**React 19 + TypeScript (strict) + Vite 7 + shadcn/ui + Tailwind CSS v4**

Application web monopage (SPA) installable en PWA, hors-ligne d'abord, structurée par
modules métier, branchée sur une API NestJS via TanStack Query, avec un design system
maison (charte SARIS : monochrome, accents teal/or, verre poli, grain).

## Justification

### Pourquoi React 19

- L'équipe maîtrise déjà JavaScript/TypeScript : la courbe d'apprentissage est minimale.
- React est le framework le plus utilisé dans les applications médicales et de gestion.
- L'écosystème est mature : chaque problème rencontré a une solution documentée.
- Compatible PWA sans restriction.
- **React 19** est la version réellement installée (`react@19.2.4`, `react-dom@19.2.4`),
  retenue pour l'usage des hooks modernes et la compatibilité des bibliothèques récentes.

> **Piège connu (React 19)** : le survol réel d'un élément exige deux mouvements de
> souris, et un `.click()` synthétique reste inopérant sur du contenu rendu en portail
> (Radix). À garder en tête pour l'automatisation des tests d'interface.

### Pourquoi TypeScript

- Le projet manipule des données médicales sensibles (patients, prescriptions, accidents du travail).
- TypeScript force la cohérence des types à la compilation, pas à l'exécution.
- Les types partagés entre frontend et backend (package `@cms-saris/types`) ne sont possibles qu'avec TypeScript.
- À la soutenance : montrer du TypeScript bien typé valorise la rigueur technique du projet.
- Le mode **strict** est activé (`strict: true`, `noUnusedLocals`, `noUnusedParameters`,
  JSX strict) côté web ; le typecheck est intégré au build (`tsc -b && vite build`).

### Pourquoi Vite

- Démarrage à froid quasi instantané (vs plusieurs dizaines de secondes avec Webpack).
- HMR (Hot Module Replacement) immédiat pendant le développement.
- Plugin PWA officiel (`vite-plugin-pwa`) qui génère le Service Worker via Workbox.
- Intégration native de Tailwind v4 via `@tailwindcss/vite` (moteur Rust, plus de `tailwind.config.js`).
- Compatible avec shadcn/ui sans configuration supplémentaire.
- **Version réelle : Vite 7.3.2** + `@vitejs/plugin-react@5.1.x`.

### Pourquoi shadcn/ui

- Les composants sont copiés dans le projet (`packages/ui`), pas une dépendance externe figée.
- Accessibilité (ARIA) intégrée via les primitives Radix : essentiel pour une application médicale.
- Composants prêts pour les formulaires complexes : tables, dialogs, toasts, badges, alerts, drawers.
- Entièrement personnalisable avec les tokens de la charte graphique SARIS.

### Pourquoi Tailwind CSS v4

- Cohérence avec la charte graphique (tokens de couleurs définis en variables CSS).
- Pas de conflit de nommage CSS dans une application multi-modules.
- Classes utilitaires = moins de CSS à maintenir.
- **Tailwind v4** (moteur « Lightning », Rust), branché via le plugin Vite — pas de
  fichier de configuration JS, tout passe par les directives `@theme` / `@layer` dans
  `globals.css`.

### Pourquoi Zustand (état global)

- Très léger, sans boilerplate (contrairement à Redux).
- Adapté au périmètre réel : état de session, état réseau (en ligne / hors-ligne), file
  de synchronisation hors-ligne.
- **Stores réellement présents** : `session.store.ts`, `network.store.ts`, `sync.store.ts`.

### Pourquoi TanStack Query

- Cache automatique des données serveur.
- Gestion des états chargement / erreur / succès sans code répétitif.
- Compatible avec les appels REST du backend NestJS.
- Permet de basculer entre données locales (offline) et données serveur (online).
- **Pilier du temps réel** : les événements SSE déclenchent l'invalidation ciblée des
  clés de requête (voir §6) — l'interface se rafraîchit sans rechargement manuel.

---

## Dépendances réelles (telles qu'installées)

La pile frontend est répartie entre l'application `apps/web` et le design system
`packages/ui` (composants shadcn, polices, primitives UI).

### apps/web — cœur applicatif

| Domaine | Bibliothèque | Version | Rôle |
|---|---|---|---|
| Framework UI | `react` / `react-dom` | 19.2.4 | Socle de rendu |
| Build / dev server | `vite` | 7.3.2 | Bundling ESM, HMR |
| Plugin React | `@vitejs/plugin-react` | 5.1.x | JSX, fast refresh |
| Plugin PWA | `vite-plugin-pwa` | 1.3.0 | Service Worker (Workbox), manifeste |
| Plugin Tailwind | `@tailwindcss/vite` | 4.1.x | Intégration native Tailwind v4 |
| Routage | `react-router-dom` | 7.15.1 | Routage côté client (SPA) |
| Internationalisation | `react-i18next` / `i18next` | 17.0.8 / 26.3.1 | Traductions FR/EN, namespaces par module |
| État global | `zustand` | 5.0.13 | Session, réseau, file de sync |
| Données serveur | `@tanstack/react-query` | 5.100.x | Cache, fetch, invalidations |
| Tables | `@tanstack/react-table` | 8.21.3 | Logique de tableaux (tri, filtres) |
| Formulaires | `react-hook-form` | 7.76.0 | Formulaires performants |
| Validation | `zod` | 3.25.76 | Schémas typés (validation client) |
| Pont formulaire ↔ schéma | `@hookform/resolvers` | 5.2.2 | Liaison RHF + Zod |
| Base locale (offline) | `dexie` | 4.4.2 | Wrapper IndexedDB |
| Primitives UI | `radix-ui` | 1.4.3 | Composants accessibles |
| Icônes | `lucide-react` | 0.513.0 | Jeu d'icônes React |
| Dates | `date-fns` | 4.2.1 | Manipulation de dates |
| Graphiques | `recharts` | 3.8.0 | Tableau de bord (séries, KPI) |
| Sélecteur de date | `react-day-picker` | 10.0.1 | Calendriers |
| Sélecteur d'emoji | `emoji-mart` | 5.6.0 | Picker emoji (messagerie) |
| Données emoji | `@emoji-mart/data` | 1.2.1 | Jeu de données (set Apple) |
| Découpe vidéo | `@ffmpeg/ffmpeg`, `@ffmpeg/core`, `@ffmpeg/util` | ~0.12.x | Rognage vidéo côté client (WASM) |

### packages/ui — design system & composants

| Domaine | Bibliothèque | Version | Rôle |
|---|---|---|---|
| Composants | `shadcn` | 4.7.0 | Bibliothèque de composants (copiés localement) |
| Primitives headless | `@base-ui/react` | 1.4.1 | Composants non stylés |
| Primitives accessibles | `radix-ui` | 1.4.3 | Dialog, popover, dropdown… |
| Toasts | `sonner` | 2.0.7 | Notifications éphémères |
| Drawers / dialogs mobiles | `vaul` | 1.1.2 | Panneaux coulissants |
| Palette de commandes | `cmdk` | 1.1.1 | Recherche / commandes |
| Saisie OTP | `input-otp` | 1.4.2 | Code TOTP / 2FA |
| QR Code | `qrcode` | 1.5.4 | Activation TOTP (otpauth) |
| Carrousel | `embla-carousel-react` | 8.6.0 | Carrousels |
| Panneaux redimensionnables | `react-resizable-panels` | 4.11.1 | Split-panel (messagerie) |
| Thème clair/sombre | `ThemeProvider` maison (+ `next-themes` 0.4.6) | 0.4.6 | Bascule clair/sombre/auto pilotée par un provider maison (`components/theme-provider.tsx` : classe `.dark` + `prefers-color-scheme` + localStorage) ; `next-themes` n'alimente que le thème du toaster Sonner |
| Variantes de composants | `class-variance-authority` | 0.7.1 | Composition de variantes |
| Fusion de classes | `tailwind-merge` | 3.6.0 | Dédoublonnage de classes Tailwind |
| Classes conditionnelles | `clsx` | 2.1.1 | Construction de `className` |
| Animations CSS | `tw-animate-css` | 1.4.0 | Animations utilitaires |
| Couleurs | `culori` | 4.0.2 | Conversions d'espaces colorimétriques |

### Polices (`@fontsource-variable`, auto-hébergées)

| Police | Paquet | Version | Usage |
|---|---|---|---|
| Inter | `@fontsource-variable/inter` | 5.2.8 | Texte courant, sans-serif par défaut |
| Plus Jakarta Sans | `@fontsource-variable/plus-jakarta-sans` | 5.2.8 | Texte UI secondaire |
| JetBrains Mono | `@fontsource-variable/jetbrains-mono` | 5.2.8 | Contenu monospace (codes, matricules) |
| Sora | `@fontsource-variable/sora` | 5.2.8 | Titres, affichage |

> Les polices sont **auto-hébergées** (aucun CDN), cohérent avec l'exigence offline-first.

---

## Structure réelle de apps/web

L'arborescence reflète l'organisation par module métier. Tous les modules ci-dessous
sont **réellement codés** et branchés sur l'API.

```
apps/web/
├── src/
│   ├── modules/                ← Un dossier par domaine métier (tous codés)
│   │   ├── auth/               ← Authentification, login, TOTP, changement MDP
│   │   ├── dashboard/          ← Tableau de bord (KPI, séries, patients à risque)
│   │   ├── triage/             ← Accueil & file d'attente, constantes vitales
│   │   ├── patients/           ← Dossier patient (identité, allergies, antécédents…)
│   │   ├── consultation/       ← Consultation, diagnostics, ordonnances
│   │   ├── bon-examen/         ← Bons d'examen + impression A4
│   │   ├── sorties-critiques/  ← Évacuations + accidents du travail
│   │   ├── referentiels/       ← Sites, motifs, pathologies, médicaments, examens…
│   │   ├── acteurs/            ← Personnel médical, délégations, sous-traitants
│   │   ├── messagerie/         ← Messagerie interne chiffrée (split-panel)
│   │   ├── notifications/      ← Flux SSE, feed, compteur non-lus
│   │   └── admin/              ← Utilisateurs, rôles, audit, paramètres, synchronisation
│   ├── components/             ← Composants partagés (layout, print, modales transverses)
│   ├── hooks/                  ← Hooks réutilisables (useSyncEngine, useServerHealth…)
│   ├── stores/                 ← Stores Zustand (session, network, sync)
│   ├── config/                 ← labels.ts (libellés FR), navigation.config.ts
│   ├── lib/
│   │   ├── db.ts               ← Instance Dexie (base locale IndexedDB)
│   │   ├── api.ts              ← Client HTTP (fetch) + capture des mutations offline
│   │   ├── sync.ts             ← Moteur de synchronisation (file de rejeu)
│   │   ├── sounds.ts           ← Sons UI synthétisés (Web Audio, 0 fichier)
│   │   ├── geo.ts              ← Aides géolocalisation côté client
│   │   ├── userAgent.ts        ← Détection appareil (mobile/tablette/desktop)
│   │   ├── duree.ts            ← Formatage de durées
│   │   └── validation.ts       ← Validation partagée des champs (alignée DTO backend)
│   └── types/                  ← Types locaux (complétés par packages/types)
├── public/
│   ├── emoji/                  ← Sprite Apple local (apple-32 / 64) — messagerie offline
│   └── ffmpeg/                 ← Cœur ffmpeg.wasm auto-hébergé (~30 Mo)
├── vite.config.ts              ← PWA (Workbox) + Tailwind v4 + alias @
├── tsconfig*.json
└── package.json
```

> ⚠️ **Règle monorepo** : ne jamais importer en valeur `@cms-saris/types` à la racine
> côté API (crash du watcher ESM). Les libellés de la matrice de permissions passent
> par un repli frontend (`config/labels.ts`).

---

## Composants shadcn utilisés

Les composants shadcn sont copiés dans `packages/ui` (et non installés via un CDN ou
une dépendance versionnée). Le projet utilise notamment : `button`, `input`, `form`,
`card`, `badge`, `alert`, `dialog`, `drawer`, `table`, `dropdown-menu`, `tabs`,
`popover`, `tooltip`, `sonner` (toasts), `command` (cmdk), `input-otp`, ainsi qu'un
composant QR Code (kibo-ui) pour l'activation TOTP.

> La famille `pnpm` est imposée sur ce monorepo — **jamais** `npm`/`npx`/`yarn`. L'ajout
> de composants shadcn se fait via la CLI du workspace, et le code généré est commité.

---

## Design system SARIS (charte graphique)

Le design system est entièrement défini en variables CSS dans
`packages/ui/src/styles/globals.css`. Il applique une charte **monochrome à accent
teal/or**, un effet **verre poli (glassmorphisme)**, une texture de **grain**, et une
**barre latérale flottante**.

### Palette de couleurs (variables CSS)

| Catégorie | Tokens | Description |
|---|---|---|
| Primaire (monochrome) | `--ap-50` … `--ap-900` | Gris ardoise, accent teal (ap-400/500) |
| Secondaire (or) | `--as-50` … `--as-900` | Accent « Congo Gold » |
| Gris neutres | `--g-0` … `--g-900` | Gris froids (style GitHub) |
| Sémantique | `--succes-*`, `--erreur-*`, `--avert-*`, `--info-*` | États (désaturés) |
| Fonds | `--fond-page`, `--fond-surface`, `--fond-surface-2`, `--fond-input` | Page, cartes, champs |
| Texte | `--texte-primaire/secondaire/tertiaire` | Encre douce (pas de noir pur) |
| Bordures | `--bordure-legere/normale/forte` | Hiérarchie de bordures |

### Verre poli (glassmorphisme)

Variables `--glass-sidebar-bg/blur`, `--glass-card-bg/blur`, `--glass-toast-bg/blur`,
`--glass-header-bg/blur` : translucidité + flou d'arrière-plan (`backdrop-filter`) pour
la barre latérale, les cartes, les toasts et l'en-tête.

### Grain & texture

Motif de bruit fractal (SVG `feTurbulence`, basse fréquence) appliqué via les classes
utilitaires `.saris-grain` / `.saris-grain-strong`. Aucun fichier image — purement CSS/SVG.

### Typographie

Échelle de `--font-size-overline` (10px) à `--font-size-display` (28px), en passant par
les niveaux body / label / caption / h1-h4. Polices variables Inter (corps), Sora
(titres), Plus Jakarta Sans (UI secondaire), JetBrains Mono (monospace).

### Espacement, rayons, ombres

- **Espacement** : base 4px (`--espace-1` … `--espace-16`) ; mode compact (-25%) via
  `[data-densite="compact"]`.
- **Rayons** : maximum **10px** (interface fonctionnelle) — `rounded-sm` (4px) à
  `rounded-3xl` (10px).
- **Ombres** : échelle `--ombre-0` … `--ombre-5` en mode clair, **désactivées en mode
  sombre** (la hiérarchie passe par les bordures).
- **Dimensions de layout** : sidebar 240px, topbar 54px, largeur de contenu max 1100px.

### Mode sombre

Niveaux de gris inversés, tons or ajustés pour le contraste, ombres désactivées,
glassmorphisme recalibré. Le thème suit la classe `.dark` (et non l'OS) — le picker
emoji et les médias s'alignent sur ce thème pour rester cohérents.

> **Règles design strictes du projet** : variables CSS + styles inline, **0 gradient**,
> rayon ≤ 10px, patterns canoniques SARIS. Aucun sombre codé en dur.

---

## Fonctionnalités frontend réellement livrées

Toutes les fonctionnalités ci-dessous sont **codées et fonctionnelles** (écrans web +
endpoints API). Cette section remplace l'ancienne vision « MVP partiel ».

### Modules métier (tous RÉALISÉS)

| Module | Écrans web | État |
|---|---|---|
| Authentification & sécurité | LoginPage, ChangePasswordDialog, SessionBootstrap | ✅ |
| Mon compte (préférences, sessions, 2FA, CGU) | Paramètres, ConditionsModal | ✅ |
| Tableau de bord | DashboardPage (KPI, séries, patients à risque) | ✅ |
| Accueil & triage | TriagePage (file d'attente, constantes vitales) | ✅ |
| Dossier patient | PatientsPage, DossierPage (identité, allergies, antécédents, alertes, rattachements) | ✅ |
| Consultation & ordonnances | ConsultationPage, OrdonnanceCard | ✅ |
| Bon d'examen | BonExamenCard, BonExamenPrintModal | ✅ |
| Sorties critiques | SortiesCritiquesPage (évacuations + accidents du travail) | ✅ |
| Suivi chronique | intégré au dossier patient | ✅ |
| Référentiels | ReferentielsPage (sites, motifs, pathologies, médicaments, catégories, examens) | ✅ |
| Acteurs administratifs | ActeursPage (personnel, délégations, sous-traitants) | ✅ |
| Administration & gouvernance | UtilisateursPage, RolesPage, AuditPage, ParametresPage, SynchronisationPage | ✅ |
| Messagerie interne chiffrée | MessageriePage (split-panel) | ✅ |
| Notifications temps réel | intégré (hook `useNotifications`, SSE) | ✅ |
| Documents imprimables A4 | OrdonnancePrintModal, BonExamenPrintModal | ✅ |

### 1. Authentification & 2FA

Login + mot de passe, double authentification **TOTP** (saisie via `input-otp`,
activation par QR Code), gestion des sessions actives (IP, user-agent, géolocalisation),
changement de mot de passe, politique de mot de passe paramétrable.

### 2. Conditions d'utilisation (CGU)

CGU versionnées (`CGU_VERSION = v1-2026.06`). Une porte bloquante (`CguGate` dans
l'`AppShell`) impose l'acceptation au premier login et redemande l'acceptation si la
version est incrémentée. Modale dédiée (`ConditionsModal`).

### 3. Messagerie interne chiffrée (style WhatsApp)

Module complet en split-panel : conversations directes et de groupe, **chiffrement
AES-256-GCM au repos** (contenu + pièces jointes), accusés de lecture trois états,
présence « en ligne », réactions emoji (sprite **Apple local**, 0 CDN via emoji-mart),
citations/réponses, suppression à deux niveaux (« pour moi » / « pour tout le monde » sous
15 min), partage de médias (image, vidéo, audio, document) avec aperçu réel, et
**rognage vidéo côté client via ffmpeg.wasm** (cœur auto-hébergé dans `public/ffmpeg/`).

### 4. Notifications temps réel (SSE)

Flux **Server-Sent Events** (`EventSource`) branché sur `/notifications/stream`. Le hook
`useNotifications` mappe chaque événement vers une invalidation ciblée de TanStack Query
(ex. `PATIENT_CREE → ['patients'], ['dashboard']`), plus des événements « live » silencieux
(`LIVE_REFERENTIELS`, `LIVE_ACTEURS`, `LIVE_BONS_EXAMEN`, `LIVE_SYNC`) pour rafraîchir les
listes sans cloche ni son. Toasts (sonner) et sons UI pour les notifications visibles ;
badge de non-lus dans la barre latérale.

### 5. Sons UI

Six sons (succès, erreur, notification, envoyé, reçu, tap) **synthétisés via Web Audio**
(`lib/sounds.ts`) — aucun fichier audio, aucun CDN. Activation réglable et persistée.

### 6. Documents imprimables A4

Génération **côté client** (CSS print, pas de dépendance PDF serveur) des ordonnances et
bons d'examen, sur un gabarit A4 unifié, avec aperçu en modale puis impression directe.

---

## PWA & offline-first (RÉALISÉ)

L'application est une **PWA installable** fonctionnant hors-ligne.

### Service Worker & cache (Workbox)

Configuré dans `vite.config.ts` (`VitePWA`, `registerType: autoUpdate`,
`devOptions.enabled: false` — la PWA est active en build/preview, désactivée en dev pour
éviter les surprises de cache pendant le HMR).

- **App shell pré-caché** : tout le bundle (`js`, `css`, `html`, `svg`, polices, `png`,
  `ico`) — l'application se charge intégralement sans réseau.
- **NetworkFirst** (timeout 5s) pour les GET de l'API → repli sur le dernier cache connu
  (cache `saris-api-get`, 400 entrées, 7 jours). Exclut `/health`, `/auth` et le flux SSE.
- **StaleWhileRevalidate** pour polices/images (cache `saris-assets`, 80 entrées, 30 jours).
- **CacheFirst** pour `ffmpeg.wasm` (cache `saris-ffmpeg`, 180 jours) — non pré-caché car
  lourd (~30 Mo), mis en cache au premier usage.
- **navigateFallback** : `/index.html` (SPA), sauf `/api` et `/health`.
- **Manifeste** : nom « CMS SARIS — Centre médical », `display: standalone`,
  `theme_color: #4E8BA4`, `lang: fr`, icônes 192/512 (dont maskable).

### File de rejeu hors-ligne (Dexie / IndexedDB)

- `lib/db.ts` : base locale `cms-saris-db` (Dexie). Tables `file_mutations` (file de
  rejeu) et caches en lecture des référentiels / patients / visites / consultations.
- `lib/sync.ts` : moteur de synchronisation. Toute écriture (`POST/PATCH/PUT/DELETE`)
  hors-ligne est mise en file (`enqueueMutation`) avec un `mutationUuid` unique
  (idempotence) et un ordre local. Au retour en ligne, `syncPush()` rejoue les mutations
  en attente dans l'ordre, puis purge les mutations appliquées/rejetées.
- `lib/api.ts` : le client HTTP capture les écritures impossibles et les met en file
  (`OfflineQueuedError`) ; les lectures, `/auth`, `/notifications` et les `FormData` sont
  exclus de la file.
- `hooks/useSyncEngine.ts` : orchestration (sync au retour en ligne + cycle périodique
  30s + invalidations React Query). Monté une seule fois dans l'`AppShell`.
- `hooks/useServerHealth.ts` : ping `/health` (timeout 4s, intervalle 20s) +
  `navigator.onLine` → pilote le store réseau.
- **Stores Zustand** : `network.store.ts` (en ligne/hors-ligne), `sync.store.ts` (état,
  nombre en attente, dernière sync), `session.store.ts`.

> ⚠️ Le build PWA passe par `vite build` (le `pnpm build` global peut être bloqué par de
> la dette pré-existante hors périmètre frontend).

---

## Internationalisation, accessibilité, responsive (état réel)

Pour rester honnête à la soutenance, voici l'état exact de ces axes transverses.

- **Internationalisation** : l'application est **bilingue FR / EN** via
  **`react-i18next`** (configuration dans `apps/web/src/i18n/config.ts`). Le namespace
  `translation` regroupe les chaînes de base (`fr` / `en`) fusionnées avec **11 espaces de
  noms de module** (`acteurs`, `admin`, `bonExamen`, `consultation`, `dashboard`,
  `labels`, `messagerie`, `patients`, `referentiels`, `sorties`, `triage`), chacun défini
  dans `apps/web/src/i18n/locales/modules/`. Les libellés métier de `config/labels.ts`
  (`labelRole`, `labelMetier`…) ont gardé leur signature mais résolvent désormais via
  `i18n.t('labels.…', { defaultValue: humanize(code) })` (repli sur le code « humanisé »
  si la clé manque). La bascule FR/EN s'opère depuis le sélecteur de langue
  (`LanguageSwitcher`) **et est persistée sur le compte** (`PreferenceUtilisateur.langue`,
  re-appliquée au chargement par `PreferencesSync.tsx` ; repli `localStorage` clé
  `cms-saris-lang`, défaut `fr`). `lib/intl.ts` dérive le locale BCP-47 de la langue active
  (`fr → fr-FR`, `en → en-GB`) pour formater dates, heures et nombres de façon cohérente.
- **Accessibilité** : baseline ARIA fournie par Radix/shadcn (rôles, `aria-*`, fermeture
  des modales au clavier). **Pas d'audit WCAG formel** ni de tests lecteur d'écran.
- **Responsive** : l'application était au départ **100 % desktop-first** (aucune media
  query). Le socle responsive repose désormais sur un hook unique
  `apps/web/src/hooks/useMediaQuery.ts` (`matchMedia`, SSR-safe) et un jeu de
  **breakpoints partagés** (`BP`) : `mobile` (≤ 767 px), `tablet` (768–1023 px),
  `compact` (≤ 1023 px), `desktop` (≥ 1024 px) et `touch` (pointeur grossier sans survol),
  exposés via les helpers `useIsMobile` / `useIsTablet` / `useIsCompact` / `useIsTouch`.
  Adaptations réelles (≈ 15 pages couvertes) :

  | Zone | Comportement responsive |
  |---|---|
  | **Barre latérale** | Passe en **drawer** sous 768 px (bouton hamburger dans `TopHeader`, état dans `ui.store`) ; persistante au-delà. |
  | **Split-panels** (messagerie, triage, patients, consultation, rôles) | **Un seul panneau à la fois** sous 1024 px (`useIsCompact`), avec un bouton **Retour** pour revenir à la liste — au lieu des deux colonnes côte à côte du bureau. |
  | **Sidebars de détail** (dossier patient, détail de visite) | La colonne latérale repasse en **bandeau** empilé sur petit écran. |
  | **Onglets** | Rendus **scrollables** horizontalement (`overflow-x`) quand ils débordent. |
  | **Modales** | **Adaptatives** (`components/saris/Modal.tsx`) : plein écran / feuille sur mobile. |

  Le rendu a été vérifié jusqu'à 400 px de large. À noter : la détection d'appareil
  `userAgent.ts` (mobile/tablette/desktop) sert surtout à la **journalisation des sessions**,
  l'adaptation de l'interface reposant sur les media queries ci-dessus.

### Tableaux de bord par rôle

`DashboardPage.tsx` est **une page adaptative** qui sélectionne un *persona* selon le rôle
et les permissions de l'utilisateur connecté : **clinique** (soignant), **admin-medical**,
**admin-systeme** ou **agent-rh**. Chaque persona ne charge **que ses propres données** :
les hooks de données sont conditionnés par permission, et les endpoints backend
(`apps/api/src/modules/dashboard/`) sont **gardés par permission** (`JwtAuthGuard` +
`PermissionsGuard`), si bien qu'un persona ne peut récupérer que les agrégats qui le
concernent. Exemple : le cockpit **AGENT_RH** (`GET /dashboard/agent-rh`, gardé par
`personnel.read`) renvoie l'**effectif par rôle**, la **patientèle par catégorie**, les
**nouveaux dossiers sur 7 jours** et les **sociétés sous-traitantes** — données réelles
filtrées par site. La mise à jour est en temps réel : refetch React Query + invalidation
ciblée sur les événements SSE (les **6 rôles** disposent de `dashboard.read`).

---

## Tests & qualité (état réel)

- **Typecheck** : strict, intégré au build (`tsc -b && vite build`).
- **Lint / format** : ESLint (config typescript-eslint) + Prettier avec
  `prettier-plugin-tailwindcss` (tri automatique des classes).
- **Tests automatisés frontend** : non mis en place à ce stade (pas de configuration de
  test côté web). La validation s'est faite par tests manuels et E2E navigateur.

---

## Points d'attention (rappels d'exploitation)

- Le Service Worker PWA gère le cache des assets statiques **et** des GET API (NetworkFirst).
- Le cache des données métier hors-ligne et la file de rejeu reposent sur **Dexie**, pas
  uniquement sur le Service Worker.
- L'indicateur de connexion (en ligne / hors-ligne) est un store Zustand global, alimenté
  par `useServerHealth`, visible sur tous les écrans (chip dans l'en-tête).
- Le temps réel (SSE) doit rester sur **un seul onglet propre** : le pool de connexions
  SSE est limité, et plusieurs onglets de dev peuvent le saturer.

---

## Hors périmètre (extensions futures)

Conformément au cadrage projet, restent **hors périmètre** (non codés, et non attendus
dans cette version) : la gestion des **stocks** et la **délivrance physique** des
médicaments, l'intégration **CNSS / tiers payant** automatisée, et plus largement tout
flux logistique ou comptable externe au dossier médical et aux actes prescrits.
