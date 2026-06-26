import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search, X, UserSearch, FileText, AlertCircle, Stethoscope, PenLine, HeartPulse,
  ChevronLeft, UserPlus, AlertTriangle,
} from 'lucide-react'
import { Button as SButton, SelectBox } from '@/components/saris'
import { Input }  from '@workspace/ui/components/input'
import { Label }  from '@workspace/ui/components/label'
import { ApiError } from '@/lib/api'
import { useCreateVisite }             from '../hooks/useTriage'
import { useMotifs, useCreateMotif, useCategoriesPatient } from '@/modules/referentiels/hooks/useReferentiels'
import { useSousTraitants } from '@/modules/referentiels/hooks/useSousTraitants'
import { useEmployeLookup } from '@/modules/referentiels/hooks/useEmployes'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { usePatients, useCreatePatient, useFindSimilarPatients } from '@/modules/patients/hooks/usePatients'
import { usePermissions }              from '@/hooks/usePermissions'
import { useSessionStore }             from '@/stores/session.store'
import { PatientAvatar, CategorieBadge } from '@/modules/patients/components/CategorieBadge'
import { nomPersonne, dateNaissance as dateNaissanceSchema, todayISO, minBirthISO } from '@/lib/validation'
import { calcAge } from '@/lib/age'

// ── Helpers ───────────────────────────────────────────────────────────────────

const lbl = { fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }

const NOM_SCHEMA = nomPersonne('Nom')
function nomValide(v: string): boolean { return NOM_SCHEMA.safeParse(v).success }
function dateNaissanceValide(v: string): boolean { return !!v && dateNaissanceSchema.safeParse(v).success }

// Dossier minimal saisi au triage — données admin pilotées par la catégorie (recueil §5).
interface NewPatient {
  nom: string; prenom: string; dateNaissance: string; sexe: '' | 'M' | 'F'; categorieId: string
  matricule: string; fonction: string; sectionPaie: string; service: string; departement: string
  cdiMatricule: string; typeLien: string; societeId: string
  // Identité du CDI rattaché à enregistrer si son matricule est inconnu au registre (ayant droit)
  cdiNom: string; cdiPrenom: string; cdiFonction: string; cdiSectionPaie: string; cdiService: string; cdiDepartement: string
}
const EMPTY_NP: NewPatient = {
  nom: '', prenom: '', dateNaissance: '', sexe: '', categorieId: '',
  matricule: '', fonction: '', sectionPaie: '', service: '', departement: '',
  cdiMatricule: '', typeLien: '', societeId: '',
  cdiNom: '', cdiPrenom: '', cdiFonction: '', cdiSectionPaie: '', cdiService: '', cdiDepartement: '',
}

// ── Composant ─────────────────────────────────────────────────────────────────
//
// Panneau de CRÉATION minimale d'une visite : on identifie le patient + le motif
// (le strict nécessaire pour ouvrir la visite), puis tout le reste du triage
// (constantes, notes d'accueil, décisions) se fait DANS VisiteDetail. À la
// création, `onCreated(visiteId)` ouvre directement la nouvelle visite.

interface Props {
  onClose:    () => void
  onCreated?: (visiteId: string) => void
}

