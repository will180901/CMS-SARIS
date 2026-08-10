# INV-01 — Inventaire des routes de l’API

> **Statut** : extrait · **Date d’extraction** : 2026-08-10 · **Source** : `CMS/APP/CMS-SARIS/apps/api/src/**/*.controller.ts`
> **Méthode** : analyse automatique des décorateurs NestJS (`@Controller`, `@Get/@Post/@Patch/@Put/@Delete`, `@RequirePermissions`, `@Audit`, `@UseGuards`, `@LiveRefresh`), puis relecture.
> **Nature de la preuve** : `IMPLÉMENTÉ` — chaque ligne renvoie à `fichier:ligne`.

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| Routes exposées | **268** |
| Contrôleurs | **26** |
| Modules fonctionnels | **18** |
| Répartition par verbe HTTP | GET 89 · POST 76 · PATCH 65 · DELETE 36 · PUT 2 |
| Routes soumises à une permission explicite | **243** |
| Routes sans permission explicite | **25** (voir §4) |
| Routes journalisées à l’audit | **151** |
| Routes déclenchant un rafraîchissement temps réel | **105** |

### 1.1 Volumétrie par module

| Module | Contrôleur(s) | Routes | Dont sans permission |
|---|---:|---:|---:|
| M05 · Référentiels | ReferentielsController | 37 | 0 |
| M02-M04 · Administration, habilitations, audit | AuditController, ParametresController, RolesController, SynchronisationController, UtilisateursController | 32 | 0 |
| M07 · Dossier patient | PatientController | 30 | 0 |
| M13 · Messagerie interne | MessagerieController | 29 | 0 |
| M09 · Consultation | ConsultationController | 22 | 0 |
| M06 · Personnel & délégations | DelegationsController, PersonnelController, SousTraitantsController | 20 | 1 |
| M01 · Sécurité & authentification | MeController, SecurityController | 20 | 20 |
| M16 · Synchronisation | SyncController, SyncReadyController | 14 | 2 |
| M15 · Tableaux de bord | DashboardController | 9 | 0 |
| M14 · Notifications | NotificationController | 9 | 0 |
| M08 · Accueil & triage | TriageController | 9 | 0 |
| M12 · Évacuations | EvacuationsController | 8 | 0 |
| M12b · Suivi de traitement | SuiviTraitementController | 8 | 0 |
| M10 · Bon d’examen | BonExamenController | 7 | 0 |
| M11 · Bon de pharmacie | BonPharmacieController | 5 | 0 |
| M06 · Registre des employés SARIS | EmployeController | 5 | 0 |
| — · Santé du service | HealthController | 2 | 2 |
| M15b · Rapports | RapportsController | 2 | 0 |
| **Total** | | **268** | **25** |

---

## 2. Convention de lecture

| Colonne | Sens |
|---|---|
| **Verbe / Chemin** | Route telle qu’exposée par NestJS (préfixe du contrôleur + chemin de la méthode) |
| **Méthode** | Méthode du contrôleur, point d’entrée du service métier |
| **Permission** | Valeur de `@RequirePermissions`. Plusieurs valeurs = **l’une d’elles suffit** |
| **DTO** | Objet de transfert validé par `class-validator` |
| **Audit** | Domaine et entité journalisés dans `JournalAudit` |
| **L.** | Ligne du décorateur HTTP dans le fichier source |

Toutes les routes sont protégées par `JwtAuthGuard` puis `PermissionsGuard`, sauf mention contraire au §4.

---

## 3. Inventaire détaillé

### — · Santé du service

**`HealthController`** — `apps/api/src/health/health.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /health` | `check` | _aucune_ | — | 40 |
| `GET /health/ping` | `ping` | _aucune_ | — | 51 |

### M02-M04 · Administration, habilitations, audit

**`AuditController`** — `apps/api/src/modules/admin/audit.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /admin/audit/actions` | `audit` | `audit.read` | — | 12 |
| `GET /admin/audit/authentifications` | `auth` | `audit.read` | — | 37 |

**`ParametresController`** — `apps/api/src/modules/admin/parametres.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /admin/parametres` | `findAll` | `parametre.read` | — | 30 |
| `PATCH /admin/parametres/:cle` | `update` | `parametre.update` | `UpdateParametreDto` | 36 |
| `POST /admin/parametres/:cle/reset` | `reset` | `parametre.update` | — | 46 |

**`RolesController`** — `apps/api/src/modules/admin/roles.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /admin/permissions` | `findAllPermissions` | `role.read` | — | 34 |
| `GET /admin/roles` | `findAll` | `role.read` | — | 42 |
| `GET /admin/roles/:id` | `findById` | `role.read` | — | 48 |
| `GET /admin/roles/:id/utilisateurs` | `getUtilisateurs` | `role.read` | — | 55 |
| `POST /admin/roles` | `create` | `role.create` | `CreateRoleDto` | 61 |
| `PATCH /admin/roles/:id` | `update` | `role.update` | `UpdateRoleDto` | 68 |
| `DELETE /admin/roles/:id` | `remove` | `role.delete` | — | 74 |

**`SynchronisationController`** — `apps/api/src/modules/admin/synchronisation.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /synchronisation/status` | `status` | `synchronisation.read` | — | 22 |
| `GET /synchronisation/sauvegardes` | `sauvegardes` | `synchronisation.read` | — | 28 |
| `POST /synchronisation/sauvegardes/manuelle` | `declencher` | `synchronisation.execute` | — | 34 |
| `POST /synchronisation/sauvegardes/:id/restaurer` | `restaurer` | `synchronisation.restore` | — | 41 |
| `DELETE /synchronisation/sauvegardes/:id` | `supprimer` | `synchronisation.execute` | — | 53 |
| `POST /synchronisation/messagerie/rechiffrer` | `rechiffrerMessagerie` | `synchronisation.execute` | — | 61 |

