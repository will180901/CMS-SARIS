# Méthode de production des 24 figures

> **Date** : 29 août 2026
> **Fichiers produits** : `07_figures_drawio/`
> **Outil** : draw.io Desktop **31.3.2**, interface en français
> **Principe** : je produis le fichier, tu l'ouvres, tu vérifies, tu exportes. Une figure à la fois, dans l'ordre, avec ta validation entre chaque.

---

## 1. Ce que j'ai vérifié dans la documentation draw.io

| Point | Ce que dit la documentation officielle |
|---|---|
| Format recommandé | Le `.drawio` est un **fichier XML non compressé**. C'est le format que draw.io recommande lui-même |
| Format `.svg` | Une image vectorielle qui **embarque les données du diagramme**. Elle s'ouvre dans draw.io et s'affiche partout ailleurs |
| Bibliothèques | Les formes UML sont dans **UML** et **UML 2.5**, à activer par *Plus de formes → Logiciel* |
| Édition directe | Le menu **Suppléments → Modifier le diagramme** ouvre le XML brut et permet de coller un diagramme entier |
| Export | *Fichier → Exporter en tant que → PNG*, avec un facteur d'échelle réglable |

**Contrôle fait** : j'ai vérifié la chaîne compression-décompression que draw.io utilise, dans les deux sens. Les fichiers que je produis sont en **XML lisible**, pas compressés : tu peux les ouvrir dans un éditeur de texte et vérifier toi-même.

---

## 2. Le vocabulaire graphique, forme par forme

Tout ce qui suit est relevé dans les exemples officiels de draw.io, pas reconstitué de mémoire.

| Élément UML | Forme draw.io |
|---|---|
| Acteur | bonhomme-bâton, étiquette sous la forme |
| Cas d'utilisation | ovale |
| Frontière du système | rectangle sans remplissage, titre en haut |
| Package | dossier à onglet |
| Classe | bandeau à trois compartiments : nom, attributs, opérations |
| Séparateur de compartiment | filet horizontal |
| Association | trait plein, cardinalités aux deux extrémités |
| Généralisation | trait plein, **triangle vide** du côté du parent |
| Réalisation | trait pointillé, triangle vide |
| Dépendance et «include» | trait pointillé, **flèche ouverte** |
| Agrégation | losange vide côté conteneur |
| Composition | losange plein côté conteneur |
| Composant | rectangle avec le symbole de composant |
| Nœud de déploiement | cube en trois dimensions |
| Ligne de vie | rectangle en tête, trait pointillé vertical |
| Bande d'activation | rectangle étroit sur la ligne de vie |
| Message | flèche pleine · **Retour** : flèche ouverte en pointillé |
| Début d'activité | disque plein · **Fin** : disque cerclé |
| Action | rectangle à coins arrondis · **Décision** : losange |
| Note | rectangle à coin replié |

**Les cardinalités** se posent comme étiquettes attachées à l'extrémité du lien, pas comme du texte libre posé à côté. Elles suivent donc le lien si tu déplaces une classe.

---

## 3. Ce que je te livre pour chaque figure

Un fichier `.drawio` **complet et positionné**, prêt à ouvrir. Tu n'as ni forme à poser, ni lien à tracer.

Ton travail se réduit à quatre gestes :

1. **Ouvrir** le fichier dans draw.io.
2. **Vérifier** que le contenu est juste — c'est toi qui connais le système.
3. **Ajuster** ce qui te déplaît : déplacer une forme, changer une couleur.
4. **Exporter** : *Fichier → Exporter en tant que → PNG*, **échelle 3**, fond non transparent.

Puis coller le PNG dans Word, au-dessus de sa légende.

---

## 4. Avant de commencer : la planche d'essai

Le fichier **`07_figures_drawio/palettes/PALETTE_v3.drawio`** contient **une forme de chaque famille**, regroupées en six blocs :

| Bloc | Ce qu'il vérifie |
|---|---|
| 1 | Acteur, ovale de cas d'utilisation, frontière du système, package en dossier, lien «include» |
| 2 | Classe à trois compartiments, association avec cardinalités **1** et **0..\***, généralisation à triangle vide, note |
| 3 | Composant, dépendance, nœud de déploiement en cube |
| 4 | Deux lignes de vie, bande d'activation, message aller et retour |
| 5 | Début, action, décision, fin d'activité |

**Ouvre-le et dis-moi si chaque forme est la bonne.** S'il y en a une de travers, je corrige mon vocabulaire une fois pour toutes, et les vingt figures qui suivent seront justes.

C'est vingt minutes de ton temps qui évitent vingt corrections.

---

## 5. L'ordre de production

Du plus simple au plus complexe, pour que ta méthode de vérification se rode sur les cas faciles.

| Rang | Figure | Difficulté | Branche 2TUP |
|---:|---|---|---|
| 1 | 1.1 Organigramme du Service Médico-Social | simple | contexte |
| 2 | 4.1 Cycle de développement selon 2TUP | simple | méthode |
| 3 | 6.1 Diagramme de contexte statique | simple | fonctionnelle |
| 4 | 5.1 Activité du processus antérieur | moyenne | fonctionnelle |
| 5 à 9 | 6.2 à 6.6 Cas d'utilisation, cinq packages | moyenne | fonctionnelle |
| 10 | 6.7 Séquence système : bon de pharmacie | moyenne | fonctionnelle |
| 11 | 6.8 Séquence système : synchronisation | moyenne | fonctionnelle |
| 12 à 15 | 7.1 à 7.4 Classes, quatre packages | **lourde** | convergence |
| 16 | 7.5 Classes du système, vue globale | **la plus lourde** | convergence |
| 17 | 7.6 Diagramme de composants | moyenne | technique |
| 18 | 7.7 Diagramme de déploiement | moyenne | technique |
| 19 | 8.1 Schéma relationnel du noyau métier | lourde | réalisation |
| 20 | 8.2 Modèle physique de données | lourde | réalisation |

Restent **trois captures d'écran** — 8.3, 8.4, 8.5 — qui ne se dessinent pas : elles se prennent sur l'application, selon le protocole de `06_interfaces/`.

---

## 6. Deux règles que je m'impose

**Rien ne s'invente.** Chaque classe, chaque cas d'utilisation, chaque cardinalité vient d'un inventaire extrait du code — `INV-02` pour le modèle de données, `INV-01` pour les routes, `INV-03` pour les permissions. Si une information manque, la figure porte une zone vide et je te le dis.

**Le mémoire fait foi.** Une figure ne peut pas montrer autre chose que ce que le texte annonce. Les 29 classes du diagramme sont les 29 du tableau 7.4. Les 65 cas d'utilisation sont ceux des tableaux 6.6 à 6.10. Je vérifie la concordance avant de te livrer.
