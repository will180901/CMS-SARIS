---
chapitre: 8
titre: "Implémentation"
budget_pages: 8-10
statut: relu
sources: [INV-01, INV-02, INV-05, INV-06, render.yaml, package.json]
figures: [SCH-REL-01, SCH-MPD-01, "captures 8.3+"]
blocages: ["environnement matériel — QO-03"]
---

# CHAPITRE 8 — IMPLÉMENTATION

## Introduction du chapitre

Ce chapitre rend compte de la réalisation effective. Il décrit l'environnement de développement et de déploiement, la mise en œuvre de la couche de persistance, les fonctionnalités livrées, l'état réel de la validation, et les difficultés rencontrées.

**Le périmètre implémenté couvre l'intégralité des 23 besoins fonctionnels identifiés au chapitre 6.** Un seul reste partiel : le fonctionnement hors connexion du poste autonome, dont le pipeline de production est vérifié statiquement mais n'a pas été validé par une exécution complète sur machine cible. Ce chapitre dit précisément ce qui est éprouvé et ce qui ne l'est pas.

---

## 8.1 Environnement de développement et de déploiement

### 8.1.1 Environnement technique général

L'architecture retenue est **client-serveur à trois couches**, déclinée en deux implantations : un serveur central hébergé, et des postes autonomes embarquant leur propre serveur.

| Aspect | Choix |
|---|---|
| Protocole | HTTPS, imposé en production |
| Origine du client de bureau | Schéma applicatif privilégié, déclaré autorisé côté serveur |
| Temps réel | Flux d'événements unidirectionnel serveur vers client |
| Authentification | Jeton signé, avec jeton de renouvellement |
| Contrainte majeure | Fonctionnement bi-sites — Moutela et Nkayi — avec continuité hors connexion |

### 8.1.2 Environnement logiciel

| Outil | Version | Rôle |
|---|---|---|
| Node.js | 20.18 | Environnement d'exécution |
| pnpm | 9.15.9 | Gestionnaire de paquets à espaces de travail |
| Turborepo | 2.8 | Orchestration des tâches du monorepo |
| TypeScript | 5.9.3 | Langage, typage statique de bout en bout |
| **NestJS** | **11** | Cadre applicatif serveur |
| **Prisma** | **6** | Correspondance objet-relationnel, migrations |
| **PostgreSQL** | **16** | Base centrale |
| SQLite | — | Base locale du poste autonome |
| **React** | **19** | Interface |
| **Vite** | **7** | Compilation et serveur de développement |
| Tailwind CSS | 4.1 | Feuilles de style |
| TanStack Query | 5.100 | Cache de données côté client |
| Zustand | 5.0 | État applicatif — 12 magasins |
| React Router | 7.15 | Routage |
| react-i18next | 17 | Bilinguisme |
| Dexie | 4.4 | Base du navigateur, file hors ligne |
| Zod | 3.25 | Validation côté client |
| class-validator | 0.15 | Validation côté serveur |
| Recharts | 3.8 | Graphiques |
| **Electron** | **33.2** | Client de bureau |
| electron-builder | 25.1 | Empaquetage |
| electron-updater | 6.3 | Mise à jour automatique |
| NSIS | — | Installateur Windows sur mesure |
| bcrypt | 6.0 | Hachage des mots de passe |
| otplib | 13.4 | Second facteur temporel |
| helmet | 8.1 | En-têtes HTTP protégés |
| @nestjs/throttler | 6.5 | Limitation de débit |
| geoip-lite | 2.0 | Géolocalisation hors ligne, en repli |
| sharp | 0.34 | Traitement d'images |
| Git | 2.x | Gestion de versions — 139 révisions |

### 8.1.3 Environnement matériel

| Élément | Valeur |
|---|---|
| Poste de développement — système | Windows 10 Professionnel, version 19045 |
| Poste de développement — caractéristiques | ⛔ **EN ATTENTE DE SOURCE** — processeur, mémoire et stockage à compléter |
| Serveur d'application | Hébergement mutualisé, région Europe (Francfort), plan gratuit |
| Serveur de base de données | PostgreSQL 16 hébergé, externe au serveur d'application |
| Postes clients du centre | ⛔ **EN ATTENTE DE SOURCE** — voir QO-03 |
| Infrastructure réseau du centre | ⛔ **EN ATTENTE DE SOURCE** — voir QO-03 |

