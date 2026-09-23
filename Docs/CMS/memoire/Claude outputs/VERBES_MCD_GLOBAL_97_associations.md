# Les 97 verbes d'association — ce qui est sourcé, ce qui est proposé

> **Étape 2** de la production des deux onglets d'atelier. Document de travail, hors mémoire.
> À valider avant tout dessin.

## 1. Le compte

| Origine du verbe | Nombre | Sur la planche |
|---|---:|---|
| Relevé sur vos planches MCD **8.1a, 8.1b, 8.1c** | **13** | écrit normalement |
| Relevé sur vos planches de classes **7.1 à 7.5** | **25** | écrit normalement |
| **Proposé** — aucune source écrite | **59** | **en gris, entre parenthèses** |
| **Total** | **97** | |

Au départ, la fiche annonçait qu'une quinzaine de verbes seulement étaient sourcés. **Il y en a 38.** Vos planches de classes 7.1 à 7.5 en portaient vingt-cinq que personne n'avait rapprochés du modèle conceptuel.

## 2. La règle de passage du diagramme de classes au MCD

Elle n'est pas de moi : **vos propres planches la pratiquent déjà.** La planche 7.4a écrit `parente de`, la planche 8.1a écrit `être parente de`. La 7.4b écrit `rattaché à`, la 8.1b écrit `rattacher`.

> **Un verbe du diagramme de classes se met à l'infinitif pour devenir un verbe d'association MERISE.**

C'est ce que j'ai appliqué aux vingt-cinq verbes repris des planches 7.x — `appartient à` devient `appartenir à`, `conduit` devient `conduire`, `désigne` devient `désigner`.

## 3. Comment se lit une ligne

`Entité A` **0,n** — *verbe* — **1,1** `Entité B` se lit : **un A verbe zéro à plusieurs B ; un B est verbé par exactement un A.**

Exemple sourcé de votre planche 8.1a : `Patient` **0,n** — *ouvrir* — **1,1** `Visite`. Un patient ouvre plusieurs visites ; une visite appartient à un seul patient.

## 4. Le vocabulaire

Cinquante verbes pour quatre-vingt-dix-sept associations : **le vocabulaire se réutilise**, ce qui est la marque d'un modèle cohérent. Les plus employés sont ceux de vos planches — `porter` quinze fois, `rattacher` sept, `recevoir` et `désigner` cinq.

---

## 5. Les 97 associations


### SÉCURITÉ & AUDIT — 15 associations · 9 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 1 | `Site` | 0,n | **appartenir à** | 1,1 | `Utilisateur` | **7.x** |
| 2 | `PersonnelMedical` | 0,1 | **correspondre à** | 0,1 | `Utilisateur` | **7.x** |
| 3 | `Utilisateur` | 0,n | **porter** | 1,1 | `PreferenceUtilisateur` | *proposé* |
| 4 | `Notification` | 0,n | **être lue** | 1,1 | `NotificationLecture` | *proposé* |
| 5 | `Utilisateur` | 0,n | **recevoir** | 1,1 | `UtilisateurPermission` | *proposé* |
| 6 | `Permission` | 0,n | **faire l'objet de** | 1,1 | `UtilisateurPermission` | *proposé* |
| 7 | `Utilisateur` | 0,n | **recevoir** | 1,1 | `UtilisateurRole` | **7.x** |
| 8 | `Role` | 0,n | **attribuer à** | 1,1 | `UtilisateurRole` | **7.x** |
| 9 | `Role` | 0,n | **détenir** | 1,1 | `RolePermission` | **7.x** |
| 10 | `Permission` | 0,n | **accorder à** | 1,1 | `RolePermission` | **7.x** |
| 11 | `Utilisateur` | 0,n | **ouvrir** | 1,1 | `SessionUtilisateur` | *proposé* |
| 12 | `Utilisateur` | 0,1 | **porter** | 1,1 | `ConfigurationTotp` | *proposé* |
| 13 | `ConfigurationTotp` | 0,n | **porter** | 1,1 | `CodeSecoursTotp` | *proposé* |
| 14 | `Utilisateur` | 0,n | **produire** | 0,1 | `JournalAudit` | *proposé* |
| 15 | `Utilisateur` | 0,n | **tenter** | 0,1 | `JournalAuthentification` | *proposé* |

### RÉFÉRENTIELS — 2 associations · 1 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 16 | `CategoriePatient` | 0,n | **ouvrir droit à** | 1,1 | `DroitCategoriePatient` | **7.x** |
| 17 | `MedicamentReference` | 0,n | **porter** | 1,1 | `ContreIndicationMedicament` | *proposé* |

