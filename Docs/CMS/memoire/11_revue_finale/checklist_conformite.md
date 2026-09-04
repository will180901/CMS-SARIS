# Checklist de conformité

> **Date de passage** : 28 août 2026
> **Document contrôlé** : `Memoire_CMS_SARIS.docx` — **98 pages**, corps de **84 pages**
> Chaque case est **mesurée sur le document**, jamais supposée. La méthode et le chiffre obtenu figurent dans la colonne « Preuve ».
> Le passage précédent datait du 19 août et portait sur un document de 90 pages, corps de 76. Il ne décrivait plus le mémoire actuel.

---

## 1. Conformité au plan de rédaction

| # | Contrôle | État | Preuve mesurée |
|---|---|:---:|---|
| 1.1 | Les 8 chapitres du modèle, dans l'ordre | ✅ | 8 titres de niveau 1, plus introduction et conclusion |
| 1.2 | Les sections ajoutées d'après le plan de l'école | ✅ | Ch. 1 § 1.5 · Ch. 2 §§ 2.1 et 2.6 · Ch. 3 §§ 3.4 et 3.7 |
| 1.3 | Introduction générale complète | ✅ | 7 paragraphes : accroche, contexte, constats, problématique, objectifs, démarche, plan |
| 1.4 | Conclusion en cinq parties, plus mot de fin | ✅ | 17 paragraphes |
| 1.5 | Pages liminaires complètes | ✅ | Page de garde, dédicace, remerciements, résumé, abstract, sommaire, 2 listes, sigles |
| 1.6 | Résumé et abstract entre 150 et 200 mots | ✅ | **199** et **175** mots, comptés sur le document. Tous deux sur la même page |
| 1.7 | Cinq mots-clés de chaque côté | ✅ | 5 mots-clés · 5 keywords. Conservés contre la version de Verdi qui les supprimait — D-34 |
| 1.8 | ~~Annexes A à F~~ | — | Retirées le 18 août pour tenir le plafond — D-19. Chacune a sa contrepartie dans le corps ou un inventaire |

## 2. Contraintes de forme de l'école

| # | Contrôle | État | Preuve mesurée |
|---|---|:---:|---|
| 2.1 | Corps entre 75 et 90 pages | ✅ | **84 pages**, comptées sur le PDF. Six pages sous le plafond de l'école |
| 2.1bis | Consigne du promoteur : 70 à 85 | ⚠️ | **84** — marge d'une seule page. À faire confirmer par le promoteur : la limite vise-t-elle le corps ou le document entier ? |
| 2.2 | Times New Roman 12, interligne 1,25, justifié | ✅ | Style Normal du document |
| 2.3 | Marges 1,5 partout, reliure gauche 1,5 | ✅ | Les 4 sections Word portent les mêmes marges |
| 2.4 | Titres 16 / 14 / 12, légendes 11 italique | ✅ | 23 Titre 1 · 61 Titre 2 · 2 Titre 3 · styles Légende et Légende tableau |
| 2.5 | En-tête et pied de page | ✅ | « Mémoire de Fin de Cycle — GLA — CFI-CIRAS » · numéro centré, année à droite |
| 2.6 | Pagination en trois parties | ✅ | **i→viii**, **1→84**, **A→E**, vérifiée **case par case** sur les 98 pages |
| 2.6bis | Aucune page vide ni page à contenu résiduel | ✅ | Contrôle en-tête et pied exclus : aucune |
| 2.7 | Au plus 2 descriptions textuelles de cas d'utilisation | ✅ | **2** — UC43 et UC48, § 6.9 |
| 2.8 | Au plus 3 diagrammes de séquence système | ✅ | **2** — figures 6.7 et 6.8 |
| 2.9 | Au plus 3 diagrammes d'activité au chapitre 6 | ✅ | **0** — l'unique diagramme d'activité est la figure 5.1 |
| 2.10 | Bibliographie : 8 à 10 références minimum | ✅ | **9 en bibliographie**, 2 en webographie. **Reste à les lire** — É-18 |

## 3. Fidélité au code et aux sources

