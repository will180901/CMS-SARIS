<!-- Fichier aligné sur Memoire_CMS_SARIS.docx le 19 août 2026. -->
<!-- Le document Word fait foi. Toute divergence est une erreur de ce fichier. -->

# CHAPITRE 8 — IMPLÉMENTATION

> 5 figure(s) · 4 tableau(x) dans ce chapitre.

Ce chapitre rend compte de la réalisation effective : l'environnement de développement et de déploiement, la mise en œuvre de la couche de persistance, les fonctionnalités livrées, l'état réel de la validation, et les difficultés rencontrées. Le périmètre implémenté couvre l'intégralité des vingt-trois besoins fonctionnels identifiés au chapitre 6. Un seul reste partiel, le fonctionnement hors connexion du poste autonome, dont la chaîne de production est vérifiée mais n'a pas été validée par une exécution complète sur machine cible.


## 8.1 Environnement de développement et de déploiement

L'architecture retenue est client-serveur à trois couches, déclinée en deux implantations : un serveur central hébergé, et des postes autonomes embarquant leur propre serveur. Les échanges se font en HTTPS, imposé en production, et transportent des données au format JSON. L'authentification repose sur un jeton JWT signé accompagné d'un jeton de renouvellement, complétée par une authentification à deux facteurs (2FA) fondée sur un code temporel (TOTP), et le temps réel sur un flux SSE unidirectionnel du serveur vers le client. La contrainte majeure reste le fonctionnement sur deux sites avec continuité hors connexion.

**Tableau 8.1 — Principaux outils logiciels employés**

| Outil | Version | Rôle |
|---|---|---|
| Node.js | 20.18 | Environnement d'exécution |
| TypeScript | 5.9 | Langage, typage statique de bout en bout |
| NestJS | 11 | Cadre applicatif serveur |
| Prisma | 6 | Correspondance objet-relationnel et migrations |
| PostgreSQL | 16 | Base de données centrale |
| SQLite | — | Base de données locale du poste autonome |
| React | 19 | Interface utilisateur |
| Vite | 7 | Compilation et serveur de développement |
| Electron | 33.2 | Client de bureau |
| electron-builder | 25.1 | Empaquetage de l'application de bureau |
| NSIS | — | Installateur Windows sur mesure |
| bcrypt | 6.0 | Hachage des mots de passe |
| otplib | 13.4 | Génération et vérification des codes temporels (TOTP) du second facteur |
| pnpm et Turborepo | 9.15 et 2.8 | Gestion et orchestration du dépôt unique |
| Git | 2 | Gestion de versions, 139 révisions |

Côté matériel, le développement a été conduit sur un poste Windows 10 Professionnel. Le serveur d'application est hébergé sur une offre mutualisée en région Europe, et la base de données est hébergée séparément. L'inventaire quantifié des postes clients du centre et de son infrastructure réseau n'a pas pu être établi, comme indiqué au chapitre 2 : cette lacune devra être comblée avant tout déploiement réel, notamment pour vérifier que les postes destinés au mode autonome disposent de l'espace disque nécessaire. Une contrainte du plan d'hébergement mérite enfin d'être signalée : le serveur est mis en veille après quinze minutes d'inactivité, si bien que la première requête après une période creuse subit un délai de réveil. C'est une contrainte assumée d'un environnement de démonstration.


## 8.2 Modélisation et implémentation de la base de données

Le schéma comporte 88 tables reliées par 97 associations, organisées en dix domaines fonctionnels.

**Tableau 8.2 — Répartition des tables par domaine fonctionnel**

| Domaine | Tables | Champs |
|---|---|---|
| Sécurité et audit | 18 | 175 |
| Dossier patient | 13 | 163 |
| Acteurs administratifs | 12 | 122 |
| Référentiels | 12 | 104 |
| Consultation et actes prescrits | 11 | 163 |
| Synchronisation hors connexion | 8 | 76 |
| Messagerie interne | 7 | 71 |
| Accueil et triage | 3 | 54 |
| Sorties critiques | 2 | 21 |
| Suivi de traitement | 2 | 27 |
| Total | 88 | 976 |

> 🖼️ **Figure 8.1 — Schéma relationnel du noyau métier**  
> *Emplacement d'image réservé dans le document.*

