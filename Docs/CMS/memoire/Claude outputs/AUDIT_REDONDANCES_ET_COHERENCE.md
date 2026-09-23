# Audit critique du mémoire — redondances, incohérences, cohérence d'ensemble

**Date** : 19 septembre 2026
**Document audité** : `Memoire_CMS_SARIS.docx`, version du 5 septembre 2026
**Périmètre** : les 8 chapitres, l'introduction, la conclusion, les 59 tableaux. 689 paragraphes de texte, 21 372 mots hors tableaux.
**Méthode** : lecture intégrale, puis mesure. Les 277 paragraphes de plus de 18 mots ont été comparés deux à deux par recouvrement de séquences. Aucun chiffre de ce rapport n'est estimé.

> **Rien n'a été modifié.** Ce document est un diagnostic.

---

## Règles de rédaction retrouvées, et qui encadrent tout ce qui suit

Je ne les ai pas inventées. Elles viennent du registre des décisions, du carnet de bord et de la checklist de conformité.

| Règle | Source | Ce qu'elle interdit ici |
|---|---|---|
| La critique formelle de l'existant appartient au **chapitre 5** ; le chapitre 2 ne garde que de **brefs constats** | D-22 | déplacer de la critique vers le chapitre 2 |
| Certaines sections existent **parce que le plan de l'école les exige** — dont **2.1, 2.6, 3.4, 3.7** et le § 1.5 | checklist 1.2 | **supprimer 2.6 ou 3.2**, même si elles répètent |
| Le **document Word fait foi sur le texte**, les inventaires sur les chiffres | D-17 | corriger un chiffre du Word sans l'avoir recompté |
| **Rien ne s'invente** ; une source absente reste déclarée absente | D-10, D-14 | combler une lacune pour supprimer sa répétition |
| Français simple, phrases courtes ; paragraphes d'au plus 95 mots ; pas de fusion devant une idée neuve | D-26, D-27 | fusionner deux paragraphes qui ouvrent chacun une idée |
| Le mémoire est au **« nous »**, mais **les faits mesurés restent impersonnels** | D-35 | réécrire un chiffre en « nous avons compté » |
| **Le plafond de pages est levé à 150** | QO-09, note de passation du 18 septembre | raccourcir pour raccourcir |

**Conséquence directe** : l'objectif de cet audit n'est pas de réduire le volume. Il est de supprimer ce qui se répète *sans rien apporter*, et de corriger ce qui est *faux ou contradictoire*.

---

# PARTIE 1 — CE QUI EST FAUX

Trois points. Ils ne relèvent pas du style : ce sont des erreurs qu'un jury peut établir.

## A1 · Le chapitre 7 annonce encore 268 routes

**Ce que j'ai identifié.** Au § 7.2, sur l'architecture de sécurité : *« Cent cinquante et une routes sur **deux cent soixante-huit** sont ainsi couvertes. »*

**Pourquoi c'est un problème.** Le système en compte **273**. Le chiffre a été corrigé partout le 5 septembre — chapitre 7, chapitre 8, conclusion — sauf ici. Il a survécu parce qu'il est **écrit en toutes lettres** : le contrôle cherchait la chaîne « 268 ». Le même document affirme donc 273 à quatre endroits et 268 à un seul. C'est exactement la contradiction qu'un jury attentif relève, et elle coûte cher : elle donne à penser que les auteurs ne maîtrisent pas leurs propres chiffres.

**Ce que je propose.** Remplacer par : *« Cent cinquante et une routes sur deux cent soixante-treize sont ainsi couvertes. »*

**Pourquoi cette solution.** C'est la seule qui rétablisse la cohérence sans toucher au reste de la phrase.

**Ce que cela change.** Un mot. Aucun effet sur la mise en page ni sur les renvois.

> **Point connexe, à trancher séparément.** L'audit du 5 septembre avait relevé que « 151 routes auditées » se discute : l'intercepteur ne journalise que les **mutations**, soit 110 routes sur les 151 placées sous audit. La formulation exacte serait *« Cent cinquante et une routes sur deux cent soixante-treize portent le décorateur d'audit ; les cent dix mutations qu'elles contiennent sont journalisées. »* Je ne le propose pas dans le même geste : c'est une précision de fond, pas une correction d'erreur.

