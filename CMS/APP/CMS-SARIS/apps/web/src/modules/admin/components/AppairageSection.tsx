/**
 * AppairageSection — l'onglet « Appairage » de la supervision.
 *
 * Un CODE D'APPAIRAGE remplace l'identifiant et le mot de passe pour installer un poste de bureau : la personne qui
 * installe ne connaît aucun mot de passe. Un administrateur prépare le code (un site, une durée, un nombre de postes),
 * le remet, puis suit ici où il en est. Le code n'est montré QU'UNE FOIS, à sa création : le serveur n'en garde que
 * l'empreinte. Un code perdu se remplace, il ne se retrouve pas.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Copy, KeyRound, Plus, ShieldAlert, XCircle } from 'lucide-react'
import {
  Button, EmptyState, Field, Modal, SelectBox, Skeleton, StatusPill, TextInput,
} from '@/components/saris'
import type { StatusTone } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { formatDateTime } from '@/lib/intl'
import { useSites } from '@/modules/referentiels/hooks/useReferentiels'
import {
  useAnnulerCodeAppairage, useCodesAppairage, useCreerCodeAppairage,
} from '../hooks/useSync'
import type { CodeAppairageCree, CodeAppairageVue, EtatCodeAppairage } from '../api/sync.api'

const TON_ETAT: Record<EtatCodeAppairage, StatusTone> = {
  ACTIF: 'success',
  EPUISE: 'info',
  EXPIRE: 'neutral',
  ANNULE: 'neutral',
}

const VALIDITES = [24, 72, 168] as const

const texteSecondaire: React.CSSProperties = {
  margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', lineHeight: 1.6,
}

export function AppairageSection({ canExecute }: { canExecute: boolean }) {
  const { t } = useTranslation()
  const { data: codes = [], isLoading } = useCodesAppairage()
  const annuler = useAnnulerCodeAppairage()
  const [creation, setCreation] = useState(false)
  const [resultat, setResultat] = useState<CodeAppairageCree | null>(null)
  const [aAnnuler, setAAnnuler] = useState<CodeAppairageVue | null>(null)

  function confirmerAnnulation() {
    if (!aAnnuler) return
    annuler.mutate(aAnnuler.id, {
      onSuccess: () => { setAAnnuler(null); toast.success(t('admin.appAnnulerFait')) },
      onError: () => toast.error(t('admin.appErreur')),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--espace-3)', flexWrap: 'wrap' }}>
        <p style={{ ...texteSecondaire, flex: 1, minWidth: 260 }}>{t('admin.appIntro')}</p>
        {canExecute && (
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setCreation(true)}>
            {t('admin.appPreparer')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton height={72} />
      ) : codes.length === 0 ? (
        <EmptyState
          icon={<KeyRound size={22} />}
          title={t('admin.appVideTitre')}
          description={t('admin.appVideAide')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
          {codes.map((c) => (
            <LigneCode key={c.id} code={c} peutAgir={canExecute} onAnnuler={() => setAAnnuler(c)} />
          ))}
        </div>
      )}

      {creation && (
        <CreerCodeModal
          onClose={() => setCreation(false)}
          onCree={(r) => { setCreation(false); setResultat(r) }}
        />
      )}
      {resultat && <CodeCreeModal code={resultat} onClose={() => setResultat(null)} />}

      {aAnnuler && (
        <Modal
          icon={<XCircle size={18} />} tone="warning" width={480}
          title={t('admin.appAnnulerTitre')} subtitle={aAnnuler.siteLibelle ?? undefined}
          onClose={() => setAAnnuler(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAAnnuler(null)}>{t('common.cancel')}</Button>
              <Button variant="primary" loading={annuler.isPending} onClick={confirmerAnnulation}>
                {t('admin.appAnnulerConfirmer')}
              </Button>
            </>
          }
        >
          <p style={texteSecondaire}>{t('admin.appAnnulerCorps')}</p>
        </Modal>
      )}
    </div>
  )
}

function LigneCode({ code, peutAgir, onAnnuler }: {
  code: CodeAppairageVue; peutAgir: boolean; onAnnuler: () => void
}) {
  const { t } = useTranslation()
  const libelleEtat: Record<EtatCodeAppairage, string> = {
    ACTIF: t('admin.appEtatActif'),
    EPUISE: t('admin.appEtatEpuise'),
    EXPIRE: t('admin.appEtatExpire'),
    ANNULE: t('admin.appEtatAnnule'),
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', flexWrap: 'wrap',
      padding: 'var(--espace-3)', border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)',
      background: 'var(--surface)', opacity: code.etat === 'ACTIF' ? 1 : 0.8,
    }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)' }}>
            {code.siteLibelle ?? t('admin.appSiteInconnu')}
          </span>
          <StatusPill tone={TON_ETAT[code.etat]}>{libelleEtat[code.etat]}</StatusPill>
          <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)' }}>
            {t('admin.appUsages', { faits: code.usagesFaits, max: code.usagesMax })}
          </span>
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
          {code.etat === 'ACTIF' && <>{t('admin.appExpire', { quand: formatDateTime(code.expireAt) })} · </>}
          {code.creeParNom ? t('admin.appCreePar', { nom: code.creeParNom, date: formatDateTime(code.createdAt) }) : formatDateTime(code.createdAt)}
          {code.note && <> · {code.note}</>}
        </p>
        {code.postes.length > 0 && (
          <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', lineHeight: 1.5 }}>
            {t('admin.appPostesLies', { liste: code.postes.map((p) => p.libelle).join(', ') })}
          </p>
        )}
      </div>
      {peutAgir && code.etat === 'ACTIF' && (
        <Button size="sm" variant="outline" onClick={onAnnuler}>{t('admin.appAnnuler')}</Button>
      )}
    </div>
  )
}

function CreerCodeModal({ onClose, onCree }: {
  onClose: () => void; onCree: (r: CodeAppairageCree) => void
}) {
  const { t } = useTranslation()
  const { data: sites = [] } = useSites()
  const creer = useCreerCodeAppairage()
  const [siteId, setSiteId] = useState('')
  const [nombre, setNombre] = useState('1')
  const [validite, setValidite] = useState('24')
  const [note, setNote] = useState('')

  const usagesMax = Number(nombre)
  const nombreValide = Number.isInteger(usagesMax) && usagesMax >= 1 && usagesMax <= 50

  function valider() {
    if (!siteId || !nombreValide) return
    creer.mutate(
      { siteId, usagesMax, validiteHeures: Number(validite), note: note.trim() || undefined },
      { onSuccess: onCree, onError: () => toast.error(t('admin.appErreur')) },
    )
  }

  return (
    <Modal
      icon={<KeyRound size={18} />} width={500}
      title={t('admin.appCreerTitre')} subtitle={t('admin.appCreerSous')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary" loading={creer.isPending}
            disabled={!siteId || !nombreValide} onClick={valider}
          >
            {t('admin.appCreer')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
        <Field label={t('admin.appSite')} required hint={t('admin.appSiteAide')}>
          {(id) => (
            <SelectBox
              id={id} value={siteId} onChange={setSiteId} fullWidth
              placeholder={t('admin.appSitePlaceholder')}
              options={sites.map((s) => ({ value: s.id, label: s.libelle, sublabel: s.code }))}
            />
          )}
        </Field>
        <div style={{ display: 'flex', gap: 'var(--espace-3)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <Field
              label={t('admin.appNombre')} required
              hint={t('admin.appNombreAide')}
              error={nombre !== '' && !nombreValide ? t('admin.appNombreErreur') : undefined}
            >
              {(id) => (
                <TextInput
                  id={id} type="number" min={1} max={50} value={nombre}
                  invalid={nombre !== '' && !nombreValide}
                  onChange={(e) => setNombre(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <Field label={t('admin.appValidite')} hint={t('admin.appValiditeAide')}>
              {(id) => (
                <SelectBox
                  id={id} value={validite} onChange={setValidite} fullWidth
                  options={VALIDITES.map((h) => ({
                    value: String(h),
                    label: h === 24 ? t('admin.appValidite24') : h === 72 ? t('admin.appValidite72') : t('admin.appValidite168'),
                  }))}
                />
              )}
            </Field>
          </div>
        </div>
        <Field label={t('admin.appNote')}>
          {(id) => (
            <TextInput
              id={id} value={note} maxLength={120} placeholder={t('admin.appNotePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}

/** Le code, EN CLAIR, une seule fois — et ce qu'il faut en faire. */
function CodeCreeModal({ code, onClose }: { code: CodeAppairageCree; onClose: () => void }) {
  const { t } = useTranslation()
  const [copie, setCopie] = useState(false)

  async function copier() {
    try {
      await navigator.clipboard.writeText(code.code)
      setCopie(true)
      toast.success(t('admin.appCopie'))
    } catch {
      toast.error(t('admin.appErreur'))
    }
  }

  return (
    <Modal
      icon={<CheckCircle2 size={18} />} tone="success" width={500}
      title={t('admin.appPretTitre')} subtitle={code.siteLibelle}
      onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>{t('admin.appPretFermer')}</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--espace-3)',
          padding: 'var(--espace-4)', borderRadius: 'var(--radius-lg)',
          background: 'var(--surface-sunken, var(--fond-secondaire))', border: '1px dashed var(--bordure)',
        }}>
          <span
            data-testid="code-appairage"
            style={{
              fontFamily: 'Consolas, "Courier New", monospace', fontSize: 28, fontWeight: 700,
              letterSpacing: 4, color: 'var(--texte-primaire)', userSelect: 'all',
            }}
          >
            {code.code}
          </span>
          <Button size="sm" variant="outline" leftIcon={<Copy size={13} />} onClick={copier}>
            {copie ? t('admin.appCopie') : t('admin.appCopier')}
          </Button>
        </div>
        <div style={{
          display: 'flex', gap: 'var(--espace-2)', padding: 'var(--espace-3)', borderRadius: 'var(--radius-md)',
          background: 'var(--avert-fond)', color: 'var(--avert-texte)',
          fontSize: 'var(--font-size-caption)', lineHeight: 1.5,
        }}>
          <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t('admin.appPretAvert')}</span>
        </div>
        <p style={texteSecondaire}>
          {t('admin.appPretValide', { date: formatDateTime(code.expireAt), max: code.usagesMax })}
        </p>
        <p style={texteSecondaire}>{t('admin.appPretUsage')}</p>
      </div>
    </Modal>
  )
}
