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
!include "nsDialogs.nsh"
!include "WordFunc.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
!insertmacro VersionCompare

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
!ifndef STM_SETIMAGE
  !define STM_SETIMAGE 0x172
!endif
!ifndef IMAGE_BITMAP
  !define IMAGE_BITMAP 0
!endif

; Repli si /DVERSION n'est pas passé au préprocesseur (build-installer.mjs le passe
; toujours depuis package.json — ce repli ne sert qu'à un appel manuel de makensis).
; Penser à la bumper avec apps/desktop/package.json si elle traîne.
!ifndef VERSION
  !define VERSION "1.8.0"
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

; Longueur du plus long chemin relatif de l'application (calculée par build-installer.mjs). NSIS 3.0.4.1 n'extrait pas, sans
; rien dire, un fichier dont le chemin complet dépasse ~230 caractères : une application installée dans un dossier trop
; profond perdrait des fichiers (et son service local ne démarrerait plus). On refuse donc ce dossier, avec une marge.
!ifndef MAXREL
  !define MAXREL 150
!endif
!define /math LIMITE_CHEMIN 220 - ${MAXREL}

; Taille de l'application installée, en Mo (calculée par build-installer.mjs) : sert aux contrôles de place disque.
!ifndef TAILLE_MB
  !define TAILLE_MB 1000
!endif

!define APP_NAME    "CMS SARIS"
!define PUBLISHER   "Deo Cherel BOUWAYI MIKOUYA & Oscarvie Verdi NZILA - SARIS-CONGO"
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
; /DRAPIDE : compilation d'ESSAI (zlib, quelques secondes au lieu de plusieurs minutes) — jamais pour une version diffusée.
!ifdef RAPIDE
  SetCompressor /SOLID zlib
!else
  SetCompressor /SOLID lzma
!endif
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

; ── Panneau animé (page Bienvenue) : fumée en boucle derrière un panneau "verre
; dépoli", cf. décision du 2026-07-20 (pas de WebView2 : séquence pré-rendue à la
; place, mêmes formes/mouvement que le mockup validé — apps/desktop/scripts/gen-installer-anim.mjs).
Var hWelcomeBmpImg  ; handle GDI du bitmap actuellement substitué (à libérer avant remplacement)
Var WelcomeFrame    ; index de frame courant (0-47)
Var WelcomeBmpW     ; largeur RÉELLE du contrôle bitmap (mesurée, peut différer de 164px selon le DPI)
Var WelcomeBmpH     ; hauteur RÉELLE du contrôle bitmap (idem, 314px)

; ── État de l'installation existante, des données du poste et des options (cf. .onInit) ──
Var Existante             ; 1 si CMS SARIS est déjà installé sur ce poste
Var AncienUninst          ; commande de désinstallation de l'installation trouvée
Var AncienUninstSilencieux
Var AncienVersion
Var AncienDossier
Var Action                ; "maj" (par défaut) | "neuf" | "desinstaller"
Var AppOuverte            ; 1 si l'application tourne
Var EnAttente             ; travail non envoyé au serveur : nombre, ou -1 = inconnu
Var EnAttentePlusDe
Var EtatReleve
Var TexteEnAttente
Var TailleDonnees
Var SauvEtat              ; "ok" | "rien" | "erreur"
Var SauvChemin
Var SauvegardeTrouvee
Var SauvegardeLibelle
Var RestaurerSauvegarde
Var PurgerDonnees         ; désinstallation : supprimer aussi les données du poste
Var SansSauvegarde
Var TexteMaj
Var BoutonMaj
Var TexteVersions
Var FiletActif            ; 1 = l'ancienne version est mise de côté (« .ancien ») : on peut revenir en arrière
Var VerifOK

; ── Apparence MUI ──
!define MUI_ICON "${ASSETS}\icon.ico"
!define MUI_UNICON "${ASSETS}\icon.ico"
; Pas de MUI_HEADERIMAGE (bandeau logo en haut des pages) — retiré explicitement,
; demandé à deux reprises le 2026-07-20. Supprimé GLOBALEMENT (Dossier/Installation
; y compris) plutôt que juste sur Bienvenue : évite toute ambiguïté sur "quelle page
; exactement l'affichait encore" après un précédent essai de retrait incomplet.
; Sert de départ à l'image du panneau Bienvenue (ensuite animée, cf. WelcomeShow) ET
; d'image FIXE du panneau Fin — page Fin gardée sur le mécanisme MUI2 standard
; (case "Lancer CMS SARIS" intacte), juste reskinnée sur la 1ère frame pour la
; cohérence visuelle, sans ré-implémenter à risque une logique déjà éprouvée.
!define MUI_WELCOMEFINISHPAGE_BITMAP "${ASSETS}\anim\frame_00.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${ASSETS}\uninstallerSidebar.bmp"
!define MUI_ABORTWARNING

; Page Bienvenue : texte personnalisé + page STANDARD MUI2 conservée (elle gère déjà
; correctement le cadre plein écran sans bandeau d'en-tête) — seule l'image de son
; contrôle bitmap existant est ensuite substituée/animée (cf. WelcomeShow plus bas).
!define MUI_WELCOMEPAGE_TITLE "Bienvenue dans l'installation de CMS SARIS"
!define MUI_WELCOMEPAGE_TEXT "Cet assistant installe CMS SARIS sur cet ordinateur : l'application, le service local (backend embarque) et la base de donnees locale.$\n$\nCliquez sur Suivant pour continuer."
!define MUI_PAGE_CUSTOMFUNCTION_SHOW WelcomeShow
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE WelcomeLeaveHook
!insertmacro MUI_PAGE_WELCOME

; Page « déjà installé » (seulement si une installation existe), puis le dossier d'installation (pas redemandé
; pour une mise à jour), puis la proposition de reprendre une sauvegarde (seulement pour une installation neuve).
Page custom PageExistante PageExistanteLeave
!define MUI_PAGE_CUSTOMFUNCTION_PRE DirPre
!define MUI_DIRECTORYPAGE_TEXT_TOP "CMS SARIS sera installé dans un dossier « CMS SARIS », créé dans le dossier choisi ci-dessous (sauf s'il porte déjà ce nom). Le chemin complet ne doit pas dépasser ${LIMITE_CHEMIN} caractères. Cliquez sur Suivant pour continuer."
!insertmacro MUI_PAGE_DIRECTORY
Page custom PageSauvegarde PageSauvegardeLeave

; Page d'installation : on accroche la création de la 2e barre à l'affichage de CETTE page.
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_PAGE_CUSTOMFUNCTION_SHOW InstFilesPageShow
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE_NAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer CMS SARIS"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
UninstPage custom un.PageDonnees un.PageDonneesLeave
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

