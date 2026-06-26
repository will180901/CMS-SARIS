/**
 * Registre des modèles synchronisables (offline-first) : nom Prisma, délégué client,
 * et filtre de SCOPE (ce qu'un poste reçoit/envoie).
 *
 * Politique de scope (décision 2026-06-26 — dossier patient CENTRALISÉ) :
 *  - référentiels partagés          → GLOBAL (aucun filtre)
 *  - DOSSIER PATIENT + PARCOURS DE SOIN → GLOBAL : chaque poste détient TOUS les
 *    patients + tout l'historique clinique de tous les sites. C'est ce qui rend la
 *    continuité cross-site possible MÊME HORS-LIGNE (un travailleur muté est retrouvé
 *    sur n'importe quel poste → zéro doublon). La confidentialité par dossier reste
 *    assurée par le VERROU médecin-chef (patient.verrouille), appliqué côté API y
 *    compris sur le backend local. Cf. [[project_audit_predeploiement]] (Phase A/B).
 *  - PERSONNEL MÉDICAL              → GLOBAL : pour résoudre le soignant des actes
 *    cliniques d'un autre site (affichage « Dr X »).
 *  - COMPTES / RH opérationnel / MESSAGERIE → PAR SITE : { siteId } ou via relation.
 *    Les comptes restent locaux au site (connexion hors-ligne) ; planning/présence/
 *    délégation et messagerie sont propres à chaque site.
 *
 * Scopes par site dérivés des clés étrangères réelles + noms de relations vérifiés
 * dans schema.prisma.
 */

export interface SyncModelDef {
  /** Nom du modèle Prisma (ex. « Patient »). */
  model: string
  /** Nom du délégué du client Prisma (camelCase, ex. « patient »). */
  delegate: string
  /** Filtre Prisma de scope par site ; `() => ({})` pour un référentiel global. */
  scopeWhere: (siteId: string) => Record<string, unknown>
  /** Champs de la clé primaire (défaut `['id']` ; clés composites pour les tables de liaison). */
  idFields: string[]
}

const GLOBAL = (): Record<string, unknown> => ({})
const BY_SITE = (siteId: string): Record<string, unknown> => ({ siteId })
const VIA = (path: (siteId: string) => Record<string, unknown>) => path

function def(
  model: string,
  delegate: string,
  scopeWhere: SyncModelDef['scopeWhere'],
  idFields: string[] = ['id'],
): SyncModelDef {
  return { model, delegate, scopeWhere, idFields }
}