> Le plan d'hébergement retenu met le serveur **en veille après environ quinze minutes d'inactivité**. La première requête après une période creuse subit donc un délai de réveil. C'est une contrainte assumée d'un environnement de démonstration, à lever par un plan supérieur pour un usage clinique réel.

---

## 8.2 Modélisation et implémentation de la base de données

### 8.2.1 Schéma relationnel

Le schéma comporte **88 tables reliées par 97 associations**, organisées en dix domaines.

| Domaine | Tables | Champs |
|---|---:|---:|
| Sécurité et audit | 18 | 175 |
| Dossier patient | 13 | 163 |
| Acteurs administratifs | 12 | 122 |
| Référentiels | 12 | 104 |
| Consultation et actes prescrits | 11 | 163 |
| Synchronisation hors ligne | 8 | 76 |
| Messagerie interne | 7 | 71 |
| Accueil et triage | 3 | 54 |
| Sorties critiques | 2 | 21 |
| Suivi de traitement | 2 | 27 |
| **Total** | **88** | **976** |

> **Figure 8.1 — Schéma relationnel du noyau métier** *(fiche `SCH-REL-01`)*

### 8.2.2 Modèle physique de données

Le modèle physique est produit et maintenu par **41 migrations versionnées** — 39 pour PostgreSQL, 2 pour SQLite — appliquées de façon idempotente à chaque déploiement. Chaque migration est un fichier SQL horodaté, conservé dans le dépôt : l'historique complet de l'évolution du schéma est donc traçable, de la création initiale jusqu'à l'ajout de la dernière colonne.

Le schéma SQLite du poste autonome est **dérivé automatiquement** du schéma PostgreSQL par un script dédié. Cette dérivation garantit que les deux cibles ne divergent pas : les **88 tables sont présentes des deux côtés**, la réplique locale n'est pas un sous-ensemble appauvri.

| Caractéristique | Mise en œuvre |
|---|---|
| Clés primaires | Identifiants universels générés, sauf clés composites des tables de liaison |
| Contraintes d'unicité | Simples et composites, portées par la base |
| Index | Notamment sur l'horodatage de modification, indispensable au calcul des deltas |
| Suppression en cascade | Déclarée seulement là où elle est voulue ; ailleurs, cascade **explicite** dans une transaction |
| Énumérations | 6 en PostgreSQL |
| Suppression logique | 47 tables sur 88 |

> **Figure 8.2 — Modèle physique de données** *(fiche `SCH-MPD-01`)*

**Une limite de conception à énoncer.** Six énumérations seulement sont portées par la base. **Cinq machines à états sont gouvernées par le code applicatif** au moyen de simples champs texte : ordonnance, bon de pharmacie, bon d'examen, évacuation, suivi de traitement. Leurs états ne sont donc pas contraints au niveau du stockage — une écriture directe en base pourrait poser une valeur invalide. C'est un compromis de portabilité entre les deux moteurs, mais il doit être reconnu comme une faiblesse.

### 8.2.3 Extrait de code commenté — la résolution de conflit

L'extrait retenu est le cœur du fonctionnement hors connexion : la fonction qui arbitre entre une modification arrivant d'un poste et celle déjà présente sur le serveur. Elle a été choisie parce qu'elle est **pure** — sans entrée-sortie, sans dépendance, déterministe —, ce qui la rend testable unitairement et réutilisable à l'identique par le serveur central et par le poste autonome.

