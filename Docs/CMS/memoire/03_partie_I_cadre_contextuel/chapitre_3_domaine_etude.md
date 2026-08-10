---
chapitre: 3
titre: "Domaine d'étude : le système d'information médical"
budget_pages: 8-10
statut: partiel
sources: [INV-02, INV-03, INV-05, INV-07]
figures: []
blocages: [QO-01, QO-06]
---

# CHAPITRE 3 — DOMAINE D'ÉTUDE : LE SYSTÈME D'INFORMATION MÉDICAL

> **État du chapitre.** Environ **cinq pages sur huit à dix sont rédigées** : celles que le système réalisé permet de prouver. Les sections dépendant d'observations de terrain sont marquées et renvoient à une question ouverte. La revue bibliographique reste à conduire : elle exige des lectures réelles, qu'aucune analyse de code ne remplace.

---

## Introduction du chapitre

Un système d'information médical n'est pas un logiciel de gestion auquel on aurait ajouté des champs cliniques. Il présente trois particularités qui gouvernent toute sa conception.

**La donnée y est sensible par nature.** Un dossier médical ne se protège pas comme un fichier client : sa divulgation cause un préjudice direct et irréversible à une personne.

**La continuité y prime sur la disponibilité.** Un système de commerce indisponible fait perdre une vente ; un système de soin indisponible fait perdre l'historique d'un patient au moment où l'on en a besoin.

**La traçabilité y est une obligation, non un confort.** Qui a prescrit, qui a délivré, qui a consulté : ces questions doivent trouver réponse après coup.

Ce chapitre décrit le domaine d'étude sous ces trois angles. Il présente les acteurs et leur organisation, le fonctionnement sur deux sites, et surtout les catégories de patients dont découle la règle métier la plus structurante du système. Il expose ensuite la critique de l'existant, situe le travail dans la littérature, énonce l'intérêt du sujet, la solution retenue et les concepts mobilisés.

---

## 3.1 Description du domaine

### 3.1.1 Structure hiérarchique du suivi médical

⛔ **PARTIELLEMENT EN ATTENTE DE SOURCE — QO-01**

**Ce qui est établi par le système** — les acteurs applicatifs et leur périmètre :

| Acteur | Périmètre de responsabilité | Portée de visibilité |
|---|---|---|
| **Médecin Chef** | Référence clinique du centre. Prescrit librement, décide des évacuations, accorde les délégations, gouverne les référentiels et le personnel | **Toute l'activité clinique** |
| **Infirmier** | Accueil, triage, constantes vitales, consultation. Prescrit **uniquement sous délégation** | **Ses propres consultations seulement** |
| **Administrateur Système** | Gouvernance de la plateforme : comptes, rôles, paramètres, supervision | Totale |

Deux principes d'organisation se lisent dans cette structure.

**Le cloisonnement par initiateur.** Un infirmier ne voit que l'activité qu'il a lui-même conduite. Consultant l'historique d'un patient, il n'accède qu'à la visite en cours, non aux visites passées. Seul le groupe de supervision — médecin chef et administrateur — dispose d'une vue complète.

**La délégation de prescription.** L'infirmier possède les droits techniques de prescrire, mais l'acte n'est autorisé que si une délégation active, accordée par le médecin chef et couvrant la date du jour, existe. La délégation utilisée est enregistrée sur l'ordonnance : la responsabilité reste imputable après coup.

Cette organisation traduit une hiérarchie médicale réelle, où l'infirmier peut traiter des cas simples sous la responsabilité du médecin, sans que cette responsabilité se dilue.

### Le personnel, commun aux deux sites

Un fait d'organisation, établi par les documents de cadrage, éclaire toute la conception : **le personnel médical est commun aux deux sites et tourne entre eux selon un planning de permutation**.

Ce point n'est pas anecdotique. Il signifie qu'un même soignant peut recevoir, à Nkayi, un patient qu'il a examiné la semaine précédente à Moutela — sans disposer du dossier correspondant. Le déficit d'information ne pénalisait donc pas seulement le patient : il pénalisait le soignant, privé de ce qu'il avait lui-même constaté.

