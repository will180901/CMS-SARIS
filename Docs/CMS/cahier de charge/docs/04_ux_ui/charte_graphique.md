# Charte graphique / Design system SARIS — CMS SARIS (as-built)

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Ce document **synthétise** la charte graphique « as-built » du design system SARIS telle
> qu'**implémentée** dans le code (le système est développé et déployé). Il ne recopie pas les
> 12 fiches HTML de référence : il en donne l'essentiel utile au cahier des charges et **renvoie**
> à la charte source pour le détail. Toute valeur citée provient du code ou des fiches ; les points
> non vérifiés sont marqués « à confirmer ».
>
> **Source de vérité visuelle (code)** : `packages/ui/src/styles/globals.css` (jetons CSS, mode
> clair/sombre, base) et `apps/web/src/components/saris/*` (composants canoniques).
> **Charte source (référence détaillée)** : `Docs/CMS/charte graphique/` — 12 fiches HTML
> autonomes **CG-01** à **CG-12** + `README.md`.
> Chiffres canoniques et stack : [[_SOURCE_systeme]]. Exigences liées : [[exigences_non_fonctionnelles]]
> (ENF-05 confidentialité, ENF-07 accessibilité/responsive, ENF-08 documents A4). Plan : [[plan_modules]].

---

## UI-01 — Principes du design system SARIS

Le design system SARIS repose sur un ensemble de **règles strictes** (l'utilisateur a explicitement
exigé leur respect). Les règles ci-dessous sont **as-built**.

- **UI-01-01 — Jetons CSS uniquement.** Les couleurs, espacements et arrondis passent par des
  **variables CSS** (`var(--…)`) définies dans `:root` / `.dark` de
  `packages/ui/src/styles/globals.css`. Jamais de hex codé en dur dans les composants (exception
  historique : bandeau d'alerte critique). Les jetons sont aussi exposés en classes Tailwind via
  `@theme inline`.
- **UI-01-02 — Style `inline` plutôt que `className` Tailwind.** Les composants applicatifs sont
  stylés via `style={{ … }}` consommant les jetons CSS (cf. tous les composants `saris/*`). Tailwind
  reste utilisé pour les rares cas structurels (ex. `animate-spin`).
- **UI-01-03 — Aucun dégradé.** Règle absolue : ni `linear-gradient`, ni `radial-gradient` dans
  l'interface fonctionnelle. **Seule exception** : les graphiques en courbes (aires de
  `apps/web/src/components/saris/Charts.tsx`). Cf. fiche [`CG-04_Effets_de_Surface`].
- **UI-01-04 — Arrondis ≤ 10 px.** Échelle bornée : `--radius-sm 4px` (badges/tags),
  `--radius-md 6px` (boutons/inputs), `--radius-lg 8px` (cartes/alertes/tooltips),
  `--radius-xl 10px` (panneaux/modales). `2xl`/`3xl`/`4xl` sont **plafonnés à 10 px**. Pas de
  `rounded-full` sauf pills et avatars. Référence : `@theme inline` (`--radius-*`).
- **UI-01-05 — Grain + verre poli.** Texture de **grain** (bruit fractal SVG, `--grain-url`) posée
  en `background-blend-mode` sur le `body` et via la classe `.saris-grain` (peu coûteux, par
  élément ; désactivé en `prefers-contrast: more`). **Glassmorphisme** (`.saris-glass`,
  `--verre-fond` + `backdrop-filter: blur`) pour sidebar/header/toasts/cartes. Cf. [`CG-04`].
- **UI-01-06 — Encre douce, jamais de noir pur.** Texte primaire `#242B34` (clair) ; les surfaces
  et bordures restent en gris froids bleutés. Cf. [`CG-01`].
- **UI-01-07 — Mode clair / sombre.** Bascule par classe `.dark` (`@custom-variant dark`). En mode
  sombre les **ombres sont désactivées** (la hiérarchie passe par les bordures).
