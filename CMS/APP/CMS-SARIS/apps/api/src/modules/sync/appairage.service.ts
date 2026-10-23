/**
 * AppairageService — enregistrer un poste de bureau avec un CODE au lieu d'un compte (serveur central uniquement).
 *
 *  - creerCode / listerCodes / annulerCode : l'administrateur prépare, suit et retire des codes (un site, une durée, un
 *    nombre de postes). Le code n'est montré qu'à sa création ; seule son empreinte est rangée.
 *  - appairer : le poste présente un code, UNE fois. Le serveur le rattache au site du code, lui donne un SECRET que
 *    seul lui détient, et ne lui demande plus jamais le code.
 *  - emettreJeton : le poste échange son secret contre un jeton d'accès de 8 h, limité à la synchronisation (cf.
 *    security/poste-token.ts) — il le renouvelle de lui-même.
 *  - revoquerAcces : l'administrateur coupe l'accès d'un poste ; son jeton cesse de valoir au prochain appel.
 *
 * Pourquoi pas un « compte poste » dans la table des utilisateurs : ces lignes se synchroniseraient sur tous les postes,
 * apparaîtraient dans la messagerie, les listes de personnel et le décompte des comptes. Ici l'identité d'un poste est
 * sa propre ligne (PosteLocal), non synchronisée, et ses droits sont fixes.
 */