Le système répond directement à cette réalité par deux dispositions : le dossier patient en portée globale, et la possibilité pour un agent de **se connecter hors ligne sur n'importe quel poste**, quel que soit son site de rattachement.

### Les quatre profils d'utilisateurs

Les documents de cadrage décrivent quatre profils, correspondant exactement aux trois rôles du système — le profil « médecin » partageant le rôle de médecin chef.

| Profil | Poste et équipement | Littératie numérique | Exposition aux coupures |
|---|---|---|---|
| **Médecin chef** | Poste fixe au cabinet, application de bureau ; parfois le web depuis un portable | Moyenne à bonne. Attend une interface en clair, sans code technique | Majoritairement connecté |
| **Médecin** | Poste fixe ou web | Moyenne | Variable selon le site |
| **Infirmier** | **Poste d'accueil partagé** ; usage mobile occasionnel | **Variable — certains agents peu habitués à l'informatique.** Exige une interface très lisible, sans jargon, à saisie guidée | **Le poste le plus exposé aux coupures** |
| Administrateur système | Poste d'administration, web et bureau | Élevée | Généralement connecté |

Deux enseignements de conception en découlent, et ils expliquent des choix que le chapitre 7 détaillera.

**Le poste d'accueil est le point critique.** C'est celui qui subit le plus de coupures, et c'est celui que tient l'agent dont la littératie numérique est la plus hétérogène. Le fonctionnement hors connexion doit donc **garantir l'enregistrement des arrivées sans interruption** — c'est là que le besoin est le plus fort, pas dans le cabinet du médecin.

**L'interface doit parler le langage du métier.** Le système en fait une règle appliquée : codes techniques retirés des vues cliniques, formulaire **piloté par la catégorie** du patient, bilinguisme, navigation courte.

⛔ **Ce qui reste à obtenir :** l'organisation humaine détaillée — effectifs par fonction et par site, organisation des gardes, existence de fonctions non représentées dans le système. Voir QO-02.

### 3.1.2 Fonctionnement bi-sites : Moutela et Nkayi

Le centre fonctionne sur **deux sites géographiquement distants**. Cette configuration pose trois problèmes que le système devait résoudre.

**Le problème de l'identité.** Un même travailleur peut être vu sur les deux sites. Sans dossier unique, il existe deux fois, avec deux historiques partiels. Aucun soignant ne dispose alors de l'information complète.

**Le problème de la synchronisation.** Toute donnée saisie sur un site doit devenir visible sur l'autre, sans ressaisie et sans divergence.

**Le problème de la connectivité.** Les deux sites ne disposent pas d'une liaison fiable et permanente. Un système exigeant une connexion permanente serait inutilisable.

**La réponse retenue est une décision d'architecture forte** : le dossier patient et l'ensemble du parcours de soin sont en **portée globale**. Chaque poste détient la totalité des dossiers, des deux sites — non pas une partie correspondant à son site de rattachement.

| Donnée | Portée | Motif |
|---|---|---|
| Dossier patient et parcours de soin | **globale** | Continuité entre sites, y compris hors connexion. Un travailleur muté est retrouvé sur n'importe quel poste, sans doublon |
| Référentiels partagés | **globale** | Un motif, une pathologie, un médicament ont le même sens partout |
| Comptes et habilitations | **globale** | Un agent qui tourne entre les deux sites doit pouvoir se connecter **hors ligne** sur n'importe quel poste |
| Personnel médical | **globale** | Permet de désigner le soignant d'un acte réalisé sur l'autre site |
| Messagerie | **globale** | Une conversation peut réunir des agents des deux sites |
| Planning, présences | **par site** | Données strictement opérationnelles, propres à chaque site |

Cette généralisation de la portée soulève immédiatement une objection : **si chaque poste détient tous les dossiers, la confidentialité n'est-elle pas compromise ?**

La réponse tient en deux mécanismes. D'abord le **verrou de dossier** : un médecin chef peut restreindre l'accès à un dossier sensible, et ce verrou est appliqué par l'API — y compris par le serveur embarqué du poste autonome, donc y compris hors connexion. Ensuite le **cloisonnement par initiateur** : détenir la donnée n'est pas y avoir accès, les droits s'appliquant à la lecture.

