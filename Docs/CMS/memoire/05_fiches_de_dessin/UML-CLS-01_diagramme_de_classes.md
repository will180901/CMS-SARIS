# UML-CLS-01 — Diagramme de classes du système

## Bloc 1 — Cartouche

```
Identifiant       : UML-CLS-01
Figure du mémoire : Figure 7.1 — Diagramme de classes du système CMS SARIS
Chapitre / section: 7 — § 7.2
Type UML          : Diagramme de classes
Sources de preuve : packages/db/prisma/schema.prisma · INV-02 §§ 3 et 4
Statut            : IMPLÉMENTÉ
Format conseillé  : A3 paysage, ou A4 paysage en deux planches (voir bloc 6)
Densité           : 29 classes · 38 associations
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Que le domaine s'organise autour de trois pivots — la personne soignée, l'acte de soin, l'agent qui le réalise — et que le parcours clinique forme une chaîne continue : patient → visite → consultation → documents.

**Ce qu'elle ne montre volontairement pas.** 59 entités sur 88 sont écartées : messagerie, synchronisation, audit, notifications, sessions, historiques. Motif : lisibilité. Critère de sélection énoncé au chapitre 7 § 7.2.1 — degré de connexion ≥ 2 dans les domaines clinique, acteurs et référentiels, plus deux exceptions justifiées (`ConstanteVitale`, `DroitCategoriePatient`). Les entités écartées figurent au dictionnaire de données, annexe D.

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

> **Figure 7.1 — Diagramme de classes du système CMS SARIS**
> 29 classes retenues sur les 88 du modèle complet, sélectionnées selon leur degré de connexion. Les colonnes techniques communes (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `version`) ne sont pas représentées. Le modèle complet figure au dictionnaire de données, annexe D.
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
