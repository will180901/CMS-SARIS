# Figure 8.1 — Schéma relationnel du noyau métier

> **Ce fichier n'est pas une figure à dessiner.** La fiche `SCH-REL-01` prescrit une **notation textuelle**. Le bloc ci-dessous se colle dans Word en **police à chasse fixe**, sous la légende « Figure 8.1 — Schéma relationnel du noyau métier ».

> **Établi le 4 septembre 2026 à partir du schéma de données lui-même**, table par table — et non recopié de la fiche, dont sept clés étrangères se sont révélées inexactes. Voir la décision **D-76**.

---

## 1. Comment lire

| Notation | Sens |
|---|---|
| `PK:` | clé primaire |
| `PK: (a, b)` | clé primaire composite |
| `FK: x → Table` | **clé étrangère déclarée** — la base refuse une valeur qui ne correspond à rien |
| `REF: x → Table` | **colonne de référence non contrainte** — elle désigne une autre table par convention de nommage, mais la base ne l'impose pas |
| `U` après un attribut | contrainte d'unicité |

L'ordre des sections suit la **dépendance des clés étrangères** : une table n'apparaît qu'après celles auxquelles elle se réfère. C'est aussi l'ordre dans lequel les données doivent être insérées.

---

## 2. Le bloc à coller

### Sécurité et habilitations

Utilisateur (PK: id, login U, email U, passwordHash, statut, motDePasseTemp,
             tentativesEchec, blocageJusquA, blocageMinutes, photoUrl, lastSeenAt,
             FK: siteId → Site,
             FK: personnelMedicalId → PersonnelMedical U)

Role (PK: id, code U, libelle)

Permission (PK: id, code U, module)

UtilisateurRole (PK: (utilisateurId, roleId),
                 FK: utilisateurId → Utilisateur,
                 FK: roleId → Role)

RolePermission (PK: (roleId, permissionId),
                FK: roleId → Role,
                FK: permissionId → Permission)

### Référentiels

Site (PK: id, code U, libelle, localisation, statut)

CategoriePatient (PK: id, code U, libelle, statut)

DroitCategoriePatient (PK: id, typePrestation, couvert, plafondConsultations, periode,
                       FK: categorieId → CategoriePatient)

PathologieReference (PK: id, code U, libelle, chronique, statut,
                     confidentialiteRenforcee)

MedicamentReference (PK: id, nomGenerique, nomCommercial, familleThera, statut)

TypeExamen (PK: id, code U, libelle, domaine, statut)

### Acteurs médicaux et employés

PersonnelMedical (PK: id, nom, prenom, matricule U, role, statut,
                  REF: siteId → Site)

DelegationPrescription (PK: id, dateDebut, dateFin, statut, perimetre,
                        FK: medecinChefId → PersonnelMedical,
                        FK: infirmierId → PersonnelMedical)

EmployeSaris (PK: id, matricule U, nom, prenom, dateNaissance, sexe, fonction,
              sectionPaie, service, departement, categorie, statut)

### Dossier patient

Patient (PK: id, siteId, numeroPatient U, matricule U, statut, version, verrouille,
         verrouilleParId, verrouilleLe, motifVerrou,
         FK: siteCreationId → Site,
         FK: categoriePatientId → CategoriePatient,
         FK: employeId → EmployeSaris)

IdentitePatient (PK: id, nom, prenom, dateNaissance, sexe, telephone, adresse, photoUrl,
                 FK: patientId → Patient U)

RattachementAyantDroitCdi (PK: id, cdiId, typeLien, statut, dateDebut, dateFin,
                           FK: patientId → Patient,
                           FK: employeId → EmployeSaris)

RattachementSousTraitant (PK: id, statut, dateDebut, dateFin,
                          FK: patientId → Patient,
                          FK: societeId → SocieteSousTraitante)

### Accueil et triage

Visite (PK: id, statut, notesAccueil, motifAnnulation, typeCloture, dateOuverture,
        dateCloture, creerHorsLigne, version,
        FK: patientId → Patient,
        FK: siteId → Site,
        FK: motifPrincipalId → MotifConsultation,
        REF: soignantId → PersonnelMedical)

