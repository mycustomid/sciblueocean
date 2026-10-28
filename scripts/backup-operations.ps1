param([string]$Destination)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimePython = Join-Path $projectRoot '.venv-operations\Scripts\python.exe'
$sourceDb = Join-Path $projectRoot 'operations-server\private\operations.sqlite3'
if (!$Destination) { $Destination = Join-Path $projectRoot ('operations-server\private\backups\operations-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sqlite3') }
if (!(Test-Path -LiteralPath $sourceDb)) { throw 'Operational database does not exist.' }
$backupDir = Split-Path -Parent $Destination
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
& $runtimePython (Join-Path $PSScriptRoot 'backup_operations.py') $sourceDb $Destination
if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed.' }
Write-Output "Backup verified: $Destination"