| # | Contrôle | État | Preuve mesurée |
|---|---|:---:|---|
| 3.1 | Les 8 inventaires sont extraits de leur source | ✅ | 7 du code, 1 du recueil de l'existant |
| 3.2 | Les besoins exprimés sont confrontés à la couverture réelle | ✅ | 18 besoins · 6 couverts · 4 partiels · 8 hors périmètre · **0 non couvert dans le périmètre** |
| 3.3 | Chaque exclusion de périmètre est motivée | ✅ | Ch. 3 § 3.6 · `perimetre_et_hors_perimetre.md` |
| 3.4 | Les chiffres du mémoire correspondent aux inventaires | ✅ | Relevés dans le document : 273 routes · 88 entités · 97 associations · 29 classes · 59 écartées · 130 permissions · 41 migrations · 52 synchronisées · 93 500 lignes · 547 fichiers |
| 3.5 | Les différences web / API / bureau sont explicites | ✅ | Ch. 8 § 8.3 |
| 3.6 | Les sources ne sont jamais confondues | ✅ | Le recueil de l'existant fait autorité sur le terrain médical, le rapport de stage sur le volet informatique. Substitution refusée — D-36 |
| 3.7 | Aucun écart avec le code n'a été effacé | ✅ | Matrice d'alignement |

## 4. Honnêteté

| # | Contrôle | État | Preuve mesurée |
|---|---|:---:|---|
| 4.1 | Aucun résultat de test affirmé sans preuve | ✅ | « Cent trois cas exécutés le 10 août 2026 », cité 3 fois de façon identique. Aucune couverture de code annoncée |
| 4.2 | Les sources absentes sont signalées, pas comblées | ✅ | Infrastructure réseau, effectifs, volumes d'activité : tous déclarés non établis |
| 4.3 | Aucune référence bibliographique inventée | ✅ | 11 références, toutes réelles |
| 4.4 | Aucun entretien, chiffre ou capture inventés | ✅ | Interlocuteurs désignés par leur fonction, faute d'autorisation de citation |
| 4.5 | Les limites sont énoncées | ✅ | Conclusion : validation partielle, cœur clinique non testé, règle d'éligibilité non couverte, mode autonome non éprouvé, signature de code inactive |
| 4.6 | Le rôle du stage de Verdi est formulé sans approximation | ✅ | Introduction · Ch. 5 § 5.1 · page de garde |
| 4.7 | Le statut réel du système n'est jamais surévalué | ✅ | « conçu et développé », jamais « déployé et utilisé ». La phrase qui pose la règle est la seule occurrence |
| 4.8 | Aucune fonction partielle présentée comme achevée | ✅ | BF23 marqué partiel · signature de code marquée non active |

## 5. Sécurité et confidentialité

| # | Contrôle | État | Preuve mesurée |
|---|---|:---:|---|
| 5.1 | Aucun mot de passe, clé ou jeton en clair | ✅ | Recherche automatique : 0 occurrence |
| 5.2 | Aucune chaîne de connexion ni nom d'hôte de production | ✅ | 0 |
| 5.3 | Aucune donnée patient réelle | ✅ | Jeu de démonstration uniquement |
| 5.4 | L'extrait de code est contrôlé sur ces points | ✅ | Extrait unique du ch. 8, fonction de résolution de conflit |
| 5.5 | Le protocole de captures impose l'anonymisation | ✅ | `06_interfaces/protocole_captures.md` |

## 6. Vocabulaire

| # | Contrôle | État | Preuve mesurée |
|---|---|:---:|---|
| 6.1 | Aucun `SGCDM` | ✅ | 0 occurrence |
| 6.2 | Aucun `Brazzaville`, aucun `Pointe-Noire` | ✅ | 0 et 0 |
| 6.3 | « Centre Médico-**Sanitaire** », jamais « Social » | ✅ | Les 3 « Médico-Social » désignent le **Service** Médico-Social, qui porte bien ce nom |
| 6.4 | Aucune notion de priorité au triage, sauf pour la nier | ✅ | — |
| 6.5 | Ordonnance et bon jamais confondus | ✅ | Distinction posée au § 3.3 et rappelée au § 6.9 |
| 6.6 | Verrou et rideau de confidentialité jamais confondus | ✅ | — |
| 6.7 | `MEDECIN` n'est jamais présenté comme un rôle | ✅ | § 6.4 : « il n'existe pas de rôle médecin dans le système » |
| 6.8 | Tout terme employé est défini | ✅ | Tableau 3.7 · liste des sigles à 25 entrées, tous employés dans le texte |

