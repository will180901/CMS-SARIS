import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/** Même durée que le cache des permissions : le délai maximal entre une écriture directe en base et
 *  sa prise en compte. Les gestes qui posent ou lèvent le drapeau (changement, réinitialisation,
 *  création) invalident explicitement : leur effet est immédiat. */
const TTL_MS = 20_000

interface Entree {
  doitChanger: boolean
  expireA: number
}

/**
 * Ce compte porte-t-il un mot de passe TEMPORAIRE qu'il doit d'abord remplacer ?
 *
 * Interrogé à chaque requête authentifiée (cf. JwtStrategy), donc mis en cache quelques secondes —
 * comme les permissions : une lecture en base par appel, sur chaque appel, serait un coût réel sur
 * une base distante.
 */
@Injectable()
export class MotDePasseTemporaireService {
  private readonly cache = new Map<string, Entree>()

  constructor(private readonly prisma: PrismaService) {}

  async doitChanger(utilisateurId: string): Promise<boolean> {
    const enCache = this.cache.get(utilisateurId)
    if (enCache && enCache.expireA > Date.now()) return enCache.doitChanger

    const u = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { motDePasseTemp: true },
    })
    const doitChanger = u?.motDePasseTemp === true
    this.cache.set(utilisateurId, {
      doitChanger,
      expireA: Date.now() + TTL_MS,
    })
    return doitChanger
  }

  /** À appeler dès que le drapeau change : le prochain appel relit la base. */
  invalider(utilisateurId: string): void {
    this.cache.delete(utilisateurId)
  }
}
