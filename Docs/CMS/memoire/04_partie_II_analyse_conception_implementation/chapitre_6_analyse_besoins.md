---
chapitre: 6
titre: "Analyse des besoins"
budget_pages: 8-10
statut: relu
sources: [INV-01, INV-03, INV-04, INV-07]
figures: [UML-CTX-01, UML-UC-01, UML-UC-02, UML-SEQS-01, UML-SEQS-02, UML-SEQS-03]
blocages: []
---

# CHAPITRE 6 — ANALYSE DES BESOINS

## Introduction du chapitre

L'analyse des besoins est la première étape formelle de la branche fonctionnelle de 2TUP. Elle transforme une compréhension du métier en un ensemble d'exigences numérotées, d'acteurs identifiés et de cas d'utilisation spécifiés, sur lesquels toute la conception s'appuiera ensuite.

Ce chapitre présente d'abord les besoins fonctionnels et non fonctionnels, puis les acteurs, la frontière du système, l'ensemble des cas d'utilisation et leur classification, les relations qui les lient, et enfin la spécification détaillée des cas prioritaires.

**Une précision de méthode s'impose.** Les besoins présentés ici ont été établis par **deux voies complémentaires**, et la distinction doit être claire.

**Les besoins exprimés** proviennent du recueil de l'existant : dix-huit besoins recueillis auprès de quatre acteurs, avec leur priorité. Ils disent ce que le centre **demandait**.

**Les besoins reconstitués** proviennent de l'analyse exhaustive du système : routes, permissions, écrans, règles et machines à états ont été inventoriés, puis remontés jusqu'à l'exigence qu'ils servent. Ils disent ce que le système **réalise**.

Les deux ensembles ne se recouvrent pas exactement, et c'est instructif. Certains besoins exprimés sont hors du périmètre retenu — ils ne produisent aucune exigence ici. Inversement, plusieurs exigences du système ne correspondent à aucun besoin explicitement formulé : la traçabilité, les habilitations granulaires, le chiffrement. Elles découlent de la **nature des données manipulées**, non d'une demande.

La confrontation systématique des deux ensembles figure au § 6.0.3.

Chaque exigence porte son statut et sa preuve. Cette double origine est assumée : elle garantit qu'aucune fonction livrée n'est absente de l'analyse, et qu'aucun besoin exprimé n'est passé sous silence.

---

## 6.0 Recueil et expression des besoins

### 6.0.1 Besoins fonctionnels

Vingt-trois besoins fonctionnels ont été identifiés. La colonne « preuve » renvoie à l'élément du système qui les réalise.

| Id | Besoin fonctionnel | Preuve | Statut |
|---|---|---|---|
| **BF01** | Authentifier les agents et sécuriser l'accès au système | 7 routes d'authentification, jeton signé, double facteur | `IMPLÉMENTÉ` |
| **BF02** | Gérer les comptes, les rôles et les habilitations | 32 routes d'administration, 128 permissions, 3 rôles | `IMPLÉMENTÉ` |
| **BF03** | Journaliser les actions sensibles | 151 routes auditées, journal persistant | `IMPLÉMENTÉ` |
| **BF04** | Paramétrer le système | Module de paramètres, 3 routes | `IMPLÉMENTÉ` |
| **BF05** | Gérer les référentiels métier | 37 routes, 9 référentiels | `IMPLÉMENTÉ` |
| **BF06** | Gérer le personnel médical et les délégations de prescription | 20 routes, modèles dédiés | `IMPLÉMENTÉ` |
| **BF07** | Tenir le registre des employés SARIS | 5 routes, registre partagé entre sites | `IMPLÉMENTÉ` |
| **BF08** | Gérer le dossier patient centralisé | 30 routes, 13 modèles de données | `IMPLÉMENTÉ` |
| **BF09** | Rattacher les ayants droit et les sous-traitants | Modèles de rattachement, historiques | `IMPLÉMENTÉ` |
| **BF10** | Enregistrer et trier les visites | 9 routes, file par ordre d'arrivée | `IMPLÉMENTÉ` |
| **BF11** | Relever les constantes vitales | Modèle à 23 champs, plages validées | `IMPLÉMENTÉ` |
| **BF12** | Conduire une consultation clinique | 22 routes, examen, diagnostics, conclusion | `IMPLÉMENTÉ` |
| **BF13** | Prescrire des médicaments ou des examens | Ordonnance à deux types, cycle de validation | `IMPLÉMENTÉ` |
| **BF14** | Émettre un bon d'examen et en saisir le résultat | 7 routes, quatre états | `IMPLÉMENTÉ` |
| **BF15** | Émettre et délivrer un bon de pharmacie | 5 routes, trois états | `IMPLÉMENTÉ` |
| **BF16** | Orienter un patient par évacuation et en suivre les étapes | 8 routes, cinq états, historique | `IMPLÉMENTÉ` |
| **BF17** | Ouvrir et alimenter un suivi de traitement | 8 routes, fiches datées | `IMPLÉMENTÉ` |
| **BF18** | Communiquer par messagerie interne | 29 routes, chiffrement, pièces jointes | `IMPLÉMENTÉ` |
| **BF19** | Notifier les agents en temps réel | 9 routes, flux d'événements, présence | `IMPLÉMENTÉ` |
| **BF20** | Piloter l'activité par tableau de bord | 9 routes, vues adaptées au rôle | `IMPLÉMENTÉ` |
| **BF21** | Produire des rapports statistiques | 2 routes, export | `IMPLÉMENTÉ` |
| **BF22** | Imprimer les documents cliniques au format A4 | 6 modèles d'impression | `IMPLÉMENTÉ` |
| **BF23** | Travailler sans connexion et se resynchroniser | 14 routes de synchronisation, 52 modèles, 2 mécanismes | `PARTIELLEMENT IMPLÉMENTÉ` — validation d'exécution restant à faire |

