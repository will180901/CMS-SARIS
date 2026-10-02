/**
 * Droits par catégorie de patient — règle centrale du recueil de l'existant.
 *
 * Certaines prestations ne sont couvertes que pour certaines catégories :
 *  - CONSULTATION + PREMIERS_SOINS : TOUTES les catégories.
 *  - MEDICAMENT (bon de pharmacie) + EXAMEN (bon d'examens) : UNIQUEMENT le personnel
 *    CDI et ses ayants droit (prise en charge complète).
 *
 * La matrice est portée par la table `DroitCategoriePatient` (peuplée par le seed).
 * Convention : autorisé s'il existe une ligne (catégorie, prestation) avec couvert=true.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { PrismaService } from '../prisma/prisma.service'

export type TypePrestation =
  | 'CONSULTATION'
  | 'PREMIERS_SOINS'
  | 'MEDICAMENT'
  | 'EXAMEN'

export async function assertPrestationCouverte(
  prisma: PrismaService,
  categorieId: string,
  typePrestation: TypePrestation,
): Promise<void> {
  const droit = await prisma.droitCategoriePatient.findFirst({
    where: { categorieId, typePrestation, couvert: true },
    select: { id: true },
  })
  if (droit) return

  const cat = await prisma.categoriePatient.findUnique({
    where: { id: categorieId },
    select: { libelle: true },
  })
  const libelle = cat?.libelle ?? 'cette catégorie'
  const quoi =
    typePrestation === 'EXAMEN'
      ? "aux bons d'examens"
      : typePrestation === 'MEDICAMENT'
        ? 'à la prise en charge des médicaments (bon de pharmacie)'
        : 'à cette prestation'
  throw new ForbiddenException(
    `La catégorie « ${libelle} » n'ouvre pas droit ${quoi} — réservé au personnel CDI et à leurs ayants droit.`,
  )
}

// ── Droits RÉELS d'un patient (catégorie + rattachement) ─────────────────────

/**
 * Pourquoi les droits de la catégorie ne s'appliquent pas aujourd'hui.
 *  - AUCUN_RATTACHEMENT   : ayant droit sans aucun lien vers un travailleur CDI.
 *  - RATTACHEMENT_CLOTURE : le lien a existé mais il est clôturé (ou arrivé à échéance).
 *  - CDI_INACTIF          : le travailleur CDI (le patient lui-même, ou celui dont il
 *                           est l'ayant droit) n'est plus actif au registre des employés,
 *                           ou n'y figure pas comme CDI.
 */
export type MotifSuspension =
  | 'AUCUN_RATTACHEMENT'
  | 'RATTACHEMENT_CLOTURE'
  | 'CDI_INACTIF'

export interface CouverturePatient {
  categorieId: string
  /** Prestation → prise en charge AUJOURD'HUI pour CE patient. */
  couvert: Record<TypePrestation, boolean>
  /** Renseigné quand la catégorie ouvrirait des droits que la situation suspend. */
  suspension: { motif: MotifSuspension; message: string } | null
}

/** Prestations suspendues : celles que seule la catégorie ouvre. Consultation et
 *  premiers soins restent dus à tout patient (décision utilisateur : « catégorie
 *  gardée, droits suspendus »). */
const PRESTATIONS_SUSPENDUES: TypePrestation[] = ['MEDICAMENT', 'EXAMEN']

const MESSAGES_SUSPENSION: Record<MotifSuspension, string> = {
  AUCUN_RATTACHEMENT:
    "Aucun rattachement actif à un travailleur CDI : médicaments et examens ne sont pas pris en charge.",
  RATTACHEMENT_CLOTURE:
    'Rattachement au travailleur CDI clôturé : droits suspendus — médicaments et examens ne sont plus pris en charge.',
  CDI_INACTIF:
    "Le travailleur CDI n'est plus actif au registre des employés : droits suspendus — médicaments et examens ne sont plus pris en charge.",
}

/** Un employé du registre ouvre des droits s'il est CDI et ACTIF. */
function cdiActif(e: { statut: string; categorie: string } | null | undefined) {
  return !!e && e.statut === 'ACTIF' && e.categorie === 'ASSURE_CDI'
}