- **UI-01-08 — Densité réglable.** Attribut `data-densite="compact"` réduit l'échelle d'espacement
  (~25 %) sans toucher la typographie (préférence utilisateur).
- **UI-01-09 — Français + bilingue.** Tout libellé UI est en français par défaut, traduit FR/EN
  (cf. [[exigences_non_fonctionnelles]] ENF-06).

## UI-02 — Palette de couleurs

Définie dans `globals.css`. Identité de marque issue du logo SARIS Congo (fiche [`CG-01`]).

- **UI-02-01 — Accent primaire « teal SARIS » (Bleu ardoise).** Échelle `--ap-50 … --ap-900`.
  Particularité as-built : la palette primaire est **monochrome gris froid**, **seuls `--ap-400`
  (`#4E8BA4`) et `--ap-500` (`#3D7A92`) restent teal**, réservés aux **boutons / CTA**. Raccourci
  `--couleur-accent` = `--ap-400`. Fond d'accent `--ap-50`, hover `--ap-500`.
- **UI-02-02 — Accent secondaire « Or Congo ».** Échelle `--as-50 … --as-900` (`--as-400 #C99A2E`).
  Usage accentuation/distinction (ex. ton `gold` du StatusPill, chart-2).
- **UI-02-03 — Gris froids.** Échelle `--g-0 … --g-900` (style GitHub) + surfaces dérivées
  `--fond-page`, `--fond-surface`, `--fond-surface-2`, `--fond-input`.
- **UI-02-04 — Couleurs sémantiques** (chacune en `fond` / `texte` / `accent` / `bordure`,
  désaturées) :
  - **Succès** : `--succes-fond #EAF3EC` / `--succes-texte #2D6A3F` / `--succes-accent #3D7A5E`.
  - **Erreur** : `--erreur-fond #F5EAEA` / `--erreur-texte #7A2E2E` / `--erreur-accent #9B4444`.
  - **Avertissement** : `--avert-fond #F5EEDF` / `--avert-texte #6B4D1A` / `--avert-accent #8A6A2A`.
  - **Info** : `--info-fond #E6EFF5` / `--info-texte #2A4F6B` / `--info-accent #3A6080`.
- **UI-02-05 — Textes & bordures.** `--texte-primaire / -secondaire / -tertiaire` ;
  `--bordure-legere / -normale / -forte` (rgba sur slate). Ombres `--ombre-0 … --ombre-5`
  (clair uniquement).

## UI-03 — Typographie

Définie dans `@theme inline` et `@layer base` de `globals.css`. Fiche [`CG-02`].

- **UI-03-01 — Familles.** Corps `--font-sans` = **Plus Jakarta Sans** (repli Inter) ; titres
  `--font-heading` = **Sora** (700, `letter-spacing -0.015em`, appliqué à `h1…h6`/`.saris-heading`) ;
  mono `--font-mono` = **JetBrains Mono**. Polices auto-hébergées (`@fontsource-variable/*`).
- **UI-03-02 — Échelle (11 niveaux).** `--font-size-display 28` · `h1 22` · `h2 18` · `h3 16` ·
  `h4 14` · `body-lg 15` · `body 14` (défaut, `line-height 1.6`) · `body-sm 13` · `label 12` ·
  `caption 11` · `overline 10`.
- **UI-03-03 — Lissage.** Antialiasing activé (`-webkit-font-smoothing: antialiased`).

## UI-04 — Espacements, layout & grilles

Fiche [`CG-03`]. Base **4 px**, multiples stricts (jamais 5/7/11/13…).

- **UI-04-01 — Échelle d'espacement.** `--espace-px 2` · `--espace-1 4` … `--espace-16 64`
  (1→4, 2→8, 3→12, 4→16, 5→20, 6→24, 7→28, 8→32, 10→40, 12→48, 14→56, 16→64).
- **UI-04-02 — Layout.** `--layout-sidebar-width 240px`, `--layout-topbar-height 54px`,
  `--layout-max-width 1100px`, `--layout-subnav-height 40px`. (Note : certaines pages historiques
  utilisent une sidebar ~268 px — *à confirmer / harmoniser*.)
