---
chapitre: 5
titre: "Étude de l'existant"
budget_pages: 6-8
statut: relu
sources: [INV-08, recueil de l'existant, INV-01 à INV-07]
figures: [UML-ACT-01]
blocages: [QO-04 réduite]
---

# CHAPITRE 5 — ÉTUDE DE L'EXISTANT

## Introduction du chapitre

Ce chapitre applique la phase d'étude de l'existant de 2TUP : documenter formellement le fonctionnement en place **avant** le projet, à partir des données recueillies sur le terrain, puis en dresser une critique structurée qui justifiera la solution retenue.

Il s'appuie sur une **source primaire** : le recueil de l'existant, produit lors du stage à partir de **quatre entretiens** conduits auprès des acteurs du Service Médico-Social.

### Précision sur la conduite du stage

Le stage à la SARIS a été effectué par **Nzila Verdi Oscarvie**, qui a conduit l'ensemble des entretiens et produit le recueil de l'existant. L'analyse de ces résultats, la sélection du périmètre, la conception et la réalisation de l'application relèvent du **travail commun des deux auteurs**.

---

## 5.1 Recueil des besoins par entretiens de terrain

### 5.1.1 Méthodologie d'enquête

La collecte s'est appuyée sur l'**entretien semi-directif**, conduit auprès de quatre acteurs choisis pour couvrir l'ensemble de la chaîne médico-sociale : un acteur administratif, un acteur pharmaceutique et deux acteurs cliniques.

Le choix de l'entretien comme technique principale se justifie par la nature de l'objet étudié. Le fonctionnement du centre reposait largement sur des **pratiques non écrites** : l'ordre de passage tenu de mémoire, la vérification du droit aux prises en charge par contrôle visuel du badge, la délégation de prescription accordée verbalement. Aucun document n'aurait permis de les reconstituer.

L'entretien a par ailleurs permis de recueillir des **besoins exprimés spontanément**, hors du questionnement prévu — le recueil en signale au moins un, le suivi épidémiologique par pathologie, cité de sa propre initiative par le gestionnaire RH.

⛔ **Le guide d'entretien utilisé n'est pas reproduit dans le recueil** — voir QO-04 et annexe A.

### 5.1.2 Déroulement des entretiens

⛔ **PARTIELLEMENT EN ATTENTE — QO-04**

**Ce qui est établi** : quatre entretiens ont été conduits, et **les quatre sont complétés**. Le recueil porte la mention « entretiens en cours » sur sa page de garde mais son tableau de suivi indique les quatre comme achevés.

**Ce qui reste à documenter** : la période, les sites visités, la durée moyenne des séances, le mode d'enregistrement des données — notes ou enregistrement audio avec accord — et les difficultés rencontrées.

### 5.1.3 Interlocuteurs rencontrés

**Tableau 5.1 — Interlocuteurs rencontrés lors du recueil de l'existant**

| # | Acteur | Périmètre de gestion | Lien avec le Centre Médico-Sanitaire | Entretien |
|---|---|---|---|---|
| 1 | **Gestionnaire RH / Service Social** | Évacuations sanitaires et contrôles, remboursements pharmaceutiques, accidents de travail, congés maladie et maternité | Reçoit les documents médicaux — papier et verbal — les traite administrativement et les valide en paie | ✅ complété |
| 2 | **Pharmacienne** | Stock de médicaments, dispensation, facturation par catégorie, rapports hebdomadaire, mensuel et annuel, réapprovisionnement trimestriel | Produit ses rapports, les transmet au médecin qui les centralise pour tous les sites | ✅ complété |
| 3 | **Médecin Chef** | Consultations générales et spécialisées, supervision médicale de tous les services, gestion administrative et rapports, décision d'évacuation, délégation de tâches | Dirige le Service Médico-Social ; tourne entre les deux sites selon le planning de permutation | ✅ complété |
| 4 | **Infirmière** | Triage et prise en charge infirmière | Premier point de contact de tout patient arrivant au centre | ✅ complété |

**Les quatre catégories d'acteurs de la chaîne médico-sociale sont donc couvertes** : administratif, pharmaceutique et clinique — ce dernier à deux niveaux, décisionnel et opérationnel.

> Les personnes ne sont pas nommées, l'autorisation de citer n'étant pas documentée. Elles sont désignées par leur fonction.

### 5.1.4 Synthèse des résultats

Les entretiens ont produit **dix-huit besoins exprimés**, dont huit de priorité haute. Ils se répartissent en trois domaines de nature très différente.

#### Domaine médical — Médecin Chef et Infirmière

| # | Besoin | Priorité | Source |
|---|---|:---:|---|
| M1 | Système d'information **centralisé entre les deux sites** | 🔴 Haute | Induit |
| M2 | **Dossier patient numérique** avec historique accessible au médecin | 🔴 Haute | Induit |
| M3 | **Automatisation des rapports** hebdomadaire, mensuel, annuel | 🔴 Haute | **Exprimé** |
| M4 | **Formulaire de triage numérique** — mode de vie, antécédents, examen clinique | 🟡 Moyenne | Induit |
| M5 | Gestion des repos médicaux liés aux accidents, avec lien vers le service RH | 🟡 Moyenne | Induit |
| M6 | Suivi statistique des pathologies par catégorie et par direction | 🟡 Moyenne | **Exprimé** |
| M7 | Délégation formalisée — interface distincte selon le profil | 🟢 Basse | Induit |

#### Domaine administratif — Gestionnaire RH et Service Social

| # | Besoin | Priorité | Source |
|---|---|:---:|---|
| R1 | Tableau de suivi des **coûts d'évacuation** — frais et coût salarial de l'absence | 🔴 Haute | **Exprimé** |
| R2 | **Tableau de bord de l'absentéisme** — par jour, direction, catégorie socio-professionnelle | 🔴 Haute | **Exprimé** |
| R3 | **Espace de consultation autonome** des données, à la demande | 🟡 Moyenne | **Exprimé** |
| R4 | Suivi des **pathologies fréquentes** et de leur prévalence | 🟡 Moyenne | **Spontané** |
| R5 | Dématérialisation des flux papier et verbal | 🟢 Basse | Induit |

#### Domaine pharmaceutique — Pharmacienne

| # | Besoin | Priorité | Source |
|---|---|:---:|---|
| P1 | **Logiciel de gestion du stock** avec persistance des données | 🔴 Haute | **Exprimé** |
| P2 | **Impression automatique des reçus** de dispensation | 🔴 Haute | **Exprimé** |
| P3 | Automatisation de la facturation et ventilation par catégorie | 🔴 Haute | **Exprimé** |
| P4 | Alertes sur stock bas et dates de péremption | 🟡 Moyenne | Induit |
| P5 | Révision du rythme de réapprovisionnement | 🟡 Moyenne | Induit |
| P6 | Reprise des inventaires physiques réguliers | 🟢 Basse | Induit |

> **Constat déterminant pour la suite du travail.** Ces dix-huit besoins couvrent **trois métiers distincts** : le soin, la logistique pharmaceutique et la gestion administrative du personnel. Aucun projet de fin de cycle ne pouvait les traiter ensemble sans devenir partout superficiel.
>
> C'est ce constat qui a conduit à **sélectionner un périmètre**, exposé au chapitre 3 § 3.5 et détaillé dans le document de cadrage du dossier. La confrontation besoin par besoin figure dans la matrice de couverture, dont la synthèse est reprise en conclusion.

---

## 5.2 Modélisation du système actuel

### 5.2.1 L'organisation

Le Service Médico-Social est rattaché à la **Direction des Ressources Humaines**. Il est dirigé par le Médecin Chef et donne naissance à deux entités opérationnelles : la **Section des Affaires Sociales**, gérée par un responsable RH, et le **Centre Médico-Sanitaire**, géré par le Médecin Chef.

Le centre opère sur **deux sites distincts, Moutela et Nkayi**. Le personnel médical n'est pas affecté à un site unique : il **tourne entre les deux selon un planning de permutation** défini à l'avance.

Le recueil énonce la conséquence sans détour :

> *« Aucun système d'information centralisé n'existe actuellement entre les deux sites. Chaque site fonctionne de façon autonome avec ses propres fichiers et ses propres données. La consolidation des informations est assurée manuellement par le Médecin Chef, qui agrège les données des deux sites pour les rapports destinés à la Direction Générale. »*

### 5.2.2 Les supports en usage

| Support | Rôle | Portée |
|---|---|---|
| **Carnet de santé individuel, papier** | Support de circulation de l'information entre les étapes | Transporté par le patient |
| Classeur papier | Recherche d'un patient connu | Local au site |
| Registre papier | Enregistrement des passages | Local au site |
| Fichier tableur | Comptages et statistiques | Local au site, a posteriori |

Le recueil relève par ailleurs que les échanges entre le centre et le service RH transitent **exclusivement** par deux canaux : le **papier** et le **verbal**. Il en tire une conclusion nette :

> *« L'absence de format numérique structuré constitue un facteur de risque important : les informations verbales ne laissent aucune trace, et les documents papier sont exposés aux pertes, erreurs de saisie et difficultés d'archivage. »*

### 5.2.3 Le processus de consultation

> **Figure 5.1 — Diagramme d'activité du processus de consultation actuel** *(fiche `UML-ACT-01`)*

**Un point mérite d'être souligné d'emblée** : ce processus est **structuré et formalisé**. Le Médecin Chef l'avait défini par écrit, en quatre étapes standardisées. Ce qui manquait n'était pas la méthode, mais **l'outil pour l'appliquer et en conserver la trace**.

**Étape 1 — Triage et accueil par l'infirmière.** Relevé du statut du patient, puis de son identité — nom, prénom, matricule le cas échéant. Suit un formulaire structuré de **neuf variables de mode de vie** : tabac, alcool, drogues, activité physique, alimentation, sommeil, sédentarité professionnelle, port de charges lourdes, automédication. Puis les **antécédents**, personnels et familiaux.

**Étape 2 — Anamnèse.** Quatre questions : date de début des symptômes, durée de la plainte, mode de début, symptômes actuels.

**Étape 3 — Examen clinique infirmier.** **Neuf paramètres standardisés** : état de conscience évalué au score de Glasgow, état général, hydratation, coloration, température, pouls, pression artérielle, fréquence respiratoire, poids, taille et indice de masse corporelle — ce dernier calculé.

À l'issue de cet examen, l'infirmière **évalue la complexité du cas** : cas simple, elle prend la consultation en charge sous délégation ; cas complexe ou doute, transfert immédiat au Médecin Chef.

**Étape 4 — Consultation médicale et diagnostic.** Examen physique, hypothèses diagnostiques, prescription d'un bilan complémentaire si nécessaire, traitement sur ordonnance, fiche de repos si le patient est un travailleur et que son état le justifie, planification d'un suivi.

**Une variante existe.** Pour les consultations **spécialisées** — ophtalmologie, ORL, stomatologie — le triage est **allégé** : l'infirmière collecte uniquement le statut et l'identité, puis oriente directement vers le spécialiste, sans anamnèse ni examen clinique.

### 5.2.4 La délégation de prescription

Le Médecin Chef cumule la prise en charge médicale et la gestion administrative du centre. Le recueil identifie **la surcharge administrative comme son principal point de tension** : rapports annuels, mensuels et hebdomadaires, suivi des maladies professionnelles et des accidents de travail s'ajoutent à l'activité clinique.

Il a donc mis en place une **délégation partielle** à certains infirmiers spécifiquement formés, encadrée par des règles précises.

| L'infirmier délégué **peut** | Il **ne peut pas** |
|---|---|
| Conduire une consultation complète pour les cas courants et simples | Traiter seul un cas présentant une complexité clinique |
| Prescrire pour les pathologies courantes — *paludisme simple, diarrhée, infection bénigne* | Décider d'une évacuation ou d'une orientation externe |
| | Prendre une décision médicale en cas de doute |

**Règle absolue**, énoncée telle quelle :

> *« Dès qu'un doute ou une complexité apparaît, le dossier est immédiatement remis au Médecin Chef, qui devient seul décisionnaire. L'infirmier délégué ne peut jamais prendre de décision médicale engageante sans validation du médecin. »*

Cette délégation reposait toutefois sur un accord **verbal ou écrit**, **sans contrôle systématique ni traçabilité fiable**. Rien ne permettait d'établir après coup sous quelle autorisation un acte avait été prescrit.

### 5.2.5 La règle de confidentialité

Le centre appliquait déjà une règle stricte, différenciée par acteur.

| Acteur | Niveau d'accès | Justification donnée |
|---|---|---|
| Médecin Chef | **Accès complet** à l'historique médical | Responsabilité médicale totale — secret médical |
| Infirmier | **Uniquement le résumé de la consultation en cours** | Ne voit que ce qui est nécessaire à sa tâche immédiate |
| Service RH / Social | Informations administratives — repos, accidents, évacuations — **sans accès au dossier médical** | Séparation entre données médicales et données RH |

Cette règle existait donc **avant** le projet. Elle n'était simplement garantie par aucun dispositif technique : un poste, un fichier partagé, aucune authentification.

---

## 5.3 Critique formelle de l'existant

### 5.3.1 Dimension informationnelle

| Problème constaté | Impact | Source |
|---|---|---|
| **Aucun dossier patient unique** — recherche dans un classeur ou un fichier local au site | Un patient vu sur l'autre site n'est pas retrouvé. L'information ne circule qu'avec le carnet qu'il transporte | Entretiens médicaux |
| **Aucune consolidation automatique entre les sites** | La consolidation est **manuelle**, assurée par le Médecin Chef pour ses rapports | Section 1.3 |
| **Le fichier tableur de la pharmacie ne conserve pas les données d'une session à l'autre** | **Aucun historique.** Un logiciel de facturation avait été abandonné pour la même raison | Entretien pharmacienne |
| Aucune autorité sur les matricules | Reconnaissance purement déclarative et visuelle | Entretiens |

> Le constat sur le tableur est le plus frappant du recueil. Il ne s'agit pas d'un outil imparfait mais d'un outil **qui ne conserve rien**. Il éclaire d'un jour cru le besoin de persistance.

### 5.3.2 Dimension organisationnelle

| Problème constaté | Impact |
|---|---|
| **Production manuelle de toutes les statistiques** | Limite la fréquence et la rapidité des analyses. Dix axes d'analyse sont attendus, tous produits à la main |
| **Surcharge administrative du Médecin Chef** | Principal point de tension déclaré. Motive la délégation |
| Droits de prise en charge vérifiés **de mémoire**, par contrôle visuel du badge | Risque d'inégalité de traitement selon l'agent |
| Traitement manuel des remboursements pharmaceutiques | Décrit comme chronophage et source de retards |
| Facturation pharmaceutique entièrement manuelle | **Tâche la plus chronophage** du poste de pharmacienne |

### 5.3.3 Dimension technique

| Problème constaté | Impact |
|---|---|
| Aucun système d'information entre les deux sites | Chaque site fonctionne en autonomie complète |
| Flux **papier et verbal** exclusivement | Perte de documents, aucune trace des échanges oraux, ressaisie obligatoire |
| Ruptures de stock récurrentes — réapprovisionnement trimestriel fixe | Pharmacie régulièrement vide ; les patients achètent ailleurs, plus cher |

### 5.3.4 Dimension sécuritaire

| Problème constaté | Impact |
|---|---|
| **Aucun contrôle d'accès** — un poste, un fichier partagé | Toute personne ayant accès au poste a accès à tout |
| **Aucune traçabilité** des actes, des accès ni des décisions | Aucune preuve d'autorisation des prescriptions déléguées |
| La règle de confidentialité existe mais n'est garantie par **aucun dispositif** | Elle repose entièrement sur la discipline des personnes |

### 5.3.5 Ce que la critique révèle

Il faut rendre justice au dispositif avant de le critiquer : **il fonctionnait**. Le processus était formalisé en quatre étapes standardisées, la règle de confidentialité était définie, la délégation était encadrée par des règles claires. Des patients étaient reçus, examinés, soignés.

Ce qui manquait n'était pas la méthode, mais **la mémoire du système** : la capacité à retrouver, à recouper, à prouver, à compter.

Un carnet perdu, et l'historique disparaissait. Un patient changeant de site, et il redevenait inconnu. Une prescription contestée, et rien ne permettait d'établir qui l'avait autorisée. Un rapport annuel demandé, et il fallait dépouiller à la main.

> ⛔ **Ce qui manque à cette critique.** Elle est **qualitative**. Le recueil documente les problèmes mais ne les chiffre pas : ni le nombre de dossiers dupliqués, ni les heures de dépouillement mensuel, ni la fréquence des ruptures de stock. Ces mesures n'ont pas été relevées lors des entretiens.

---

## 5.4 Proposition des solutions

Quatre catégories de solutions ont été examinées.

| Critère | **A — Progiciel hospitalier** | **B — Solution libre de dossier patient** | **C — Maintien du tableur** | **D — Développement sur mesure hors connexion prioritaire** |
|---|---|---|---|---|
| Adéquation au besoin | **Faible** — conçu pour un établissement complet, surdimensionné pour des soins de premier recours | **Moyenne** — adaptable, mais non taillé pour la règle de prise en charge propre à SARIS | **Nulle** — c'est l'existant | **Forte** |
| Règle de prise en charge par statut | Non native | Non native | Humaine | **Native, en base** |
| Fonctionnement sans connexion | Rarement | Variable | « Oui », au prix de la fragmentation | **Oui, avec réconciliation** |
| Cohérence entre les deux sites | Si le réseau tient | Si le réseau tient | Nulle | **Oui, même hors ligne** |
| Coût de licence | Élevé | Nul | Nul | Nul |
| Coût de développement | Faible | Moyen | Nul | **Élevé** |
| Délai | Court | Moyen | Nul | **Long** |
| Maîtrise des données de santé | Dépend de l'éditeur | Totale | Totale | **Totale** |
| Compétences de maintenance | Externes | Externes ou internes | — | **Internes, plus rares** |

> **Réserve d'honnêteté.** Aucune étude de marché formelle n'a été conduite. Les catégories A et B sont décrites **génériquement** ; aucun produit précis n'est nommé, et les appréciations comparatives sont **à vérifier**.

---

## 5.5 Choix de la solution retenue

**La solution D est retenue** : un développement sur mesure, conçu pour fonctionner sans connexion en premier lieu.

Trois contraintes l'imposent, et aucune autre option ne les satisfait ensemble.

**La règle de prise en charge est propre à SARIS.** Le statut du patient détermine ses droits, avec refacturation pour les statuts non couverts. Aucun progiciel générique ne porte cette règle ; l'y ajouter reviendrait à développer sur mesure tout en payant une licence.

**Le fonctionnement sans connexion doit être réconciliable.** C'est le point décisif, et il élimine A, B et C d'un seul coup. Un système centralisé s'arrête quand le réseau tombe. Le tableur continue, mais fragmente — et, dans le cas de la pharmacie, **ne conserve même pas ce qu'il a enregistré**. Seule une architecture répliquée avec résolution de conflit permet de travailler sans réseau **et** de retrouver une donnée cohérente ensuite.

**La confidentialité doit être garantie techniquement.** La règle existait déjà ; elle reposait sur la discipline. L'outiller suppose des habilitations différenciées par acteur, ce qu'aucun tableur partagé ne peut offrir.

Le coût est assumé : **développement plus long, maintenance exigeant des compétences plus rares**. En contrepartie, ni licence, ni dépendance à un éditeur, et une maîtrise complète des données de santé.

**Un périmètre a été sélectionné.** Les dix-huit besoins recueillis couvrant trois métiers distincts, le projet retient le **parcours de soin** — triage, consultation, décision, documents — augmenté des fonctions transverses nécessaires à son exploitation. La gestion pharmaceutique et les processus administratifs des ressources humaines sont explicitement écartés. Ce cadrage est justifié au chapitre 3 § 3.5.

⛔ **À compléter — QO-01** : l'évaluation chiffrée des coûts et délais, et la confrontation aux contraintes budgétaires du centre.

---

## Conclusion du chapitre

Le centre fonctionnait selon un **processus formalisé en quatre étapes**, appliqué intégralement sur support papier. Le carnet de santé individuel, transporté par le patient, constituait le support de circulation ; classeurs, registres et fichiers tableur, tous **locaux à chaque site**, complétaient le dispositif.

Quatre entretiens ont établi que ce dispositif fonctionnait, mais sans mémoire : pas de dossier unique, pas de consolidation automatique entre Moutela et Nkayi, pas de traçabilité des décisions, pas de garantie technique de la confidentialité, et des statistiques produites à la main.

Dix-huit besoins ont été exprimés, couvrant trois métiers. Le projet en a sélectionné un — le parcours de soin — et retient un développement sur mesure fonctionnant sans connexion, seule option satisfaisant simultanément la continuité de service, la cohérence entre les deux sites et la règle de prise en charge propre à l'entreprise.

Le chapitre suivant formalise les besoins de cette solution.

---

## Récapitulatif de l'état

| Section | État |
|---|---|
| Précision sur la conduite du stage | ✅ |
| 5.1.1 Méthodologie d'enquête | ✅ |
| 5.1.2 Déroulement des entretiens | ⚠️ partiel — période et durée en attente, QO-04 |
| 5.1.3 Interlocuteurs — **Tableau 5.1** | ✅ **débloqué** |
| 5.1.4 Synthèse des résultats — 18 besoins | ✅ **débloquée** |
| 5.2 Modélisation de l'existant | ✅ **débloquée** — source primaire |
| Figure 5.1 | ✅ **débloquée** — source primaire |
| 5.3 Critique formelle | ✅ — qualitative, mesures non relevées |
| 5.4 Proposition de solutions | ✅ |
| 5.5 Choix de la solution | ✅ — chiffrage à compléter |
