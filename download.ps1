param([switch]$PrepareOnly)
$ErrorActionPreference = 'Stop'
# Official Node.js release, pinned and checked before extraction/execution.
$version = '24.21.0'
$expectedHash = '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'
if (-not [Environment]::Is64BitOperatingSystem) { throw 'autoX requires 64-bit Windows.' }
$runtimeDirectory = Join-Path $PSScriptRoot '.runtime'
$archive = Join-Path $runtimeDirectory "node-v$version-win-x64.zip"
$runtimeNode = Join-Path $runtimeDirectory "node-v$version-win-x64\node.exe"
if (-not (Test-Path -LiteralPath $runtimeNode)) {
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    Write-Host "Downloading Node.js $version from nodejs.org..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v$version/node-v$version-win-x64.zip" -OutFile $archive
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
        throw 'Node.js checksum mismatch. Nothing was extracted or started.'
    }
    Expand-Archive -LiteralPath $archive -DestinationPath $runtimeDirectory -Force
}
if ($PrepareOnly) { Write-Output $runtimeNode; exit 0 }
& (Join-Path $PSScriptRoot 'launch.ps1') -NodePath $runtimeNode
