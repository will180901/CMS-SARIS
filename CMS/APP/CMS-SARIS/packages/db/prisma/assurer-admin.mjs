/**
 * Garantit qu'au moins un compte peut administrer le système.
 *
 * Le rattachement rôle↔utilisateur vit dans une table de LIAISON. Toute opération qui la
 * vide — nettoyage, restauration partielle, migration maladroite — laisse les comptes en
 * place mais SANS AUCUN DROIT : ils se connectent, et l'application s'effondre parce que
 * plus rien ne leur est accessible. Constaté en production le 07/08/2026 : le tableau de
 * bord plantait sur `Cannot read properties of undefined`, faute de la moindre permission.
 *
 * Ce script rend son rôle à `admin` s'il l'a perdu. Il est IDEMPOTENT et INOFFENSIF :
 * quand tout va bien, il ne fait rien. C'est pourquoi il peut rester dans la commande de
 * démarrage — contrairement au nettoyage, qui lui est destructeur et n'y a pas sa place.
 *
 * Ne crée jamais de compte, ne touche à aucun mot de passe.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const LOGIN = 'admin'
const ROLE = 'ADMIN_SYSTEME'

async function main() {
  const compte = await prisma.utilisateur.findFirst({
    where: { login: LOGIN },
    include: { roles: true },
  })
  if (!compte) {
    console.log(`ℹ️  Aucun compte « ${LOGIN} » — rien à faire (le seed s'en charge).`)
    return
  }
  if (compte.roles.length > 0) {
    console.log(`✓ ${LOGIN} possède déjà ${compte.roles.length} rôle(s).`)
    return
  }

  const role = await prisma.role.findFirst({ where: { code: ROLE }, select: { id: true } })
  if (!role) {
    console.log(`⚠️  Rôle ${ROLE} absent — lancer db:sync-permissions d'abord.`)
    return
  }
  await prisma.utilisateurRole.create({
    data: { utilisateurId: compte.id, roleId: role.id },
  })
  console.log(`🔧 ${LOGIN} n'avait AUCUN rôle : ${ROLE} rétabli.`)
}

main()
  .catch((e) => { console.error('⚠️  assurer-admin :', e.message) })
  .finally(() => prisma.$disconnect())
