import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CI } from '../../common/prisma/search'
import type { ListQueryDto }             from './dto/list-query.dto'
import type { CreateSiteDto, UpdateSiteDto }                         from './dto/site.dto'
import type { CreateMotifDto, UpdateMotifDto }                       from './dto/motif.dto'
import type { CreatePathologieDto, UpdatePathologieDto }             from './dto/pathologie.dto'
import type { CreateMedicamentDto, UpdateMedicamentDto }             from './dto/medicament.dto'
import type { CreateCategoriePatientDto, UpdateCategoriePatientDto } from './dto/categorie-patient.dto'
import type { CreateTypeExamenDto, UpdateTypeExamenDto }             from './dto/type-examen.dto'
import type { CreateTypeConsultationDto, UpdateTypeConsultationDto } from './dto/type-consultation.dto'

/**
 * Normalise un statut reçu côté API vers l'enum attendu par l'entité.
 * Les pathologies et catégories utilisent ACTIVE/INACTIVE,
 * les autres utilisent ACTIF/INACTIF.
 */
function toEnumActifInactif(statut: string): 'ACTIF' | 'INACTIF' {
  if (statut === 'ACTIF' || statut === 'ACTIVE')   return 'ACTIF'
  if (statut === 'INACTIF' || statut === 'INACTIVE') return 'INACTIF'
  throw new BadRequestException(`Statut "${statut}" invalide (attendu ACTIF/INACTIF)`)
}
function toEnumActiveInactive(statut: string): 'ACTIVE' | 'INACTIVE' {
  if (statut === 'ACTIVE' || statut === 'ACTIF')   return 'ACTIVE'
  if (statut === 'INACTIVE' || statut === 'INACTIF') return 'INACTIVE'
  throw new BadRequestException(`Statut "${statut}" invalide (attendu ACTIVE/INACTIVE)`)
}