; ── Animation du panneau Bienvenue (fumée + verre dépoli) ──────────────────────
; La page MUI2 standard (Pages\Welcome.nsh, lue directement dans le NSIS installé
; localement pour éviter de deviner) crée déjà elle-même le contrôle bitmap correct
; ($mui.WelcomePage.Image, déclaré par MUI_WELCOMEPAGE_INTERFACE) sur un cadre plein
; écran SANS bandeau d'en-tête — reconstruire cette page à la main (tenté puis annulé)
; cassait ce cadrage. On se contente donc de permuter l'IMAGE de ce contrôle EXISTANT,
; toutes les 150 ms, parmi 48 frames pré-rendues (build/anim/frame_NN.bmp, cf.
; scripts/gen-installer-anim.mjs).
Function WelcomeShow
  StrCpy $WelcomeFrame 0
  StrCpy $hWelcomeBmpImg 0

  ; Mesure la taille RÉELLE du contrôle bitmap (peut différer de nos frames natives
  ; 164x314 selon le DPI/l'échelle système) — cf. constat du 2026-07-20 : à taille
  ; native, l'image ne remplissait pas tout le contrôle, laissant un vide en bas.
  System::Call "*(i,i,i,i) p.r2"
  System::Call "user32::GetClientRect(p $mui.WelcomePage.Image, p r2)"
  System::Call "*$2(i,i,i.r3,i.r4)"   ; r3 = largeur, r4 = hauteur (left/top toujours 0)
  System::Free $2
  StrCpy $WelcomeBmpW $3
  StrCpy $WelcomeBmpH $4

  ${NSD_CreateTimer} WelcomeAnimate 150
FunctionEnd

Function WelcomeAnimate
  IntOp $WelcomeFrame $WelcomeFrame + 1
  ${If} $WelcomeFrame >= 48
    StrCpy $WelcomeFrame 0
  ${EndIf}
  StrCpy $9 "0$WelcomeFrame"
  StrCpy $9 $9 2 -2   ; 2 derniers caracteres -> "00".."47"
  ; Étirée à la taille RÉELLE mesurée (WelcomeShow) au lieu de la taille native du
  ; fichier — remplit tout le contrôle, plus de bande vide en bas.
  System::Call 'user32::LoadImageW(i 0, w "$PLUGINSDIR\anim\frame_$9.bmp", i 0, i $WelcomeBmpW, i $WelcomeBmpH, i 0x10) p.r1'
  ${If} $1 != 0
    SendMessage $mui.WelcomePage.Image ${STM_SETIMAGE} ${IMAGE_BITMAP} $1
    ${If} $hWelcomeBmpImg != 0
      System::Call 'gdi32::DeleteObject(p $hWelcomeBmpImg)'
    ${EndIf}
    StrCpy $hWelcomeBmpImg $1
  ${EndIf}
FunctionEnd

; Note : on ne touche PAS à $mui.WelcomePage.Image.Bitmap (l'image de depart chargee
; par MUI2 lui-meme) — seulement aux frames qu'on y substitue ensuite, trackees a part.
Function WelcomeLeaveHook
  ${NSD_KillTimer} WelcomeAnimate
  ${If} $hWelcomeBmpImg != 0
    System::Call 'gdi32::DeleteObject(p $hWelcomeBmpImg)'
    StrCpy $hWelcomeBmpImg 0
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

; Frames de l'animation (page Bienvenue) — extraites tôt (ordre d'archive .onInit).
ReserveFile "${ASSETS}\anim\*.bmp"

; ============================================================================
;  FONCTIONS COMMUNES à l'installateur ET au désinstallateur (macro : préfixe « un. » pour le second).
; ============================================================================
!macro FONCTIONS_COMMUNES un

; $AppOuverte = 1 si CMS SARIS tourne.
; On ne peut PAS se fier à un mutex : Electron n'en crée pas sous ce nom (vérifié). Ce qui existe, c'est
; la fenêtre interne « Chrome_MessageWindow » dont le TITRE est le dossier de données de l'application.
Function ${un}AppEnCours
  Push $0
  System::Call 'user32::FindWindowExW(i -3, i 0, w "Chrome_MessageWindow", w "$APPDATA\${APP_NAME}") i .r0'
  ${If} $0 <> 0
    StrCpy $AppOuverte 1
  ${Else}
    StrCpy $AppOuverte 0
  ${EndIf}
  Pop $0
FunctionEnd

; Demande à l'application de se fermer d'elle-même : on la relance avec --quitter, ce qui prévient l'instance
; en cours. Elle envoie alors son travail restant au serveur, puis s'arrête. $R8 = dossier d'installation.
; (Les versions antérieures à 1.11.0 ignorent l'argument : on attend, puis on demande à l'utilisateur.)
Function ${un}LancerFermeture
  ${If} ${FileExists} "$R8\${EXE_NAME}"
    Exec '"$R8\${EXE_NAME}" --quitter'
  ${EndIf}
FunctionEnd

; Attend la fermeture (au plus $R7 tours de 500 ms). Résultat : $AppOuverte.
Function ${un}AttendreFermeture
  attendre:
    Call ${un}AppEnCours
    ${If} $AppOuverte = 0
      Return
    ${EndIf}
    ${If} $R7 <= 0
      Return
    ${EndIf}
    Sleep 500
    IntOp $R7 $R7 - 1
    Goto attendre
FunctionEnd

; Lit l'état écrit par l'application (etat-poste.ini) : $EnAttente (-1 = inconnu), $EnAttentePlusDe, $EtatReleve.
Function ${un}LireEtatPoste
  Push $0
  StrCpy $EnAttente "-1"
  StrCpy $EnAttentePlusDe 0
  StrCpy $EtatReleve ""
  ClearErrors
  ReadINIStr $0 "$APPDATA\${APP_NAME}\etat-poste.ini" "poste" "enAttente"
  ${IfNot} ${Errors}
  ${AndIf} $0 != ""
    StrCpy $EnAttente $0
    ReadINIStr $EnAttentePlusDe "$APPDATA\${APP_NAME}\etat-poste.ini" "poste" "plusDe"
    ReadINIStr $EtatReleve "$APPDATA\${APP_NAME}\etat-poste.ini" "poste" "releve"
  ${EndIf}
  Pop $0
FunctionEnd

; Le travail non envoyé, en une phrase : $TexteEnAttente.
Function ${un}FormulerEnAttente
  Call ${un}LireEtatPoste
  ${If} $EnAttente == "-1"
    StrCpy $TexteEnAttente "inconnu (l'application n'a pas encore enregistré son état)"
  ${ElseIf} $EnAttente == "0"
    StrCpy $TexteEnAttente "aucun, tout est envoyé (relevé du $EtatReleve)"
  ${Else}
    ${If} $EnAttentePlusDe == "1"
      StrCpy $TexteEnAttente "plus de $EnAttente éléments (relevé du $EtatReleve)"
    ${ElseIf} $EnAttente == "1"
      StrCpy $TexteEnAttente "1 élément (relevé du $EtatReleve)"
    ${Else}
      StrCpy $TexteEnAttente "$EnAttente éléments (relevé du $EtatReleve)"
    ${EndIf}
  ${EndIf}
FunctionEnd

; Redessine le fond sous un libellé dont on vient de changer le texte. Les libellés sont TRANSPARENTS (SetCtlColors lit ses
; couleurs à la compilation : on ne peut pas lui donner la couleur de fond de Windows, qui est une variable) ; sans ce
; repaint du parent, le nouveau texte se dessine par-dessus l'ancien. $R0 = handle du libellé.
!if "${un}" == ""
Function Rafraichir
  Push $0
  Push $1
  System::Call 'user32::GetParent(p $R0) p .r1'
  System::Call '*(i,i,i,i) p.r0'
  System::Call 'user32::GetWindowRect(p $R0, p r0)'
  System::Call 'user32::MapWindowPoints(p 0, p r1, p r0, i 2)'
  System::Call 'user32::InvalidateRect(p r1, p r0, i 1)'
  System::Call 'user32::UpdateWindow(p r1)'
  System::Free $0
  Pop $1
  Pop $0
FunctionEnd
!endif

