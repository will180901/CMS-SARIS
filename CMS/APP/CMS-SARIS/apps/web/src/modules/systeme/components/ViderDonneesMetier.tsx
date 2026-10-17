/**
 * ViderDonneesMetier — vider d'un geste TOUTES les données métier du centre (dossiers, visites,
 * consultations, ordonnances, bons, résultats, évacuations, suivis). C'est le geste de la mise en
 * service : le centre a vécu en mode Test, il repart à neuf avant d'ouvrir pour de bon.
 *
 * Irréversible. D'où, avant d'activer le bouton : ce qui partirait est montré en chiffres, la phrase
 * est à recopier, deux accusés sont à cocher (irréversible ; restauration de la base vérifiée) et le
 * mot de passe de l'administrateur est redemandé. Le serveur refuse de toute façon hors mode Test,
 * pendant une génération, et pour qui n'a pas le droit `systeme.vidage`.
 *
 * Les postes de bureau reçoivent l'ordre de vider leur copie ; tant qu'un poste ne l'a pas fait, ses
 * échanges sont refusés — la fenêtre dit quels postes sont concernés, et lesquels sont trop anciens
 * pour le faire seuls.
 */
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Eraser, TriangleAlert } from 'lucide-react'
import { Button, Card, CheckBox, Field, Modal, TextInput } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { ApiError } from '@/lib/api'
import { formatDateTime, formatNumber } from '@/lib/intl'
import { usePermissions } from '@/hooks/usePermissions'
import { useEtatVidage, useViderDonnees } from '../hooks/useVidage'
import type { EtatVidage } from '../api/vidage.api'

function codeDe(e: unknown): string | null {
  if (e instanceof ApiError && typeof e.body === 'object' && e.body !== null && 'code' in e.body) {
    const c = (e.body as { code: unknown }).code
    return typeof c === 'string' ? c : null
  }
  return null
}

function messageDe(e: unknown): string {
  return e instanceof ApiError ? e.serverMessage : (e as Error).message
}