### ACTEURS ADMINISTRATIFS — 13 associations · 8 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 18 | `PersonnelMedical` | 0,n | **détenir** | 1,1 | `HabilitationPersonnel` | *proposé* |
| 19 | `PersonnelMedical` | 0,n | **demander** | 1,1 | `PlanningPermutation` | *proposé* |
| 20 | `PersonnelMedical` | 0,n | **pointer** | 1,1 | `PresenceJournaliere` | *proposé* |
| 21 | `PersonnelMedical` | 0,n | **déclarer** | 1,1 | `AbsencePersonnel` | *proposé* |
| 22 | `PersonnelMedical` | 0,n | **accorder** | 1,1 | `DelegationPrescription` | **7.x** |
| 23 | `PersonnelMedical` | 0,n | **agir sous** | 1,1 | `DelegationPrescription` | **7.x** |
| 24 | `DelegationPrescription` | 0,n | **autoriser** | 1,1 | `DelegationMedicamentAutorise` | *proposé* |
| 25 | `Patient` | 0,n | **concerner** | 1,1 | `RattachementAyantDroitCdi` | **7.x** |
| 26 | `EmployeSaris` | 0,n | **rattacher** | 0,1 | `RattachementAyantDroitCdi` | **7.x** |
| 27 | `RattachementAyantDroitCdi` | 0,n | **historiser** | 1,1 | `HistoriqueRattachementAyantDroit` | *proposé* |
| 28 | `Patient` | 0,n | **concerner** | 1,1 | `RattachementSousTraitant` | **7.x** |
| 29 | `SocieteSousTraitante` | 0,n | **employer** | 1,1 | `RattachementSousTraitant` | *proposé* |
| 30 | `RattachementSousTraitant` | 0,n | **historiser** | 1,1 | `HistoriqueRattachementSousTraitant` | *proposé* |

### DOSSIER PATIENT — 19 associations · 15 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 31 | `Site` | 0,n | **enregistrer** | 1,1 | `Patient` | **7.x** |
| 32 | `CategoriePatient` | 0,n | **classer** | 1,1 | `Patient` | **7.x** |
| 33 | `EmployeSaris` | 0,n | **correspondre à** | 0,1 | `Patient` | **7.x** |
| 34 | `Patient` | 0,1 | **porter** | 1,1 | `IdentitePatient` | **7.x** |
| 35 | `Patient` | 0,1 | **porter** | 1,1 | `DonneesEmploi` | *proposé* |
| 36 | `Patient` | 0,1 | **déclarer** | 1,1 | `ModeViePatient` | *proposé* |
| 37 | `Patient` | 0,1 | **désigner** | 1,1 | `ContactUrgence` | *proposé* |
| 38 | `Patient` | 0,n | **présenter** | 1,1 | `AllergiePatient` | *proposé* |
| 39 | `Patient` | 0,n | **rapporter** | 1,1 | `AntecedentPatient` | *proposé* |
| 40 | `PathologieReference` | 0,n | **nommer** | 0,1 | `AntecedentPatient` | *proposé* |
| 41 | `Patient` | 0,n | **faire l'objet de** | 1,1 | `AlerteMedicale` | *proposé* |
| 42 | `Patient` | 0,n | **changer de catégorie** | 1,1 | `HistoriqueCategoriePatient` | *proposé* |
| 43 | `CategoriePatient` | 0,n | **devenir** | 1,1 | `HistoriqueCategoriePatient` | *proposé* |
| 44 | `Patient` | 0,1 | **être la source de** | 1,1 | `FusionDossierPatient` | *proposé* |
| 45 | `Patient` | 0,1 | **être la cible de** | 1,1 | `FusionDossierPatient` | *proposé* |
| 46 | `Patient` | 0,n | **recevoir** | 1,1 | `PreSaisieMedicale` | *proposé* |
| 47 | `Patient` | 0,n | **suivre** | 1,1 | `SuiviGrossesse` | *proposé* |
| 48 | `SuiviGrossesse` | 0,n | **porter** | 1,1 | `ConsultationPrenatale` | *proposé* |
| 49 | `Consultation` | 0,n | **rattacher** | 0,1 | `ConsultationPrenatale` | *proposé* |

