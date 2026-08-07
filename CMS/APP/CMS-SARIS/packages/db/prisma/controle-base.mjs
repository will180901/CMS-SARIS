/**
 * Contrôle l'état de la base après nettoyage : ce qui subsiste doit permettre de
 * démarrer une mise en service, rien de plus.
 *
 * Vérifie surtout que `admin` a bien conservé son RÔLE — le nettoyage vide la table de
 * liaison rôle↔utilisateur comme les autres, et un compte sans rôle se connecte mais ne
 * voit rien. C'est le genre de base « propre » et pourtant inutilisable.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const u = await prisma.utilisateur.findFirst({
    where: { login: 'admin' },
    include: { roles: { include: { role: { include: { permissions: true } } } } },
  })
  const perms = new Set(u?.roles.flatMap((r) => r.role.permissions.map((x) => x.permissionId)) ?? [])

  console.log('── COMPTE ──')
  console.log('  admin        :', u ? 'présent' : 'ABSENT', '| statut :', u?.statut)
  console.log('  rôle(s)      :', u?.roles.map((r) => r.role.code).join(', ') || 'AUCUN ⚠️')
  console.log('  permissions  :', perms.size)

  console.log('── VIDÉ ──')
  for (const m of ['patient', 'visite', 'consultation', 'ordonnance', 'bonExamen',
                   'employeSaris', 'posteLocal', 'personnelMedical', 'message',
                   'notification', 'journalAudit', 'sessionUtilisateur']) {
    const n = await prisma[m].count()
    console.log(`  ${m.padEnd(20)} ${n}${n === 0 ? '' : ' ⚠️'}`)
  }

  console.log('── CONSERVÉ ──')
  for (const m of ['site', 'motifConsultation', 'pathologieReference', 'medicamentReference',
                   'categoriePatient', 'typeExamen', 'typeConsultation', 'societeSousTraitante',
                   'role', 'permission', 'utilisateur']) {
    console.log(`  ${m.padEnd(20)} ${await prisma[m].count()}`)
  }
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