C'est un arbitrage explicite entre **disponibilité de l'information de soin** et **restriction de sa diffusion**, tranché en faveur de la première, avec des garde-fous applicatifs. Dans un contexte où l'indisponibilité d'un antécédent peut avoir des conséquences cliniques, cet arbitrage se défend — à condition d'être énoncé, ce qui est fait ici.

### 3.1.3 Catégories de patients et règles de prise en charge

**C'est la règle métier centrale de tout le système.** Elle explique la majorité des contrôles, conditionne plusieurs cas d'utilisation et constitue la principale différence entre ce système et un dossier médical générique.

Le centre soigne cinq catégories de personnes, dont les droits diffèrent.

| Catégorie | Qui | Identification |
|---|---|---|
| **Assuré CDI** | Travailleur de SARIS-CONGO en contrat à durée indéterminée | Matricule |
| **Ayant droit CDI** | Membre de la famille rattaché à un assuré CDI | Matricule du CDI et type de lien |
| **Assuré CDD** | Travailleur en contrat à durée déterminée | Matricule |
| **Sous-traitant** | Travailleur d'une société sous-traitante | Rattachement à la société |
| **Riverain** | Personne du voisinage, sans lien contractuel | — |

Les prestations se répartissent en quatre types, et **toutes ne sont pas ouvertes à toutes les catégories** :

| Prestation | Assuré CDI | Ayant droit CDI | Assuré CDD | Sous-traitant | Riverain |
|---|:---:|:---:|:---:|:---:|:---:|
| **Consultation** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Premiers soins** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Bon de pharmacie** *(médicaments)* | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Bon d'examen** | ✅ | ✅ | ❌ | ❌ | ❌ |

La lecture de ce tableau doit être précise, car un contresens est facile. **Personne n'est refusé aux soins.** Toute personne se présentant au centre est reçue, examinée et soignée. Ce qui varie, c'est la **prise en charge financière** des médicaments et des examens complémentaires, réservée au personnel en contrat à durée indéterminée et à ses ayants droit.

Une distinction s'impose entre deux documents que l'on confond aisément :

| Document | Restreint par catégorie ? | Nature |
|---|:---:|---|
| **Ordonnance** | **non** | Acte médical : le soignant prescrit ce que l'état du patient exige |
| **Bon de pharmacie** | **oui** | Acte administratif : l'employeur prend en charge, ou non |

Autrement dit, un riverain reçoit une ordonnance s'il en a besoin ; il l'honorera à ses frais, faute de bon.

**Traitement dans le système.** Cette règle n'est pas écrite en dur : elle est portée par une **table de la base de données** croisant catégories et prestations. Elle est donc modifiable sans redéploiement, ce qui est cohérent avec une règle qui relève d'une politique d'entreprise susceptible d'évoluer. Toute demande de bon interroge cette table ; en cas de refus, le message nomme explicitement la catégorie et rappelle la règle.

> ⚠️ **Point à confirmer — QO-06.** Les employés en contrat à durée déterminée n'ouvrent pas droit aux bons, alors qu'ils sont du personnel sous contrat. Cette exclusion est contre-intuitive et sera très probablement relevée en soutenance. Il faut la faire confirmer par la direction : politique délibérée, ou état transitoire de la table ?

---

## 3.2 Critique de l'existant

La critique détaillée figure au chapitre 5 § 5.3, qui formalise les **huit limites documentées** de l'existant. Elle est ici résumée sous l'angle du domaine médical, thème par thème.