## A2 · Le chapitre 8 contredit le chapitre 7 sur la synchronisation

**Ce que j'ai identifié.** Au § 8.3 : *« **Trente-cinq** entités sur les **cinquante-deux** concernées sont synchronisées hors connexion. »*

Or le § 7.4 écrit : *« **Quarante-six** entités sur 88 sont synchronisées : quarante-deux en portée globale et quatre par site. »* Et la conclusion générale écrit : *« 46 entités synchronisées hors connexion. »*

**Pourquoi c'est un problème.** Le document donne **trois nombres différents** pour la même grandeur : 35, 52 et 46. Le 52 est l'ancien chiffre, corrigé le 5 septembre ; il a survécu pour la même raison que le précédent — écrit en lettres. Le 35 n'a de source nulle part dans le dossier. Deux chapitres voisins se contredisent sur un chiffre que la conclusion reprend : c'est la contradiction la plus facile à trouver du document.

**Ce que je propose.** Deux possibilités, et **je ne peux pas trancher seul** :

1. Si le chiffre voulu est celui du registre de synchronisation — 46 entités sur 88 —, écrire : *« La synchronisation reste partielle côté client de bureau autonome : quarante-six entités sur quatre-vingt-huit sont synchronisées hors connexion. »*
2. Si « trente-cinq sur cinquante-deux » désignait autre chose — par exemple les seules entités effectivement éprouvées sur le poste autonome —, alors la phrase doit le dire, et il faut une source.

**Pourquoi cette solution.** La première option aligne le chapitre 8 sur le chapitre 7 et sur la conclusion, qui sont déjà d'accord entre eux et adossés au registre `sync-models.ts`. La seconde préserve une information si elle existe — mais **je n'en ai trouvé la trace nulle part**, ni dans le mémoire, ni dans les inventaires.

**Ce que cela change.** Une phrase. Le § 8.3 cesse de contredire le § 7.4.

## A3 · Une affirmation fausse au § 7.3, et c'est la deuxième fois

**Ce que j'ai identifié.** Après la ventilation des 59 entités écartées du diagramme de classes, le § 7.3 écrit : *« **La plupart** sont des fonctions techniques ou transverses. »*

**Pourquoi c'est un problème.** Le comptage se fait sur la phrase précédente, qui est dans le même paragraphe : 13 sécurité et audit · 11 satellites du dossier patient · 8 synchronisation · 7 messagerie · 7 personnel · 7 suivis de soin · 6 référentiels secondaires.

| | |
|---|---:|
| Techniques ou transverses — sécurité et audit, synchronisation, messagerie | **28** |
| Métier — satellites du dossier, personnel, suivis de soin, référentiels | **31** |
| Total | 59 |

**28 sur 59 n'est pas « la plupart ».** C'est une minorité, et le lecteur peut le vérifier en additionnant les sept nombres de la phrase d'avant.

Ce point mérite une mention particulière : **la décision D-31 avait déjà corrigé cette erreur**. La phrase d'origine affirmait que les 59 relevaient de « domaines techniques ou transverses » ; elle avait été retirée précisément parce que 11 sont des satellites du dossier patient et 7 des suivis de soin, donc du métier pur. La formulation actuelle est la même erreur, atténuée par « la plupart » — et elle reste fausse.

**Ce que je propose.** *« Un peu moins de la moitié relèvent de fonctions techniques ou transverses — la sécurité, la synchronisation et la messagerie. Les autres ajoutent du détail à une entité déjà présente sur la planche, sans en changer la structure. »*

**Pourquoi cette solution.** Elle est exacte, elle se vérifie sur les sept nombres qui précèdent, et elle conserve entièrement l'argument : les 59 écartées n'appauvrissent pas le modèle du domaine.

**Ce que cela change.** Une phrase. L'argument du § 7.3 est inchangé, et devient vérifiable.

---

# PARTIE 2 — LES REDONDANCES

## B1 · § 2.7 « Premiers constats » et la conclusion du chapitre 2 disent la même chose, à deux paragraphes d'intervalle

**Ce que j'ai identifié.** Recouvrement mesuré : **25 %**, le plus élevé du document entre deux paragraphes voisins.