## 7. Écriture

| # | Contrôle | État | Preuve mesurée |
|---|---|:---:|---|
| 7.1 | Français simple et lisible | ✅ | **15,5 mots** par phrase en moyenne, médiane 14, seulement 2,7 % de phrases au-delà de 35 mots |
| 7.2 | Le vocabulaire technique est présent et défini | ✅ | 10 sigles techniques employés et développés à leur première apparition — D-32 |
| 7.3 | Les auteurs sont présents dans le texte | ✅ | **142 emplois** de « nous / notre / nos », soit 6,07 pour 1000 mots. Le mémoire de référence NGATSE est à 5,64 — D-35 |
| 7.4 | Les faits mesurés restent impersonnels | ✅ | Aucun chiffre n'est attribué à « nous » |

## 8. Figures et tableaux

| # | Contrôle | État | Preuve mesurée |
|---|---|:---:|---|
| 8.1 | Chaque figure dispose de sa fiche de dessin | ✅ | 24 figures, fiches dans `05_fiches_de_dessin/` |
| 8.2 | Numérotation séquentielle, sans exception | ✅ | Figures 1.1 à 8.5 · tableaux 1.1 à 8.4 |
| 8.3 | Chaque figure a son emplacement réservé | ✅ | 24 légendes, 24 emplacements |
| 8.4 | **Les figures sont tracées et collées** | ❌ | **0 sur 24.** Les seules images du fichier sont les logos de la page de garde |
| 8.5 | **Les captures d'écran sont produites** | ❌ | **0 sur 3** — protocole prêt |
| 8.6 | **Les listes automatiques sont à jour** | ❌ | Elles affichent **15 figures et 42 tableaux** au lieu de 24 et 58. Se corrige par **Ctrl+A puis F9**, après collage des images |

## 9. Traçabilité

| # | Contrôle | État |
|---|---|:---:|
| 9.1 | La chaîne besoin → règle → cas d'utilisation → écran → route → entité → permission → test est établie | ✅ |
| 9.2 | La traçabilité ascendante vers le terrain est établie | ✅ |
| 9.3 | Les décisions de rédaction sont consignées | ✅ 36 décisions, D-01 à D-36 |
| 9.4 | Le dossier de travail reflète le document Word | ✅ 271 paragraphes du mémoire, **0 absent** du dossier — régénéré le 28 août |

---

## Synthèse

| Catégorie | ✅ | ⚠️ | ❌ |
|---|---:|---:|---:|
| Plan de rédaction | 7 | 0 | 0 |
| Forme | 12 | 1 | 0 |
| Fidélité aux sources | 7 | 0 | 0 |
| Honnêteté | 8 | 0 | 0 |
| Sécurité | 5 | 0 | 0 |
| Vocabulaire | 8 | 0 | 0 |
| Écriture | 4 | 0 | 0 |
| Figures et tableaux | 3 | 0 | 3 |
| Traçabilité | 4 | 0 | 0 |
| **Total** | **58** | **1** | **3** |

**Légende** : ✅ conforme · ⚠️ à confirmer · ❌ action requise

---

## Ce qui reste à faire

| # | Point | Qui | Effort |
|---|---|---|---|
| 8.4 | Tracer les **20 diagrammes** — fiches prêtes dans `05_fiches_de_dessin/` | Les auteurs | plusieurs séances |
| 8.5 | Produire les **3 captures** — protocole dans `06_interfaces/` | Les auteurs | une demi-journée |
| 8.6 | Coller les 23 images, puis **Ctrl+A** et **F9** quatre fois | Les auteurs | une heure |
| 2.1bis | Demander au promoteur si la limite de 70-85 pages vise le corps ou le document entier | Les auteurs | un message |
| 2.10 | Lire les 11 références citées | Les auteurs | — |
| — | Remplir les **8 mentions « ▪ (nom) »** de la dédicace | Les auteurs | quelques minutes |

**Les trois non-conformités portent toutes sur le même point : les images ne sont pas collées.** C'est le dernier verrou avant la remise, et il ne dépend que des auteurs. Tout le reste du document est conforme et mesuré.
