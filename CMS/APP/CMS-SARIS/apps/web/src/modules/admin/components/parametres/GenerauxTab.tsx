/**
 * GenerauxTab — paramètres SYSTÈME (réellement appliqués), groupés en cartes.
 * Édition par paramètre, validée par type + bornes côté backend.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Settings, RotateCcw, Save, Building2, ShieldCheck, KeyRound, Loader2, Lock, Clock,
} from 'lucide-react'
import {
  Card, Button, IconButton, StatusPill, EmptyState, Skeleton, TextInput, SelectBox,
} from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { useParametres, useUpdateParametre, useResetParametre } from '../../hooks/useAdmin'
import type { ParametreSysteme } from '../../api/admin.api'

const GROUP_ICONS: Record<string, React.ReactNode> = {
  'Établissement':               <Building2 size={15} />,
  'Sécurité & authentification': <ShieldCheck size={15} />,
  'Politique de mot de passe':   <KeyRound size={15} />,
}

/**
 * Mappe un nom de groupe backend (FR, stable) vers sa clé de titre i18n —
 * les mêmes libellés que la sous-nav (`settings.gen*`), pour que le titre de
 * carte suive la langue. Repli sur le nom brut si le groupe est inconnu.
 */
const GROUP_TITLE_KEYS: Record<string, string> = {
  'Sécurité & authentification': 'settings.genSecurity',
  'Politique de mot de passe':   'settings.genPassword',
  'Notifications':               'settings.genNotifications',
}

/** Rend UNE section de paramètres système (= un groupe), sélectionnée par la sous-nav. */
export function GenerauxTab({ canWrite, section }: { canWrite: boolean; section: string }) {
  const { t } = useTranslation()
  const { data: parametres = [], isLoading } = useParametres()
  const params = useMemo(() => parametres.filter(p => p.group === section), [parametres, section])

  if (isLoading) {
    return <Skeleton height={220} />
  }
  if (params.length === 0) {
    return <EmptyState icon={<Settings size={20} />} title={t('admin.emptySectionTitle')} description={t('admin.emptySectionDesc')} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
      {!canWrite && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
          padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-md)',
          background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)',
          color: 'var(--avert-texte)', fontSize: 'var(--font-size-caption)',
        }}>
          <Lock size={14} /> {t('admin.readOnlySystemParams')}
        </div>
      )}
      <Card>
        <Card.Header
          icon={GROUP_ICONS[section] ?? <Settings size={15} />}
          title={GROUP_TITLE_KEYS[section] ? t(GROUP_TITLE_KEYS[section]) : section}
          subtitle={`${params.length} ${params.length > 1 ? t('admin.parametersPlural') : t('admin.parameterSingular')}`}
        />
        <Card.Body padding="none">
          {params.map((p, i) => (
            <ParametreRow key={p.cle} param={p} canWrite={canWrite} last={i === params.length - 1} />
          ))}
        </Card.Body>
      </Card>
    </div>
  )
}

// ── Ligne paramètre ───────────────────────────────────────────────────────────

function ParametreRow({ param, canWrite, last }: {
  param: ParametreSysteme; canWrite: boolean; last: boolean
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const [val, setVal] = useState(param.valeur)
  const update = useUpdateParametre()
  const reset  = useResetParametre()

  useEffect(() => { setVal(param.valeur) }, [param.valeur])
  const dirty = val !== param.valeur

  async function save() { if (dirty) await update.mutateAsync({ cle: param.cle, valeur: val }) }
  async function doReset() { await reset.mutateAsync(param.cle) }

  // Libellé humain = description traduite (clé stable `params.<cle>`),
  // avec repli sur la description FR fournie par le backend.
  const label = t(`params.${param.cle}`, { defaultValue: param.description })

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 220px auto', gap: 'var(--espace-3)',
      alignItems: isCompact ? 'stretch' : 'center', padding: 'var(--espace-3) var(--espace-4)',
      borderBottom: last ? 'none' : '1px solid var(--bordure-legere)',
    }}>
      {/* Description */}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', fontWeight: 500, lineHeight: 1.4 }}>
          {label}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-overline)', color: 'var(--texte-tertiaire)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {param.modifie
            ? <StatusPill tone="warning" dot={false} size="sm">{t('admin.customized')}</StatusPill>
            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Lock size={10} /> {t('admin.defaultValue')}</span>}
          <span>·</span>
          <span>{t('admin.defaultLabel')} {formatValForDisplay(param, param.defaultVal, t)}</span>
        </p>
      </div>

      {/* Contrôle selon type */}
      <div style={{ minWidth: 0 }}>
        <ParametreControl param={param} value={val} onChange={setVal} disabled={!canWrite} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', minWidth: 96 }}>
        {canWrite ? (
          <>
            {dirty && (
              <Button size="sm" variant="primary" loading={update.isPending} onClick={save} leftIcon={<Save size={13} />}>
                {t('admin.save')}
              </Button>
            )}
            {param.modifie && !dirty && (
              <IconButton aria-label={t('admin.reset')} title={t('admin.resetToDefault')}
                icon={reset.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                tone="neutral" size="sm" onClick={doReset} />
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

function ParametreControl({ param, value, onChange, disabled }: {
  param: ParametreSysteme; value: string; onChange: (v: string) => void; disabled: boolean
}) {
  const { t } = useTranslation()
  if (param.type === 'boolean') {
    return (
      <SelectBox value={value} onChange={onChange} disabled={disabled}
        options={[{ value: 'true', label: t('admin.enabled') }, { value: 'false', label: t('admin.disabled') }]} />
    )
  }
  if (param.type === 'enum') {
    return (
      <SelectBox value={value} onChange={onChange} disabled={disabled}
        options={(param.options ?? []).map(o => ({ value: o.value, label: o.label }))} />
    )
  }
  if (param.type === 'number' || param.type === 'duration_minutes') {
    const isDuration = param.type === 'duration_minutes'
    return (
      <div style={{ position: 'relative' }}>
        <TextInput type="number" value={value} disabled={disabled}
          min={param.min ?? undefined} max={param.max ?? undefined}
          onChange={e => onChange(e.target.value)}
          style={{ paddingRight: isDuration ? 64 : undefined }} />
        {isDuration && (
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', pointerEvents: 'none',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Clock size={11} /> {t('admin.minutesUnit')}
          </span>
        )}
      </div>
    )
  }
  return <TextInput value={value} disabled={disabled} onChange={e => onChange(e.target.value)} />
}

function formatValForDisplay(param: ParametreSysteme, v: string, t: (key: string) => string): string {
  if (param.type === 'boolean') return v === 'true' ? t('admin.enabled') : t('admin.disabled')
  if (param.type === 'enum') return param.options?.find(o => o.value === v)?.label ?? v
  if (param.type === 'duration_minutes') return `${v} ${t('admin.minutesUnit')}`
  return v
}