- **UI-04-03 — Densité compacte.** Voir UI-01-08.

## UI-05 — États des composants

Cf. fiches [`CG-08`] (feedback) et [`CG-11`] (états & accessibilité).

- **UI-05-01 — Chargement.** Squelettes `Skeleton` (`saris/Skeleton.tsx`) + spinners discrets
  (loaders `animate-spin`). Bornage temps réel pour limiter le polling (ENF-02).
- **UI-05-02 — Erreur.** `ErrorBoundary` global (`apps/web/src/components/ErrorBoundary.tsx`),
  alertes inline sémantiques (ton `error`), toasts d'erreur traduits.
- **UI-05-03 — Vide.** Composant canonique `EmptyState` (cf. UI-06-02) — toujours proposer un CTA
  quand c'est possible.
- **UI-05-04 — Hors-ligne.** Indicateur de connectivité / synchronisation dans le TopHeader
  (chip), file de rejeu et bascule en-ligne/hors-ligne (cf. [[exigences_non_fonctionnelles]]
  ENF-01) ; `connectivity.store`. Toasts dédiés (mutation mise en file).
- **UI-05-05 — Focus & ARIA.** Anneau de focus `--ring`/`outline-ring/50` global ; composants
  interactifs portent rôles/états ARIA (ex. `SegmentedTabs` `role="tablist"`/`tab`, navigation
  flèches ; rideau `role="switch"`). Conformité WCAG 2.1 AA formelle **à confirmer** (ENF-07-03).

## UI-06 — Composants canoniques

Bibliothèque `apps/web/src/components/saris/` (réutilisée partout ; ne pas réimplémenter).
Fiches [`CG-05`] (fondamentaux), [`CG-06`] (navigation), [`CG-07`] (données), [`CG-08`] (feedback).

