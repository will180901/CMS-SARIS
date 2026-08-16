# Rapport des écarts non résolus

> ⚠️ **Ce rapport a été établi le 10 août 2026, avant la refonte du mémoire.** Il a été mis à jour le 19 août sur les points factuels — nombre de figures, résultats de tests, disparition des annexes — mais sa structure reste celle de la revue d'origine. L'état courant du document est décrit dans `DIAGNOSTIC_ALIGNEMENT_DOCX.md`.


> **Ce rapport liste honnêtement tout ce qui n'est pas fait.** Il n'existe pas pour rassurer : il existe pour qu'aucun point ne soit découvert la veille de la remise, ou en soutenance.
> **Date** : 2026-08-10, après intégration du recueil de l'existant.

---

## 1. Ce qui a été résolu depuis la version précédente de ce rapport

| # | Écart antérieur | Résolution |
|---|---|---|
| É-03 | Bibliographie — 3 références sur 8-10 | ✅ **8 références**, dont **5 vérifiées à la source**. Reste à les **lire** avant citation |
| É-04 | Recueil de l'existant introuvable — 24 pages bloquées | ✅ **Obtenu.** Version v6. Chapitres 1, 2, 3, 5 rédigés ; figures 1.1 et 5.1 et tableau 5.1 débloqués. **≈ 18 pages débloquées sur 24** |
| É-05 | Aucun test exécuté | ✅ **103 cas exécutés sur 145**, 103 réussis, 0 échec — sorties console à l'appui |
| — | Documentation antérieure contradictoire | ✅ **Écartée puis retirée du dépôt**, après rebasage de 18 fichiers sur le recueil et le code |

---

## 2. Écarts bloquants — le mémoire ne peut pas être remis en l'état

### É-01 ⛔ Aucune figure n'est tracée

| | |
|---|---|
| **Constat** | 15 figures sont numérotées, leur emplacement est réservé dans le document. **Zéro n'est dessinée** |
| **Ce qui existe** | **24 fiches de dessin complètes**, en 8 blocs : liste exacte des formes, tableau des liens avec cardinalités, plan de placement, contrôles de vérification |
| **Ce qui manque** | Le tracé lui-même |
| **Qui peut le faire** | Les auteurs — c'est un choix assumé, décision D-05 |
| **Effort estimé** | 3 à 4 jours. La figure 7.5, le diagramme de classes global, est la plus longue : compter une demi-journée |
| **Ordre conseillé** | Voir l'index des figures § 3 |

### É-02 ⛔ Aucune capture d'écran n'est produite

| | |
|---|---|
| **Constat** | Le chapitre 8 § 8.3 exige des captures. Aucune n'existe |
| **Ce qui existe** | Le protocole complet : jeu de données, rôle à indiquer, éléments à masquer, nommage, couverture minimale de 14 captures |
| **Prérequis** | Installer les dépendances, démarrer la base et l'API, charger le jeu de démonstration |
| **Effort estimé** | Une demi-journée, dont l'essentiel en mise en place |
| **Point de vigilance** | Vérifier que les noms du jeu de démonstration ne correspondent pas à des personnes réelles — QO-12 |
| **Capture la plus précieuse** | La **8.11**, montrant le refus d'un bon pour un patient non couvert. C'est la seule qui prouve que la règle centrale s'applique réellement |

---

## 3. Écarts sérieux — le mémoire est remettable, mais affaibli

### É-06 ⚠️ Deux suites de test ne s'exécutent jamais — **et la dérive est prouvée**

51 cas sur 145 — **35 %** — ne sont rattachés à aucune commande : la résolution de conflit hors connexion (17 cas) et la validation des saisies (34 cas).

**Ce n'est plus une crainte théorique.** La campagne du 10 août a révélé que la suite de validation avait **silencieusement cessé de couvrir la neuvième constante vitale** — la fréquence respiratoire, ajoutée au client et au serveur mais jamais au test. Le garde-fou ne comparait plus que huit plages sur neuf, et son compteur était resté figé à huit.

Personne ne l'avait vu, parce que personne ne lançait cette suite.

