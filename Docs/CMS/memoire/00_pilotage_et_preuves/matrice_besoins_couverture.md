# Matrice besoin exprimé → périmètre → couverture

> **Pièce maîtresse du dossier.** Elle confronte les **18 besoins exprimés** lors des entretiens de terrain à ce que le système réalise, en distinguant ce qui a été **choisi de ne pas faire** de ce qui **n'a pas été fait**.
> **Sources** : INV-08 pour les besoins · INV-01 à INV-07 pour la couverture · `perimetre_et_hors_perimetre.md` pour les exclusions.
> **Date** : 2026-08-10.

---

## 1. Comment lire cette matrice

| Verdict | Sens |
|---|---|
| ✅ **COUVERT** | Dans le périmètre, et réalisé |
| ⚠️ **PARTIEL** | Dans le périmètre, réalisé incomplètement — **c'est une limite du travail** |
| 🚫 **HORS PÉRIMÈTRE** | Volontairement exclu, **avec motif** — ce n'est pas un échec |
| ❌ **NON COUVERT** | Dans le périmètre, non réalisé — **c'est un échec, à assumer** |

**La distinction entre 🚫 et ❌ est le cœur de ce document.** Un besoin hors périmètre relève d'un cadrage argumenté. Un besoin non couvert dans le périmètre relève d'un manque.

---

## 2. Matrice complète — les 18 besoins

### 2.1 Besoins du Médecin Chef et de l'Infirmière — domaine médical

| # | Besoin exprimé | Prio | Verdict | Preuve ou motif |
|---|---|:---:|---|---|
| M1 | **Système d'information centralisé entre les deux sites** | 🔴 | ✅ **COUVERT** | Réplication complète : 52 entités synchronisées, dossier patient et parcours en portée **globale**. Un patient vu à Moutela est retrouvé à Nkayi, y compris hors connexion |
| M2 | **Dossier patient numérique** avec historique accessible au médecin | 🔴 | ✅ **COUVERT** | 30 routes, 13 entités : identité, allergies, antécédents, alertes, mode de vie, rattachements, historique des visites |
| M3 | **Automatisation des rapports** hebdomadaire, mensuel, annuel | 🔴 | ⚠️ **PARTIEL** | Module de rapports et tableaux de bord livré, avec export. **Mais 4 des 10 axes attendus sont hors d'atteinte** — voir § 3.1 |
| M4 | **Formulaire de triage numérique** — mode de vie, antécédents, examen clinique | 🟡 | ✅ **COUVERT** | Les **9 variables de mode de vie**, les antécédents personnels et familiaux, et les **9 paramètres d'examen clinique** du recueil sont tous modélisés. IMC calculé automatiquement |
| M5 | Gestion des repos médicaux liés aux accidents, **avec lien vers le service RH** | 🟡 | ⚠️ **PARTIEL** | Le **certificat de repos** est produit, avec calcul de la date de reprise. **Le lien vers le service RH n'existe pas** — hors périmètre E3 |
| M6 | **Suivi statistique des pathologies** par catégorie et par direction | 🟡 | ⚠️ **PARTIEL** | Statistiques par pathologie livrées. **La notion de direction n'existe pas** dans le modèle |
| M7 | **Délégation formalisée** — interface distincte selon le profil | 🟢 | ✅ **COUVERT** | Délégation datée, tracée sur l'ordonnance ; contrôle à deux étages ; menu et écrans filtrés par permission |

**Bilan domaine médical : 4 couverts · 3 partiels · 0 non couvert · 0 hors périmètre.**

### 2.2 Besoins du Gestionnaire RH / Service Social

