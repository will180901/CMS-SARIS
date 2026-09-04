# Comparaison — notre mémoire face à la version de Verdi

> **Date** : 28 août 2026
> **Notre version** : `Memoire_CMS_SARIS.docx` — 98 pages, **84 de corps**, 23 figures, 54 tableaux, 24 185 mots
> **Version de Verdi** : `Memoire_CMS_SARIS_version_modifié_par_verdi_mon binôme.docx` — 92 pages, **79 de corps**, 15 figures, 48 tableaux, 22 392 mots
> **Méthode** : extraction des 536 blocs de notre document et des 512 blocs du sien, puis comparaison bloc par bloc, et mot à mot sur les paragraphes réécrits.
> **Aucun fichier n'a été modifié.** Ce rapport constate.

---

## 1. Le fait le plus important

**Verdi n'a pas travaillé sur la version actuelle du mémoire.** Il a travaillé sur une copie antérieure au 24 août.

La preuve est directe. Sa version ne contient **aucune** des corrections apportées après cette date :

| Ce que contient notre version | Chez Verdi |
|---|---|
| Tableau 4.2 — « Les **sept** diagrammes UML retenus » | « Les **neuf** » — l'erreur qu'on a corrigée |
| Paragraphe justifiant **quatre** exclusions de diagrammes | L'ancien, qui n'en justifie que deux |
| **23 figures** — cas d'utilisation et classes découpés par package | **15 figures** — l'ancien découpage |
| **54 tableaux** | **48 tableaux** |
| Section 6.6 « Classification par package », 27 blocs | Absente |
| La répartition chiffrée des 59 entités écartées | La phrase générale, qui était **fausse** |
| Les 10 sigles techniques (API, REST, JWT, SSE, IPC, PWA…) | Aucun |
| Liste des sigles à 25 entrées | 15 entrées |

**Conséquence pratique : sa version ne peut pas devenir la base de travail.** Repartir de son fichier ferait perdre cinq jours de corrections, dont deux erreurs de fond que le jury aurait vues.

La bonne méthode est l'inverse : **garder notre version, et y verser une par une les corrections de Verdi qui valent la peine.**

---

## 2. Ce que Verdi a fait, classé

Taux d'identité entre les deux documents : **77,8 %**. Les 22 % restants se répartissent en trois familles.

### 2.1 Les retours en arrière — à refuser

Ce ne sont pas des choix de Verdi : ce sont les traces de sa copie périmée. Rien à discuter, notre version est postérieure.

| Écart | Notre version | La sienne |
|---|---|---|
| Tableau 4.2 | 7 diagrammes | 9 — contredit les figures livrées |
| Conclusion du chapitre 4 | « sept types de diagrammes » | « neuf » |
| Découpage par package | 5 planches de cas d'utilisation + 4 de classes | Une planche unique, illisible en A4 |
| Les 59 entités | Répartition chiffrée en 7 domaines | Phrase générale inexacte |
| Sigles techniques | 10, définis à leur première apparition | Aucun |

### 2.2 Les suppressions de vocabulaire technique — à refuser

Verdi a retiré les noms d'outils du texte. C'est l'inverse exact de ce qui a été décidé le 22 août, après ta remarque « il n'y a plus de jargon technique ».

| Notre version | La sienne |
|---|---|
| « Le même code **NestJS** s'exécute sur le serveur central » | « Le même code s'exécute » |
| « 41 migrations **Prisma** versionnées » | « 41 migrations versionnées » |
| « le schéma **Prisma** et les migrations, les types **TypeScript** » | « le schéma et les migrations, les types » |
| « Le serveur applicatif **NestJS** expose les 273 routes **HTTP** » | « Le serveur applicatif expose les 273 routes » |
| « un fichier de configuration **render.yaml**, versionné » | « un fichier de configuration versionné » |
| « **L'offre gratuite de Render** met le serveur en veille » | « Le serveur est mis en veille » |
| Tableau 8.1 avec la colonne **« Usage dans le projet »** | Colonne absente |
| « tracés avec **draw.io**, un éditeur libre au format ouvert » | Phrase entière supprimée |

Un jury de génie logiciel attend ces noms. Les retirer donne l'impression que les auteurs ne savent pas ce qu'ils ont utilisé.

### 2.3 Les réécritures de style — à refuser en bloc, sauf exception

Verdi a réécrit une trentaine de paragraphes dans un français **plus long et plus administratif**. C'est le style qu'on avait justement quitté le 22 août.

| Notre version | La sienne |
|---|---|
| « Le système réalisé **ne connaît que trois rôles**, alors que l'organisation en compte davantage. » (32 mots) | « Le système réalisé **retient trois rôles principaux, bien que l'organisation du CMS fasse intervenir un nombre plus important d'acteurs**. » (48 mots) |
| « Cette configuration **pose trois problèmes**. Le problème de l'identité d'abord. » (79 mots) | « Cette configuration **soulève d'abord trois difficultés majeures. La première concerne l'identité des travailleurs**… » (107 mots) |
| « **C'est un arbitrage explicite** entre la disponibilité et la restriction… » (48 mots) | « **Il s'agit donc d'un arbitrage architectural assumé** entre la disponibilité des informations… » (70 mots) |
| « Une observation indirecte **mérite d'être versée au dossier**. » (69 mots) | « Une observation indirecte **permet néanmoins de mettre en évidence une difficulté liée à la connectivité**. » (101 mots) |
| « Cette généralisation **soulève une objection**. » (80 mots) | « Cette architecture **soulève toutefois une question essentielle**… » (114 mots) |

Sur ces cinq exemples, les paragraphes gagnent en moyenne **40 % de mots pour dire la même chose**. C'est le retour du français lourd, et c'est aussi du volume en plus alors que le corps est déjà à 84 pages pour un plafond de 85.