| § 2.7 Premiers constats | Conclusion du chapitre 2 |
|---|---|
| « Le centre ne disposait d'aucun système d'information médical, alors que l'entreprise exploitait un parc applicatif structuré. » | « Le Service Médico-Social fonctionnait sans aucun système d'information médical. » |
| « Les deux seuls outils informatiques mis en place au centre avaient échoué pour la même raison : la perte des données d'une session à l'autre. » | « Les deux seuls outils informatiques en usage au centre avaient échoué pour la même raison : la perte des données d'une session à l'autre. » |
| « les échanges avec le service administratif transitaient exclusivement par le papier et par l'oral, sans trace ni possibilité de suivi » | « Les flux avec le service administratif transitaient exclusivement par le papier et par l'oral, sans trace ni possibilité de suivi. » |

La deuxième ligne est **identique à deux mots près**. La troisième aussi.

**Pourquoi c'est un problème.** Ce n'est pas une répétition pédagogique séparée par vingt pages : les deux paragraphes se suivent presque. Le lecteur lit deux fois la même phrase en trente secondes. C'est le genre de défaut qu'un directeur de mémoire relève immédiatement, et il affaiblit la conclusion du chapitre, qui devrait apporter la synthèse et n'apporte qu'un doublon.

**Ce que je propose.** Garder **les deux sections** — elles ont chacune une fonction — mais leur donner des contenus distincts :

- **§ 2.7 « Premiers constats »** garde les trois constats, qui sont sa raison d'être, et garde sa dernière phrase, qui renvoie la critique formelle au chapitre 5 (règle D-22).
- **La conclusion du chapitre 2** cesse de les répéter et fait ce qu'une conclusion de chapitre doit faire : rappeler **ce que le chapitre a établi comme matériau** — les quatre supports de l'information médicale, leur portée locale à chaque site, l'absence de lien entre Moutela et Nkayi — puis annoncer le chapitre 3.

**Pourquoi cette solution est préférable.** Supprimer l'une des deux sections serait une faute : les sept autres chapitres ont tous une « Conclusion du chapitre », et le § 2.7 est la contrepartie, au chapitre 2, de ce que le plan de l'école attend. Les faire diverger conserve la structure et supprime le doublon.

**Ce que cela change.** Un paragraphe réécrit, environ 90 mots. Aucun renvoi ne pointe sur la conclusion du chapitre 2. Aucun chiffre en jeu.

## B2 · La problématique est énoncée trois fois, dont deux quasi mot pour mot

**Ce que j'ai identifié.** Recouvrement mesuré entre l'introduction générale et le § 3.2 : **88 %**. C'est le plus fort du document.

Les trois énoncés :

| Emplacement | Contenu |
|---|---|
| Introduction générale | « Comment concevoir et réaliser un système … quatre conditions à la fois ? Tenir un seul dossier par patient sur les deux sites. Appliquer sans erreur les règles de prise en charge par catégorie. Garder la trace de chaque acte. Et continuer de fonctionner sans connexion réseau. » |
| **§ 3.2 Problématique** | **la même phrase, aux mots « Ce contexte pose une question centrale » près** |
| Conclusion générale | la même question, reformulée en ouverture : « Notre travail est parti d'une question… » |

Le paragraphe suivant — celui qui expose la contradiction entre relier deux sites et fonctionner sans réseau — est lui aussi repris **deux fois** : § 3.2 et conclusion générale, 25 % de recouvrement.

**Pourquoi c'est un problème — et pourquoi ce n'en est un qu'à un seul endroit.** Il faut distinguer les trois cas, et c'est ici que la critique doit être précise :

- **L'introduction doit poser la problématique.** C'est sa fonction. Elle reste.
- **La conclusion doit la reprendre.** C'est une convention académique : la conclusion rappelle la question pour y répondre. Elle reste, et sa reformulation est d'ailleurs déjà différente.
- **Le § 3.2 la répète à l'identique, vingt pages après l'introduction, sans rien y ajouter.** C'est là qu'est le défaut.

**Ce que je propose.** **Ne pas supprimer le § 3.2** : la checklist établit qu'il fait partie des sections ajoutées d'après le plan de l'école. Le réécrire pour qu'il fasse ce que l'introduction ne peut pas faire : **fonder la question sur ce que les chapitres 1 et 2 viennent d'établir**.

