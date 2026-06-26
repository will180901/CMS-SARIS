/**
 * Catalogue de permissions granulaires — CMS SARIS
 *
 * Convention : `module.action`
 *   - module : domaine fonctionnel (patient, visite, consultation…)
 *   - action : opération (read, create, update, delete, …)
 *
 * Toute permission doit être déclarée ici. Le seed crée les enregistrements
 * `Permission` correspondants en BDD. Les rôles reçoivent un sous-ensemble.
 */

// ── Toutes les permissions du système ─────────────────────────────────────────

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_READ:          'dashboard.read',

  // Patient
  PATIENT_READ:            'patient.read',
  PATIENT_CREATE:          'patient.create',
  PATIENT_UPDATE:          'patient.update',
  PATIENT_DELETE:          'patient.delete',
  PATIENT_ARCHIVE:         'patient.archive',
  PATIENT_CHANGE_CATEGORY: 'patient.change_category',
  PATIENT_LOCK:            'patient.lock',
  // Rattachements (CDI / sous-traitants) — partie administrative du dossier,
  // séparée de patient.update pour pouvoir la confier à un autre profil.
  PATIENT_RATTACHEMENT_MANAGE: 'patient.rattachement.manage',

  // Visite / Triage
  VISITE_READ:             'visite.read',
  VISITE_CREATE:           'visite.create',
  VISITE_UPDATE:           'visite.update',
  VISITE_CANCEL:           'visite.cancel',
  VISITE_CLOSE:            'visite.close',
  VISITE_DELETE:           'visite.delete',
  VISITE_ASSIGN:           'visite.assign_soignant',

  // Consultation
  CONSULTATION_READ:       'consultation.read',
  CONSULTATION_CREATE:     'consultation.create',
  CONSULTATION_UPDATE:     'consultation.update',
  CONSULTATION_CLOSE:      'consultation.close',
  CONSULTATION_CANCEL:     'consultation.cancel',
  CONSULTATION_DELETE:     'consultation.delete',
  CONSULTATION_DIAGNOSE:   'consultation.diagnose',
  CONSULTATION_EXAMEN:     'consultation.examen',

  // Ordonnance
  ORDONNANCE_READ:         'ordonnance.read',
  ORDONNANCE_CREATE:       'ordonnance.create',
  ORDONNANCE_VALIDATE:     'ordonnance.validate',
  ORDONNANCE_CANCEL:       'ordonnance.cancel',
  ORDONNANCE_PRINT:        'ordonnance.print',

  // Bon d'examen
  BON_EXAMEN_READ:         'bon_examen.read',
  BON_EXAMEN_CREATE:       'bon_examen.create',
  BON_EXAMEN_VALIDATE:     'bon_examen.validate',
  BON_EXAMEN_CANCEL:       'bon_examen.cancel',
  BON_EXAMEN_DELETE:       'bon_examen.delete',
  BON_EXAMEN_RESULT:       'bon_examen.result',

  // Bon de pharmacie (recueil) — voucher de retrait de médicaments, CDI + ayants droit
  BON_PHARMACIE_READ:      'bon_pharmacie.read',
  BON_PHARMACIE_CREATE:    'bon_pharmacie.create',
  BON_PHARMACIE_DELIVER:   'bon_pharmacie.deliver',
  BON_PHARMACIE_CANCEL:    'bon_pharmacie.cancel',
  BON_PHARMACIE_DELETE:    'bon_pharmacie.delete',

  // Évacuation
  EVACUATION_READ:         'evacuation.read',
  EVACUATION_CREATE:       'evacuation.create',
  EVACUATION_UPDATE:       'evacuation.update',
  EVACUATION_CANCEL:       'evacuation.cancel',
  EVACUATION_CLOSE:        'evacuation.close',
  EVACUATION_DELETE:       'evacuation.delete',

  // Référentiels — lecture globale + écriture GRANULAIRE par service.
  // Cette séparation permet d'accorder la création/édition d'un seul service
  // (ex: motifs) sans donner accès aux autres (sites, médicaments…).
  REFERENTIEL_READ:               'referentiel.read',
  REFERENTIEL_SITE_CREATE:        'referentiel.site.create',
  REFERENTIEL_SITE_UPDATE:        'referentiel.site.update',
  REFERENTIEL_SITE_DELETE:        'referentiel.site.delete',
  REFERENTIEL_MOTIF_CREATE:       'referentiel.motif.create',
  REFERENTIEL_MOTIF_UPDATE:       'referentiel.motif.update',
  REFERENTIEL_MOTIF_DELETE:       'referentiel.motif.delete',
  REFERENTIEL_PATHOLOGIE_CREATE:  'referentiel.pathologie.create',
  REFERENTIEL_PATHOLOGIE_UPDATE:  'referentiel.pathologie.update',
  REFERENTIEL_PATHOLOGIE_DELETE:  'referentiel.pathologie.delete',
  REFERENTIEL_MEDICAMENT_CREATE:  'referentiel.medicament.create',
  REFERENTIEL_MEDICAMENT_UPDATE:  'referentiel.medicament.update',
  REFERENTIEL_MEDICAMENT_DELETE:  'referentiel.medicament.delete',
  REFERENTIEL_CATEGORIE_CREATE:   'referentiel.categorie.create',
  REFERENTIEL_CATEGORIE_UPDATE:   'referentiel.categorie.update',
  REFERENTIEL_CATEGORIE_DELETE:   'referentiel.categorie.delete',
  REFERENTIEL_EXAMEN_CREATE:      'referentiel.examen.create',
  REFERENTIEL_EXAMEN_UPDATE:      'referentiel.examen.update',
  REFERENTIEL_EXAMEN_DELETE:      'referentiel.examen.delete',
  REFERENTIEL_TYPE_CONSULTATION_CREATE: 'referentiel.type_consultation.create',
  REFERENTIEL_TYPE_CONSULTATION_UPDATE: 'referentiel.type_consultation.update',
  REFERENTIEL_TYPE_CONSULTATION_DELETE: 'referentiel.type_consultation.delete',

  // Personnel médical
  PERSONNEL_READ:          'personnel.read',
  PERSONNEL_CREATE:        'personnel.create',
  PERSONNEL_UPDATE:        'personnel.update',
  PERSONNEL_DELETE:        'personnel.delete',

  // Sous-traitants — onglet distinct du personnel médical, permissions dédiées
  SOUS_TRAITANT_READ:      'sous_traitant.read',
  SOUS_TRAITANT_CREATE:    'sous_traitant.create',
  SOUS_TRAITANT_UPDATE:    'sous_traitant.update',
  SOUS_TRAITANT_DELETE:    'sous_traitant.delete',

  // Registre des employés SARIS (main-d'œuvre patiente — CDI/CDD reconnus par matricule)
  EMPLOYE_READ:            'employe.read',
  EMPLOYE_CREATE:          'employe.create',
  EMPLOYE_UPDATE:          'employe.update',
  EMPLOYE_DELETE:          'employe.delete',

  // Délégations
  DELEGATION_READ:         'delegation.read',
  DELEGATION_CREATE:       'delegation.create',
  DELEGATION_UPDATE:       'delegation.update',
  DELEGATION_REVOKE:       'delegation.revoke',
  DELEGATION_DELETE:       'delegation.delete',

  // Utilisateurs (admin)
  UTILISATEUR_READ:        'utilisateur.read',
  UTILISATEUR_CREATE:      'utilisateur.create',
  UTILISATEUR_UPDATE:      'utilisateur.update',
  UTILISATEUR_DELETE:      'utilisateur.delete',
  UTILISATEUR_RESET_PWD:   'utilisateur.reset_password',
  UTILISATEUR_ASSIGN_ROLE: 'utilisateur.assign_role',
  UTILISATEUR_MANAGE_PERMS:'utilisateur.manage_permissions',

  // Rôles & permissions
  ROLE_READ:               'role.read',
  ROLE_CREATE:             'role.create',
  ROLE_UPDATE:             'role.update',
  ROLE_DELETE:             'role.delete',

  // Audit
  AUDIT_READ:              'audit.read',

  // Paramètres système
  PARAMETRE_READ:          'parametre.read',
  PARAMETRE_UPDATE:        'parametre.update',

  // Synchronisation
  SYNCHRONISATION_READ:    'synchronisation.read',
  SYNCHRONISATION_EXECUTE: 'synchronisation.execute',
  SYNCHRONISATION_RESTORE: 'synchronisation.restore',

  // Notifications (CRUD)
  NOTIFICATION_READ:       'notification.read',
  NOTIFICATION_CREATE:     'notification.create',
  NOTIFICATION_UPDATE:     'notification.update',
  NOTIFICATION_DELETE:     'notification.delete',

  // Messagerie interne (CRUD)
  MESSAGERIE_READ:         'messagerie.read',
  MESSAGERIE_CREATE:       'messagerie.create',
  MESSAGERIE_UPDATE:       'messagerie.update',
  MESSAGERIE_DELETE:       'messagerie.delete',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ── Liste plate (pour seed et validation) ─────────────────────────────────────

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS) as PermissionCode[]

