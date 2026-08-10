# Périmètre et hors-périmètre

> **Document de cadrage.** Il énonce le périmètre métier retenu pour ce travail, et **justifie chaque exclusion**.
> **Sources** : le **recueil de l'existant** (INV-08) pour le besoin · le **code de l'application** (INV-01 à INV-07) pour le livré.
> **Statut de la décision** : arbitrage de projet, pris par les auteurs, documenté ici.

---

## 1. Le point de départ : un recueil plus large que le projet

Le recueil de l'existant couvre **l'ensemble du Service Médico-Social** de SARIS-CONGO, à travers quatre entretiens : gestionnaire RH et service social, pharmacienne, médecin chef, infirmière.

Il en résulte **18 besoins exprimés**, répartis sur trois domaines très différents : la gestion médicale, la gestion pharmaceutique, et la gestion administrative et financière des ressources humaines.

**Aucun projet de fin de cycle ne pouvait couvrir cet ensemble.** Un périmètre a donc été sélectionné.

> **Ce point doit être énoncé clairement dans le mémoire, et de préférence tôt.** Un jury qui lit le recueil constatera immédiatement qu'il déborde le système. Mieux vaut avoir expliqué le choix que devoir le défendre.

---

## 2. Le périmètre retenu

**Le parcours de soin, de l'accueil du patient à la remise de ses documents**, augmenté des fonctions transverses nécessaires à son exploitation réelle.

### 2.1 Le cœur métier retenu

| # | Domaine | Contenu |
|---|---|---|
| 1 | **Triage et accueil** | Identification du patient et de son statut, mode de vie, antécédents, constantes vitales, file d'attente par ordre d'arrivée |
| 2 | **Consultation** | Anamnèse, examen clinique, diagnostics, conclusion |
| 3 | **Décision finale** | Clôture guidée par la décision médicale |
| 4 | **Génération des documents** | Ordonnance, bon de pharmacie, bon d'examen, certificat de repos, fiche d'évacuation — imprimables au format A4 |

Ce périmètre correspond **exactement** au processus décrit par le Médecin Chef dans le recueil : triage par l'infirmière, anamnèse, examen clinique infirmier, consultation médicale et diagnostic. Ce n'est pas une réduction arbitraire : c'est **le processus central du centre**, celui que tous les autres alimentent ou prolongent.

### 2.2 Les fonctions transverses ajoutées

Ces fonctions n'apparaissent pas comme des besoins du recueil. Elles ont été ajoutées parce qu'**un système d'information de santé n'est pas exploitable sans elles**.

| # | Fonction | Pourquoi elle est indispensable |
|---|---|---|
| 5 | **Dossier patient centralisé** | Besoin n° 2 du médecin chef. Sans dossier unique, le parcours de soin perd sa continuité entre les deux sites |
| 6 | **Référentiels** | Sites, catégories, motifs, pathologies, médicaments, types d'examen : sans eux, aucune saisie structurée n'est possible |
| 7 | **Personnel et délégations** | La délégation de prescription est une règle du terrain. L'outiller exige de gérer le personnel soignant |
| 8 | **Sécurité, rôles et permissions** | Le recueil énonce une règle de confidentialité stricte, différenciée par acteur. Elle n'est applicable que par un système d'habilitations |
| 9 | **Journal d'audit** | Données de santé. La traçabilité des accès et des actes n'est pas optionnelle |
| 10 | **Synchronisation hors connexion** | Besoin n° 1 du médecin chef — système centralisé entre les deux sites — dans un contexte de connectivité instable |
| 11 | **Messagerie interne chiffrée** | Le recueil constate que l'information circule **verbalement, sans trace**. Un canal écrit, chiffré et tracé y répond |
| 12 | **Notifications temps réel** | Corollaire du travail à plusieurs sur un même parcours |
| 13 | **Tableaux de bord et rapports** | Besoin n° 3 du médecin chef — automatisation des rapports |
| 14 | **Paramètres système** | Exploitation courante |

