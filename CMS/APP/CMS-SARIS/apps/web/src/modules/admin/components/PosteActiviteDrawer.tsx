/**
 * PosteActiviteDrawer — la fiche d'un poste côté ÉCHANGES : ce qu'il a envoyé, ce qui a
 * réussi, ce qui a été refusé ou tranché, et la chronologie de ses échanges.
 *
 * Panneau latéral droit, comme le détail d'une entrée du journal d'audit : on y arrive
 * depuis une ligne du tableau d'activité (UNE ligne par poste) sans quitter la page.
 *
 * Il ne montre JAMAIS le contenu des fiches refusées (ce sont des dossiers patients entiers,
 * et le serveur ne les envoie pas) : la raison du refus suffit à superviser. La fiche
 * elle-même reste dans la base du poste.
 *
 * Les décisions sur le flux (suspendre le poste, forcer une resynchronisation complète)
 * se prennent depuis cette même fiche : on y lit ce que le poste a fait, et on y décide.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { MonitorSmartphone, ChevronLeft, ChevronRight, CheckCircle2, History, X } from 'lucide-react'
import { Button, IconButton, StatusPill, Skeleton, EmptyState } from '@/components/saris'
import { DESKTOP_TITLEBAR_H } from '@/components/layout/DesktopTitleBar'
import { isDesktop } from '@/lib/desktop'
import { formatDateTime, formatNumber } from '@/lib/intl'
import { labelRole } from '@/config/labels'
import { usePermissions } from '@/hooks/usePermissions'
import { useBilanPoste, useConflitsPoste, useSyncActivite } from '../hooks/useSync'
import type { TypeConflitPoste } from '../api/sync.api'
import { etatDuPoste, libelleEntite, relative } from './relatif'
import { PastilleEtat } from './PastilleEtat'
import { ControleFluxPoste } from './ControleFluxPoste'

const TAILLE_A_REVOIR = 5
const TAILLE_CHRONO = 8

// ── Briques d'affichage ───────────────────────────────────────────────────────

function Section({ titre, badge, actions, children }: {
  titre: string; badge?: number; actions?: ReactNode; children: ReactNode
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
        <h3 style={{
          margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--texte-tertiaire)',
        }}>
          {titre}
        </h3>
        {!!badge && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18,
            padding: '0 5px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
            background: 'var(--avert-fond)', color: 'var(--avert-texte)',
          }}>
            {formatNumber(badge)}
          </span>
        )}
        {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
      </div>
      {children}
    </section>
  )
}

type TonTuile = 'neutre' | 'succes' | 'avert' | 'erreur'
const TONS_TUILE: Record<Exclude<TonTuile, 'neutre'>, { fond: string; texte: string }> = {
  succes: { fond: 'var(--succes-fond)', texte: 'var(--succes-texte)' },
  avert:  { fond: 'var(--avert-fond)',  texte: 'var(--avert-texte)' },
  erreur: { fond: 'var(--erreur-fond)', texte: 'var(--erreur-texte)' },
}

/** Un chiffre du bilan. Les tons d'alerte ne s'allument que s'il y a quelque chose à signaler. */
function Tuile({ label, valeur, ton = 'neutre' }: { label: string; valeur: number; ton?: TonTuile }) {
  const c = ton === 'neutre' ? null : TONS_TUILE[ton]
  return (
    <div style={{
      padding: 'var(--espace-3)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--bordure-legere)', background: c ? c.fond : 'var(--fond-surface)',
    }}>
      <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: c ? c.texte : 'var(--texte-tertiaire)' }}>
        {label}
      </p>
      <p style={{
        margin: '2px 0 0', fontSize: 20, fontWeight: 700, lineHeight: 1.2,
        color: c ? c.texte : 'var(--texte-primaire)', fontVariantNumeric: 'tabular-nums',
      }}>
        {formatNumber(valeur)}
      </p>
    </div>
  )
}