**`UtilisateursController`** — `apps/api/src/modules/admin/utilisateurs.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /admin/utilisateurs` | `findAll` | `utilisateur.read` | `UtilisateurQueryDto` | 69 |
| `GET /admin/utilisateurs/:id` | `findById` | `utilisateur.read` | — | 75 |
| `POST /admin/utilisateurs` | `create` | `utilisateur.create` | `CreateUtilisateurDto` | 81 |
| `PATCH /admin/utilisateurs/:id` | `update` | `utilisateur.update` | `UpdateUtilisateurDto` | 93 |
| `DELETE /admin/utilisateurs/:id` | `remove` | `utilisateur.delete` | — | 109 |
| `PATCH /admin/utilisateurs/:id/roles` | `setRoles` | `utilisateur.assign_role` | `SetRolesDto` | 116 |
| `PATCH /admin/utilisateurs/:id/statut` | `setStatut` | `utilisateur.update` | `SetStatutDto` | 126 |
| `POST /admin/utilisateurs/:id/reset-password` | `resetPassword` | `utilisateur.reset_password` | `ResetPasswordDto` | 136 |
| `POST /admin/utilisateurs/:id/totp/reset` | `resetTotp` | `utilisateur.reset_password` | — | 150 |
| `POST /admin/utilisateurs/:id/backup-codes` | `regenerateBackupCodes` | `utilisateur.reset_password` | — | 158 |
| `POST /admin/utilisateurs/:id/sessions/revoke` | `revokeSessions` | `utilisateur.reset_password` | — | 166 |
| `POST /admin/utilisateurs/permissions/bulk` | `bulkPermissions` | `utilisateur.manage_permissions` | `BulkPermissionDto` | 176 |
| `GET /admin/utilisateurs/:id/permissions` | `getPermissions` | `utilisateur.read` · `utilisateur.manage_permissions` | — | 184 |
| `PUT /admin/utilisateurs/:id/permissions` | `setPermissions` | `utilisateur.manage_permissions` | `SetPermissionOverridesDto` | 191 |

### M10 · Bon d’examen

**`BonExamenController`** — `apps/api/src/modules/bon-examen/bon-examen.controller.ts` · audit `bon_examen, Bon d` · temps réel `LIVE_BONS_EXAMEN`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /bons-examen` | `findAll` | `bon_examen.read` | `BonExamenQueryDto` | 41 |
| `GET /bons-examen/:id` | `findById` | `bon_examen.read` | — | 47 |
| `PATCH /bons-examen/:id` | `update` | `bon_examen.update` | `UpdateBonExamenDto` | 56 |
| `PATCH /bons-examen/:id/statut` | `validerOuAnnuler` | `bon_examen.validate` | `ValiderBonExamenDto` | 62 |
| `PATCH /bons-examen/:id/annuler` | `annuler` | `bon_examen.cancel` | `AnnulerBonExamenDto` | 68 |
| `DELETE /bons-examen/:id` | `remove` | `bon_examen.delete` | — | 74 |
| `POST /bons-examen/:id/resultats` | `saisirResultat` | `bon_examen.result` | `SaisirResultatDto` | 81 |

### M11 · Bon de pharmacie

**`BonPharmacieController`** — `apps/api/src/modules/bon-pharmacie/bon-pharmacie.controller.ts` · audit `bon_pharmacie, Bon de pharmacie` · temps réel `LIVE_BONS_PHARMACIE`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /bons-pharmacie` | `findAll` | `bon_pharmacie.read` | `BonPharmacieQueryDto` | 35 |
| `GET /bons-pharmacie/:id` | `findById` | `bon_pharmacie.read` | — | 41 |
| `PATCH /bons-pharmacie/:id/delivrer` | `deliver` | `bon_pharmacie.deliver` | `DelivrerBonPharmacieDto` | 50 |
| `PATCH /bons-pharmacie/:id/annuler` | `annuler` | `bon_pharmacie.cancel` | `AnnulerBonPharmacieDto` | 56 |
| `DELETE /bons-pharmacie/:id` | `remove` | `bon_pharmacie.delete` | — | 62 |

### M09 · Consultation

**`ConsultationController`** — `apps/api/src/modules/consultation/consultation.controller.ts` · audit `consultation, Consultation` · temps réel `LIVE_CONSULTATION`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /consultations` | `findAll` | `consultation.read` | `ConsultationQueryDto` | 88 |
| `POST /consultations` | `create` | `consultation.create` | `CreateConsultationDto` | 105 |
| `GET /consultations/patient/:patientId/documents` | `patientDocuments` | `consultation.read` | — | 115 |
| `GET /consultations/:id` | `findById` | `consultation.read` | — | 140 |
| `PATCH /consultations/:id/examen` | `updateExamen` | `consultation.examen` | `UpdateExamenCliniqueDto` | 160 |
| `PATCH /consultations/:id/conclusion` | `updateConclusion` | `consultation.update` | `UpdateConclusionDto` | 173 |
| `PATCH /consultations/:id/type` | `setType` | `consultation.update` | `SetTypeConsultationDto` | 186 |
| `PATCH /consultations/:id/repos` | `setRepos` | `consultation.update` | `UpdateReposDto` | 203 |
| `POST /consultations/:id/diagnostics` | `addDiagnostic` | `consultation.diagnose` | `AddDiagnosticDto` | 216 |
| `DELETE /consultations/:id/diagnostics/:diagId` | `removeDiagnostic` | `consultation.diagnose` | — | 228 |
| `PATCH /consultations/:id/cloturer` | `cloturer` | `consultation.close` | `CloturerConsultationDto` | 242 |
| `PATCH /consultations/:id/annuler` | `annuler` | `consultation.cancel` | `AnnulerConsultationDto` | 253 |
| `DELETE /consultations/:id` | `deleteConsultation` | `consultation.delete` | — | 264 |
| `POST /consultations/:id/prise-en-charge` | `prendreEnCharge` | `consultation.update` | — | 273 |
| `POST /consultations/:id/ordonnances` | `createOrdonnance` | `ordonnance.create` | `CreateOrdonnanceDto` | 283 |
| `POST /consultations/:id/ordonnances/:ordId/lignes` | `addLigne` | `ordonnance.create` · `ordonnance.update` | `AddLigneOrdonnanceDto` | 307 |
| `PATCH /consultations/:id/ordonnances/:ordId` | `updateOrdonnance` | `ordonnance.update` | `UpdateOrdonnanceDto` | 331 |
| `DELETE /consultations/:id/ordonnances/:ordId/lignes/:ligneId` | `removeLigne` | `ordonnance.update` | — | 343 |
| `PATCH /consultations/:id/ordonnances/:ordId/valider` | `validerOrdonnance` | `ordonnance.validate` | — | 361 |
| `PATCH /consultations/:id/ordonnances/:ordId/annuler` | `annulerOrdonnance` | `ordonnance.cancel` | — | 372 |
| `DELETE /consultations/:id/ordonnances/:ordId` | `deleteOrdonnance` | `ordonnance.delete` | — | 383 |
| `POST /consultations/:id/ordonnances/:ordId/generer-bon` | `genererBon` | `bon_examen.create` · `bon_pharmacie.create` | — | 398 |

### M15 · Tableaux de bord

**`DashboardController`** — `apps/api/src/modules/dashboard/dashboard.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /dashboard/overview` | `overview` | `dashboard.read` | — | 12 |
| `GET /dashboard/motifs-jour` | `motifsDuJour` | `dashboard.read` | — | 18 |
| `GET /dashboard/urgences` | `urgences` | `dashboard.read` | — | 24 |
| `GET /dashboard/tendance` | `tendance` | `dashboard.read` | — | 31 |
| `GET /dashboard/affluence` | `affluence` | `dashboard.read` | — | 38 |
| `GET /dashboard/admin-systeme` | `adminSysteme` | `utilisateur.read` | — | 45 |
| `GET /dashboard/statistiques` | `statistiques` | `consultation.read` | — | 54 |
| `GET /dashboard/croisement` | `croisement` | `consultation.read` | — | 61 |
| `GET /dashboard/evolution-annuelle` | `evolutionAnnuelle` | `consultation.read` | — | 68 |

### M06 · Registre des employés SARIS

**`EmployeController`** — `apps/api/src/modules/employe/employe.controller.ts` · audit `employe, Employé SARIS` · temps réel `LIVE_EMPLOYES`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /employes` | `findAll` | `employe.read` | `EmployeQueryDto` | 38 |
| `GET /employes/lookup/:matricule` | `lookup` | `employe.read` | — | 45 |
| `POST /employes` | `create` | `employe.create` | `CreateEmployeDto` | 51 |
| `PATCH /employes/:id` | `update` | `employe.update` | `UpdateEmployeDto` | 58 |
| `DELETE /employes/:id` | `remove` | `employe.delete` | — | 64 |

