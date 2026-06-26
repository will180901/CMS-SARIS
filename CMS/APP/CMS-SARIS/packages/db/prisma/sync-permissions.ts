/**
 * sync-permissions.ts — Synchronisation NON DESTRUCTIVE du catalogue de permissions.
 *
 * Contrairement au seed (qui réinitialise rôles + mot de passe admin), ce script :
 *   1. Upsert chaque permission du catalogue ALL_PERMISSIONS (création si absente).
 *   2. Rattache aux 7 rôles système les permissions DEFAULT manquantes
 *      (sans supprimer les affectations existantes ni les personnalisations).
 *   3. Ne touche NI au mot de passe admin NI aux dérogations individuelles.
 *
 * Idempotent. À lancer après ajout de permissions au catalogue :
 *   pnpm --filter @cms-saris/db exec tsx prisma/sync-permissions.ts
 */

import { PrismaClient } from '@prisma/client'
import {
  ALL_PERMISSIONS, PERMISSION_META, DEFAULT_ROLE_PERMISSIONS, ROLE_CATALOG,
} from '../../types/src/permissions.js'

const prisma = new PrismaClient()

async function main() {
  console.log('🛡️  Synchronisation du catalogue de permissions (additif)...')

  // 1. Catalogue : upsert (création des nouvelles, mise à jour du module)
  let created = 0
  for (const code of ALL_PERMISSIONS) {
    const meta = PERMISSION_META[code as keyof typeof PERMISSION_META]
    const before = await prisma.permission.findUnique({ where: { code } })
    await prisma.permission.upsert({
      where:  { code },
      update: { module: meta.module },
      create: { code, module: meta.module },
    })
    if (!before) created++
  }
  console.log(`   ✓ ${ALL_PERMISSIONS.length} permissions présentes (${created} nouvelle(s))`)

  // 1.b Créer les rôles système manquants (ex. nouveau rôle MEDECIN) — non destructif.
  let rolesCreated = 0
  for (const r of ROLE_CATALOG) {
    const before = await prisma.role.findUnique({ where: { code: r.code } })
    await prisma.role.upsert({ where: { code: r.code }, update: {}, create: r })
    if (!before) { rolesCreated++; console.log(`   + rôle ${r.code} créé`) }
  }
  console.log(`   ✓ ${ROLE_CATALOG.length} rôles présents (${rolesCreated} nouveau(x))`)

  // 2. Rattachement additif des permissions DEFAULT aux rôles système
  const roles = await prisma.role.findMany()
  let attached = 0
  for (const role of roles) {
    const wanted = DEFAULT_ROLE_PERMISSIONS[role.code] ?? []
    for (const permCode of wanted) {
      const perm = await prisma.permission.findUnique({ where: { code: permCode } })
      if (!perm) continue
      const exists = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: perm.id },
      })
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } })
        attached++
        console.log(`   + ${role.code} ← ${permCode}`)
      }
    }
  }
  console.log(`   ✓ ${attached} rattachement(s) ajouté(s) (aucune suppression)`)
  console.log('✅ Synchronisation terminée.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
