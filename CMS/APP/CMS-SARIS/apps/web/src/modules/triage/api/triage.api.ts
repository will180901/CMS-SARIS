/**
 * triage.api.ts — Couche d'accès API pour le module Accueil & Triage
 */

import { api } from '@/lib/api'
import type { VisiteListItem, VisiteDetail, ConstanteVitale } from '@cms-saris/types'

// ── Payload types ─────────────────────────────────────────────────────────────

export interface ConstantesPayload {
  temperature?:        number
  tensionSystolique?:  number
  tensionDiastolique?: number
  frequenceCardiaque?: number
  frequenceRespiratoire?: number
  saturationO2?:       number
  poids?:              number
  taille?:             number
  glycemie?:           number
  // Signes généraux (modèle Jeannette)
  etatConscience?:     string
  scoreGlasgow?:       number
  etatGeneral?:        string
  hydratation?:        string
  coloration?:         string
}

export interface CreateVisitePayload {
  patientId:        string
  motifPrincipalId: string
  soignantId?:      string
  notesAccueil?:    string
  constantes?:      ConstantesPayload
}

// Même forme que ConstantesPayload (source de vérité unique) — alias pour éviter la divergence.
export type ConstanteVitalePayload = ConstantesPayload

export interface VisiteQueryParams {
  statut?: string
}

/** Historique par pages (onglets « Clôturées » et « Annulées »). */
export interface VisiteHistoriqueParams {
  statut:      'CLOTUREE' | 'ANNULEE'
  /** Mots cherchés par le serveur, sur tout l'historique : patient, numéro, motif. */
  search?:     string
  soignantId?: string
  motifId?:    string
  /** Dernière visite reçue : la page demandée commence juste après. */
  curseur?:    string
  limite?:     number
}

export interface VisiteHistoriquePage {
  data:           VisiteListItem[]
  /** Visites correspondant aux filtres — donné sur la 1re page seulement (`null` ensuite). */
  total:          number | null
  /** À passer en `curseur` pour la page suivante ; `null` à la fin. */
  curseurSuivant: string | null
}

export interface VisitePatientItem {
  id:             string
  dateOuverture:  string
  statut:         string
  typeCloture:    string | null
  motifPrincipal: { libelle: string } | null
  site?:          { libelle: string } | null
  consultations:  { id: string; statut: string }[]
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface UpdateStatutPayload {
  statut:           string
  motifAnnulation?: string
  commentaire?:     string
}

export const triageApi = {
  // Liste
  list: (params?: VisiteQueryParams) =>
    api.get<VisiteListItem[]>('/triage/visites', params as Record<string, string>),

  // Historique par pages (clôturées / annulées)
  historique: (params: VisiteHistoriqueParams) =>
    api.get<VisiteHistoriquePage>('/triage/visites/historique', params as unknown as Record<string, string>),

  // Détail
  findById: (id: string) =>
    api.get<VisiteDetail>(`/triage/visites/${id}`),

  // Visites d'un patient (dossier)
  visitesByPatient: (patientId: string) =>
    api.get<VisitePatientItem[]>(`/triage/visites/patient/${patientId}`),

  // Ouverture
  create: (data: CreateVisitePayload) =>
    api.post<VisiteDetail>('/triage/visites', data),

  // Statut
  updateStatut: (id: string, payload: UpdateStatutPayload) =>
    api.patch<VisiteDetail>(`/triage/visites/${id}/statut`, payload),

  // Soignant
  updateSoignant: (id: string, soignantId: string | null, motif?: string) =>
    api.patch<VisiteDetail>(`/triage/visites/${id}/soignant`, { soignantId, motif }),

  // Notes d'accueil
  updateNotes: (id: string, notesAccueil: string | null) =>
    api.patch<VisiteDetail>(`/triage/visites/${id}/notes`, { notesAccueil }),

  // Constantes
  createConstantes: (id: string, data: ConstanteVitalePayload) =>
    api.post<ConstanteVitale>(`/triage/visites/${id}/constantes`, data),

  // Suppression définitive (visite.delete)
  remove: (id: string) =>
    api.delete<{ deleted: boolean }>(`/triage/visites/${id}`),
}