### ACCUEIL & TRIAGE — 5 associations · 2 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 50 | `Patient` | 0,n | **ouvrir** | 1,1 | `Visite` | **8.1** |
| 51 | `Site` | 0,n | **accueillir** | 1,1 | `Visite` | **7.x** |
| 52 | `MotifConsultation` | 0,n | **motiver** | 1,1 | `Visite` | *proposé* |
| 53 | `Visite` | 0,n | **historiser** | 1,1 | `VisiteEvenement` | *proposé* |
| 54 | `Visite` | 0,n | **porter** | 1,1 | `ConstanteVitale` | **8.1** |

### CONSULTATION & ACTES PRESCRITS — 25 associations · 7 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 55 | `Visite` | 0,n | **être parente de** | 1,1 | `Consultation` | **8.1** |
| 56 | `PersonnelMedical` | 0,n | **conduire** | 1,1 | `Consultation` | **7.x** |
| 57 | `DelegationPrescription` | 0,n | **autoriser** | 0,1 | `Consultation` | **7.x** |
| 58 | `TypeConsultation` | 0,n | **qualifier** | 0,1 | `Consultation` | *proposé* |
| 59 | `Consultation` | 0,n | **rattacher** | 1,1 | `DiagnosticConsultation` | **8.1** |
| 60 | `PathologieReference` | 0,n | **nommer** | 1,1 | `DiagnosticConsultation` | **7.x** |
| 61 | `Consultation` | 0,n | **rattacher** | 1,1 | `Ordonnance` | **8.1** |
| 62 | `DelegationPrescription` | 0,n | **couvrir** | 0,1 | `Ordonnance` | **7.x** |
| 63 | `EtablissementReference` | 0,n | **exécuter** | 0,1 | `Ordonnance` | *proposé* |
| 64 | `Ordonnance` | 0,n | **porter** | 1,1 | `LigneOrdonnance` | **8.1** |
| 65 | `MedicamentReference` | 0,n | **désigner** | 0,1 | `LigneOrdonnance` | **7.x** |
| 66 | `TypeExamen` | 0,n | **désigner** | 0,1 | `LigneOrdonnance` | **7.x** |
| 67 | `Consultation` | 0,n | **rattacher** | 1,1 | `BonExamen` | **8.1** |
| 68 | `Ordonnance` | 0,n | **engendrer** | 0,1 | `BonExamen` | **8.1** |
| 69 | `BonExamen` | 0,n | **porter** | 1,1 | `LigneExamen` | **8.1** |
| 70 | `TypeExamen` | 0,n | **désigner** | 1,1 | `LigneExamen` | **7.x** |
| 71 | `BonExamen` | 0,n | **recevoir** | 1,1 | `ResultatExamen` | *proposé* |
| 72 | `Consultation` | 0,n | **rattacher** | 1,1 | `BonPharmacie` | **8.1** |
| 73 | `Ordonnance` | 0,n | **engendrer** | 0,1 | `BonPharmacie` | **8.1** |
| 74 | `BonPharmacie` | 0,n | **porter** | 1,1 | `LigneBonPharmacie` | **8.1** |
| 75 | `MedicamentReference` | 0,n | **désigner** | 0,1 | `LigneBonPharmacie` | **7.x** |
| 76 | `PathologieReference` | 0,n | **nommer** | 1,1 | `SuiviChronique` | *proposé* |
| 77 | `Consultation` | 0,n | **ouvrir** | 0,1 | `SuiviChronique` | *proposé* |
| 78 | `Consultation` | 0,n | **délivrer** | 1,1 | `CertificatMedical` | *proposé* |
| 79 | `TypeCertificat` | 0,n | **qualifier** | 1,1 | `CertificatMedical` | *proposé* |

### SORTIES CRITIQUES — 3 associations · 2 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 80 | `Consultation` | 0,1 | **rattacher** | 1,1 | `Evacuation` | **8.1** |
| 81 | `EtablissementReference` | 0,n | **accueillir** | 0,1 | `Evacuation` | *proposé* |
| 82 | `Evacuation` | 0,n | **porter** | 1,1 | `SuiviEvacuation` | *proposé* |

### SUIVI DE TRAITEMENT — 2 associations · 2 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 83 | `Consultation` | 0,1 | **ouvrir** | 1,1 | `SuiviTraitement` | *proposé* |
| 84 | `SuiviTraitement` | 0,n | **porter** | 1,1 | `FicheSuiviTraitement` | *proposé* |

