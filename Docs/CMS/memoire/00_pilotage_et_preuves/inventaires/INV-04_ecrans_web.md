# INV-04 — Inventaire des écrans de l'application web

> **Statut** : extrait · **Date d'extraction** : 2026-08-10
> **Sources** : `apps/web/src/App.tsx`, `apps/web/src/components/layout/AppShell.tsx`, `apps/web/src/config/navigation.config.ts`, pages et onglets des 15 modules
> **Nature de la preuve** : `IMPLÉMENTÉ`.

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| Chemins de routage déclarés | **19** (dont 2 redirections et 2 replis) |
| Écrans réellement atteignables | **15** |
| Composants de page | **17** (2 sont montés en onglet, voir § 6) |
| Onglets et sous-onglets | **25** répartis sur 4 pages composites |
| Modules fonctionnels front | **15** |
| Modales d'impression A4 | **6** (+ 2 gabarits d'impression partagés) |
| Magasins d'état (Zustand) | **12** |
| Langues | **2** — français et anglais, 16 fichiers de traduction par module |

Toutes les pages sauf trois sont protégées par le composant `PermissionGate`, qui applique le **même catalogue de permissions que le serveur** (INV-03). Le menu latéral, lui, est filtré item par item : un groupe dont tous les items sont refusés **disparaît** au lieu d'afficher des entrées mortes.

---

## 2. Écrans routés

| # | Chemin | Composant de page | Permission d'accès (mode « au moins une ») | Fichier |
|---:|---|---|---|---|
| 1 | `/login` | `LoginPage` | _aucune_ — écran d'authentification | `modules/auth/pages/LoginPage.tsx` |
| 2 | `/` | `RootRedirect` | — | redirection vers la page d'accueil préférée |
| 3 | `/dashboard` | `DashboardPage` | `dashboard.read` | `modules/dashboard/pages/DashboardPage.tsx` |
| 4 | `/rapports` | `RapportsPage` | `rapport.read` | `modules/rapports/pages/RapportsPage.tsx` |
| 5 | `/triage` | `TriagePage` | `visite.read` | `modules/triage/pages/TriagePage.tsx` |
| 6 | `/patients` | `PatientsPage` | `patient.read` | `modules/patients/pages/PatientsPage.tsx` |
| 7 | `/patients/:id` | `DossierPage` | `patient.read` | `modules/patients/pages/DossierPage.tsx` |
| 8 | `/consultations` | `ConsultationPage` | `consultation.read` | `modules/consultation/pages/ConsultationPage.tsx` |
| 9 | `/messagerie` | `MessageriePage` | `messagerie.read` | `modules/messagerie/pages/MessageriePage.tsx` |
| 10 | `/referentiels` | `ReferentielsPage` | `referentiel.read` | `modules/referentiels/pages/ReferentielsPage.tsx` |
| 11 | `/admin/acces` | `AccesPage` | `utilisateur.read` · `role.read` · `personnel.read` · `delegation.read` | `modules/admin/pages/AccesPage.tsx` |
| 12 | `/admin/audit` | `AuditPage` | `audit.read` | `modules/admin/pages/AuditPage.tsx` |
| 13 | `/admin/parametres` | `ParametresPage` | _aucune_ — réglages **personnels**, en libre-service | `modules/admin/pages/ParametresPage.tsx` |
| 14 | `/admin/parametres-systeme` | `ParametresSystemePage` | `parametre.read` | `modules/admin/pages/ParametresSystemePage.tsx` |
| 15 | `/synchronisation` | `SynchronisationPage` | `synchronisation.read` | `modules/admin/pages/SynchronisationPage.tsx` |
| 16 | `/base-donnees` | `BaseDonneesPage` | `synchronisation.read` | `modules/admin/pages/BaseDonneesPage.tsx` |

**Redirections et replis** — à ne pas compter comme des écrans :

| Chemin | Comportement | Motif |
|---|---|---|
| `/admin/utilisateurs` | → `/admin/acces` | Ancienne route, conservée pour ne pas casser les liens existants |
| `/admin/roles` | → `/admin/acces` | Idem |
| `*` (connecté) | → page d'accueil préférée | Repli |
| `*` (non connecté) | → `/login` | L'URL reflète toujours l'état réel de la session |

---

## 3. Structure du menu latéral

Le menu est déclaré une seule fois (`navigation.config.ts`) et filtré par permission. Il constitue la **vue par acteur** utilisable telle quelle au chapitre 6.

