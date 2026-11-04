$ErrorActionPreference = 'Stop'
$serverFile = Join-Path $PSScriptRoot 'server.mjs'
$servers = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('"' + $serverFile + '"') }
if (-not $servers) { Write-Output 'No PDF Desk launcher process is running from this folder.'; exit }
foreach ($serverProcess in $servers) { Stop-Process -Id $serverProcess.ProcessId; Write-Output ('Stopped PDF Desk (process ' + $serverProcess.ProcessId + ').') }
