# ORG-01 — Organigramme du Service Médico-Social

> ✅ **Fiche débloquée le 2026-08-10** par l'arrivée du recueil de l'existant, qui documente la structure au niveau nécessaire.

## Bloc 1 — Cartouche

```
Identifiant       : ORG-01
Figure du mémoire : Figure 1.1 — Organigramme du Service Médico-Social de SARIS-CONGO
Chapitre / section: 1 — § 1.3.1
Type              : Organigramme hiérarchique (non UML)
Sources de preuve : Recueil de l'existant — section 1.1 « Position du CMS dans l'organigramme
                    général » et section 1.2 « Divisions internes du CMS »
                    Extrait dans INV-08 §§ 2.1 et 2.2
                    SOURCE PRIMAIRE
Statut            : OBSERVÉ
Format conseillé  : A4 paysage
Densité           : 4 entités hiérarchiques · 6 pôles · 2 sites
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Trois choses, dans cet ordre de lisibilité :

1. le Service Médico-Social est **rattaché à la Direction des Ressources Humaines** — ce n'est pas une structure autonome ;
2. il se scinde en **deux entités** aux missions distinctes : l'administratif et le soin ;
3. le **Médecin Chef occupe deux positions simultanées** — il dirige le service et gère le centre de soins.

**Ce qu'elle ne montre pas.** Les effectifs, absents du recueil. La figure représente la **structure**, non les personnes.

---

## Bloc 3 — Éléments à dessiner

### Niveau hiérarchique — rectangles à trait plein

| N° | Libellé exact à écrire | Sous-titre à écrire dessous | Niveau |
|---|---|---|---|
| H1 | `DRH` | `Direction des Ressources Humaines` | 1 — sommet |
| H2 | `SMS` | `Service Médico-Social` | 2 |
| H3 | `SAS` | `Section des Affaires Sociales` | 3, à gauche |
| H4 | `CMS` | `Centre Médico-Sanitaire` | 3, à droite |

### Étiquettes de direction — petits cartouches accolés

| N° | Texte | Accolé à |
|---|---|---|
| D1 | `dirigé par le Médecin Chef` | H2 |
| D2 | `géré par un Responsable RH` | H3 |
| D3 | `géré par le Médecin Chef` | H4 |

> ⚠️ **Le libellé D1 et le libellé D3 désignent la même personne.** C'est le point le plus instructif de la figure. Il doit être visible, et une annotation le souligne au bloc 5.

### Attributions — encadrés en pointillés, sous chaque entité de niveau 3

| N° | Sous | Contenu |
|---|---|---|
| A1 | `SAS` | `Évacuations sanitaires · Remboursements · Accidents de travail · Congés maladie et maternité` |
| A2 | `CMS` | `Soins médicaux · Pharmacie · Laboratoire · Radiologie · Kinésithérapie · Maternité` |

### Les six pôles du centre — rectangles arrondis, en éventail sous `CMS`

| N° | Libellé exact |
|---|---|
| P1 | `Consultation et soins` |
| P2 | `Radiologie` |
| P3 | `Laboratoire d'analyses` |
| P4 | `Pharmacie` |
| P5 | `Service de Maternité Infantile` |
| P6 | `Kinésithérapie` |

Sous `P1`, un sous-encadré : `Consultation générale · Consultation spécialisée : ophtalmologie, ORL, stomatologie`.

### Les deux sites — encadré transversal en bas

| N° | Libellé exact |
|---|---|
| S1 | `Site de Moutela` |
| S2 | `Site de Nkayi` |

---

## Bloc 4 — Marquage du périmètre du projet

**C'est l'apport principal de cette figure au mémoire.** Le périmètre retenu doit être **visible sur l'organigramme**.

| Élément | Marquage |
|---|---|
| `Consultation et soins`, composante **générale** | **Encadré en trait épais** ou fond légèrement teinté — *dans le périmètre* |
| Les cinq autres pôles | Trait normal, sans marquage |
| `Consultation spécialisée` | Trait normal — *hors périmètre* |
| `SAS` et ses attributions | Trait normal — *hors périmètre* |

**Légende du marquage**, à placer en bas à droite :

> `Trait épais : périmètre couvert par le système CMS SARIS`

> **Pourquoi c'est important.** Un jury qui lit le recueil verra que la pharmacie et le service social ont été étudiés. Cette figure lui montre, **d'un seul regard**, ce qui a été retenu et ce qui ne l'a pas été. Elle évite une question embarrassante en y répondant avant qu'elle ne soit posée.

---

## Bloc 5 — Liens à tracer

Traits **pleins verticaux et horizontaux**, sans tête de flèche — convention de l'organigramme.

| N° | De | Vers | Type |
|---:|---|---|---|
| L1 | `DRH` | `SMS` | rattachement hiérarchique |
| L2 | `SMS` | `SAS` | division |
| L3 | `SMS` | `CMS` | division |
| L4 | `CMS` | `P1` à `P6` | composition, en éventail |
| L5 | `P1` | sous-encadré des consultations | composition |
| L6 | `CMS` | encadré des deux sites | implantation — **trait pointillé** |

### Annotations obligatoires

