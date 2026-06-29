# Module 15 — Tableau de bord & Statistiques

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » (le système est développé et déployé — voir [[_SOURCE_systeme]]). Tout fait
> technique renvoie au code réel sous `CMS/APP/CMS-SARIS/`. Les chiffres ne sont jamais redéfinis
> localement : ils renvoient à [[parametres_metier]] (`PM-xx`) ; les décisions à [[registre_decisions]]
> (`D-xxx`) ; les termes au [[glossaire]] ; le positionnement inter-modules à [[plan_modules]] (`C-x`).
> Code de référence : backend `apps/api/src/modules/dashboard/{dashboard.controller.ts,dashboard.service.ts,dashboard.module.ts}` ;
> frontend `apps/web/src/modules/dashboard/` (pages `DashboardPage.tsx`, hooks `useDashboard.ts`,
> api `dashboard.api.ts`, lib `statsExport.ts`, composant `components/DelegationsWidget.tsx`).

---

## 1. Mission et périmètre

### 1.1 Mission

Le module **Tableau de bord & Statistiques** fournit une **vue de pilotage en lecture seule** du centre,
**adaptée au persona** de l'utilisateur connecté, et la **finalité statistique** du système : remplacer
le comptage Excel manuel « façon Jeannette » par une agrégation **type × pathologie × catégorie de
patient** exportable (CSV / PDF). Il est rattaché au domaine **Pilotage & Statistiques** ([[plan_modules]])
et n'expose qu'un seul contrat fonctionnel, **C-13** (KPI & statistiques : données cliniques → `Dashboard`,
agrégations en lecture).

Deux personas sont servis (cf. `DashboardPage.tsx`) :
- **Vue clinique** (pour les soignants : médecin-chef, infirmier — « médecin » étant une profession mappée au rôle médecin-chef) : KPI du jour, file d'attente,
  tendance, affluence horaire, motifs, et la **section Statistiques d'activité**.
- **Vue admin système** (gouvernance) : comptes, échecs de connexion, sessions actives, rôles configurés,
  tendance d'authentification, répartition des comptes, activité d'audit récente.

### 1.2 Périmètre couvert (as-built)

- **KPI cliniques instantanés** du jour avec tendance vs la veille (`GET /dashboard/overview`).
- **Série temporelle** des visites sur 14 jours (`GET /dashboard/tendance`).
- **Affluence horaire** du jour, plage 6 h → 20 h (`GET /dashboard/affluence`).
- **Top 5 des motifs** du jour (`GET /dashboard/motifs-jour`).
- **File d'attente** (10 visites en attente, par ordre d'arrivée) (`GET /dashboard/urgences`).
- **Statistiques d'activité** sur période paramétrable (`GET /dashboard/statistiques?from&to`) :
  répartition par type de consultation, par pathologie (diagnostic principal), par catégorie de patient,
  et synthèse des jours de **repos** maladie.
- **Statistiques de gouvernance système** (`GET /dashboard/admin-systeme`).
- **Exports** des statistiques d'activité en **CSV** (séparateur `;` + BOM UTF-8, ouvrable Excel FR) et en
  **PDF** (fenêtre imprimable « Enregistrer en PDF »), côté client (`statsExport.ts`).
- **Site-filtrage systématique** : toutes les requêtes héritent du `siteId` du JWT (`requireSite`).
- **Widget délégations** affiché dans la vue clinique si l'utilisateur a `delegation.read` (composant
  `DelegationsWidget`, données fournies par le domaine Personnel, hors périmètre de calcul de ce module).

### 1.3 Hors périmètre (explicite)

- **Aucune écriture / mutation** : le module est **strictement en lecture** (agrégations). Aucune entité
  propre, aucun POST/PATCH/DELETE (cf. `dashboard.controller.ts` : que des `@Get`). Il **n'est pas**
  journalisé par l'audit (`@Audit`) puisqu'il ne mute rien (cf. [[registre_decisions]] D-014).