export function ZoneVider() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const autorise = has('systeme.vidage')
  const { data: etat } = useEtatVidage(autorise)
  const [ouvert, setOuvert] = useState(false)
  if (!autorise || !etat) return null

  return (
    <Card padding="none">
      <Card.Header
        icon={<Eraser size={14} />}
        title={t('vidage.titre')}
        subtitle={t('vidage.sousTitre')}
        tone="error"
      />
      <Card.Body padding="md">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--espace-4)' }}>
          <Liste titre={t('vidage.part')} elements={t('vidage.partListe').split('|')} />
          <Liste titre={t('vidage.reste')} elements={t('vidage.resteListe').split('|')} />
        </div>

        <p style={{ margin: 'var(--espace-4) 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
          {etat.lignes.total > 0
            ? t('vidage.resume', { n: formatNumber(etat.lignes.total), postes: etat.postes.total })
            : t('vidage.rienAVider')}
          {etat.dernier && (
            <>
              {' '}
              {t('vidage.dernier', {
                date: formatDateTime(etat.dernier.at),
                nom: etat.dernier.parNom ?? '—',
                n: formatNumber(etat.dernier.lignes),
              })}
            </>
          )}
        </p>

        <div style={{ marginTop: 'var(--espace-4)', display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', flexWrap: 'wrap' }}>
          <Button variant="danger" leftIcon={<Eraser size={15} />} disabled={!etat.disponible} onClick={() => setOuvert(true)}>
            {t('vidage.bouton')}
          </Button>
          {!etat.disponible && etat.raison && (
            <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', maxWidth: 520 }}>{etat.raison}</span>
          )}
        </div>
      </Card.Body>

      {/* Monté à chaque ouverture : rien de ce qui est saisi (phrase, mot de passe) ne survit à la fenêtre. */}
      {ouvert && <Fenetre etat={etat} onClose={() => setOuvert(false)} />}
    </Card>
  )
}

function Liste({ titre, elements }: { titre: string; elements: string[] }) {
  return (
    <div>
      <p style={{ margin: '0 0 var(--espace-2)', fontSize: 'var(--font-size-label)', fontWeight: 700, color: 'var(--texte-secondaire)' }}>
        {titre}
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 2, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
        {elements.map((e) => <li key={e}>{e}</li>)}
      </ul>
    </div>
  )
}

function Fenetre({ etat, onClose }: { etat: EtatVidage; onClose: () => void }) {
  const { t } = useTranslation()
  const vider = useViderDonnees()
  const [phrase, setPhrase] = useState('')
  const [irreversible, setIrreversible] = useState(false)
  const [restauration, setRestauration] = useState(false)
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const tables = useMemo(() => [...etat.lignes.tables].sort((a, b) => b.n - a.n), [etat.lignes.tables])
  const anciens = etat.postes.liste.filter((p) => !p.comprend)
  const phraseJuste = phrase.trim() === etat.phrase
  const pret = phraseJuste && irreversible && restauration && motDePasse.length > 0

  function valider(e?: FormEvent) {
    e?.preventDefault()
    if (!pret || vider.isPending) return
    setErreur(null)
    vider.mutate(
      { motDePasse, confirmation: phrase.trim(), irreversible, restaurationVerifiee: restauration },
      {
        onSuccess: (r) => {
          onClose()
          toast.success(t('vidage.fait', { n: formatNumber(r.lignes), postes: r.postes }))
        },
        onError: (err) => {
          const code = codeDe(err)
          if (code === 'MOT_DE_PASSE_INCORRECT') {
            setErreur(t('vidage.motDePasseFaux'))
            setMotDePasse('')
          } else {
            // Mode quitté, génération démarrée, échanges en cours… : le serveur dit pourquoi.
            toast.error(messageDe(err))
            onClose()
          }
        },
      },
    )
  }

  return (
    <Modal
      icon={<Eraser size={18} />}
      tone="error"
      title={t('vidage.modaleTitre')}
      width={620}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" leftIcon={<Eraser size={15} />} loading={vider.isPending} disabled={!pret} onClick={() => valider()}>
            {t('vidage.confirmer')}
          </Button>
        </>
      }
    >
      <form onSubmit={valider} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
          {t('vidage.modaleCorps', { n: formatNumber(etat.lignes.total) })}
        </p>

        {/* Ce qui partirait, table par table */}
        {tables.length > 0 && (
          <div style={{
            maxHeight: 150, overflow: 'auto', padding: 'var(--espace-2) var(--espace-3)',
            border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-md)', background: 'var(--fond-surface-2)',
          }}>
            {[...tables, ...etat.lignes.autres].map((x) => (
              <div key={'modele' in x ? x.modele : x.cle} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--espace-3)', fontSize: 'var(--font-size-body-sm)' }}>
                <span style={{ color: 'var(--texte-secondaire)' }}>
                  {'modele' in x ? t(`donneesTest.modeles.${x.modele}`, { defaultValue: x.libelle }) : t(`donneesTest.autres.${x.cle}`, { defaultValue: x.libelle })}
                </span>
                <strong style={{ color: 'var(--texte-primaire)', fontVariantNumeric: 'tabular-nums' }}>{formatNumber(x.n)}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Les postes de bureau */}
        {etat.postes.total > 0 && (
          <div style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', lineHeight: 1.55 }}>
            <p style={{ margin: 0 }}>
              {t('vidage.postes', { total: etat.postes.total, enLigne: etat.postes.enLigne })}
            </p>
            {anciens.length > 0 && (
              <p style={{ margin: 'var(--espace-2) 0 0', display: 'flex', gap: 6, alignItems: 'flex-start', color: 'var(--avert-texte)' }}>
                <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 3 }} />
                <span>{t('vidage.postesAnciens', { noms: anciens.map((p) => p.libelle).join(', '), n: anciens.length })}</span>
              </p>
            )}
          </div>
        )}

        <Field label={t('vidage.phraseLabel', { phrase: etat.phrase })} hint={t('vidage.phraseAide')}>
          {(id) => (
            <TextInput
              id={id} autoComplete="off" autoFocus spellCheck={false}
              value={phrase} placeholder={etat.phrase}
              onChange={(e) => setPhrase(e.target.value.toUpperCase())}
            />
          )}
        </Field>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
          <Accord checked={irreversible} onChange={setIrreversible}>{t('vidage.accuseIrreversible')}</Accord>
          <Accord checked={restauration} onChange={setRestauration}>{t('vidage.accuseRestauration')}</Accord>
        </div>

        <Field label={t('vidage.motDePasse')} hint={t('vidage.motDePasseAide')} error={erreur}>
          {(id) => (
            <TextInput
              id={id} type="password" autoComplete="current-password"
              value={motDePasse} invalid={!!erreur}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  )
}

function Accord({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--espace-2)', cursor: 'pointer', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
      <span style={{ marginTop: 2 }}><CheckBox checked={checked} onChange={onChange} aria-label={typeof children === 'string' ? children : undefined} /></span>
      <span>{children}</span>
    </label>
  )
}
