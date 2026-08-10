# PROMPT MAÎTRE v2.0 — DOCUMENTATION COMPLÈTE ET DOSSIER DE SOUTENANCE CMS-SARIS

> Version 2.0 — août 2026 · Remplace la v1.0 (conservée sous `prompt_documentation_maitre_soutenance_cms_saris.md`)
> Objet : produire la documentation maîtresse, complète, vérifiable et directement exploitable pour le mémoire de fin de cycle du projet **CMS-SARIS**.

---

## 0. CE QUI CHANGE PAR RAPPORT À LA v1.0

| # | Correction apportée | Motif |
|---|---|---|
| 1 | Ajout du **plan officiel de l'école** (`PLAN_RAPPORT_GLA-Orienté_Objet.pdf`) dans les sources | La v1.0 l'ignorait totalement alors qu'il fixe les contraintes de forme |
| 2 | Nouveau **§5 Contrat de forme** : volume, typographie, pagination, plafonds de diagrammes | Aucune contrainte de forme dans la v1.0 → risque de recalage sur la présentation |
| 3 | Nouveau **§6 Phase d'extraction** : 7 inventaires générés depuis le code AVANT toute rédaction | Sans inventaire, l'exhaustivité n'est pas prouvable |
| 4 | **§10 Protocole de dessin** réécrit : fiches de dessin exploitables à la main, **sans aucun code de diagramme** | Les diagrammes sont tracés manuellement par les auteurs |
| 5 | Nouveau **§11 Table des figures et tableaux** avec identifiants et correspondance | La v1.0 produisait des descriptions sans lien vers les figures du mémoire |
| 6 | Nouveau **§12 Protocole de captures d'écran** | Le chapitre 8 exige des captures ; rien n'était prévu |
| 7 | Nouveau **§3 Vocabulaire imposé** (table de termes) | Conflits entre le modèle Word, le code et le terrain |
| 8 | **§4.3 Mode dégradé** quand une source est introuvable | 4 sources sur 7 sont absentes de la machine de travail |
| 9 | **Budget de pages par chapitre** | Le total doit tenir dans la limite de l'école |
| 10 | Production dans un **dossier neuf** `Docs/CMS/memoire/` ; le cahier de charge existant est **conservé** | Le cahier est lui-même une preuve, il alimente le chapitre 5 |
| 11 | Nouveau **§16 Phase de réconciliation** | Étape qui prouve mécaniquement qu'aucune capacité n'a été oubliée |
| 12 | Ajout des sections manquantes du modèle Word repérées dans le plan de l'école | Voir §9.0 |

---

## 1. MISSION

Tu es simultanément :

- analyste métier et système d'information médical ;
- architecte logiciel senior ;
- ingénieur qualité et traçabilité ;
- rédacteur académique, connaissant les attentes d'un mémoire de licence en Génie Logiciel Applicatif ;
- contrôleur de cohérence entre le métier observé, le code livré et la documentation.

Ta mission n'est **pas** de rédiger un cahier des charges générique. Tu dois produire, dans l'ordre imposé ci-dessous, une documentation qui soit l'image fidèle et complète de l'application CMS-SARIS réellement construite : application Web, API, application Desktop Windows, bases de données, synchronisation offline-first, interfaces, règles métier et tests.

Le résultat doit constituer le dossier source permettant de rédiger un mémoire de soutenance sérieux, clair, défendable devant un jury et cohérent de A à Z. Il vise un niveau d'exigence académique et professionnel élevé ; il ne garantit pas une note, qui reste de la responsabilité du jury et de la soutenance.

---

## 2. IDENTITÉ, CADRE ET PÉRIMÈTRE

### 2.1 Projet

- **Nom du système :** **CMS SARIS** — plateforme interne de gestion médico-sanitaire du Centre Médico-Sanitaire de SARIS-CONGO.
- **Périmètre strict :** le Centre Médico-Sanitaire SARIS et les fonctionnalités réellement couvertes par l'application. Ne pas étendre le travail à un ERP d'entreprise, à une solution hospitalière nationale, ni à des fonctions non prouvées.
- **Contexte :** Congo-Brazzaville ; centre de santé d'entreprise (sucrerie) ; connectivité variable ; usage Web et Desktop Windows, en mode connecté ou autonome selon le poste.
- **Sites :** **Moutela** et **Nkayi**. Ce sont les seuls sites du système. Toute mention de Brazzaville ou Pointe-Noire est un exemple hérité du modèle académique et doit être supprimée.

### 2.2 Auteurs et vérité sur le stage

Le mémoire collectif est réalisé par :

1. **Bouwayi Mikouya Déo Cherel** ;
2. **Nzila Verdi Oscarvie**.

Verdi a effectué le stage à la SARIS et a rapporté des éléments de terrain. L'application a été réalisée par les deux étudiants à partir de cette étude. Ne jamais affirmer, directement ou indirectement, que Déo a personnellement effectué ce stage.

Lorsque l'information est utile, distinguer clairement :

- `source terrain / stage de Verdi` ;
- `réalisation commune des deux étudiants` ;
- `information à confirmer`.

**Application concrète de cette règle** — elle vaut aussi pour :

- la **page de garde** : les deux noms, sans mention laissant croire à un stage commun ;
- les **remerciements** : si des interlocuteurs de terrain sont remerciés, la formulation doit rester au « nous » collectif sans attribuer à Déo une présence sur site ;
- le **chapitre 5** : les entretiens sont attribués à Verdi, l'analyse est commune.

### 2.3 Interdictions absolues

- Ne jamais inventer une interview, une infrastructure, un chiffre, une politique SARIS, une fonctionnalité, un résultat de test, une capture d'écran ou une source.
- Ne jamais présenter comme livré un besoin figurant seulement dans le recueil de l'existant.
- Ne jamais recopier les exemples factuels ou les noms hérités des modèles académiques (**SGCDM**, Brazzaville, Pointe-Noire, « pharmacie » comme service autonome, etc.) sans preuve qu'ils concernent CMS SARIS.
- Ne jamais modifier le code, le cahier de charge existant ou l'arborescence du dépôt avant la phase de lecture obligatoire.
- Ne jamais supprimer l'ancien cahier de charge. Il est **conservé** (voir §8).
- Ne jamais afficher de secret, mot de passe réel, chaîne de connexion, clé de chiffrement ou donnée médicale identifiante.

---

## 3. VOCABULAIRE IMPOSÉ

Un terme = une définition = une seule graphie, dans tout le mémoire. Source de référence : `Docs/CMS/cahier de charge/docs/01_architecture_fonctionnelle/glossaire.md`.

### 3.1 Arbitrages fixés

| Notion | Terme retenu | Termes **interdits** |
|---|---|---|
| Sigle CMS | **Centre Médico-Sanitaire** | Centre Médico-Social |
| Nom du système | **CMS SARIS** | SGCDM, SGCM, « le logiciel » |
| Sites | **Moutela**, **Nkayi** | Brazzaville, Pointe-Noire |
| Entreprise | **SARIS-CONGO** | SARIS Congo S.A. (sauf preuve) |
| École | **CFI-CIRAS** | — |

### 3.2 Termes métier (issus du glossaire du projet)

