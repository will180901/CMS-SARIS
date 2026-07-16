/**
 * DocumentsTab — tous les documents générés pour le patient, toutes consultations
 * confondues : ordonnances, bons d'examen, fiches d'évacuation.
 *
 * Permet de retrouver tout l'historique documentaire ET de le GÉRER :
 *   - Voir le document en lecture seule dans un TIROIR qui glisse de la droite
 *     (aperçu A4, `DossierDetailDrawer`) — la liste reste visible derrière,
 *     pas de navigation vers /consultations
 *   - Supprimer un document (confirmation + garde-fous serveur 409-safe)
 * La création / édition se fait dans la consultation (là où vit le cycle clinique).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { FileText, Pill, FlaskConical, Ambulance, ChevronRight, Loader2, Trash2, Receipt } from 'lucide-react'
import { EmptyState, Modal, Button } from '@/components/saris'
import { usePatientDocuments } from '@/modules/consultation/hooks/useConsultation'
import { consultationApi } from '@/modules/consultation/api/consultation.api'
import { bonExamenApi } from '@/modules/bon-examen/api/bon-examen.api'
import { bonPharmacieApi } from '@/modules/bon-pharmacie/api/bon-pharmacie.api'
import { ApiError } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import { useSessionStore } from '@/stores/session.store'
import { formatDate as intlFormatDate } from '@/lib/intl'
import { labelStatut } from '@/config/labels'
import { DossierDetailDrawer, targetForDocument } from './DossierDetailPanel'
import type { DossierDetailTarget } from './DossierDetailPanel'
import type { PatientDocument } from '@/modules/consultation/api/consultation.api'
import type { PermissionCode } from '@cms-saris/types'

// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).
const TYPE_META: Record<PatientDocument['type'], { labelKey: string; icon: typeof FileText; tint: string; bg: string }> = {
  ORDONNANCE:       { labelKey: 'patients.docOrdonnance',      icon: Pill,         tint: 'var(--ap-600)',     bg: 'var(--ap-50)' },
  BON_EXAMEN:       { labelKey: 'patients.docBonExamen',       icon: FlaskConical, tint: 'var(--info-accent)', bg: 'var(--info-fond)' },
  BON_PHARMACIE:    { labelKey: 'patients.docBonPharmacie',    icon: Receipt,      tint: 'var(--succes-accent)', bg: 'var(--succes-fond)' },
  EVACUATION:       { labelKey: 'patients.docEvacuation',      icon: Ambulance,    tint: 'var(--erreur-accent)', bg: 'var(--erreur-fond)' },
}

// Famille `labelStatut()` par type de document (aligné sur `labels.statut.*`).
const STATUT_FAMILLE: Record<PatientDocument['type'], string> = {
  ORDONNANCE:    'ordonnance',
  BON_EXAMEN:    'bon_examen',
  BON_PHARMACIE: 'bon_pharmacie',
  EVACUATION:    'evacuation',
}

// Permission requise pour supprimer chaque type (le serveur reste l'arbitre final).
const DELETE_PERM: Record<PatientDocument['type'], PermissionCode> = {
  ORDONNANCE:       'ordonnance.cancel',
  BON_EXAMEN:       'bon_examen.delete',
  BON_PHARMACIE:    'bon_pharmacie.delete',
  EVACUATION:       'evacuation.delete',
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
  const qc = useQueryClient()
  const { has } = usePermissions()
  const { data: documents = [], isLoading, isError } = usePatientDocuments(patientId)
  const [filtre, setFiltre] = useState<'TOUS' | PatientDocument['type']>('TOUS')
  const [confirmDoc, setConfirmDoc] = useState<PatientDocument | null>(null)
  const [detail, setDetail] = useState<DossierDetailTarget | null>(null)

  // Confidentialité (recueil §5) : la même restriction serveur qu'en Chronologie
  // s'applique ici (l'infirmier n'a accès qu'à la consultation EN COURS) — le
  // bandeau évite de laisser croire à un historique documentaire anormalement court.
  const roles = useSessionStore(s => s.user?.roles ?? [])
  const historiqueRestreint = roles.includes('INFIRMIER') && !roles.some(r => r === 'ADMIN_SYSTEME' || r === 'MEDECIN_CHEF')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const d of documents) c[d.type] = (c[d.type] ?? 0) + 1
    return c
  }, [documents])

  const filtered = filtre === 'TOUS' ? documents : documents.filter(d => d.type === filtre)

  // Suppression — routage par type vers l'endpoint dédié (le serveur applique
  // ses garde-fous : 409 si le document n'est pas dans un état supprimable).
  // EVACUATION exclue : gérable uniquement depuis la carte interactive (annulation,
  // suivi, suppression) ouverte par le clic sur la ligne — un seul endroit qui gère
  // tout son cycle de vie, plutôt que deux commandes de suppression concurrentes.
  const del = useMutation({
    mutationFn: async (d: PatientDocument) => {
      switch (d.type) {
        case 'ORDONNANCE':       await consultationApi.annulerOrdonnance(d.consultationId, d.id); return
        case 'BON_EXAMEN':       await bonExamenApi.remove(d.id); return
        case 'BON_PHARMACIE':    await bonPharmacieApi.remove(d.id); return
        default:                 throw new Error('Type non supprimable')
      }
    },
    onSuccess: (_res, d) => {
      qc.invalidateQueries({ queryKey: ['consultations', 'patient', patientId, 'documents'] })
      qc.invalidateQueries({ queryKey: ['consultations', d.consultationId] })
      qc.invalidateQueries({ queryKey: ['bons-examen'] })
      qc.invalidateQueries({ queryKey: ['bons-pharmacie'] })
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

      {historiqueRestreint && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          padding: '8px 12px', borderRadius: 8,
          background: 'var(--info-fond)', border: '1px solid var(--info-bordure)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--info-texte)' }}>{t('patients.tlHistoriqueRestreint')}</span>
        </div>
      )}

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

      {isError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--erreur-texte)', fontSize: '13px' }}>
          {t('patients.erreurChargement')}
        </div>
      )}

      {!isError && isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: '13px' }}>{t('patients.loading')}</span>
        </div>
      )}

      {!isError && !isLoading && filtered.length === 0 && (
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
          // EVACUATION exclue : suppression/annulation gérées depuis la carte
          // interactive ouverte au clic (un seul chemin de suppression, pas deux).
          const canDelete = d.type !== 'EVACUATION' && has(DELETE_PERM[d.type])
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
              {/* Zone cliquable : aperçu du document en place (même onglet) */}
              <button
                type="button"
                onClick={() => setDetail(targetForDocument(d.type, d.id, d.consultationId))}
                title={t('patients.viewDocument')}
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
                  {labelStatut(STATUT_FAMILLE[d.type], d.statut)}
                </span>
                <ChevronRight size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
              </button>

              {/* Action : supprimer */}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDoc(d)}
                  title={d.type === 'ORDONNANCE'
                    ? t('patients.docCancel', { defaultValue: "Annuler l'ordonnance" })
                    : t('patients.docDelete', { defaultValue: 'Supprimer le document' })}
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

      {/* Confirmation de suppression (ou d'annulation, pour une ordonnance — le
          serveur ne la supprime jamais réellement, il la marque ANNULEE pour
          conserver la traçabilité de la prescription). */}
      {confirmDoc && (
        <Modal
          icon={<Trash2 size={16} />}
          title={confirmDoc.type === 'ORDONNANCE'
            ? t('patients.docCancelTitle', { defaultValue: "Annuler cette ordonnance ?" })
            : t('patients.docDeleteTitle', { defaultValue: 'Supprimer ce document ?' })}
          subtitle={t(TYPE_META[confirmDoc.type].labelKey) + ' · ' + formatDate(confirmDoc.date)}
          width={460}
          onClose={() => { if (!del.isPending) setConfirmDoc(null) }}
          footer={<>
            <Button variant="secondary" onClick={() => setConfirmDoc(null)} disabled={del.isPending}>
              {t('common.cancel', { defaultValue: 'Annuler' })}
            </Button>
            <Button variant="danger" leftIcon={<Trash2 size={14} />} loading={del.isPending} onClick={() => del.mutate(confirmDoc)}>
              {confirmDoc.type === 'ORDONNANCE'
                ? t('patients.docCancelConfirm', { defaultValue: "Annuler l'ordonnance" })
                : t('patients.docDeleteConfirm', { defaultValue: 'Supprimer définitivement' })}
            </Button>
          </>}
        >
          <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
            {confirmDoc.type === 'ORDONNANCE'
              ? t('patients.docCancelWarning', { defaultValue: "L'ordonnance sera marquée annulée (traçabilité conservée) et ne sera plus délivrable. Si elle est verrouillée, le serveur peut refuser l'annulation." })
              : t('patients.docDeleteWarning', { defaultValue: "Cette action est définitive. Si le document est validé ou verrouillé, le serveur peut refuser la suppression (il faudra d'abord l'annuler dans la consultation)." })}
          </p>
        </Modal>
      )}

      {/* Tiroir de détail (glisse de la droite, la liste reste derrière) */}
      {detail && <DossierDetailDrawer target={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