| Thème | Problème constaté | Impact clinique | Besoin |
|---|---|---|---|
| **Dossier patient** | Aucun dossier unique. L'information ne circule que dans le carnet transporté par le patient | Un antécédent, une allergie ou une alerte peuvent être **indisponibles au moment de la décision médicale** | Dossier unique et permanent |
| **Circulation entre sites** | Aucun lien entre Moutela et Nkayi, alors que le personnel **et** les patients circulent entre les deux | Un patient change de site et **redevient inconnu** ; le soignant perd ce qu'il a lui-même constaté | Réplication automatique |
| **Continuité de service** | Réseau instable ; le papier « fonctionne » mais fragmente | Un outil dépendant du réseau **s'arrêterait en pleine consultation** | Fonctionnement hors connexion, réconciliable |
| **Droits aux prestations** | Règle d'éligibilité vérifiée **de mémoire**, par contrôle visuel du badge ou du carnet | Risque d'**inégalité de traitement** : un même patient traité différemment selon l'agent | Règle portée par le système |
| **Prescription déléguée** | Délégation **verbale ou écrite**, sans contrôle ni traçabilité | Impossible d'établir après coup **sous quelle autorisation** un acte a été prescrit | Délégation datée et tracée |
| **Reporting** | Dépouillement manuel du registre et du tableur | Statistiques **laborieuses et faillibles**, produites a posteriori | Production automatique |
| **Confidentialité** | Aucun contrôle d'accès. Un poste, un fichier partagé | **Toute personne ayant accès au poste a accès à tout** | Habilitations et verrou de dossier |

### Ce que cette critique révèle du domaine

Trois de ces problèmes sont **génériques** : n'importe quel centre de santé sans système d'information les rencontrerait. Quatre sont **propres à ce contexte**, et ce sont eux qui font l'intérêt du domaine d'étude.

**La circulation du personnel entre les sites** transforme un problème de partage de données en problème de continuité du soin. Ce n'est pas seulement le dossier qui doit suivre le patient : c'est la mémoire du soignant qui doit le suivre lui-même.

**L'instabilité du réseau** interdit la réponse habituelle — centraliser. Elle impose une architecture répliquée, avec tout ce que cela suppose de réconciliation.

**La règle d'éligibilité par catégorie** n'est pas une règle médicale mais une **règle de prise en charge**, propre à un centre de santé d'entreprise. Aucun logiciel générique ne la porte.

**La délégation de prescription** formalise une pratique réelle : l'infirmier traite des cas simples sous la responsabilité du médecin. Le système ne l'invente pas, il l'encadre et la trace.

> ⛔ **Ce qui manque.** Cette critique est **qualitative**. Les mesures — fréquence des dossiers dupliqués, temps de dépouillement, incidents constatés — figurent peut-être dans le recueil de l'existant (QO-01). Sans elles, elle décrit justement sans quantifier.

---

## 3.3 Synthèse bibliographique sur les systèmes d'information médicaux

> ⚠️ **État de cette section.** Les références ci-dessous ont été **identifiées et vérifiées à la source** — auteurs, titres, éditeurs, années, identifiants. Elles doivent maintenant être **lues** avant que le texte de synthèse ne soit rédigé. Le plan et les points d'appui sont établis ; la rédaction argumentée reste à produire à partir de la lecture effective.

### 3.3.1 Le cadre institutionnel

L'Organisation mondiale de la santé a publié en 2025 une **stratégie d'optimisation des systèmes d'information sanitaire de routine**, dont l'objet est de renforcer ces systèmes pour soutenir les soins de santé primaires et la couverture sanitaire universelle.

Cette référence situe le présent travail dans un cadre reconnu : un centre médico-sanitaire d'entreprise produit précisément des **données de routine** — consultations, pathologies, prescriptions — dont l'agrégation alimente les décisions de santé.

📖 *À lire avant rédaction* — voir bibliographie.

### 3.3.2 Un cas comparable en Afrique subsaharienne

Un article publié en 2024 dans le *Pan African Medical Journal* analyse **la gestion des données du système d'information sanitaire de routine dans le district sanitaire de Tombouctou, au Mali**, en contexte de ressources contraintes.

C'est la référence la plus proche du sujet : francophone, à comité de lecture, et portant sur un environnement comparable à celui du Centre Médico-Sanitaire de SARIS-CONGO. Elle permettra d'étayer cette section par un **cas documenté** plutôt que par une généralité.

📖 *À lire avant rédaction.*

### 3.3.3 Les architectures conçues pour une connectivité intermittente

La question de la cohérence des données entre répliques qui ne peuvent pas se coordonner en permanence relève d'un champ théorique établi. Les travaux de **Shapiro, Preguiça, Baquero et Zawirski** sur les types de données répliqués sans conflit, publiés en 2011, en constituent la référence fondatrice.

