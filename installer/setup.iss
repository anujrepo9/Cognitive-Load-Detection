; setup.iss — Inno Setup 6 installer script for CogniLoad
;
; Prerequisites:
;   1. Run PyInstaller:  pyinstaller cogniload.spec
;   2. This script bundles:  dist\CogniLoad\**
;   3. Install Inno Setup 6 from https://jrsoftware.org/isinfo.php
;   4. Compile:  iscc installer\setup.iss
;   Output:  installer\Output\CogniLoad_Setup_1.0.0.exe

#define AppName      "CogniLoad"
#define AppVersion   "1.0.0"
#define AppPublisher "Your Organization"
#define AppURL       "https://github.com/yourorg/cognitive-load-detection"
#define AppExeName   "CogniLoad.exe"
#define SourceDir    "..\dist\CogniLoad"

[Setup]
AppId={{A3F9B2C1-4E7D-4F8A-9B3C-D2E5F6A7B8C9}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE.txt
OutputDir=Output
OutputBaseFilename=CogniLoad_Setup_{#AppVersion}
SetupIconFile=..\resources\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}
ChangesAssociations=no
; Allow users without admin rights to install to their own AppData
PrivilegesRequiredOverridesAllowed=commandline dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon";    Description: "{cm:CreateDesktopIcon}";    GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupicon";    Description: "Start CogniLoad when Windows starts"; GroupDescription: "System:"; Flags: unchecked

[Files]
; Main application files (PyInstaller output)
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; VC++ redistributables are usually bundled by PyInstaller, but include just in case
; Source: "redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\{#AppName}";        Filename: "{app}\{#AppExeName}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}";  Filename: "{app}\{#AppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#AppName}";  Filename: "{app}\{#AppExeName}"; Tasks: startupicon

[Run]
; Open the app after installation completes
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Kill running instances before uninstall
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM {#AppExeName}"; Flags: runhidden

[Registry]
; Optional: Add to Add/Remove Programs "Support Information"
Root: HKLM; Subkey: "Software\Microsoft\Windows\CurrentVersion\Uninstall\{#AppName}"; ValueType: string; ValueName: "URLInfoAbout"; ValueData: "{#AppURL}"; Flags: uninsdeletekey

[Dirs]
; Create a user-writable data directory alongside the app for logs/db
Name: "{userappdata}\{#AppName}"; Flags: uninsneveruninstall

[Messages]
BeveledLabel=CogniLoad — AI Cognitive Load Detection

[Code]
// Check if a previous version is running and offer to close it
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  if CheckForMutexes('CogniLoadRunning') then
  begin
    if MsgBox('CogniLoad is currently running. Close it and continue?',
              mbConfirmation, MB_YESNO) = IDYES then
    begin
      Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM CogniLoad.exe',
           '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Sleep(1000);
    end else begin
      Result := False;
      Exit;
    end;
  end;
  Result := True;
end;