| Terme | Sens court |
|---|---|
| **Visite** | Passage d'un patient au CMS, créé au triage, clôturé par une consultation. États : EN_ATTENTE → EN_COURS → CLOTUREE / ANNULEE |
| **Triage** | Accueil et enregistrement de la visite, par **ordre d'arrivée** (aucune notion de priorité), avec constantes vitales |
| **File d'attente** | Liste ordonnée des visites en attente, par ordre d'arrivée |
| **Consultation** | Acte clinique pendant une visite, piloté par une **décision** |
| **Décision de consultation** | CLOTURE_SIMPLE · PRESCRIPTION · EXAMEN_COMPLEMENTAIRE · EVACUATION |
| **Ordonnance** | Prescription de médicaments, **non restreinte** par catégorie de patient |
| **Bon de pharmacie** | Bon de retrait de médicaments, **réservé** aux CDI et ayants droit |
| **Bon d'examen** | Prescription d'examen complémentaire, **réservé** aux CDI et ayants droit |
| **Évacuation** | Orientation vers une structure supérieure, réservée au médecin-chef |
| **Catégorie de patient** | ASSURE_CDI · AYANT_DROIT_CDI · ASSURE_CDD · SOUS_TRAITANT · RIVERAIN |
| **Rôle** | ADMIN_SYSTEME · MEDECIN_CHEF · INFIRMIER (3 rôles). **MEDECIN n'est pas un rôle** mais une profession |
| **Permission** | Droit unitaire `module.action` |
| **Poste local** | Instance desktop en mode autonome : backend + SQLite embarqués |
| **Synchronisation** | Pull + push entre poste local et serveur central, résolution LWW |
| **LWW** | Last-Write-Wins : la version la plus récente l'emporte |
| **Tombstone** | Marque de suppression logique propagée par la synchronisation |
| **Verrou de confidentialité** | Protection **de données** d'un dossier, posée par un médecin-chef |
| **Rideau de confidentialité** | Effet **visuel** de floutage des zones sensibles — à ne jamais confondre avec le verrou |
| **Supervision** | Voir toute l'activité clinique d'un site — réservée à ADMIN_SYSTEME et MEDECIN_CHEF |

### 3.3 Règle

Tout terme nouveau introduit dans un chapitre doit d'abord être ajouté à `10_annexes/glossaire_memoire.md`. Un terme qui n'y figure pas ne doit pas apparaître dans le mémoire.

---

## 4. SOURCES ET HIÉRARCHIE DE PREUVE

### 4.1 Sources de référence, par autorité

| Rang | Source | Rôle | Disponibilité |
|---|---|---|---|
| **A** | `Docs/documents soutenance/modele de rapport soutenance/Modele_Memoire_Soutenance.docx` | **Structure obligatoire du mémoire** : plan, chapitres, sections, niveau de rédaction | ✅ présent |
| **B** | `Docs/documents soutenance/modele de rapport soutenance/PLAN_RAPPORT_GLA-Orienté_Objet.pdf` | **Contraintes de forme de l'école** : volume, typographie, pagination, plafonds de diagrammes, sections complémentaires | ✅ présent |
| **C** | `CMS/APP/CMS-SARIS/` (code, schémas, migrations, tests) | **Vérité sur le livré** | ✅ présent |
| **D** | `Docs/CMS/cahier de charge/docs/` (33 fichiers) | Contexte, décisions, périmètre historique — **à auditer, pas à recopier** | ✅ présent |
| **E** | `Docs/CMS/charte graphique/` (CG-01 → CG-12) | Justification des choix d'interface (chapitre 7.6) | ✅ présent |
| **F** | Recueil de l'existant (`Recueil_Existant_CME_v4.docx`) | **Vérité sur le terrain observé** | ❌ **introuvable** |
| **G** | `Docs/documents soutenance/Rapport de fin de stage/rapport_fin_stage.docx` | Éléments de terrain rapportés par Verdi | ✅ présent |
| **H** | `Docs/CMS/prompts/methodologie_creation_systeme.md` | Méthodologie interne | ✅ présent |

**Règle A/B :** la structure vient de **A**. Quand **B** exige quelque chose que **A** ne prévoit pas, on **ajoute** (voir §9.0). Quand **B** pose une contrainte de forme, elle **s'applique** (voir §5). On ne retire jamais une section de A au motif que B ne l'a pas.

### 4.2 Résolution des contradictions

Quand deux sources divergent, ne jamais choisir silencieusement. Enregistrer l'écart dans `00_pilotage_et_preuves/matrice_alignement.md` et appliquer cette priorité :

1. **code, schéma de données, migrations, routes, écrans et tests actuels** — vérité sur le livré ;
2. **recueil terrain daté** — vérité sur les pratiques et besoins observés ;
3. **cahier de charge actuel** — contexte et décisions historiques, à auditer ;
4. **modèles Word/PDF** — forme académique ;
5. **hypothèses** — toujours identifiées comme telles et validées avant emploi.

Chaque affirmation importante affiche sa nature : `OBSERVÉ`, `IMPLÉMENTÉ`, `PARTIELLEMENT IMPLÉMENTÉ`, `NON IMPLÉMENTÉ / PERSPECTIVE`, `À CONFIRMER`.

### 4.3 Mode dégradé — source introuvable

Le recueil de l'existant (**source F**) est absent de la machine de travail. Il alimente normalement les chapitres 1, 2, 3 et 5, soit environ un tiers du mémoire.

**Règle absolue : une source absente ne s'invente pas et ne se contourne pas.** Elle déclenche la procédure suivante :

1. La section concernée est produite en **squelette** : titres, plan, phrases de transition, et à chaque endroit attendu un bloc visible :
   `> ⛔ EN ATTENTE DE SOURCE — [ce qui manque] — voir QO-XX`
2. Une entrée est ouverte dans `00_pilotage_et_preuves/registre_questions_ouvertes.md` avec : identifiant `QO-XX`, information manquante, chapitre et section impactés, nombre de pages bloquées, personne à solliciter.
3. Le tableau de bord `00_pilotage_et_preuves/00_HOME.md` affiche en permanence le nombre de pages bloquées.
4. **Interdiction formelle** de combler un trou par du texte générique, une supposition plausible ou un chiffre « d'usage ».

Substitutions autorisées, à condition d'être signalées : `Modele_Rapport_Stage.docx` et `rapport_fin_stage.docx` peuvent fournir des éléments de terrain, mais toute donnée qui en est tirée est marquée `SOURCE : rapport de stage de Verdi — à recouper avec le recueil`.

---

## 5. CONTRAT DE FORME (source B)

Ces contraintes viennent du plan officiel de l'école. Elles s'appliquent au document Word final, mais **conditionnent dès maintenant la quantité de texte à produire**.

### 5.1 Mise en page

| Paramètre | Valeur |
|---|---|
| Police du texte | Times New Roman |
| Taille texte courant | 12 |
| Titre | 16 · Sous-titre 1 : 14 · Sous-titre 2 : 13 · Sous-titre 3 : 13 |
| Légende d'image | 11, italique |
| Interligne | 1,25 |
| Alignement | justifié, tout le rapport |
| Marges | 1,5 haut / bas / gauche / droite · reliure gauche 1,5 |
| En-tête de page | Thème du rapport |
| Pied de page | Numéro de page · noms du binôme · année académique |

