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
> ⚠️ **Partiellement annulée le 30 août par D-43.** Le nom « CMS SARIS » n'a jamais été introduit dans le Word : relevé fait, **zéro occurrence**. Le mémoire dit « le système ». Les interdictions de cette décision — SGCDM, Brazzaville, Pointe-Noire, Centre Médico-Social — restent en vigueur et sont respectées ; seule la prescription du nom tombe.

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

**Décision** : le diagramme de classes retient **29 classes** sur 88, sélectionnées sur deux critères explicites : degré de connexion supérieur ou égal à 2 dans les domaines clinique, acteurs et référentiels ; plus deux exceptions justifiées par leur poids métier (`ConstanteVitale` et `DroitCategoriePatient`).
**Motif** : une planche de 88 classes est illisible imprimée en A4. Le critère doit être **énoncé** dans le mémoire, sinon la sélection paraît arbitraire.
**Conséquence** : 38 associations à tracer ; les **59** autres modèles sont décrits dans INV-02 § 4.
**Correction du 19 août 2026** : cette décision annonçait 27 classes et 61 modèles écartés. La fiche `UML-CLS-01` les énumère de C01 à C29. Le compte exact est **29 retenues, 59 écartées**.

## D-08 — Diagramme de déploiement au chapitre 7

**Décision** : le diagramme de déploiement figure au chapitre 7, conformément au modèle Word, bien que le plan de l'école le place au chapitre 8.
**Motif** : cohérence avec la structure retenue en D-01.
**Conséquence** : écart MA-04, consigné.

## D-09 — Exactement deux descriptions textuelles de cas d'utilisation

**Décision** : deux descriptions textuelles complètes dans le corps — § 6.8 — conformément au plafond de l'école. Trois fiches de spécification en tableau, plus courtes, au § 6.7.
**Mise à jour du 19 août 2026** : les autres cas devaient aller en annexe C ; les annexes ayant été retirées, ils ne sont plus détaillés. Le tableau 6.5 les recense par module, ce qui suffit au périmètre annoncé.
**Motif** : le plan de l'école dit « au plus 2 », le modèle Word « au moins 2 ». Deux satisfait les deux.
**Cas d'utilisation retenus** : la consultation avec décision, et l'émission d'un bon de pharmacie — ce dernier portant la règle métier la plus structurante.

## D-10 — Les chapitres bloqués sont livrés en squelette, pas comblés

**Décision** : les sections dépendant du recueil absent reçoivent leur plan, leurs transitions et un bloc `⛔ EN ATTENTE DE SOURCE` renvoyant à une question ouverte. Aucun texte générique de remplissage.
**Motif** : combler un trou par du plausible est exactement ce qu'un jury détecte. Un squelette honnête est défendable ; une invention ne l'est pas.
**Conséquence** : à l'issue de la rédaction, il ne reste que trois sections en attente de source — QO-02bis, QO-03 et QO-04.

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

---

# Décisions de la refonte — août 2026

> Le mémoire faisait **214 pages** après la première rédaction. Le plafond annoncé était de 120 pages, puis ramené à **70-85**. Les décisions D-16 à D-25 ont d'abord ramené le document à 90 pages dont 76 de corps. Les décisions D-26 à D-30, prises les 22 et 24 août 2026, l'ont porté à 98 pages dont 84 de corps. Les décisions D-33 à D-36, prises le 28 août après la relecture de NZILA Oscarvie Verdi, ont maintenu ce volume : **98 pages dont 84 de corps**.

## D-16 — Le mémoire de référence devient un modèle de rédaction

**Décision** : la réécriture suit la manière de `Doc_Soutenance_Fin_OYERE.docx`, mémoire noté 18 sur 20 — français simple, phrases courtes, connecteurs explicites, aucune section qui commente sa propre méthode.
**Motif** : un modèle noté 18 prouve ce que le jury attend mieux qu'une consigne écrite.
**Conséquence** : suppression des sections « Introduction du chapitre » et « Récapitulatif de l'état », qui doublaient le texte sans rien apporter.

## D-17 — Le document Word devient la source de vérité du contenu

**Décision** : à partir de la refonte, `Memoire_CMS_SARIS.docx` fait foi sur ce que dit le mémoire. Les fichiers de rédaction en sont le reflet, pas l'inverse.
**Motif** : deux sources qui se prétendent maîtresses divergent toujours.
**Conséquence** : les inventaires conservent leur autorité sur les **chiffres** ; le Word l'a sur le **texte**. Une divergence entre les deux est un écart à instruire.

## D-18 — Vingt-quatre illustrations ramenées à quinze

**Décision** : onze figures retirées — infrastructure réseau, relations entre cas, séquence de connexion, activité du parcours outillé, deux séquences objets, communication, et les cinq maquettes d'interface.
**Motif** : chaque figure occupe une page entière ; onze figures valaient onze pages. Toutes les figures retirées étaient soit redondantes avec un tableau, soit sans source, soit supplantées par une capture du système réel.
**Conséquence** : renumérotation de six figures. Fiches archivées avec leur motif dans `99_archive/`.

## D-19 — Les annexes sont retirées

**Décision** : les six annexes sortent du mémoire.
**Motif** : chacune avait déjà sa contrepartie dans le corps ou dans un inventaire — le registre des besoins est le tableau 6.1, le glossaire le tableau 3.7, le dictionnaire de données l'inventaire INV-02.
**Conséquence** : le mot « annexe » n'apparaît plus une seule fois dans le mémoire. Les six fichiers sont archivés.

## D-20 — Chaque figure occupe une page entière, seule

**Décision** : emplacement réservé par un saut de page avant et après la légende.
**Motif** : exigence explicite de l'auteur, et lisibilité des diagrammes UML denses.
**Conséquence** : 15 pages sur 76 sont des pages d'illustration. C'est le poste de volume le plus lourd, et le plus visible.

## D-21 — Trois maquettes remplacées par trois captures du système réel

**Décision** : les cinq maquettes d'interface disparaissent ; trois captures d'écran les remplacent — consultation en cours, émission d'un bon de pharmacie avec contrôle d'éligibilité, tableau de bord et journal d'audit.
**Motif** : une maquette montre ce qu'on projetait, une capture montre ce qui existe. Devant un jury, la seconde vaut mieux.
**Conséquence** : protocole de captures réécrit.

## D-22 — La critique de l'existant est regroupée au chapitre 5

**Décision** : la critique formelle, dispersée sur trois chapitres, est rassemblée au § 5.4. Le chapitre 2 ne garde que de brefs « premiers constats ».
**Motif** : le plan de l'école attend la critique formelle au chapitre d'étude de l'existant. La répétition sur trois chapitres était le premier poste de gonflement du document.

## D-23 — Le saut de page est porté par le style du titre

**Décision** : chaque titre de niveau 1 porte la propriété « saut de page avant », au lieu de sauts insérés à la main.
**Motif** : les sauts manuels se déplacent dès qu'un paragraphe change de longueur. Cinq chapitres démarraient au milieu d'une page, dont le chapitre 8 en bas de page.
**Conséquence** : la règle tiendra quand les 15 images seront collées.

## D-24 — Pagination en trois parties

**Décision** : chiffres romains **i à viii** pour les liminaires, chiffres arabes **1 à 76** pour le corps, lettres **A à E** pour la bibliographie et la table des matières.
**Motif** : exigence de l'école, contrôle 2.6 de la checklist. Elle isole surtout les 76 pages que le jury compte réellement.

## D-25 — Le thème tronqué de la page de garde est corrigé

**Décision** : les mots « DE LA SARIS » ont été rétablis à la fin du thème, le 19 août 2026.
**Motif** : le thème s'arrêtait à « (CMS) ». C'est la première ligne que lit le jury.
**Conséquence** : seule modification jamais apportée à la page de garde. Mise en forme inchangée.

## D-26 — Le français du document entier est simplifié

**Décision** : tout le texte est réécrit en français simple — phrases courtes, une idée par phrase, vocabulaire courant, connecteurs explicites.
**Motif** : l'auteur avait du mal à se relire dans le français savant de la première version. Un mémoire qu'on ne peut pas défendre à l'oral ne sert à rien.
**Conséquence** : aucune information retirée. Le sens est identique, la forme est plus directe.

## D-27 — Les paragraphes sont fusionnés à contenu constant

**Décision** : les paragraphes trop découpés sont regroupés, sans couper une seule phrase.
**Motif** : chaque paragraphe coûte environ 15 points de hauteur — 6 points d'espacement plus une demi-ligne perdue. Deux cent trente paragraphes de trop valaient près de sept pages.
**Conséquence** : 273 paragraphes, d'une longueur médiane de 62 mots, très proche de la version d'origine. Un plafond de 95 mots et une règle qui interdit la fusion devant un paragraphe annonçant une idée neuve empêchent les recollages abusifs.

## D-28 — Les outils techniques sont nommés en clair

**Décision** : le mémoire nomme chaque outil de la chaîne — TypeScript, NestJS, Prisma, PostgreSQL, SQLite, React, Vite, Electron, Trae, Git, draw.io, Render, Neon, entre autres — et donne pour chacun son importance et son cas d'usage dans le projet.
**Motif** : la simplification du français avait effacé le vocabulaire technique. Un jury de génie logiciel attend ce vocabulaire.
**Conséquence** : le tableau des outils du chapitre 8 gagne deux colonnes.

## D-29 — Les cas d'utilisation et les classes sont découpés par package

**Décision** : à l'exemple du mémoire de référence de NGATSE et KUBEMBULA, les 65 cas d'utilisation sont répartis sur cinq planches et les 29 classes sur quatre planches, plus une planche globale.
**Motif** : un diagramme unique de 65 cas ou de 29 classes est illisible en A4. Le découpage par package est la pratique attendue et rend chaque planche défendable.
**Conséquence** : le mémoire passe de 15 à **23 illustrations**, portées à **24** le 29 août par le découpage de la figure 5.1 — décision D-37. Les neuf planches de package occupent une demi-page chacune, deux par page.

## D-30 — Le tableau 4.2 est ramené de neuf à sept diagrammes

**Décision** : le 24 août 2026, les lignes « Séquence objets » et « Communication » sont retirées du tableau 4.2, et la ligne « Activité » ramenée au seul chapitre 5.
**Motif** : le tableau annonçait neuf diagrammes UML alors que le mémoire n'en livre que sept. Un jury qui compte les figures trouve la contradiction en deux minutes.
**Conséquence** : le paragraphe suivant justifie désormais **quatre** exclusions au lieu de deux — états-transitions, paquetages, séquence objets, communication. Aucun coût en pages : le document reste à 98 pages dont 84 de corps.

## D-31 — Les 59 entités écartées sont chiffrées par domaine

**Décision** : le chapitre 7 donne la répartition exacte des 59 entités absentes du diagramme de classes — 13 sécurité et audit, 11 satellites du dossier patient, 8 synchronisation, 7 messagerie, 7 gestion du personnel, 7 suivis du parcours de soin, 6 référentiels secondaires.
**Motif** : « et les 59 autres ? » est la première question qu'un jury pose devant un diagramme qui ne montre que 29 classes sur 88. Un chiffre par domaine y répond en une phrase.
**Conséquence** : la phrase précédente était **fausse** et a été retirée. Elle affirmait que les 59 relevaient de « domaines techniques ou transverses », alors que 11 sont des satellites du dossier patient et 7 des suivis de soin, donc du métier pur. Les sept nombres proviennent d'une différence d'ensembles entre les 88 modèles du § 7 de `INV-02` et les 29 classes retenues.

## D-32 — Les sigles techniques rentrent dans le texte

**Décision** : dix sigles sont introduits dans le corps, chacun développé à sa première apparition — API, REST, HTTP, JSON, JWT, SQL, ORM, SSE, IPC, PWA — puis ajoutés à la liste des abréviations, qui passe de 15 à 25 entrées.
**Motif** : la simplification du français (D-26) avait paraphrasé tous les sigles techniques. Le mémoire écrivait « interface de programmation » six fois au lieu d'API et « jeton signé » au lieu de JWT. Un jury de génie logiciel attend ce vocabulaire, et son absence laisse croire que les auteurs ne le maîtrisent pas.
**Conséquence** : deux règles s'appliquent désormais. **Un sigle n'entre dans la liste que s'il est employé dans le texte** — vérification faite, les 25 le sont, BF, BNF et UC sous forme préfixée. Et **chaque sigle est justifié par le code**, avec son relevé consigné dans `01_preliminaires/sigles_et_abreviations.md`. SGBD et IHM ont été refusés à ce titre : ce sont des sigles d'école, absents du projet. Aucun coût en pages : la page des sigles est liminaire, et elle n'occupe que 28 lignes sur environ 40.