| # | Besoin exprimé | Prio | Verdict | Preuve ou motif |
|---|---|:---:|---|---|
| R1 | **Tableau de suivi des coûts d'évacuation** — frais et coût salarial | 🔴 | 🚫 **HORS PÉRIMÈTRE** | Exclusions **E2** et **E4**. Aucun modèle de données ne porte de montant. Le volet financier des évacuations relève de la Section des Affaires Sociales |
| R2 | **Tableau de bord de l'absentéisme** — par jour, direction, catégorie socio-professionnelle | 🔴 | 🚫 **HORS PÉRIMÈTRE** | Exclusion **E3**. Relève de la Direction des Ressources Humaines. Ni la direction ni la catégorie socio-professionnelle n'existent dans le modèle |
| R3 | **Espace de consultation autonome** des données, à la demande | 🟡 | ✅ **COUVERT** *(pour le domaine médical)* | Les tableaux de bord sont consultables à la demande, adaptés au rôle, avec export. Ils ne portent que sur l'activité clinique |
| R4 | **Suivi des pathologies fréquentes** et de leur prévalence | 🟡 | ✅ **COUVERT** | Statistiques par pathologie et par catégorie de patient. Répond directement à l'exemple cité — *« si beaucoup de collaborateurs souffrent du paludisme… »* |
| R5 | **Dématérialisation des flux** papier et verbal | 🟢 | ⚠️ **PARTIEL** | Dématérialisé **dans le périmètre médical** : dossier, consultation, documents, messagerie tracée. Les flux vers le service RH restent papier — hors périmètre E3 |

**Bilan RH : 2 couverts · 1 partiel · 2 hors périmètre · 0 non couvert.**

### 2.3 Besoins de la Pharmacienne

| # | Besoin exprimé | Prio | Verdict | Motif |
|---|---|:---:|---|---|
| P1 | **Logiciel de gestion du stock** avec persistance des données | 🔴 | 🚫 **HORS PÉRIMÈTRE** | Exclusion **E1**. Métier distinct : prix fournisseur, coffrets génériques, seuils. Le système émet un bon de retrait, il ne gère pas le stock |
| P2 | **Impression automatique des reçus** de dispensation | 🔴 | 🚫 **HORS PÉRIMÈTRE** | Exclusion **E1**. Le système imprime le **bon de retrait** ; le reçu de dispensation appartient au processus pharmaceutique |
| P3 | **Automatisation de la facturation** et ventilation par catégorie | 🔴 | 🚫 **HORS PÉRIMÈTRE** | Exclusion **E2**. Aucune donnée financière |
| P4 | Alertes sur **stock bas et péremption** | 🟡 | 🚫 **HORS PÉRIMÈTRE** | Exclusion **E1** |
| P5 | Révision du rythme de réapprovisionnement | 🟡 | 🚫 **HORS PÉRIMÈTRE** | **Problème organisationnel, non informatique.** Le recueil le dit lui-même : *« ce problème est structurel et ne peut pas être résolu par le seul outil informatique »* |
| P6 | Reprise des **inventaires physiques** réguliers | 🟢 | 🚫 **HORS PÉRIMÈTRE** | Idem — problème de procédure |

**Bilan pharmacie : 0 couvert · 6 hors périmètre.**

> **Ce bilan doit être présenté sans détour et sans embarras.** L'intégralité des besoins de la pharmacienne est hors périmètre, et deux d'entre eux ne relèvent même pas de l'informatique — le recueil le reconnaît explicitement pour le réapprovisionnement.
>
> C'est la démonstration la plus nette de l'utilité d'un cadrage : sans lui, ce projet aurait tenté de devenir un logiciel de pharmacie, un outil RH et un dossier patient à la fois — et n'aurait été bon à rien.

---

## 3. Les trois limites réelles

Trois besoins **dans le périmètre** ne sont que partiellement satisfaits. Ce sont les seules vraies limites fonctionnelles du travail.

### 3.1 M3 et M6 — les axes statistiques manquants

Le Médecin Chef attend **dix axes** d'analyse des consultations. Le système en couvre six.

| # | Axe attendu | État | Obstacle |
|---|---|:---:|---|
| 1 | Évolution annuelle du nombre total | ✅ | — |
| 2 | Nombre par **département / direction** | ❌ | Attribut absent du modèle |
| 3 | Évolution annuelle par **département / direction** | ❌ | Idem |
| 4 | Évolution annuelle par **catégorie socio-professionnelle** | ❌ | Attribut absent du modèle |
| 5 | Répartition selon la **catégorie socio-professionnelle** | ❌ | Idem |
| 6 | Répartition selon la **direction** | ❌ | Idem |
| 7 | Pathologies selon la catégorie de patient | ✅ | — |
| 8 | Pathologies selon la **direction** | ❌ | Attribut absent |
| 9 | Répartition selon le type de consultation | ✅ | — |
| 10 | Consultations liées à un accident de travail | ⚠️ | Le suivi des accidents a été retiré du système |

