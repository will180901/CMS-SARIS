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
**Conséquence** : le mémoire passe de 15 à **23 illustrations**. Les neuf planches de package occupent une demi-page chacune, deux par page.

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
**Conséquence** : **142 emplois, soit 6,07 pour 1000**. Deux limites posées. Les **faits mesurés restent impersonnels** — « le système expose 268 routes », jamais « nous avons compté 268 routes » : un chiffre s'affirme, il ne s'attribue pas. Et les **14 sections purement descriptives** — présentation de SARIS-CONGO, Processus Unifié, processus de consultation antérieur, catégories de patients — restent sans « nous », car ce ne sont pas nos décisions.
**Coût** : la première passe est montée à 101 pages, avec trois pages presque vides. Vingt-sept resserrements, sans perte d'information, ont ramené le document à **98 pages dont 84 de corps**.

## D-36 — La substitution « rapport de stage » → « recueil de l'existant » est refusée

**Décision** : le mémoire continue de citer le **rapport de stage** aux trois endroits où il le fait.
**Motif** : ce sont deux sources distinctes, et `sources_et_statut_des_preuves.md` le dit. Le recueil de l'existant fait autorité sur le besoin et le terrain médical ; le rapport de stage est la source de l'organisation informatique, du parc matériel et des applications en production. Faire la substitution attribuerait au recueil des faits qu'il ne contient pas.
**Conséquence** : correction proposée par Verdi, examinée, refusée avec motif. Une phrase d'attribution supprimée par erreur au chapitre 1 lors du resserrement a été rétablie : « Le rapport de stage apporte ici une précision qui compte. »