**Deux corrections, dans cet ordre** : corriger le test périmé — une entrée à ajouter, un compteur de 8 à 9, **cinq minutes** ; puis rattacher les deux suites à une commande, **dix minutes, 51 cas récupérés**.

**C'est la correction au meilleur rapport effort / bénéfice de tout le projet.**

### É-07 ⚠️ Le cœur clinique n'a aucun test

Triage, consultation, prescription, bons, évacuation : aucun test dédié. La règle de prise en charge par statut — la plus structurante — n'est couverte par aucun test.

**Effort** : plusieurs jours. **Non réalisable avant la soutenance** dans un délai raisonnable.
**Traitement retenu** : énoncé comme limite en conclusion, porté en perspective.

### É-08 ⚠️ Le mode autonome n'est pas validé à l'exécution

Pipeline vérifié statiquement, jamais exécuté de bout en bout sur machine cible. Trois points à confirmer : les moteurs de base de données après empaquetage, le démarrage du processus forké, la copie de la base modèle au premier lancement.

**Effort** : une journée. **Enjeu** : c'est le seul besoin fonctionnel marqué partiel pour cause technique.

### É-09 ⚠️ La synchronisation n'est pas éprouvée entre deux postes

Le code réclame lui-même une validation à deux postes : ordre des clés étrangères, chaînes de portée, liaison des dates selon le moteur.

**Effort** : une journée, deux machines requises.

### É-18 ⚠️ Les références bibliographiques ne sont pas lues

Huit références sont listées, **cinq vérifiées à la source** — auteurs, titres, éditeurs, années, identifiants contrôlés. Mais **vérifier n'est pas lire**.

Le chapitre 3 § 3.3 est structuré et ses points d'appui identifiés ; sa rédaction argumentée exige la lecture effective.

**Effort** : deux à trois jours de lecture. **Priorité** : l'ouvrage de Roques et Vallée, obligatoire pour le chapitre 4 et pour sourcer la figure 4.1 ; puis l'article sur Tombouctou, le plus proche du sujet.

---

## 4. Écarts mineurs

| # | Écart | Effort | Traitement |
|---|---|---|---|
| É-10 | Signature de code non active | Coût d'un certificat | Porté en perspective |
| É-11 | 5 machines à états sur 9 non garanties par la base | 1 journée | Porté en perspective |
| É-12 | Permissions déclarées à deux endroits côté web | 2 heures | Signalé au ch. 8 § 8.6 |
| É-13 | Règle de cohérence des permissions dupliquée | Refonte | Dette assumée, ch. 7 § 7.1.3 |
| É-14 | 3 permissions sans route serveur | Vérification | Signalé, matrice § 4.3 |
| É-15 | Source du schéma 2TUP non renseignée | 30 minutes | ⚠️ **Obligatoire avant impression** — fiche `ORG-03` |
| É-16 | Aucune mesure de couverture de test | Configuration | Aucun pourcentage n'est annoncé |
| É-17 | Aucune exigence chiffrée de performance | Campagne de mesure | Porté en perspective |
| **É-19** | **4 axes statistiques sur 10 hors d'atteinte** | **Faible — les données existent** | **Première perspective en rapport valeur/effort** |
| **É-20** | **Parcours de consultation spécialisée non distingué** | **Faible** | Le type de consultation existe déjà |
| **É-21** | **Certificat de repos non transmis au service administratif** | Moyen | Point de rupture papier subsistant dans le périmètre |

---

## 5. Points à confirmer

| # | Question | Impact si non résolu |
|---|---|---|
| QO-02bis | Effectifs, chiffres d'activité, statut juridique du centre | Chapitre 1 §§ 1.1, 1.4, 1.5 ; Tableau 1.1 — ≈ 3 pages |
| **QO-03** | **Infrastructure réseau et parc informatique** | **Chapitre 2 § 2.2 et Tableau 2.1. La figure 2.1 a été retirée du mémoire — décision D-18. Seule figure encore bloquée** |
| QO-04 | Période, durée et guide des entretiens | Chapitre 5 § 5.1 — ≈ 1 page |
| QO-08 | Promoteur, jury, année académique | Page de garde incomplète |
| QO-09 | La limite de 70-85 pages vise-t-elle le corps ou le document entier ? | Le corps fait 76 pages, le document 90. À confirmer auprès du promoteur |
| QO-16 | Faut-il ventiler les statistiques par les 9 statuts réels ? | Question probable du jury |
| QO-17 | Faut-il ajouter les axes manquants avant la soutenance ? | Voir É-19 |