### M13 · Messagerie interne

**`MessagerieController`** — `apps/api/src/modules/messagerie/messagerie.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /messagerie/contacts` | `contacts` | `messagerie.read` | — | 153 |
| `GET /messagerie/conversations` | `conversations` | `messagerie.read` | — | 161 |
| `GET /messagerie/unread-count` | `unread` | `messagerie.read` | — | 168 |
| `POST /messagerie/conversations` | `start` | `messagerie.create` | `StartConversationDto` | 175 |
| `POST /messagerie/groupes` | `createGroup` | `messagerie.create` | `CreateGroupDto` | 184 |
| `POST /messagerie/conversations/:id/quitter` | `leave` | `messagerie.read` | `LeaveConversationDto` | 197 |
| `GET /messagerie/conversations/:id/groupe` | `groupInfo` | `messagerie.read` | — | 215 |
| `POST /messagerie/conversations/:id/participants` | `addParticipants` | `messagerie.create` | `AddParticipantsDto` | 222 |
| `DELETE /messagerie/conversations/:id/participants/:userId` | `removeParticipant` | `messagerie.delete` | — | 238 |
| `PATCH /messagerie/conversations/:id/participants/:userId/admin` | `setAdmin` | `messagerie.update` | `SetAdminDto` | 250 |
| `PATCH /messagerie/conversations/:id` | `updateGroup` | `messagerie.update` | `UpdateGroupDto` | 262 |
| `POST /messagerie/conversations/:id/photo` | `uploadGroupPhoto` | `messagerie.update` | — | 273 |
| `DELETE /messagerie/conversations/:id/photo` | `removeGroupPhoto` | `messagerie.update` | — | 286 |
| `PATCH /messagerie/conversations/:id/mute` | `mute` | `messagerie.read` | `MuteDto` | 293 |
| `POST /messagerie/conversations/:id/typing` | `typing` | `messagerie.create` | — | 308 |
| `GET /messagerie/conversations/:id/messages` | `messages` | `messagerie.read` | — | 325 |
| `POST /messagerie/conversations/:id/messages` | `send` | `messagerie.create` | `SendMessageDto` | 336 |
| `GET /messagerie/pieces-jointes/:id` | `piece` | `messagerie.read` | — | 367 |
| `GET /messagerie/messages/:id/details` | `details` | `messagerie.read` | — | 374 |
| `POST /messagerie/messages/:id/reactions` | `react` | `messagerie.create` | `ReactDto` | 381 |
| `GET /messagerie/messages/:id/reactions` | `reactionDetails` | `messagerie.read` | — | 393 |
| `POST /messagerie/messages/:id/epingler` | `togglePin` | `messagerie.update` | — | 400 |
| `GET /messagerie/conversations/:id/epingles` | `pinned` | `messagerie.read` | — | 408 |
| `POST /messagerie/messages/:id/transferer` | `forward` | `messagerie.create` | `ForwardMessageDto` | 415 |
| `PATCH /messagerie/messages/:id` | `update` | `messagerie.update` | `UpdateMessageDto` | 431 |
| `DELETE /messagerie/messages/:id` | `remove` | `messagerie.delete` | — | 442 |
| `POST /messagerie/messages/:id/masquer` | `hide` | `messagerie.delete` | — | 450 |
| `POST /messagerie/messages/batch-masquer` | `batchHide` | `messagerie.delete` | `BatchIdsDto` | 458 |
| `POST /messagerie/messages/batch-delete` | `batchDelete` | `messagerie.delete` | `BatchIdsDto` | 466 |

### M14 · Notifications

**`NotificationController`** — `apps/api/src/modules/notification/notification.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /notifications` | `list` | `notification.read` | — | 133 |
| `GET /notifications/unread-count` | `unreadCount` | `notification.read` | — | 140 |
| `PATCH /notifications/:id/read` | `markRead` | `notification.update` | — | 147 |
| `POST /notifications/read-all` | `markAllRead` | `notification.update` | — | 154 |
| `POST /notifications/annonce` | `annonce` | `notification.create` | `CreateAnnonceDto` | 163 |
| `POST /notifications/dismiss-many` | `dismissMany` | `notification.read` | `BatchIdsDto` | 190 |
| `POST /notifications/dismiss-all` | `dismissAll` | `notification.read` | — | 199 |
| `POST /notifications/:id/dismiss` | `dismiss` | `notification.read` | — | 208 |
| `DELETE /notifications/:id` | `remove` | `notification.delete` | — | 217 |

