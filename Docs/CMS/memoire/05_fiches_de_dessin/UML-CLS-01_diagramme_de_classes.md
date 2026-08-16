# UML-CLS-01 — Diagramme de classes du système

## Bloc 1 — Cartouche

```
Identifiant       : UML-CLS-01
Figures du mémoire : Figure 7.1 à Figure 7.4 — un diagramme par package · Figure 7.5 — diagramme global
Chapitre / section: 7 — § 7.2
Type UML          : Diagramme de classes
Sources de preuve : packages/db/prisma/schema.prisma · INV-02 §§ 3 et 4
Statut            : IMPLÉMENTÉ
Format conseillé  : A3 paysage, ou A4 paysage en deux planches (voir bloc 6)
Densité           : 29 classes · 38 associations
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Que le domaine s'organise autour de trois pivots — la personne soignée, l'acte de soin, l'agent qui le réalise — et que le parcours clinique forme une chaîne continue : patient → visite → consultation → documents.

**Ce qu'elle ne montre volontairement pas.** 59 entités sur 88 sont écartées : messagerie, synchronisation, audit, notifications, sessions, historiques. Motif : lisibilité. Critère de sélection énoncé au chapitre 7 § 7.2.1 — degré de connexion ≥ 2 dans les domaines clinique, acteurs et référentiels, plus deux exceptions justifiées (`ConstanteVitale`, `DroitCategoriePatient`). Les entités écartées figurent dans l'inventaire du modèle de données, INV-02.

---

## Bloc 3 — Éléments à dessiner

Chaque classe est un **rectangle à trois compartiments** : nom, attributs, opérations (le compartiment des opérations reste **vide** — le modèle est un modèle de données).

| N° | Libellé exact à écrire | Groupe | Placement |
|---|---|---|---|
| C01 | `Patient` | Dossier patient | **centre** |
| C02 | `IdentitePatient` | Dossier patient | centre-bas |
| C03 | `EmployeSaris` | Acteurs | gauche-bas |
| C04 | `RattachementAyantDroitCdi` | Acteurs | gauche-bas |
| C05 | `RattachementSousTraitant` | Acteurs | gauche-bas |
| C06 | `Visite` | Triage | centre-droit |
| C07 | `ConstanteVitale` | Triage | centre-droit |
| C08 | `Consultation` | Actes | **droite, pivot** |
| C09 | `DiagnosticConsultation` | Actes | droite |
| C10 | `Ordonnance` | Actes | droite |
| C11 | `LigneOrdonnance` | Actes | extrême droite |
| C12 | `BonExamen` | Actes | extrême droite |
| C13 | `LigneExamen` | extrême droite | extrême droite |
| C14 | `BonPharmacie` | Actes | extrême droite |
| C15 | `LigneBonPharmacie` | Actes | extrême droite |
| C16 | `Evacuation` | Sorties critiques | extrême droite |
| C17 | `Site` | Référentiels | haut-gauche |
| C18 | `CategoriePatient` | Référentiels | gauche |
| C19 | `DroitCategoriePatient` | Référentiels | gauche |
| C20 | `PathologieReference` | Référentiels | bas |
| C21 | `MedicamentReference` | Référentiels | bas |
| C22 | `TypeExamen` | Référentiels | bas |
| C23 | `Utilisateur` | Sécurité | **haut** |
| C24 | `UtilisateurRole` | Sécurité | haut |
| C25 | `Role` | Sécurité | haut |
| C26 | `RolePermission` | Sécurité | haut |
| C27 | `Permission` | Sécurité | haut |
| C28 | `PersonnelMedical` | Acteurs | haut-centre |
| C29 | `DelegationPrescription` | Acteurs | haut-droit |

---

## Bloc 4 — Contenu de chaque classe

Les attributs listés sont ceux **à écrire dans le compartiment du milieu**. Les identifiants sont **soulignés**. Les clés étrangères ne s'écrivent **pas** comme attributs : elles sont portées par les associations du bloc 5.

Les colonnes techniques communes — `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `version` — **ne sont pas reportées** sur le diagramme : elles existent sur presque toutes les classes et les surchargeraient. Une note en légende le signale.