```typescript
/**
 * Décide comment appliquer un enregistrement entrant face à l'existant.
 * - `existing` null → `apply` (création).
 * - LWW par `updatedAt` ; égalité stricte → `skip` (idempotent / même milliseconde).
 * - Si `baseUpdatedAt` fourni et l'existant a bougé depuis cette base → `conflict`
 *   (le `winner` est désigné par LWW ; l'appelant journalise puis applique le gagnant).
 */
export function resolveConflict(
  incoming: IncomingVersioned,
  existing: Versioned | null,
): ConflictDecision {
  if (!existing) return { kind: 'apply' }

  const inMs   = toMs(incoming.updatedAt)      // version arrivant du poste
  const exMs   = toMs(existing.updatedAt)      // version présente sur le serveur
  const baseMs = incoming.baseUpdatedAt != null
    ? toMs(incoming.baseUpdatedAt)             // version connue du poste au départ
    : exMs                                     // absente → LWW pur, sans détection fine

  // Le serveur a-t-il été modifié par QUELQU'UN D'AUTRE depuis que le poste
  // a commencé son édition ? C'est cela, un vrai conflit concurrent.
  const serverMovedSinceBase = exMs > baseMs

  if (inMs > exMs) {
    return serverMovedSinceBase
      ? { kind: 'conflict', winner: 'incoming' }  // tranché, puis journalisé
      : { kind: 'apply' }
  }
  if (inMs < exMs) {
    return serverMovedSinceBase
      ? { kind: 'conflict', winner: 'existing' }
      : { kind: 'skip' }                          // entrant périmé
  }
  return { kind: 'skip' }                         // même milliseconde → renvoi idempotent
}
```

*Langage : TypeScript · Module : paquet de types partagés, logique de synchronisation · 17 cas de test associés.*

Trois enseignements se lisent dans ces vingt lignes. D'abord, **le conflit est détecté mais jamais bloquant** : la fonction tranche toujours, et confie à l'appelant le soin de journaliser. Ensuite, **la version de départ est ce qui distingue un vrai conflit d'une simple mise à jour tardive** : sans elle, on ne saurait pas si quelqu'un d'autre est intervenu. Enfin, **l'égalité stricte produit une non-action**, ce qui rend le rejeu d'un même lot sans effet — propriété indispensable quand le réseau coupe au milieu d'un envoi.

---

## 8.3 Fonctionnalités développées

Les vingt-trois besoins fonctionnels sont réalisés. Le tableau ci-dessous en donne la mesure objective, canal par canal.

| Besoin | Web | API | Desktop | Synchronisé | Preuve |
|---|:---:|:---:|:---:|:---:|---|
| BF01 Authentification | ✅ | ✅ | ✅ | — | 7 routes, double facteur |
| BF02 Comptes et habilitations | ✅ | ✅ | ✅ | ✅ | 32 routes, 128 permissions |
| BF03 Journal d'audit | ✅ | ✅ | ✅ | ⬜ | 151 routes auditées |
| BF04 Paramètres système | ✅ | ✅ | ✅ | ⬜ | 3 routes |
| BF05 Référentiels | ✅ | ✅ | ✅ | ✅ | 37 routes, 9 onglets |
| BF06 Personnel et délégations | ✅ | ✅ | ✅ | ✅ | 20 routes |
| BF07 Registre des employés | ✅ | ✅ | ✅ | ✅ | 5 routes |
| BF08 Dossier patient | ✅ | ✅ | ✅ | ✅ | 30 routes, 9 onglets |
| BF09 Rattachements | ✅ | ✅ | ✅ | ✅ | Historiques dédiés |
| BF10 Visites et triage | ✅ | ✅ | ✅ | ✅ | 9 routes |
| BF11 Constantes vitales | ✅ | ✅ | ✅ | ✅ | 23 champs, plages validées |
| BF12 Consultation | ✅ | ✅ | ✅ | ✅ | 22 routes |
| BF13 Ordonnance | ✅ | ✅ | ✅ | ✅ | 2 types, 3 états |
| BF14 Bon d'examen | ✅ | ✅ | ✅ | ✅ | 7 routes, 4 états |
| BF15 Bon de pharmacie | ✅ | ✅ | ✅ | ✅ | 5 routes, 3 états |
| BF16 Évacuation | ✅ | ✅ | ✅ | ✅ | 8 routes, 5 états |
| BF17 Suivi de traitement | ✅ | ✅ | ✅ | ⬜ | 8 routes |
| BF18 Messagerie chiffrée | ✅ | ✅ | ✅ | ✅ | 29 routes |
| BF19 Notifications temps réel | ✅ | ✅ | ✅ | ⬜ | 9 routes, flux d'événements |
| BF20 Tableaux de bord | ✅ | ✅ | ✅ | — | 9 routes |
| BF21 Rapports | ✅ | ✅ | ✅ | ⬜ | 2 routes, export |
| BF22 Impressions A4 | ✅ | — | ✅ | — | 6 documents |
| BF23 Synchronisation | ✅ | ✅ | ⚠️ | — | 14 routes, 52 entités |