### M07 · Dossier patient

**`PatientController`** — `apps/api/src/modules/patient/patient.controller.ts` · audit `patient, Patient`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /patients` | `findAll` | `patient.read` | `PatientQueryDto` | 94 |
| `POST /patients` | `create` | `patient.create` | `CreatePatientDto` | 100 |
| `GET /patients/similar` | `findSimilar` | `patient.create` · `patient.read` | `FindSimilarPatientDto` | 112 |
| `GET /patients/by-matricule/:matricule` | `findByMatricule` | `patient.read` | — | 121 |
| `GET /patients/:id` | `findById` | `patient.read` | — | 127 |
| `GET /patients/:id/ayants-droits` | `ayantsDroits` | `patient.read` | — | 139 |
| `GET /patients/:id/constantes` | `findConstantes` | `patient.read` | — | 150 |
| `GET /patients/:id/alertes-cliniques` | `findAlertesCliniques` | `consultation.read` | — | 166 |
| `GET /patients/:id/suivi` | `findSuivi` | `consultation.read` | — | 180 |
| `POST /patients/:id/suivi-chronique` | `createSuiviChronique` | `consultation.diagnose` | `CreateSuiviChroniqueDto` | 195 |
| `PATCH /patients/:id/suivi-chronique/:sId` | `updateSuiviChronique` | `consultation.diagnose` | `UpdateSuiviChroniqueDto` | 204 |
| `PATCH /patients/:id/identite` | `updateIdentite` | `patient.update` | `UpdateIdentiteDto` | 214 |
| `PATCH /patients/:id/mode-vie` | `upsertModeVie` | `patient.update` | `UpsertModeVieDto` | 220 |
| `POST /patients/:id/photo` | `uploadPhoto` | `patient.update` | — | 226 |
| `DELETE /patients/:id/photo` | `removePhoto` | `patient.update` | — | 255 |
| `PATCH /patients/:id/categorie` | `changerCategorie` | `patient.change_category` | `ChangerCategorieDto` | 261 |
| `PATCH /patients/:id/statut` | `updateStatut` | `patient.archive` | `ToggleStatutPatientDto` | 271 |
| `PATCH /patients/:id/verrou` | `setVerrou` | `patient.lock` | `VerrouPatientDto` | 278 |
| `POST /patients/:id/allergies` | `createAllergie` | `patient.update` | `CreateAllergieDto` | 295 |
| `PATCH /patients/:id/allergies/:aId` | `updateAllergie` | `patient.update` | `UpdateAllergieDto` | 301 |
| `DELETE /patients/:id/allergies/:aId` | `deleteAllergie` | `patient.update` | — | 311 |
| `POST /patients/:id/antecedents` | `createAntecedent` | `patient.update` | `CreateAntecedentDto` | 319 |
| `PATCH /patients/:id/antecedents/:aId` | `updateAntecedent` | `patient.update` | `UpdateAntecedentDto` | 325 |
| `DELETE /patients/:id/antecedents/:aId` | `deleteAntecedent` | `patient.update` | — | 335 |
| `POST /patients/:id/alertes` | `createAlerte` | `patient.update` | `CreateAlerteMedicaleDto` | 343 |
| `PATCH /patients/:id/alertes/:aId` | `updateAlerte` | `patient.update` | `UpdateAlerteMedicaleDto` | 349 |
| `DELETE /patients/:id/alertes/:aId` | `deleteAlerte` | `patient.update` | — | 359 |
| `PATCH /patients/:id/rattachements-ad/:rId` | `updateRattachementAD` | `patient.rattachement.manage` | `UpdateRattachementADDto` | 370 |
| `DELETE /patients/:id/rattachements-ad/:rId` | `deleteRattachementAD` | `patient.rattachement.manage` | — | 380 |
| `DELETE /patients/:id` | `remove` | `patient.delete` | — | 388 |

### M06 · Personnel & délégations

**`DelegationsController`** — `apps/api/src/modules/personnel/delegations.controller.ts` · audit `delegation, Délégation` · temps réel `LIVE_ACTEURS`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /delegations/mine/active` | `mine` | _aucune_ | — | 43 |
| `GET /delegations` | `findAll` | `delegation.read` | — | 48 |
| `GET /delegations/:id` | `findOne` | `delegation.read` | — | 54 |
| `POST /delegations` | `create` | `delegation.create` | `CreateDelegationDto` | 60 |
| `PATCH /delegations/:id` | `update` | `delegation.update` | `UpdateDelegationDto` | 67 |
| `PATCH /delegations/:id/statut` | `toggleStatut` | `delegation.revoke` | `ToggleDelegationStatutDto` | 73 |
| `DELETE /delegations/:id` | `remove` | `delegation.delete` | — | 82 |

**`PersonnelController`** — `apps/api/src/modules/personnel/personnel.controller.ts` · audit `personnel, Personnel` · temps réel `LIVE_ACTEURS`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /personnel` | `findAll` | `personnel.read` | `PersonnelQueryDto` | 39 |
| `GET /personnel/soignants` | `findSoignants` | `visite.read` | — | 50 |
| `GET /personnel/:id` | `findOne` | `personnel.read` | — | 56 |
| `POST /personnel` | `create` | `personnel.create` | `CreatePersonnelDto` | 62 |
| `PATCH /personnel/:id` | `update` | `personnel.update` | `UpdatePersonnelDto` | 69 |
| `PATCH /personnel/:id/statut` | `setStatut` | `personnel.delete` | `ToggleStatutPersonnelDto` | 78 |
| `DELETE /personnel/:id` | `remove` | `personnel.delete` | — | 84 |

**`SousTraitantsController`** — `apps/api/src/modules/personnel/sous-traitants.controller.ts` · audit `sous_traitant, Sous-traitant` · temps réel `LIVE_ACTEURS`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /sous-traitants` | `findAll` | `sous_traitant.read` | `SousTraitantQueryDto` | 37 |
| `GET /sous-traitants/:id` | `findOne` | `sous_traitant.read` | — | 43 |
| `POST /sous-traitants` | `create` | `sous_traitant.create` | `CreateSousTraitantDto` | 49 |
| `PATCH /sous-traitants/:id` | `update` | `sous_traitant.update` | `UpdateSousTraitantDto` | 56 |
| `PATCH /sous-traitants/:id/statut` | `setStatut` | `sous_traitant.delete` | `ToggleStatutSousTraitantDto` | 63 |
| `DELETE /sous-traitants/:id` | `remove` | `sous_traitant.delete` | — | 69 |

