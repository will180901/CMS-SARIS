/**
 * Termine le nettoyage : vide les tables cliniques restantes, puis REND SON RÔLE à `admin`.
 *
 * `nettoyer-base.ts` procède par `deleteMany`, ce qui exige de connaître l'ordre exact
 * des dépendances. Six tables résistaient — référencées par des relations absentes de sa
 * liste. Plutôt que de compléter cette liste à la main (fragile, et à refaire à chaque
 * évolution du schéma), on tronque avec CASCADE : PostgreSQL suit lui-même les liens.
 *
 * CASCADE ne remonte JAMAIS vers les tables de référence (Site, Role, Permission…) :
 * il ne descend que vers ce qui dépend des tables citées.
 *
 * ⚠️ Le rattachement rôle↔utilisateur est une table de LIAISON : le nettoyage la vide
 * comme les autres, et `admin` se retrouve sans aucun droit — il se connecte, mais ne
 * voit rien. On le lui redonne donc explicitement ici. Sans cette étape, la base est
 * « propre » mais inutilisable.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CIBLES = [
  'Patient', 'Visite', 'Consultation', 'BonExamen', 'Evacuation',
  'DelegationPrescription', 'EmployeSaris', 'PosteLocal',
]

async function main() {
  const admin = await prisma.utilisateur.findFirst({
    where: { login: 'admin' },
    select: { id: true, personnelMedicalId: true },
  })
  if (!admin) throw new Error('Compte admin introuvable — interruption.')

  const liste = CIBLES.map((t) => `"${t}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${liste} CASCADE`)
  console.log(`TRUNCATE CASCADE sur ${CIBLES.length} tables : ${CIBLES.join(', ')}`)

  // Personnel médical : tout, sauf la fiche éventuellement rattachée à `admin`.
  const where = admin.personnelMedicalId ? { NOT: { id: admin.personnelMedicalId } } : {}
  const { count } = await prisma.personnelMedical.deleteMany({ where })
  console.log(`personnelMedical supprimé : ${count}`)

  // ── Rendre son rôle à `admin` ────────────────────────────────────────────
  const role = await prisma.role.findFirst({ where: { code: 'ADMIN_SYSTEME' }, select: { id: true } })
  if (!role) throw new Error('Rôle ADMIN_SYSTEME absent — lancer db:sync-permissions.')
  const existe = await prisma.utilisateurRole.findFirst({
    where: { utilisateurId: admin.id, roleId: role.id },
  })
  if (!existe) {
    await prisma.utilisateurRole.create({ data: { utilisateurId: admin.id, roleId: role.id } })
    console.log('rôle ADMIN_SYSTEME rendu à admin')
  } else {
    console.log('admin a déjà son rôle')
  }
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