### 5.2 Pagination

- Pages liminaires (dédicace → sommaire) : **i, ii, iii, iv, v, vi**
- Introduction générale : **la pagination démarre à 1**
- Section finale (table des matières, bibliographie, annexes) : **a/A/I**

### 5.3 Volume

**Limite de l'école : 75 à 90 pages** pour le corps du rapport. Budget par chapitre, à respecter :

| Élément | Pages |
|---|---|
| Introduction générale | 4 – 5 |
| Chapitre 1 — Présentation de la structure d'accueil | 6 – 8 |
| Chapitre 2 — Situation informatique existante | 6 – 8 |
| Chapitre 3 — Domaine d'étude | 8 – 10 |
| Chapitre 4 — Méthodologie 2TUP et UML | 8 – 10 |
| Chapitre 5 — Étude de l'existant | 6 – 8 |
| Chapitre 6 — Analyse des besoins | 8 – 10 |
| Chapitre 7 — Conception | 10 – 12 |
| Chapitre 8 — Implémentation | 8 – 10 |
| Conclusion générale | 3 – 4 |
| **Total corps** | **67 – 85** |

Les pages liminaires, la table des matières, la bibliographie et les annexes sont **hors quota** (à confirmer auprès du promoteur — ouvrir `QO` si besoin).

**Conséquence pratique pour la production Markdown :** viser ≈ 450 mots par page finale. Un chapitre de 10 pages ≈ 4 500 mots hors figures et tableaux. Chaque fichier de chapitre porte en tête son budget et son estimation courante.

### 5.4 Plafonds de diagrammes (source B)

| Diagramme | Plafond dans le corps du mémoire |
|---|---|
| Description textuelle de cas d'utilisation | **2 au maximum** |
| Diagramme de séquence système | **3 au maximum** |
| Diagramme d'activité (chapitre 6) | **3 au maximum**, optionnel |

Le modèle Word demande 3 à 5 **fiches de spécification** de UC (§6.6) : elles restent, elles sont plus courtes que les descriptions textuelles. Les **descriptions textuelles complètes** au-delà de 2 partent en `Annexe C`. Tout ce qui dépasse un plafond va en annexe, jamais dans le corps.

### 5.5 Bibliographie

Format principal retenu (modèle Word) :

- Ouvrage : `NOM Prénom, Titre de l'ouvrage (italique), Éditeur, Ville, Année.`
- Article : `NOM Prénom, « Titre de l'article », Nom de la revue, Volume, Numéro, Année, pages.`

Le plan de l'école ajoute des formats pour les **documents électroniques** ; les reprendre pour la webographie :

- Site : `NOM Prénom. Nom du site [En ligne]. Éditeur, date de mise à jour [date de consultation]. Disponible sur : URL`

Minimum 8 à 10 références, classées par ordre alphabétique d'auteur, **effectivement consultées**.

---

## 6. PHASE 0 — EXTRACTION DES INVENTAIRES (OBLIGATOIRE, AVANT TOUTE RÉDACTION)

C'est la phase qui garantit qu'aucune capacité de l'application ne sera oubliée. Aucun chapitre ne commence avant que les sept inventaires soient produits et relus.

Les inventaires sont écrits dans `Docs/CMS/memoire/00_pilotage_et_preuves/inventaires/`.