Ils éclairent directement le choix du chapitre 7 § 7.5.2 — la résolution par dernière écriture — et fondent la perspective évoquée en conclusion : les approches de **fusion par champ**, écartées ici pour leur complexité, relèvent de ce cadre.

📖 *À lire avant rédaction.*

### 3.3.4 Le style architectural retenu pour l'interface de programmation

La thèse de **Roy Thomas Fielding**, soutenue en 2000 à l'Université de Californie à Irvine, introduit le style architectural sur lequel repose l'interface de programmation du système — ses 268 points d'accès. Les chapitres 5 et 6 suffisent à en dégager les principes mobilisés.

📖 *À lire avant rédaction — chapitres 5 et 6.*

### 3.3.5 Ce que la synthèse devra établir

Une fois ces lectures faites, la synthèse doit répondre à une question précise :

> **En quoi le contexte d'un centre de santé d'entreprise, en milieu à connectivité intermittente et sur deux sites, diffère-t-il de celui pour lequel les systèmes hospitaliers courants sont conçus — et pourquoi ce contexte justifie-t-il les choix d'architecture du chapitre 7 ?**

Trois points d'appui sont d'ores et déjà identifiés :

1. les systèmes d'information sanitaire des environnements à ressources contraintes sont décrits comme **fragmentés**, avec une collecte incohérente — ce que le chapitre 2 constate au Centre Médico-Sanitaire ;
2. la **cohérence sans coordination permanente** est un problème théorique traité, dont les solutions connues vont du plus simple — la dernière écriture l'emporte, retenue ici — au plus élaboré ;
3. l'**interopérabilité** suppose une nomenclature commune ; le système emploie un référentiel de pathologies propre, non aligné sur une classification internationale, ce qui constitue une limite et une perspective.

> **Exigence de forme.** Chaque affirmation de cette section devra porter sa référence. Une synthèse bibliographique sans citation précise n'est pas une synthèse : c'est une opinion.

---

## 3.4 Intérêts du sujet *(section ajoutée d'après le plan de l'école)*

Le sujet présente un intérêt à trois niveaux, qu'il convient de distinguer sans les surestimer.

**Intérêt pratique, pour le Centre Médico-Sanitaire.** Le système répond à quatre besoins précis : disposer d'un dossier patient unique et consolidé entre les deux sites ; supprimer les ressaisies ; automatiser une règle d'éligibilité qui reposait jusque-là sur la mémoire des agents ; et surtout continuer de fonctionner lorsque le réseau tombe. Ce dernier point n'est pas un raffinement technique mais une condition d'usage.

**Intérêt académique, pour les auteurs.** Le projet a exigé la mise en œuvre complète d'une démarche d'ingénierie : modélisation objet, architecture en couches, sécurité applicative, gestion de la persistance sur deux moteurs, synchronisation distribuée avec résolution de conflit, empaquetage et distribution d'un logiciel de bureau. La difficulté principale n'a pas été algorithmique mais **architecturale** : faire coexister deux modes d'exécution du même code.

**Intérêt méthodologique, modeste mais réel.** Le travail documente une réponse concrète à un problème récurrent dans la sous-région : concevoir un système de santé pour un environnement où la connectivité n'est pas acquise. Les choix effectués — réplication complète plutôt que partielle, résolution par dernière écriture avec journalisation plutôt que verrouillage, rejeu de requêtes plutôt que moteur de règles dupliqué — sont transposables et, surtout, **argumentés**. C'est cette argumentation qui constitue l'apport, plus que le code lui-même.

---

## 3.5 Justification du projet, périmètre retenu et solution

### 3.5.1 Un besoin plus vaste que ce qu'un projet de fin de cycle peut couvrir

Le recueil de l'existant a produit **dix-huit besoins exprimés**, répartis sur **trois métiers distincts** :

| Domaine | Besoins | Porté par |
|---|---:|---|
| **Soins** — triage, consultation, décision, documents | 7 | Centre Médico-Sanitaire |
| Administration du personnel — évacuations, remboursements, accidents, absentéisme | 5 | Section des Affaires Sociales |
| Logistique pharmaceutique — stock, dispensation, facturation | 6 | Pharmacie du centre |