- **Calcul de la délégation** : le `DelegationsWidget` consomme des données du domaine
  **Référentiels & Personnel** ; sa logique métier ne relève **pas** de ce module.
- **Détail des journaux** : la vue admin affiche un **aperçu** des dernières actions d'audit (8 lignes) en
  réutilisant le hook `useAuditActions` du **module Admin** ; la consultation complète relève du module
  **Audit & sécurité** (lien « Journaux » → `/admin/audit`).
- **Tableaux de bord par rôle supprimés** : les vues `AGENT_RH` et `ADMIN_MEDICAL` ont été **retirées**
  (réduction à 3 rôles d'habilitation — MEDECIN fusionné dans MEDECIN_CHEF —, [[registre_decisions]] D-003) ; il ne reste que **ClinicalView** et
  **AdminSystemView**.
- **KPI hors-recueil résiduels (dette)** : la vue clinique référence encore des KPI « Accidents du travail »
  et « Suivis chroniques » dans le code frontend, **non alimentés par le backend** — voir §9 (point ouvert).
- **Génération PDF serveur** : le « PDF » est en réalité une **fenêtre d'impression navigateur** côté client
  (pas de rendu PDF backend).

---

## 2. Acteurs et rôles

Rôles du système (3 d'habilitation : ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER — cf. [[glossaire]] « Rôle », [[registre_decisions]] D-003, `PM-46`. « MEDECIN » n'est pas un rôle mais une profession du personnel mappée au rôle MEDECIN_CHEF). L'accès au tableau
de bord et aux blocs est **piloté par permission** (garde `@RequirePermissions` côté controller) et le
**persona affiché** est déduit du rôle primaire (avec repli sur permissions) côté `DashboardPage.tsx`.

| Acteur | Vue affichée | Accès aux blocs (permissions requises) |
|--------|--------------|----------------------------------------|
| **ADMIN_SYSTEME** | Vue **admin système** | `utilisateur.read` (bloc gouvernance `admin-systeme`) ; aperçu audit si `audit.read`. A par ailleurs tout le catalogue ([[registre_decisions]] D-004). |
| **MEDECIN_CHEF** | Vue **clinique** | `dashboard.read` (overview, motifs, urgences, tendance, affluence) ; `consultation.read` (statistiques d'activité) ; widget délégations si `delegation.read`. *(Profession « MEDECIN » du personnel → rôle MEDECIN_CHEF.)* |
| **INFIRMIER** | Vue **clinique** | `dashboard.read`, `consultation.read` selon attribution. |

Notes :
- La **supervision** (= { ADMIN_SYSTEME, MEDECIN_CHEF }, [[glossaire]]) n'a pas d'effet de filtrage propre
  dans ce module : les agrégations sont **site-scopées** (par `siteId`), non scopées à l'initiateur. Les
  comptages cliniques portent donc sur **tout le site** (à confirmer comme conforme au cloisonnement par
  initiateur D-007 — voir §9).
- Les **catégories de patient** ([[glossaire]]) interviennent comme **axe d'agrégation** des statistiques
  (`parCategorie`), pas comme acteur.

---

## 3. Exigences fonctionnelles

> IDs `EF-15-xx`. Atomiques et vérifiables. Source de chaque exigence : code cité.

- **EF-15-01** — Le système expose `GET /dashboard/overview` qui renvoie les KPI cliniques **du jour** du
  site de l'appelant, détaillés en EF-15-01a à EF-15-01h. (`getOverview`)
- **EF-15-01a** — L'overview renvoie le décompte des visites du jour ventilé par statut : en attente, en
  cours, clôturées, annulées, plus le total. (`getOverview`)
- **EF-15-01b** — L'overview renvoie le nombre de visites de la veille et la **tendance % vs veille** (cf.
  EF-15-03 pour le cas nul). (`getOverview`)
- **EF-15-01c** — L'overview renvoie le **temps d'attente moyen** (minutes) calculé sur les visites
  clôturées du jour (cf. EF-15-02 pour le cas nul). (`getOverview`)
- **EF-15-01d** — L'overview renvoie le nombre de **consultations actives**. (`getOverview`)
- **EF-15-01e** — L'overview renvoie le nombre de **consultations clôturées du jour**. (`getOverview`)
- **EF-15-01f** — L'overview renvoie le nombre d'**ordonnances validées du jour**. (`getOverview`)
- **EF-15-01g** — L'overview renvoie le nombre de **bons d'examen en attente**. (`getOverview`)
- **EF-15-01h** — L'overview renvoie le nombre d'**évacuations en cours**. (`getOverview`)
- **EF-15-02** — Le **temps d'attente moyen** vaut `null` quand aucune visite n'a été clôturée le jour même
  (pas de division par zéro). (`getOverview`, `tempsAttenteMoyenMin`)
- **EF-15-03** — La **tendance % vs veille** vaut `null` si aucune visite la veille (évite la division par
  zéro). (`getOverview`, `tendanceVisitesPct`)
- **EF-15-04** — Le système expose `GET /dashboard/tendance` : série du **nombre de visites par jour** sur
  **14 jours** (incluant aujourd'hui), avec total et clôturées par jour, clé `YYYY-MM-DD`. (`getActivityTrend`)
- **EF-15-05** — Le système expose `GET /dashboard/affluence` : comptage des visites du jour **par tranche
  horaire**, bornée à la plage **6 h → 20 h** (heures hors plage ignorées). (`getHourlyAffluence`)
- **EF-15-06** — Le système expose `GET /dashboard/motifs-jour` : **top 5** des motifs principaux des
  visites du jour (id, libellé, compte), trié décroissant ; renvoie une liste vide si aucune visite.
  (`getMotifsDuJour`)
- **EF-15-07** — Le système expose `GET /dashboard/urgences` : les **10** visites `EN_ATTENTE` du site,
  triées **par ordre d'arrivée** (plus ancienne d'abord), avec patient (numéro + identité) et motif
  principal. (`getUrgences` ; conforme à la suppression de la priorité, [[registre_decisions]] D-008)
- **EF-15-08** — Le système expose `GET /dashboard/statistiques?from&to` : agrégation de **toutes les
  consultations créées sur la période** (défaut : **30 derniers jours**), **quel que soit le statut**
  (ouvertes incluses) — `getStatistiques` **ne filtre pas** sur le statut de consultation — par **type de
  consultation**, par **pathologie** (diagnostic `PRINCIPAL`, top 15) et par **catégorie de patient**, plus
  la synthèse **repos** (nombre de consultations avec repos + total des jours). *(Dette : l'UI étiquette ces
  consultations « clôturées » — message « Aucune consultation clôturée sur la période », `DashboardPage.tsx` —
  alors que le calcul backend ne restreint pas au statut clôturé ; libellé à corriger. Voir §9.)* (`getStatistiques`)
- **EF-15-09** — Les statistiques d'activité acceptent une période explicite via `from=YYYY-MM-DD` &
  `to=YYYY-MM-DD` ; `from` est ramené à 00:00:00 et `to` à 23:59:59.999. (`getStatistiques`)
- **EF-15-10** — Le système expose `GET /dashboard/admin-systeme` (réservé `utilisateur.read`) : agrégats
  de gouvernance détaillés en EF-15-10a à EF-15-10f. (`getAdminSystemStats`)
- **EF-15-10a** — `admin-systeme` renvoie le décompte des **comptes** ventilé : actifs / bloqués /
  désactivés / total. (`getAdminSystemStats`)
- **EF-15-10b** — `admin-systeme` renvoie le **nombre de rôles** configurés. (`getAdminSystemStats`)
- **EF-15-10c** — `admin-systeme` renvoie le nombre d'**échecs de connexion sur 24 h** (cf. RM-15-09 pour la
  convention de préfixe). (`getAdminSystemStats`)
