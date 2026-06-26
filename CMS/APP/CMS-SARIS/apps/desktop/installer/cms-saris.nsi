; ============================================================================
;  Installateur SUR-MESURE CMS SARIS (NSIS / MUI2)
;  Objectif : affichage TEMPS RÉEL des fichiers installés (un par un) dans la
;  zone de détails + DEUX barres de progression (globale + étape en cours),
;  ce qu'electron-builder interdit (SetDetailsPrint none + extraction 7z silencieuse).
;
;  Source = win-unpacked (produit par electron-builder, dossier non empaqueté).
;  Paramètres passés au build via /D : VERSION, SRCDIR, ASSETS, OUTFILE.
; ============================================================================
Unicode true
ManifestDPIAware true

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "FileFunc.nsh"

; Constantes Win32 (certaines déjà fournies par WinMessages.nsh → guardées).
!ifndef WS_CHILD_VISIBLE
  !define WS_CHILD_VISIBLE 0x50000000   ; WS_CHILD (0x40000000) | WS_VISIBLE (0x10000000)
!endif
!ifndef PBM_SETPOS
  !define PBM_SETPOS 0x402
!endif
!ifndef PBM_SETRANGE32
  !define PBM_SETRANGE32 0x406
!endif

!ifndef VERSION
  !define VERSION "1.4.0"
!endif
!ifndef SRCDIR
  !define SRCDIR "..\release\win-unpacked"
!endif
!ifndef ASSETS
  !define ASSETS "..\build"
!endif
!ifndef OUTFILE
  !define OUTFILE "..\release\CMS SARIS-Setup-${VERSION}.exe"
!endif

!define APP_NAME    "CMS SARIS"
!define PUBLISHER   "Deo Cherel BOUWAYI MIKOUYA - SARIS-CONGO"
!define EXE_NAME    "CMS SARIS.exe"
!define APP_ID      "cg.sariscongo.cms"
!define UNINST_KEY  "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
!define INSTALL_KEY "Software\${APP_ID}"

Name "${APP_NAME} ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\CMS SARIS"
InstallDirRegKey HKCU "${INSTALL_KEY}" "InstallLocation"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
SetCompressor /SOLID lzma
BrandingText "${APP_NAME} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "LegalCopyright" "(c) 2026 ${PUBLISHER}"
VIAddVersionKey "FileDescription" "${APP_NAME} - installateur"

Var SecondBar     ; handle de la 2e barre (étape) ; 0 si non créée
Var TotalSteps
Var CurStep

; ── Apparence MUI ──
!define MUI_ICON "${ASSETS}\icon.ico"
!define MUI_UNICON "${ASSETS}\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${ASSETS}\installerHeader.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEFINISHPAGE_BITMAP "${ASSETS}\installerSidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${ASSETS}\uninstallerSidebar.bmp"
!define MUI_ABORTWARNING

; Page d'installation : on accroche la création de la 2e barre à l'affichage.
!define MUI_PAGE_CUSTOMFUNCTION_SHOW InstFilesPageShow

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE_NAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer CMS SARIS"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "French"

; ── 2e barre de progression (étape en cours) ────────────────────────────────
; Créée dans la page d'install : on rétrécit la liste de détails par le haut et
; on insère une barre dans l'espace dégagé. Tout est GARDÉ (si un appel échoue,
; on continue sans 2e barre — l'install reste pleinement fonctionnel).
Function InstFilesPageShow
  StrCpy $SecondBar 0
  StrCpy $CurStep 0
  FindWindow $R0 "#32770" "" $HWNDPARENT
  ${If} $R0 == 0
    Return
  ${EndIf}
  GetDlgItem $R1 $R0 1004   ; barre native (globale)
  GetDlgItem $R2 $R0 1016   ; liste des détails
  ${If} $R1 == 0
  ${OrIf} $R2 == 0
    Return
  ${EndIf}
  ; RECT de la liste (coordonnées client du dialogue)
  System::Call "*(i,i,i,i) p.r3"
  System::Call "user32::GetWindowRect(p $R2, p r3)"
  System::Call "user32::MapWindowPoints(p 0, p $R0, p r3, i 2)"
  System::Call "*$3(i.r4, i.r5, i.r6, i.r7)"   ; r4=left r5=top r6=right r7=bottom
  System::Free $3
  IntOp $R8 $6 - $4        ; largeur
  IntOp $R9 $7 - $5        ; hauteur liste
  ; Rétrécir la liste par le haut de 20 px
  IntOp $5 $5 + 20
  IntOp $R9 $R9 - 20
  System::Call "user32::MoveWindow(p $R2, i $4, i $5, i $R8, i $R9, i 1)"
  ; Créer la 2e barre dans l'espace (4 px sous l'ancien top, hauteur 12)
  IntOp $6 $5 - 18
  System::Call "user32::CreateWindowEx(i 0, t 'msctls_progress32', t '', \
    i ${WS_CHILD_VISIBLE}, i $4, i $6, i $R8, i 12, p $R0, p 0, p 0, p 0) p.r1"
  ${If} $1 != 0
    StrCpy $SecondBar $1
    SendMessage $SecondBar ${PBM_SETRANGE32} 0 100
    SendMessage $SecondBar ${PBM_SETPOS} 0 0
  ${EndIf}
