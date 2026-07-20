/**
 * statsExport — exports des statistiques d'activité (remplacement du comptage Excel
 * « Jeannette ») : classeur .xlsx réellement stylé + impression PDF native (pas de
 * popup, immunisée au bloqueur de fenêtres).
 */
import writeXlsxFile from 'write-excel-file/browser'
import type { Sheet } from 'write-excel-file/browser'
import type { StatistiquesActivite } from '../api/dashboard.api'

const ACCENT = '#2f6f86'   // teal profond SARIS
const SOFT   = '#eef4f7'   // teal très clair (lignes alternées)
const LINE   = '#d7e3e8'
const INK    = '#1e293b'

type Row = { libelle: string; count: number }

// ── Excel (.xlsx réel — en-têtes colorées, bordures, lignes alternées) ────────

function breakdownSheet(sheet: string, rows: Row[]): Sheet<Blob> {
  return {
    sheet,
    columns: [{ width: 42 }, { width: 14 }],
    data: [
      [
        { value: 'Libellé', fontWeight: 'bold', backgroundColor: ACCENT, textColor: '#ffffff', borderColor: ACCENT },
        { value: 'Nombre', fontWeight: 'bold', backgroundColor: ACCENT, textColor: '#ffffff', borderColor: ACCENT, align: 'right' as const },
      ],
      ...rows.map((r, i) => {
        const bg = i % 2 === 0 ? SOFT : '#ffffff'
        return [
          { value: r.libelle, backgroundColor: bg, textColor: INK, borderColor: LINE },
          { value: r.count, type: Number, backgroundColor: bg, textColor: INK, borderColor: LINE, align: 'right' as const },
        ]
      }),
    ],
  }
}

export async function exportStatsXlsx(stats: StatistiquesActivite) {
  const resume: Sheet<Blob> = {
    sheet: 'Résumé',
    columns: [{ width: 34 }, { width: 16 }],
    data: [
      [
        { value: "Statistiques d'activité", fontWeight: 'bold', fontSize: 14, backgroundColor: ACCENT, textColor: '#ffffff', borderColor: ACCENT, columnSpan: 2 },
      ],
      [
        { value: `Période : ${stats.periode.from} au ${stats.periode.to}`, backgroundColor: SOFT, textColor: INK, borderColor: LINE, columnSpan: 2 },
      ],
      [null],
      [
        { value: 'Total consultations', fontWeight: 'bold', backgroundColor: SOFT, textColor: INK, borderColor: LINE },
        { value: stats.totalConsultations, type: Number, backgroundColor: '#ffffff', textColor: INK, borderColor: LINE, align: 'right' as const },
      ],
      [
        { value: 'Jours de repos prescrits', fontWeight: 'bold', backgroundColor: SOFT, textColor: INK, borderColor: LINE },
        { value: stats.repos.totalJours, type: Number, backgroundColor: '#ffffff', textColor: INK, borderColor: LINE, align: 'right' as const },
      ],
      [
        { value: 'Consultations avec repos', fontWeight: 'bold', backgroundColor: SOFT, textColor: INK, borderColor: LINE },
        { value: stats.repos.consultationsAvecRepos, type: Number, backgroundColor: '#ffffff', textColor: INK, borderColor: LINE, align: 'right' as const },
      ],
    ],
  }

  const sheets = [
    resume,
    breakdownSheet('Par type', stats.parType),
    breakdownSheet('Par pathologie', stats.parPathologie),
    breakdownSheet('Par catégorie', stats.parCategorie),
    breakdownSheet('Par département', stats.parDepartement),
  ].filter(s => s.data.length > 1 || s === resume)

  await writeXlsxFile(sheets).toFile(`statistiques_${stats.periode.from}_${stats.periode.to}.xlsx`)
}

// ── PDF (impression native — même page, aucune fenêtre popup) ────────────────

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

const PRINT_ROOT_ID = 'stats-print-sheet'

function statsPrintBody(stats: StatistiquesActivite) {
  const table = (titre: string, rows: Row[]) => rows.length ? `
    <h2>${escapeHtml(titre)}</h2>
    <table><thead><tr><th>Libellé</th><th class="n">Nombre</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${escapeHtml(r.libelle)}</td><td class="n">${r.count}</td></tr>`).join('')}
    </tbody></table>` : ''
  return `
    <h1>Statistiques d'activité</h1>
    <p class="ps-sub">Période : ${escapeHtml(stats.periode.from)} au ${escapeHtml(stats.periode.to)} · CMS SARIS</p>
    <div class="ps-kpis">
      <div class="ps-kpi"><div class="v">${stats.totalConsultations}</div><div class="l">Consultations</div></div>
      <div class="ps-kpi"><div class="v">${stats.repos.totalJours}</div><div class="l">Jours de repos prescrits</div></div>
    </div>
    ${table('Par type de consultation', stats.parType)}
    ${table('Par pathologie (diagnostic principal)', stats.parPathologie)}
    ${table('Par catégorie de patient', stats.parCategorie)}
    ${table('Par département / direction', stats.parDepartement)}
  `
}

/**
 * Imprime les statistiques SANS ouvrir de fenêtre (donc jamais bloqué par le
 * navigateur) : injecte un fragment caché dans la page courante, une feuille de
 * style scopée `@media print` qui masque tout le reste, puis appelle
 * `window.print()` directement — même mécanisme que MedicalPrintSheet.
 */
export function exportStatsPdf(stats: StatistiquesActivite) {
  document.getElementById(PRINT_ROOT_ID)?.remove()

  const root = document.createElement('div')
  root.id = PRINT_ROOT_ID
  root.style.display = 'none'
  root.innerHTML = statsPrintBody(stats)
  document.body.appendChild(root)

  const style = document.createElement('style')
  style.textContent = `
    #${PRINT_ROOT_ID} { font-family: 'Helvetica Neue', Arial, sans-serif; color: ${INK}; }
    #${PRINT_ROOT_ID} h1 { font-size: 20px; color: ${ACCENT}; margin: 0 0 4px; }
    #${PRINT_ROOT_ID} .ps-sub { color: #64748b; margin: 0 0 18px; font-size: 12px; }
    #${PRINT_ROOT_ID} .ps-kpis { display: flex; gap: 24px; margin: 0 0 18px; }
    #${PRINT_ROOT_ID} .ps-kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; }
    #${PRINT_ROOT_ID} .ps-kpi .v { font-size: 22px; font-weight: 700; color: ${ACCENT}; }
    #${PRINT_ROOT_ID} .ps-kpi .l { font-size: 11px; color: #64748b; }
    #${PRINT_ROOT_ID} h2 { font-size: 14px; color: ${ACCENT}; margin: 18px 0 6px; border-bottom: 2px solid ${ACCENT}; padding-bottom: 3px; }
    #${PRINT_ROOT_ID} table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    #${PRINT_ROOT_ID} th, #${PRINT_ROOT_ID} td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    #${PRINT_ROOT_ID} th { background: ${SOFT}; color: ${ACCENT}; }
    #${PRINT_ROOT_ID} .n { text-align: right; width: 90px; }
    @media print {
      body * { visibility: hidden !important; }
      #${PRINT_ROOT_ID}, #${PRINT_ROOT_ID} * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      #${PRINT_ROOT_ID} {
        display: block !important; position: fixed !important; top: 0 !important; left: 0 !important;
        width: 210mm !important; margin: 0 !important; padding: 16mm 18mm !important; background: #fff !important;
      }
      @page { size: A4; margin: 0; }
    }
  `
  document.head.appendChild(style)

  window.print()

  setTimeout(() => { style.remove(); root.remove() }, 2000)
}