import {
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import {
  DUREE_JETON_POSTE,
  PREFIXE_POSTE,
  generationSecret,
} from '../security/poste-token'
import {
  LimiteurEchecs,
  empreinteCode,
  empreinteSecret,
  etatCode,
  formaterCode,
  genererCode,
  genererSecret,
  memeEmpreinte,
  normaliserCode,
  type EtatCode,
} from './appairage-code'
import type {
  AppairerPosteDto,
  CreerCodeAppairageDto,
  JetonPosteDto,
} from './appairage.dto'

const MESSAGE_CODE_INVALIDE = 'Code d’appairage invalide, expiré ou déjà utilisé.'
const MESSAGE_ACCES_INVALIDE = 'Accès du poste invalide ou révoqué.'
const SECONDES_JETON = 8 * 3600

export interface CodeAppairageVue {
  id: string
  siteId: string
  siteLibelle: string | null
  usagesMax: number
  usagesFaits: number
  etat: EtatCode
  expireAt: Date
  annuleAt: Date | null
  note: string | null
  creeParNom: string | null
  createdAt: Date
  /** Les postes appairés avec ce code (nom lisible). */
  postes: { id: string; libelle: string }[]
}

@Injectable()
export class AppairageService {
  private readonly logger = new Logger('Appairage')
  /** Essais ratés de code, par origine : au-delà, plus aucun essai pendant un moment. */
  private readonly echecsCode = new LimiteurEchecs(15, 15 * 60_000)
  /** Essais ratés d'échange de secret (un poste légitime se trompe rarement : seuil plus large). */
  private readonly echecsJeton = new LimiteurEchecs(60, 15 * 60_000)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
  ) {}

  private get cleHmac(): string {
    return this.config.getOrThrow<string>('JWT_SECRET')
  }

  private signaler(): void {
    this.notifications.broadcastLive('SYNC_ACTIVITY', {
      requiredPermission: 'synchronisation.read',
    })
  }

  /** Trace un geste d'appairage dans le journal d'audit. Jamais bloquant. */
  private async tracer(
    action: string,
    entiteType: string,
    entiteId: string | null,
    auteurId: string | null,
    ip: string | null,
    apres: Record<string, string | number | boolean | null> = {},
  ): Promise<void> {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: auteurId,
          action,
          module: 'synchronisation',
          entiteType,
          entiteId,
          ipAdresse: ip,
          statut: 'SUCCES',
          apresJson: apres,
        },
      })
    } catch (e) {
      this.logger.error(`Appairage non tracé : ${(e as Error).message}`)
    }
  }

  // ── Administration des codes ────────────────────────────────────────────────

  async creerCode(
    dto: CreerCodeAppairageDto,
    auteurId: string | null,
    ip: string | null,
  ): Promise<{
    id: string
    /** Le code, sous la forme `K7QM-4XPD` : montré UNE SEULE FOIS. */
    code: string
    siteId: string
    siteLibelle: string
    usagesMax: number
    expireAt: Date
    note: string | null
  }> {
    const site = await this.prisma.site.findUnique({
      where: { id: dto.siteId },
      select: { id: true, libelle: true },
    })
    if (!site) throw new NotFoundException('Site introuvable')
    const usagesMax = dto.usagesMax ?? 1
    const expireAt = new Date(Date.now() + (dto.validiteHeures ?? 24) * 3_600_000)

    // Une collision sur 2^40 est quasi impossible ; on retente quand même plutôt que d'échouer.
    for (let essai = 0; essai < 5; essai++) {
      const code = genererCode()
      try {
        const ligne = await this.prisma.codeAppairage.create({
          data: {
            codeHash: empreinteCode(code, this.cleHmac),
            siteId: site.id,
            usagesMax,
            expireAt,
            note: dto.note?.trim() || null,
            creePar: auteurId,
          },
        })
        await this.tracer('APPAIRAGE_CODE_CREE', 'CodeAppairage', ligne.id, auteurId, ip, {
          site: site.libelle,
          usagesMax,
          expireAt: expireAt.toISOString(),
        })
        return {
          id: ligne.id,
          code: formaterCode(code),
          siteId: site.id,
          siteLibelle: site.libelle,
          usagesMax,
          expireAt,
          note: ligne.note,
        }
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e
      }
    }
    throw new HttpException('Impossible de générer un code, réessayez.', 500)
  }

  async listerCodes(): Promise<CodeAppairageVue[]> {
    const codes = await this.prisma.codeAppairage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    if (!codes.length) return []
    const createurs = [
      ...new Set(codes.map((c) => c.creePar).filter((x): x is string => !!x)),
    ]
    const [postes, sites, auteurs] = await Promise.all([
      this.prisma.posteLocal.findMany({
        where: { appaireCodeId: { in: codes.map((c) => c.id) } },
        select: { id: true, libelle: true, appaireCodeId: true },
        orderBy: { appaireAt: 'asc' },
      }),
      this.prisma.site.findMany({
        where: { id: { in: [...new Set(codes.map((c) => c.siteId))] } },
        select: { id: true, libelle: true },
      }),
      createurs.length
        ? this.prisma.utilisateur.findMany({
            where: { id: { in: createurs } },
            select: {
              id: true,
              login: true,
              personnelMedical: { select: { nom: true, prenom: true } },
            },
          })
        : Promise.resolve([]),
    ])
    const siteParId = new Map(sites.map((s) => [s.id, s.libelle] as const))
    const auteurParId = new Map(
      auteurs.map(
        (u) =>
          [
            u.id,
            u.personnelMedical
              ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
              : u.login,
          ] as const,
      ),
    )
    const maintenant = new Date()
    return codes.map((c) => ({
      id: c.id,
      siteId: c.siteId,
      siteLibelle: siteParId.get(c.siteId) ?? null,
      usagesMax: c.usagesMax,
      usagesFaits: c.usagesFaits,
      etat: etatCode(c, c.usagesFaits, maintenant),
      expireAt: c.expireAt,
      annuleAt: c.annuleAt,
      note: c.note,
      creeParNom: c.creePar ? (auteurParId.get(c.creePar) ?? null) : null,
      createdAt: c.createdAt,
      postes: postes
        .filter((p) => p.appaireCodeId === c.id)
        .map((p) => ({ id: p.id, libelle: p.libelle })),
    }))
  }

  /** Annule un code : plus aucun nouveau poste ne peut s'appairer avec. Les postes déjà appairés ne sont pas touchés. */
  async annulerCode(
    id: string,
    auteurId: string | null,
    ip: string | null,
  ): Promise<void> {
    const code = await this.prisma.codeAppairage.findUnique({ where: { id } })
    if (!code) throw new NotFoundException('Code introuvable')
    if (code.annuleAt) return
    await this.prisma.codeAppairage.update({
      where: { id },
      data: { annuleAt: new Date() },
    })
    await this.tracer('APPAIRAGE_CODE_ANNULE', 'CodeAppairage', id, auteurId, ip)
  }

  /** Coupe l'accès d'un poste appairé : son jeton cesse de valoir au prochain appel. Il peut se réappairer avec un nouveau code. */
  async revoquerAcces(
    posteId: string,
    auteurId: string | null,
    ip: string | null,
  ): Promise<void> {
    const poste = await this.prisma.posteLocal.findUnique({
      where: { id: posteId },
      select: { id: true, libelle: true, secretHash: true },
    })
    if (!poste) throw new NotFoundException('Poste introuvable')
    if (!poste.secretHash) return
    await this.prisma.posteLocal.update({
      where: { id: posteId },
      data: { secretHash: null, accesRevoqueAt: new Date() },
    })
    await this.tracer('APPAIRAGE_ACCES_REVOQUE', 'PosteLocal', posteId, auteurId, ip, {
      poste: poste.libelle,
    })
    this.signaler()
  }

  // ── Côté poste ──────────────────────────────────────────────────────────────

  /**
   * Un nom de poste libre dans le site : celui demandé, sinon suivi de « (2) », « (3) »… Un nom déjà pris ne doit pas
   * faire échouer l'installation d'un poste (le renommage, lui, reste une décision de l'administrateur).
   */
  private async libelleLibre(
    siteId: string,
    demande: string | undefined,
    posteLocalId: string,
  ): Promise<string> {
    const base = (demande?.trim() || `Poste ${posteLocalId.slice(0, 8)}`).slice(0, 72)
    for (let n = 1; n < 100; n++) {
      const candidat = n === 1 ? base : `${base} (${n})`
      const pris = await this.prisma.posteLocal.findFirst({
        where: { siteId, libelle: candidat, id: { not: posteLocalId } },
        select: { id: true },
      })
      if (!pris) return candidat
    }
    return `${base} (${posteLocalId.slice(0, 4)})`
  }

  /** Le poste présente son code : il reçoit son site, son nom et SON secret (montré une seule fois). */
  async appairer(
    dto: AppairerPosteDto,
    ip: string,
  ): Promise<{
    posteSecret: string
    posteLocalId: string
    siteId: string
    siteLibelle: string | null
    libelle: string
  }> {
    if (this.echecsCode.bloque(ip))
      throw new HttpException(
        'Trop d’essais de code. Patientez quelques minutes avant de réessayer.',
        429,
      )
    const refuser = (): never => {
      this.echecsCode.enregistrerEchec(ip)
      // Le même refus pour un code faux, expiré, annulé ou épuisé : on ne dit pas lequel (pas d'indice à un devineur).
      throw new ForbiddenException(MESSAGE_CODE_INVALIDE)
    }

    const normalise = normaliserCode(dto.code)
    if (!normalise) return refuser()
    const code = await this.prisma.codeAppairage.findUnique({
      where: { codeHash: empreinteCode(normalise, this.cleHmac) },
    })
    if (!code) return refuser()

    const maintenant = new Date()
    const etat = etatCode(code, code.usagesFaits, maintenant)
    if (etat === 'ANNULE' || etat === 'EXPIRE') return refuser()
    // Réinstallation d'un poste DÉJÀ appairé avec ce code : il reprend son rang, il n'en consomme pas un autre.
    const dejaCeCode = !!(await this.prisma.posteLocal.findFirst({
      where: { id: dto.posteLocalId, appaireCodeId: code.id },
      select: { id: true },
    }))
    if (etat === 'EPUISE' && !dejaCeCode) return refuser()

    let reserve = false
    if (!dejaCeCode) {
      // Réservation ATOMIQUE d'une place : la condition est dans l'UPDATE, donc deux postes simultanés ne passent pas
      // tous les deux sur la dernière place.
      const r = await this.prisma.codeAppairage.updateMany({
        where: {
          id: code.id,
          annuleAt: null,
          expireAt: { gt: maintenant },
          usagesFaits: { lt: code.usagesMax },
        },
        data: { usagesFaits: { increment: 1 } },
      })
      if (r.count !== 1) return refuser()
      reserve = true
    }

    try {
      const secret = genererSecret()
      const existant = await this.prisma.posteLocal.findUnique({
        where: { id: dto.posteLocalId },
        select: { libelle: true },
      })
      // Un poste déjà connu garde le nom que le serveur lui donne (le serveur fait foi, cf. renommage par l'admin).
      const libelle =
        existant?.libelle ??
        (await this.libelleLibre(code.siteId, dto.libelle, dto.posteLocalId))
      const poste = await this.prisma.posteLocal.upsert({
        where: { id: dto.posteLocalId },
        create: {
          id: dto.posteLocalId,
          siteId: code.siteId,
          libelle,
          secretHash: empreinteSecret(secret),
          appaireAt: maintenant,
          appaireCodeId: code.id,
          versionApp: dto.versionApp ?? null,
        },
        update: {
          siteId: code.siteId,
          secretHash: empreinteSecret(secret),
          appaireAt: maintenant,
          appaireCodeId: code.id,
          accesRevoqueAt: null,
          masque: false,
          ...(dto.versionApp ? { versionApp: dto.versionApp } : {}),
        },
      })
      const site = await this.prisma.site.findUnique({
        where: { id: code.siteId },
        select: { libelle: true },
      })
      this.echecsCode.oublier(ip)
      await this.tracer('APPAIRAGE_POSTE', 'PosteLocal', poste.id, null, ip, {
        poste: poste.libelle,
        site: site?.libelle ?? null,
        codeId: code.id,
      })
      this.signaler()
      return {
        posteSecret: secret,
        posteLocalId: poste.id,
        siteId: code.siteId,
        siteLibelle: site?.libelle ?? null,
        libelle: poste.libelle,
      }
    } catch (e) {
      // La place réservée est rendue : un échec d'enregistrement ne doit pas brûler une place du code.
      if (reserve) {
        await this.prisma.codeAppairage
          .update({ where: { id: code.id }, data: { usagesFaits: { decrement: 1 } } })
          .catch(() => undefined)
      }
      throw e
    }
  }

  /** Le poste échange son secret contre un jeton d'accès limité à la synchronisation. */
  async emettreJeton(
    dto: JetonPosteDto,
    ip: string,
  ): Promise<{ accessToken: string; expiresIn: number; siteId: string; libelle: string }> {
    if (this.echecsJeton.bloque(ip))
      throw new HttpException('Trop d’essais. Patientez quelques minutes.', 429)
    const poste = await this.prisma.posteLocal.findUnique({
      where: { id: dto.posteLocalId },
      select: { id: true, siteId: true, libelle: true, secretHash: true },
    })
    if (
      !poste?.secretHash ||
      !memeEmpreinte(poste.secretHash, empreinteSecret(dto.secret))
    ) {
      this.echecsJeton.enregistrerEchec(ip)
      throw new UnauthorizedException(MESSAGE_ACCES_INVALIDE)
    }
    const accessToken = await this.jwt.signAsync(
      {
        sub: `${PREFIXE_POSTE}${poste.id}`,
        typ: 'poste',
        posteLocalId: poste.id,
        siteId: poste.siteId,
        roles: [],
        permissions: [],
        personnelMedicalId: null,
        pe: generationSecret(poste.secretHash),
      },
      { expiresIn: DUREE_JETON_POSTE },
    )
    return {
      accessToken,
      expiresIn: SECONDES_JETON,
      siteId: poste.siteId,
      libelle: poste.libelle,
    }
  }
}