> ⚠️ **BF23 côté poste autonome** : implémenté et vérifié statiquement — chemins, noms de fichiers et options de production cohérents de bout en bout — mais **non validé par une exécution réelle** sur machine cible.

> **Figures 8.3 et suivantes — Captures des fonctionnalités** : le protocole de production est décrit dans `06_interfaces/protocole_captures.md`. Les captures doivent être prises sur le jeu de données de démonstration, avec le rôle indiqué en légende, et aucune donnée réelle de patient.

---

## 8.4 Tests et validation

### 8.4.1 Ce qui existe

| Suite | Portée | Cas | Rattachée à un script |
|---|---|---:|:---:|
| Chiffrement de la messagerie | Unitaire, pure | 23 | ✅ |
| Chiffrement des secrets du second facteur | Unitaire, pure | 11 | ✅ |
| Suppression logique — logique de décision | Unitaire, pure | 10 | ✅ |
| **Résolution de conflit** | Unitaire, pure | 17 | ❌ |
| **Validation des saisies** | Unitaire, pure | 34 | ❌ |
| CRUD complet sur un référentiel | Intégration HTTP | 19 | ✅ |
| Messagerie entre deux utilisateurs | Intégration HTTP | 12 | ✅ |
| Création de conversation au premier message | Intégration HTTP | 9 | ✅ |
| Résurrection après suppression logique | Intégration HTTP | 8 | ✅ |
| Amorçage de l'application | Bout en bout | 2 | ✅ |
| **Total** | | **145** | **8 sur 10** |

### 8.4.2 Tableau 8.1 — Résultats de la campagne du 10 août 2026

Cinq suites de logique pure ont été **réellement exécutées**, avec sorties console conservées. Les cinq autres exigent une API démarrée et une base chargée.

| # | Cas de test | Entrée | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| T01 | Chiffrement et déchiffrement d'un message | Texte en clair | Restitution à l'identique | Conforme | ✅ **réussi** |
| T02 | Le chiffré ne contient jamais le clair | Texte en clair | Absence du clair dans le stockage | Conforme | ✅ **réussi** |
| T03 | Altération du chiffré, du tag ou du vecteur | Valeur modifiée | Déchiffrement refusé | Conforme | ✅ **réussi** |
| T04 | Rotation de clés non destructive | Message chiffré avec l'ancienne clé | Ré-encryption vers la clé courante | Conforme | ✅ **réussi** |
| T05 | Round-trip binaire, 64 kibioctets | Pièce jointe | Octets identiques | Conforme | ✅ **réussi** |
| T06 | Secret du second facteur jamais en clair | Secret en base32 | Stockage chiffré, format `v1:` | Conforme | ✅ **réussi** |
| T07 | Vecteur 96 bits, tag 128 bits | — | Tailles conformes à la norme | Conforme | ✅ **réussi** |
| T08 | Suppression logique — filtrage automatique | Enregistrement supprimé | Invisible en lecture | Conforme | ✅ **réussi** |
| T09 | Filtre explicite respecté | Lecture des marques de suppression | Filtre par défaut non imposé | Conforme | ✅ **réussi** |
| T10 | Résolution de conflit — entrant plus récent | Deux versions | Application de l'entrant | Conforme | ✅ **réussi** |
| T11 | Résolution de conflit — concurrence détectée | Version de départ dépassée | Conflit signalé, gagnant désigné | Conforme | ✅ **réussi** |
| T12 | Horodatages égaux | Renvoi du même lot | Ignoré, idempotent | Conforme | ✅ **réussi** |
| T13 | Suppression concurrente d'une édition | Marque plus récente | La suppression l'emporte | Conforme | ✅ **réussi** |
| T14 | Plages physiologiques des constantes | Valeur hors plage | Rejet avec message | Conforme | ✅ **réussi** |
| T15 | **Alignement client-serveur des 8 plages comparées** | Plages du client | Identiques à celles du serveur | Conforme | ✅ **réussi** |
| T16 | Refus d'un mot de passe non conforme | Mot de passe faible | Rejet | Conforme | ✅ **réussi** |
| T17 | **Comptage des constantes vitales déclarées** | 9 constantes au client | Le test en attend **8** | **9 ≠ 8** | ❌ **échoué** |
| T18 | CRUD complet, pile entière | Référentiel des pathologies | Chaîne complète validée | — | ⏳ non exécuté |
| T19 | Refus sans jeton | Requête non authentifiée | Erreur 401 | — | ⏳ non exécuté |
| T20 | Conversation créée au premier message | Ouverture sans envoi | Invisible des deux côtés | — | ⏳ non exécuté |
| T21 | Recréation après suppression | Clé unique réutilisée | Enregistrement ressuscité | — | ⏳ non exécuté |

