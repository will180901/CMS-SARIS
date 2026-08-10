# INV-09 — Rapport de fin de stage de Nzila Verdi Oscarvie

> **Statut** : extrait · **Date d'extraction** : 2026-08-10
> **Source** : `Docs/documents soutenance/Rapport de fin de stage/rapport_fin_stage.docx`
> **Auteur** : **Nzila Verdi Oscarvie** · **Encadrant** : Monsieur MANFOUMBI KOMBILA PawelZick
> **Nature** : mémoire de fin de cycle complet, en 11 chapitres — non un simple rapport de stage
> **Nature de la preuve** : `OBSERVÉ` — observations de terrain conduites pendant le stage

---

## ⚠️ Avertissement de méthode — à lire en premier

Ce document est le **mémoire de Verdi sur le même projet**, rédigé de son point de vue et avec **son propre périmètre déclaré**.

**Il n'est donc pas une source neutre.** Il est utilisé ici pour deux usages précis, et pour rien d'autre :

| Usage | Statut |
|---|---|
| ✅ **Données factuelles sur l'entreprise et son informatique** — historique, organisation, parc, effectifs | Fiables : observations de terrain, non interprétées |
| ✅ **Métrologie du stage** — période, encadrement | Fiables |
| ⛔ **Description du système réalisé** — nom, modules, entités | **NON UTILISÉE** — voir § 6, divergences majeures |

**Sur le système livré, seul le code fait autorité.**

---

## 1. Métrologie du stage — résout QO-04 et QO-08

| Élément | Valeur |
|---|---|
| **Période de stage** | **du 15 janvier au 14 avril 2026** — 3 mois |
| **Stagiaire** | Nzila Verdi Oscarvie |
| **Encadrant en entreprise** | **Monsieur MANFOUMBI KOMBILA PawelZick**, chef du Service Informatique |
| **Structure d'accueil** | SARIS Congo — Direction Administrative et Financière, Service Informatique |
| **Année académique** | **2025–2026** |
| **Établissement** | CFI-CIRAS, sous tutelle du **Ministère de la Défense** |
| **Lieu de soutenance indiqué** | Brazzaville |

**Encadrants remerciés dans son rapport** : MM. MANFOUMBI KOMBILA PawelZick, MBOUNGOU Jean Jacques, ANDEA Patrick, PANDZOU Claudel, YOKA Kevin, KOUATILA Aimé, DAMBA Daniel.

> ⚠️ **Ne pas reprendre ces noms sans accord.** Ils figurent dans le rapport de Verdi ; leur reprise dans un second mémoire suppose leur autorisation, ou une désignation par fonction.

---

## 2. L'entreprise SARIS Congo — débloque le chapitre 1 § 1.1

### 2.1 Historique

| Année | Événement |
|---|---|
| **1947** | Installation de la famille Vilgrain dans la vallée du Niari — ≈ 12 000 hectares, huilerie d'arachides |
| Années 1950 | Premiers essais de culture de la canne à sucre |
| **1956** | Création de la **SIAN** — Société Industrielle et Agricole du Niari — première sucrerie à Nkayi |
| **1965** | Création de la **SOSUNIARI** — capacité de broyage de 5 000 tonnes de canne par jour |
| **1970** | Fusion SIAN + SOSUNIARI → **SIA-Congo** |
| **1991** | **Privatisation** → **SARIS Congo** — Société Agricole de Raffinage Industriel du Sucre |
| **1995** | Programme de modernisation engagé par le groupe **SOMDIAA** |
| **2010** | Lancement de la marque **Princesse Tatie** — première marque panafricaine de sucre |
| **2011** | Entrée du **groupe Castel** au capital — production portée à 70 310 tonnes de sucre |
| **2025** | Mise en service de la **Distillerie du Congo** — 6 millions de litres par an |

### 2.2 Situation géographique

Implantée à **Moutéla**, département de la **Bouenza**, à environ **15 kilomètres de Nkayi**.
À mi-distance entre les deux pôles du pays : ≈ **240 km de Pointe-Noire**, ≈ **280 km de Brazzaville**.

