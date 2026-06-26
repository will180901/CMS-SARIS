/**
 * statsExport — exports des statistiques d'activité (remplacement du comptage Excel
 * « Jeannette ») : CSV ouvrable dans Excel + PDF imprimable.
 */
import type { StatistiquesActivite } from '../api/dashboard.api'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const csvEsc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

/** CSV — séparateur ';' + BOM UTF-8 → ouverture directe dans Excel (FR). */
export function exportStatsCsv(stats: StatistiquesActivite) {
  const L: string[] = []
  L.push(`Statistiques d'activité;${stats.periode.from} au ${stats.periode.to}`)
  L.push('')
  L.push(`Total consultations;${stats.totalConsultations}`)
  L.push(`Jours de repos prescrits;${stats.repos.totalJours}`)
  L.push(`Consultations avec repos;${stats.repos.consultationsAvecRepos}`)
  L.push('')
  L.push('Par type de consultation;Nombre')
  stats.parType.forEach(r => L.push(`${csvEsc(r.libelle)};${r.count}`))
  L.push('')
  L.push('Par pathologie (diagnostic principal);Nombre')
  stats.parPathologie.forEach(r => L.push(`${csvEsc(r.libelle)};${r.count}`))
  L.push('')
  L.push('Par catégorie de patient;Nombre')
  stats.parCategorie.forEach(r => L.push(`${csvEsc(r.libelle)};${r.count}`))
  download(`statistiques_${stats.periode.from}_${stats.periode.to}.csv`, '﻿' + L.join('\r\n'), 'text/csv;charset=utf-8;')
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

/** PDF — ouvre une fenêtre imprimable formatée (l'utilisateur « Enregistrer en PDF »). */
export function exportStatsPdf(stats: StatistiquesActivite) {
  const w = window.open('', '_blank', 'width=820,height=640')
  if (!w) return
  const table = (titre: string, rows: { libelle: string; count: number }[]) => rows.length ? `
    <h2>${escapeHtml(titre)}</h2>
    <table><thead><tr><th>Libellé</th><th class="n">Nombre</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${escapeHtml(r.libelle)}</td><td class="n">${r.count}</td></tr>`).join('')}
    </tbody></table>` : ''
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Statistiques d'activité</title>
    <style>
      body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1e293b;padding:32px;font-size:13px}
      h1{font-size:20px;color:#2f6f86;margin:0 0 4px}
      .sub{color:#64748b;margin:0 0 18px;font-size:12px}
      .kpis{display:flex;gap:24px;margin:0 0 18px}
      .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px}
      .kpi .v{font-size:22px;font-weight:700;color:#2f6f86}
      .kpi .l{font-size:11px;color:#64748b}
      h2{font-size:14px;color:#2f6f86;margin:18px 0 6px;border-bottom:2px solid #2f6f86;padding-bottom:3px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:12px}
      th{background:#eef4f7;color:#2f6f86}
      .n{text-align:right;width:90px}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>Statistiques d'activité</h1>
    <p class="sub">Période : ${stats.periode.from} au ${stats.periode.to} · CMS SARIS</p>
    <div class="kpis">
      <div class="kpi"><div class="v">${stats.totalConsultations}</div><div class="l">Consultations</div></div>
      <div class="kpi"><div class="v">${stats.repos.totalJours}</div><div class="l">Jours de repos prescrits</div></div>
    </div>
    ${table('Par type de consultation', stats.parType)}
    ${table('Par pathologie (diagnostic principal)', stats.parPathologie)}
    ${table('Par catégorie de patient', stats.parCategorie)}
    </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 250)
}
