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
  CorrigerResultatDto,
  BonExamenQueryDto,
} from './dto/bon-examen.dto'
import { encryptBytes, decryptBytes } from '../../common/crypto/message-crypto'

const BON_INCLUDE = {
  lignes: {
    include: {
      typeExamen: {
        select: { id: true, code: true, libelle: true, domaine: true },
      },
    },
  },
  resultats: { orderBy: { createdAt: 'desc' as const } },
  // Comptes rendus joints : métadonnées seules (le contenu chiffré n'est servi qu'à la demande).
  piecesJointes: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, nomFichier: true, mimeType: true, taille: true, createdAt: true, createdBy: true },
  },
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
    return (await this.avecEtablissement([bon]))[0]
  }

  /** Nom de l'établissement choisi à la prescription (pas de relation Prisma sur le bon) :
   *  il pré-remplit le laboratoire à la saisie du résultat. */
  private async avecEtablissement<T extends { etablissementId: string | null }>(bons: T[]) {
    const ids = [...new Set(bons.map((b) => b.etablissementId).filter((x): x is string => !!x))]
    const etabs = ids.length
      ? await this.prisma.etablissementReference.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true } })
      : []
    const noms = new Map(etabs.map((e) => [e.id, e.nom]))
    return bons.map((b) => ({ ...b, etablissementNom: b.etablissementId ? noms.get(b.etablissementId) ?? null : null }))
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

    const bons = await this.prisma.bonExamen.findMany({
      where,
      include: BON_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return this.avecEtablissement(bons)
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
    const dateRealisation = this.dateRealisationValide(dto.dateRealisation, bon.createdAt)
    const commun = {
      bonId,
      laboratoire: dto.laboratoire?.trim() || null,
      interpretation: dto.interpretation?.trim() || null,
      dateRealisation,
      statut: 'RECU',
      saisiePar: acteurId,
    }

    if (dto.resultats?.length) {
      // Un résultat ne se saisit QUE pour un examen prescrit sur CE bon, et une seule fois :
      // une erreur se corrige (correction tracée), elle ne s'écrase pas par une 2e saisie.
      const lignes = new Map(bon.lignes.map((l) => [l.id, l]))
      const dejaSaisies = new Set(
        bon.resultats.filter((r) => r.statut === 'RECU' && r.ligneExamenId).map((r) => r.ligneExamenId),
      )
      const vues = new Set<string>()
      for (const r of dto.resultats) {
        const ligne = lignes.get(r.ligneExamenId)
        if (!ligne)
          throw new BadRequestException("Cet examen n'a pas été prescrit sur ce bon")
        if (vues.has(r.ligneExamenId))
          throw new BadRequestException(`« ${ligne.typeExamen.libelle} » apparaît deux fois dans la saisie`)
        vues.add(r.ligneExamenId)
        if (dejaSaisies.has(r.ligneExamenId))
          throw new ConflictException(
            `Le résultat de « ${ligne.typeExamen.libelle} » est déjà saisi : corrigez-le plutôt que de le saisir à nouveau`,
          )
      }
      await this.prisma.$transaction(
        dto.resultats.map((r) =>
          this.prisma.resultatExamen.create({
            data: {
              ...commun,
              ligneExamenId: r.ligneExamenId,
              contenu: r.contenu.trim(),
              anormal: r.anormal ?? null,
            },
          }),
        ),
      )
      return this.getOrThrow(bonId)
    }

    if (!dto.contenu?.trim())
      throw new BadRequestException('Aucun résultat à enregistrer')
    // Ancienne forme : un résultat global pour tout le bon.
    await this.prisma.resultatExamen.create({
      data: { ...commun, contenu: dto.contenu.trim() },
    })
    return this.getOrThrow(bonId)
  }

  /** Date à laquelle l'examen a été RÉALISÉ : jamais dans le futur, jamais avant le jour
   *  de la prescription (un examen ne se fait pas avant d'avoir été demandé). */
  private dateRealisationValide(iso: string | undefined, prescritLe: Date): Date | null {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Date de réalisation invalide')
    if (d.getTime() > Date.now() + 60_000)
      throw new BadRequestException("La date de réalisation de l'examen ne peut pas être dans le futur")
    if (d.toISOString().slice(0, 10) < prescritLe.toISOString().slice(0, 10))
      throw new BadRequestException("La date de réalisation de l'examen ne peut pas précéder sa prescription")
    return d
  }

  // ── Corriger un résultat (l'ancien est gardé, statut REMPLACE) ─────────────

  async corrigerResultat(
    bonId: string,
    resultatId: string,
    dto: CorrigerResultatDto,
    acteurId: string,
  ) {
    const bon = await this.getOrThrow(bonId)
    const ancien = bon.resultats.find((r) => r.id === resultatId)
    if (!ancien) throw new NotFoundException('Résultat introuvable sur ce bon')
    if (ancien.statut === 'REMPLACE')
      throw new ConflictException('Ce résultat a déjà été corrigé : corrigez la version la plus récente')
    const dateRealisation =
      dto.dateRealisation !== undefined ? this.dateRealisationValide(dto.dateRealisation, bon.createdAt) : ancien.dateRealisation
    await this.prisma.$transaction([
      this.prisma.resultatExamen.update({ where: { id: ancien.id }, data: { statut: 'REMPLACE' } }),
      this.prisma.resultatExamen.create({
        data: {
          bonId,
          ligneExamenId: ancien.ligneExamenId,
          contenu: dto.contenu.trim(),
          anormal: dto.anormal ?? ancien.anormal,
          laboratoire: dto.laboratoire !== undefined ? dto.laboratoire.trim() || null : ancien.laboratoire,
          interpretation: dto.interpretation !== undefined ? dto.interpretation.trim() || null : ancien.interpretation,
          dateRealisation,
          statut: 'RECU',
          saisiePar: acteurId,
          corrigeId: ancien.id,
          motifCorrection: dto.motifCorrection.trim(),
        },
      }),
    ])
    return this.getOrThrow(bonId)
  }

  // ── Comptes rendus joints (photo / PDF, chiffrés) ─────────────────────────

  async ajouterPieceJointe(
    bonId: string,
    fichier: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    acteurId: string,
  ) {
    const bon = await this.getOrThrow(bonId)
    if (bon.statut !== 'VALIDE')
      throw new ConflictException('Un compte rendu se joint à un bon validé')
    await this.prisma.pieceJointeResultat.create({
      data: {
        bonId,
        nomFichier: fichier.originalname.slice(0, 200) || 'compte-rendu',
        mimeType: fichier.mimetype,
        taille: fichier.size,
        contenuChiffre: encryptBytes(fichier.buffer),
        createdBy: acteurId,
      },
    })
    return this.getOrThrow(bonId)
  }

  async lirePieceJointe(bonId: string, pieceId: string) {
    const pj = await this.prisma.pieceJointeResultat.findFirst({ where: { id: pieceId, bonId } })
    if (!pj) throw new NotFoundException('Compte rendu introuvable')
    const octets = decryptBytes(pj.contenuChiffre)
    return {
      id: pj.id,
      nomFichier: pj.nomFichier,
      mimeType: pj.mimeType,
      dataUrl: `data:${pj.mimeType};base64,${octets.toString('base64')}`,
    }
  }

  async supprimerPieceJointe(bonId: string, pieceId: string) {
    const pj = await this.prisma.pieceJointeResultat.findFirst({ where: { id: pieceId, bonId }, select: { id: true } })
    if (!pj) throw new NotFoundException('Compte rendu introuvable')
    await this.prisma.pieceJointeResultat.delete({ where: { id: pj.id } })
    return this.getOrThrow(bonId)
  }
}