Trois sites d'entreprise : Nkayi-Moutéla (direction générale et production), Pointe-Noire (direction commerciale), Brazzaville (activités commerciales).

### 2.3 Activités

Production agricole · transformation industrielle · commercialisation · production d'alcool · diversification agricole.

### 2.4 Organisation générale

Direction Générale, supervisant huit directions : **DAF** (administrative et financière), **DRH** (ressources humaines), DAL (approvisionnement et logistique), DPM (parc matériel), DCM (commerciale et marketing), DDDC (développement durable et communication), DEC (exploitations cultures), DU (usine).

> **Point structurant** : le Service Médico-Social relève de la **DRH**, et le Service Informatique de la **DAF**. Ce sont deux directions distinctes — ce qui explique que le centre médical n'ait bénéficié d'aucun outillage informatique dédié.

---

## 3. La situation informatique — débloque le chapitre 2 §§ 2.1 à 2.4

### 3.1 Organisation du système d'information

Le **Service Informatique** est rattaché à la **Direction Administrative et Financière**, et dirigé par le chef du service. Il assure la gestion de l'infrastructure, la maintenance, le support et le développement applicatif interne.

Il s'inscrit dans une structure de groupe à trois niveaux :

| Niveau | Entité | Rôle |
|---|---|---|
| Entreprise | Service Informatique SARIS Congo | Infrastructure, maintenance, support, développement interne |
| Groupe | **SOMINFOR**, basée à Paris | Architecture, développement des applications de gestion du groupe, cybersécurité |
| Groupe | **AFRIK IT**, membre de SOMINFOR | Informaticiens africains — interventions préventives et curatives sur le terrain |

### 3.2 Effectif du Service Informatique — Tableau 2.x

| Poste | Section | Nombre |
|---|---|---:|
| Chef du Service Informatique | Direction | 1 |
| Technicien réseau et système | Réseau & Système | 2 |
| Technicien de saisie | Saisie | 3 |
| Administrateur système (support AFRIK IT) | Réseau & Système | 1 *(détaché)* |
| **Total** | | **7** |

Deux sections : la **section saisie** — exploitation des rapports de main-d'œuvre, données du parc matériel, pointages, centralisation sur l'ERP ; la **section réseau et système** — administration des serveurs, infrastructure réseau, câblage, équipements actifs, sécurité, maintenance.

### 3.3 Parc matériel par type — **Tableau 2.1 débloqué**

| Type de matériel | Caractéristiques | Usage principal |
|---|---|---|
| Serveurs physiques | Windows Server, **AS400** | Applications de gestion, base de données centrale |
| Postes de travail | **Windows 10 / Windows 11** | Bureautique, saisie, applications métier |
| Commutateurs et routeurs | Équipements **Cisco** | Infrastructure réseau filaire |
| Points d'accès sans fil | **Wi-Fi 5 / Wi-Fi 6** | Couverture des bureaux et du centre médical |
| Onduleurs | APC et équivalents | Protection contre les coupures de courant |
| Imprimantes réseau | Laser monochrome et couleur | Documents administratifs et médicaux |

*Le parc couvre l'ensemble des sites : Moutéla, Nkayi, Brazzaville, Pointe-Noire.*

### 3.4 Applications en production par fonction

| Application | Éditeur / type | Fonction couverte |
|---|---|---|
| **AS400 (iSeries)** | IBM — progiciel de gestion intégré | Gestion financière, comptabilité, **paie**, stocks |
| HCL Sametime | HCL / SOMDIAA — messagerie | Communication interne du groupe |
| Kaspersky Endpoint Security | Kaspersky — sécurité | Protection des postes et serveurs |
| Suite bureautique Microsoft | Microsoft | Rédaction, tableaux de bord, rapports |
| **Gestion du centre médical** | **aucune — papier** | **Consultations et dossiers médicaux** |

> ✅ **Constat décisif, à citer au chapitre 2** : *« On observe que la gestion du Centre Médico-Sanitaire ne dispose d'aucune application informatique dédiée. »*
>
> Ce n'est pas une déduction : c'est un constat de terrain, formulé par la personne qui a inventorié le parc applicatif.

