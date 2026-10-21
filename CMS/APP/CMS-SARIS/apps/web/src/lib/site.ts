/** « Centre Médico-Sanitaire Nkayi » → « Nkayi », « CMS Moutela » → « Moutela » (l'ancien « Médico-Social » reste compris). */
export function nomCourtSite(libelle: string): string {
  return libelle.replace(/^(Centre Médico-(?:Sanitaire|Social)|CMS)\s+/i, '')
}