@Injectable()
export class ReferentielsService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════════════════
  //  SITES
  // ══════════════════════════════════════════════════════════════════════════

  findAllSites(query: ListQueryDto = {}) {
    return this.prisma.site.findMany({
      where: {
        ...(query.statut  && { statut: query.statut }),
        ...(query.search  && {
          OR: [
            { libelle:     { contains: query.search, ...CI } },
            { code:        { contains: query.search, ...CI } },
            { localisation:{ contains: query.search, ...CI } },
          ],
        }),
      },
      orderBy: { libelle: 'asc' },
    })
  }

  async findSiteById(id: string) {
    const site = await this.prisma.site.findUnique({ where: { id } })
    if (!site) throw new NotFoundException(`Site ${id} introuvable`)
    return site
  }

  async createSite(dto: CreateSiteDto) {
    const existing = await this.prisma.raw.site.findUnique({ where: { code: dto.code } })
    if (existing && !existing.deletedAt) throw new ConflictException(`Code site "${dto.code}" déjà utilisé`)
    if (existing) return this.prisma.site.update({ where: { id: existing.id }, data: { ...dto, deletedAt: null } })
    return this.prisma.site.create({ data: dto })
  }

  async updateSite(id: string, dto: UpdateSiteDto) {
    await this.findSiteById(id)
    return this.prisma.site.update({ where: { id }, data: dto })
  }

  async setStatutSite(id: string, statut: string) {
    await this.findSiteById(id)
    return this.prisma.site.update({ where: { id }, data: { statut: toEnumActifInactif(statut) } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MOTIFS DE CONSULTATION
  // ══════════════════════════════════════════════════════════════════════════

  findAllMotifs(query: ListQueryDto = {}) {
    return this.prisma.motifConsultation.findMany({
      where: {
        ...(query.statut && { statut: query.statut }),
        ...(query.search && {
          OR: [
            { libelle: { contains: query.search, ...CI } },
            { code:    { contains: query.search, ...CI } },
          ],
        }),
      },
      orderBy: { libelle: 'asc' },
    })
  }

  async createMotif(dto: CreateMotifDto) {
    const existing = await this.prisma.raw.motifConsultation.findUnique({ where: { code: dto.code } })
    if (existing && !existing.deletedAt) throw new ConflictException(`Code motif "${dto.code}" déjà utilisé`)
    if (existing) return this.prisma.motifConsultation.update({ where: { id: existing.id }, data: { ...dto, deletedAt: null } })
    return this.prisma.motifConsultation.create({ data: dto })
  }

  async updateMotif(id: string, dto: UpdateMotifDto) {
    const existing = await this.prisma.motifConsultation.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Motif ${id} introuvable`)
    return this.prisma.motifConsultation.update({ where: { id }, data: dto })
  }

  async setStatutMotif(id: string, statut: string) {
    const existing = await this.prisma.motifConsultation.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Motif ${id} introuvable`)
    return this.prisma.motifConsultation.update({ where: { id }, data: { statut: toEnumActifInactif(statut) } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PATHOLOGIES
  // ══════════════════════════════════════════════════════════════════════════

  findAllPathologies(query: ListQueryDto = {}) {
    return this.prisma.pathologieReference.findMany({
      where: {
        ...(query.statut && { statut: query.statut }),
        ...(query.search && {
          OR: [
            { libelle: { contains: query.search, ...CI } },
            { code:    { contains: query.search, ...CI } },
          ],
        }),
      },
      orderBy: { libelle: 'asc' },
    })
  }

  async createPathologie(dto: CreatePathologieDto) {
    const existing = await this.prisma.raw.pathologieReference.findUnique({ where: { code: dto.code } })
    if (existing && !existing.deletedAt) throw new ConflictException(`Code pathologie "${dto.code}" déjà utilisé`)
    if (existing) return this.prisma.pathologieReference.update({ where: { id: existing.id }, data: { ...dto, chronique: dto.chronique ?? false, deletedAt: null } })
    return this.prisma.pathologieReference.create({ data: { ...dto, chronique: dto.chronique ?? false } })
  }

  async updatePathologie(id: string, dto: UpdatePathologieDto) {
    const existing = await this.prisma.pathologieReference.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Pathologie ${id} introuvable`)
    return this.prisma.pathologieReference.update({ where: { id }, data: dto })
  }

  async setStatutPathologie(id: string, statut: string) {
    const existing = await this.prisma.pathologieReference.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Pathologie ${id} introuvable`)
    return this.prisma.pathologieReference.update({ where: { id }, data: { statut: toEnumActiveInactive(statut) } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MÉDICAMENTS
  // ══════════════════════════════════════════════════════════════════════════

  findAllMedicaments(query: ListQueryDto = {}) {
    return this.prisma.medicamentReference.findMany({
      where: {
        ...(query.statut && { statut: query.statut }),
        ...(query.search && {
          OR: [
            { nomGenerique:  { contains: query.search, ...CI } },
            { nomCommercial: { contains: query.search, ...CI } },
            { familleThera:  { contains: query.search, ...CI } },
          ],
        }),
      },
      orderBy: { nomGenerique: 'asc' },
    })
  }

  async createMedicament(dto: CreateMedicamentDto) {
    return this.prisma.medicamentReference.create({ data: dto })
  }

  async updateMedicament(id: string, dto: UpdateMedicamentDto) {
    const existing = await this.prisma.medicamentReference.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Médicament ${id} introuvable`)
    return this.prisma.medicamentReference.update({ where: { id }, data: dto })
  }

  async setStatutMedicament(id: string, statut: string) {
    const existing = await this.prisma.medicamentReference.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Médicament ${id} introuvable`)
    return this.prisma.medicamentReference.update({ where: { id }, data: { statut: toEnumActifInactif(statut) } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CATÉGORIES DE PATIENTS
  // ══════════════════════════════════════════════════════════════════════════

  findAllCategoriesPatient(query: ListQueryDto = {}) {
    return this.prisma.categoriePatient.findMany({
      where: {
        ...(query.statut && { statut: query.statut }),
        ...(query.search && {
          OR: [
            { libelle: { contains: query.search, ...CI } },
            { code:    { contains: query.search, ...CI } },
          ],
        }),
      },
      orderBy: { libelle: 'asc' },
    })
  }

  async createCategoriePatient(dto: CreateCategoriePatientDto) {
    const existing = await this.prisma.raw.categoriePatient.findUnique({ where: { code: dto.code } })
    if (existing && !existing.deletedAt) throw new ConflictException(`Code catégorie "${dto.code}" déjà utilisé`)
    if (existing) return this.prisma.categoriePatient.update({ where: { id: existing.id }, data: { ...dto, deletedAt: null } })
    return this.prisma.categoriePatient.create({ data: dto })
  }

  async updateCategoriePatient(id: string, dto: UpdateCategoriePatientDto) {
    const existing = await this.prisma.categoriePatient.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Catégorie ${id} introuvable`)
    return this.prisma.categoriePatient.update({ where: { id }, data: dto })
  }

  async setStatutCategoriePatient(id: string, statut: string) {
    const existing = await this.prisma.categoriePatient.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Catégorie ${id} introuvable`)
    return this.prisma.categoriePatient.update({ where: { id }, data: { statut: toEnumActiveInactive(statut) } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TYPES D'EXAMEN
  // ══════════════════════════════════════════════════════════════════════════

  findAllTypesExamen(query: ListQueryDto = {}) {
    return this.prisma.typeExamen.findMany({
      where: {
        ...(query.statut && { statut: query.statut }),
        ...(query.search && {
          OR: [
            { libelle: { contains: query.search, ...CI } },
            { code:    { contains: query.search, ...CI } },
            { domaine: { contains: query.search, ...CI } },
          ],
        }),
      },
      orderBy: [{ domaine: 'asc' }, { libelle: 'asc' }],
    })
  }

  async createTypeExamen(dto: CreateTypeExamenDto) {
    const existing = await this.prisma.raw.typeExamen.findUnique({ where: { code: dto.code } })
    if (existing && !existing.deletedAt) throw new ConflictException(`Code type examen "${dto.code}" déjà utilisé`)
    if (existing) return this.prisma.typeExamen.update({ where: { id: existing.id }, data: { ...dto, deletedAt: null } })
    return this.prisma.typeExamen.create({ data: dto })
  }

  async updateTypeExamen(id: string, dto: UpdateTypeExamenDto) {
    const existing = await this.prisma.typeExamen.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Type examen ${id} introuvable`)
    return this.prisma.typeExamen.update({ where: { id }, data: dto })
  }

  async setStatutTypeExamen(id: string, statut: string) {
    const existing = await this.prisma.typeExamen.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Type examen ${id} introuvable`)
    return this.prisma.typeExamen.update({ where: { id }, data: { statut: toEnumActifInactif(statut) } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TYPES DE CONSULTATION
  // ══════════════════════════════════════════════════════════════════════════

  findAllTypesConsultation(query: ListQueryDto = {}) {
    return this.prisma.typeConsultation.findMany({
      where: {
        ...(query.statut && { statut: query.statut }),
        ...(query.search && {
          OR: [
            { libelle: { contains: query.search, ...CI } },
            { code:    { contains: query.search, ...CI } },
          ],
        }),
      },
      orderBy: { libelle: 'asc' },
    })
  }

  async createTypeConsultation(dto: CreateTypeConsultationDto) {
    const existing = await this.prisma.raw.typeConsultation.findUnique({ where: { code: dto.code } })
    if (existing && !existing.deletedAt) throw new ConflictException(`Code type consultation "${dto.code}" déjà utilisé`)
    if (existing) return this.prisma.typeConsultation.update({ where: { id: existing.id }, data: { ...dto, deletedAt: null } })
    return this.prisma.typeConsultation.create({ data: dto })
  }

  async updateTypeConsultation(id: string, dto: UpdateTypeConsultationDto) {
    const existing = await this.prisma.typeConsultation.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Type consultation ${id} introuvable`)
    return this.prisma.typeConsultation.update({ where: { id }, data: dto })
  }

  async setStatutTypeConsultation(id: string, statut: string) {
    const existing = await this.prisma.typeConsultation.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Type consultation ${id} introuvable`)
    return this.prisma.typeConsultation.update({ where: { id }, data: { statut: toEnumActifInactif(statut) } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPPRESSION DÉFINITIVE (bloquée 409 si l'entrée est référencée par des
  //  données existantes — l'opérateur doit alors la désactiver plutôt)
  // ══════════════════════════════════════════════════════════════════════════

  private async hardDelete<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e: any) {
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new ConflictException(
          `Suppression impossible : ${label} est référencé(e) par des données existantes. ` +
          'Désactivez-le plutôt (changement de statut).',
        )
      }
      throw e
    }
  }

  async deleteSite(id: string) {
    if (!await this.prisma.site.findUnique({ where: { id } })) throw new NotFoundException(`Site ${id} introuvable`)
    await this.hardDelete('ce site', () => this.prisma.site.delete({ where: { id } }))
    return { id, deleted: true }
  }

  async deleteMotif(id: string) {
    if (!await this.prisma.motifConsultation.findUnique({ where: { id } })) throw new NotFoundException(`Motif ${id} introuvable`)
    await this.hardDelete('ce motif', () => this.prisma.motifConsultation.delete({ where: { id } }))
    return { id, deleted: true }
  }

  async deletePathologie(id: string) {
    if (!await this.prisma.pathologieReference.findUnique({ where: { id } })) throw new NotFoundException(`Pathologie ${id} introuvable`)
    await this.hardDelete('cette pathologie', () => this.prisma.pathologieReference.delete({ where: { id } }))
    return { id, deleted: true }
  }

  async deleteMedicament(id: string) {
    if (!await this.prisma.medicamentReference.findUnique({ where: { id } })) throw new NotFoundException(`Médicament ${id} introuvable`)
    await this.hardDelete('ce médicament', () => this.prisma.medicamentReference.delete({ where: { id } }))
    return { id, deleted: true }
  }

  async deleteCategoriePatient(id: string) {
    if (!await this.prisma.categoriePatient.findUnique({ where: { id } })) throw new NotFoundException(`Catégorie ${id} introuvable`)
    await this.hardDelete('cette catégorie', () => this.prisma.categoriePatient.delete({ where: { id } }))
    return { id, deleted: true }
  }

  async deleteTypeExamen(id: string) {
    if (!await this.prisma.typeExamen.findUnique({ where: { id } })) throw new NotFoundException(`Type examen ${id} introuvable`)
    await this.hardDelete('ce type d\'examen', () => this.prisma.typeExamen.delete({ where: { id } }))
    return { id, deleted: true }
  }

  async deleteTypeConsultation(id: string) {
    if (!await this.prisma.typeConsultation.findUnique({ where: { id } })) throw new NotFoundException(`Type consultation ${id} introuvable`)
    await this.hardDelete('ce type de consultation', () => this.prisma.typeConsultation.delete({ where: { id } }))
    return { id, deleted: true }
  }
}