ConstanteVitale (PK: id, temperature, tensionSystolique, tensionDiastolique,
                 frequenceCardiaque, frequenceRespiratoire, saturationO2, poids, taille,
                 imc, glycemie, etatConscience, scoreGlasgow, etatGeneral, hydratation,
                 coloration, saisiePar,
                 FK: visiteId → Visite,
                 REF: patientId → Patient)

### Consultation et actes prescrits

Consultation (PK: id, statut, anamneseDateDebut, anamneseDuree, anamneseModeDebut,
              anamneseSymptomes, examenClinique, conclusion, decisionMedicale,
              motifAnnulation, reposJours, reposInclutJour, dateReprise, version,
              closedAt, pickedUpById, pickedUpAt,
              FK: visiteId → Visite,
              FK: soignantId → PersonnelMedical,
              FK: delegationId → DelegationPrescription,
              FK: typeConsultationId → TypeConsultation)

DiagnosticConsultation (PK: id, type, certitude,
                        FK: consultationId → Consultation,
                        FK: pathologieId → PathologieReference)

Ordonnance (PK: id, statut, typeOrdonnance, indicationClinik, motifAnnulation,
            FK: consultationId → Consultation,
            FK: delegationId → DelegationPrescription,
            FK: etablissementId → EtablissementReference,
            REF: prescripteurId → PersonnelMedical)

LigneOrdonnance (PK: id, posologie, duree, voieAdmin, quantite, instructions,
                 justification,
                 FK: ordonnanceId → Ordonnance,
                 FK: medicamentId → MedicamentReference,
                 FK: typeExamenId → TypeExamen)

BonExamen (PK: id, indicationClinik, statut, motifAnnulation,
           FK: consultationId → Consultation,
           FK: ordonnanceId → Ordonnance,
           REF: etablissementId → EtablissementReference)

LigneExamen (PK: id,
             FK: bonId → BonExamen,
             FK: typeExamenId → TypeExamen)

BonPharmacie (PK: id, statut, observations, delivreLe, delivrePar, motifAnnulation,
              FK: consultationId → Consultation,
              FK: ordonnanceId → Ordonnance,
              REF: prescripteurId → PersonnelMedical)

LigneBonPharmacie (PK: id, libelle, posologie, quantite,
                   FK: bonId → BonPharmacie,
                   FK: medicamentId → MedicamentReference)

Evacuation (PK: id, niveauUrgence, infosCliniques, statut, motifAnnulation,
            FK: consultationId → Consultation U,
            FK: etablissementId → EtablissementReference,
            REF: motifId → MotifConsultation)

---

## 3. La note de bas de figure

> Les vingt-neuf relations portent en outre quatre colonnes techniques communes — `createdAt`, `updatedAt`, `createdBy`, `updatedBy` — et, sur quarante-sept des quatre-vingt-huit tables du schéma, une colonne `deletedAt` qui porte la suppression logique. Elles ne sont pas répétées ligne à ligne.

> Le noyau métier compte **43 clés étrangères déclarées**. **7 colonnes supplémentaires** désignent une autre table par convention de nommage **sans contrainte déclarée** : elles sont notées `REF`. Sur celles-là, l'intégrité référentielle est portée par l'application, et non par la base de données.

---

## 4. Mise en forme dans Word

| Réglage | Valeur |
|---|---|
| Police | **Consolas** ou **Courier New** — une chasse fixe aligne les colonnes toute seule |
| Taille | **8,5 pt**, la même que les figures dessinées |
| Interligne | simple · espacement avant et après : 0 pt |
| Alignement | à gauche, **sans justification** — la justification casserait l'alignement |
| Style | corps de texte, surtout pas un style de titre |

Les intertitres de section — *Sécurité et habilitations*, *Référentiels*, etc. — se composent dans la police du corps, en gras, **hors du bloc à chasse fixe**.

La largeur maximale d'une ligne est de **88 caractères**, ce qui tient dans les 16,5 cm de la zone de texte à 8,5 pt.
