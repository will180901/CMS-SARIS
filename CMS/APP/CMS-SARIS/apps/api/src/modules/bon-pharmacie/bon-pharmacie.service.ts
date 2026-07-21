/**
 * BonPharmacieService — Bon de pharmacie (recueil) : voucher de retrait de médicaments
 * (gratuits), généré depuis une ordonnance PHARMACEUTIQUE validée (ordonnanceId, traçabilité).
 * Réservé au personnel CDI + ayants droit (garde MEDICAMENT via DroitCategoriePatient).
 * Calque BonExamenService.
 *
 * Cycle de vie : EN_ATTENTE → DELIVRE (retiré en pharmacie) ou EN_ATTENTE → ANNULE
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
  AnnulerBonPharmacieDto,
  BonPharmacieQueryDto,
} from './dto/bon-pharmacie.dto'

const BON_INCLUDE = {
  lignes: {
    include: {
      medicament: {
        select: { id: true, nomGenerique: true, nomCommercial: true },
      },
    },
  },
  // Statut de l'ordonnance d'origine : permet au frontend de signaler un bon dont l'ordonnance
  // a été annulée APRÈS coup (bon déjà DELIVRE, non touché par la cascade).
  ordonnance: { select: { id: true, statut: true } },
  consultation: {
    select: {
      id: true,
      visite: {
        select: {
          patient: {
            select: {
              id: true,
              numeroPatient: true,
              identite: {
                select: {
                  nom: true,
                  prenom: true,
                  dateNaissance: true,
                  sexe: true,
                },
              },
            },
          },
        },
      },
    },
  },
} as const

@Injectable()
export class BonPharmacieService {
  constructor(private readonly prisma: PrismaService) {}

  // Volontairement SANS filtre de site : l'accès est gouverné uniquement par les
  // permissions (bon_pharmacie.read/create/deliver/cancel), pas par le site.
  private async getOrThrow(id: string) {
    const bon = await this.prisma.bonPharmacie.findFirst({
      where: { id },
      include: BON_INCLUDE,
    })
    if (!bon) throw new NotFoundException('Bon de pharmacie introuvable')
    return bon
  }

  async findAll(query: BonPharmacieQueryDto) {
    // Volontairement SANS filtre de site (accès gouverné par permission).
    const where: any = {}
    if (query.patientId)
      where.consultation = { visite: { patientId: query.patientId } }
    if (query.consultationId) where.consultationId = query.consultationId
    if (query.statut && query.statut !== 'TOUS') where.statut = query.statut

    return this.prisma.bonPharmacie.findMany({
      where,
      include: BON_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string) {
    return this.getOrThrow(id)
  }

  // Créer un bon de pharmacie « à la main » n'existe plus ici (route retirée) : un bon naît
  // exclusivement de « Générer un bon » sur une ordonnance PHARMACEUTIQUE validée (voir
  // ConsultationService.genererBonDepuisOrdonnance), pour garantir sa traçabilité.

  async deliver(id: string, delivrePar: string | null) {
    const bon = await this.getOrThrow(id)
    if (bon.statut !== 'EN_ATTENTE') {
      throw new ConflictException(
        'Seul un bon en attente peut être marqué délivré',
      )
    }
    await this.prisma.bonPharmacie.update({
      where: { id },
      data: {
        statut: 'DELIVRE',
        delivreLe: new Date(),
        delivrePar: delivrePar ?? null,
      },
    })
    return this.getOrThrow(id)
  }

  async annuler(id: string, dto: AnnulerBonPharmacieDto) {
    const bon = await this.getOrThrow(id)
    if (bon.statut === 'ANNULE') throw new ConflictException('Bon déjà annulé')
    if (bon.statut === 'DELIVRE')
      throw new ConflictException('Un bon déjà délivré ne peut être annulé')
    if (!dto.motifAnnulation?.trim())
      throw new BadRequestException("Motif d'annulation requis")
    await this.prisma.bonPharmacie.update({
      where: { id },
      data: { statut: 'ANNULE', motifAnnulation: dto.motifAnnulation.trim() },
    })
    return this.getOrThrow(id)
  }

  /**
   * Volontairement SANS filtre de site : la suppression est aussi déclenchée depuis
   * l'onglet Documents du dossier patient CENTRALISÉ (bons des deux sites) — un
   * document visible dans le dossier doit rester gérable depuis là.
   */
  async delete(id: string) {
    const bon = await this.prisma.bonPharmacie.findFirst({ where: { id } })
    if (!bon) throw new NotFoundException('Bon de pharmacie introuvable')
    await this.prisma.$transaction([
      this.prisma.ligneBonPharmacie.deleteMany({ where: { bonId: id } }),
      this.prisma.bonPharmacie.delete({ where: { id } }),
    ])
    return { id, deleted: true }
  }
}
