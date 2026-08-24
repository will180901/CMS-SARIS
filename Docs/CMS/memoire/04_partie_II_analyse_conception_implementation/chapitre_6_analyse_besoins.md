<!-- Fichier régénéré depuis Memoire_CMS_SARIS.docx le 28 août 2026. -->
<!-- Miroir exact du document Word. Ne pas modifier ici : le Word fait foi sur le texte. -->

# CHAPITRE 6 — ANALYSE DES BESOINS

> 8 figure(s) · 19 tableau(x) dans cette partie.

L'analyse des besoins est la première étape formelle de la branche fonctionnelle de 2TUP. Elle transforme une compréhension du métier en un ensemble d'exigences numérotées, d'acteurs identifiés et de cas d'utilisation spécifiés. Toute la conception s'appuiera dessus. Nous avons établi les besoins présentés ici par deux voies complémentaires. Les besoins exprimés proviennent du recueil de l'existant : ils disent ce que le centre demandait. Les besoins reconstitués proviennent de l'analyse du système réalisé — routes, permissions, écrans, règles — et disent ce que le système réalise.

Les deux ensembles ne se recouvrent pas exactement. Nous les confrontons plus loin.

## 6.1 Analyse du besoin

Cette section définit l'ensemble des exigences que le système doit satisfaire. Nous les répartissons en deux catégories, fonctionnelle et non fonctionnelle, puis nous les confrontons au périmètre retenu.

### 6.1.1 Besoins fonctionnels

Nous avons identifié vingt-trois besoins fonctionnels. Chacun est rattaché à l'élément du système qui le réalise, ce qui permet de vérifier qu'aucun besoin n'est déclaré sans preuve.

**Tableau 6.1 — Les vingt-trois besoins fonctionnels et leur preuve**

| Id | Besoin fonctionnel | Preuve dans le système | Statut |
|---|---|---|---|
| BF01 | Authentifier les agents et sécuriser l'accès | 7 routes, jeton signé, second facteur | Implémenté |
| BF02 | Gérer les comptes, les rôles et les habilitations | 32 routes, 128 permissions, 3 rôles | Implémenté |
| BF03 | Journaliser les actions sensibles | 151 routes auditées, journal persistant | Implémenté |
| BF04 | Paramétrer le système | Module de paramètres, 3 routes | Implémenté |
| BF05 | Gérer les référentiels métier | 37 routes, 9 référentiels | Implémenté |
| BF06 | Gérer le personnel médical et les délégations | 20 routes, modèles dédiés | Implémenté |
| BF07 | Tenir le registre des employés | 5 routes, registre partagé entre les sites | Implémenté |
| BF08 | Gérer le dossier patient centralisé | 30 routes, 13 modèles de données | Implémenté |
| BF09 | Rattacher les ayants droit et les sous-traitants | Modèles de rattachement historisés | Implémenté |
| BF10 | Enregistrer et trier les visites | 9 routes, file par ordre d'arrivée | Implémenté |
| BF11 | Relever les constantes vitales | Modèle à 23 champs, plages validées | Implémenté |
| BF12 | Conduire une consultation clinique | 22 routes, examen, diagnostics, conclusion | Implémenté |
| BF13 | Prescrire des médicaments ou des examens | Ordonnance à deux types, cycle de validation | Implémenté |
| BF14 | Émettre un bon d'examen et en saisir le résultat | 7 routes, quatre états | Implémenté |
| BF15 | Émettre et délivrer un bon de pharmacie | 5 routes, trois états | Implémenté |
| BF16 | Orienter par évacuation et en suivre les étapes | 8 routes, cinq états, historique | Implémenté |
| BF17 | Ouvrir et alimenter un suivi de traitement | 8 routes, fiches datées | Implémenté |
| BF18 | Communiquer par messagerie interne | 29 routes, chiffrement, pièces jointes | Implémenté |
| BF19 | Notifier les agents en temps réel | 9 routes, flux d'événements | Implémenté |
| BF20 | Piloter l'activité par tableau de bord | 9 routes, vues adaptées au rôle | Implémenté |
| BF21 | Produire des rapports statistiques | 2 routes, export | Implémenté |
| BF22 | Imprimer les documents cliniques | 6 modèles d'impression au format A4 | Implémenté |
| BF23 | Travailler sans connexion et se resynchroniser | 14 routes, 52 modèles, 2 mécanismes | Partiel |

### 6.1.2 Besoins non fonctionnels

Treize besoins non fonctionnels encadrent la réalisation. Ils portent sur la sécurité, la continuité, l'intégrité et la maintenabilité, c'est-à-dire les qualités que le système doit présenter indépendamment des fonctions qu'il rend.

**Tableau 6.2 — Les treize besoins non fonctionnels et leur réalisation**