### 6.0.2 Besoins non fonctionnels

| Id | Besoin non fonctionnel | Exigence | Réalisation | Statut |
|---|---|---|---|---|
| **BNF01** | **Sécurité de l'accès** | Authentification forte, protection contre l'attaque en force | Mot de passe haché, second facteur temporel, codes de secours, **blocage progressif dont la durée est multipliée par quatre à chaque récidive**, limitation à 100 requêtes par minute et par utilisateur | `IMPLÉMENTÉ` |
| **BNF02** | **Confidentialité des données** | Aucune donnée sensible lisible au repos | Messagerie et secrets du second facteur chiffrés en AES-256-GCM ; file hors-ligne chiffrée ; jetons du client de bureau protégés par le coffre du système d'exploitation | `IMPLÉMENTÉ` |
| **BNF03** | **Confidentialité d'usage** | Un dossier sensible ne doit pas être visible de tous | Verrou de dossier posé par le médecin chef, cloisonnement par initiateur, floutage permanent des zones cliniques révélées au survol | `IMPLÉMENTÉ` |
| **BNF04** | **Traçabilité** | Toute action sensible doit être imputable | Journal d'audit alimenté par un intercepteur unique, capturant auteur, action, entité, adresse IP réelle et statut ; aucune route d'écriture directe dans le journal | `IMPLÉMENTÉ` |
| **BNF05** | **Continuité hors connexion** | Le poste doit rester opérationnel sans réseau | Deux mécanismes distincts : file de mutations rejouées côté web, base locale et synchronisation par deltas côté poste autonome | `PARTIELLEMENT IMPLÉMENTÉ` |
| **BNF06** | **Cohérence entre les deux sites** | Un patient vu à Moutela doit être retrouvé à Nkayi | Dossier patient et parcours de soin en portée **globale** : chaque poste détient l'ensemble des dossiers | `IMPLÉMENTÉ` |
| **BNF07** | **Intégrité des saisies** | Une donnée invalide ne doit jamais entrer | Validation stricte à l'entrée avec rejet des champs inconnus ; plages physiologiques des constantes alignées entre client et serveur | `IMPLÉMENTÉ` |
| **BNF08** | **Réversibilité des suppressions** | Une suppression doit pouvoir se propager sans perte | Suppression logique sur 47 modèles, propagation par marques de suppression | `IMPLÉMENTÉ` |
| **BNF09** | **Accessibilité linguistique** | Le système doit être utilisable en français et en anglais | Bilinguisme complet, bascule en direct, préférence mémorisée par compte | `IMPLÉMENTÉ` |
| **BNF10** | **Ergonomie et mobilité** | Utilisable sur poste, tablette et téléphone | Interface adaptative, menu en tiroir sur mobile, application installable | `IMPLÉMENTÉ` |
| **BNF11** | **Déployabilité** | Installation sans droits d'administrateur, mise à jour sans intervention | Installateur par utilisateur, mise à jour automatique avec notification | `PARTIELLEMENT IMPLÉMENTÉ` — signature de code non active |
| **BNF12** | **Maintenabilité** | Une règle ne doit exister qu'à un seul endroit | Monorepo à types partagés ; utilitaires désignés « source unique » pour l'indice de masse corporelle, la date de reprise, l'éligibilité aux prestations, le droit de prescrire | `IMPLÉMENTÉ` |
| **BNF13** | **Robustesse des erreurs** | Toute erreur doit produire une réponse exploitable | Filtre global renvoyant une structure unique ; traduction des erreurs de base en codes HTTP explicites | `IMPLÉMENTÉ` |

> **Sur les performances.** Aucune exigence chiffrée de temps de réponse n'a pu être établie : elle n'apparaît ni dans le recueil, ni sous forme mesurable dans le code, et aucune campagne de mesure n'a été conduite. Annoncer un seuil serait une invention. Le sujet est renvoyé aux perspectives.

### 6.0.3 Confrontation des besoins exprimés aux exigences retenues

Les dix-huit besoins du recueil se répartissent ainsi une fois confrontés au périmètre.