| N° | Attachée à | Texte |
|---|---|---|
| N1 | Entre D1 et D3 | *« Le Médecin Chef dirige le Service Médico-Social et gère le Centre. Cette double fonction est identifiée comme son principal point de tension, et motive la délégation de tâches. »* |
| N2 | Encadré des sites | *« Le personnel médical n'est pas affecté à un site unique : il tourne entre les deux selon un planning de permutation. »* |
| N3 | Encadré des sites | *« Aucun système d'information ne reliait les deux sites. La consolidation était assurée manuellement par le Médecin Chef. »* |

---

## Bloc 6 — Plan de placement

**Structure en arbre descendant, sur quatre bandes.**

**Bande 1 — sommet** : `DRH`, seul, centré.

**Bande 2** : `SMS`, centré sous `DRH`, avec son cartouche de direction à droite.

**Bande 3** : `SAS` à gauche, `CMS` à droite, à égale distance de l'axe. Leurs encadrés d'attributions en pointillés juste dessous.

**Bande 4** : les six pôles en éventail sous `CMS`, sur une ou deux rangées de trois. Le pôle `Consultation et soins` est placé **le plus à gauche**, avec son sous-encadré, et porte le marquage de périmètre.

**Bande 5 — transversale, en bas** : un encadré large contenant les deux sites, relié à `CMS` par un trait pointillé.

**Règles de tracé :**

- Les deux cartouches mentionnant le Médecin Chef — sous `SMS` et sous `CMS` — doivent être **visuellement alignés ou reliés**, pour que la double fonction saute aux yeux.
- L'asymétrie est voulue : `CMS` porte six pôles, `SAS` n'en porte aucun. Ne pas chercher à équilibrer artificiellement.
- Aucun trait ne doit traverser un encadré.
- La bande des sites est **transversale** : elle concerne le centre entier, pas un pôle.

---

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Entité hiérarchique | Rectangle à trait plein, sigle en gras, intitulé complet dessous |
| Cartouche de direction | Petit rectangle accolé, texte en italique |
| Attributions | Encadré à trait **pointillé** |
| Pôle de compétence | Rectangle à coins arrondis |
| Rattachement | Trait plein, sans flèche |
| Implantation | Trait **pointillé** |
| **Périmètre du projet** | **Trait épais** ou fond teinté |

**Légende à reproduire :**

> **Figure 1.1 — Organigramme du Service Médico-Social de SARIS-CONGO**
> Le Médecin Chef dirige le Service et gère le Centre Médico-Sanitaire. Le trait épais signale le périmètre couvert par le système réalisé : la consultation générale, à l'exclusion des cinq autres pôles et de la Section des Affaires Sociales.
> *Source : recueil de l'existant, entretiens conduits au Service Médico-Social.*

---

## Bloc 8 — Contrôles après dessin

```
[ ] Les 4 entités hiérarchiques sont présentes, avec sigle ET intitulé complet
[ ] La DRH est bien au SOMMET — le service n'est pas autonome
[ ] Les 3 cartouches de direction sont présents
[ ] Le double rôle du Médecin Chef est visuellement évident
[ ] Les 2 encadrés d'attributions sont en POINTILLÉS
[ ] Les 6 pôles sont présents
[ ] Le sous-encadré des consultations spécialisées est présent
[ ] Le marquage du périmètre est appliqué à « Consultation et soins » UNIQUEMENT
[ ] La légende du marquage est présente
[ ] L'encadré des deux sites est TRANSVERSAL, relié en pointillés
[ ] Les 3 annotations sont présentes
[ ] AUCUN effectif n'est indiqué — ils ne sont pas documentés
[ ] Aucun nom de personne n'apparaît
```

---

## Vérification finale contre la source primaire

| Point | Source dans le recueil |
|---|---|
| Le Service Médico-Social fait partie intégrante de la Direction des Ressources Humaines | Section 1.1 |
| Le Service est dirigé par le Médecin Chef | Section 1.1, niveau 2 |
| Il donne naissance à deux entités opérationnelles | Section 1.1 |
| La Section des Affaires Sociales est gérée par un Responsable RH | Section 1.1, niveau 3a |
| Le Centre Médico-Sanitaire est géré par le Médecin Chef | Section 1.1, niveau 3b |
| Attributions de la Section : évacuations, remboursements, accidents | Section 1.1, niveau 3a |
| Attributions du Centre : soins, pharmacie, laboratoire, radiologie, kinésithérapie, maternité | Section 1.1, niveau 3b |
| Les six pôles de compétences | Section 1.2 |
| Consultation spécialisée : ophtalmologie, ORL, stomatologie | Section 1.2 |
| Deux sites, personnel tournant par permutation | Section 1.3 |
| Aucun système d'information entre les sites | Section 1.3, point d'attention |
| Double fonction du Médecin Chef et surcharge | Section 3, tableau des acteurs · Section 4.1 |

## Ce qui n'est pas documenté et ne doit pas être inventé

| Élément | Question |
|---|---|
| Effectifs par entité et par site | QO-02 |
| Noms des responsables | QO-02 — et à ne pas publier sans autorisation |
| Existence d'échelons intermédiaires — surveillants, chefs de pôle | QO-02 |
| Position du service informatique, s'il existe | QO-03 |

> **En cas de doute, ne pas ajouter de case.** Un organigramme enrichi d'entités supposées est un organigramme faux. Mieux vaut une structure juste et incomplète qu'une structure complète et inventée.
