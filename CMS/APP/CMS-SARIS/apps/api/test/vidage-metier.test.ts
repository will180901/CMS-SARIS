/**
 * Tests unitaires du vidage des données métier : la liste des tables à vider est vérifiée CONTRE LE
 * SCHÉMA (ordre des clés étrangères, aucune table oubliée), et le portier des envois des postes.
 *   pnpm --filter api exec tsx test/vidage-metier.test.ts
 */
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { PortierVidage } from '../src/modules/sync/portier-vidage'
import {
  AUTRES_DONNEES_METIER,
  delegueMetier,
  ENTITES_NOTIFICATION_METIER,
  TABLES_METIER,
} from '../src/modules/sync/vidage-metier'

let passed = 0
let failed = 0
const attentes: Promise<void>[] = []
function test(name: string, fn: () => void | Promise<void>): void {
  const run = async () => {
    try {
      await fn()
      passed++
      console.log('  ✓ ' + name)
    } catch (e) {
      failed++
      console.error('  ✗ ' + name + '\n     ' + (e as Error).message)
    }
  }
  attentes.push(
    attentes.length ? attentes[attentes.length - 1].then(run) : run(),
  )
}

const modeles = Prisma.dmmf.datamodel.models
const parNom = new Map(modeles.map((m) => [m.name, m]))
const liste = new Set(TABLES_METIER)

/** Les clés étrangères d'un modèle : [champ, modèle visé]. */
function cles(nom: string): [string, string][] {
  return (parNom.get(nom)?.fields ?? [])
    .filter(
      (f) => f.kind === 'object' && (f.relationFromFields?.length ?? 0) > 0,
    )
    .map((f) => [f.name, f.type])
}

console.log('liste des tables métier (contre le schéma)')
test('chaque table de la liste existe au schéma, une seule fois', () => {
  assert.equal(liste.size, TABLES_METIER.length)
  for (const t of TABLES_METIER)
    assert.ok(parNom.has(t), `${t} absente du schéma`)
})
test('les parents sont avant leurs enfants : l’ordre inverse supprime sans heurter une clé étrangère', () => {
  const rang = new Map(TABLES_METIER.map((t, i) => [t, i]))
  const fautes: string[] = []
  for (const t of TABLES_METIER)
    for (const [champ, cible] of cles(t))
      if (liste.has(cible) && (rang.get(cible) ?? 0) >= (rang.get(t) ?? 0))
        fautes.push(`${t}.${champ} → ${cible}`)
  assert.deepEqual(fautes, [])
})
test('aucune autre table du schéma ne dépend d’une table métier : rien d’oublié', () => {
  const orphelines: string[] = []
  for (const m of modeles) {
    if (liste.has(m.name)) continue
    for (const [champ, cible] of cles(m.name))
      if (liste.has(cible)) orphelines.push(`${m.name}.${champ} → ${cible}`)
  }
  assert.deepEqual(orphelines, [])
})
test('toute table qui porte un patientId ou une visiteId est dans la liste (lien sans clé étrangère compris)', () => {
  const oublies = modeles
    .filter(
      (m) =>
        !liste.has(m.name) &&
        m.fields.some((f) =>
          ['patientId', 'visiteId', 'consultationId'].includes(f.name),
        ),
    )
    .map((m) => m.name)
  assert.deepEqual(oublies, [])
})
test('rien de ce qui doit rester n’est dans la liste', () => {
  const doitRester = [
    'Utilisateur',
    'Role',
    'Permission',
    'RolePermission',
    'UtilisateurRole',
    'UtilisateurPermission',
    'PersonnelMedical',
    'DelegationPrescription',
    'Site',
    'CategoriePatient',
    'DroitCategoriePatient',
    'MotifConsultation',
    'TypeConsultation',
    'PathologieReference',
    'MedicamentReference',
    'ContreIndicationMedicament',
    'TypeExamen',
    'EtablissementReference',
    'SocieteSousTraitante',
    'Conversation',
    'ConversationParticipant',
    'Message',
    'MessagePieceJointe',
    'ParametreSysteme',
    'PreferenceUtilisateur',
    'JournalAudit',
    'JournalAuthentification',
    'SessionUtilisateur',
    'PosteLocal',
    'JournalSynchronisation',
    'SyncState',
    'Notification',
    'SauvegardeSysteme',
  ]
  for (const t of doitRester) {
    assert.ok(
      parNom.has(t),
      `${t} n’existe plus au schéma : mettre ce test à jour`,
    )
    assert.ok(!liste.has(t), `${t} ne doit PAS être vidée`)
  }
})
test('le dossier patient et le parcours de soins y sont tous', () => {
  for (const t of [
    'Patient',
    'IdentitePatient',
    'Visite',
    'ConstanteVitale',
    'Consultation',
    'Ordonnance',
    'LigneOrdonnance',
    'BonExamen',
    'ResultatExamen',
    'BonPharmacie',
    'Evacuation',
    'SuiviTraitement',
    'AdministrationTraitement',
    'SuiviChronique',
    'FusionDossierPatient',
  ])
    assert.ok(liste.has(t), `${t} manque à la liste`)
})
test('le premier de la liste est le dossier patient (le parent de presque tout)', () => {
  assert.equal(TABLES_METIER[0], 'Patient')
})

