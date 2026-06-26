import { useState, useMemo, useEffect, useRef }  from 'react'
import { useNavigate }        from 'react-router-dom'
import { useTranslation }     from 'react-i18next'
import { Search, X, Plus, Users, AlertTriangle, ChevronRight, ChevronLeft, Camera } from 'lucide-react'
import { Input }              from '@workspace/ui/components/input'
import { Button }             from '@workspace/ui/components/button'
import { SelectBox, PaginationBar, EmptyState } from '@/components/saris'
import { usePagination }      from '@/hooks/usePagination'
import { useRowsPerPage }     from '@/hooks/useRowsPerPage'
import { usePermissions }     from '@/hooks/usePermissions'
import { useIsCompact }       from '@/hooks/useMediaQuery'
import { usePersistedState }  from '@/hooks/usePersistedState'
import { usePatients, useUploadPatientPhoto } from '../hooks/usePatients'
import { useCategoriesPatient } from '@/modules/referentiels/hooks/useReferentiels'
import { CategorieBadge, PatientAvatar }  from '../components/CategorieBadge'
import { StatutBadge }        from '@/modules/referentiels/components/badges/StatutBadge'
import type { PatientListItem } from '@cms-saris/types'
import { CreerPatientDrawer } from '../components/CreerPatientDrawer'
import { formatDate } from '@/lib/intl'
import { calcAge } from '@/lib/age'
import { PrivacyCurtain } from '@/components/PrivacyCurtain'

// ── Panneau aperçu rapide ─────────────────────────────────────────────────────