| Id | Besoin non fonctionnel | Réalisation dans le système | Statut |
|---|---|---|---|
| BNF01 | Sécurité de l'accès | Mot de passe haché, authentification à deux facteurs (2FA) par code temporel (TOTP), codes de secours, blocage progressif, limitation à 100 requêtes par minute et par utilisateur | Implémenté |
| BNF02 | Confidentialité des données au repos | Messagerie et secrets TOTP du second facteur chiffrés, file hors connexion chiffrée, jetons protégés par le coffre du système | Implémenté |
| BNF03 | Confidentialité d'usage | Verrou de dossier, cloisonnement par initiateur, floutage des zones cliniques | Implémenté |
| BNF04 | Traçabilité | Journal d'audit alimenté par un intercepteur unique, sans route d'écriture directe | Implémenté |
| BNF05 | Continuité hors connexion | Deux mécanismes distincts : file de mutations côté web, base locale synchronisée côté poste autonome | Partiel |
| BNF06 | Cohérence entre les deux sites | Dossier patient et parcours de soin en portée globale | Implémenté |
| BNF07 | Intégrité des saisies | Validation stricte à l'entrée, plages physiologiques alignées entre client et serveur | Implémenté |
| BNF08 | Réversibilité des suppressions | Suppression logique sur 47 modèles | Implémenté |
| BNF09 | Accessibilité linguistique | Bilinguisme complet, bascule en direct, préférence par compte | Implémenté |
| BNF10 | Ergonomie et mobilité | Interface adaptative, menu en tiroir sur mobile, application installable | Implémenté |
| BNF11 | Déployabilité | Installateur par utilisateur, mise à jour automatique | Partiel |
| BNF12 | Maintenabilité | Dépôt de code unique à types partagés, utilitaires désignés source unique | Implémenté |
| BNF13 | Robustesse des erreurs | Filtre global, traduction des erreurs de base en codes explicites | Implémenté |

Une exigence attendue manque à cette liste, et son absence doit être justifiée. Nous n'avons établi aucune exigence chiffrée de temps de réponse. Elle ne figure ni dans le recueil, ni sous forme mesurable dans le code, et nous n'avons conduit aucune campagne de mesure. Annoncer un seuil serait une invention. Nous renvoyons le sujet aux perspectives.

Six de ces besoins non fonctionnels ne correspondent par ailleurs à aucune demande formulée lors des entretiens : la sécurité de l'accès, la confidentialité au repos, la traçabilité, l'intégrité des saisies, la réversibilité des suppressions et la maintenabilité. Ils découlent de la nature des données manipulées et des conditions d'exploitation.

Le constat mérite d'être relevé, car il dit quelque chose du travail d'analyse. Les acteurs ont demandé des tableaux de bord et un logiciel de stock, non de la sécurité ni de la traçabilité. L'utilisateur exprime ce qui lui manque au quotidien, non ce qui protège les données dont il a la charge. Le rôle de l'analyse est précisément de compléter le recueil par ces exigences implicites.

### 6.1.3 Confrontation des besoins exprimés au périmètre

Une fois confrontés au périmètre que nous avons retenu, les dix-huit besoins recueillis se répartissent ainsi.

**Tableau 6.3 — Confrontation des dix-huit besoins exprimés au périmètre**

| Besoin exprimé | Devient | Verdict |
|---|---|---|
| Système centralisé entre les deux sites | BF23, BNF05, BNF06 | Couvert |
| Dossier patient numérique | BF08, BF09 | Couvert |
| Automatisation des rapports | BF20, BF21 | Partiel : quatre axes sur dix hors d'atteinte |
| Formulaire de triage numérique | BF10, BF11 | Couvert |
| Repos médicaux avec lien vers le service RH | BF22 | Partiel : le document est produit, non transmis |
| Statistiques par catégorie et par direction | BF21 | Partiel : la notion de direction n'existe pas au modèle |
| Délégation formalisée | BF06, BF13 | Couvert |
| Espace de consultation autonome | BF20 | Couvert pour le domaine médical |
| Suivi des pathologies fréquentes | BF21 | Couvert |
| Dématérialisation des flux | BF18, BF22 | Partiel dans le périmètre |
| Coûts d'évacuation | Aucune exigence | Hors périmètre |
| Tableau de bord de l'absentéisme | Aucune exigence | Hors périmètre |
| Gestion du stock pharmaceutique | Aucune exigence | Hors périmètre |
| Impression des reçus de dispensation | Aucune exigence | Hors périmètre |
| Facturation pharmaceutique | Aucune exigence | Hors périmètre |
| Alertes de stock et de péremption | Aucune exigence | Hors périmètre |
| Rythme de réapprovisionnement | Aucune exigence | Hors périmètre, problème organisationnel |
| Inventaires physiques réguliers | Aucune exigence | Hors périmètre, problème organisationnel |