- **EF-15-10d** — `admin-systeme` renvoie le nombre de **sessions actives**. (`getAdminSystemStats`)
- **EF-15-10e** — `admin-systeme` renvoie le **volume d'actions d'audit sur 7 jours**. (`getAdminSystemStats`)
- **EF-15-10f** — `admin-systeme` renvoie la **tendance d'authentification** : succès / échecs par jour sur
  7 jours. (`getAdminSystemStats`)
- **EF-15-11** — Tout endpoint du module **filtre par `siteId`** issu du JWT ; en l'absence de `siteId`
  dans la session, l'appel est rejeté `401`. (`requireSite`)
- **EF-15-12** — L'interface affiche un **persona unique** par utilisateur : `ADMIN_SYSTEME` → vue admin
  système ; `MEDECIN_CHEF` / `INFIRMIER` → vue clinique ; repli par permissions pour rôles
  personnalisés. (`DashboardPage.tsx`, calcul `persona`)
- **EF-15-13** — La vue clinique permet d'**exporter** les statistiques d'activité au format **CSV** (Excel
  FR : séparateur `;`, BOM UTF-8) et **PDF** (fenêtre imprimable). Les boutons sont **désactivés** si aucune
  consultation sur la période. (`StatistiquesSection`, `exportStatsCsv`, `exportStatsPdf`)
