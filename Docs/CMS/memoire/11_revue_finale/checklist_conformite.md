# Checklist de conformité

> Contrôle final avant remise. Chaque case est **vérifiée**, non supposée.
> Date de passage : 2026-08-10.

---

## 1. Conformité au plan de rédaction

| # | Contrôle | État | Preuve |
|---|---|:---:|---|
| 1.1 | Les 8 chapitres du modèle sont présents, dans l'ordre | ✅ | 8 fichiers de chapitre |
| 1.2 | Les sections ajoutées d'après le plan de l'école sont présentes | ✅ | Ch. 1 § 1.3bis et 1.5 · Ch. 2 § 2.1 et 2.6 · Ch. 3 § 3.4 et 3.6 |
| 1.3 | Introduction générale en 8 points | ✅ | Fichier d'introduction |
| 1.4 | Conclusion en 5 parties + mot de fin | ✅ | Fichier de conclusion |
| 1.5 | Pages liminaires complètes | ✅ | Page de garde, dédicace, remerciements, résumé, abstract, listes, sigles |
| 1.6 | Résumé et abstract entre 150 et 200 mots | ✅ | 187 et 184 mots, décomptés |
| 1.7 | Cinq mots-clés de chaque côté | ✅ | — |
| 1.8 | Annexes A à F présentes | ✅ | 6 fichiers d'annexe |

## 2. Contraintes de forme de l'école

| # | Contrôle | État | Note |
|---|---|:---:|---|
| 2.1 | Corps du rapport entre 75 et 90 pages | ⚠️ | Budget établi à 67-85 pages. **Non vérifiable avant mise en page Word** |
| 2.2 | Times New Roman 12, interligne 1,25, justifié | ⏳ | À appliquer à la mise en page |
| 2.3 | Marges 1,5 partout, reliure gauche 1,5 | ⏳ | Idem |
| 2.4 | Titres 16 / 14 / 13 / 13 / 12, légendes 11 italique | ⏳ | Idem |
| 2.5 | En-tête : thème · pied : page, noms, année | ⏳ | Idem |
| 2.6 | Pagination i→vi, puis 1, puis a/A/I | ⏳ | Idem |
| 2.7 | **Au plus 2 descriptions textuelles de UC** | ✅ | Exactement 2 — ch. 6 § 6.6. Les autres en annexe C |
| 2.8 | **Au plus 3 diagrammes de séquence système** | ✅ | Exactement 3 — figures 6.4 à 6.6 |
| 2.9 | Au plus 3 diagrammes d'activité au chapitre 6 | ✅ | 0 — les activités sont aux chapitres 5 et 7 |
| 2.10 | Bibliographie : 8 à 10 références minimum | ✅ | **8 références**, dont **5 vérifiées à la source**. Reste à les lire — É-18 |

## 3. Fidélité au code

| # | Contrôle | État | Preuve |
|---|---|:---:|---|
| 3.1 | Les **8 inventaires** sont extraits de leur source, référencés | ✅ | 7 du code, 1 du recueil de l'existant |
| 3.1bis | **Les besoins exprimés sont confrontés à la couverture réelle** | ✅ | 18 besoins · 0 non couvert dans le périmètre |
| 3.1ter | **Le périmètre est formalisé, chaque exclusion motivée** | ✅ | `perimetre_et_hors_perimetre.md` · Ch. 3 § 3.5 |
| 3.2 | Réconciliation à **zéro orphelin** | ✅ | Rapport de réconciliation |
| 3.3 | Aucune fonctionnalité non prouvée décrite comme implémentée | ✅ | Contrôle par statut sur les 23 besoins |
| 3.4 | Les chiffres cités correspondent aux inventaires | ✅ | 268 routes · 88 entités · 128 permissions · 15 écrans · 52 entités synchronisées |
| 3.5 | Les différences Web / API / Desktop sont explicites | ✅ | Ch. 8 § 8.3 · INV-05 § 7 |
| 3.6 | Les cardinalités des fiches correspondent au schéma | ✅ | Fiche `UML-CLS-01` bloc 5, 38 associations vérifiées |
| 3.7 | Aucun écart avec le code n'a été effacé | ✅ | Matrice d'alignement, 24 écarts consignés |

## 4. Honnêteté

| # | Contrôle | État | Preuve |
|---|---|:---:|---|
| 4.1 | **Aucun résultat de test n'est affirmé sans preuve** | ✅ | Tableau 8.1 : « prévu — non exécuté » sur les 13 lignes |
| 4.2 | Les sources absentes sont signalées, pas comblées | ✅ | 3 chapitres en squelette, blocs `⛔ EN ATTENTE DE SOURCE` |
| 4.3 | Aucune référence bibliographique inventée | ✅ | 3 références réelles, le reste marqué à compléter |
| 4.4 | Aucun entretien, chiffre ou capture inventés | ✅ | Tableaux 1.1, 2.1 et 5.1 laissés vides |
| 4.5 | Les limites sont énoncées | ✅ | Conclusion § 4, six limites |
| 4.6 | Le rôle du stage de Verdi est formulé sans approximation | ✅ | Introduction § 7 · Ch. 5 · Annexe A § 5 · Page de garde |
| 4.7 | Les champs non confirmés restent `[ à compléter ]` | ✅ | Promoteur, jury, année académique |
| 4.8 | Aucune fonction partielle présentée comme achevée | ✅ | BF23 marqué partiel · signature de code marquée non implémentée |