### SYNCHRONISATION OFFLINE — 5 associations · 5 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 85 | `PosteLocal` | 0,n | **empiler** | 1,1 | `FileMutation` | *proposé* |
| 86 | `PosteLocal` | 0,n | **produire** | 1,1 | `JournalSynchronisation` | *proposé* |
| 87 | `JournalSynchronisation` | 0,n | **relever** | 1,1 | `ConflitSynchronisation` | *proposé* |
| 88 | `ConflitSynchronisation` | 0,1 | **aboutir à** | 1,1 | `ResolutionConflit` | *proposé* |
| 89 | `ParametreMetier` | 0,n | **historiser** | 1,1 | `HistoriqueParametreMetier` | *proposé* |

### MESSAGERIE INTERNE (chiffrée) — 8 associations · 8 verbes proposés

| # | Entité | Card. | Verbe | Card. | Entité | Source |
|---:|---|:---:|---|:---:|---|:---:|
| 90 | `Conversation` | 0,n | **réunir** | 1,1 | `ConversationParticipant` | *proposé* |
| 91 | `Utilisateur` | 0,n | **participer à** | 1,1 | `ConversationParticipant` | *proposé* |
| 92 | `Conversation` | 0,n | **porter** | 1,1 | `Message` | *proposé* |
| 93 | `Utilisateur` | 0,n | **envoyer** | 1,1 | `Message` | *proposé* |
| 94 | `Message` | 0,n | **répondre à** | 0,1 | `Message` | *proposé* |
| 95 | `Message` | 0,n | **être masqué pour** | 1,1 | `MessageMasque` | *proposé* |
| 96 | `Message` | 0,n | **recevoir** | 1,1 | `MessageReaction` | *proposé* |
| 97 | `Message` | 0,n | **porter** | 1,1 | `MessagePieceJointe` | *proposé* |

---

## 6. Les neuf propositions sur lesquelles je veux votre avis

Les cinquante autres sont mécaniques — un référentiel `désigne`, un historique `historise`, un parent `porte` ses lignes. Celles-ci demandent un jugement métier, et vous seul l'avez.

| Association | Verbe proposé | Pourquoi celui-là, et le doute |
|---|---|---|
| `PersonnelMedical` → `PresenceJournaliere` | **pointer** | vocabulaire du pointage. Si le centre ne dit pas « pointer », le mot est faux |
| `PersonnelMedical` → `PlanningPermutation` | **demander** | une permutation se demande puis s'accorde. Si elle est imposée par le planning, le verbe devient `subir` |
| `SocieteSousTraitante` → `RattachementSousTraitant` | **employer** | c'est la société qui emploie le sous-traitant. Mais l'entité rattachée est un rattachement, pas une personne |
| `EtablissementReference` → `Ordonnance` | **exécuter** | l'établissement où l'ordonnance est servie. À confirmer : est-ce bien l'exécutant, ou l'émetteur ? |
| `EtablissementReference` → `Evacuation` | **accueillir** | reprend le verbe que votre planche 7.5 emploie pour `Site` → `Visite` |
| `Consultation` → `CertificatMedical` | **délivrer** | le mémoire parle de certificat de repos. `délivrer` est le mot du recueil |
| `Patient` → `AllergiePatient` · `AntecedentPatient` | **présenter** · **rapporter** | une allergie se constate, un antécédent se rapporte. Deux verbes distincts, volontairement |
| `Patient` → `FusionDossierPatient` ×2 | **être la source de** · **être la cible de** | deux liens vers la même entité : il faut deux verbes, sinon la planche ne dit pas lequel est fusionné dans lequel |
| `ConflitSynchronisation` → `ResolutionConflit` | **aboutir à** | un conflit aboutit à une résolution, et une seule. Le registre D-52 dit « tranché puis journalisé » |

---

## 7. Ce que je n'affirme pas

- **Les 59 verbes proposés n'ont aucune source écrite.** Ni le mémoire, ni le code, ni le recueil ne les nomment. Ils seront écrits **en gris et entre parenthèses** sur les deux planches, et le cartouche le dira.
- **Aucun d'eux ne peut entrer dans le mémoire** sans avoir été validé au préalable — par vous, ou par votre directeur de mémoire. C'est ce que prévoit le § 6 de la fiche `MCD-GLOBAL-01`.
- **Les 38 verbes sourcés le sont sur vos figures, pas sur le texte du Word.** Les treize de la planche 8.1 et douze des vingt-cinq de la 7.5 ont été fondés par un paragraphe ajouté au § 7.3 (décisions D-62 et D-72) ; pour les treize autres, la figure est la seule source.