La synthèse de cette confrontation tient en quatre nombres : six besoins couverts, quatre partiellement couverts, huit hors du périmètre retenu, et aucun besoin non couvert à l'intérieur du périmètre. Cette dernière valeur est la plus importante. Elle établit que nous n'avons pas laissé de trou dans le domaine que nous nous sommes donné.

## 6.2 Spécifications fonctionnelles

Cette section identifie qui utilise le système, où s'arrête son périmètre, et quelles fonctions il rend.

### 6.2.1 Acteurs du système

Notre système ne connaît que trois rôles, et les acteurs primaires en découlent directement.

**Tableau 6.4 — Les acteurs du système**

| Acteur | Type | Permissions | Vocation |
|---|---|---|---|
| Administrateur système | Primaire | 128 sur 128 | Gouvernance de la plateforme : comptes, rôles, paramètres, supervision de la synchronisation |
| Médecin Chef | Primaire | 101 sur 128 | Activité de soin complète, gouvernance des référentiels et du personnel, délégations, évacuations, audit |
| Infirmier | Primaire | 51 sur 128 | Accueil, triage, constantes vitales, consultation de ses propres patients, prescription sous délégation |
| Poste local autonome | Secondaire | Sans objet | Instance du client de bureau fonctionnant hors ligne, qui se synchronise avec le serveur central |
| Service de géolocalisation | Secondaire externe | Sans objet | Fournit la ville et les coordonnées pour le journal d'authentification, avec repli hors ligne |
| Canal de mise à jour | Secondaire externe | Sans objet | Publie et distribue les versions du client de bureau |

Deux précisions sont indispensables. La première concerne la profession de médecin. Il n'existe pas de rôle « médecin » dans le système : tout médecin reçoit le rôle de médecin chef, car aucun droit ne les sépare. La seconde concerne l'administrateur système, qui détient la totalité du catalogue de permissions, actes cliniques compris. C'est un choix de gouvernance explicite pour ce déploiement, et il doit être énoncé plutôt que dissimulé. Dans un déploiement en établissement de santé, il conviendrait de retirer à ce rôle les permissions cliniques qui ne lui sont pas nécessaires.

### 6.2.2 Diagramme de contexte statique

Le diagramme de contexte statique fixe la frontière du système et les acteurs qui l'entourent. Il ne montre aucun détail interne : le système y est une boîte noire.

> 🖼️ **Figure 6.1 — Diagramme de contexte statique du système**
> *Emplacement d'image réservé dans le document.*

### 6.2.3 Frontière du système

La frontière du système commence à l'authentification d'un agent et s'arrête aux documents imprimés qu'il remet au patient. Relèvent du système : les dossiers patients, les visites, les consultations, les prescriptions, les bons de prise en charge, les évacuations, les suivis de traitement, la messagerie, les notifications, les tableaux de bord, les référentiels, les comptes et droits, et la synchronisation.

Quatre domaines voisins n'en relèvent pas, et il importe de les nommer. La facturation et la comptabilité : le système émet des bons et jamais de facture, et aucun modèle ne porte de montant. La gestion de stock : le bon est un bon de retrait, sans suivi de quantité. Le laboratoire : seul le résultat revient dans le système, saisi manuellement. Et l'hospitalisation : le centre oriente par évacuation.

Cette frontière explique pourquoi certains acteurs interrogés lors du recueil — la pharmacienne, le gestionnaire des ressources humaines — ne sont pas des acteurs du système.

### 6.2.4 Identification des cas d'utilisation

Nous avons identifié soixante-cinq cas d'utilisation, répartis en douze modules fonctionnels. Le tableau ci-dessous en donne la répartition par module.

**Tableau 6.5 — Répartition des cas d'utilisation par module**

| Module | Cas d'utilisation | Dont priorité haute |
|---|---|---|
| Sécurité et accès personnel | 8 | 4 |
| Habilitations | 5 | 3 |
| Supervision et paramètres | 3 | 1 |
| Référentiels | 4 | 3 |
| Acteurs médicaux | 4 | 3 |
| Dossier patient | 9 | 6 |
| Triage | 5 | 4 |
| Consultation et actes prescrits | 11 | 8 |
| Sorties critiques et suivi | 4 | 2 |
| Communication | 5 | 0 |
| Pilotage | 3 | 1 |
| Synchronisation | 4 | 2 |
| Total | 65 | 37 |