// ── Métadonnées des permissions (libellés humains) ───────────────────────────

export const PERMISSION_META: Record<PermissionCode, { libelle: string; module: string }> = {
  // Dashboard
  'dashboard.read':              { libelle: 'Consulter le tableau de bord', module: 'dashboard' },

  // Patient
  'patient.read':                { libelle: 'Consulter les dossiers patient', module: 'patient' },
  'patient.create':              { libelle: 'Créer un dossier patient', module: 'patient' },
  'patient.update':              { libelle: 'Modifier un dossier patient', module: 'patient' },
  'patient.delete':              { libelle: 'Supprimer un dossier patient', module: 'patient' },
  'patient.archive':             { libelle: 'Archiver / réactiver un dossier', module: 'patient' },
  'patient.change_category':     { libelle: 'Changer la catégorie d\'un patient', module: 'patient' },
  'patient.lock':                { libelle: 'Verrouiller / déverrouiller l\'accès à un dossier', module: 'patient' },
  'patient.rattachement.manage': { libelle: 'Gérer les rattachements (CDI / sous-traitants)', module: 'patient' },

  // Visite / Triage
  'visite.read':                 { libelle: 'Consulter les visites de triage', module: 'visite' },
  'visite.create':               { libelle: 'Ouvrir une visite', module: 'visite' },
  'visite.update':               { libelle: 'Modifier une visite', module: 'visite' },
  'visite.cancel':               { libelle: 'Annuler une visite', module: 'visite' },
  'visite.close':                { libelle: 'Clôturer une visite sans consultation', module: 'visite' },
  'visite.delete':               { libelle: 'Supprimer définitivement une visite', module: 'visite' },
  'visite.assign_soignant':      { libelle: 'Assigner un soignant à une visite', module: 'visite' },

  // Consultation
  'consultation.read':           { libelle: 'Consulter les consultations', module: 'consultation' },
  'consultation.create':         { libelle: 'Ouvrir une consultation', module: 'consultation' },
  'consultation.update':         { libelle: 'Modifier une consultation', module: 'consultation' },
  'consultation.close':          { libelle: 'Clôturer une consultation', module: 'consultation' },
  'consultation.cancel':         { libelle: 'Annuler une consultation', module: 'consultation' },
  'consultation.delete':         { libelle: 'Supprimer définitivement une consultation', module: 'consultation' },
  'consultation.diagnose':       { libelle: 'Poser un diagnostic', module: 'consultation' },
  'consultation.examen':         { libelle: 'Saisir l\'examen clinique', module: 'consultation' },

  // Ordonnance
  'ordonnance.read':             { libelle: 'Consulter les ordonnances', module: 'ordonnance' },
  'ordonnance.create':           { libelle: 'Créer une ordonnance', module: 'ordonnance' },
  'ordonnance.validate':         { libelle: 'Valider une ordonnance', module: 'ordonnance' },
  'ordonnance.cancel':           { libelle: 'Annuler une ordonnance validée', module: 'ordonnance' },
  'ordonnance.print':            { libelle: 'Imprimer une ordonnance', module: 'ordonnance' },

  // Bon d'examen
  'bon_examen.read':             { libelle: 'Consulter les bons d\'examen', module: 'bon_examen' },
  'bon_examen.create':           { libelle: 'Créer un bon d\'examen', module: 'bon_examen' },
  'bon_examen.validate':         { libelle: 'Valider un bon d\'examen', module: 'bon_examen' },
  'bon_examen.cancel':           { libelle: 'Annuler un bon d\'examen', module: 'bon_examen' },
  'bon_examen.delete':           { libelle: 'Supprimer définitivement un bon d\'examen', module: 'bon_examen' },
  'bon_examen.result':           { libelle: 'Saisir un résultat d\'examen', module: 'bon_examen' },

  // Bon de pharmacie (recueil)
  'bon_pharmacie.read':          { libelle: 'Consulter les bons de pharmacie', module: 'bon_pharmacie' },
  'bon_pharmacie.create':        { libelle: 'Créer un bon de pharmacie', module: 'bon_pharmacie' },
  'bon_pharmacie.deliver':       { libelle: 'Marquer un bon de pharmacie délivré', module: 'bon_pharmacie' },
  'bon_pharmacie.cancel':        { libelle: 'Annuler un bon de pharmacie', module: 'bon_pharmacie' },
  'bon_pharmacie.delete':        { libelle: 'Supprimer définitivement un bon de pharmacie', module: 'bon_pharmacie' },

  // Évacuation
  'evacuation.read':             { libelle: 'Consulter les évacuations', module: 'evacuation' },
  'evacuation.create':           { libelle: 'Initier une évacuation', module: 'evacuation' },
  'evacuation.update':           { libelle: 'Suivre une évacuation', module: 'evacuation' },
  'evacuation.cancel':           { libelle: 'Annuler une évacuation', module: 'evacuation' },
  'evacuation.close':            { libelle: 'Clôturer une évacuation', module: 'evacuation' },
  'evacuation.delete':           { libelle: 'Supprimer définitivement une évacuation', module: 'evacuation' },

  // Référentiels — lecture globale + écriture par service
  'referentiel.read':                { libelle: 'Consulter les référentiels', module: 'referentiel' },
  'referentiel.site.create':         { libelle: 'Créer un site', module: 'referentiel' },
  'referentiel.site.update':         { libelle: 'Modifier un site', module: 'referentiel' },
  'referentiel.site.delete':         { libelle: 'Désactiver ou supprimer un site', module: 'referentiel' },
  'referentiel.motif.create':        { libelle: 'Créer un motif de consultation', module: 'referentiel' },
  'referentiel.motif.update':        { libelle: 'Modifier un motif de consultation', module: 'referentiel' },
  'referentiel.motif.delete':        { libelle: 'Désactiver ou supprimer un motif', module: 'referentiel' },
  'referentiel.pathologie.create':   { libelle: 'Créer une pathologie', module: 'referentiel' },
  'referentiel.pathologie.update':   { libelle: 'Modifier une pathologie', module: 'referentiel' },
  'referentiel.pathologie.delete':   { libelle: 'Désactiver ou supprimer une pathologie', module: 'referentiel' },
  'referentiel.medicament.create':   { libelle: 'Créer un médicament', module: 'referentiel' },
  'referentiel.medicament.update':   { libelle: 'Modifier un médicament', module: 'referentiel' },
  'referentiel.medicament.delete':   { libelle: 'Désactiver ou supprimer un médicament', module: 'referentiel' },
  'referentiel.categorie.create':    { libelle: 'Créer une catégorie de patient', module: 'referentiel' },
  'referentiel.categorie.update':    { libelle: 'Modifier une catégorie de patient', module: 'referentiel' },
  'referentiel.categorie.delete':    { libelle: 'Désactiver ou supprimer une catégorie', module: 'referentiel' },
  'referentiel.examen.create':       { libelle: 'Créer un type d\'examen', module: 'referentiel' },
  'referentiel.examen.update':       { libelle: 'Modifier un type d\'examen', module: 'referentiel' },
  'referentiel.examen.delete':       { libelle: 'Désactiver ou supprimer un type d\'examen', module: 'referentiel' },
  'referentiel.type_consultation.create': { libelle: 'Créer un type de consultation', module: 'referentiel' },
  'referentiel.type_consultation.update': { libelle: 'Modifier un type de consultation', module: 'referentiel' },
  'referentiel.type_consultation.delete': { libelle: 'Désactiver ou supprimer un type de consultation', module: 'referentiel' },

  // Personnel médical
  'personnel.read':              { libelle: 'Consulter le personnel médical', module: 'personnel' },
  'personnel.create':            { libelle: 'Créer une fiche personnel', module: 'personnel' },
  'personnel.update':            { libelle: 'Modifier une fiche personnel', module: 'personnel' },
  'personnel.delete':            { libelle: 'Désactiver ou supprimer une fiche personnel', module: 'personnel' },

  // Sous-traitants
  'sous_traitant.read':          { libelle: 'Consulter les sociétés sous-traitantes', module: 'sous_traitant' },
  'sous_traitant.create':        { libelle: 'Créer une société sous-traitante', module: 'sous_traitant' },
  'sous_traitant.update':        { libelle: 'Modifier une société sous-traitante', module: 'sous_traitant' },
  'sous_traitant.delete':        { libelle: 'Désactiver ou supprimer une société sous-traitante', module: 'sous_traitant' },

  // Registre des employés SARIS
  'employe.read':                { libelle: 'Consulter le registre des employés SARIS', module: 'employe' },
  'employe.create':              { libelle: 'Enregistrer un employé SARIS', module: 'employe' },
  'employe.update':              { libelle: 'Modifier un employé SARIS', module: 'employe' },
  'employe.delete':              { libelle: 'Supprimer un employé SARIS', module: 'employe' },

  // Délégations
  'delegation.read':             { libelle: 'Consulter les délégations', module: 'delegation' },
  'delegation.create':           { libelle: 'Créer une délégation', module: 'delegation' },
  'delegation.update':           { libelle: 'Modifier une délégation', module: 'delegation' },
  'delegation.revoke':           { libelle: 'Révoquer une délégation', module: 'delegation' },
  'delegation.delete':           { libelle: 'Supprimer définitivement une délégation', module: 'delegation' },

  // Utilisateurs
  'utilisateur.read':            { libelle: 'Consulter les comptes utilisateur', module: 'utilisateur' },
  'utilisateur.create':          { libelle: 'Créer un compte utilisateur', module: 'utilisateur' },
  'utilisateur.update':          { libelle: 'Modifier un compte utilisateur', module: 'utilisateur' },
  'utilisateur.delete':          { libelle: 'Supprimer définitivement un compte utilisateur', module: 'utilisateur' },
  'utilisateur.reset_password':  { libelle: 'Réinitialiser un mot de passe', module: 'utilisateur' },
  'utilisateur.assign_role':     { libelle: 'Attribuer des rôles', module: 'utilisateur' },
  'utilisateur.manage_permissions': { libelle: 'Gérer les dérogations de permissions individuelles', module: 'utilisateur' },

  // Rôles
  'role.read':                   { libelle: 'Consulter les rôles', module: 'role' },
  'role.create':                 { libelle: 'Créer un rôle', module: 'role' },
  'role.update':                 { libelle: 'Modifier un rôle (permissions)', module: 'role' },
  'role.delete':                 { libelle: 'Supprimer un rôle', module: 'role' },

  // Audit
  'audit.read':                  { libelle: 'Consulter les journaux d\'audit', module: 'audit' },

  // Paramètres
  'parametre.read':              { libelle: 'Consulter les paramètres système', module: 'parametre' },
  'parametre.update':            { libelle: 'Modifier les paramètres système', module: 'parametre' },

  // Sync
  'synchronisation.read':        { libelle: 'Consulter l\'état de synchronisation', module: 'synchronisation' },
  'synchronisation.execute':     { libelle: 'Lancer une sauvegarde système', module: 'synchronisation' },
  'synchronisation.restore':     { libelle: 'Restaurer une sauvegarde de configuration', module: 'synchronisation' },

  // Notifications
  'notification.read':           { libelle: 'Consulter ses notifications', module: 'notification' },
  'notification.create':         { libelle: 'Émettre une notification / annonce', module: 'notification' },
  'notification.update':         { libelle: 'Marquer ses notifications comme lues', module: 'notification' },
  'notification.delete':         { libelle: 'Supprimer des notifications', module: 'notification' },

  // Messagerie interne
  'messagerie.read':             { libelle: 'Consulter la messagerie interne', module: 'messagerie' },
  'messagerie.create':           { libelle: 'Envoyer un message', module: 'messagerie' },
  'messagerie.update':           { libelle: 'Modifier un message', module: 'messagerie' },
  'messagerie.delete':           { libelle: 'Supprimer un message', module: 'messagerie' },
}