export const SYNC_MODELS: readonly SyncModelDef[] = [
  // ── Référentiels partagés (globaux) ───────────────────────────────────────
  def('Site', 'site', (siteId) => ({ id: siteId })),
  def('CategoriePatient', 'categoriePatient', GLOBAL),
  def('DroitCategoriePatient', 'droitCategoriePatient', GLOBAL),  // droits par catégorie (recueil) — après CategoriePatient (FK)
  def('MotifConsultation', 'motifConsultation', GLOBAL),
  def('PathologieReference', 'pathologieReference', GLOBAL),
  def('MedicamentReference', 'medicamentReference', GLOBAL),
  def('TypeExamen', 'typeExamen', GLOBAL),
  def('EtablissementReference', 'etablissementReference', GLOBAL),
  def('SocieteSousTraitante', 'societeSousTraitante', GLOBAL),
  def('EmployeSaris', 'employeSaris', GLOBAL),  // registre des employés SARIS (main-d'œuvre, partagé inter-sites)
  def('Role', 'role', GLOBAL),
  def('Permission', 'permission', GLOBAL),

  // ── Acteurs / RH ──────────────────────────────────────────────────────────
  // PersonnelMedical = GLOBAL : un acte clinique d'un autre site doit pouvoir
  // afficher son soignant (« Dr X ») sur n'importe quel poste.
  def('PersonnelMedical', 'personnelMedical', GLOBAL),
  // Planning / présence / délégation = opérationnel, propre au site.
  def('PlanningPermutation', 'planningPermutation', BY_SITE),
  def('PresenceJournaliere', 'presenceJournaliere', BY_SITE),
  def('DelegationPrescription', 'delegationPrescription', VIA((s) => ({ medecinChef: { siteId: s } }))),

  // ── Comptes & habilitations (AVANT les entités qui les référencent : createdBy…) ──
  // Indispensable aussi à la connexion HORS-LIGNE (les comptes vivent en local).
  def('Utilisateur', 'utilisateur', BY_SITE),
  def('RolePermission', 'rolePermission', GLOBAL, ['roleId', 'permissionId']),
  def('UtilisateurRole', 'utilisateurRole', VIA((s) => ({ utilisateur: { siteId: s } })), ['utilisateurId', 'roleId']),
  def('UtilisateurPermission', 'utilisateurPermission', VIA((s) => ({ utilisateur: { siteId: s } }))),

  // ── Patients & dossier — GLOBAL (dossier centralisé, continuité cross-site) ─
  // Chaque poste détient tous les patients + tout le dossier, même hors-ligne.
  def('Patient', 'patient', GLOBAL),
  def('IdentitePatient', 'identitePatient', GLOBAL),
  def('ContactUrgence', 'contactUrgence', GLOBAL),
  def('DonneesEmploi', 'donneesEmploi', GLOBAL),
  def('ModeViePatient', 'modeViePatient', GLOBAL),
  def('AllergiePatient', 'allergiePatient', GLOBAL),
  def('AntecedentPatient', 'antecedentPatient', GLOBAL),
  def('AlerteMedicale', 'alerteMedicale', GLOBAL),
  def('PreSaisieMedicale', 'preSaisieMedicale', GLOBAL),
  def('SuiviGrossesse', 'suiviGrossesse', GLOBAL),
  def('SuiviChronique', 'suiviChronique', GLOBAL),
  def('RattachementAyantDroitCdi', 'rattachementAyantDroitCdi', GLOBAL),
  def('RattachementSousTraitant', 'rattachementSousTraitant', GLOBAL),

  // ── Parcours de soin — GLOBAL (suit le patient, tous sites) ────────────────
  def('Visite', 'visite', GLOBAL),
  def('ConstanteVitale', 'constanteVitale', GLOBAL),
  def('Consultation', 'consultation', GLOBAL),
  def('DiagnosticConsultation', 'diagnosticConsultation', GLOBAL),
  def('Ordonnance', 'ordonnance', GLOBAL),
  def('LigneOrdonnance', 'ligneOrdonnance', GLOBAL),
  def('BonExamen', 'bonExamen', GLOBAL),
  def('LigneExamen', 'ligneExamen', GLOBAL),
  def('ResultatExamen', 'resultatExamen', GLOBAL),
  def('BonPharmacie', 'bonPharmacie', GLOBAL),
  def('LigneBonPharmacie', 'ligneBonPharmacie', GLOBAL),
  def('ConsultationPrenatale', 'consultationPrenatale', GLOBAL),
  def('Evacuation', 'evacuation', GLOBAL),

  // ── Messagerie (scope site via conversation) ──────────────────────────────
  def('Conversation', 'conversation', BY_SITE),
  def('ConversationParticipant', 'conversationParticipant', VIA((s) => ({ conversation: { siteId: s } }))),
  def('Message', 'message', VIA((s) => ({ conversation: { siteId: s } }))),
  def('MessageReaction', 'messageReaction', VIA((s) => ({ message: { conversation: { siteId: s } } }))),
  def('MessageMasque', 'messageMasque', VIA((s) => ({ message: { conversation: { siteId: s } } }))),
  def('MessagePieceJointe', 'messagePieceJointe', VIA((s) => ({ message: { conversation: { siteId: s } } }))),
]

export const SYNC_MODEL_BY_NAME: ReadonlyMap<string, SyncModelDef> = new Map(
  SYNC_MODELS.map((d) => [d.model, d]),
)
