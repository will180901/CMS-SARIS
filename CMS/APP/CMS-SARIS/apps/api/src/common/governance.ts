/**
 * Permissions de gouvernance « vitales » : un administrateur ne peut pas se les
 * retirer à lui-même (ni au dernier admin système actif) — sinon plus personne ne
 * pourrait administrer la plateforme (seule issue : intervention SQL hors app).
 *
 * SOURCE UNIQUE partagée par :
 *   - roles.service      (édition de la matrice d'un rôle que l'acteur possède)
 *   - utilisateurs.service (dérogations REVOKE sur soi-même / dernier admin)
 *
 * (Typé `string[]` volontairement : pas de value-import de @cms-saris/types côté API.)
 */
export const VITAL_GOVERNANCE_PERMISSIONS: string[] = [
  'role.read', 'role.create', 'role.update', 'role.delete',
  'utilisateur.read', 'utilisateur.create', 'utilisateur.update',
  'utilisateur.assign_role', 'utilisateur.reset_password', 'utilisateur.manage_permissions',
]