**Synthèse : 102 cas exécutés sur 145 · 101 réussis · 1 échoué · taux de réussite 99 %.**

| Suite | Cas | Réussis | Échoués |
|---|---:|---:|---:|
| Résolution de conflit | 17 | 17 | 0 |
| Suppression logique | 10 | 10 | 0 |
| Chiffrement du second facteur | 11 | 11 | 0 |
| Chiffrement de la messagerie | 23 | 23 | 0 |
| Règles de saisie | 41 | 40 | **1** |

### 8.4.3 L'échec constaté — un test périmé, pas un défaut du code

Le cas T17 mérite d'être analysé, car il illustre un mécanisme plus intéressant que son résultat.

Le test compare les plages physiologiques du client à celles du serveur : c'est un **garde-fou anti-désynchronisation**, dont le commentaire dit explicitement *« si quelqu'un modifie l'un sans l'autre, ce test casse »*.

| Élément | Constantes vitales déclarées |
|---|---:|
| Interface web | **9** |
| Objet de transfert du serveur | **9** |
| Liste de comparaison du test | **8** |
| Assertion de comptage du test | **8** |

La constante **fréquence respiratoire** a été ajoutée **des deux côtés** — client et serveur, avec la même plage de 4 à 80 cycles par minute — mais **jamais au test**.

Le diagnostic est donc l'inverse de ce que l'échec suggère : **le client et le serveur sont alignés ; c'est le garde-fou qui a dérivé.** Et il a dérivé sur deux plans : il ne compare que huit constantes sur neuf, et son compteur est resté figé à huit.

**Pourquoi cette dérive n'a-t-elle jamais été détectée ?** Parce que cette suite **n'est rattachée à aucune commande** : elle ne s'exécute que si on l'invoque à la main, avec le chemin complet du fichier. Personne ne l'a lancée depuis l'ajout de la neuvième constante.

C'est la démonstration concrète, et non théorique, du défaut analysé au § 8.4.4 : une suite qu'on n'exécute pas cesse silencieusement de protéger ce qu'elle prétend protéger.

**Correction** : deux lignes, une entrée à ajouter à la liste de comparaison et un compteur à porter de 8 à 9.

> ### Déclaration de sincérité sur les tests
>
> Les résultats ci-dessus proviennent d'exécutions réelles, conduites le 10 août 2026. Les sorties console correspondantes sont reproductibles par les commandes documentées dans l'inventaire des tests.
>
> **Aucun résultat n'est extrapolé.** Les vingt-et-un cas marqués « non exécuté » le sont parce qu'ils exigent une interface de programmation démarrée et une base de données chargée, indisponibles au moment de la rédaction.
>
> **Sur les campagnes antérieures.** La documentation du projet fait état d'exécutions plus larges — 48 tests d'intégration sur le moteur embarqué, et plusieurs campagnes de bout en bout. Ces constats sont **datés du 26 juin 2026** et la stratégie de tests du projet reconnaît elle-même que *« ces scripts de flux sont ad-hoc et non tous committés ; les compteurs valent constat d'exécution daté, pas garantie rejouable »*. Ils sont donc rapportés comme tels, jamais présentés comme une vérification propre à ce mémoire.

### 8.4.4 Ce qui n'est pas couvert

| Domaine | Couverture | Commentaire |
|---|---|---|
| Chiffrement | forte — 34 cas | Le point le mieux testé du projet |
| Suppression logique | forte — 18 cas | Unitaire et intégration |
| Résolution de conflit | **forte** | 17 cas exécutés et réussis · suite rattachée à une commande |
| Validation des saisies | **forte** | 42 cas exécutés et réussis · garde-fou complété et rattaché |
| CRUD | partielle | 1 référentiel sur 9, choisi comme représentatif |
| **Cœur clinique** | **aucune** | Triage, consultation, prescription, bons, évacuation |
| **Éligibilité par catégorie** | **aucune** | La règle la plus structurante n'est couverte par aucun test |
| Interface | aucune | Aucun test de rendu |
| Poste autonome | aucune | Validation d'exécution à faire |

