import { useEffect, useState }  from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation }       from 'react-i18next'
import {
  ArrowLeft, Users, AlertTriangle, MoreVertical, Archive, RotateCcw, Printer, Activity, Trash2, Lock, Unlock,
  LayoutGrid, Stethoscope, GitCommitVertical, Building2, History, ShieldAlert, ChevronDown, ChevronUp, ChevronRight,
} from 'lucide-react'
import { Button }              from '@workspace/ui/components/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { usePermissions }      from '@/hooks/usePermissions'
import { useIsCompact }        from '@/hooks/useMediaQuery'
import { usePersistedState }   from '@/hooks/usePersistedState'
import { usePatientDossier, useUpdateStatutPatient, usePatientAlertesCliniques, useDeletePatient, useSetVerrouPatient, usePatientCouverture, usePatientAyantsDroits, usePatientSuivi } from '../hooks/usePatients'
import { useSessionStore } from '@/stores/session.store'
import { ConfirmDeleteModal }  from '../components/dossier/ConfirmDeleteModal'
import { CategorieBadge, PatientAvatar } from '../components/CategorieBadge'
import { IdentiteTab }         from '../components/dossier/IdentiteTab'
import { AlertesTab }          from '../components/dossier/AlertesTab'
import { AntecedentsTab }      from '../components/dossier/AntecedentsTab'
import { RattementsTab }       from '../components/dossier/RattementsTab'
import { DocumentsTab }        from '../components/dossier/DocumentsTab'
import { VisitesTab }          from '../components/dossier/VisitesTab'
import { ConsultationsTab }    from '../components/dossier/ConsultationsTab'
import {
  SuiviTraitementTab, ConstantesTab, PathologiesChroniquesTab, TraitementsTab, ResultatsExamensTab,
} from '../components/dossier/SuiviTraitementTab'
import { HistoriqueCategorieTab } from '../components/dossier/HistoriqueCategorieTab'
import { ChangerCategorieModal } from '../components/ChangerCategorieModal'
import { DossierPrintModal }     from '../components/dossier/DossierPrintModal'
import { SegmentedTabs, Modal, Textarea } from '@/components/saris'
import type { PatientDossier } from '@cms-saris/types'
import { calcAge } from '@/lib/age'
import { formatDate } from '@/lib/intl'

// Les droits d'écriture sont désormais portés par les permissions granulaires.

// ── Sections ──────────────────────────────────────────────────────────────────
// 4 groupes, DEUX niveaux d'onglets au plus (étape 5.2) — rangés par nature :
//   Dossier médical   — ce que le patient A : antécédents, pathologies chroniques,
//                       constantes, documents générés ;
//   Parcours de soins — ce qui a été FAIT : visites, consultations, épisodes de suivi,
//                       traitements, résultats d'examens ;
//   Administratif     — rattachements ET historique de catégorie.
// Pathologies chroniques, Constantes, Traitements et Résultats formaient avant un 3e
// niveau d'onglets dans « Suivi de traitement » ; le contenu est inchangé.
// Libellés via clés i18n (résolues dans le composant, jamais au niveau module).
const SECTIONS = [
  {
    key: 'apercu', labelKey: 'patients.sectionOverview', icon: LayoutGrid,
    subTabs: [
      { key: 'identite', labelKey: 'patients.tabIdentity' },
      { key: 'alertes',  labelKey: 'patients.tabAlerts' },
    ],
  },
  {
    key: 'medical', labelKey: 'patients.sectionMedicalDossier', icon: Stethoscope,
    subTabs: [
      { key: 'antecedents', labelKey: 'patients.tabHistory', clinicalOnly: true },
      { key: 'chroniques',  labelKey: 'suiviTraitement.subTabChroniques', clinicalOnly: true },
      { key: 'constantes',  labelKey: 'suiviTraitement.subTabConstantes', clinicalOnly: true },
      { key: 'documents',   labelKey: 'patients.tabDocuments', clinicalOnly: true },
    ],
  },
  {
    key: 'parcours', labelKey: 'patients.sectionCareJourney', icon: GitCommitVertical,
    subTabs: [
      { key: 'visites',         labelKey: 'patients.tabVisites',        clinicalOnly: true },
      { key: 'consultations',   labelKey: 'patients.tabConsultations',  clinicalOnly: true },
      { key: 'suiviTraitement', labelKey: 'patients.tabSuiviTraitement', clinicalOnly: true },
      { key: 'traitements',     labelKey: 'patients.tabTraitements',     clinicalOnly: true },
      { key: 'resultats',       labelKey: 'suiviTraitement.subTabResultats', clinicalOnly: true },
    ],
  },
  {
    key: 'administratif', labelKey: 'patients.sectionAdmin', icon: Building2,
    subTabs: [
      { key: 'rattachements',       labelKey: 'patients.tabAttachments', requiresRattachement: true },
      { key: 'historiqueCategorie', labelKey: 'patients.tabCategoryHistory' },
    ],
  },
] as const
type SectionKey = typeof SECTIONS[number]['key']
type SubTabKey  = typeof SECTIONS[number]['subTabs'][number]['key']

// ── Sidebar patient ───────────────────────────────────────────────────────────

/** « Catégorie gardée, droits suspendus » (décision utilisateur) : la catégorie seule
 *  ne dit plus la vérité sur la prise en charge, on l'écrit juste en dessous. */
function DroitsSuspendus({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const { data } = usePatientCouverture(patientId)
  if (!data?.suspension) return null
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'flex-start', gap: 6, width: '100%', boxSizing: 'border-box',
      padding: '7px 10px', borderRadius: 8,
      background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)',
    }}>
      <AlertTriangle size={13} style={{ color: 'var(--avert-texte)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--avert-texte)' }}>{t('patients.droitsSuspendus')}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--avert-texte)', lineHeight: 1.4 }}>
          {t(`patients.suspension_${data.suspension.motif}`)}
        </p>
      </div>
    </div>
  )
}

// Gravités : mêmes jetons et mêmes libellés que l'onglet Alertes (AlertesTab).
const TON_ALLERGIE: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  SEVERE: { bg: 'var(--erreur-fond)', text: 'var(--erreur-texte)', border: 'var(--erreur-bordure)', labelKey: 'patients.graviteLabelSevere' },
  MODERE: { bg: 'var(--avert-fond)',  text: 'var(--avert-texte)',  border: 'var(--avert-bordure)',  labelKey: 'patients.graviteLabelModere' },
  FAIBLE: { bg: 'var(--succes-fond)', text: 'var(--succes-texte)', border: 'var(--succes-bordure)', labelKey: 'patients.graviteLabelFaible' },
}
const TON_ALERTE: Record<string, { bg: string; text: string; border: string; labelKey: string }> = {
  CRITIQUE:  { bg: 'var(--erreur-fond)', text: 'var(--erreur-texte)', border: 'var(--erreur-bordure)', labelKey: 'patients.graviteLabelCritique' },
  IMPORTANT: { bg: 'var(--avert-fond)',  text: 'var(--avert-texte)',  border: 'var(--avert-bordure)',  labelKey: 'patients.graviteLabelImportant' },
  INFO:      { bg: 'var(--info-fond)',   text: 'var(--info-texte)',   border: 'var(--info-bordure)',   labelKey: 'patients.graviteLabelInfo' },
}
// Types d'antécédent : mêmes libellés que l'onglet Antécédents (AntecedentsTab).
const TYPE_ANTECEDENT_LABEL: Record<string, string> = {
  MEDICAL: 'patients.antecedentMedical', CHIRURGICAL: 'patients.antecedentSurgical',
  FAMILIAL: 'patients.antecedentFamilial', GYNECO_OBSTETRICAL: 'patients.antecedentGyneco',
  AUTRE: 'patients.antecedentOther',
}
const RESUME_MAX = 3