### M15b · Rapports

**`RapportsController`** — `apps/api/src/modules/rapports/rapports.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /rapports` | `list` | `rapport.read` | — | 14 |
| `GET /rapports/:id` | `findOne` | `rapport.read` | — | 21 |

### M05 · Référentiels

**`ReferentielsController`** — `apps/api/src/modules/referentiels/referentiels.controller.ts` · audit `referentiel, Référentiel` · temps réel `LIVE_REFERENTIELS`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /referentiels/sites` | `getSites` | `referentiel.site.read` | `ListQueryDto` | 63 |
| `GET /referentiels/sites/:id` | `getSite` | `referentiel.site.read` | — | 69 |
| `POST /referentiels/sites` | `createSite` | `referentiel.site.create` | `CreateSiteDto` | 75 |
| `PATCH /referentiels/sites/:id` | `updateSite` | `referentiel.site.update` | `UpdateSiteDto` | 82 |
| `PATCH /referentiels/sites/:id/statut` | `setStatutSite` | `referentiel.site.delete` | `ToggleStatutReferentielDto` | 88 |
| `DELETE /referentiels/sites/:id` | `deleteSite` | `referentiel.site.delete` | — | 97 |
| `GET /referentiels/motifs` | `getMotifs` | `referentiel.motif.read` | `ListQueryDto` | 105 |
| `POST /referentiels/motifs` | `createMotif` | `referentiel.motif.create` | `CreateMotifDto` | 111 |
| `PATCH /referentiels/motifs/:id` | `updateMotif` | `referentiel.motif.update` | `UpdateMotifDto` | 118 |
| `PATCH /referentiels/motifs/:id/statut` | `setStatutMotif` | `referentiel.motif.delete` | `ToggleStatutReferentielDto` | 124 |
| `DELETE /referentiels/motifs/:id` | `deleteMotif` | `referentiel.motif.delete` | — | 133 |
| `GET /referentiels/pathologies` | `getPathologies` | `referentiel.pathologie.read` | `ListQueryDto` | 141 |
| `POST /referentiels/pathologies` | `createPathologie` | `referentiel.pathologie.create` | `CreatePathologieDto` | 147 |
| `PATCH /referentiels/pathologies/:id` | `updatePathologie` | `referentiel.pathologie.update` | `UpdatePathologieDto` | 154 |
| `PATCH /referentiels/pathologies/:id/statut` | `setStatutPathologie` | `referentiel.pathologie.delete` | `ToggleStatutReferentielDto` | 160 |
| `DELETE /referentiels/pathologies/:id` | `deletePathologie` | `referentiel.pathologie.delete` | — | 169 |
| `GET /referentiels/medicaments` | `getMedicaments` | `referentiel.medicament.read` | `ListQueryDto` | 177 |
| `POST /referentiels/medicaments` | `createMedicament` | `referentiel.medicament.create` | `CreateMedicamentDto` | 183 |
| `PATCH /referentiels/medicaments/:id` | `updateMedicament` | `referentiel.medicament.update` | `UpdateMedicamentDto` | 190 |
| `PATCH /referentiels/medicaments/:id/statut` | `setStatutMedicament` | `referentiel.medicament.delete` | `ToggleStatutReferentielDto` | 196 |
| `DELETE /referentiels/medicaments/:id` | `deleteMedicament` | `referentiel.medicament.delete` | — | 205 |
| `GET /referentiels/categories-patient` | `getCategoriesPatient` | `referentiel.categorie.read` | `ListQueryDto` | 213 |
| `GET /referentiels/categories-patient/droits` | `getDroitsCategoriesPatient` | `referentiel.read` | — | 226 |
| `POST /referentiels/categories-patient` | `createCategoriePatient` | `referentiel.categorie.create` | `CreateCategoriePatientDto` | 232 |
| `PATCH /referentiels/categories-patient/:id` | `updateCategoriePatient` | `referentiel.categorie.update` | `UpdateCategoriePatientDto` | 239 |
| `PATCH /referentiels/categories-patient/:id/statut` | `setStatutCategoriePatient` | `referentiel.categorie.delete` | `ToggleStatutReferentielDto` | 248 |
| `DELETE /referentiels/categories-patient/:id` | `deleteCategoriePatient` | `referentiel.categorie.delete` | — | 257 |
| `GET /referentiels/types-examen` | `getTypesExamen` | `referentiel.examen.read` | `ListQueryDto` | 265 |
| `POST /referentiels/types-examen` | `createTypeExamen` | `referentiel.examen.create` | `CreateTypeExamenDto` | 271 |
| `PATCH /referentiels/types-examen/:id` | `updateTypeExamen` | `referentiel.examen.update` | `UpdateTypeExamenDto` | 278 |
| `PATCH /referentiels/types-examen/:id/statut` | `setStatutTypeExamen` | `referentiel.examen.delete` | `ToggleStatutReferentielDto` | 284 |
| `DELETE /referentiels/types-examen/:id` | `deleteTypeExamen` | `referentiel.examen.delete` | — | 293 |
| `GET /referentiels/types-consultation` | `getTypesConsultation` | `referentiel.type_consultation.read` | `ListQueryDto` | 301 |
| `POST /referentiels/types-consultation` | `createTypeConsultation` | `referentiel.type_consultation.create` | `CreateTypeConsultationDto` | 307 |
| `PATCH /referentiels/types-consultation/:id` | `updateTypeConsultation` | `referentiel.type_consultation.update` | `UpdateTypeConsultationDto` | 314 |
| `PATCH /referentiels/types-consultation/:id/statut` | `setStatutTypeConsultation` | `referentiel.type_consultation.delete` | `ToggleStatutReferentielDto` | 323 |
| `DELETE /referentiels/types-consultation/:id` | `deleteTypeConsultation` | `referentiel.type_consultation.delete` | — | 332 |

### M01 · Sécurité & authentification

**`MeController`** — `apps/api/src/modules/security/me.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /me/preferences` | `getPreferences` | _aucune_ | — | 38 |
| `PUT /me/preferences` | `updatePreferences` | _aucune_ | `UpdatePreferencesDto` | 43 |
| `POST /me/photo` | `uploadPhoto` | _aucune_ | — | 49 |
| `DELETE /me/photo` | `removePhoto` | _aucune_ | — | 74 |
| `GET /me/annuaire` | `annuaire` | _aucune_ | — | 80 |
| `POST /me/cgu/accepter` | `accepterCgu` | _aucune_ | — | 86 |
| `GET /me/sessions` | `listSessions` | _aucune_ | — | 93 |
| `POST /me/sessions/revoke-others` | `revokeOthers` | _aucune_ | — | 98 |
| `DELETE /me/sessions/:id` | `revokeSession` | _aucune_ | — | 104 |
| `GET /me/totp` | `totpStatus` | _aucune_ | — | 110 |
| `POST /me/totp/setup` | `totpSetup` | _aucune_ | — | 115 |
| `POST /me/totp/activate` | `totpActivate` | _aucune_ | `TotpCodeDto` | 121 |
| `POST /me/totp/disable` | `totpDisable` | _aucune_ | `TotpCodeDto` | 127 |

**`SecurityController`** — `apps/api/src/modules/security/security.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `POST /auth/login` | `login` | _aucune_ | `LoginDto` | 45 |
| `POST /auth/totp/verify` | `verifyTotp` | _aucune_ | `TotpVerifyDto` | 64 |
| `POST /auth/session/confirmer` | `confirmerSession` | _aucune_ | `ConfirmerSessionDto` | 85 |
| `POST /auth/refresh` | `refresh` | _aucune_ | `RefreshDto` | 108 |
| `POST /auth/change-password` | `changePassword` | _aucune_ | `ChangePasswordDto` | 122 |
| `POST /auth/logout` | `logout` | _aucune_ | — | 138 |
| `GET /auth/me` | `me` | _aucune_ | — | 151 |