| Classe | Attributs à écrire |
|---|---|
| `Patient` | <u>id</u> : String · numeroPatient : String {unique} · matricule : String [0..1] {unique} · statut : StatutPatient · verrouille : Boolean · motifVerrou : String [0..1] |
| `IdentitePatient` | <u>id</u> : String · nom : String · prenom : String · dateNaissance : Date [0..1] · sexe : String [0..1] · telephone : String [0..1] · adresse : String [0..1] |
| `EmployeSaris` | <u>id</u> : String · matricule : String {unique} · nom : String · prenom : String · fonction : String [0..1] · service : String [0..1] · categorie : String · statut : String |
| `RattachementAyantDroitCdi` | <u>id</u> : String · typeLien : String |
| `RattachementSousTraitant` | <u>id</u> : String |
| `Visite` | <u>id</u> : String · statut : StatutVisite · dateOuverture : DateTime · dateCloture : DateTime [0..1] · notesAccueil : String [0..1] · motifAnnulation : String [0..1] · creerHorsLigne : Boolean |
| `ConstanteVitale` | <u>id</u> : String · temperature : Float [0..1] · tensionSystolique : Int [0..1] · tensionDiastolique : Int [0..1] · frequenceCardiaque : Int [0..1] · saturationO2 : Float [0..1] · poids : Float [0..1] · taille : Float [0..1] · imc : Float [0..1] |
| `Consultation` | <u>id</u> : String · statut : StatutConsultation · examenClinique : String [0..1] · conclusion : String [0..1] · **decisionMedicale : String [0..1]** · reposJours : Int [0..1] · dateReprise : Date [0..1] · closedAt : DateTime [0..1] |
| `DiagnosticConsultation` | <u>id</u> : String · type : String · certitude : String |
| `Ordonnance` | <u>id</u> : String · statut : String · **typeOrdonnance : String [0..1]** · indicationClinik : String [0..1] · motifAnnulation : String [0..1] |
| `LigneOrdonnance` | <u>id</u> : String · posologie : String [0..1] · duree : String [0..1] · voieAdmin : String [0..1] · quantite : String [0..1] |
| `BonExamen` | <u>id</u> : String · statut : String · indicationClinik : String · motifAnnulation : String [0..1] |
| `LigneExamen` | <u>id</u> : String |
| `BonPharmacie` | <u>id</u> : String · statut : String · observations : String [0..1] · delivreLe : DateTime [0..1] · motifAnnulation : String [0..1] |
| `LigneBonPharmacie` | <u>id</u> : String |
| `Evacuation` | <u>id</u> : String · statut : String · niveauUrgence : String · infosCliniques : String [0..1] · motifAnnulation : String [0..1] |
| `Site` | <u>id</u> : String · code : String {unique} · libelle : String · localisation : String [0..1] · statut : String |
| `CategoriePatient` | <u>id</u> : String · code : String {unique} · libelle : String · statut : String |
| `DroitCategoriePatient` | <u>id</u> : String · **typePrestation : String** · **couvert : Boolean** · plafondConsultations : Int [0..1] |
| `PathologieReference` | <u>id</u> : String · code : String {unique} · libelle : String |
| `MedicamentReference` | <u>id</u> : String · code : String {unique} · libelle : String |
| `TypeExamen` | <u>id</u> : String · code : String {unique} · libelle : String |
| `Utilisateur` | <u>id</u> : String · login : String {unique} · email : String {unique} · statut : StatutCompte · motDePasseTemp : Boolean · tentativesEchec : Int · blocageJusquA : DateTime [0..1] |
| `UtilisateurRole` | <u>utilisateurId, roleId</u> *(clé composite)* |
| `Role` | <u>id</u> : String · code : String {unique} · libelle : String |
| `RolePermission` | <u>roleId, permissionId</u> *(clé composite)* |
| `Permission` | <u>id</u> : String · code : String {unique} · module : String |
| `PersonnelMedical` | <u>id</u> : String · nom : String · prenom : String · matricule : String {unique} · role : String · statut : String |
| `DelegationPrescription` | <u>id</u> : String · dateDebut : DateTime · dateFin : DateTime · statut : String · perimetre : String [0..1] |

> ⚠️ Le mot-clé souligné en gras dans `Consultation`, `Ordonnance` et `DroitCategoriePatient` signale les attributs **porteurs de règle métier**. Ne pas les omettre : ce sont eux qui rendent le diagramme parlant.

---

## Bloc 5 — Liens à tracer

**38 associations.** Toutes sont des associations simples, en **trait plein sans tête de flèche**, sauf mention contraire. La multiplicité s'écrit **à l'extrémité de la classe comptée**.