## D-33 — La version relue par Verdi ne devient pas la base de travail

**Décision** : `Memoire_CMS_SARIS.docx` reste le document unique. Les corrections de `Memoire_CMS_SARIS_version_modifié_par_verdi_mon binôme.docx` y sont versées une par une, jamais l'inverse.
**Motif** : Verdi a relu une copie antérieure au 24 août. Sa version ignore la correction du tableau 4.2, le découpage par package, la répartition chiffrée des 59 entités et les dix sigles techniques. Repartir de son fichier ferait revenir deux erreurs de fond déjà corrigées.
**Conséquence** : comparaison complète consignée dans `11_revue_finale/COMPARAISON_VERSION_VERDI.md` — 536 blocs contre 512, taux d'identité de 77,8 %. Ce qui est refusé l'est avec un motif écrit, pour que Verdi ne recommence pas.

## D-34 — Les pages liminaires sont reprises mot pour mot de la version de Verdi

**Décision** : dédicace, remerciements, résumé, abstract et introduction générale reprennent son texte à l'identique, sur demande explicite de l'auteur.
**Motif** : ces pages relèvent des deux auteurs à parts égales. Le fond y compte moins que l'accord entre eux.
**Conséquence** : trois réserves. Les **mots-clés et keywords ont été conservés** contre sa version, car le contrôle 1.7 de la checklist les exige. La **mise en page reste la nôtre** : son style « Sans interligne » aurait rompu l'interligne du document. Et son introduction annonçait « trois constats » en n'en donnant que deux — la phrase manquante sur l'échec des deux outils tableur a été rétablie à l'identique. Huit mentions « ▪ (nom) » restent à remplir dans la dédicace.

## D-35 — Le mémoire est écrit à la première personne du pluriel

**Décision** : le corps entier passe au « nous », de l'introduction à la conclusion générale. 178 réécritures.
**Motif** : Verdi a relevé que le document ne disait jamais « nous ». Mesure faite : **9 emplois dans tout le corps, dont 8 dans la seule conclusion**. Les huit chapitres n'en contenaient aucun. Les deux mémoires de référence en comptent bien davantage — OYERE 2,12 pour 1000 mots, NGATSE 5,64, contre 0,38 chez nous.
**Conséquence** : **142 emplois, soit 6,07 pour 1000**. Deux limites posées. Les **faits mesurés restent impersonnels** — « le système expose 273 routes », jamais « nous avons compté 273 routes » : un chiffre s'affirme, il ne s'attribue pas. Et les **14 sections purement descriptives** — présentation de SARIS-CONGO, Processus Unifié, processus de consultation antérieur, catégories de patients — restent sans « nous », car ce ne sont pas nos décisions.
**Coût** : la première passe est montée à 101 pages, avec trois pages presque vides. Vingt-sept resserrements, sans perte d'information, ont ramené le document à **98 pages dont 84 de corps**.

## D-36 — La substitution « rapport de stage » → « recueil de l'existant » est refusée

**Décision** : le mémoire continue de citer le **rapport de stage** aux trois endroits où il le fait.
**Motif** : ce sont deux sources distinctes, et `sources_et_statut_des_preuves.md` le dit. Le recueil de l'existant fait autorité sur le besoin et le terrain médical ; le rapport de stage est la source de l'organisation informatique, du parc matériel et des applications en production. Faire la substitution attribuerait au recueil des faits qu'il ne contient pas.
**Conséquence** : correction proposée par Verdi, examinée, refusée avec motif. Une phrase d'attribution supprimée par erreur au chapitre 1 lors du resserrement a été rétablie : « Le rapport de stage apporte ici une précision qui compte. »

## D-37 — La figure d'activité est scindée en deux planches

**Décision** : la figure 5.1 devient **deux figures** — 5.1 « triage et recueil clinique » et 5.2 « consultation, décision et clôture ». Le mémoire passe à **24 figures**.
**Motif** : mesure faite sur les marges réelles du document. La place utile pour une image est de **16,5 × 25,1 cm**. La planche unique mesurait 1840 points de large : réduite à cette largeur, sa police de 11 tombait à **3,7 pt sur papier**, soit illisible. Le seuil d'impression est de 8 pt.
**Conséquence** : une règle de production s'applique désormais à toutes les figures — **canevas de 770 × 1170 points au plus, police 14 au minimum**, ce qui donne 8,5 pt à l'impression. Concrètement, jamais plus de trois boîtes côte à côte. Les figures 1.1, 4.1 et 6.1, déjà produites, étaient elles aussi illisibles — respectivement 2,5, 3,0 et 2,3 pt — et ont été refaites au même gabarit.
*Corrigé le 29 août : le gabarit initial de 660 × 1000 en police 12 a été porté à 770 × 1170 en police 14, les figures étant trop confinées à la première mesure.*

## D-38 — Aucun trait ne traverse un encadré

**Décision** : sur toute figure, les liens qui partent d'une même forme vers une colonne d'autres formes descendent dans une **gouttière verticale vide**, puis rejoignent chaque destinataire par un court trait horizontal. Aucune forme ne se pose dans cette gouttière.
**Motif** : sur la première version de la figure 1.1, les six traits du CMS vers les pôles traversaient l'encadré des attributions. Un trait qui coupe une boîte fait croire à un lien qui n'existe pas.
**Conséquence** : trois contrôles automatiques s'ajoutent avant chaque livraison — reconstitution du trajet de chaque lien segment par segment, exclusion des conteneurs qui sont faits pour être traversés, et **rendu de la figure en image que je regarde avant de livrer**. Les commentaires et les encadrés d'attributions se placent désormais dans une colonne propre, jamais entre un parent et ses enfants.

## D-39 — Les planches de cas d'utilisation gardent les ovales regroupés, et sortent ceux qui portent une relation

**Décision** : sur les cinq planches 6.2 à 6.6, un ovale représente un **groupe de cas** — sauf lorsqu'un cas figure au tableau 6.11 ou 6.12, auquel cas il reçoit son propre ovale pour que la relation soit traçable.
**Motif** : la fiche `UML-UC-01` demandait à la fois de regrouper et de tracer les relations. Or les cas porteurs de relations — UC02, UC03, UC04, UC07 — sont précisément absorbés dans les regroupements. Les deux consignes ne pouvaient pas être tenues ensemble.

**Précision du 29 août, tirée de la figure 6.5.** La règle ne dit pas « tout cas porteur de relation reçoit son ovale ». Elle dit : **on scinde quand les deux bouts de la flèche tomberaient dans le même ovale**, car la flèche serait alors invisible. C'est le cas sur la 6.2, où UC02 étend UC01 et où les deux étaient dans « Se connecter ». Sur la 6.5, les cinq relations relient à chaque fois deux groupes **différents** : elles se tracent sans rien scinder, et la planche tient en huit ovales au lieu de quinze. Pour lever le dernier doute — une flèche qui touche un groupe entier laisse croire que tous ses cas y participent — **chaque flèche porte sur son étiquette le couple de cas exact** : `«extend» UC50→UC48`, et non le seul stéréotype.
**Amendement du 29 août — on ne regroupe que si la planche ne tient pas autrement.** Le regroupement a un coût caché : le libellé du groupe **n'existe nulle part dans le mémoire**, et le lecteur ne peut plus refaire la correspondance avec le tableau. On ne le paie donc que lorsqu'il est nécessaire.

| Figure | Cas | Représentation |
|---|---:|---|
| 6.2 | 16 | regroupée — seize ovales ne tiennent pas au gabarit |
| 6.3 | 8 | **un ovale par cas, libellés exacts du tableau 6.7** |
| 6.4 | 9 | un ovale par cas, libellés exacts du tableau 6.8 |
| 6.5 | 20 | regroupée |
| 6.6 | 12 | regroupée |

Sur les trois planches regroupées, **la note porte la liste des cas couverts par chaque ovale**, pour que la correspondance reste vérifiable.

**Conséquence** : la figure 6.2 porte **dix ovales** au lieu de cinq — les groupes, plus `Accepter les conditions d'utilisation` (inclusion), `Valider le second facteur`, `Résoudre une connexion concurrente` et `Changer son mot de passe` (extensions), plus la scission imposée par **D-41**. Deux erreurs de la fiche sont corrigées au passage : elle annonçait **une** relation sur ce package, le mémoire en porte **quatre** — une inclusion au tableau 6.11 et trois extensions au tableau 6.12.

## D-40 — L'héritage entre acteurs n'est tracé que là où il est vrai

**Décision** : la généralisation `Administrateur système ▷ Médecin Chef ▷ Infirmier` est tracée sur les planches où l'inclusion des ensembles de cas est **vérifiée cas par cas**, et nulle part ailleurs.
**Motif** : l'héritage réduit la figure 6.2 de onze traits à cinq, et supprime tout croisement. Mais il énonce un fait : *l'acteur enfant fait tout ce que fait l'acteur parent*. Ce fait est faux sur deux packages.
**Conséquence** : relevé fait sur les 65 cas des tableaux 6.6 à 6.10.

| Figure | Package | Héritages traçables |
|---|---|---|
| 6.2 | Sécurité et habilitations | Administrateur ▷ Médecin Chef ▷ Infirmier |
| 6.3 | Référentiels et acteurs médicaux | **aucun** — UC24 est à l'Infirmier seul, UC22 et UC23 au Médecin Chef seul |
| 6.4 | Dossier patient | Administrateur ▷ Médecin Chef ▷ Infirmier |
| 6.5 | Parcours de soin | Médecin Chef ▷ Infirmier seulement — l'Administrateur n'intervient qu'au seul UC37 |
| 6.6 | Fonctions transverses | Administrateur ▷ Médecin Chef ▷ Infirmier |

Chaque planche portant un héritage l'explicite en note, avec le tableau qui le fonde.

**Erreur de la fiche relevée au passage.** Le bloc 9 de `UML-UC-01` place l'Administrateur système sur tous les cas du parcours de soin. Les tableaux 6.6 à 6.10 du mémoire ne l'y placent que sur **UC37, Consulter la file d'attente**. Le mémoire fait foi : la figure 6.5 ne reliera l'Administrateur qu'à ce seul cas.

## D-41 — Un ovale ne réunit que des cas ayant exactement les mêmes acteurs

**Décision** : deux cas d'utilisation ne sont réunis dans un même ovale que si la colonne « Acteurs » des tableaux 6.6 à 6.10 est **identique** pour les deux. Sinon, le groupe est scindé.
**Motif** : un ovale relié à l'Administrateur et au Médecin Chef affirme que **les deux font tout ce que l'ovale contient**. Le groupe « Gérer les comptes et les rôles » réunissait UC09 *Créer et gérer un compte* — A M — et UC10 à UC13 — A seul. La planche laissait donc croire que le Médecin Chef attribue les rôles et édite la matrice de permissions, ce que le tableau 6.6 lui refuse. Ce n'est pas une question de mise en page : c'est une affirmation fausse.
**Conséquence** : contrôle passé sur les 24 regroupements prévus par la fiche. **Six étaient hétérogènes**, et sont scindés.