export function NouvelleVisitePanel({ onClose, onCreated }: Props) {
  const { t }         = useTranslation()
  const create        = useCreateVisite()
  const createMotif   = useCreateMotif()
  const createPatient = useCreatePatient()
  const { has }       = usePermissions()
  // Enrichissement à la volée du référentiel motifs = perm dédiée.
  const canCreateMotif   = has('referentiel.motif.create')
  const canCreatePatient = has('patient.create')
  const mySiteId         = useSessionStore(s => s.user?.siteId ?? '')

  const [search,      setSearch]     = useState('')
  const [patientId,   setPatient]    = useState('')
  const [submitError, setError]      = useState<string | null>(null)

  // Patient — sous-mode : sélectionner un patient existant OU créer le dossier.
  const [mode, setMode] = useState<'search' | 'create'>('search')
  const [np, setNp]     = useState<NewPatient>(EMPTY_NP)
  const { data: categories = [] } = useCategoriesPatient()
  const { data: societes   = [] } = useSousTraitants()
  const categoriesActives = useMemo(() => categories.filter(c => c.statut === 'ACTIVE'), [categories])

  // Données admin EXIGÉES par catégorie (recueil §5)
  const npCode      = categoriesActives.find(c => c.id === np.categorieId)?.code
  const npIsCdiCdd  = npCode === 'ASSURE_CDI' || npCode === 'ASSURE_CDD'
  const npAyant     = npCode === 'AYANT_DROIT_CDI'
  const npSousTrait = npCode === 'SOUS_TRAITANT'

  // Reconnaissance dynamique de l'employé par matricule (recueil) : CDI/CDD = son propre
  // matricule ; ayant droit = le matricule du CDI rattaché. Debounce 400 ms.
  const matRecherche = npAyant ? np.cdiMatricule : npIsCdiCdd ? np.matricule : ''
  const [lookupMat, setLookupMat] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setLookupMat(matRecherche.trim()), 400)
    return () => clearTimeout(id)
  }, [matRecherche])
  const { data: employeTrouve, isFetching: lookupLoading } = useEmployeLookup(lookupMat)
  const employeReconnu = !!employeTrouve && employeTrouve.matricule === matRecherche.trim() && matRecherche.trim().length >= 3

  // CDI/CDD reconnu → auto-remplissage des données pro depuis le registre.
  useEffect(() => {
    if (employeReconnu && npIsCdiCdd && employeTrouve) {
      setNp(prev => ({
        ...prev,
        fonction:    employeTrouve.fonction    ?? prev.fonction,
        sectionPaie: employeTrouve.sectionPaie ?? prev.sectionPaie,
        service:     employeTrouve.service     ?? prev.service,
        departement: employeTrouve.departement ?? prev.departement,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeReconnu, npIsCdiCdd, employeTrouve?.id])

  const categorieDonneesOk =
      npIsCdiCdd  ? !!(np.matricule.trim() && np.fonction.trim() && np.sectionPaie.trim() && np.service.trim() && np.departement.trim())
    : npAyant     ? !!(np.fonction.trim() && np.cdiMatricule.trim() && np.typeLien && (employeReconnu || (np.cdiNom.trim() && np.cdiPrenom.trim())))
    : npSousTrait ? !!np.societeId
    : true
  const newPatientValid =
    nomValide(np.nom) && nomValide(np.prenom) &&
    dateNaissanceValide(np.dateNaissance) && !!np.sexe && !!np.categorieId &&
    categorieDonneesOk

  // Détection de doublons : ne s'active qu'en mode création, nom+prénom valides.
  const { data: similaires = [] } = useFindSimilarPatients({
    nom:    mode === 'create' ? np.nom.trim() : '',
    prenom: mode === 'create' ? np.prenom.trim() : '',
    dateNaissance: np.dateNaissance || undefined,
    sexe:   (np.sexe || undefined) as 'M' | 'F' | undefined,
  })

  // Motif : sélection depuis référentiel OU saisie manuelle
  const [selectedMotif,  setSelectedMotif]  = useState<{ id: string; libelle: string } | null>(null)
  const [showManualMotif, setShowManualMotif] = useState(false)
  const [manualMotifLib,  setManualMotifLib]  = useState('')

  const motifId = selectedMotif?.id ?? ''

  const { data: allPatients = [], isLoading: searching } = usePatients({
    search: search.length >= 2 ? search : undefined,
    statut: 'ACTIF',
  })
  const { data: motifs = [] } = useMotifs()
  const actifsMotifs = useMemo(() => motifs.filter(m => m.statut === 'ACTIF'), [motifs])

  const selectedPatient = allPatients.find(p => p.id === patientId)
  const patientValid = mode === 'create' ? newPatientValid : !!patientId
  const valid        = patientValid && !!motifId

  function reset() {
    setSearch(''); setPatient(''); setSelectedMotif(null)
    setShowManualMotif(false); setManualMotifLib('')
    setError(null)
    setMode('search'); setNp(EMPTY_NP)
  }
  function handleClose() { reset(); onClose() }

  /** Sélectionne un patient existant proposé par la détection de doublons. */
  function utiliserPatientExistant(id: string, label: string) {
    setMode('search'); setSearch(label); setPatient(id)
  }

  function handleMotifManualConfirm() {
    const lib = manualMotifLib.trim()
    if (!lib) return
    // Code auto-généré : 6 premières lettres sans accents
    const code = lib.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6) || 'AUTRE'
    createMotif.mutate(
      { libelle: lib, code },
      {
        onSuccess: (newMotif) => {
          setSelectedMotif({ id: newMotif.id, libelle: newMotif.libelle })
          setShowManualMotif(false)
          setManualMotifLib('')
        },
      },
    )
  }

  async function handleSubmit() {
    setError(null)
    if (!valid) {
      setError(t('triage.patientMotifRequis'))
      return
    }
    try {
      // siteId est injecté côté serveur depuis le JWT.
      let pid = patientId
      // Nouveau patient : on crée d'abord le dossier (automatiquement, au triage),
      // puis on ouvre la visite sur ce dossier fraîchement créé.
      if (mode === 'create') {
        const created = await createPatient.mutateAsync({
          nom:                np.nom.trim(),
          prenom:             np.prenom.trim(),
          dateNaissance:      np.dateNaissance,
          sexe:               np.sexe as 'M' | 'F',
          categoriePatientId: np.categorieId,
          siteCreationId:     mySiteId,
          // Données admin selon la catégorie (recueil §5)
          ...(npIsCdiCdd ? {
            matricule:   np.matricule.trim()   || undefined,
            fonction:    np.fonction.trim()    || undefined,
            sectionPaie: np.sectionPaie.trim() || undefined,
            service:     np.service.trim()     || undefined,
            departement: np.departement.trim() || undefined,
          } : {}),
          ...(npAyant ? {
            fonction:     np.fonction.trim()     || undefined,
            cdiMatricule: np.cdiMatricule.trim() || undefined,
            typeLien:     np.typeLien || undefined,
            // CDI inconnu au registre → on l'enregistre à la volée.
            ...(!employeReconnu ? {
              nouvelEmploye: {
                nom:         np.cdiNom.trim(),
                prenom:      np.cdiPrenom.trim(),
                fonction:    np.cdiFonction.trim()    || undefined,
                sectionPaie: np.cdiSectionPaie.trim() || undefined,
                service:     np.cdiService.trim()     || undefined,
                departement: np.cdiDepartement.trim() || undefined,
              },
            } : {}),
          } : {}),
          ...(npSousTrait ? { societeId: np.societeId || undefined } : {}),
        })
        pid = created.id
      }
      // Création minimale : patient + motif. Constantes / notes / décisions se font
      // ensuite dans VisiteDetail (vers où l'on bascule via onCreated).
      const visite = await create.mutateAsync({
        patientId:        pid,
        motifPrincipalId: motifId,
      })
      reset()
      onCreated?.(visite.id)
      onClose()
    } catch (err) {
      // Le message serveur précis (ex. « visite déjà ouverte ») est déjà affiché en toast
      // par le hook ; l'encadré inline reste un repli générique.
      setError(err instanceof ApiError ? err.serverMessage : t('triage.erreurCreation'))
    }
  }

  const submitting = create.isPending || createPatient.isPending

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
      background: 'var(--fond-page)', overflow: 'hidden',
    }}>
        {/* ── En-tête ────────────────────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          padding: 'var(--espace-4) var(--espace-6)',
          borderBottom: '1px solid var(--bordure-legere)',
          flexShrink: 0,
          display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 'var(--espace-3)',
          textAlign: 'left', background: 'var(--fond-surface)',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--radius-lg)',
            background: 'var(--ap-50)', color: 'var(--ap-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <HeartPulse size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
            <p style={{
              margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700,
              color: 'var(--texte-primaire)', lineHeight: 1.25,
            }}>
              {t('triage.drawerTitle')}
            </p>
            <p style={{
              margin: '3px 0 0', fontSize: 'var(--font-size-caption)',
              color: 'var(--texte-tertiaire)', lineHeight: 1.4,
            }}>
              {t('triage.drawerSubtitleStart')}
            </p>
          </div>
          <button
            aria-label={t('triage.fermerPanneau')}
            onClick={handleClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'transparent', border: 'none', padding: 6,
              borderRadius: 'var(--radius-md)', color: 'var(--texte-tertiaire)',
              cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--fond-surface-2)'; e.currentTarget.style.color = 'var(--texte-primaire)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Contenu scrollable : Patient + Motif sur UN écran ──────────── */}
        <div
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 'var(--espace-5) var(--espace-6)', display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 760, margin: '0 auto', boxSizing: 'border-box' }}
        >

          {/* ── Patient ───────────────────────────────────────────────────── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: 'var(--ap-50)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <UserSearch size={12} style={{ color: 'var(--ap-600)' }} />
              </div>
              <Label style={{ ...lbl, fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)' }}>
                {t('triage.patientRequired')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
              </Label>
            </div>

            {/* Mode CRÉATION : nouveau dossier (créé automatiquement au triage) */}
            {mode === 'create' ? (
              <>
                <NewPatientForm
                  np={np}
                  setNp={setNp}
                  categories={categoriesActives}
                  societes={societes.filter((s: { statut: string }) => s.statut === 'ACTIVE')}
                  employeReconnu={employeReconnu}
                  employeNom={employeTrouve ? `${employeTrouve.prenom} ${employeTrouve.nom}` : null}
                  lookupLoading={lookupLoading}
                  onBack={() => { setMode('search'); setNp(EMPTY_NP) }}
                />
                {similaires.length > 0 && (
                  <div style={{
                    marginTop: 12, padding: '10px 12px', borderRadius: 8,
                    background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <AlertTriangle size={14} style={{ color: 'var(--avert-accent)', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--avert-texte)' }}>
                        {t('triage.dossiersSimilaires', { count: similaires.length })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {similaires.map(s => (
                        <button
                          key={s.id} type="button"
                          onClick={() => utiliserPatientExistant(s.id, s.identite ? `${s.identite.prenom} ${s.identite.nom}` : s.numeroPatient)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '7px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                            background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--texte-primaire)' }}>
                              {s.identite ? `${s.identite.prenom} ${s.identite.nom}` : s.numeroPatient}
                            </span>
                            <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--texte-tertiaire)' }}>{s.numeroPatient}</span>
                              {s.identite && <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)' }}>· {t('triage.ageAns', { age: calcAge(s.identite.dateNaissance) })}</span>}
                              {s.correspondanceDate && <span style={{ fontSize: '10px', color: 'var(--avert-texte)', fontWeight: 600 }}>{t('triage.memeDateNaissance')}</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ap-600)', flexShrink: 0 }}>{t('triage.utiliser')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : selectedPatient ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--ap-50)', border: '1px solid var(--ap-200)',
              }}>
                {selectedPatient.identite ? (
                  <PatientAvatar
                    nom={selectedPatient.identite.nom}
                    prenom={selectedPatient.identite.prenom}
                    code={selectedPatient.categoriePatient.code}
                    size={40}
                    photoUrl={selectedPatient.identite.photoUrl}
                  />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--fond-surface-2)' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0 }}>
                    {selectedPatient.identite
                      ? `${selectedPatient.identite.prenom} ${selectedPatient.identite.nom}`
                      : selectedPatient.numeroPatient}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontFamily: 'monospace' }}>
                      {selectedPatient.numeroPatient}
                    </span>
                    {selectedPatient.identite && (
                      <>
                        <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>·</span>
                        <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
                          {t('triage.ageAns', { age: calcAge(selectedPatient.identite.dateNaissance) })}
                        </span>
                      </>
                    )}
                    <CategorieBadge
                      code={selectedPatient.categoriePatient.code}
                      libelle={selectedPatient.categoriePatient.libelle}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setPatient(''); setSearch('') }}
                  style={{
                    width: 26, height: 26, borderRadius: 6, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--texte-tertiaire)',
                  }}
                  title={t('triage.changerPatient')}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                {/* Recherche */}
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--texte-tertiaire)', pointerEvents: 'none',
                  }} />
                  <Input
                    type="text"
                    placeholder={t('triage.searchPatientPlaceholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                    style={{
                      paddingLeft: 32, paddingRight: 12, height: 36,
                      fontSize: '13px', background: 'var(--fond-surface)',
                      border: '1px solid var(--bordure-normale)', borderRadius: 6,
                    }}
                  />
                </div>

                {/* Résultats */}
                {search.length >= 2 && (
                  <div style={{
                    marginTop: 6,
                    border: '1px solid var(--bordure-legere)', borderRadius: 8,
                    overflow: 'hidden', background: 'var(--fond-surface)',
                    maxHeight: 320, overflowY: 'auto',
                    boxShadow: 'var(--ombre-1)',
                  }}>
                    {searching ? (
                      <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--texte-tertiaire)', textAlign: 'center' }}>
                        {t('triage.recherche')}
                      </div>
                    ) : allPatients.length === 0 ? (
                      <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--texte-tertiaire)', textAlign: 'center' }}>
                        {t('triage.aucunPatientTrouve', { search })}
                      </div>
                    ) : (
                      allPatients.slice(0, 12).map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPatient(p.id)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', background: 'transparent', cursor: 'pointer',
                            border: 'none',
                            borderBottom: i < Math.min(allPatients.length, 12) - 1 ? '1px solid var(--bordure-legere)' : 'none',
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--fond-surface-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {p.identite && (
                            <PatientAvatar
                              nom={p.identite.nom}
                              prenom={p.identite.prenom}
                              code={p.categoriePatient.code}
                              size={32}
                              photoUrl={p.identite.photoUrl}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.identite ? `${p.identite.prenom} ${p.identite.nom}` : '—'}
                            </p>
                            <p style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', margin: '2px 0 0', fontFamily: 'monospace' }}>
                              {p.numeroPatient}
                            </p>
                          </div>
                          <CategorieBadge
                            code={p.categoriePatient.code}
                            libelle={p.categoriePatient.libelle}
                          />
                        </button>
                      ))
                    )}
                  </div>
                )}

                {search.length > 0 && search.length < 2 && (
                  <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: '6px 0 0', fontStyle: 'italic' }}>
                    {t('triage.tapeAuMoins2')}
                  </p>
                )}

                {/* Patient introuvable → créer son dossier directement au triage */}
                {canCreatePatient && (
                  <button
                    type="button"
                    onClick={() => { setMode('create'); setPatient(''); setSearch('') }}
                    style={{
                      marginTop: 12, width: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                      background: 'var(--fond-surface-2)', color: 'var(--ap-700)',
                      border: '1px dashed var(--ap-300)', fontSize: '12px', fontWeight: 600,
                    }}
                  >
                    <UserPlus size={14} /> {t('triage.creerDossier')}
                  </button>
                )}
              </>
            )}
          </section>

          {/* ── Motif ─────────────────────────────────────────────────────── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: 'var(--ap-50)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={12} style={{ color: 'var(--ap-600)' }} />
              </div>
              <Label style={{ ...lbl, fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)' }}>
                {t('triage.motifPrincipalRequired')} <span style={{ color: 'var(--erreur-texte)' }}>*</span>
              </Label>
            </div>

            {/* Motif sélectionné (référentiel ou manuel) */}
            {selectedMotif ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                background: 'var(--ap-50)', border: '1px solid var(--ap-200)',
              }}>
                <FileText size={13} style={{ color: 'var(--ap-600)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: 'var(--texte-primaire)' }}>
                  {selectedMotif.libelle}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMotif(null)}
                  style={{ width: 22, height: 22, borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={13} />
                </button>
              </div>
            ) : showManualMotif ? (
              /* Mode saisie manuelle */
              <div style={{
                border: '1px solid var(--ap-300)', borderRadius: 8,
                background: 'var(--fond-surface)', padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <PenLine size={11} style={{ color: 'var(--ap-600)' }} />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ap-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('triage.nouveauMotif')}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', marginLeft: 'auto' }}>
                    {t('triage.ajouteAuReferentiel')}
                  </span>
                </div>
                <input
                  type="text"
                  value={manualMotifLib}
                  onChange={e => setManualMotifLib(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleMotifManualConfirm() } }}
                  placeholder={t('triage.motifManuelPlaceholder')}
                  autoFocus
                  style={{
                    height: 34, padding: '0 10px', fontSize: '12px',
                    borderRadius: 6, border: '1px solid var(--bordure-normale)',
                    background: 'var(--fond-surface-2)', color: 'var(--texte-primaire)',
                    outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setShowManualMotif(false); setManualMotifLib('') }}
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: '11px', background: 'transparent', color: 'var(--texte-secondaire)', border: '1px solid var(--bordure-normale)', cursor: 'pointer' }}
                  >
                    {t('triage.retourFleche')}
                  </button>
                  <button
                    type="button"
                    onClick={handleMotifManualConfirm}
                    disabled={!manualMotifLib.trim() || createMotif.isPending}
                    style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: '11px', fontWeight: '600',
                      background: 'var(--ap-500)', color: '#fff', border: 'none',
                      cursor: !manualMotifLib.trim() ? 'not-allowed' : 'pointer',
                      opacity: !manualMotifLib.trim() ? 0.5 : 1,
                    }}
                  >
                    {createMotif.isPending ? t('triage.creation') : t('triage.confirmer')}
                  </button>
                </div>
              </div>
            ) : (
              /* Sélection depuis le référentiel */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SelectBox
                  size="md"
                  fullWidth
                  value={motifId}
                  onChange={id => {
                    const m = actifsMotifs.find(m => m.id === id)
                    if (m) setSelectedMotif({ id: m.id, libelle: m.libelle })
                  }}
                  placeholder={t('triage.selectionnerMotifPlaceholder')}
                  aria-label={t('triage.motifPrincipalLabel')}
                  options={actifsMotifs.map(m => ({ value: m.id, label: m.libelle }))}
                />
                {canCreateMotif && (
                  <button
                    type="button"
                    onClick={() => setShowManualMotif(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: '11px', color: 'var(--ap-600)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 0', alignSelf: 'flex-start',
                    }}
                  >
                    <PenLine size={11} />
                    {t('triage.motifNonTrouve')}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Indication : la suite du triage se fait dans le dossier de la visite */}
          <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: 0, fontStyle: 'italic' }}>
            {t('triage.suiteDansVisite')}
          </p>

          {/* Erreur de soumission */}
          {submitError && (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--erreur-fond)', border: '1px solid var(--erreur-bordure)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertCircle size={14} style={{ color: 'var(--erreur-accent)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '12px', color: 'var(--erreur-texte)', margin: 0 }}>{submitError}</p>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: 'var(--espace-3) var(--espace-6)',
          borderTop: '1px solid var(--bordure-legere)',
          display: 'flex', justifyContent: 'space-between', gap: 'var(--espace-2)',
          flexShrink: 0,
          background: 'var(--fond-surface)',
        }}>
          <SButton type="button" variant="secondary" size="sm" onClick={handleClose} disabled={submitting}>
            {t('triage.annuler')}
          </SButton>
          <SButton
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<Stethoscope size={14} />}
            loading={submitting}
            disabled={!valid || submitting}
            onClick={handleSubmit}
            style={{ minWidth: 160 }}
          >
            {t('triage.demarrerTriage')}
          </SButton>
        </div>
    </div>
  )
}