| N° | De | Rôle | Mult. côté « Vers » | Vers | Rôle inverse | Mult. côté « De » | Clé étrangère |
|---:|---|---|:---:|---|---|:---:|---|
| L01 | `Utilisateur` | site | 1 | `Site` | utilisateurs | 0..* | `Utilisateur.siteId` |
| L02 | `Utilisateur` | personnelMedical | 0..1 | `PersonnelMedical` | utilisateur | 0..1 | `Utilisateur.personnelMedicalId` |
| L03 | `Utilisateur` | roles | 0..* | `UtilisateurRole` | utilisateur | 1 | `UtilisateurRole.utilisateurId` |
| L04 | `Role` | utilisateurs | 0..* | `UtilisateurRole` | role | 1 | `UtilisateurRole.roleId` |
| L05 | `Role` | permissions | 0..* | `RolePermission` | role | 1 | `RolePermission.roleId` |
| L06 | `Permission` | roles | 0..* | `RolePermission` | permission | 1 | `RolePermission.permissionId` |
| L07 | `Site` | patients | 0..* | `Patient` | siteCreation | 1 | `Patient.siteCreationId` |
| L08 | `Site` | visites | 0..* | `Visite` | site | 1 | `Visite.siteId` |
| L09 | `CategoriePatient` | droits | 0..* | `DroitCategoriePatient` | categorie | 1 | `DroitCategoriePatient.categorieId` |
| L10 | `CategoriePatient` | patients | 0..* | `Patient` | categoriePatient | 1 | `Patient.categoriePatientId` |
| L11 | `PathologieReference` | diagnostics | 0..* | `DiagnosticConsultation` | pathologie | 1 | `DiagnosticConsultation.pathologieId` |
| L12 | `MedicamentReference` | lignesOrdonnance | 0..* | `LigneOrdonnance` | medicament | 0..1 | `LigneOrdonnance.medicamentId` |
| L13 | `MedicamentReference` | lignesBonPharmacie | 0..* | `LigneBonPharmacie` | medicament | 0..1 | `LigneBonPharmacie.medicamentId` |
| L14 | `TypeExamen` | lignes | 0..* | `LigneExamen` | typeExamen | 1 | `LigneExamen.typeExamenId` |
| L15 | `TypeExamen` | lignesOrdonnance | 0..* | `LigneOrdonnance` | typeExamen | 0..1 | `LigneOrdonnance.typeExamenId` |
| L16 | `PersonnelMedical` | delegationsDonnees | 0..* | `DelegationPrescription` | medecinChef | 1 | `DelegationPrescription.medecinChefId` |
| L17 | `PersonnelMedical` | delegationsRecues | 0..* | `DelegationPrescription` | infirmier | 1 | `DelegationPrescription.infirmierId` |
| L18 | `PersonnelMedical` | consultations | 0..* | `Consultation` | soignant | 1 | `Consultation.soignantId` |
| L19 | `DelegationPrescription` | ordonnances | 0..* | `Ordonnance` | delegation | 0..1 | `Ordonnance.delegationId` |
| L20 | `DelegationPrescription` | consultations | 0..* | `Consultation` | delegation | 0..1 | `Consultation.delegationId` |
| L21 | `EmployeSaris` | patients | 0..* | `Patient` | employe | 0..1 | `Patient.employeId` |
| L22 | `EmployeSaris` | rattachementsAyantDroit | 0..* | `RattachementAyantDroitCdi` | employe | 0..1 | `RattachementAyantDroitCdi.employeId` |
| L23 | `RattachementAyantDroitCdi` | patient | 1 | `Patient` | rattachementsAD | 0..* | `RattachementAyantDroitCdi.patientId` |
| L24 | `RattachementSousTraitant` | patient | 1 | `Patient` | rattachementsST | 0..* | `RattachementSousTraitant.patientId` |
| L25 | `Patient` | identite | 0..1 | `IdentitePatient` | patient | 1 | `IdentitePatient.patientId` |
| L26 | `Patient` | visites | 0..* | `Visite` | patient | 1 | `Visite.patientId` |
| L27 | `Visite` | constantes | 0..* | `ConstanteVitale` | visite | 1 | `ConstanteVitale.visiteId` |
| L28 | `Visite` | consultations | 0..* | `Consultation` | visite | 1 | `Consultation.visiteId` |
| L29 | `Consultation` | diagnostics | 0..* | `DiagnosticConsultation` | consultation | 1 | `DiagnosticConsultation.consultationId` |
| L30 | `Consultation` | ordonnances | 0..* | `Ordonnance` | consultation | 1 | `Ordonnance.consultationId` |
| L31 | `Consultation` | bonsExamen | 0..* | `BonExamen` | consultation | 1 | `BonExamen.consultationId` |
| L32 | `Consultation` | bonsPharmacie | 0..* | `BonPharmacie` | consultation | 1 | `BonPharmacie.consultationId` |
| L33 | `Consultation` | evacuation | 0..1 | `Evacuation` | consultation | 1 | `Evacuation.consultationId` {unique} |
| L34 | `Ordonnance` | lignes | 0..* | `LigneOrdonnance` | ordonnance | 1 | `LigneOrdonnance.ordonnanceId` |
| L35 | `Ordonnance` | bonsExamen | 0..* | `BonExamen` | ordonnance | 0..1 | `BonExamen.ordonnanceId` |
| L36 | `Ordonnance` | bonsPharmacie | 0..* | `BonPharmacie` | ordonnance | 0..1 | `BonPharmacie.ordonnanceId` |
| L37 | `BonExamen` | lignes | 0..* | `LigneExamen` | bon | 1 | `LigneExamen.bonId` |
| L38 | `BonPharmacie` | lignes | 0..* | `LigneBonPharmacie` | bon | 1 | `LigneBonPharmacie.bonId` |

### Compositions à marquer d'un losange plein

Les associations suivantes sont des **compositions** : la partie n'existe pas sans le tout. **Losange plein du côté du composite.**