| Besoin exprimé | Prio | Devient | Verdict |
|---|:---:|---|---|
| Système centralisé entre les deux sites | 🔴 | BF23, BNF05, BNF06 | ✅ couvert |
| Dossier patient numérique | 🔴 | BF08, BF09 | ✅ couvert |
| Automatisation des rapports | 🔴 | BF20, BF21 | ⚠️ partiel — 4 axes sur 10 hors d'atteinte |
| Formulaire de triage numérique | 🟡 | BF10, BF11 | ✅ couvert |
| Repos médicaux avec lien vers le service RH | 🟡 | BF22 | ⚠️ partiel — le document est produit, non transmis |
| Statistiques par catégorie et par direction | 🟡 | BF21 | ⚠️ partiel — la direction n'existe pas au modèle |
| Délégation formalisée | 🟢 | BF06, BF13 | ✅ couvert |
| Espace de consultation autonome | 🟡 | BF20 | ✅ couvert pour le domaine médical |
| Suivi des pathologies fréquentes | 🟡 | BF21 | ✅ couvert |
| Dématérialisation des flux | 🟢 | BF18, BF22 | ⚠️ partiel dans le périmètre |
| **Coûts d'évacuation** | 🔴 | — | 🚫 hors périmètre |
| **Tableau de bord de l'absentéisme** | 🔴 | — | 🚫 hors périmètre |
| **Gestion du stock pharmaceutique** | 🔴 | — | 🚫 hors périmètre |
| **Impression des reçus de dispensation** | 🔴 | — | 🚫 hors périmètre |
| **Facturation pharmaceutique** | 🔴 | — | 🚫 hors périmètre |
| Alertes de stock et de péremption | 🟡 | — | 🚫 hors périmètre |
| Rythme de réapprovisionnement | 🟡 | — | 🚫 hors périmètre — **problème organisationnel, non informatique** |
| Inventaires physiques réguliers | 🟢 | — | 🚫 hors périmètre — idem |

**Synthèse : 6 couverts · 4 partiels · 8 hors périmètre · 0 non couvert dans le périmètre.**

### 6.0.4 Les exigences sans besoin exprimé

Six besoins non fonctionnels ne correspondent à **aucune demande formulée** lors des entretiens. Ils découlent de la nature des données manipulées et des conditions d'exploitation.

| Id | Exigence | Origine |
|---|---|---|
| BNF01 | Sécurité de l'accès | Données de santé — obligation implicite |
| BNF02 | Confidentialité au repos | Idem |
| BNF04 | Traçabilité | Idem. Le recueil constate l'absence de traçabilité mais n'en fait pas une demande |
| BNF07 | Intégrité des saisies | Qualité de la donnée clinique |
| BNF08 | Réversibilité des suppressions | Conséquence technique du fonctionnement hors connexion |
| BNF12 | Maintenabilité | Contrainte d'équipe |

> **Ce constat mérite d'être relevé.** Les acteurs n'ont pas demandé de sécurité ni de traçabilité — ils ont demandé des tableaux de bord et un logiciel de stock. Les exigences les plus structurantes du système ne figuraient donc dans aucun besoin exprimé.
>
> C'est une observation classique en ingénierie des exigences : **l'utilisateur exprime ce qui lui manque au quotidien, non ce qui protège les données dont il a la charge.** Le rôle de l'analyse est précisément de compléter le recueil par ces exigences implicites.

---

## 6.1 Identification des acteurs

Le système ne connaît que **trois rôles**. Les acteurs primaires en découlent directement — il n'en existe pas d'autres, et aucun ne doit être ajouté par analogie avec un autre centre de santé.

| Acteur | Rôle technique | Type | Permissions | Vocation |
|---|---|---|---|---|
| **Administrateur Système** | `ADMIN_SYSTEME` | primaire | 128 / 128 | Gouvernance de la plateforme : comptes, rôles, paramètres, supervision de la synchronisation. Détient également l'accès clinique complet |
| **Médecin Chef** | `MEDECIN_CHEF` | primaire | 101 / 128 | Référence clinique du centre : activité de soin complète, gouvernance des référentiels et du personnel, délégations, évacuations, audit |
| **Infirmier** | `INFIRMIER` | primaire | 51 / 128 | Accueil, triage, constantes vitales, consultation de ses propres patients, prescription **uniquement sous délégation active** |
| **Poste local autonome** | — | **secondaire** | — | Instance du client de bureau fonctionnant hors ligne, qui se synchronise avec le serveur central |
| **Service de géolocalisation** | — | **secondaire, externe** | — | Fournit ville et coordonnées à partir d'une adresse IP, pour le journal d'authentification. Dispose d'un repli hors ligne |
| **Canal de mise à jour** | — | **secondaire, externe** | — | Publie et distribue les versions du client de bureau |

**Deux précisions indispensables.**

D'abord, **`MEDECIN` n'est pas un rôle du système** : c'est une *profession* du personnel médical. Tout médecin reçoit le rôle `MEDECIN_CHEF`. Créer un acteur « Médecin » distinct serait une erreur d'analyse.

