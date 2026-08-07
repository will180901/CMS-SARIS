/**
 * EmployeService — Registre des employés SARIS (main-d'œuvre patiente : CDI/CDD reconnus
 * par matricule). DISTINCT des utilisateurs/soignants du CMS et des sociétés sous-traitantes.
 * Construit dynamiquement à l'accueil (reconnaissance / enregistrement par matricule).
 */
import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CI } from '../../common/prisma/search'
import { PatientService } from '../patient/patient.service'
import type {
  CreateEmployeDto,
  UpdateEmployeDto,
  EmployeQueryDto,
} from './dto/employe.dto'

@Injectable()
export class EmployeService {
  private readonly logger = new Logger(EmployeService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PatientService))
    private readonly patients: PatientService,
  ) {}

  async findAll(query: EmployeQueryDto) {
    const where: any = {}
    if (query.search) {
      const s = query.search.trim()
      where.OR = [
        { matricule: { contains: s, ...CI } },
        { nom: { contains: s, ...CI } },
        { prenom: { contains: s, ...CI } },
      ]
    }
    if (query.categorie && query.categorie !== 'TOUS')
      where.categorie = query.categorie
    if (query.statut && query.statut !== 'TOUS') where.statut = query.statut
    return this.prisma.employeSaris.findMany({
      where,
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })
  }

  /** Lookup de reconnaissance par matricule (200 + nullable, PAS de 404 — l'UI gère « inconnu »). */
  async findByMatricule(matricule: string) {
    return this.prisma.employeSaris.findFirst({
      where: { matricule: matricule.trim() },
    })
  }

  async findById(id: string) {
    const e = await this.prisma.employeSaris.findUnique({ where: { id } })
    if (!e) throw new NotFoundException('Employé introuvable')
    return e
  }

  /**
   * `siteId`/`createdBy` : fournis UNIQUEMENT par la création directe au registre
   * (EmployeController) — déclenche l'auto-création du dossier patient si date de
   * naissance + sexe sont renseignés. Absents lors de l'appel interne depuis
   * `ensureByMatricule()` (PatientService crée déjà le patient lui-même dans ce cas
   * — recréer un dossier ici ferait doublon).
   */
  async create(dto: CreateEmployeDto, siteId?: string, createdBy?: string) {
    // Unicité matricule sur le client BRUT (voit les tombstones soft-delete).
    const exists = await this.prisma.raw.employeSaris.findUnique({
      where: { matricule: dto.matricule.trim() },
      select: { id: true },
    })
    if (exists)
      throw new ConflictException(
        `Le matricule ${dto.matricule.trim()} existe déjà au registre des employés`,
      )
    const employe = await this.prisma.employeSaris.create({
      data: {
        matricule: dto.matricule.trim(),
        nom: dto.nom.trim(),
        prenom: dto.prenom.trim(),
        dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null,
        sexe: dto.sexe ?? null,
        fonction: dto.fonction?.trim() ?? null,
        sectionPaie: dto.sectionPaie?.trim() ?? null,
        service: dto.service?.trim() ?? null,
        departement: dto.departement?.trim() ?? null,
        categorie: dto.categorie,
      },
    })

    if (siteId) {
      // Dossier patient automatique, en tâche de fond — n'échoue jamais la création
      // de l'employé (erreurs avalées : le registre reste la source de vérité même
      // si le dossier n'a pas pu être créé).
      try {
        await this.patients.createFromEmploye(employe, siteId, createdBy)
      } catch {
        /* best-effort */
      }
    }

    return employe
  }

  async update(id: string, dto: UpdateEmployeDto) {
    await this.findById(id)
    if (dto.matricule) {
      const clash = await this.prisma.raw.employeSaris.findFirst({
        where: { matricule: dto.matricule.trim(), id: { not: id } },
        select: { id: true },
      })
      if (clash)
        throw new ConflictException(
          `Le matricule ${dto.matricule.trim()} est déjà utilisé`,
        )
    }
    const maj = await this.prisma.employeSaris.update({
      where: { id },
      data: {
        ...(dto.matricule !== undefined && { matricule: dto.matricule.trim() }),
        ...(dto.nom !== undefined && { nom: dto.nom.trim() }),
        ...(dto.prenom !== undefined && { prenom: dto.prenom.trim() }),
        ...(dto.dateNaissance !== undefined && {
          dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null,
        }),
        ...(dto.sexe !== undefined && { sexe: dto.sexe || null }),
        ...(dto.fonction !== undefined && {
          fonction: dto.fonction?.trim() || null,
        }),
        ...(dto.sectionPaie !== undefined && {
          sectionPaie: dto.sectionPaie?.trim() || null,
        }),
        ...(dto.service !== undefined && {
          service: dto.service?.trim() || null,
        }),
        ...(dto.departement !== undefined && {
          departement: dto.departement?.trim() || null,
        }),
        ...(dto.categorie !== undefined && { categorie: dto.categorie }),
        ...(dto.statut !== undefined && { statut: dto.statut }),
      },
    })

    await this.propagerVersDossier(id, dto)
    return maj
  }

  /**
   * Répercute une correction du registre sur le DOSSIER PATIENT de l'employé.
   *
   * L'identité du dossier est une COPIE faite à sa création (cf. createFromEmploye) :
   * sans cette propagation, corriger « MABIALA » en « MABIKA » dans le registre laissait
   * l'ancien nom dans le dossier, et l'infirmier cherchait au triage un patient qui,
   * pour lui, n'existait plus sous ce nom. Deux vérités pour une seule personne.
   *
   * Ne touche QUE les champs venus du registre employeur, qui fait autorité sur l'état
   * civil. Téléphone, adresse et photo restent au dossier : ils ont été saisis au centre
   * médical, le registre RH ne les connaît pas.
   *
   * Best-effort : une correction de registre ne doit jamais échouer parce qu'un dossier
   * est absent ou verrouillé.
   */
  private async propagerVersDossier(
    employeId: string,
    dto: UpdateEmployeDto,
  ): Promise<void> {
    const champs = {
      ...(dto.nom !== undefined && { nom: dto.nom.trim() }),
      ...(dto.prenom !== undefined && { prenom: dto.prenom.trim() }),
      ...(dto.dateNaissance !== undefined && {
        dateNaissance: dto.dateNaissance ? new Date(dto.dateNaissance) : null,
      }),
      ...(dto.sexe !== undefined && { sexe: dto.sexe || null }),
    }
    if (!Object.keys(champs).length) return

    try {
      const patients = await this.prisma.patient.findMany({
        where: { employeId, deletedAt: null },
        select: { id: true },
      })
      if (!patients.length) return
      await this.prisma.identitePatient.updateMany({
        where: { patientId: { in: patients.map((p) => p.id) }, deletedAt: null },
        data: champs,
      })
    } catch (e) {
      this.logger.warn(
        `Propagation de l'employé ${employeId} vers son dossier ignorée : ${(e as Error).message}`,
      )
    }
  }

  /** Suppression — bloquée si l'employé est lié à un patient ou à un rattachement ayant droit. */
  async delete(id: string) {
    await this.findById(id)
    const [patients, rattachements] = await Promise.all([
      this.prisma.patient.count({ where: { employeId: id } }),
      this.prisma.rattachementAyantDroitCdi.count({ where: { employeId: id } }),
    ])
    if (patients + rattachements > 0) {
      throw new ConflictException(
        'Cet employé est rattaché à des dossiers patients — désactivez-le plutôt que de le supprimer',
      )
    }
    await this.prisma.employeSaris.delete({ where: { id } })
    return { id, deleted: true }
  }

  /**
   * Trouve un employé par matricule, ou le crée s'il n'existe pas (enregistrement dynamique
   * à l'accueil). Utilisé par PatientService lors de la création d'un patient CDI/CDD ou du
   * rattachement d'un ayant droit à un CDI inconnu.
   */
  async ensureByMatricule(data: CreateEmployeDto): Promise<{ id: string }> {
    const found = await this.prisma.employeSaris.findFirst({
      where: { matricule: data.matricule.trim() },
      select: { id: true },
    })
    if (found) return found
    return this.create(data)
  }
}
