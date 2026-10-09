/** « Centre Médico-Social Nkayi » → « Nkayi », « CMS Moutela » → « Moutela ». */
export function nomCourtSite(libelle: string): string {
  return libelle.replace(/^(Centre Médico-Social|CMS)\s+/i, '')
}