### 2.4 Les points qui méritent d'être retenus

Tout n'est pas à jeter. Six choses sont justes.

| # | Ce que Verdi a vu | Mon avis |
|---:|---|---|
| 1 | Il nomme **M. MAFOUMBI PAWEL**, responsable du service informatique, dans les remerciements | ✅ **À prendre.** Un nom vaut mieux qu'une fonction. À confirmer avec lui. |
| 2 | Il ajoute le **Colonel EKONDZI Alain** aux remerciements | ✅ **À prendre si c'est justifié.** Toi seul sais si cette personne a joué un rôle. |
| 3 | Il remplace « **le rapport de stage** » par « **le recueil de l'existant** » | ✅ **À prendre.** Le rapport de stage n'est pas une source citable devant le jury ; le recueil de l'existant, si. |
| 4 | Il remercie **Dieu** avant tout le monde | ⚖️ **Question de convention.** C'est l'usage dans beaucoup de mémoires au Congo. À toi de trancher. |
| 5 | Il ajoute une catégorie de patients : **« Stagiaire missionnaire et expatrié »** | ⚠️ **À instruire.** Voir le point 3 ci-dessous — l'ajout est cassé, mais l'information est peut-être vraie. |
| 6 | Il corrige « conditionne **cinq** cas d'utilisation » en « **plusieurs** » | ⚠️ **À vérifier.** Si le chiffre cinq est faux, il faut le corriger ; s'il est juste, un chiffre vaut mieux qu'un « plusieurs ». |

---

## 3. Trois défauts dans sa version, à ne pas reprendre

### 3.1 La dédicace n'est pas terminée

Sa dédicace contient **huit lignes « ▪ (nom) »** — des marques de remplissage jamais complétées. En l'état, le mémoire partirait à l'impression avec « (nom) » huit fois sur la page de dédicace.

### 3.2 Le tableau des droits est cassé

Il ajoute une colonne « Stagiaire missionnaire et expatrier » — deux problèmes :

- **les cellules de la colonne sont vides.** Cinq lignes de prestations, aucune valeur en face. Le tableau annonce une catégorie et ne dit rien de ses droits ;
- **« expatrier » est une faute** : il faut « expatrié ».

L'information est peut-être exacte — mais dans cet état, elle ne peut pas entrer dans le mémoire. Il faut la valeur de chaque prestation pour cette catégorie, et il faut vérifier qu'elle correspond au code, où les catégories sont figées dans `CategoriePatient`.

### 3.3 Des suppressions non signalées

Trois passages ont disparu de sa version sans qu'aucune justification n'apparaisse :

| Supprimé | Pourquoi c'est un problème |
|---|---|
| Les **mots-clés du résumé** et les **keywords de l'abstract** | Le plan de l'école les demande. C'est un point de conformité, pas un ornement. |
| Le paragraphe sur les **volumes d'activité non établis** | C'est une limite honnête du travail. La retirer donne l'impression qu'on cache un trou. |
| La **conclusion du chapitre 1** (deux paragraphes) | Tous les autres chapitres en ont une. Le chapitre 1 se retrouverait seul sans conclusion. |
| « les deux outils informatiques en usage **avaient échoué : ils perdaient leurs données à chaque fermeture** » | C'est le fait le plus parlant du chapitre 2. Sans lui, la critique de l'existant s'affaiblit. |

---

## 4. Mise en page

| Contrôle | Notre version | La sienne |
|---|---|---|
| Pages | 98 | 92 |
| Corps | **84** | 79 |
| Pages liminaires | 8 (i à viii) | 7 (i à vii) |
| Sections Word | 4 | **5** |
| Marges | uniformes sur tout le document | **une section a des marges différentes** — 1276 / 1417 / 1417 au lieu de 851 / 1701 / 851 |
| Pages blanches | aucune | aucune |
| Style « Sans interligne » | absent | **3 paragraphes** dans les remerciements, en rupture avec le reste |

Sa version a **une section Word de plus, avec des marges qui ne sont pas celles du document.** C'est un défaut de mise en page : sur ces pages, le texte ne commence pas au même endroit que sur les autres. Le plan de l'école impose des marges uniformes.

---

## 5. Ce que je recommande

**Un seul document de travail : le nôtre.** On y verse les corrections de Verdi qui tiennent, une par une, avec validation à chaque fois.

Ordre proposé :

| Lot | Contenu | Décision |
|---|---|---|
| **1** | Nommer M. MAFOUMBI PAWEL dans les remerciements | À valider par toi |
| **2** | Remplacer « rapport de stage » par « recueil de l'existant », partout | À valider par toi |
| **3** | Ajouter le Colonel EKONDZI Alain, et le remerciement à Dieu | À trancher par toi — c'est ton mémoire et celui de Verdi |
| **4** | La catégorie « Stagiaire, missionnaire et expatrié » | **Bloqué** : il faut d'abord les droits de cette catégorie, et la confrontation au code |
| **5** | Vérifier « cinq cas d'utilisation » | Je peux le compter dans le code |
| **6** | Fusionner les deux dédicaces, en gardant la nôtre comme base | À valider par toi |

**Ce que je propose de refuser, avec un motif à donner à Verdi** : les neuf diagrammes, la suppression des packages, le retrait des noms d'outils, les réécritures allongées, la suppression des mots-clés, celle de la conclusion du chapitre 1 et celle du paragraphe sur les volumes d'activité.

Il faut lui dire pourquoi, sans quoi il recommencera : **il a travaillé sur une copie périmée**, et une bonne partie de son travail corrige des choses déjà corrigées, ou défait des décisions prises après sa copie.