FunctionEnd

; Avance la 2e barre + affiche l'en-tête d'étape dans le journal temps réel.
!macro STEP TXT
  IntOp $CurStep $CurStep + 1
  DetailPrint ""
  DetailPrint "================  Etape $CurStep/$TotalSteps : ${TXT}  ================"
  ${If} $SecondBar != 0
    IntOp $0 $CurStep - 1
    IntOp $0 $0 * 100
    IntOp $0 $0 / $TotalSteps
    SendMessage $SecondBar ${PBM_SETPOS} $0 0
  ${EndIf}
!macroend
!macro STEP_DONE
  ${If} $SecondBar != 0
    IntOp $0 $CurStep * 100
    IntOp $0 $0 / $TotalSteps
    SendMessage $SecondBar ${PBM_SETPOS} $0 0
  ${EndIf}
!macroend

; ── .onInit : refus si l'app tourne + installateur 2-en-1 ────────────────────
Function .onInit
  StrCpy $TotalSteps 4
  ; App en cours d'exécution ? (mutex posé par Electron singleInstanceLock = appId)
  System::Call 'kernel32::OpenMutexW(i 0x100000, b 0, w "${APP_ID}") i .R9'
  ${If} $R9 <> 0
    System::Call 'kernel32::CloseHandle(i $R9)'
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "CMS SARIS est en cours d'execution.$\n$\nFermez completement l'application (barre des taches comprise) puis relancez l'installateur."
    ${EndIf}
    Abort
  ${EndIf}
  ; Déjà installé ? (sauf en mode silencieux = mise à jour auto → on réinstalle)
  ${IfNot} ${Silent}
    ReadRegStr $R0 HKCU "${UNINST_KEY}" "UninstallString"
    ${If} $R0 != ""
      MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "CMS SARIS est deja installe.$\n$\nOui = Desinstaller (suppression complete)$\nNon = Reinstaller / Mettre a jour$\nAnnuler = Quitter" IDYES sarisUninst IDNO +2
      Abort
      sarisUninst:
        ReadRegStr $R1 HKCU "${UNINST_KEY}" "QuietUninstallString"
        ${If} $R1 == ""
          StrCpy $R1 '"$R0" /S'
        ${EndIf}
        ExecWait '$R1'
        Abort
    ${EndIf}
  ${EndIf}
FunctionEnd

; Mise à jour AUTO (electron-updater) : lance l'installateur en silencieux avec
; --force-run → on relance l'application après l'installation.
Function .onInstSuccess
  ${GetParameters} $9
  ClearErrors
  ${GetOptions} $9 "--force-run" $8
  ${IfNot} ${Errors}
    Exec '"$INSTDIR\${EXE_NAME}"'
  ${EndIf}
FunctionEnd

; ============================================================================
;  SECTIONS (les 4 « parties » → font avancer la 2e barre + le journal)
; ============================================================================
Section "Application & interface" SEC_APP
  !insertmacro STEP "Application & interface (Electron + React)"
  SetOutPath "$INSTDIR"
  File /r /x resources "${SRCDIR}\*"
  SetOutPath "$INSTDIR\resources"
  File "${SRCDIR}\resources\app.asar"
  File "${SRCDIR}\resources\elevate.exe"
  File "${SRCDIR}\resources\app-update.yml"
  SetOutPath "$INSTDIR\resources\app.asar.unpacked"
  File /r "${SRCDIR}\resources\app.asar.unpacked\*"
  !insertmacro STEP_DONE