/**
 * Résumé médical de la colonne : les NOMS, pas des compteurs. « Allergies actives 1 »
 * obligeait à ouvrir un onglet pour savoir à QUOI le patient est allergique ; ici on le
 * lit depuis n'importe quel onglet. Chaque groupe ouvre son onglet ; au-delà de trois
 * éléments, « +N de plus » y mène aussi.
 */
function ResumeGroupe({ titre, total, vide, onOuvrir, children }: {
  titre: string; total: number; vide: string; onOuvrir: () => void; children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <button
        type="button"
        onClick={onOuvrir}
        aria-label={t('patients.sidebarOpenTab', { onglet: titre })}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: 0,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          fontSize: 12, fontWeight: 600, color: 'var(--texte-secondaire)',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{titre}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--texte-tertiaire)' }}>{total}</span>
        <ChevronRight size={12} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
      </button>
      {total === 0
        ? <p style={{ margin: 0, fontSize: 11.5, color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>{vide}</p>
        : children}
      {total > RESUME_MAX && (
        <button type="button" onClick={onOuvrir} style={{ alignSelf: 'flex-start', padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--ap-600)' }}>
          {t('patients.sidebarMore', { count: total - RESUME_MAX })}
        </button>
      )}
    </div>
  )
}

function ResumeLigne({ texte, etiquette }: { texte: string; etiquette?: { libelle: string; bg: string; text: string; border: string } | string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12 }}>
      <span title={texte} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--texte-primaire)' }}>
        {texte}
      </span>
      {typeof etiquette === 'string' ? (
        <span style={{ flexShrink: 0, fontSize: 10.5, color: 'var(--texte-tertiaire)' }}>{etiquette}</span>
      ) : etiquette ? (
        <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: etiquette.bg, color: etiquette.text, border: `1px solid ${etiquette.border}` }}>
          {etiquette.libelle}
        </span>
      ) : null}
    </div>
  )
}

function DossierSidebar({ dossier, onChangerCategorie, canChangerCategorie, onOuvrir, canViewClinique, compact, locked }: {
  dossier: PatientDossier
  onChangerCategorie: () => void
  /** `patient.change_category` — le bouton était affiché à tous, même à qui le serveur refuse. */
  canChangerCategorie: boolean
  onOuvrir: (section: SectionKey, sousOnglet: SubTabKey) => void
  /** consultation.read — les antécédents sont des données cliniques (non envoyées sinon). */
  canViewClinique: boolean
  compact?: boolean
  locked?: boolean
}) {
  const { t } = useTranslation()
  const id  = dossier.identite
  const allergiesActives    = dossier.allergies.filter(a => a.statut === 'ACTIVE')
  const alertesMedActives   = dossier.alertesMedicales.filter(a => a.statut === 'ACTIVE')
  const antecedentsActifs   = dossier.antecedents.filter(a => a.statut === 'ACTIF')

  return (
    <aside style={{
      width:        compact ? '100%' : '268px',
      flexShrink:   0,
      overflowY:    compact ? 'visible' : 'auto',
      borderRight:  compact ? 'none' : '1px solid var(--bordure-legere)',
      borderBottom: compact ? '1px solid var(--bordure-legere)' : undefined,
      padding:      '20px',
      display:      'flex',
      flexDirection: 'column',
      gap:          '18px',
      background:   'var(--fond-surface)',
    }}>
      {/* Avatar + identité */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--bordure-legere)' }}>
        {id ? (
          <PatientAvatar nom={id.nom} prenom={id.prenom} code={dossier.categoriePatient.code} photoUrl={id.photoUrl} size={56} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--fond-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} style={{ color: 'var(--texte-tertiaire)' }} />
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--texte-primaire)', margin: 0 }}>
            {id ? `${id.prenom} ${id.nom}` : '—'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: '3px 0 0', fontFamily: 'monospace' }}>
            {dossier.numeroPatient}
          </p>
          {id && (
            <p style={{ fontSize: '12px', color: 'var(--texte-secondaire)', margin: '2px 0 0' }}>
              {/* Un « — » seul ne disait pas ce qui manquait : on le nomme. */}
              {id.dateNaissance ? t('patients.infoYears', { count: calcAge(id.dateNaissance) }) : t('patients.ageNonRenseigne')}
              {' · '}
              {id.sexe === 'M' ? t('patients.sexMale') : id.sexe === 'F' ? t('patients.sexFemale') : t('patients.sexeNonRenseigne')}
            </p>
          )}
        </div>
        <CategorieBadge code={dossier.categoriePatient.code} libelle={dossier.categoriePatient.libelle} />
        <DroitsSuspendus patientId={dossier.id} />
      </div>

      {/* Site + Statut */}
      <SidebarSection title={t('patients.sectionAssignment')}>
        <SidebarRow label={t('patients.sidebarSite')} value={dossier.siteCreation.libelle.replace('Centre Médico-Social ', '')} />
        <SidebarRow label={t('patients.sidebarStatus')} value={
          dossier.statut === 'ACTIF'   ? t('patients.statusActiveValue')    :
          dossier.statut === 'ARCHIVE' ? t('patients.statusArchivedValue')  :
          dossier.statut === 'DECEDE'  ? t('patients.statusDeceasedValue')  : dossier.statut
        } />
      </SidebarSection>

      {/* Le contact d'urgence n'est plus répété ici : l'onglet Identité (ouvert par
          défaut) l'affiche déjà, juste à côté — il apparaissait deux fois sur le même écran. */}

      {/* Compteurs rapides */}
      <SidebarSection title={t('patients.sectionMedicalRecord')}>
        {/* Sous verrou, le serveur renvoie des listes VIDES (rien ne fuit) : les compter
            afficherait « Allergies actives 0 », qu'un soignant lit comme « aucune allergie ».
            On dit ce qui est vrai : le contenu existe peut-etre, il est masque. */}
        {locked ? (
          <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: 0, display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.4 }}>
            <Lock size={12} style={{ flexShrink: 0 }} /> {t('patients.sidebarLockedContent')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ResumeGroupe
              titre={t('patients.counterActiveAllergies')} total={allergiesActives.length}
              vide={t('patients.sidebarNothingRecorded')} onOuvrir={() => onOuvrir('apercu', 'alertes')}
            >
              {[...allergiesActives]
                .sort((a, b) => ['SEVERE', 'MODERE', 'FAIBLE'].indexOf(a.gravite) - ['SEVERE', 'MODERE', 'FAIBLE'].indexOf(b.gravite))
                .slice(0, RESUME_MAX)
                .map(a => {
                  const ton = TON_ALLERGIE[a.gravite]
                  return <ResumeLigne key={a.id} texte={a.substance} etiquette={ton ? { ...ton, libelle: t(ton.labelKey) } : undefined} />
                })}
            </ResumeGroupe>
            <ResumeGroupe
              titre={t('patients.counterMedicalAlerts')} total={alertesMedActives.length}
              vide={t('patients.sidebarNothingRecorded')} onOuvrir={() => onOuvrir('apercu', 'alertes')}
            >
              {[...alertesMedActives]
                .sort((a, b) => ['CRITIQUE', 'IMPORTANT', 'INFO'].indexOf(a.gravite) - ['CRITIQUE', 'IMPORTANT', 'INFO'].indexOf(b.gravite))
                .slice(0, RESUME_MAX)
                .map(a => {
                  const ton = TON_ALERTE[a.gravite]
                  return <ResumeLigne key={a.id} texte={a.message} etiquette={ton ? { ...ton, libelle: t(ton.labelKey) } : undefined} />
                })}
            </ResumeGroupe>
            {canViewClinique && (
            <ResumeGroupe
              titre={t('patients.counterAntecedents')} total={antecedentsActifs.length}
              vide={t('patients.sidebarNothingRecorded')} onOuvrir={() => onOuvrir('medical', 'antecedents')}
            >
              {antecedentsActifs.slice(0, RESUME_MAX).map(a => (
                <ResumeLigne
                  key={a.id}
                  texte={a.pathologie?.libelle ?? a.description}
                  etiquette={t(TYPE_ANTECEDENT_LABEL[a.type] ?? 'patients.antecedentOther')}
                />
              ))}
            </ResumeGroupe>
            )}
          </div>
        )}
      </SidebarSection>

      {/* Rattachements — des NOMS, et dans le bon sens. Avant : « Ayants droit CDI 1 »
          sur le dossier d'un ayant droit (c'est LUI qui l'est), rien sur celui d'un CDI qui
          en a, et « Sous-traitant 1 » sans jamais nommer la société. */}
      <RattachementsResume dossier={dossier} />

      {/* Actions — même garde que l'entrée du menu « ⋮ » : sans `patient.change_category`,
          le bouton ouvrait un formulaire que le serveur refusait ensuite. */}
      {canChangerCategorie && (
        <div style={{ marginTop: 'auto' }}>
          <button
            onClick={onChangerCategorie}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', cursor: 'pointer', textAlign: 'left' }}
          >
            {t('patients.changeCategory')}
          </button>
        </div>
      )}
    </aside>
  )
}

