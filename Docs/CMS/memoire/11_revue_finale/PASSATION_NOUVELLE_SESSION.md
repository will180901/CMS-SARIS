# Passation vers une nouvelle session

> **Écrit le 18 septembre 2026**, au moment où l'environnement Linux de la session précédente est tombé.
> **Usage** : copier le bloc du § 1 comme premier message d'une nouvelle session. Le reste de ce fichier est le détail, que la nouvelle session lira dans les documents du dossier.

---

## 1. Le texte à coller

---

Nous reprenons un travail en cours, interrompu par une panne technique. Lis d'abord ces cinq fichiers, dans cet ordre, avant de me répondre :

1. `00_pilotage_et_preuves/registre_decisions.md` — 84 décisions, chacune avec son motif. C'est la mémoire du projet.
2. `00_pilotage_et_preuves/sources_et_statut_des_preuves.md` — la hiérarchie de preuve et les huit inventaires.
3. `11_revue_finale/AUDIT_AVANT_SOUTENANCE.md` — l'audit complet du 5 septembre et les cinq corrections faites.
4. `11_revue_finale/NOTE_DE_RECONSTITUTION.md` — l'état de la méthode, reconstitué.
5. `05_fiches_de_dessin/MCD-GLOBAL-01_mcd_complet_atelier.md` — la fiche de ce qu'il reste à produire.

**Où on en est.** Le mémoire est rédigé, 110 pages, huit chapitres, 58 tableaux. Les 26 planches de figures sont produites et contrôlées, rassemblées dans `07_figures_drawio/FIG_00_TOUTES_LES_FIGURES.drawio`, un onglet par figure. Un audit complet a été passé le 5 septembre : cinq erreurs trouvées, cinq corrigées, contrôle repassé.

**Ce qu'on faisait quand ça s'est arrêté.** Je t'avais demandé d'ajouter au fichier draw.io deux onglets d'atelier — un MCD global des 88 entités, hors mémoire, pour travailler avec mon directeur de mémoire. La fiche est écrite. **La production n'a pas pu se faire** : ton environnement Linux ne démarrait plus, une mise à jour Windows du 8 septembre empêchait le montage du disque.

**Première chose à faire** : vérifie si ton environnement Linux fonctionne, avec une commande simple. Dis-le-moi. S'il marche, on produit les deux onglets à partir de la fiche. S'il ne marche pas, on continue avec les outils de fichiers, qui eux fonctionnent.

**Comment on travaille.** Une étape à la fois, tu m'expliques ce que tu vas faire, je valide, tu exécutes. Je ne connais ni la rédaction de mémoire ni Word — tu es mon directeur de mémoire, pas mon exécutant. Tu mesures avant d'affirmer, tu ne recopies jamais un chiffre sans le recompter, et tu me dis ce que tu n'as pas pu vérifier. **Pas de code dans les fichiers que tu produis.**

---

## 2. Les règles de fond, à ne pas perdre

Elles sont détaillées dans le registre, mais les voici en résumé :

| Règle | Décision |
|---|---|
| **Le code fait foi** sur ce qui est livré | D-02 |
| **Le document Word fait foi sur le texte, les inventaires sur les chiffres** | D-17 |
| **Le code fait foi sur la structure** — les fiches de dessin ne portent pas les contenus | D-78 |
| **Rien ne s'invente** — un chiffre, un verbe, une cardinalité sans source ne s'écrit pas | permanente |
| **Un chiffre a une date de péremption** — trois des cinq erreurs de l'audit venaient de mesures d'août jamais refaites | leçon du 5 septembre |
| **Pas de code dans le dossier du mémoire** | D-81 |
| **Une seule source pour les figures** : le fichier à onglets | D-84 |
| **Chaque figure occupe une page entière, seule** | D-20 |
| **La page de garde ne se modifie jamais** | permanente |
| **Aucune donnée patient réelle sur les captures** | QO-12 |

---

## 3. L'état du mémoire au 18 septembre 2026