| Lien | Composite (losange) | Composant |
|---|---|---|
| L25 | `Patient` | `IdentitePatient` |
| L27 | `Visite` | `ConstanteVitale` |
| L34 | `Ordonnance` | `LigneOrdonnance` |
| L37 | `BonExamen` | `LigneExamen` |
| L38 | `BonPharmacie` | `LigneBonPharmacie` |
| L29 | `Consultation` | `DiagnosticConsultation` |

Toutes les autres restent des **associations simples**.

### Point d'attention sur les doubles associations

Trois paires de classes sont reliées **deux fois**, par des associations de sens métier différent. Les deux traits doivent être tracés **séparément et étiquetés distinctement**, sans quoi le lecteur croira à une erreur.

| Paire | Les deux associations |
|---|---|
| `PersonnelMedical` ↔ `DelegationPrescription` | L16 `medecinChef` — celui qui **accorde** · L17 `infirmier` — celui qui **reçoit** |
| `MedicamentReference` ↔ lignes | L12 vers `LigneOrdonnance` · L13 vers `LigneBonPharmacie` |
| `TypeExamen` ↔ lignes | L14 vers `LigneExamen` · L15 vers `LigneOrdonnance` |

---

## Bloc 6 — Plan de placement

**Format : A3 paysage.** Si seul l'A4 est possible, scinder en deux planches selon la coupure indiquée plus bas.

**Cinq bandes horizontales, de haut en bas :**

**Bande 1 — Sécurité et acteurs** *(haut)*
De gauche à droite : `Permission` — `RolePermission` — `Role` — `UtilisateurRole` — `Utilisateur` — `PersonnelMedical` — `DelegationPrescription`.
Chaîne strictement horizontale. `Utilisateur` se relie à `Site` (bande 2) par un trait descendant à gauche, et à `PersonnelMedical` par un trait horizontal court.

**Bande 2 — Référentiels** *(gauche)*
Colonne verticale à l'extrême gauche : `Site`, `CategoriePatient`, `DroitCategoriePatient`.
`DroitCategoriePatient` se place **directement sous** `CategoriePatient` : leur lien est le plus court du diagramme, ce qui met visuellement en évidence la règle d'éligibilité.

**Bande 3 — Dossier patient** *(centre)*
`Patient` au **centre géométrique de la planche** — c'est le pivot, degré 18.
Autour : `IdentitePatient` juste en dessous · `EmployeSaris`, `RattachementAyantDroitCdi`, `RattachementSousTraitant` en bas à gauche.

**Bande 4 — Parcours clinique** *(centre vers droite, ligne directrice)*
De gauche à droite, **strictement alignés horizontalement** :
`Patient` → `Visite` → `Consultation` → `Ordonnance` → `BonPharmacie` / `BonExamen`
`ConstanteVitale` se place sous `Visite`. `DiagnosticConsultation` sous `Consultation`. `Evacuation` sous les bons.
**Cette ligne est l'épine dorsale du diagramme** : elle doit être immédiatement lisible, sans croisement.

**Bande 5 — Lignes de détail et référentiels cliniques** *(bas droite)*
`LigneOrdonnance`, `LigneExamen`, `LigneBonPharmacie` à l'extrême droite, chacune sous son document parent.
`PathologieReference`, `MedicamentReference`, `TypeExamen` en bas, reliés vers le haut.

**Ordre de lecture à induire** : haut vers bas pour la sécurité, puis **gauche vers droite** pour le parcours de soin.

**Coupure si deux planches A4 :**
- **Planche A — Domaine clinique** : bandes 3, 4 et 5, plus `Site` et `CategoriePatient` en référence.
- **Planche B — Sécurité et acteurs** : bandes 1 et 2, avec `Consultation` répétée en classe de référence grisée, pour raccrocher la délégation.

**Contraintes de tracé :**
- Aucun trait ne doit traverser une classe.
- Les liens L12, L13, L14, L15 (référentiels vers lignes) montent depuis le bas : les faire longer le bord inférieur pour éviter de couper la bande 4.
- Les deux traits `PersonnelMedical` ↔ `DelegationPrescription` doivent être visiblement écartés.

---

## Bloc 7 — Conventions de tracé et légende

| Élément | Convention |
|---|---|
| Classe | Rectangle à 3 compartiments : nom (gras, centré) · attributs · opérations (vide) |
| Association simple | Trait plein continu, **sans tête de flèche** |
| Composition | Trait plein avec **losange plein** côté composite |
| Multiplicité | Écrite près de l'extrémité, **du côté de la classe comptée** |
| Rôle | Écrit près de l'extrémité, en minuscules |
| Identifiant | **Souligné** |
| Attribut facultatif | Suffixe `[0..1]` |
| Contrainte d'unicité | `{unique}` après le type |

**Légende à reproduire sous la figure, mot pour mot :**

