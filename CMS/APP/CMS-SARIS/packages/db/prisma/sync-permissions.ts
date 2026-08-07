/**
 * sync-permissions.ts — Aligne la base sur le catalogue de permissions du code.
 *
 * Contrairement au seed (qui réinitialise rôles + mot de passe admin), ce script :
 *   1. Upsert chaque permission du catalogue ALL_PERMISSIONS (création si absente).
 *   2. RÉALIGNE les rôles SYSTÈME sur DEFAULT_ROLE_PERMISSIONS — ajouts ET retraits.
 *   3. Complète les rôles PERSONNALISÉS quand une permission a été scindée en droits
 *      plus fins (jamais de retrait : ces rôles appartiennent à l'administrateur).
 *   4. Ne touche NI au mot de passe admin NI aux dérogations individuelles.
 *
 * Pourquoi le retrait (étape 2) : longtemps le script fut purement additif. Résultat,
 * une permission retirée du code restait active en base pour toujours — constaté en
 * production le 07/08/2026 : Médecin Chef y portait 112 droits contre 107 au code, et
 * Infirmier 61 contre 57. Des droits explicitement révoqués côté code restaient donc
 * exerçables. Un rôle « système » n'a de sens que si le code en est la source unique.
 *
 * Idempotent. À lancer après ajout de permissions au catalogue :
 *   pnpm --filter @cms-saris/db exec tsx prisma/sync-permissions.ts
 */

import { PrismaClient } from '@prisma/client'
import {
  ALL_PERMISSIONS, PERMISSION_META, DEFAULT_ROLE_PERMISSIONS, ROLE_CATALOG, SYSTEM_ROLES,
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

  // 2. Rôles SYSTÈME : réalignement EXACT sur le code (ajouts + retraits).
  //    Les rôles personnalisés sont ignorés ici — ils appartiennent à l'administrateur.
  const roles = await prisma.role.findMany()
  const estSysteme = (code: string) => (SYSTEM_ROLES as readonly string[]).includes(code)
  let attached = 0
  let detached = 0
  for (const role of roles) {
    const wanted = DEFAULT_ROLE_PERMISSIONS[role.code] ?? []
    if (!estSysteme(role.code)) continue

    const voulus = new Set(wanted)
    const actuels = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    })
    const detenus = new Set(actuels.map((rp) => rp.permission.code))

    // 2a. Ce que le code accorde et qui manque en base.
    for (const permCode of wanted) {
      if (detenus.has(permCode)) continue
      const perm = await prisma.permission.findUnique({ where: { code: permCode } })
      if (!perm) continue
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } })
      attached++
      console.log(`   + ${role.code} ← ${permCode}`)
    }

    // 2b. Ce que la base porte encore et que le code n'accorde plus. C'est CE retrait
    //     qui manquait : sans lui, un droit supprimé du code restait exerçable à vie.
    const enTrop = actuels.filter((rp) => !voulus.has(rp.permission.code))
    if (enTrop.length) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: enTrop.map((rp) => rp.permissionId) } },
      })
      detached += enTrop.length
      for (const rp of enTrop) console.log(`   − ${role.code} ⊘ ${rp.permission.code} (absent du code)`)
    }
  }
  console.log(`   ✓ rôles système réalignés : ${attached} ajout(s), ${detached} retrait(s)`)

  // 3. Reprise de compatibilité — découpage d'anciennes permissions « fourre-tout ».
  //
  // Certaines permissions ont été scindées en droits plus fins (ex. la lecture globale
  // des référentiels → une lecture par service ; `ordonnance.create` qui gardait aussi
  // l'édition et la suppression). Les rôles SYSTÈME reçoivent les nouveaux droits via
  // DEFAULT_ROLE_PERMISSIONS ci-dessus, mais les rôles PERSONNALISÉS créés en base par
  // un administrateur, eux, perdraient l'accès. Cette étape leur accorde l'équivalent
  // de ce qu'ils avaient déjà : à droits inchangés, accès inchangé.
  //
  // Purement additive et idempotente : relancer le script ne produit plus rien.
  const IMPLIED: { si: string; alors: string[] }[] = [
    { si: 'referentiel.read', alors: [
      'referentiel.site.read', 'referentiel.motif.read', 'referentiel.pathologie.read',
      'referentiel.medicament.read', 'referentiel.categorie.read', 'referentiel.examen.read',
      'referentiel.type_consultation.read',
    ] },
    { si: 'ordonnance.create',  alors: ['ordonnance.update', 'ordonnance.delete'] },
    { si: 'bon_examen.create',  alors: ['bon_examen.update'] },
    { si: 'consultation.read',  alors: ['rapport.read'] },
  ]

  let backfilled = 0
  for (const role of roles) {
    // Les rôles système viennent d'être réalignés à l'étape 2 : leur appliquer la reprise
    // les ferait diverger du code aussitôt (elle ajoute des droits que DEFAULT n'a pas).
    if (estSysteme(role.code)) continue
    const codesDuRole = new Set(
      (await prisma.rolePermission.findMany({
        where:   { roleId: role.id },
        include: { permission: true },
      })).map((rp) => rp.permission.code),
    )

    for (const { si, alors } of IMPLIED) {
      if (!codesDuRole.has(si)) continue
      for (const permCode of alors) {
        if (codesDuRole.has(permCode)) continue
        const perm = await prisma.permission.findUnique({ where: { code: permCode } })
        if (!perm) continue
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } })
        codesDuRole.add(permCode)
        backfilled++
        console.log(`   ↪ ${role.code} ← ${permCode} (repris de « ${si} »)`)
      }
    }
  }
  console.log(`   ✓ ${backfilled} droit(s) repris pour préserver les accès existants`)
  console.log('✅ Synchronisation terminée.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