Concrètement, le § 3.2 poserait la même question, mais adossée aux faits désormais acquis : neuf catégories de patients aux droits différents établies au § 1.3, deux sites sans lien informatique établis au § 1.4, quatre supports papier et tableur établis au § 2.5, deux outils déjà en échec établis au § 2.4. La question cesse alors d'être une redite pour devenir une déduction.

**Pourquoi cette solution est préférable.** Elle conserve la section exigée, supprime la redite, et **renforce la logique du document** : la problématique n'est plus affirmée deux fois, elle est posée une fois puis démontrée.

**Ce que cela change.** Un paragraphe réécrit au § 3.2, environ 100 mots. Le second paragraphe du § 3.2 — celui de la contradiction — est conservé tel quel : c'est lui qui porte la difficulté du sujet, et sa reprise en conclusion est légitime.

## B3 · § 3.1 « Contexte du projet » redit les chapitres 1 et 2

**Ce que j'ai identifié.** Le § 3.1 tient en deux paragraphes. Chaque fait qu'il énonce a déjà été établi :

| Ce que dit le § 3.1 | Où c'est déjà établi |
|---|---|
| soins de premier recours sur deux sites distants, Moutela et Nkayi | § 1.2 et § 1.4 |
| neuf catégories de personnes, du travailleur permanent au riverain | § 1.3 et tableau 1.2 |
| le personnel n'est affecté à aucun site en propre, il tourne par permutation | § 1.4, deux fois |
| tout reposait sur le papier et le tableur | § 2.4, § 2.5 |
| le carnet de santé portait l'information d'une étape à l'autre | § 2.5, plus en détail |
| chaque site tenait ses registres, le Médecin Chef consolidait à la main | § 1.4 et § 2.5, deux fois chacun |
| aucun lien informatique entre Moutela et Nkayi | § 1.4, § 2.2, § 2.5 |

Recouvrement mesuré avec l'introduction générale seule : **20 %**. Avec les chapitres 1 et 2 réunis, la totalité des faits est redite.

**Pourquoi c'est un problème.** C'est la redondance la plus coûteuse du document, et probablement celle que votre directeur a perçue sous le nom de « chapitre 3 contre 2.6 ». Le chapitre 3 s'ouvre sur une page qui n'apprend rien à qui a lu les deux chapitres précédents. Or le chapitre 3 est le chapitre du **domaine d'étude** : c'est là que le mémoire doit passer de la description à l'analyse. Commencer par redire affaiblit ce basculement.

**Ce que je propose.** Réduire le § 3.1 à **un paragraphe de transition** qui ne redit rien mais rassemble : ce que les deux chapitres précédents ont établi du centre et de son informatique est le contexte ; ce chapitre en tire les caractéristiques de domaine. Puis enchaîner sur la problématique.

**Pourquoi cette solution est préférable à la suppression pure.** Un chapitre ne peut pas s'ouvrir sur une sous-section « Problématique » sans mise en situation. Et le § 3.1 est nommé dans le sommaire et la table des matières : le retirer créerait un trou dans la numérotation 3.1 à 3.9.

**Ce que cela change.** Le § 3.1 passe de deux paragraphes à un. **Attention à une conséquence** : le § 3.4 commence par « **Cette** configuration pose trois problèmes » — le démonstratif renvoie au § 3.1. Si le § 3.1 est resserré, cette phrase doit être reprise, sinon elle devient orpheline. Je l'ai vérifié : c'est le seul renvoi implicite au § 3.1 dans tout le document.

## B4 · § 2.6 « Domaine du projet » — le point soulevé par votre directeur

**Ce que j'ai identifié.** Le § 2.6 annonce que le domaine couvert est le parcours de soin, présente les trois domaines fonctionnels du service (tableau 2.6), puis écrit : *« Cette délimitation est une décision de cadrage, que nous justifions au chapitre 3. »*

Le § 3.8 « Périmètre retenu et solution proposée » reprend les trois métiers, explique pourquoi ils ne peuvent pas être traités ensemble, et énonce le périmètre.