Ensuite, l'**Administrateur Système détient la totalité du catalogue**, actes cliniques compris. C'est un choix de gouvernance explicite pour ce déploiement, où l'administrateur pilote et supervise l'ensemble de la plateforme. Ce choix doit être énoncé, car il déroge au principe de séparation des pouvoirs et un jury ne manquera pas de le relever.

> **Figure 6.1 — Diagramme de contexte statique** *(fiche `UML-CTX-01`)*

---

## 6.2 Frontière du système

La frontière retenue est celle de l'application CMS SARIS : elle commence à l'authentification d'un agent et s'arrête aux documents imprimés qu'il remet au patient.

**Sont dans le système** : dossiers, visites, consultations, prescriptions, bons, évacuations, suivis, messagerie, notifications, tableaux de bord, référentiels, comptes et droits, synchronisation.

**Sont hors du système**, bien que voisins : la facturation et la comptabilité — le système émet des bons de prise en charge, jamais de facture, et aucun modèle de données ne porte de montant ; la gestion de stock de pharmacie — le bon est un bon de retrait, aucune quantité n'est suivie ; le laboratoire — le bon sort du système, seul le résultat y revient, saisi manuellement ; l'hospitalisation — le centre oriente par évacuation.

---

## 6.3 Cas d'utilisation

Soixante-cinq cas d'utilisation ont été identifiés, répartis en douze modules fonctionnels.

> **Figure 6.2 — Diagramme de cas d'utilisation global** *(fiche `UML-UC-01`)*

### 6.3.1 Module Sécurité et accès personnel

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC01 | Se connecter au système | tous | haute |
| UC02 | Valider le second facteur d'authentification | tous | haute |
| UC03 | Résoudre une connexion concurrente | tous | moyenne |
| UC04 | Changer son mot de passe | tous | haute |
| UC05 | Consulter et révoquer ses sessions | tous | moyenne |
| UC06 | Activer ou désactiver son second facteur | tous | moyenne |
| UC07 | Accepter les conditions d'utilisation | tous | haute |
| UC08 | Gérer ses préférences d'affichage et de langue | tous | basse |

### 6.3.2 Module Habilitations

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC09 | Créer et gérer un compte utilisateur | Admin, Médecin Chef | haute |
| UC10 | Attribuer un rôle à un compte | Admin | haute |
| UC11 | Éditer la matrice de permissions d'un rôle | Admin | haute |
| UC12 | Accorder ou révoquer une permission individuelle | Admin | moyenne |
| UC13 | Réinitialiser le mot de passe d'un agent | Admin | moyenne |

### 6.3.3 Module Supervision et paramètres

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC14 | Consulter le journal d'audit | Admin, Médecin Chef | haute |
| UC15 | Consulter les paramètres système | Admin | moyenne |
| UC16 | Modifier les paramètres système | Admin | moyenne |

### 6.3.4 Module Référentiels

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC17 | Consulter un référentiel | tous | haute |
| UC18 | Créer, modifier ou désactiver une entrée de référentiel | Admin, Médecin Chef | haute |
| UC19 | Gérer les sociétés sous-traitantes | Admin, Médecin Chef | moyenne |
| UC20 | Tenir le registre des employés SARIS | Admin, Médecin Chef, Infirmier | haute |

### 6.3.5 Module Acteurs médicaux

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC21 | Gérer une fiche de personnel médical | Admin, Médecin Chef | haute |
| UC22 | Accorder une délégation de prescription | Médecin Chef | haute |
| UC23 | Révoquer une délégation | Médecin Chef | haute |
| UC24 | Consulter ses délégations actives | Infirmier | moyenne |

### 6.3.6 Module Dossier patient

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC25 | Rechercher un patient | tous | haute |
| UC26 | Créer un dossier patient | tous | haute |
| UC27 | Consulter un dossier patient | tous | haute |
| UC28 | Mettre à jour l'identité et les données médicales | tous | haute |
| UC29 | Gérer les rattachements d'un patient | tous | haute |
| UC30 | Changer la catégorie d'un patient | Admin, Médecin Chef | haute |
| UC31 | Verrouiller ou déverrouiller un dossier | Admin, Médecin Chef | moyenne |
| UC32 | Archiver un dossier | Admin, Médecin Chef | basse |
| UC33 | Imprimer un dossier | tous | basse |

### 6.3.7 Module Triage

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC34 | Ouvrir une visite | Infirmier, Médecin Chef | **haute** |
| UC35 | Relever les constantes vitales | Infirmier, Médecin Chef | haute |
| UC36 | Affecter un soignant à une visite | Infirmier, Médecin Chef | haute |
| UC37 | Consulter la file d'attente | tous | haute |
| UC38 | Annuler une visite | Infirmier, Médecin Chef | moyenne |

