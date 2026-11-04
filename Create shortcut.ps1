$ErrorActionPreference = 'Stop'
$projectFolder = $PSScriptRoot
$shortcutFile = Join-Path $projectFolder 'PDF Desk.lnk'
$shellObject = New-Object -ComObject WScript.Shell
$shortcut = $shellObject.CreateShortcut($shortcutFile)
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32/wscript.exe'
$shortcut.Arguments = '//nologo "' + (Join-Path $projectFolder 'Launch PDF Desk.vbs') + '"'
$shortcut.WorkingDirectory = $projectFolder
$shortcut.Description = 'Open PDF Desk in your browser'
$shortcut.IconLocation = (Join-Path $projectFolder 'public\pdf-desk.ico') + ',0'
$shortcut.Save()
Write-Output "Created $shortcutFile"
