import { useState }           from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation }       from 'react-i18next'
import {
  ArrowLeft, Users, Phone, AlertTriangle, MoreVertical, Archive, RotateCcw, Printer, Activity, Trash2, Lock, Unlock,
  LayoutGrid, Stethoscope, GitCommitVertical, Building2,
} from 'lucide-react'
import { Button }              from '@workspace/ui/components/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { usePermissions }      from '@/hooks/usePermissions'
import { useIsCompact }        from '@/hooks/useMediaQuery'
import { usePersistedState }   from '@/hooks/usePersistedState'
import { usePatientDossier, useUpdateStatutPatient, usePatientAlertesCliniques, useDeletePatient, useSetVerrouPatient } from '../hooks/usePatients'
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
import { SuiviTraitementTab }  from '../components/dossier/SuiviTraitementTab'
import { HistoriqueCategorieTab } from '../components/dossier/HistoriqueCategorieTab'
import { ChangerCategorieModal } from '../components/ChangerCategorieModal'
import { DossierPrintModal }     from '../components/dossier/DossierPrintModal'
import { SegmentedTabs, Modal, Textarea } from '@/components/saris'
import type { PatientDossier } from '@cms-saris/types'
import { calcAge } from '@/lib/age'

// Les droits d'écriture sont désormais portés par les permissions granulaires.

// ── Sections ──────────────────────────────────────────────────────────────────
// 4 groupes cliniques/administratifs — Dossier médical porte les données stables
// (antécédents, documents générés) ; Parcours de soins porte le fil temporel en
// 3 onglets séparés (Visites / Consultations / Suivi de traitement, chacun un
// onglet simple sans filtre puisqu'il n'affiche qu'un seul type d'événement) ;
// Administratif porte les rattachements ET l'historique de catégorie (nature
// administrative, pas clinique).
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
      { key: 'antecedents', labelKey: 'patients.tabHistory' },
      { key: 'documents',   labelKey: 'patients.tabDocuments', clinicalOnly: true },
    ],
  },
  {
    key: 'parcours', labelKey: 'patients.sectionCareJourney', icon: GitCommitVertical,
    subTabs: [
      { key: 'visites',         labelKey: 'patients.tabVisites',        clinicalOnly: true },
      { key: 'consultations',   labelKey: 'patients.tabConsultations',  clinicalOnly: true },
      { key: 'suiviTraitement', labelKey: 'patients.tabSuiviTraitement', clinicalOnly: true },
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

function DossierSidebar({ dossier, onChangerCategorie, compact }: { dossier: PatientDossier; onChangerCategorie: () => void; compact?: boolean }) {
  const { t } = useTranslation()
  const id  = dossier.identite
  const cu  = dossier.contactUrgence
  const allergiesActives    = dossier.allergies.filter(a => a.statut === 'ACTIVE')
  const alertesMedActives   = dossier.alertesMedicales.filter(a => a.statut === 'ACTIVE')
  const antecedentsActifs   = dossier.antecedents.filter(a => a.statut === 'ACTIF')
  const rattAD              = dossier.rattachementsAD.filter(r => r.statut === 'ACTIF')
  const rattST              = dossier.rattachementsST.filter(r => r.statut === 'ACTIF')

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
              {id.dateNaissance && <>{t('patients.infoYears', { count: calcAge(id.dateNaissance) })} · </>}
              {id.sexe === 'M' ? t('patients.sexMale') : id.sexe === 'F' ? t('patients.sexFemale') : '—'}
            </p>
          )}
        </div>
        <CategorieBadge code={dossier.categoriePatient.code} libelle={dossier.categoriePatient.libelle} />
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

      {/* Contact urgence */}
      {cu && (
        <SidebarSection title={t('patients.sidebarEmergencyContact')} icon={<Phone size={12} />}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0 }}>{cu.prenom} {cu.nom}</p>
          <p style={{ fontSize: '12px', color: 'var(--texte-secondaire)', margin: '2px 0 0' }}>{cu.lien}</p>
          <p style={{ fontSize: '12px', color: 'var(--texte-secondaire)', margin: '2px 0 0' }}>{cu.telephone}</p>
        </SidebarSection>
      )}

      {/* Compteurs rapides */}
      <SidebarSection title={t('patients.sectionMedicalRecord')}>
        <SidebarCounter label={t('patients.counterActiveAllergies')}    count={allergiesActives.length}    danger={allergiesActives.some(a => a.gravite === 'SEVERE')} />
        <SidebarCounter label={t('patients.counterMedicalAlerts')}    count={alertesMedActives.length}   danger={alertesMedActives.some(a => a.gravite === 'CRITIQUE')} />
        <SidebarCounter label={t('patients.counterAntecedents')}          count={antecedentsActifs.length}   />
      </SidebarSection>

      {/* Rattachements */}
      {(rattAD.length + rattST.length) > 0 && (
        <SidebarSection title={t('patients.sectionActiveAttachments')}>
          {rattAD.length > 0 && <SidebarCounter label={t('patients.counterBeneficiariesCdi')}     count={rattAD.length} />}
          {rattST.length > 0 && <SidebarCounter label={t('patients.counterSubcontractor')}        count={rattST.length} />}
        </SidebarSection>
      )}

      {/* Actions */}
      <div style={{ marginTop: 'auto' }}>
        <button
          onClick={onChangerCategorie}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)', border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)', cursor: 'pointer', textAlign: 'left' }}
        >
          {t('patients.changeCategory')}
        </button>
      </div>
    </aside>
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

