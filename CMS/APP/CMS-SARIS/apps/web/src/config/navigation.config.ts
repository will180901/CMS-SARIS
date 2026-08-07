/**
 * Configuration de navigation — basée sur les PERMISSIONS granulaires
 * (et plus seulement sur les rôles).
 *
 * Ce qu'un utilisateur voit ici découle UNIQUEMENT de ses permissions effectives :
 * aucune entrée n'est réservée à un rôle en dur, et un groupe vide disparaît. Une
 * permission accordée ou retirée depuis « Accès & habilitations » se répercute donc
 * immédiatement sur ce menu, y compris pour un rôle personnalisé.
 *
 * Fonctions livrées avec le système (ce ne sont que les valeurs PAR DÉFAUT des rôles,
 * modifiables depuis la matrice de permissions) :
 *   - ADMIN_SYSTEME : super-administrateur — catalogue COMPLET, clinique comprise.
 *       Choix assumé : il pilote et supervise l'ensemble de la plateforme. Ne pas lui
 *       re-retirer le clinique (décision prise, puis confirmée).
 *   - MEDECIN_CHEF  : clinique complète + gouvernance médicale (référentiels, personnel,
 *       accès & habilitations, audit) — mais ni paramètres système ni synchronisation.
 *   - INFIRMIER     : triage / constantes / accueil (prescription uniquement si délégué),
 *       sans aucune entrée du groupe Administration.
 */

import {
  LayoutDashboard,
  HeartPulse,
  Users,
  ClipboardList,
  BookOpen,
  MessageSquare,
  FileBarChart,
  ShieldCheck,
  SlidersHorizontal,
  History,
  RefreshCw,
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
    key:   'espace_travail',
    label: 'Espace de travail',
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
        key:         'rapports',
        label:       'Rapports',
        icon:        FileBarChart,
        href:        '/rapports',
        // `rapport.read` et non `consultation.read` : c'est ce qu'exige réellement
        // le serveur (RapportsController). Avec l'ancienne valeur, une personne
        // privée de `rapport.read` voyait l'entrée puis se heurtait à un 403.
        permissions: ['rapport.read'],
        description: 'Rapports statistiques générés automatiquement (hebdo/mensuel/annuel)',
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
        // « Dossiers médicaux » et non « Patients » : TOUTE personne connue du centre a un
        // dossier — employé, ayant droit, sous-traitant, riverain — y compris en bonne
        // santé. Le dossier est créé dès l'enregistrement de la personne, bien avant
        // qu'elle ne devienne patiente. (Libellé affiché : cf. `nav.patients` en i18n.)
        label:       'Dossiers médicaux',
        icon:        Users,
        href:        '/patients',
        permissions: ['patient.read'],
        description: 'Dossiers de toutes les personnes suivies par le centre',
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
  // Administration : pages de gouvernance et de configuration SYSTÈME, remontées ici
  // (elles n'étaient plus atteignables que par des raccourcis dans Paramètres > Généraux).
  // Chaque entrée porte SA permission réelle : useNavigation filtre item par item et
  // supprime le groupe s'il devient vide → un infirmier ne voit pas ce groupe du tout.
  // Les paramètres PERSONNELS (préférences, 2FA, sessions) restent hors de ce groupe :
  // ils sont en self-service pour tout le monde, via le menu utilisateur du pied de page.
  {
    key:   'administration',
    label: 'Administration',
    items: [
      {
        key:         'acces',
        label:       'Accès & habilitations',
        icon:        ShieldCheck,
        href:        '/admin/acces',
        permissions: ['utilisateur.read', 'role.read', 'personnel.read', 'delegation.read'],
        description: 'Comptes, rôles & permissions, personnel soignant, délégations',
      },
      {
        key:         'parametresSysteme',
        label:       'Paramètres système',
        icon:        SlidersHorizontal,
        href:        '/admin/parametres-systeme',
        permissions: ['parametre.read'],
        description: 'Sécurité, politique de mot de passe, notifications',
      },
      {
        key:         'audit',
        label:       'Journaux d\'audit',
        icon:        History,
        href:        '/admin/audit',
        permissions: ['audit.read'],
        description: 'Traçabilité des actions et des authentifications',
      },
      {
        key:         'synchronisation',
        label:       'Synchronisation',
        icon:        RefreshCw,
        href:        '/synchronisation',
        permissions: ['synchronisation.read'],
        description: 'Postes locaux, sauvegardes et restauration',
      },
    ],
  },
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

// ── Poste de travail par défaut ───────────────────────────────────────────────

/**
 * Page sur laquelle une fonction arrive naturellement à la connexion.
 *
 * L'infirmier(ère) travaille à l'accueil : sa journée commence dans la file
 * d'attente, pas devant des statistiques. Le médecin chef et l'administrateur
 * ouvrent au contraire sur une vue d'ensemble.
 *
 * Ce n'est qu'un DÉFAUT : le choix explicite fait dans « Mes paramètres » prime
 * toujours, et une fonction absente de cette table garde le tableau de bord.
 * La page reste soumise aux permissions — un poste non autorisé est ignoré.
 */
export const ACCUEIL_PAR_ROLE: Partial<Record<Role, string>> = {
  INFIRMIER: 'triage',
}
