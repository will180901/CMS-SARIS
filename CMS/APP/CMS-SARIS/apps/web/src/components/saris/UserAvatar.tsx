/**
 * UserAvatar — avatar d'un utilisateur SYSTÈME (compte `Utilisateur`), cliquable.
 *
 * Contrairement à `Avatar` (purement présentatif), celui-ci résout LUI-MÊME la vraie
 * photo de profil de l'utilisateur via l'annuaire partagé (`useAnnuaire`, mis en cache),
 * pour que la photo apparaisse partout où cet utilisateur est représenté (audit,
 * messagerie, listes de comptes…) sans avoir à faire porter `photoUrl` par chaque
 * endpoint métier. Cliquer dessus ouvre une fenêtre affichant la photo en grand — même
 * repli propre (grandes initiales) si l'utilisateur n'a pas encore de photo.
 *
 * Le déclencheur est un `<span role="button">` (jamais un `<button>`) : plusieurs pages
 * affichent déjà une rangée entière cliquable (ex. tableau d'audit = `<button>` par ligne)
 * — imbriquer un vrai `<button>` dedans serait invalide en HTML. `stopPropagation` évite
 * aussi de déclencher le clic de la rangée englobante.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from 'lucide-react'
import { Avatar } from './Avatar'
import { Modal } from './Modal'
import { useAnnuaire } from '@/modules/admin/hooks/useAdmin'
import { humanizeCode } from '@/config/labels'

interface UserAvatarProps {
  /** Identifiant du compte `Utilisateur` (PAS un personnelMedicalId). */
  userId:  string
  /** Repli si l'annuaire n'est pas encore chargé ou si l'utilisateur y est introuvable. */
  nom:     string
  prenom?: string
  size?:   number
  tone?:   'auto' | 'accent' | 'gold' | 'neutral'
  /**
   * Passer `false` dans un contexte où le clic a déjà un sens PRIMAIRE incompatible
   * (ex. une ligne de sélection @mention ou de contact, où cliquer choisit ce contact) :
   * la vraie photo s'affiche quand même (perpétuité), sans ouvrir la fenêtre d'agrandissement.
   */
  clickable?: boolean
}

export function UserAvatar({ userId, nom, prenom, size = 32, tone = 'auto', clickable = true }: UserAvatarProps) {
  const { t } = useTranslation()
  const { data: annuaire } = useAnnuaire()
  const entry = annuaire?.find(u => u.id === userId)

  const photoUrl      = entry?.photoUrl ?? null
  const displayNom     = entry?.nom ?? nom
  const displayPrenom  = entry?.prenom ?? prenom ?? undefined
  const fullName       = [displayPrenom, displayNom].filter(Boolean).join(' ')
  const [open, setOpen] = useState(false)

  if (!clickable) {
    return <Avatar nom={displayNom} prenom={displayPrenom} size={size} tone={tone} photoUrl={photoUrl} />
  }

  function reveal(e: React.SyntheticEvent) {
    e.stopPropagation()
    setOpen(true)
  }
  // Le déclencheur est parfois imbriqué dans un élément cliquable ancestral (bouton
  // de menu, ligne de tableau…). stopPropagation sur le seul `click` ne suffit pas
  // toujours : certains composants (ex. Radix Popover/DismissableLayer) réagissent
  // dès `pointerdown`/`mousedown`, avant même que le `click` ne se déclenche.
  function stop(e: React.SyntheticEvent) { e.stopPropagation() }

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={t('common.viewPhoto', { name: fullName })}
        onPointerDown={stop}
        onMouseDown={stop}
        onClick={reveal}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(e) } }}
        style={{
          display: 'inline-flex', cursor: 'pointer', flexShrink: 0,
          borderRadius: size > 40 ? 'var(--radius-lg)' : 'var(--radius-md)',
        }}
      >
        <Avatar nom={displayNom} prenom={displayPrenom} size={size} tone={tone} photoUrl={photoUrl} />
      </span>
      {open && (
        <AvatarPhotoModal
          nom={displayNom} prenom={displayPrenom}
          role={entry?.role ? humanizeCode(entry.role) : undefined}
          photoUrl={photoUrl}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function AvatarPhotoModal({ nom, prenom, role, photoUrl, onClose }: {
  nom: string; prenom?: string; role?: string; photoUrl: string | null; onClose: () => void
}) {
  const { t } = useTranslation()
  const fullName = [prenom, nom].filter(Boolean).join(' ')
  return (
    <Modal icon={<User size={18} />} title={fullName} subtitle={role} width={360} onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--espace-3) 0' }}>
        {photoUrl ? (
          <img
            src={photoUrl} alt={fullName}
            style={{ width: 240, height: 240, borderRadius: 'var(--radius-xl)', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--espace-3)' }}>
            <Avatar nom={nom} prenom={prenom} size={160} tone="accent" />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--texte-tertiaire)' }}>{t('common.noProfilePhoto')}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