function PreviewPanel({ patient, onOpen, onBack }: { patient: PatientListItem; onOpen: () => void; onBack?: () => void }) {
  const { t } = useTranslation()
  const id      = patient.identite
  const hasSevereAllergie = patient.allergies.some(a => a.gravite === 'SEVERE')
  const critiques = patient.alertesMedicales.filter(a => a.gravite === 'CRITIQUE')

  // Photo patient — aperçu local instantané + upload serveur (persistant)
  const [photo, setPhoto] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadPhoto = useUploadPatientPhoto(patient.id)
  useEffect(() => { setPhoto(null) }, [patient.id]) // réinitialise au changement de patient

  // Photo affichée : aperçu local prioritaire, sinon photo persistée.
  // photoUrl est une data URL Base64 (stockée en base) → utilisable directement.
  const displayPhoto = photo ?? id?.photoUrl ?? null

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file) // aperçu immédiat
    uploadPhoto.mutate(file)    // persistance serveur
  }

  return (
    <div style={{ padding: onBack ? '14px 16px' : '24px', display: 'flex', flexDirection: onBack ? 'column' : 'row', gap: onBack ? '16px' : '24px', height: '100%', overflowY: 'auto', alignItems: onBack ? 'stretch' : 'flex-start' }}>

      {onBack && (
        <button onClick={onBack} title={t('common.back')} aria-label={t('common.back')}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px 6px 8px', borderRadius: 9999, background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)', cursor: 'pointer', color: 'var(--texte-secondaire)', fontSize: 13, fontWeight: 600 }}>
          <ChevronLeft size={18} /> {t('common.back')}
        </button>
      )}

      {/* ── Colonne gauche : photo + action ──────────────────────────────── */}
      <div style={{ width: onBack ? '100%' : 210, maxWidth: onBack ? 200 : undefined, alignSelf: onBack ? 'center' : 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Carte photo (carré) + bouton caméra en bas à droite */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '100%', aspectRatio: '1 / 1', borderRadius: 'var(--radius-xl)', overflow: 'hidden',
            background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {displayPhoto
              ? <img src={displayPhoto} alt={t('patients.patientPhoto')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Users size={56} style={{ color: 'var(--texte-tertiaire)', opacity: 0.4 }} />}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadPhoto.isPending}
            aria-label={displayPhoto ? t('patients.changePhoto') : t('patients.addPhoto')}
            title={displayPhoto ? t('patients.changePhoto') : t('patients.addPhoto')}
            style={{
              position: 'absolute', right: -6, bottom: -6,
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--ap-400)', color: '#fff',
              border: '2px solid var(--fond-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: uploadPhoto.isPending ? 'wait' : 'pointer',
              opacity: uploadPhoto.isPending ? 0.7 : 1,
              boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)',
            }}
          >
            <Camera size={16} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
        </div>
        {/* Action principale — sous la photo */}
        <Button
          onClick={onOpen}
          style={{ width: '100%', background: 'var(--ap-400)', color: '#fff', fontSize: '13px', height: '38px', gap: '6px', justifyContent: 'center' }}
        >
          {t('patients.openFullRecord')}
          <ChevronRight size={14} />
        </Button>
      </div>

      {/* ── Colonne droite : informations détaillées ─────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Identité */}
        <div>
          <p style={{ fontWeight: '700', fontSize: '17px', color: 'var(--texte-primaire)', margin: 0 }}>
            {id ? `${id.prenom} ${id.nom}` : '—'}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: '3px 0 0', fontFamily: 'monospace' }}>
            {patient.numeroPatient}
          </p>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <CategorieBadge code={patient.categoriePatient.code} libelle={patient.categoriePatient.libelle} />
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
              {patient.siteCreation.libelle.replace('Centre Médico-Social ', '')}
            </span>
          </div>
        </div>

      {/* Infos rapides */}
      {id && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <InfoChip label={t('patients.infoAge')} value={t('patients.infoYears', { count: calcAge(id.dateNaissance) })} />
          <InfoChip label={t('patients.infoSex')} value={id.sexe === 'M' ? t('patients.sexMale') : t('patients.sexFemale')} />
          {id.telephone && <InfoChip label={t('patients.infoPhone')} value={id.telephone} colSpan />}
        </div>
      )}

      {/* Allergies sévères */}
      {(hasSevereAllergie || patient.allergies.length > 0) && (
        <div style={{
          background: hasSevereAllergie ? 'var(--erreur-fond)' : 'var(--avert-fond)',
          border: `1px solid ${hasSevereAllergie ? 'var(--erreur-bordure)' : 'var(--avert-bordure)'}`,
          borderRadius: '8px', padding: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <AlertTriangle size={13} style={{ color: hasSevereAllergie ? 'var(--erreur-accent)' : 'var(--avert-accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: hasSevereAllergie ? 'var(--erreur-texte)' : 'var(--avert-texte)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('patients.allergiesCount', { count: patient.allergies.length })}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {patient.allergies.map(a => (
              <div key={a.id} style={{ fontSize: '12px', color: 'var(--texte-primaire)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{a.substance}</span>
                <GravitePill gravite={a.gravite} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertes critiques */}
      {critiques.length > 0 && (
        <div style={{ background: 'var(--erreur-fond)', border: '1px solid var(--erreur-bordure)', borderRadius: '8px', padding: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--erreur-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={12} /> {t('patients.criticalAlerts')}
          </p>
          {critiques.map(a => (
            <p key={a.id} style={{ fontSize: '12px', color: 'var(--texte-primaire)', margin: '4px 0 0' }}>{a.message}</p>
          ))}
        </div>
      )}

      {/* Statut */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <StatutBadge statut={patient.statut} />
        <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
          {t('patients.createdOn', { date: formatDate(patient.createdAt) })}
        </span>
      </div>

      </div>{/* fin colonne droite */}
    </div>
  )
}

function InfoChip({ label, value, colSpan }: { label: string; value: string; colSpan?: boolean }) {
  return (
    <div style={{ background: 'var(--fond-surface-2)', borderRadius: '6px', padding: '8px 10px', gridColumn: colSpan ? 'span 2' : undefined }}>
      <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--texte-tertiaire)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: '13px', color: 'var(--texte-primaire)', margin: 0 }}>{value}</p>
    </div>
  )
}

function GravitePill({ gravite }: { gravite: string }) {
  const { t } = useTranslation()
  const cfg = {
    SEVERE: { bg: 'var(--erreur-fond)',  text: 'var(--erreur-texte)'  },
    MODERE: { bg: 'var(--avert-fond)',   text: 'var(--avert-texte)'   },
    FAIBLE: { bg: 'var(--succes-fond)',  text: 'var(--succes-texte)'  },
  }[gravite] ?? { bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)' }
  const label = {
    SEVERE: t('patients.graviteSevere'),
    MODERE: t('patients.graviteModere'),
    FAIBLE: t('patients.graviteFaible'),
  }[gravite] ?? gravite
  return (
    <span style={{ fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '9999px', background: cfg.bg, color: cfg.text }}>
      {label}
    </span>
  )
}

// ── Ligne patient ─────────────────────────────────────────────────────────────

function PatientRow({
  patient, selected, onClick,
}: {
  patient:  PatientListItem
  selected: boolean
  onClick:  () => void
}) {
  const { t } = useTranslation()
  const id  = patient.identite
  const hasCritical = patient.allergies.some(a => a.gravite === 'SEVERE') ||
                      patient.alertesMedicales.some(a => a.gravite === 'CRITIQUE')

  return (
    <div
      onClick={onClick}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '12px',
        padding:       '12px 16px',
        cursor:        'pointer',
        borderBottom:  '1px solid var(--bordure-legere)',
        background:    selected ? 'var(--ap-50)' : 'transparent',
        borderLeft:    selected ? '3px solid var(--ap-500)' : '3px solid transparent',
        transition:    'background 0.1s',
      }}
    >
      {/* Avatar + indicateur critique */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {id ? (
          <PatientAvatar nom={id.nom} prenom={id.prenom} code={patient.categoriePatient.code} size={38} photoUrl={id.photoUrl} />
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--fond-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={16} style={{ color: 'var(--texte-tertiaire)' }} />
          </div>
        )}
        {hasCritical && (
          <div style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: 'var(--erreur-accent)', border: '2px solid var(--fond-surface)' }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {id ? `${id.prenom} ${id.nom}` : patient.numeroPatient}
          </span>
          {patient.statut !== 'ACTIF' && (
            <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', fontWeight: '500' }}>
              {patient.statut === 'ARCHIVE' ? t('patients.statusSuffixArchived') : patient.statut === 'DECEDE' ? t('patients.statusSuffixDeceased') : t('patients.statusSuffixMerged')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontFamily: 'monospace' }}>{patient.numeroPatient}</span>
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>·</span>
          <CategorieBadge code={patient.categoriePatient.code} libelle={patient.categoriePatient.libelle} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginTop: '2px' }}>
          {id ? t('patients.infoYears', { count: calcAge(id.dateNaissance) }) : '—'}
          {' · '}
          {patient.siteCreation.libelle.replace('Centre Médico-Social ', '')}
        </div>
      </div>

      <ChevronRight size={13} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export function PatientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { has }  = usePermissions()
  // Création manuelle réservée au rôle administratif (Agent RH) pour les ayants
  // droit / sous-traitants. Le flux clinique normal crée le dossier au TRIAGE.
  // `sous_traitant.create` discrimine l'Agent RH (les soignants ne l'ont pas).
  const canCreate = has('sous_traitant.create')
  const isCompact = useIsCompact()

  const [search,    setSearch]   = usePersistedState('patients', 'search', '')
  const [categorie, setCategorie] = usePersistedState('patients', 'categorie', 'all')
  const [statut,    setStatut]   = usePersistedState('patients', 'statut', 'ACTIF')
  const [selected,  setSelected] = usePersistedState<string | null>('patients', 'selected', null)
  const [drawerOpen, setDrawer]  = useState(false)

  const { data: categories = [] } = useCategoriesPatient()

  const { data: patients = [], isLoading } = usePatients({
    statut:      statut    !== 'all' ? statut    : undefined,
    categorieId: categorie !== 'all' ? categorie : undefined,
  })

  const filtered = useMemo(() => {
    return patients.filter(p => {
      if (statut !== 'all' && p.statut !== statut) return false
      if (search) {
        const q    = search.toLowerCase()
        const full = `${p.identite?.nom ?? ''} ${p.identite?.prenom ?? ''} ${p.numeroPatient}`.toLowerCase()
        if (!full.includes(q)) return false
      }
      return true
    })
  }, [patients, search, statut])

  const pagination = usePagination(filtered, useRowsPerPage())
  const selectedPatient = filtered.find(p => p.id === selected) ?? null

  // ── Largeur redimensionnable du panneau liste (persistante) ──────────────
  // Minimum fixe suffisant pour afficher n° dossier + badge sans troncature.
  const LIST_MIN = 480, LIST_MAX = 720
  const [listWidth, setListWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('patients:listWidth'))
    return saved >= LIST_MIN && saved <= LIST_MAX ? saved : LIST_MIN
  })
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: listWidth }
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const next = Math.max(LIST_MIN, Math.min(LIST_MAX, d.startW + (ev.clientX - d.startX)))
      setListWidth(next)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      setListWidth(w => { localStorage.setItem('patients:listWidth', String(w)); return w })
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{`
        .patients-resizer:hover > span,
        .patients-resizer:active > span { background: var(--ap-400) !important; }
      `}</style>

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div style={{ padding: 'var(--espace-4) var(--espace-6) var(--espace-4)', flexShrink: 0, borderBottom: '1px solid var(--bordure-legere)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--ap-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <Users size={16} style={{ color: 'var(--ap-600)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-h2)', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0 }}>{t('patients.pageTitle')}</h1>
              <p style={{ fontSize: '13px', color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
                {isLoading ? '…' : t(filtered.length > 1 ? 'patients.patientCountPlural' : 'patients.patientCountSingular', { count: filtered.length })}
                {statut !== 'all' ? ` · ${statut === 'ACTIF' ? t('patients.filterActifs') : statut}` : ''}
              </p>
            </div>
          </div>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setDrawer(true)}
              title={t('patients.newBeneficiaryTooltip')}
              style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '13px', height: '34px', gap: '6px' }}
            >
              <Plus size={14} /> {t('patients.newBeneficiary')}
            </Button>
          )}
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '340px' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', pointerEvents: 'none' }} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('patients.searchPlaceholder')}
              style={{ paddingLeft: 32, paddingRight: search ? 32 : 12, height: 34, fontSize: '13px', background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)', borderRadius: 6 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)', display: 'flex' }}>
                <X size={12} />
              </button>
            )}
          </div>

          <div style={{ width: 200 }}>
            <SelectBox
              size="sm"
              value={categorie}
              onChange={setCategorie}
              aria-label={t('patients.filterByCategory')}
              options={[
                { value: 'all', label: t('patients.allCategories') },
                ...categories.map(c => ({ value: c.id, label: c.libelle })),
              ]}
            />
          </div>
          <div style={{ width: 160 }}>
            <SelectBox
              size="sm"
              value={statut}
              onChange={setStatut}
              aria-label={t('patients.filterByStatus')}
              options={[
                { value: 'ACTIF',   label: t('patients.statusActive')   },
                { value: 'ARCHIVE', label: t('patients.statusArchived') },
                { value: 'all',     label: t('patients.statusAll')      },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ── Corps split panel ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Panneau liste — colonne fixe (bureau) / pleine largeur cachée si un dossier est ouvert (compact) */}
        {(!isCompact || !selectedPatient) && (
        <div style={{
          width:        isCompact ? '100%' : listWidth,
          flexShrink:   0,
          display:      'flex',
          flexDirection: 'column',
          minHeight:    0,
        }}>
          {/* Zone scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '8px' }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 8px', borderRadius: 8, opacity: 1 - i * 0.08 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--fond-surface-2)', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ height: 12, borderRadius: 4, background: 'var(--fond-surface-2)', width: '55%' }} />
                      <div style={{ height: 10, borderRadius: 4, background: 'var(--fond-surface-2)', width: '30%' }} />
                    </div>
                    <div style={{ width: 48, height: 18, borderRadius: 99, background: 'var(--fond-surface-2)' }} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '32px' }}>
                <EmptyState
                  icon={<Users size={20} />}
                  title={search ? t('patients.emptyNoMatch') : categorie !== 'all' ? t('patients.emptyNoneInCategory') : t('patients.emptyNoneRegistered')}
                  description={search ? t('patients.emptySearchHint') : undefined}
                  action={canCreate && !search ? (
                    <Button size="sm" onClick={() => setDrawer(true)} style={{ background: 'var(--ap-500)', color: '#fff', fontSize: '12px' }}>
                      {t('patients.registerPatient')}
                    </Button>
                  ) : undefined}
                />
              </div>
            ) : (
              pagination.pageData.map(p => (
                <PatientRow
                  key={p.id}
                  patient={p}
                  selected={p.id === selected}
                  onClick={() => setSelected(p.id === selected ? null : p.id)}
                />
              ))
            )}
          </div>

          {/* Pagination en bas */}
          {!isLoading && filtered.length > 0 && (
            <div style={{ padding: 'var(--espace-2)', borderTop: '1px solid var(--bordure-legere)', flexShrink: 0 }}>
              <PaginationBar {...pagination} attached />
            </div>
          )}
        </div>
        )}

        {/* Poignée de redimensionnement liste ↔ détail — bureau uniquement */}
        {!isCompact && (
        <div
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('patients.resizeList')}
          title={t('patients.resizeListTitle')}
          className="patients-resizer"
          style={{
            width: 7, flexShrink: 0, cursor: 'col-resize',
            display: 'flex', justifyContent: 'center',
            borderLeft: '1px solid var(--bordure-legere)',
            background: 'transparent',
          }}
        >
          <span aria-hidden="true" style={{ width: 2, alignSelf: 'stretch', background: 'transparent', transition: 'background 0.12s' }} />
        </div>
        )}

        {/* Panneau détail — pleine largeur (compact, si un dossier est sélectionné) */}
        {(!isCompact || selectedPatient) && (
        <div style={{ flex: 1, background: 'var(--fond-surface)', overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {selectedPatient ? (
            <PrivacyCurtain>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <PreviewPanel
                  patient={selectedPatient}
                  onOpen={() => navigate(`/patients/${selectedPatient.id}`)}
                  onBack={isCompact ? () => setSelected(null) : undefined}
                />
              </div>
            </PrivacyCurtain>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 'var(--espace-3)', padding: 'var(--espace-6)', textAlign: 'center',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: 'var(--fond-surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={24} style={{ color: 'var(--texte-tertiaire)' }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 'var(--font-size-body)', fontWeight: 600, color: 'var(--texte-secondaire)' }}>
                  {t('patients.noSelectionTitle')}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)', maxWidth: 280 }}>
                  {t('patients.noSelectionDescription')}
                </p>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Drawer création */}
      <CreerPatientDrawer
        open={drawerOpen}
        onClose={() => setDrawer(false)}
        onCreated={id => { setDrawer(false); navigate(`/patients/${id}`) }}
      />
    </div>
  )
}
