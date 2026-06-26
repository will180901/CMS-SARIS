/**
 * TabToolbar — Barre d'outils commune à tous les onglets référentiels.
 * Contient : champ de recherche, filtre statut, bouton "Nouveau".
 */

import { useTranslation } from 'react-i18next'
import { Search, X, Plus } from 'lucide-react'
import { Input }   from '@workspace/ui/components/input'
import { Button }  from '@workspace/ui/components/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'

interface TabToolbarProps {
  search:          string
  onSearchChange:  (v: string) => void
  statut:          string
  onStatutChange:  (v: string) => void
  onNew:           () => void
  newLabel:        string
  placeholder?:    string
  /** Si false, cache le bouton "Nouveau" (lecture seule = pas de referentiel.create) */
  canCreate?:       boolean
}

export function TabToolbar({
  search,
  onSearchChange,
  statut,
  onStatutChange,
  onNew,
  newLabel,
  placeholder,
  canCreate        = true,
}: TabToolbarProps) {
  const { t } = useTranslation()
  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '10px',
        padding:        'var(--espace-3) 0 var(--espace-2)',
        flexWrap:       'wrap',
      }}
    >
      {/* ── Recherche ─────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '320px' }}>
        <Search
          size={14}
          style={{
            position:  'absolute',
            left:      '10px',
            top:       '50%',
            transform: 'translateY(-50%)',
            color:     'var(--texte-tertiaire)',
            pointerEvents: 'none',
          }}
        />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder ?? t('referentiels.searchPlaceholder')}
          style={{
            paddingLeft:  '32px',
            paddingRight: search ? '32px' : '12px',
            height:       '34px',
            fontSize:     '13px',
            background:   'var(--fond-surface)',
            border:       '1px solid var(--bordure-normale)',
            borderRadius: '6px',
          }}
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position:   'absolute',
              right:      '8px',
              top:        '50%',
              transform:  'translateY(-50%)',
              color:      'var(--texte-tertiaire)',
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              padding:    '2px',
              display:    'flex',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Filtre statut ─────────────────────────────────────────────── */}
      <Select value={statut} onValueChange={onStatutChange}>
        <SelectTrigger
          style={{
            height:       '34px',
            width:        '168px',
            fontSize:     '13px',
            border:       '1px solid var(--bordure-normale)',
            background:   'var(--fond-surface)',
            borderRadius: '6px',
          }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('referentiels.statusAll')}</SelectItem>
          <SelectItem value="actif">{t('referentiels.statusActiveOnly')}</SelectItem>
          <SelectItem value="inactif">{t('referentiels.statusInactiveOnly')}</SelectItem>
        </SelectContent>
      </Select>

      {/* ── Spacer ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Bouton Nouveau ───────────────────────────────────────────── */}
      {canCreate && (
        <Button
          size="sm"
          onClick={onNew}
          style={{
            background:  'var(--ap-400)',
            color:       '#fff',
            fontSize:    '13px',
            height:      '34px',
            gap:         '6px',
            paddingLeft: '12px',
            paddingRight:'14px',
          }}
        >
          <Plus size={14} />
          {newLabel}
        </Button>
      )}
    </div>
  )
}