| | |
|---|---|
| Document | `Memoire_CMS_SARIS.docx` · **110 pages** · 1 012 paragraphes · 59 tableaux |
| Chapitres | Les huit sont rédigés, plus introduction, conclusion, bibliographie, table des matières |
| Figures | **29 emplacements**, tous vides · 26 planches prêtes dans le fichier à onglets · 3 captures à prendre |
| Plafond de pages | **jusqu'à 150** — la contrainte de volume est levée, QO-09 résolue |
| Contrôles | Renvois, légendes, numérotation, sauts de page : tous passés le 5 septembre |

**Le nombre de pages ne bougera pratiquement plus** : chaque emplacement de figure réserve déjà sa page entière, par saut de page. Coller les images ne rallongera pas le document.

---

## 4. Ce qui reste à faire

### Par l'auteur, dans Word

1. **Coller les 29 figures.** Export depuis draw.io : *Fichier → Exporter en tant que → PNG*, échelle 3, fond non transparent. **Coller l'image dans le premier paragraphe vide du bloc, puis supprimer les paragraphes vides restants** — sinon la légende bascule sur la page suivante.
2. **Prendre les trois captures** 8.3, 8.4, 8.5, sans aucune donnée patient réelle.
3. **Remplir les huit « ▪ (nom) »** de la dédicace.
4. **Ctrl+A puis F9** une fois tout collé, pour régénérer sommaire, listes et numéros de page.
5. **Relire la bibliographie** et retirer l'adresse du dépôt personnel.

### À obtenir auprès de tiers

- Nom du promoteur, composition du jury, date de soutenance — bloque la page de garde.
- Les chiffres du centre et de l'infrastructure réseau, auprès de Verdi — environ six pages de réserve, chapitres 1 et 2.
- Vérifier que le jeu de démonstration ne contient aucun nom réel.

### Par l'assistant

- **Produire les deux onglets d'atelier** du MCD global, dès que l'environnement Linux fonctionne. La fiche `MCD-GLOBAL-01` dit tout.
- **Relecture croisée finale** une fois les figures collées : chaque figure et chaque tableau appelé dans le texte, chiffres du corps concordants avec les inventaires.
- **Deux prompts universels à écrire**, projet en cours au moment de la panne : l'un pour produire un mémoire de A à Z, l'autre pour produire ses diagrammes. La note de reconstitution en donne le plan.

---

## 5. Les sept points de formulation laissés ouverts

Ce ne sont pas des erreurs, mais un jury peut les discuter. Le détail est au § 3 de l'audit.

- « 17 modules métier » quand le dossier en contient 18 — le dix-huitième n'a pas de contrôleur.
- « 151 routes auditées » quand 110 seulement sont journalisées.
- « 15 écrans » sans définition écrite.
- Huit méthodes des diagrammes de classes nommées dans le vocabulaire du métier, pas dans celui du code.
- Les identifiants MERISE des planches 8.1, qui n'existent pas sous ce nom dans la base.
- Le sigle « RH », employé deux fois sans figurer dans la liste des abréviations.

---

## 6. L'incident technique

**Symptôme** : l'environnement Linux ne démarre plus. Message : *le partage du disque C: n'est pas monté*, et *l'utilisateur existe déjà de façon inattendue*.

**Cause annoncée par l'application** : une mise à jour Windows du 8 septembre 2026 empêche l'environnement d'atteindre les fichiers. Le problème est suivi par Anthropic.

**Facteur aggravant** : la session précédente était restée ouverte treize jours, traversant l'expiration d'un abonnement, son annulation et un nouvel abonnement. La seconde partie de l'erreur — l'utilisateur fantôme — vient de là.

**Ce qui marche quand même** : les outils de lecture et d'écriture de fichiers. Lire le code, écrire un document, modifier le Word : tout cela fonctionne. **Seul l'atelier Linux est perdu** — donc la génération des figures et leurs contrôles automatiques.

**Échelle de dépannage, dans l'ordre** : nouvelle session · quitter et rouvrir l'application · redémarrer Windows · vérifier Windows Update et les dossiers autorisés · signaler avec le pouce vers le bas.