### M12 · Évacuations

**`EvacuationsController`** — `apps/api/src/modules/sorties-critiques/sorties-critiques.controller.ts` · audit `evacuation, Évacuation`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /evacuations` | `findAll` | `evacuation.read` | `EvacuationQueryDto` | 44 |
| `GET /evacuations/:id` | `findById` | `evacuation.read` | — | 50 |
| `POST /evacuations` | `create` | `evacuation.create` | `CreateEvacuationDto` | 56 |
| `PATCH /evacuations/:id` | `update` | `evacuation.update` | `UpdateEvacuationDto` | 63 |
| `POST /evacuations/:id/suivi` | `addSuivi` | `evacuation.update` | `AddSuiviEvacuationDto` | 69 |
| `PATCH /evacuations/:id/annuler` | `annuler` | `evacuation.cancel` · `evacuation.update` | `AnnulerEvacuationDto` | 80 |
| `PATCH /evacuations/:id/cloturer` | `cloturer` | `evacuation.close` | — | 86 |
| `DELETE /evacuations/:id` | `remove` | `evacuation.delete` | — | 92 |

### M12b · Suivi de traitement

**`SuiviTraitementController`** — `apps/api/src/modules/suivi-traitement/suivi-traitement.controller.ts` · audit `suivi_traitement, Suivi de traitement`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /suivi-traitement` | `findAll` | `suivi_traitement.read` | `SuiviTraitementQueryDto` | 42 |
| `GET /suivi-traitement/:id` | `findById` | `suivi_traitement.read` | — | 48 |
| `POST /suivi-traitement` | `create` | `suivi_traitement.create` | `CreateSuiviTraitementDto` | 54 |
| `POST /suivi-traitement/:id/fiches` | `addFiche` | `suivi_traitement.update` | `AddFicheSuiviDto` | 61 |
| `PATCH /suivi-traitement/:id/fiches/:ficheId` | `updateFiche` | `suivi_traitement.update` | `AddFicheSuiviDto` | 72 |
| `PATCH /suivi-traitement/:id/cloturer` | `cloturer` | `suivi_traitement.close` | `CloturerSuiviTraitementDto` | 82 |
| `PATCH /suivi-traitement/:id/annuler` | `annuler` | `suivi_traitement.cancel` · `suivi_traitement.update` | `AnnulerSuiviTraitementDto` | 88 |
| `DELETE /suivi-traitement/:id` | `remove` | `suivi_traitement.delete` | — | 94 |

### M16 · Synchronisation

**`SyncController`** — `apps/api/src/modules/sync/sync.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /sync/pull` | `pull` | `synchronisation.read` | `SyncPullQueryDto` | 64 |
| `POST /sync/push` | `push` | `synchronisation.execute` | `SyncPushDto` | 94 |
| `POST /sync/heartbeat` | `heartbeat` | `synchronisation.execute` | `SyncHeartbeatDto` | 105 |
| `POST /sync/poste` | `configurerPoste` | `synchronisation.read` | `ConfigurerPosteDto` | 122 |
| `GET /sync/poste/:id` | `lirePoste` | `synchronisation.read` | — | 133 |
| `PATCH /sync/supervision/postes/:id` | `renamePoste` | `synchronisation.execute` | `RenamePosteDto` | 146 |
| `GET /sync/supervision` | `getSupervision` | `synchronisation.read` | — | 153 |
| `GET /sync/supervision/activite` | `getActivite` | `synchronisation.read` | `ActiviteQueryDto` | 161 |
| `GET /sync/supervision/postes/:id` | `getPosteDetail` | `synchronisation.read` | — | 168 |
| `DELETE /sync/supervision/postes/:id` | `masquerPoste` | `synchronisation.execute` | — | 175 |
| `GET /sync/status` | `status` | `synchronisation.read` | — | 182 |
| `POST /sync/run` | `run` | `synchronisation.execute` | — | 194 |

**`SyncReadyController`** — `apps/api/src/modules/sync/sync-ready.controller.ts` · non audité

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `POST /sync/now` | `now` | _aucune_ | — | 36 |
| `GET /sync/ready` | `ready` | _aucune_ | — | 43 |

### M08 · Accueil & triage

**`TriageController`** — `apps/api/src/modules/triage/triage.controller.ts` · audit `visite, Visite` · temps réel `LIVE_TRIAGE`

