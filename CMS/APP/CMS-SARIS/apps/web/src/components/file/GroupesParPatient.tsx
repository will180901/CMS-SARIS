/**
 * GroupesParPatient — une file (visites, consultations) où chaque PATIENT n'apparaît
 * qu'une fois. Un patient venu une seule fois garde sa carte habituelle ; venu plusieurs
 * fois, il devient une « bulle » qui s'ouvre sur ses passages, rangés par problème
 * (même diagnostic, même épisode de suivi…) puis du plus récent au plus ancien.
 *
 * Utilisé pour l'HISTORIQUE (Clôturées, Annulées) : la file « En cours » ne compte
 * jamais deux fois le même patient (une seule visite ouverte par patient).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/intl'

export interface PatientDeFile {
  id:            string
  numeroPatient: string
  identite?:     { nom: string; prenom: string } | null
}

interface Props<T> {
  items:        T[]
  idDe:         (item: T) => string
  patientDe:    (item: T) => PatientDeFile
  dateDe:       (item: T) => string
  /** Problème auquel rattacher le passage (diagnostic, épisode…) ; null = « autres ». */
  problemeDe?:  (item: T) => string | null
  /** Carte pleine (patient venu une seule fois). */
  carte:        (item: T) => React.ReactNode
  /** Ligne compacte dans une bulle (le patient est déjà nommé par la bulle). */
  ligne:        (item: T, selectionne: boolean) => React.ReactNode
  selectedId:   string | null
  onSelect:     (item: T) => void
  /** Recherche en cours : toutes les bulles ouvertes. */
  toutOuvrir?:  boolean
}

export function GroupesParPatient<T>({ items, idDe, patientDe, dateDe, problemeDe, carte, ligne, selectedId, onSelect, toutOuvrir }: Props<T>) {
  const { t } = useTranslation()
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())

  // Historique : du plus récent au plus ancien, dans chaque bulle comme entre les bulles
  // (un patient se place à son passage le plus récent) — quel que soit l'ordre de la file.
  const groupes = useMemo(() => {
    const temps = (it: T) => new Date(dateDe(it)).getTime()
    const map = new Map<string, { patient: PatientDeFile; items: T[] }>()
    for (const it of [...items].sort((a, b) => temps(b) - temps(a))) {
      const p = patientDe(it)
      const g = map.get(p.id) ?? { patient: p, items: [] }
      g.items.push(it)
      map.set(p.id, g)
    }
    return [...map.values()]
  }, [items, patientDe, dateDe])

  const basculer = (id: string) => setOuverts(s => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  return (
    <>
      {groupes.map(g => {
        if (g.items.length === 1) return <div key={g.patient.id}>{carte(g.items[0])}</div>
        const contientSelection = g.items.some(it => idDe(it) === selectedId)
        const ouvert = toutOuvrir || ouverts.has(g.patient.id) || contientSelection
        const nom = g.patient.identite ? `${g.patient.identite.prenom} ${g.patient.identite.nom}` : g.patient.numeroPatient
        const initiales = g.patient.identite
          ? `${g.patient.identite.prenom[0] ?? ''}${g.patient.identite.nom[0] ?? ''}`.toUpperCase()
          : '#'
        // Rangement par problème — seulement s'il apporte quelque chose : plusieurs
        // problèmes, dont au moins un revenu (sinon, simple ordre chronologique).
        const parProblemeBrut = new Map<string, T[]>()
        for (const it of g.items) {
          const k = problemeDe?.(it) ?? ''
          parProblemeBrut.set(k, [...(parProblemeBrut.get(k) ?? []), it])
        }
        const plusieurs = parProblemeBrut.size > 1 && [...parProblemeBrut.values()].some(l => l.length > 1)
        const parProbleme = plusieurs ? parProblemeBrut : new Map([['', g.items]])
        return (
          <div key={g.patient.id} style={{ borderBottom: '1px solid var(--bordure-legere)', borderLeft: `3px solid ${contientSelection ? 'var(--ap-300)' : 'transparent'}` }}>
            <button
              type="button"
              onClick={() => basculer(g.patient.id)}
              aria-expanded={ouvert}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px 12px 13px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: 'var(--ap-50)', color: 'var(--ap-700)' }}>
                {initiales}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--texte-tertiaire)' }}>
                  {g.patient.numeroPatient} · {t('file.passages', { count: g.items.length })} · {t('file.dernier', { date: formatDate(dateDe(g.items[0])) })}
                </span>
              </span>
              {ouvert ? <ChevronDown size={14} style={{ color: 'var(--texte-tertiaire)' }} /> : <ChevronRight size={14} style={{ color: 'var(--texte-tertiaire)' }} />}
            </button>
            {ouvert && (
              <div style={{ padding: '0 10px 10px 54px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...parProbleme.entries()].map(([probleme, liste]) => (
                  <div key={probleme || '_'} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {plusieurs && (
                      <span style={{ padding: '4px 6px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texte-tertiaire)' }}>
                        {probleme || t('file.autresPassages')} · {liste.length}
                      </span>
                    )}
                    {liste.map(it => {
                      const sel = idDe(it) === selectedId
                      return (
                        <button
                          key={idDe(it)}
                          type="button"
                          onClick={() => onSelect(it)}
                          aria-current={sel ? 'true' : undefined}
                          style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '6px 8px', background: sel ? 'var(--ap-50)' : 'transparent', borderLeft: `3px solid ${sel ? 'var(--ap-500)' : 'transparent'}` }}
                          onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
                          onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
                        >
                          {ligne(it, sel)}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
