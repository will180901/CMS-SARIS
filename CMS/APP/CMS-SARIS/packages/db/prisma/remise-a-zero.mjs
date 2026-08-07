/**
 * remise-a-zero.mjs — Une application vierge, prête à être mise en service.
 *
 * Remplace `nettoyer-base.ts` + `nettoyer-residus.mjs`, qui procédaient par étapes
 * enchaînées : la première a échoué en production sur une contrainte de clé étrangère, et
 * la chaîne s'est interrompue AVANT l'étape qui rend son rôle à `admin`. Résultat : une
 * base à moitié vidée, et un administrateur sans aucun droit.
 *
 * D'où ce script en UN SEUL passage, qui ne peut pas s'arrêter au milieu :
 *   1. TRUNCATE … CASCADE sur tout ce qui est opérationnel — PostgreSQL résout lui-même
 *      l'ordre des dépendances, là où une liste écrite à la main se trompe ;
 *   2. les comptes autres qu'`admin` ;
 *   3. le rôle d'`admin`, rendu en dernier, systématiquement.
 *
 * CONSERVÉ — sans quoi l'application ne fonctionne pas :
 *   sites · rôles · permissions · catégories de patient · le compte `admin` et son rôle
 * CONSERVÉ — utile dès le premier jour :
 *   motifs · pathologies · médicaments · types d'examen · types de consultation ·
 *   sociétés sous-traitantes
 *
 * ⚠️ IRRÉVERSIBLE.
 *
 * Usage :  node prisma/remise-a-zero.mjs            (simulation : compte, ne touche à rien)
 *          node prisma/remise-a-zero.mjs --appliquer
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APPLIQUER = process.argv.includes('--appliquer')
const LOGIN = 'admin'

/**
 * Tables VIDÉES intégralement. CASCADE emporte tout ce qui en dépend — y compris les
 * tables filles non listées ici, ce qui rend l'énumération robuste aux évolutions du
 * schéma. Aucune table de référence n'y figure, et CASCADE ne remonte jamais vers elles :
 * il ne descend que vers les dépendants.
 */
const A_VIDER = [
  // Dossiers et parcours de soins
  'Patient', 'Visite', 'Consultation',
  // Prescriptions et documents
  'Ordonnance', 'BonExamen', 'BonPharmacie', 'Evacuation', 'SuiviTraitement',
  // Registre employés
  'EmployeSaris',
  // Messagerie
  'Conversation', 'Message',
  // Notifications et traçabilité
  'Notification', 'JournalAudit', 'JournalAuthentification',
  // Synchronisation
  'PosteLocal', 'JournalSynchronisation', 'SyncState',
  // Sessions et délégations
  'SessionUtilisateur', 'DelegationPrescription',
  // ⚠️ PAS 'PersonnelMedical' : `Utilisateur.personnelMedicalId` pointe vers cette
  //    table, et TRUNCATE ... CASCADE tronque TOUTE table portant une clé étrangère vers
  //    la cible — quelles que soient les VALEURS de cette colonne. Y inclure
  //    PersonnelMedical effaçait donc l'intégralité des comptes, `admin` compris, et
  //    rendait l'application définitivement inaccessible. Il est supprimé plus bas, par
  //    un simple `deleteMany` qui, lui, ne regarde que les lignes.
]

async function main() {
  console.log(APPLIQUER ? '🧹 REMISE À ZÉRO' : '👀 SIMULATION (ajouter --appliquer)')
  console.log()

  const admin = await prisma.utilisateur.findFirst({
    where: { login: LOGIN },
    select: { id: true, personnelMedicalId: true },
  })
  if (!admin) throw new Error(`Compte « ${LOGIN} » introuvable — interruption.`)

  if (!APPLIQUER) {
    for (const t of A_VIDER) {
      const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`)
      if (n > 0) console.log(`   · ${t.padEnd(26)} ${n}`)
    }
    const autres = await prisma.utilisateur.count({ where: { NOT: { id: admin.id } } })
    if (autres) console.log(`   · ${'Utilisateur'.padEnd(26)} ${autres}`)
    console.log('\n   Relancer avec --appliquer pour exécuter.')
    return
  }

  // 0. Détacher tous les comptes de leur fiche personnel : les fiches sont supprimées
  //    plus bas, et un compte conservé ne doit pas pointer vers une fiche disparue.
  await prisma.utilisateur.updateMany({ data: { personnelMedicalId: null } })

  // 1. Un seul TRUNCATE pour toutes les tables : PostgreSQL gère l'ordre et les
  //    dépendances en une transaction — impossible de s'arrêter à mi-chemin.
  const liste = A_VIDER.map((t) => `"${t}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${liste} CASCADE`)
  console.log(`   ✓ ${A_VIDER.length} tables vidées (TRUNCATE CASCADE)`)

  // 2. Fiches personnel : par `deleteMany`, jamais par TRUNCATE (cf. la note ci-dessus).
  const fiches = await prisma.personnelMedical.deleteMany({})
  console.log(`   ✓ ${fiches.count} fiche(s) personnel supprimée(s)`)

  // 3. Comptes : tous sauf `admin`.
  const { count } = await prisma.utilisateur.deleteMany({ where: { NOT: { id: admin.id } } })
  console.log(`   ✓ ${count} compte(s) supprimé(s) — « ${LOGIN} » conservé`)

  // 4. Le rôle d'`admin`, EN DERNIER et systématiquement : le TRUNCATE a emporté la table
  //    de liaison au passage (elle dépend de SessionUtilisateur… et d'Utilisateur). Sans
  //    cette étape, `admin` se connecte mais n'a plus aucun droit — l'application
  //    s'effondre sans que rien à l'écran n'en donne la raison.
  const role = await prisma.role.findFirst({ where: { code: 'ADMIN_SYSTEME' }, select: { id: true } })
  if (!role) throw new Error('Rôle ADMIN_SYSTEME absent — lancer db:sync-permissions.')
  const dejaLa = await prisma.utilisateurRole.findFirst({
    where: { utilisateurId: admin.id, roleId: role.id },
  })
  if (!dejaLa) {
    await prisma.utilisateurRole.create({ data: { utilisateurId: admin.id, roleId: role.id } })
  }
  console.log(`   ✓ ${LOGIN} → ADMIN_SYSTEME`)

  // ── Contrôle ──
  console.log('\n   VIDÉ :')
  for (const t of ['Patient', 'Visite', 'Consultation', 'EmployeSaris', 'PosteLocal',
                   'PersonnelMedical', 'JournalAudit']) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`)
    console.log(`     ${t.padEnd(22)} ${n}${n === 0 ? '' : '  ⚠️'}`)
  }
  console.log('   CONSERVÉ :')
  for (const t of ['Site', 'CategoriePatient', 'MotifConsultation', 'PathologieReference',
                   'MedicamentReference', 'TypeExamen', 'TypeConsultation',
                   'SocieteSousTraitante', 'Role', 'Permission', 'Utilisateur']) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`)
    console.log(`     ${t.padEnd(22)} ${n}`)
  }
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