SectionEnd

Section "Service local (backend NestJS)" SEC_API
  !insertmacro STEP "Service local - backend NestJS embarque"
  SetOutPath "$INSTDIR\resources\api"
  File /r "${SRCDIR}\resources\api\*"
  !insertmacro STEP_DONE
SectionEnd

Section "Moteur de base de donnees (Prisma SQLite)" SEC_DB_ENGINE
  !insertmacro STEP "Moteur Prisma + client SQLite"
  SetOutPath "$INSTDIR\resources\sqlite-client"
  File /r "${SRCDIR}\resources\sqlite-client\*"
  !insertmacro STEP_DONE
SectionEnd

Section "Base locale + raccourcis" SEC_FINAL
  !insertmacro STEP "Base de donnees locale + raccourcis"
  SetOutPath "$INSTDIR\resources"
  File "${SRCDIR}\resources\seed.db"

  ; Raccourcis
  DetailPrint "Creation des raccourcis (Bureau + menu Demarrer)..."
  CreateShortCut "$DESKTOP\CMS SARIS.lnk" "$INSTDIR\${EXE_NAME}"
  CreateDirectory "$SMPROGRAMS\CMS SARIS"
  CreateShortCut "$SMPROGRAMS\CMS SARIS\CMS SARIS.lnk" "$INSTDIR\${EXE_NAME}"
  CreateShortCut "$SMPROGRAMS\CMS SARIS\Desinstaller CMS SARIS.lnk" "$INSTDIR\Uninstall CMS SARIS.exe"

  ; Registre (Programmes & fonctionnalites + 2-en-1 + repérage install)
  DetailPrint "Enregistrement dans Windows..."
  WriteRegStr   HKCU "${UNINST_KEY}" "DisplayName"     "${APP_NAME}"
  WriteRegStr   HKCU "${UNINST_KEY}" "DisplayVersion"  "${VERSION}"
  WriteRegStr   HKCU "${UNINST_KEY}" "Publisher"       "${PUBLISHER}"
  WriteRegStr   HKCU "${UNINST_KEY}" "DisplayIcon"     "$INSTDIR\${EXE_NAME}"
  WriteRegStr   HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr   HKCU "${UNINST_KEY}" "UninstallString"      '"$INSTDIR\Uninstall CMS SARIS.exe"'
  WriteRegStr   HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall CMS SARIS.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  WriteRegStr   HKCU "${INSTALL_KEY}" "InstallLocation" "$INSTDIR"

  DetailPrint "Creation du desinstalleur..."
  WriteUninstaller "$INSTDIR\Uninstall CMS SARIS.exe"
  !insertmacro STEP_DONE
  DetailPrint ""
  DetailPrint "Installation terminee dans : $INSTDIR"
SectionEnd

; ============================================================================
;  DÉSINSTALLATION (nettoyage complet : fichiers + données locales)
; ============================================================================
Function un.onInit
  System::Call 'kernel32::OpenMutexW(i 0x100000, b 0, w "${APP_ID}") i .R9'
  ${If} $R9 <> 0
    System::Call 'kernel32::CloseHandle(i $R9)'
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "Fermez CMS SARIS avant de desinstaller."
    ${EndIf}
    Abort
  ${EndIf}
FunctionEnd

Section "Uninstall"
  DetailPrint "Suppression des fichiers de l'application..."
  RMDir /r "$INSTDIR"

  DetailPrint "Suppression des raccourcis..."
  Delete "$DESKTOP\CMS SARIS.lnk"
  RMDir /r "$SMPROGRAMS\CMS SARIS"

  DetailPrint "Suppression des donnees locales (base synchronisee, config)..."
  Delete "$APPDATA\CMS SARIS\cms-saris.db"
  Delete "$APPDATA\CMS SARIS\cms-saris.db-wal"
  Delete "$APPDATA\CMS SARIS\cms-saris.db-shm"
  Delete "$APPDATA\CMS SARIS\cms-saris.db-journal"
  RMDir /r "$APPDATA\CMS SARIS"
  RMDir /r "$LOCALAPPDATA\CMS SARIS"

  DetailPrint "Nettoyage du registre..."
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "${INSTALL_KEY}"
SectionEnd