; Taille de la base locale, en Mo : $TailleDonnees (vide s'il n'y en a pas).
Function ${un}MesurerDonnees
  Push $0
  Push $1
  Push $2
  StrCpy $TailleDonnees ""
  ${If} ${FileExists} "$APPDATA\${APP_NAME}\cms-saris.db"
    ClearErrors
    ${${un}GetSize} "$APPDATA\${APP_NAME}" "/M=cms-saris.db /S=0K /G=0" $0 $1 $2
    ${IfNot} ${Errors}
      IntOp $0 $0 / 1024
      ${If} $0 < 1
        StrCpy $TailleDonnees "moins de 1 Mo"
      ${Else}
        StrCpy $TailleDonnees "$0 Mo"
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; Sauvegarde la base locale (et son journal) dans %LOCALAPPDATA%\CMS SARIS Sauvegardes — un dossier que
; OneDrive ne synchronise pas : ce sont des données de santé, elles ne doivent pas partir dans un cloud.
; Résultat : $SauvEtat = "ok" | "rien" (pas de base) | "erreur" ; $SauvChemin = chemin sans extension.
Function ${un}SauvegarderBase
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  StrCpy $SauvEtat "rien"
  StrCpy $SauvChemin ""
  ${If} ${FileExists} "$APPDATA\${APP_NAME}\cms-saris.db"
    ${${un}GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    ; GetTime ne complète pas toujours à deux chiffres (l'heure « 8 » au lieu de « 08 ») : le tri par nom
    ; (la plus récente d'abord) et la lecture par position en dépendent.
    StrCpy $0 "0$0"
    StrCpy $0 $0 2 -2
    StrCpy $1 "0$1"
    StrCpy $1 $1 2 -2
    StrCpy $4 "0$4"
    StrCpy $4 $4 2 -2
    StrCpy $5 "0$5"
    StrCpy $5 $5 2 -2
    StrCpy $6 "0$6"
    StrCpy $6 $6 2 -2
    CreateDirectory "$LOCALAPPDATA\${APP_NAME} Sauvegardes"
    StrCpy $SauvChemin "$LOCALAPPDATA\${APP_NAME} Sauvegardes\cms-saris-$2$1$0-$4$5$6"
    StrCpy $SauvEtat "ok"
    ClearErrors
    CopyFiles /SILENT "$APPDATA\${APP_NAME}\cms-saris.db" "$SauvChemin.db"
    ${If} ${Errors}
      StrCpy $SauvEtat "erreur"
    ${EndIf}
    ; Le journal : sans lui, les dernières écritures (pas encore reportées dans le fichier principal) seraient perdues.
    ${If} $SauvEtat == "ok"
    ${AndIf} ${FileExists} "$APPDATA\${APP_NAME}\cms-saris.db-wal"
      CopyFiles /SILENT "$APPDATA\${APP_NAME}\cms-saris.db-wal" "$SauvChemin.db-wal"
      ${If} ${Errors}
        StrCpy $SauvEtat "erreur"
      ${EndIf}
    ${EndIf}
    ${If} $SauvEtat == "ok"
    ${AndIf} ${FileExists} "$APPDATA\${APP_NAME}\cms-saris.db-shm"
      CopyFiles /SILENT "$APPDATA\${APP_NAME}\cms-saris.db-shm" "$SauvChemin.db-shm"
      ${If} ${Errors}
        StrCpy $SauvEtat "erreur"
      ${EndIf}
    ${EndIf}
    ${If} $SauvEtat == "ok"
    ${AndIf} ${FileExists} "$APPDATA\${APP_NAME}\cms-saris.db-journal"
      CopyFiles /SILENT "$APPDATA\${APP_NAME}\cms-saris.db-journal" "$SauvChemin.db-journal"
      ${If} ${Errors}
        StrCpy $SauvEtat "erreur"
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

!macroend
!insertmacro FONCTIONS_COMMUNES ""
!insertmacro FONCTIONS_COMMUNES "un."

; ============================================================================
;  INSTALLATION EXISTANTE
; ============================================================================

; Repère une installation CMS SARIS existante, quel que soit l'installateur d'ORIGINE :
; notre identifiant fixe (${UNINST_KEY}, cet installateur "local") EST insuffisant seul,
; car l'installateur "remote" (electron-builder standard, electron-builder.yml) enregistre
; sous une clé GUID générée à la volée, différente à chaque build. On balaie donc aussi
; par DisplayName commençant par "CMS SARIS" pour couvrir ce cas.
; Résultat : $Existante (0/1), $AncienUninst, $AncienUninstSilencieux, $AncienVersion, $AncienDossier.
Function FindExistingInstall
  StrCpy $Existante 0
  StrCpy $AncienUninst ""
  StrCpy $AncienUninstSilencieux ""
  StrCpy $AncienVersion ""
  StrCpy $AncienDossier ""
  StrCpy $R0 "${UNINST_KEY}"
  ReadRegStr $AncienUninst HKCU "$R0" "UninstallString"
  ${If} $AncienUninst == ""
    StrCpy $R2 0
    boucleRecherche:
      EnumRegKey $R3 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall" $R2
      ${If} $R3 == ""
        Goto finRecherche
      ${EndIf}
      ClearErrors
      ReadRegStr $R4 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R3" "DisplayName"
      ${IfNot} ${Errors}
        StrCpy $R6 $R4 9
        ${If} $R6 == "CMS SARIS"
          StrCpy $R0 "Software\Microsoft\Windows\CurrentVersion\Uninstall\$R3"
          ReadRegStr $AncienUninst HKCU "$R0" "UninstallString"
          ${If} $AncienUninst != ""
            Goto finRecherche
          ${EndIf}
        ${EndIf}
      ${EndIf}
      IntOp $R2 $R2 + 1
      Goto boucleRecherche
    finRecherche:
  ${EndIf}
  ${If} $AncienUninst != ""
    ReadRegStr $AncienUninstSilencieux HKCU "$R0" "QuietUninstallString"
    ReadRegStr $AncienVersion HKCU "$R0" "DisplayVersion"
    ReadRegStr $AncienDossier HKCU "$R0" "InstallLocation"
    ; Une clé d'inscription dont le dossier n'existe plus est un reste, pas une installation.
    ${If} $AncienDossier != ""
    ${AndIfNot} ${FileExists} "$AncienDossier\${EXE_NAME}"
      StrCpy $AncienUninst ""
    ${EndIf}
  ${EndIf}
  ${If} $AncienUninst != ""
    StrCpy $Existante 1
  ${EndIf}
FunctionEnd

; Dernière sauvegarde de la base locale : $SauvegardeTrouvee (chemin sans extension, vide s'il n'y en a pas)
; et $SauvegardeLibelle (« 22/10/2026 08:30 »). Les noms contiennent la date : le plus grand est le plus récent.
Function TrouverSauvegarde
  StrCpy $SauvegardeTrouvee ""
  StrCpy $SauvegardeLibelle ""
  StrCpy $R0 ""
  FindFirst $R1 $R2 "$LOCALAPPDATA\${APP_NAME} Sauvegardes\cms-saris-*.db"
  boucleSauv:
    ${If} $R2 == ""
      Goto finSauv
    ${EndIf}
    ${If} $R2 S> $R0
      StrCpy $R0 $R2
    ${EndIf}
    FindNext $R1 $R2
    Goto boucleSauv
  finSauv:
  FindClose $R1
  ${If} $R0 != ""
    StrCpy $R3 $R0 -3
    StrCpy $SauvegardeTrouvee "$LOCALAPPDATA\${APP_NAME} Sauvegardes\$R3"
    StrCpy $R4 $R0 2 16
    StrCpy $R5 $R0 2 14
    StrCpy $R6 $R0 4 10
    StrCpy $R7 $R0 2 19
    StrCpy $R8 $R0 2 21
    StrCpy $SauvegardeLibelle "$R4/$R5/$R6 $R7:$R8"
  ${EndIf}
FunctionEnd

; Remet une sauvegarde en place — seulement si ce poste n'a pas déjà une base locale.
Function RestaurerBase
  ${If} $SauvegardeTrouvee == ""
    Return
  ${EndIf}
  ${If} ${FileExists} "$APPDATA\${APP_NAME}\cms-saris.db"
    DetailPrint "Une base locale existe déjà : la sauvegarde n'est pas restaurée."
    Return
  ${EndIf}
  CreateDirectory "$APPDATA\${APP_NAME}"
  ClearErrors
  CopyFiles /SILENT "$SauvegardeTrouvee.db" "$APPDATA\${APP_NAME}\cms-saris.db"
  ${If} ${FileExists} "$SauvegardeTrouvee.db-wal"
    CopyFiles /SILENT "$SauvegardeTrouvee.db-wal" "$APPDATA\${APP_NAME}\cms-saris.db-wal"
  ${EndIf}
  ${If} ${FileExists} "$SauvegardeTrouvee.db-shm"
    CopyFiles /SILENT "$SauvegardeTrouvee.db-shm" "$APPDATA\${APP_NAME}\cms-saris.db-shm"
  ${EndIf}
  ${If} ${FileExists} "$SauvegardeTrouvee.db-journal"
    CopyFiles /SILENT "$SauvegardeTrouvee.db-journal" "$APPDATA\${APP_NAME}\cms-saris.db-journal"
  ${EndIf}
  ${If} ${Errors}
    DetailPrint "La sauvegarde du $SauvegardeLibelle n'a pas pu être restaurée."
  ${Else}
    DetailPrint "Sauvegarde du $SauvegardeLibelle restaurée : l'application retrouvera le travail de ce poste."
  ${EndIf}
FunctionEnd

; ── .onInit : extrait les frames d'animation, repère l'installation existante, lit les options ──
; Options (installation silencieuse, p. ex. mise à jour automatique ou déploiement) :
;   /ACTION=neuf    réinstalle à neuf : sauvegarde la base locale, supprime l'ancienne installation et ses données
;   /RESTAURER=1    reprend la dernière sauvegarde de ce poste (si aucune base locale n'existe)
; Sans option, une installation silencieuse met à jour en gardant toutes les données.
Function .onInit
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\anim"
  File "${ASSETS}\anim\*.bmp"

  StrCpy $TotalSteps 4
  StrCpy $FiletActif 0
  ; Contrôles préalables : Electron 33 ne démarre pas avant Windows 10, ni en 32 bits.
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "CMS SARIS nécessite Windows 10 ou plus récent. Cet ordinateur ne peut pas l'exécuter." /SD IDOK
    SetErrorLevel 8
    Abort
  ${EndIf}
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "CMS SARIS nécessite un Windows 64 bits. Cet ordinateur ne peut pas l'exécuter." /SD IDOK
    SetErrorLevel 8
    Abort
  ${EndIf}
  StrCpy $Action "maj"
  StrCpy $RestaurerSauvegarde 0
  Call FindExistingInstall
  ${IfNot} ${Silent}
  ${AndIf} $Existante = 1
  ${AndIf} $AncienDossier != ""
    StrCpy $INSTDIR $AncienDossier
  ${EndIf}

  ${If} ${Silent}
    ClearErrors
    ${GetOptions} $CMDLINE "/ACTION=" $0
    ${IfNot} ${Errors}
    ${AndIf} $0 == "neuf"
      StrCpy $Action "neuf"
    ${EndIf}
    ClearErrors
    ${GetOptions} $CMDLINE "/RESTAURER=" $0
    ${IfNot} ${Errors}
    ${AndIf} $0 == "1"
      StrCpy $RestaurerSauvegarde 1
      Call TrouverSauvegarde
    ${EndIf}
    ; L'application est ouverte (c'est le cas d'une mise à jour automatique : elle est en train de se fermer) :
    ; on lui demande de se fermer proprement et on attend, au plus 45 s.
    Call AppEnCours
    ${If} $AppOuverte = 1
      StrCpy $R8 $INSTDIR
      Call LancerFermeture
      StrCpy $R7 90
      Call AttendreFermeture
      ${If} $AppOuverte = 1
        SetErrorLevel 5
        Abort
      ${EndIf}
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

; ── Page « CMS SARIS est déjà installé » ────────────────────────────────────────
Var hRadioMaj
Var hRadioNeuf
Var hRadioDesinst
Var hLblAppOuverte
Var hBtnFermer
Var hLblEnAttente
; 0 = pas demandée, 1 = en cours, 2 = n'a pas abouti, 3 = faite
Var EtatFermeture
Var EtatAffiche
Var TicsFermeture

Function PageExistante
  ${If} ${Silent}
  ${OrIf} $Existante = 0
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "CMS SARIS est déjà installé sur ce poste" "Choisissez ce que vous voulez faire. Rien n'est supprimé sans sauvegarde."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  Call MesurerDonnees
  Call FormulerEnAttente

  ${VersionCompare} "${VERSION}" "$AncienVersion" $R0
  ${If} $AncienVersion == ""
    StrCpy $TexteMaj "Mettre à jour vers la version ${VERSION} (vos données sont conservées)"
    StrCpy $BoutonMaj "Mettre à jour"
    StrCpy $TexteVersions "Version installée : inconnue    -    cet installateur : ${VERSION}"
  ${ElseIf} $R0 = 1
    StrCpy $TexteMaj "Mettre à jour vers la version ${VERSION} (vos données sont conservées)"
    StrCpy $BoutonMaj "Mettre à jour"
    StrCpy $TexteVersions "Version installée : $AncienVersion    -    cet installateur : ${VERSION}"
  ${ElseIf} $R0 = 0
    StrCpy $TexteMaj "Réparer l'installation, même version ${VERSION} (vos données sont conservées)"
    StrCpy $BoutonMaj "Réparer"
    StrCpy $TexteVersions "Version installée : $AncienVersion    -    cet installateur : ${VERSION} (identique)"
  ${Else}
    StrCpy $TexteMaj "Remplacer par la version ${VERSION}, plus ancienne que celle installée (déconseillé)"
    StrCpy $BoutonMaj "Remplacer"
    StrCpy $TexteVersions "Version installée : $AncienVersion    -    cet installateur : ${VERSION} (plus ancienne)"
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 9u "$TexteVersions"
  Pop $0
  ${If} $TailleDonnees != ""
    ${NSD_CreateLabel} 0 10u 100% 9u "Données de ce poste : $TailleDonnees"
  ${Else}
    ${NSD_CreateLabel} 0 10u 100% 9u "Données de ce poste : aucune base locale trouvée"
  ${EndIf}
  Pop $0
  ${NSD_CreateLabel} 0 20u 100% 18u "Travail pas encore envoyé au serveur : $TexteEnAttente"
  Pop $hLblEnAttente
  ${If} $EnAttente != "0"
    SetCtlColors $hLblEnAttente "B42318" "transparent"
  ${EndIf}

  ${NSD_CreateRadioButton} 0 41u 100% 10u "$TexteMaj"
  Pop $hRadioMaj
  ${NSD_AddStyle} $hRadioMaj ${WS_GROUP}
  ${NSD_CreateRadioButton} 0 54u 100% 18u "Réinstaller à neuf : supprime l'application ET les données de ce poste (une sauvegarde est faite avant)"
  Pop $hRadioNeuf
  ${NSD_CreateRadioButton} 0 74u 100% 10u "Désinstaller CMS SARIS (vous choisirez quoi faire des données)"
  Pop $hRadioDesinst
  ${NSD_OnClick} $hRadioMaj PageExistanteChoix
  ${NSD_OnClick} $hRadioNeuf PageExistanteChoix
  ${NSD_OnClick} $hRadioDesinst PageExistanteChoix
  ${NSD_Check} $hRadioMaj

  ${NSD_CreateLabel} 0 91u 62% 18u ""
  Pop $hLblAppOuverte
  SetCtlColors $hLblAppOuverte "B42318" "transparent"
  ${NSD_CreateButton} 64% 91u 36% 12u "Fermer CMS SARIS pour moi"
  Pop $hBtnFermer
  ${NSD_OnClick} $hBtnFermer PageExistanteFermer
  ShowWindow $hBtnFermer ${SW_HIDE}

  StrCpy $EtatFermeture 0
  StrCpy $EtatAffiche -1
  StrCpy $TicsFermeture 0
  Call PageExistanteMinuteur
  ${NSD_CreateTimer} PageExistanteMinuteur 500
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:$BoutonMaj"
  nsDialogs::Show
FunctionEnd

; Le bouton « Suivant » porte le nom de l'action choisie.
Function PageExistanteChoix
  GetDlgItem $0 $HWNDPARENT 1
  ${NSD_GetState} $hRadioNeuf $1
  ${NSD_GetState} $hRadioDesinst $2
  ${If} $1 = 1
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Réinstaller à neuf"
  ${ElseIf} $2 = 1
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Désinstaller"
  ${Else}
    SendMessage $0 ${WM_SETTEXT} 0 "STR:$BoutonMaj"
  ${EndIf}
FunctionEnd

; Les libellés qui changent ont un fond blanc UNI (pas « transparent ») : sinon le nouveau texte se dessine par-dessus l'ancien.
; Appelée toutes les 500 ms : l'application est-elle ouverte ? Tant qu'elle l'est, on ne peut pas continuer.
; Le texte n'est réécrit que quand l'état change (sinon il clignote).
Function PageExistanteMinuteur
  Call AppEnCours
  GetDlgItem $0 $HWNDPARENT 1
  ${If} $AppOuverte = 1
    EnableWindow $0 0
    ${If} $EtatFermeture = 1
      IntOp $TicsFermeture $TicsFermeture + 1
      ${If} $TicsFermeture > 90
        StrCpy $EtatFermeture 2
      ${EndIf}
    ${ElseIf} $EtatFermeture = 3
      StrCpy $EtatFermeture 0
    ${EndIf}
    ${If} $EtatAffiche <> $EtatFermeture
      StrCpy $EtatAffiche $EtatFermeture
      SetCtlColors $hLblAppOuverte "B42318" "transparent"
      ${If} $EtatFermeture = 1
        ${NSD_SetText} $hLblAppOuverte "Fermeture en cours : le travail restant est envoyé au serveur..."
        StrCpy $R0 $hLblAppOuverte
        Call Rafraichir
        EnableWindow $hBtnFermer 0
      ${ElseIf} $EtatFermeture = 2
        ${NSD_SetText} $hLblAppOuverte "CMS SARIS ne s'est pas fermé de lui-même. Fermez-le vous-même (barre des tâches comprise)."
        StrCpy $R0 $hLblAppOuverte
        Call Rafraichir
        EnableWindow $hBtnFermer 1
      ${Else}
        ${NSD_SetText} $hLblAppOuverte "CMS SARIS est ouvert : il doit être fermé pour continuer."
        StrCpy $R0 $hLblAppOuverte
        Call Rafraichir
        EnableWindow $hBtnFermer 1
      ${EndIf}
      ShowWindow $hLblAppOuverte ${SW_SHOW}
      ShowWindow $hBtnFermer ${SW_SHOW}
    ${EndIf}
  ${Else}
    EnableWindow $0 1
    ShowWindow $hBtnFermer ${SW_HIDE}
    ${If} $EtatFermeture = 1
    ${OrIf} $EtatFermeture = 2
      ; L'application vient de se fermer : on relit ce qu'elle a noté en partant.
      StrCpy $EtatFermeture 3
      StrCpy $EtatAffiche 3
      Call FormulerEnAttente
      ${NSD_SetText} $hLblEnAttente "Travail pas encore envoyé au serveur : $TexteEnAttente"
      StrCpy $R0 $hLblEnAttente
      Call Rafraichir
      ${If} $EnAttente != "0"
        SetCtlColors $hLblEnAttente "B42318" "transparent"
      ${Else}
        SetCtlColors $hLblEnAttente "027A48" "transparent"
      ${EndIf}
      SetCtlColors $hLblAppOuverte "027A48" "transparent"
      ${NSD_SetText} $hLblAppOuverte "CMS SARIS est fermé."
      StrCpy $R0 $hLblAppOuverte
      Call Rafraichir
    ${ElseIf} $EtatAffiche <> 3
    ${AndIf} $EtatAffiche <> 0
      StrCpy $EtatAffiche 0
      ${NSD_SetText} $hLblAppOuverte ""
      StrCpy $R0 $hLblAppOuverte
      Call Rafraichir
    ${ElseIf} $EtatAffiche = -1
      StrCpy $EtatAffiche 0
      ${NSD_SetText} $hLblAppOuverte ""
      StrCpy $R0 $hLblAppOuverte
      Call Rafraichir
    ${EndIf}
  ${EndIf}
FunctionEnd

Function PageExistanteFermer
  StrCpy $R8 $AncienDossier
  ${If} $R8 == ""
    StrCpy $R8 $INSTDIR
  ${EndIf}
  Call LancerFermeture
  StrCpy $EtatFermeture 1
  StrCpy $TicsFermeture 0
  StrCpy $EtatAffiche 1
  EnableWindow $hBtnFermer 0
  SetCtlColors $hLblAppOuverte "B42318" "transparent"
  ${NSD_SetText} $hLblAppOuverte "Fermeture en cours : le travail restant est envoyé au serveur..."
  StrCpy $R0 $hLblAppOuverte
  Call Rafraichir
FunctionEnd

Function PageExistanteLeave
  Call AppEnCours
  ${If} $AppOuverte = 1
    MessageBox MB_OK|MB_ICONSTOP "CMS SARIS est encore ouvert. Fermez-le (barre des tâches comprise), ou utilisez le bouton « Fermer CMS SARIS pour moi »."
    Abort
  ${EndIf}
  ${NSD_GetState} $hRadioNeuf $1
  ${NSD_GetState} $hRadioDesinst $2
  ${If} $1 = 1
    StrCpy $Action "neuf"
  ${ElseIf} $2 = 1
    StrCpy $Action "desinstaller"
  ${Else}
    StrCpy $Action "maj"
  ${EndIf}

  ${If} $Action != "maj"
    Call LireEtatPoste
    ${If} $EnAttente != "0"
      ${If} $EnAttente == "-1"
        MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "On ne peut pas savoir si ce poste a du travail qui n'est pas encore parti vers le serveur.$\n$\nUne sauvegarde de la base de ce poste sera faite avant toute suppression, dans :$\n$LOCALAPPDATA\${APP_NAME} Sauvegardes$\n$\nContinuer ?" IDYES continuerChoix
      ${Else}
        MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Ce poste a du travail qui n'est pas encore parti vers le serveur : $TexteEnAttente.$\n$\nConseil : annulez, ouvrez CMS SARIS (connecté au réseau) et laissez-le tout envoyer.$\n$\nSi vous continuez, une sauvegarde de la base sera faite avant toute suppression, dans :$\n$LOCALAPPDATA\${APP_NAME} Sauvegardes$\n$\nContinuer quand même ?" IDYES continuerChoix
      ${EndIf}
      Abort
      continuerChoix:
    ${EndIf}
  ${EndIf}

  ${NSD_KillTimer} PageExistanteMinuteur
  ${If} $Action == "desinstaller"
    ; Les désinstalleurs d'avant la 1.11.0 suppriment tout sans rien demander : on sauvegarde d'abord.
    ${VersionCompare} "$AncienVersion" "1.11.0" $R0
    ${If} $AncienVersion == ""
    ${OrIf} $R0 = 2
      Call SauvegarderBase
      ${If} $SauvEtat == "erreur"
        MessageBox MB_OK|MB_ICONSTOP "La sauvegarde de la base de ce poste a échoué : rien n'est désinstallé."
        ${NSD_CreateTimer} PageExistanteMinuteur 500
        Abort
      ${EndIf}
    ${EndIf}
    Exec '$AncienUninst'
    Quit
  ${EndIf}
FunctionEnd

; ── Dossier d'installation ───────────────────────────────────────────────────────
; Déjà installé : on garde l'emplacement, on ne redemande rien.
Function DirPre
  ${If} $Existante = 1
    Abort
  ${EndIf}
FunctionEnd

; Dossier trop profond (cf. LIMITE_CHEMIN) : « Suivant » reste grisé tant que le chemin saisi est trop long.
Function .onVerifyInstDir
  Push $0
  Push $1
  StrLen $0 $INSTDIR
  StrCpy $1 $INSTDIR 9 -9
  ${If} $1 != "${APP_NAME}"
    IntOp $0 $0 + 10
  ${EndIf}
  Pop $1
  ${If} $0 > ${LIMITE_CHEMIN}
    Pop $0
    Abort
  ${EndIf}
  Pop $0
FunctionEnd

; Le dossier d'une installation NEUVE finit TOUJOURS par « CMS SARIS » : le désinstallateur supprime ce dossier en
; entier, il ne doit jamais pouvoir pointer sur « Documents » ou sur la racine d'un disque. On ne peut pas le faire
; dans la fonction de sortie de la page (NSIS n'y a pas encore mis à jour $INSTDIR avec ce que l'utilisateur a saisi) :
; c'est donc la première section qui s'en charge (aussi pour /D= en silencieux).
Function ForcerSuffixeDossier
  Push $1
  StrCpy $1 $INSTDIR 1 -1
  ${If} $1 == "\"
    StrCpy $INSTDIR $INSTDIR -1
  ${EndIf}
  StrCpy $1 $INSTDIR 9 -9
  ${If} $1 != "${APP_NAME}"
    StrCpy $INSTDIR "$INSTDIR\${APP_NAME}"
  ${EndIf}
  Pop $1
FunctionEnd

; ── Page « Une sauvegarde de ce poste existe » (installation neuve seulement) ───────
Var hRadioRepartir
Var hRadioReprendre

Function PageSauvegarde
  ${If} ${Silent}
  ${OrIf} $Existante = 1
    Abort
  ${EndIf}
  ${If} ${FileExists} "$APPDATA\${APP_NAME}\cms-saris.db"
    Abort
  ${EndIf}
  Call TrouverSauvegarde
  ${If} $SauvegardeTrouvee == ""
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "Une sauvegarde de ce poste a été trouvée" "Faite lors d'une désinstallation ou d'une réinstallation précédente."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 24u "Le $SauvegardeLibelle, la base de ce poste a été sauvegardée. Vous pouvez la reprendre : l'application retrouvera ses données, y compris le travail qui n'avait pas encore été envoyé au serveur."
  Pop $0
  ${NSD_CreateRadioButton} 0 30u 100% 10u "Repartir de zéro (les données seront retéléchargées depuis le serveur)"
  Pop $hRadioRepartir
  ${NSD_AddStyle} $hRadioRepartir ${WS_GROUP}
  ${NSD_CreateRadioButton} 0 44u 100% 10u "Reprendre la sauvegarde du $SauvegardeLibelle"
  Pop $hRadioReprendre
  ${NSD_Check} $hRadioReprendre
  nsDialogs::Show
FunctionEnd

Function PageSauvegardeLeave
  ${NSD_GetState} $hRadioReprendre $0
  ${If} $0 = 1
    StrCpy $RestaurerSauvegarde 1
  ${Else}
    StrCpy $RestaurerSauvegarde 0
  ${EndIf}
FunctionEnd

; ============================================================================
;  SECTIONS (les 4 « parties » → font avancer la 2e barre + le journal)
; ============================================================================

; ── Contrôles de place, filet de sécurité (retour arrière) et vérification ─────────────────────────────────────────
;
; Mise à jour : l'ancienne version n'est pas supprimée, elle est RENOMMÉE « CMS SARIS.ancien » (instantané, même disque),
; la nouvelle s'installe à sa place, puis un contrôle (verifier-installation.cjs) la fait démarrer sur des COPIES des bases.
; Réussi : l'ancienne version est supprimée. Raté, ou installation interrompue : la nouvelle est supprimée et l'ancienne
; remise en place — le poste retrouve exactement la version qu'il avait. Les données du poste (%APPDATA%) ne sont jamais
; touchées par la vérification, donc rien n'est à défaire de ce côté.

Function PlaceInsuffisante   ; $0 = Mo nécessaires, $1 = Mo libres
  DetailPrint "Pas assez de place sur le disque ($1 Mo libres, $0 Mo nécessaires) : rien n'a été installé."
  MessageBox MB_OK|MB_ICONSTOP "Il n'y a pas assez de place sur le disque pour installer CMS SARIS ($1 Mo libres, $0 Mo nécessaires).$\n$\nLibérez de la place ou choisissez un autre disque." /SD IDOK
  SetErrorLevel 8
  Abort "Place insuffisante sur le disque."
FunctionEnd

Function ControlerPlace
  Push $0
  Push $1
  Push $2
  StrCpy $FiletActif 0
  ClearErrors
  StrCpy $0 $INSTDIR 3
  ${DriveSpace} "$0" "/D=F /S=M" $1
  ${If} ${Errors}
    ; Dossier réseau ou lecteur illisible : on ne peut pas mesurer, on ne bloque pas.
    DetailPrint "Place disponible non mesurable : contrôle ignoré."
  ${ElseIf} $Existante = 0
    IntOp $0 ${TAILLE_MB} + 100
    ${If} $1 < $0
      Call PlaceInsuffisante
    ${EndIf}
  ${ElseIf} $Action == "maj"
    StrCpy $2 $INSTDIR 9 -9
    IntOp $0 ${TAILLE_MB} + 300
    ${If} $2 != "${APP_NAME}"
      DetailPrint "Dossier d'installation personnalisé : mise à jour sans retour arrière automatique."
    ${ElseIf} $1 >= $0
      ; Assez de place pour garder l'ancienne version à côté : on la met de côté.
      ${If} ${FileExists} "$INSTDIR.ancien"
        SetDetailsPrint none
        RMDir /r "$INSTDIR.ancien"
        SetDetailsPrint both
      ${EndIf}
      SetOutPath "$TEMP"
      ClearErrors
      Rename "$INSTDIR" "$INSTDIR.ancien"
      ${IfNot} ${Errors}
        StrCpy $FiletActif 1
        DetailPrint "Ancienne version mise de côté : retour arrière automatique si la nouvelle ne passe pas la vérification."
      ${Else}
        DetailPrint "Impossible de mettre l'ancienne version de côté (fichiers utilisés ?) : mise à jour sans retour arrière automatique."
      ${EndIf}
    ${Else}
      ${If} $1 < 300
        StrCpy $0 300
        Call PlaceInsuffisante
      ${EndIf}
      DetailPrint "Pas assez de place pour garder l'ancienne version en secours ($1 Mo libres, $0 Mo nécessaires) : mise à jour sans retour arrière automatique."
      ${IfNot} ${Silent}
        MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Il n'y a pas assez de place pour garder l'ancienne version en secours ($1 Mo libres, $0 Mo nécessaires).$\n$\nVous pouvez continuer SANS retour arrière automatique : si la mise à jour échoue, il faudra réinstaller CMS SARIS (les données de ce poste ne sont pas touchées).$\n$\nContinuer sans filet de sécurité ?" IDYES continuerSansFilet
        Abort "Mise à jour annulée : pas assez de place pour un retour arrière."
        continuerSansFilet:
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; Une mise à jour interrompue (coupure, arrêt brutal) laisse « CMS SARIS.ancien » : c'est la dernière version qui marchait.
; On la remet en place AVANT de recommencer, pour ne jamais repartir d'un dossier à moitié copié.
Function RecupererAncien
  StrCpy $R9 $INSTDIR 9 -9
  ${If} $R9 == "${APP_NAME}"
  ${AndIf} ${FileExists} "$INSTDIR.ancien\${EXE_NAME}"
    DetailPrint "Une mise à jour précédente a été interrompue : retour à la dernière version qui fonctionnait..."
    SetOutPath "$TEMP"
    SetDetailsPrint none
    RMDir /r "$INSTDIR"
    SetDetailsPrint both
    ClearErrors
    Rename "$INSTDIR.ancien" "$INSTDIR"
    ${If} ${Errors}
      DetailPrint "La dernière version qui fonctionnait n'a pas pu être remise en place : elle est dans $INSTDIR.ancien"
    ${Else}
      ; La clé d'inscription pouvait déjà ne plus être cohérente (installation interrompue) : ce dossier EST l'installation existante.
      StrCpy $Existante 1
      StrCpy $AncienDossier $INSTDIR
    ${EndIf}
  ${EndIf}
FunctionEnd

; Retour arrière : la version qui vient d'être copiée est supprimée, l'ancienne remise en place.
Function Retablir
  DetailPrint "Retour à l'ancienne version..."
  ; Le répertoire courant de l'installateur est DANS le dossier à supprimer (SetOutPath) : tant qu'on y reste, Windows
  ; refuse de le supprimer, et le renommage qui suit échoue. On en sort d'abord.
  SetOutPath "$TEMP"
  SetDetailsPrint none
  RMDir /r "$INSTDIR"
  ${If} ${FileExists} "$INSTDIR"
    Sleep 1500
    RMDir /r "$INSTDIR"
  ${EndIf}
  SetDetailsPrint both
  ClearErrors
  Rename "$INSTDIR.ancien" "$INSTDIR"
  ${If} ${Errors}
    DetailPrint "ÉCHEC du retour arrière : l'ancienne version est restée dans $INSTDIR.ancien"
  ${Else}
    ${If} $AncienVersion != ""
      WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "$AncienVersion"
    ${EndIf}
    DetailPrint "L'ancienne version $AncienVersion est remise en place."
  ${EndIf}
  StrCpy $FiletActif 0
FunctionEnd

; Installation interrompue (erreur de copie, disque plein, annulation) : si l'ancienne version a été mise de côté, on la remet.
Function .onInstFailed
  ${If} $FiletActif = 1
    Call Retablir
    MessageBox MB_OK|MB_ICONEXCLAMATION "L'installation n'a pas abouti. L'ancienne version de CMS SARIS a été remise en place : le poste fonctionne comme avant." /SD IDOK
  ${EndIf}
FunctionEnd

; Fait démarrer la version installée sur des COPIES des bases (cf. verifier-installation.cjs) : $VerifOK = 1 si tout va bien.
; ELECTRON_RUN_AS_NODE n'est posé que le temps du contrôle : sinon l'application lancée ensuite (« Lancer CMS SARIS »,
; relance d'une mise à jour automatique) hériterait de la variable et tournerait comme un simple programme Node.
Function VerifierInstallation
  Push $0
  Push $1
  StrCpy $1 ""
  ${If} ${FileExists} "$APPDATA\${APP_NAME}\cms-saris.db"
    StrCpy $1 "$APPDATA\${APP_NAME}\cms-saris.db"
  ${EndIf}
  System::Call 'kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "1")'
  nsExec::ExecToLog '"$INSTDIR\${EXE_NAME}" "$INSTDIR\resources\verifier-installation.cjs" "$INSTDIR" "$1"'
  Pop $0
  System::Call 'kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", p 0)'
  ${If} $0 == "0"
    StrCpy $VerifOK 1
  ${Else}
    StrCpy $VerifOK 0
  ${EndIf}
  Pop $1
  Pop $0
FunctionEnd

; Préparation (cachée, ne compte pas parmi les 4 parties) : « Réinstaller à neuf ».
; Toujours dans cet ordre : sauvegarde d'abord, suppression ensuite — si la sauvegarde échoue, rien n'est supprimé.
Section "-Preparation" SEC_PREP
  ${If} $Existante = 0
    Call ForcerSuffixeDossier
  ${EndIf}
  StrLen $0 $INSTDIR
  ${If} $0 > ${LIMITE_CHEMIN}
    DetailPrint "Chemin d'installation trop long ($0 caractères, ${LIMITE_CHEMIN} au plus) : rien n'a été installé."
    MessageBox MB_OK|MB_ICONSTOP "Le chemin d'installation est trop long ($0 caractères, ${LIMITE_CHEMIN} au plus) :$\n$INSTDIR$\n$\nL'installateur ne sait pas copier tous les fichiers de l'application dans un dossier aussi profond. Choisissez un dossier plus court." /SD IDOK
    SetErrorLevel 7
    Abort "Chemin d'installation trop long."
  ${EndIf}
  Call RecupererAncien
  Call ControlerPlace
  ${If} $Existante = 1
  ${AndIf} $Action == "neuf"
    DetailPrint "Réinstallation à neuf : sauvegarde de la base de ce poste..."
    Call SauvegarderBase
    ${If} $SauvEtat == "erreur"
      DetailPrint "La sauvegarde a échoué : rien n'a été supprimé."
      MessageBox MB_OK|MB_ICONSTOP "La sauvegarde de la base de ce poste a échoué : rien n'est supprimé, l'installation est interrompue." /SD IDOK
      SetErrorLevel 6
      Abort "Sauvegarde impossible : rien n'a été supprimé."
    ${EndIf}
    ${If} $SauvEtat == "ok"
      DetailPrint "Sauvegarde faite : $SauvChemin.db"
    ${Else}
      DetailPrint "Aucune base locale à sauvegarder."
    ${EndIf}
    DetailPrint "Suppression de l'ancienne installation..."
    StrCpy $R8 $AncienDossier
    ${If} $R8 == ""
      StrCpy $R8 $INSTDIR
    ${EndIf}
    ExecWait '$AncienUninst /S /PURGE /SANSSAUVEGARDE _?=$R8' $0
    DetailPrint "Ancienne installation supprimée (code $0)."
  ${EndIf}
SectionEnd

Section "Application & interface" SEC_APP
  !insertmacro STEP "Application & interface (Electron + React)"
  ; Mise à jour par-dessus une installation : on retire d'abord l'ancien contenu de l'application. Sans cela,
  ; les fichiers qui n'existent plus dans la nouvelle version restaient sur le disque. Les données de ce poste
  ; (%APPDATA%\CMS SARIS) ne sont pas dans ce dossier : elles ne sont pas touchées.
  ${If} ${FileExists} "$INSTDIR\${EXE_NAME}"
    DetailPrint "Nettoyage de l'ancienne version (les données de ce poste sont conservées)..."
    SetDetailsPrint none
    RMDir /r "$INSTDIR\resources"
    RMDir /r "$INSTDIR\locales"
    SetDetailsPrint both
  ${EndIf}
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
  !ifdef ESSAI_ECHEC
    ; Compilation d'ESSAI seulement (-DESSAI_ECHEC) : simule une installation qui échoue en cours de route.
    Abort "Échec simulé (essai)."
  !endif
  !insertmacro STEP_DONE
SectionEnd

Section "Moteur de base de donnees (Prisma SQLite)" SEC_DB_ENGINE
  !insertmacro STEP "Moteur Prisma + client SQLite"
  SetOutPath "$INSTDIR\resources\sqlite-client"
  File /r "${SRCDIR}\resources\sqlite-client\*"
  ; Migrations de la base locale : sans elles, un poste MIS À JOUR ne met pas sa base à niveau (un poste neuf
  ; n'en a pas besoin : il part de seed.db). Elles manquaient jusqu'à la 1.10.0.
  SetOutPath "$INSTDIR\resources\sqlite-migrations"
  File /r "${SRCDIR}\resources\sqlite-migrations\*"
  !insertmacro STEP_DONE
SectionEnd

Section "Base locale + raccourcis" SEC_FINAL
  !insertmacro STEP "Base de donnees locale + raccourcis"
  SetOutPath "$INSTDIR\resources"
  File "${SRCDIR}\resources\seed.db"
  File "verifier-installation.cjs"

  ${If} $RestaurerSauvegarde = 1
    Call RestaurerBase
  ${EndIf}

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

; Écran de santé : la version installée démarre-t-elle, ici, sur CE poste ? (cf. verifier-installation.cjs)
; Réussi : l'ancienne version mise de côté est supprimée. Raté : retour arrière si l'ancienne version a été gardée.
Section "-Verification" SEC_VERIF
  DetailPrint ""
  DetailPrint "================  Verification de l'installation (sur des copies)  ================"
  Call VerifierInstallation
  ${If} $VerifOK = 1
    DetailPrint "Verification reussie : CMS SARIS est pret."
    ${If} $FiletActif = 1
      DetailPrint "Suppression de l'ancienne version mise de cote..."
      SetDetailsPrint none
      RMDir /r "$INSTDIR.ancien"
      SetDetailsPrint both
      StrCpy $FiletActif 0
    ${EndIf}
  ${Else}
    ${If} $FiletActif = 1
      DetailPrint "La verification a echoue : retour automatique a l'ancienne version."
      Call Retablir
      MessageBox MB_OK|MB_ICONEXCLAMATION "La nouvelle version ne démarre pas correctement sur ce poste (voir le détail de la vérification).$\n$\nL'ancienne version a été remise en place : le poste fonctionne comme avant. Ses données n'ont pas été touchées." /SD IDOK
      SetErrorLevel 9
      Abort "Mise à jour annulée : la nouvelle version ne passe pas la vérification."
    ${Else}
      DetailPrint "ATTENTION : la verification a signale un probleme (voir ci-dessus)."
      MessageBox MB_OK|MB_ICONEXCLAMATION "L'installation est terminée, mais la vérification a signalé un problème (voir le détail ci-dessus).$\n$\nCMS SARIS risque de ne pas démarrer correctement sur ce poste." /SD IDOK
      SetErrorLevel 9
    ${EndIf}
  ${EndIf}
SectionEnd

; ============================================================================
;  DÉSINSTALLATION
;  Les données de ce poste (base locale, configuration) sont CONSERVÉES par défaut : elles peuvent contenir du
;  travail pas encore envoyé au serveur. On ne les supprime que si on le demande (case à cocher, ou /PURGE en
;  silencieux) — et alors une sauvegarde est faite avant (sauf /SANSSAUVEGARDE : l'installateur l'a déjà faite).
; ============================================================================
Function un.onInit
  StrCpy $PurgerDonnees 0
  StrCpy $SansSauvegarde 0
  ClearErrors
  ${un.GetOptions} $CMDLINE "/PURGE" $0
  ${IfNot} ${Errors}
    StrCpy $PurgerDonnees 1
  ${EndIf}
  ClearErrors
  ${un.GetOptions} $CMDLINE "/SANSSAUVEGARDE" $0
  ${IfNot} ${Errors}
    StrCpy $SansSauvegarde 1
  ${EndIf}

  Call un.AppEnCours
  ${If} $AppOuverte = 1
    ${If} ${Silent}
      StrCpy $R8 $INSTDIR
      Call un.LancerFermeture
      StrCpy $R7 90
      Call un.AttendreFermeture
      ${If} $AppOuverte = 1
        SetErrorLevel 5
        Abort
      ${EndIf}
    ${Else}
      MessageBox MB_YESNOCANCEL|MB_ICONEXCLAMATION "CMS SARIS est ouvert.$\n$\nOui : le fermer pour moi (le travail restant est d'abord envoyé au serveur)$\nNon : je le ferme moi-même, puis je réessaie$\nAnnuler : quitter" IDYES uFermerPourMoi IDNO uReessayer
      Abort
      uFermerPourMoi:
        StrCpy $R8 $INSTDIR
        Call un.LancerFermeture
        StrCpy $R7 90
        Call un.AttendreFermeture
        Goto uVerifier
      uReessayer:
        Call un.AppEnCours
      uVerifier:
        ${If} $AppOuverte = 1
          MessageBox MB_OK|MB_ICONSTOP "CMS SARIS est toujours ouvert. Fermez-le (barre des tâches comprise) puis relancez la désinstallation."
          Abort
        ${EndIf}
    ${EndIf}
  ${EndIf}
FunctionEnd

Var hCaseSupprimer

Function un.PageDonnees
  !insertmacro MUI_HEADER_TEXT "Données de ce poste" "Que faire de la base locale et de la configuration de ce poste ?"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  Call un.MesurerDonnees
  Call un.FormulerEnAttente
  ${If} $TailleDonnees != ""
    ${NSD_CreateLabel} 0 0 100% 9u "Données de ce poste : $TailleDonnees"
  ${Else}
    ${NSD_CreateLabel} 0 0 100% 9u "Données de ce poste : aucune base locale trouvée"
  ${EndIf}
  Pop $0
  ${NSD_CreateLabel} 0 10u 100% 18u "Travail pas encore envoyé au serveur : $TexteEnAttente"
  Pop $hLblEnAttente
  ${If} $EnAttente != "0"
    SetCtlColors $hLblEnAttente "B42318" "transparent"
  ${EndIf}
  ${NSD_CreateCheckBox} 0 36u 100% 18u "Supprimer aussi les données de ce poste (une sauvegarde est faite avant)"
  Pop $hCaseSupprimer
  ${NSD_CreateLabel} 0 58u 100% 28u "Si vous les conservez, une réinstallation de CMS SARIS retrouvera ce poste tel qu'il était, sans rien retélécharger. Si vous les supprimez, la sauvegarde est rangée dans :$\r$\n$LOCALAPPDATA\${APP_NAME} Sauvegardes"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function un.PageDonneesLeave
  ${NSD_GetState} $hCaseSupprimer $0
  ${If} $0 = 1
    StrCpy $PurgerDonnees 1
    ${If} $EnAttente != "0"
      MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Du travail n'est peut-être pas encore parti vers le serveur : $TexteEnAttente.$\n$\nUne sauvegarde de la base sera faite avant la suppression. Supprimer quand même les données de ce poste ?" IDYES uOui
      StrCpy $PurgerDonnees 0
      Abort
      uOui:
    ${EndIf}
  ${Else}
    StrCpy $PurgerDonnees 0
  ${EndIf}
FunctionEnd

Section "Uninstall"
  ; Données de ce poste : sauvegarde AVANT toute suppression ; si elle échoue, on les garde.
  ${If} $PurgerDonnees = 1
  ${AndIf} $SansSauvegarde = 0
    DetailPrint "Sauvegarde de la base de ce poste..."
    Call un.SauvegarderBase
    ${If} $SauvEtat == "erreur"
      DetailPrint "La sauvegarde a échoué : les données de ce poste sont conservées."
      StrCpy $PurgerDonnees 0
    ${ElseIf} $SauvEtat == "ok"
      DetailPrint "Sauvegarde faite : $SauvChemin.db"
    ${EndIf}
  ${EndIf}

  DetailPrint "Suppression des fichiers de l'application..."
  ${If} ${FileExists} "$INSTDIR\${EXE_NAME}"
    ; Un dossier qui porte le nom de l'application est supprimé en entier. Sinon (installation d'une version plus
    ; ancienne dans un dossier au choix), on ne retire que ce qui appartient à l'application : jamais un dossier
    ; qui pourrait contenir autre chose.
    StrCpy $1 $INSTDIR 9 -9
    SetDetailsPrint none
    ${If} $1 == "${APP_NAME}"
      RMDir /r "$INSTDIR"
    ${Else}
      RMDir /r "$INSTDIR\resources"
      RMDir /r "$INSTDIR\locales"
      Delete "$INSTDIR\${EXE_NAME}"
      Delete "$INSTDIR\*.pak"
      Delete "$INSTDIR\*.dll"
      Delete "$INSTDIR\*.dat"
      Delete "$INSTDIR\*.bin"
      Delete "$INSTDIR\vk_swiftshader_icd.json"
      Delete "$INSTDIR\LICENSE*"
      Delete "$INSTDIR\Uninstall CMS SARIS.exe"
      RMDir "$INSTDIR"
    ${EndIf}
    SetDetailsPrint both
  ${EndIf}

  DetailPrint "Suppression des raccourcis..."
  Delete "$DESKTOP\CMS SARIS.lnk"
  RMDir /r "$SMPROGRAMS\CMS SARIS"

  ${If} $PurgerDonnees = 1
    DetailPrint "Suppression des donnees locales (base synchronisee, config)..."
    Delete "$APPDATA\CMS SARIS\cms-saris.db"
    Delete "$APPDATA\CMS SARIS\cms-saris.db-wal"
    Delete "$APPDATA\CMS SARIS\cms-saris.db-shm"
    Delete "$APPDATA\CMS SARIS\cms-saris.db-journal"
    RMDir /r "$APPDATA\CMS SARIS"
    RMDir /r "$LOCALAPPDATA\CMS SARIS"
  ${Else}
    DetailPrint "Donnees de ce poste conservees dans : $APPDATA\CMS SARIS"
  ${EndIf}

  DetailPrint "Nettoyage du registre..."
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "${INSTALL_KEY}"
SectionEnd
