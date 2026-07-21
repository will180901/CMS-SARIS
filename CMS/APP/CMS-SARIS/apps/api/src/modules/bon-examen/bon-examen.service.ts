/**
 * BonExamenService — Bons d'examen complémentaires prescrits durant une consultation.
 *
 * Cycle de vie : EN_ATTENTE → VALIDE → (résultat saisi : statut RECU) → CONSULTÉ
 *              → ou EN_ATTENTE → ANNULE
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
  UpdateBonExamenDto,
  ValiderBonExamenDto,
  SaisirResultatDto,
  BonExamenQueryDto,
} from './dto/bon-examen.dto'

const BON_INCLUDE = {
  lignes: {
    include: {
      typeExamen: {
        select: { id: true, code: true, libelle: true, domaine: true },
      },
    },
  },
  resultats: { orderBy: { createdAt: 'desc' as const } },
  // Statut de l'ordonnance d'origine : permet au frontend de signaler un bon dont l'ordonnance
  // a été annulée APRÈS coup (bon déjà VALIDE/résultat saisi, non touché par la cascade).
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
export class BonExamenService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Volontairement SANS filtre de site : l'accès est gouverné uniquement par les
  // permissions (bon_examen.read/create/validate/cancel/result), pas par le site.
  private async getOrThrow(id: string) {
    const bon = await this.prisma.bonExamen.findFirst({
      where: { id },
      include: BON_INCLUDE,
    })
    if (!bon) throw new NotFoundException("Bon d'examen introuvable")
    return bon
  }

  // ── Liste ─────────────────────────────────────────────────────────────────

  async findAll(query: BonExamenQueryDto) {
    // Volontairement SANS filtre de site (accès gouverné par permission).
    const where: any = {}
    if (query.patientId)
      where.consultation = { visite: { patientId: query.patientId } }
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

  async findById(id: string) {
    return this.getOrThrow(id)
  }

  // Créer un bon d'examen « à la main » n'existe plus ici (route retirée) : un bon naît
  // exclusivement de « Générer un bon » sur une ordonnance PRESCRIPTION_EXAMEN validée
  // (voir ConsultationService.genererBonDepuisOrdonnance), pour garantir sa traçabilité.

  // ── Modifier (brouillon uniquement) ───────────────────────────────────────

  async update(id: string, dto: UpdateBonExamenDto) {
    const bon = await this.getOrThrow(id)
    if (bon.statut !== 'EN_ATTENTE') {
      throw new ConflictException('Seul un bon EN_ATTENTE peut être modifié')
    }

    await this.prisma.bonExamen.update({
      where: { id },
      data: {
        indicationClinik: dto.indicationClinik?.trim() ?? bon.indicationClinik,
        etablissementId:
          dto.etablissementId !== undefined
            ? dto.etablissementId
            : bon.etablissementId,
      },
    })
    return this.getOrThrow(id)
  }

  // ── Valider / Annuler ─────────────────────────────────────────────────────

  async validerOuAnnuler(id: string, dto: ValiderBonExamenDto) {
    const bon = await this.getOrThrow(id)
    if (bon.statut !== 'EN_ATTENTE') {
      throw new ConflictException('Statut non modifiable depuis ' + bon.statut)
    }

    if (dto.statut === 'ANNULE' && !dto.motifAnnulation?.trim()) {
      throw new BadRequestException("Motif d'annulation requis")
    }

    await this.prisma.bonExamen.update({
      where: { id },
      data: {
        statut: dto.statut,
        motifAnnulation:
          dto.statut === 'ANNULE' ? dto.motifAnnulation!.trim() : null,
      },
    })
    return this.getOrThrow(id)
  }

  // ── Annuler (perm bon_examen.cancel — couvre aussi un bon déjà VALIDE) ──────

  async annuler(id: string, motifAnnulation: string) {
    const bon = await this.getOrThrow(id)
    if (bon.statut !== 'EN_ATTENTE' && bon.statut !== 'VALIDE') {
      throw new ConflictException(
        'Seul un bon en attente ou validé peut être annulé',
      )
    }
    if (!motifAnnulation?.trim()) {
      throw new BadRequestException("Motif d'annulation requis")
    }
    await this.prisma.bonExamen.update({
      where: { id },
      data: { statut: 'ANNULE', motifAnnulation: motifAnnulation.trim() },
    })
    return this.getOrThrow(id)
  }

  // ── Supprimer définitivement (perm bon_examen.delete) ──────────────────────

  /**
   * Volontairement SANS filtre de site (contrairement à `getOrThrow`, utilisé par les
   * autres méthodes de ce service pour le workflow ACTIF) : la suppression est aussi
   * déclenchée depuis l'onglet Documents du dossier patient CENTRALISÉ, qui montre
   * des bons des deux sites — un document visible dans le dossier doit rester gérable
   * depuis là, sans « introuvable » pour un bon créé sur l'autre site.
   */
  async delete(id: string) {
    const bon = await this.prisma.bonExamen.findFirst({
      where: { id },
      include: BON_INCLUDE,
    })
    if (!bon) throw new NotFoundException("Bon d'examen introuvable")
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

  async saisirResultat(
    bonId: string,
    dto: SaisirResultatDto,
    acteurId: string,
  ) {
    const bon = await this.getOrThrow(bonId)
    if (bon.statut !== 'VALIDE') {
      throw new ConflictException(
        'Seul un bon validé peut recevoir un résultat',
      )
    }

    await this.prisma.resultatExamen.create({
      data: {
        bonId,
        laboratoire: dto.laboratoire?.trim() ?? null,
        contenu: dto.contenu.trim(),
        interpretation: dto.interpretation?.trim() ?? null,
        statut: 'RECU',
        saisiePar: acteurId,
      },
    })
    return this.getOrThrow(bonId)
  }
}