> **Figure 7.5 — Diagramme de classes du système**
> 29 classes retenues sur les 88 du modèle complet, sélectionnées selon leur degré de connexion. Les colonnes techniques communes (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `version`) ne sont pas représentées. le modèle complet figure dans l'inventaire du modèle de données, INV-02.
> *Source : conception propre, dérivée du schéma de données du système.*

---

## Bloc 8 — Contrôles après dessin

```
[ ] Les 29 classes du bloc 3 sont présentes, aucune en trop
[ ] Les 38 associations du bloc 5 sont tracées
[ ] Les 6 compositions portent un losange PLEIN, du bon côté
[ ] Chaque multiplicité est écrite du côté de la classe COMPTÉE, pas de l'autre
[ ] Chaque multiplicité correspond ligne à ligne au tableau du bloc 5
[ ] Les 3 paires à double association ont bien DEUX traits distincts et étiquetés
[ ] Aucun libellé n'a été traduit, abrégé ou reformulé
[ ] Les identifiants sont soulignés
[ ] La chaîne Patient → Visite → Consultation → Ordonnance → Bons est lisible en une seconde
[ ] DroitCategoriePatient est visuellement adjacent à CategoriePatient
[ ] Aucun trait ne traverse une classe
[ ] Le titre sous la figure est exactement celui du bloc 7
[ ] La figure reste lisible imprimée en noir et blanc, à sa taille finale
```

---

## Vérification finale contre les sources

| Point | Vérifié le | Source |
|---|---|---|
| Existence des 29 classes | 2026-08-10 | INV-02 § 7 |
| Exactitude des 38 associations et de leurs cardinalités | 2026-08-10 | INV-02 § 4, extraction automatique du schéma |
| Portage des clés étrangères | 2026-08-10 | INV-02 § 4, colonne « Porteur FK » |
| Attributs et contraintes d'unicité | 2026-08-10 | Schéma de données |
| Critère de sélection du noyau | 2026-08-10 | Registre des décisions, D-07 |

---

## ⚠️ Changement du 24 août 2026 — quatre diagrammes de package, puis le global

Le mémoire ne comporte plus **un seul** diagramme de classes, mais **cinq** : quatre par package, puis le diagramme global. La raison est la même que pour les cas d'utilisation — 29 classes et 38 associations sur une planche A4 ne se lisent pas — et elle suit le mémoire de référence de NGATSE et KUBEMBULA, qui procède exactement ainsi.

Le découpage est celui du tableau 7.4 du mémoire.

| Figure | Package | Classes | Place |
|---|---|---:|---|
| Figure 7.1 | Sécurité et habilitations | 5 — `Utilisateur`, `UtilisateurRole`, `Role`, `RolePermission`, `Permission` | demi-page |
| Figure 7.2 | Référentiels et acteurs médicaux | 8 — `Site`, `CategoriePatient`, `DroitCategoriePatient`, `PathologieReference`, `MedicamentReference`, `TypeExamen`, `PersonnelMedical`, `DelegationPrescription` | demi-page |
| Figure 7.3 | Dossier patient | 5 — `Patient`, `IdentitePatient`, `EmployeSaris`, `RattachementAyantDroitCdi`, `RattachementSousTraitant` | demi-page |
| Figure 7.4 | Parcours de soin | 11 — `Visite`, `ConstanteVitale`, `Consultation`, `DiagnosticConsultation`, `Ordonnance`, `LigneOrdonnance`, `BonExamen`, `LigneExamen`, `BonPharmacie`, `LigneBonPharmacie`, `Evacuation` | demi-page |
| Figure 7.5 | Diagramme global | les 29 | **page entière** |

**Les attributs et les associations ne changent pas.** Ils sont décrits aux blocs 4 et 5 de cette fiche. Chaque diagramme de package reprend, pour ses classes, exactement les mêmes attributs et les mêmes cardinalités.

**Les associations qui traversent deux packages** — par exemple `Consultation` vers `PersonnelMedical` — se tracent sur le diagramme global, et se signalent sur le diagramme de package par une classe en pointillés portant seulement son nom, sans attributs.

**Le diagramme global (7.5)** reste celui décrit dans cette fiche : les 29 classes, les 38 associations, le placement du bloc 3. Il vient **après** les quatre diagrammes de package, du détail vers l'ensemble.

**Le package Fonctions transverses n'a pas de diagramme** : aucune de ses entités n'est retenue au modèle. Le mémoire l'explique au § 7.3.

---

# Bloc 9 — Découpage par package : ce qu'il faut tracer sur chaque planche

> **Le modèle complet compte 88 entités. Le mémoire n'en dessine que 29.** Les 59 autres — messagerie, notifications, sessions, journaux, historiques, tables de synchronisation — ne sont sur **aucune** planche. Elles sont décrites dans l'inventaire `INV-02` § 4, et le mémoire l'explique au § 7.3. Ne cherche pas à les faire entrer.

Les 38 associations se répartissent en **24 associations internes** à un package, et **14 associations qui traversent deux packages**.

**Règle de tracé, valable pour les quatre planches de package :**