// ── Affectation par défaut Rôle → Permissions (charte de gouvernance) ─────────

/**
 * Définit qui peut faire quoi par défaut.
 * ADMIN_SYSTEME = super-administrateur : accès complet (gouvernance système +
 * lecture/action clinique). Choix assumé pour ce déploiement — l'admin pilote
 * et supervise l'ensemble de la plateforme.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  // ── ADMIN_SYSTEME : super-administrateur (catalogue complet) ──────────────
  ADMIN_SYSTEME: [...ALL_PERMISSIONS],

  // ── MEDECIN_CHEF : pleins droits cliniques + gouvernance médicale ──────────
  // Le médecin chef EST l'administrateur médical : il cumule l'activité clinique
  // complète ET la gouvernance (référentiels, personnel, sous-traitants, audit).
  MEDECIN_CHEF: [
    'dashboard.read',
    'patient.read', 'patient.create', 'patient.update', 'patient.change_category',
    'patient.rattachement.manage', 'patient.archive', 'patient.lock',
    'visite.read', 'visite.create', 'visite.update', 'visite.assign_soignant',
    'visite.cancel', 'visite.close', 'visite.delete',
    'consultation.read', 'consultation.create', 'consultation.update',
    'consultation.close', 'consultation.cancel', 'consultation.delete',
    'consultation.diagnose', 'consultation.examen',
    'ordonnance.read', 'ordonnance.create', 'ordonnance.validate', 'ordonnance.cancel', 'ordonnance.print',
    'bon_examen.read', 'bon_examen.create', 'bon_examen.validate', 'bon_examen.cancel', 'bon_examen.delete', 'bon_examen.result',
    'bon_pharmacie.read', 'bon_pharmacie.create', 'bon_pharmacie.deliver', 'bon_pharmacie.cancel', 'bon_pharmacie.delete',
    'evacuation.read', 'evacuation.create', 'evacuation.update', 'evacuation.cancel', 'evacuation.close', 'evacuation.delete',
    'delegation.read', 'delegation.create', 'delegation.update', 'delegation.revoke', 'delegation.delete',
    // Gouvernance médicale (anciennement ADMIN_MEDICAL) : contrôle total des référentiels
    'referentiel.read',
    'referentiel.site.create',       'referentiel.site.update',       'referentiel.site.delete',
    'referentiel.motif.create',      'referentiel.motif.update',      'referentiel.motif.delete',
    'referentiel.pathologie.create', 'referentiel.pathologie.update', 'referentiel.pathologie.delete',
    'referentiel.medicament.create', 'referentiel.medicament.update', 'referentiel.medicament.delete',
    'referentiel.categorie.create',  'referentiel.categorie.update',  'referentiel.categorie.delete',
    'referentiel.examen.create',     'referentiel.examen.update',     'referentiel.examen.delete',
    'referentiel.type_consultation.create', 'referentiel.type_consultation.update', 'referentiel.type_consultation.delete',
    // Personnel & sous-traitants (gouvernance RH médicale, anciennement AGENT_RH)
    'personnel.read', 'personnel.create', 'personnel.update', 'personnel.delete',
    'sous_traitant.read', 'sous_traitant.create', 'sous_traitant.update', 'sous_traitant.delete',
    'employe.read', 'employe.create', 'employe.update', 'employe.delete',
    // Audit (anciennement ADMIN_MEDICAL)
    'audit.read',
  ],

  // ── INFIRMIER : triage + consultation DÉLÉGUÉE (recueil §3.2) ──────────────
  INFIRMIER: [
    'dashboard.read',
    'patient.read', 'patient.create', 'patient.update', 'patient.rattachement.manage',
    'visite.read', 'visite.create', 'visite.update',
    'visite.cancel', 'visite.assign_soignant',
    // Consultation : l'infirmier conduit les consultations qui LUI sont attribuées/confiées
    // (recueil §3.2 « réaliser une consultation »). Le cloisonnement (consultation.controller)
    // ne lui montre QUE ses propres consultations (soignantId = lui).
    'consultation.read', 'consultation.create', 'consultation.examen',
    'consultation.diagnose', 'consultation.update', 'consultation.close', 'consultation.cancel',
    'bon_examen.read', 'bon_examen.result',
    // Prescription (recueil) : l'infirmier reçoit les permissions de prescription,
    // mais le SERVICE (assertPeutPrescrire) n'autorise l'acte QUE s'il a une
    // délégation active accordée par le médecin chef. Sans délégation → 403.
    // validate + cancel : indispensables pour que la prescription DÉLÉGUÉE aille
    // au bout — la clôture en décision « Prescription » exige une ordonnance VALIDÉE
    // (le cloisonnement limite l'infirmier à ses propres consultations).
    'ordonnance.read', 'ordonnance.create', 'ordonnance.validate', 'ordonnance.cancel', 'ordonnance.print',
    // L'infirmier gère les documents de SES propres consultations déléguées
    // (créer + annuler ses bons d'examen / de pharmacie en cas d'erreur).
    'bon_examen.create', 'bon_examen.cancel',
    'bon_pharmacie.read', 'bon_pharmacie.create', 'bon_pharmacie.cancel',
    // Registre employés : l'infirmière reconnaît/enregistre les travailleurs SARIS à l'accueil
    'employe.read', 'employe.create',
    // Enrichissement collaboratif : motifs de triage uniquement
    'referentiel.read', 'referentiel.motif.create',
  ],
}

// ── Baseline commun à TOUS les rôles ──────────────────────────────────────────
// Notifications (consulter ses notifs + les marquer lues) et messagerie interne
// (chacun peut lire/écrire/éditer/supprimer SES propres messages). Appliqué à
// chaque rôle existant — y compris les rôles personnalisés créés plus tard via
// le seed/sync. notification.create/delete restent réservés à ADMIN_SYSTEME.
const COMMS_BASELINE: PermissionCode[] = [
  'notification.read', 'notification.update',
  'messagerie.read', 'messagerie.create', 'messagerie.update', 'messagerie.delete',
]
for (const code of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
  const perms = DEFAULT_ROLE_PERMISSIONS[code]!
  for (const p of COMMS_BASELINE) if (!perms.includes(p)) perms.push(p)
}

// ── Catalogue des rôles système (code + libellé) ──────────────────────────────
// Source unique partagée par le seed (création initiale) ET sync-permissions
// (création NON destructive des rôles manquants en base live).
export const ROLE_CATALOG: { code: string; libelle: string }[] = [
  { code: 'ADMIN_SYSTEME', libelle: 'Administrateur Système' },
  { code: 'MEDECIN_CHEF',  libelle: 'Médecin Chef' },
  { code: 'INFIRMIER',     libelle: 'Infirmier' },
]