// ── Mini-formulaire « nouveau dossier » intégré au triage ──────────────────────

function NewPatientForm({ np, setNp, categories, societes, employeReconnu, employeNom, lookupLoading, onBack }: {
  np:         NewPatient
  setNp:      React.Dispatch<React.SetStateAction<NewPatient>>
  categories: { id: string; code: string; libelle: string }[]
  societes:   { id: string; nom: string }[]
  employeReconnu: boolean
  employeNom:     string | null
  lookupLoading:  boolean
  onBack:     () => void
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const cols2 = isCompact ? '1fr' : '1fr 1fr'
  const patch = (p: Partial<NewPatient>) => setNp(prev => ({ ...prev, ...p }))
  const code        = categories.find(c => c.id === np.categorieId)?.code
  const isCdiCdd    = code === 'ASSURE_CDI' || code === 'ASSURE_CDD'
  const isAyantDroit = code === 'AYANT_DROIT_CDI'
  const isSousTrait  = code === 'SOUS_TRAITANT'
  const LIENS = [
    { value: 'CONJOINT', label: t('patients.lienConjoint', { defaultValue: 'Conjoint(e)' }) },
    { value: 'ENFANT',   label: t('patients.lienEnfant',   { defaultValue: 'Enfant' }) },
    { value: 'PARENT',   label: t('patients.lienParent',   { defaultValue: 'Parent' }) },
    { value: 'AUTRE',    label: t('patients.lienAutre',    { defaultValue: 'Autre' }) },
  ]
  const baseInput = {
    height: 36, padding: '0 10px', fontSize: '13px', width: '100%', boxSizing: 'border-box' as const,
    borderRadius: 6, background: 'var(--fond-surface)', color: 'var(--texte-primaire)', outline: 'none',
  }
  const errInput = (invalid: boolean) => ({
    ...baseInput,
    border: `1px solid ${invalid ? 'var(--erreur-accent)' : 'var(--bordure-normale)'}`,
  })
  const errText = { fontSize: '10px', color: 'var(--erreur-texte)', fontWeight: 500, margin: '3px 0 0' }

  // Erreurs affichées uniquement si le champ est rempli (ne pas crier sur un champ vide).
  const prenomErr = np.prenom.trim() !== '' && !nomValide(np.prenom) ? t('triage.lettresUniquement') : null
  const nomErr    = np.nom.trim()    !== '' && !nomValide(np.nom)    ? t('triage.lettresUniquement') : null
  const dateErr   = np.dateNaissance !== '' && !dateNaissanceValide(np.dateNaissance) ? t('triage.dateIncoherente') : null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: '12px', borderRadius: 8,
      border: '1px solid var(--ap-200)', background: 'var(--ap-50)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <UserPlus size={13} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ap-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('triage.nouveauDossierPatient')}
        </span>
        <button type="button" onClick={onBack} style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--ap-600)', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <ChevronLeft size={12} /> {t('triage.rechercheLabel')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 10 }}>
        <div>
          <Label style={{ ...lbl, fontSize: '12px' }}>{t('triage.prenom')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
          <input value={np.prenom} maxLength={100} onChange={e => patch({ prenom: e.target.value })} placeholder={t('triage.prenomPlaceholder')} style={errInput(!!prenomErr)} autoFocus />
          {prenomErr && <p style={errText}>{prenomErr}</p>}
        </div>
        <div>
          <Label style={{ ...lbl, fontSize: '12px' }}>{t('triage.nom')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
          <input value={np.nom} maxLength={100} onChange={e => patch({ nom: e.target.value })} placeholder={t('triage.nomPlaceholder')} style={errInput(!!nomErr)} />
          {nomErr && <p style={errText}>{nomErr}</p>}
        </div>
        <div>
          <Label style={{ ...lbl, fontSize: '12px' }}>{t('triage.naissance')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
          <input type="date" value={np.dateNaissance} min={minBirthISO()} max={todayISO()} onChange={e => patch({ dateNaissance: e.target.value })} style={errInput(!!dateErr)} />
          {dateErr && <p style={errText}>{dateErr}</p>}
        </div>
        <div>
          <Label style={{ ...lbl, fontSize: '12px' }}>{t('triage.sexe')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['M', 'F'] as const).map(s => (
              <button
                key={s} type="button" onClick={() => patch({ sexe: s })}
                style={{
                  flex: 1, height: 36, borderRadius: 6, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: np.sexe === s ? 'var(--ap-500)' : 'var(--fond-surface)',
                  color:      np.sexe === s ? '#fff' : 'var(--texte-secondaire)',
                  border:     np.sexe === s ? '1.5px solid var(--ap-500)' : '1px solid var(--bordure-normale)',
                }}
              >
                {s === 'M' ? t('triage.sexeMasculin') : t('triage.sexeFeminin')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label style={{ ...lbl, fontSize: '12px' }}>{t('triage.categorie')} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
        <SelectBox
          size="md"
          fullWidth
          value={np.categorieId}
          onChange={id => patch({ categorieId: id })}
          placeholder={t('triage.selectionnerCategorie')}
          aria-label={t('triage.categorie')}
          options={categories.map(c => ({ value: c.id, label: c.libelle }))}
        />
      </div>

      {/* CDI / CDD : matricule + fonction + section + service + département (recueil §5, obligatoires) */}
      {isCdiCdd && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 10 }}>
            <div>
              <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldMatriculeCdi', { defaultValue: 'Matricule' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <input value={np.matricule} maxLength={50} onChange={e => patch({ matricule: e.target.value })} placeholder={t('triage.matriculePlaceholder')} style={errInput(false)} />
            </div>
            <div>
              <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldFonction', { defaultValue: 'Fonction' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <input value={np.fonction} maxLength={100} onChange={e => patch({ fonction: e.target.value })} style={errInput(false)} />
            </div>
            <div>
              <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldSectionPaie', { defaultValue: 'Section de paie' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <input value={np.sectionPaie} maxLength={100} onChange={e => patch({ sectionPaie: e.target.value })} style={errInput(false)} />
            </div>
            <div>
              <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldService', { defaultValue: 'Service' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <input value={np.service} maxLength={100} onChange={e => patch({ service: e.target.value })} style={errInput(false)} />
            </div>
          </div>
          <div>
            <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldDepartement', { defaultValue: 'Département' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
            <input value={np.departement} maxLength={100} onChange={e => patch({ departement: e.target.value })} style={errInput(false)} />
          </div>
        </>
      )}

      {/* Ayant droit CDI : reconnaissance du CDI par matricule (recueil §5) */}
      {isAyantDroit && (() => {
        const mat = np.cdiMatricule.trim()
        const cdiInconnu = mat.length >= 3 && !lookupLoading && !employeReconnu
        return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 10 }}>
            <div>
              <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldCdiMatricule', { defaultValue: 'Matricule du CDI rattaché' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <input value={np.cdiMatricule} maxLength={50} onChange={e => patch({ cdiMatricule: e.target.value })} placeholder={t('patients.cdiMatriculePlaceholder', { defaultValue: 'Matricule du travailleur CDI' })} style={errInput(false)} />
              {mat.length >= 3 && (
                lookupLoading
                  ? <p style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', margin: '3px 0 0' }}>{t('employes.checking', { defaultValue: 'Vérification…' })}</p>
                  : employeReconnu
                    ? <p style={{ fontSize: '10px', color: 'var(--succes-texte)', fontWeight: 600, margin: '3px 0 0' }}>✓ {t('employes.recognized', { defaultValue: 'CDI reconnu' })}{employeNom ? ` : ${employeNom}` : ''}</p>
                    : <p style={{ fontSize: '10px', color: 'var(--avert-texte)', fontWeight: 600, margin: '3px 0 0' }}>{t('employes.unknown', { defaultValue: 'Matricule inconnu — enregistrez le travailleur ci-dessous' })}</p>
              )}
            </div>
            <div>
              <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldLien', { defaultValue: 'Lien de parenté' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
              <SelectBox size="md" fullWidth value={np.typeLien} onChange={v => patch({ typeLien: v })} placeholder={t('triage.selectionnerCategorie')} aria-label={t('patients.fieldLien', { defaultValue: 'Lien de parenté' })} options={LIENS} />
            </div>
          </div>
          <div>
            <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldFonction', { defaultValue: 'Fonction' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
            <input value={np.fonction} maxLength={100} onChange={e => patch({ fonction: e.target.value })} style={errInput(false)} />
          </div>

          {/* CDI inconnu → enregistrement du travailleur au registre (recueil §5) */}
          {cdiInconnu && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px dashed var(--bordure-normale)', paddingTop: 10 }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ap-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('employes.registerWorker', { defaultValue: 'Enregistrer le travailleur CDI' })}
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 10 }}>
                <div>
                  <Label style={{ ...lbl, fontSize: '12px' }}>{t('triage.nom', { defaultValue: 'Nom' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                  <input value={np.cdiNom} maxLength={100} onChange={e => patch({ cdiNom: e.target.value })} style={errInput(false)} />
                </div>
                <div>
                  <Label style={{ ...lbl, fontSize: '12px' }}>{t('triage.prenom', { defaultValue: 'Prénom' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
                  <input value={np.cdiPrenom} maxLength={100} onChange={e => patch({ cdiPrenom: e.target.value })} style={errInput(false)} />
                </div>
                <div>
                  <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldFonction', { defaultValue: 'Fonction' })}</Label>
                  <input value={np.cdiFonction} maxLength={100} onChange={e => patch({ cdiFonction: e.target.value })} style={errInput(false)} />
                </div>
                <div>
                  <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldSectionPaie', { defaultValue: 'Section de paie' })}</Label>
                  <input value={np.cdiSectionPaie} maxLength={100} onChange={e => patch({ cdiSectionPaie: e.target.value })} style={errInput(false)} />
                </div>
                <div>
                  <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldService', { defaultValue: 'Service' })}</Label>
                  <input value={np.cdiService} maxLength={100} onChange={e => patch({ cdiService: e.target.value })} style={errInput(false)} />
                </div>
                <div>
                  <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldDepartement', { defaultValue: 'Département' })}</Label>
                  <input value={np.cdiDepartement} maxLength={100} onChange={e => patch({ cdiDepartement: e.target.value })} style={errInput(false)} />
                </div>
              </div>
            </div>
          )}

          <p style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', margin: 0, fontStyle: 'italic' }}>
            {t('patients.ayantDroitHint', { defaultValue: 'Section de paie, service et département sont hérités du CDI rattaché.' })}
          </p>
        </>
        )
      })()}

      {/* Sous-traitant : société (recueil §5) */}
      {isSousTrait && (
        <div>
          <Label style={{ ...lbl, fontSize: '12px' }}>{t('patients.fieldSociete', { defaultValue: 'Société' })} <span style={{ color: 'var(--erreur-texte)' }}>*</span></Label>
          <SelectBox size="md" fullWidth value={np.societeId} onChange={v => patch({ societeId: v })} placeholder={t('patients.selectPlaceholder', { defaultValue: 'Sélectionner…' })} aria-label={t('patients.fieldSociete', { defaultValue: 'Société' })} options={societes.map(s => ({ value: s.id, label: s.nom }))} />
        </div>
      )}

      <p style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', margin: 0, fontStyle: 'italic' }}>
        {t('triage.dossierComplete')}
      </p>
    </div>
  )
}