| Verbe / Chemin | Méthode | Permission | DTO | L. |
|---|---|---|---|---:|
| `GET /triage/visites` | `findAll` | `visite.read` | `VisiteQueryDto` | 74 |
| `POST /triage/visites` | `create` | `visite.create` | `CreateVisiteDto` | 88 |
| `GET /triage/visites/patient/:patientId` | `findByPatient` | `visite.read` | — | 97 |
| `GET /triage/visites/:id` | `findById` | `visite.read` | — | 114 |
| `DELETE /triage/visites/:id` | `deleteVisite` | `visite.delete` | — | 121 |
| `PATCH /triage/visites/:id/statut` | `updateStatut` | `visite.update` · `visite.cancel` · `visite.close` | `UpdateStatutVisiteDto` | 129 |
| `PATCH /triage/visites/:id/soignant` | `updateSoignant` | `visite.assign_soignant` | `UpdateSoignantVisiteDto` | 140 |
| `PATCH /triage/visites/:id/notes` | `updateNotes` | `visite.update` | `UpdateNotesVisiteDto` | 151 |
| `POST /triage/visites/:id/constantes` | `createConstantes` | `visite.update` | `CreateConstanteVitaleDto` | 162 |

---

## 4. Routes sans permission explicite

Ces routes n’exigent aucune permission du catalogue. Elles se répartissent en deux familles ; la distinction est **essentielle pour le chapitre 6 (droits) et le chapitre 7 (sécurité)**.

### 4.1 Routes publiques (aucune authentification préalable possible)

| Verbe / Chemin | Contrôleur | Justification |
|---|---|---|
| `GET /health` | `HealthController` | Sonde de disponibilité utilisée par l’hébergeur |
| `GET /health/ping` | `HealthController` | Sonde de disponibilité |
| `POST /auth/login` | `SecurityController` | Point d’entrée de l’authentification : exiger une permission serait circulaire |
| `POST /auth/totp/verify` | `SecurityController` | Deuxième facteur, avant émission du jeton définitif |
| `POST /auth/session/confirmer` | `SecurityController` | Confirmation de session concurrente, avant jeton définitif |
| `POST /auth/refresh` | `SecurityController` | Renouvellement par jeton de rafraîchissement, pas par permission |
| `POST /auth/change-password` | `SecurityController` | Séquence d’authentification |
| `POST /auth/logout` | `SecurityController` | Séquence d’authentification |
| `GET /auth/me` | `SecurityController` | Séquence d’authentification |

### 4.2 Routes authentifiées mais sans permission de catalogue

Elles exigent un jeton valide (`JwtAuthGuard`) mais aucune permission : **tout utilisateur connecté y a accès**. C’est un choix de conception assumé — ces routes n’agissent que sur les données propres de l’appelant.

| Verbe / Chemin | Contrôleur | Portée |
|---|---|---|
| `GET /delegations/mine/active` | `DelegationsController` | Délégations de prescription actives de l’appelant |
| `GET /me/preferences` | `MeController` | Préférences du compte appelant (langue, thème) |
| `PUT /me/preferences` | `MeController` | Préférences du compte appelant (langue, thème) |
| `POST /me/photo` | `MeController` | Photo de profil du compte appelant |
| `DELETE /me/photo` | `MeController` | Photo de profil du compte appelant |
| `GET /me/annuaire` | `MeController` | Annuaire interne, nécessaire à la messagerie |
| `POST /me/cgu/accepter` | `MeController` | Acceptation des CGU par l’appelant |
| `GET /me/sessions` | `MeController` | Sessions du compte appelant |
| `POST /me/sessions/revoke-others` | `MeController` | Révocation des autres sessions de l’appelant |
| `DELETE /me/sessions/:id` | `MeController` | Révocation d’une session de l’appelant |
| `GET /me/totp` | `MeController` | État du second facteur de l’appelant |
| `POST /me/totp/setup` | `MeController` | Enrôlement du second facteur de l’appelant |
| `POST /me/totp/activate` | `MeController` | Activation du second facteur de l’appelant |
| `POST /me/totp/disable` | `MeController` | Désactivation du second facteur de l’appelant |
| `POST /sync/now` | `SyncReadyController` | Déclenchement manuel de la synchronisation du poste local |
| `GET /sync/ready` | `SyncReadyController` | État de préparation de la synchronisation du poste local |

---

## 5. Architecture transverse de l'API

Éléments qui s'appliquent à **toutes** les routes ci-dessus. Ils sont indispensables au chapitre 7 (conception) et au diagramme de composants.

### 5.1 Amorçage et protections globales

| Élément | Réglage constaté | Motif inscrit dans le code |
|---|---|---|
| En-têtes de sécurité HTTP | `helmet()` | Protection standard |
| Limitation de débit **globale** | 100 requêtes / minute, fenêtre de 60 s, throttler nommé `default` | Le nom `default` est obligatoire : un autre nom rendrait les surcharges par route **silencieusement inertes** |
| Limitation par **utilisateur** | `UserThrottlerGuard` sur les routes sensibles | Derrière un proxy ou du NAT, plusieurs agents partagent une IP : un plafond par IP les pénaliserait mutuellement. La clé est l'identifiant du compte, avec repli sur l'IP si non authentifié |
| Validation des entrées | Liste blanche, **rejet** des champs inconnus, transformation des types | Les champs non déclarés au DTO sont supprimés ; une requête portant un champ inconnu est refusée |
| Filtre d'exceptions global | Structure de réponse unique : `statusCode`, `timestamp`, `path`, `message` | Réponses d'erreur homogènes |
| Taille du corps de requête | **50 Mo** en JSON et en formulaire | Les lots de synchronisation peuvent être volumineux |
| Confiance proxy | `TRUST_PROXY`, défaut : 1 saut | Indispensable derrière un proxy inverse pour lire la vraie IP client — sinon l'audit journalise l'IP du proxy |
| Tâches planifiées | Module d'ordonnancement actif | Purge des tombstones, purge des notifications |

### 5.2 Politique CORS

Origines autorisées : la liste `CORS_ORIGINS` (ou `FRONTEND_URL`, défaut `http://localhost:5173`), **plus** l'origine du client de bureau `app://cms-saris` ajoutée automatiquement, **plus** toute origine `localhost` ou `127.0.0.1` sur n'importe quel port.

> Cette dernière autorisation n'est pas un relâchement : en mode autonome, le frontend d'origine `app://cms-saris` appelle l'API **locale** sur `127.0.0.1` avec un **port dynamique**. Sans elle, le mode hors-ligne ne fonctionnerait pas.
>
> La politique CORS conditionne aussi le flux temps réel : le mécanisme d'événements côté navigateur y est soumis.

### 5.3 Deux intercepteurs globaux