**Pourquoi c'est un problème — et pourquoi il faut être prudent.** Le § 2.6 annonce une décision et en renvoie la justification vingt pages plus loin. Le lecteur lit donc deux fois la même liste de trois domaines, sans que la première lui serve.

**Mais le § 2.6 ne peut pas être supprimé.** La checklist de conformité établit qu'il fait partie des sections **ajoutées d'après le plan officiel de l'école** — au même titre que les §§ 2.1, 3.4 et 3.7. Le retirer ferait perdre un point de conformité au plan, ce qui est un risque plus grave que la redondance qu'il crée.

**Ce que je propose.** Garder la section et le tableau 2.6, et changer ce qu'elle fait. Aujourd'hui elle *annonce un périmètre*. Elle devrait *délimiter un domaine* — ce qui est sa vraie fonction au chapitre 2, chapitre de l'existant : dire quel domaine du service est informatisé et lequel ne l'est pas. La sélection du périmètre, elle, reste entièrement au § 3.8.

**Pourquoi cette solution est préférable.** Elle sépare nettement deux questions que le document confond : *de quel domaine parle-t-on* (chapitre 2, constat) et *quel périmètre a-t-on retenu et pourquoi* (chapitre 3, décision). Chaque section garde alors une fonction propre.

**Ce que cela change.** Deux ou trois phrases au § 2.6. Le tableau 2.6 est conservé. Le § 3.8 n'est pas touché. La phrase « que nous justifions au chapitre 3 » disparaît, ce qui supprime le renvoi en avant.

## B5 · § 3.6 « Intérêts du sujet » et les « apports » de la conclusion générale

**Ce que j'ai identifié.** Recouvrement mesuré : **18 %**. Les deux passages suivent la même structure en trois niveaux et partagent une phrase presque à l'identique.

| § 3.6 Intérêts du sujet | Conclusion générale |
|---|---|
| intérêt **pratique** pour le centre : dossier unique, suppression des ressaisies, règle automatisée, fonctionnement sans réseau | apports **pour le Centre** : supprime les ressaisies, consolide les historiques, applique uniformément la règle |
| intérêt **académique** : « La difficulté principale n'a pas été algorithmique mais architecturale : faire coexister deux modes d'exécution du même code. » | apports **pour la formation** : « La difficulté dominante n'a pas été algorithmique mais architecturale : faire coexister deux modes d'exécution d'un même code. » |
| intérêt **méthodologique** : « un problème récurrent dans la sous-région : concevoir un système de santé pour un environnement où la connectivité n'est pas acquise » | apports **pour le domaine** : « un problème récurrent dans la sous-région : concevoir pour un environnement où la connectivité n'est pas acquise » |

**Pourquoi c'est un problème.** La phrase sur la difficulté architecturale est la formule la plus mémorable du mémoire. L'entendre deux fois, à quatre-vingts pages d'écart, n'est pas grave. Mais **au § 3.6, elle est prématurée** : le mémoire n'a encore rien montré de l'architecture, et l'auteur annonce déjà sa conclusion. C'est un défaut de progression, pas de volume.

**Ce que je propose.** Au § 3.6, formuler l'intérêt académique **au futur du travail à conduire** plutôt qu'au passé du résultat obtenu : ce que le projet exigeait, non ce qu'il a démontré. La phrase sur la difficulté architecturale reste, mais **seulement en conclusion**, où elle est à sa place.

**Pourquoi cette solution.** Elle respecte la progression que le lecteur attend : le chapitre 3 annonce un enjeu, la conclusion livre un enseignement. Aujourd'hui les deux disent la même chose au même temps.

**Ce que cela change.** Deux phrases au § 3.6. La conclusion générale n'est pas touchée.

## B6 · Trois mécanismes techniques racontés deux fois, au chapitre 7 puis au chapitre 8

**Ce que j'ai identifié.**

| Mécanisme | Chapitre 7 | Chapitre 8 | Recouvrement |
|---|---|---|---|
| Le battement du canal temps réel, et le fait qu'il porte un type différent de la notification | § 7.4, dernier paragraphe | § 8.6, sixième difficulté | **22 %** |
| L'option de requête acceptée par un moteur et refusée par l'autre | § 7.1 | § 8.6, difficultés moindres | mesuré |
| Les permissions déployées sans exister en base | § 8.5 | § 8.6, troisième difficulté | mesuré |