Cette répartition est parlante. Le module Consultation et actes prescrits concentre à lui seul onze cas, dont huit de priorité haute : c'est le cœur du système, celui qui porte le parcours de soin. Le module Dossier patient vient ensuite avec neuf cas. À l'inverse, le module Communication ne comporte aucun cas de priorité haute. La messagerie répond au constat que l'information circule verbalement sans trace, mais elle ne conditionne pas le fonctionnement du parcours de soin.

### 6.2.5 Classification par package

Un package regroupe des éléments de modèle en un ensemble cohérent. Les douze modules identifiés plus haut se regroupent en cinq packages, chacun correspondant à un domaine de responsabilité distinct. Ce découpage gouverne la suite de notre mémoire : il commande les diagrammes de cas d'utilisation présentés ci-après, et les diagrammes de classes du chapitre 7.

Les tableaux suivants nomment les soixante-cinq cas d'utilisation, un par un, et les classent selon trois critères. Les acteurs sont désignés par une initiale : A pour l'administrateur système, M pour le Médecin Chef, I pour l'infirmier, P pour le poste local, qui est un acteur secondaire.

Une précision de méthode s'impose sur la colonne du risque. Elle n'est pas une estimation faite avant le développement, mais un constat établi après coup, à partir des difficultés effectivement rencontrées et documentées au chapitre 8. Un cas est marqué à risque élevé lorsqu'il a exigé une reprise de conception, lorsqu'il porte une règle métier que le système doit garantir seul, ou lorsqu'un incident daté l'a mis en défaut. La colonne de l'itération indique le rang dans lequel le module correspondant a été construit.

Le package « Sécurité et habilitations » compte 16 cas d'utilisation, dont 8 de priorité haute et 4 à risque élevé. Il rassemble l'accès personnel, les habilitations et la supervision. C'est le socle : aucun autre package ne fonctionne sans lui.

**Tableau 6.6 — Package Sécurité et habilitations : cas d'utilisation, risque, priorité et itération**

| Id | Cas d'utilisation | Acteurs | Risque | Priorité | Itération |
|---|---|---|---|---|---|
| UC01 | Se connecter | A M I | Élevé | Haute | 1 |
| UC02 | Valider le second facteur | A M I | Élevé | Haute | 1 |
| UC03 | Résoudre une connexion concurrente | A M I | Moyen | Haute | 1 |
| UC04 | Changer son mot de passe | A M I | Faible | Haute | 1 |
| UC05 | Consulter et révoquer ses sessions | A M I | Faible | Moyenne | 1 |
| UC06 | Activer ou désactiver son second facteur | A M I | Moyen | Moyenne | 1 |
| UC07 | Accepter les conditions d'utilisation | A M I | Faible | Basse | 1 |
| UC08 | Gérer ses préférences | A M I | Faible | Basse | 1 |
| UC09 | Créer et gérer un compte | A M | Moyen | Haute | 2 |
| UC10 | Attribuer un rôle | A | Élevé | Haute | 2 |
| UC11 | Éditer la matrice de permissions d'un rôle | A | Élevé | Haute | 2 |
| UC12 | Accorder ou révoquer une permission individuelle | A | Moyen | Moyenne | 2 |
| UC13 | Réinitialiser un mot de passe | A | Faible | Basse | 2 |
| UC14 | Consulter le journal d'audit | A M | Moyen | Haute | 2 |
| UC15 | Consulter les paramètres système | A | Faible | Basse | 2 |
| UC16 | Modifier les paramètres système | A | Moyen | Moyenne | 2 |

Le package « Référentiels et acteurs médicaux » compte 8 cas d'utilisation, dont 6 de priorité haute et 2 à risque élevé. Il porte les données de référence du centre et les fiches du personnel soignant, dont les délégations de prescription.

**Tableau 6.7 — Package Référentiels et acteurs médicaux : cas d'utilisation, risque, priorité et itération**

| Id | Cas d'utilisation | Acteurs | Risque | Priorité | Itération |
|---|---|---|---|---|---|
| UC17 | Consulter un référentiel | A M I | Faible | Haute | 3 |
| UC18 | Créer, modifier ou désactiver une entrée | A M | Moyen | Haute | 3 |
| UC19 | Gérer les sociétés sous-traitantes | A M | Faible | Basse | 3 |
| UC20 | Tenir le registre des employés | A M I | Élevé | Haute | 3 |
| UC21 | Gérer une fiche de personnel | A M | Faible | Haute | 3 |
| UC22 | Accorder une délégation de prescription | M | Élevé | Haute | 3 |
| UC23 | Révoquer une délégation | M | Moyen | Haute | 3 |
| UC24 | Consulter ses délégations actives | I | Faible | Moyenne | 3 |

Le package « Dossier patient » compte 9 cas d'utilisation, dont 6 de priorité haute et 4 à risque élevé. Il porte l'identité du patient, ses données médicales, ses rattachements et la règle de confidentialité.

