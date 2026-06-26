import { IsIn, IsNotEmpty } from 'class-validator'

/**
 * DTO dédié au toggle ACTIF/INACTIF d'une entité de référentiel.
 *
 * SÉCURITÉ : route /:type/:id/statut gated par `referentiel.delete` (et NON
 * `referentiel.update`). Le champ `statut` est ainsi retiré des DTOs Update
 * pour empêcher qu'un utilisateur ayant seulement `referentiel.update` puisse
 * désactiver un élément en envoyant un PATCH classique avec statut.
 *
 * Les pathologies et catégories patient utilisent l'enum ACTIVE/INACTIVE,
 * les autres entités utilisent ACTIF/INACTIF. On accepte les 4 valeurs côté
 * DTO et c'est le service qui choisit la bonne forme selon l'entité.
 */
export class ToggleStatutReferentielDto {
  @IsNotEmpty()
  @IsIn(['ACTIF', 'INACTIF', 'ACTIVE', 'INACTIVE'])
  statut: 'ACTIF' | 'INACTIF' | 'ACTIVE' | 'INACTIVE'
}