- **EF-15-14** — La vue clinique propose un **sélecteur de période** par préréglages **7 j / 30 j / 90 j /
  1 an** alimentant `from`/`to`. (`StatistiquesSection`, `PRESETS`)
- **EF-15-15** — Chaque persona ne **charge que ses données** : les hooks `useAdminSystemStats` /
  `useStatistiques` sont conditionnés (`enabled`) par le persona, et chaque bloc clinique est conditionné
  par permission (ex. lien « Voir tout » vers `/triage` si `visite.read`). (`useDashboard.ts`, `DashboardPage.tsx`)
- **EF-15-16** — Les données du tableau de bord se **rafraîchissent automatiquement** à des intervalles
  distincts par bloc (file/urgences plus fréquent, séries plus espacées) — voir `RM-15-05` / [[parametres_metier]]
  `PM-43`. (`useDashboard.ts`, `refetchInterval`)
- **EF-15-17** — La vue clinique affiche une **bannière d'alerte contextuelle** : visites en attente depuis
  plus de 30 min, sinon temps d'attente moyen > 60 min. (`ClinicalView`, `alerte`)
- **EF-15-18** — La vue admin système affiche une **alerte de sécurité** lorsque les échecs de connexion sur
  24 h atteignent **5 ou plus**. (`AdminSystemView`)
- **EF-15-19** — La vue admin système affiche un **aperçu des 8 dernières actions d'audit** si l'utilisateur
  a `audit.read` (réutilisation du module Admin) ; sinon le bloc est masqué. (`AdminSystemView`, `useAuditActions`)

---

## 4. Cas d'utilisation

> IDs `CU-15-xx`. Critères « Étant donné / Quand / Alors ».

### CU-15-01 — Consulter le tableau de bord clinique du jour
- **Acteur** : MEDECIN_CHEF, INFIRMIER (vue clinique).
- **Déclencheur** : ouverture de la page Tableau de bord.
- **Scénario nominal** : le client appelle `overview`, `urgences`, `motifs-jour`, `tendance`, `affluence` ;
  la page affiche KPI, file d'attente, tendance 14 j, affluence horaire, motifs.
- **Scénarios d'erreur** : session sans `siteId` → `401` (EF-15-11) ; un bloc en erreur réseau reste vide /
  squelette, les autres s'affichent (chargements indépendants).
- **Hors-ligne** : sur **poste local** (desktop, [[glossaire]]) le backend embarqué répond avec les données
  locales synchronisées ; sur le web, le service worker peut servir une réponse en cache (offline léger).
  Les chiffres reflètent alors le dernier état synchronisé.
- **Critères** :
  - *Étant donné* un soignant authentifié avec `siteId`, *quand* il ouvre le tableau de bord, *alors* les
    KPI du jour de **son site** s'affichent (visites, attente, temps moyen, consultations actives).
  - *Étant donné* aucune visite clôturée aujourd'hui, *quand* l'overview se charge, *alors* le temps
    d'attente moyen s'affiche « — » (valeur `null`, EF-15-02).