**Tableau 6.8 — Package Dossier patient : cas d'utilisation, risque, priorité et itération**

| Id | Cas d'utilisation | Acteurs | Risque | Priorité | Itération |
|---|---|---|---|---|---|
| UC25 | Rechercher un patient | A M I | Faible | Haute | 4 |
| UC26 | Créer un dossier | A M I | Élevé | Haute | 4 |
| UC27 | Consulter un dossier | A M I | Moyen | Haute | 4 |
| UC28 | Mettre à jour identité et données médicales | A M I | Moyen | Haute | 4 |
| UC29 | Gérer les rattachements | A M I | Élevé | Haute | 4 |
| UC30 | Changer la catégorie | A M | Élevé | Moyenne | 4 |
| UC31 | Verrouiller ou déverrouiller un dossier | A M | Élevé | Haute | 4 |
| UC32 | Archiver un dossier | A M | Faible | Basse | 4 |
| UC33 | Imprimer un dossier | A M I | Faible | Moyenne | 4 |

Le package « Parcours de soin » compte 20 cas d'utilisation, dont 14 de priorité haute et 4 à risque élevé. C'est le cœur métier : le triage, la consultation, la prescription, les bons de prise en charge, l'évacuation et le suivi.

**Tableau 6.9 — Package Parcours de soin : cas d'utilisation, risque, priorité et itération**

| Id | Cas d'utilisation | Acteurs | Risque | Priorité | Itération |
|---|---|---|---|---|---|
| UC34 | Ouvrir une visite | M I | Moyen | Haute | 5 |
| UC35 | Relever les constantes vitales | M I | Moyen | Haute | 5 |
| UC36 | Affecter un soignant | M I | Faible | Haute | 5 |
| UC37 | Consulter la file d'attente | A M I | Faible | Haute | 5 |
| UC38 | Annuler une visite | M I | Faible | Basse | 5 |
| UC39 | Ouvrir une consultation | M I | Moyen | Haute | 6 |
| UC40 | Saisir l'examen clinique | M I | Faible | Haute | 6 |
| UC41 | Poser un diagnostic | M I | Faible | Haute | 6 |
| UC42 | Créer et valider une ordonnance | M I | Élevé | Haute | 6 |
| UC43 | Émettre un bon de pharmacie | M I | Élevé | Haute | 6 |
| UC44 | Délivrer un bon de pharmacie | M | Moyen | Haute | 6 |
| UC45 | Émettre un bon d'examen | M I | Élevé | Haute | 6 |
| UC46 | Saisir un résultat d'examen | M I | Moyen | Moyenne | 6 |
| UC47 | Délivrer un certificat de repos | M I | Faible | Moyenne | 6 |
| UC48 | Clôturer une consultation | M I | Élevé | Haute | 6 |
| UC49 | Annuler une consultation | M I | Faible | Basse | 6 |
| UC50 | Initier une évacuation | M | Moyen | Haute | 7 |
| UC51 | Suivre et clôturer une évacuation | M | Moyen | Moyenne | 7 |
| UC52 | Ouvrir un suivi de traitement | M I | Faible | Haute | 7 |
| UC53 | Ajouter une fiche de suivi | M I | Faible | Basse | 7 |

Le package « Fonctions transverses » compte 12 cas d'utilisation, dont 3 de priorité haute et 2 à risque élevé. Il regroupe la communication, le pilotage et la synchronisation hors connexion.

**Tableau 6.10 — Package Fonctions transverses : cas d'utilisation, risque, priorité et itération**

| Id | Cas d'utilisation | Acteurs | Risque | Priorité | Itération |
|---|---|---|---|---|---|
| UC54 | Consulter ses conversations | A M I | Faible | Basse | 8 |
| UC55 | Envoyer un message | A M I | Moyen | Moyenne | 8 |
| UC56 | Réagir, répondre, masquer | A M I | Faible | Basse | 8 |
| UC57 | Consulter ses notifications | A M I | Élevé | Moyenne | 8 |
| UC58 | Diffuser une annonce | A | Faible | Basse | 8 |
| UC59 | Consulter le tableau de bord | A M I | Faible | Haute | 8 |
| UC60 | Consulter un rapport | A M I | Faible | Moyenne | 8 |
| UC61 | Exporter un rapport | A M | Faible | Basse | 8 |
| UC62 | Enregistrer un poste local | P | Moyen | Haute | 9 |
| UC63 | Synchroniser un poste local | P | Élevé | Haute | 9 |
| UC64 | Superviser le parc | A | Faible | Moyenne | 9 |
| UC65 | Restaurer une sauvegarde | A | Moyen | Basse | 9 |

