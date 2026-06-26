/**
 * Seed de développement — CMS SARIS
 *
 * Données créées (idempotent via upsert) :
 *   - 2 sites
 *   - 3 rôles (ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER)
 *   - 1 utilisateur admin
 *   - 15 motifs de consultation
 *   - 12 pathologies de référence
 *   - 10 médicaments essentiels
 *   - 6 catégories de patients
 *   - 7 types d'examen
 *
 * Exécution : pnpm --filter @cms-saris/db db:seed
 */

import { PrismaClient } from '@prisma/client'
import { createRequire } from 'node:module'
import * as bcrypt from 'bcrypt'
import {
  ALL_PERMISSIONS, PERMISSION_META, DEFAULT_ROLE_PERMISSIONS, ROLE_CATALOG,
} from '../../types/src/permissions.js'

/**
 * Provider-aware : par défaut PostgreSQL ; si `DATABASE_PROVIDER=sqlite`, charge le
 * client Prisma SQLite généré (`SQLITE_CLIENT_PATH`) — sert à seeder la base SQLite
 * EMBARQUÉE du client de bureau (mode local offline-first) pour qu'elle soit utilisable
 * sans serveur central (login admin + données de démo).
 */
function makePrisma(): PrismaClient {
  const sqlitePath = process.env['DATABASE_PROVIDER'] === 'sqlite' ? process.env['SQLITE_CLIENT_PATH'] : null
  if (sqlitePath) {
    const req = createRequire(process.cwd() + '/seed.cjs')
    const mod = req(sqlitePath) as { PrismaClient: new (o?: unknown) => PrismaClient }
    return new mod.PrismaClient()
  }
  return new PrismaClient()
}

const prisma = makePrisma()
// SQLite ne supporte pas `mode: 'insensitive'` (filtre case-insensitive PostgreSQL).
const IS_SQLITE = process.env['DATABASE_PROVIDER'] === 'sqlite'

// ── Données de référence ──────────────────────────────────────────────────────

const SITES = [
  { code: 'MOUTELA', libelle: 'Centre Médico-Social Moutela', localisation: 'Brazzaville, Congo' },
  { code: 'NKAYI',   libelle: 'Centre Médico-Social Nkayi',   localisation: 'Nkayi, Congo' },
]

const ROLES = ROLE_CATALOG

const MOTIFS = [
  { code: 'URGENCE_VITALE',        libelle: 'Urgence vitale' },
  { code: 'DIFFICULTES_RESPI',     libelle: 'Difficultés respiratoires' },
  { code: 'TRAUMATISME',           libelle: 'Traumatisme / Blessure' },
  { code: 'PALUDISME_SUSPECT',     libelle: 'Paludisme suspecté' },
  { code: 'FIEVRE_FORTE',          libelle: 'Fièvre élevée (≥ 38,5°C)' },
  { code: 'DOULEUR_ABDOMINALE',    libelle: 'Douleur abdominale aiguë' },
  { code: 'SUIVI_GROSSESSE',       libelle: 'Suivi de grossesse' },
  { code: 'SUIVI_CHRONIQUE',       libelle: 'Suivi maladie chronique' },
  { code: 'DIARRHEE',              libelle: 'Diarrhée / Gastroentérite' },
  { code: 'PEDIATRIE',             libelle: 'Consultation pédiatrique' },
  { code: 'HYPERTENSION_CONTROLE', libelle: 'Contrôle tension artérielle' },
  { code: 'CONSULTATION_GENERALE', libelle: 'Consultation générale' },
  { code: 'DERMATOLOGIE',          libelle: 'Problème cutané / Dermatologie' },
  { code: 'OPHTALMOLOGIE',         libelle: 'Problème ophtalmologique' },
  { code: 'VACCINATION',           libelle: 'Vaccination / Prévention' },
]

const PATHOLOGIES = [
  { code: 'PALUDISME',           libelle: 'Paludisme',                   chronique: false },
  { code: 'DIABETE_TYPE2',       libelle: 'Diabète de type 2',           chronique: true  },
  { code: 'HTA',                 libelle: 'Hypertension artérielle',     chronique: true  },
  { code: 'TUBERCULOSE',         libelle: 'Tuberculose',                 chronique: false },
  { code: 'VIH_SIDA',            libelle: 'VIH / SIDA',                  chronique: true  },
  { code: 'DREPANOCYTOSE',       libelle: 'Drépanocytose',               chronique: true  },
  { code: 'ANEMIE',              libelle: 'Anémie',                      chronique: false },
  { code: 'GASTROENTERITE',      libelle: 'Gastroentérite',              chronique: false },
  { code: 'PNEUMONIE',           libelle: 'Pneumonie',                   chronique: false },
  { code: 'INSUFFISANCE_CARD',   libelle: 'Insuffisance cardiaque',      chronique: true  },
  { code: 'GROSSESSE',           libelle: 'Grossesse',                   chronique: false },
  { code: 'TRAUMATISME_PHYSIQUE',libelle: 'Traumatisme physique',        chronique: false },
]