| Intercepteur | Déclencheur | Effet |
|---|---|---|
| **Audit** | Mutation (POST/PATCH/PUT/DELETE) sur un contrôleur portant `@Audit('module', 'Entité')` | Écrit une entrée dans le journal d'audit : auteur, action, module, entité, IP réelle, statut `SUCCES`/`ERREUR`. **Best-effort** : n'altère jamais la requête métier |
| **Rafraîchissement en direct** | Mutation sur un contrôleur portant `@LiveRefresh('LIVE_*')` | Diffuse un événement temps réel **silencieux** : les listes de tous les clients se rafraîchissent instantanément, sans cloche ni son |

Les deux sont enregistrés globalement mais **sans effet** si la route n'est pas annotée ou n'est pas mutante — zéro impact ailleurs. **151 routes** sont auditées, **105** déclenchent un rafraîchissement en direct.

> Règle de conception explicite : **seul cet intercepteur** (et les écritures explicites des services d'administration) écrit dans le journal d'audit. Jamais une route d'écriture directe. C'est ce qui garantit qu'on ne peut pas falsifier l'audit par l'API.

### 5.4 Les 17 modules métier

`Security` · `Referentiels` · `Personnel` · `Patient` · `Triage` · `Consultation` · `BonExamen` · `BonPharmacie` · `Employe` · `SortiesCritiques` · `SuiviTraitement` · `Admin` · `Dashboard` · `Rapports` · `Notification` · `Messagerie` · `Sync`

Plus les modules techniques : configuration, limitation de débit, ordonnancement, accès aux données. Le contrôleur de santé est déclaré directement au module racine.

### 5.5 Utilitaires transverses — sources uniques de vérité

Le code applique systématiquement le principe « un concept, une seule implémentation ». Ces utilitaires doivent apparaître dans le diagramme de composants comme des dépendances partagées.

| Utilitaire | Rôle | Justification inscrite dans le code |
|---|---|---|
| `droits-categorie.ts` | Éligibilité d'une catégorie de patient à une prestation | Règle centrale du recueil de l'existant |
| `prescription.ts` | Droit de prescrire (médecin chef libre, infirmier délégué) | Règle du recueil de l'existant |
| `governance.ts` | 10 permissions « vitales » qu'un administrateur **ne peut pas se retirer** | Sinon plus personne ne pourrait administrer la plateforme — seule issue : intervention SQL hors application |
| `permission-coherence.ts` | Règle « écrire implique consulter », copie serveur | L'API ne peut pas importer de valeur depuis le paquet partagé |
| `clinical.ts` | Calcul de l'indice de masse corporelle | Source unique de la formule, pour qu'un même concept ne soit jamais recalculé de deux façons |
| `repos.ts` | Calcul de la date de reprise après repos | Idem |
| `prisma/search.ts` | Recherche insensible à la casse | L'option existe en PostgreSQL mais **est rejetée par SQLite** : elle n'est injectée que hors SQLite. Sans cela, le backend embarqué planterait sur toute recherche |
| `geo/geo.util.ts` | Ville et coordonnées depuis une IP | Service externe d'abord, **repli hors-ligne** sur une base embarquée ; cache par IP d'une heure. Dérivé à la lecture — aucune colonne dédiée |
| `crypto/message-crypto.ts` | Chiffrement de la messagerie | Format versionné, rotation de clés |
| `crypto/totp-secret.ts` | Chiffrement des secrets de double authentification | La clé maîtresse n'est jamais stockée en clair |
| `soft-delete.extension.ts` | Suppression logique automatique | Détaillé au § 5.6 |
| `consultation-cascade.util.ts` | Cascade de suppression d'une consultation | Partagée entre suppression de consultation et de visite, pour ne jamais faire diverger une logique destructrice |

### 5.6 L'extension de suppression logique — et ses limites assumées

Pour les modèles portant `deletedAt` (47 sur 88) :

| Opération | Comportement |
|---|---|
| `delete` / `deleteMany` | Transformés en mise à jour posant `deletedAt` |
| `findMany`, `findFirst`, `count`, `aggregate`, `groupBy` | Filtre `deletedAt: null` ajouté d'office, sauf filtre explicite |
| `findUnique` | Post-filtré : un enregistrement supprimé devient `null` |

**Limites documentées par le code lui-même** — à citer au chapitre 7, c'est de l'honnêteté technique :

- `upsert`, les compteurs relationnels et les inclusions imbriquées **voient les tombstones** ;
- un `select` qui omet `deletedAt` **défait** le post-filtre de `findUnique` ;
- pour contrôler l'unicité avant création, ou ressusciter un enregistrement supprimé, il faut passer par le client **brut**.

C'est aussi ce que teste la suite `soft-delete-revive` (INV-06 § 4.4).

---

## 6. Écarts et points de vigilance

| # | Constat | Conséquence documentaire |
|---|---|---|
| E-01 | Le décompte réel est de **268 routes**. Une estimation antérieure annonçait 273 : l’écart venait de 5 mentions `@Get(...)` situées **dans des commentaires** de contrôleurs. | Retenir 268 partout dans le mémoire. |
| E-02 | 25 routes sans permission explicite, dont **17 authentifiées sans contrôle de catalogue**. | À décrire honnêtement au chapitre 7 (sécurité) comme un choix de portée « données propres à l’appelant », et non comme un oubli. |
| E-03 | Les permissions multiples sur une même route (`@RequirePermissions(a, b, c)`) fonctionnent en **OU logique**, pas en ET. | Le diagramme de cas d’utilisation ne doit pas présenter ces routes comme exigeant tous les droits simultanément. |
| E-04 | Le préfixe `@Controller()` vide sur certains contrôleurs produit des chemins à la racine. | Vérifier qu’aucune collision de route n’existe (contrôle à faire au chapitre 8). |

---

## 7. Alimente

| Destination | Usage |
|---|---|
| Chapitre 6 § 6.3 et 6.4 | Dérivation des cas d’utilisation et de leur classification par module |
| Chapitre 7 § 7.1 | Architecture technique : § 5 en entier |
| Chapitre 7 § 7.4 | Diagramme de composants : interfaces fournies par l’API |
| Chapitre 8 § 8.2 | Présentation des fonctionnalités développées |
| Matrice de traçabilité | Colonne « route / contrôleur API » |
| UML-CMP-01, UML-SEQO-01/02 | Noms de méthodes réels pour les séquences objets |