---

## 6. Plan d'action recommandé

### Priorité 1 — cette semaine

| # | Action | Effort | Débloque |
|---|---|---|---|
| 1 | **Corriger le test périmé, puis rattacher les 2 suites orphelines** | 15 min | É-06 · 51 cas de test |
| 2 | **Un entretien de 20 min avec le responsable informatique** | 20 min | QO-03 · 3 pages · la dernière figure bloquée |
| 3 | Renseigner la source du schéma 2TUP | 30 min | É-15 |
| 4 | Confirmer promoteur, jury, année | 1 appel | QO-08 |
| 5 | Obtenir de Verdi la période et le guide des entretiens | 1 appel | QO-04 |
| 6 | Obtenir les effectifs et chiffres d'activité | 1 appel | QO-02bis · 3 pages |

> **Les six actions de priorité 1 représentent moins de deux heures de travail effectif** — l'essentiel étant du temps d'attente de réponses. Elles débloquent 7 pages, une figure et un tableau.

### Priorité 2 — les deux semaines suivantes

| # | Action | Effort |
|---|---|---|
| 7 | **Lire les références bibliographiques**, en commençant par Roques et Vallée | 2-3 jours |
| 8 | **Tracer les 12 diagrammes et produire les 3 captures** | 2-3 jours |
| 9 | **Produire les captures d'écran** | ½ journée |
| 10 | Exécuter les 5 suites d'intégration restantes | ½ journée |
| 11 | Ajouter les 4 axes statistiques manquants | 1 journée |
| 12 | Valider le mode autonome par un build réel | 1 journée |

### Priorité 3 — si le temps le permet

Tester le cœur clinique · valider la synchronisation à deux postes · alléger le triage des consultations spécialisées · mesurer la couverture.

---

## 7. Estimation globale

| Catégorie | Écarts | Effort cumulé |
|---|---:|---|
| Bloquants | 2 | ≈ 4 jours — dessin et captures |
| Sérieux | 5 | ≈ 5 jours, dont 3 de lecture |
| Mineurs | 11 | ≈ 2 jours pour les traitables |
| À confirmer | 7 | **moins de 2 heures** de sollicitations |

**Le dossier est structurellement complet et cohérent.** Ce qui manque relève de trois natures : un travail manuel que seuls les auteurs peuvent faire — dessiner, capturer ; un travail intellectuel qui ne se délègue pas — lire ; et six informations à obtenir par de brèves sollicitations.

Aucun de ces manques n'est un défaut de conception du dossier. Tous sont identifiés, chiffrés et priorisés.

---

## 8. Ce qui, en revanche, est acquis

- Les **8 inventaires** couvrent l'intégralité du code et du recueil, avec référence à la ligne près.
- La **réconciliation** est à **zéro orphelin** : aucune capacité du système n'est absente du mémoire.
- Les **18 besoins exprimés** sont confrontés un à un à la couverture réelle : **zéro besoin non couvert dans le périmètre**.
- Les **chiffres sont cohérents** dans tout le dossier — 22 grandeurs vérifiées.
- **103 cas de test ont été réellement exécutés**, avec un échec analysé et diagnostiqué.
- Le **vocabulaire est unifié**, et les termes hérités éliminés — avec la nuance apportée sur les villes des établissements partenaires.
- Les **24 écarts** entre documents et code sont consignés, dont **6 résolus** par le recueil.
- **Aucun résultat de test n'est inventé**, aucune référence fabriquée, aucun chiffre de terrain supposé.
- Les **24 fiches de dessin** sont exploitables sans revenir au code.
- Les **limites sont énoncées** dans le mémoire lui-même, pas seulement dans ce rapport.
- La **documentation antérieure contradictoire** a été retirée, après rebasage complet des sources.