### CU-15-02 — Suivre la file d'attente et les visites anciennes
- **Acteur** : soignant (vue clinique).
- **Déclencheur** : affichage du bloc file d'attente.
- **Scénario nominal** : les 10 visites `EN_ATTENTE` sont listées par ordre d'arrivée ; un clic ouvre
  `/triage`. Si une visite attend > 30 min, une bannière d'alerte s'affiche (EF-15-17).
- **Scénarios d'erreur** : file vide → état vide « rien en attente ».
- **Critères** :
  - *Étant donné* des visites en attente, *quand* la file se rend, *alors* elles sont ordonnées de la plus
    ancienne à la plus récente (pas de priorité, D-008).
  - *Étant donné* une visite en attente depuis plus de 30 minutes, *quand* la vue se charge, *alors* une
    bannière d'avertissement signale le nombre de visites concernées.

### CU-15-03 — Produire les statistiques d'activité sur une période
- **Acteur** : soignant disposant de `consultation.read`.
- **Déclencheur** : sélection d'un préréglage de période (7 j / 30 j / 90 j / 1 an) dans la section
  Statistiques.
- **Scénario nominal** : le client appelle `statistiques?from&to` ; la section affiche le total de
  consultations, les jours de repos, et trois répartitions (type, catégorie en donut ; pathologies en
  barres classées).
- **Scénarios d'erreur** : aucune consultation sur la période → message « Aucune consultation clôturée sur
  la période » et boutons d'export désactivés (EF-15-13). *(Le terme « clôturée » du message est inexact :
  l'agrégation backend ne filtre pas le statut — dette UI, voir §9.)*
- **Hors-ligne** : agrégation sur les consultations **locales** (poste desktop) ; les exports CSV/PDF se
  génèrent **entièrement côté client** (aucune dépendance réseau).
- **Critères** :
  - *Étant donné* une période choisie, *quand* l'utilisateur la sélectionne, *alors* `from`/`to` sont
    recalculés et la requête est rejouée.
  - *Étant donné* des consultations sur la période, *quand* l'utilisateur clique « Excel », *alors* un
    fichier `statistiques_<from>_<to>.csv` ouvrable dans Excel est téléchargé.

### CU-15-04 — Exporter les statistiques en PDF imprimable
- **Acteur** : soignant (vue clinique), données présentes.
- **Déclencheur** : clic sur le bouton « PDF ».
- **Scénario nominal** : une fenêtre navigateur formatée (gabarit teal SARIS) s'ouvre et lance l'impression
  (l'utilisateur choisit « Enregistrer en PDF »).
- **Scénarios d'erreur** : ouverture de fenêtre bloquée par le navigateur → l'export n'aboutit pas (retour
  silencieux, `if (!w) return`).
- **Critères** :
  - *Étant donné* des statistiques affichées, *quand* l'utilisateur clique « PDF », *alors* une page
    imprimable listant total, repos et les trois répartitions s'ouvre.

### CU-15-05 — Superviser la gouvernance système
- **Acteur** : ADMIN_SYSTEME (permission `utilisateur.read`).
- **Déclencheur** : ouverture du tableau de bord (persona admin système).
- **Scénario nominal** : `admin-systeme` renvoie comptes, échecs 24 h, sessions actives, rôles, tendance
  d'authentification 7 j, audit 7 j ; si `audit.read`, l'aperçu des 8 dernières actions s'affiche.
- **Scénarios d'erreur** : sans `audit.read`, le bloc d'activité récente est masqué (EF-15-19).
- **Critères** :
  - *Étant donné* 5 échecs de connexion ou plus sur 24 h, *quand* la vue se charge, *alors* une alerte de
    sécurité s'affiche (EF-15-18).
  - *Étant donné* un administrateur authentifié, *quand* il ouvre le tableau de bord, *alors* la vue
    **gouvernance** s'affiche (et non la vue clinique), même s'il dispose de droits cliniques élargis
    (EF-15-12).

---