Deux enseignements se lisent dans ces tableaux. Le risque n'est pas là où le volume est : le package Parcours de soin concentre vingt cas d'utilisation mais six seulement sont à risque élevé, alors que le package Sécurité et habilitations en compte quatre sur seize. Les difficultés se sont concentrées sur ce qui garantit les droits, non sur ce qui enregistre les actes.

Les cinq diagrammes suivants représentent chaque package. Nous les avons préférés à un diagramme unique : soixante-cinq cas d'utilisation sur une seule planche seraient illisibles au format A4, et la lisibilité d'un diagramme conditionne son utilité.

> 🖼️ **Figure 6.2 — Cas d'utilisation du package Sécurité et habilitations**
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 6.3 — Cas d'utilisation du package Référentiels et acteurs médicaux**
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 6.4 — Cas d'utilisation du package Dossier patient**
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 6.5 — Cas d'utilisation du package Parcours de soin**
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 6.6 — Cas d'utilisation du package Fonctions transverses**
> *Emplacement d'image réservé dans le document.*

### 6.2.6 Relations entre cas d'utilisation

Nous ne présentons ici que les relations imposées par le code. Nous n'en avons ajouté aucune pour enrichir le diagramme. Une relation d'inclusion qui ne correspondrait à aucun appel réel serait une décoration, non une modélisation. Une relation d'inclusion exprime une obligation : le cas de base ne peut pas s'exécuter sans que le cas inclus s'exécute aussi.

**Tableau 6.11 — Relations d'inclusion**

| Cas de base | Inclut | Justification dans le code |
|---|---|---|
| UC34 Ouvrir une visite | UC25 Rechercher un patient | Une visite ne peut exister sans patient |
| UC39 Ouvrir une consultation | UC37 Consulter la file d'attente | La consultation part d'une visite existante |
| UC42 Créer une ordonnance | Vérifier le droit de prescrire | Appel systématique du contrôle avant création |
| UC43 Émettre un bon de pharmacie | Vérifier l'éligibilité de la catégorie | Appel systématique du contrôle d'éligibilité |
| UC45 Émettre un bon d'examen | Vérifier l'éligibilité de la catégorie | Même contrôle, prestation examen |
| UC48 Clôturer une consultation | Clôturer la visite parente | La clôture pose l'état terminal sur la visite |
| UC01 Se connecter | UC07 Accepter les conditions | Un portail bloque l'accès sans acceptation |

Une relation d'extension exprime au contraire une possibilité : le cas étendu ne s'exécute que si une condition est remplie.

**Tableau 6.12 — Relations d'extension**

| Cas de base | Étendu par | Condition |
|---|---|---|
| UC01 Se connecter | UC02 Valider le second facteur | Si le second facteur est activé |
| UC01 Se connecter | UC03 Résoudre une connexion concurrente | Si une autre session est ouverte |
| UC01 Se connecter | UC04 Changer son mot de passe | Si le mot de passe est temporaire |
| UC48 Clôturer une consultation | UC50 Initier une évacuation | Si la décision retenue est l'évacuation |
| UC48 Clôturer une consultation | UC52 Ouvrir un suivi de traitement | Si la décision retenue est le suivi |
| UC42 Créer une ordonnance | UC43 Émettre un bon de pharmacie | Si l'ordonnance est pharmaceutique et validée |
| UC42 Créer une ordonnance | UC45 Émettre un bon d'examen | Si l'ordonnance est un examen et validée |

Nous ne retenons qu'une seule généralisation. Les cas de consultation et de gestion d'un référentiel sont des généralisations de neuf variantes concrètes, une par référentiel, chacune avec ses propres permissions. Représenter ces dix-huit cas individuellement rendrait le diagramme illisible sans rien apprendre : le comportement est identique, seule l'entité change.

## 6.3 Spécification détaillée

Conformément au plan de rédaction de l'école, deux descriptions textuelles complètes figurent dans le corps du mémoire, précédées de trois fiches en tableau.

### 6.3.1 Spécification des cas d'utilisation prioritaires

Nous avons retenu trois cas pour une spécification détaillée. Nous ne les avons pas choisis pour leur fréquence, mais parce qu'ils portent les règles les plus structurantes ou les mécanismes les plus originaux du système : l'authentification, la prescription sous délégation, et la synchronisation d'un poste hors connexion.

**Tableau 6.13 — Spécification de UC01 : Se connecter au système**

