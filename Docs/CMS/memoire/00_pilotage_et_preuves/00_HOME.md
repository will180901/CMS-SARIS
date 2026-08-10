# CMS SARIS — Dossier source du mémoire de fin de cycle

> **Tableau de bord.** Point d'entrée unique du dossier documentaire. Mis à jour à chaque livraison.
> **Dernière mise à jour** : 2026-08-10

---

## 1. Le projet en une page

**CMS SARIS** est la plateforme interne de gestion médico-sanitaire du Centre Médico-Sanitaire de SARIS-CONGO, déployée sur les sites de **Moutela** et **Nkayi**. Elle existe en application web et en client de bureau Windows, ce dernier pouvant fonctionner **entièrement hors connexion** sur une base locale, puis se resynchroniser avec le serveur central.

| Grandeur | Valeur constatée |
|---|---|
| Lignes de code source | ~93 500 |
| Routes de l'API | 268 |
| Modèles de données | 88, reliés par 97 associations |
| Permissions | 128, réparties sur 3 rôles |
| Écrans web | 15, plus 25 onglets |
| Migrations de base | 41 |
| Modèles synchronisés hors-ligne | 52 sur 88 |
| Cas de test écrits | 145, sur 10 fichiers |

---

## 2. État d'avancement

**Volumétrie du dossier** : 65 fichiers · 16635 lignes.

| Phase | Livrable | État |
|---|---|---|
| 0 | **Huit inventaires** — 7 du code, 1 du recueil | ✅ terminé |
| 1 | Pilotage, registres, matrices | ✅ terminé |
| 2 | Chapitres 4, 6, 7, 8 — dérivés du code | ✅ terminé |
| 3 | **Chapitres 1, 2, 3, 5 — rédigés sur le recueil** | ✅ terminé, sauf 7 pages en attente |
| 4 | Fiches de dessin — **24 prêtes, 1 bloquée** | ✅ terminé |
| 5 | Préliminaires, introduction, conclusion, annexes | ✅ terminé |
| 6 | Traçabilité, réconciliation, revue finale | ✅ terminé — **zéro orphelin** |
| 10 | **Correction du test périmé et rattachement des 2 suites** | ✅ terminé — 145 cas lançables sur 145 |
| 7 | **Bibliographie** — 8 références, 5 vérifiées à la source | ✅ terminé |
| 8 | **Campagne de tests réelle** — 103 cas exécutés, **103 réussis** | ✅ terminé |
| 9 | **Retrait de la documentation antérieure** | ✅ terminé — 51 fichiers, après rebasage |

### 2.1 Ce qui reste à faire

| # | Point | Qui | Effort |
|---|---|---|---|
| 1 | **Tracer les 24 figures** — fiches prêtes | Les auteurs | 3-4 jours |
| 2 | **Produire les captures d'écran** — protocole prêt | Les auteurs | ½ journée |
| 3 | **Lire les 8 références** — vérifiées, non lues | Les auteurs | 2-3 jours |
| 4 | **Six informations à obtenir** — infrastructure, effectifs, entretiens, encadrement | Verdi et le centre | **< 2 h de sollicitations** |

Détail et priorisation : `11_revue_finale/rapport_ecarts_non_resolus.md`.

### 2.2 Les deux corrections les plus rentables

**Sur les tests** : ✅ **fait le 2026-08-10.** Test périmé corrigé, deux suites rattachées. **103 cas exécutés, 103 réussis, 0 échec.**

**Sur le produit** : ajouter les axes « direction » et « catégorie socio-professionnelle » aux statistiques. Ce sont 4 des 10 axes attendus par le Médecin Chef, et **les données existent déjà** dans le registre des employés.

---

## 3. Sources et périmètre

### 3.1 Deux sources font autorité

| Source | Fait autorité sur |
|---|---|
| **Le code** — `CMS/APP/CMS-SARIS/` | Ce qui est **livré** |
| **Le recueil de l'existant** — `Docs/Recueil_Existant_CME_v6.docx` | Le **besoin** et le **terrain** |

Une documentation antérieure, produite avant le développement et devenue contradictoire avec le code, a été **écartée puis retirée du dépôt** après rebasage complet. Voir `sources_et_statut_des_preuves.md` § 4.

### 3.2 Un périmètre sélectionné, et assumé

Le recueil couvre **l'ensemble du Service Médico-Social** et recense **18 besoins** sur trois métiers : le soin, la logistique pharmaceutique et l'administration du personnel.