### 6.3.8 Module Consultation et actes prescrits

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC39 | Ouvrir une consultation | Médecin Chef, Infirmier | **haute** |
| UC40 | Saisir l'examen clinique | Médecin Chef, Infirmier | haute |
| UC41 | Poser un diagnostic | Médecin Chef, Infirmier | haute |
| UC42 | Créer et valider une ordonnance | Médecin Chef, Infirmier délégué | **haute** |
| UC43 | Émettre un bon de pharmacie | Médecin Chef, Infirmier | **haute** |
| UC44 | Délivrer un bon de pharmacie | Médecin Chef | moyenne |
| UC45 | Émettre un bon d'examen | Médecin Chef, Infirmier | haute |
| UC46 | Saisir un résultat d'examen | Médecin Chef, Infirmier | haute |
| UC47 | Délivrer un certificat de repos | Médecin Chef, Infirmier | moyenne |
| UC48 | Clôturer une consultation avec décision | Médecin Chef, Infirmier | **haute** |
| UC49 | Annuler une consultation | Médecin Chef, Infirmier | moyenne |

### 6.3.9 Module Sorties critiques et suivi

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC50 | Initier une évacuation | Médecin Chef | haute |
| UC51 | Suivre et clôturer une évacuation | Médecin Chef | haute |
| UC52 | Ouvrir un suivi de traitement | Médecin Chef, Infirmier | moyenne |
| UC53 | Ajouter une fiche de suivi | Médecin Chef, Infirmier | moyenne |

### 6.3.10 Module Communication

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC54 | Consulter ses conversations | tous | moyenne |
| UC55 | Envoyer un message, avec pièce jointe | tous | moyenne |
| UC56 | Réagir, répondre ou masquer un message | tous | basse |
| UC57 | Consulter ses notifications | tous | moyenne |
| UC58 | Diffuser une annonce | Admin | basse |

### 6.3.11 Module Pilotage

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC59 | Consulter le tableau de bord de son rôle | tous | haute |
| UC60 | Consulter un rapport statistique | tous | moyenne |
| UC61 | Exporter un rapport | Médecin Chef, Admin | basse |

### 6.3.12 Module Synchronisation

| Id | Cas d'utilisation | Acteurs | Priorité |
|---|---|---|---|
| UC62 | Enregistrer un poste local | Poste local | haute |
| UC63 | Synchroniser un poste local | Poste local | **haute** |
| UC64 | Superviser le parc de postes | Admin | moyenne |
| UC65 | Restaurer une sauvegarde de configuration | Admin | basse |

### 6.3.13 Synthèse de la classification

| Module | Cas d'utilisation | Dont priorité haute |
|---|---:|---:|
| Sécurité et accès personnel | 8 | 4 |
| Habilitations | 5 | 3 |
| Supervision et paramètres | 3 | 1 |
| Référentiels | 4 | 3 |
| Acteurs médicaux | 4 | 3 |
| Dossier patient | 9 | 6 |
| Triage | 5 | 4 |
| Consultation et actes | 11 | 8 |
| Sorties critiques et suivi | 4 | 2 |
| Communication | 5 | 0 |
| Pilotage | 3 | 1 |
| Synchronisation | 4 | 2 |
| **Total** | **65** | **37** |

---

## 6.4 Relations entre cas d'utilisation

Les relations retenues sont uniquement celles que le code impose. Aucune n'a été ajoutée pour enrichir le diagramme.

> **Figure 6.3 — Relations entre cas d'utilisation** *(fiche `UML-UC-02`)*

### 6.4.1 Relations d'inclusion — obligatoires

| Cas de base | Inclut | Justification dans le code |
|---|---|---|
| UC34 Ouvrir une visite | UC25 Rechercher un patient | Une visite ne peut exister sans patient : l'identifiant est obligatoire |
| UC39 Ouvrir une consultation | UC37 Consulter la file d'attente | La consultation part d'une visite existante |
| UC42 Créer une ordonnance | **Vérifier le droit de prescrire** | Appel systématique de la garde de prescription |
| UC43 Émettre un bon de pharmacie | **Vérifier l'éligibilité de la catégorie** | Appel systématique de la garde d'éligibilité |
| UC45 Émettre un bon d'examen | **Vérifier l'éligibilité de la catégorie** | Idem, pour la prestation « examen » |
| UC48 Clôturer une consultation | **Clôturer la visite parente** | La clôture pose l'état terminal sur la visite |
| UC01 Se connecter | UC07 Accepter les conditions d'utilisation | Un portail bloque l'accès tant que l'acceptation n'est pas faite |

### 6.4.2 Relations d'extension — optionnelles

| Cas de base | Étendu par | Condition |
|---|---|---|
| UC01 Se connecter | UC02 Valider le second facteur | si le second facteur est activé sur le compte |
| UC01 Se connecter | UC03 Résoudre une connexion concurrente | si une autre session est déjà ouverte |
| UC01 Se connecter | UC04 Changer son mot de passe | si le mot de passe est temporaire |
| UC48 Clôturer une consultation | UC50 Initier une évacuation | si la décision est « évacuation » |
| UC48 Clôturer une consultation | UC52 Ouvrir un suivi de traitement | si la décision est « suivi de traitement » |
| UC42 Créer une ordonnance | UC43 Émettre un bon de pharmacie | si l'ordonnance est de type pharmaceutique **et** validée |
| UC42 Créer une ordonnance | UC45 Émettre un bon d'examen | si l'ordonnance est de type prescription d'examen **et** validée |