Sur le premier, la phrase *« ce battement porte un type différent de celui de la notification ; sans cela, les postes se synchroniseraient à chaque battement »* figure **deux fois, presque mot pour mot**.

**Pourquoi c'est un problème — et jusqu'où seulement.** La répartition est en principe saine : le chapitre 7 décrit le mécanisme conçu, le chapitre 8 raconte l'incident qui l'a imposé. Ce n'est pas une redondance, c'est la structure même de 2TUP. **Le défaut est ailleurs** : les deux passages sont écrits au même niveau de détail, avec les mêmes mots. Le chapitre 8 n'apporte alors que la date.

**Ce que je propose.** Ne rien supprimer. **Répartir** : le chapitre 7 garde la description du mécanisme et abandonne l'explication de sa cause ; le chapitre 8 garde l'incident, sa date, et la subtilité du type de message — qui est un enseignement d'exploitation, donc à sa place au chapitre 8.

**Pourquoi cette solution.** Elle conserve toute l'information, supprime la répétition littérale, et renforce la distinction entre conception et réalisation que le mémoire revendique.

**Ce que cela change.** Une phrase retirée au § 7.4, une phrase retirée au § 7.1. Rien n'est perdu : les deux sont déjà écrites au chapitre 8.

---

# PARTIE 3 — CE QU'IL NE FAUT SURTOUT PAS TOUCHER

Vous m'avez demandé de le dire aussi. Voici ce que j'ai examiné et qui **doit rester en l'état**, malgré les apparences.

## C1 · La règle de prise en charge, énoncée cinq fois

Elle apparaît à l'introduction, au § 1.3, au § 3.5, au § 4.2 et au § 6.3.2. **Aucune de ces cinq occurrences n'est de trop**, et chacune a une fonction différente :

| Emplacement | Fonction |
|---|---|
| Introduction | l'annoncer comme le fait qui structure le sujet |
| § 1.3 | l'établir comme **fait de terrain**, avec sa source dans le recueil |
| § 3.5 | la formaliser comme **règle métier** du système, avec sa table |
| § 4.2 | s'en servir d'**exemple** de ce que produit la branche fonctionnelle de 2TUP |
| § 6.3.2 | la décliner en **exception** d'un cas d'utilisation précis |

C'est la règle la plus importante du système. Un mémoire qui ne l'énoncerait qu'une fois serait moins bon, pas plus.

## C2 · Les limites, répétées en conclusion de chapitre 8 puis en conclusion générale

Le cœur clinique non testé, la règle d'éligibilité non couverte, le mode autonome non éprouvé : ces limites figurent au § 8.4, en conclusion du chapitre 8, et en conclusion générale. **C'est voulu, et c'est juste** — décision D-14. Une limite qu'on n'énonce qu'une fois passe pour un aveu arraché ; une limite qu'on porte jusqu'à la conclusion est une preuve de maîtrise.

## C3 · « Aucun besoin non couvert à l'intérieur du périmètre »

Ce résultat figure au § 6.1.3, en conclusion du chapitre 6, et en conclusion générale. C'est le résultat central de la confrontation besoins/couverture. Sa répétition est une insistance délibérée, et elle est justifiée.

## C4 · La distinction ordonnance / bon de pharmacie, énoncée au § 3.5 puis au § 6.3.2

Le § 6.3.2 le dit lui-même : *« Confondre les deux reviendrait à décrire un système qui refuse de soigner, alors qu'il refuse seulement de prendre en charge. »* C'est le contresens le plus probable d'un lecteur pressé. Le rappeler au moment du cas d'utilisation est une précaution, pas une redite.

## C5 · Les lacunes de source, signalées quatre fois

Infrastructure réseau et effectifs sont déclarés non établis au § 1.6, au § 2.2, au § 2.3, au § 8.1 et en conclusion. **Ne rien retirer** : c'est la règle D-10 appliquée. Chaque occurrence est au point où le lecteur attend la donnée. Les taire une fois serait laisser croire qu'on l'a oubliée.

---

# PARTIE 4 — UN DÉFAUT DE FORME, MESURÉ