> **Argument à porter au mémoire.** Les fonctions 5 à 14 ne sont pas des ajouts d'agrément. Neuf d'entre elles répondent directement à un besoin exprimé ou à une règle du terrain. Les cinq autres — référentiels, audit, notifications, paramètres, personnel — sont les conditions techniques d'existence des précédentes.

---

## 3. Le hors-périmètre — et le motif de chaque exclusion

### 3.1 Exclusions de domaine

| # | Exclu | Motif |
|---|---|---|
| **E1** | **Gestion de stock pharmaceutique** — entrées, sorties, inventaires, péremption, réapprovisionnement | Métier **distinct** du parcours de soin, avec ses propres règles — prix d'achat fournisseur, coffrets génériques, seuils de réapprovisionnement. Le système émet un **bon de retrait** ; la délivrance physique et le stock restent hors système |
| **E2** | **Facturation et refacturation** — montants, barèmes, ventilation par catégorie, remboursements | Le système modélise des **droits d'accès aux prestations**, non des droits financiers. **Aucun modèle de données ne porte de montant.** La refacturation aux sociétés sous-traitantes et aux assurances relève de la Section des Affaires Sociales |
| **E3** | **Processus RH** — congés maladie et maternité, paie, absentéisme, suivi de reprise | Relève de la **Direction des Ressources Humaines**, entité distincte du centre de soins dans l'organigramme |
| **E4** | **Volet financier des évacuations** — bon de caisse, barème, coût salarial de l'absence | Le système gère la **décision médicale** d'évacuation et son suivi clinique. Le volet financier relève de la Section des Affaires Sociales |
| **E5** | **Consultations spécialisées** — ophtalmologie, ORL, stomatologie | Pôle distinct du centre, avec un parcours de triage allégé. Le système couvre la **consultation générale** |
| **E6** | **Radiologie, laboratoire, maternité, kinésithérapie** | Quatre pôles distincts du centre. Le système émet un **bon d'examen** vers le laboratoire et en reçoit le résultat ; il ne gère pas le laboratoire lui-même |
| **E7** | **Accidents de travail** comme processus administratif | Le système produit le **certificat de repos** ; la déclaration réglementaire, le suivi de paie et la reprise de poste relèvent du service RH |

### 3.2 Ce que ces exclusions laissent hors de portée

Trois besoins de **priorité haute** du recueil ne sont pas satisfaits par le système. Ils doivent être nommés, non tus.

| Besoin non satisfait | Acteur | Motif d'exclusion |
|---|---|---|
| Tableau de suivi des **coûts d'évacuation** — frais et salaires | Gestionnaire RH | E2 et E4 — aucune donnée financière dans le modèle |
| **Tableau de bord de l'absentéisme** — par jour, direction, catégorie socio-professionnelle | Gestionnaire RH | E3 — les notions de direction et de catégorie socio-professionnelle n'existent pas dans le modèle |
| **Logiciel de gestion pharmaceutique** — stock, péremption, reçus, facturation | Pharmacienne | E1 et E2 |

> **Formulation à retenir pour le mémoire.** Ces besoins sont **hors du périmètre retenu**, non « non réalisés ». La différence n'est pas cosmétique : un besoin hors périmètre relève d'une décision de cadrage argumentée ; un besoin non réalisé relève d'un échec. Le premier se défend, le second se subit.
>
> Ils figurent en **perspectives** de la conclusion, comme extensions naturelles du système.

### 3.3 Exclusions du mémoire, non du produit

| Exclu du mémoire | Motif | Où le trouver |
|---|---|---|
| 61 entités sur 88 absentes du diagramme de classes | Lisibilité — sélection sur critère de degré de connexion | Annexe D |
| Le détail des 128 permissions | Volume | INV-03, annexe B |
| Le détail des 268 routes | Volume | INV-01 |
| Les 60 composants du système de conception d'interface | Sans valeur pour la compréhension du domaine | — |

---

## 4. Ce qui est dans le périmètre mais **partiellement** couvert

