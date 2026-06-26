# Document 16 — Périmètre de Développement (as-built)

## 1. Objectif

Ce document répond à une question centrale pour la soutenance : **parmi les modules documentés, lesquels sont réellement codés et dans quel état de finition ?**

À la différence des premières versions du cahier des charges — qui anticipaient un MVP partiel limité à cinq modules prioritaires —, ce document reflète désormais **l'état réel de l'application livrée (as-built)**. Le périmètre a très largement dépassé l'ambition initiale : **les 8 modules métier documentés sont codés**, et plusieurs modules transversaux non prévus au départ (messagerie interne chiffrée, notifications temps réel, sauvegarde/restauration de configuration, conditions d'utilisation) ont été implémentés et intégrés.

Ce document distingue donc clairement :

- ce qui est **RÉALISÉ** (codé, opérationnel, démontrable) ;
- ce qui reste volontairement **hors périmètre** (extensions futures explicitement non développées).

---

## 2. Les deux niveaux du projet

| Niveau | Contenu | Valeur pour la soutenance |
|---|---|---|
| **Documenté (analyse & conception)** | 8 modules métier, 79 tables, 20 workflows, ~430 règles de gestion | Démontre la capacité d'analyse et de conception |
| **Codé (implémentation as-built)** | Les **8 modules métier** + modules transversaux (sécurité, gouvernance, messagerie, notifications, synchronisation/sauvegarde, CGU) | Démontre la capacité d'implémentation technique complète |

Le périmètre codé recouvre désormais l'intégralité des modules métier documentés. Les seules briques laissées de côté sont des extensions fonctionnelles clairement identifiées (gestion des stocks pharmaceutiques, délivrance physique des médicaments, interface CNSS), traitées en fin de document.

> **Chiffres clés vérifiés sur le code** : 79 tables Prisma, 22 migrations (dernière : `20260607100000_offline_first_foundations`), 110 permissions granulaires, 6 rôles, **2 sites** (Moutela, Nkayi) et 6 familles de référentiels seedés. Stack : React 19, NestJS 11, Prisma 6, PostgreSQL.

---

## 3. Modules codés (état as-built)

### Module 1 — Sécurité, Authentification et Audit
**Statut : CODÉ INTÉGRALEMENT**

**Justification :** Ce module est le prérequis de tous les autres et le plus exigeant techniquement. Il est implémenté de bout en bout.

**Ce qui est implémenté :**
- Connexion login/mot de passe avec hachage **bcrypt** ;
- Double authentification **TOTP** (otplib) : secret chiffré au repos en **AES-256-GCM** (dérivation scrypt), 8 codes de secours hachés (usage unique) ;
- Émission **JWT** (access token court + refresh token 7 jours, rotation, hash stocké) ;
- Politique de mot de passe paramétrable (longueur, majuscule, minuscule, chiffre, caractère spécial) ;
- **Escalade dynamique de blocage** de compte après échecs (durée × 4 à chaque nouvelle tentative) ;
- Gestion des **sessions** multiples par utilisateur (IP, user-agent, géolocalisation, révocation sélective et en masse) ;
- **Journal d'audit métier** persistant via intercepteur global NestJS (`@Audit` → `JournalAudit` : module, action, entité, IP, statut), déclenché sur toutes les mutations des contrôleurs cliniques et de configuration ;
- **Journal d'authentification** séparé (`JournalAuthentification` : login/logout/TOTP/codes de secours, résultat, IP, user-agent) ;
- **Géolocalisation IP réelle** (service externe `ip-api.com` prioritaire + repli hors-ligne `geoip-lite`, cache 1 h, `trust proxy` configurable).

---

### Module 2 — Référentiels et Droits
**Statut : CODÉ INTÉGRALEMENT (CRUD complet)**

**Justification :** Les référentiels sont consommés par tous les modules. La gestion complète (création, lecture, modification, suppression sûre 409) est implémentée pour chaque service.

**Ce qui est implémenté :**
- **Sites** (CRUD) ;
- **Motifs de consultation** (CRUD) ;
- **Pathologies de référence** (CRUD, marquage « chronique ») ;
- **Médicaments de référence** (CRUD : générique, commercial, dosage) ;
- **Catégories patients** et leurs droits (CRUD) ;
- **Types d'examen** (CRUD : domaine, tarif) ;
- Permissions d'écriture **granulaires par service** (un profil peut gérer les motifs sans toucher aux sites ou aux médicaments) ;
- Diffusion **temps réel** des modifications de référentiels aux postes connectés (invalidation `LIVE_REFERENTIELS` via SSE) ;
- Synchronisation des référentiels vers le poste local (cache hors-ligne en lecture).

---

### Module 3 — Dossier Patient
**Statut : CODÉ INTÉGRALEMENT**

**Justification :** Le dossier patient est l'entité centrale du système.

