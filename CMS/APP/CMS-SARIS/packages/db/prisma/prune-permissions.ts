/**
 * prune-permissions.ts — Retire de la base les permissions OBSOLÈTES, c'est-à-dire
 * présentes en base mais plus déclarées dans ALL_PERMISSIONS.
 *
 * Pourquoi ce script existe : `sync-permissions.ts` est volontairement ADDITIF (il ne
 * supprime jamais rien, pour ne pas détruire une personnalisation). Résultat, une
 * permission retirée du catalogue TypeScript survit en base et continue d'apparaître
 * dans la matrice d'habilitation comme une ligne fantôme, attachée à des rôles.
 * Seul le seed nettoyait — or le seed réinitialise aussi les rôles et le mot de passe
 * admin, donc il est inutilisable sur une base vivante.
 *
 * Sûr par défaut : SIMULATION. Rien n'est supprimé sans `--apply`.
 *
 *   pnpm --filter @cms-saris/db exec tsx prisma/prune-permissions.ts           # simulation
 *   pnpm --filter @cms-saris/db exec tsx prisma/prune-permissions.ts --apply   # exécution
 */

import { PrismaClient } from '@prisma/client'
import { ALL_PERMISSIONS } from '../../types/src/permissions.js'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

async function main() {
  const declarees = new Set<string>(ALL_PERMISSIONS as readonly string[])
  const enBase = await prisma.permission.findMany({ select: { id: true, code: true } })
  const obsoletes = enBase.filter((p) => !declarees.has(p.code))

  console.log(`🔎 ${enBase.length} permission(s) en base · ${declarees.size} déclarée(s) dans le code`)

  if (obsoletes.length === 0) {
    console.log('✅ Aucune permission obsolète — rien à faire.')
    return
  }

  console.log(`\n⚠️  ${obsoletes.length} permission(s) obsolète(s) :\n`)
  for (const p of obsoletes) {
    const [roles, overrides] = await Promise.all([
      prisma.rolePermission.findMany({
        where: { permissionId: p.id },
        include: { role: { select: { code: true } } },
      }),
      prisma.utilisateurPermission.count({ where: { permissionId: p.id } }),
    ])
    const rolesTxt = roles.map((r) => r.role.code).join(', ') || 'aucun rôle'
    console.log(`   • ${p.code}  → rattachée à : ${rolesTxt} · ${overrides} dérogation(s) individuelle(s)`)
  }

  if (!APPLY) {
    console.log('\n💡 SIMULATION — rien n\'a été supprimé.')
    console.log('   Relancer avec --apply pour exécuter réellement.')
    return
  }

  // Suppression des dépendances AVANT la permission (contraintes de clé étrangère).
  let liensRoles = 0
  let liensOverrides = 0
  for (const p of obsoletes) {
    const r = await prisma.rolePermission.deleteMany({ where: { permissionId: p.id } })
    const o = await prisma.utilisateurPermission.deleteMany({ where: { permissionId: p.id } })
    liensRoles += r.count
    liensOverrides += o.count
    await prisma.permission.delete({ where: { id: p.id } })
    console.log(`   ✗ ${p.code} supprimée`)
  }

  console.log(
    `\n✅ ${obsoletes.length} permission(s) supprimée(s) ` +
      `(${liensRoles} rattachement(s) de rôle, ${liensOverrides} dérogation(s)).`,
  )
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
