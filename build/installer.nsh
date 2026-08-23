; Assisted NSIS: skip Win7 SHGetKnownFolderPath / System::Store in multiUser.nsh.
; That call crashes on current Windows (electron-builder issues #7921 and #8536):
; first launch often dies in .onInit (looks like "nothing opened"), Next then
; crashes System.dll. If HKCU InstallLocation is already set, that path is skipped.
; Directory page still lets the user change $INSTDIR.
; https://www.electron.build/nsis
; https://github.com/electron-userland/electron-builder/issues/8536

!macro preInit
  SetRegView 64
  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $0 == ""
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\${APP_FILENAME}"
  ${EndIf}
!macroend