/** En vigueur = statut ACTIF et date de fin non dépassée. */
function enVigueur(r: { statut: string; dateFin: string | null }, maintenant: number) {
  return r.statut === 'ACTIF' && (!r.dateFin || new Date(r.dateFin).getTime() > maintenant)
}

function RattachementsResume({ dossier }: { dossier: PatientDossier }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [maintenant] = useState(() => Date.now())
  const code = dossier.categoriePatient.code
  const estCdi = code === 'ASSURE_CDI'
  const { data: tousDependants = [] } = usePatientAyantsDroits(dossier.id, estCdi)
  // La colonne ne montre que les liens EN VIGUEUR ; l'historique est dans l'onglet.
  const dependants = tousDependants.filter(l => enVigueur(l, maintenant))
  const rattAD = dossier.rattachementsAD.filter(r => enVigueur(r, maintenant))
  const rattST = dossier.rattachementsST.filter(r => enVigueur(r, maintenant))
  const LIEN: Record<string, string> = { CONJOINT: t('patients.relLabelConjoint'), ENFANT: t('patients.relLabelEnfant'), PARENT: t('patients.relLabelParent'), AUTRE: t('patients.relLabelAutre') }

  const lignes: { cle: string; texte: string; detail?: string; vers?: string | null }[] = [
    // Ayant droit : le CDI dont il dépend.
    ...rattAD.map(r => ({
      cle: r.id,
      texte: r.cdi ? `${r.cdi.prenom} ${r.cdi.nom}` : t('patients.attachCdiUnknown'),
      detail: LIEN[r.typeLien] ?? r.typeLien,
      vers: r.cdi?.patientId ?? null,
    })),
    // CDI : ses ayants droit.
    ...(estCdi ? dependants.map(l => ({
      cle: l.id,
      texte: l.patient.identite ? `${l.patient.identite.prenom} ${l.patient.identite.nom}` : l.patient.numeroPatient,
      detail: LIEN[l.typeLien] ?? l.typeLien,
      vers: l.patient.id,
    })) : []),
    // Sous-traitant : la société.
    ...rattST.map(r => ({
      cle: r.id,
      texte: r.societe.nom,
      detail: t('patients.attachSince', { date: formatDate(r.dateDebut) }),
      vers: null,
    })),
  ]
  if (lignes.length === 0) return null
  const titre = rattAD.length > 0
    ? t('patients.sidebarAyantDroitDe')
    : estCdi
      ? t('patients.sidebarSesAyantsDroit')
      : t('patients.sidebarSociete')

  return (
    <SidebarSection title={titre}>
      {lignes.slice(0, 5).map(l => (
        <div key={l.cle} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12 }}>
          {l.vers ? (
            <button
              type="button"
              onClick={() => navigate(`/patients/${l.vers}`)}
              title={t('patients.openRecord')}
              style={{ flex: 1, minWidth: 0, padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--ap-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {l.texte}
            </button>
          ) : (
            <span style={{ flex: 1, minWidth: 0, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.texte}</span>
          )}
          {l.detail && <span style={{ flexShrink: 0, fontSize: 10.5, color: 'var(--texte-tertiaire)' }}>{l.detail}</span>}
        </div>
      ))}
      {lignes.length > 5 && (
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--texte-tertiaire)' }}>{t('patients.sidebarMore', { count: lignes.length - 5 })}</p>
      )}
    </SidebarSection>
  )
}

function SidebarSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
        {icon}
        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)' }}>
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {children}
      </div>
    </div>
  )
}

function SidebarRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
      <span style={{ color: 'var(--texte-tertiaire)' }}>{label}</span>
      <span style={{ fontWeight: '500', color: 'var(--texte-primaire)' }}>{value}</span>
    </div>
  )
}

