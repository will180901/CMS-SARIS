# UML-CTX-01 — Diagramme de contexte statique

## Bloc 1 — Cartouche

```
Identifiant       : UML-CTX-01
Figure du mémoire : Figure 6.1 — Diagramme de contexte statique du système
Chapitre / section: 6 — § 6.2
Type UML          : Diagramme de contexte statique
Sources de preuve : INV-03 § 2 (acteurs) · INV-01 (flux) · INV-05 (systèmes externes)
Statut            : IMPLÉMENTÉ
Format conseillé  : A4 paysage
Densité           : 1 système · 6 acteurs · 14 flux
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Où s'arrête le système, qui échange avec lui, et quelle est la nature de chaque échange. C'est la première figure que le lecteur rencontre : elle doit se comprendre sans explication.

**Ce qu'elle ne montre volontairement pas.** Aucun détail interne. Ni module, ni écran, ni base de données. Le système est une boîte unique.

---

## Bloc 3 — Éléments à dessiner

| N° | Libellé exact | Forme | Stéréotype | Placement |
|---|---|---|---|---|
| E1 | `CMS SARIS` | **Rectangle central**, grand, bordure épaisse | système | centre |
| E2 | `Administrateur Système` | Bonhomme-bâton | acteur primaire | gauche, haut |
| E3 | `Médecin Chef` | Bonhomme-bâton | acteur primaire | gauche, milieu |
| E4 | `Infirmier` | Bonhomme-bâton | acteur primaire | gauche, bas |
| E5 | `Poste local autonome` | **Rectangle** avec `«système»` | acteur secondaire | droite, haut |
| E6 | `Service de géolocalisation` | **Rectangle** avec `«système externe»` | acteur secondaire | droite, milieu |
| E7 | `Canal de mise à jour` | **Rectangle** avec `«système externe»` | acteur secondaire | droite, bas |

> Convention retenue : les acteurs **humains** sont des bonshommes-bâtons ; les acteurs **systèmes** sont des rectangles stéréotypés. Cette distinction visuelle est essentielle et doit être respectée.

## Bloc 4 — Contenu interne des formes

Le rectangle central ne contient **que** son nom, `CMS SARIS`, écrit en gras et centré. Aucun contenu interne : c'est une boîte noire.

Les rectangles des acteurs systèmes portent leur stéréotype `«système»` ou `«système externe»` **au-dessus** de leur nom.

---

## Bloc 5 — Flux à tracer

Chaque flux est une **flèche pleine à tête ouverte**, étiquetée du nom du flux. Le sens indique qui envoie l'information.

| N° | De | Vers | Libellé du flux |
|---:|---|---|---|
| F01 | `Administrateur Système` | `CMS SARIS` | Gestion des comptes et des rôles |
| F02 | `Administrateur Système` | `CMS SARIS` | Paramétrage du système |
| F03 | `CMS SARIS` | `Administrateur Système` | Journal d'audit, état du parc |
| F04 | `Médecin Chef` | `CMS SARIS` | Actes cliniques, prescriptions, décisions |
| F05 | `Médecin Chef` | `CMS SARIS` | Délégations de prescription |
| F06 | `Médecin Chef` | `CMS SARIS` | Gouvernance des référentiels et du personnel |
| F07 | `CMS SARIS` | `Médecin Chef` | Documents cliniques, tableaux de bord, rapports |
| F08 | `Infirmier` | `CMS SARIS` | Enregistrement des visites, constantes vitales |
| F09 | `Infirmier` | `CMS SARIS` | Consultations et prescriptions déléguées |
| F10 | `CMS SARIS` | `Infirmier` | File d'attente, dossiers, documents à imprimer |
| F11 | `Poste local autonome` | `CMS SARIS` | Modifications produites hors connexion |
| F12 | `CMS SARIS` | `Poste local autonome` | Données à jour, notification de nouveauté |
| F13 | `CMS SARIS` | `Service de géolocalisation` | Adresse IP à localiser |
| F14 | `Service de géolocalisation` | `CMS SARIS` | Ville et coordonnées |
| F15 | `Canal de mise à jour` | `Poste local autonome` | Nouvelle version de l'application |

> **Note sur F15** : ce flux relie deux acteurs **sans passer par le système**. Le tracer en **pointillés** et l'annoter `hors périmètre` — il documente le contexte sans faire partie du système.

---

## Bloc 6 — Plan de placement

**Trois colonnes.**

- **Colonne gauche** : les trois acteurs humains, de haut en bas dans l'ordre E2, E3, E4.
- **Colonne centrale** : le rectangle `CMS SARIS`, occupant environ 40 % de la largeur et centré verticalement.
- **Colonne droite** : les trois acteurs systèmes, de haut en bas dans l'ordre E5, E6, E7.

**Règles de tracé :**
- Tous les flux des acteurs humains abordent le rectangle par son **bord gauche**.
- Tous les flux des acteurs systèmes abordent le rectangle par son **bord droit**.
- Aucun flux ne traverse le rectangle central.
- Les flux allant dans les deux sens entre un même acteur et le système se tracent comme **deux flèches parallèles distinctes**, jamais comme une flèche double.
- F15 longe le bord droit sans toucher le rectangle central.

**Ordre de lecture** : gauche vers droite. Les acteurs humains agissent, le système répond, les systèmes externes assistent.

---

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Système | Rectangle à bordure épaisse, nom en gras |
| Acteur humain | Bonhomme-bâton, nom dessous |
| Acteur système | Rectangle avec stéréotype entre guillemets français |
| Flux | Flèche pleine, tête ouverte, libellé au-dessus du trait |
| Flux hors périmètre | Flèche en pointillés, annotée |

**Légende à reproduire :**

> **Figure 6.1 — Diagramme de contexte statique du système**
> Trois acteurs primaires humains, trois acteurs secondaires systèmes. Le flux en pointillés relie deux acteurs sans transiter par le système.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 7 éléments du bloc 3 sont présents
[ ] Les acteurs humains sont des bonshommes-bâtons, les systèmes des rectangles stéréotypés
[ ] Les 15 flux sont tracés, chacun étiqueté
[ ] Le sens de chaque flèche correspond au tableau du bloc 5
[ ] Aucun flux ne traverse le rectangle central
[ ] F15 est en pointillés et annoté « hors périmètre »
[ ] Aucun détail interne n'apparaît dans le rectangle CMS SARIS
[ ] Aucun acteur supplémentaire n'a été ajouté — il n'existe que 3 rôles
```

## Vérification finale

| Point | Source |
|---|---|
| Il n'existe que 3 rôles, donc 3 acteurs primaires | INV-03 § 1.2 |
| Le poste autonome dialogue bien avec le serveur | INV-05 § 5.1 |
| La géolocalisation est un service externe avec repli | INV-01 § 5.5 |

---

## ⚠️ Corrections du 30 août 2026

**La frontière ne s'appelle plus « CMS SARIS ».** Ce nom n'existe pas dans le mémoire — relevé fait sur le Word, zéro occurrence. La boîte du système porte désormais **« Système de gestion des consultations et des dossiers médicaux »**. Voir décision **D-43**.

**Cinq étiquettes de flux sont des condensations assumées** du tableau 6.4, colonne « Vocation » : *Comptes et rôles*, *Référentiels et personnel*, *Documents, tableaux de bord*, *Consultations déléguées*, *Modifications hors connexion*. Le Word écrit ces notions en phrases — « gouvernance des référentiels et du personnel », « prescription sous délégation ». Une étiquette de flux condense, elle ne cite pas.
