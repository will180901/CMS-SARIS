/**
 * nettoyer-base.ts — Remet la base dans un état SAIN, prêt pour la mise en service.
 *
 * Ce que l'on GARDE :
 *   • les données de référence — sites, motifs, pathologies, médicaments, catégories,
 *     types d'examen, types de consultation, sous-traitants ;
 *   • les rôles et le catalogue de permissions ;
 *   • UN SEUL compte : `admin` (identifiant et mot de passe inchangés).
 *
 * Ce que l'on VIDE : tout le reste — dossiers, visites, consultations, ordonnances,
 * bons, messagerie, notifications, journaux, sessions, postes, personnel médical,
 * registre des employés.
 *
 * ⚠️ IRRÉVERSIBLE. Faire une sauvegarde AVANT (cf. README « Nettoyage »).
 *
 * L'ordre de suppression suit les dépendances : on part des feuilles (ce qui référence)
 * vers les racines (ce qui est référencé). Une suppression dans le désordre échouerait
 * sur une contrainte de clé étrangère — d'où la liste explicite plutôt qu'une boucle
 * sur tous les modèles.
 *
 * Usage :
 *   pnpm --filter @cms-saris/db exec tsx prisma/nettoyer-base.ts            (blanc : compte)
 *   pnpm --filter @cms-saris/db exec tsx prisma/nettoyer-base.ts --appliquer
 *
 * Sur NEON (production), passer l'URL en variable d'environnement :
 *   DATABASE_URL="postgresql://…" pnpm --filter @cms-saris/db exec tsx prisma/nettoyer-base.ts --appliquer
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APPLIQUER = process.argv.includes('--appliquer')
const LOGIN_CONSERVE = 'admin'

/**
 * Ordre STRICT : chaque entrée ne doit dépendre d'aucune de celles qui la suivent.
 * (Les `deleteMany` de Prisma ne réordonnent pas : c'est à nous de le faire.)
 */
const A_VIDER = [
  // ── Messagerie (feuilles d'abord) ──
  'messageReaction', 'messageLecture', 'messageMention', 'pieceJointeMessage',
  'message', 'conversationParticipant', 'conversation',
  // ── Notifications ──
  'notificationLecture', 'notification',
  // ── Clinique : du plus dépendant au plus racine ──
  'ligneOrdonnance', 'ordonnance',
  'resultatExamen', 'ligneBonExamen', 'bonExamen',
  'ligneBonPharmacie', 'bonPharmacie',
  'certificatRepos', 'ficheSuiviTraitement', 'suiviTraitement',
  'evacuation',
  'diagnosticConsultation', 'examenClinique', 'anamnese', 'consultation',
  'constanteVitale', 'evenementVisite', 'visite',
  // ── Dossier patient ──
  'alertePatient', 'antecedentPatient', 'allergiePatient', 'modeVie',
  'suiviChronique', 'rattachementAyantDroit', 'donneesEmploi',
  'contactUrgence', 'identitePatient', 'patient',
  // ── Registre employés (demandé explicitement) ──
  'employeSaris',
  // ── Synchronisation ──
  'conflitSynchronisation', 'journalSynchronisation', 'syncState',
  'mutationSync', 'posteLocal',
  // ── Sécurité / traçabilité ──
  'journalAudit', 'journalAuthentification',
  'codeSecoursTotp', 'configurationTotp', 'sessionUtilisateur',
  'preferenceUtilisateur', 'utilisateurPermission', 'utilisateurRole',
  // ── Comptes & personnel (traités à part : on conserve `admin`) ──
  // 'utilisateur' et 'personnelMedical' : voir plus bas.
  // ── Délégations (dépendent du personnel) ──
  'delegationPrescription', 'absencePersonnel',
] as const

async function compter(modele: string): Promise<number | null> {
  try {
    return await (prisma as never as Record<string, { count: () => Promise<number> }>)[modele].count()
  } catch {
    return null // modèle absent de ce schéma (SQLite vs PostgreSQL)
  }
}

async function vider(modele: string): Promise<number> {
  const client = prisma as never as Record<string, { deleteMany: (a?: unknown) => Promise<{ count: number }> }>
  if (!client[modele]) return 0
  const { count } = await client[modele].deleteMany({})
  return count
}

