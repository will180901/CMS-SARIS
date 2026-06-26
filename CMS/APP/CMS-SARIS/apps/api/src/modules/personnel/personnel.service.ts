import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CI } from '../../common/prisma/search'
import type { CreatePersonnelDto, UpdatePersonnelDto, PersonnelQueryDto }   from './dto/personnel.dto'
import type { CreateDelegationDto, UpdateDelegationDto }                     from './dto/delegation.dto'
import type { CreateSousTraitantDto, UpdateSousTraitantDto, SousTraitantQueryDto } from './dto/sous-traitant.dto'

// ── Sélection réutilisable pour les relations "résumé personnel" ──────────────
const PERSONNEL_RESUME  = { select: { id: true, nom: true, prenom: true, matricule: true } } as const
const DELEGATION_INCLUDE = {
  include: {
    medecinChef: PERSONNEL_RESUME,
    infirmier:   PERSONNEL_RESUME,
  },
} as const

@Injectable()
export class PersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════════════════════════════════
  //  PERSONNEL MÉDICAL
  // ══════════════════════════════════════════════════════════════════════════

  findAll(query: PersonnelQueryDto = {}) {
    return this.prisma.personnelMedical.findMany({
      where: {
        ...(query.statut && { statut: query.statut }),
        ...(query.role   && { role:   query.role }),
        ...(query.siteId && { siteId: query.siteId }),
        ...(query.search && {
          OR: [
            { nom:       { contains: query.search, ...CI } },
            { prenom:    { contains: query.search, ...CI } },
            { matricule: { contains: query.search, ...CI } },
          ],
        }),
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })
  }

  async findById(id: string) {
    const agent = await this.prisma.personnelMedical.findUnique({ where: { id } })
    if (!agent) throw new NotFoundException(`Agent ${id} introuvable`)
    return agent
  }

  // Soignants = personnel rattaché à un COMPTE utilisateur ACTIF de rôle clinique
  // (MEDECIN_CHEF / INFIRMIER). Le personnel est partagé entre les 2 sites (recueil),
  // donc pas de filtre de site. Liste légère pour le picker de triage.
  findSoignants() {
    return this.prisma.personnelMedical.findMany({
      where: {
        statut: 'ACTIF',
        utilisateur: {
          statut: 'ACTIF',
          roles:  { some: { role: { code: { in: ['MEDECIN_CHEF', 'INFIRMIER'] } } } },
        },
      },
      select:  { id: true, nom: true, prenom: true, matricule: true, role: true, statut: true, siteId: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })
  }

  async create(dto: CreatePersonnelDto) {
    // Contrôle d'unicité sur le client BRUT : il voit aussi les tombstones (agents soft-supprimés)
    // qui occupent encore le matricule @unique en base.
    const existing = await this.prisma.raw.personnelMedical.findUnique({ where: { matricule: dto.matricule } })
    if (existing) {
      throw new ConflictException(
        existing.deletedAt
          ? `Matricule "${dto.matricule}" appartient à un agent supprimé`
          : `Matricule "${dto.matricule}" déjà utilisé`,
      )
    }
    return this.prisma.personnelMedical.create({ data: dto })
  }

  async update(id: string, dto: UpdatePersonnelDto) {
    await this.findById(id)
    if (dto.matricule) {
      // Client BRUT : voit les tombstones occupant le matricule, sans bloquer sur soi-même.
      const existing = await this.prisma.raw.personnelMedical.findUnique({ where: { matricule: dto.matricule } })
      if (existing && existing.id !== id) {
        throw new ConflictException(
          existing.deletedAt
            ? `Matricule "${dto.matricule}" appartient à un agent supprimé`
            : `Matricule "${dto.matricule}" déjà utilisé`,
        )
      }
    }
    return this.prisma.personnelMedical.update({ where: { id }, data: dto })
  }

  async setStatut(id: string, statut: 'ACTIF' | 'INACTIF') {
    await this.findById(id)
    return this.prisma.personnelMedical.update({ where: { id }, data: { statut } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DÉLÉGATIONS DE PRESCRIPTION
  // ══════════════════════════════════════════════════════════════════════════

  findAllDelegations() {
    return this.prisma.delegationPrescription.findMany({
      ...DELEGATION_INCLUDE,
      orderBy: { dateDebut: 'desc' },
    })
  }

  async findDelegationById(id: string) {
    const d = await this.prisma.delegationPrescription.findUnique({ where: { id }, ...DELEGATION_INCLUDE })
    if (!d) throw new NotFoundException(`Délégation ${id} introuvable`)
    return d
  }

  async createDelegation(dto: CreateDelegationDto) {
    await this.findById(dto.medecinChefId)
    await this.findById(dto.infirmierId)
    return this.prisma.delegationPrescription.create({
      data: {
        ...dto,
        dateDebut: new Date(dto.dateDebut),
        dateFin:   new Date(dto.dateFin),
      },
      ...DELEGATION_INCLUDE,
    })
  }

  async updateDelegation(id: string, dto: UpdateDelegationDto) {
    await this.findDelegationById(id)
    return this.prisma.delegationPrescription.update({
      where: { id },
      data:  {
        ...(dto.medecinChefId && { medecinChefId: dto.medecinChefId }),
        ...(dto.infirmierId   && { infirmierId:   dto.infirmierId }),
        ...(dto.dateDebut     && { dateDebut: new Date(dto.dateDebut) }),
        ...(dto.dateFin       && { dateFin:   new Date(dto.dateFin) }),
        ...(dto.perimetre !== undefined && { perimetre: dto.perimetre }),
      },
      ...DELEGATION_INCLUDE,
    })
  }

  async toggleDelegationStatut(id: string, statut: string) {
    await this.findDelegationById(id)
    return this.prisma.delegationPrescription.update({ where: { id }, data: { statut } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SOCIÉTÉS SOUS-TRAITANTES
  // ══════════════════════════════════════════════════════════════════════════

  findAllSousTraitants(query: SousTraitantQueryDto = {}) {
    return this.prisma.societeSousTraitante.findMany({
      where: {
        ...(query.statut && { statut: query.statut }),
        ...(query.search && {
          nom: { contains: query.search, ...CI },
        }),
      },
      orderBy: { nom: 'asc' },
    })
  }

  async findSousTraitantById(id: string) {
    const s = await this.prisma.societeSousTraitante.findUnique({ where: { id } })
    if (!s) throw new NotFoundException(`Société ${id} introuvable`)
    return s
  }

  async createSousTraitant(dto: CreateSousTraitantDto) {
    const existing = await this.prisma.societeSousTraitante.findFirst({
      where: { nom: { equals: dto.nom, ...CI } },
    })
    if (existing) throw new ConflictException(`Une société nommée "${dto.nom}" existe déjà`)
    return this.prisma.societeSousTraitante.create({ data: dto })
  }

  async updateSousTraitant(id: string, dto: UpdateSousTraitantDto) {
    await this.findSousTraitantById(id)
    if (dto.nom) {
      const existing = await this.prisma.societeSousTraitante.findFirst({
        where: { nom: { equals: dto.nom, ...CI }, NOT: { id } },
      })
      if (existing) throw new ConflictException(`Une société nommée "${dto.nom}" existe déjà`)
    }
    return this.prisma.societeSousTraitante.update({ where: { id }, data: dto })
  }

  async setStatutSousTraitant(id: string, statut: 'ACTIVE' | 'INACTIVE') {
    await this.findSousTraitantById(id)
    return this.prisma.societeSousTraitante.update({ where: { id }, data: { statut } })
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUPPRESSION DÉFINITIVE (bloquée 409 si référencé — désactiver plutôt)
  // ══════════════════════════════════════════════════════════════════════════

  private async hardDelete<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e: any) {
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new ConflictException(
          `Suppression impossible : ${label} est référencé(e) par des données existantes (compte, visites, prescriptions…). Désactivez-le plutôt.`,
        )
      }
      throw e
    }
  }

  async deletePersonnel(id: string) {
    await this.findById(id)
    await this.hardDelete('cet agent', () => this.prisma.personnelMedical.delete({ where: { id } }))
    return { id, deleted: true }
  }

  async deleteDelegation(id: string) {
    await this.findDelegationById(id)
    // Les médicaments autorisés sont des enfants directs → on les retire d'abord.
    await this.prisma.$transaction([
      this.prisma.delegationMedicamentAutorise.deleteMany({ where: { delegationId: id } }),
      this.prisma.delegationPrescription.delete({ where: { id } }),
    ])
    return { id, deleted: true }
  }

  async deleteSousTraitant(id: string) {
    await this.findSousTraitantById(id)
    await this.hardDelete('cette société', () => this.prisma.societeSousTraitante.delete({ where: { id } }))
    return { id, deleted: true }
  }
}