- Tu traces les classes du package en **rectangle plein à trois compartiments**, avec leurs attributs du bloc 4.
- Tu traces les associations **internes** au package en trait plein, avec leurs multiplicités du bloc 5.
- Pour une association qui **sort** du package, tu dessines la classe partenaire en **rectangle à bord pointillé, avec son seul nom, sans attributs**, et tu traces le lien vers elle. Cela montre la frontière sans dupliquer l'information.
- Les **14 associations traversantes** se tracent en entier, avec toutes leurs multiplicités, sur la **planche globale 7.5** seulement.

---

## Figure 7.1 — Package Sécurité et habilitations

**Cinq classes à dessiner :** `Utilisateur` · `UtilisateurRole` · `Role` · `RolePermission` · `Permission`

**Quatre associations internes :**

| N° | De | Vers | Multiplicités |
|---|---|---|---|
| L03 | `Utilisateur` | `UtilisateurRole` | 1 → 0..* |
| L04 | `Role` | `UtilisateurRole` | 1 → 0..* |
| L05 | `Role` | `RolePermission` | 1 → 0..* |
| L06 | `Permission` | `RolePermission` | 1 → 0..* |

**Deux classes en pointillés, aux bords de la planche :** `Site` (lien L01) et `PersonnelMedical` (lien L02).

**Placement.** `Utilisateur` au centre-gauche, `Role` au centre-droit. `UtilisateurRole` et `RolePermission` sont des classes d'association : les placer **entre** les deux classes qu'elles relient. `Permission` à l'extrême droite. C'est la figure la plus simple des quatre.

---

## Figure 7.2 — Package Référentiels et acteurs médicaux

**Huit classes à dessiner :** `Site` · `CategoriePatient` · `DroitCategoriePatient` · `PathologieReference` · `MedicamentReference` · `TypeExamen` · `PersonnelMedical` · `DelegationPrescription`

**Trois associations internes :**

| N° | De | Vers | Multiplicités |
|---|---|---|---|
| L09 | `CategoriePatient` | `DroitCategoriePatient` | 1 → 0..* |
| L16 | `PersonnelMedical` | `DelegationPrescription` | 1 → 0..* — rôle `medecinChef` |
| L17 | `PersonnelMedical` | `DelegationPrescription` | 1 → 0..* — rôle `infirmier` |

⚠️ **L16 et L17 sont deux liens distincts entre les deux mêmes classes.** Il faut tracer **deux traits séparés**, chacun portant son nom de rôle. Un seul trait serait une erreur : c'est ce qui permet de savoir qui a accordé la délégation et qui l'a reçue.

**Trois classes en pointillés :** `Patient` (liens L07 et L10), `Consultation` (liens L18 et L20), `Ordonnance` (lien L19). Les liens vers les lignes d'ordonnance et d'examen — L11 à L15 — se signalent par une seule classe en pointillés nommée `Parcours de soin`, sans quoi la planche se surcharge.

**Placement.** Les six référentiels en colonne à gauche, les deux classes d'acteurs à droite. `DroitCategoriePatient` collé sous `CategoriePatient` : c'est la matrice qui porte la règle d'éligibilité, la planche doit la mettre en évidence.

---

## Figure 7.3 — Package Dossier patient

**Cinq classes à dessiner :** `Patient` · `IdentitePatient` · `EmployeSaris` · `RattachementAyantDroitCdi` · `RattachementSousTraitant`

**Cinq associations internes :**

| N° | De | Vers | Multiplicités | Forme |
|---|---|---|---|---|
| L25 | `Patient` | `IdentitePatient` | 1 → 0..1 | **composition**, losange plein côté `Patient` |
| L21 | `EmployeSaris` | `Patient` | 0..1 → 0..* | trait plein |
| L22 | `EmployeSaris` | `RattachementAyantDroitCdi` | 0..1 → 0..* | trait plein |
| L23 | `RattachementAyantDroitCdi` | `Patient` | 0..* → 1 | trait plein |
| L24 | `RattachementSousTraitant` | `Patient` | 0..* → 1 | trait plein |

**Trois classes en pointillés :** `Site` (L07), `CategoriePatient` (L10), `Visite` (L26).

**Placement.** `Patient` au centre, c'est le pivot. `IdentitePatient` juste en dessous, reliée par la composition. `EmployeSaris` à gauche, les deux classes de rattachement entre les deux. La planche doit faire voir qu'un patient peut être rattaché **de deux façons différentes** — ayant droit d'un CDI, ou employé d'un sous-traitant.

---

## Figure 7.4 — Package Parcours de soin

**Onze classes à dessiner :** `Visite` · `ConstanteVitale` · `Consultation` · `DiagnosticConsultation` · `Ordonnance` · `LigneOrdonnance` · `BonExamen` · `LigneExamen` · `BonPharmacie` · `LigneBonPharmacie` · `Evacuation`

**Douze associations internes :**