### 3.5 Interventions réseau observées pendant le stage

Le rapport documente une extension de la couverture réseau **sur le site de Moutéla** : élaboration de devis pour prises RJ45, câbles, goulottes et gaines ; déploiement de nouvelles prises ; configuration de points d'accès sans fil ; câblage structuré.

Également : déploiement et mise à jour de la protection des postes via console d'administration centralisée.

> **Ce que cela établit** : l'infrastructure réseau était **en cours d'extension** pendant la période du stage. Le réseau existait, mais sa couverture n'était pas complète.

### 3.6 Ce qui reste non documenté

| Élément | Statut |
|---|---|
| Existence et caractéristiques d'une **liaison entre Moutéla et Nkayi** | ⛔ non documenté |
| Débit d'accès à Internet et **taux d'indisponibilité constaté** | ⛔ non documenté |
| Quantités précises par type de matériel | ⛔ non documenté |
| Topologie et plan d'adressage | ⛔ non documenté |

**QO-03 est donc réduite, non résolue.** Le chiffre le plus utile — le taux d'indisponibilité — reste manquant.

---

## 4. Le Centre Médico-Sanitaire — complète le chapitre 1

| Élément | Valeur |
|---|---|
| Rattachement | **DRH**, via le Service Médico-Social |
| **Population couverte** | **plus de 2 000 agents**, plus leurs ayants droit |
| Portée sociale | *« pour de nombreuses familles d'agents, le principal point d'accès aux soins »* — communauté de plusieurs milliers de personnes |
| Sites | **Moutéla** — usine, majorité des travailleurs, siège de la Direction Générale · **Nkayi** — population riveraine, familles des agents, une partie des travailleurs |
| Distance entre les sites | **plusieurs dizaines de kilomètres** |
| Sections | **six** : Maternité et Santé Infantile, **Consultation et Soins**, Pharmacie, Laboratoire, Radiologie, Kinésithérapie |
| Personnel médical permanent | Un Médecin Chef, des médecins, des infirmiers et infirmières, des pharmaciens, des agents d'accueil |

> ✅ **Concordance avec le recueil de l'existant** : six sections, deux sites, rattachement à la DRH via le Service Médico-Social. Les deux sources se recoupent exactement.

**Une précision nouvelle** : la **répartition fonctionnelle des deux sites**. Moutéla concentre l'usine et les travailleurs ; Nkayi accueille davantage la population riveraine et les familles. Cela éclaire la nécessité du dossier partagé : ce ne sont pas deux sites équivalents, mais deux populations différentes qu'un même travailleur peut traverser.

---

## 5. Une exigence chiffrée — la seule du dossier

> *« un fonctionnement autonome de **72 heures minimum** sans connexion réseau, avec synchronisation bidirectionnelle automatique au rétablissement de la connexion »*

C'est la **seule exigence non fonctionnelle chiffrée** trouvée dans l'ensemble des sources.

⚠️ **À traiter avec précaution.** Cette valeur figure dans le mémoire de Verdi comme une **caractéristique annoncée de la solution**, non comme un besoin recueilli auprès du centre ni comme une mesure vérifiée. Le code ne porte aucune limite de durée : le poste autonome fonctionne tant qu'il n'est pas synchronisé.

**Traitement retenu** : la mentionner comme **objectif de conception énoncé**, jamais comme une performance mesurée. Une campagne de validation serait nécessaire pour l'affirmer.

---

## 6. ⛔ Divergences majeures avec la documentation du système

**C'est le point le plus important de cet inventaire.** Le mémoire de Verdi décrit le système avec des chiffres et une dénomination **incompatibles** avec le code.

| Élément | Rapport de Verdi | **Code réel** | Écart |
|---|---|---|---|
| **Nom du système** | **SGCDM** — Système de Gestion des Consultations et des Dossiers Médicaux | **CMS SARIS** | dénomination |
| Modules | **13** | **17** modules serveur | +4 |
| Entités de données | **55** | **88** | **+33** |
| Relations | ≈ **105** | **97** | −8 |
| Attributs | « plus de 500 » | **976** | ≈ ×2 |
| Accidents de travail | module **M-13 réalisé** | **retiré du système** — migration du 16/07/2026 | contradiction |
| Autonomie hors connexion | **72 heures minimum** | aucune limite codée | non vérifiable |

