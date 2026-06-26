/**
 * ReferentielsPage — Module 2 · Données de référence CMS SARIS
 *
 * Page à onglets (6 entités) avec :
 *  - indicateur d'onglet actif (bordure bleue inférieure)
 *  - compteurs live sur chaque onglet
 *  - toolbar fixe (ne défile pas)
 *  - tableau avec pagination dynamique
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent } from '@workspace/ui/components/tabs'
import { Database } from 'lucide-react'
import { SegmentedTabs } from '@/components/saris'
import { useSites, useMotifs, usePathologies, useMedicaments, useCategoriesPatient, useTypesExamen, useTypesConsultation } from '../hooks/useReferentiels'
import { useSousTraitants } from '../hooks/useSousTraitants'
import { useEmployes } from '../hooks/useEmployes'
import { isActif } from '../api/referentiels.api'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { SitesTab }       from '../tabs/SitesTab'
import { MotifsTab }      from '../tabs/MotifsTab'
import { PathologiesTab } from '../tabs/PathologiesTab'
import { MedicamentsTab } from '../tabs/MedicamentsTab'
import { CategoriesTab }  from '../tabs/CategoriesTab'
import { ExamensTab }     from '../tabs/ExamensTab'
import { TypesConsultationTab } from '../tabs/TypesConsultationTab'
import { SousTraitantsTab }     from '../tabs/SousTraitantsTab'
import { EmployesTab }          from '../tabs/EmployesTab'

// ── Page principale ────────────────────────────────────────────────────────────

export function ReferentielsPage() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const isCompact = useIsCompact()
  // GRANULARITÉ PAR SERVICE : chaque onglet (site, motif, pathologie…) a ses
  // propres permissions create/update/delete. On peut ainsi accorder la création
  // de motifs SANS donner accès aux sites. Le backend applique exactement la
  // même séparation (referentiel.<service>.<action>).
  const PERM = {
    sites:       { canCreate: has('referentiel.site.create'),       canUpdate: has('referentiel.site.update'),       canDelete: has('referentiel.site.delete') },
    motifs:      { canCreate: has('referentiel.motif.create'),      canUpdate: has('referentiel.motif.update'),      canDelete: has('referentiel.motif.delete') },
    pathologies: { canCreate: has('referentiel.pathologie.create'), canUpdate: has('referentiel.pathologie.update'), canDelete: has('referentiel.pathologie.delete') },
    medicaments: { canCreate: has('referentiel.medicament.create'), canUpdate: has('referentiel.medicament.update'), canDelete: has('referentiel.medicament.delete') },
    categories:  { canCreate: has('referentiel.categorie.create'),  canUpdate: has('referentiel.categorie.update'),  canDelete: has('referentiel.categorie.delete') },
    examens:     { canCreate: has('referentiel.examen.create'),     canUpdate: has('referentiel.examen.update'),     canDelete: has('referentiel.examen.delete') },
    typesConsultation: { canCreate: has('referentiel.type_consultation.create'), canUpdate: has('referentiel.type_consultation.update'), canDelete: has('referentiel.type_consultation.delete') },
    sousTraitants:     { canCreate: has('sous_traitant.create'),                 canUpdate: has('sous_traitant.update'),                 canDelete: has('sous_traitant.delete') },
    employes:          { canCreate: has('employe.create'),                       canUpdate: has('employe.update'),                       canDelete: has('employe.delete') },
  } as const

  // Prefetch de tous les référentiels → compteurs live + cache chaud pour chaque tab
  const { data: sites       } = useSites()
  const { data: motifs      } = useMotifs()
  const { data: pathologies } = usePathologies()
  const { data: medicaments } = useMedicaments()
  const { data: categories  } = useCategoriesPatient()
  const { data: examens     } = useTypesExamen()
  const { data: typesConsultation } = useTypesConsultation()
  const { data: sousTraitants } = useSousTraitants()
  const { data: employes      } = useEmployes()

  const counts = {
    sites:       sites?.filter(s => isActif(s.statut)).length,
    motifs:      motifs?.filter(m => isActif(m.statut)).length,
    pathologies: pathologies?.filter(p => isActif(p.statut)).length,
    medicaments: medicaments?.filter(m => isActif(m.statut)).length,
    categories:  categories?.filter(c => isActif(c.statut)).length,
    examens:     examens?.filter(e => isActif(e.statut)).length,
    typesConsultation: typesConsultation?.filter(e => isActif(e.statut)).length,
    sousTraitants:     sousTraitants?.filter(s => isActif(s.statut)).length,
    employes:          employes?.filter(e => isActif(e.statut)).length,
  }

  const TABS = [
    { value: 'sites',       label: t('referentiels.tabSites'),        count: counts.sites,        Component: SitesTab       },
    { value: 'motifs',      label: t('referentiels.tabMotifs'),       count: counts.motifs,       Component: MotifsTab      },
    { value: 'pathologies', label: t('referentiels.tabPathologies'),  count: counts.pathologies,  Component: PathologiesTab  },
    { value: 'medicaments', label: t('referentiels.tabMedicaments'),  count: counts.medicaments,  Component: MedicamentsTab  },
    { value: 'categories',  label: t('referentiels.tabCategories'),   count: counts.categories,   Component: CategoriesTab  },
    { value: 'examens',     label: t('referentiels.tabExamens'),      count: counts.examens,      Component: ExamensTab     },
    { value: 'typesConsultation', label: t('referentiels.tabTypesConsultation', { defaultValue: 'Types consultation' }), count: counts.typesConsultation, Component: TypesConsultationTab },
    { value: 'sousTraitants',     label: t('referentiels.tabSousTraitants', { defaultValue: 'Sous-traitants' }),         count: counts.sousTraitants,     Component: SousTraitantsTab },
    { value: 'employes',          label: t('referentiels.tabEmployes', { defaultValue: 'Registre employé' }),           count: counts.employes,          Component: EmployesTab },
  ] as const

  const [tab, setTab] = useState<string>('sites')

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

        {/* ── En-tête de page ─────────────────────────────────────────────── */}
        <div style={{ padding: 'var(--espace-4) var(--espace-6) 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'var(--ap-50)', flexShrink: 0, marginTop: '2px',
            }}>
              <Database size={16} style={{ color: 'var(--ap-600)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-h2)', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0, lineHeight: '1.3' }}>
                {t('referentiels.pageTitle')}
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
                {t('referentiels.pageSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* ── Onglets ─────────────────────────────────────────────────────── */}
        <Tabs
          value={tab}
          onValueChange={setTab}
          style={{ flex: '1', display: 'flex', flexDirection: 'column', minHeight: 0, padding: isCompact ? '0 12px' : '0 32px' }}
        >
          {/* Strip des onglets (pills SARIS) — défile horizontalement sur petit écran (6 onglets nowrap) */}
          <div style={{
            padding: 'var(--espace-4) 0 var(--espace-3)',
            borderBottom: '1px solid var(--bordure-legere)',
            flexShrink: 0,
            overflowX: isCompact ? 'auto' : undefined,
          }}>
            <SegmentedTabs
              value={tab}
              onChange={setTab}
              tabs={TABS.map(t => ({ key: t.value, label: t.label, badge: t.count }))}
            />
          </div>

          {/* Contenus des onglets — flex column pour que le toolbar soit fixe */}
          {TABS.map(({ value, Component }) => (
            <TabsContent
              key={value}
              value={value}
              style={{
                flex:          '1',
                display:       'flex',
                flexDirection: 'column',
                overflow:      'hidden',
                minHeight:     0,
                marginTop:     0,
              }}
            >
              <Component {...PERM[value]} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  )
}
