/**
 * SortiesCritiquesService — Évacuations.
 * Module 8 (sorties-critiques) — gestion des cas qui sortent du centre
 * pour une prise en charge ailleurs.
 */

import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import {
  CreateEvacuationDto, UpdateEvacuationDto, AddSuiviEvacuationDto,
  AnnulerEvacuationDto, EvacuationQueryDto,
} from './dto/evacuation.dto'

const EVACUATION_INCLUDE = {
  consultation: {
    select: {
      id: true, createdAt: true,
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
  etablissement: { select: { id: true, nom: true, type: true } },
  suivi: { orderBy: { createdAt: 'desc' as const } },
} as const

@Injectable()
export class SortiesCritiquesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif:  NotificationService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  //  ÉVACUATIONS
  // ══════════════════════════════════════════════════════════════════════════

  // Cloisonnement multi-site : `siteId` (JWT) restreint aux sorties dont la
  // consultation d'origine appartient au site de l'utilisateur. Une sortie d'un
  // autre site est traitée comme inexistante (404) — pas de fuite ni d'IDOR.
  private async getEvacOrThrow(id: string, siteId?: string) {
    const e = await this.prisma.evacuation.findFirst({
      where:   siteId ? { id, consultation: { visite: { siteId } } } : { id },
      include: EVACUATION_INCLUDE,
    })
    if (!e) throw new NotFoundException('Évacuation introuvable')
    return e
  }

  async findAllEvacuations(query: EvacuationQueryDto, siteId: string) {
    const visiteWhere: any = { siteId }
    if (query.patientId) visiteWhere.patientId = query.patientId
    const where: any = { consultation: { visite: visiteWhere } }
    if (query.consultationId) where.consultationId = query.consultationId
    if (query.statut && query.statut !== 'TOUS') where.statut = query.statut

    return this.prisma.evacuation.findMany({
      where,
      include: EVACUATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findEvacuationById(id: string, siteId: string) { return this.getEvacOrThrow(id, siteId) }

  async createEvacuation(dto: CreateEvacuationDto, siteId: string, acteurId?: string) {
    // Vérifier consultation + cloisonnement (la visite doit être du site)
    const c = await this.prisma.consultation.findFirst({
      where: { id: dto.consultationId, visite: { siteId } },
    })
    if (!c) throw new NotFoundException('Consultation introuvable')

    // Unicité (modèle @unique sur consultationId). Lecture sur le client BRUT
    // (`raw`) pour VOIR les tombstones soft-supprimés et pouvoir les ressusciter.
    const existing = await this.prisma.raw.evacuation.findUnique({ where: { consultationId: dto.consultationId } })
    if (existing && !existing.deletedAt && existing.statut !== 'ANNULE') {
      // Une évacuation active (EN_COURS) ou clôturée bloque toujours la recréation.
      throw new ConflictException({
        message: 'Une évacuation existe déjà pour cette consultation',
        existingEvacuationId: existing.id,
      })
    }

    // Si une évacuation ANNULÉE existe, on la réactive (resaisie) : reset des
    // données + purge de l'ancien suivi, dans une transaction. Sinon, création.
    if (existing) {
      await this.prisma.$transaction(async tx => {
        await tx.suiviEvacuation.deleteMany({ where: { evacuationId: existing.id } })
        await tx.evacuation.update({
          where: { id: existing.id },
          data: {
            niveauUrgence:   dto.niveauUrgence,
            motifId:         dto.motifId        ?? null,
            etablissementId: dto.etablissementId ?? null,
            infosCliniques:  dto.infosCliniques.trim(),
            statut:          'EN_COURS',
            motifAnnulation: null,
            deletedAt:       null,
          },
        })
      })
      return this.getEvacOrThrow(existing.id)
    }

    const created = await this.prisma.evacuation.create({
      data: {
        consultationId: dto.consultationId,
        niveauUrgence:  dto.niveauUrgence,
        motifId:        dto.motifId        ?? null,
        etablissementId: dto.etablissementId ?? null,
        infosCliniques: dto.infosCliniques.trim(),
        statut:         'EN_COURS',
      },
    })
    await this.notif.emit({
      type:               'EVACUATION_INITIEE',
      niveau:             dto.niveauUrgence === 'CRITIQUE' ? 'CRITIQUE' : 'AVERTISSEMENT',
      category:           'sortie',
      titre:              'Évacuation médicale initiée',
      message:            `Urgence ${dto.niveauUrgence.toLowerCase()} — transfert en cours`,
      siteId,
      requiredPermission: 'evacuation.read',
      entiteType:         'evacuation',
      entiteId:           created.id,
      lien:               '/sorties-critiques',
      createdById:        acteurId ?? null,
    })
    return this.getEvacOrThrow(created.id)
  }

  async updateEvacuation(id: string, dto: UpdateEvacuationDto, siteId: string) {
    const e = await this.getEvacOrThrow(id, siteId)
    if (e.statut === 'CLOTURE' || e.statut === 'ANNULE') {
      throw new ConflictException('Évacuation déjà ' + e.statut.toLowerCase())
    }
    await this.prisma.evacuation.update({
      where: { id },
      data: {
        niveauUrgence:   dto.niveauUrgence   ?? e.niveauUrgence,
        etablissementId: dto.etablissementId !== undefined ? dto.etablissementId : e.etablissementId,
        infosCliniques:  dto.infosCliniques?.trim() ?? e.infosCliniques,
      },
    })
    return this.getEvacOrThrow(id)
  }

  async addSuiviEvacuation(id: string, dto: AddSuiviEvacuationDto, acteurId: string, siteId: string) {
    const e = await this.getEvacOrThrow(id, siteId)
    if (e.statut === 'CLOTURE' || e.statut === 'ANNULE') {
      throw new ConflictException('Évacuation déjà ' + e.statut.toLowerCase())
    }

    await this.prisma.$transaction(async tx => {
      await tx.suiviEvacuation.create({
        data: {
          evacuationId: id,
          notes:        dto.notes.trim(),
          statut:       dto.statut,
          createdBy:    acteurId,
        },
      })
      // Si le suivi indique une CLOTURE → on clôture aussi l'évacuation
      if (dto.statut === 'CLOTURE') {
        await tx.evacuation.update({ where: { id }, data: { statut: 'CLOTURE' } })
      }
    })
    return this.getEvacOrThrow(id)
  }

  async annulerEvacuation(id: string, dto: AnnulerEvacuationDto, siteId: string) {
    const e = await this.getEvacOrThrow(id, siteId)
    if (e.statut !== 'EN_COURS') {
      throw new ConflictException('Seule une évacuation EN_COURS peut être annulée')
    }
    await this.prisma.evacuation.update({
      where: { id },
      data:  { statut: 'ANNULE', motifAnnulation: dto.motifAnnulation.trim() },
    })
    return this.getEvacOrThrow(id)
  }

  /** Clôture directe d'une évacuation (perm evacuation.close). */
  async cloturerEvacuation(id: string, siteId: string) {
    const e = await this.getEvacOrThrow(id, siteId)
    if (e.statut !== 'EN_COURS') {
      throw new ConflictException('Seule une évacuation EN_COURS peut être clôturée')
    }
    await this.prisma.evacuation.update({ where: { id }, data: { statut: 'CLOTURE' } })
    return this.getEvacOrThrow(id)
  }

  /** Suppression définitive d'une évacuation + ses suivis (perm evacuation.delete). */
  async deleteEvacuation(id: string, siteId: string) {
    await this.getEvacOrThrow(id, siteId)
    await this.prisma.$transaction([
      this.prisma.suiviEvacuation.deleteMany({ where: { evacuationId: id } }),
      this.prisma.evacuation.delete({ where: { id } }),
    ])
    return { id, deleted: true }
  }
}