### 6.4.3 Généralisation

Une seule généralisation est justifiée : les cas UC17 « Consulter un référentiel » et UC18 « Créer, modifier ou désactiver une entrée » sont des **généralisations** de neuf variantes concrètes, une par référentiel — sites, motifs, pathologies, médicaments, catégories, types d'examen, types de consultation, sociétés sous-traitantes, registre des employés. Chaque variante possède ses propres permissions de lecture et d'écriture.

Représenter ces dix-huit cas individuellement rendrait le diagramme illisible sans rien apprendre : le comportement est identique, seule l'entité change. La généralisation est ici une simplification **justifiée**, non une facilité.

---

## 6.5 Spécifications détaillées des cas d'utilisation prioritaires

Cinq cas ont été retenus, choisis parce qu'ils portent les règles les plus structurantes ou les mécanismes les plus originaux du système.

### Tableau 6.3 — UC01 : Se connecter au système

| Rubrique | Contenu |
|---|---|
| **Acteur principal** | Tout agent du centre |
| **Préconditions** | Le compte existe et n'est pas désactivé |
| **Postconditions** | Une session est ouverte, les droits effectifs sont chargés, l'agent est dirigé vers la page d'accueil de son rôle |
| **Scénario nominal** | 1. L'agent saisit son identifiant et son mot de passe. 2. Le système vérifie qu'aucun blocage n'est en cours. 3. Le système vérifie le mot de passe. 4. Le système remet à zéro les compteurs d'échec. 5. Le système émet un jeton d'accès et un jeton de renouvellement. 6. Le système charge les droits effectifs. 7. Le système dirige l'agent vers sa page d'accueil |
| **Alternatives** | A1 — second facteur activé : une étape de validation s'intercale avant l'émission des jetons. A2 — session déjà ouverte ailleurs : une étape de résolution s'intercale. A3 — mot de passe temporaire : changement obligatoire avant tout accès. A4 — conditions d'utilisation non acceptées : un portail bloque l'accès |
| **Exceptions** | E1 — compte bloqué : refus, avec la durée restante. E2 — mot de passe erroné : incrément du compteur ; au seuil, blocage dont la durée est **multipliée par quatre** à chaque récidive. E3 — compte désactivé : refus |
| **Règles associées** | Blocage progressif ; unicité de session ; acceptation des conditions bloquante |

### Tableau 6.4 — UC34 : Ouvrir une visite

| Rubrique | Contenu |
|---|---|
| **Acteur principal** | Infirmier |
| **Préconditions** | Agent connecté disposant du droit de création de visite ; le patient existe et son dossier est actif |
| **Postconditions** | Une visite est créée en attente et entre dans la file par ordre d'arrivée |
| **Scénario nominal** | 1. L'infirmier recherche le patient. 2. Il vérifie visuellement le matricule. 3. Il sélectionne le motif. 4. Le système contrôle que le patient est actif, que le motif est actif et qu'aucune visite n'est déjà ouverte. 5. Le système crée la visite. 6. L'infirmier relève les constantes vitales. 7. La visite apparaît dans la file |
| **Alternatives** | A1 — patient inconnu : création préalable du dossier. A2 — affectation immédiate d'un soignant |
| **Exceptions** | E1 — patient non actif : refus. E2 — motif inactif : refus. E3 — visite déjà ouverte pour ce patient : refus, la visite existante est proposée |
| **Règles associées** | **Aucune notion de priorité** : la file est strictement ordonnée par arrivée. Une seule visite ouverte par patient |

### Tableau 6.5 — UC42 : Créer et valider une ordonnance

| Rubrique | Contenu |
|---|---|
| **Acteur principal** | Médecin Chef, ou Infirmier disposant d'une délégation active |
| **Préconditions** | Une consultation est ouverte |
| **Postconditions** | Une ordonnance validée existe, rattachée à la consultation, portant le cas échéant la trace de la délégation utilisée |
| **Scénario nominal** | 1. Le soignant choisit le type d'ordonnance. 2. **Le système vérifie le droit de prescrire.** 3. L'ordonnance est créée à l'état brouillon. 4. Le soignant ajoute les lignes. 5. Le soignant valide. 6. L'ordonnance devient validée et n'est plus modifiable |
| **Alternatives** | A1 — suppression de l'ordonnance tant qu'elle est au brouillon. A2 — annulation après validation. A3 — impression |
| **Exceptions** | E1 — infirmier sans délégation active : refus explicite. E2 — modification après validation : refus |
| **Règle centrale** | Le contrôle est **à deux étages** : la permission ouvre la porte, la délégation autorise l'acte. L'identifiant de la délégation est enregistré sur l'ordonnance, rendant la responsabilité traçable |

