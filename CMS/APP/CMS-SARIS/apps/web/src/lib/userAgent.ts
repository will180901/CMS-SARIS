/**
 * Analyse d'un user-agent → navigateur + système, lisible par un humain.
 * Détection par ordre de priorité (Edge avant Chrome, Chrome avant Safari…).
 * Best-effort : un UA inconnu renvoie un libellé neutre.
 */

export interface UAInfo {
  /** Nom du navigateur (ex. « Chrome ») */
  browser: string
  /** Version majeure (ex. « 126 ») ou '' */
  version: string
  /** Système d'exploitation (ex. « Windows », « Android 14 ») */
  os: string
  /** Type d'appareil */
  device: 'desktop' | 'mobile' | 'tablette'
  /** Libellé compact prêt à afficher (ex. « Chrome 126 · Windows ») */
  label: string
}

function major(v?: string): string {
  return v ? v.split('.')[0]! : ''
}

function detectBrowser(ua: string): { browser: string; version: string } {
  const tests: [string, RegExp][] = [
    ['Edge',             /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ['Opera',            /(?:OPR|Opera)\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Firefox',          /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome',           /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari',           /Version\/([\d.]+).*Safari/],
  ]
  for (const [name, re] of tests) {
    const m = ua.match(re)
    if (m) return { browser: name, version: major(m[1]) }
  }
  if (/Safari/.test(ua)) return { browser: 'Safari', version: '' }
  return { browser: 'Navigateur', version: '' }
}

function detectOs(ua: string): string {
  if (/Windows NT 10/.test(ua))      return 'Windows'
  if (/Windows NT 6\.3/.test(ua))    return 'Windows 8.1'
  if (/Windows NT 6\.1/.test(ua))    return 'Windows 7'
  if (/Windows/.test(ua))            return 'Windows'
  if (/Android ([\d.]+)/.test(ua))   return `Android ${major(ua.match(/Android ([\d.]+)/)![1])}`
  if (/Android/.test(ua))            return 'Android'
  if (/(iPhone|iPad|iPod)/.test(ua)) return 'iOS'
  if (/CrOS/.test(ua))               return 'ChromeOS'
  if (/Mac OS X/.test(ua))           return 'macOS'
  if (/Linux/.test(ua))              return 'Linux'
  return ''
}

function detectDevice(ua: string): UAInfo['device'] {
  if (/iPad|Tablet/.test(ua))                  return 'tablette'
  if (/Mobi|Android.*Mobile|iPhone/.test(ua))  return 'mobile'
  return 'desktop'
}

export function parseUserAgent(ua?: string | null): UAInfo {
  if (!ua) {
    return { browser: 'Inconnu', version: '', os: '', device: 'desktop', label: 'Appareil inconnu' }
  }
  const { browser, version } = detectBrowser(ua)
  const os     = detectOs(ua)
  const device = detectDevice(ua)
  const tete   = version ? `${browser} ${version}` : browser
  const label  = os ? `${tete} · ${os}` : tete
  return { browser, version, os, device, label }
}