| N° | De | Vers | Multiplicités | Forme |
|---|---|---|---|---|
| L27 | `Visite` | `ConstanteVitale` | 1 → 0..* | **composition** |
| L28 | `Visite` | `Consultation` | 1 → 0..* | trait plein |
| L29 | `Consultation` | `DiagnosticConsultation` | 1 → 0..* | trait plein |
| L30 | `Consultation` | `Ordonnance` | 1 → 0..* | trait plein |
| L31 | `Consultation` | `BonExamen` | 1 → 0..* | trait plein |
| L32 | `Consultation` | `BonPharmacie` | 1 → 0..* | trait plein |
| L33 | `Consultation` | `Evacuation` | 1 → 0..1 | trait plein, contrainte `{unique}` |
| L34 | `Ordonnance` | `LigneOrdonnance` | 1 → 0..* | **composition** |
| L35 | `Ordonnance` | `BonExamen` | 0..1 → 0..* | trait plein |
| L36 | `Ordonnance` | `BonPharmacie` | 0..1 → 0..* | trait plein |
| L37 | `BonExamen` | `LigneExamen` | 1 → 0..* | **composition** |
| L38 | `BonPharmacie` | `LigneBonPharmacie` | 1 → 0..* | **composition** |

**Trois classes en pointillés :** `Patient` (L26), `PersonnelMedical` (L18), `DelegationPrescription` (L19 et L20).

**Placement.** C'est la planche la plus dense des quatre : elle mérite d'être tracée en dernier, quand la main est faite. Une lecture de gauche à droite, dans l'ordre du parcours : `Visite` à gauche avec `ConstanteVitale` en dessous, `Consultation` au centre — c'est le second pivot du modèle — puis `Ordonnance`, les deux bons et `Evacuation` à droite, chacun avec ses lignes en dessous.

**Ce que cette planche doit faire voir.** Les documents cliniques sont rattachés à la **consultation**, jamais directement au patient. C'est le choix de modélisation expliqué au § 7.3 du mémoire : aucun document ne peut exister sans acte de soin qui le justifie.

---

## Figure 7.5 — Diagramme global

Les 29 classes, les 38 associations, selon le plan de placement du **bloc 6**. C'est cette planche qui porte les **14 associations traversantes**, que les quatre planches de package n'ont fait que suggérer par des classes en pointillés :

| N° | De | Vers | Ce qu'elle relie |
|---|---|---|---|
| L01 | `Utilisateur` | `Site` | Sécurité → Référentiels |
| L02 | `Utilisateur` | `PersonnelMedical` | Sécurité → Acteurs |
| L07 | `Site` | `Patient` | Référentiels → Dossier |
| L08 | `Site` | `Visite` | Référentiels → Parcours |
| L10 | `CategoriePatient` | `Patient` | Référentiels → Dossier |
| L11 | `PathologieReference` | `DiagnosticConsultation` | Référentiels → Parcours |
| L12 | `MedicamentReference` | `LigneOrdonnance` | Référentiels → Parcours |
| L13 | `MedicamentReference` | `LigneBonPharmacie` | Référentiels → Parcours |
| L14 | `TypeExamen` | `LigneExamen` | Référentiels → Parcours |
| L15 | `TypeExamen` | `LigneOrdonnance` | Référentiels → Parcours |
| L18 | `PersonnelMedical` | `Consultation` | Acteurs → Parcours |
| L19 | `DelegationPrescription` | `Ordonnance` | Acteurs → Parcours |
| L20 | `DelegationPrescription` | `Consultation` | Acteurs → Parcours |
| L26 | `Patient` | `Visite` | Dossier → Parcours |

**Un fait à relever en soutenance.** Dix des quatorze associations traversantes partent des **référentiels et des acteurs** vers le parcours de soin. C'est la traduction visuelle de ce que dit le mémoire : le parcours de soin ne fonctionne que parce que les référentiels et les délégations existent d'abord.

---

## Contrôle avant de coller les cinq planches

```
[ ] Les 29 classes sont réparties : 5 + 8 + 5 + 11 sur les quatre planches
[ ] Aucune des 59 entités écartées n'apparaît nulle part
[ ] Les 24 associations internes sont tracées sur leur planche de package
[ ] Les 14 associations traversantes ne sont tracées QUE sur la planche 7.5
[ ] Les classes partenaires hors package sont en POINTILLÉS, sans attributs
[ ] Les 4 compositions portent un losange PLEIN : L25, L27, L34, L37, L38
[ ] L16 et L17 sont DEUX traits distincts, avec leur nom de rôle
[ ] Chaque planche de package tient dans 16 cm sur 11
[ ] La planche 7.5 occupe une page entière
```

---

# Bloc 10 — Aide-mémoire de tracé : la liste complète, prête à recopier

> Ce bloc existe pour que tu n'aies **jamais à ouvrir un autre fichier** pendant que tu dessines. Tout ce qui suit est vérifié contre le code.

## Les 29 classes, par ordre de degré de connexion