### Interprétation

Ces écarts s'expliquent vraisemblablement par la **date de rédaction**. Le rapport décrit le système tel qu'il était **à la fin du stage, le 14 avril 2026**. Le code a continué d'évoluer pendant quatre mois — d'où les entités supplémentaires, les modules ajoutés, et le retrait du module des accidents de travail.

### ⚠️ Conséquence pour la soutenance

**Deux mémoires seront présentés sur le même projet, avec des chiffres différents.** Un jury attentif le remarquera.

Trois options, à trancher par les auteurs :

| # | Option | Conséquence |
|---|---|---|
| **A** | **Chaque mémoire assume sa date.** Verdi décrit l'état d'avril 2026, le présent mémoire celui d'août 2026, et **les deux le disent explicitement** | ✅ Honnête, défendable, demande une phrase dans chaque introduction |
| B | Aligner les chiffres de Verdi sur l'état actuel | Suppose de rouvrir son mémoire — lourd, et fausse la chronologie de son stage |
| C | Ne rien dire | ❌ Risque de contradiction relevée en soutenance |

> **Recommandation : option A.** Ajouter dans l'introduction du présent mémoire une phrase du type : *« Le système a poursuivi son évolution après la période de stage ; les chiffres présentés ici décrivent son état au 10 août 2026. »*
>
> Cette précision transforme une contradiction apparente en démonstration de rigueur chronologique.

### Sur la dénomination

Le sigle **SGCDM** avait été interdit dans le présent dossier, réputé hérité d'un modèle académique. **Cette analyse était partiellement fausse** : c'est la dénomination retenue par Verdi pour ce projet.

**Décision maintenue** : le présent mémoire emploie **CMS SARIS**, nom réel du système dans le code et dans son fichier de configuration. Mais l'interdiction est reformulée : `SGCDM` n'est pas « le sigle d'un autre projet », c'est **une dénomination alternative du même projet, retenue par l'autre mémoire**. À signaler si le jury pose la question.

---

## 7. Ce que cet inventaire débloque

| Question | Avant | Après |
|---|---|---|
| **QO-04** — période et encadrement du stage | 🟠 ouverte | ✅ **résolue** — 15 janvier au 14 avril 2026 |
| **QO-08** — encadrement académique | 🟠 ouverte | ⚠️ **réduite** — encadrant en entreprise et année connus ; promoteur académique et jury restent à confirmer |
| **QO-02bis** — chiffres et statut | 🟠 ouverte | ✅ **largement résolue** — historique, organisation, population couverte |
| **QO-03** — infrastructure et parc | 🟠 ouverte | ⚠️ **réduite** — organisation, effectif, parc par type et applications documentés ; liaison inter-sites et taux d'indisponibilité toujours manquants |

**Pages débloquées** : ≈ 5 sur les 7 restantes.

---

## 8. Alimente

| Destination | Usage |
|---|---|
| Chapitre 1 § 1.1 | Historique de l'entreprise, situation géographique, statut |
| Chapitre 1 § 1.2 | Population couverte — plus de 2 000 agents |
| Chapitre 1 § 1.3 | Organisation générale, huit directions, rattachement du centre |
| Chapitre 1 § 1.5 | Chiffres caractéristiques |
| Chapitre 2 § 2.1 | Organisation du système d'information, structure de groupe |
| Chapitre 2 § 2.2 | **Effectif du Service Informatique** — tableau |
| Chapitre 2 § 2.3 | **Parc matériel par type — Tableau 2.1** |
| Chapitre 2 § 2.4 | **Applications par fonction** — et le constat d'absence d'outil médical |
| Chapitre 5 § 5.1.2 | Période et déroulement du stage |
| Préliminaires | Année académique, encadrement |
| `matrice_alignement.md` | Divergences du § 6 |
