# SCH-REL-01 — Schéma relationnel du noyau métier

## Bloc 1 — Cartouche

```
Identifiant       : SCH-REL-01
Figure du mémoire : Figure 8.1 — Schéma relationnel du noyau métier
Chapitre / section: 8 — § 8.2.1
Type              : Schéma relationnel (notation textuelle des relations)
Sources de preuve : Schéma de données · 41 migrations · INV-02 § 4
Statut            : IMPLÉMENTÉ
Format conseillé  : A4 portrait — notation textuelle, non graphique
Densité           : 29 relations · 38 clés étrangères
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** La traduction du modèle de classes en tables, avec leurs clés primaires et étrangères explicites. C'est le passage du conceptuel au logique.

**Différence avec la figure 7.1.** Le diagramme de classes montre les associations par des traits ; le schéma relationnel les montre par des **clés étrangères nommées**. Les deux figures décrivent le même modèle sous deux formes.

**Notation retenue** : la notation textuelle du modèle de mémoire —
`Nom_Table (PK : clé_primaire, attribut1, attribut2, FK : clé_étrangère)`

Cette notation est plus lisible qu'un schéma graphique pour 29 tables, et se compose sans outil.

## Bloc 3 — Relations à écrire

Une ligne par table. Les clés primaires sont préfixées `PK`, les clés étrangères `FK` avec leur table de référence entre parenthèses.

### Sécurité et habilitations

```
Utilisateur (PK: id, login U, email U, passwordHash, statut, motDePasseTemp,
             tentativesEchec, blocageJusquA, blocageMinutes, photoUrl, lastSeenAt,
             FK: siteId → Site, FK: personnelMedicalId → PersonnelMedical U)

Role (PK: id, code U, libelle)

Permission (PK: id, code U, module)

UtilisateurRole (PK: (utilisateurId, roleId),
                 FK: utilisateurId → Utilisateur, FK: roleId → Role)

RolePermission (PK: (roleId, permissionId),
                FK: roleId → Role, FK: permissionId → Permission)
```

### Référentiels

```
Site (PK: id, code U, libelle, localisation, statut)

CategoriePatient (PK: id, code U, libelle, statut)

DroitCategoriePatient (PK: id, typePrestation, couvert, plafondConsultations, periode,
                       FK: categorieId → CategoriePatient)

PathologieReference (PK: id, code U, libelle, chronique, domaine, statut)

MedicamentReference (PK: id, code U, libelle, forme, dosage, statut)

TypeExamen (PK: id, code U, libelle, categorie, statut)
```

### Acteurs

```
PersonnelMedical (PK: id, nom, prenom, matricule U, role, statut,
                  FK: siteId → Site)

DelegationPrescription (PK: id, dateDebut, dateFin, statut, perimetre,
                        FK: medecinChefId → PersonnelMedical,
                        FK: infirmierId → PersonnelMedical)

EmployeSaris (PK: id, matricule U, nom, prenom, dateNaissance, sexe, fonction,
              sectionPaie, service, departement, categorie, statut)
```

### Dossier patient

```
Patient (PK: id, numeroPatient U, matricule U, statut, version, verrouille,
         verrouilleParId, verrouilleLe, motifVerrou,
         FK: siteCreationId → Site, FK: categoriePatientId → CategoriePatient,
         FK: employeId → EmployeSaris)

IdentitePatient (PK: id, nom, prenom, dateNaissance, sexe, telephone, adresse, photoUrl,
                 FK: patientId → Patient U)

RattachementAyantDroitCdi (PK: id, typeLien,
                           FK: patientId → Patient, FK: employeId → EmployeSaris)

RattachementSousTraitant (PK: id,
                          FK: patientId → Patient, FK: societeId → SocieteSousTraitante)
```

### Triage

```
Visite (PK: id, statut, dateOuverture, dateCloture, notesAccueil, motifAnnulation,
        typeCloture, creerHorsLigne, version,
        FK: patientId → Patient, FK: siteId → Site,
        FK: motifPrincipalId → MotifConsultation, FK: soignantId → PersonnelMedical)

ConstanteVitale (PK: id, temperature, tensionSystolique, tensionDiastolique,
                 frequenceCardiaque, frequenceRespiratoire, saturationO2, poids, taille,
                 imc, glycemie, etatConscience, scoreGlasgow, etatGeneral, hydratation,
                 coloration, saisiePar,
                 FK: visiteId → Visite, FK: patientId → Patient)
```

### Consultation et actes prescrits

```
Consultation (PK: id, statut, anamneseDateDebut, anamneseDuree, anamneseModeDebut,
              anamneseSymptomes, examenClinique, conclusion, decisionMedicale,
              motifAnnulation, reposJours, reposInclutJour, dateReprise, version, closedAt,
              FK: visiteId → Visite, FK: soignantId → PersonnelMedical,
              FK: delegationId → DelegationPrescription,
              FK: typeConsultationId → TypeConsultation)

