/**
 * BonExamenService — Bons d'examen complémentaires prescrits durant une consultation.
 *
 * Cycle de vie : EN_ATTENTE → VALIDE → (résultat saisi : statut RECU) → CONSULTÉ
 *              → ou EN_ATTENTE → ANNULE
 */

import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { assertPeutPrescrire, type PrescriptionScope } from '../../common/prescription'
import { assertPrestationCouverte } from '../../common/droits-categorie'
import {
  CreateBonExamenDto, UpdateBonExamenDto, ValiderBonExamenDto,
  SaisirResultatDto, BonExamenQueryDto,
} from './dto/bon-examen.dto'

const BON_INCLUDE = {
  lignes: { include: { typeExamen: { select: { id: true, code: true, libelle: true, domaine: true } } } },
  resultats: { orderBy: { createdAt: 'desc' as const } },
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
export class BonExamenService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Cloisonnement SITE : un bon n'est accessible que si sa consultation appartient
  // au site de l'appelant (BonExamen → consultation → visite → siteId). Sécurise
  // toutes les lectures ET écritures qui passent par ce helper (anti-IDOR cross-site).
  private async getOrThrow(id: string, siteId: string) {
    const bon = await this.prisma.bonExamen.findFirst({
      where: { id, consultation: { visite: { siteId } } },
      include: BON_INCLUDE,
    })
    if (!bon) throw new NotFoundException('Bon d\'examen introuvable')
    return bon
  }

  // ── Liste ─────────────────────────────────────────────────────────────────

  async findAll(query: BonExamenQueryDto, siteId: string) {
    // Cloisonnement SITE systématique (le bon → consultation → visite → site).
    const visiteWhere: any = { siteId }
    if (query.patientId) visiteWhere.patientId = query.patientId
    const where: any = { consultation: { visite: visiteWhere } }

    if (query.consultationId) where.consultationId = query.consultationId
    if (query.statut && query.statut !== 'TOUS') {
      where.statut = query.statut
    }

    return this.prisma.bonExamen.findMany({
      where,
      include: BON_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  // ── Détail ────────────────────────────────────────────────────────────────

  async findById(id: string, siteId: string) {
    return this.getOrThrow(id, siteId)
  }

  // ── Créer ─────────────────────────────────────────────────────────────────

  async create(dto: CreateBonExamenDto, siteId: string, scope: PrescriptionScope) {
    // Droit de prescrire (recueil) : médecin chef libre, infirmier seulement si délégué.
    await assertPeutPrescrire(this.prisma, scope)

    // Vérifier consultation (et qu'elle appartient au site de l'appelant)
    const consultation = await this.prisma.consultation.findFirst({
      where:  { id: dto.consultationId, visite: { siteId } },
      select: { statut: true, visite: { select: { patient: { select: { categoriePatientId: true } } } } },
    })
    if (!consultation) throw new NotFoundException('Consultation introuvable')
    if (consultation.statut !== 'OUVERTE') {
      throw new ConflictException('Impossible de créer un bon d\'examen sur une consultation clôturée')
    }

    // RÈGLE CENTRALE (recueil) : bon d'examens réservé aux CDI + ayants droit.
    await assertPrestationCouverte(this.prisma, consultation.visite.patient.categoriePatientId, 'EXAMEN')

    // Vérifier types d'examen
    const types = await this.prisma.typeExamen.findMany({ where: { id: { in: dto.typesExamenIds } } })
    if (types.length !== dto.typesExamenIds.length) {
      throw new BadRequestException('Un ou plusieurs types d\'examen sont invalides')
    }

    // Créer le bon + ses lignes
    const bon = await this.prisma.$transaction(async tx => {
      const created = await tx.bonExamen.create({
        data: {
          consultationId:  dto.consultationId,
          indicationClinik: dto.indicationClinik.trim(),
          etablissementId: dto.etablissementId ?? null,
          statut:          'EN_ATTENTE',
        },
      })
      await tx.ligneExamen.createMany({
        data: dto.typesExamenIds.map(typeExamenId => ({
          bonId: created.id,
          typeExamenId,
        })),
      })
      return created
    })

    return this.getOrThrow(bon.id, siteId)
  }

  // ── Modifier (brouillon uniquement) ───────────────────────────────────────

  async update(id: string, dto: UpdateBonExamenDto, siteId: string) {
    const bon = await this.getOrThrow(id, siteId)
    if (bon.statut !== 'EN_ATTENTE') {
      throw new ConflictException('Seul un bon EN_ATTENTE peut être modifié')
    }

    await this.prisma.bonExamen.update({
      where: { id },
      data:  {
        indicationClinik: dto.indicationClinik?.trim() ?? bon.indicationClinik,
        etablissementId:  dto.etablissementId !== undefined ? dto.etablissementId : bon.etablissementId,
      },
    })
    return this.getOrThrow(id, siteId)
  }

  // ── Valider / Annuler ─────────────────────────────────────────────────────

  async validerOuAnnuler(id: string, dto: ValiderBonExamenDto, siteId: string) {
    const bon = await this.getOrThrow(id, siteId)
    if (bon.statut !== 'EN_ATTENTE') {
      throw new ConflictException('Statut non modifiable depuis ' + bon.statut)
    }

    if (dto.statut === 'ANNULE' && !dto.motifAnnulation?.trim()) {
      throw new BadRequestException('Motif d\'annulation requis')
    }

    await this.prisma.bonExamen.update({
      where: { id },
      data:  {
        statut: dto.statut,
        motifAnnulation: dto.statut === 'ANNULE' ? dto.motifAnnulation!.trim() : null,
      },
    })
    return this.getOrThrow(id, siteId)
  }

  // ── Annuler (perm bon_examen.cancel — couvre aussi un bon déjà VALIDE) ──────

  async annuler(id: string, motifAnnulation: string, siteId: string) {
    const bon = await this.getOrThrow(id, siteId)
    if (bon.statut !== 'EN_ATTENTE' && bon.statut !== 'VALIDE') {
      throw new ConflictException('Seul un bon en attente ou validé peut être annulé')
    }
    if (!motifAnnulation?.trim()) {
      throw new BadRequestException('Motif d\'annulation requis')
    }
    await this.prisma.bonExamen.update({
      where: { id },
      data:  { statut: 'ANNULE', motifAnnulation: motifAnnulation.trim() },
    })
    return this.getOrThrow(id, siteId)
  }

  // ── Supprimer définitivement (perm bon_examen.delete) ──────────────────────

  async delete(id: string, siteId: string) {
    const bon = await this.getOrThrow(id, siteId)
    if (bon.resultats.length > 0) {
      throw new ConflictException(
        'Ce bon possède des résultats enregistrés : annulez-le plutôt que de le supprimer (traçabilité).',
      )
    }
    await this.prisma.$transaction([
      this.prisma.ligneExamen.deleteMany({ where: { bonId: id } }),
      this.prisma.bonExamen.delete({ where: { id } }),
    ])
    return { id, deleted: true }
  }

  // ── Saisir un résultat ────────────────────────────────────────────────────

  async saisirResultat(bonId: string, dto: SaisirResultatDto, acteurId: string, siteId: string) {
    const bon = await this.getOrThrow(bonId, siteId)
    if (bon.statut !== 'VALIDE') {
      throw new ConflictException('Seul un bon validé peut recevoir un résultat')
    }

    await this.prisma.resultatExamen.create({
      data: {
        bonId,
        laboratoire:    dto.laboratoire?.trim() ?? null,
        contenu:        dto.contenu.trim(),
        interpretation: dto.interpretation?.trim() ?? null,
        statut:         'RECU',
        saisiePar:      acteurId,
      },
    })
    return this.getOrThrow(bonId, siteId)
  }
}
