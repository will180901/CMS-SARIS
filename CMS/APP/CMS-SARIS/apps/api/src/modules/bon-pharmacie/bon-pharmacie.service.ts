/**
 * BonPharmacieService — Bon de pharmacie (recueil) : voucher de retrait de médicaments
 * (gratuits) DISTINCT de l'ordonnance. Réservé au personnel CDI + ayants droit
 * (garde MEDICAMENT via DroitCategoriePatient). Calque BonExamenService.
 *
 * Cycle de vie : EN_ATTENTE → DELIVRE (retiré en pharmacie) ou EN_ATTENTE → ANNULE
 */
import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { assertPrestationCouverte } from '../../common/droits-categorie'
import {
  CreateBonPharmacieDto, AnnulerBonPharmacieDto, BonPharmacieQueryDto,
} from './dto/bon-pharmacie.dto'

const BON_INCLUDE = {
  lignes: { include: { medicament: { select: { id: true, nomGenerique: true, nomCommercial: true } } } },
  consultation: {
    select: {
      id: true,
      visite: {
        select: {
          patient: {
            select: {
              id: true, numeroPatient: true,
              identite: { select: { nom: true, prenom: true, dateNaissance: true, sexe: true } },
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

  // Cloisonnement SITE : le bon → consultation → visite → siteId (anti-IDOR cross-site).
  private async getOrThrow(id: string, siteId: string) {
    const bon = await this.prisma.bonPharmacie.findFirst({
      where: { id, consultation: { visite: { siteId } } },
      include: BON_INCLUDE,
    })
    if (!bon) throw new NotFoundException('Bon de pharmacie introuvable')
    return bon
  }

  async findAll(query: BonPharmacieQueryDto, siteId: string) {
    const visiteWhere: any = { siteId }
    if (query.patientId) visiteWhere.patientId = query.patientId
    const where: any = { consultation: { visite: visiteWhere } }
    if (query.consultationId) where.consultationId = query.consultationId
    if (query.statut && query.statut !== 'TOUS') where.statut = query.statut

    return this.prisma.bonPharmacie.findMany({
      where, include: BON_INCLUDE, orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, siteId: string) {
    return this.getOrThrow(id, siteId)
  }

  async create(dto: CreateBonPharmacieDto, siteId: string, prescripteurId: string) {
    const consultation = await this.prisma.consultation.findFirst({
      where:  { id: dto.consultationId, visite: { siteId } },
      select: { statut: true, visite: { select: { patient: { select: { categoriePatientId: true } } } } },
    })
    if (!consultation) throw new NotFoundException('Consultation introuvable')
    // Le bon de pharmacie est délivré par l'infirmier une fois la consultation
    // CLÔTURÉE (recueil §3.2/§4.3) — jamais pendant que le médecin est encore en
    // train d'examiner, jamais après une annulation.
    if (consultation.statut !== 'CLOTUREE') {
      throw new ConflictException('Le bon de pharmacie ne peut être créé qu\'une fois la consultation clôturée')
    }

    // Le bon de pharmacie délivre ce que l'ordonnance a prescrit — il exige donc
    // qu'une ordonnance VALIDÉE existe pour cette consultation (contrairement au bon
    // d'examen, indépendant de toute ordonnance).
    const ordonnanceValidee = await this.prisma.ordonnance.count({
      where: { consultationId: dto.consultationId, statut: 'VALIDEE' },
    })
    if (ordonnanceValidee === 0) {
      throw new ConflictException('Une ordonnance validée est requise avant de créer un bon de pharmacie')
    }

    // RÈGLE CENTRALE (recueil) : médicaments réservés aux CDI + ayants droit.
    await assertPrestationCouverte(this.prisma, consultation.visite.patient.categoriePatientId, 'MEDICAMENT')

    const bon = await this.prisma.$transaction(async tx => {
      const created = await tx.bonPharmacie.create({
        data: {
          consultationId: dto.consultationId,
          prescripteurId,
          observations:   dto.observations?.trim() ?? null,
          statut:         'EN_ATTENTE',
        },
      })
      await tx.ligneBonPharmacie.createMany({
        data: dto.lignes.map(l => ({
          bonId:        created.id,
          medicamentId: l.medicamentId ?? null,
          libelle:      l.libelle.trim(),
          posologie:    l.posologie?.trim() ?? null,
          quantite:     l.quantite?.trim() ?? null,
        })),
      })
      return created
    })
    return this.getOrThrow(bon.id, siteId)
  }

  async deliver(id: string, siteId: string, delivrePar: string | null) {
    const bon = await this.getOrThrow(id, siteId)
    if (bon.statut !== 'EN_ATTENTE') {
      throw new ConflictException('Seul un bon en attente peut être marqué délivré')
    }
    await this.prisma.bonPharmacie.update({
      where: { id },
      data:  { statut: 'DELIVRE', delivreLe: new Date(), delivrePar: delivrePar ?? null },
    })
    return this.getOrThrow(id, siteId)
  }

  async annuler(id: string, dto: AnnulerBonPharmacieDto, siteId: string) {
    const bon = await this.getOrThrow(id, siteId)
    if (bon.statut === 'ANNULE') throw new ConflictException('Bon déjà annulé')
    if (bon.statut === 'DELIVRE') throw new ConflictException('Un bon déjà délivré ne peut être annulé')
    if (!dto.motifAnnulation?.trim()) throw new BadRequestException('Motif d\'annulation requis')
    await this.prisma.bonPharmacie.update({
      where: { id },
      data:  { statut: 'ANNULE', motifAnnulation: dto.motifAnnulation.trim() },
    })
    return this.getOrThrow(id, siteId)
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
