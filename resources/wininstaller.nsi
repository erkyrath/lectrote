; NSIS installer-creator for Lectrote
; To use:
;   makensis resources/wininstaller.nsi

; based on the example at:
;   https://nsis.sourceforge.io/Examples/Modern%20UI/Basic.nsi

;--------------------------------
;Include Modern UI

; see: "/opt/homebrew/share/nsis/Contrib/Modern UI 2/MUI2.nsh"

  !include "MUI2.nsh"

;--------------------------------
;General

  ;Name and file
  Name "Lectrote for Windows"
  OutFile "..\dist\Install Lectrote.exe"
  Unicode True

  ;Default installation folder
  InstallDir "$LOCALAPPDATA\Lectrote"
  
  ;Get installation folder from registry if available
  InstallDirRegKey HKCU "Software\Lectrote" ""

  ;Request application privileges for Windows Vista
  RequestExecutionLevel user

;--------------------------------
;Interface Settings

  !define MUI_ABORTWARNING

;--------------------------------
;Pages

  ; !insertmacro MUI_PAGE_LICENSE "..."
  !insertmacro MUI_PAGE_COMPONENTS
  !insertmacro MUI_PAGE_DIRECTORY
  !insertmacro MUI_PAGE_INSTFILES
  
  !insertmacro MUI_UNPAGE_CONFIRM
  !insertmacro MUI_UNPAGE_INSTFILES
  
;--------------------------------
;Languages
 
  !insertmacro MUI_LANGUAGE "English"

;--------------------------------
;Installer Sections

Section "Lectrote" SecMain

  SectionIn RO
  SetOutPath "$INSTDIR"
  
  File /r "wininstall-link\*.*"
  
  ;Store installation folder
  WriteRegStr HKCU "Software\Lectrote" "" $INSTDIR
  
  ;Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall Lectrote.exe"

SectionEnd

;--------------------------------
;Descriptions

  ;Language strings
  LangString DESC_SecMain ${LANG_ENGLISH} "Lectrote"

  ;Assign language strings to sections
  !insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} $(DESC_SecMain)
  !insertmacro MUI_FUNCTION_DESCRIPTION_END

;--------------------------------
;Uninstaller Section

Section "Uninstall"

  ; Note that we install "*.*", but delete files/dirs explicitly. This
  ; is because I'm nervous about wildcard deletion. If Electron changes
  ; its install setup, we might need to update this list.
  
  Delete "$INSTDIR\Lectrote.exe"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.bin"
  Delete "$INSTDIR\*.dat"
  Delete "$INSTDIR\*.txt"
  Delete "$INSTDIR\*.html"
  Delete "$INSTDIR\*.json"
  Delete "$INSTDIR\*.pak"
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"

  Delete "$INSTDIR\Uninstall Lectrote.exe"

  RMDir "$INSTDIR"

  DeleteRegKey /ifempty HKCU "Software\Lectrote"

SectionEnd