// ── Sécurité clinique : UN bloc pour tout ce qui doit être vu avant d'agir ─────────
//
// Remplace deux bandeaux empilés (« Informations critiques » + « Alertes cliniques
// détectées ») qui occupaient ~230 px en tête de CHAQUE onglet : le contenu commençait
// à mi-écran. Ici, rien n'est retiré — tout reste visible d'un coup d'œil sous forme de
// pastilles (allergies sévères et alertes critiques en rouge, alertes calculées dans leur
// couleur de gravité, historique en ton neutre) — et le détail complet (phrase, date,
// ancienneté) s'ouvre d'un clic. L'état ouvert/fermé est retenu.

type Ton = { bg: string; border: string; text: string; dot: string }
const TON_GRAVITE: Record<'CRITIQUE' | 'ELEVE' | 'MODERE', Ton> = {
  CRITIQUE: { bg: 'var(--erreur-fond)', border: 'var(--erreur-bordure)', text: 'var(--erreur-texte)', dot: 'var(--erreur-accent)' },
  ELEVE:    { bg: 'var(--avert-fond)',  border: 'var(--avert-bordure)',  text: 'var(--avert-texte)',  dot: 'var(--avert-texte)' },
  MODERE:   { bg: 'var(--info-fond)',   border: 'var(--info-bordure)',   text: 'var(--info-texte)',   dot: 'var(--info-texte)' },
}
// Ton NEUTRE de l'historique : la donnée est toujours vraie, mais elle n'est plus
// d'actualité. La peindre en rouge la ferait lire comme un danger présent.
// Libellé du type d'une alerte saisie (mêmes clés que l'onglet Alertes).
const TYPE_ALERTE_CLE: Record<string, string> = {
  ALLERGIE: 'patients.alertTypeAllergie', PATHOLOGIE_CHRONIQUE: 'patients.alertTypePathologie',
  CONTRE_INDICATION: 'patients.alertTypeContreIndication', SURVEILLANCE: 'patients.alertTypeSurveillance', AUTRE: 'patients.alertTypeAutre',
}
const TON_NEUTRE: Ton = { bg: 'var(--fond-surface-2)', border: 'var(--bordure-legere)', text: 'var(--texte-secondaire)', dot: 'var(--texte-tertiaire)' }

function Pastille({ ton, icone, children, fort }: { ton: Ton; icone?: React.ReactNode; children: React.ReactNode; fort?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%',
      fontSize: 12, fontWeight: fort ? 600 : 500, lineHeight: 1.3,
      padding: '3px 9px', borderRadius: 99,
      background: fort ? 'var(--fond-surface)' : ton.bg, color: ton.text, border: `1px solid ${ton.border}`,
    }}>
      {icone}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </span>
  )
}