Ces trois domaines n'ont en commun ni les règles, ni les objets, ni les acteurs. Le premier manipule des actes de soin ; le deuxième des dossiers administratifs et des montants ; le troisième des références de produits et des mouvements de stock.

**Vouloir les traiter ensemble aurait produit un système partout superficiel.** Un périmètre a donc été sélectionné.

### 3.5.2 Le périmètre retenu

**Le parcours de soin, de l'accueil du patient à la remise de ses documents**, augmenté des fonctions transverses nécessaires à son exploitation réelle.

| Retenu | Contenu |
|---|---|
| **Triage et accueil** | Identification, statut, mode de vie, antécédents, constantes vitales, file d'attente |
| **Consultation** | Anamnèse, examen clinique, diagnostics, conclusion |
| **Décision finale** | Clôture guidée par la décision médicale |
| **Génération des documents** | Ordonnance, bon de pharmacie, bon d'examen, certificat de repos, fiche d'évacuation |

Ce choix n'est pas arbitraire : **il correspond exactement au processus formalisé par le Médecin Chef**, décrit au chapitre 5. C'est le processus central du centre, celui que tous les autres alimentent ou prolongent — la pharmacie exécute une ordonnance, le laboratoire exécute un bon d'examen, le service administratif traite un certificat de repos.

**S'y ajoutent dix fonctions transverses** : dossier patient centralisé, référentiels, gestion du personnel et des délégations, sécurité et habilitations, journal d'audit, synchronisation hors connexion, messagerie interne chiffrée, notifications, tableaux de bord et rapports, paramètres système.

Ces fonctions ne sont pas des ajouts d'agrément. Le dossier centralisé et la synchronisation répondent aux deux besoins de priorité haute du Médecin Chef. Les habilitations traduisent la règle de confidentialité du centre. La messagerie répond au constat que l'information circule **verbalement, sans trace**. Les autres sont les conditions techniques d'existence des précédentes.

### 3.5.3 Ce qui est écarté, et pourquoi

| Écarté | Motif |
|---|---|
| **Gestion de stock pharmaceutique** | Métier distinct, avec ses propres règles : prix d'achat fournisseur, coffrets génériques, seuils de réapprovisionnement, dates de péremption. Le système émet un **bon de retrait** ; le stock et la délivrance physique restent hors système |
| **Facturation et refacturation** | Le système modélise des **droits d'accès aux prestations**, non des droits financiers. Aucun modèle de données ne porte de montant |
| **Processus administratifs du personnel** | Relèvent de la Section des Affaires Sociales et de la Direction des Ressources Humaines, entités distinctes du centre de soins |
| **Volet financier des évacuations** | Le système gère la décision médicale et le suivi clinique ; le bon de caisse et le barème relèvent de la Section des Affaires Sociales |
| **Consultations spécialisées** | Pôle distinct, avec un parcours de triage allégé |
| **Radiologie, laboratoire, maternité, kinésithérapie** | Quatre pôles distincts du centre |

**Trois besoins de priorité haute restent donc sans réponse** : le suivi des coûts d'évacuation, le tableau de bord de l'absentéisme, et le logiciel de gestion pharmaceutique. Ils appartiennent tous à des domaines écartés.

> **Ce point doit être énoncé franchement, et il se défend.** Un besoin **hors périmètre** relève d'une décision de cadrage argumentée ; un besoin **non réalisé dans le périmètre** relèverait d'un échec. Le premier se défend, le second se subit.
>
> Ces trois besoins figurent en **perspectives** de la conclusion, comme extensions naturelles du système.

### 3.5.4 La solution

Une plateforme interne de gestion médico-sanitaire couvrant le périmètre ci-dessus, accessible depuis les deux sites et **fonctionnant en connexion comme hors connexion**.

Elle se décline en trois canaux appuyés sur un socle commun :

| Canal | Usage visé |
|---|---|
| Application web | Poste connecté, tablette, téléphone |
| Client de bureau connecté | Poste fixe, avec intégration au système d'exploitation |
| **Client de bureau autonome** | Poste devant fonctionner **sans connexion**, avec base locale et resynchronisation |

