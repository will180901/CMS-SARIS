# Registre des décisions documentaires

> Décisions prises pour la rédaction du mémoire. Chacune porte son motif et sa conséquence.
> Une décision n'est pas un fait sur le produit : c'est un choix de documentation, révisable par l'auteur ou le promoteur.

---

## D-01 — Le plan officiel de l'école fixe la forme, le modèle Word fixe la structure

**Décision** : la structure des chapitres vient du modèle Word ; les contraintes de forme (volume, typographie, pagination, plafonds de diagrammes) viennent du plan officiel de l'école. Ce que le plan de l'école exige en plus est **ajouté** au plan du modèle Word.
**Motif** : les deux documents divergent sur neuf points. Ignorer le plan de l'école exposait à un refus sur la forme ; ignorer le modèle Word privait le mémoire de ses sections les plus valorisantes.
**Conséquence** : voir `matrice_alignement.md` § 4.

## D-02 — Le code fait foi

**Décision** : lorsqu'un document du projet et le code divergent, le mémoire décrit le **code**, et l'écart est consigné.
**Motif** : le mémoire décrit un système réalisé, pas un système souhaité. Un jury peut ouvrir le code.
**Conséquence** : trois écarts majeurs arbitrés en faveur du code (décisions médicales, permissions, routes).

## D-03 — Vocabulaire verrouillé

**Décision** : « Centre Médico-**Sanitaire** », sites **Moutela** et **Nkayi**, système nommé **CMS SARIS**. Les termes `SGCDM`, `Brazzaville`, `Pointe-Noire`, « Centre Médico-Social » sont interdits.
**Motif** : le modèle académique est construit autour d'exemples d'un autre projet. Les recopier serait une faute grossière. Le sigle retenu est celui du modèle de mémoire, choix de l'auteur.
**Conséquence** : contrôle de vocabulaire en revue finale.

## D-04 — Production dans un dossier neuf, et retrait de la documentation antérieure

**Décision initiale** : la documentation est produite dans `Docs/CMS/memoire/`, sans toucher à l'existant.

**Décision révisée le 2026-08-10, sur instruction des auteurs** : la documentation antérieure — le cahier de charge produit **avant** le développement — est **écartée comme source, puis retirée du dépôt**.

**Motif** : elle a été produite avant la réalisation ; beaucoup de choses ont ensuite été réadaptées puis modifiées. Trois divergences le confirment — 87 entités contre 88, 110 permissions contre 128, 4 décisions médicales contre 2. La maintenir produirait des contradictions avec le code.

**Conséquence de méthode** : deux sources font désormais autorité — le **code** sur ce qui est livré, le **recueil de l'existant** sur le besoin. Aucun document du dossier ne s'appuie plus sur la documentation antérieure ; les faits qui en provenaient ont été re-sourcés.

**Réversibilité** : les 51 fichiers concernés sont suivis par le dépôt et restent récupérables dans son historique.

## D-05 — Aucun code de diagramme

**Décision** : les figures ne sont pas générées. Chaque figure reçoit une **fiche de dessin** exploitable à la main.
**Motif** : choix explicite de l'auteur, qui trace lui-même ses diagrammes.
**Conséquence** : les fiches doivent être assez précises pour être tracées sans revenir au code — huit blocs obligatoires, dont un tableau exhaustif des liens avec cardinalités.

## D-06 — Numérotation séquentielle des figures

**Décision** : `Figure <chapitre>.<ordre d'apparition>`, sans exception. La numérotation irrégulière du modèle Word (`Figure 7.3ter.1`, `Figure 7.3quater.1`) est corrigée.
**Motif** : une numérotation non séquentielle rend la liste des figures illisible et complique les renvois.
**Conséquence** : écart MA-06, à signaler au promoteur.

## D-07 — Sélection d'un noyau pour le diagramme de classes