async function main() {
  console.log(APPLIQUER
    ? '🧹 NETTOYAGE — suppression réelle en cours…'
    : '👀 SIMULATION — rien ne sera supprimé (ajouter --appliquer pour exécuter)')
  console.log()

  const admin = await prisma.utilisateur.findFirst({
    where: { login: LOGIN_CONSERVE },
    select: { id: true, login: true, personnelMedicalId: true },
  })
  if (!admin) {
    throw new Error(
      `Compte « ${LOGIN_CONSERVE} » introuvable — nettoyage interrompu.\n` +
      'Supprimer tous les comptes sans en conserver un rendrait la base inaccessible.',
    )
  }
  console.log(`   compte conservé : ${admin.login} (${admin.id})`)
  console.log()

  let total = 0

  if (!APPLIQUER) {
    for (const modele of A_VIDER) {
      const avant = await compter(modele)
      if (avant === null || avant === 0) continue
      total += avant
      console.log(`   · ${modele.padEnd(28)} ${avant} seraient supprimés`)
    }
  } else {
    // Boucle de CONVERGENCE plutôt qu'un ordre figé : on retente tant qu'un passage
    // supprime quelque chose. Une table encore référencée échoue silencieusement à ce
    // tour-ci et repassera au suivant, une fois ses dépendants partis.
    //
    // Pourquoi pas un ordre explicite : le schéma compte 88 tables et évolue ; toute
    // relation ajoutée demain casserait un ordre écrit à la main, au milieu d'une
    // suppression déjà commencée — l'état le plus inconfortable qui soit.
    const restants = new Set<string>(A_VIDER)
    let tour = 0
    while (restants.size && tour < 12) {
      tour++
      let supprimeCeTour = 0
      for (const modele of [...restants]) {
        const avant = await compter(modele)
        if (avant === null || avant === 0) { restants.delete(modele); continue }
        try {
          const n = await vider(modele)
          total += n
          supprimeCeTour += n
          restants.delete(modele)
          console.log(`   − ${modele.padEnd(28)} ${n}`)
        } catch {
          /* encore référencé : on retentera au tour suivant */
        }
      }
      if (supprimeCeTour === 0) break // plus rien ne bouge : on sort
    }
    if (restants.size) {
      console.log(`   ⚠️  non vidés (encore référencés) : ${[...restants].join(', ')}`)
    }
  }

  // ── Comptes : tous sauf `admin` ──
  const autresComptes = await prisma.utilisateur.count({ where: { NOT: { id: admin.id } } })
  if (autresComptes) {
    if (APPLIQUER) {
      await prisma.utilisateur.deleteMany({ where: { NOT: { id: admin.id } } })
      console.log(`   − ${'utilisateur'.padEnd(28)} ${autresComptes}`)
    } else {
      console.log(`   · ${'utilisateur'.padEnd(28)} ${autresComptes} seraient supprimés`)
    }
    total += autresComptes
  }

  // ── Personnel médical : tout sauf la fiche éventuellement liée à `admin` ──
  const wherePersonnel = admin.personnelMedicalId
    ? { NOT: { id: admin.personnelMedicalId } }
    : {}
  const personnel = await prisma.personnelMedical.count({ where: wherePersonnel })
  if (personnel) {
    if (APPLIQUER) {
      await prisma.personnelMedical.deleteMany({ where: wherePersonnel })
      console.log(`   − ${'personnelMedical'.padEnd(28)} ${personnel}`)
    } else {
      console.log(`   · ${'personnelMedical'.padEnd(28)} ${personnel} seraient supprimés`)
    }
    total += personnel
  }

  console.log()
  console.log(APPLIQUER
    ? `✅ ${total} enregistrement(s) supprimé(s).`
    : `👀 ${total} enregistrement(s) seraient supprimés. Relancer avec --appliquer.`)

  // ── Contrôle de ce qui subsiste ──
  console.log()
  console.log('   Conservé :')
  for (const m of ['site', 'motifConsultation', 'pathologieReference', 'medicamentReference',
                   'categoriePatient', 'typeExamen', 'typeConsultation', 'societeSousTraitante',
                   'role', 'permission', 'utilisateur']) {
    const n = await compter(m)
    if (n !== null) console.log(`     ${m.padEnd(24)} ${n}`)
  }
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