Ce qui reste inclus forme un ensemble cohérent : **tout ce qui se passe entre le moment où une personne se présente au centre et le moment où elle en repart avec ses documents.**

---

## 3.6 Concepts liés au sujet *(section ajoutée d'après le plan de l'école)*

| Concept | Définition retenue dans ce mémoire |
|---|---|
| **Système d'information médical** | Ensemble organisé de moyens permettant de recueillir, conserver, traiter et diffuser l'information nécessaire aux activités de soin |
| **Dossier patient** | Ensemble consolidé des informations concernant une personne : identité, antécédents, allergies, alertes, et historique de ses passages |
| **Visite** | Passage d'un patient au centre. Unité de travail créée à l'accueil, portant les constantes vitales, close par une consultation |
| **Triage** | Étape d'accueil et d'enregistrement. Ici **par ordre d'arrivée**, sans notion de priorité clinique |
| **Consultation** | Acte clinique conduit pendant une visite, aboutissant à une conclusion et, éventuellement, à une décision |
| **Ordonnance** | Document de prescription. **Non restreint** par catégorie de patient |
| **Bon de prise en charge** | Document ouvrant droit au retrait de médicaments ou à la réalisation d'un examen. **Restreint** par catégorie |
| **Évacuation** | Orientation d'un patient vers une structure de soins supérieure |
| **Catégorie de patient** | Classement administratif déterminant les prestations prises en charge |
| **Délégation de prescription** | Autorisation temporaire, accordée par le médecin chef à un infirmier, de prescrire dans un cadre défini |
| **Offline-first** | Approche de conception où le fonctionnement sans réseau est le cas nominal, et la connexion un enrichissement |
| **Synchronisation** | Rapprochement des données d'un poste local et d'un serveur central, par échange des seules modifications |
| **Résolution de conflit** | Arbitrage entre deux modifications concurrentes du même enregistrement |
| **Suppression logique** | Marquage d'un enregistrement comme supprimé sans effacement, afin que la suppression puisse se propager |
| **Traçabilité** | Capacité à établir après coup qui a fait quoi, quand et depuis où |
| **Habilitation** | Ensemble des droits d'un agent, résultant de son rôle et de ses dérogations individuelles |

---

## Conclusion du chapitre et transition vers la partie II

Ce chapitre a établi les caractéristiques du domaine. Le suivi médical repose sur une **hiérarchie où l'infirmier agit sous délégation** du médecin chef, avec une visibilité cloisonnée à sa propre activité. Le fonctionnement sur **deux sites distants et mal reliés** impose une réplication complète des dossiers, arbitrée en faveur de la disponibilité de l'information de soin, avec des garde-fous applicatifs. Enfin, une **règle d'éligibilité par catégorie de patient** distingue le soin, ouvert à tous, de la prise en charge, réservée à certains — distinction qui structure une large part du système.

Deux volets restent à compléter : la critique de l'existant, qui exige les observations du recueil, et la revue bibliographique, qui exige des lectures effectives.

La partie II développe la démarche technique. Le chapitre 4 expose la méthode, le chapitre 5 formalise l'existant, le chapitre 6 analyse les besoins, le chapitre 7 conçoit la solution, le chapitre 8 rend compte de sa réalisation.

---

## Récapitulatif de l'état

| Section | État |
|---|---|
| Introduction | ✅ rédigée |
| 3.1.1 Structure hiérarchique | ✅ **débloquée** — personnel commun, 4 profils, littératie hétérogène. Effectifs en attente (QO-02) |
| 3.1.2 Fonctionnement bi-sites | ✅ rédigée, prouvée par le code |
| 3.1.3 Catégories et prise en charge | ✅ rédigée, prouvée — sauf QO-06 |
| 3.2 Critique de l'existant | ✅ **débloquée** — qualitative, mesures en attente (QO-01) |
| 3.3 Synthèse bibliographique | ⛔ à conduire — lectures réelles |
| 3.4 Intérêts du sujet | ✅ rédigée |
| 3.5 Justification et solution | ✅ rédigée |
| 3.6 Concepts | ✅ rédigée |
| Conclusion | ✅ rédigée |
