# Étude de l'existant — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document de cadrage « as-built » : il décrit l'existant que CMS SARIS remplace, les solutions comparables du marché, et les différenciateurs réels du système **tel que développé et déployé**. Référence de vérité : [[_SOURCE_systeme]]. Voir aussi [[vision]], [[glossaire]] et [[plan_modules]].
>
> Source primaire de l'existant : recueil de l'existant fourni par le commanditaire (`C:\Users\bouwa\Downloads\CMS SARIS_\recueil_existant_CMS.txt`). Toute affirmation sur les pratiques actuelles en découle ; les affirmations sur le marché tiers sont marquées **« à vérifier »** lorsqu'elles ne reposent pas sur une source certaine.

---

## 1. L'existant interne : un suivi Excel + papier

### 1.1 Contexte

Le Centre Médico-Social de **SARIS-CONGO** (sucrerie, Congo-Brazzaville) opère **deux sites distincts et autonomes** — **Moutela** et **Nkayi** — implantés dans la même ville. Le personnel médical est **commun aux deux sites** et tourne entre eux selon un planning de permutation. Cette organisation implique, selon le recueil, qu'**aucun système d'information centralisé n'existe actuellement** entre les deux sites.

Le suivi est aujourd'hui assuré « à la main » : un fonctionnement **tableur Excel + papier** (désigné en interne « suivi façon Jeannette »). Le **carnet de santé individuel papier** est le seul support de circulation de l'information entre les étapes du parcours patient (triage → consultation → registre).

### 1.2 Le processus actuel (rappel)

Le parcours décrit dans le recueil est **intégralement papier** :

1. Triage et accueil par l'infirmière (recueil administratif selon la catégorie, constantes vitales, mode de vie, motif), consigné dans le carnet.
2. Transfert du carnet au Médecin Chef (ou infirmier délégué) pour la consultation et la décision médicale.
3. Retour au triage, enregistrement dans le **registre papier**, puis émission des bons (pharmacie / examen) **réservés aux CDI et ayants droit**.

