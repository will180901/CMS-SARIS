/**
 * Point d'entrée du process forké (backend embarqué). Démarre l'API NestJS compilée
 * sur la base SQLite locale. Le chemin du main.js compilé est fourni par Electron via
 * SARIS_API_MAIN (résolu depuis les resources packagées).
 */
async function main(): Promise<void> {
  const mainPath = process.env['SARIS_API_MAIN']
  if (!mainPath) {
    console.error('[backend-entry] SARIS_API_MAIN manquant')
    process.exit(1)
    return
  }
  const mod = (await import(mainPath)) as {
    bootstrap?: (o?: { port?: number; host?: string }) => Promise<unknown>
  }
  if (typeof mod.bootstrap !== 'function') {
    console.error('[backend-entry] bootstrap introuvable dans ' + mainPath)
    process.exit(1)
    return
  }
  const port = Number(process.env['PORT'] ?? '0') || undefined
  // SECURITE : le backend embarque n'ecoute QUE la boucle locale. On ignore
  // deliberement process.env.HOST et toute valeur "0.0.0.0"/"::" pour ne jamais
  // exposer l'API (donnees medicales) sur le reseau du poste.
  const envHost = (process.env['HOST'] ?? '').trim()
  const host = envHost === '' || envHost === '0.0.0.0' || envHost === '::' ? '127.0.0.1' : envHost
  await mod.bootstrap({ port, host })
}

void main().catch((e) => {
  console.error('[backend-entry] échec du démarrage :', e)
  process.exit(1)
})