Le degré est le nombre d'associations qui touchent la classe. C'est le critère de sélection énoncé au § 7.3 du mémoire. Plus il est élevé, plus la classe doit être **au centre** de la planche.

| Rang | Classe | Degré | Champs | Package | Planche |
|---:|---|---:|---:|---|---|
| 1 | `Patient` | **18** | 36 | Dossier patient | 7.3 |
| 2 | `Consultation` | **13** | 37 | Parcours de soin | 7.4 |
| 3 | `Utilisateur` | **11** | 29 | Sécurité | 7.1 |
| 4 | `PersonnelMedical` | **8** | 18 | Référentiels et acteurs | 7.2 |
| 5 | `Visite` | 6 | 22 | Parcours de soin | 7.4 |
| 6 | `Ordonnance` | 6 | 18 | Parcours de soin | 7.4 |
| 7 | `DelegationPrescription` | 5 | 14 | Référentiels et acteurs | 7.2 |
| 8 | `BonExamen` | 4 | 14 | Parcours de soin | 7.4 |
| 9 | `Site` | 3 | 11 | Référentiels et acteurs | 7.2 |
| 10 | `CategoriePatient` | 3 | 9 | Référentiels et acteurs | 7.2 |
| 11 | `PathologieReference` | 3 | 11 | Référentiels et acteurs | 7.2 |
| 12 | `MedicamentReference` | 3 | 10 | Référentiels et acteurs | 7.2 |
| 13 | `LigneOrdonnance` | 3 | 15 | Parcours de soin | 7.4 |
| 14 | `BonPharmacie` | 3 | 15 | Parcours de soin | 7.4 |
| 15 | `Evacuation` | 3 | 14 | Parcours de soin | 7.4 |
| 16 | `RattachementAyantDroitCdi` | 3 | 13 | Dossier patient | 7.3 |
| 17 | `RattachementSousTraitant` | 3 | 11 | Dossier patient | 7.3 |
| 18 | `Role` | 2 | 6 | Sécurité | 7.1 |
| 19 | `Permission` | 2 | 6 | Sécurité | 7.1 |
| 20 | `UtilisateurRole` | 2 | 3 | Sécurité | 7.1 |
| 21 | `RolePermission` | 2 | 3 | Sécurité | 7.1 |
| 22 | `TypeExamen` | 2 | 9 | Référentiels et acteurs | 7.2 |
| 23 | `EmployeSaris` | 2 | 17 | Dossier patient | 7.3 |
| 24 | `DiagnosticConsultation` | 2 | 8 | Parcours de soin | 7.4 |
| 25 | `LigneExamen` | 2 | 6 | Parcours de soin | 7.4 |
| 26 | `LigneBonPharmacie` | 2 | 10 | Parcours de soin | 7.4 |
| 27 | `IdentitePatient` | 1 | 12 | Dossier patient | 7.3 |
| 28 | `ConstanteVitale` | 1 | 23 | Parcours de soin | 7.4 |
| 29 | `DroitCategoriePatient` | 1 | 8 | Référentiels et acteurs | 7.2 |

**Les trois classes de degré 1 sont les exceptions au critère.** Le mémoire les justifie au § 7.3. `IdentitePatient` et `ConstanteVitale` portent les données saisies à chaque visite. `DroitCategoriePatient` porte la règle d'éligibilité, la règle métier centrale du système : l'écarter aurait vidé le diagramme de son sens.

**Les deux classes d'association.** `UtilisateurRole` et `RolePermission` ne sont pas des entités métier : elles matérialisent un lien plusieurs-à-plusieurs. Sur la planche, elles se placent **entre** les deux classes qu'elles relient, jamais à côté.

## Trois règles de placement, valables partout

**Le degré commande la position.** Une classe de degré élevé va au centre, une classe de degré 1 ou 2 va en périphérie. Si tu places `Patient` dans un coin, tous les traits vont se croiser.

**Les lignes se collent à leur en-tête.** `LigneOrdonnance` sous `Ordonnance`, `LigneExamen` sous `BonExamen`, `LigneBonPharmacie` sous `BonPharmacie`, `ConstanteVitale` sous `Visite`, `IdentitePatient` sous `Patient`. Ce sont les cinq compositions, et le losange plein se dessine du côté de l'en-tête.

**Le compartiment des opérations reste vide.** C'est un modèle de données, pas un modèle de comportement. Trois compartiments quand même : nom, attributs, et un troisième vide.

## Ce qu'il ne faut jamais faire

```
[ ] Ne pas écrire les clés étrangères comme attributs — elles sont portées par les traits
[ ] Ne pas reporter createdAt, updatedAt, createdBy, updatedBy, deletedAt, version
    — elles existent sur presque toutes les classes et les surchargeraient
[ ] Ne dessiner aucune des 59 entités écartées, sur aucune planche
[ ] Ne pas fusionner L16 et L17 en un seul trait entre PersonnelMedical
    et DelegationPrescription : deux traits, deux rôles
```
