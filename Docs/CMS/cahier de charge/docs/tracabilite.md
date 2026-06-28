# Matrice de traçabilité — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document « as-built » (le système est développé et déployé — voir [[_SOURCE_systeme]]). Cette matrice
> **recoupe** les 16 spécifications de module ([[plan_modules]]), le [[plan_releases]], le [[plan_modules]]
> (contrats d'interface `C-x`), les [[exigences_non_fonctionnelles]] (`ENF-xx`), les [[parametres_metier]]
> (`PM-xx`) et le [[registre_decisions]] (`D-xxx`). Tous les comptages d'**EF**/**CU** et les plages d'IDs
> sont **extraits mécaniquement** des fichiers `MODULE_NN_*.md` (grep des identifiants `**EF-NN-xx**` /
> `CU-NN-xx`). Aucun chiffre n'est inventé ; les écarts constatés sont signalés « à confirmer » ou
> explicitement nuancés. Convention d'identifiants : [[registre_decisions]] §Conventions.

---

## 1. Tableau récapitulatif par module

> Colonnes : numéro de module, intitulé (lien Obsidian vers la spec), nombre d'exigences fonctionnelles
> (**EF**) et de cas d'utilisation (**CU**) **réellement présents** dans la spec, plage d'IDs, et release.
> La colonne **Release (en-tête spec)** reprend le champ `Release` de l'en-tête du module (source : la spec
> elle-même) ; la colonne **Jalon ([[plan_releases]])** reprend le rattachement du §5 du plan de releases.
> Les deux divergent pour trois modules — voir la **note d'écart** sous le tableau (honnêteté as-built).

