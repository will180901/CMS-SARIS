# CMS SARIS — Dossier source du mémoire de fin de cycle

> **Tableau de bord.** Point d'entrée unique du dossier documentaire. Mis à jour à chaque livraison.
> **Dernière mise à jour** : 2026-08-19 — alignement complet du dossier sur `Memoire_CMS_SARIS.docx`.
>
> ⚠️ **Le document Word fait désormais foi sur le contenu du mémoire.** Les inventaires font foi sur les chiffres. En cas de divergence entre les deux, c'est un écart à consigner, pas à masquer.

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

**Le mémoire est rédigé et mis en page.** `Memoire_CMS_SARIS.docx` — **90 pages**, dont **76 pages de corps**.

| Ce qui est fait | État |
|---|---|
| Huit inventaires extraits du code et du recueil | ✅ |
| Pilotage, registres, matrices | ✅ |
| Les huit chapitres, l'introduction et la conclusion, rédigés puis refondus | ✅ |
| Mise en page Word : styles, marges, en-tête, pied de page | ✅ |
| Sommaire, liste des figures, liste des tableaux, table des matières — champs automatiques | ✅ |
| Pagination en trois parties : **i à viii**, puis **1 à 76**, puis **A à E** | ✅ |
| Chaque chapitre démarre en haut d'une page neuve | ✅ |
| Bibliographie — 8 références, 5 vérifiées à la source | ✅ |
| Campagne de tests réelle — **103 cas exécutés, 103 réussis** | ✅ |
| Alignement du dossier documentaire sur le document Word | ✅ 19 août 2026 |

### 2.1 Ce qui reste à faire

| # | Point | Qui | Effort |
|---|---|---|---|
| 1 | **Tracer les 12 diagrammes** — fiches prêtes, emplacements réservés dans le document | Les auteurs | 2-3 jours |
| 2 | **Produire les 3 captures d'écran** — protocole prêt | Les auteurs | ½ journée |
| 3 | **Coller les 15 images**, puis Ctrl+A et F9 pour régénérer les quatre listes | Les auteurs | 1 h |
| 4 | **Lire les 4 références** — vérifiées, non lues | Les auteurs | 2-3 jours |
| 5 | **Trois informations à obtenir** : infrastructure réseau, effectifs chiffrés, guide d'entretien | Verdi et le centre | **< 2 h de sollicitations** |
| 6 | **Confirmer avec le promoteur** si la limite de 70-85 pages vise le corps ou le document entier | Les auteurs | 5 min |

### 2.2 Le point de vigilance

Le corps fait **76 pages** pour un minimum de **75** exigé par le plan de l'école. La marge est d'une page. Toute suppression ultérieure doit être compensée — voir `budget_pages.md` § 4.

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

### 3.3 Ce qui reste en attente de source

| Élément | Question |
|---|---|
| Chapitre 2 § 2.2 — infrastructure réseau, chiffrée | QO-03 |
| Chapitre 1 § 1.6 — effectifs et chiffres caractéristiques | QO-02bis |
| Chapitre 5 § 5.1 — période exacte et guide des entretiens | QO-04 |

Ces trois manques sont les seules **réserves de volume** du mémoire : les combler est la seule façon d'ajouter des pages sans les gonfler. La figure 2.1 qui dépendait de QO-03 a été retirée du mémoire ; la question reste ouverte pour le texte.

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
| `05_fiches_de_dessin/` | Index des **15 figures** + les **12 fiches** des diagrammes à tracer |
| `06_interfaces/` | Protocole de production des **3 captures d'écran** |
| `09_conclusion_et_references/` | Conclusion générale, bibliographie et webographie |
| `99_archive/` | **Ce qui a été retiré du mémoire** : les 6 annexes, les 8 fiches des figures abandonnées, les fichiers d'avant l'alignement. Chaque retrait est motivé dans son `LISEZ-MOI.md` |
| `11_revue_finale/` | Réconciliation, checklist, rapports de cohérence et d'écarts, **diagnostic d'alignement** |

> **Deux dossiers de l'arborescence initiale n'ont pas été créés, volontairement.** `07_donnees/` aurait dupliqué l'inventaire du modèle de données et les fiches du schéma relationnel et du modèle physique. `08_tests_qualite_deploiement/` aurait dupliqué INV-06 et le chapitre 8. Une information à deux endroits est une information qui diverge.

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