**Décision** : le diagramme de classes retient **27 classes** sur 88, sélectionnées sur deux critères explicites : degré de connexion supérieur ou égal à 2 dans les domaines clinique, acteurs et référentiels ; plus deux exceptions justifiées par leur poids métier (`ConstanteVitale` et `DroitCategoriePatient`).
**Motif** : une planche de 88 classes est illisible imprimée en A4. Le critère doit être **énoncé** dans le mémoire, sinon la sélection paraît arbitraire.
**Conséquence** : 34 associations à tracer ; les 61 autres modèles vont au dictionnaire de données (annexe D).

## D-08 — Diagramme de déploiement au chapitre 7

**Décision** : le diagramme de déploiement figure au chapitre 7, conformément au modèle Word, bien que le plan de l'école le place au chapitre 8.
**Motif** : cohérence avec la structure retenue en D-01.
**Conséquence** : écart MA-04, consigné.

## D-09 — Exactement deux descriptions textuelles de cas d'utilisation

**Décision** : deux descriptions textuelles complètes dans le corps (plafond de l'école), les autres en annexe C. Les fiches de spécification, plus courtes, restent au nombre de trois à cinq (modèle Word).
**Motif** : le plan de l'école dit « au plus 2 », le modèle Word « au moins 2 ». Deux satisfait les deux.
**Cas d'utilisation retenus** : la consultation avec décision, et l'émission d'un bon de pharmacie — ce dernier portant la règle métier la plus structurante.

## D-10 — Les chapitres bloqués sont livrés en squelette, pas comblés

**Décision** : les sections dépendant du recueil absent reçoivent leur plan, leurs transitions et un bloc `⛔ EN ATTENTE DE SOURCE` renvoyant à une question ouverte. Aucun texte générique de remplissage.
**Motif** : combler un trou par du plausible est exactement ce qu'un jury détecte. Un squelette honnête est défendable ; une invention ne l'est pas.
**Conséquence** : ≈ 24 pages visiblement en attente, et un compteur au tableau de bord.

## D-11 — Aucun résultat de test n'est affirmé

**Décision** : le tableau des tests porte `prévu — non exécuté` partout, tant qu'aucune campagne réelle n'a produit de sortie console.
**Motif** : les dépendances ne sont pas installées et l'environnement d'intégration n'est pas actif. Inventer un résultat serait une faute grave, vérifiable en trente secondes par un jury.

## D-12 — Le stage est attribué à son auteur réel

**Décision** : le stage à la SARIS est attribué à **Nzila Verdi Oscarvie**. L'application est présentée comme la réalisation **commune** des deux auteurs. Aucune formulation ne laisse entendre que Bouwayi Mikouya Déo Cherel a effectué ce stage.
**Motif** : exigence explicite de l'auteur, et honnêteté élémentaire.
**Conséquence** : la règle s'applique aussi à la page de garde, aux remerciements et au chapitre 5.

## D-13 — Deux mécanismes hors-ligne, décrits séparément

**Décision** : le mémoire décrit **deux** mécanismes hors-ligne distincts — la file de mutations rejouées côté web, et la synchronisation par deltas du poste autonome.
**Motif** : découverte de l'analyse du code. Les présenter comme un seul serait une erreur factuelle.
**Conséquence** : INV-05 §§ 5 et 6 ; chapitre 7 ; deux fiches de dessin.

## D-14 — Les limites sont énoncées, pas dissimulées

**Décision** : figurent explicitement au mémoire — l'absence de test sur le cœur clinique, les deux suites de test orphelines, la validation d'exécution du mode autonome restant à faire, la signature de code non active, les cinq machines à états non garanties par la base, la double déclaration des permissions côté web.
**Motif** : un mémoire qui présente un système sans défaut est suspect. Un mémoire qui identifie ses propres limites démontre une maîtrise supérieure.

## D-15 — Le certificat de repos est documenté avec réserve

**Décision** : le certificat médical est décrit comme `IMPLÉMENTÉ` pour le certificat de repos, et son périmètre plus large marqué `À CONFIRMER`.
**Motif** : le glossaire du projet signale lui-même cette incertitude.