### Tableau 6.6 — UC48 : Clôturer une consultation avec décision

| Rubrique | Contenu |
|---|---|
| **Acteur principal** | Médecin Chef ou Infirmier |
| **Préconditions** | Une consultation ouverte, conduite par l'acteur |
| **Postconditions** | La consultation est clôturée, la visite parente également, une notification est émise |
| **Scénario nominal** | 1. Le soignant rédige la conclusion. 2. Il choisit une décision, ou n'en choisit aucune. 3. Le système clôture la consultation. 4. Le système clôture la visite parente. 5. Le système émet une notification portant la décision |
| **Alternatives** | A1 — décision « évacuation » : une évacuation est créée. A2 — décision « suivi de traitement » : un épisode de suivi est ouvert. A3 — aucune décision : clôture simple |
| **Exceptions** | E1 — consultation déjà terminale : refus |
| **Règle** | **Deux décisions seulement** existent. La clôture simple se caractérise par l'absence de décision. Ce point corrige une divergence avec une documentation antérieure du projet, qui en annonçait quatre |

### Tableau 6.7 — UC63 : Synchroniser un poste local

| Rubrique | Contenu |
|---|---|
| **Acteur principal** | Poste local autonome (acteur secondaire) |
| **Préconditions** | Poste enregistré, serveur central joignable |
| **Postconditions** | Le poste détient les données à jour, ses modifications sont remontées, les conflits sont journalisés |
| **Scénario nominal** | 1. Le poste s'abonne au canal de notification. 2. Le serveur signale qu'il y a du neuf. 3. Le poste demande les modifications depuis son dernier horodatage. 4. Le serveur renvoie les deltas, marques de suppression comprises. 5. Le poste applique localement. 6. Le poste envoie ses propres modifications. 7. Le serveur applique, ignore ou signale un conflit. 8. Les conflits sont journalisés |
| **Alternatives** | A1 — déclenchement manuel. A2 — poste à l'origine de l'écriture : il n'est pas réveillé pour son propre travail |
| **Exceptions** | E1 — écriture concurrente : la version la plus récente l'emporte, le conflit est journalisé. E2 — serveur injoignable : le poste continue sur sa base locale |
| **Règle** | **Jamais de blocage** : aucun verrou distribué n'est possible entre machines hors ligne. Un conflit est tranché puis journalisé, jamais mis en attente |

---

## 6.6 Descriptions textuelles détaillées

Conformément au plan de rédaction de l'école, **deux** descriptions textuelles complètes figurent dans le corps du mémoire. Les autres sont reportées en **annexe C**.

### 6.6.1 UC43 — Émettre un bon de pharmacie

**Numéro** : UC43 · **Acteurs** : Médecin Chef, Infirmier · **Module** : Consultation et actes prescrits

**Résumé.** Un soignant génère, à partir d'une ordonnance pharmaceutique validée, un bon permettant au patient de retirer ses médicaments. Ce cas porte la règle métier la plus structurante du système : **tous les patients n'ouvrent pas droit à cette prise en charge**.

**Préconditions.** Le soignant est connecté et dispose du droit de création de bon. Une consultation existe. Une ordonnance de type pharmaceutique, rattachée à cette consultation, est à l'état validé.

**Postconditions.** Un bon de pharmacie existe à l'état « en attente », rattaché à l'ordonnance et à la consultation. Il est imprimable. La création est journalisée à l'audit.

**Scénario nominal**

1. Le soignant ouvre l'ordonnance validée.
2. Il demande la génération d'un bon de pharmacie.
3. Le système lit la catégorie du patient concerné.
4. **Le système interroge la matrice des droits par catégorie** pour la prestation « médicament ».
5. La matrice indique que la catégorie est couverte.
6. Le système crée le bon à l'état « en attente », reprenant les lignes de l'ordonnance.
7. Le système journalise la création.
8. Le soignant imprime le bon et le remet au patient.

**Scénarios alternatifs**

- **A1 — Annulation avant délivrance.** Le soignant annule le bon en indiquant un motif obligatoire ; le bon passe à l'état « annulé ».
- **A2 — Délivrance.** Le pharmacien remet les médicaments ; le bon passe à l'état « délivré » et devient définitif.

**Scénarios d'exception**

- **E1 — Catégorie non couverte.** La matrice indique que la catégorie n'ouvre pas droit à la prestation. Le système refuse et affiche un message nommant explicitement la catégorie concernée et rappelant que la prise en charge est réservée au personnel en contrat à durée indéterminée et à ses ayants droit. **Aucun bon n'est créé.**
- **E2 — Ordonnance non validée.** Le système refuse : seule une ordonnance validée peut engendrer un bon.
- **E3 — Tentative d'annulation d'un bon délivré.** Le système refuse : les médicaments sont sortis.

**Règles métier mobilisées.** Éligibilité par catégorie de patient ; irréversibilité de la délivrance ; obligation de motif à l'annulation.