**Diagnostic précis.** Le modèle de données porte la **catégorie de patient** — qui gouverne les droits — mais **ni la direction, ni le département, ni la catégorie socio-professionnelle** du collaborateur. Or ce sont ces trois attributs que le Médecin Chef croise dans ses rapports.

**Coût de la correction.** Le registre des employés existe déjà et porte les champs `fonction`, `service` et `departement`. Les données sont donc **présentes** ; elles ne sont simplement pas exploitées par le module de statistiques. Il s'agirait d'ajouter des jointures et des axes d'agrégation, non de modifier le modèle.

> C'est la **perspective d'évolution la plus rentable** du système : le besoin est exprimé en priorité haute, les données existent, et le travail est circonscrit.

### 3.2 M5 — le lien avec le service RH

Le certificat de repos est produit et imprimé. **Il n'est pas transmis au service RH** : l'agent doit le porter physiquement, exactement comme avant.

C'est une conséquence assumée de l'exclusion E3. Mais elle laisse subsister, dans le périmètre, **un point de rupture que le système n'a pas supprimé** — celui-là même que le recueil dénonce : *« les données transmises sur support papier et verbal »*.

Le dire est plus honnête que de le taire.

### 3.3 Le parcours de consultation spécialisée

Le recueil décrit un **triage allégé** pour l'ophtalmologie, l'ORL et la stomatologie : statut et identité seulement, sans anamnèse ni examen clinique.

Le système applique **le même flux à tous les types de consultation**. Un patient orienté vers un spécialiste passera donc par un triage complet inutile.

**Coût de la correction** : conditionner l'affichage des étapes au type de consultation. Le type existe déjà dans le modèle.

---

## 4. Synthèse

| Verdict | Nombre | Part |
|---|---:|---:|
| ✅ **COUVERT** | **6** | 33 % |
| ⚠️ **PARTIEL** | **4** | 22 % |
| 🚫 **HORS PÉRIMÈTRE, motivé** | **8** | 44 % |
| ❌ **NON COUVERT dans le périmètre** | **0** | 0 % |
| **Total** | **18** | |

### Lecture par domaine

| Domaine | Couverts | Partiels | Hors périmètre |
|---|---:|---:|---:|
| **Médical** — le périmètre retenu | **4** | 3 | 0 |
| RH et service social | 2 | 1 | 2 |
| Pharmacie | 0 | 0 | 6 |

### Ce que la matrice établit

**Dans le périmètre retenu, aucun besoin n'est laissé sans réponse.** Les sept besoins du domaine médical sont couverts ou partiellement couverts ; aucun n'est ignoré.

**Les huit besoins hors périmètre sont tous motivés**, et six d'entre eux appartiennent à un métier — la pharmacie — que le projet a explicitement écarté. Deux ne relèvent même pas de l'informatique.

**Les quatre couvertures partielles sont les vraies limites** du travail. Trois d'entre elles ont une cause identifiée et un coût de correction estimable.

> **Ce que cette matrice apporte au mémoire.** Elle transforme une question redoutable — *« pourquoi n'avez-vous pas fait la pharmacie ? »* — en démonstration de méthode. Elle prouve que le périmètre n'a pas été subi mais choisi, et que le choix a été instruit besoin par besoin.

---

## 5. Perspectives issues de cette matrice

Classées par rapport valeur / effort, telles qu'elles figureront en conclusion.

| # | Évolution | Besoin servi | Effort | Pourquoi c'est rentable |
|---|---|---|---|---|
| 1 | **Ajouter les axes direction et catégorie socio-professionnelle** aux statistiques | M3, M6 — priorité haute | Faible | **Les données existent déjà** dans le registre des employés |
| 2 | **Alléger le triage** pour les consultations spécialisées | Fidélité au processus réel | Faible | Le type de consultation existe déjà |
| 3 | **Transmettre le certificat de repos** au service RH | M5 | Moyen | Supprime un point de rupture papier subsistant |
| 4 | Rétablir le **suivi des accidents de travail** | Axe statistique 10 | Moyen | Retiré du système ; le besoin demeure |
| 5 | Étendre au **suivi des coûts d'évacuation** | R1 — priorité haute | Élevé | Exige d'introduire des données financières |
| 6 | Étendre à la **gestion pharmaceutique** | P1 à P4 — priorité haute | Élevé | Métier distinct, projet à part entière |
