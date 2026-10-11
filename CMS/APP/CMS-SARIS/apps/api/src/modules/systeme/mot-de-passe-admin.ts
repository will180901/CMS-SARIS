import * as bcrypt from 'bcrypt'
import type { PrismaService } from '../../prisma/prisma.service'

/**
 * Le mot de passe saisi est-il bien celui de cet utilisateur ?
 *
 * Les gestes qui engagent tout le système (changer de mode, vider les données du centre) redemandent
 * le mot de passe de l'administrateur même si sa session est ouverte : une session laissée ouverte
 * sur un poste ne suffit pas à les accomplir. Faux aussi pour un compte inconnu.
 */
export async function motDePasseCorrect(
  prisma: PrismaService,
  utilisateurId: string,
  motDePasse: string,
): Promise<boolean> {
  const u = await prisma.utilisateur.findUnique({
    where: { id: utilisateurId },
    select: { passwordHash: true },
  })
  return !!u && (await bcrypt.compare(motDePasse, u.passwordHash))
}
