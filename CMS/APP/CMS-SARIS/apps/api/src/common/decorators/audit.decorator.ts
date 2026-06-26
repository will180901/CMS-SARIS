import { SetMetadata } from '@nestjs/common'

/**
 * @Audit('patient', 'Patient') — marque un controller (ou une route) dont les
 * MUTATIONS (POST/PATCH/PUT/DELETE) doivent être journalisées dans journal_audit
 * par AuditInterceptor : qui, quoi, quand, depuis quelle IP, succès/erreur.
 *
 * À NE PAS poser sur les services qui s'auto-auditent déjà (utilisateurs, rôles,
 * paramètres, sécurité) → éviter le double enregistrement. Réservé aux modules
 * cliniques / configuration sans audit explicite.
 */
export interface AuditMeta { module: string; entiteType?: string }
export const AUDIT_KEY = 'audit_meta'
export const Audit = (module: string, entiteType?: string) =>
  SetMetadata(AUDIT_KEY, { module, entiteType } as AuditMeta)
