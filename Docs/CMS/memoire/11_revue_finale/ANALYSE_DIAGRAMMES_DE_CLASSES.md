# Diagrammes de classes — analyse critique avant décision

> **Date** : 30 août 2026
> **Objet** : confronter nos planches de classes aux mémoires de référence, sur la règle UML et sur la vérité de notre système.
> **Statut** : document d'arbitrage. Rien n'est engagé tant que l'auteur n'a pas tranché.

---

## 1. Ce que dit UML, et qu'il faut départager

Trois informations distinctes se placent sur une association, et on les confond souvent.

| Information | Où elle se pose | Ce qu'elle dit |
|---|---|---|
| **Nom de l'association** | **au milieu du trait** | ce que la relation *fait* — `réaliser`, `possède`, `concerne` |
| **Nom de rôle** | **à chaque extrémité** | le rôle que joue la classe de ce côté, vu de l'autre — `roles`, `utilisateur` |
| **Multiplicité** | **à chaque extrémité** | combien — `1`, `0..*`, `1..*` |

Les trois peuvent coexister. Aucune n'en remplace une autre.

**Pour la classe** : trois compartiments — nom, attributs, opérations. Le troisième peut rester vide ; **un compartiment vide signifie « aucune opération déclarée »**, ce qui est une affirmation, pas un oubli.

---

## 2. Les mémoires de référence — ce qui est juste, et ce qui est faux

### Ce qu'ils font mieux que nous

**Le nom de l'association, au milieu du trait.** `réaliser`, `regrouper`, `enregistrer`, `possède`, `concerne`, `appartient_à`. C'est la lecture immédiate du modèle : on lit une phrase. **Nos planches ne l'ont pas. C'est un manque réel.**

**Le cadre nommé** qui enveloppe le diagramme — « Référentiel du domaine BTP », « Gestion des offres et réservations ». Il donne le périmètre d'un coup d'œil.

### Ce qui est fautif chez eux

**`+réaliser`, `+regrouper`, `+enregistrer`.** Le signe `+` est un **marqueur de visibilité**. Il ne s'applique qu'aux attributs et aux opérations. **Un nom d'association n'a pas de visibilité.** C'est une faute de notation, répétée sur toutes leurs associations.

**Le gabarit CRUD collé sur chaque classe.** `ajouter_domaine()`, `modifier_domaine()`, `supprimer_domaine()`, `rechercher_domaine()` — et la même série sur `Metier`, `Travaux`, `Gestionnaire`. C'est une **erreur de catégorie** : ces quatre opérations ne sont pas le comportement de l'entité, ce sont les actions d'un contrôleur. Une entité `Domaine` ne se recherche pas elle-même. Le modèle est ce qu'on appelle un *modèle de domaine anémique*, décoré d'un stencil.

Et il est **uniforme**. Aucun système réel n'a exactement quatre opérations identiques sur chacune de ses entités. L'uniformité est le signe qu'il n'a pas été relevé, mais recopié.

**`__init__()` dans le second mémoire.** C'est le constructeur de Python. Un diagramme de classes de **conception** ne montre pas le constructeur d'un langage : c'est de l'implémentation qui remonte dans la conception. Sur ce diagramme, `__init__()` apparaît sur les vingt classes.

**`created_at` et `updated_at` comme attributs.** Ce sont des colonnes techniques d'ORM, pas des attributs du domaine. Elles alourdissent chaque classe sans rien apprendre du métier.

**Une association plusieurs-à-plusieurs sans classe d'association.** `Domaine 1..* —réaliser— 1..* Metier`. Une base de données ne peut pas implémenter cela sans une table de jonction. Le diagramme **cache une table**. Nous montrons les nôtres — `UtilisateurRole`, `RolePermission` — et c'est plus fidèle.

**Aucun nom de rôle.** Sur `Domaine —regrouper— Travaux`, rien ne dit de quel côté on lit quoi. La multiplicité seule ne suffit pas à naviguer le modèle.

**Le diagramme global est illisible.** Leur figure 16 porte plus de vingt classes sur une planche, avec des traits qui se croisent d'un bout à l'autre et un texte qui, imprimé en A4, tombe sous 6 points. C'est exactement le problème que notre découpage par package évite.

---

## 3. Nos planches — ce qui est faux chez nous

**Il manque le nom de l'association au milieu du trait.** Nos liens portent les noms de rôle et les multiplicités, ce qui est juste et plus riche que chez eux, mais on ne lit pas la relation. **À corriger.**

**Le compartiment d'opérations est vide, et c'était un choix par défaut.** Défendable — mais je l'avais pris sans avoir cherché si notre système avait des opérations à y mettre. Il en a. Voir le point suivant.