function SidebarCounter({ label, count, danger }: { label: string; count: number; danger?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
      <span style={{ color: 'var(--texte-secondaire)' }}>{label}</span>
      <span style={{
        minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: '600',
        background: danger && count > 0 ? '#fee2e2' : 'var(--fond-surface-2)',
        color:      danger && count > 0 ? '#b91c1c' : 'var(--texte-secondaire)',
      }}>{count}</span>
    </div>
  )
}

// ── Bannière alertes critiques ────────────────────────────────────────────────

function AlerteBanner({ dossier }: { dossier: PatientDossier }) {
  const { t } = useTranslation()
  const severe    = dossier.allergies.filter(a => a.statut === 'ACTIVE' && a.gravite === 'SEVERE')
  const critiques = dossier.alertesMedicales.filter(a => a.statut === 'ACTIVE' && a.gravite === 'CRITIQUE')
  if (severe.length === 0 && critiques.length === 0) return null

  return (
    <div style={{
      margin: '16px 24px 0',
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--erreur-fond)',
      border: '1px solid var(--erreur-bordure)',
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start',
    }}>
      <AlertTriangle size={15} style={{ color: 'var(--erreur-accent)', flexShrink: 0, marginTop: 1 }} />
      <div>
        <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--erreur-texte)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t('patients.bannerCriticalTitle')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {severe.map(a => (
            <span key={a.id} style={{ fontSize: '12px', background: 'var(--fond-surface)', color: 'var(--erreur-texte)', border: '1px solid var(--erreur-bordure)', padding: '2px 8px', borderRadius: 99, fontWeight: '500' }}>
              {t('patients.bannerAllergyPrefix', { substance: a.substance })}
            </span>
          ))}
          {critiques.map(a => (
            <span key={a.id} style={{ fontSize: '12px', background: 'var(--fond-surface)', color: 'var(--erreur-texte)', border: '1px solid var(--erreur-bordure)', padding: '2px 8px', borderRadius: 99, fontWeight: '500' }}>
              {a.message}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Bandeau alertes cliniques CALCULÉES (allergie↔médicament, constantes, chronique) ──

function AlertesCliniquesBanner({ patientId, enabled }: { patientId: string; enabled: boolean }) {
  const { t } = useTranslation()
  const { data: alertes = [] } = usePatientAlertesCliniques(patientId, enabled)
  if (!enabled || alertes.length === 0) return null

  const COLOR = {
    CRITIQUE: { bg: '#fff1f2',            border: '#fecdd3',              text: '#be123c',          dot: '#e11d48' },
    ELEVE:    { bg: 'var(--avert-fond)',  border: 'var(--avert-bordure)', text: 'var(--avert-texte)', dot: 'var(--avert-texte)' },
    MODERE:   { bg: 'var(--info-fond)',   border: 'var(--info-bordure)',  text: 'var(--info-texte)',  dot: 'var(--info-texte)' },
  } as const

  return (
    <div style={{ margin: '12px 24px 0', padding: '12px 14px', borderRadius: 8, background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--texte-secondaire)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Activity size={13} style={{ color: 'var(--ap-600)' }} /> {t('patients.clinicalAlertsDetected', { count: alertes.length })}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alertes.map((a, i) => {
          const c = COLOR[a.gravite]
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 6, background: c.bg, border: `1px solid ${c.border}` }}>
              <AlertTriangle size={14} style={{ color: c.dot, flexShrink: 0, marginTop: 1 }} />
              <div style={{ minWidth: 0, fontSize: 12, lineHeight: 1.45 }}>
                <span style={{ fontWeight: 700, color: c.text }}>{a.titre}</span>
                <span style={{ color: 'var(--texte-secondaire)' }}> — {a.detail}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
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

  const [activeSection, setActiveSection]   = usePersistedState<SectionKey>('dossier', 'activeSection', 'apercu')
  const [activeSubTabRaw, setActiveSubTab]  = usePersistedState<SubTabKey>('dossier', 'activeSubTab', 'identite')
  const [showChangerCateg, setChangerCateg] = useState(false)
  const [showArchiveConfirm, setShowArchive] = useState(false)
  const [showDeleteConfirm, setShowDelete]   = useState(false)
  const [showPrint, setShowPrint]           = useState(false)
  const [showLock, setShowLock]             = useState(false)
  const [lockMotif, setLockMotif]           = useState('')

  const { data: dossier, isLoading } = usePatientDossier(id ?? '')
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
  const visibleSections   = SECTIONS

  // Comptes pour les badges d'onglets/sections
  const tabCounts: Partial<Record<SubTabKey, number>> = {
    alertes:    dossier.allergies.filter(a => a.statut === 'ACTIVE').length +
                dossier.alertesMedicales.filter(a => a.statut === 'ACTIVE').length,
    antecedents: dossier.antecedents.filter(a => a.statut === 'ACTIF').length,
    rattachements: dossier.rattachementsAD.filter(r => r.statut === 'ACTIF').length,
  }
  const sectionBadge: Partial<Record<SectionKey, number>> = {
    apercu: tabCounts.alertes,
    medical: tabCounts.antecedents,
    administratif: tabCounts.rattachements,
  }

  // Section active + ses sous-onglets, filtrés par permission (onglets cliniques
  // masqués aux profils sans lecture clinique — ex. délégation sans consultation.read)
  // et par catégorie (Rattachements absent des catégories sans rattachement possible).
  const currentSection = visibleSections.find(s => s.key === activeSection) ?? visibleSections[0]
  const visibleSubTabs = currentSection.subTabs.filter(t =>
    (!('clinicalOnly' in t && t.clinicalOnly) || canViewClinique) &&
    (!('requiresRattachement' in t && t.requiresRattachement) || hasRattachements),
  )
  const activeSubTab: SubTabKey = visibleSubTabs.some(t => t.key === activeSubTabRaw) ? activeSubTabRaw : visibleSubTabs[0].key

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
            <CategorieBadge code={dossier.categoriePatient.code} libelle={dossier.categoriePatient.libelle} />
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowPrint(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Printer size={14} /> {t('patients.menuPrintSynthesis')}
              </DropdownMenuItem>
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

          {/* Sidebar — colonne fixe (bureau) / bandeau empilé pleine largeur (compact) */}
          <DossierSidebar dossier={dossier} onChangerCategorie={() => setChangerCateg(true)} compact={isCompact} />

          {/* Contenu principal — sur compact: hauteur naturelle, c'est le corps qui scrolle (un seul scroll) */}
          <div style={{ flex: isCompact ? 'none' : 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflowY: isCompact ? 'visible' : 'auto' }}>

            {lockedForMe ? (
              <LockedDossier motif={dossier.motifVerrou} />
            ) : (
            <>
            {/* Bannière alertes */}
            <AlerteBanner dossier={dossier} />
            <AlertesCliniquesBanner patientId={dossier.id} enabled={canViewClinique} />

            {/* Sections (niveau 1) */}
            <div style={{ borderBottom: '1px solid var(--bordure-legere)', padding: 'var(--espace-3) 24px', marginTop: '12px', flexShrink: 0, overflowX: 'auto' }}>
              <SegmentedTabs
                value={activeSection}
                onChange={k => setActiveSection(k as SectionKey)}
                tabs={visibleSections.map(s => ({
                  key: s.key,
                  label: t(s.labelKey),
                  icon: <s.icon size={13} />,
                  badge: (sectionBadge[s.key] ?? 0) > 0 ? sectionBadge[s.key] : undefined,
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
                    badge: (tabCounts[st.key] ?? 0) > 0 ? tabCounts[st.key] : undefined,
                  }))}
                />
              </div>
            )}

            {/* Contenu — compact: hauteur naturelle + flux (scroll délégué au corps) */}
            <div style={{ flex: isCompact ? 'none' : 1, padding: '20px 24px', overflowY: isCompact ? 'visible' : 'auto' }}>
              {activeSubTab === 'identite'            && <IdentiteTab      dossier={dossier} canWrite={canWrite} />}
              {activeSubTab === 'alertes'             && <AlertesTab       dossier={dossier} canWrite={canWrite} />}
              {activeSubTab === 'antecedents'         && <AntecedentsTab   dossier={dossier} canWrite={canWrite} />}
              {activeSubTab === 'documents'           && canViewClinique && <DocumentsTab patientId={dossier.id} />}
              {activeSubTab === 'visites'             && canViewClinique && <VisitesTab patientId={dossier.id} />}
              {activeSubTab === 'consultations'       && canViewClinique && <ConsultationsTab patientId={dossier.id} />}
              {activeSubTab === 'suiviTraitement'     && canViewClinique && <SuiviTraitementTab patientId={dossier.id} />}
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