| Rubrique | Contenu |
|---|---|
| Acteur principal | Tout agent du centre |
| Préconditions | Le compte existe et n'est pas désactivé |
| Postconditions | Une session est ouverte, les droits effectifs sont chargés |
| Scénario nominal | L'agent saisit ses identifiants. Le système vérifie qu'aucun blocage n'est en cours, contrôle le mot de passe, remet à zéro les compteurs d'échec, émet les jetons, charge les droits effectifs et dirige l'agent vers sa page d'accueil |
| Scénarios alternatifs | Second facteur activé, session déjà ouverte ailleurs, mot de passe temporaire, conditions d'utilisation non acceptées |
| Scénarios d'exception | Compte bloqué : refus avec durée restante. Mot de passe erroné : incrément du compteur puis blocage dont la durée est multipliée par quatre à chaque récidive. Compte désactivé : refus |
| Règles associées | Blocage progressif, unicité de session, acceptation des conditions bloquante |

**Tableau 6.14 — Spécification de UC42 : Créer et valider une ordonnance**

| Rubrique | Contenu |
|---|---|
| Acteur principal | Médecin Chef, ou Infirmier disposant d'une délégation active |
| Préconditions | Une consultation est ouverte |
| Postconditions | Une ordonnance validée existe, portant le cas échéant la trace de la délégation utilisée |
| Scénario nominal | Le soignant choisit le type d'ordonnance. Le système vérifie le droit de prescrire. L'ordonnance est créée à l'état brouillon, le soignant ajoute les lignes puis valide : l'ordonnance devient validée et n'est plus modifiable |
| Scénarios alternatifs | Suppression au brouillon, annulation après validation avec motif, impression |
| Scénarios d'exception | Infirmier sans délégation active : refus explicite. Modification après validation : refus |
| Règles associées | Le contrôle est à deux étages : la permission ouvre la porte, la délégation autorise l'acte. L'identifiant de la délégation est enregistré sur l'ordonnance |

**Tableau 6.15 — Spécification de UC63 : Synchroniser un poste local**

| Rubrique | Contenu |
|---|---|
| Acteur principal | Poste local autonome, acteur secondaire |
| Préconditions | Poste enregistré et serveur central joignable |
| Postconditions | Le poste détient les données à jour, ses modifications sont remontées, les conflits sont journalisés |
| Scénario nominal | Le poste s'abonne au canal de notification. Le serveur signale qu'il y a du neuf. Le poste demande les modifications survenues depuis son dernier horodatage, les applique localement, puis envoie les siennes. Le serveur les applique, les ignore ou signale un conflit |
| Scénarios alternatifs | Déclenchement manuel. Poste à l'origine de l'écriture : il n'est pas réveillé pour son propre travail |
| Scénarios d'exception | Écriture concurrente : la version la plus récente l'emporte et le conflit est journalisé. Serveur injoignable : le poste continue sur sa base locale |
| Règles associées | Jamais de blocage : aucun verrou distribué n'étant possible entre machines hors ligne, un conflit est tranché puis journalisé |

### 6.3.2 UC43 — Émettre un bon de pharmacie

Ce cas porte la règle métier la plus structurante du système : tous les patients n'ouvrent pas droit à la prise en charge des médicaments.

**Tableau 6.16 — Sommaire d'identification de UC43**

| Rubrique | Contenu |
|---|---|
| Objectif | Permettre à un soignant de générer, à partir d'une ordonnance pharmaceutique validée, un bon autorisant le patient à retirer ses médicaments |
| Acteur principal | Le soignant — Médecin Chef ou infirmier |
| Préconditions | Le soignant est connecté et dispose du droit de création de bon. Une consultation existe. Une ordonnance de type pharmaceutique, rattachée à cette consultation, est à l'état validé |
| Postconditions | Un bon de pharmacie existe à l'état en attente. Il est rattaché à l'ordonnance et à la consultation, il est imprimable, et sa création est journalisée |

**Tableau 6.17 — Scénario nominal de UC43**

| Étape | Acteur | Système |
|---|---|---|
| 1 | Le soignant ouvre l'ordonnance validée et demande la génération d'un bon |  |
| 2 |  | Le système lit la catégorie du patient et interroge la matrice des droits pour la prestation médicament |
| 3 |  | Il constate que la catégorie est couverte et crée le bon à l'état en attente, en reprenant les lignes de l'ordonnance |
| 4 |  | Il journalise la création |
| 5 | Le soignant imprime le bon et le remet au patient |  |

Deux scénarios alternatifs existent. L'annulation avant délivrance fait passer le bon à l'état annulé, avec un motif obligatoire. La délivrance, lorsque le pharmacien remet les médicaments, fait passer le bon à l'état délivré, qui est définitif.

Trois exceptions sont prévues. Si la catégorie n'est pas couverte, le système refuse : il affiche un message nommant explicitement la catégorie concernée, et rappelant que la prise en charge est réservée au personnel en contrat à durée indéterminée et à ses ayants droit. Aucun bon n'est créé. Si l'ordonnance n'est pas validée, le système refuse. Si le bon a déjà été délivré, l'annulation est refusée, les médicaments étant sortis.