Le modèle physique est produit et maintenu par 41 migrations versionnées, appliquées à chaque déploiement sans effet en cas de réapplication. Chaque migration est un fichier horodaté conservé dans le dépôt, si bien que l'historique complet de l'évolution du schéma reste traçable. Le schéma de la base locale du poste autonome est dérivé automatiquement de celui de la base centrale, ce qui garantit que les deux cibles ne divergent pas : les 88 tables sont présentes des deux côtés. Les clés primaires sont des identifiants universels générés, les contraintes d'unicité sont portées par la base, et un index sur l'horodatage de modification rend possible le calcul des deltas de synchronisation. Six énumérations seulement sont portées par la base, les cinq machines à états restantes reposant sur des champs texte contraints par le code applicatif : c'est un compromis de portabilité entre les deux moteurs, qui doit être reconnu comme une faiblesse.

> 🖼️ **Figure 8.2 — Modèle physique de données**  
> *Emplacement d'image réservé dans le document.*

L'extrait de code ci-dessous est le cœur du fonctionnement hors connexion : la fonction qui arbitre entre une modification arrivant d'un poste et celle déjà présente sur le serveur. Elle a été choisie parce qu'elle est pure — sans entrée-sortie, sans dépendance externe, entièrement déterministe — ce qui la rend testable unitairement et réutilisable à l'identique par le serveur central et par le poste autonome.