function Puces<T extends string>({ valeur, onChange, options }: {
  valeur: T; onChange: (v: T) => void; options: { key: T; label: string }[]
}) {
  return (
    <div style={{
      display: 'flex', gap: 3, padding: 3, borderRadius: 'var(--radius-md)',
      background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)',
    }}>
      {options.map(o => (
        <button
          key={o.key || 'tout'} type="button" onClick={() => onChange(o.key)} aria-pressed={valeur === o.key}
          style={{
            padding: '3px 9px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            fontSize: 'var(--font-size-caption)', fontWeight: 600,
            background: valeur === o.key ? 'var(--fond-surface)' : 'transparent',
            color: valeur === o.key ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)',
            boxShadow: valeur === o.key ? 'var(--ombre-1)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Pager({ page, pageSize, total, onPage }: {
  page: number; pageSize: number; total: number; onPage: (p: number) => void
}) {
  const { t } = useTranslation()
  if (total <= pageSize) return null
  const derniere = Math.ceil(total / pageSize)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--espace-2)' }}>
      <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
        {t('admin.supFichePage', {
          debut: formatNumber((page - 1) * pageSize + 1),
          fin: formatNumber(Math.min(page * pageSize, total)),
          total: formatNumber(total),
        })}
      </span>
      <IconButton
        aria-label={t('admin.supFichePrec')} size="sm" icon={<ChevronLeft size={14} />}
        disabled={page <= 1} onClick={() => onPage(page - 1)}
      />
      <IconButton
        aria-label={t('admin.supFicheSuiv')} size="sm" icon={<ChevronRight size={14} />}
        disabled={page >= derniere} onClick={() => onPage(page + 1)}
      />
    </div>
  )
}

/** Cadre commun des listes (À revoir, chronologie) : rangées pleine largeur, zébrées. */
function Liste({ children, chargement }: { children: ReactNode; chargement: boolean }) {
  return (
    <div style={{
      border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      opacity: chargement ? 0.6 : 1, transition: 'opacity 0.12s',
    }}>
      {children}
    </div>
  )
}
const rangee = (i: number): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', padding: 'var(--espace-2) var(--espace-3)',
  background: i % 2 === 1 ? 'var(--fond-surface-2)' : 'transparent',
  borderTop: i === 0 ? 'none' : '1px solid var(--bordure-legere)',
})

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--espace-3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ width: 150, flexShrink: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)' }}>{children}</span>
    </div>
  )
}

// ── Le tiroir ─────────────────────────────────────────────────────────────────