Une remarque d'analyse s'impose. Il faut distinguer soigneusement l'ordonnance du bon. L'ordonnance n'est restreinte par aucune catégorie : tout patient peut en recevoir une. Le bon l'est, car il matérialise une prise en charge financière par l'employeur. Confondre les deux reviendrait à décrire un système qui refuse de soigner, alors qu'il refuse seulement de prendre en charge.

### 6.3.3 UC48 — Clôturer une consultation avec décision

**Tableau 6.18 — Sommaire d'identification de UC48**

| Rubrique | Contenu |
|---|---|
| Objectif | Permettre à un soignant de mettre fin à une consultation en enregistrant sa conclusion et, le cas échéant, une décision médicale qui déclenche la suite de la prise en charge |
| Acteur principal | Le soignant qui conduit la consultation |
| Préconditions | Une consultation est ouverte et conduite par l'acteur. Un examen clinique et au moins un diagnostic ont normalement été saisis |
| Postconditions | La consultation est clôturée et n'est plus modifiable. La visite parente est clôturée. Une notification est diffusée. Selon la décision, une évacuation ou un suivi de traitement a été créé |

**Tableau 6.19 — Scénario nominal de UC48**

| Étape | Acteur | Système |
|---|---|---|
| 1 | Le soignant rédige sa conclusion et indique, s'il y a lieu, la durée de repos prescrite |  |
| 2 | Il choisit une décision médicale, ou n'en choisit aucune |  |
| 3 |  | Le système vérifie que la consultation n'est pas déjà dans un état terminal |
| 4 |  | Il enregistre la conclusion et la décision, puis fait passer la consultation à l'état clôturé |
| 5 |  | Il clôture la visite parente et émet une notification portant l'intitulé de la décision |

Quatre scénarios alternatifs sont prévus. La décision d'évacuation crée une évacuation rattachée à la consultation, à l'état en cours. La décision de suivi de traitement ouvre un épisode que des fiches datées viendront alimenter. L'absence de décision produit une clôture simple, le patient repartant sans orientation particulière. Un certificat de repos peut enfin être délivré, la date de reprise étant calculée selon que le jour de consultation compte ou non comme premier jour de repos.

Deux exceptions existent. Le système refuse toute modification d'un état terminal. Et il refuse de créer une seconde évacuation tant que la première n'est pas annulée. Le couplage entre les deux machines à états est le point le plus important de ce cas. Une visite ne peut pas être clôturée depuis l'écran de triage : seule la clôture d'une consultation y parvient. Cette contrainte est inscrite dans la table des transitions. Elle garantit qu'aucun patient ne sort du circuit sans qu'un acte clinique ait été enregistré.

## 6.4 Diagrammes de séquence système

Nous produisons deux diagrammes de séquence système. Le plan de rédaction de l'école en autorise trois au maximum. Ils présentent le système en boîte noire : seuls les échanges entre l'acteur et le système y sont visibles. Le premier retient l'émission d'un bon de pharmacie, qui porte la règle métier centrale avec un cas de refus explicite.

Le second retient la synchronisation d'un poste local. C'est le seul cas dont l'acteur principal est un système, et le seul à comporter une résolution de conflit. La connexion, qui est l'enchaînement le plus ramifié du système, est décrite au tableau 6.13 plutôt que par un diagramme. Ses quatre branches optionnelles et ses trois cas d'erreur s'y lisent plus précisément.

> 🖼️ **Figure 6.7 — Diagramme de séquence système : émettre un bon de pharmacie**
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 6.8 — Diagramme de séquence système : synchroniser un poste local**
> *Emplacement d'image réservé dans le document.*

## Conclusion du chapitre

Notre analyse a établi vingt-trois besoins fonctionnels et treize besoins non fonctionnels, tous rattachés à une preuve dans le système réalisé. Elle a identifié trois acteurs primaires et trois acteurs secondaires. Elle a recensé soixante-cinq cas d'utilisation répartis en douze modules, dont trente-sept de priorité haute, et a spécifié en détail les plus structurants. La confrontation des besoins exprimés aux exigences retenues a produit un résultat qu'il faut souligner. Aucun besoin n'est resté non couvert à l'intérieur du périmètre : les huit besoins sans réponse relèvent tous de domaines explicitement écartés.

Deux règles gouvernent l'ensemble, et devront être portées telles quelles dans la conception. La première est l'éligibilité par catégorie de patient. La seconde est le contrôle de prescription à deux étages, qui distingue la permission d'agir de l'autorisation d'agir. Le chapitre suivant projette ce modèle du métier sur l'architecture technique qui doit le porter.