console.log('notifications et autres données')
test('seuls les types d’entité du parcours de soins sont des notifications métier', () => {
  assert.deepEqual([...ENTITES_NOTIFICATION_METIER].sort(), [
    'consultation',
    'evacuation',
    'ordonnance',
    'patient',
    'suivi_traitement',
    'visite',
  ])
  for (const gardee of ['conversation', 'session', 'utilisateur', 'role'])
    assert.ok(
      !ENTITES_NOTIFICATION_METIER.includes(gardee),
      `${gardee} doit rester`,
    )
})
test('les trois « autres » données ont un libellé', () => {
  assert.deepEqual(Object.keys(AUTRES_DONNEES_METIER).sort(), [
    'conflits',
    'notifications',
    'rapports',
  ])
})
test('le délégué du client Prisma s’écrit en minuscule initiale', () => {
  assert.equal(delegueMetier('IdentitePatient'), 'identitePatient')
  assert.equal(delegueMetier('Patient'), 'patient')
})

console.log('portier des envois')
test('un envoi entre tant que rien ne ferme la porte', () => {
  const p = new PortierVidage()
  assert.equal(p.entrer(), true)
  assert.equal(p.envoisEnRoute, 1)
  p.sortir()
  assert.equal(p.envoisEnRoute, 0)
})
test('porte fermée : plus aucun envoi n’entre', async () => {
  const p = new PortierVidage()
  assert.equal(await p.fermer(50), true)
  assert.equal(p.estFerme, true)
  assert.equal(p.entrer(), false)
  assert.equal(p.envoisEnRoute, 0)
})
test('rouverte, la porte laisse de nouveau entrer', async () => {
  const p = new PortierVidage()
  await p.fermer(50)
  p.rouvrir()
  assert.equal(p.estFerme, false)
  assert.equal(p.entrer(), true)
})
test('la fermeture attend la fin des envois en route', async () => {
  const p = new PortierVidage()
  assert.equal(p.entrer(), true)
  let ferme = false
  const f = p.fermer(2000).then((ok) => {
    ferme = ok
    return ok
  })
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(
    ferme,
    false,
    'la porte se ferme alors qu’un envoi est encore en route',
  )
  assert.equal(
    p.entrer(),
    false,
    'un nouvel envoi est entré pendant la fermeture',
  )
  p.sortir()
  assert.equal(await f, true)
})
test('des envois qui ne finissent pas : la fermeture renonce et la porte est rouverte', async () => {
  const p = new PortierVidage()
  p.entrer()
  assert.equal(await p.fermer(40), false)
  assert.equal(p.estFerme, false)
  assert.equal(p.entrer(), true)
})
test('deux fermetures ne se croisent pas', async () => {
  const p = new PortierVidage()
  assert.equal(await p.fermer(50), true)
  assert.equal(await p.fermer(50), false)
})
test('sortir sans être entré ne rend jamais un compte négatif', () => {
  const p = new PortierVidage()
  p.sortir()
  p.sortir()
  assert.equal(p.envoisEnRoute, 0)
  assert.equal(p.entrer(), true)
  assert.equal(p.envoisEnRoute, 1)
})

void Promise.all(attentes).then(() => {
  console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
  if (failed > 0) process.exit(1)
})