**Ce qui est implémenté :**
- Création de dossier avec **numérotation séquentielle** et **détection de doublons** (distance de Levenshtein sur nom/prénom normalisés) ;
- Identité administrative complète (+ photo patient, compressée côté serveur via `sharp`) ;
- Catégorie et droits (lecture depuis référentiel) + **historique des changements de catégorie** ;
- **Allergies** (substance, gravité, statut, historique) ;
- **Antécédents** médico-chirurgicaux ;
- **Alertes médicales** (type, gravité CRITIQUE/ÉLEVÉ/MODÉRÉ, résolution datée et motivée) ;
- Contact d'urgence ;
- **Rattachements administratifs** : ayants droit CDI et sous-traitants (création, modification, suppression, historique) ;
- Constantes vitales (consultables depuis le dossier) ;
- Création de patient **hors connexion** (UUID client + rejeu).

---

### Module 4 — Accueil et Triage
**Statut : CODÉ INTÉGRALEMENT**

**Justification :** L'accueil est le point d'entrée de chaque parcours de soin et le lieu où l'offline-first est le plus démontrable.

**Ce qui est implémenté :**
- Ouverture de visite (patient, site, motif, notes d'accueil) avec aperçu des alertes/allergies sévères ;
- Saisie des **constantes vitales** (TA, FC, T°, SpO₂, poids, taille) avec **calcul automatique de l'IMC** ;
- **File d'attente** par ordre d'arrivée (la notion de priorité a été retirée de l'interface) ;
- **Machine d'états** EN_ATTENTE → EN_COURS → CLÔTURÉE (ou ANNULÉE), sans retour en arrière depuis EN_COURS ;
- Orientation vers le soignant responsable ;
- Notes d'accueil et historique d'événements (journalisés via `VisiteEvenement`) ;
- **Fonctionnement hors ligne complet** (mutations locales + synchronisation au retour réseau).

---

### Module 5 — Consultation et Actes Prescrits
**Statut : CODÉ INTÉGRALEMENT**

**Justification :** Module le plus riche médicalement. Le flux complet est implémenté, y compris les actes prescrits associés.

**Ce qui est implémenté :**
- Ouverture/clôture/annulation de consultation (machine d'états OUVERTE → CLÔTURÉE/ANNULÉE) ;
- Examen clinique (symptômes, observations) ;
- **Diagnostics** (pathologie + type PRINCIPAL/SECONDAIRE) ;
- **Ordonnances** : lignes de prescription (médicament, posologie, durée, voie, instructions), validation (signature médecin) ;
- Conclusion et **décision de sortie** (consultation simple, suivi chronique, évacuation, accident du travail) ;
- **Verrou souple de prise en charge** (`pickedUpById`) pour éviter les éditions concurrentes ;
- **Suivi chronique** (ouverture depuis la consultation ou manuellement, fréquence, visites de suivi, clôture motivée) ;
- **Délégation de prescription** : un médecin chef confère un droit de prescription borné (dates, liste de médicaments autorisés) à un infirmier délégué ;
- **Fonctionnement hors ligne** (consultation créée hors connexion).

---

### Module 6 — Acteurs Administratifs
**Statut : CODÉ INTÉGRALEMENT**

> **Changement majeur par rapport aux versions antérieures du cahier des charges :** ce module, initialement classé « documenté, non codé », est désormais **développé et opérationnel**.

**Ce qui est implémenté :**
- **Personnel médical** (CRUD multi-site : médecin, infirmier, sage-femme, technicien de laboratoire, administratif ; matricule unique) ;
- **Délégations de prescription** (médecin chef → infirmier, plage de dates, liste de médicaments autorisés, historique) ;
- **Sous-traitants** (entreprises externes : domaine d'activité, statut, CRUD) ;
- Diffusion temps réel des modifications (`LIVE_ACTEURS`).

---

### Module 7 — Sorties Critiques
**Statut : CODÉ INTÉGRALEMENT**

> **Changement majeur par rapport aux versions antérieures du cahier des charges :** ce module, initialement classé « documenté, non codé », est désormais **développé et opérationnel**.

**Ce qui est implémenté :**
- **Évacuations** : établissement de destination, motif, type de transport, **historique de suivi** (états intermédiaires), statut final RÉALISÉE/ABANDONNÉE ;
- **Accidents du travail** : lieu, type de lésion, tiers responsable, assurances, **suivi clinique** (diagnostics, traitements, date de retour au travail), statut OUVERT/CLOS/REFUS ;
- Ouverture déclenchée par la décision de sortie en consultation.

---

### Module 8 — Bon d'Examen (acte prescrit)
**Statut : CODÉ INTÉGRALEMENT**

**Ce qui est implémenté :**
- Création depuis une consultation (indication clinique + liste d'examens) ;
- Machine d'états EN_ATTENTE → VALIDÉ → REÇU (résultat saisi) → CONSULTÉ (ou ANNULÉ) ;
- Saisie des résultats (fichier + observations) et historique ;
- Diffusion temps réel (`LIVE_BONS_EXAMEN`).

---

## 4. Modules transversaux codés (non prévus initialement)

Ces briques n'étaient pas au périmètre MVP d'origine ; elles ont été développées et intégrées, et constituent une part significative de la valeur démontrable du projet.

### 4.1 — Messagerie interne chiffrée
**Statut : CODÉ INTÉGRALEMENT**

- Conversations **directes** et de **groupe** (cap 50 participants), cloisonnées par site ;
- **Chiffrement AES-256-GCM** du contenu et des pièces jointes au repos, avec **versionnage et rotation de clé** (format `v2:<keyId>:…`, trousseau `MESSAGE_ENC_KEYS`, clés Vault-ready, outil de ré-encryption v1→v2) ;
- Pièces jointes (10 fichiers, 16 Mo chacun) : images, vidéos, audio, documents ; **vérification de signature binaire** (rejet des exécutables déguisés) + assainissement des noms de fichier ;
- Accusés de lecture à 3 états (envoyé / remis / lu), réactions emoji, citations/réponses, édition et suppression (fenêtre 15 min), suppression « pour moi » / « pour tout le monde » ;
- **Présence « en ligne »** temps réel, partage et aperçu médias (rogneur vidéo `ffmpeg.wasm`) ;
- Anti-flood : 40 envois/min/utilisateur.

### 4.2 — Notifications temps réel (SSE)
**Statut : CODÉ INTÉGRALEMENT**

- Flux **Server-Sent Events** (`/notifications/stream`, token JWT en query) ;
- Notifications individuelles ou de diffusion (filtrées par site + permission requise) ;
- Types (clinique, sortie, administratif, système) et niveaux (INFO, SUCCÈS, AVERTISSEMENT, CRITIQUE) ;
- État « lu » par utilisateur, suppression « pour moi », rétention paramétrable ;
- **Invalidations React Query temps réel** (création patient, consultation, bons d'examen…), événements LIVE silencieux pour les référentiels/acteurs/sauvegardes ;
- Sons UI synthétisés et réglables.

### 4.3 — Synchronisation, sauvegarde et restauration
**Statut : CODÉ INTÉGRALEMENT**

- **Offline-first** : PWA (service worker Workbox, NetworkFirst sur les GET API), file de rejeu IndexedDB (Dexie), moteur de synchronisation (`enqueue`/`push`, idempotence par UUID, ordre local) ;
- **Sauvegarde réelle de la configuration** (référentiels, matrice rôles↔permissions, paramètres) au format JSON — les **données cliniques et patients ne sont JAMAIS incluses** (confidentialité et intégrité) ;
- **Restauration non-destructive** (upsert), **cron quotidien** (02 h 00), rétention des 30 dernières sauvegardes ;
- Écran d'administration en 3 zones (terrain offline / sauvegardes / volumétrie).

### 4.4 — Tableau de bord
**Statut : CODÉ INTÉGRALEMENT**

- KPI du jour (visites, consultations, ordonnances, bons d'examen, sorties critiques) avec tendance vs veille ;
- Séries temporelles (7–30 jours), état du personnel, patients à risque ;
- Cloisonnement multi-site.

### 4.5 — Documents imprimables
**Statut : CODÉ INTÉGRALEMENT**

- **Ordonnance A4** et **bon d'examen A4** (gabarit unifié, aperçu modal, impression navigateur, sans dépendance PDF serveur).

### 4.6 — Conditions d'utilisation (CGU)
**Statut : CODÉ INTÉGRALEMENT**

- CGU versionnées (`v1-2026.06`), acceptation tracée (date + version) dans les préférences utilisateur ;
- Porte bloquante à la connexion, re-demande automatique si la version est incrémentée.

### 4.7 — Application de bureau Windows (Electron)
**Statut : CODÉ INTÉGRALEMENT**

- **Installateur NSIS réellement buildable** (`pnpm --filter @cms-saris/desktop dist` → `CMS SARIS-Setup-<v>.exe`, ~91 Mo) ;
- Assistant d'installation guidé (`oneClick:false`) **sans droits administrateur** (`perMachine:false`) ;
- URL du serveur **figeable au build** (`SARIS_DEFAULT_API_URL` → `defaults.json`, zéro écran de configuration) ;
- **2 modes** : connecté à un serveur distant, ou autonome avec API + base SQLite embarquées ;
- Le renderer **est le build web** (même code, 100 % identique) — aucune divergence d'interface entre la version navigateur et le poste de bureau.

### 4.8 — Interface responsive et tableaux de bord par rôle
**Statut : CODÉ INTÉGRALEMENT**

- **Interface responsive** : adaptation mobile/tablette (sidebar en tiroir, panneaux empilés sur petits écrans, tableaux et modales adaptatifs) vérifiée jusqu'à 400 px de large ;
- **Tableaux de bord personnalisés par rôle** : chaque profil (clinique, administratif, RH, gouvernance) dispose de KPI et de visualisations cloisonnés par site et adaptés à son périmètre fonctionnel.

---

## 5. Résumé du périmètre as-built

| Module / Brique | Codé | Niveau |
|---|---|---|
| 1. Sécurité, Authentification et Audit | ✅ | Intégral |
| 2. Référentiels et Droits | ✅ | Intégral (CRUD) |
| 3. Dossier Patient | ✅ | Intégral |
| 4. Accueil et Triage | ✅ | Intégral |
| 5. Consultation et Actes Prescrits | ✅ | Intégral |
| 6. Acteurs Administratifs | ✅ | Intégral *(était non codé)* |
| 7. Sorties Critiques | ✅ | Intégral *(était non codé)* |
| 8. Bon d'Examen | ✅ | Intégral |
| Suivi chronique | ✅ | Intégral |
| Administration & Gouvernance (utilisateurs, rôles, permissions, paramètres) | ✅ | Intégral |
| Messagerie interne chiffrée | ✅ | Intégral *(ajout)* |
| Notifications temps réel (SSE) | ✅ | Intégral *(ajout)* |
| Synchronisation / Sauvegarde / Restauration | ✅ | Intégral |
| Tableau de bord | ✅ | Intégral *(ajout)* |
| Documents imprimables | ✅ | Intégral *(ajout)* |
| Conditions d'utilisation (CGU) | ✅ | Intégral *(ajout)* |
| Application de bureau Windows (Electron / NSIS) | ✅ | Intégral *(ajout)* |
| Interface responsive et tableaux de bord par rôle | ✅ | Intégral *(ajout)* |

---

## 6. Hors périmètre (extensions futures explicitement non développées)

Pour rester honnête sur les limites du projet, les briques suivantes sont **documentées dans l'analyse mais volontairement non développées** :

- **Gestion des stocks pharmaceutiques** : l'ordonnance prescrit ; aucun décompte de stock n'est tenu.
- **Délivrance physique des médicaments** : pas de module de dispensation/pharmacie.
- **Interface CNSS / organismes payeurs** : les catégories et droits sont gérés en interne, sans échange automatisé avec un tiers payeur.
- **Suivi de grossesse complet** : les tables existent (`SuiviGrossesse`, `ConsultationPrenatale`) mais le workflow obstétrical complet n'est pas implémenté côté interface.
- **Internationalisation (i18n)** : l'application est en français (libellés centralisés dans `labels.ts`) ; aucun mécanisme de bascule de langue n'est en place.

Ces choix sont assumés : ils relèvent d'un périmètre fonctionnel supplémentaire qui ne remettait pas en cause la démonstration des parcours de soin et de l'architecture technique.

---

## 7. Scénario de démonstration pour la soutenance

Le scénario complet, démontrable avec l'application livrée, illustre l'enchaînement de bout en bout :

1. **Connexion sécurisée** — l'administrateur se connecte, valide son code **TOTP**, accepte les CGU (démontre la sécurité et la conformité).
2. **Configuration** — création d'un site, d'une catégorie patient et de quelques médicaments ; la modification se propage **en temps réel** sur un second poste (démontre les référentiels + SSE).
3. **Acteurs** — déclaration d'un agent de personnel et d'une **délégation de prescription** à un infirmier (démontre le module Acteurs).
4. **Dossier patient** — l'infirmier crée un dossier, saisit allergies et antécédents ; le système signale un doublon potentiel (démontre le dossier).
5. **Triage hors ligne** — coupure réseau : ouverture d'une visite, saisie des constantes (IMC calculé), orientation du patient ; la file d'attente reste fonctionnelle (démontre l'offline-first).
6. **Consultation et actes** — le médecin ouvre une consultation, pose un diagnostic, prescrit une ordonnance et un bon d'examen ; **impression A4** des documents (démontre les règles métier et les actes prescrits).
7. **Sortie critique** — décision d'évacuation : création de l'évacuation avec suivi (démontre les sorties critiques).
8. **Messagerie** — l'infirmier et le médecin échangent un message **chiffré** avec pièce jointe et accusé de lecture (démontre la messagerie sécurisée).
9. **Retour en ligne** — la connexion revient, la **synchronisation** s'exécute automatiquement ; l'administrateur déclenche une **sauvegarde de configuration** depuis l'écran de synchronisation (démontre le sync engine et la sauvegarde).

Ce scénario couvre l'ensemble des risques du sujet : **sécurité et conformité, offline-first, règles métier médicales, communication interne chiffrée, temps réel et architecture technique**.