Les droits de prise en charge dépendent de la **catégorie de patient** (CDI, ayants droit CDI, CDD, sous-traitant, riverain) ; la prise en charge complète (médicaments + bons d'examen) est réservée exclusivement aux **personnels CDI et à leurs ayants droit**. Cette règle reposait sur la **vigilance humaine** (vérification visuelle du badge / carnet à chaque visite).

### 1.3 Limites documentées de l'existant

| # | Limite | Conséquence opérationnelle |
|---|---|---|
| L1 | **Pas de dossier patient unique** | Un même patient vu sur Moutela puis Nkayi n'a pas d'historique consolidé ; l'information ne circule qu'avec le carnet papier qu'il transporte. |
| L2 | **Multi-site non synchronisé** | Aucune cohérence automatique entre les deux sites ; ressaisies, divergences, pertes ; pas de vue consolidée. |
| L3 | **Pas de hors-ligne fiable** | Le carnet papier « fonctionne » hors connexion mais au prix de la fragmentation totale de l'information ; aucune réconciliation possible. |
| L4 | **Comptages manuels** | Les statistiques (par catégorie, pathologie, période) sont produites par dépouillement manuel du registre / Excel — laborieux et faillible. |
| L5 | **Traçabilité faible** | Pas de journal des actes, des accès, ni des décisions médicales ; pas de preuve d'autorisation des prescriptions. |
| L6 | **Droits par catégorie tenus « de tête »** | La réservation des bons aux CDI + ayants droit dépend de la mémoire et de la vigilance de l'infirmière, sans garde-fou système. |
| L7 | **Pas de sécurité d'accès** | Aucun contrôle d'identité numérique, aucun cloisonnement, aucune confidentialité technique des données cliniques. |
| L8 | **Pas d'autorité sur les matricules** | Aucune source de vérité numérique pour reconnaître un matricule CDI/CDD ; reconnaissance purement déclarative et visuelle. |

> Ces limites constituent les besoins fondateurs de CMS SARIS ; elles alimentent les exigences fonctionnelles et non fonctionnelles (voir [[vision]] et les fiches `02_modules/`).

---

## 2. Solutions comparables (DPI / dossier patient informatisé)

> **Avertissement d'honnêteté** : aucune étude de marché formelle n'a été conduite dans le cadre du projet (contexte de **soutenance de stage**). Cette section décrit **génériquement** des catégories d'outils. Les noms de produits précis ne sont pas affirmés ; les affirmations comparatives sont à considérer comme **« à vérifier »**.

### 2.1 Catégories de solutions existantes

| Catégorie | Description générique | Adéquation au besoin CMS SARIS |
|---|---|---|
| **DPI hospitaliers commerciaux** | Dossier patient informatisé complet pour établissements de santé (spécialités, hospitalisation, plateau technique, facturation). | Surdimensionnés pour des **soins de premier recours** en centre médico-social ; coût, complexité et dépendance réseau élevés. |
| **DPI / EHR open-source** | Solutions libres de dossier médical (génériquement : projets de type « open-source EHR » orientés cliniques / pays à ressources limitées). **À vérifier** pour tout nom précis. | Potentiellement adaptables, mais non taillés pour la **règle métier par catégorie de patient SARIS** ni pour le **mode hors-ligne multi-poste** spécifique. |
| **Tableurs / outils bureautiques** | Excel + documents papier (l'existant actuel). | Mode en place ; limites L1–L8 ci-dessus. |
| **SGL / laboratoire, SIRH, facturation** | Systèmes spécialisés (laboratoire, ressources humaines, facturation/assurance). | Hors périmètre : CMS SARIS n'est ni un SGL, ni un SIRH, ni un système de facturation (voir anti-périmètre dans [[vision]]). |

### 2.2 Pourquoi une solution sur mesure

Les solutions du marché (DPI commerciaux ou libres) ne répondent pas, en l'état, à trois contraintes structurantes du CMS SARIS :

- la **règle métier propre à SARIS** où la **catégorie de patient pilote les droits** aux bons (pharmacie / examen) ;
- le besoin d'un fonctionnement **offline-first multi-poste** robuste face à un réseau instable, avec **synchronisation** entre sites ;
- l'intégration d'outils de **collaboration interne sécurisée** (messagerie chiffrée) dans un même produit cloisonné par site.

> Le choix d'un développement sur mesure relève d'une décision d'architecture documentée séparément (voir les ADR `03_*` / [[plan_modules]]). La présente section ne tranche pas le « build vs buy » : elle constate l'inadéquation des catégories d'outils observées au besoin spécifique.

---

## 3. Différenciateurs réels de CMS SARIS

> Ces différenciateurs sont **as-built** (vérifiés dans le code et la mémoire projet). Chemins cités pour les faits techniques.

### 3.1 Offline-first multi-poste

L'application de bureau (**Electron, Windows**) embarque un **backend NestJS + une base SQLite** : elle fonctionne **pleinement hors-ligne** et se **synchronise** avec le serveur central à la reconnexion. La réconciliation suit une stratégie **« dernier écrit gagne » (LWW)** avec **tombstones** (soft-delete) et **curseur de synchronisation par poste** (`SyncState`).

- Code : `apps/desktop/electron`, `apps/api/src/modules/sync`, schémas `packages/db/prisma/schema.prisma` (PostgreSQL central) et `packages/db/prisma/sqlite/schema.prisma` (desktop).
- Le serveur central (cloud) reste la source de vérité : **API NestJS sur Render**, **PostgreSQL sur Neon** ; un **site web public PWA** offre un accès direct au central avec offline léger (service worker + file de rejeu IndexedDB).

C'est la réponse directe aux limites **L2** (multi-site non synchronisé) et **L3** (pas de hors-ligne fiable).

### 3.2 Dossier centralisé cross-site + verrou de confidentialité

Le **dossier patient suit le patient sur les deux sites** : identité, allergies, antécédents, alertes, mode de vie, données d'emploi sont consolidés (`apps/api/src/modules/patient`). Le **MEDECIN_CHEF** (et l'ADMIN_SYSTEME) peut **verrouiller un dossier** en confidentialité ; l'activité clinique reste par ailleurs **scopée à son initiateur** (consultations / triage par soignant), avec un **rideau de confidentialité** (flou) sur les zones cliniques.

Réponse aux limites **L1** (pas de dossier unique) et **L7** (pas de confidentialité technique).

### 3.3 Droits pilotés par la catégorie de patient

Le **cœur métier du recueil** est implémenté : la **catégorie de patient pilote les droits** aux prestations. Les **bons de pharmacie et d'examen** sont réservés aux **assurés CDI et à leurs ayants droit**, par une garde appliquée **côté serveur** (`apps/api/src/common/droits-categorie.ts`, fonction `assertPrestationCouverte`), branchée sur la création des bons d'examen et des **bons de pharmacie** (`modules/bon-pharmacie`, distinct de l'ordonnance). La matrice `DroitCategoriePatient` est peuplée par le seed.

Réponse aux limites **L6** (droits tenus « de tête »). Un **registre employé dynamique** (`EmployeSaris`) reconnaît les matricules CDI/CDD et adresse partiellement **L8** ; la reconnaissance reste néanmoins **déclarative** tant qu'une liste d'autorité RH n'est pas fournie par SARIS.

### 3.4 Messagerie interne chiffrée intégrée

Une **messagerie interne** de type WhatsApp Web (chiffrement **AES-256-GCM** au repos, groupes, médias, réactions, accusés de lecture, présence) est **cloisonnée par site** et **temps réel (SSE)** (`apps/api/src/modules/messagerie`). Elle remplace les échanges informels et fournit un canal de collaboration **entre soignants** (pas un canal patient).

### 3.5 Sécurité, traçabilité et pilotage

- **Sécurité** : authentification JWT à **session unique** (révocation immédiate), **2FA TOTP** chiffrée at-rest, permissions par rôle (**110**, `packages/types/src/permissions.ts`), **4 rôles** (ADMIN_SYSTEME, MEDECIN_CHEF, MEDECIN, INFIRMIER — voir [[MODULE_02_acces_habilitations]]).
- **Traçabilité** : **journal d'audit persistant** (`@Audit` + interceptor global), **IP réelle + géolocalisation hors-ligne**, conditions d'utilisation (CGU). Réponse à la limite **L5**.
- **Pilotage** : **tableaux de bord et statistiques** par rôle (stats type × pathologie × catégorie), **exports CSV/PDF** (`modules/dashboard`). Réponse à la limite **L4** (comptages manuels).

### 3.6 Synthèse différenciateurs ↔ limites

| Différenciateur CMS SARIS | Limites de l'existant levées |
|---|---|
| Offline-first multi-poste (sync LWW) | L2, L3 |
| Dossier centralisé cross-site + verrou | L1, L7 |
| Droits pilotés par la catégorie (garde serveur) | L6 (et L8 partiellement) |
| Messagerie chiffrée intégrée cloisonnée par site | — (nouvelle valeur collaborative) |
| Audit + IP/géo + sécurité JWT/TOTP | L5, L7 |
| Tableaux de bord + exports | L4 |

---

## 4. Conclusion

L'existant (Excel + papier, carnet de santé individuel) couvre le besoin de manière fragmentée, sans dossier unique, sans synchronisation inter-sites, sans traçabilité ni garde-fou sur les droits par catégorie. Les solutions du marché observées (DPI commerciaux ou libres) ne répondent pas, en l'état, à la combinaison **offline-first multi-poste + règle métier par catégorie + collaboration chiffrée cloisonnée** propre à SARIS — sous réserve qu'aucune étude de marché formelle n'ait été menée (**à vérifier**). CMS SARIS, tel que développé et déployé, lève les limites L1 à L7 et adresse partiellement L8, en remplaçant le suivi « façon Jeannette » par une application médico-sociale offline-first cohérente sur les deux sites.

> Suite logique : [[vision]] (proposition de valeur, anti-périmètre), [[plan_modules]] (modules), fiches `02_modules/`.