DiagnosticConsultation (PK: id, type, certitude,
                        FK: consultationId → Consultation,
                        FK: pathologieId → PathologieReference)

Ordonnance (PK: id, statut, typeOrdonnance, indicationClinik, motifAnnulation,
            FK: consultationId → Consultation, FK: prescripteurId → PersonnelMedical,
            FK: delegationId → DelegationPrescription,
            FK: etablissementId → EtablissementReference)

LigneOrdonnance (PK: id, posologie, duree, voieAdmin, quantite, instructions, justification,
                 FK: ordonnanceId → Ordonnance, FK: medicamentId → MedicamentReference,
                 FK: typeExamenId → TypeExamen)

BonExamen (PK: id, statut, indicationClinik, motifAnnulation,
           FK: consultationId → Consultation, FK: ordonnanceId → Ordonnance,
           FK: etablissementId → EtablissementReference)

LigneExamen (PK: id,
             FK: bonId → BonExamen, FK: typeExamenId → TypeExamen)

BonPharmacie (PK: id, statut, observations, delivreLe, delivrePar, motifAnnulation,
              FK: consultationId → Consultation, FK: prescripteurId → PersonnelMedical,
              FK: ordonnanceId → Ordonnance)

LigneBonPharmacie (PK: id, posologie, quantite,
                   FK: bonId → BonPharmacie, FK: medicamentId → MedicamentReference)

Evacuation (PK: id, niveauUrgence, infosCliniques, statut, motifAnnulation,
            FK: consultationId → Consultation U, FK: motifId → MotifConsultation,
            FK: etablissementId → EtablissementReference)
```

### Colonnes techniques communes

Toutes les tables ci-dessus portent en outre :

```
createdAt TIMESTAMP · updatedAt TIMESTAMP · createdBy TEXT · updatedBy TEXT
deletedAt TIMESTAMP  (sur 47 tables sur 88 — marque de suppression logique)
```

Elles ne sont pas répétées ligne à ligne : une note en bas de figure le précise.

## Bloc 4 — Contenu et mise en forme

Le schéma s'écrit en **police à chasse fixe**, ce qui aligne naturellement les colonnes.

Conventions typographiques à respecter :

| Notation | Sens |
|---|---|
| `PK:` | Clé primaire |
| `PK: (a, b)` | Clé primaire composite |
| `FK: x → Table` | Clé étrangère et sa table de référence |
| `U` après un attribut | Contrainte d'unicité |

## Bloc 5 — Contraintes à signaler

| Contrainte | Tables concernées |
|---|---|
| Unicité simple | `Utilisateur.login`, `Utilisateur.email`, `Role.code`, `Permission.code`, `Site.code`, `CategoriePatient.code`, `Patient.numeroPatient`, `Patient.matricule`, `PersonnelMedical.matricule`, `EmployeSaris.matricule`, `PathologieReference.code`, `MedicamentReference.code`, `TypeExamen.code` |
| Unicité relationnelle | `IdentitePatient.patientId`, `Utilisateur.personnelMedicalId`, `Evacuation.consultationId` — une seule par parent |
| Clé composite | `UtilisateurRole`, `RolePermission` |
| Unicité partielle | `BonExamen.ordonnanceId` et `BonPharmacie.ordonnanceId` — un seul bon actif par ordonnance |

## Bloc 6 — Plan de placement

Présentation **en sections titrées**, dans l'ordre du bloc 3 : sécurité, référentiels, acteurs, dossier patient, triage, consultation et actes.

Cet ordre suit la **dépendance des clés étrangères** : une table n'apparaît qu'après celles auxquelles elle se réfère. C'est aussi l'ordre dans lequel les données doivent être insérées.

Chaque section porte un intertitre. Une ligne vide sépare les tables.

## Bloc 7 — Conventions et légende

**Légende à reproduire :**

> **Figure 8.1 — Schéma relationnel du noyau métier**
> 29 tables sur les 88 du schéma complet. Les colonnes techniques communes — `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt` — ne sont pas répétées. Le schéma complet figure au dictionnaire de données, annexe D.
> *Source : conception propre, dérivée du schéma de données et des 41 migrations.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 29 tables sont présentes
[ ] Chaque table porte sa clé primaire, préfixée PK
[ ] Les 38 clés étrangères sont présentes, avec leur table de référence
[ ] Les 2 clés composites sont notées PK: (a, b)
[ ] Les contraintes d'unicité sont marquées U
[ ] L'ordre respecte la dépendance des clés étrangères
[ ] La note sur les colonnes techniques est présente
[ ] Aucune donnée réelle n'apparaît
```

## Vérification finale

| Point | Source |
|---|---|
| Existence et nom des tables | Schéma de données |
| Portage des clés étrangères | INV-02 § 4, colonne « Porteur FK » |
| Contraintes d'unicité | Migrations, index uniques |
| Unicité partielle des bons | Migration dédiée à cette contrainte |