## 5. Données du module

Le module **ne possède aucune entité Prisma propre** : c'est une couche d'**agrégation en lecture** sur des
entités définies dans [[modele_donnees_global]]. Entités lues (chemins : `dashboard.service.ts`) :

| Entité ([[modele_donnees_global]]) | Usage dans le module |
|------------------------------------|----------------------|
| `Visite` | KPI du jour, file d'attente, tendance, affluence, motifs ; temps d'attente (dateOuverture/dateCloture). |
| `Consultation` | Consultations actives/clôturées ; base des statistiques d'activité (type, période, repos). |
| `Ordonnance` | Ordonnances validées du jour. |
| `BonExamen` | Bons d'examen en attente. |
| `Evacuation` | Évacuations en cours. |
| `MotifConsultation` | Libellés des motifs (top 5). |
| `TypeConsultation` | Libellés pour la répartition « par type ». |
| `DiagnosticConsultation` | Diagnostics `PRINCIPAL` pour la répartition « par pathologie ». |
| `PathologieReference` | Libellés de pathologies. |
| `CategoriePatient` (via `Patient`) | Axe « par catégorie de patient ». |
| `Utilisateur`, `Role`, `SessionUtilisateur` | KPI de gouvernance (comptes, rôles, sessions). |
| `JournalAuthentification` | Échecs 24 h + tendance d'authentification 7 j. |
| `JournalAudit` | Volume d'actions 7 j (+ aperçu via le module Admin). |

**Formes de sortie (DTO de réponse, non persistées)** : `DashboardOverview`, `TrendPoint[]`,
`AffluencePoint[]`, `MotifDuJour[]`, `UrgenceVisite[]`, `AdminSystemStats`, `StatistiquesActivite`
(définies dans `apps/web/src/modules/dashboard/api/dashboard.api.ts`).

> Honnêteté as-built : le DTO frontend `DashboardOverview` déclare deux champs **non renvoyés par le
> backend** (`accidentsTravailOuverts`, `suivisChroniquesActifs`) — résidu de l'alignement au recueil
> ([[registre_decisions]] D-023). Voir §9.

---

## 6. Règles métier

> IDs `RM-15-xx`. Toute valeur chiffrée renvoie à [[parametres_metier]] (`PM-xx`) — jamais en dur ici.

- **RM-15-01** — **Site-filtrage obligatoire** : toute agrégation est restreinte au `siteId` de la session ;
  pas de `siteId` ⇒ rejet `401`. (cf. EF-15-11)
- **RM-15-02** — **Lecture seule** : le module n'effectue aucune mutation ; il n'a donc ni permission
  d'écriture, ni journalisation d'audit propre ([[registre_decisions]] D-014).