## 5. Sécurité et confidentialité

| # | Contrôle | État |
|---|---|:---:|
| 5.1 | Aucun mot de passe, aucune clé, aucun jeton | ✅ |
| 5.2 | Aucune chaîne de connexion, aucun nom d'hôte de production | ✅ |
| 5.3 | Aucune donnée patient réelle | ✅ |
| 5.4 | Les extraits de code sont vérifiés sur ces points | ✅ Annexe E, section de vérification |
| 5.5 | Le protocole de captures impose l'anonymisation | ✅ |
| 5.6 | Aucune adresse personnelle ni URL de dépôt privé | ✅ |

## 6. Vocabulaire

| # | Contrôle | État |
|---|---|:---:|
| 6.1 | Aucun `SGCDM` | ✅ |
| 6.2 | Aucun `Brazzaville` ni `Pointe-Noire` | ✅ |
| 6.3 | Aucun « Centre Médico-**Social** » — la forme retenue est **Sanitaire** | ✅ |
| 6.4 | Aucune notion de « priorité » au triage, sauf pour la nier | ✅ |
| 6.5 | Ordonnance et bon ne sont jamais confondus | ✅ |
| 6.6 | Verrou et rideau de confidentialité ne sont jamais confondus | ✅ |
| 6.7 | `MEDECIN` n'est jamais présenté comme un rôle | ✅ |
| 6.8 | Tout terme employé figure au glossaire | ✅ Annexe F |

## 7. Figures et tableaux

| # | Contrôle | État | Note |
|---|---|:---:|---|
| 7.1 | Chaque figure dispose de sa fiche de dessin | ✅ | **24 fiches prêtes**, 1 seule bloquée et documentée |
| 7.2 | Chaque fiche passe le test de dessinabilité | ✅ | 8 blocs, dont tableau des liens et plan de placement |
| 7.3 | Numérotation séquentielle, sans exception | ✅ | Décision D-06 |
| 7.4 | Les listes sont générées depuis l'index | ✅ | — |
| 7.5 | Les figures théoriques citent leur source | ⚠️ | Fiche `ORG-03` : référence à compléter |
| 7.6 | **Les figures produites** | ❌ | **0 sur 24 tracée** — les fiches sont prêtes, le dessin reste à faire |
| 7.7 | **Les captures d'écran** | ❌ | **0 produite** — protocole prêt |

## 8. Traçabilité

| # | Contrôle | État |
|---|---|:---:|
| 8.1 | La chaîne besoin → règle → UC → écran → route → entité → permission → test → chapitre est établie | ✅ |
| 8.2 | Les 5 règles transverses sont tracées dans les deux sens | ✅ |
| 8.3 | La couverture par canal est documentée | ✅ |
| 8.4 | La traçabilité **ascendante** vers le terrain | ✅ **établie** — les 18 besoins du recueil sont tracés jusqu'à leur verdict |

---

## Synthèse

| Catégorie | ✅ | ⚠️ | ⏳ | ❌ |
|---|---:|---:|---:|---:|
| Plan de rédaction | 8 | 0 | 0 | 0 |
| Forme | 4 | 1 | 5 | 0 |
| Fidélité aux sources | 10 | 0 | 0 | 0 |
| Honnêteté | 8 | 0 | 0 | 0 |
| Sécurité | 6 | 0 | 0 | 0 |
| Vocabulaire | 8 | 0 | 0 | 0 |
| Figures | 5 | 1 | 0 | 2 |
| Traçabilité | 4 | 0 | 0 | 0 |
| **Total** | **53** | **2** | **5** | **2** |

**Légende** : ✅ conforme · ⚠️ partiel · ⏳ dépend de la mise en page Word · ❌ non conforme, action requise

### Les 2 non-conformités restantes

| # | Point | Action requise |
|---|---|---|
| 7.6 | **Aucune figure tracée** | Tracer les 24 figures à partir de leurs fiches — 3 à 4 jours |
| 7.7 | **Aucune capture produite** | Lancer l'application et appliquer le protocole — ½ journée |

**Les deux relèvent d'un travail manuel que seuls les auteurs peuvent faire**, conformément à leur choix de tracer eux-mêmes les diagrammes.

### Les 4 points levés depuis la version précédente

| # | Point | Comment |
|---|---|---|
| 2.10 | Bibliographie insuffisante | **8 références**, dont 5 vérifiées à la source. Reste à les lire — É-18 |
| 8.4 | Traçabilité ascendante absente | **Recueil obtenu**, INV-08 produit, 18 besoins tracés |
| — | Chapitres 1, 2, 5 en squelette | **Rédigés** sur la source primaire |
| — | 3 figures bloquées | **2 débloquées** — organigramme et processus antérieur. Une seule reste bloquée |
