; ─────────────────────────────────────────────────────────────────────────────
; installer.nsh — inclusion NSIS personnalisée pour electron-builder (MODE LOCAL).
; Référencée par electron-builder.local.yml (nsis.include).
;
; ⚠️ RECONSTRUIT le 2026-06-29 : la version d'origine vivait dans `build/` (NON suivie
;    par git) et a été perdue lors d'un nettoyage des artefacts. Elle est désormais
;    placée ICI, dans un dossier SUIVI par git → plus aucune perte possible.
;
; Rôle : garantir que l'application ET son backend embarqué (processus enfant `node`)
; sont bien arrêtés avant l'installation / la désinstallation. Sans cela, une mise à
; jour par-dessus une version en cours d'exécution peut échouer (fichiers verrouillés).
; Le `/T` termine l'arbre de processus (donc le backend embarqué lancé par l'app).
; ─────────────────────────────────────────────────────────────────────────────

!macro customInstall
  ; Arrêt défensif de toute instance résiduelle avant la copie des fichiers.
  nsExec::Exec 'taskkill /F /IM "CMS SARIS.exe" /T'
  Pop $0
!macroend

!macro customUnInstall
  ; Idem à la désinstallation, pour libérer les fichiers du dossier d'installation.
  nsExec::Exec 'taskkill /F /IM "CMS SARIS.exe" /T'
  Pop $0
!macroend