| Figure | Groupe scindé | Devient |
|---|---|---|
| 6.2 | Gérer les comptes et les rôles | `Créer et gérer un compte` (UC09, A M) · `Gérer rôles, permissions et mots de passe` (UC10-13, A) |
| 6.3 | Gérer les délégations de prescription | `Accorder ou révoquer une délégation` (UC22-23, M) · `Consulter ses délégations actives` (UC24, I) |
| 6.5 | Émettre et suivre les bons | `Émettre et suivre les bons` (UC43, 45, 46, M I) · `Délivrer un bon de pharmacie` (UC44, M) |
| 6.6 | Communiquer | `Communiquer` (UC54-57, A M I) · `Diffuser une annonce` (UC58, A) |
| 6.6 | Piloter l'activité | `Piloter l'activité` (UC59-60, A M I) · `Exporter ou supprimer un rapport` (UC61, A M) |
| 6.6 | Synchroniser les données | `Synchroniser un poste local` (UC62-63, Poste local) · `Superviser le parc et restaurer` (UC64-65, A) |

**Le total passe de 29 à 41 ovales** : 10 pour la figure 6.2, **8** pour la 6.3, 9 pour la 6.4, 8 pour la 6.5, 6 pour la 6.6. Les 65 cas d'utilisation restent tous couverts, et la scission ne change aucun héritage vérifié en **D-40**.

**Effet de bord utile.** Sur la figure 6.3, la représentation cas par cas rend inutile l'annotation « consultation seule » que la fiche exigeait sur le trait Infirmier → délégations : les ovales séparés disent la chose d'eux-mêmes.

## D-42 — Chaque planche de cas d'utilisation est confrontée au Word par programme

**Décision** : aucune planche n'est livrée sans avoir passé un **contrôle automatique de conformité** qui relit le fichier `.drawio` produit et le confronte au tableau correspondant du `Memoire_CMS_SARIS.docx`.
**Motif** : la fiche de dessin `UML-UC-01` s'est révélée fausse sur trois points — une relation annoncée au lieu de quatre, l'Administrateur système placé sur des cas qui ne sont pas les siens, et six regroupements aux acteurs hétérogènes. Une relecture à l'œil ne les avait pas tous vus. Le miroir markdown ne fait pas foi non plus : seul le Word compte.
**Conséquence** : le contrôle reconstruit à partir du fichier seul la liste des acteurs, celle des ovales, les associations, la chaîne d'héritage et les flèches de relation. Il applique les deux règles UML — *un acteur enfant fait tout ce que fait son parent*, *un cas qui étend ou qui est inclus reprend les acteurs du cas de base* — puis compare ovale par ovale à la colonne « Acteurs » du Word. Il refuse la planche si un cas manque, si un ovale n'a pas de correspondance déclarée, si un cas est couvert deux fois, ou si un regroupement mêle des acteurs différents.

**Ce qu'il ne sait pas vérifier** : les libellés composés. D'où la règle d'amendement de **D-39** — on ne regroupe que si la planche ne tient pas autrement, et la note porte alors la correspondance.

**Les cinq planches portent la mention `CONFORME AU WORD`** : 6.2 sur 16 cas, 6.3 sur 8 cas, 6.4 sur 9 cas, 6.5 sur 20 cas, 6.6 sur 12 cas. **Les 65 cas d'utilisation du mémoire sont couverts, chacun une fois et une seule.** Le contrôle a dû apprendre à reconnaître un acteur système : le Poste local autonome est dessiné en rectangle stéréotypé « système », non en silhouette.

**Un second contrôle porte sur les relations, et il a trouvé deux erreurs.** Le premier contrôle vérifie les acteurs et la couverture ; il ne regarde pas les flèches. Un second programme extrait donc du Word **toutes les relations des tableaux 6.11 et 6.12 qui touchent le package**, puis vérifie pour chaque flèche dessinée que le cas source appartient bien à l'ovale de départ, le cas cible à l'ovale d'arrivée, et que le couple existe au Word. Il signale aussi toute relation traçable qui aurait été oubliée.

| Ce qu'il a trouvé | Correction |
|---|---|
| La note de la figure 6.5 annonçait **quatre** inclusions non traçables ; le Word en porte **cinq** — UC34 inclut UC25 hors package, et UC42, UC43, UC45, UC48 incluent chacun un contrôle non numéroté | note corrigée |
| Les quatre flèches de la figure 6.2 ne portaient que le stéréotype, sans le couple de cas : non ambiguës à l'œil, mais invérifiables par programme | les quatre étiquettes portent désormais `«include» UC01→UC07`, `«extend» UC02→UC01`, `UC03→UC01`, `UC04→UC01` |

Les cinq planches portent maintenant **la même convention d'étiquetage**, et les quatre livrées passent les trois contrôles : couverture, acteurs, relations.

**Une règle du contrôle a dû être corrigée, et le motif compte.** Sur la figure 6.5, le contrôle a refusé l'ovale « Gérer une évacuation ». Il propageait au cas qui étend les acteurs du cas de base : « Conduire une consultation » étant à l'Infirmier et au Médecin Chef, il en déduisait que l'Infirmier gérait les évacuations — ce que le tableau 6.9 refuse. Examen fait, **c'est la règle du contrôle qui était trop grossière, pas la planche** : l'ovale « Gérer une évacuation » porte son propre trait vers le Médecin Chef, donc il déclare ses acteurs et n'a rien à recevoir. La propagation ne vaut que pour un ovale **sans aucune association propre** — le cas des quatre extensions de la figure 6.2. Règle corrigée, et les trois planches déjà livrées repassées au contrôle : toutes conformes.

**Une relation ne peut pas toujours se tracer.** Le tableau 6.11 pose que UC34 *Ouvrir une visite* inclut UC25 *Rechercher un patient*. Les deux cas appartiennent à des packages différents — Parcours de soin et Dossier patient — donc à des planches différentes. La flèche ne peut figurer ni sur la 6.4, où le cas de base est absent, ni sur la 6.5, où le cas inclus est absent. **Elle est rappelée en note sur les deux planches** plutôt que dessinée de travers. Même traitement pour UC39 qui inclut UC37, tous deux dans le package Parcours de soin : celle-là, en revanche, se trace.

## D-43 — Les figures nomment le système comme le mémoire le nomme

**Décision** : la frontière des diagrammes porte **« Système de gestion des consultations et des dossiers médicaux »**. Le nom « CMS SARIS » disparaît de toutes les figures.
**Motif** : relevé fait sur le Word — corps, en-têtes, pieds de page. **« CMS SARIS » n'y apparaît pas une seule fois.** Le mémoire écrit « le système » 35 fois, « du système » 45 fois, et « système de gestion des consultations et des dossiers médicaux » 4 fois. Le sigle CMS n'y figure que trois fois, toujours entre parenthèses après « Centre Médico-Sanitaire », et il désigne le **centre médical**, pas le logiciel. Six figures écrivaient pourtant « CMS SARIS », sur la foi d'une règle du carnet de bord qui n'avait jamais été appliquée au document. Or **le Word fait foi**.
**Conséquence** : frontières des figures 6.2 à 6.5 réécrites, boîte du système de la figure 6.1 renommée, légende de la figure 1.1 corrigée en « périmètre couvert par le système conçu ». La règle fautive du carnet de bord est remplacée. Aucun texte du mémoire n'a été touché.

## D-44 — Trois autres écarts relevés par le contrôle de texte, et corrigés

**Décision** : un troisième contrôle vérifie que **chaque libellé porté par une figure se retrouve dans le Word**. Ce qui n'y est pas est soit un nom de groupe assumé et déclaré, soit un écart à instruire.
**Motif** : les cinq figures produites avant les planches de cas d'utilisation n'avaient jamais été confrontées au document par programme.
**Conséquence** : trois écarts trouvés, trois corrigés.

| Écart | Correction |
|---|---|
| La figure 4.1 portait la mention **« Page à préciser avant impression »** — mon propre marqueur, resté dans le dessin et destiné à être imprimé tel quel | supprimé ; la source cite désormais la référence exacte de la bibliographie |
| La figure 4.1 employait le vocabulaire du **chapitre 4 archivé du 19 août** — *capture des besoins fonctionnels, conception générique, conception détaillée, codage et tests unitaires, recette* — absent du chapitre actuel | figure refaite avec le vocabulaire en vigueur : contraintes fonctionnelles et techniques, branche fonctionnelle et branche technique, conception préliminaire, construction par itérations |
| La figure 1.1 montrait **ophtalmologie, ORL, stomatologie** et la distinction générale / spécialisée, absentes du mémoire | conservées, car sourcées dans `INV-08_recueil_existant.md` et cohérentes avec la « composante générale » que le Word mentionne — mais **la note de la figure porte désormais la source**, pour qu'un jury sache d'où elles viennent |

**Deux fausses alertes levées.** Les chiffres des planches 5.1 et 5.2 sont exacts : le Word dit bien « neuf variables de mode de vie », « l'anamnèse, en quatre questions », « neuf paramètres standardisés » — la figure les écrit en chiffres, c'est la seule différence. Et la référence Roques et Vallée de la figure 4.1 est bien à la bibliographie.

**Deux reformulations assumées** subsistent sur la figure 4.1, toutes deux fidèles au chapitre 4 : « part des contraintes d'exploitation, et construit l'architecture qui les satisfait » condense deux phrases du Word, et « indépendante des fonctions à rendre » en accorde une troisième. Une figure condense, elle ne cite pas.

## D-45 — Les cinq figures antérieures aux planches de cas d'utilisation sont passées au contrôle

**Décision** : les figures 1.1, 4.1, 5.1, 5.2 et 6.1 sont confrontées à leur fiche de dessin **dans les deux sens** — ce que la figure porte doit venir de la fiche, du Word ou d'un inventaire ; ce que la fiche impose doit se retrouver sur la figure.
**Motif** : ces cinq figures avaient été produites avant que les contrôles automatiques n'existent. Elles n'avaient jamais été relues autrement qu'à l'œil.
**Conséquence** : deux écarts de fond trouvés sur les planches d'activité, tous deux corrigés.

- La planche 5.1 enchaînait une action sur une **décision sans action intermédiaire** : le dossier n'était jamais cherché, seulement trouvé ou non. L'action de recherche est rétablie.
- **Quatre actions étaient des noms**, non des verbes — *Mode de vie*, *Anamnèse*, *Examen clinique*. En diagramme d'activité, une action est un verbe. Rétablies.
- « Rédiger le bon d'examen » avait perdu **« à la main »**, qui est précisément ce que la planche démontre. Rétabli.

**Sur la figure 6.1**, aucun écart de fond : les cinq étiquettes de flux qui n'existent pas telles quelles dans le Word sont des condensations de la colonne « Vocation » du tableau 6.4. C'est consigné sur la fiche.

**Sur la figure 4.1**, refaite en vrai Y — voir **D-46**.

## D-46 — La figure 4.1 devient un vrai Y, et le chapitre 4 nomme les huit étapes

**Décision** : la figure 4.1 est redessinée en **Y** — deux bras obliques qui convergent, puis un tronc descendant — et porte les **huit étapes canoniques de 2TUP** : capture des besoins fonctionnels, analyse, capture des besoins techniques, conception générique, conception préliminaire, conception détaillée, codage et tests, recette. Une phrase de deux lignes est ajoutée au chapitre 4 pour les nommer.
**Motif** : le chapitre 4 annonce « sa représentation caractéristique **en Y** : deux branches montantes, un point de convergence, un tronc descendant ». La figure montrait deux colonnes parallèles et un rectangle. **La figure ne montrait pas ce que le texte annonçait.** Comparaison faite avec le mémoire de référence d'OYERE, qui porte le Y canonique.
**Conséquence** : figure refaite ; une phrase ajoutée au chapitre 4, après celle qui décrit le Y ; la source Roques et Vallée, déjà à la bibliographie, est citée sous la figure. Le marqueur de travail « Page à préciser avant impression », qui traînait sur l'ancienne version, a disparu.
**Sauvegarde** : la version du Word antérieure à l'ajout est conservée le temps de la session.

## D-47 — Un fichier draw.io par figure pendant la production, un fichier à onglets à la fin

**Décision** : chaque figure vit dans son propre `.drawio` tant que la production dure. Une fois les vingt et une figures validées, un **fichier unique à onglets** est assemblé, une page par figure, pour l'archive et pour le second auteur. Les fichiers individuels restent la référence.
**Motif** : un `.drawio` accepte plusieurs pages — plusieurs `<diagram>` dans un `<mxfile>` — et la question méritait d'être posée. Essai fait sur un fichier à deux pages : **mes trois contrôles additionnent silencieusement les pages**. Ils ont produit 22 faux doublons d'identifiants, 4 formes faussement « hors page », des chevauchements inventés, et surtout **la lisibilité n'était vérifiée que sur la première page**. Ce n'est pas une limite du format, c'est une limite des outils.
**Second motif** : draw.io a déjà écrasé nos fichiers deux fois en réenregistrant sa version en mémoire. Un fichier par figure limite la perte à une figure ; un fichier unique la porterait à vingt et une.
**Conséquence** : les contrôles restent tels quels pendant la production. L'assemblage final est une copie, sans risque. Si le fichier à onglets devait servir de format de travail, il faudrait d'abord reprendre les trois contrôles pour qu'ils bouclent sur chaque page.

## D-48 — La croix de destruction demandée par la fiche est refusée

**Décision** : la branche « catégorie non couverte » de la figure 6.7 ne se termine **pas** par une croix sur la ligne de vie. Elle porte une note : *« Aucun bon n'est créé, aucune ligne n'est reprise, rien n'est journalisé. »*
**Motif** : la fiche `UML-SEQS-02` demande « terminer la branche B par une croix sur la ligne de vie ». En UML, une croix sur une ligne de vie signifie **la destruction de l'objet**. Or le système n'est pas détruit par un refus d'éligibilité : il répond, et continue. Dessiner cette croix serait une faute de langage que le jury peut relever.
**Conséquence** : l'intention de la fiche — montrer qu'aucun bon n'existe à l'issue de cette branche — est tenue par la note, qui est plus précise que la croix puisqu'elle nomme les trois effets absents.

**Un second point de la fiche est déplacé, non supprimé.** Elle demandait une bulle attachée au message `vérifierÉligibilité`, portant la matrice des droits. Le coin haut-droit de la planche est occupé par les étiquettes des trois auto-appels, qui ont besoin de toute la largeur disponible. La matrice figure donc **dans la note de bas de figure**, avec son renvoi au tableau 3.4. Rien n'est perdu ; la place l'imposait.

## D-49 — La palette se relit avant chaque famille de figures

**Décision** : avant de produire la première figure d'une famille nouvelle, le bloc correspondant de `palettes/PALETTE_v3.drawio` est **relu**, et la figure produite est **confrontée à ses valeurs** — remplissage, largeurs, imbrications, parentés.
**Motif** : la première version de la figure 6.7 portait des bandes d'activation teintées de largeur 14, **une seule par ligne de vie sur toute la hauteur du diagramme**, et **aucune bande imbriquée** pour les six auto-appels. Or une bande d'activation est une **période d'exécution**, pas la durée de la scène. Le vocabulaire juste — bande blanche de largeur 10, bande imbriquée décalée de 10 pour chaque auto-appel — figurait déjà au bloc 4 de la palette, validé avant toute production. Je ne l'avais pas rouverte.
**Conséquence** : figure 6.7 refaite. Deux bandes d'exécution distinctes sur le système, six bandes imbriquées, gardes replacées au coin supérieur gauche de chaque opérande comme le veut la convention. La palette redevient ce pour quoi elle a été faite : la référence, pas un souvenir.

## D-50 — Les diagrammes de séquence portent un cadre « sd », et gardent deux lignes de vie

**Décision** : chaque diagramme de séquence est enveloppé d'un **cadre d'interaction `sd`** portant le nom de la scène, et son fragment `alt` est tracé **en rouge**, gardes comprises. En revanche, les deux planches conservent **deux lignes de vie** — l'acteur et le système.
**Motif** : comparaison faite avec les diagrammes de séquence du mémoire de référence. Deux de leurs choix sont meilleurs que les nôtres et sont repris : le cadre nommé, qui donne le périmètre de la scène, et la couleur qui sépare la structure conditionnelle du fil des messages. Un troisième ne l'est pas pour nous : ils font dialoguer l'acteur, le système **et la base de données**. Nos figures sont des diagrammes de séquence **système**, ce que leur légende annonce et ce que la fiche impose — le système y est une **boîte noire**. Y ajouter une ligne de vie « BD » contredirait le texte du mémoire.
**Conséquence** : figure 6.7 refaite avec son cadre `sd`, son `alt` rouge et ses bandes d'activation teintées ; la palette est mise à jour dans le même sens pour que la référence reste vraie. La vue interne du système n'est pas perdue : elle est portée par le diagramme de composants, figure 7.6.

## D-51 — L'auto-appel se dessine en crochet court, la bande imbriquée en dessous

**Décision** : sur les diagrammes de séquence, un auto-appel est un **crochet de 14 points de haut** qui part de la bande d'activation, sort à droite et retombe sur la ligne de vie. La **bande imbriquée commence où la flèche retombe** et se poursuit en dessous, décalée de 5 points pour **chevaucher** la bande porteuse.
**Motif** : la version précédente traçait un rectangle de 36 points refermé sur une bande imbriquée posée à côté de la bande porteuse. Les deux formes composaient **une boîte fermée** : la planche ne se lisait plus comme une suite d'appels. La comparaison avec les diagrammes de séquence du mémoire de référence l'a rendu évident — chez eux le crochet est court et la bande continue dessous.
**Conséquence** : figure 6.7 refaite. Le contrôle de chevauchement est précisé : une bande d'activation est faite pour se poser sur une ligne de vie et s'imbriquer sur une autre bande, elle est donc exclue du test. Les onze figures antérieures repassées : aucune régression.

## D-52 — Deux scénarios de la figure 6.8 sont renvoyés au tableau 6.15

**Décision** : la figure 6.8 trace le cycle nominal de synchronisation et la résolution de conflit. **Deux scénarios ne sont pas dessinés** : le déclenchement manuel, et le serveur injoignable — où le poste continue sur sa base locale. Ils sont nommés dans la note de la figure, avec renvoi au tableau 6.15.
**Motif** : mesure faite. Les dix-huit messages, le `loop`, les deux `opt`, l'`alt` à trois branches et les deux notes de la fiche demandent environ 1 260 points de hauteur. Le plafond du gabarit est de **1 170** — au-delà, la police tombe sous 8 pt à l'impression et la planche devient illisible. Il fallait retirer quelque chose.
**Ce qui a été retiré, et pourquoi ceux-là** : le tableau 6.15 classe ces deux cas en **scénarios alternatif et d'exception**, non en scénario nominal. Le diagramme conserve donc ce qu'il doit démontrer — que la synchronisation est déclenchée par notification et non par interrogation, et qu'un conflit est tranché puis journalisé, jamais bloquant.
**Réversible** : si l'auteur préfère les conserver, la figure se scinde en deux planches, comme la 5.1 l'a été. Cela ajoute une figure au mémoire et environ une page.

## D-53 — Le compartiment des opérations reste vide, et la planche le dit *(annulée par D-55)*

**Décision** : les classes des planches 7.1 à 7.5 portent **trois compartiments** — nom, attributs, opérations — le troisième étant **vide**. Chaque planche porte en note le motif de ce vide.
**Motif** : comparaison faite avec les diagrammes de classes des deux mémoires de référence, qui remplissent le troisième compartiment de `créer()`, `lire()`, `modifier()`, `supprimer()`. Notre modèle vient des modèles de données du dépôt, qui **ne déclarent aucune méthode**. Y inscrire des opérations serait une affirmation fausse, vérifiable dans le code — et **D-02** dit que le code fait foi. La fiche `UML-CLS-01` l'avait d'ailleurs déjà tranché : *« le compartiment des opérations reste vide — le modèle est un modèle de données »*.
**Conséquence** : la première version de la figure 7.1 n'avait que deux compartiments ; elle en porte trois désormais. Deux autres manques relevés par la même comparaison sont corrigés : les associations portent maintenant **le nom du rôle et la multiplicité à chacune de leurs deux extrémités** — le bloc 5 de la fiche les donne pour les 38 associations — et les attributs portent le **marqueur de visibilité** que la palette prescrit.

**Un contrôle s'ajoute pour cette famille de figures.** Le style de classe de la palette porte `overflow=hidden` : un attribut trop long pour son compartiment est **coupé sans aucun avertissement**. La largeur de chaque ligne est donc mesurée contre celle de son compartiment avant livraison.

## D-54 — Les planches de classes portent trois compartiments et les noms de rôle *(partiellement annulée par D-55)*

**Décision** : chaque classe est dessinée en **rectangle à trois compartiments** — nom, attributs, opérations — le troisième restant **vide**. Chaque extrémité d'association porte **son nom de rôle et sa multiplicité**, et non la multiplicité seule.
**Motif** : comparaison faite avec les diagrammes de classes des mémoires de référence, à la demande de l'auteur. Deux écarts sont apparus sur la première planche produite. La fiche `UML-CLS-01` énonce quatre fois la règle des trois compartiments — *« le compartiment des opérations reste vide, le modèle est un modèle de données »* — et ma planche n'en portait que deux. Le bloc 5 de la même fiche donne le **nom de rôle de chaque extrémité** — `roles`, `utilisateur`, `permissions`, `role` — que je n'avais pas porté.
**Conséquence** : figure 7.1 refaite ; la règle vaut pour les planches 7.2 à 7.5.

**Sur les opérations, un choix assumé.** Les mémoires de référence remplissent le troisième compartiment de méthodes — `ajouter_X()`, `modifier_X()`, `supprimer_X()`. Nous ne le faisons pas. Nos vingt-neuf classes sont des **entités de données**, sans méthode propre : leur comportement est porté par les routes et les services, décrits au chapitre 7. Écrire un jeu de méthodes uniforme sur chaque classe serait une invention, et un jury peut ouvrir le code. **Le compartiment vide est la façon UML de dire qu'aucune opération n'est déclarée**, et la note de chaque planche l'énonce en toutes lettres.

---

## D-55 — Les opérations réelles s'écrivent ; le nom de l'association va au milieu du trait

**Décision** : elle annule D-53 et complète D-54.

1. Le troisième compartiment porte les **opérations réellement établies**, et reste vide sur les classes qui n'en ont pas. Une opération n'est écrite que si elle correspond à une **transition d'état documentée** — tableau 7.6 du mémoire, détaillé au § 3 de `INV-07`. **Huit classes sur vingt-neuf** en portent ; les vingt et une autres gardent un compartiment vide.
2. Chaque association porte **un verbe au milieu du trait** et **ses multiplicités aux deux extrémités**. Les noms de rôle ne sont plus écrits sur la planche : ils restent la source du sens du verbe, dans le bloc 5 de la fiche.

**Motif** : comparaison demandée par l'auteur avec les diagrammes de classes des mémoires de référence. Deux constats se sont opposés. Le premier est que le nom de l'association au milieu du trait **nous manquait**, et qu'il rend le modèle lisible comme une phrase. Le second est que leur gabarit CRUD uniforme — `ajouter_X()`, `modifier_X()`, `supprimer_X()`, `rechercher_X()` sur chaque classe — nous est **interdit** : relevé sur `INV-01`, nos 273 routes se répartissent sur 26 contrôleurs qui ne correspondent pas aux classes, et **vingt et une de nos vingt-neuf classes n'ont aucun contrôleur propre**. Mais le tableau 7.6 existe déjà dans le mémoire et donne, lui, de vraies opérations avec leurs gardes. Le compartiment vide par défaut était donc un choix pris **sans avoir cherché**, et c'est ce qui le rendait fautif — non le vide lui-même.

**Refusé avec motif** : le `+` devant un nom d'association (le `+` est un marqueur de visibilité, qui ne s'applique qu'aux attributs et aux opérations) · `__init__()` (constructeur de langage dans un diagramme de conception) · `created_at` / `updated_at` (colonnes d'ORM, pas attributs du domaine) · une association plusieurs-à-plusieurs sans classe d'association (le diagramme cache alors une table).

**Conséquence** : figure 7.1 refaite ; fiche `UML-CLS-01` révisée le 30 août 2026 ; la règle vaut pour les planches 7.2 à 7.5. L'analyse comparative complète est dans `11_revue_finale/ANALYSE_DIAGRAMMES_DE_CLASSES.md`.

---

## D-56 — Trois corrections de notation sur la figure 7.1, relevées par l'auteur

**Décision** : trois défauts corrigés, et trois règles qui en découlent pour les planches suivantes.

1. **Un nom de classe en italique est réservé aux classes abstraites.** `Site` et `PersonnelMedical` étaient dessinés en italique — le style `HORS` de la palette portait `fontStyle=2`. La planche affirmait donc qu'ils sont abstraits, ce qui est faux. **L'italique est retiré du style ; les pointillés suffisent à marquer le hors-package.**
2. **Un lien vers une classe d'un autre package porte au moins ses multiplicités.** Les liens `Utilisateur — Site` et `Utilisateur — PersonnelMedical` ne portaient rien, alors que D-55 exige les multiplicités sur *chaque* association. Elles sont relevées dans `INV-02`, lignes 28 et 32 : `Utilisateur` 0..\* — 1 `Site`, et `Utilisateur` 0..1 — 0..1 `PersonnelMedical`. **Le verbe, lui, reste absent** : le texte du mémoire n'en donne aucun pour ces deux liens, et rien ne s'invente. La note de la planche dit qu'ils sont nommés sur la figure 7.5.
3. **Une planche de classes se dispose de façon que ses liens soient des segments droits.** Les liens `détient` et `reçoit` étaient tracés en diagonale à travers la planche. La cause n'était pas le placement mais la **fragilité du procédé** : ils reposaient sur des points de passage, que draw.io ne conserve pas toujours en réenregistrant. La planche est refaite en **chaîne verticale** — Permission, RolePermission, Role, UtilisateurRole, Utilisateur, centres alignés — où chaque lien est un segment vertical droit qui ne dépend d'aucun point de passage. La note passe dans la colonne de droite, restée libre.

**Motif** : les trois défauts ont été relevés par l'auteur sur la planche livrée, et les trois étaient réels. Le premier est une faute de notation UML, les deux autres une infraction à nos propres règles.

**Conséquence** : figure 7.1 refaite en 770 × 1120 ; style `HORS` corrigé pour toutes les figures à venir ; **la disposition en chaîne verticale devient la disposition à essayer en premier** sur les planches 7.2 à 7.4.

---

## D-57 — Le générateur n'échappait pas la balise de gras : correction et contrôle ajouté

**Décision** : la balise `<b>` est ajoutée à la liste des balises que le générateur laisse passer, et un contrôle automatique refuse désormais toute balise doublement échappée.

**Motif** : la fiche demande que `typePrestation` et `couvert` soient écrits **en gras** sur `DroitCategoriePatient` — ce sont les deux attributs porteurs de la règle d'éligibilité. Le générateur convertissait `<b>` en `&amp;lt;b&amp;gt;`, ce que draw.io affiche **en toutes lettres** : la figure aurait imprimé les balises au lieu du gras. Le défaut ne se voyait ni sur mon aperçu, qui ignore les balises, ni sur les contrôles existants. Il n'est apparu qu'en comparant, caractère par caractère, les attributs de la figure au bloc 4 de la fiche.

**Conséquence** : figures 7.1 et 7.2 régénérées ; le contrôle « balises doublement échappées » entre dans la liste des vérifications de chaque figure.

---

## D-58 — Figure 7.2 : deux verbes, aucun nom de rôle, et le périmètre de la fiche corrigé

**Décision, sur arbitrage de l'auteur** :

1. Les deux associations entre `PersonnelMedical` et `DelegationPrescription` portent **leur verbe seul** — `accorde` et `agit sous` — **sans nom de rôle**. R2 s'applique sans exception.
2. Le périmètre en pointillés de la planche est **corrigé** par rapport à la fiche : `Utilisateur` est ajouté, par symétrie avec la figure 7.1 qui montre `Site` et `PersonnelMedical` ; `Visite` est ajouté pour porter le lien L08, absent des consignes ; `Parcours de soin` est dessiné avec le **symbole UML du package** — rectangle à onglet — et non comme une classe.

**Motif** : la fiche exigeait des noms de rôle sur L16 et L17, ce que R2 avait supprimé ; l'auteur a tranché pour le verbe seul, les deux verbes étant assez distincts pour lever l'ambiguïté. La fiche omettait par ailleurs trois liens — L01, L02 et L08 — et nommait `Parcours de soin` comme une classe, ce qu'il n'est pas.

**Les trois verbes sont relevés dans le mémoire, aucun n'est inventé** :

| Association | Verbe | Phrase source |
|---|---|---|
| `CategoriePatient` → `DroitCategoriePatient` | `ouvre droit à` | « seuls les employés en CDI et leurs ayants droit **ouvrent droit** aux bons de pharmacie et d'examen » |
| `PersonnelMedical` → `DelegationPrescription` (médecin chef) | `accorde` | « prescrit librement, décide des évacuations, **accorde les délégations** » |
| `PersonnelMedical` → `DelegationPrescription` (infirmier) | `agit sous` | « l'infirmier **agit sous délégation** du médecin chef » |

**Les huit compartiments d'opérations sont vides**, et la note de la planche l'affirme : aucune des huit classes ne figure parmi les neuf machines à états du tableau 7.6. Quatre portent pourtant un attribut `statut` — le mémoire ne documente aucune transition pour elles, et il n'en est pas inventé.

---

## D-59 — Un contrôle porte sur l'étendue réelle du dessin, pas sur la page déclarée

**Décision** : deux contrôles s'ajoutent à la liste, et une règle de méthode.

1. **L'étendue réelle du dessin** — le rectangle qui englobe vraiment toutes les formes — est mesurée, et la police sur papier en est déduite. La page déclarée dans le fichier ne prouve rien : une forme peut se trouver au-delà.
2. **Le fichier est relu depuis le disque** à la livraison, et **de nouveau chaque fois qu'une capture d'écran est envoyée**.

**Motif** : la figure 7.2 a été trouvée sur le disque dans un état différent de celui que j'avais écrit. Neuf formes avaient été déplacées, `PersonnelMedical` et `DelegationPrescription` de **615 points vers la droite**, soit 385 points au-delà de la page. Tous les points de passage avaient disparu et les traits étaient redevenus des diagonales.

Le dessin ne mesurait plus 750 points de large mais **1 365**. Réduit à la largeur utile d'une image dans le mémoire — 468 points — il serait tombé à **4,80 pt sur papier**, contre 8,74 pour la version produite. Le seuil de lisibilité est de 8. La planche aurait été illisible imprimée, et rien dans mes contrôles ne l'aurait signalé, puisqu'ils avaient été passés **avant** la modification, sur un fichier alors conforme.

**Ce que ce défaut apprend** : mes contrôles ne valaient que pour l'instant où je les passais. Une figure n'est pas acquise parce qu'elle a été vérifiée une fois. La version déplacée est conservée sous `FIG_7-2_VERSION_DEPLACEE_a_verifier.drawio` — rien n'est perdu si le déplacement était voulu.

---

## D-60 — Quatre classes de la figure 7.2 n'ont aucun lien interne, et la planche le dit

**Constat, relevé sur `INV-02`** : le package « Référentiels et acteurs médicaux » compte huit classes mais **seulement trois associations internes** — `CategoriePatient` — `DroitCategoriePatient`, et les deux liens `PersonnelMedical` — `DelegationPrescription`. Quatre classes ont un **degré interne de zéro** : `Site`, `PathologieReference`, `MedicamentReference`, `TypeExamen`.

| Classe | Liens dans le package | Liens sortants |
|---|---|---|
| `Site` | **0** | 3 — `Utilisateur`, `Patient`, `Visite` |
| `PathologieReference` | **0** | 3 — dont `DiagnosticConsultation` |
| `MedicamentReference` | **0** | 3 — dont les lignes d'ordonnance et de bon |
| `TypeExamen` | **0** | 2 — les lignes d'examen et d'ordonnance |
| `CategoriePatient` | 1 | 2 |
| `DroitCategoriePatient` | 1 | 0 |
| `PersonnelMedical` | 2 | 6 |
| `DelegationPrescription` | 2 | 3 |

**Ce n'est pas un défaut de dessin, et ce n'est pas un oubli.** C'est une propriété d'un package de référentiels : un catalogue ne se référence pas lui-même, il est référencé par le domaine clinique. Vérifié : sur les vingt-deux associations qui touchent ces huit classes, **treize visent une des vingt-neuf classes retenues** et sont toutes tracées sur la planche — huit en traits pleins vers les classes en pointillés, cinq résumées par les trois flèches de dépendance vers le package `Parcours de soin`. Les neuf autres visent des entités écartées du modèle, listées au tableau 7.4.

**Décision** : la note de la planche énonce le fait, pour qu'un lecteur n'y voie pas une omission. La question a été posée par l'auteur devant la figure ; elle le sera par le jury.

---

## D-61 — L'outillage de production des figures est reconstruit à chaque réinitialisation

**Constat** : l'environnement de travail a été réinitialisé cinq fois, effaçant à chaque fois les scripts qui produisent et vérifient les figures. Ils ont été reconstruits de mémoire, à partir des styles relus dans les fichiers déjà livrés.

**Risque** : une reconstruction de mémoire peut réintroduire un défaut déjà corrigé. C'est exactement ce qui s'est produit avec la balise de gras — voir D-57.

**Question ouverte** : faut-il déposer ces scripts dans le dossier du mémoire pour qu'ils survivent ? Ils n'entrent pas dans le rendu, mais ils garantissent qu'une figure régénérée est identique à celle qui a été validée. **En attente de l'arbitrage de l'auteur.**

---

## D-62 — Une phrase ajoutée au § 7.3 pour nommer les liens du dossier patient

**Décision, sur arbitrage de l'auteur** : une phrase est ajoutée à la fin du paragraphe du § 7.3 qui commence par « Cette hiérarchie se mesure au nombre d'associations ».

> Le dossier patient se lit alors en trois liens. Il **porte** une identité, qui n'existe pas sans lui. Il **correspond** à un employé lorsque le patient est lui-même assuré, identifié par son matricule. Un rattachement distinct le **concerne** enfin lorsqu'il est ayant droit d'un assuré, avec le type de lien familial, ou salarié d'une société sous-traitante.

**Motif** : sur les cinq associations internes de la figure 7.3, **une seule** avait un verbe dans le mémoire — `rattaché à`, tableau 3.3, ligne « Ayant droit CDI ». Le § 7.3 annonçait « trois choix de modélisation » et n'en explicitait qu'un ; il montrait le modèle sans jamais le lire. La phrase comble ce manque **et** source les trois verbes manquants. Même procédé que pour la figure 4.1, décision **D-46**.

**Chaque affirmation est vérifiée, aucune n'est déduite** : l'identité obligatoire côté patient vient de `INV-02` et justifie le losange plein de composition ; le matricule vient du tableau 3.3, ligne « Assuré CDI » ; le type de lien familial de la ligne « Ayant droit CDI — matricule du CDI **et type de lien** ». Le verbe `bénéficie de` a été écarté : le tableau 3.4 montre qu'un sous-traitant n'ouvre droit à aucun bon, le mot aurait été faux pour lui.

**Contrôle après insertion** : 999 paragraphes avant, 999 après, **un seul modifié**, style et police inchangés. Sauvegarde dans `/tmp/sauvegarde_avant_phrase_7-3.docx`.

---

## D-63 — Figure 7.3 : le tracé se choisit pour qu'aucun trait n'en croise un autre

**Constat** : deux classes de la colonne de gauche — les deux rattachements — pointent vers la même classe de droite, `Patient`. Le premier tracé faisait se croiser leurs deux coudes.

**Règle** : quand plusieurs traits partent d'une colonne vers une même boîte, **la boîte la plus basse prend la gouttière la plus éloignée du mur et entre le plus bas**. Les trajets s'emboîtent alors sans se croiser. Ici : `RattachementAyantDroitCdi` passe par la gouttière x = 300 et entre haut ; `RattachementSousTraitant` par x = 345 et entre bas.

**Motif** : mon contrôle détecte les traits qui traversent une **forme**, pas ceux qui se croisent entre eux. Le défaut n'est apparu qu'à la lecture de l'aperçu. Un croisement n'est pas une faute UML, mais il fait douter le lecteur du trait qu'il suit.

---

## D-64 — Le dépôt relu en entier : cinq fonctions de plus, trois sans cas d'utilisation

**Constat**, à la demande de l'auteur qui a fait remarquer que je travaillais sur les inventaires et non sur le code. Lecture intégrale du dépôt le 31 août 2026 — API, application web, client de bureau, schéma, catalogue de permissions.

**Le résultat principal est que les inventaires sont fidèles.** Les 268 routes recensées le 10 août existent toujours, exactement là où l'inventaire les situe. Les 88 entités, les 41 migrations, les 26 contrôleurs, les 18 modules, les 15 écrans, les **151 routes journalisées** : tout se recompte juste. **Aucune fonction inventoriée n'a disparu.**

**Cinq routes et deux permissions ont été ajoutées entre le 10 et le 31 août.** Trois de ces fonctions ne correspondaient à aucun des soixante-cinq cas d'utilisation.

| Fonction | Traitement retenu |
|---|---|
| Générer un rapport | déjà couverte par **UC61** ; c'est l'inventaire qui l'avait manquée |
| Purger le journal d'audit | **UC14** élargi : « Consulter **et purger** le journal d'audit » |
| Supprimer un rapport | **UC61** élargi : « Exporter **ou supprimer** un rapport » |
| Confirmer son site à la connexion | ajoutée aux **scénarios alternatifs de UC01**, tableau 6.13 — le libellé du cas ne change pas |
| État détaillé du service | route technique, hors périmètre fonctionnel |

**Décision, sur arbitrage de l'auteur** : élargir trois libellés plutôt qu'ajouter trois cas. Le total reste à **65 cas d'utilisation**, la répartition par module et la matrice de traçabilité ne bougent pas.

### Ce que j'avais annoncé à tort

J'ai dit à l'auteur que cette option ne demanderait **aucune retouche de figure**. C'était faux, et je l'ai vérifié avant d'agir : les libellés de UC14 et UC61 sont **écrits sur les ovales** des figures 6.2 et 6.6. Deux ovales ont donc été repris, plus la note de la figure 6.6 qui citait l'ancien libellé. La capacité des ovales a été vérifiée avant : sur la 6.2, « Gérer rôles, permissions et mots de passe » est plus long et tient déjà ; sur la 6.6, « Superviser le parc et restaurer une sauvegarde » également.

### La cascade de chiffres

Deux nombres du chapitre 8 étaient devenus faux — 268 routes et 128 permissions. **Ils en entraînaient huit autres**, tous corrigés :

| Endroit | Avant | Après |
|---|---|---|
| Besoin BF01 — authentification | 7 routes | **8 routes** |
| Besoin BF02 — comptes et habilitations | 32 routes, 128 permissions | **33 routes, 130 permissions** |
| Besoin — rapports | 2 routes, export | **4 routes, génération et export** |
| Tableau 6.4 — Administrateur système | 128 sur 128 | **130 sur 130** |
| Tableau 6.4 — Médecin Chef | 101 sur 128 | **102 sur 130** |
| Tableau 6.4 — Infirmier | 51 sur 128 | **51 sur 130** |
| Tableau 7.2 — serveur applicatif | 268 routes | **273 routes** |
| Chapitre 7 — paquet de types | 128 permissions | **130 permissions** |
| Chapitre 7 — composants, deux mentions | 268 routes | **273 routes** |
| Chapitre 2 — REST | 268 points d'accès | **273 points d'accès** |
| Chapitre 8 et conclusion | 268 routes, 128 permissions | **273 routes, 130 permissions** |

**Contrôle après modification** : 2 600 paragraphes avant, 2 600 après, **17 modifiés**, plus aucune occurrence de 268 ni de 128 dans le document. Sauvegarde dans `/tmp/sauvegarde_avant_maj_chiffres.docx`.

**Ce qui n'a pas bougé et a été revérifié ce jour** : 88 entités · 41 migrations · 26 contrôleurs · 18 modules · 15 écrans · 151 routes auditées · 51 permissions pour l'infirmier.

**Répercussion sur les fichiers du dossier** : 22 fichiers de travail mis à jour, dont `INV-01` et `INV-03` qui reçoivent chacun un bloc de révision daté listant les ajouts. **Le dossier `99_archive` n'a pas été touché** — c'est une archive.

Le recensement complet des fonctionnalités, module par module, est dans `11_revue_finale/RECENSEMENT_FONCTIONNALITES_APPLICATION.md`.

---

## D-65 — La figure 7.4 est dédoublée en 7.4a et 7.4b

**Décision, sur arbitrage de l'auteur** : le package Parcours de soin est représenté sur **deux planches** au lieu d'une.

**Motif, mesuré avant tout tracé** : les onze classes totalisent **2 420 points de hauteur cumulée**, et il faudrait **950 points de large** — trois colonnes de 250 plus les gouttières des verbes — là où le gabarit en autorise 770. Ce n'est pas un problème de placement, c'est une question d'aire : le contenu déborde de moitié. La page en paysage a été calculée aussi : 1 244 × 819 points utiles, quatre colonnes serrées, police à **8,00 pt tout juste** — au seuil exact, sans marge. Écartée.

**Ce qui change dans le mémoire** : la phrase du § 7.3 qui annonçait « les quatre diagrammes suivants… et le cinquième » devient « les cinq planches suivantes… et la sixième », et la légende unique devient deux légendes, **7.4a** et **7.4b**. Le suffixe évite de renuméroter les figures 7.5 à 8.5.

**Contrôle après modification** : 2 600 paragraphes avant, **2 601** après — la légende ajoutée, et rien d'autre. Sauvegarde dans `/tmp/sauvegarde_avant_split_7-4.docx`.

> ⚠️ **La liste des figures est un champ Word.** Elle affiche encore l'ancienne entrée tant que le document n'a pas été mis à jour par Ctrl+A puis F9. C'est la première fois depuis le début du travail que cette manipulation est nécessaire.

**Conséquence sur le budget de pages** : une image de plus à coller, donc une figure de plus dans le corps. À porter au décompte des vingt-quatre emplacements d'image, qui passent à vingt-cinq.

---

## D-66 — Le contrôle des figures est affiné : il criait au loup, et il manquait le loup

**Constat** : passé sur les dix-sept figures, le contrôle signalait **plus de cent défauts**, presque tous faux — et il en manquait un vrai. Quatre corrections lui ont été apportées, chacune fondée sur une propriété de la forme concernée.

| Correction | Ce qu'elle change |
|---|---|
| **Largeur mesurée ligne par ligne** | un libellé coupé par un retour à la ligne explicite n'est plus mesuré comme une seule ligne. Et les formes qui replient leur texte toutes seules ne sont plus mesurées du tout |
| **Les conteneurs sont ignorés** | un cadre de séquence, une frontière de système, un couloir d'activité : un trait les traverse **par nature**. Une forme est reconnue conteneuse si une autre la déclare pour parent, ou si elle en contient une entièrement |
| **Un ovale se teste sur son contour** | les coins de son rectangle englobant sont vides. Un trait qui passe dans un coin ne traverse rien. Sans cela, la figure 6.3 était signalée à tort |
| **Une ligne de vie se teste sur son trait central** | sa colonne est vide de part et d'autre. Une note posée à côté ne la recouvre pas |

**Et le contrôle porte désormais sur toutes les formes, pas seulement celles de premier niveau.** C'était le manque : les ovales des diagrammes de cas d'utilisation sont des enfants de la frontière, ils n'étaient donc **jamais testés**. Un trait aurait pu en traverser un sans que rien ne le signale.

### Le défaut réel trouvé — figure 4.1

Trois étiquettes de la figure 4.1 étaient écrites **sans repli automatique** : les deux sous-titres des branches du Y, et la ligne de source bibliographique. Leur texte débordait de sa boîte, et deux d'entre elles **dépassaient le bord de la page** — de 10 points pour le sous-titre de la branche technique, de 18 points pour la ligne de source.

Le défaut était invisible sur l'aperçu, qui replie le texte, et invisible au contrôle, qui mesurait la boîte et non le texte. La figure avait pourtant été validée. **Corrigé** : repli activé, hauteurs portées de 54 à 76 points, et la bande des sous-titres remontée pour ne pas toucher les étapes en dessous.

**État après correction : les dix-sept figures passent les huit contrôles sans un seul signalement.**

---

## D-67 — Composants et déploiement dessinés en portrait, et non en paysage

**Décision** : les figures 7.6 et 7.7 sont produites au gabarit portrait 770 points, alors que leurs fiches conseillaient l'une et l'autre le format A4 paysage.

**Motif** : une image large collée dans une page portrait est réduite à la largeur utile du mémoire, 468 points, quelle que soit sa proportion. Un dessin de 1 244 points de large y tomberait à **5,3 pt** — illisible. Le paysage n'a de sens que si la page elle-même est tournée, ce qui exige un saut de section dans Word. Les deux planches tiennent en portrait à condition de les organiser autrement : quatre bandes au lieu de trois pour les composants, deux zones superposées pour le déploiement. Le mémoire reste ainsi homogène, et aucune manipulation Word supplémentaire n'est demandée à l'auteur.

**Résultat** : 7.6 en 770 × 1 080, **8,74 pt** · 7.7 en 770 × 1 170, **8,66 pt**.

## D-68 — Figure 7.6 : les cadres retirés, cinq bandes, et les interfaces renvoyées au texte

**Constat** : la fiche `UML-CMP-01` demande seize dépendances, chacune portant le nom de son interface. Écrites toutes les seize, **les étiquettes se recouvraient entre elles et par-dessus les composants** — l'aperçu l'a montré sans ambiguïté.

**Décision** : sept étiquettes sont conservées, celles qui portent une information que le lecteur ne peut pas déduire — `API REST`, `mode connecté`, `mode autonome`, `Géolocalisation`, `Stockage relationnel`, `Accès aux données`, `embarque le rendu`. Les neuf autres sont retirées de la planche, et la note renvoie au § 7.6 du mémoire, **où les onze composants et leurs interfaces fournies et requises sont énumérés un par un**. L'information n'est pas perdue : elle est là où elle se lit.

**Motif** : une planche illisible ne démontre rien. Le diagramme de composants sert à montrer **de quels blocs le système est fait et lequel s'exécute où** — pas à recopier un tableau.

### Complément — la planche a été refaite deux fois avant d'être lisible

**L'auteur a renvoyé deux versions successives avec le même verdict** : « c'est trop confiné et on ne comprend ». Il avait raison les deux fois, et le défaut n'était pas dans les détails mais dans la structure.

**Première version** — deux cadres de déploiement imbriqués, treize composants placés autour, seize flèches routées dans les gouttières restantes. Résultat : un labyrinthe. Les cadres `Serveur central` et `Poste autonome` obligeaient à disperser les composants selon leur machine d'exécution, ce qui contredisait l'ordre logique des dépendances.

**Deuxième version** — cadres remplacés par des colonnes titrées, mais `Application web`, `Paquet de types partagés`, `Base du navigateur` et `Paquet d'interface` empilés dans une même colonne : **quatre traits parallèles descendaient sur toute la hauteur** sans qu'on puisse suivre lequel allait où.