**Ce qui est juste chez nous, et qu'il faut garder** : le découpage par package, les classes d'association montrées, les noms de rôle, les classes d'un autre package en pointillés, et le refus des colonnes techniques.

---

## 4. Ce que notre système permet d'écrire — les faits

**Relevé sur `INV-01` : 273 routes, 26 contrôleurs, 18 modules fonctionnels.**

**Les contrôleurs ne correspondent pas aux classes.** `ReferentielsController` porte 37 routes et sert à lui seul cinq classes — `Site`, `CategoriePatient`, `PathologieReference`, `MedicamentReference`, `TypeExamen`. `MessagerieController` en porte 29 et ne sert **aucune** des 29 classes retenues. `PatientController` en porte 30 pour une seule.

**Conséquence directe : le gabarit CRUD nous est interdit.** Il serait faux de trois façons. Il attribuerait à l'entité des actions qui appartiennent au contrôleur. Il serait uniforme là où notre système ne l'est pas — de 5 à 37 routes selon le module. Et **vingt et une de nos vingt-neuf classes n'ont aucun contrôleur propre** : `LigneOrdonnance`, `ConstanteVitale`, `DroitCategoriePatient`, les rattachements, les classes d'association. Leur inventer un CRUD serait une invention pure, vérifiable en ouvrant le code.

**Mais nos entités ont de vraies opérations.** Le **tableau 7.6 du mémoire** — *Les neuf machines à états du système* — et le **§ 3 de `INV-07`** donnent, entité par entité, les transitions avec leurs gardes. Ce sont des opérations de domaine, pas des actions de contrôleur.

| Classe | Opérations tirées du tableau 7.6 et de INV-07 | Règle portée |
|---|---|---|
| `Utilisateur` | `bloquerApresEchecs()` · `changerStatut()` | blocage automatique, durée × 4 à chaque récidive |
| `Patient` | `changerCategorie()` · `verrouiller()` · `archiver()` | une visite exige un dossier actif |
| `Visite` | `prendreEnCharge()` · `affecterSoignant()` · `annuler()` · `cloturer()` | la clôture est posée par la consultation, jamais depuis le triage |
| `Consultation` | `cloturer()` · `annuler()` | une seule consultation ouverte par soignant et par visite |
| `Ordonnance` | `valider()` · `annuler()` | modifiable uniquement à l'état brouillon |
| `BonPharmacie` | `delivrer()` · `annuler()` | un bon délivré ne peut plus être annulé |
| `BonExamen` | `valider()` · `saisirResultat()` · `annuler()` | la saisie du résultat exige un bon validé |
| `Evacuation` | `ajouterSuivi()` · `cloturer()` · `annuler()` | l'annulation exige l'état en cours |

**Huit classes sur vingt-neuf portent des opérations. Vingt et une n'en portent aucune.** Cette non-uniformité est précisément ce qui rend le modèle crédible : elle se vérifie dans le code, ligne par ligne.

---

## 5. Les trois options

| | Ce qu'on montre | Force | Faiblesse |
|---|---|---|---|
| **A** | Compartiment vide partout, note explicative | Aucune invention possible | Paraît pauvre face aux mémoires de référence ; un jury pressé y verra un oubli |
| **B** | Gabarit CRUD uniforme, comme chez eux | Ressemble aux autres mémoires | **Faux pour notre système**, et vérifiable en ouvrant le code. À proscrire |
| **C** | **Opérations réelles sur les 8 classes qui en ont, compartiment vide sur les 21 autres** | Chaque opération porte une règle métier vérifiable ; la non-uniformité prouve le relevé | Demande une note expliquant pourquoi certaines classes n'en ont pas |

**Dans les trois cas**, le nom de l'association au milieu du trait est ajouté : c'est un manque, pas une option.

---

## 6. Ce que je recommande

**L'option C.** Elle est la seule qui soit à la fois plus riche que le compartiment vide et plus vraie que le gabarit CRUD.

Un membre du jury qui connaît UML verra sur la planche de référence quatre CRUD identiques par classe et saura que c'est un décor. Sur la nôtre, il verra `delivrer()` sur `BonPharmacie` et rien sur `LigneBonPharmacie`, et il comprendra que quelqu'un a lu le code.

Et si on lui demande d'où vient `saisirResultat()`, la réponse tient en une ligne : **tableau 7.6 du mémoire, machine à états du bon d'examen.** C'est déjà dans le document.

---

## 7. Ce qui change dans les fiches de dessin

La fiche `UML-CLS-01` dit quatre fois que le compartiment des opérations reste vide. Si l'option C est retenue, **cette consigne doit être révisée**, et le bloc 4 de la fiche complété d'une colonne « opérations », remplie depuis le tableau 7.6 et `INV-07`.

C'est un changement de fiche, pas un changement de mémoire : le tableau 7.6 existe déjà dans le Word et n'a pas à bouger.