function SecuriteClinique({ dossier, alertesActives }: { dossier: PatientDossier; alertesActives: boolean }) {
  const { t } = useTranslation()
  const { data: alertes = [], isError: alertesEnErreur, refetch: recalculer } = usePatientAlertesCliniques(dossier.id, alertesActives)
  const [ouvert, setOuvert] = usePersistedState<boolean>('dossier', 'securiteDetails', false)
  // Instant figé au montage : appeler Date.now() à chaque rendu rendrait le composant
  // impur (React peut re-rendre à tout moment) et l'ancienneté bougerait toute seule.
  const [maintenant] = useState(() => Date.now())

  const severes     = dossier.allergies.filter(a => a.statut === 'ACTIVE' && a.gravite === 'SEVERE')
  const critiques   = dossier.alertesMedicales.filter(a => a.statut === 'ACTIVE' && a.gravite === 'CRITIQUE')
  const calculees   = alertesActives ? alertes : []
  const actuelles   = calculees.filter(a => a.portee !== 'HISTORIQUE')
  const historiques = calculees.filter(a => a.portee === 'HISTORIQUE')
  // Un échec du calcul donnait le même écran qu'« aucune alerte » : on le dit.
  const echecCalcul = alertesActives && alertesEnErreur
  if (severes.length + critiques.length + calculees.length === 0 && !echecCalcul) return null

  // Le bloc entier passe au rouge dès qu'un danger PRÉSENT existe : c'est le signal fort
  // que portait l'ancien bandeau « Informations critiques », conservé tel quel.
  const danger = severes.length + critiques.length + actuelles.filter(a => a.gravite === 'CRITIQUE').length > 0
  // Constat 5 : une alerte saisie au dossier était réduite à son message — sans type,
  // sans gravité écrite, sans date. Le détail couvre désormais aussi ces saisies.
  const aDuDetail = severes.length + critiques.length + calculees.length > 0
  const typeAlerte = (type: string) => t(TYPE_ALERTE_CLE[type] ?? 'patients.alertTypeAutre')

  const anciennete = (iso: string) => {
    const jours = Math.floor((maintenant - new Date(iso).getTime()) / 86_400_000)
    return jours <= 0 ? t('patients.alertToday') : t('patients.alertDaysAgo', { count: jours })
  }

  const ligne = (a: (typeof alertes)[number], i: number, c: Ton) => (
    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', borderRadius: 6, background: c.bg, border: `1px solid ${c.border}` }}>
      <AlertTriangle size={13} style={{ color: c.dot, flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0, fontSize: 12, lineHeight: 1.45 }}>
        <span style={{ fontWeight: 700, color: c.text }}>{a.titre}</span>
        <span style={{ color: 'var(--texte-secondaire)' }}> — {a.detail}</span>
        {/* La date fait partie de l'alerte : sans elle, on ne sait pas si elle est vraie aujourd'hui. */}
        {a.date && (
          <span style={{ color: 'var(--texte-tertiaire)' }}>
            {' · '}{t(`patients.alertDate_${a.type}`, { date: formatDate(a.date) })}, {anciennete(a.date)}
          </span>
        )}
      </div>
    </div>
  )

  const sousTitre = { fontSize: 11, fontWeight: 700, margin: 0, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }

  return (
    <section
      aria-label={t('patients.securiteClinique')}
      style={{
        margin: '16px 24px 0', borderRadius: 'var(--radius-md)',
        background: danger ? 'var(--erreur-fond)' : 'var(--fond-surface)',
        border: `1px solid ${danger ? 'var(--erreur-bordure)' : 'var(--bordure-legere)'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: danger ? 'var(--erreur-texte)' : 'var(--texte-secondaire)',
        }}>
          <ShieldAlert size={14} style={{ color: danger ? 'var(--erreur-accent)' : 'var(--ap-600)' }} />
          {t('patients.securiteClinique')}
        </span>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0 }}>
          {severes.map(a => (
            <Pastille key={a.id} ton={TON_GRAVITE.CRITIQUE} fort>{t('patients.bannerAllergyPrefix', { substance: a.substance })}</Pastille>
          ))}
          {critiques.map(a => (
            <Pastille key={a.id} ton={TON_GRAVITE.CRITIQUE} fort>{typeAlerte(a.type)} : {a.message}</Pastille>
          ))}
          {actuelles.map((a, i) => (
            <Pastille key={`c${i}`} ton={TON_GRAVITE[a.gravite]} fort={danger}>
              {a.titre}{a.sujet ? ` · ${a.sujet}` : ''}
            </Pastille>
          ))}
          {historiques.length > 0 && (
            <Pastille ton={TON_NEUTRE} icone={<History size={11} />}>
              {t('patients.securiteHistorique', { count: historiques.length })}
            </Pastille>
          )}
          {echecCalcul && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Pastille ton={TON_GRAVITE.ELEVE} icone={<AlertTriangle size={11} />}>{t('patients.securiteEchecCalcul')}</Pastille>
              <button type="button" onClick={() => recalculer()} style={{ fontSize: 12, fontWeight: 600, padding: '2px 6px', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--ap-600)' }}>
                {t('patients.securiteReessayer')}
              </button>
            </span>
          )}
        </div>

        {aDuDetail && (
          <button
            type="button"
            onClick={() => setOuvert(!ouvert)}
            aria-expanded={ouvert}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 'auto',
              fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: danger ? 'var(--erreur-texte)' : 'var(--ap-600)',
            }}
          >
            {ouvert ? t('patients.securiteMasquer') : t('patients.securiteDetails')}
            {ouvert ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {ouvert && aDuDetail && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px 12px',
          borderTop: `1px solid ${danger ? 'var(--erreur-bordure)' : 'var(--bordure-legere)'}`,
          background: 'var(--fond-surface)', borderRadius: '0 0 var(--radius-md) var(--radius-md)',
        }}>
          {severes.length + critiques.length > 0 && (
            <>
              <p style={{ ...sousTitre, color: 'var(--texte-secondaire)' }}>
                <ShieldAlert size={12} style={{ color: 'var(--erreur-accent)' }} /> {t('patients.securiteSaisies', { count: severes.length + critiques.length })}
              </p>
              {severes.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', borderRadius: 6, background: TON_GRAVITE.CRITIQUE.bg, border: `1px solid ${TON_GRAVITE.CRITIQUE.border}` }}>
                  <AlertTriangle size={13} style={{ color: TON_GRAVITE.CRITIQUE.dot, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ minWidth: 0, fontSize: 12, lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 700, color: TON_GRAVITE.CRITIQUE.text }}>{t('patients.alertTypeAllergie')} · {t('patients.graviteLabelSevere')}</span>
                    <span style={{ color: 'var(--texte-secondaire)' }}> — {a.substance}</span>
                    <span style={{ color: 'var(--texte-tertiaire)' }}>{' · '}{t('patients.securiteSignaleeLe', { date: formatDate(a.createdAt) })}, {anciennete(a.createdAt)}</span>
                  </div>
                </div>
              ))}
              {critiques.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', borderRadius: 6, background: TON_GRAVITE.CRITIQUE.bg, border: `1px solid ${TON_GRAVITE.CRITIQUE.border}` }}>
                  <AlertTriangle size={13} style={{ color: TON_GRAVITE.CRITIQUE.dot, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ minWidth: 0, fontSize: 12, lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 700, color: TON_GRAVITE.CRITIQUE.text }}>{typeAlerte(a.type)} · {t('patients.graviteLabelCritique')}</span>
                    <span style={{ color: 'var(--texte-secondaire)' }}> — {a.message}</span>
                    <span style={{ color: 'var(--texte-tertiaire)' }}>{' · '}{t('patients.securiteSignaleeLe', { date: formatDate(a.createdAt) })}, {anciennete(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
          {actuelles.length > 0 && (
            <>
              <p style={{ ...sousTitre, color: 'var(--texte-secondaire)', marginTop: severes.length + critiques.length ? 6 : 0 }}>
                <Activity size={12} style={{ color: 'var(--ap-600)' }} /> {t('patients.clinicalAlertsDetected', { count: actuelles.length })}
              </p>
              {actuelles.map((a, i) => ligne(a, i, TON_GRAVITE[a.gravite]))}
            </>
          )}
          {historiques.length > 0 && (
            <>
              <p style={{ ...sousTitre, color: 'var(--texte-tertiaire)', marginTop: actuelles.length + severes.length + critiques.length ? 6 : 0 }}>
                <History size={12} /> {t('patients.clinicalAlertsHistory', { count: historiques.length })}
              </p>
              {historiques.map((a, i) => ligne(a, i, TON_NEUTRE))}
            </>
          )}
        </div>
      )}
    </section>
  )
}

// ── Dossier verrouillé : rideau bloqué (contenu clinique masqué) ───────────────
function LockedDossier({ motif }: { motif: string | null }) {
  const { t } = useTranslation()
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
      background: 'var(--verre-fond)', backdropFilter: 'blur(var(--verre-blur))',
    }}>
      <div style={{ maxWidth: 420, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--avert-fond)', color: 'var(--avert-texte)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--avert-bordure)' }}>
          <Lock size={26} />
        </div>
        <p style={{ margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
          {t('patients.lockedTitle', { defaultValue: 'Dossier verrouillé' })}
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
          {t('patients.lockedBody', { defaultValue: 'L\'accès à ce dossier a été restreint par le médecin-chef. Contactez-le si vous avez besoin d\'y accéder.' })}
        </p>
        {motif && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--texte-tertiaire)', fontStyle: 'italic', padding: '8px 12px', background: 'var(--fond-surface-2)', borderRadius: 8, border: '1px solid var(--bordure-legere)' }}>
            « {motif} »
          </p>
        )}
      </div>
    </div>
  )
}

// ── Page dossier ──────────────────────────────────────────────────────────────

export function DossierPage() {
  const { t }      = useTranslation()
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const { has }    = usePermissions()
  const isCompact  = useIsCompact()
  const canWrite   = has('patient.update')
  const canArchive = has('patient.archive')
  const canDelete  = has('patient.delete')
  // Rattachements (CDI / sous-traitants) = partie administrative, perm dédiée
  const canManageRattachements = has('patient.rattachement.manage')
  // Onglets cliniques (consultations + documents générés) réservés aux soignants.
  const canViewClinique = has('consultation.read')
  // Verrou de confidentialité : poser/retirer = patient.lock (médecin-chef) ;
  // VOIR un dossier verrouillé = supervision (ADMIN_SYSTEME / MEDECIN_CHEF).
  const canLock     = has('patient.lock')
  const roles       = useSessionStore(s => s.user?.roles ?? [])
  const isSupervision = roles.some(r => r === 'ADMIN_SYSTEME' || r === 'MEDECIN_CHEF')
  // Meme regle que le serveur (isHistoriqueRestreint) : l'infirmier ne recoit que le
  // parcours EN COURS. Les onglets doivent le savoir pour ne pas ecrire « aucun … pour ce
  // patient » sur ce qui n'est qu'une vue limitee.
  const historiqueRestreint = roles.includes('INFIRMIER') && !isSupervision

  const [activeSection, setActiveSection]   = usePersistedState<SectionKey>('dossier', 'activeSection', 'apercu')
  const [activeSubTabRaw, setActiveSubTab]  = usePersistedState<SubTabKey>('dossier', 'activeSubTab', 'identite')
  // Arrivée depuis une consultation (« Ouvrir le suivi dans le dossier ») : on se place sur
  // Parcours de soins › Suivi de traitement et l'épisode s'ouvre de lui-même.
  const location = useLocation()
  const [suiviAOuvrir, setSuiviAOuvrir] = useState<string | null>(null)
  const suiviDemande = (location.state as { ouvrirSuiviId?: string } | null)?.ouvrirSuiviId
  useEffect(() => {
    if (!suiviDemande) return
    setSuiviAOuvrir(suiviDemande)
    setActiveSection('parcours'); setActiveSubTab('suiviTraitement')
    // L'état de navigation est consommé : un rechargement ne rouvre pas l'épisode.
    navigate(location.pathname, { replace: true, state: null })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suiviDemande])
  const [showChangerCateg, setChangerCateg] = useState(false)
  const [showArchiveConfirm, setShowArchive] = useState(false)
  const [showDeleteConfirm, setShowDelete]   = useState(false)
  const [showPrint, setShowPrint]           = useState(false)
  const [showLock, setShowLock]             = useState(false)
  const [lockMotif, setLockMotif]           = useState('')

  const { data: dossier, isLoading } = usePatientDossier(id ?? '')
  // Mêmes données (même cache) que les onglets du suivi : sert aux COMPTEURS d'onglets
  // (constat 83) — des résultats en attente de saisie étaient invisibles tant qu'on
  // n'ouvrait pas le bon onglet.
  const { data: suiviResume } = usePatientSuivi(id ?? '', canViewClinique)
  const updateStatut = useUpdateStatutPatient(id ?? '')
  const deletePatient = useDeletePatient()
  const setVerrou = useSetVerrouPatient(id ?? '')

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--texte-tertiaire)' }}>
        {t('patients.loadingRecord')}
      </div>
    )
  }

  if (!dossier) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <p style={{ fontSize: '14px', color: 'var(--texte-secondaire)' }}>{t('patients.recordNotFound')}</p>
        <Button size="sm" variant="outline" onClick={() => navigate('/patients')}>{t('patients.backToList')}</Button>
      </div>
    )
  }

  const id_ = dossier.identite
  // Dossier verrouillé ET je ne suis pas supervision → contenu masqué (rideau forcé).
  const lockedForMe = dossier.verrouille && !isSupervision

  // Sous-onglet Rattachements : uniquement pertinent pour un CDI (voit ses ayants
  // droit) ou un ayant droit (voit le CDI dont il dépend) — le rattachement se
  // crée désormais automatiquement à la visite, aucune autre catégorie n'en a besoin
  // (sous-traitant/riverain/retraité/agent fonctionnaire/patient externe/CDD n'ont pas
  // ce privilège, cf. DroitCategoriePatient qui les exclut déjà tous de la couverture).
  // La section Administratif reste visible pour tous (l'historique de catégorie
  // s'applique à toute catégorie de patient), seul le sous-onglet est filtré.
  const hasRattachements = dossier.categoriePatient.code === 'ASSURE_CDI' || dossier.categoriePatient.code === 'AYANT_DROIT_CDI'

  // Onglet visible pour CE profil et CE patient : réservé aux soignants (consultation.read)
  // ou au CDI / ayant droit (rattachements).
  const sousOngletVisible = (t: (typeof SECTIONS)[number]['subTabs'][number]) =>
    (!('clinicalOnly' in t && t.clinicalOnly) || canViewClinique) &&
    (!('requiresRattachement' in t && t.requiresRattachement) || hasRattachements)
  // Une section sans AUCUN onglet visible disparaît. Avant, elle restait affichée :
  // pour un profil sans lecture clinique, « Parcours de soins » (tous ses onglets sont
  // cliniques) faisait planter la page — et comme la section active est mémorisée pour
  // tous les dossiers, chaque dossier ouvert ensuite plantait aussi.
  const visibleSections = SECTIONS.filter(s => s.subTabs.some(sousOngletVisible))

  // Comptes pour les badges d'onglets/sections
  const tabCounts: Partial<Record<SubTabKey, number>> = {
    alertes:    dossier.allergies.filter(a => a.statut === 'ACTIVE').length +
                dossier.alertesMedicales.filter(a => a.statut === 'ACTIVE').length,
    antecedents: dossier.antecedents.filter(a => a.statut === 'ACTIF').length,
    rattachements: dossier.rattachementsAD.filter(r => r.statut === 'ACTIF').length,
    chroniques: suiviResume?.chroniques.length,
    resultats: suiviResume?.resultatsEnAttente.length,
  }
  // Ce que compte la pastille d'une section = celle de l'un de ses onglets.
  const sectionBadgeSource: Partial<Record<SectionKey, SubTabKey>> = {
    apercu: 'alertes',
    medical: 'antecedents',
    administratif: 'rattachements',
    // Des résultats attendent d'être saisis : signalé dès la barre des sections.
    parcours: 'resultats',
  }
  // Un nombre seul ne disait pas ce qu'il comptait — et chaque onglet compte autre chose
  // (constat 15) : l'infobulle le dit.
  const pastille = (key: SubTabKey | undefined) => {
    const n = key ? tabCounts[key] ?? 0 : 0
    if (!key || n <= 0) return undefined
    const libelle = t(`patients.badgeTitle_${key}`, { count: n })
    return <span title={libelle} aria-label={libelle}>{n}</span>
  }

  // Section active + ses sous-onglets, filtrés par permission (onglets cliniques
  // masqués aux profils sans lecture clinique — ex. délégation sans consultation.read)
  // et par catégorie (Rattachements absent des catégories sans rattachement possible).
  // Une section mémorisée devenue invisible (droit retiré, autre profil sur le même poste)
  // retombe sur la première section visible au lieu de casser la page.
  const currentSection = visibleSections.find(s => s.key === activeSection) ?? visibleSections[0]
  const activeSectionKey: SectionKey = currentSection.key
  const visibleSubTabs = currentSection.subTabs.filter(sousOngletVisible)
  const activeSubTab: SubTabKey = visibleSubTabs.some(t => t.key === activeSubTabRaw) ? activeSubTabRaw : (visibleSubTabs[0]?.key ?? 'identite')

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

        {/* ── Barre navigation ────────────────────────────────────────── */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--bordure-legere)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', background: 'var(--fond-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/patients')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--texte-tertiaire)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
              <ArrowLeft size={14} /> {t('patients.breadcrumbPatients')}
            </button>
            <span style={{ color: 'var(--bordure-normale)' }}>/</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
              {id_ ? `${id_.prenom} ${id_.nom}` : dossier.numeroPatient}
            </span>
            {/* Catégorie : affichée une seule fois, sous l'avatar de la colonne — là où
                l'encart « Droits suspendus » la complète quand il le faut. */}
            {dossier.verrouille && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 99, whiteSpace: 'nowrap', background: 'var(--avert-fond)', color: 'var(--avert-texte)', border: '1px solid var(--avert-bordure)' }}>
                <Lock size={11} /> {t('patients.lockedBadge', { defaultValue: 'Verrouillé' })}
              </span>
            )}
            {dossier.statut !== 'ACTIF' && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 99, whiteSpace: 'nowrap',
                background: dossier.statut === 'DECEDE' ? 'var(--erreur-fond)' : 'var(--fond-surface-2)',
                color:      dossier.statut === 'DECEDE' ? 'var(--erreur-texte)' : 'var(--texte-secondaire)',
                border:     `1px solid ${dossier.statut === 'DECEDE' ? 'var(--erreur-bordure)' : 'var(--bordure-legere)'}`,
              }}>
                {dossier.statut === 'ARCHIVE' ? t('patients.statusArchivedValue') : t('patients.statusDeceasedValue')}
              </span>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" style={{ width: 32, height: 32 }}>
                <MoreVertical size={15} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ fontSize: '13px', minWidth: 180 }}>
              <DropdownMenuItem onClick={() => { setActiveSection('apercu'); setActiveSubTab('identite') }} style={{ cursor: 'pointer' }}>
                {t('patients.menuEditIdentity')}
              </DropdownMenuItem>
              {/* Sous verrou, la synthese imprimerait « Aucune alerte ni allergie active » :
                  une affirmation fausse, et sur papier, la ou rien ne la corrigera. */}
              {!lockedForMe && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowPrint(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Printer size={14} /> {t('patients.menuPrintSynthesis')}
                  </DropdownMenuItem>
                </>
              )}
              {has('patient.change_category') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setChangerCateg(true)} style={{ cursor: 'pointer' }}>
                    {t('patients.menuChangeCategory')}
                  </DropdownMenuItem>
                </>
              )}
              {canLock && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setLockMotif(dossier.motifVerrou ?? ''); setShowLock(true) }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: dossier.verrouille ? 'var(--succes-texte)' : 'var(--avert-texte)' }}
                  >
                    {dossier.verrouille ? <Unlock size={14} /> : <Lock size={14} />}
                    {dossier.verrouille ? t('patients.menuUnlock', { defaultValue: 'Déverrouiller le dossier' }) : t('patients.menuLock', { defaultValue: 'Verrouiller le dossier' })}
                  </DropdownMenuItem>
                </>
              )}
              {canArchive && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowArchive(true)}
                    style={{ cursor: 'pointer', color: dossier.statut === 'ACTIF' ? 'var(--erreur-texte)' : 'var(--succes-texte)' }}
                  >
                    {dossier.statut === 'ACTIF' ? t('patients.menuArchiveRecord') : t('patients.menuReactivateRecord')}
                  </DropdownMenuItem>
                </>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDelete(true)}
                    style={{ cursor: 'pointer', color: 'var(--erreur-texte)', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Trash2 size={14} /> {t('patients.menuDeleteRecord')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Corps principal ──────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: isCompact ? 'column' : 'row', minHeight: 0, overflow: isCompact ? 'auto' : 'hidden' }}>

          {/* Écran compact : la Sécurité clinique PASSE AVANT la colonne empilée (constat 11).
              Sinon, sur tablette ou téléphone, allergies sévères et alertes critiques
              n'apparaissaient qu'après tout le panneau d'identité — hors de l'écran. */}
          {isCompact && !lockedForMe && (
            <div style={{ paddingBottom: 12 }}>
              <SecuriteClinique dossier={dossier} alertesActives={canViewClinique} />
            </div>
          )}

          {/* Sidebar — colonne fixe (bureau) / bandeau empilé pleine largeur (compact) */}
          <DossierSidebar
            dossier={dossier}
            onChangerCategorie={() => setChangerCateg(true)}
            canChangerCategorie={has('patient.change_category')}
            onOuvrir={(section, sousOnglet) => { setActiveSection(section); setActiveSubTab(sousOnglet) }}
            canViewClinique={canViewClinique}
            compact={isCompact}
            locked={lockedForMe}
          />

          {/* Contenu principal — sur compact: hauteur naturelle, c'est le corps qui scrolle (un seul scroll) */}
          <div style={{ flex: isCompact ? 'none' : 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflowY: isCompact ? 'visible' : 'auto' }}>

            {lockedForMe ? (
              <LockedDossier motif={dossier.motifVerrou} />
            ) : (
            <>
            {/* Sécurité clinique : allergies sévères, alertes critiques et alertes calculées
                (sur écran compact, déjà affichée avant la colonne). */}
            {!isCompact && <SecuriteClinique dossier={dossier} alertesActives={canViewClinique} />}

            {/* Sections (niveau 1) */}
            <div style={{ borderBottom: '1px solid var(--bordure-legere)', padding: 'var(--espace-3) 24px', marginTop: '12px', flexShrink: 0, overflowX: 'auto' }}>
              <SegmentedTabs
                value={activeSectionKey}
                onChange={k => setActiveSection(k as SectionKey)}
                tabs={visibleSections.map(s => ({
                  key: s.key,
                  label: t(s.labelKey),
                  icon: <s.icon size={13} />,
                  badge: pastille(sectionBadgeSource[s.key]),
                }))}
              />
            </div>

            {/* Sous-onglets (niveau 2) — masqués si la section n'a qu'un seul enfant visible */}
            {visibleSubTabs.length > 1 && (
              <div style={{ padding: '12px 24px 0', flexShrink: 0, overflowX: 'auto' }}>
                <SegmentedTabs
                  size="sm"
                  value={activeSubTab}
                  onChange={k => setActiveSubTab(k as SubTabKey)}
                  tabs={visibleSubTabs.map(st => ({
                    key: st.key,
                    label: t(st.labelKey),
                    badge: pastille(st.key),
                  }))}
                />
              </div>
            )}

            {/* Contenu — compact: hauteur naturelle + flux (scroll délégué au corps) */}
            <div style={{ flex: isCompact ? 'none' : 1, padding: '20px 24px', overflowY: isCompact ? 'visible' : 'auto' }}>
              {/* Dit UNE fois, en tete du Parcours, ce que Documents disait seul : la vue de
                  l'infirmier est limitee au parcours en cours. Sans ce bandeau, Visites,
                  Consultations et Suivi presentaient une vue tronquee comme le dossier entier. */}
              {(activeSectionKey === 'parcours' || activeSubTab === 'chroniques' || activeSubTab === 'constantes') && historiqueRestreint && canViewClinique && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                  padding: '8px 12px', borderRadius: 8,
                  background: 'var(--info-fond)', border: '1px solid var(--info-bordure)',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--info-texte)' }}>{t('patients.tlHistoriqueRestreint')}</span>
                </div>
              )}
              {activeSubTab === 'identite'            && <IdentiteTab      dossier={dossier} canWrite={canWrite} />}
              {activeSubTab === 'alertes'             && <AlertesTab       dossier={dossier} canWrite={canWrite} />}
              {activeSubTab === 'antecedents'         && <AntecedentsTab   dossier={dossier} canWrite={canWrite} />}
              {activeSubTab === 'documents'           && canViewClinique && <DocumentsTab patientId={dossier.id} />}
              {activeSubTab === 'visites'             && canViewClinique && <VisitesTab patientId={dossier.id} historiqueRestreint={historiqueRestreint} />}
              {activeSubTab === 'consultations'       && canViewClinique && <ConsultationsTab patientId={dossier.id} historiqueRestreint={historiqueRestreint} />}
              {activeSubTab === 'chroniques'          && canViewClinique && <PathologiesChroniquesTab patientId={dossier.id} historiqueRestreint={historiqueRestreint} />}
              {activeSubTab === 'constantes'          && canViewClinique && <ConstantesTab patientId={dossier.id} historiqueRestreint={historiqueRestreint} />}
              {activeSubTab === 'suiviTraitement'     && canViewClinique && <SuiviTraitementTab patientId={dossier.id} historiqueRestreint={historiqueRestreint} ouvrirSuiviId={suiviAOuvrir} onOuvert={() => setSuiviAOuvrir(null)} />}
              {activeSubTab === 'traitements'         && canViewClinique && <TraitementsTab patientId={dossier.id} historiqueRestreint={historiqueRestreint} />}
              {activeSubTab === 'resultats'           && canViewClinique && <ResultatsExamensTab patientId={dossier.id} historiqueRestreint={historiqueRestreint} />}
              {activeSubTab === 'rattachements'       && <RattementsTab    dossier={dossier} canWrite={canManageRattachements} />}
              {activeSubTab === 'historiqueCategorie' && <HistoriqueCategorieTab dossier={dossier} />}
            </div>
            </>
            )}
          </div>
        </div>
      </div>

      {/* Modal changer catégorie */}
      <ChangerCategorieModal
        open={showChangerCateg}
        onClose={() => setChangerCateg(false)}
        dossier={dossier}
      />

      {/* Modal impression synthèse dossier (PDF) */}
      {showPrint && (
        <DossierPrintModal dossier={dossier} onClose={() => setShowPrint(false)} />
      )}

      {/* Modal verrouiller / déverrouiller le dossier (médecin-chef) */}
      {showLock && (
        <Modal
          icon={dossier.verrouille ? <Unlock size={17} /> : <Lock size={17} />}
          title={dossier.verrouille ? t('patients.unlockTitle', { defaultValue: 'Déverrouiller le dossier' }) : t('patients.lockTitle', { defaultValue: 'Verrouiller le dossier' })}
          subtitle={id_ ? `${id_.prenom} ${id_.nom} · ${dossier.numeroPatient}` : dossier.numeroPatient}
          width={460}
          onClose={() => setShowLock(false)}
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setShowLock(false)} disabled={setVerrou.isPending} style={{ fontSize: '13px', height: 34 }}>
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={async () => { await setVerrou.mutateAsync({ verrouille: !dossier.verrouille, motif: lockMotif }); setShowLock(false) }}
                disabled={setVerrou.isPending}
                style={{ fontSize: '13px', height: 34, gap: '5px', color: '#fff', border: 'none', background: dossier.verrouille ? 'var(--succes-accent)' : 'var(--avert-accent)' }}
              >
                {dossier.verrouille
                  ? <><Unlock size={13} /> {t('patients.btnUnlock', { defaultValue: 'Déverrouiller' })}</>
                  : <><Lock size={13} /> {t('patients.btnLock', { defaultValue: 'Verrouiller' })}</>}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: '13px', color: 'var(--texte-secondaire)', lineHeight: '1.6', margin: '0 0 12px' }}>
            {dossier.verrouille
              ? t('patients.unlockBody', { defaultValue: 'Le dossier redeviendra accessible à tous les soignants autorisés.' })
              : t('patients.lockBody', { defaultValue: 'Seuls le médecin-chef et l\'administrateur pourront consulter ce dossier. Les autres verront un dossier verrouillé (contenu masqué).' })}
          </p>
          {!dossier.verrouille && (
            <Textarea
              value={lockMotif}
              onChange={e => setLockMotif(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder={t('patients.lockMotifPlaceholder', { defaultValue: 'Motif (optionnel) — ex. dossier sensible' })}
            />
          )}
        </Modal>
      )}

      {/* Modal confirmation archivage / réactivation */}
      {showArchiveConfirm && (
        <Modal
          icon={dossier.statut === 'ACTIF' ? <Archive size={17} /> : <RotateCcw size={17} />}
          title={dossier.statut === 'ACTIF' ? t('patients.archiveTitle') : t('patients.reactivateTitle')}
          subtitle={id_ ? `${id_.prenom} ${id_.nom} · ${dossier.numeroPatient}` : dossier.numeroPatient}
          width={440}
          onClose={() => setShowArchive(false)}
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setShowArchive(false)} disabled={updateStatut.isPending} style={{ fontSize: '13px', height: 34 }}>
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const newStatut = dossier.statut === 'ACTIF' ? 'ARCHIVE' : 'ACTIF'
                  await updateStatut.mutateAsync(newStatut)
                  setShowArchive(false)
                }}
                disabled={updateStatut.isPending}
                style={{
                  fontSize: '13px', height: 34, gap: '5px', color: '#fff', border: 'none',
                  background: dossier.statut === 'ACTIF' ? 'var(--erreur-accent)' : 'var(--succes-accent)',
                }}
              >
                {updateStatut.isPending
                  ? t('patients.processing')
                  : dossier.statut === 'ACTIF'
                    ? <><Archive size={13} /> {t('patients.btnArchive')}</>
                    : <><RotateCcw size={13} /> {t('patients.btnReactivate')}</>}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: '13px', color: 'var(--texte-secondaire)', lineHeight: '1.6', margin: 0, padding: '12px', background: 'var(--fond-surface-2)', borderRadius: 'var(--radius-md)' }}>
            {dossier.statut === 'ACTIF'
              ? t('patients.archiveBody')
              : t('patients.reactivateBody')}
          </p>
        </Modal>
      )}

      {/* Modal confirmation suppression définitive du dossier */}
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          title={t('patients.deleteRecordTitle')}
          subtitle={id_ ? `${id_.prenom} ${id_.nom} · ${dossier.numeroPatient}` : dossier.numeroPatient}
          confirmLabel={t('patients.deleteRecordConfirm')}
          closeOnSuccess={false}
          message={
            <>
              <strong style={{ color: 'var(--erreur-texte)' }}>{t('patients.deleteRecordIrreversible')}</strong>{t('patients.deleteRecordBody')}
            </>
          }
          onClose={() => setShowDelete(false)}
          onConfirm={async () => {
            await deletePatient.mutateAsync(dossier.id)
            navigate('/patients')
          }}
        />
      )}
    </>
  )
}
