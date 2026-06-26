/**
 * DocumentsTab — tous les documents générés pour le patient, toutes consultations
 * confondues : ordonnances, bons d'examen, fiches d'évacuation.
 *
 * Permet de retrouver tout l'historique documentaire ET de le GÉRER :
 *   - Ouvrir la consultation source (édition / impression dans le contexte clinique)
 *   - Supprimer un document (confirmation + garde-fous serveur 409-safe)
 * La création / édition se fait dans la consultation (là où vit le cycle clinique).
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { FileText, Pill, FlaskConical, Ambulance, ChevronRight, Loader2, Trash2, Receipt } from 'lucide-react'
import { EmptyState, Modal, Button } from '@/components/saris'
import { usePatientDocuments } from '@/modules/consultation/hooks/useConsultation'
import { consultationApi } from '@/modules/consultation/api/consultation.api'
import { bonExamenApi } from '@/modules/bon-examen/api/bon-examen.api'
import { bonPharmacieApi } from '@/modules/bon-pharmacie/api/bon-pharmacie.api'
import { evacuationsApi } from '@/modules/sorties-critiques/api/sorties.api'
import { ApiError } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDate as intlFormatDate } from '@/lib/intl'
import type { PatientDocument } from '@/modules/consultation/api/consultation.api'
import type { PermissionCode } from '@cms-saris/types'

// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).
const TYPE_META: Record<PatientDocument['type'], { labelKey: string; icon: typeof FileText; tint: string; bg: string }> = {
  ORDONNANCE:       { labelKey: 'patients.docOrdonnance',      icon: Pill,         tint: 'var(--ap-600)',     bg: 'var(--ap-50)' },
  BON_EXAMEN:       { labelKey: 'patients.docBonExamen',       icon: FlaskConical, tint: 'var(--info-accent)', bg: 'var(--info-fond)' },
  BON_PHARMACIE:    { labelKey: 'patients.docBonPharmacie',    icon: Receipt,      tint: 'var(--succes-accent)', bg: 'var(--succes-fond)' },
  EVACUATION:       { labelKey: 'patients.docEvacuation',      icon: Ambulance,    tint: 'var(--erreur-accent)', bg: 'var(--erreur-fond)' },
}

// Permission requise pour supprimer chaque type (le serveur reste l'arbitre final).
const DELETE_PERM: Record<PatientDocument['type'], PermissionCode> = {
  ORDONNANCE:       'ordonnance.cancel',
  BON_EXAMEN:       'bon_examen.delete',
  BON_PHARMACIE:    'bon_pharmacie.delete',
  EVACUATION:       'evacuation.delete',
}

// Type de document -> vue à ouvrir dans la consultation (étape « Documents »).
const DOC_VIEW: Record<PatientDocument['type'], 'ordonnance' | 'examens-c' | 'sorties'> = {
  ORDONNANCE:       'ordonnance',
  BON_EXAMEN:       'examens-c',
  BON_PHARMACIE:    'ordonnance',
  EVACUATION:       'sorties',
}

function formatDate(iso: string) {
  return intlFormatDate(iso, { day: '2-digit', month: 'long', year: 'numeric' })
}

const FILTERS: { key: 'TOUS' | PatientDocument['type']; labelKey: string }[] = [
  { key: 'TOUS',             labelKey: 'patients.docFilterAll' },
  { key: 'ORDONNANCE',       labelKey: 'patients.docFilterOrdonnances' },
  { key: 'BON_EXAMEN',       labelKey: 'patients.docFilterBons' },
  { key: 'BON_PHARMACIE',    labelKey: 'patients.docFilterBonsPharmacie' },
  { key: 'EVACUATION',       labelKey: 'patients.docFilterEvacuations' },
]

export function DocumentsTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { has } = usePermissions()
  const { data: documents = [], isLoading } = usePatientDocuments(patientId)
  const [filtre, setFiltre] = useState<'TOUS' | PatientDocument['type']>('TOUS')
  const [confirmDoc, setConfirmDoc] = useState<PatientDocument | null>(null)

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const d of documents) c[d.type] = (c[d.type] ?? 0) + 1
    return c
  }, [documents])

  const filtered = filtre === 'TOUS' ? documents : documents.filter(d => d.type === filtre)

  function openSource(d: PatientDocument) {
    navigate('/consultations', { state: { openConsultationId: d.consultationId, openDocView: DOC_VIEW[d.type] } })
  }

  // Suppression — routage par type vers l'endpoint dédié (le serveur applique
  // ses garde-fous : 409 si le document n'est pas dans un état supprimable).
  const del = useMutation({
    mutationFn: async (d: PatientDocument) => {
      switch (d.type) {
        case 'ORDONNANCE':       await consultationApi.annulerOrdonnance(d.consultationId, d.id); return
        case 'BON_EXAMEN':       await bonExamenApi.remove(d.id); return
        case 'BON_PHARMACIE':    await bonPharmacieApi.remove(d.id); return
        case 'EVACUATION':       await evacuationsApi.supprimer(d.id); return
        default:                 throw new Error('Type non supprimable')
      }
    },
    onSuccess: (_res, d) => {
      qc.invalidateQueries({ queryKey: ['consultations', 'patient', patientId, 'documents'] })
      qc.invalidateQueries({ queryKey: ['consultations', d.consultationId] })
      qc.invalidateQueries({ queryKey: ['bons-examen'] })
      qc.invalidateQueries({ queryKey: ['bons-pharmacie'] })
      qc.invalidateQueries({ queryKey: ['evacuations'] })
      setConfirmDoc(null)
      toast.success(t('patients.docDeleted', { defaultValue: 'Document supprimé.' }))
    },
    onError: (e: unknown) => {
      toast.error(e instanceof ApiError ? e.serverMessage : t('patients.docDeleteError', { defaultValue: 'Suppression impossible.' }))
    },
  })

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <FileText size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--texte-primaire)' }}>
          {t('patients.generatedDocuments')}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', padding: '1px 7px', borderRadius: 99 }}>
          {t('patients.totalCount', { count: documents.length })}
        </span>
      </div>

      {/* Filtres par type */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const active = filtre === f.key
          const n = f.key === 'TOUS' ? documents.length : (counts[f.key] ?? 0)
          return (
            <button
              key={f.key}
              onClick={() => setFiltre(f.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 9999, cursor: 'pointer',
                fontSize: '12px', fontWeight: 600,
                border: `1px solid ${active ? 'var(--ap-400)' : 'var(--bordure-normale)'}`,
                background: active ? 'var(--ap-100)' : 'var(--fond-surface)',
                color: active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
              }}
            >
              {t(f.labelKey)}
              <span style={{ fontSize: '10px', opacity: 0.8 }}>{n}</span>
            </button>
          )
        })}
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: '13px' }}>{t('patients.loading')}</span>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<FileText size={20} />}
          title={filtre !== 'TOUS' ? t('patients.emptyDocumentsTyped') : t('patients.emptyDocuments')}
          variant="subtle"
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720 }}>
        {filtered.map(d => {
          const meta = TYPE_META[d.type]
          const Icon = meta.icon
          const canDelete = has(DELETE_PERM[d.type])
          return (
            <div
              key={`${d.type}-${d.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                borderRadius: 10, border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)',
                transition: 'border-color 0.12s, background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ap-300)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bordure-legere)' }}
            >
              {/* Zone cliquable : ouvrir la consultation source */}
              <button
                type="button"
                onClick={() => openSource(d)}
                title={t('patients.openSourceConsultation')}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  padding: '12px 14px', cursor: 'pointer', background: 'transparent', border: 'none', borderRadius: 10,
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: meta.bg, color: meta.tint,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--texte-primaire)' }}>{t(meta.labelKey)}</span>
                    <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>· {formatDate(d.date)}</span>
                    {d.site && (
                      <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)', borderRadius: 9999, padding: '1px 7px' }}>
                        {d.site}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--texte-secondaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.details || d.motif}
                  </p>
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                  padding: '3px 8px', borderRadius: 9999, flexShrink: 0,
                  background: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)',
                  border: '1px solid var(--bordure-legere)',
                }}>
                  {d.statut}
                </span>
                <ChevronRight size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
              </button>

              {/* Action : supprimer */}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDoc(d)}
                  title={t('patients.docDelete', { defaultValue: 'Supprimer le document' })}
                  style={{
                    flexShrink: 0, width: 34, height: 34, marginRight: 8, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--erreur-fond)'; e.currentTarget.style.color = 'var(--erreur-accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Confirmation de suppression */}
      {confirmDoc && (
        <Modal
          icon={<Trash2 size={16} />}
          title={t('patients.docDeleteTitle', { defaultValue: 'Supprimer ce document ?' })}
          subtitle={t(TYPE_META[confirmDoc.type].labelKey) + ' · ' + formatDate(confirmDoc.date)}
          width={460}
          onClose={() => { if (!del.isPending) setConfirmDoc(null) }}
          footer={<>
            <Button variant="secondary" onClick={() => setConfirmDoc(null)} disabled={del.isPending}>
              {t('common.cancel', { defaultValue: 'Annuler' })}
            </Button>
            <Button variant="danger" leftIcon={<Trash2 size={14} />} loading={del.isPending} onClick={() => del.mutate(confirmDoc)}>
              {t('patients.docDeleteConfirm', { defaultValue: 'Supprimer définitivement' })}
            </Button>
          </>}
        >
          <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
            {t('patients.docDeleteWarning', { defaultValue: "Cette action est définitive. Si le document est validé ou verrouillé, le serveur peut refuser la suppression (il faudra d'abord l'annuler dans la consultation)." })}
          </p>
        </Modal>
      )}
    </div>
  )
}
