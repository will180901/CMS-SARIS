/**
 * Configuration de navigation — basée sur les PERMISSIONS granulaires
 * (et plus seulement sur les rôles).
 *
 * Charte de gouvernance (3 rôles, modèle du recueil) :
 *   - ADMIN_SYSTEME : administration + audit + supervision système (PAS de clinique)
 *   - MEDECIN_CHEF  : clinique complète + gouvernance médicale (référentiels, personnel, audit)
 *   - INFIRMIER     : triage / constantes (prescription uniquement si délégué)
 */

import {
  LayoutDashboard,
  HeartPulse,
  Users,
  ClipboardList,
  AlertTriangle,
  BookOpen,
  MessageSquare,
} from 'lucide-react'
import type { LucideIcon }     from 'lucide-react'
import type { PermissionCode, Role } from '@cms-saris/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavItem {
  key:   string
  label: string
  icon:  LucideIcon
  href:  string
  /** Permissions requises (mode ANY : au moins une suffit). Vide = accessible à tous. */
  permissions: PermissionCode[]
  /** Description courte pour les tooltips et les écrans d'aide */
  description?: string
}

export interface NavGroup {
  key:   string
  label: string
  items: NavItem[]
}

// ── Groupes de navigation ─────────────────────────────────────────────────────

export const NAV_GROUPS: NavGroup[] = [
  {
    key:   'clinique',
    label: 'Clinique',
    items: [
      {
        key:         'dashboard',
        label:       'Tableau de bord',
        icon:        LayoutDashboard,
        href:        '/dashboard',
        permissions: ['dashboard.read'],
        description: 'Vue d\'ensemble de l\'activité du centre',
      },
      {
        key:         'triage',
        label:       'Triage',
        icon:        HeartPulse,
        href:        '/triage',
        permissions: ['visite.read'],
        description: 'File d\'attente et prise en charge initiale',
      },
      {
        key:         'patients',
        label:       'Patients',
        icon:        Users,
        href:        '/patients',
        permissions: ['patient.read'],
        description: 'Registre des dossiers patients',
      },
      {
        key:         'consultations',
        label:       'Consultations',
        icon:        ClipboardList,
        href:        '/consultations',
        permissions: ['consultation.read'],
        description: 'Consultations cliniques et prescriptions',
      },
      {
        key:         'sorties',
        label:       'Évacuations',
        icon:        AlertTriangle,
        href:        '/sorties-critiques',
        permissions: ['evacuation.read'],
        description: 'Évacuations médicales décidées en consultation',
      },
      {
        key:         'messagerie',
        label:       'Messagerie',
        icon:        MessageSquare,
        href:        '/messagerie',
        permissions: ['messagerie.read'],
        description: 'Messagerie interne chiffrée entre agents',
      },
    ],
  },
  {
    key:   'administration_medicale',
    label: 'Administration médicale',
    items: [
      {
        key:         'referentiels',
        label:       'Référentiels',
        icon:        BookOpen,
        href:        '/referentiels',
        permissions: ['referentiel.read'],
        description: 'Sites, motifs, pathologies, médicaments, examens, catégories, sous-traitants…',
      },
    ],
  },
  // « Administration système » (Accès & habilitations, Journaux d'audit) et « Système »
  // (Synchronisation) ne sont plus des groupes séparés de la sidebar : ces 3 pages restent
  // pleinement fonctionnelles à leurs routes (/admin/acces, /admin/audit, /synchronisation)
  // mais sont désormais accessibles via des raccourcis dans Paramètres > Généraux (cf.
  // ParametresPage.tsx), pour désencombrer le menu principal.
]

// ── Labels & couleurs des rôles ───────────────────────────────────────────────

export const ROLE_META: Record<Role, { label: string; bg: string; text: string }> = {
  ADMIN_SYSTEME: { label: 'Admin Système',  bg: '#EDE9FE', text: '#5B21B6' },
  MEDECIN_CHEF:  { label: 'Médecin Chef',   bg: '#D1FAE5', text: '#065F46' },
  INFIRMIER:     { label: 'Infirmier(ère)', bg: '#E0F2FE', text: '#0369A1' },
}

/** Ordre de priorité d'affichage — retourne le rôle le plus élevé */
const ROLE_PRIORITY: Role[] = [
  'ADMIN_SYSTEME', 'MEDECIN_CHEF', 'INFIRMIER',
]

export function getPrimaryRole(roles: Role[]): Role {
  return ROLE_PRIORITY.find(r => roles.includes(r)) ?? roles[0]
}