- **UI-06-01 — Modal** (`saris/Modal.tsx`). Shell de fenêtre modale : overlay flouté + carte
  centrée (header icône/titre/sous-titre + bouton fermer, corps défilant, pied d'actions). Ferme
  par Échap / clic overlay, verrouille le scroll de fond, **adaptative mobile** (`useIsMobile`).
  Props : `icon, title, subtitle?, onClose, width? (560), footer?, bodyPadding?`.
- **UI-06-02 — EmptyState** (`saris/EmptyState.tsx`). État vide accueillant : icône en tuile,
  titre, description, action (CTA). Variantes `default | subtle`. Tout en jetons CSS.
- **UI-06-03 — StatusPill** (`saris/StatusPill.tsx`). Badge d'état uniforme : point coloré + libellé.
  Tons : `success | warning | error | info | neutral | accent | gold` (mappés sur les jetons
  sémantiques). Tailles `sm | md`, `borderRadius: 9999`.
- **UI-06-04 — SegmentedTabs** (`saris/SegmentedTabs.tsx`). Onglets « pills » : conteneur teinté
  (`--fond-surface-2`) + onglet actif en pastille surélevée. Contrôlé (`value`/`onChange`),
  accessible (tablist/tab, flèches), `fullWidth`, `badge`, tailles `sm | md`.
- **UI-06-05 — DataTable** (`saris/DataTable.tsx`). Tableau de données ; colonnes
  redimensionnables (`useColumnResize` + poignée `.saris-col-resize`). *Limite connue* : la variante
  tableau-cartes (DATA_TABLE_CARD) n'est pas adaptée au responsive (ENF-07-04).
- **UI-06-06 — Autres fondamentaux.** `Button`, `IconButton`, `Field`, `SelectBox`, `DatePicker`,
  `Avatar`, `Card`, `StatCard`, `PageHeader`, `Toolbar`, `Tooltip`, `Pagination`, `Skeleton`,
  `Charts` (5 types de graphiques, seul lieu autorisant les dégradés d'aire).

## UI-07 — Patterns spécifiques SARIS

- **UI-07-01 — Rideau de confidentialité** (`apps/web/src/components/PrivacyCurtain.tsx`,
  `stores/privacy.store.ts`). Les zones de détail clinique sensibles (triage, consultation,
  messagerie, aperçu patient, éditeur de rôle) sont **floutées en permanence** (verre poli + grain)
  et se révèlent **au survol**. Bascule globale persistée (défaut activé, `role="switch"`),
  neutralisée sur écran tactile. Protège des regards sur poste partagé. Cf.
  [[exigences_non_fonctionnelles]] ENF-05-04.
- **UI-07-02 — Codes techniques masqués hors référentiels** (`apps/web/src/config/labels.ts` :
  `labelDomaine`, `humanizeCode`). L'application étant destinée à des soignants (non-IT), les codes
  techniques `UPPER_SNAKE` sont **retirés des vues cliniques, listes et documents** (humanisés via
  i18n + repli) ; ils ne restent visibles **que dans les écrans Référentiels** (où ils sont gérés).
- **UI-07-03 — Documents A4 imprimables** (`apps/web/src/components/print/MedicalPrintSheet.tsx`).
  **Gabarit A4 unifié** au thème SARIS (logo réel `/logo_cms_saris.png`) pour ordonnance, bon
  d'examen, bon de pharmacie, certificat, certificat de repos, évacuation. Helpers de mise en page
  (PrintTable, Prose, Callout), variantes `inline | modal` ; l'aperçu occupe la **zone de droite**
  de la consultation (pas une modale plein écran). Cf. [[exigences_non_fonctionnelles]] ENF-08.
- **UI-07-04 — Responsive.** Sidebar en **drawer** mobile (hamburger TopHeader), split-panels
  (messagerie, triage) **empilés** sous 1024 px, Modal adaptative ; `useMediaQuery` + `ui.store`.
  Cf. ENF-07.
- **UI-07-05 — Barres de défilement & contrôles natifs.** Scrollbars fines aux couleurs SARIS
  (clair/sombre auto) ; flèches « spinner » des `input[type=number]` masquées (saisie clavier
  conservée). Référence : `@layer base` de `globals.css`.

## UI-08 — Iconographie & assets

Fiche [`CG-10`]. Icônes **lucide-react** (tailles cohérentes ~14 px en barre d'onglets, jusqu'aux
tuiles 48 px des états vides). Logo SARIS officiel `/logo_cms_saris.png` (documents, sidebar recadrée
en tuile `contain`). Emojis de la messagerie = **set Apple auto-hébergé** (sprite local, 0 CDN).

---

## Traçabilité

| ID | Sujet | Source de vérité (code) | Charte source |
| --- | --- | --- | --- |
| UI-01 | Principes | `packages/ui/src/styles/globals.css` | CG-04, CG-12 |
| UI-02 | Palette | `globals.css` (`:root` / `.dark`) | CG-01 |
| UI-03 | Typographie | `globals.css` (`@theme inline`, base) | CG-02 |
| UI-04 | Espacements / layout | `globals.css` | CG-03 |
| UI-05 | États | `saris/Skeleton`, `ErrorBoundary`, `connectivity.store` | CG-08, CG-11 |
| UI-06 | Composants canoniques | `apps/web/src/components/saris/*` | CG-05, CG-06, CG-07, CG-08 |
| UI-07 | Patterns SARIS | `PrivacyCurtain.tsx`, `labels.ts`, `print/MedicalPrintSheet.tsx` | CG-04, CG-07, CG-11 |
| UI-08 | Iconographie / assets | lucide-react, `/logo_cms_saris.png` | CG-10 |

> Référence détaillée : **12 fiches HTML** `Docs/CMS/charte graphique/CG-01 … CG-12` (+ `README.md`).
> Tout point « à confirmer » (conformité WCAG formelle UI-05-05/ENF-07-03 ; harmonisation largeur
> sidebar UI-04-02) doit être levé avant la version 1.0 validée.