## D1 · Le tableau 5.3 apparaît avant les tableaux 5.1 et 5.2

**Ce que j'ai identifié.** Dans le corps, l'ordre d'apparition est : … tableau 5.3 (page 32), puis tableau 5.1 (page 33), puis tableau 5.2 (page 33). La liste des tableaux, qui est un champ automatique, reproduit fidèlement ce désordre.

**Pourquoi c'est un problème.** La numérotation est continue et sans doublon — c'est ce qu'avait vérifié le contrôle du 5 septembre. Mais elle n'est pas **croissante**. Un jury qui suit la liste des tableaux trouve le 5.3 avant le 5.1. C'est le seul défaut de ce type dans les 59 tableaux du document.

**Ce que je propose.** Renuméroter les trois tableaux du chapitre 5 dans leur ordre d'apparition : la règle de confidentialité devient le tableau 5.1, les interlocuteurs le 5.2, les dix-huit besoins le 5.3. Les tableaux 5.4 et 5.5 ne bougent pas.

**Pourquoi cette solution plutôt que déplacer le tableau.** Déplacer la règle de confidentialité hors du § 5.1 la séparerait du paragraphe qui l'introduit et de celui qui la commente. La renumérotation ne coûte rien et ne déplace aucun contenu.

**Ce que cela change.** Trois légendes, et les renvois qui les citent dans le texte — **à vérifier un par un avant toute modification**. La liste des tableaux se régénère ensuite d'elle-même par Ctrl+A puis F9.

---

# SYNTHÈSE ET ORDRE DE TRAITEMENT PROPOSÉ

| # | Point | Nature | Gravité | Effort |
|---|---|---|---|---|
| A1 | 268 routes au § 7.2 | erreur factuelle | **élevée** | un mot |
| A2 | 35 sur 52 au § 8.3 contre 46 sur 88 au § 7.4 | contradiction interne | **élevée** | une phrase |
| A3 | « la plupart » au § 7.3 | affirmation fausse, vérifiable | **élevée** | une phrase |
| B1 | § 2.7 et conclusion du chapitre 2 | doublon littéral | moyenne | un paragraphe |
| B2 | problématique répétée au § 3.2 | doublon littéral | moyenne | un paragraphe |
| B3 | § 3.1 redit les chapitres 1 et 2 | redondance de fond | moyenne | un paragraphe |
| B4 | § 2.6 et § 3.8 | chevauchement de fonction | moyenne | trois phrases |
| B5 | § 3.6 et conclusion générale | défaut de progression | faible | deux phrases |
| B6 | mécanismes racontés deux fois, ch. 7 et 8 | répétition littérale | faible | deux phrases |
| D1 | tableau 5.3 avant 5.1 | défaut de forme | faible | trois légendes |

**Volume total en jeu** : environ **500 mots réécrits sur 21 372**, soit 2,3 % du texte. Le document ne perdra pas une page. Ce n'était pas l'objectif.

**Ordre recommandé.** D'abord A1, A2 et A3 : ce sont les seuls points où le mémoire dit quelque chose de faux. Ensuite B1, B2 et B3, qui sont les redondances que votre directeur a perçues. Ensuite B4. Puis B5, B6 et D1, qui relèvent du polissage.

---

# CE QUE CET AUDIT NE COUVRE PAS

Je préfère l'écrire, comme l'audit du 5 septembre l'avait fait.

1. **L'orthographe et la grammaire.** Je n'ai pas conduit de relecture linguistique. J'ai relevé au passage `expertise avec patient et diligence` dans la dédicace — probablement « avec patience » — mais ce n'est pas une revue systématique.
2. **Le contenu des 59 tableaux.** Je les ai lus, mais je n'ai pas confronté chaque cellule au code. Seules les affirmations chiffrées du texte ont été recomptées.
3. **Les chiffres des chapitres 1 et 2** — histoire de SARIS-CONGO, parc matériel, population couverte. Ils viennent de sources que je ne peux pas recouper.
4. **La justesse des références bibliographiques.** Je ne les ai pas lues.
5. **Les attentes propres de votre directeur de mémoire.** Il a signalé les chapitres 2.6 et 3 ; j'ai examiné le document entier, mais je ne sais pas ce qu'il vise précisément au-delà.