Le projet retient le **parcours de soin** — triage, consultation, décision, documents — augmenté de dix fonctions transverses. La gestion pharmaceutique et les processus administratifs sont **explicitement écartés**, chacun avec son motif.

| Verdict sur les 18 besoins | Nombre |
|---|---:|
| ✅ Couverts | 6 |
| ⚠️ Partiels | 4 |
| 🚫 Hors périmètre, motivés | 8 |
| ❌ **Non couverts dans le périmètre** | **0** |

Détail : `matrice_besoins_couverture.md`.

### 3.3 Ce qui reste bloqué

| Élément | Pages | Question |
|---|---:|---|
| Chapitre 2 §§ 2.1 à 2.3 · **Figure 2.1** · Tableau 2.1 | ≈ 3 | QO-03 — infrastructure réseau et parc |
| Chapitre 1 §§ 1.1, 1.4, 1.5 · Tableau 1.1 | ≈ 3 | QO-02bis — effectifs et chiffres |
| Chapitre 5 § 5.1.2 · Annexe A | ≈ 1 | QO-04 — période et guide des entretiens |

**≈ 7 pages sur 85**, contre 24 avant l'arrivée du recueil.

**Un entretien de vingt minutes avec le responsable informatique lèverait le principal blocage restant.**

---

## 4. Navigation du dossier

| Dossier | Contenu |
|---|---|
| `00_pilotage_et_preuves/` | Ce tableau de bord, les registres, les trois matrices et les **8 inventaires** |
| `01_preliminaires/` | Page de garde, dédicace et remerciements, résumé et abstract, listes, sigles |
| `02_introduction_generale/` | Introduction en 8 points |
| `03_partie_I_cadre_contextuel/` | Chapitres 1 à 3 |
| `04_partie_II_analyse_conception_implementation/` | Chapitres 4 à 8 |
| `05_fiches_de_dessin/` | Index des figures + une fiche par figure à tracer |
| `06_interfaces/` | Protocole de production des captures d'écran |
| `09_conclusion_et_references/` | Conclusion générale, bibliographie et webographie |
| `10_annexes/` | Annexes A à F, dont le dictionnaire de données et le glossaire |
| `11_revue_finale/` | Réconciliation, checklist, rapports de cohérence et d'écarts |

> **Deux dossiers de l'arborescence initiale n'ont pas été créés, volontairement.** `07_donnees/` aurait dupliqué le dictionnaire de données (annexe D) et les fiches du schéma relationnel et du modèle physique. `08_tests_qualite_deploiement/` aurait dupliqué INV-06 et le chapitre 8. Une information à deux endroits est une information qui diverge.

---

## 5. Règles qui gouvernent ce dossier

1. **Le code fait foi.** En cas de divergence entre un document et le code, c'est le code qui est décrit, et l'écart est consigné dans `matrice_alignement.md` — jamais effacé.
2. **Rien ne s'invente.** Une information indisponible produit un bloc `⛔ EN ATTENTE DE SOURCE` et une entrée au registre des questions ouvertes.
3. **Chaque affirmation porte son statut** : `OBSERVÉ`, `IMPLÉMENTÉ`, `PARTIELLEMENT IMPLÉMENTÉ`, `NON IMPLÉMENTÉ / PERSPECTIVE`, `À CONFIRMER`.
4. **Aucun résultat de test n'est affirmé sans sortie console à l'appui.**
5. **Aucun secret** — mot de passe, clé, chaîne de connexion, donnée patient identifiante — n'apparaît nulle part.
6. **Deux sources font autorité, et une seule sur chaque question** : le **code** sur ce qui est livré, le **recueil de l'existant** sur le besoin et le terrain. Le cahier de charge antérieur, produit avant le développement et devenu contradictoire avec le code, est **écarté** — voir `sources_et_statut_des_preuves.md` § 4.

---

## 6. Chiffres qui font foi

Ces valeurs proviennent d'un comptage direct dans le code. Elles **remplacent** toute estimation antérieure du README de l'application ou d'une documentation antérieure du projet.

| Grandeur | Valeur | Estimations antérieures, désormais caduques |
|---|---:|---|
| Routes de l'API | **268** | 273 (comptage incluant des mentions en commentaire) |
| Permissions | **128** | « ~110 » et « 116 » (estimations antérieures) |
| Écrans web atteignables | **15** | 17 (comptage des composants de page) |
| Décisions médicales | **2** | 4 (documentation antérieure) |
| Fichiers de test | **10** | 8 |
