param([int]$Port = 8766)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimePython = Join-Path $projectRoot '.venv-operations\Scripts\python.exe'
$serverEntry = Join-Path $projectRoot 'operations-server\app.py'
if (!(Test-Path -LiteralPath $runtimePython)) { throw 'Install operations-server/requirements.txt in .venv-operations first.' }
$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($listener) {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/booking/health" -TimeoutSec 5
    if ($health.mode -ne 'OPERATIONS_LOCAL') { throw "Port $Port belongs to a different service." }
    Write-Output "Operations already running: http://127.0.0.1:$Port/studio/"
    exit 0
}
$privateDir = Join-Path $projectRoot 'operations-server\private'
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$serverProcess = Start-Process -FilePath $runtimePython -ArgumentList @($serverEntry, 'serve', '--port', $Port) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $privateDir 'server.log') -RedirectStandardError (Join-Path $privateDir 'server-error.log') -PassThru
Write-Output "Operations PID $($serverProcess.Id): http://127.0.0.1:$Port/studio/"
$started = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if ($serverProcess.HasExited) { throw 'Operations server exited. Check operations-server/private/server-error.log.' }
    try {
        $ready = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/booking/health" -TimeoutSec 1
        if ($ready.mode -eq 'OPERATIONS_LOCAL') { $started = $true; break }
    } catch { Start-Sleep -Milliseconds 200 }
}
if (!$started) { throw 'Operations server did not become healthy.' }
$legacyListener = Get-NetTCPConnection -State Listen -LocalPort 8765 -ErrorAction SilentlyContinue
if (!$legacyListener) {
    Start-Process -FilePath $runtimePython -ArgumentList (Join-Path $projectRoot 'scripts\legacy-local-redirect.py') -WorkingDirectory $projectRoot -WindowStyle Hidden
}
