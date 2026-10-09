/**
 * Durée des CONNEXIONS — calcul commun à « Mes sessions » et au journal d'authentification.
 *
 * Une connexion est une chaîne de SessionUtilisateur (chaque renouvellement de jeton crée
 * une ligne neuve) reliées par `connexionId`. Sa fin n'est pas toujours une déconnexion :
 * un navigateur fermé laisse la session ouverte jusqu'à son expiration, et la connexion
 * suivante la ferme parfois le lendemain. Mesurer jusqu'à cette fermeture tardive gonflerait
 * la durée de toute une nuit : on mesure donc jusqu'à la DERNIÈRE ACTIVITÉ, sauf quand la
 * fermeture suit de près l'activité (vraie déconnexion).
 */
import type { PrismaService } from '../../prisma/prisma.service'

/** Pas de mise à jour de la dernière activité (cf. jwt.strategy) : pas plus d'une écriture
 *  par session et par tranche de 5 minutes. */
export const PAS_ACTIVITE_MS = 5 * 60_000
/** Au-delà de 30 minutes sans aucune requête, une connexion non fermée est « interrompue »
 *  (navigateur fermé, poste éteint) plutôt qu'« en cours ». */
export const SEUIL_INACTIVITE_MS = 30 * 60_000

export type EtatConnexion = 'EN_COURS' | 'TERMINEE' | 'INTERROMPUE'

export interface ResumeConnexion {
  debut: Date
  /** Fin retenue pour la durée (maintenant si la connexion est en cours). */
  fin: Date
  derniereActivite: Date
  etat: EtatConnexion
  dureeMinutes: number
}

export async function resumerConnexions(
  prisma: PrismaService,
  connexionIds: string[],
  maintenant = new Date(),
): Promise<Map<string, ResumeConnexion>> {
  const ids = [...new Set(connexionIds.filter(Boolean))]
  const resultat = new Map<string, ResumeConnexion>()
  if (ids.length === 0) return resultat
  const lignes = await prisma.sessionUtilisateur.findMany({
    where: { connexionId: { in: ids } },
    select: {
      connexionId: true,
      createdAt: true,
      revokedAt: true,
      expiresAt: true,
      derniereActiviteAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  const parConnexion = new Map<string, typeof lignes>()
  for (const l of lignes) {
    if (!l.connexionId) continue
    const chaine = parConnexion.get(l.connexionId) ?? []
    chaine.push(l)
    parConnexion.set(l.connexionId, chaine)
  }
  for (const [id, chaine] of parConnexion) {
    const debut = chaine[0].createdAt
    const derniere = chaine[chaine.length - 1]
    const derniereActivite = new Date(
      Math.max(
        ...chaine.map((l) => (l.derniereActiviteAt ?? l.createdAt).getTime()),
      ),
    )
    let etat: EtatConnexion
    let fin: Date
    if (derniere.revokedAt) {
      etat = 'TERMINEE'
      // Fermeture juste après l'activité = vraie déconnexion ; fermeture tardive (connexion
      // suivante, le lendemain) = on s'arrête à la dernière activité.
      fin =
        derniere.revokedAt.getTime() - derniereActivite.getTime() <=
        PAS_ACTIVITE_MS * 2
          ? derniere.revokedAt
          : derniereActivite
    } else if (
      derniere.expiresAt > maintenant &&
      maintenant.getTime() - derniereActivite.getTime() <= SEUIL_INACTIVITE_MS
    ) {
      etat = 'EN_COURS'
      fin = maintenant
    } else {
      etat = 'INTERROMPUE'
      fin = derniereActivite
    }
    resultat.set(id, {
      debut,
      fin,
      derniereActivite,
      etat,
      dureeMinutes: Math.max(
        0,
        Math.round((fin.getTime() - debut.getTime()) / 60_000),
      ),
    })
  }
  return resultat
}