/**
 * Calcule les droits réels d'un patient. SOURCE UNIQUE : la garde de génération des
 * bons (assertPatientCouvert) et l'écran (GET /patients/:id/couverture) lisent tous
 * deux cette fonction — un bouton affiché est un bon que le serveur acceptera.
 *
 * Avant, seule la catégorie comptait : un ayant droit dont le rattachement avait été
 * clôturé, ou dont le travailleur CDI avait quitté l'entreprise, gardait à vie la
 * gratuité des médicaments et des examens.
 */
export async function couverturePatient(
  prisma: PrismaService,
  patientId: string,
): Promise<CouverturePatient> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      categoriePatientId: true,
      categoriePatient: { select: { code: true } },
      employe: { select: { statut: true, categorie: true } },
    },
  })
  if (!patient) throw new NotFoundException('Patient introuvable')

  const droits = await prisma.droitCategoriePatient.findMany({
    where: { categorieId: patient.categoriePatientId, couvert: true },
    select: { typePrestation: true },
  })
  const parCategorie = new Set(droits.map((d) => d.typePrestation))
  const couvert: Record<TypePrestation, boolean> = {
    CONSULTATION: parCategorie.has('CONSULTATION'),
    PREMIERS_SOINS: parCategorie.has('PREMIERS_SOINS'),
    MEDICAMENT: parCategorie.has('MEDICAMENT'),
    EXAMEN: parCategorie.has('EXAMEN'),
  }

  let motif: MotifSuspension | null = null
  const code = patient.categoriePatient.code

  if (code === 'AYANT_DROIT_CDI') {
    const maintenant = new Date()
    const liens = await prisma.rattachementAyantDroitCdi.findMany({
      where: { patientId },
      select: {
        statut: true,
        dateDebut: true,
        dateFin: true,
        cdiId: true,
        employe: { select: { statut: true, categorie: true } },
      },
    })
    const enVigueur = liens.filter(
      (l) =>
        l.statut === 'ACTIF' &&
        l.dateDebut <= maintenant &&
        (!l.dateFin || l.dateFin > maintenant),
    )
    if (enVigueur.length === 0) {
      motif = liens.length > 0 ? 'RATTACHEMENT_CLOTURE' : 'AUCUN_RATTACHEMENT'
    } else {
      // Ancien modèle : lien vers le DOSSIER du CDI (cdiId) et non vers le registre —
      // on remonte alors à l'employé de ce dossier.
      const cdiIdsAnciens = enVigueur
        .filter((l) => !l.employe && l.cdiId)
        .map((l) => l.cdiId!)
      const anciens = cdiIdsAnciens.length
        ? await prisma.patient.findMany({
            where: { id: { in: cdiIdsAnciens } },
            select: {
              categoriePatient: { select: { code: true } },
              employe: { select: { statut: true, categorie: true } },
            },
          })
        : []
      const unCdiActif =
        enVigueur.some((l) => cdiActif(l.employe)) ||
        anciens.some((p) =>
          p.employe
            ? cdiActif(p.employe)
            : p.categoriePatient.code === 'ASSURE_CDI',
        )
      if (!unCdiActif) motif = 'CDI_INACTIF'
    }
  } else if (code === 'ASSURE_CDI' && patient.employe && !cdiActif(patient.employe)) {
    // Le travailleur lui-même : sorti des effectifs (INACTIF au registre).
    // Un dossier CDI sans fiche au registre (données anciennes) garde ses droits :
    // rien ne permet d'affirmer qu'il est parti.
    motif = 'CDI_INACTIF'
  }

  if (motif) {
    for (const p of PRESTATIONS_SUSPENDUES) couvert[p] = false
  }
  // On ne parle de suspension que si la catégorie ouvrait bien ces droits.
  const suspendAQuelqueChose = PRESTATIONS_SUSPENDUES.some((p) => parCategorie.has(p))
  return {
    categorieId: patient.categoriePatientId,
    couvert,
    suspension:
      motif && suspendAQuelqueChose
        ? { motif, message: MESSAGES_SUSPENSION[motif] }
        : null,
  }
}

/**
 * Garde de génération d'un bon : la catégorie d'abord (message habituel), puis la
 * situation du patient (rattachement, registre des employés).
 */
export async function assertPatientCouvert(
  prisma: PrismaService,
  patientId: string,
  typePrestation: TypePrestation,
): Promise<void> {
  const c = await couverturePatient(prisma, patientId)
  await assertPrestationCouverte(prisma, c.categorieId, typePrestation)
  if (!c.couvert[typePrestation]) {
    throw new ForbiddenException(
      c.suspension?.message ?? 'Prestation non prise en charge pour ce patient.',
    )
  }
}
