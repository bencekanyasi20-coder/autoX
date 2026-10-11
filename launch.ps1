param([string]$NodePath)
$ErrorActionPreference = 'Stop'
$appUrl = 'http://127.0.0.1:4317'
$appNode = $NodePath
if (-not $appNode) {
  $installedNode = Get-Command node -ErrorAction SilentlyContinue
  if ($installedNode) { $appNode = $installedNode.Source }
  else { $appNode = & (Join-Path $PSScriptRoot 'download.ps1') -PrepareOnly }
}
$nodeMajor = [int]((& $appNode --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24) { throw 'Node.js 24 or newer is required. Run download.cmd to use the pinned runtime.' }
$running = $false
try {
  $health = Invoke-RestMethod "$appUrl/health" -TimeoutSec 2
  if ($health.app -ne 'xauto') { throw 'A portot mas alkalmazas hasznalja.' }
  $running = $true
} catch {
  if ($_.Exception.Message -like '*mas alkalmazas*') { throw }
}
if (-not $running) {
  $appData = Join-Path $env:LOCALAPPDATA 'Xauto'
  New-Item -ItemType Directory -Path $appData -Force | Out-Null
  Start-Process -FilePath $appNode -ArgumentList ('"' + (Join-Path $PSScriptRoot 'server.mjs') + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $appData 'server.log') -RedirectStandardError (Join-Path $appData 'server-error.log') | Out-Null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { $health = Invoke-RestMethod "$appUrl/health" -TimeoutSec 1; if ($health.app -eq 'xauto') { $running = $true; break } } catch { }
    Start-Sleep -Milliseconds 200
  }
  if (-not $running) { throw "Az alkalmazas nem indult el. Naplo: $appData\server-error.log" }
}
Start-Process $appUrl
