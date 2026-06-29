; ─────────────────────────────────────────────────────────────────────────────
; installer.nsh — inclusion NSIS personnalisée pour electron-builder (MODE LOCAL).
; Référencée par electron-builder.local.yml (nsis.include). SUIVIE par git.
;
; Comportement « intelligent » installateur ⇄ désinstalleur :
;
;  1) MISE À JOUR. À l'exécution de l'installateur, si une version est déjà installée,
;     electron-builder lit la clé de registre de désinstallation de l'app (écrite par
;     l'install précédente) et lance d'abord SON désinstalleur en mode SILENCIEUX (/S),
;     PUIS installe la nouvelle version. C'est le canal de « communication » entre les
;     deux. On renforce ici en arrêtant tout processus résiduel (app + backend embarqué
;     = arbre /T) pour éviter les fichiers verrouillés pendant l'opération.
;
;  2) DÉSINSTALLATION MANUELLE. On arrête les processus, electron-builder retire les
;     fichiers + les données (deleteAppDataOnUninstall), puis on affiche une
;     NOTIFICATION claire confirmant le retrait complet.
;     ⚠️ Cette notification ne s'affiche QUE pour une désinstallation interactive
;     (${IfNot} ${Silent}) : pendant une mise à jour, le désinstalleur tourne en /S,
;     donc aucun popup parasite n'apparaît.
; ─────────────────────────────────────────────────────────────────────────────

; .onInit de l'INSTALLATEUR : tuer toute instance avant install / upgrade-uninstall.
!macro customInit
  nsExec::Exec 'taskkill /F /IM "CMS SARIS.exe" /T'
  Pop $0
!macroend

!macro customInstall
  nsExec::Exec 'taskkill /F /IM "CMS SARIS.exe" /T'
  Pop $0
!macroend

; .onInit du DÉSINSTALLEUR : libérer les fichiers avant suppression.
!macro customUnInit
  nsExec::Exec 'taskkill /F /IM "CMS SARIS.exe" /T'
  Pop $0
!macroend

; Fin de la DÉSINSTALLATION : confirmer le retrait complet (hors mode silencieux/MAJ).
!macro customUnInstall
  nsExec::Exec 'taskkill /F /IM "CMS SARIS.exe" /T'
  Pop $0
  ${IfNot} ${Silent}
    MessageBox MB_OK|MB_ICONINFORMATION "CMS SARIS a été entièrement désinstallé de votre ordinateur.$\r$\n$\r$\nTous les fichiers et données de l'application ont été retirés."
  ${EndIf}
!macroend