| Groupe | Entrée | Permission | ADMIN | MÉDECIN CHEF | INFIRMIER |
|---|---|---|:---:|:---:|:---:|
| Espace de travail | Tableau de bord | `dashboard.read` | ✅ | ✅ | ✅ |
| Espace de travail | Rapports | `rapport.read` | ✅ | ✅ | ✅ |
| Espace de travail | Triage | `visite.read` | ✅ | ✅ | ✅ |
| Espace de travail | Dossiers médicaux | `patient.read` | ✅ | ✅ | ✅ |
| Espace de travail | Consultations | `consultation.read` | ✅ | ✅ | ✅ |
| Espace de travail | Messagerie | `messagerie.read` | ✅ | ✅ | ✅ |
| Administration médicale | Référentiels | `referentiel.read` | ✅ | ✅ | ✅ |
| Administration | Accès & habilitations | `utilisateur.read` · `role.read` · `personnel.read` · `delegation.read` | ✅ | ✅ | ⬜ |
| Administration | Paramètres système | `parametre.read` | ✅ | ⬜ | ⬜ |
| Administration | Journaux d'audit | `audit.read` | ✅ | ✅ | ⬜ |
| Administration | Synchronisation | `synchronisation.read` | ✅ | ⬜ | ⬜ |
| Administration | Base de données | `synchronisation.read` | ✅ | ⬜ | ⬜ |

> **Résultat par acteur** : l'infirmier ne voit **que** le groupe « Espace de travail » et « Référentiels » — le groupe Administration disparaît entièrement. Le médecin chef voit tout sauf les paramètres système, la synchronisation et la base de données. C'est la démonstration concrète de l'adaptation par rôle, à illustrer par capture au chapitre 8.

**Page d'accueil par défaut** : `INFIRMIER` arrive sur `/triage` (sa journée commence à la file d'attente) ; les autres rôles sur `/dashboard`. Le choix explicite de l'utilisateur dans « Mes paramètres » prime toujours.

---

## 4. Pages composites et leurs onglets

### 4.1 `/referentiels` — 9 onglets, chacun gouverné par sa propre permission

| Onglet | Permission de lecture | Composant |
|---|---|---|
| Sites | `referentiel.site.read` | `SitesTab` |
| Motifs | `referentiel.motif.read` | `MotifsTab` |
| Pathologies | `referentiel.pathologie.read` | `PathologiesTab` |
| Médicaments | `referentiel.medicament.read` | `MedicamentsTab` |
| Catégories | `referentiel.categorie.read` | `CategoriesTab` |
| Examens | `referentiel.examen.read` | `ExamensTab` |
| Types de consultation | `referentiel.type_consultation.read` | `TypesConsultationTab` |
| Sous-traitants | `sous_traitant.read` | `SousTraitantsTab` |
| Registre employé | `employe.read` | `EmployesTab` |

> Un onglet **n'existe pas** si sa permission de lecture n'est pas détenue. Si aucun onglet n'est autorisé, la page affiche un état vide explicite au lieu d'une coquille. C'est la raison d'être des `.read` par service : `referentiel.read` seul ouvrait autrefois les sept d'un coup.

### 4.2 `/patients/:id` — 4 sections, 9 sous-onglets

| Section | Sous-onglet | Restriction |
|---|---|---|
| Aperçu | Identité | — |
| Aperçu | Alertes | — |
| Dossier médical | Antécédents | — |
| Dossier médical | Documents | réservé aux profils cliniques |
| Parcours de soin | Visites | réservé aux profils cliniques |
| Parcours de soin | Consultations | réservé aux profils cliniques |
| Parcours de soin | Suivi de traitement | réservé aux profils cliniques |
| Administratif | Rattachements | exige `patient.rattachement.manage` |
| Administratif | Historique de catégorie | — |

### 4.3 `/admin/acces` — 3 onglets

| Onglet | Condition d'affichage | Contenu |
|---|---|---|
| Personnel | `utilisateur.read` **ou** `personnel.read` | Toutes les personnes, avec ou sans accès à l'application (`UtilisateursPage` monté en mode intégré) |
| Rôles & permissions | `role.read` | Matrice rôle × permission (`RolesPage` monté en mode intégré) |
| Délégations | `delegation.read` | Délégations de prescription |

> **Décision de conception à documenter** : l'onglet « Personnel » a fusionné les anciens écrans « Utilisateurs » et « Personnel soignant ». Motif inscrit dans le code : *c'est la même personne des deux côtés, et deux écrans de création produisaient des doublons et des fiches orphelines.* C'est un bon exemple d'amélioration issue de l'usage, à reprendre au chapitre 8 (difficultés rencontrées).

### 4.4 `/admin/parametres` — 4 sections personnelles

Préférences · Sécurité du compte (mot de passe, 2FA) · Sessions · Mentions légales et langue. Aucune permission : chaque agent gère ses propres réglages.

---

## 5. Éléments transverses

### 5.1 Ossature

| Composant | Rôle |
|---|---|
| `AppShell` | Ossature de l'application : barre latérale, en-tête, zone de contenu, routage |
| `Sidebar` | Menu filtré par permission, en tiroir sur mobile |
| `TopHeader` | Recherche, notifications, bascule de confidentialité, menu utilisateur |
| `BreadcrumbBar` | Fil d'Ariane |
| `NotificationDrawer` | Tiroir des notifications, alimenté en temps réel (SSE) |
| `BulleSynchro` | Bulle d'état de synchronisation, en haut au centre (mode autonome) |
| `UpdateBubble` | Notification de mise à jour disponible (application de bureau) |
| `DesktopTitleBar` | Barre de titre personnalisée, application de bureau uniquement |
| `SiteActifSwitch` | Bascule du site actif (Moutela ↔ Nkayi) |

