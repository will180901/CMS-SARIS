/**
 * VoletsRapport — le rapport parle enfin du CENTRE, pas seulement des consultations.
 *
 * Le rapport ne lisait qu'une table de la base : `Consultation`. Il ignorait donc combien
 * de personnes étaient réellement passées au centre, combien de dossiers avaient été
 * ouverts, ce qui avait été prescrit, et qui restait à suivre. Pour un centre médical
 * d'entreprise, ce sont exactement les questions qu'on pose.
 *
 * Cinq volets, dans l'ordre où on se les pose :
 *   1. ACTIVITÉ         — combien de passages, et combien ont donné lieu à un acte
 *   2. SANTÉ AU TRAVAIL — accidents, jours d'arrêt prescrits, certificats
 *   3. POPULATION       — qui est suivi, et depuis quand
 *   4. PHARMACIE/EXAMENS— ce qui est prescrit, donc consommé et budgété
 *   5. SUIVI & RISQUES  — ce qui reste ouvert, donc ce qui demande de l'attention
 *
 * Distinction tenue partout : un FLUX se compte sur la période, un ÉTAT se constate à la
 * date du rapport. Les mélanger ferait dire n'importe quoi aux chiffres.
 */
import { useTranslation } from 'react-i18next'
import type { ContenuRapport } from '../api/rapports.api'

interface Indicateur {
  label: string
  valeur: string | number
  hint?: string
}

function Volet({ titre, items }: { titre: string; items: Indicateur[] }) {
  if (!items.length) return null
  return (
    <div>
      <p style={{
        margin: '0 0 10px', fontSize: 'var(--font-size-overline)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)',
      }}>
        {titre}
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'var(--espace-3)',
      }}>
        {items.map(it => (
          <div key={it.label} style={{
            padding: 'var(--espace-3)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--fond-surface)',
            border: '1px solid var(--bordure-legere)',
          }}>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--texte-tertiaire)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {it.label}
            </p>
            <p style={{
              margin: '4px 0 0', fontSize: 'var(--font-size-h3)', fontWeight: 700,
              color: 'var(--texte-primaire)', lineHeight: 1.15,
            }}>
              {it.valeur}
            </p>
            {it.hint && (
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--texte-tertiaire)' }}>
                {it.hint}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function VoletsRapport({ contenu }: { contenu: ContenuRapport }) {
  const { t } = useTranslation()
  const v = contenu.volets
  // Rapport généré avant cette évolution : on n'affiche rien plutôt que des zéros, qui se
  // liraient comme « aucune activité » alors que la donnée n'a jamais été calculée.
  if (!v) return null

  const consultations = contenu.totalConsultations
  const visites = v.activite.visites
  // Part des visites ayant donné lieu à un acte médical. Calculée ici et non stockée : la
  // donnée source est déjà présente, la dupliquer créerait deux vérités.
  const tauxPassage = visites > 0 ? Math.round((consultations / visites) * 100) : null

  const at = contenu.parType.find(x => /accident/i.test(x.libelle))?.count ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-5)' }}>
      <Volet
        titre={t('rapports.voletActivite')}
        items={[
          { label: t('rapports.kpiVisites'), valeur: visites, hint: t('rapports.kpiVisitesHint') },
          { label: t('rapports.kpiConsultations'), valeur: consultations },
          ...(tauxPassage !== null
            ? [{ label: t('rapports.kpiTauxPassage'), valeur: `${tauxPassage} %`, hint: t('rapports.kpiTauxPassageHint') }]
            : []),
          { label: t('rapports.kpiEvacuations'), valeur: v.activite.evacuations, hint: t('rapports.kpiEvacuationsHint') },
        ]}
      />

      <Volet
        titre={t('rapports.voletSanteTravail')}
        items={[
          { label: t('rapports.kpiAccidents'), valeur: at, hint: t('rapports.kpiAccidentsHint') },
          { label: t('rapports.kpiJoursArret'), valeur: contenu.repos.totalJours, hint: t('rapports.kpiJoursArretHint') },
          { label: t('rapports.kpiCertificats'), valeur: v.santeTravail.certificats },
        ]}
      />

      <Volet
        titre={t('rapports.voletPopulation')}
        items={[
          { label: t('rapports.kpiNouveauxDossiers'), valeur: v.population.nouveauxDossiers, hint: t('rapports.kpiNouveauxDossiersHint') },
          { label: t('rapports.kpiDossiersActifs'), valeur: v.population.dossiersActifs, hint: t('rapports.kpiEtatHint') },
        ]}
      />

      <Volet
        titre={t('rapports.voletPharmacie')}
        items={[
          { label: t('rapports.kpiOrdonnances'), valeur: v.pharmacieExamens.ordonnances },
          { label: t('rapports.kpiBonsExamen'), valeur: v.pharmacieExamens.bonsExamen },
          { label: t('rapports.kpiResultats'), valeur: v.pharmacieExamens.resultatsRecus, hint: t('rapports.kpiResultatsHint') },
        ]}
      />

      <Volet
        titre={t('rapports.voletSuivi')}
        items={[
          { label: t('rapports.kpiChroniques'), valeur: v.suiviRisques.suivisChroniques, hint: t('rapports.kpiEtatHint') },
          { label: t('rapports.kpiGrossesses'), valeur: v.suiviRisques.grossessesSuivies, hint: t('rapports.kpiEtatHint') },
          { label: t('rapports.kpiAlertes'), valeur: v.suiviRisques.alertesActives, hint: t('rapports.kpiAlertesHint') },
        ]}
      />
    </div>
  )
}
