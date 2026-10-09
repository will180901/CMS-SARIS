/**
 * Droits par catégorie de patient — règle centrale du recueil de l'existant.
 *
 * Certaines prestations ne sont couvertes que pour certaines catégories :
 *  - CONSULTATION + PREMIERS_SOINS : TOUTES les catégories.
 *  - MEDICAMENT (bon de pharmacie) + EXAMEN (bon d'examens) : UNIQUEMENT le personnel
 *    CDI et ses ayants droit (prise en charge complète).
 *
 * La matrice est portée par la table `DroitCategoriePatient` (seed, puis Référentiels ›
 * Catégories). Convention : autorisé s'il existe une ligne (catégorie, prestation) avec
 * couvert=true.
 *
 * CONSULTATION et PREMIERS_SOINS sont TOUJOURS dus (décision utilisateur) : leurs lignes
 * existent pour que la matrice soit complète, mais elles ne peuvent pas être retirées
 * (ecrireDroitsCategorie) et ne sont pas vérifiées — un patient est toujours reçu.
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
  if (typePrestation === 'CONSULTATION' || typePrestation === 'PREMIERS_SOINS') return
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
  // Plus de « réservé au personnel CDI » : faux depuis que les droits se configurent par
  // catégorie (et faux pour un CDI refusé). La catégorie dit tout ce qu'il y a à dire.
  throw new ForbiddenException(
    `La catégorie « ${libelle} » n'ouvre pas droit ${quoi}.`,
  )
}

// ── Droits RÉELS d'un patient (catégorie + rattachement) ─────────────────────

/**
 * Pourquoi les droits de la catégorie ne s'appliquent pas aujourd'hui.
 *  - AUCUN_RATTACHEMENT   : ayant droit sans aucun lien vers un travailleur CDI.
 *  - RATTACHEMENT_CLOTURE : le lien a existé mais il est clôturé (ou arrivé à échéance).
 *  - CDI_INACTIF          : le travailleur CDI (le patient lui-même, ou celui dont il
 *                           est l'ayant droit) n'est plus actif : son dossier n'est plus
 *                           en catégorie CDI, ou il n'est plus actif (archivé, décédé…).
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
    "Le travailleur CDI n'est plus actif (dossier hors catégorie CDI ou inactif) : droits suspendus — médicaments et examens ne sont plus pris en charge.",
}

/** Le dossier d'un travailleur ouvre des droits s'il est en catégorie CDI et ACTIF.
 *  (Il n'y a plus de registre des employés : le dossier patient fait foi.) */
function cdiActif(
  p: { statut: string; categoriePatient: { code: string } } | null | undefined,
) {
  return !!p && p.statut === 'ACTIF' && p.categoriePatient.code === 'ASSURE_CDI'
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
      statut: true,
      categoriePatientId: true,
      categoriePatient: { select: { code: true } },
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
      // Le lien pointe vers le DOSSIER du travailleur CDI (cdiId) : c'est lui qui dit
      // s'il est toujours CDI et actif.
      const cdiIds = enVigueur
        .map((l) => l.cdiId)
        .filter((v): v is string => !!v)
      const cdis = cdiIds.length
        ? await prisma.patient.findMany({
            where: { id: { in: cdiIds } },
            select: { statut: true, categoriePatient: { select: { code: true } } },
          })
        : []
      if (!cdis.some(cdiActif)) motif = 'CDI_INACTIF'
    }
  } else if (code === 'ASSURE_CDI' && patient.statut !== 'ACTIF') {
    // Le travailleur lui-même : dossier archivé, décédé…
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
 * situation du patient (rattachement, dossier du travailleur CDI).
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