const MEDICAMENTS = [
  { nomGenerique: 'Arteméther + Luméfantrine', nomCommercial: 'Coartem',     familleThera: 'Antipaludéen'          },
  { nomGenerique: 'Amoxicilline',              nomCommercial: 'Amoxil',      familleThera: 'Antibiotique'           },
  { nomGenerique: 'Paracétamol',               nomCommercial: 'Doliprane',   familleThera: 'Antalgique/Antipyrétique'},
  { nomGenerique: 'Metformine',                nomCommercial: 'Glucophage',  familleThera: 'Antidiabétique'         },
  { nomGenerique: 'Amlodipine',                nomCommercial: 'Amlor',       familleThera: 'Antihypertenseur'       },
  { nomGenerique: 'Cotrimoxazole',             nomCommercial: 'Bactrim',     familleThera: 'Antibiotique'           },
  { nomGenerique: 'Oméprazole',                nomCommercial: 'Mopral',      familleThera: 'Antiulcéreux'           },
  { nomGenerique: 'Ibuprofène',                nomCommercial: 'Advil',       familleThera: 'Anti-inflammatoire'     },
  { nomGenerique: 'Sels de réhydratation orale',nomCommercial: 'SRO',        familleThera: 'Réhydratation'          },
  { nomGenerique: 'Acide folique',             nomCommercial: null,          familleThera: 'Vitamines/Suppléments'  },
]

// Les 5 catégories du recueil (CDI, ayants droit, CDD, sous-traitant, riverain) +
// catégories techniques héritées conservées (retrait destructif → patients rattachés).
const CATEGORIES_PATIENT = [
  { code: 'ASSURE_CDI',       libelle: 'Personnel CDI (Contrat à durée indéterminée)' },
  { code: 'AYANT_DROIT_CDI',  libelle: 'Ayant droit CDI'                              },
  { code: 'ASSURE_CDD',       libelle: 'Personnel CDD (Contrat à durée déterminée)'   },
  { code: 'SOUS_TRAITANT',    libelle: 'Personnel sous-traitant'                      },
  { code: 'RIVERAIN',         libelle: 'Population riveraine'                          },
  { code: 'RETRAITE',         libelle: 'Retraité'                                     },
  { code: 'AGENT_FONCTIONNAIRE', libelle: 'Agent fonctionnaire'                       },
  { code: 'PATIENT_EXTERNE',  libelle: 'Patient externe (payant)'                     },
]

const TYPES_EXAMEN = [
  { code: 'NFS',               libelle: 'Numération formule sanguine', domaine: 'BIOLOGIE'   },
  { code: 'GLYCEMIE',          libelle: 'Glycémie',                    domaine: 'BIOLOGIE'   },
  { code: 'PALUDISME_TDR',     libelle: 'Test rapide paludisme (TDR)', domaine: 'BIOLOGIE'   },
  { code: 'URINE_BU',          libelle: 'Bandelette urinaire',         domaine: 'BIOLOGIE'   },
  { code: 'RADIO_THORAX',      libelle: 'Radiographie thoracique',     domaine: 'IMAGERIE'   },
  { code: 'ECHO_ABDO',         libelle: 'Échographie abdominale',      domaine: 'IMAGERIE'   },
  { code: 'TENSION_ARTERIELLE',libelle: 'Mesure de tension artérielle',domaine: 'SPECIALISE' },
]

const TYPES_CONSULTATION = [
  { code: 'MEDECINE_GENERALE',   libelle: 'Médecine générale'   },
  { code: 'BILAN_OBLIGATOIRE',   libelle: 'Bilan obligatoire'   },
  { code: 'VISITE_PRE_EMBAUCHE', libelle: 'Visite pré-embauche' },
  { code: 'ACCIDENT_TRAVAIL',    libelle: 'Accident du travail' },
  { code: 'VACCINATION',         libelle: 'Vaccination'         },
  { code: 'PESEE',               libelle: 'Pesée'               },
  { code: 'CARDIOLOGIE',         libelle: 'Cardiologie'         },
  { code: 'HEPATOLOGIE',         libelle: 'Hépatologie'         },
  { code: 'KINESITHERAPIE',      libelle: 'Kinésithérapie'      },
  { code: 'OPHTALMOLOGIE',       libelle: 'Ophtalmologie'       },
  { code: 'ORL',                 libelle: 'ORL'                 },
  { code: 'RHUMATOLOGIE',        libelle: 'Rhumatologie'        },
  { code: 'STOMATOLOGIE',        libelle: 'Stomatologie'        },
]

const SOCIETES_SOUS_TRAITANTES = [
  { nom: 'BTP Congo Sarl',              statut: 'ACTIVE'   },
  { nom: 'SATRAM Sécurité',             statut: 'ACTIVE'   },
  { nom: 'Congo Nettoyage Services',    statut: 'ACTIVE'   },
  { nom: 'SOTEM Électricité',           statut: 'ACTIVE'   },
  { nom: 'Restauration Centrale SARIS', statut: 'ACTIVE'   },
  { nom: 'Agri-Congo Transport',        statut: 'INACTIVE' },
  { nom: 'Maintenance Industrielle CG', statut: 'ACTIVE'   },
  { nom: 'EXCO Informatique Congo',     statut: 'INACTIVE' },
]