### 5.2 Portails de contrôle

| Composant | Effet |
|---|---|
| `PermissionGate` | Refuse l'accès à un écran ou masque un élément selon les permissions effectives |
| `CguGate` | Bloque l'application tant que les conditions d'utilisation ne sont pas acceptées |
| `SessionBootstrap` | Resynchronise les permissions au démarrage |
| `PrivacyCurtain` | **Rideau de confidentialité** : floute en permanence les zones cliniques sensibles, révélées au survol. Actif par défaut, neutralisé sur écran tactile |
| `ErrorBoundary` | Capture les erreurs de rendu sans faire tomber l'application |

> ⚠️ Ne jamais confondre le **rideau** de confidentialité (effet visuel, ci-dessus) et le **verrou** de confidentialité (protection de données d'un dossier, permission `patient.lock`). Les deux existent, ils ne font pas la même chose.

### 5.3 Impressions A4

| Document | Composant | Module |
|---|---|---|
| Ordonnance | `OrdonnancePrintModal` | consultation |
| Bon d'examen | `BonExamenPrintModal` | bon-examen |
| Bon de pharmacie | `BonPharmaciePrintModal` | bon-pharmacie |
| Certificat de repos | `CertificatReposPrintModal` | consultation |
| Fiche d'évacuation | `EvacuationPrintModal` | sorties-critiques |
| Dossier patient | `DossierPrintModal` | patients |
| _(gabarit partagé)_ | `MedicalPrintSheet` | mise en page A4 des documents cliniques |
| _(gabarit partagé)_ | `ListePrintSheet` | mise en page A4 des listes |

### 5.4 État applicatif — 12 magasins Zustand

`session` · `sync` · `network` · `connectivity` · `ui` · `navStack` · `viewState` · `privacy` · `typing` · `audioPlayback` · `uploadProgress` · `session-storage`

Les magasins `network`, `connectivity` et `sync` portent le fonctionnement hors-ligne : ils sont à représenter dans la fiche de dessin du diagramme de composants (UML-CMP-01).

### 5.5 Bilinguisme

Français et anglais, bascule en direct, préférence persistée par compte. 16 fichiers de traduction, un par module fonctionnel (`acteurs`, `admin`, `bonExamen`, `bonPharmacie`, `consultation`, `dashboard`, `employes`, `labels`, `messagerie`, `patients`, `personnelSoignant`, `rapports`, `referentiels`, `sorties`, `suiviTraitement`, `triage`).

---

## 6. Écarts et points de vigilance

| # | Constat | Conséquence documentaire |
|---|---|---|
| E-01 | **17 composants de page pour 15 écrans atteignables** : `UtilisateursPage` et `RolesPage` ne sont pas routés directement, ils sont montés en onglet dans `AccesPage` (mode `embedded`). | Ne jamais annoncer « 17 écrans ». Le chiffre à retenir est **15 écrans**, dont une page composite qui en réutilise deux. |
| E-02 | `/admin/parametres` n'exige **aucune** permission. | Ce n'est pas un oubli : la page ne porte que des réglages personnels. À justifier explicitement, sinon le jury y verra une faille. |
| E-03 | La garde de `/admin/acces` liste 4 permissions, mais la page n'affiche que **3 onglets** (`utilisateur.read` et `personnel.read` ouvrent le même onglet). | Le diagramme de cas d'utilisation ne doit pas créer 4 UC distincts là où il y en a 3. |
| E-04 | Les permissions du menu et celles des gardes de route sont déclarées à **deux endroits** (`navigation.config.ts` et `AppShell.tsx`). | Divergence possible entre « voir l'entrée » et « pouvoir ouvrir la page ». Le code documente d'ailleurs un incident de ce type sur `/rapports` (l'entrée exigeait `consultation.read`, le serveur `rapport.read` → 403 après clic). Excellent exemple pour le chapitre 8. |
| E-05 | 3 permissions du catalogue ne sont exigées par aucune route serveur (`ordonnance.read`, `ordonnance.print`, `rapport.export`) — elles gouvernent l'affichage côté client. | À traiter comme des contrôles **de présentation**, pas de sécurité : une permission purement cliente n'est pas une protection. |

---

## 7. Alimente

| Destination | Usage |
|---|---|
| Chapitre 6 § 6.3 | Cas d'utilisation : un écran ≈ un ou plusieurs UC |
| Chapitre 7 § 7.6 | Inventaire des interfaces principales et choix ergonomiques |
| Chapitre 8 § 8.2 | Présentation des fonctionnalités, avec captures |
| Fiche UML-UC-01 → Figure 6.2 | Périmètre fonctionnel vu par chaque acteur |
| Fiche UML-CMP-01 → Figure 7.6 | Composants du frontend et magasins d'état |
| § 12 du prompt (captures) | Liste des écrans à capturer : au moins un par module |
| Matrice de traçabilité | Colonne « écran Web » |