| # | Module | EF | Plage EF | CU | Plage CU | Release (en-tête spec) | Jalon ([[plan_releases]]) |
|---|--------|----|----------|----|----------|------------------------|---------------------------|
| 01 | [[MODULE_01_securite_authentification\|Sécurité & Authentification]] | 35 | EF-01-01 → EF-01-35 | 7 | CU-01-01 → CU-01-07 | MVP | MVP (`security`) |
| 02 | [[MODULE_02_acces_habilitations\|Accès & Habilitations]] | 20 | EF-02-01 → EF-02-20 | 9 | CU-02-01 → CU-02-09 | MVP | MVP (`admin`) |
| 03 | [[MODULE_03_parametres\|Paramètres système]] | 15 | EF-03-01 → EF-03-15 | 5 | CU-03-01 → CU-03-05 | MVP | MVP (`parametres`, support) |
| 04 | [[MODULE_04_audit_supervision\|Audit & Supervision système]] | 25 | EF-04-01 → EF-04-25 | 10 | CU-04-01 → CU-04-10 | MVP | MVP (accès) + V1/V2 (supervision sync, ré-encryption) |
| 05 | [[MODULE_05_referentiels\|Référentiels]] | 15 | EF-05-01 → EF-05-15 | 7 | CU-05-01 → CU-05-07 | MVP | MVP (`referentiels`) |
| 06 | [[MODULE_06_personnel\|Personnel, Délégations & Employés SARIS]] | 27 | EF-06-01 → EF-06-27 | 4 | CU-06-01 → CU-06-04 | MVP | MVP (`personnel`) |
| 07 | [[MODULE_07_dossier_patient\|Dossier Patient]] | 29 | EF-07-01 → EF-07-29 | 8 | CU-07-01 → CU-07-08 | MVP | MVP (`patient`) + V2 (dossier global synchronisé) |
| 08 | [[MODULE_08_triage\|Triage & File d'attente]] | 22 | EF-08-01 → EF-08-22 | 8 | CU-08-01 → CU-08-08 | MVP | MVP (`triage`) |
| 09 | [[MODULE_09_consultation\|Consultation & Certificats]] | 34 | EF-09-01 → EF-09-34 | 7 | CU-09-01 → CU-09-07 | MVP | MVP (`consultation`) + V2 (flux cible, partiel) |
| 10 | [[MODULE_10_bon_examen\|Bon d'examen]] | 18 | EF-10-01 → EF-10-18 | 6 | CU-10-01 → CU-10-06 | **V1** | **MVP** (`bon-examen`) — *écart* |
| 11 | [[MODULE_11_bon_pharmacie\|Bon de pharmacie]] | 15 | EF-11-01 → EF-11-15 | 6 | CU-11-01 → CU-11-06 | **V1** | **MVP** (`bon-pharmacie`) + V2 (pilotage catégorie) — *écart* |
| 12 | [[MODULE_12_evacuations\|Sorties critiques & Évacuations]] | 19 | EF-12-01 → EF-12-19 | 7 | CU-12-01 → CU-12-07 | MVP | MVP (`sorties-critiques`) |
| 13 | [[MODULE_13_messagerie\|Messagerie interne chiffrée]] | 22 | EF-13-01 → EF-13-22 | 8 | CU-13-01 → CU-13-08 | V1 | V1 (`messagerie`) + V2 (sécurité avancée, médias) |
| 14 | [[MODULE_14_notifications\|Notifications & Annonces]] | 21 | EF-14-01 → EF-14-21 | 8 | CU-14-01 → CU-14-08 | MVP | V1 (`notification`) + V2 (annonces) — *écart* |
| 15 | [[MODULE_15_dashboard\|Tableau de bord & Statistiques]] | 19 | EF-15-01 → EF-15-19 | 5 | CU-15-01 → CU-15-05 | MVP | V1 (`dashboard`) — *écart* |
| 16 | [[MODULE_16_synchronisation\|Synchronisation offline-first]] | 27 | EF-16-01 → EF-16-27 | 6 | CU-16-01 → CU-16-06 | V1 | V1 (`sync`) + V2 (dossier global) |

**Total global : 363 exigences fonctionnelles (EF) · 111 cas d'utilisation (CU)** sur 16 modules.

### Note d'écart « Release » (en-tête spec ↔ [[plan_releases]])

L'écart est **réel et assumé** : l'en-tête de chaque spec porte une étiquette `Release` posée au niveau du
module, tandis que [[plan_releases]] reconstitue *a posteriori* un découpage MoSCoW par jalon (qui peut
rattacher au MVP un module documenté « V1 », ou l'inverse). Divergences constatées :

- **Module 10 (Bon d'examen)** : en-tête **V1**, plan_releases §5 = **MVP** (`bon-examen`).
- **Module 11 (Bon de pharmacie)** : en-tête **V1**, plan_releases §5 = **MVP** (`bon-pharmacie`, + V2 pour le pilotage par catégorie).
- **Module 14 (Notifications)** : en-tête **MVP**, plan_releases §5 = **V1** (`notification`, + V2 annonces).
- **Module 15 (Dashboard)** : en-tête **MVP**, plan_releases §5 = **V1** (`dashboard`).

Ces étiquettes ne sont **pas** des tags de release réels : [[plan_releases]] §1 rappelle que le seul numéro
de version existant dans le code est celui de l'app desktop (`apps/desktop/package.json` = **1.4.1**), et que
le découpage MVP/V1/V2 est une lecture de structuration. **À régulariser** : aligner l'étiquette d'en-tête de
chaque spec sur le jalon de [[plan_releases]] §5 (ou inversement), au choix de l'auteur du cahier des charges.

---

## 2. Matrice Exigence-clé ↔ Module ↔ Release ↔ ENF couverte ↔ Décision

> Lecture transverse : pour chaque **capacité-clé** du système (regroupant un ou plusieurs blocs d'EF), on
> indique le module porteur, le jalon, l'**exigence non fonctionnelle** couverte ([[exigences_non_fonctionnelles]])
> et la **décision structurante** ([[registre_decisions]]) qui la fonde. Les ENF ne sont **pas** citées par
> identifiant dans les specs de module (vérifié : aucune occurrence `ENF-xx` dans les 16 fichiers) ; le
> rattachement ci-dessous est établi par recoupement de contenu (à confirmer ligne à ligne si besoin).

| Exigence-clé | Module(s) | Jalon | ENF couverte | Décision(s) |
|--------------|-----------|-------|--------------|-------------|
| Authentification JWT + session unique + révocation immédiate | 01, 02 | MVP | ENF-04-01/02/03 | D-021 |
| 2FA TOTP chiffré at-rest + codes de secours | 01, 02 | MVP | ENF-04-04 | D-013 |
| Anti brute-force (rate-limit, blocage escaladé) | 01 | MVP | ENF-04-08 | — |
| Catalogue permissions (~110) + 4 rôles (RBAC granulaire) | 02, 01 | MVP | ENF-05-05 | D-003, D-004 |
| Gouvernance des comptes/rôles cloisonnée par site | 02 | MVP | ENF-05-02 | D-005 |
| Configuration système clé-valeur typée (politique mdp, sessions, notifs) | 03 | MVP | ENF-04-01 | D-004 |
| Audit persistant transverse (`@Audit` + interceptor global, IP réelle + géo) | 04 | MVP | ENF-04-06, ENF-04-09 | D-014 |
| Sauvegarde/restauration de configuration (cron + rétention, non destructif) | 04 | V1 | ENF-03-03 | — |
| Supervision de synchronisation (postes, conflits, scopée site) | 04, 16 | V1 | ENF-01-05, ENF-03-02 | D-016 |
| Ré-encryption messagerie post-rotation de clé | 04, 13 | V2 | ENF-04-05 | D-012 |
| Référentiels métier (catégories, motifs, pathologies, médicaments, types) | 05 | MVP | ENF-06-02 | D-008, D-009, D-022, D-023 |
| Registre employé SARIS dynamique (autorité matricules) | 06, 05 | MVP | — | D-022 |
| Délégation de prescription (approche PROJECTION) | 06 | MVP | — | D-011 |
| Dossier patient centralisé cross-site (identité, allergies, antécédents, alertes) | 07 | MVP | ENF-05-01 | D-005 |
| Verrou de confidentialité par dossier (médecin-chef) | 07 | MVP | ENF-05-03 | D-006 |
| Ayants droit par matricule + continuité multi-site | 07, 06 | MVP / V2 | ENF-05-01 | D-005, D-022 |
| Triage : visites + constantes + file par ordre d'arrivée (dédup patient) | 08 | MVP | ENF-05-02 | D-005, D-007, D-008 |
| Activité clinique scopée à l'initiateur (soignant) | 08, 09 | MVP | ENF-05-02 | D-007 |
| Consultation pilotée par la décision + clôture guidée | 09 | MVP | — | D-007, D-023 |
| Documents A4 imprimables (ordonnance, bons, certificat de repos, évacuation) | 09, 10, 11, 12 | MVP | ENF-08-01/02 | D-010, D-023 |
| Bon d'examen (émission + saisie résultats) | 10 | V1/MVP* | — | D-009, D-010 |
| Bon de pharmacie distinct de l'ordonnance + droits par catégorie | 11 | V1/MVP* | — | D-009, D-010 |
| Évacuations / sorties critiques (suivi EN_TRANSPORT/ADMIS) | 12 | MVP | ENF-09-01 | D-023 |
| Messagerie chiffrée AES-256-GCM façon WhatsApp Web (cloisonnée par site) | 13 | V1 | ENF-04-05, ENF-09-01/03 | D-012 |
| Notifications & annonces temps réel (cloche + SSE, présence) | 14 | V1 | ENF-09-01 | D-017 |
| Annonces de mise à jour + diffusion installeur desktop | 14, 16 | V2 | — | D-017 |
| Tableau de bord & statistiques par rôle (type × patho × catégorie, exports) | 15 | V1 | — | D-007, D-008 |
| Offline-first : soft-delete bi-cible + sync LWW + tombstones + `SyncState` | 16 | V1 | ENF-01-01→06, ENF-03-04 | D-001, D-015, D-016 |
| Online-first / offline-fallback du desktop (JWT loopback) | 16, 01 | V1 | ENF-01-06, ENF-03-02 | D-020 |
| Serveur central cloud (Render + Neon) + URL hybride | 16 | V1 | ENF-03-01, ENF-10-* | D-002, D-019 |
| CGU versionnées bloquantes | 01 | V1 | ENF-04-12 | — |
| Rideau de confidentialité (flou poste partagé) | (transverse `apps/web`) | V1 | ENF-05-04 | D-006 |

> \* « V1/MVP\* » = écart d'étiquette signalé au §1 (en-tête spec vs [[plan_releases]]).
> « — » dans la colonne **Décision** ou **ENF** : aucune décision `D-xxx` / aucune `ENF-xx` formellement
> rattachée n'a été identifiée pour cette ligne (la capacité existe, mais elle n'est pas adossée à un
> identifiant dédié — à confirmer si une formalisation est souhaitée).

### 2.1 Couverture des décisions `D-xxx` par module (recensement réel)

> Source : grep des occurrences `D-xxx` dans chaque spec. `D-019` n'est cité dans **aucune** spec de module
> (il relève du déploiement, voir [[plan_releases]] §3.2 et [[registre_decisions]] D-019). `D-017`/`D-018`
> ne sont cités qu'en notifications/dashboard. L'occurrence « D-216 » repérée dans le module 09 est un
> **faux positif** de capture (fragment d'un identifiant `EF-09-…` / chiffre), à ignorer.

| Décision | Modules citant la décision |
|----------|----------------------------|
| D-001 | 04, 05, 08, 09, 10, 11, 12, 16 |
| D-002 | 04, 16 |
| D-003 | 01, 02, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16 |
| D-004 | 01, 02, 03, 04, 05, 08, 09, 10, 11, 12, 15, 16 |
| D-005 | 02, 06, 07, 08, 09, 13, 16 |
| D-006 | 07, 08, 09 |
| D-007 | 07, 08, 09, 12, 15 |
| D-008 | 05, 08, 14, 15 |
| D-009 | 05, 06, 07, 08, 09, 10, 11, 12, 14, 16 |
| D-010 | 07, 09, 10, 11 |
| D-011 | 02, 06, 07, 09, 10, 11 |
| D-012 | 04, 13 |
| D-013 | 01, 02 |
| D-014 | 01, 02, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15 |
| D-015 | 02, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 16 |
| D-016 | 02, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 16 |
| D-017 | 14 |
| D-018 | 04 |
| D-019 | *(aucun module — déploiement, [[plan_releases]] §3.2)* |
| D-020 | 01, 03, 08, 10, 11, 12, 13, 16 |
| D-021 | 01, 02, 14, 16 |
| D-022 | 05, 06, 07 |
| D-023 | 05, 06, 07, 08, 09, 10, 11, 12, 15, 16 |

---

## 3. Couverture des contrats d'interface [[plan_modules]] `C-x` par module

> Source : grep des occurrences `C-x` dans chaque spec, recoupé avec [[plan_modules]] §6 (13 contrats
> définis, C-1 → C-13). La présence d'un `C-x` dans une spec signifie que le module **réalise** (émetteur)
> ou **consomme** (récepteur) ce contrat. Le module 04 cite « C-01 » (= C-1, graphie à harmoniser).

| Module | Contrats cités dans la spec |
|--------|-----------------------------|
| 01 — Sécurité | C-9, C-10 |
| 02 — Accès & Habilitations | C-8, C-9, C-10, C-11 |
| 03 — Paramètres | C-10 |
| 04 — Audit & Supervision | C-1 (« C-01 »), C-8, C-9, C-10, C-11, C-12 |
| 05 — Référentiels | C-6, C-8, C-9, C-11, C-12 |
| 06 — Personnel | C-1, C-7, C-8, C-9, C-11, C-12 |
| 07 — Dossier Patient | C-1, C-3, C-6, C-7, C-8, C-9, C-11 |
| 08 — Triage | C-1, C-2, C-6, C-8, C-9, C-11, C-12 |
| 09 — Consultation | C-2, C-3, C-4, C-6, C-8, C-9, C-11, C-12, C-13 |
| 10 — Bon d'examen | C-4, C-5, C-6, C-9, C-11, C-12 |
| 11 — Bon de pharmacie | C-2, C-4, C-6, C-8, C-9, C-11, C-12 |
| 12 — Évacuations | C-4, C-8, C-9, C-11, C-12 |
| 13 — Messagerie | C-8, C-9 |
| 14 — Notifications | C-8, C-9, C-10 |
| 15 — Dashboard | C-9, C-13 |
| 16 — Synchronisation | C-8, C-9, C-12 |

### 3.1 Couverture inverse : chaque contrat est-il couvert ?

> Un contrat est « couvert » si au moins un module l'émet et un module le consomme (cf. [[plan_modules]] §6,
> qui précise émetteur → récepteur). Les contrats **C-2, C-3, C-4, C-5, C-6, C-13** sont des collaborations
> **par la donnée** (mêmes entités Prisma) plutôt que par `imports` NestJS direct ([[plan_modules]] §6, note
> d'honnêteté).

| Contrat | Intitulé ([[plan_modules]] §6) | Modules impliqués | Couvert ? |
|---------|-------------------------------|-------------------|-----------|
| C-1 | Création de visite et constantes (Triage → Patient) | 04, 06, 07, 08 | Oui |
| C-2 | Prise en charge de la visite (Triage → Consultation) | 08, 09, 11 | Oui |
| C-3 | Enregistrement des actes cliniques (Consultation → Patient) | 07, 09 | Oui |
| C-4 | Émission de documents cliniques (Consultation → bons / évacuation) | 09, 10, 11, 12 | Oui |
| C-5 | Saisie des résultats d'examen (BonExamen → Patient) | 10 | Partiel (1 module nommé ; récepteur Patient implicite, vérifié dans la spec 07/10) |
| C-6 | Référentiels consommés (Referentiels → modules cliniques) | 05, 06, 07, 08, 09, 10, 11 | Oui |
| C-7 | Identité employé (Employe → Patient) | 06, 07 | Oui |
| C-8 | Notification temps réel (modules → Notification) | 02, 04, 05, 06, 07, 08, 09, 11, 12, 13, 14, 16 | Oui |
| C-9 | Authentification & autorisation (Security → controllers) | tous (01–16) | Oui |
| C-10 | Configuration système (Parametres → Security/Notif/Admin) | 01, 02, 03, 04, 14 | Oui |
| C-11 | Journalisation d'audit (`@Audit` → interceptor global) | 02, 04, 05, 06, 07, 08, 09, 10, 11, 12 | Oui |
| C-12 | Synchronisation offline-first (tables sync ↔ Sync) | 04, 05, 06, 08, 09, 10, 11, 12, 16 | Oui |
| C-13 | KPI & statistiques (données → Dashboard) | 09, 15 | Oui |

> **Conclusion couverture contrats** : les **13 contrats** `C-1 → C-13` de [[plan_modules]] §6 sont couverts.
> Seul **C-5** n'est nommé que dans un module (10) ; le récepteur « dossier Patient » est documenté dans les
> specs 07 et 10 (saisie infirmière des résultats), donc le contrat est réel — la double-citation explicite
> côté module 07 serait à ajouter pour la symétrie (cosmétique).

---

## 4. Vérification : chaque module a des EF identifiées, et signalement des trous

> Méthode : extraction des identifiants `**EF-NN-xx**` et `CU-NN-xx` puis contrôle de **continuité** des
> numéros (de 01 jusqu'au max), par module. Un « trou » = un numéro manquant dans la séquence attendue.

| # | Module | EF présentes ? | Séquence EF | Trous EF | Séquence CU | Trous CU |
|---|--------|----------------|-------------|----------|-------------|----------|
| 01 | Sécurité | Oui (35) | 01 → 35 | **aucun** | 01 → 07 | aucun |
| 02 | Accès & Habilitations | Oui (20) | 01 → 20 | **aucun** | 01 → 09 | aucun |
| 03 | Paramètres | Oui (15) | 01 → 15 | **aucun** | 01 → 05 | aucun |
| 04 | Audit & Supervision | Oui (25) | 01 → 25 | **aucun** | 01 → 10 | aucun |
| 05 | Référentiels | Oui (15) | 01 → 15 | **aucun** | 01 → 07 | aucun |
| 06 | Personnel | Oui (27) | 01 → 27 | **aucun** | 01 → 04 | aucun |
| 07 | Dossier Patient | Oui (29) | 01 → 29 | **aucun** | 01 → 08 | aucun |
| 08 | Triage | Oui (22) | 01 → 22 | **aucun** | 01 → 08 | aucun |
| 09 | Consultation | Oui (34) | 01 → 34 | **aucun** | 01 → 07 | aucun |
| 10 | Bon d'examen | Oui (18) | 01 → 18 | **aucun** | 01 → 06 | aucun |
| 11 | Bon de pharmacie | Oui (15) | 01 → 15 | **aucun** | 01 → 06 | aucun |
| 12 | Évacuations | Oui (19) | 01 → 19 | **aucun** | 01 → 07 | aucun |
| 13 | Messagerie | Oui (22) | 01 → 22 | **aucun** | 01 → 08 | aucun |
| 14 | Notifications | Oui (21) | 01 → 21 | **aucun** | 01 → 08 | aucun |
| 15 | Dashboard | Oui (19) | 01 → 19 | **aucun** | 01 → 05 | aucun |
| 16 | Synchronisation | Oui (27) | 01 → 27 | **aucun** | 01 → 06 | aucun |

**Résultat de la vérification :**

- **Les 16 modules possèdent des EF avec identifiants** `EF-NN-xx` (aucun module sans exigence).
- **Aucun trou de numérotation** détecté, ni en EF ni en CU : toutes les séquences sont **contiguës** de
  `01` au maximum constaté (contrôle de continuité automatisé sur les 16 fichiers).
- **Total global vérifié : 363 EF et 111 CU.** Détail des sous-totaux dans le tableau du §1.
- Seul écart résiduel signalé : les **étiquettes de release** d'en-tête de specs divergent de [[plan_releases]]
  pour les modules 10, 11, 14, 15 (cf. §1, note d'écart) — écart **documentaire**, pas un trou d'exigence.

> Remarque : la continuité des IDs garantit l'absence de **trou de numérotation**, mais ne garantit pas que
> chaque EF soit *implémentée* dans le code à 100 % — ce dernier point relève des sections « Risques et points
> ouverts » de chaque spec et des fiches mémoire `project_*.md`. Les états « à confirmer » y sont signalés
> (ex. portée de synchro de `ParametreSysteme`, comportement hors-ligne 2FA, etc.).

---

## 5. Renvois

- Vérité de référence : [[_SOURCE_systeme]].
- Plan de versions (jalons MVP/V1/V2, MoSCoW) : [[plan_releases]].
- Modules & contrats d'interface `C-x` : [[plan_modules]].
- Exigences non fonctionnelles `ENF-xx` : [[exigences_non_fonctionnelles]].
- Décisions structurantes `D-xxx` : [[registre_decisions]].
- Paramètres métier `PM-xx` : [[parametres_metier]].
- Spécifications détaillées par module : [[MODULE_01_securite_authentification]] … [[MODULE_16_synchronisation]].

> Tous les comptages et plages d'IDs de ce document ont été extraits mécaniquement des fichiers
> `02_modules/MODULE_NN_*.md` au 2026-06-26 ; les rattachements ENF/`D-xxx` aux exigences-clés (§2) sont
> établis par recoupement de contenu (les specs ne citent pas les `ENF-xx` par identifiant) et signalés
> « à confirmer » là où aucun identifiant dédié n'existe.