/**

* Décide comment appliquer un enregistrement entrant face à l'existant.

* - existing null : création directe.

* - Dernière écriture gagnante sur updatedAt ; égalité stricte : aucune action.

* - Si baseUpdatedAt est fourni et que l'existant a bougé depuis cette base,

*   il y a conflit ; le gagnant est désigné, l'appelant journalise puis applique.

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

: exMs                                     // absente : comparaison simple

// Le serveur a-t-il été modifié par quelqu'un d'autre depuis que

// le poste a commencé son édition ? C'est cela, un vrai conflit.

const serverMovedSinceBase = exMs > baseMs

if (inMs > exMs) {

return serverMovedSinceBase

? { kind: 'conflict', winner: 'incoming' }

: { kind: 'apply' }

}

if (inMs < exMs) {

return serverMovedSinceBase

? { kind: 'conflict', winner: 'existing' }

: { kind: 'skip' }

}

return { kind: 'skip' }

}

Trois enseignements se lisent dans ces vingt lignes. Le conflit est détecté mais jamais bloquant : la fonction tranche toujours, et confie à l'appelant le soin de journaliser l'incident. La version de départ est ce qui distingue un vrai conflit d'une simple mise à jour tardive : sans elle, on ne saurait pas si quelqu'un d'autre est intervenu entre-temps. L'égalité stricte des horodatages produit enfin une non-action, ce qui rend le renvoi d'un même lot sans effet, propriété indispensable quand le réseau coupe au milieu d'un envoi.


## 8.3 Fonctionnalités développées

Les vingt-trois besoins fonctionnels identifiés au chapitre 6 sont réalisés, et leur preuve dans le système figure au tableau 6.1. Tous sont disponibles sur les trois canaux — application web installable (PWA), API et client de bureau — à deux exceptions près : l'impression des documents cliniques, qui ne concerne pas l'API, et la synchronisation, qui reste partielle côté client de bureau autonome. Trente-cinq entités sur les cinquante-deux concernées sont synchronisées hors connexion.

Une réserve porte sur le seul besoin marqué partiel. Le fonctionnement hors connexion du poste autonome est implémenté et vérifié statiquement — chemins, noms de fichiers et options de production cohérents de bout en bout — mais il n'a pas été validé par une exécution complète sur une machine cible. La distinction est importante : un code vérifié n'est pas un code éprouvé.

Les captures d'écran ci-après présentent les principales fonctionnalités. Elles ont été prises sur le jeu de données de démonstration, avec indication du rôle utilisé en légende, et aucune donnée réelle de patient n'y figure.

> 🖼️ **Figure 8.3 — Consultation en cours, avec examen clinique et diagnostics (rôle Médecin Chef)**  
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 8.4 — Émission d'un bon de pharmacie et contrôle d'éligibilité (rôle Infirmier)**  
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 8.5 — Tableau de bord et journal d'audit (rôle Administrateur système)**  
> *Emplacement d'image réservé dans le document.*


## 8.4 Tests et validation

Dix fichiers de test regroupent l'ensemble des cas écrits. Cinq suites relèvent de la logique pure et s'exécutent sans dépendance externe, quatre sont des suites d'intégration exigeant une API démarrée et une base chargée, et une dernière vérifie l'amorçage complet de l'application. Un défaut a été corrigé le 10 août 2026 : deux suites n'étaient rattachées à aucune commande et ne s'exécutaient que manuellement. Elles sont désormais rattachées, et les dix suites sur dix sont lançables automatiquement.

Deux campagnes ont été conduites le même jour. La première a révélé un test périmé, analysé plus loin. La seconde, après correction, donne le résultat définitif.

**Tableau 8.3 — Résultats de la campagne d'exécution après correction**

| Suite | Cas | Réussis | Échoués |
|---|---|---|---|
| Résolution de conflit | 17 | 17 | 0 |
| Suppression logique | 10 | 10 | 0 |
| Chiffrement des secrets du second facteur | 11 | 11 | 0 |
| Chiffrement de la messagerie | 23 | 23 | 0 |
| Validation des saisies | 42 | 42 | 0 |
| Total | 103 | 103 | 0 |

Cent trois cas ont donc été exécutés avec succès, soit un taux de réussite de 100 %. Les quarante-trois cas restants relèvent des suites d'intégration, qui exigent une API démarrée et une base chargée, indisponibles au moment de la rédaction.

Le cas du test périmé mérite d'être analysé, car il illustre un mécanisme plus intéressant que son résultat. Ce test compare les plages physiologiques déclarées côté client à celles déclarées côté serveur : c'est un garde-fou contre la désynchronisation, dont le commentaire dit explicitement que si quelqu'un modifie l'un sans l'autre, le test doit casser. Lors de la première campagne, il a effectivement cassé. Mais le diagnostic est l'inverse de ce que l'échec suggérait : le client déclarait neuf constantes vitales et le serveur également, les deux étant donc parfaitement alignés. C'est le test qui n'en comparait que huit, la constante fréquence respiratoire ayant été ajoutée des deux côtés mais jamais au garde-fou. Autrement dit, le client et le serveur étaient alignés, c'est le garde-fou qui avait dérivé. Et il n'avait pu dériver ainsi que parce que sa suite n'était rattachée à aucune commande : personne ne l'avait lancée depuis l'ajout de la neuvième constante. C'est la démonstration concrète qu'une suite qu'on n'exécute pas cesse silencieusement de protéger ce qu'elle prétend protéger. La correction a tenu en deux lignes.

L'honnêteté exige de dire aussi ce que ces tests ne couvrent pas.

**Tableau 8.4 — Couverture des tests par domaine**

| Domaine | Couverture | Commentaire |
|---|---|---|
| Chiffrement | Forte, 34 cas | Le point le mieux testé du projet |
| Suppression logique | Forte, 18 cas | Couverte en unitaire et en intégration |
| Résolution de conflit | Forte, 17 cas | Exécutés et réussis, suite rattachée à une commande |
| Validation des saisies | Forte, 42 cas | Exécutés et réussis, garde-fou complété |
| Opérations sur les référentiels | Partielle | Un référentiel sur neuf, choisi comme représentatif |
| Cœur clinique | Aucune | Triage, consultation, prescription, bons, évacuation |
| Éligibilité par catégorie | Aucune | La règle la plus structurante n'est couverte par aucun test |
| Interface | Aucune | Aucun test de rendu |
| Poste autonome | Aucune | Validation d'exécution restant à faire |

Deux constats doivent être énoncés sans détour. Le cœur clinique n'a aucun test automatisé exécuté : le triage, la consultation, la prescription, les bons et l'évacuation reposent sur des tests d'intégration qui n'ont pas été lancés. Et la règle d'éligibilité par catégorie, présentée tout au long de ce mémoire comme la plus structurante du système, n'est couverte par aucun test. C'est la lacune la plus sérieuse de la validation, signalée ici plutôt que découverte en soutenance. Aucune mesure de couverture de code n'est enfin disponible, aucun outil n'ayant été configuré à cet effet : annoncer un pourcentage serait une invention. Les résultats présentés proviennent d'exécutions réelles, dont les sorties sont reproductibles par les commandes documentées.


## 8.5 Déploiement

Le déploiement est décrit par un fichier de configuration versionné, qui définit deux services, l'API et le site web statique, la base de données étant hébergée séparément. La séquence de démarrage enchaîne quatre étapes : application des migrations, synchronisation du catalogue des permissions, garde-fou de création du compte administrateur, puis démarrage du serveur.

Trois enseignements d'exploitation sont inscrits dans ce fichier, et ils illustrent la différence entre un système qui fonctionne et un système qui s'exploite. La synchronisation des permissions est nécessaire mais non bloquante : le catalogue vit dans le code tandis que les gardes lisent la base, si bien qu'une permission ajoutée au code serait déployée sans exister en base, et les rôles perdraient silencieusement les accès correspondants. Un garde-fou permanent protège ensuite l'accès administrateur, car une base sans compte administrateur ne peut plus être débloquée depuis l'interface, puisqu'il faut être connecté pour créer un compte. Une opération destructrice n'a enfin pas sa place dans une commande de démarrage : un script de remise à zéro y avait été greffé puis retiré aussitôt, car rattaché au démarrage il se rejouait à chaque redémarrage et effaçait tout ce qui avait été saisi entre-temps.


## 8.6 Difficultés rencontrées et solutions apportées

Six difficultés significatives ont été rencontrées. Toutes sont documentées dans le code lui-même, ce qui permet de les rapporter sans reconstruction a posteriori.

La première est que le mode hors connexion ne fonctionnait pas. En mode autonome, le poste dialogue avec le serveur central lorsqu'il est en ligne et avec son serveur embarqué lorsqu'il ne l'est plus ; or ce sont deux autorités d'authentification distinctes, signant chacune avec son propre secret. La bascule ne changeait initialement que l'adresse du serveur, si bien que le jeton émis par le central partait vers le serveur local, qui le refusait. Une solution apparente a été écartée : partager le secret du serveur central aurait résolu le symptôme, mais ce secret aurait été présent dans chaque installateur distribué, extractible, et aurait permis de forger des jetons valides pour la production. La solution retenue consiste à authentifier le poste auprès des deux autorités au moment de la connexion.

La deuxième est un indicateur de connectivité qui mentait. Il interrogeait le chemin de contrôle de santé du serveur, qui est aussi celui que l'hébergeur interroge pour ses décisions de routage : ce chemin peut répondre en erreur pendant une transition d'instance, indépendamment de la disponibilité réelle. Le phénomène a été constaté le 5 juillet 2026, avec des erreurs en rafale sur ce chemin alors que toutes les autres routes répondaient normalement. La solution a consisté à créer un chemin dédié, jamais sondé par l'hébergeur.

La troisième est que des permissions ont été déployées sans exister en base. Le catalogue vit dans le code, mais les gardes lisent la base : le 2 août 2026, douze permissions ajoutées au code étaient absentes de la base en production, rendant les référentiels et les rapports inaccessibles. La solution a consisté en un script de synchronisation additif, rejoué à chaque déploiement.

La quatrième est un compte sans rôle qui effondrait l'application. Un compte dépourvu de rôle se connecte mais n'obtient aucun droit, et l'application s'effondre sans que la cause soit visible pour l'utilisateur. Le cas a été constaté en production le 7 août 2026. La solution a consisté en un garde-fou permanent au démarrage.

La cinquième est une collision d'unicité après suppression logique. Recréer un enregistrement portant une clé unique déjà utilisée par un enregistrement supprimé produisait une violation de contrainte remontée en erreur serveur, et l'utilisateur ne comprenait pas pourquoi il ne pouvait pas créer une entrée dont il venait de supprimer l'homonyme. La solution a consisté à détecter ce cas et à ressusciter l'enregistrement marqué, puis à traduire globalement les erreurs de base en messages explicites. Le comportement est verrouillé par un test de non-régression.

La sixième est un canal temps réel coupé par les intermédiaires réseau. Ce canal est silencieux par nature, or les équipements intermédiaires coupent une connexion muette au bout d'une minute environ : sur un parc de deux cents postes, cela aurait produit un flot permanent de reconnexions pour aucune information utile. La solution a consisté à émettre un battement régulier, plus court que le délai de coupure le plus agressif rencontré. Un point subtil mérite d'être relevé : ce battement porte un type différent de celui de la notification, faute de quoi les postes se seraient synchronisés à chaque battement, réinventant l'interrogation périodique que le canal visait à supprimer.

Quatre difficultés moindres ont enfin été traitées : une option de requête acceptée par un moteur de base de données et refusée par l'autre, résolue par une injection conditionnelle ; un empaquetage qui recopiait des paquets internes dans les dossiers de production, résolu par des exclusions explicites ; un générateur qui produisait un assistant d'installation générique sous le même nom de fichier, écrasant silencieusement l'installateur sur mesure ; et une taille de pré-cache dépassant le plafond par défaut, résolue par un relèvement justifié.


## Conclusion du chapitre

L'implémentation couvre les vingt-trois besoins fonctionnels, dont vingt-deux pleinement et un partiellement. Elle représente environ 93 500 lignes réparties sur 547 fichiers, avec 268 routes, 88 entités, 128 permissions et 41 migrations. Cent trois cas de test ont été exécutés le 10 août 2026 avec un taux de réussite de 100 %, et les dix suites sont désormais rattachées à une commande. Deux limites sérieuses subsistent néanmoins : le cœur clinique n'a aucun test automatisé exécuté, et la règle d'éligibilité par catégorie n'est couverte par aucun test. Les difficultés rencontrées sont enfin instructives à un titre particulier : aucune n'était un problème d'algorithme, toutes relevaient de l'écart entre un système qui fonctionne en développement et un système qui tient en exploitation. C'est probablement l'enseignement technique le plus durable de ce projet.