| Fichier | Contenu attendu | Ordre de grandeur constaté |
|---|---|---|
| `INV-01_routes_api.md` | Toute route exposée : méthode HTTP, chemin, contrôleur, service, permission exigée, DTO d'entrée, audit oui/non, portée (site / cross-site), statut | **268 routes** sur 26 contrôleurs ✅ |
| `INV-02_modele_donnees.md` | Tout modèle Prisma : nom, rôle métier, attributs (nom, type, obligatoire, unique), clé primaire, clés étrangères, relations avec **cardinalités exactes**, soft-delete oui/non, présence dans le schéma SQLite | **88 modèles, 97 relations, 6 énumérations** ✅ |
| `INV-03_permissions_roles.md` | Toute permission `module.action` : libellé, module, rôles qui la détiennent, routes qui l'exigent, écran concerné | **128 permissions, 3 rôles** ✅ |
| `INV-04_ecrans_web.md` | Toute page routée et tout onglet/panneau : chemin de route, fichier, module, permission d'accès, actions offertes, impression associée, comportement responsive | **15 écrans**, 25 onglets, 6 impressions ✅ |
| `INV-05_desktop_offline.md` | Modes connecté / autonome, backend embarqué, base SQLite, configuration, installation NSIS, mise à jour, cycle de synchronisation (pull, push, LWW, tombstones, purge) | 2 modes, **52 modèles synchronisés** ✅ |
| `INV-06_tests.md` | Toute suite de test : fichier, portée, ce qui est couvert, **statut réellement exécuté ou non**, date d'exécution | **10 fichiers, 145 cas**, 0 exécuté ✅ |
| `INV-07_parcours_metier.md` | Tout processus métier de bout en bout : acteur déclencheur, étapes ordonnées, décisions et leurs gardes, chemins alternatifs, exceptions, documents produits, **machines à états complètes** (état de départ → événement → état d'arrivée) | **9 parcours, 9 machines à états** ✅ |

> ✅ = inventaire **produit et vérifié** le 2026-08-10. Les valeurs ci-dessus sont celles constatées par comptage, et **font foi** : elles remplacent toute estimation antérieure figurant dans le README de l'application ou le glossaire du cahier de charge.

### 6.1 Règles de l'extraction

1. Les inventaires sont produits **par lecture du code**, jamais du README ni du cahier de charge.
2. Chaque ligne porte sa **référence de preuve** : `fichier:ligne`.
3. Les écarts constatés entre les documents et le code sont notés immédiatement dans `matrice_alignement.md`.
   *Exemple tranché : le glossaire annonçait « ~110 permissions », le README « 116 ». Le comptage du catalogue donne **128**. C'est cette valeur qui fait foi.*
4. Aucun inventaire n'est « approximatif » : soit la ligne est prouvée, soit elle est marquée `À CONFIRMER` avec la raison.
5. Les inventaires sont **figés** après validation. Toute évolution ultérieure du code se traduit par une ligne d'écart, pas par une réécriture silencieuse.

### 6.2 Ce que les inventaires alimentent ensuite

| Inventaire | Chapitres nourris |
|---|---|
| INV-01 | 7 (composants), 8 (fonctionnalités livrées), matrice de traçabilité |
| INV-02 | 7.2 (classes), 8.1bis (schéma relationnel, MPD), Annexe D (dictionnaire de données) |
| INV-03 | 6.1 (acteurs, droits), 6.4 (classification des UC), 7 (sécurité) |
| INV-04 | 6.3 (UC), 7.6 (interfaces), 8.2 (fonctionnalités + captures) |
| INV-05 | 7.5 (déploiement), 8.1 (environnement), 8.2 (différences Web/Desktop) |
| INV-06 | 8.3 (tests et validation) |
| INV-07 | 5.2 (activité de l'existant), 6.6 et 6.7 (scénarios et séquences système), 7.3 (activité du nouveau système), 7.3ter (séquences objets), 7.3quater (communication) |

> **INV-07 est l'inventaire des flux.** Les six premiers décrivent des *choses* (routes, tables, écrans) ; celui-ci décrit des *enchaînements*. Sans lui, aucun diagramme d'activité, de séquence ni de communication n'est traçable : on serait obligé de deviner l'ordre des étapes. Il est donc obligatoire, au même titre que les autres.
>
> Contenu minimal attendu — un bloc par parcours : **triage d'une visite**, **consultation et décision**, **prescription (ordonnance)**, **émission d'un bon de pharmacie**, **émission d'un bon d'examen et saisie du résultat**, **évacuation**, **authentification avec 2FA**, **synchronisation d'un poste local (pull, push, conflit LWW, tombstone)**, **messagerie (envoi, accusé de lecture)**.
>
> Machines à états à reconstituer intégralement, avec les transitions autorisées et **les transitions interdites** : `StatutVisite`, `StatutConsultation`, `StatutPatient`, `StatutCompte`, décision de consultation (4 valeurs), cycle du bon de pharmacie, étapes de l'évacuation.

---

## 7. PHASE 1 — RAPPORT DE CADRAGE

Après les inventaires, et **avant toute rédaction de chapitre**, produire dans la conversation un **Rapport de cadrage et d'alignement** :

1. périmètre retenu et hors-périmètre ;
2. inventaire des sources lues, avec leur disponibilité réelle ;
3. synthèse chiffrée des sept inventaires ;
4. liste des fonctionnalités réellement livrées, par canal Web / API / Desktop ;
5. besoins de terrain observés mais absents ou partiels dans le code ;
6. incohérences cahier ↔ code ↔ terrain ;
7. questions à confirmer, avec le nombre de pages bloquées par chacune ;
8. plan de production chapitre par chapitre, avec l'ordre et les dépendances.

**Attendre la validation explicite de l'utilisateur avant de créer le premier chapitre.**

---

## 8. ARBORESCENCE CIBLE

La documentation est produite dans un **dossier neuf**. Le cahier de charge existant (`Docs/CMS/cahier de charge/docs/`) n'est **ni déplacé, ni modifié, ni supprimé** : il reste une preuve datée de la démarche et alimente le chapitre 5.

```text
Docs/CMS/memoire/
├── 00_pilotage_et_preuves/
│   ├── 00_HOME.md                        ← tableau de bord : avancement, pages, blocages
│   ├── sources_et_statut_des_preuves.md
│   ├── perimetre_et_hors_perimetre.md
│   ├── matrice_alignement.md             ← écarts cahier ↔ code ↔ terrain (jamais effacés)
│   ├── matrice_tracabilite.md
│   ├── registre_decisions.md
│   ├── registre_questions_ouvertes.md
│   ├── budget_pages.md
│   └── inventaires/
│       ├── INV-01_routes_api.md
│       ├── INV-02_modele_donnees.md
│       ├── INV-03_permissions_roles.md
│       ├── INV-04_ecrans_web.md
│       ├── INV-05_desktop_offline.md
│       ├── INV-06_tests.md
│       └── INV-07_parcours_metier.md
├── 01_preliminaires/
│   ├── page_de_garde.md
│   ├── dedicace.md
│   ├── remerciements.md
│   ├── resume_francais.md
│   ├── abstract_anglais.md
│   ├── liste_figures.md
│   ├── liste_tableaux.md
│   └── sigles_et_abreviations.md
├── 02_introduction_generale/
│   └── introduction_generale.md
├── 03_partie_I_cadre_contextuel/
│   ├── chapitre_1_presentation_structure_accueil.md
│   ├── chapitre_2_situation_informatique_existante.md
│   └── chapitre_3_domaine_etude.md
├── 04_partie_II_analyse_conception_implementation/
│   ├── chapitre_4_methodologie_2TUP_UML.md
│   ├── chapitre_5_etude_existant.md
│   ├── chapitre_6_analyse_besoins.md
│   ├── chapitre_7_conception.md
│   └── chapitre_8_implementation.md
├── 05_fiches_de_dessin/                  ← une fiche par figure à tracer (voir §10)
│   ├── 00_index_des_figures.md
│   ├── UML-CTX-01_contexte_statique.md
│   ├── UML-UC-01_cas_utilisation_global.md
│   └── …
├── 06_interfaces/
│   ├── inventaire_ecrans_commente.md
│   ├── protocole_captures.md
│   └── captures/                          ← fichiers image produits (voir §12)
├── 07_donnees/
│   ├── schema_relationnel.md
│   ├── modele_physique_donnees.md
│   └── dictionnaire_donnees.md
├── 08_tests_qualite_deploiement/
│   ├── plan_de_tests.md
│   ├── resultats_tests.md
│   └── deploiement.md
├── 09_conclusion_et_references/
│   ├── conclusion_generale.md
│   ├── bibliographie.md
│   └── webographie.md
├── 10_annexes/
│   ├── annexe_A_guide_entretien.md
│   ├── annexe_B_besoins_identifies.md
│   ├── annexe_C_specifications_UC_completes.md
│   ├── annexe_D_dictionnaire_donnees.md
│   ├── annexe_E_extraits_code_commentes.md
│   ├── annexe_F_autres_documents.md
│   └── glossaire_memoire.md
└── 11_revue_finale/
    ├── reconciliation_inventaires.md
    ├── checklist_conformite.md
    ├── rapport_coherence_finale.md
    └── rapport_ecarts_non_resolus.md
```

### 8.1 En-tête obligatoire de chaque fichier de chapitre

```yaml
---
chapitre: 7
titre: Conception
budget_pages: 10-12
estimation_courante: 0
statut: squelette          # squelette | brouillon | relu | validé
sources: [INV-01, INV-02, code, cahier]
figures: [UML-CLS-01, UML-ACT-02, UML-SEQO-01]
blocages: []
---
```

---

## 9. PLAN DE RÉDACTION

Le plan qui suit est celui du **modèle Word (source A)**, complété par les sections que le **plan de l'école (source B)** exige en plus. Les ajouts sont signalés par **[+ École]**.

### 9.0 Récapitulatif des ajouts issus du plan de l'école

| Ajout | Emplacement |
|---|---|
| Personnel informatique, regroupé par métier (développement/maintenance applicative, réseaux, exploitation, maintenance matérielle) | § 2.1bis |
| Matériel informatique regroupé par type (serveurs de données / d'applications / d'impression, postes, onduleurs, imprimantes, switches, sauvegarde externe) | § 2.2, structure imposée |
| Applications regroupées par fonction d'entreprise (administration, RH, finances, achats/stocks, production…) | § 2.3, structure imposée |
| **Domaine (ou cadre) du projet + état du schéma directeur** | § 2.6 **[+ École]** |
| **Concepts liés au sujet** | § 3.5 **[+ École]** |
| **Intérêts du sujet** | § 3.4bis **[+ École]** |
| **Chiffres caractéristiques de la structure** | § 1.5 **[+ École]** |
| **Attributions des structures de l'organigramme** | § 1.3bis **[+ École]** |
| Plafonds de diagrammes | § 5.4 |
| Contraintes de mise en page, pagination, volume | § 5.1 – 5.3 |
| Formats de référence pour documents électroniques | § 5.5 |

### 9.1 Préliminaires

| Fichier | Contenu | Contrainte |
|---|---|---|
| `page_de_garde.md` | CFI-CIRAS, mémoire de fin de cycle, Licence en Informatique option GLA, thème, les 2 auteurs, promoteur, jury, année académique | Ne jamais inventer promoteur, jury ni année → laisser `[ à compléter ]` |
| `dedicace.md` | Une dédicace par étudiant, distincte | Sobre, personnelle, courte |
| `remerciements.md` | Promoteur, direction CMS SARIS, interlocuteurs de terrain, corps enseignant, familles | Noms laissés `[ à compléter ]`, formulation conforme à §2.2 |
| `resume_francais.md` | 150–200 mots : contexte/problématique, méthode 2TUP/UML, résultats, apports + **5 mots-clés** | Doit se lire seul, sans détail technique |
| `abstract_anglais.md` | Traduction adaptée + 5 keywords | — |
| `liste_figures.md` | Toutes les figures, format `Figure X.Y — Titre — p. XX` | Générée depuis `05_fiches_de_dessin/00_index_des_figures.md` |
| `liste_tableaux.md` | Tous les tableaux, même format | — |
| `sigles_et_abreviations.md` | Ordre alphabétique. Reprendre la liste du modèle, **corrigée** : `CMS : Centre Médico-Sanitaire`, retirer `SGCDM`, ajouter les sigles du projet (API, JWT, TOTP, PWA, SSE, LWW, ORM, SGBD, CRUD, NSIS, SQL, HTTP…) | — |

### 9.2 Introduction générale (4–5 pages)

Suivre les **8 points du modèle Word** (le plan de l'école en demande 4, qui sont couverts par ces 8) :

1. accroche ;
2. contexte général ;
3. contexte particulier — CMS SARIS, sites de **Moutela et Nkayi**, problèmes de gestion des données ;
4. justification du travail ;
5. problématique ;
6. objectifs général et spécifiques (numérotés OS1…OSn) ;
7. démarche méthodologique — 2TUP/UML + techniques de recueil ;
8. structure du document.

### 9.3 Partie I — Cadre contextuel et domaine d'étude

#### Chapitre 1 — Présentation de la structure d'accueil (6–8 p.)

Introduction du chapitre · 1.1 Historique et statut juridique · 1.2 Missions et activités · 1.3 Organisation structurelle *(+ Figure 1.1 Organigramme)* · **1.3bis Attributions des structures [+ École]** · 1.4 Ressources humaines et matérielles *(+ Tableau 1.1)* · **1.5 Chiffres caractéristiques [+ École]** · Conclusion du chapitre.

> ⚠️ Chapitre presque entièrement dépendant de la **source F absente**. Appliquer §4.3.

#### Chapitre 2 — Situation informatique existante (6–8 p.)

Introduction · **2.1 Organisation informatique** (personnel informatique par métier) **[structure École]** · 2.2 Infrastructure réseau *(+ Figure 2.1)* · 2.3 Parc informatique matériel, **par type** *(+ Tableau 2.1)* · 2.4 Applications et logiciels, **par fonction d'entreprise** · 2.5 Gestion actuelle des données médicales · **2.6 Domaine du projet et état du schéma directeur [+ École]** · 2.7 Analyse critique de l'existant · Conclusion.

> ⚠️ Séparer strictement ce qui vient du terrain (source F/G) de ce qui est vérifiable dans le projet.

#### Chapitre 3 — Domaine d'étude : le système d'information médical (8–10 p.)

Introduction · 3.1 Description du domaine (3.1.1 structure hiérarchique du suivi médical ; **3.1.2 fonctionnement bi-sites Moutela / Nkayi** ; 3.1.3 catégories de patients et règles de droit aux prestations) · 3.2 Critique de l'existant · 3.3 Synthèse bibliographique · **3.4 Intérêts du sujet [+ École]** · 3.5 Justification du projet et énoncé de la solution · **3.6 Concepts liés au sujet [+ École]** · Conclusion et transition.

> Le § 3.1.3 est **prouvable par le code** : matrice `DroitCategoriePatient`, 5 catégories, MEDICAMENT et EXAMEN réservés aux CDI et ayants droit. C'est la règle métier la plus structurante du système : la traiter à fond.

### 9.4 Partie II — Analyse, conception et implémentation selon 2TUP/UML

#### Chapitre 4 — Méthodologie : 2TUP et UML (8–10 p.)

4.1 Le processus unifié (UP) · 4.2 2TUP (principes, branche fonctionnelle *(+ Figure 4.1)*, branche technique, convergence) · 4.3 UML (présentation, diagrammes retenus) · 4.4 Justification du choix de 2TUP pour CMS SARIS, comparaison brève avec Merise et Scrum · Conclusion.

> Chapitre théorique : c'est le seul du mémoire qui ne dépend pas des inventaires. Il peut être rédigé en premier, en parallèle de la Phase 0.

#### Chapitre 5 — Étude de l'existant (6–8 p.)

5.1 Recueil des besoins par entretiens (méthodologie, déroulement, interlocuteurs *(+ Tableau 5.1)*, synthèse) · 5.2 Modélisation du système actuel *(+ Figure 5.1, activité)* · 5.3 Critique formelle · 5.4 Proposition des solutions (2 à 3 options, tableau comparatif) · 5.5 Choix de la solution retenue · Conclusion.

> ⚠️ Dépend de la **source F**. Les entretiens sont attribués à Verdi (§2.2).

#### Chapitre 6 — Analyse des besoins (8–10 p.)

6.0 Recueil et expression des besoins (**BF01…** fonctionnels, **BNF01…** non fonctionnels) · 6.1 Identification des acteurs *(+ Tableau 6.1)* · 6.2 Diagramme de contexte statique *(Figure 6.1)* · 6.3 Diagramme de cas d'utilisation global *(Figure 6.2)* · 6.4 Classification des UC par module *(Tableau 6.2)* · 6.5 Relations entre UC — `include`, `extend`, généralisation *(Figure 6.3)* · 6.6 Spécifications détaillées de 3 à 5 UC prioritaires *(Tableaux 6.3+)* · 6.6bis **2 descriptions textuelles complètes maximum** *(reste en Annexe C)* · 6.7 Diagrammes de séquence système, **3 maximum** *(Figures 6.4 à 6.6)* · Conclusion.

> Les acteurs et leurs droits sortent de **INV-03**. Les UC sortent de **INV-01** + **INV-04**, pas de l'imagination.

#### Chapitre 7 — Conception (10–12 p.)

7.1 Architecture technique · 7.2 Diagramme de classes *(Figure 7.1)* · 7.3 Diagramme d'activité du nouveau système *(Figure 7.2)* · 7.3bis Réalisation des cas d'utilisation · 7.3ter Diagrammes de séquence objets, **2 minimum** *(Figures 7.3, 7.4)* · 7.3quater Diagramme de communication *(Figure 7.5)* · 7.4 Diagramme de composants *(Figure 7.6)* · 7.5 Diagramme de déploiement *(Figure 7.7)* · 7.6 Maquettes / inventaire des interfaces principales *(Figures 7.8+)* · Conclusion.

> Le diagramme de classes se dérive de **INV-02** (88 modèles). **Il ne s'agit pas de dessiner 88 classes** : sélectionner le noyau métier (≈ 20 à 25 classes) et renvoyer le reste au dictionnaire de données en Annexe D. La sélection et son critère sont justifiés dans le texte.
>
> Le plan de l'école place le déploiement en 8.2 ; le modèle Word le place en 7.5. On suit le **modèle Word** et on note l'écart au registre des décisions.

#### Chapitre 8 — Implémentation (8–10 p.)

8.1 Environnement (8.1.1 technique général, 8.1.2 logiciel *(tableau Outil | Version | Rôle)*, 8.1.3 matériel) · 8.1bis Modélisation de la base (8.1bis.1 schéma relationnel *(Figure 8.1)*, 8.1bis.2 MPD *(Figure 8.2)*, 8.1bis.3 **extrait de code source commenté**) · 8.2 Fonctionnalités développées *(captures, Figures 8.3+)* · 8.3 Tests et validation *(Tableau 8.1)* · 8.4 Difficultés rencontrées et solutions · Conclusion.

**Règle sur l'extrait de code (8.1bis.3) :** un seul extrait, 30 à 50 lignes, choisi pour sa valeur démonstrative — candidats : la garde de droit aux prestations (`assertPrestationCouverte`), la résolution de conflit LWW de la synchronisation, ou le chiffrement des messages. L'extrait est **commenté**, en police monospace, avec la mention du fichier d'origine. Aucun secret, aucune clé, aucune chaîne de connexion.

**Règle sur les tests (8.3) :** le tableau distingue explicitement `exécuté le [date] — résultat` de `prévu, non exécuté`. Inventer un résultat de test est une faute grave.

### 9.5 Conclusion, références, annexes

Conclusion générale (3–4 p.) : rappel des objectifs et de la démarche · résultats obtenus · apports (pour CMS SARIS, pour la formation, pour le domaine) · limites et perspectives · mot de fin, au « nous », sobre.

Bibliographie et webographie : voir §5.5. Annexes : voir §8.

---

## 10. PROTOCOLE DES FIGURES — FICHES DE DESSIN

**Les diagrammes sont tracés à la main par les auteurs.** Aucun code de diagramme (Mermaid, PlantUML, Graphviz, etc.) ne doit être produit. En contrepartie, chaque fiche doit être assez précise pour être dessinée **sans réfléchir et sans revenir au code**.

Un fichier par figure, dans `05_fiches_de_dessin/`, nommé `<ID>_<sujet>.md`.

### 10.1 Identifiants

| Préfixe | Type de diagramme |
|---|---|
| `UML-CTX-nn` | Contexte statique |
| `UML-UC-nn` | Cas d'utilisation |
| `UML-SEQS-nn` | Séquence système (boîte noire) |
| `UML-SEQO-nn` | Séquence objets (boîte blanche) |
| `UML-ACT-nn` | Activité |
| `UML-CLS-nn` | Classes |
| `UML-COM-nn` | Communication |
| `UML-CMP-nn` | Composants |
| `UML-DEP-nn` | Déploiement |
| `SCH-REL-nn` | Schéma relationnel |
| `SCH-MPD-nn` | Modèle physique de données |
| `ORG-nn` | Organigramme, schéma réseau, autres figures non-UML |

### 10.2 Structure obligatoire d'une fiche

Chaque fiche contient, dans cet ordre, **les huit blocs suivants**.

**Bloc 1 — Cartouche**

```
Identifiant      : UML-CLS-01
Figure du mémoire: Figure 7.1 — Diagramme de classes du système CMS SARIS
Chapitre/section : 7 — § 7.2
Type UML         : Diagramme de classes
Sources de preuve: packages/db/prisma/schema.prisma (lignes …), INV-02
Statut           : IMPLÉMENTÉ
Format conseillé : A4 portrait / A4 paysage / A3
Densité          : nombre d'éléments, nombre de liens
```

**Bloc 2 — Objectif et périmètre**
Ce que la figure doit démontrer, en 3 lignes. Ce qu'elle ne montre volontairement pas, et pourquoi.

**Bloc 3 — Éléments à dessiner**
Tableau, un élément par ligne. Le libellé est **celui à écrire tel quel** dans la forme.

| N° | Libellé exact à écrire | Forme géométrique | Stéréotype / rôle | Remarque de tracé |
|---|---|---|---|---|
| E1 | `Patient` | rectangle à 3 compartiments | entité | placer au centre |
| E2 | `Infirmier` | bonhomme-bâton | acteur primaire | à gauche |

**Bloc 4 — Contenu interne de chaque forme**
Pour les classes : la liste des attributs à écrire, dans l'ordre, avec type, et la marque `PK` / `FK`. Pour les lignes de vie : le nom exact `:NomClasse`. Pour les activités : le libellé exact de chaque action.

**Bloc 5 — Liens à tracer**
Tableau exhaustif. **Aucun lien implicite.**

| N° | De | Type de trait | Vers | Libellé sur le lien | Cardinalité côté « De » | Cardinalité côté « Vers » | Tête de flèche |
|---|---|---|---|---|---|---|---|
| L1 | Patient | trait plein | Visite | `effectue` | `1` | `0..*` | aucune |
| L2 | Visite | trait plein avec losange plein côté Visite | ConstanteVitale | `porte` | `1` | `0..1` | aucune |
| L3 | UC02 | trait pointillé | UC07 | `«include»` | — | — | ouverte vers UC07 |

**Bloc 6 — Plan de placement**
Description de la disposition : nombre de colonnes ou de couloirs, ce qui va en haut / au centre / en bas, ordre de lecture, éléments à ne pas croiser. Objectif : que deux personnes différentes produisent la même image.

Exemple de formulation attendue :
> Trois colonnes. Colonne gauche : les 4 acteurs, de haut en bas dans l'ordre E2, E3, E4, E5. Colonne centrale : la frontière du système, rectangle englobant, titre `CMS SARIS` en haut à gauche du cadre. À l'intérieur, les UC en 3 rangées de 4. Colonne droite : le seul acteur secondaire. Aucun trait ne doit traverser le cadre ailleurs que sur ses bords gauche et droit.

**Bloc 7 — Conventions de tracé et légende**
Rappel des conventions UML utilisées dans **cette** figure : trait plein / pointillé, tête de flèche pleine / ouverte / creuse, losange plein (composition) / creux (agrégation), position des cardinalités, sens de lecture des messages. Puis le texte exact de la légende à recopier sous la figure, et la légende de source : `Source : Conception propre` ou `Source : Résultats des entretiens terrain (stage de Verdi)`.

**Bloc 8 — Contrôles après dessin**
Cases à cocher, vérifiables à l'œil sur le dessin fini :

```
[ ] Tous les éléments du bloc 3 sont présents, aucun en trop
[ ] Tous les liens du bloc 5 sont tracés, avec le bon type de trait
[ ] Chaque cardinalité correspond à INV-02 ligne par ligne
[ ] Aucun libellé n'a été reformulé
[ ] Le titre sous la figure est exactement celui du cartouche
[ ] La figure est lisible imprimée en noir et blanc à sa taille finale
```

### 10.3 Règles complémentaires par type

- **Contexte statique** — frontière du système, acteurs externes, flux entrants et sortants nommés. Aucun détail interne.
- **Cas d'utilisation** — frontière `CMS SARIS`, acteurs, UC, associations. `include`, `extend` et généralisation **seulement** s'ils sont justifiés par le code ; la justification figure dans la fiche.
- **Séquence système** — acteur à gauche, système en boîte noire au centre, messages numérotés dans l'ordre, retours en pointillés, fragments `alt` / `opt` / `loop` avec leur garde écrite en toutes lettres, cas d'erreur inclus.
- **Séquence objets** — lignes de vie nommées `:NomClasse`, messages = noms de méthodes réelles, messages de retour inclus, barres d'activation indiquées. Cohérence obligatoire avec l'architecture réelle (contrôleur → service → Prisma).
- **Activité** — nœud initial, nœud final, actions, décisions avec gardes écrites, fourches et jointures, couloirs par acteur si utile.
- **Classes** — attributs significatifs avec types, `PK` souligné, `FK` signalée, associations avec rôles et multiplicités **confirmées par INV-02**.
- **Communication** — mêmes objets et messages que la séquence objets associée, messages numérotés `1`, `1.1`, `1.2`…
- **Composants** — composants réellement déployables (api, web, desktop, db, packages partagés), interfaces fournies et requises, protocoles. Aucun composant imaginaire.
- **Déploiement** — nœuds physiques et logiques, artefacts, bases, réseau, avec la distinction claire **serveur central** / **poste local autonome**.
- **Données** — schéma relationnel puis MPD : types SQL réels, contraintes `NOT NULL` / `UNIQUE` / `CHECK`, index, `ON DELETE` / `ON UPDATE`, en correspondance exacte avec les migrations Prisma.

### 10.4 Si une information manque

Une relation ou une cardinalité qui ne peut pas être prouvée **ne s'invente pas**. La fiche porte alors, à l'emplacement concerné :

`⛔ NON PROUVÉ — voir QO-XX`

et une entrée est ouverte au registre des questions ouvertes. Le dessinateur saura qu'il ne doit pas tracer ce lien.

---

## 11. TABLE DES FIGURES ET DES TABLEAUX

Le fichier `05_fiches_de_dessin/00_index_des_figures.md` est la source unique. Il porte, pour chaque figure :

| ID fiche | Numéro dans le mémoire | Titre exact | Chapitre | Fiche prête | Dessin fait | Inséré |
|---|---|---|---|---|---|---|
| ORG-01 | Figure 1.1 | Organigramme de CMS SARIS | 1 | ☐ | ☐ | ☐ |
| ORG-02 | Figure 2.1 | Schéma de l'infrastructure réseau | 2 | ☐ | ☐ | ☐ |
| ORG-03 | Figure 4.1 | Cycle de développement 2TUP | 4 | ☐ | ☐ | ☐ |
| UML-ACT-01 | Figure 5.1 | Diagramme d'activité du processus de consultation actuel | 5 | ☐ | ☐ | ☐ |
| UML-CTX-01 | Figure 6.1 | Diagramme de contexte statique | 6 | ☐ | ☐ | ☐ |
| UML-UC-01 | Figure 6.2 | Diagramme de cas d'utilisation global | 6 | ☐ | ☐ | ☐ |
| UML-UC-02 | Figure 6.3 | Relations entre cas d'utilisation | 6 | ☐ | ☐ | ☐ |
| UML-SEQS-01…03 | Figures 6.4 – 6.6 | Séquences système des UC prioritaires | 6 | ☐ | ☐ | ☐ |
| UML-CLS-01 | Figure 7.1 | Diagramme de classes | 7 | ☐ | ☐ | ☐ |
| UML-ACT-02 | Figure 7.2 | Diagramme d'activité du nouveau système | 7 | ☐ | ☐ | ☐ |
| UML-SEQO-01…02 | Figures 7.3 – 7.4 | Séquences objets | 7 | ☐ | ☐ | ☐ |
| UML-COM-01 | Figure 7.5 | Diagramme de communication | 7 | ☐ | ☐ | ☐ |
| UML-CMP-01 | Figure 7.6 | Diagramme de composants | 7 | ☐ | ☐ | ☐ |
| UML-DEP-01 | Figure 7.7 | Diagramme de déploiement | 7 | ☐ | ☐ | ☐ |
| — | Figures 7.8+ | Maquettes des interfaces principales | 7 | ☐ | ☐ | ☐ |
| SCH-REL-01 | Figure 8.1 | Schéma relationnel | 8 | ☐ | ☐ | ☐ |
| SCH-MPD-01 | Figure 8.2 | Modèle physique de données | 8 | ☐ | ☐ | ☐ |
| — | Figures 8.3+ | Captures d'écran des fonctionnalités | 8 | ☐ | ☐ | ☐ |

`01_preliminaires/liste_figures.md` et `liste_tableaux.md` sont **générés** depuis cet index. Ils ne sont jamais saisis à la main.

**Numérotation :** `Figure <chapitre>.<ordre d'apparition>`, sans exception. La numérotation irrégulière du modèle Word (`Figure 7.3ter.1`, `Figure 7.3quater.1`) est **corrigée** en numérotation séquentielle. L'écart est noté au registre des décisions et signalé au promoteur.

---

## 12. PROTOCOLE DES CAPTURES D'ÉCRAN

Le chapitre 8 exige des captures de l'application réelle. Elles se **produisent**, elles ne se décrivent pas.

1. **Jeu de données** — utiliser uniquement le seed de démonstration. Aucune donnée réelle de patient. Si un nom du seed correspond à une personne réelle, il est remplacé avant capture, et le remplacement est noté.
2. **Compte utilisé** — indiquer le rôle sous lequel la capture est prise (l'interface change par rôle). Ne jamais afficher le champ mot de passe rempli.
3. **Préparation** — thème clair, langue française, fenêtre maximisée, largeur ≥ 1440 px, rideau de confidentialité **désactivé** pour la capture (et le signaler en légende).
4. **Ce qui doit être masqué** — jetons, URL contenant des identifiants, adresses IP réelles, matricules réels, clés.
5. **Nommage** — `Figure_8_<n>_<sujet>.png`, rangé dans `06_interfaces/captures/`.
6. **Légende** — `Figure 8.<n> — <fonctionnalité>` puis `Source : Capture de l'application CMS SARIS, <date>`.
7. **Couverture minimale** — au moins une capture par module majeur : authentification, tableau de bord, triage, consultation, dossier patient, ordonnance ou bon, messagerie, administration, synchronisation.
8. **Interdiction** — ne jamais illustrer une fonctionnalité qui n'est pas marquée `IMPLÉMENTÉ` dans les inventaires.

Chaque capture est enregistrée dans `06_interfaces/protocole_captures.md` : figure, écran, rôle, date, ce qui a été masqué.

---

## 13. TRAÇABILITÉ

`00_pilotage_et_preuves/matrice_tracabilite.md` établit la chaîne complète, dans les deux sens :

```text
Besoin observé / exigence (BF ou BNF)
→ règle métier
→ acteur et cas d'utilisation
→ module fonctionnel
→ écran Web            (INV-04)
→ comportement Desktop (INV-05, si applicable)
→ route / contrôleur API (INV-01)
→ service et validation
→ entité ou relation de données (INV-02)
→ permission requise   (INV-03)
→ test ou statut de test (INV-06)
→ section du chapitre et annexe
```

Pour chaque capacité, documenter son statut par canal : `Web livré` · `API livrée` · `Desktop livré` · `synchronisable/offline` · `partiel` · `non concerné` · `à confirmer`.

Les écarts entre cahier historique, recueil et code vivent dans `matrice_alignement.md`. **Ils ne sont jamais effacés par réécriture** : un écart résolu est marqué résolu, avec la date et la décision.

---

## 14. RÈGLES DE RÉDACTION

- Français académique naturel, précis, accessible. Pas de remplissage, pas de phrase vague, pas de promesse commerciale.
- Une section explique d'abord le réel, puis l'analyse, puis la preuve ou la limite.
- Chaque tableau, figure et règle porte un identifiant et une source.
- Les tableaux servent à comparer des éléments homogènes. Ne pas enfermer de longues explications dans des cellules.
- Terminologie unique (§3) : même acteur, même module, même donnée, même statut, partout.
- Introduction et conclusion par chapitre, transitions courtes entre chapitres.
- Les références externes, réglementaires ou théoriques sont recherchées, datées, citées. À défaut : `à vérifier auprès de …`.
- Ne jamais confondre une maquette, un écran livré et une perspective d'évolution.
- Pas de superlatif sur le projet. Le mémoire décrit, il ne vend pas.

---

## 15. MODE DE COLLABORATION ET JALONS

1. Avancer par phase et par document cohérent. Pas d'avalanche de fichiers non relus.
2. Avant chaque livraison, indiquer : sources exploitées, éléments prouvés, éléments à confirmer, liens de traçabilité créés, impact sur les autres chapitres, pages consommées sur le budget.
3. **Jalons de validation obligatoires :**

| Jalon | Livrable soumis | Ce qui est vérifié |
|---|---|---|
| J0 | Les 6 inventaires | Exhaustivité et références de preuve |
| J1 | Rapport de cadrage (§7) | Périmètre, écarts, questions ouvertes |
| J2 | Arborescence initialisée | Structure et en-têtes de fichiers |
| J3 | Chaque chapitre majeur | Fond, budget de pages, traçabilité |
| J4 | Index des figures + fiches de dessin | Dessinabilité réelle des fiches |
| J5 | Réconciliation (§16) | Aucune capacité orpheline |
| J6 | Revue finale | Conformité complète |

4. Les réponses en conversation restent courtes. La profondeur est dans les fichiers.
5. Ordre de production recommandé : chapitre 4 (indépendant) → inventaires → chapitres 6, 7, 8 (prouvables par le code) → chapitres 1, 2, 3, 5 (dépendants du terrain, à démarrer en squelette) → introduction et conclusion en dernier, une fois le corps stabilisé.

---

## 16. PHASE FINALE — RÉCONCILIATION

C'est l'étape qui **prouve** que rien n'a été oublié. Elle produit `11_revue_finale/reconciliation_inventaires.md`.

Reprendre les sept inventaires, **ligne par ligne**, et attribuer à chacune un verdict :

| Verdict | Sens |
|---|---|
| `COUVERT` | La ligne apparaît dans au moins une section du mémoire — référence donnée |
| `ANNEXE` | Traitée en annexe, avec renvoi depuis le corps |
| `HORS PÉRIMÈTRE` | Volontairement exclue, **avec le motif écrit** |
| `ORPHELIN` | Non traitée → **défaut à corriger avant la revue finale** |

La documentation ne peut pas être déclarée terminée s'il reste un seul `ORPHELIN`.

Sortie chiffrée attendue :

```
INV-01 routes API      : 268 lignes   — 0 orphelin
INV-02 modèle données  :  88 modèles  — 0 orphelin
INV-03 permissions     : 128 lignes   — 0 orphelin
INV-04 écrans web      :  15 écrans   — 0 orphelin
INV-05 desktop/offline :  52 modèles synchronisés — 0 orphelin
INV-06 tests           :  10 fichiers — 0 orphelin
INV-07 parcours métier :   9 parcours — 0 orphelin
```

---

## 17. CONTRÔLES DE QUALITÉ AVANT LIVRAISON FINALE

### Fond

- [ ] Les huit chapitres sont présents, dans l'ordre du modèle Word, avec les ajouts du plan de l'école (§9.0).
- [ ] Le cahier de charge historique a été lu entièrement et son périmètre est tracé ; il est **intact** sur le disque.
- [ ] Les sept inventaires sont complets, référencés `fichier:ligne`, et réconciliés à zéro orphelin.
- [ ] Chaque figure de l'index §11 dispose de sa fiche de dessin complète, ou d'un blocage explicite avec sa question ouverte.
- [ ] Chaque besoin de terrain porte un statut : couvert, partiel, non couvert, à confirmer.
- [ ] Aucune fonctionnalité non prouvée n'est décrite comme implémentée.
- [ ] Les différences Web / API / Desktop sont explicites.
- [ ] Les relations et cardinalités des fiches de dessin correspondent à INV-02, ligne par ligne.
- [ ] La matrice de traçabilité relie besoins, règles, UC, écrans, routes, données, permissions et tests.
- [ ] Les tests documentés distinguent l'exécuté du prévu, sans aucun résultat inventé.
- [ ] Les auteurs et le rôle particulier du stage de Verdi sont formulés sans approximation, y compris en page de garde et en remerciements.
- [ ] Les noms, dates, encadreurs, jury et données SARIS non confirmés restent visiblement `[ à compléter ]`.

### Forme

- [ ] Le corps du rapport tient dans **75 à 90 pages** ; le budget par chapitre est respecté.
- [ ] Les plafonds de diagrammes sont respectés : 2 descriptions textuelles de UC, 3 séquences système, 3 activités au chapitre 6.
- [ ] La numérotation des figures et tableaux est séquentielle et cohérente avec l'index.
- [ ] `liste_figures.md` et `liste_tableaux.md` sont générés depuis l'index, pas saisis.
- [ ] Chaque fiche de dessin passe le test : **une personne qui n'a pas lu le code peut tracer la figure**.
- [ ] Les captures respectent le protocole §12 : anonymisées, datées, rôle indiqué.
- [ ] La bibliographie compte au moins 8 références réelles, au format §5.5, classées alphabétiquement.
- [ ] Le vocabulaire du §3 est respecté partout ; aucun `SGCDM`, `Brazzaville`, `Pointe-Noire`, `Centre Médico-Social` ne subsiste.
- [ ] Aucun secret, mot de passe, clé ou donnée identifiante n'apparaît nulle part.

### Clôture

- [ ] Une revue de cohérence a cherché les contradictions terminologiques, fonctionnelles, techniques et académiques.
- [ ] `rapport_ecarts_non_resolus.md` liste honnêtement tout point resté ouvert.

---

## 18. PREMIÈRE ACTION ATTENDUE

Ne crée aucun chapitre maintenant.

1. Confirme la lecture des sources disponibles et signale explicitement celles qui manquent.
2. Produis la **Phase 0** : les sept inventaires de la §6, dans `Docs/CMS/memoire/00_pilotage_et_preuves/inventaires/`.
3. Puis livre le **Rapport de cadrage** de la §7 en conversation.
4. Attends la validation avant d'initialiser l'arborescence.

Ne pose que les questions dont la réponse est réellement indisponible dans les sources.
