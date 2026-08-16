# ORG-02 — Schéma de l'infrastructure réseau

> ## ⛔ SEULE FIGURE ENCORE BLOQUÉE
>
> Sur les 25 figures du mémoire, **celle-ci est la dernière qui ne peut pas être spécifiée**. Elle décrit l'infrastructure physique du centre — une donnée d'entreprise, absente du code comme du recueil de l'existant.
>
> **Question ouverte** : QO-03. **Détenteur** : le responsable informatique du centre, ou la Direction des Ressources Humaines, via Nzila Verdi Oscarvie.

## Cartouche

```
Identifiant       : ORG-02
Figure du mémoire : Figure 2.1 — Schéma de l'infrastructure réseau
Chapitre / section: 2 — § 2.2
Type              : Schéma d'infrastructure (non UML)
Statut            : ⛔ BLOQUÉE — QO-03
```

---

## 1. Pourquoi cette figure ne peut pas être dérivée des sources disponibles

**Le code** décrit comment l'application communique — protocoles, origines autorisées, ports —, non sur quel matériel elle circule. Aucune information sur les commutateurs, les points d'accès, la liaison entre les deux sites ou les onduleurs n'existe dans le dépôt.

**Le recueil de l'existant** documente les **outils** et les **flux d'information** — carnets, registres, fichiers tableur, transmissions papier et verbales — mais aucun entretien n'a porté sur l'infrastructure technique. Les quatre interlocuteurs étaient un gestionnaire administratif, une pharmacienne, un médecin et une infirmière : aucun n'est en charge du réseau.

---

## 2. Ce qui est établi, et qui ne suffit pas

| Fait établi | Source |
|---|---|
| Deux sites géographiquement distincts, Moutela et Nkayi | Recueil, section 1.3 |
| Le personnel tourne entre les deux selon un planning de permutation | Recueil, section 1.3 |
| **Aucun système d'information centralisé n'existe entre les deux sites** | Recueil, section 1.3 |
| Chaque site fonctionne en autonomie, avec ses propres fichiers | Recueil, section 1.3 |
| Consolidation manuelle par le Médecin Chef | Recueil, section 1.3 |
| Des postes bureautiques existent, avec tableur | Recueil, section 2 de l'entretien pharmacienne |

**Une preuve indirecte forte.** L'architecture réalisée est entièrement conçue pour fonctionner sans réseau : réplication complète des données sur chaque poste, serveur embarqué, résolution de conflit. On ne construit pas un tel dispositif pour un environnement où la connexion serait fiable.

**Mais elle ne permet pas de tracer un schéma.** Elle établit qu'un problème de connectivité existait ; elle n'en donne ni la topologie, ni l'ampleur, ni la fréquence.

---

## 3. Informations à obtenir

| Catégorie | Détail attendu |
|---|---|
| **Topologie par site** | Type de réseau, plan d'adressage, segmentation éventuelle |
| **Équipements actifs** | Commutateurs, routeurs, pare-feu : nombre, modèle, âge |
| **Couverture sans fil** | Points d'accès, zones couvertes |
| **Liaison Moutela ↔ Nkayi** | **Existe-t-elle ?** Si oui : technologie, débit, disponibilité constatée |
| **Accès à Internet** | Fournisseur, débit souscrit, **débit réel constaté**, taux d'indisponibilité |
| **Alimentation électrique** | Onduleurs, autonomie, fréquence des coupures |
| **Serveurs sur site** | En existe-t-il, ou tout est-il en poste de travail ? |
| Postes de travail | Nombre par site, système d'exploitation, caractéristiques |

> **La ligne la plus importante est la disponibilité réelle.** C'est elle qui justifie factuellement le choix du fonctionnement hors connexion au chapitre 7. Sans chiffre, l'argument demeure une affirmation raisonnable — mais une affirmation.

---

## 4. Consignes de tracé, une fois la source obtenue

**Structure en deux zones**, une par site, reliées — ou non — par la liaison inter-sites.

Dans chaque zone : équipements actifs, postes de travail, serveur éventuel. Sortie vers Internet représentée en haut.

**Chaque lien porte son annotation** : technologie et débit. Si la liaison entre les deux sites n'existe pas, **le montrer explicitement** — par une absence de trait accompagnée d'une note *« aucune liaison »*, plus parlante qu'un simple vide.

Légende des symboles obligatoire.

**Source à indiquer en légende** : *« relevé d'infrastructure du [ date ], service informatique de SARIS-CONGO »*. Jamais « conception propre » : une infrastructure ne se conçoit pas ici, elle se relève.

---

## 5. Que faire si la source reste indisponible

Trois options, par ordre de préférence.

**Option 1 — Un entretien ciblé.** Vingt minutes avec le responsable informatique suffiraient à renseigner les huit lignes du § 3. C'est de loin le meilleur rapport effort / valeur du dossier restant.

**Option 2 — Remplacer par un schéma de déploiement du système.** Renoncer à décrire l'infrastructure existante et présenter à sa place l'architecture technique déployée. Cela déplace la figure du chapitre 2 vers le chapitre 7, où elle existe déjà — la figure 7.7. **Cette option revient à supprimer la figure 2.1.**

**Option 3 — Retirer la figure.** Adapter le texte du § 2.2 en indiquant explicitement que l'infrastructure n'a pas pu être relevée.

> ⚠️ **Ce qu'il ne faut faire en aucun cas** : dessiner un schéma réseau plausible. Un jury connaissant le site le repérerait immédiatement, et cela invaliderait la crédibilité de l'ensemble du chapitre 2 — y compris des parties exactes.
>
> **Recommandation** : option 1. À défaut, option 3, avec mention explicite. La figure 2.1 est alors retirée de la liste des figures.