// siteCode → résolu dynamiquement dans main()
const PERSONNEL_MEDICAL = [
  // ── Moutela ──────────────────────────────────────────────────────────────────
  { matricule: 'MED-001', nom: 'MOUKANDA',   prenom: 'Jean-Pierre',  role: 'MEDECIN',        siteCode: 'MOUTELA', statut: 'ACTIF'   },
  { matricule: 'MED-002', nom: 'KIMPOUNI',   prenom: 'Arnaud',       role: 'MEDECIN',        siteCode: 'MOUTELA', statut: 'INACTIF' },
  { matricule: 'INF-001', nom: 'BATCHI',     prenom: 'Marie-Claire', role: 'INFIRMIER',      siteCode: 'MOUTELA', statut: 'ACTIF'   },
  { matricule: 'INF-002', nom: 'NDINGA',     prenom: 'Rachel',       role: 'INFIRMIER',      siteCode: 'MOUTELA', statut: 'ACTIF'   },
  { matricule: 'SF-001',  nom: 'BOUANGA',    prenom: 'Cécile',       role: 'SAGE_FEMME',     siteCode: 'MOUTELA', statut: 'ACTIF'   },
  { matricule: 'TL-001',  nom: 'MILANDOU',   prenom: 'Stéphane',     role: 'TECHNICIEN_LAB', siteCode: 'MOUTELA', statut: 'ACTIF'   },
  { matricule: 'ADM-001', nom: 'NGANGA',     prenom: 'Pierre',       role: 'ADMINISTRATIF',  siteCode: 'MOUTELA', statut: 'ACTIF'   },

  // ── Nkayi ─────────────────────────────────────────────────────────────────────
  { matricule: 'MED-003', nom: 'NZINGA',     prenom: 'Paul',         role: 'MEDECIN',        siteCode: 'NKAYI',   statut: 'ACTIF'   },
  { matricule: 'INF-003', nom: 'LOEMBA',     prenom: 'Grâce',        role: 'INFIRMIER',      siteCode: 'NKAYI',   statut: 'ACTIF'   },
  { matricule: 'INF-004', nom: 'MAFOUTA',    prenom: 'Lionel',       role: 'INFIRMIER',      siteCode: 'NKAYI',   statut: 'ACTIF'   },
  { matricule: 'SF-002',  nom: 'MABIALA',    prenom: 'Sylvie',       role: 'SAGE_FEMME',     siteCode: 'NKAYI',   statut: 'ACTIF'   },
  { matricule: 'TL-002',  nom: 'MABIKA',     prenom: 'Thomas',       role: 'TECHNICIEN_LAB', siteCode: 'NKAYI',   statut: 'ACTIF'   },
  { matricule: 'ADM-002', nom: 'PAMBOU',     prenom: 'Lucie',        role: 'ADMINISTRATIF',  siteCode: 'NKAYI',   statut: 'INACTIF' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seed CMS SARIS — démarrage...\n')

  // 1. Sites
  console.log('📍 Création des sites...')
  const sites = await Promise.all(
    SITES.map(s => prisma.site.upsert({ where: { code: s.code }, update: {}, create: s })),
  )
  const siteMoutela = sites[0]!
  console.log(`   ✓ ${sites.map(s => s.code).join(', ')}`)

  // 2. Rôles
  console.log('🔑 Création des rôles...')
  const roles = await Promise.all(
    ROLES.map(r => prisma.role.upsert({ where: { code: r.code }, update: {}, create: r })),
  )
  const roleAdmin = roles.find(r => r.code === 'ADMIN_SYSTEME')!
  console.log(`   ✓ ${roles.map(r => r.code).join(', ')}`)

  // 2.b Permissions (catalogue)
  console.log('🛡️  Création du catalogue de permissions...')
  for (const code of ALL_PERMISSIONS) {
    const meta = PERMISSION_META[code]
    await prisma.permission.upsert({
      where:  { code },
      update: { module: meta.module },
      create: { code, module: meta.module },
    })
  }
  console.log(`   ✓ ${ALL_PERMISSIONS.length} permissions`)

  // 2.c Affectation rôle → permissions (charte de gouvernance)
  console.log('🔗 Affectation des permissions aux rôles...')
  // On efface puis on recrée pour rester aligné avec DEFAULT_ROLE_PERMISSIONS
  for (const role of roles) {
    const perms = DEFAULT_ROLE_PERMISSIONS[role.code] ?? []
    // Reset des permissions de ce rôle
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    for (const permCode of perms) {
      const perm = await prisma.permission.findUnique({ where: { code: permCode } })
      if (perm) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        })
      }
    }
  }
  console.log('   ✓ Permissions affectées aux 3 rôles')

  // 2.d Nettoyage des permissions OBSOLÈTES (retirées du catalogue)
  // Ex : la migration vers la granularité par service supprime referentiel.create/update/delete.
  // On retire d'abord les RolePermission (de TOUS les rôles, y compris custom) qui les
  // référencent — sinon la contrainte FK bloque la suppression de la Permission.
  console.log('🧹 Nettoyage des permissions obsolètes...')
  const obsoletes = await prisma.permission.findMany({
    where:  { code: { notIn: ALL_PERMISSIONS } },
    select: { id: true, code: true },
  })
  if (obsoletes.length > 0) {
    const ids = obsoletes.map(p => p.id)
    await prisma.rolePermission.deleteMany({ where: { permissionId: { in: ids } } })
    await prisma.permission.deleteMany({ where: { id: { in: ids } } })
    console.log(`   ✓ ${obsoletes.length} permission(s) obsolète(s) supprimée(s) : ${obsoletes.map(p => p.code).join(', ')}`)
  } else {
    console.log('   ✓ Aucune permission obsolète')
  }

  // 3. Utilisateur admin — reset complet du compte à chaque seed
  console.log('👤 Création / réinitialisation de l\'utilisateur admin...')
  const PASSWORD    = 'Admin123!'
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  const admin = await prisma.utilisateur.upsert({
    where:  { login: 'admin' },
    update: {
      // Reset complet : hash + déblocage + reset compteurs
      passwordHash,
      statut:           'ACTIF',
      tentativesEchec:  0,
      blocageJusquA:    null,
      blocageMinutes:   0,
      motDePasseTemp:   false,
    },
    create: {
      login:        'admin',
      email:        'admin@cms-saris.cg',
      passwordHash,
      statut:       'ACTIF',
      siteId:       siteMoutela.id,
    },
  })
  await prisma.utilisateurRole.upsert({
    where:  { utilisateurId_roleId: { utilisateurId: admin.id, roleId: roleAdmin.id } },
    update: {},
    create: { utilisateurId: admin.id, roleId: roleAdmin.id },
  })
  // ── Réinitialisations destructives RÉSERVÉES aux tests E2E (SEED_E2E=1) ──────
  // Par défaut, le seed NE TOUCHE PAS à la 2FA ni aux dérogations de l'admin :
  // un administrateur peut légitimement activer son TOTP, et celui-ci DOIT
  // persister d'une session (et d'un re-seed) à l'autre. Ces remises à zéro ne
  // servent qu'à garantir un login admin déterministe pour la suite E2E
  // automatisée (qui se connecte en admin et ne peut pas fournir de code TOTP).
  if (process.env.SEED_E2E === '1') {
    const adminTotp = await prisma.configurationTotp.findUnique({ where: { utilisateurId: admin.id } })
    if (adminTotp) {
      await prisma.codeSecoursTotp.deleteMany({ where: { configId: adminTotp.id } })
      await prisma.configurationTotp.delete({ where: { id: adminTotp.id } })
    }
    await prisma.utilisateurPermission.deleteMany({ where: { utilisateurId: admin.id } })
    console.log(`   ✓ admin / Admin123! — réinitialisé (déblocage + mdp + 2FA + dérogations) [mode E2E]`)
  } else {
    console.log(`   ✓ admin / Admin123! — réinitialisé (déblocage + mdp). 2FA & dérogations PRÉSERVÉES.`)
  }

  // 3.b (Comptes test des rôles spéciaux supprimés — système réduit à 3 rôles.
  //  Les comptes de test cliniques sont créés via le personnel médical, §9.b.)

  // 4. Motifs de consultation
  console.log('📋 Création des motifs de consultation...')
  await Promise.all(
    MOTIFS.map(m => prisma.motifConsultation.upsert({
      where: { code: m.code }, update: {}, create: m,
    })),
  )
  console.log(`   ✓ ${MOTIFS.length} motifs`)

  // 5. Pathologies
  console.log('🦠 Création des pathologies de référence...')
  await Promise.all(
    PATHOLOGIES.map(p => prisma.pathologieReference.upsert({
      where: { code: p.code }, update: {}, create: p,
    })),
  )
  console.log(`   ✓ ${PATHOLOGIES.length} pathologies`)

  // 6. Médicaments
  console.log('💊 Création des médicaments essentiels...')
  for (const m of MEDICAMENTS) {
    const existing = await prisma.medicamentReference.findFirst({
      where: { nomGenerique: m.nomGenerique },
    })
    if (!existing) {
      await prisma.medicamentReference.create({ data: m })
    }
  }
  console.log(`   ✓ ${MEDICAMENTS.length} médicaments`)

  // 7. Catégories de patients
  console.log('👥 Création des catégories de patients...')
  await Promise.all(
    CATEGORIES_PATIENT.map(c => prisma.categoriePatient.upsert({
      where: { code: c.code }, update: { libelle: c.libelle }, create: c,
    })),
  )
  console.log(`   ✓ ${CATEGORIES_PATIENT.length} catégories`)

  // 7.b Droits par catégorie (RÈGLE CENTRALE du recueil) : consultation + premiers
  //     soins pour TOUTES ; médicaments (bon de pharmacie) + bons d'examens UNIQUEMENT
  //     pour CDI + ayants droit. Table de référence (dormante jusqu'ici) → reset propre.
  console.log('🔐 Affectation des droits par catégorie...')
  const COUVERTURE_COMPLETE = ['ASSURE_CDI', 'AYANT_DROIT_CDI']  // prise en charge médicaments + examens
  const catsForDroits = await prisma.categoriePatient.findMany({ select: { id: true, code: true } })
  await prisma.droitCategoriePatient.deleteMany({})
  const droitsData = catsForDroits.flatMap(c => {
    const complet = COUVERTURE_COMPLETE.includes(c.code)
    return [
      { categorieId: c.id, typePrestation: 'CONSULTATION',   couvert: true    },
      { categorieId: c.id, typePrestation: 'PREMIERS_SOINS', couvert: true    },
      { categorieId: c.id, typePrestation: 'MEDICAMENT',     couvert: complet },
      { categorieId: c.id, typePrestation: 'EXAMEN',         couvert: complet },
    ]
  })
  await prisma.droitCategoriePatient.createMany({ data: droitsData })
  console.log(`   ✓ ${droitsData.length} droits (médicaments/examens réservés CDI + ayants droit)`)

  // 8. Types d'examen
  console.log('🔬 Création des types d\'examen...')
  await Promise.all(
    TYPES_EXAMEN.map(t => prisma.typeExamen.upsert({
      where: { code: t.code }, update: {}, create: t,
    })),
  )
  console.log(`   ✓ ${TYPES_EXAMEN.length} types d'examen`)

  // 8.b Types de consultation (modèle Jeannette)
  console.log('🗂️  Création des types de consultation...')
  await Promise.all(
    TYPES_CONSULTATION.map(t => prisma.typeConsultation.upsert({
      where: { code: t.code }, update: {}, create: t,
    })),
  )
  console.log(`   ✓ ${TYPES_CONSULTATION.length} types de consultation`)

  // 9. Personnel médical + délégations
  console.log('👨‍⚕️ Création du personnel médical...')
  const siteMap = Object.fromEntries(sites.map(s => [s.code, s.id]))
  for (const p of PERSONNEL_MEDICAL) {
    const { siteCode, ...rest } = p
    await prisma.personnelMedical.upsert({
      where:  { matricule: rest.matricule },
      update: {},
      create: { ...rest, siteId: siteMap[siteCode] },
    })
  }
  console.log(`   ✓ ${PERSONNEL_MEDICAL.length} agents (${PERSONNEL_MEDICAL.filter(p => p.statut === 'ACTIF').length} actifs, ${PERSONNEL_MEDICAL.filter(p => p.statut === 'INACTIF').length} inactifs)`)

  // 9.b Comptes utilisateurs liés au personnel médical (login: nom de famille)
  console.log('🔐 Création des comptes utilisateurs liés au personnel...')
  const ROLE_BY_MED = {
    MEDECIN:        'MEDECIN_CHEF',     // modèle du recueil : un seul rôle médecin = Médecin Chef
    INFIRMIER:      'INFIRMIER',
    SAGE_FEMME:     'INFIRMIER',
    TECHNICIEN_LAB: 'INFIRMIER',
    // ADMINISTRATIF : pas de compte (le personnel administratif n'est pas un
    // utilisateur du système — modèle réduit à 3 rôles cliniques/admin).
  } as const
  // Le matricule du médecin-chef « principal » (libellé/affichage) ; tous les
  // médecins reçoivent le rôle MEDECIN_CHEF (recueil = 2 rôles cliniques).
  const CHEF_MATRICULE = 'MED-001'

  const sharedHash = await bcrypt.hash('Saris2026!', 12)
  let userCount = 0
  let resetCount = 0
  for (const p of PERSONNEL_MEDICAL) {
    if (p.statut !== 'ACTIF') continue
    // Le personnel administratif n'a pas de compte (hors des 3 rôles du système).
    if (p.role === 'ADMINISTRATIF') continue
    const personnel = await prisma.personnelMedical.findUnique({ where: { matricule: p.matricule } })
    if (!personnel) continue

    const login = p.nom.toLowerCase().replace(/[^a-z]/g, '')
    const email = `${login}@cms-saris.cg`
    const targetRoleCode = p.matricule === CHEF_MATRICULE
      ? 'MEDECIN_CHEF'
      : (ROLE_BY_MED[p.role as keyof typeof ROLE_BY_MED] ?? 'INFIRMIER')
    const targetRole     = roles.find(r => r.code === targetRoleCode)!

    const existing = await prisma.utilisateur.findUnique({ where: { login } })

    if (existing) {
      // Reset complet du compte (mdp + déblocage + lien personnel)
      await prisma.utilisateur.update({
        where: { id: existing.id },
        data:  {
          passwordHash:       sharedHash,
          statut:             'ACTIF',
          tentativesEchec:    0,
          blocageJusquA:      null,
          blocageMinutes:     0,
          personnelMedicalId: personnel.id,
        },
      })
      // S'assurer que le rôle est toujours attaché
      await prisma.utilisateurRole.upsert({
        where: { utilisateurId_roleId: { utilisateurId: existing.id, roleId: targetRole.id } },
        update: {},
        create: { utilisateurId: existing.id, roleId: targetRole.id },
      })
      resetCount++
      continue
    }

    const u = await prisma.utilisateur.create({
      data: {
        login,
        email,
        passwordHash:       sharedHash,
        statut:             'ACTIF',
        siteId:             siteMap[p.siteCode]!,
        personnelMedicalId: personnel.id,
        createdBy:          'seed',
      },
    })
    await prisma.utilisateurRole.create({
      data: { utilisateurId: u.id, roleId: targetRole.id },
    })
    userCount++
  }
  console.log(`   ✓ ${userCount} nouveaux comptes · ${resetCount} comptes réinitialisés (mot de passe : Saris2026!)`)

  // 10. Délégations de prescription
  console.log('🔗 Création des délégations de prescription...')

  // Récupérer les IDs par matricule
  const getPersonnelId = async (matricule: string) => {
    const agent = await prisma.personnelMedical.findUnique({ where: { matricule } })
    return agent!.id
  }

  // Récupérer quelques médicaments pour les affecter aux délégations
  const medPaludisme  = await prisma.medicamentReference.findFirst({ where: { nomGenerique: { contains: 'Arteméther' } } })
  const medAmox       = await prisma.medicamentReference.findFirst({ where: { nomGenerique: 'Amoxicilline' } })
  const medParacetamol = await prisma.medicamentReference.findFirst({ where: { nomGenerique: 'Paracétamol' } })
  const medSRO        = await prisma.medicamentReference.findFirst({ where: { nomGenerique: { contains: 'réhydratation' } } })
  const medCotri      = await prisma.medicamentReference.findFirst({ where: { nomGenerique: 'Cotrimoxazole' } })

  const idMED001 = await getPersonnelId('MED-001')  // MOUKANDA — Moutela
  const idMED003 = await getPersonnelId('MED-003')  // NZINGA    — Nkayi
  const idINF001 = await getPersonnelId('INF-001')  // BATCHI    — Moutela
  const idINF002 = await getPersonnelId('INF-002')  // NDINGA    — Moutela
  const idINF003 = await getPersonnelId('INF-003')  // LOEMBA    — Nkayi
  const idINF004 = await getPersonnelId('INF-004')  // MAFOUTA   — Nkayi

  const now = new Date()
  const past   = (months: number) => new Date(now.getFullYear(), now.getMonth() - months, now.getDate()).toISOString()
  const future = (months: number) => new Date(now.getFullYear(), now.getMonth() + months, now.getDate()).toISOString()

  const DELEGATIONS = [
    // Active — Moutela : MOUKANDA → BATCHI
    {
      medecinChefId: idMED001, infirmierId: idINF001,
      dateDebut: past(1), dateFin: future(2),
      statut: 'ACTIVE',
      perimetre: 'Consultations de routine, suivi des malades chroniques du lundi au vendredi',
      medicamentIds: [medParacetamol?.id, medAmox?.id, medSRO?.id].filter(Boolean) as string[],
    },
    // Active — Moutela : MOUKANDA → NDINGA
    {
      medecinChefId: idMED001, infirmierId: idINF002,
      dateDebut: past(0), dateFin: future(3),
      statut: 'ACTIVE',
      perimetre: 'Permanences de nuit et week-ends',
      medicamentIds: [medParacetamol?.id, medSRO?.id].filter(Boolean) as string[],
    },
    // Active — Nkayi : NZINGA → LOEMBA
    {
      medecinChefId: idMED003, infirmierId: idINF003,
      dateDebut: past(1), dateFin: future(1),
      statut: 'ACTIVE',
      perimetre: 'Prise en charge du paludisme non compliqué',
      medicamentIds: [medPaludisme?.id, medParacetamol?.id, medCotri?.id].filter(Boolean) as string[],
    },
    // Expirée — Nkayi : NZINGA → MAFOUTA (dateFin dans le passé)
    {
      medecinChefId: idMED003, infirmierId: idINF004,
      dateDebut: past(4), dateFin: past(1),
      statut: 'ACTIVE',
      perimetre: 'Campagne de vaccination trimestrielle',
      medicamentIds: [] as string[],
    },
    // Suspendue — Moutela : MOUKANDA → BATCHI (statut INACTIVE)
    {
      medecinChefId: idMED001, infirmierId: idINF001,
      dateDebut: past(3), dateFin: future(1),
      statut: 'INACTIVE',
      perimetre: 'Délégation suspendue suite à audit interne',
      medicamentIds: [medAmox?.id, medCotri?.id].filter(Boolean) as string[],
    },
  ]

  let delegCount = 0
  for (const d of DELEGATIONS) {
    const { medicamentIds, ...rest } = d
    const existing = await prisma.delegationPrescription.findFirst({
      where: { medecinChefId: rest.medecinChefId, infirmierId: rest.infirmierId, dateDebut: new Date(rest.dateDebut) },
    })
    if (!existing) {
      await prisma.delegationPrescription.create({
        data: {
          ...rest,
          dateDebut: new Date(rest.dateDebut),
          dateFin:   new Date(rest.dateFin),
          ...(medicamentIds.length && {
            medicamentsAutorises: { create: medicamentIds.map(medicamentId => ({ medicamentId })) },
          }),
        },
      })
      delegCount++
    }
  }
  console.log(`   ✓ ${delegCount} délégations créées (3 actives, 1 expirée, 1 suspendue)`)

  // 11. Sociétés sous-traitantes
  console.log('🏢 Création des sociétés sous-traitantes...')
  let stCount = 0
  for (const s of SOCIETES_SOUS_TRAITANTES) {
    const existing = await prisma.societeSousTraitante.findFirst({
      where: { nom: { equals: s.nom, ...(IS_SQLITE ? {} : { mode: 'insensitive' as const }) } },
    })
    if (!existing) {
      await prisma.societeSousTraitante.create({ data: s })
      stCount++
    }
  }
  const stActives = SOCIETES_SOUS_TRAITANTES.filter(s => s.statut === 'ACTIVE').length
  const stInactives = SOCIETES_SOUS_TRAITANTES.filter(s => s.statut === 'INACTIVE').length
  console.log(`   ✓ ${stCount} sociétés créées (${stActives} actives, ${stInactives} inactives)`)

  // 12. Patients de test
  console.log('🏥 Création des patients de test...')
  const siteNkayi = sites[1]!
  const categCdi       = await prisma.categoriePatient.findUnique({ where: { code: 'ASSURE_CDI' } })
  const categAD        = await prisma.categoriePatient.findUnique({ where: { code: 'AYANT_DROIT_CDI' } })
  const categRetraite  = await prisma.categoriePatient.findUnique({ where: { code: 'RETRAITE' } })
  const categExterne   = await prisma.categoriePatient.findUnique({ where: { code: 'PATIENT_EXTERNE' } })
  const categFonction  = await prisma.categoriePatient.findUnique({ where: { code: 'AGENT_FONCTIONNAIRE' } })

  const patientsData = [
    // Patient 1 — CDI, Moutela, avec allergie sévère
    {
      numero: 'PAT-MOU-00001',
      siteId: siteMoutela.id,
      categId: categCdi!.id,
      identite: { nom: 'MBEMBA', prenom: 'Jean-Pierre', dateNaissance: '1978-04-15', sexe: 'M', telephone: '+242 06 123 4567' },
      contact:  { nom: 'MBEMBA', prenom: 'Marie', telephone: '+242 06 987 6543', lien: 'Conjoint(e)' },
      allergies: [
        { substance: 'Pénicilline', gravite: 'SEVERE', confirme: true },
        { substance: 'Aspirine',    gravite: 'MODERE', confirme: true },
      ],
      antecedents: [
        { type: 'MEDICAL',     description: 'Hypertension artérielle diagnostiquée en 2015, sous traitement.' },
        { type: 'CHIRURGICAL', description: 'Appendicectomie en 2003 sans complications.' },
      ],
      alertes: [
        { type: 'ALLERGIE',            message: 'ALLERGIE SÉVÈRE à la pénicilline — à éviter absolument', gravite: 'CRITIQUE' },
        { type: 'PATHOLOGIE_CHRONIQUE', message: 'Hypertension artérielle traitée — surveiller TA à chaque visite',  gravite: 'IMPORTANT' },
      ],
    },
    // Patient 2 — Ayant droit CDI, Moutela
    {
      numero: 'PAT-MOU-00002',
      siteId: siteMoutela.id,
      categId: categAD!.id,
      identite: { nom: 'MOUKASSA', prenom: 'Élisabeth', dateNaissance: '2005-09-22', sexe: 'F', telephone: '+242 06 234 5678' },
      contact:  { nom: 'MOUKASSA', prenom: 'Paul', telephone: '+242 06 876 5432', lien: 'Père' },
      allergies: [],
      antecedents: [
        { type: 'FAMILIAL', description: 'Antécédent familial de diabète de type 2 (père et grand-père paternels).' },
      ],
      alertes: [],
    },
    // Patient 3 — Retraité, Moutela, avec diabète
    {
      numero: 'PAT-MOU-00003',
      siteId: siteMoutela.id,
      categId: categRetraite!.id,
      identite: { nom: 'NGANGA', prenom: 'Théophile', dateNaissance: '1955-01-03', sexe: 'M', telephone: '+242 05 345 6789', adresse: 'Quartier Moungali, Brazzaville' },
      contact:  { nom: 'NGANGA', prenom: 'Cécile', telephone: '+242 05 765 4321', lien: 'Conjoint(e)' },
      allergies: [
        { substance: 'Sulfamides', gravite: 'MODERE', confirme: false },
      ],
      antecedents: [
        { type: 'MEDICAL',     description: 'Diabète de type 2 depuis 2010, insulinodépendant depuis 2018.' },
        { type: 'MEDICAL',     description: 'Insuffisance rénale chronique légère (stade 2) — diagnostic 2020.' },
        { type: 'GYNECO_OBSTETRICAL', description: 'Non applicable (patient de sexe masculin — renseignement à supprimer).' },
      ],
      alertes: [
        { type: 'PATHOLOGIE_CHRONIQUE', message: 'Diabète insulinodépendant — vérifier glycémie systématiquement',        gravite: 'CRITIQUE' },
        { type: 'SURVEILLANCE',         message: 'Insuffisance rénale chronique — adapter les posologies médicamenteuses', gravite: 'IMPORTANT' },
      ],
    },
    // Patient 4 — Externe, Nkayi
    {
      numero: 'PAT-NKA-00001',
      siteId: siteNkayi.id,
      categId: categExterne!.id,
      identite: { nom: 'BOUITI', prenom: 'Sandrine', dateNaissance: '1992-07-18', sexe: 'F' },
      contact:  { nom: 'BOUITI', prenom: 'Roger', telephone: '+242 06 456 7890', lien: 'Frère / Sœur' },
      allergies: [],
      antecedents: [
        { type: 'MEDICAL', description: 'Antécédent de paludisme grave avec hospitalisation en 2019.' },
      ],
      alertes: [],
    },
    // Patient 5 — Fonctionnaire, Nkayi
    {
      numero: 'PAT-NKA-00002',
      siteId: siteNkayi.id,
      categId: categFonction!.id,
      identite: { nom: 'MAKOUMBOU', prenom: 'Aristide', dateNaissance: '1980-11-30', sexe: 'M', telephone: '+242 05 567 8901' },
      contact:  { nom: 'MAKOUMBOU', prenom: 'Florence', telephone: '+242 05 654 3210', lien: 'Conjoint(e)' },
      allergies: [],
      antecedents: [
        { type: 'CHIRURGICAL', description: 'Hernie inguinale opérée en 2017 à l\'Hôpital Central de Brazzaville, sans complication.' },
      ],
      alertes: [
        { type: 'CONTRE_INDICATION', message: 'Contre-indication aux AINS (antécédent de gastropathie)', gravite: 'IMPORTANT' },
      ],
    },
  ]

  let patCount = 0
  for (const p of patientsData) {
    const exists = await prisma.patient.findUnique({ where: { numeroPatient: p.numero } })
    if (exists) continue

    const patient = await prisma.patient.create({
      data: {
        numeroPatient:      p.numero,
        siteCreationId:     p.siteId,
        siteId:             p.siteId, // ⚠️ scope de SYNCHRONISATION : sans `siteId`, le patient
        //                              est exclu du pull offline-first (cf. sync-models BY_SITE).
        categoriePatientId: p.categId,
        createdBy:          'seed',
      },
    })

    // Identité
    await prisma.identitePatient.create({
      data: {
        patientId:     patient.id,
        nom:           p.identite.nom,
        prenom:        p.identite.prenom,
        dateNaissance: new Date(p.identite.dateNaissance),
        sexe:          p.identite.sexe,
        telephone:     p.identite.telephone ?? null,
        adresse:       (p.identite as { adresse?: string }).adresse ?? null,
      },
    })

    // Contact urgence
    await prisma.contactUrgence.create({
      data: { patientId: patient.id, ...p.contact },
    })

    // Historique catégorie initial
    await prisma.historiqueCategoriePatient.create({
      data: {
        patientId:      patient.id,
        ancienneCategId: null,
        nouvelleCategId: p.categId,
        dateEffet:      new Date(),
        motif:          'Création initiale du dossier',
        createdBy:      'seed',
      },
    })

    // Allergies
    for (const a of p.allergies) {
      await prisma.allergiePatient.create({
        data: { patientId: patient.id, ...a },
      })
    }

    // Antécédents
    for (const ant of p.antecedents) {
      await prisma.antecedentPatient.create({
        data: { patientId: patient.id, ...ant },
      })
    }

    // Alertes médicales
    for (const al of p.alertes) {
      await prisma.alerteMedicale.create({
        data: { patientId: patient.id, ...al },
      })
    }

    patCount++
  }
  console.log(`   ✓ ${patCount} patients créés (3 Moutela, 2 Nkayi)`)

  console.log(`\n${'─'.repeat(50)}`)
  console.log('🎉 Seed terminé avec succès !\n')
  console.log('   Identifiants de test :')
  console.log(`   Login    : admin`)
  console.log(`   Password : ${PASSWORD}`)
  console.log(`   Site     : Moutela (${siteMoutela.id})`)
  console.log(`   Personnel: ${PERSONNEL_MEDICAL.length} agents créés`)
  console.log('─'.repeat(50))
}

main()
  .catch(e => { console.error('❌ Erreur seed :', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
