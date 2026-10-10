/**
 * DiagnosticReseauCard — ce que le serveur voit de CETTE requête : l'adresse retenue pour
 * tracer la connexion, d'où elle vient, et les en-têtes posés par les relais réseau.
 *
 * Sert à vérifier, après un déploiement, que la VRAIE adresse des postes est lue (et non
 * celle d'un relais, ni une adresse que l'appelant a pu inventer). L'administrateur compare
 * l'adresse affichée à celle que lui donne un site « Quelle est mon adresse IP ».
 *
 * La localisation affichée est celle que l'on peut déduire d'une adresse : la ville de
 * l'opérateur, jamais le quartier — d'où la position de l'APPAREIL, relevée à la connexion.
 */

import { useTranslation } from 'react-i18next'
import { Network, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import { Card, Button, StatusPill, Skeleton } from '@/components/saris'
import { useDiagnosticReseau } from '../../hooks/useAdmin'
import type { DiagnosticReseau } from '../../api/admin.api'

const VERDICTS: Record<DiagnosticReseau['verdict'], { tone: 'success' | 'warning' | 'error' | 'info'; icone: React.ReactNode }> = {
  OK:              { tone: 'success', icone: <CheckCircle2 size={11} /> },
  LOCAL:           { tone: 'info',    icone: <Info size={11} /> },
  FALSIFIABLE:     { tone: 'warning', icone: <AlertTriangle size={11} /> },
  ADRESSE_INTERNE: { tone: 'error',   icone: <XCircle size={11} /> },
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--espace-3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ width: 190, flexShrink: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', wordBreak: 'break-all' }}>{children}</span>
    </div>
  )
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-caption)' }}>{children}</code>
)

export function DiagnosticReseauCard() {
  const { t } = useTranslation()
  const { data: d, isLoading, isFetching, refetch } = useDiagnosticReseau()

  const origine = !d ? '' : d.origine === 'ENTETE'
    ? t('position.reseau.origineENTETE', { entete: d.enteteConfigure })
    : d.origine === 'X_FORWARDED_FOR'
      ? t('position.reseau.origineXFF', { trust: d.trustProxy })
      : t('position.reseau.origineSOCKET')
  const vide = <span style={{ color: 'var(--texte-tertiaire)' }}>—</span>

  return (
    <Card>
      <Card.Header
        icon={<Network size={15} />} title={t('position.reseau.titre')} subtitle={t('position.reseau.sousTitre')}
        actions={
          <Button size="sm" variant="outline" leftIcon={<RefreshCw size={13} />} loading={isFetching} onClick={() => refetch()}>
            {t('position.reseau.actualiser')}
          </Button>
        }
      />
      <Card.Body padding="md">
        {isLoading || !d ? <Skeleton height={160} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
            <Ligne label={t('position.reseau.adresse')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Code>{d.ip ?? '—'}</Code>
                <StatusPill tone={VERDICTS[d.verdict].tone} dot={false} icon={VERDICTS[d.verdict].icone}>
                  {t(`position.reseau.verdict.${d.verdict}`)}
                </StatusPill>
              </span>
            </Ligne>
            <Ligne label={t('position.reseau.origine')}>{origine}</Ligne>
            <Ligne label={t('position.reseau.lieu')}>
              {d.localisation && d.localisation.label !== 'Localisation inconnue' ? d.localisation.label : vide}
              <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', wordBreak: 'normal' }}>
                {t('position.reseau.lieuNote')}
              </span>
            </Ligne>

            <div style={{ borderTop: '1px solid var(--bordure-legere)', paddingTop: 'var(--espace-3)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
              <span style={{ fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)' }}>
                {t('position.reseau.details')}
              </span>
              <Ligne label="CLIENT_IP_HEADER">{d.enteteConfigure ? <Code>{d.enteteConfigure}</Code> : vide}</Ligne>
              <Ligne label="TRUST_PROXY"><Code>{d.trustProxy}</Code></Ligne>
              <Ligne label="CF-Connecting-IP">{d.cfConnectingIp ? <Code>{d.cfConnectingIp}</Code> : vide}</Ligne>
              <Ligne label="True-Client-IP">{d.trueClientIp ? <Code>{d.trueClientIp}</Code> : vide}</Ligne>
              <Ligne label="X-Forwarded-For">{d.xForwardedFor ? <Code>{d.xForwardedFor}</Code> : vide}</Ligne>
              <Ligne label={t('position.reseau.socket')}>{d.adresseSocket ? <Code>{d.adresseSocket}</Code> : vide}</Ligne>
            </div>

            {(d.verdict === 'ADRESSE_INTERNE' || d.verdict === 'FALSIFIABLE') && (
              <p style={{
                margin: 0, padding: 'var(--espace-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-caption)', lineHeight: 1.5,
                background: 'var(--avert-fond)', color: 'var(--avert-texte)', border: '1px solid var(--avert-bordure)',
              }}>
                {t('position.reseau.aide')}
              </p>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