**Version retenue** — **cinq bandes horizontales** : services extérieurs, clients, serveurs, paquets partagés, bases. Chaque dépendance descend d'une bande à la suivante ; **deux seulement** empruntent une gouttière verticale. Aucun trait ne traverse la planche.

**Ce que cet épisode enseigne, et qui vaut pour les planches suivantes** : sur un diagramme dense, **c'est le placement qui décide de la lisibilité, pas le routage**. Router proprement des composants mal placés ne produit qu'un labyrinthe bien tracé. La bonne question à se poser avant de placer quoi que ce soit est : *dans quel sens les flèches doivent-elles aller ?* Ici la réponse était « toujours vers le bas », et la disposition en a découlé.

**Les cadres de déploiement sont retirés de la 7.6** : ils font double emploi avec la figure 7.7, dont c'est précisément l'objet. La 7.6 dit **de quels blocs le système est fait**, la 7.7 dit **où ils s'exécutent**.

---

## D-69 — La police à l'écran est un levier de lisibilité, et je ne m'en étais jamais servi

**Constat** : l'auteur a demandé une planche « plus lisible ». J'ai d'abord cherché du côté du placement et des écarts. Le vrai levier était ailleurs, et il était dans la formule que j'applique depuis le début :

> police sur papier = 468 × police à l'écran ÷ largeur du canevas

