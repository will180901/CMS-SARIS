# Registre des décisions — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

---

## Objet et portée

Ce document recense les **décisions structurantes validées** du projet CMS SARIS (le système est
développé et déployé — voir [[_SOURCE_systeme]]). Il constitue la **source de vérité unique** pour
les choix d'architecture, de périmètre et de produit : tout autre document du cahier des charges doit
s'y aligner et le référencer plutôt que de redéfinir un choix. Il est le garde-fou anti-contradiction.

**Conventions** : chaque décision porte un identifiant stable `D-xxx`. Une décision n'est jamais
supprimée ; si elle évolue, elle est marquée *Remplacée* / *Amendée* avec un renvoi vers la décision
qui la met à jour. Les paramètres métier sont notés `PM-xx`, les exigences `EF-NN-xx`, les règles
`RM-NN-xx`, les cas d'usage `CU-NN-xx`, les contrats d'interface `C-x` (définis dans les documents de
modules respectifs).

**Honnêteté** : ce registre documente ce qui a été **décidé et appliqué**. Le nombre de rôles
d'habilitation est tranché : **3 rôles** (ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER ; MEDECIN fusionné dans
MEDECIN_CHEF), voir D-003.

---

## Tableau de synthèse

| ID | Intitulé | Date | Statut |
|----|----------|------|--------|
| D-001 | Architecture offline-first multi-poste (modèle « ulamu ») | 2026-06-23 | Acté · Appliqué |
| D-002 | Serveur central cloud : API Render + PostgreSQL Neon | 2026-06-23 | Acté · Déployé |
| D-003 | Réduction à 3 rôles d'habilitation (ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER ; MEDECIN fusionné dans MEDECIN_CHEF) | 2026-06-24 | Acté · Appliqué |
| D-004 | ADMIN_SYSTEME = super-administrateur (catalogue complet) | 2026-06-02 | Acté · Appliqué (réduction prévue) |
| D-005 | Dossier patient CENTRALISÉ cross-site | 2026-06-26 | Acté · Appliqué |
| D-006 | Verrou de confidentialité du médecin-chef (par dossier) | 2026-06-26 | Acté · Appliqué |
| D-007 | Activité clinique scopée à l'initiateur (soignant) | 2026-06-26 | Acté · Appliqué |
| D-008 | Suppression de la notion de priorité (file par ordre d'arrivée) | 2026-06-02 | Acté · Appliqué |
| D-009 | Catégorie patient = pilote des droits aux bons (cœur métier recueil) | 2026-06-25 | Acté · Appliqué |
| D-010 | Bon de pharmacie distinct de l'ordonnance | 2026-06-25 | Acté · Appliqué |
| D-011 | Délégation de prescription (approche PROJECTION, sans migration destructive) | 2026-06-24 | Acté · Appliqué |
| D-012 | Messagerie interne chiffrée AES-256-GCM façon WhatsApp Web | 2026-06-05 | Acté · Appliqué |
| D-013 | TOTP / 2FA chiffré at-rest + codes de secours | 2026-06-01 | Acté · Appliqué |
| D-014 | Journal d'audit persistant (interceptor global) | 2026-06-05 | Acté · Appliqué |
| D-015 | Soft-delete bi-cible global (tombstones) | 2026-06-08 | Acté · Appliqué |
| D-016 | Synchronisation Last-Write-Wins (LWW) | 2026-06-07 | Acté · Appliqué |
| D-017 | Annonces de mise à jour + diffusion d'installeur desktop | 2026-06-26 | Acté · Appliqué |
| D-018 | Badge de connectivité réelle (ping /health, anti-clignotement) | 2026-06-26 | Acté · Appliqué |
| D-019 | URL du serveur central HYBRIDE (bakée + formulaire de secours) | 2026-06-23 | Acté · Appliqué |
| D-020 | Online-first / offline-fallback du desktop | 2026-06-09 | Acté · Appliqué |
| D-021 | Session unique par utilisateur + révocation immédiate | 2026-06-09 | Acté · Appliqué |
| D-022 | Registre employé SARIS dynamique (autorité matricules) | 2026-06-25 | Acté · Appliqué |
| D-023 | Retrait du scope-creep (alignement strict sur le recueil) | 2026-06-24 | Acté · Appliqué |

---

## D-001 — Architecture offline-first multi-poste (modèle « ulamu »)

- **Date** : 2026-06-23 (validée par l'utilisateur).
- **Statut** : Acté · Appliqué (runtime complet, fusionné sur `main`).
- **Contexte** : CMS SARIS dessert deux sites (Moutela, Nkayi) à la connectivité incertaine. Le besoin
  central exprimé dans le recueil de l'existant est la **continuité de service même hors-ligne** et la
  **synchronisation** entre postes. Le système remplace un suivi « façon Jeannette » sur Excel + papier.
- **Décision** : chaque poste est une **application desktop Electron en mode `local`** embarquant un
  **backend NestJS + une base SQLite** → l'application fonctionne **entièrement hors-ligne** ; elle se
  **synchronise** avec un serveur central dès qu'internet est disponible. Modèle de référence : le
  projet « ulamu ».
- **Alternatives écartées** :
  - *Client distant simple (mode `remote` uniquement)* : initialement envisagé par erreur, écarté car
    il ne couvre pas le travail hors-ligne, exigence forte du terrain.
  - *PWA web seule* : conservée comme client complémentaire (offline léger) mais insuffisante comme
    socle unique (pas de base locale complète embarquée).
- **Justification** : robustesse terrain, multi-poste, indépendance vis-à-vis du réseau ; le web reste
  disponible pour un accès « de partout ».
- **Liens** : D-002, D-015, D-016, D-019, D-020.

## D-002 — Serveur central cloud : API Render + PostgreSQL Neon

- **Date** : 2026-06-23 (architecture) ; déployé le 2026-06-26.
- **Statut** : Acté · Déployé et en ligne.
- **Contexte** : projet de soutenance, **sans accès au serveur local SARIS** → un hébergement cloud est
  nécessaire pour la démonstration et le hub de synchronisation.
- **Décision** : le serveur central (source de vérité + hub de synchro) est l'**API NestJS hébergée sur
  Render** (`https://cms-saris-api.onrender.com`) adossée à **PostgreSQL sur Neon**. Le site web public
  React/Vite (PWA) est servi en statique sur Render (`https://cms-saris-web.onrender.com`).
- **Alternatives écartées** : *on-premise sur le réseau SARIS* — reporté à la phase post-soutenance si
  SARIS valide ; non disponible aujourd'hui.
- **Justification** : déploiement immédiat sans infrastructure locale, HTTPS fourni, plan gratuit
  suffisant pour la démo.
- **Notes / réserves** : le plan gratuit Render/Neon **met le service en veille** après inactivité
  (première requête lente) ; passage à un plan payant prévu pour un central permanent. Les secrets de
  production (JWT, clés de chiffrement) sont saisis dans l'environnement Render (jamais dans le dépôt).
- **Liens** : D-001, D-019.

## D-003 — Réduction à 3 rôles d'habilitation

- **Date** : 2026-06-24 (réduction) ; affinée jusqu'au 2026-06-26.
- **Statut** : Acté · Appliqué.
- **Contexte** : le système comportait historiquement 7 rôles. Le recueil de l'existant ne décrit que
  **deux rôles cliniques** (Infirmier, Médecin-Chef) plus un administrateur système.
- **Décision** : réduire à **3 rôles d'habilitation** centrés sur le besoin réel :
  `ADMIN_SYSTEME`, `MEDECIN_CHEF`, `INFIRMIER`. **MEDECIN fusionné dans MEDECIN_CHEF** — il n'existe
  **pas de rôle d'habilitation `MEDECIN`** au catalogue ; tout médecin reçoit le rôle `MEDECIN_CHEF`
  (un seul rôle médecin = Médecin Chef).
- **Vérification (code de référence)** : `packages/types/src/permissions.ts`
  (`ROLE_CATALOG` / `DEFAULT_ROLE_PERMISSIONS`) ne contient que ces **3 rôles** ; le seed mappe la
  profession `MEDECIN` au rôle `MEDECIN_CHEF` (`seed.ts` : `MEDECIN: 'MEDECIN_CHEF'`).
  - Ne pas confondre avec `ROLES_PERSONNEL` (le **métier / la profession** de `PersonnelMedical` :
    MEDECIN, INFIRMIER, SAGE_FEMME, TECHNICIEN_LAB, ADMINISTRATIF), qui est **descriptif** et non un
    rôle d'habilitation.
- **Rôles supprimés** : `ADMIN_MEDICAL` (fusionné dans `MEDECIN_CHEF`), `INFIRMIER_DELEGUE` et
  `AGENT_RH` (avec leurs tableaux de bord dédiés) ; la profession `MEDECIN` n'a jamais constitué un
  rôle d'habilitation distinct (mappée à `MEDECIN_CHEF`).
- **Alternatives écartées** : *conserver 6/7 rôles* — surcharge non justifiée par le recueil.
- **Justification** : simplification alignée sur l'organisation réelle du centre.
- **Action de régularisation** : aligner la documentation et le script `test-permissions.ps1`
  (encore basé sur des comptes supprimés) sur ces 3 rôles.
- **Liens** : D-004, D-011.

## D-004 — ADMIN_SYSTEME = super-administrateur (catalogue complet)

- **Date** : 2026-06-02 ; intention affinée le 2026-06-21.
- **Statut** : Acté · Appliqué (réduction de périmètre prévue ultérieurement).
- **Contexte** : un débat existait sur la nature d'`ADMIN_SYSTEME` (gouvernance pure vs accès complet).
- **Décision** : `ADMIN_SYSTEME` possède **toutes les permissions** du catalogue (110 aujourd'hui), y
  compris le clinique. Ce rôle pilote **et** supervise l'ensemble. Le mécanisme reste sans bypass : la
  garde vérifie `userPerms.has(p)` ; l'admin a tout **uniquement** parce que son rôle vaut
  `[...ALL_PERMISSIONS]`.
- **Alternatives écartées** : *ADMIN_SYSTEME = gouvernance pure (sans clinique)* — explicitement
  rejetée par l'utilisateur pour la phase actuelle.
- **Justification** : facilite la mise au point et les tests ; un seul rôle peut tout administrer.
- **Évolution prévue (à confirmer)** : l'accès clinique complet est **temporaire (tests)** ; une fois le
  système validé, `ADMIN_SYSTEME` sera **réduit à la gouvernance** (utilisateurs, rôles, audit,
  synchronisation, paramètres — sans le clinique). Ne pas s'opposer à cette réduction le moment venu.
- **Liens** : D-003.

## D-005 — Dossier patient CENTRALISÉ cross-site

- **Date** : 2026-06-26 (validée par l'utilisateur ; remplace l'ancien cloisonnement par site).
- **Statut** : Acté · Appliqué (Phase A, prouvé en E2E).
- **Contexte** : un travailleur muté d'un site à l'autre voyait son dossier recréé (doublon, perte de
  continuité). L'ancienne « décision verrouillée » (un médecin ne voit que ses dossiers / dossier
  non-suivi interdit, cloisonnement par site) cassait la continuité des soins.
- **Décision** : le **dossier patient (identité + historique) suit le patient sur TOUS les sites**. La
  recherche patient au triage est **globale** (un patient existant ailleurs n'est pas recréé). La
  **visite** reste, elle, rattachée au site de l'utilisateur. Côté synchronisation, le patient, tout le
  dossier, tout le parcours de soin et `PersonnelMedical` sont **GLOBAUX** (chaque poste détient tous
  les patients de tous les sites — nécessaire pour le hors-ligne d'un patient muté).
- **Règle métier conservée** : **une seule visite ouverte par patient** (globale).
- **Restent cloisonnés par site** : comptes `Utilisateur` (login hors-ligne), RH opérationnel,
  messagerie.
- **Alternatives écartées** : *dossier cloisonné par site* (modèle initial) — provoquait des doublons
  hors-ligne ; *cloisonnement par médecin* — abandonné (voir D-006/D-007 pour la confidentialité réelle).
- **Justification** : continuité des soins d'un travailleur sur l'ensemble du périmètre SARIS.
- **Liens** : D-006, D-007.

## D-006 — Verrou de confidentialité du médecin-chef (par dossier)

- **Date** : 2026-06-26.
- **Statut** : Acté · Appliqué (Phase B, prouvé en E2E 19/19 avec D-005).
- **Contexte** : le dossier étant ouvert à tous les soignants (D-005), il faut un mécanisme ponctuel de
  confidentialité au lieu du cloisonnement par site/médecin.
- **Décision** : un **médecin-chef** (ou ADMIN_SYSTEME) peut **verrouiller un dossier** (permission
  `patient.lock`). Pour un appelant **hors supervision**, le contenu clinique est **dépouillé/masqué**
  (allergies, antécédents, alertes, mode de vie, données d'emploi vidés ; constantes, alertes et
  documents renvoient une liste vide) et une bannière « Verrouillé » s'affiche (rideau forcé). La
  supervision (`ADMIN_SYSTEME`, `MEDECIN_CHEF`) voit tout. Le dépouillement s'applique aussi côté
  backend **local** (donc hors-ligne).
- **Alternatives écartées** : *confidentialité par site* / *par médecin* — abandonnées (cassaient la
  continuité, cf. D-005).
- **Justification** : confidentialité **par-acte + verrou ponctuel**, compatible avec un dossier
  centralisé.
- **Liens** : D-005, D-007.

## D-007 — Activité clinique scopée à l'initiateur (soignant)

- **Date** : 2026-06-26.
- **Statut** : Acté · Appliqué (Phase C, prouvé en E2E 10/10).
- **Contexte** : un dossier centralisé ne doit pas exposer toute l'activité de chaque soignant à tous.
- **Décision** : l'**activité est scopée à son initiateur**. Les **consultations** sont filtrées par
  `soignantId = moi` ; l'**historique de triage** (visites clôturées/annulées) est filtré par soignant
  pour les non-supervision. La **file active reste partagée** (gestion collective de l'accueil). La
  supervision voit tout.
- **Alternatives écartées** : *tout visible par tous* (état initial : `findAll` filtrait par site
  seulement) — non confidentiel.
- **Justification** : confidentialité opérationnelle sans casser la continuité du dossier ni la gestion
  collective de la file.
- **Liens** : D-005, D-006.

## D-008 — Suppression de la notion de priorité

- **Date** : 2026-06-02.
- **Statut** : Acté · Appliqué (colonnes DB supprimées par migration `remove_priorite`).
- **Contexte** : le processus réel est une **file d'attente par ordre d'arrivée**, pas une file priorisée.
- **Décision** : retirer **complètement** la notion de priorité de l'interface, du backend et de la base.
  La file se gère **par heure d'arrivée** (avec les visites EN_COURS épinglées en tête). Permission
  `visite.set_priority`, endpoint `PATCH .../priorite`, champ et tri associés supprimés ; colonnes
  `priorite` des tables `Visite` et `MotifConsultation` **droppées**.
- **Conservation minimale** : l'enum d'événement `PRIORITE_CHANGE` est gardé **en lecture seule** pour
  l'affichage d'anciens événements d'audit.
- **Alternatives écartées** : *file priorisée (triage médical)* — non conforme au fonctionnement décrit.
- **Justification** : simplification du flux conforme au terrain.
- **Règle d'application** : **ne jamais réintroduire** de champ/colonne/badge/tri de priorité.
- **Liens** : (traçabilité interne).

## D-009 — Catégorie patient = pilote des droits aux bons (cœur métier du recueil)

- **Date** : 2026-06-25.
- **Statut** : Acté · Appliqué (Phase 3 complète, prouvé en E2E).
- **Contexte** : le recueil pose une **règle centrale** : consultation et premiers soins pour **toutes**
  les catégories ; **médicaments (bon de pharmacie) et bons d'examen réservés aux CDI + ayants droit**.
  Initialement la catégorie n'était qu'une étiquette ne pilotant rien.
- **Décision** : la **catégorie patient pilote les droits**. La table `DroitCategoriePatient` est
  **peuplée** (matrice catégorie × prestation) et **lue** par un garde backend
  (`assertPrestationCouverte`) appliqué à la création d'un **bon d'examen** et d'un **bon de pharmacie** :
  `EXAMEN` et `MEDICAMENT` réservés à `ASSURE_CDI` et `AYANT_DROIT_CDI` ; refus `403` sinon. L'**ordonnance
  n'est PAS restreinte** (prescription libre, ≠ prise en charge du médicament). Les **formulaires
  d'inscription sont conditionnels par catégorie** et les données administratives sont **imposées côté
  backend** (CDI/CDD : matricule + fonction + section + service + département ; ayant droit : lien +
  matricule du CDI rattaché ; sous-traitant : société active ; riverain : identité seule).
- **Paramètre** : `PM` catégories patient — 5 catégories du recueil (CDI, Ayant droit CDI, CDD,
  Sous-traitant, Riverain), seedées à 8 valeurs pour compat (extras conservés, retrait jugé destructif).
- **Alternatives écartées** : *catégorie purement informative* (état initial) — ne couvre pas la règle
  de prise en charge.
- **Justification** : conformité au cœur fonctionnel du recueil de l'existant.
- **Liens** : D-010, D-022, D-023.

## D-010 — Bon de pharmacie distinct de l'ordonnance

- **Date** : 2026-06-25.
- **Statut** : Acté · Appliqué (backend prouvé E2E ; impression A4 livrée).
- **Contexte** : auparavant l'ordonnance faisait office de bon de retrait de médicaments. Le recueil
  distingue **ordonnance** (prescription) et **bon de pharmacie** (voucher de retrait, réservé CDI +
  ayants droit).
- **Décision** : créer un **bon de pharmacie distinct** (`BonPharmacie` + lignes), avec permissions
  `bon_pharmacie.{read,create,deliver,cancel,delete}`, cycle EN_ATTENTE → DELIVRE/ANNULE, garde
  catégorie `MEDICAMENT` (D-009) et garde de prescription (D-011), impression A4 dédiée, picker
  médicament alimenté par le référentiel.
- **Alternatives écartées** : *réutiliser l'ordonnance comme bon* — non conforme au recueil.
- **Justification** : séparation prescription / délivrance prise en charge, conforme au recueil §4.3.
- **Liens** : D-009, D-011.

## D-011 — Délégation de prescription (approche PROJECTION, sans migration destructive)

- **Date** : 2026-06-24.
- **Statut** : Acté · Appliqué.
- **Contexte** : le recueil prévoit qu'un **infirmier prescrit uniquement si une délégation lui est
  accordée** par le médecin-chef. Le re-ciblage des clés étrangères (`Consultation.soignantId`,
  `Delegation`) vers `Utilisateur` aurait été destructif et inutile.
- **Décision** : approche **PROJECTION** — `PersonnelMedical` reste la projection clinique (FK
  intactes), le **compte** étant la source. Un garde partagé `assertPeutPrescrire` autorise la
  prescription : `MEDECIN_CHEF`/`ADMIN_SYSTEME` librement ; `INFIRMIER` **seulement** s'il existe une
  `DelegationPrescription` active le concernant. Branché sur la création d'ordonnance, l'ajout de ligne
  et la création de bon d'examen / bon de pharmacie. La granularité « par médicament » a été **retirée**
  (alignée recueil) ; le champ `perimetre` est conservé comme **note textuelle**.
- **Alternatives écartées** : *re-pointage destructif des FK vers Utilisateur* — risque/coût injustifié.
- **Justification** : aligner sur le recueil sans migration destructive, en préservant l'historique.
- **Liens** : D-003, D-009, D-010.

## D-012 — Messagerie interne chiffrée AES-256-GCM façon WhatsApp Web

- **Date** : 2026-06-05 (et itérations v2→v6.4).
- **Statut** : Acté · Appliqué (module complet, conservé lors de l'alignement recueil).
- **Contexte** : besoin d'une communication interne sécurisée entre soignants, cloisonnée par site.
- **Décision** : module de **chat chiffré AES-256-GCM au repos**, expérience « WhatsApp Web » :
  conversations directes et groupes, **pièces jointes chiffrées**, accusés de lecture (3 états),
  réactions emoji, présence en ligne (SSE), médias sophistiqués (album, rogneur vidéo, notes vocales),
  emojis Apple servis depuis un sprite **local** (zéro CDN), **temps réel SSE**. Cloisonnement strict
  par site (anti-IDOR), rate-limit par utilisateur, neutralisation des exécutables (magic-bytes),
  rotation/versionnage de clé (`v2:keyId`, trousseau Vault-ready).
- **Alternatives écartées** : *messagerie en clair* — non conforme aux exigences de confidentialité ;
  *retrait du module lors de l'alignement recueil* — explicitement **gardé** (jugé important).
- **Justification** : coordination interne sécurisée, indispensable au fonctionnement multi-poste.
- **Liens** : D-014.

## D-013 — TOTP / 2FA chiffré at-rest + codes de secours

- **Date** : 2026-06-01.
- **Statut** : Acté · Appliqué (vérifié bout-en-bout).
- **Contexte** : authentification à renforcer ; un bug historique effaçait le TOTP de l'admin au seed.
- **Décision** : **TOTP (2FA)** avec secret **chiffré at-rest en AES-256-GCM** (clé dérivée de
  `TOTP_ENC_KEY`, format `v1:…`, rétro-compat legacy) ; **codes de secours** acceptés au login (usage
  unique, hachés). Le seed **préserve** la 2FA (sauf mode E2E dédié). Réserve : ne jamais changer
  `TOTP_ENC_KEY` après enrôlement (secrets indéchiffrables) ; `migrate reset` réinitialise par nature.
- **Alternatives écartées** : *secret TOTP en clair* — non acceptable ; *2FA obligatoire pour tous* —
  non décidé (self-service + récupération admin).
- **Justification** : sécurité des comptes, récupération possible en cas de perte du téléphone.
- **Liens** : D-021.

## D-014 — Journal d'audit persistant (interceptor global)

- **Date** : 2026-06-05.
- **Statut** : Acté · Appliqué.
- **Contexte** : besoin de traçabilité des actions sensibles ; l'ancien intercepteur d'audit était un
  stub non enregistré.
- **Décision** : **audit persistant** via un décorateur `@Audit('module','Entite')` et un
  `AuditInterceptor` **global** : chaque mutation (POST/PATCH/PUT/DELETE) d'un contrôleur annoté écrit
  une ligne `JournalAudit` (action, module, entité, utilisateur, **IP réelle**, statut SUCCÈS/ERREUR).
  Les contrôleurs d'administration qui s'auto-auditent déjà (avec avant/après) ne sont **pas** annotés
  (anti-double). Messagerie volontairement non annotée (volume + sémantique).
- **Alternatives écartées** : *audit applicatif manuel partout* — non maintenable.
- **Justification** : traçabilité conforme aux attentes d'un système médical.
- **Liens** : D-012.

## D-015 — Soft-delete bi-cible global (tombstones)

- **Date** : 2026-06-08.
- **Statut** : Acté · Appliqué (runtime branché, audité, régressions corrigées).
- **Contexte** : la synchronisation hors-ligne nécessite des **tombstones** (suppressions propagées) ;
  un hard-delete empêcherait la réplication des suppressions.
- **Décision** : **soft-delete global** (`deletedAt`) branché dans `PrismaService`, en **PostgreSQL et
  SQLite** (extension par modèle, allow-list) ; un accesseur **`raw`** (client brut non filtré) sert la
  synchronisation et la « résurrection » (revive). Les modèles hors allow-list gardent le hard-delete.
  Le filtre exclut les tombstones des lectures ; `GlobalExceptionFilter` mappe les contraintes Prisma
  (P2002→409, P2025→404, P2003→409).
- **Alternatives écartées** : *hard-delete + journal séparé de suppressions* — plus fragile pour la
  réconciliation ; *index uniques partiels* — casseraient l'API typée `findUnique` de Prisma.
- **Justification** : prérequis de la synchronisation LWW (D-016) et de la cohérence multi-poste.
- **Réserve** : conséquences systémiques connues (findUnique aveugle aux tombstones, aggregate/groupBy à
  filtrer, plus de cascade FK DB) — corrigées et à connaître pour tout nouveau modèle.
- **Liens** : D-001, D-016.

## D-016 — Synchronisation Last-Write-Wins (LWW)

- **Date** : 2026-06-07.
- **Statut** : Acté · Appliqué (moteur prouvé, 17 tests de conflit).
- **Contexte** : plusieurs postes modifient les mêmes données hors-ligne ; il faut une stratégie de
  réconciliation simple et déterministe.
- **Décision** : réconciliation **Last-Write-Wins** sur `updatedAt`, avec `baseUpdatedAt` pour détecter
  un vrai conflit, **tombstones** (D-015), curseur `SyncState` par poste, pull delta + push idempotent.
  La synchronisation scope les modèles selon leur portée (globale pour le dossier/parcours — cf. D-005 ;
  par site pour comptes, RH opérationnel, messagerie). Cron de purge physique des tombstones côté serveur.
- **Alternatives écartées** : *CRDT / merge champ-à-champ généralisé* — complexité disproportionnée ;
  *résolution manuelle systématique* — non ergonomique (les conflits sont journalisés et supervisés).
- **Justification** : compromis simplicité/robustesse adapté au volume et au contexte.
- **Réserve** : pas d'UI client de résolution de conflits (le serveur les journalise, la supervision les
  affiche).
- **Liens** : D-005, D-015.

## D-017 — Annonces de mise à jour + diffusion d'installeur desktop

- **Date** : 2026-06-26.
- **Statut** : Acté · Appliqué (typecheck 0, E2E annonce 10/10).
- **Contexte** : il faut diffuser les mises à jour de l'application desktop aux postes installés, sans
  infrastructure lourde et **sans migration**.
- **Décision** : **réutiliser les champs existants de `Notification`** pour une **annonce de mise à
  jour** : l'admin saisit un lien de téléchargement + une version → notification `MISE_A_JOUR` de portée
  TOUS, niveau Avertissement, affichée avec un bouton « Télécharger et installer ». Le bridge desktop
  télécharge l'installeur puis le lance après fermeture de l'application (libération du mutex) ;
  l'installeur NSIS est « intelligent » (désinstaller / réinstaller-mettre à jour / annuler, refus si
  l'app tourne). Sur le web, le bouton ouvre l'URL.
- **Alternatives écartées** : *nouvelle table/migration dédiée aux mises à jour* — superflu ;
  *auto-update silencieux uniquement* — conservé en complément, mais l'annonce pilotée par l'admin
  donne le contrôle.
- **Justification** : diffusion simple, contrôlée, sans coût de schéma.
- **Liens** : D-018, D-020.

## D-018 — Badge de connectivité réelle

- **Date** : 2026-06-26.
- **Statut** : Acté · Appliqué.
- **Contexte** : `navigator.onLine` est trompeur ; l'hébergement gratuit qui se réveille provoquait de
  faux « Hors ligne ».
- **Décision** : le badge de connectivité **ping `/health`** du serveur (vraie joignabilité), avec un
  **anti-clignotement** (deux échecs consécutifs avant d'afficher « Hors ligne ») et un timeout relevé
  (8 s).
- **Alternatives écartées** : *se fier à `navigator.onLine`* — faux positifs/négatifs.
- **Justification** : indicateur fiable de la disponibilité réelle du central.
- **Liens** : D-002, D-020.

## D-019 — URL du serveur central HYBRIDE (bakée + formulaire de secours)

- **Date** : 2026-06-23.
- **Statut** : Acté · Appliqué (mécanisme `config.ts`).
- **Contexte** : l'utilisateur tient à pouvoir **changer d'hébergeur / déplacer le serveur** sans
  rebuild, tout en ayant une expérience « zéro config » par défaut.
- **Décision** : URL du central **hybride et dynamique** : **bakée au build** par défaut (connexion
  directe), **formulaire de saisie de secours** (`server-config.html`) si pas d'URL bakée, central
  injoignable ou changement d'hébergeur, et **re-modifiable à tout moment**. Résolution :
  env > `config.json` > `defaults.json` baké > sinon écran de saisie. Il s'agit du `serverUrl` du mode
  `local` (central de synchro).
- **Alternatives écartées** : *URL figée au build uniquement* — bloque le changement d'hébergeur ;
  *toujours demander l'URL au premier lancement* — friction inutile.
- **Justification** : liberté d'hébergement + simplicité d'usage.
- **Liens** : D-001, D-002.

## D-020 — Online-first / offline-fallback du desktop

- **Date** : 2026-06-09.
- **Statut** : Acté · Appliqué (validé E2E par l'utilisateur : messagerie desktop↔web instantanée).
- **Contexte** : en mode purement local, la messagerie desktop↔web ne transitait que par la
  synchronisation périodique (lenteur perçue).
- **Décision** : **online-first / offline-fallback** : **en ligne**, le renderer du desktop parle
  **directement au central** (API + SSE temps réel, comme le web) ; **hors-ligne**, il bascule sur le
  **backend local SQLite** (qui tourne et synchronise en arrière-plan). Activation clé : en backend
  embarqué (SQLite, loopback), la stratégie JWT **saute la vérification de session en base** (un token
  émis par le central est accepté localement) — la révocation immédiate reste effective côté central.
  Hystérésis sur la sonde de connectivité pour éviter le clignotement.
- **Alternatives écartées** : *toujours passer par le local + synchro périodique* — latence inacceptable
  pour la messagerie.
- **Justification** : temps réel quand le réseau est là, continuité hors-ligne sinon.
- **Liens** : D-001, D-018, D-021.

## D-021 — Session unique par utilisateur + révocation immédiate

- **Date** : 2026-06-09 (session unique) ; 2026-06-08 (révocation immédiate).
- **Statut** : Acté · Appliqué.
- **Contexte** : deux postes pouvaient se connecter avec les mêmes identifiants ; une session révoquée
  laissait le jeton d'accès valable jusqu'à expiration.
- **Décision** : **une seule session applicative active par utilisateur** — un nouveau login **révoque
  les autres sessions** et déconnecte instantanément les anciennes via SSE (`SESSION_REVOKED`, ciblé par
  `sid`). La **révocation est immédiate** : la stratégie JWT vérifie le `sid` en base à chaque requête
  (session existante, non révoquée, non expirée). **Exemption critique** : les sessions de
  **synchronisation desktop** (`posteLocalId` présent) ne sont pas révoquées (sinon le login app du
  desktop casserait sa propre synchro). Le refresh token porte un `sid` (UUID de session) pour éviter
  les collisions bcrypt (>72 octets).
- **Alternatives écartées** : *sessions multiples concurrentes* — jugé non sécurisant ; *TTL court sans
  vérif DB* — casserait le jeton de synchro figé ; *Redis* — hors stack PG/SQLite.
- **Justification** : sécurité (un seul poste actif) et révocation effective.
- **Liens** : D-013, D-020.

## D-022 — Registre employé SARIS dynamique (autorité des matricules)

- **Date** : 2026-06-25.
- **Statut** : Acté · Appliqué (backend + UI, prouvé E2E).
- **Contexte** : un matricule CDI/CDD au hasard était accepté (aucune source d'autorité RH). Il faut
  distinguer les **employés SARIS** (qui viennent se faire soigner = patients potentiels) des
  **utilisateurs CMS** (soignants/admin) et des **sociétés sous-traitantes**.
- **Décision** : table **`EmployeSaris`** (matricule unique, identité, fonction/section/service/dépt,
  catégorie CDI/CDD, statut, soft-delete), bâtie **dynamiquement** (pas d'import de liste) : à la
  création patient, le matricule est cherché (`lookup/:matricule`, jamais 404) → reconnu = auto-remplissage,
  inconnu = bloc d'enregistrement du travailleur → création dans le registre. Les rattachements ayant
  droit / sous-traitant pointent vers le registre. Permissions `employe.{read,create,update,delete}`.
  Onglet « Registre employé » dans les Référentiels.
- **Alternatives écartées** : *import statique d'une liste RH* — non disponible (SARIS ne l'a pas
  fournie) ; *aucune table d'autorité (déclaratif pur)* — accepte des matricules fantaisistes.
- **Justification** : autorité de référence des matricules construite au fil de l'eau, sans dépendance à
  un export RH.
- **Réserve / décision liée** : l'authenticité reste **déclarative** (cf. recueil §9 « vérification
  visuelle à chaque visite ») ; un référentiel `EmployeAutorise` alimenté par RH n'est pas retenu pour
  l'instant.
- **Liens** : D-009, D-023.

## D-023 — Retrait du scope-creep (alignement strict sur le recueil)

- **Date** : 2026-06-24.
- **Statut** : Acté · Appliqué (phase 1, vérifié ; modèles laissés dormants en base).
- **Contexte** : l'application avait dérivé au-delà du recueil de l'existant (certificat, suivi
  chronique/grossesse, accident du travail, module RH).
- **Décision** : **retirer le hors-périmètre** au niveau code (workflows, UI, endpoints) en laissant les
  modèles Prisma **dormants** (pas de DROP immédiat) : Certificat (réduit au « Repos maladie »), Suivi
  chronique, Suivi grossesse, Accident du travail, RH (habilitations/absences). « Sorties critiques » →
  renommé **« Évacuations »** (seul flux conservé). Décisions de consultation finales :
  CLOTURE_SIMPLE / PRESCRIPTION / EXAMEN_COMPLEMENTAIRE / EVACUATION.
- **Alternatives écartées** : *DROP immédiat des tables* — différé (migration destructive à confirmer au
  déploiement) ; *conserver les modules hors-recueil* — non conforme à la source de vérité.
- **Justification** : le **recueil de l'existant est la source de vérité** ; l'alignement réduit la
  surface fonctionnelle aux besoins réels.
- **Réserve** : migration de DROP des tables dormantes et purge des gardes résiduels **à régulariser** au
  déploiement (re-baseline des migrations).
- **Liens** : D-003, D-009, D-010, D-011.

---

## Notes de cohérence (points à confirmer / régulariser)

- **Nombre de rôles** (D-003) : tranché à **3 rôles d'habilitation** (ADMIN_SYSTEME, MEDECIN_CHEF,
  INFIRMIER) ; le code de référence (`packages/types/src/permissions.ts`) ne contient pas `MEDECIN` au
  catalogue (profession mappée à MEDECIN_CHEF). Reste à propager dans `test-permissions.ps1`.
- **Réduction d'ADMIN_SYSTEME** (D-004) : accès clinique complet **temporaire** ; réduction de
  gouvernance prévue.
- **Migrations** (D-009, D-023) : développement sur `db push` ; **re-baseline** des migrations formelles
  à effectuer au déploiement (dérive `add_patient_matricule` + DROP des tables dormantes).
- **Documentation** : aligner les anciens cahiers des charges (qui mentionnent encore 6/7 rôles) sur le
  présent registre.

---

*Source de vérité : [[_SOURCE_systeme]] (traçabilité interne). Toute nouvelle
décision structurante doit être ajoutée ici avec un identifiant `D-xxx` et liée depuis les documents
de modules concernés.*