Ces points sont dans le périmètre. Ils sont donc évaluables, et leurs limites doivent être assumées.

| Élément | État | Détail |
|---|---|---|
| **Fonctionnement hors connexion du poste autonome** | `PARTIELLEMENT IMPLÉMENTÉ` | Pipeline vérifié statiquement, validation par une exécution réelle restant à faire |
| **Statistiques par direction et catégorie socio-professionnelle** | `NON IMPLÉMENTÉ` | Quatre des dix axes attendus par le médecin chef sont hors d'atteinte : ces attributs n'existent pas dans le modèle de données |
| **Parcours de consultation spécialisée allégé** | `NON IMPLÉMENTÉ` | Le système applique le même flux de triage à tous les types de consultation |
| **Visites médicales annuelles systématiques** | `PARTIELLEMENT IMPLÉMENTÉ` | Distinguables par le type de consultation ; leur planification n'est pas outillée |
| **Signature de code de l'installateur** | `NON IMPLÉMENTÉ` | Configuration préparée, non active |
| **Tests du cœur clinique** | `NON IMPLÉMENTÉ` | Aucun test automatisé sur triage, consultation, prescription, bons, évacuation |

> Ces six points sont les **vraies limites** du travail — celles qui portent sur ce qu'il a choisi de faire. Elles sont énoncées au chapitre 8 et en conclusion.

---

## 5. Frontière du système — pour le diagramme de contexte

| Acteur | Type | Nature des échanges |
|---|---|---|
| Administrateur Système | primaire, humain | Gouvernance, comptes, paramètres, supervision |
| Médecin Chef | primaire, humain | Activité clinique complète, gouvernance médicale, évacuations |
| Infirmier | primaire, humain | Triage, consultation, prescription **déléguée** |
| Poste local autonome | **secondaire**, système | Synchronisation par deltas |
| Service de géolocalisation | **secondaire**, externe | Ville et coordonnées depuis une adresse IP, avec repli hors ligne |
| Canal de mise à jour du client de bureau | **secondaire**, externe | Publication et téléchargement des versions |

**Aucun autre acteur humain n'existe dans le système.** La pharmacienne et le gestionnaire RH sont des acteurs du **centre**, décrits par le recueil, mais **pas des utilisateurs du système** : leurs processus sont hors périmètre. Les faire figurer au diagramme de contexte serait une erreur.

---

## 6. Justification d'ensemble du périmètre

Trois arguments soutiennent ce cadrage.

**Il correspond au processus central.** Le parcours triage → consultation → décision → documents est celui que le Médecin Chef a lui-même formalisé. Tous les autres processus du centre l'alimentent — la pharmacie exécute une ordonnance, le laboratoire exécute un bon, le service RH traite un certificat de repos. **Outiller le centre, c'est outiller ce parcours d'abord.**

**Il répond aux besoins de priorité haute du domaine médical.** Les trois besoins hauts du Médecin Chef — système centralisé bi-sites, dossier patient numérique, automatisation des rapports — sont dans le périmètre. Les besoins hauts non satisfaits appartiennent tous à d'**autres domaines**, pharmacie et ressources humaines.

**Il est réalisable et démontrable.** Un périmètre plus large aurait produit un système partout superficiel. Celui-ci est complet sur ce qu'il couvre : 268 points d'accès, 88 entités, 15 écrans, deux modes de fonctionnement.

---

## 7. Limites de validité de ce document

1. Le périmètre décrit l'état du code au **2026-08-10**.
2. La sélection est une **décision des auteurs**, non une demande formelle du centre. Elle doit être présentée comme telle.
3. Le recueil ne documente ni les effectifs, ni le parc informatique, ni les chiffres d'activité — ces éléments manquent aux chapitres 1 et 2.
4. **Aucune preuve d'un usage clinique effectif** n'a été trouvée. Le contexte est celui d'une soutenance ; le déploiement sur le réseau interne est postérieur et conditionné à la validation du centre.