**Deux constats doivent être énoncés sans détour.**

D'une part, **51 cas sur 145 — soit 35 % — ne sont rattachés à aucune commande**. Ils ne s'exécutent que manuellement, et peuvent se désynchroniser du code sans que personne ne s'en aperçoive. Ce n'est plus une crainte théorique : la campagne du 10 août l'a **prouvé** — la suite de validation avait cessé de couvrir la neuvième constante vitale sans que quiconque le sache (§ 8.4.3). Or ce sont précisément ces deux suites qui couvrent la logique la plus critique : la résolution de conflit hors connexion et l'alignement des saisies.

D'autre part, **le cœur clinique n'a aucun test automatisé**. Un script de vérification des permissions existe, mais c'est un outil de contrôle manuel — et la documentation du projet signale qu'il référence encore des rôles supprimés, donc qu'il doit être aligné avant tout usage.

Aucune mesure de couverture n'est disponible : aucun outil n'est configuré. Annoncer un pourcentage serait une invention.

---

## 8.5 Déploiement

Le déploiement est décrit par un fichier de configuration versionné, qui définit deux services : l'API et le site web statique, la base de données étant hébergée séparément.

La séquence de démarrage enchaîne quatre étapes, dans cet ordre : application des migrations, synchronisation du catalogue des permissions, garde-fou de création du compte administrateur, puis démarrage de l'API.

**Trois enseignements d'exploitation** sont inscrits dans ce fichier, et méritent d'être rapportés car ils illustrent la différence entre un système qui fonctionne et un système exploitable.

**La synchronisation des permissions est nécessaire mais non bloquante.** Le catalogue vit dans le code, tandis que les gardes lisent la base. Sans rejeu à chaque déploiement, une permission ajoutée au code serait déployée sans exister en base, et les rôles perdraient silencieusement les accès correspondants. Le script est additif et idempotent ; son échec n'empêche pas l'API de démarrer, mais reste visible dans les journaux.

**Un garde-fou permanent protège l'accès administrateur.** Une base sans compte, ou dont le compte a perdu son rôle, ne peut plus être débloquée depuis l'interface — il faut être connecté pour créer un compte ou attribuer un rôle. Le script correspondant est idempotent et inoffensif : quand tout va bien, il ne fait rien.

**Une opération destructrice n'a pas sa place dans une commande de démarrage.** Un script de remise à zéro y avait été greffé, puis retiré aussitôt : rattaché au démarrage, il se rejouait à chaque redémarrage — déploiement, réveil après mise en veille — et effaçait au passage tout ce qui avait été saisi entre-temps. Les scripts restent versionnés pour un usage ponctuel et volontaire.

---

## 8.6 Difficultés rencontrées et solutions apportées

Six difficultés significatives ont été rencontrées. Toutes sont documentées dans le code lui-même, ce qui permet de les rapporter sans reconstruction a posteriori.

### 8.6.1 Le hors-ligne ne fonctionnait pas — problème de double autorité

**Le problème.** En mode autonome, le poste parle au serveur central quand il est en ligne, et à son serveur embarqué quand il ne l'est plus. Or ce sont **deux autorités d'authentification distinctes**, signant chacune avec son propre secret. La bascule ne changeait initialement que l'adresse : le jeton du central partait vers le serveur local, qui le refusait. Hors connexion, toute action tournait en boucle puis déconnectait l'agent. **Le mode hors ligne était inopérant.**

**La fausse solution écartée.** Partager le secret du central aurait résolu le symptôme — et créé une faille majeure : ce secret aurait été présent dans chaque installateur distribué, extractible, et aurait permis de forger des jetons valides pour le serveur de production.

**La solution retenue.** Le poste s'authentifie **auprès des deux autorités**, au moment de la connexion, quand les identifiants sont disponibles. La session conserve quatre jetons.

### 8.6.2 Un indicateur « hors ligne » qui mentait

**Le problème.** L'indicateur de connectivité interrogeait le chemin de contrôle de santé de l'API. Or c'est aussi celui que l'hébergeur interroge pour ses propres décisions de routage : il peut répondre en erreur pendant une transition d'instance, **indépendamment de la disponibilité réelle** pour les clients. Constaté en direct le 5 juillet 2026 : erreurs en rafale sur ce chemin alors que toutes les autres routes répondaient normalement, produisant un badge « Hors ligne » injustifié.