**Elle se lit dans les deux sens.** J'avais figé la police à 14 en la traitant comme une règle, alors que c'était un **plancher** : 14 était la plus petite valeur qui garantisse 8 pt sur le papier à 770 de large. Rien n'interdisait de monter.

| Police à l'écran | Police sur papier |
|---:|---:|
| 14 | 8,5 pt |
| **18** | **10,9 pt** |
| 20 | 12,2 pt |

**La figure 7.6 est passée de 8,5 à 11,2 pt sur le papier** — un tiers de plus — sans rien retirer de son contenu. La seule contrainte est que le texte tienne encore dans les boîtes : cela vaut pour les planches à libellés courts, pas pour les diagrammes de classes, dont les lignes d'attributs fixent déjà la largeur.

**Deuxième correction, sur les écarts.** Les gouttières entre colonnes faisaient 40 points quand les bandes horizontales en faisaient 110. Ce déséquilibre donnait une planche à la fois serrée en largeur et vide en hauteur. Écarts égalisés : **60 points entre colonnes, 80 entre bandes**.

**Le contrôle mentait aussi.** Il calculait la police sur papier en supposant 14 à l'écran. Il lit désormais la police réellement employée dans le fichier — sans quoi il aurait annoncé 8,7 pt là où la planche en fait 11,2.