export function PosteActiviteDrawer({ posteId, onClose }: { posteId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: fiche, isLoading, isError } = useBilanPoste(posteId)
  const { has } = usePermissions()
  const peutAgir = has('synchronisation.execute')
  // Une fenêtre (suspendre, resynchroniser) est ouverte par-dessus : Échap doit la fermer, elle,
  // et pas le tiroir qui est dessous.
  const [modaleOuverte, setModaleOuverte] = useState(false)
  // Horloge figée à l'ouverture : la relire à chaque rendu rendrait le composant impur.
  const [maintenant] = useState(() => Date.now())

  const [filtreRevoir, setFiltreRevoir] = useState<'' | TypeConflitPoste>('')
  const [pageRevoir, setPageRevoir] = useState(1)
  const { data: aRevoir, isFetching: chargeRevoir } = useConflitsPoste(posteId, {
    page: pageRevoir, pageSize: TAILLE_A_REVOIR, type: filtreRevoir || undefined,
  })

  const [filtreChrono, setFiltreChrono] = useState<'' | 'CONFLITS'>('')
  const [pageChrono, setPageChrono] = useState(1)
  const { data: chrono, isFetching: chargeChrono } = useSyncActivite({
    posteId, page: pageChrono, pageSize: TAILLE_CHRONO, statut: filtreChrono || undefined,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !modaleOuverte) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, modaleOuverte])

  const poste = fiche?.poste
  const b = fiche?.bilan
  const etat = poste ? etatDuPoste(poste, maintenant) : null
  const sousTitre = poste ? [poste.siteLibelle, poste.utilisateurNom].filter(Boolean).join(' · ') : ''
  const nbARevoir = b ? b.quarantaine + b.conflitsAuto : 0

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: isDesktop ? DESKTOP_TITLEBAR_H : 0, right: 0, bottom: 0, left: 0, zIndex: 990,
          background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)',
        }}
      />
      <div
        role="dialog" aria-modal="true" aria-label={poste?.libelle ?? t('admin.supPosteDetailTitle')}
        style={{
          position: 'fixed', top: isDesktop ? DESKTOP_TITLEBAR_H : 0, right: 0, bottom: 0, zIndex: 991,
          width: 600, maxWidth: '95vw', background: 'var(--fond-surface)', boxShadow: 'var(--ombre-4)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <div style={{
          padding: 'var(--espace-4) var(--espace-5)', borderBottom: '1px solid var(--bordure-legere)',
          display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-lg)', flexShrink: 0,
            background: 'var(--ap-50)', color: 'var(--ap-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MonitorSmartphone size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700, color: 'var(--texte-primaire)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {poste?.libelle ?? t('admin.supPosteDetailTitle')}
            </p>
            {sousTitre && (
              <p style={{
                margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {sousTitre}
              </p>
            )}
          </div>
          <IconButton aria-label={t('admin.close')} icon={<X size={16} />} onClick={onClose} />
        </div>

        {/* ── Corps ──────────────────────────────────────────────────────── */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 'var(--espace-5)',
          display: 'flex', flexDirection: 'column', gap: 'var(--espace-5)',
        }}>
          {isLoading ? (
            <div>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={48} style={{ marginBottom: 8 }} />)}</div>
          ) : isError || !poste || !b || !etat ? (
            <EmptyState icon={<MonitorSmartphone size={18} />} title={t('admin.supFicheErreur')} variant="subtle" />
          ) : (
            <>
              {/* Identité : qui est ce poste, et où en est-il */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
                <Ligne label={t('admin.supDetailStatus')}>
                  <PastilleEtat etat={etat} />
                </Ligne>
                <Ligne label={t('admin.supFicheSigneVie')}>{relative(poste.derniereSyncAt)}</Ligne>
                {poste.utilisateurNom && (
                  <Ligne label={t('admin.supDetailLastUser')}>
                    {poste.utilisateurRole ? `${poste.utilisateurNom} · ${labelRole(poste.utilisateurRole)}` : poste.utilisateurNom}
                  </Ligne>
                )}
                <Ligne label={t('admin.supDetailSite')}>{poste.siteLibelle ?? t('admin.supSiteInconnu')}</Ligne>
                <Ligne label={t('admin.supCtlVersion')}>{poste.versionApp ?? t('admin.supCtlVersionInconnue')}</Ligne>
              </div>

              {/* Contrôle du flux : suspendre, resynchroniser */}
              <Section titre={t('admin.supCtlTitre')}>
                <ControleFluxPoste poste={poste} peutAgir={peutAgir} onModale={setModaleOuverte} />
              </Section>

              {/* Bilan */}
              <Section titre={t('admin.supFicheBilan')}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--espace-2)' }}>
                  <Tuile label={t('admin.supFicheEchanges')} valeur={b.nbEchanges} />
                  <Tuile label={t('admin.supFicheReussis')} valeur={b.nbReussis} ton={b.nbReussis > 0 ? 'succes' : 'neutre'} />
                  <Tuile label={t('admin.supFicheAvecConflits')} valeur={b.nbAvecConflits} ton={b.nbAvecConflits > 0 ? 'avert' : 'neutre'} />
                  <Tuile label={t('admin.supFicheMutations')} valeur={b.nbMutations} />
                  <Tuile label={t('admin.supFicheRefuses')} valeur={b.quarantaine} ton={b.quarantaine > 0 ? 'erreur' : 'neutre'} />
                  <Tuile label={t('admin.supFicheTranches')} valeur={b.conflitsAuto} ton={b.conflitsAuto > 0 ? 'avert' : 'neutre'} />
                  <Tuile label={t('admin.supFicheEchanges24')} valeur={b.dernieres24h.echanges} />
                  <Tuile label={t('admin.supFicheMutations24')} valeur={b.dernieres24h.mutations} />
                </div>
                {b.premierEchangeAt && b.dernierEchangeAt && (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                    {t('admin.supFichePeriode')} : {formatDateTime(b.premierEchangeAt)} → {formatDateTime(b.dernierEchangeAt)}
                  </p>
                )}
              </Section>

              {/* À revoir : refus (quarantaine) et conflits tranchés */}
              <Section
                titre={t('admin.supFicheARevoir')} badge={nbARevoir}
                actions={nbARevoir > 0 ? (
                  <Puces
                    valeur={filtreRevoir}
                    onChange={(v) => { setFiltreRevoir(v); setPageRevoir(1) }}
                    options={[
                      { key: '', label: t('admin.supFiltreTout') },
                      { key: 'QUARANTAINE', label: t('admin.supFicheFiltreRefuses') },
                      { key: 'CONFLITS', label: t('admin.supFicheFiltreTranches') },
                    ]}
                  />
                ) : undefined}
              >
                {!aRevoir || aRevoir.items.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle2 size={18} />} title={t('admin.supFicheRienARevoir')}
                    description={t('admin.supFicheRienARevoirDesc')} variant="subtle"
                  />
                ) : (
                  <>
                    <Liste chargement={chargeRevoir}>
                      {aRevoir.items.map((c, i) => {
                        const refus = c.typeConflit === 'REJET_SERVEUR'
                        return (
                          <div key={c.id} style={rangee(i)}>
                            <StatusPill tone={refus ? 'error' : 'warning'} size="sm">
                              {refus ? t('admin.supFicheRefuse') : t('admin.supFicheConflit')}
                            </StatusPill>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>
                                {libelleEntite(c.entiteType)}
                              </p>
                              <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)', wordBreak: 'break-word' }}>
                                {refus
                                  ? (c.raison ?? t('admin.supFicheRaisonInconnue'))
                                  : c.typeConflit === 'LOCAL_GAGNE' ? t('admin.supFicheGagnantPoste') : t('admin.supFicheGagnantServeur')}
                              </p>
                            </div>
                            <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', whiteSpace: 'nowrap' }}>
                              {relative(c.createdAt)}
                            </span>
                          </div>
                        )
                      })}
                    </Liste>
                    <Pager page={pageRevoir} pageSize={TAILLE_A_REVOIR} total={aRevoir.total} onPage={setPageRevoir} />
                  </>
                )}
              </Section>

              {/* Chronologie des échanges */}
              <Section
                titre={t('admin.supFicheChrono')}
                actions={b.nbEchanges > 0 ? (
                  <Puces
                    valeur={filtreChrono}
                    onChange={(v) => { setFiltreChrono(v); setPageChrono(1) }}
                    options={[
                      { key: '', label: t('admin.supFiltreTout') },
                      { key: 'CONFLITS', label: t('admin.supActFiltreConflits') },
                    ]}
                  />
                ) : undefined}
              >
                {!chrono || chrono.items.length === 0 ? (
                  <EmptyState
                    icon={<History size={18} />} title={t('admin.supFicheChronoVide')}
                    description={t('admin.supFicheChronoVideDesc')} variant="subtle"
                  />
                ) : (
                  <>
                    <Liste chargement={chargeChrono}>
                      {chrono.items.map((j, i) => (
                        <div key={j.id} style={rangee(i)}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>
                              {formatDateTime(j.startedAt)}
                            </p>
                            <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                              {relative(j.startedAt)}
                            </p>
                          </div>
                          <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)', whiteSpace: 'nowrap' }}>
                            {t('admin.supFicheMutationsN', { count: j.nbMutations })}
                          </span>
                          {j.nbConflits > 0 && (
                            <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--avert-texte)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {t('admin.supFicheARevoirN', { count: j.nbConflits })}
                            </span>
                          )}
                          <StatusPill tone={j.statut === 'REUSSIE' ? 'success' : j.statut === 'CONFLITS' ? 'warning' : 'neutral'} size="sm">
                            {j.statut === 'REUSSIE' ? t('admin.supJournalSuccess') : j.statut === 'CONFLITS' ? t('admin.supJournalConflicts') : j.statut}
                          </StatusPill>
                        </div>
                      ))}
                    </Liste>
                    <Pager page={pageChrono} pageSize={TAILLE_CHRONO} total={chrono.total} onPage={setPageChrono} />
                  </>
                )}
              </Section>
            </>
          )}
        </div>

        {/* ── Pied ───────────────────────────────────────────────────────── */}
        <div style={{
          padding: 'var(--espace-3) var(--espace-5)', borderTop: '1px solid var(--bordure-legere)',
          background: 'var(--fond-surface)', flexShrink: 0,
        }}>
          <Button variant="secondary" onClick={onClose} fullWidth>{t('admin.close')}</Button>
        </div>
      </div>
    </>,
    document.body,
  )
}
