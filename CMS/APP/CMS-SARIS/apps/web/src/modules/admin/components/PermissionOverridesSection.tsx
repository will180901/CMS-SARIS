/**
 * PermissionOverridesSection — onglet « Permissions » du tiroir utilisateur :
 * dérogations individuelles (GRANT/REVOKE par permission, par-dessus les rôles).
 *
 * Complète l'attribution par rôle (onglet Rôles & accès) : un administrateur
 * peut ACCORDER une permission absente du rôle, ou RÉVOQUER une permission
 * normalement héritée, pour CE compte précis uniquement (`UtilisateurPermission`,
 * backend déjà prêt — `GET/PUT /admin/utilisateurs/:id/permissions`). Cas
 * d'usage type : accorder `utilisateur.create` + `utilisateur.read` à un
 * MEDECIN_CHEF pour qu'il puisse créer/gérer des comptes sur les deux sites
 * (cf. UtilisateursController#hasCrossSiteAccess côté backend).
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, RotateCcw } from 'lucide-react'
import { Button, TextInput } from '@/components/saris'
import { useUserPermissions, useSetUserPermissions, usePermissions as useAdminPermissionCatalog } from '../hooks/useAdmin'
import { buildPermissionTree, labelPermAction } from '@/config/permission-tree'
import { labelPermission } from '@/config/labels'
import type { PermissionCode } from '@cms-saris/types'

interface Props {
  utilisateurId: string
  isSelf: boolean
}

export function PermissionOverridesSection({ utilisateurId, isSelf }: Props) {
  const { t } = useTranslation()
  const { data: breakdown } = useUserPermissions(utilisateurId)
  const { data: catalog = [] } = useAdminPermissionCatalog()
  const setPerms = useSetUserPermissions(utilisateurId)

  const [search, setSearch]   = useState('')
  const [grants, setGrants]   = useState<Set<PermissionCode> | null>(null)
  const [revokes, setRevokes] = useState<Set<PermissionCode> | null>(null)

  // État local initialisé paresseusement à la première frappe (avant ça, on
  // affiche directement les données serveur — pas de bouton « Modifier »
  // séparé : chaque puce se clique directement, comme la matrice de rôle.
  const grantSet  = grants  ?? new Set(breakdown?.grants.map(g => g.code) ?? [])
  const revokeSet = revokes ?? new Set(breakdown?.revokes.map(r => r.code) ?? [])
  const dirty = grants !== null || revokes !== null

  const fromRoles = useMemo(() => new Set(breakdown?.fromRoles ?? []), [breakdown])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter(p =>
      labelPermission(p.code, p.libelle).toLowerCase().includes(q)
      || p.module.toLowerCase().includes(q),
    )
  }, [catalog, search])

  const tree = useMemo(() => buildPermissionTree(filtered), [filtered])

  function isGranted(code: PermissionCode)  { return grantSet.has(code) }
  function isRevoked(code: PermissionCode)  { return revokeSet.has(code) }
  function isEffective(code: PermissionCode) {
    if (isRevoked(code)) return false
    if (isGranted(code)) return true
    return fromRoles.has(code)
  }

  /** Clic sur une puce : comportement contextuel selon l'état actuel. */
  function handleClick(code: PermissionCode) {
    const inherited = fromRoles.has(code)
    if (isGranted(code)) {
      // Accordé individuellement → retire l'octroi (retour à « non accordé »)
      const n = new Set(grantSet); n.delete(code); setGrants(n)
    } else if (isRevoked(code)) {
      // Révoqué → rétablit (retour à hérité du rôle)
      const n = new Set(revokeSet); n.delete(code); setRevokes(n)
    } else if (inherited) {
      // Hérité du rôle, sans dérogation → révoque pour ce compte
      const n = new Set(revokeSet); n.add(code); setRevokes(n)
      const g = new Set(grantSet); g.delete(code); setGrants(g)
    } else {
      // Non accordé du tout → accorde individuellement
      const n = new Set(grantSet); n.add(code); setGrants(n)
      const r = new Set(revokeSet); r.delete(code); setRevokes(r)
    }
  }

  async function handleSave() {
    await setPerms.mutateAsync({ grants: [...grantSet], revokes: [...revokeSet] })
    setGrants(null); setRevokes(null)
  }
  function handleReset() { setGrants(null); setRevokes(null) }

  const effectiveCount = catalog.filter(p => isEffective(p.code)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
      {/* Barre de résumé + actions — collante, comme l'onglet Rôles */}
      <div style={{
        position: 'sticky', top: 'calc(-1 * var(--espace-5))', zIndex: 2,
        marginTop: 'calc(-1 * var(--espace-5))',
        marginLeft: 'calc(-1 * var(--espace-6))', marginRight: 'calc(-1 * var(--espace-6))',
        padding: 'var(--espace-4) var(--espace-6) var(--espace-3)',
        background: 'var(--fond-surface)',
        borderBottom: '1px solid var(--bordure-legere)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--espace-2)',
      }}>
        <div style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
          <strong style={{ color: 'var(--texte-primaire)' }}>{effectiveCount}</strong>{' '}
          {effectiveCount > 1 ? t('admin.effectivePermissionsPlural') : t('admin.effectivePermissionsSingular')}
          {(grantSet.size > 0 || revokeSet.size > 0) && (
            <>
              {' · '}
              {grantSet.size > 0 && <span>{grantSet.size} {t('admin.grantedShort')}</span>}
              {grantSet.size > 0 && revokeSet.size > 0 && ', '}
              {revokeSet.size > 0 && <span>{revokeSet.size} {t('admin.revokedShort')}</span>}
            </>
          )}
        </div>
        {dirty && (
          <div style={{ display: 'flex', gap: 'var(--espace-2)' }}>
            <Button variant="ghost" size="sm" leftIcon={<RotateCcw size={12} />} onClick={handleReset}>
              {t('admin.cancel')}
            </Button>
            <Button variant="primary" size="sm" loading={setPerms.isPending} onClick={handleSave}>
              {t('admin.save')}
            </Button>
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
        {t('admin.overridesNotePart1')} <strong style={{ color: 'var(--texte-secondaire)' }}>{t('admin.overridesNoteStrong')}</strong> {t('admin.overridesNotePart2')}
        {isSelf && <><br />{t('admin.overridesNoteSelf')}</>}
      </p>

      <TextInput
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder={t('admin.filterPermission')}
      />

      {tree.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
          {t('admin.noPermissionMatch', { search })}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
          {tree.map(node => (
            <div key={node.module}>
              <p style={{ margin: '0 0 6px', fontSize: 'var(--font-size-caption)', fontWeight: 700, color: 'var(--texte-secondaire)' }}>
                {node.label}
              </p>
              {node.subgroups.map(sg => (
                <div key={sg.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: sg.sub ? 12 : 0, marginBottom: 4 }}>
                  {sg.leaves.map(leaf => {
                    const inherited = fromRoles.has(leaf.code)
                    const granted   = isGranted(leaf.code)
                    const revoked   = isRevoked(leaf.code)
                    const title = granted ? t('admin.clickToRemoveGrant')
                      : revoked ? t('admin.clickToRestore')
                      : inherited ? t('admin.clickToRevoke')
                      : t('admin.clickToGrant')
                    return (
                      <button
                        key={leaf.code}
                        type="button"
                        onClick={() => handleClick(leaf.code)}
                        title={`${labelPermission(leaf.code)} — ${title}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-caption)', fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.12s',
                          background: granted ? 'var(--succes-fond)' : revoked ? 'var(--erreur-fond)' : (inherited ? 'var(--ap-50)' : 'var(--fond-surface-2)'),
                          color:      granted ? 'var(--succes-texte)' : revoked ? 'var(--erreur-texte)' : (inherited ? 'var(--ap-700)' : 'var(--texte-secondaire)'),
                          border: `1px solid ${granted ? 'var(--succes-accent)' : revoked ? 'var(--erreur-accent)' : (inherited ? 'var(--ap-300)' : 'var(--bordure-legere)')}`,
                        }}
                      >
                        {granted && <Check size={11} />}
                        {revoked && <X size={11} />}
                        {labelPermAction(leaf.action)}
                        {inherited && !granted && !revoked && (
                          <span style={{ fontSize: 10, opacity: 0.75 }}>{t('admin.inheritedSuffix')}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