- **RM-15-03** — **Ordre d'arrivée** : la file (`urgences`) est triée par `dateOuverture` croissante ;
  aucune notion de priorité ([[registre_decisions]] D-008, [[glossaire]] « File d'attente »).
- **RM-15-04** — **Période par défaut des statistiques** : **30 derniers jours** si `from`/`to` absents ;
  `from` borné à 00:00:00, `to` à 23:59:59.999. L'agrégation porte sur **toutes les consultations créées**
  dans la fenêtre, **sans filtre de statut** (ouvertes comprises) ; le libellé UI « clôturées » est donc
  inexact (dette, voir EF-15-08 et §9). *(Valeur 30 j : définition locale du défaut backend ;
  les préréglages UI 7/30/90/365 j sont des choix d'interface.)*
- **RM-15-05** — **Rafraîchissement automatique** : intervalles distincts par bloc (urgences ≈ fréquent,
  séries ≈ espacé) ; le rafraîchissement des séries/statistiques (tendance, statistiques d'activité) suit
  [[parametres_metier]] **PM-43** (2 min). *(Valeurs plus courtes pour overview/urgences/motifs/affluence :
  définies dans `useDashboard.ts` — à formaliser en `PM` si besoin, voir §9.)*
- **RM-15-06** — **Plage horaire d'affluence** : seules les visites entre **6 h et 20 h** sont comptées
  (plage d'ouverture typique du centre). *(Bornes définies dans `getHourlyAffluence` — candidat `PM`.)*
- **RM-15-07** — **Top des répartitions** : motifs limités au **top 5**, pathologies au **top 15** (backend)
  puis **top 8** affiché ; type/catégorie limités aux **6** premières tranches en donut. *(Cardinalités
  d'affichage définies dans le code, candidats `PM`.)*
- **RM-15-08** — **Pathologie = diagnostic principal** : la répartition « par pathologie » ne compte que les
  diagnostics de type `PRINCIPAL`. (`getStatistiques`)
- **RM-15-09** — **Convention des résultats d'authentification** : un **échec** = code commençant par
  `ECHEC`, un **succès** = code commençant par `SUCCES` (préfixes de `JournalAuthentification`).
  (`getAdminSystemStats`)
- **RM-15-10** — **Seuils d'alerte UI** : alerte file si attente > 30 min ; alerte temps moyen si > 60 min ;
  alerte sécurité admin si échecs 24 h ≥ 5. *(Seuils d'interface dans `DashboardPage.tsx` — candidats `PM`.)*
- **RM-15-11** — **Robustesse au libellé manquant** : tout regroupement sans libellé connu (motif, type,
  pathologie, catégorie) est affiché « — » / « Non précisé ». (`getStatistiques`, `getMotifsDuJour`)

---

## 7. Interfaces

### 7.1 Endpoints exposés (consommés par le frontend)

Tous sous `@Controller('dashboard')`, gardés par `JwtAuthGuard` + `PermissionsGuard` (cf. C-9, [[plan_modules]]).

| Endpoint | Permission | Réponse |
|----------|-----------|---------|
| `GET /dashboard/overview` | `dashboard.read` | `DashboardOverview` |
| `GET /dashboard/motifs-jour` | `dashboard.read` | `MotifDuJour[]` |
| `GET /dashboard/urgences` | `dashboard.read` | `UrgenceVisite[]` |
| `GET /dashboard/tendance` | `dashboard.read` | `TrendPoint[]` (14 j) |
| `GET /dashboard/affluence` | `dashboard.read` | `AffluencePoint[]` |
| `GET /dashboard/admin-systeme` | `utilisateur.read` | `AdminSystemStats` |
| `GET /dashboard/statistiques?from&to` | `consultation.read` | `StatistiquesActivite` |

### 7.2 Ce que le module consomme

- **C-9** (Authentification & autorisation) : gardes JWT + permissions de `SecurityModule` (seul `imports`
  réel du `DashboardModule`, cf. `dashboard.module.ts` et [[plan_modules]]).
- **C-13** (KPI & statistiques) : lecture des entités cliniques et de gouvernance via `PrismaService`
  (collaboration **par la donnée**, [[plan_modules]] §6).
- **Module Admin** (frontend uniquement) : la vue admin réutilise le hook `useAuditActions` pour l'aperçu
  des dernières actions (lecture `JournalAudit`).
- **Domaine Référentiels & Personnel** (frontend) : `DelegationsWidget`, affiché si `delegation.read`.

### 7.3 Ce que le module expose

- Sept endpoints REST de **lecture** (§7.1). Aucun service exporté vers d'autres modules backend
  (`DashboardModule` n'a pas d'`exports`).

---

## 8. Exigences non fonctionnelles spécifiques

- **Performance** : agrégations majoritairement via `count` / `groupBy` Prisma ; certains regroupements
  (catégorie + repos) sont faits **en mémoire** après un `findMany` sélectif. Volumétrie attendue
  raisonnable (un site, fenêtre temporelle bornée). *(Charge à valider en production — à confirmer.)*
- **Confidentialité** : agrégations **site-scopées** (`RM-15-01`). La page clinique reste soumise au
  **rideau de confidentialité** global de l'application ([[glossaire]]) ; le module n'expose pas de données
  nominatives au-delà du nom/numéro patient dans la file d'attente.
- **Offline-first** : aucune mutation ⇒ pas de file de rejeu ni de tombstone propres ; les chiffres
  reflètent l'état **synchronisé** localement (poste desktop) ou le cache PWA (web). Voir [[MODULE_16_synchronisation]].
- **Temps réel / fraîcheur** : rafraîchissement par **polling** React Query (`RM-15-05`, `PM-43`), pas par
  SSE — le module n'importe pas `NotificationModule`.
- **i18n** : la **vue clinique « Statistiques d'activité »** et les **exports CSV/PDF** sont **en français
  codé en dur** (`StatistiquesSection`, `statsExport.ts`) ; le reste de la page passe par `react-i18next`.
  Écart à l'exigence « bilingue FR/EN strict » de [[_SOURCE_systeme]] — voir §9.
- **Exports** : CSV avec séparateur `;` + **BOM UTF-8** (ouverture directe Excel FR) ; PDF via fenêtre
  d'impression navigateur (pas de moteur PDF serveur).

---

## 9. Risques et points ouverts

- **PO-1 — KPI hors-recueil résiduels (dette frontend)** : `DashboardOverview` (frontend) déclare
  `accidentsTravailOuverts` et `suivisChroniquesActifs`, et `ClinicalView` rend des `StatCard` pour eux,
  **alors que le backend `getOverview` ne renvoie pas ces champs** (retirés au titre de [[registre_decisions]]
  D-023). Conséquence probable : KPI affichant `undefined`/0. **À nettoyer** côté frontend (alignement recueil).
- **PO-2 — Cloisonnement par initiateur non appliqué au dashboard** : les agrégations cliniques sont
  **site-scopées** (par `siteId`), non scopées au **soignant initiateur** ([[registre_decisions]] D-007).
  À confirmer : est-ce voulu (pilotage collectif du site) ou faut-il restreindre les non-superviseurs à
  leur propre activité comme ailleurs dans le clinique ?
- **PO-3 — Paramètres en dur à formaliser** : plusieurs valeurs sont codées localement (plage 6 h–20 h ;
  défaut 30 j ; intervalles de rafraîchissement overview/urgences/motifs/affluence ; seuils d'alerte 30/60
  min et 5 échecs ; cardinalités top 5/15/8/6). Seul **PM-43** est référencé dans [[parametres_metier]].
  **À régulariser** en `PM-xx` si ces seuils doivent devenir source unique.
- **PO-4 — i18n incomplète** : la section Statistiques d'activité et les exports sont en **français codé en
  dur**, contrairement à l'exigence bilingue ([[_SOURCE_systeme]]). À internationaliser ou à acter comme
  exception documentée.
- **PO-5 — Comptage des échecs/succès par convention de préfixe** : `RM-15-09` repose sur les préfixes
  `ECHEC`/`SUCCES` de `JournalAuthentification`. Tout nouveau code de résultat non préfixé fausserait la
  tendance d'authentification. **À garder cohérent** avec le module Audit & sécurité.
- **PO-6 — PDF = impression navigateur** : dépend du blocage de pop-up et du moteur d'impression du
  navigateur ; pas de rendu serveur reproductible. Acceptable pour la soutenance, à confirmer pour un usage
  de production.
- **PO-8 — Label « clôturée » trompeur (dette UI)** : `getStatistiques` (`dashboard.service.ts`) **n'applique
  aucun filtre de statut** et agrège **toutes les consultations créées** sur la période (ouvertes incluses),
  alors que l'UI parle de consultations « clôturées » (message d'état vide + intitulés, `DashboardPage.tsx`).
  Le décompte peut donc inclure des consultations non clôturées. **À corriger** : soit filtrer sur le statut
  clôturé côté backend, soit retirer le terme « clôturée » du libellé pour refléter le calcul réel.
- **PO-7 — Décision dédiée absente** : aucune `D-xxx` ne formalise spécifiquement le module Dashboard dans
  [[registre_decisions]] (il découle des décisions transverses D-007, D-008, D-023). À acter si une
  décision propre est souhaitée (ex. scope du pilotage).