**Arbitré** : les seize autres figures **restent en police 14**, à 8,5 pt. La figure 7.6 **garde ses 11,2 pt** — c'est celle que l'auteur avait trouvée illisible, et la ramener au plancher aurait annulé la correction demandée.

L'écart entre planches se justifie et se défend : **la police n'est pas un choix esthétique, elle est contrainte par le texte le plus long de la planche**. Un diagramme de classes porte des lignes d'attributs de trente caractères qui fixent la largeur des boîtes, donc la police. Un diagramme de composants porte des noms de deux mots. Écrire les deux à la même taille reviendrait à imposer au second la contrainte du premier, sans raison. Un jury ne mesure pas les polices d'une figure à l'autre : il remarque celles qu'il n'arrive pas à lire.

---

## D-70 — Figure 7.7 refaite : l'espace vide porte les annotations obligatoires

**Constat** : la première version souffrait du même défaut que la 7.6. Le poste autonome contient quatre artefacts, les deux autres nœuds n'en contiennent que deux : le cadre du bas était donc dimensionné pour le plus grand, et **un tiers de sa surface restait vide** sous les deux petits.

**Décision** : le poste autonome occupe à lui seul la hauteur des deux autres nœuds — ce qui **fait voir sa différence de taille**, exigée par la fiche comme point pédagogique — et **l'espace laissé libre porte deux des cinq annotations obligatoires** de la fiche `UML-DEP-01` :

- sous le navigateur, le chiffrement AES-256-GCM de la file d'écritures hors ligne ;
- sous le poste connecté, le coffre de secrets chiffré au repos et lié au compte de session.

Le vide n'est pas comblé par du décor : il porte du contenu que la fiche réclamait et que la première version avait relégué dans la note générale.

**Les deux liens internes au poste autonome sont tracés** : `127.0.0.1` entre l'exécutable et le serveur embarqué, `accès fichier` entre le serveur embarqué et la base locale. Ils démontrent visuellement que **le serveur embarqué n'est joignable que depuis sa propre machine**.