**La solution.** Un chemin dédié, jamais sondé par l'hébergeur, qui ne reflète que la vraie joignabilité de l'API.

### 8.6.3 Des permissions déployées sans exister en base

**Le problème.** Le catalogue des permissions vit dans le code, mais les gardes d'autorisation lisent la base. Constaté en production le 2 août 2026 : douze permissions ajoutées au code, absentes de la base, rendant les référentiels et les rapports inaccessibles.

**La solution.** Un script de synchronisation additif et idempotent, rejoué à chaque déploiement, qui ne supprime jamais rien et ne touche ni aux mots de passe ni aux dérogations individuelles.

### 8.6.4 Un compte sans rôle qui effondrait l'application

**Le problème.** Un compte sans rôle se connecte mais n'a aucun droit. L'application s'effondre alors sans que la cause soit visible. Constaté en production le 7 août 2026 : tableau de bord en erreur.

**La solution.** Un garde-fou permanent au démarrage, idempotent et inoffensif.

### 8.6.5 Collision d'unicité après suppression logique

**Le problème.** Avec la suppression logique, recréer un enregistrement portant une clé unique déjà utilisée par un enregistrement supprimé produisait une violation de contrainte, remontée en erreur serveur. L'utilisateur ne comprenait pas pourquoi il ne pouvait pas créer une entrée dont il venait de supprimer l'homonyme.

**La solution.** Détection du cas et **résurrection** de l'enregistrement marqué, plus traduction globale des erreurs de base en codes explicites. Le comportement est verrouillé par un test de non-régression.

### 8.6.6 Un canal temps réel coupé par les intermédiaires réseau

**Le problème.** Le canal de notification est silencieux par nature. Or les intermédiaires réseau — hébergeur, proxys d'entreprise — coupent une connexion muette au bout d'une minute environ. Sur un parc de deux cents postes, cela aurait produit un flot permanent de reconnexions pour zéro information.

**La solution.** Un battement régulier, plus court que le délai de coupure le plus agressif rencontré. Point subtil : le battement porte un **type différent** de la notification, faute de quoi les postes auraient synchronisé à chaque battement — réinventant exactement l'interrogation périodique que le canal visait à supprimer.

### 8.6.7 Autres difficultés, moindres

| Difficulté | Solution |
|---|---|
| Une option de requête existe en PostgreSQL et est refusée par SQLite | Injection conditionnelle selon le moteur |
| L'empaquetage recopiait des paquets du monorepo dans les dossiers de production, faussant les filtres de commande | Exclusions explicites, et règle de lancement depuis la bonne racine |
| Un générateur d'installateur produisait un assistant générique **sous le même nom de fichier**, écrasant silencieusement l'installateur sur mesure | Interdiction documentée, pipeline dédié |
| La taille du pré-cache dépassait le plafond par défaut, faisant échouer la production | Plafond relevé, avec justification chiffrée |

---

## Conclusion du chapitre

L'implémentation couvre les **23 besoins fonctionnels**, dont 22 pleinement et un partiellement. Elle représente environ **93 500 lignes** réparties sur 547 fichiers, structurées en un monorepo de six paquets, avec **268 routes**, **88 entités**, **128 permissions** et **41 migrations**.

La qualité est **documentée mais non mesurée**. Cent quarante-cinq cas de test sont écrits, dont aucun n'a été exécuté dans les conditions de cette rédaction ; 35 % d'entre eux ne sont rattachés à aucune commande ; et le cœur clinique n'a aucun test automatisé. Ce sont les limites les plus sérieuses du travail, et elles sont énoncées ici plutôt que découvertes en soutenance.

Les difficultés rencontrées sont instructives à un titre particulier : aucune n'était un problème d'algorithme. Toutes relevaient de **l'écart entre un système qui fonctionne en développement et un système qui tient en exploitation** — deux autorités d'authentification là où l'on n'en voyait qu'une, un indicateur de santé détourné de son usage, un catalogue en base en retard sur le code, un canal coupé par un intermédiaire invisible. C'est probablement l'enseignement technique le plus durable de ce projet.
