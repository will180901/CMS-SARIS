/**
 * Recrée le compte `admin` s'il n'existe plus, avec le rôle ADMIN_SYSTEME.
 *
 * Filet de dernier recours : une base sans aucun compte est définitivement inaccessible,
 * et rien dans l'interface ne permet d'en créer un — il faut bien être connecté pour cela.
 *
 * Mot de passe par défaut `Admin123!` (le même que le seed). À changer après connexion.
 *
 * Idempotent : si `admin` existe, le script se contente de vérifier son rôle.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const LOGIN = 'admin'
const MDP = 'Admin123!'

async function main() {
  const role = await prisma.role.findFirst({ where: { code: 'ADMIN_SYSTEME' }, select: { id: true } })
  if (!role) throw new Error('Rôle ADMIN_SYSTEME absent — lancer db:sync-permissions.')

  let compte = await prisma.utilisateur.findFirst({ where: { login: LOGIN }, include: { roles: true } })

  if (!compte) {
    const site = await prisma.site.findFirst({ select: { id: true } })
    if (!site) throw new Error('Aucun site en base — impossible de rattacher un compte.')
    compte = await prisma.utilisateur.create({
      data: {
        login: LOGIN,
        email: 'admin@cms-saris.local',
        passwordHash: await bcrypt.hash(MDP, 10),
        siteId: site.id,
        statut: 'ACTIF',
      },
      include: { roles: true },
    })
    console.log(`🔧 Compte « ${LOGIN} » recréé (mot de passe : ${MDP} — à changer).`)
  } else {
    console.log(`✓ Compte « ${LOGIN} » présent.`)
  }

  if (compte.roles.length === 0) {
    await prisma.utilisateurRole.create({ data: { utilisateurId: compte.id, roleId: role.id } })
    console.log('🔧 Rôle ADMIN_SYSTEME attribué.')
  } else {
    console.log(`✓ ${compte.roles.length} rôle(s) déjà attribué(s).`)
  }
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