**Résultat** : 770 × 1 160, 8,56 pt, aucun signalement sur les huit contrôles.

---

## D-71 — Figure 7.5 : les vingt-neuf classes en noms seuls, et les quatorze liens inter-packages

**Décision, sur recommandation validée par l'auteur** : le diagramme de classes du système montre **les vingt-neuf classes, noms seuls, groupées dans quatre cadres de package**, et **uniquement les quatorze associations qui traversent les packages**.

**Ce qui est écarté et pourquoi.** Redessiner les attributs, les opérations et les cinquante-cinq associations internes revenait à une planche de 5 318 points de hauteur cumulée. Le calcul a été fait de deux à six colonnes, en portrait comme en paysage : **aucune combinaison ne tient**, la largeur croissant plus vite que la hauteur ne diminue. La seule variante possible descendait le texte sous cinq points. Les quatre planches par package portent déjà ce détail ; la planche d'ensemble n'a pas à le répéter.

**Ce que la planche apporte, et que rien d'autre ne donnait dans le mémoire** : la façon dont les cinq packages tiennent ensemble. Trois faits s'y lisent sans commentaire.

| Fait | Ce qu'il montre |
|---|---|
| **Référentiels est le pivot** — douze des quatorze associations en partent ou y aboutissent | c'est lui qui alimente le parcours de soin en médicaments, examens, pathologies et soignants |
| **Sécurité ne touche le domaine médical que par deux liens**, tous deux via les référentiels | le compte utilisateur ne connaît **ni patient ni consultation** : la séparation est structurelle, pas seulement affaire de permissions |
| **Dossier patient et Parcours de soin ne se rejoignent que par un seul lien** — le patient et sa visite | tout le reste du parcours passe par la consultation, ce qui confirme le choix de modélisation du § 7.3 |

**Deux ajustements de tracé** ont été nécessaires. `CategoriePatient` est placée en dernier dans le cadre Référentiels pour que son lien vers `Patient` soit un segment court. Et `Site` — qui doit rester en tête pour son lien vers `Visite` — voit son lien vers `Patient` routé dans la gouttière de gauche plutôt qu'à travers les six classes qui la suivent.

**Résultat** : 770 × 1 020, **8,75 pt**, aucun signalement sur les huit contrôles.

---

## D-72 — Un paragraphe nomme les quatorze relations inter-packages, et la figure 7.5 les porte

**Constat de l'auteur** : la première version de la figure 7.5 ne portait ni verbe ni multiplicité, et les liens se chevauchaient. Trois demandes : les cardinalités aux deux extrémités, le verbe au milieu de chaque lien, et un espacement qui rende la planche lisible.

**Le blocage** : les quatorze liens de la 7.5 sont exactement les liens **inter-packages**, et la décision **D-56** avait établi que le mémoire n'en nomme aucun — c'est pourquoi les planches 7.1 à 7.4b ne portent que les multiplicités sur leurs liens en pointillés. Sur quatorze, **deux seulement** avaient un verbe sourçable.

**Décision, sur arbitrage de l'auteur** : un paragraphe est ajouté au § 7.3, avant l'annonce des planches, qui décrit comment les cinq packages se tiennent et **nomme les quatorze relations**. Il source les douze verbes manquants et comble un manque réel — rien dans le mémoire ne décrivait l'articulation entre packages.

| Lien | Verbe | Multiplicités |
|---|---|---|
| `Utilisateur` — `Site` | appartient à | 0..* → 1 |
| `Utilisateur` — `PersonnelMedical` | correspond à | 0..1 → 0..1 |
| `Site` — `Patient` | enregistre | 1 → 0..* |
| `Site` — `Visite` | accueille | 1 → 0..* |
| `CategoriePatient` — `Patient` | classe | 1 → 0..* |
| `PersonnelMedical` — `Consultation` | conduit | 1 → 0..* |
| `DelegationPrescription` — `Consultation` | autorise | 0..1 → 0..* |
| `DelegationPrescription` — `Ordonnance` | couvre | 0..1 → 0..* |
| `PathologieReference` — `DiagnosticConsultation` | nomme | 1 → 0..* |
| `MedicamentReference` — `LigneOrdonnance` · `LigneBonPharmacie` | désigne | 0..1 → 0..* |
| `TypeExamen` — `LigneOrdonnance` | désigne | 0..1 → 0..* |
| `TypeExamen` — `LigneExamen` | désigne | 1 → 0..* |
| `Patient` — `Visite` | ouvre | 1 → 0..* |

**Chaque verbe traduit un fait vérifiable** : `enregistre` le champ qui retient le site de création du dossier, `conduit` le soignant porté par la consultation, `couvre` l'identifiant de délégation inscrit sur l'ordonnance. Le mot `affecté à` a été **écarté** pour le compte utilisateur : le mémoire dit que le personnel médical n'est affecté à aucun site en propre, l'employer aurait créé une contradiction.

**Contrôle après insertion** : 2 601 paragraphes avant, **2 602** après, un seul ajouté, au bon endroit.

### La géométrie qui rend les quarante-deux étiquettes lisibles

Quatorze liens portant chacun un verbe et deux multiplicités font **quarante-deux étiquettes**. Trois règles ont suffi :

1. **Verbe au-dessus du trait, multiplicités en dessous.** Ils ne sont jamais à la même hauteur, donc ne se recouvrent pas même dans une gouttière étroite.
2. **Gouttières de 120 points** entre les colonnes, obtenues en ramenant les boîtes à 130 points et en coupant les noms longs sur deux lignes.
3. **Position variable le long du trait.** Quand deux liens partent d'une même classe ou arrivent sur la même, leurs multiplicités sont placées à des distances différentes — 0,64 et 0,88 de la longueur — et décalées latéralement. C'est ce qui a résolu les six derniers chevauchements.

**Résultat** : 770 × 990, **9,02 pt sur papier**, aucun signalement sur les huit contrôles.

---

## D-73 — Deux cadres qui échangent des liens doivent être alignés à la même hauteur

**Constat de l'auteur, sur la figure 7.5** : « tout est mélangé ». Les huit liens entre Référentiels et Parcours de soin formaient un éventail illisible.

**La cause n'était ni le nombre de liens ni les étiquettes.** Les deux cadres n'étaient pas alignés : les Référentiels occupaient la moitié basse de la planche, le Parcours de soin la moitié haute. Chaque lien devait donc **remonter** la hauteur d'un demi-cadre, et les huit remontées se croisaient dans la même bande étroite.

**Correction, en deux gestes.**

1. **Les deux cadres commencent à la même hauteur.** Le décalage disparaît, et avec lui la remontée systématique.
2. **Chaque classe des Référentiels est placée en face de ce qu'elle alimente.** `Site` face à `Visite`, `PersonnelMedical` face à `Consultation`, `MedicamentReference` face à `LigneOrdonnance`, `TypeExamen` face à `LigneExamen`. Les liens deviennent courts et presque horizontaux.

**Résultat mesurable** : sur les huit liens, **cinq sont maintenant quasi horizontaux** et les trois autres franchissent au plus une boîte de hauteur. Il n'y a plus d'éventail.

**Un cas restait à traiter.** `Patient` doit atteindre `Visite`, qui se trouve deux colonnes plus loin. Le lien est routé **par-dessus le cadre des Référentiels**, ce qui n'est possible que parce que `Patient` est la première boîte de son cadre et que les Référentiels commencent plus bas. C'est ce qui a dicté l'ordre des trois cadres de la colonne de gauche : Dossier patient en haut, Sécurité en dessous.

**Règle à retenir pour toute planche à venir** : avant de router quoi que ce soit, **aligner les cadres qui échangent des liens et ordonner leur contenu pour que les liens soient les plus courts possible**. Un lien court se lit sans effort ; un lien long finit toujours par croiser un autre.

**Résultat** : 770 × 1 130, **9,02 pt sur papier**, aucun signalement sur les huit contrôles.

---

## D-74 — Treize classes sans trait sur la figure 7.5 : le relevé, et ce que la planche en dit

**Question de l'auteur** : pourquoi certaines classes n'ont-elles aucune relation, et est-ce normal en UML ?

**Relevé fait sur `INV-02`, classe par classe.** Treize des vingt-neuf ne portent aucun trait sur la figure 7.5 : `UtilisateurRole`, `Role`, `RolePermission`, `Permission`, `DroitCategoriePatient`, `IdentitePatient`, `EmployeSaris`, `RattachementAyantDroitCdi`, `RattachementSousTraitant`, `ConstanteVitale`, `BonExamen`, `BonPharmacie`, `Evacuation`.

**Ce n'est pas une anomalie, c'est la conséquence de ce que la planche montre** : elle ne trace que les associations **inter-packages**. Une classe sans trait est une classe dont toutes les relations restent dans son package — `BonPharmacie` en a trois, toutes internes au Parcours de soin, et toutes tracées sur la planche 7.4b.

**Le point vérifié, qui est celui qui compte** : **aucune des vingt-neuf classes n'a un degré nul**. Le degré total va de 1 à 8 — `Consultation` est la plus liée avec huit associations, `Permission`, `DroitCategoriePatient`, `IdentitePatient`, `RattachementSousTraitant`, `PathologieReference`, `ConstanteVitale` et `Evacuation` en ont une. **Il n'y a aucune classe orpheline dans le modèle.**

**Ce que dit UML.** Une classe isolée est *permise* par la norme, mais dans un modèle de domaine c'est presque toujours un défaut de conception : une entité qui ne participe à aucune relation n'a pas de raison d'exister. Ce n'est pas notre cas — et il faut pouvoir le démontrer, pas seulement l'affirmer.

**Conséquence, en application de la règle R4** : la note de la planche énonce le fait en trois lignes. Une planche doit répondre elle-même aux questions qu'elle soulève ; sinon le lecteur conclut à un oubli, et il a raison de le faire.

---

## D-75 — Une gouttière se dimensionne au nombre de liens qu'elle porte, pas par symétrie

**Constat de l'auteur** : sur la figure 7.5, « les verbes ne sont pas au bon endroit, tout est désordonné ».

**La cause, mesurée.** Les deux gouttières faisaient 120 points chacune, par symétrie. Or elles ne portent pas la même charge : celle de gauche porte **quatre** liens, celle de droite en porte **huit**, soit **vingt-quatre étiquettes** — huit verbes et seize multiplicités — dans la même largeur. Les verbes étaient bien au milieu de leur trait ; c'est le milieu qui était encombré.

**Correction, en trois gestes.**

1. **Gouttières dimensionnées à la charge** : 90 points à gauche pour quatre liens, **174 à droite** pour huit. La largeur totale reste dans le gabarit.
2. **Boîtes espacées de 26 points** au lieu de 10 dans les deux cadres qui échangent. Comme le milieu d'un lien se situe à mi-hauteur entre sa source et sa cible, **écarter les boîtes écarte les milieux dans la même proportion**. Les neuf verbes de la gouttière droite passent d'un écart moyen de 40 points à un écart moyen de 64.
3. **Deux verbes restaient superposés** — `couvre` et `nomme`, dont les liens se croisent et dont les milieux tombaient à quatre points l'un de l'autre. Ils sont décalés horizontalement de part et d'autre du point de croisement, sans quitter le milieu de leur trait.

**Règle générale à retenir** : la largeur d'une gouttière se calcule sur **le nombre d'étiquettes qu'elle doit porter**, et l'espacement des boîtes n'est pas une question d'esthétique — **il commande directement l'écartement des étiquettes de lien**.

**Résultat** : 770 × 1 170, **8,66 pt sur papier**, aucun signalement sur les huit contrôles.

---

## D-76 — Sept fausses clés étrangères dans la fiche 8.1, et une figure engendrée depuis le schéma

**Constat**, avant toute composition. La fiche `SCH-REL-01` a été confrontée au schéma de données ligne à ligne. **Sept colonnes qu'elle présentait comme clés étrangères ne sont, dans la base, que des colonnes ordinaires** : `PersonnelMedical.siteId`, `Visite.soignantId`, `ConstanteVitale.patientId`, `Ordonnance.prescripteurId`, `BonPharmacie.prescripteurId`, `BonExamen.etablissementId`, `Evacuation.motifId`. Aucune contrainte référentielle ne les protège.

**L'erreur était bien dans la fiche seule** : `INV-02` ne les compte pas parmi les 97 associations, et aucune des vingt figures ne les dessine. Le mémoire n'a donc rien à corriger — il aurait fallu le faire si la figure avait été composée sans vérification.

**Trois décomptes se contredisaient** : le cartouche de la fiche annonçait 38 clés étrangères, son corps en énumérait 50, le schéma en déclare **43**.

