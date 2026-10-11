import { Injectable } from '@nestjs/common'

/**
 * Le portier des envois : empêche qu'un lot d'un poste, déjà accepté mais pas encore appliqué, ne
 * s'écrive APRÈS un vidage et ne ressuscite des lignes que l'on vient d'effacer.
 *
 * Le serveur refuse déjà (423) les envois d'un poste dont le vidage n'est pas accusé ; mais un lot
 * accepté une seconde avant le vidage peut très bien finir de s'écrire une seconde après. Tout envoi
 * passe donc par ici : il entre (et compte) tant que le vidage n'a pas commencé, il est refusé
 * pendant que le vidage s'exécute, et le vidage attend que les envois en route soient finis.
 *
 * Un seul processus serveur est supposé (c'est le cas du déploiement) ; entre plusieurs, c'est la
 * demande inscrite sur chaque poste qui protège.
 */
@Injectable()
export class PortierVidage {
  private enRoute = 0
  private ferme = false
  private vides: (() => void)[] = []

  /** Un envoi veut entrer. Faux si un vidage est en cours : il doit être refusé. */
  entrer(): boolean {
    if (this.ferme) return false
    this.enRoute++
    return true
  }

  /** L'envoi est fini (réussi ou non). */
  sortir(): void {
    this.enRoute = Math.max(0, this.enRoute - 1)
    if (this.enRoute === 0) {
      const attentes = this.vides
      this.vides = []
      for (const reveille of attentes) reveille()
    }
  }

  /** Les envois en route. */
  get envoisEnRoute(): number {
    return this.enRoute
  }

  get estFerme(): boolean {
    return this.ferme
  }

  /**
   * Ferme la porte aux nouveaux envois et attend la fin de ceux en route.
   * Vrai si la porte est fermée ET plus rien n'est en route ; faux si des envois n'ont pas fini à
   * temps — la porte est alors rouverte, rien n'a été fait.
   */
  async fermer(delaiMs: number): Promise<boolean> {
    if (this.ferme) return false
    this.ferme = true
    if (this.enRoute === 0) return true
    const fini = await new Promise<boolean>((resolve) => {
      const minuterie = setTimeout(() => {
        this.vides = this.vides.filter((f) => f !== reveil)
        resolve(false)
      }, delaiMs)
      const reveil = () => {
        clearTimeout(minuterie)
        resolve(true)
      }
      this.vides.push(reveil)
    })
    if (!fini) this.ferme = false
    return fini
  }

  rouvrir(): void {
    this.ferme = false
  }
}