**Remarque d'analyse.** Il faut distinguer soigneusement l'ordonnance du bon. **L'ordonnance n'est restreinte par aucune catégorie** : tout patient peut en recevoir une. **Le bon l'est** : il matérialise une prise en charge financière par l'employeur. Confondre les deux reviendrait à décrire un système qui refuse de soigner, alors qu'il refuse seulement de prendre en charge.

### 6.6.2 UC48 — Clôturer une consultation avec décision

**Numéro** : UC48 · **Acteurs** : Médecin Chef, Infirmier · **Module** : Consultation et actes prescrits

**Résumé.** Le soignant met fin à une consultation en enregistrant sa conclusion et, le cas échéant, une décision médicale qui déclenche la suite de la prise en charge.

**Préconditions.** Une consultation est ouverte et conduite par l'acteur. Un examen clinique et au moins un diagnostic ont normalement été saisis.

**Postconditions.** La consultation est clôturée et n'est plus modifiable. La visite parente est clôturée. Une notification est diffusée. Selon la décision, une évacuation ou un suivi de traitement a été créé.

**Scénario nominal**

1. Le soignant rédige la conclusion de la consultation.
2. Il indique, s'il y a lieu, la durée de repos prescrite.
3. Il choisit une décision médicale, ou n'en choisit aucune.
4. Le système vérifie que la consultation n'est pas déjà dans un état terminal.
5. Le système enregistre la conclusion et la décision.
6. Le système fait passer la consultation à l'état clôturé.
7. **Le système fait passer la visite parente à l'état clôturé.**
8. Le système émet une notification portant l'intitulé de la décision.

**Scénarios alternatifs**

- **A1 — Décision « évacuation ».** Le système crée une évacuation rattachée à la consultation, à l'état « en cours ». Le patient sera suivi jusqu'à son admission dans la structure d'accueil.
- **A2 — Décision « suivi de traitement ».** Le système ouvre un épisode de suivi, que des fiches datées viendront alimenter depuis le dossier du patient.
- **A3 — Aucune décision.** La clôture est simple : le patient repart sans orientation particulière.
- **A4 — Certificat de repos.** Un certificat imprimable est délivré, la date de reprise étant calculée selon que le jour de consultation compte ou non comme premier jour de repos.

**Scénarios d'exception**

- **E1 — Consultation déjà clôturée ou annulée.** Le système refuse toute modification d'un état terminal.
- **E2 — Évacuation déjà existante.** Le système refuse d'en créer une seconde tant que la première n'est pas annulée.

**Règles métier mobilisées.** Deux décisions médicales seulement ; couplage obligatoire entre la clôture de la consultation et celle de la visite ; irréversibilité des états terminaux.

**Remarque d'analyse.** Le couplage entre les deux machines à états est le point le plus important de ce cas. Une visite **ne peut pas** être clôturée depuis l'écran de triage : seule la clôture d'une consultation y parvient. Cette contrainte, inscrite dans la table des transitions, garantit qu'aucun patient ne sort du circuit sans qu'un acte clinique ait été enregistré.

---

## 6.7 Diagrammes de séquence système

Trois diagrammes de séquence système sont produits, conformément au plafond fixé par le plan de rédaction de l'école. Ils présentent le système en boîte noire : seuls les échanges entre l'acteur et le système sont visibles.

| Figure | Cas d'utilisation | Pourquoi celui-ci |
|---|---|---|
| **Figure 6.4** | UC01 — Se connecter | Enchaînement le plus ramifié du système : quatre branches optionnelles et trois cas d'erreur *(fiche `UML-SEQS-01`)* |
| **Figure 6.5** | UC43 — Émettre un bon de pharmacie | Porte la règle métier centrale, avec un cas de refus explicite *(fiche `UML-SEQS-02`)* |
| **Figure 6.6** | UC63 — Synchroniser un poste local | Seul cas dont l'acteur principal est un système, et seul à comporter une résolution de conflit *(fiche `UML-SEQS-03`)* |

---

## Conclusion du chapitre

L'analyse a établi **23 besoins fonctionnels** et **13 besoins non fonctionnels**, tous rattachés à une preuve dans le système réalisé. Elle a identifié **trois acteurs primaires** — et seulement trois — ainsi que trois acteurs secondaires dont un poste autonome qui dialogue avec le serveur comme un système à part entière. Elle a recensé **65 cas d'utilisation** répartis en douze modules, dont 37 de priorité haute, et spécifié en détail les cinq plus structurants.

Deux règles gouvernent l'ensemble et devront être portées telles quelles dans la conception : l'**éligibilité par catégorie de patient**, qui détermine qui ouvre droit aux bons, et le **contrôle de prescription à deux étages**, qui distingue la permission d'agir de l'autorisation d'agir. Une troisième caractéristique conditionne toute l'architecture : la **continuité hors connexion**, qui n'est pas une commodité mais une contrainte de contexte.

Le chapitre suivant opère la convergence des deux branches de 2TUP : il projette ce modèle du métier sur l'architecture technique qui doit le porter.