**Décision, sur arbitrage de l'auteur** : les sept colonnes sont écrites `REF: x → Table` et distinguées des `FK:`, avec une note de figure qui énonce que **l'intégrité y est portée par l'application et non par la base**. Le mémoire assume la caractéristique au lieu de la masquer — un jury qui ouvre le schéma trouvera exactement ce que la figure annonce.

**Changement de méthode, qui vaut pour la figure 8.2 à venir** : le bloc de la figure 8.1 est **engendré depuis le schéma de données**, table par table, et non recopié de la fiche. La fiche reste la spécification — objectif, notation, ordre des sections — mais **elle cesse d'être la source des contenus**. C'est la deuxième fois qu'une fiche se révèle en écart avec le code ; la première fois, c'était la figure 7.2 et ses trois liens oubliés.

**Livrable** : `07_figures_texte/FIG_8-1_schema_relationnel.md` — 29 relations, 43 clés étrangères, 7 colonnes de référence, ligne la plus longue 88 caractères, à composer en Consolas 8,5 pt.

---

## D-77 — Figure 8.2 en tableaux plutôt qu'en SQL, et deux décomptes corrigés

**Décision, sur arbitrage de l'auteur** : le modèle physique est présenté **en tableaux** — colonne, type, nullité, valeur par défaut, contrainte — et non en instructions `CREATE TABLE` comme la fiche le prévoyait. L'information est identique ; la forme respecte la consigne de l'auteur sur le code dans les documents, et se lit sans connaître le langage.

**Deux décomptes de la fiche étaient faux**, relevés avant composition :

| Élément | Fiche | Schéma |
|---|---|---|
| Types énumérés « au décompte de la migration initiale » | 6 | **4** à cette date, **6** aujourd'hui |
| `JSONB` | absent du tableau | **6 occurrences** |

Les cinq autres — `TEXT` 332, `TIMESTAMP(3)` 77, `INTEGER` 13, `BOOLEAN` 10, `DOUBLE PRECISION` 8 — sont exacts pour la migration initiale. **La figure retient l'état d'aujourd'hui**, recompté sur les 88 tables.

**Trois faits nouveaux, relevés et portés à la figure** : **76 index déclarés**, **35 contraintes d'unicité**, **102 relations dont 10 en suppression cascade**. Le mémoire ne les mentionnait nulle part.

**Ce que la figure démontre**, et qui n'était pas dit : l'index sur `updatedAt` existe sur **chaque table synchronisée**. Sans lui, la synchronisation devrait relire une table entière pour trouver ce qui a changé. **C'est la contrainte que le fonctionnement hors connexion impose au schéma** — le pendant technique du choix d'identifiants textuels expliqué au § A de la figure.

**Livrable** : `07_figures_texte/FIG_8-2_modele_physique.md`.

---

## D-78 — Les fiches de dessin ne sont plus la source des contenus

**Constat, après trois relevés successifs.** Trois fiches se sont révélées en écart avec le code : `UML-CLS-01` oubliait trois liens de la figure 7.2, `SCH-REL-01` annonçait sept clés étrangères inexistantes, `SCH-MPD-01` se trompait sur deux décomptes. Aucun de ces écarts n'a atteint le mémoire, parce que chaque figure a été confrontée au code avant d'être composée.

**Règle** : une fiche de dessin dit **ce que la figure doit démontrer, avec quelle notation et dans quel ordre**. Elle **ne fait plus foi sur les contenus** — noms, attributs, clés, décomptes — qui sont relevés dans le code ou dans les inventaires au moment de produire.

C'est la troisième déclinaison d'une même règle déjà posée par l'auteur : *le document Word fait foi sur le texte, les inventaires font foi sur les chiffres.* S'y ajoute désormais : **le code fait foi sur la structure.**

---

## D-79 — Le relevé de pages est périmé, et c'est le dernier point ouvert du mémoire

**Constat, au terme de la production des figures.** Le fichier `budget_pages.md` date du 19 août, **avant** que les figures soient produites. Trois de ses chiffres ne correspondent plus au document :

| Relevé du 19 août | Document au 4 septembre |
|---|---|
| 15 figures | **25 légendes de figure** dans le corps |
| 90 pages au total | **102** selon le compteur de Word, 93 au rendu LibreOffice |
| 76 pages de corps | à remesurer |

**Et les images ne sont pas collées.** Le document ne porte que dix fichiers image, dont ceux de la page de garde. Les vingt-deux figures produites n'occupent donc pas encore la place qui leur revient.

**Conséquence** : le volume final ne peut être connu qu'**après** le collage des images et la mise à jour des champs. Les deux exigences sont serrées — 75 à 90 pages de corps pour l'école, 70 à 85 pour le promoteur — et le relevé du 19 août notait déjà que la marge basse était mince.

**Ce qui reste à faire, et par qui.**

| # | Action | Qui |
|---|---|---|
| 1 | Poser au promoteur la question de la limite : corps ou document entier ? | **l'auteur — chemin critique** |
| 2 | Ctrl+A puis F9 : la liste des figures attend encore 7.4a et 7.4b | l'auteur |
| 3 | Coller les 22 images, puis refaire Ctrl+A / F9 | l'auteur |
| 4 | Composer les deux blocs textuels 8.1 et 8.2 | l'auteur |
| 5 | Prendre les trois captures 8.3, 8.4, 8.5 — **sans donnée patient réelle** | l'auteur |
| 6 | Remplir les huit « ▪ (nom) » de la dédicace | l'auteur |
| 7 | Relire les références bibliographiques | l'auteur |
| 8 | Refaire le relevé de pages et arbitrer s'il déborde | à deux |

**Les figures, elles, sont finies** : vingt-deux produites, zéro défaut aux huit contrôles. Il ne reste aucune figure à dessiner.

---

## D-80 — Les figures 8.1 et 8.2 restent textuelles : le dessin a été mesuré, il ne tient pas

**Question de l'auteur** : les figures 8.1 et 8.2 ont-elles été dessinées ?

**Non, et c'est délibéré.** La fiche `SCH-REL-01` le prescrit en toutes lettres — *« Format conseillé : A4 portrait, notation textuelle, non graphique »* — et en donne la raison : *« cette notation est plus lisible qu'un schéma graphique pour 29 tables »*.

**La mesure confirme la fiche.** Un schéma relationnel dessiné montre chaque table **avec toutes ses colonnes**, clés étrangères comprises. Les vingt-neuf tables totalisent **7 082 points de hauteur cumulée** — davantage que le diagramme de classes, qui en faisait 5 318. `Consultation` seule fait 584 points de haut, `ConstanteVitale` 532.

| Disposition | Largeur | Hauteur | Verdict |
|---|---:|---:|---|
| 2 colonnes | 630 | 4 081 | impossible |
| 3 colonnes | 1 000 | 2 707 | impossible |
| 4 colonnes | 1 370 | 2 020 | impossible |

Aucune disposition ne tient, en portrait comme en paysage. **Décision de l'auteur : la forme textuelle est conservée.**

**Bilan des figures** : **vingt dessinées, deux textuelles, trois captures d'écran à prendre.** Vingt-cinq légendes dans le corps, vingt-deux figures produites, zéro défaut aux huit contrôles.

**Les délimiteurs de bloc ont été retirés du fichier 8.1**, à la demande de l'auteur : le texte est identique au caractère près, mais il ne ressemble plus à du code.

---

## D-81 — L'outillage de production est retiré du mémoire

**Décision de l'auteur**, une fois les vingt-deux figures produites et contrôlées : les onze scripts déposés en août pour survivre aux réinitialisations sont **supprimés**. Ils avaient été autorisés tant qu'il restait des figures à produire ; il n'en reste plus.

**Vérifié après suppression** : le dossier du mémoire ne contient **plus aucun fichier de code**, et aucun document n'y fait référence.

**Conséquence pratique** : une figure qui devrait encore changer sera **modifiée directement dans son fichier `.drawio`**, comme cela a déjà été fait pour la figure 4.1 — repli du texte de trois étiquettes qui débordaient de la page — et pour les figures 6.2 et 6.6, dont un libellé d'ovale a été repris. La régénération à l'identique n'est plus garantie, mais les vingt fichiers sont validés et contrôlés : ils n'ont plus vocation à être reproduits, seulement retouchés.

**Rappel de la règle qui a présidé** : *si je ne demande pas d'introduire du code dans les fichiers, il ne faut pas le faire.* Elle s'applique désormais sans exception au dossier du mémoire.

---

## D-82 — Le fichier d'ensemble est assemblé : vingt-deux onglets

**Rappel de la décision D-47**, prise en août : une fois toutes les figures validées, les rassembler dans **un seul fichier draw.io à onglets**. C'est fait — l'auteur a dû me le rappeler, l'assemblage n'avait pas été lancé.

**`07_figures_drawio/FIG_00_TOUTES_LES_FIGURES.drawio`** — vingt-deux onglets, dans l'ordre du mémoire, chacun nommé de sa figure.

**Contrôle après assemblage, onglet par onglet** : pour les vingt figures dessinées, le nombre de formes, le nombre de liens et les dimensions de page sont **identiques aux fichiers d'origine**. Aucune n'a été altérée par le regroupement.

**Les figures 8.1 et 8.2 y figurent aussi**, ce que l'auteur a demandé explicitement. Elles ne se dessinent pas — leur onglet porte le **contenu textuel**, sur une page haute, avec une mention en tête : *« Onglet d'archive. Cette figure se compose en texte dans Word : un bloc de texte peut courir sur plusieurs pages, une image non. »* C'est la raison de fond pour laquelle elles restent textuelles, et elle est maintenant écrite là où on la cherchera.

**Les vingt fichiers individuels sont conservés.** Ils font foi si l'ensemble devait être reconstruit. À supprimer sur décision de l'auteur, une fois l'export des images terminé.

---

## D-83 — Sur la figure 7.2, la boîte de package nomme les classes qu'elle contient

**Question de l'auteur, posée deux fois** : pourquoi `PathologieReference`, `MedicamentReference` et `TypeExamen` n'ont-elles aucun lien sur la figure 7.2 ?

**Elles en ont un chacune** — une flèche de dépendance en pointillés qui descend vers la boîte de package `Parcours de soin`. Ces trois flèches résument **cinq associations** : la pathologie vers les diagnostics, le médicament vers les lignes d'ordonnance et de bon de pharmacie, le type d'examen vers les lignes d'examen et d'ordonnance.

**Mais la question a été posée deux fois, et c'est le signe que la planche ne répondait pas.** La boîte de package ne portait que son nom : le lecteur voyait trois flèches partir vers un rectangle dont il ignorait le contenu.

**Correction** : la boîte de package **nomme désormais les quatre classes** qu'elle contient et qui sont visées — `DiagnosticConsultation`, `LigneOrdonnance`, `LigneExamen`, `LigneBonPharmacie`. La destination des flèches se lit sur la planche, sans recourir à la note.

**Contrôle** : étendue 750 × 1 078 sur une page de 770 × 1 120, **8,74 pt sur papier**, rien hors page. La modification a été portée **dans le fichier individuel et dans le fichier d'ensemble**.

**Rappel du fait de fond, déjà relevé en D-60** : ces trois classes, plus `Site`, ont un **degré interne nul** — elles n'ont aucune association à l'intérieur de leur propre package. Un référentiel ne se référence pas lui-même : il est référencé par le domaine clinique. Aucune n'est isolée pour autant, leurs treize associations sortent toutes du package.

**La leçon, pour la troisième fois** : quand l'auteur pose deux fois la même question devant une planche, ce n'est pas la note qu'il faut compléter — **c'est la planche qui doit répondre**.

---

## D-84 — Une seule source pour les figures : le fichier à onglets

**Constat de l'auteur** : la correction de la figure 7.2 devait être portée dans le fichier à onglets. Elle l'avait été — dans les deux fichiers — mais la remarque touche un vrai risque : **tant que les vingt fichiers individuels coexistent avec le fichier d'ensemble, il y a deux sources qui peuvent diverger.** Une retouche faite dans l'un et pas dans l'autre passerait inaperçue.

**Décision de l'auteur** : les vingt fichiers individuels sont **supprimés**. Il ne reste que `FIG_00_TOUTES_LES_FIGURES.drawio`, vingt-deux onglets.

**Contrôle fait avant la suppression, et c'est celui qui comptait** : pour chacune des vingt figures, le nombre de formes, le nombre de liens et les dimensions de page du fichier d'ensemble ont été comparés à ceux du fichier individuel. **Les vingt sont identiques.** Après suppression : 22 onglets, 1 047 cellules, fichier valide.

**Règle** : toute modification d'une figure se fait désormais dans le fichier à onglets, et nulle part ailleurs. L'export des images s'y fait aussi — draw.io exporte la page affichée.
