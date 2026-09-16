#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Asar,
  [switch]$Unpatch,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$Userscript = Join-Path $RepoRoot 'opencode-a11y-announcer.user.js'
$InjectName = 'oc-a11y.js'

function Get-AsarPath {
  if ($Asar) { return $Asar }
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\OpenCode\resources\app.asar'),
    (Join-Path $env:LOCALAPPDATA 'Programs\opencode\resources\app.asar'),
    (Join-Path $env:LOCALAPPDATA 'Programs\opencode-desktop\resources\app.asar'),
    (Join-Path $env:LOCALAPPDATA 'Programs\OpenCode Beta\resources\app.asar'),
    (Join-Path $env:LOCALAPPDATA 'Programs\OpenCode Dev\resources\app.asar'),
    (Join-Path $env:PROGRAMFILES 'OpenCode\resources\app.asar'),
    (Join-Path $env:PROGRAMFILES 'opencode\resources\app.asar')
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return ''
}

$ResolvedAsar = Get-AsarPath
if (-not $ResolvedAsar) {
  Write-Error 'Could not find app.asar. Pass -Asar PATH.'
  exit 1
}
if (-not (Test-Path $ResolvedAsar)) {
  Write-Error "app.asar not found: $ResolvedAsar"
  exit 1
}

$Backup = "$ResolvedAsar.bak"
$Unpacked = $ResolvedAsar -replace 'app\.asar$', 'app.asar.unpacked'

if ($Unpatch) {
  if (-not (Test-Path $Backup)) {
    Write-Error "No backup found at $Backup; nothing to restore."
    exit 1
  }
  Copy-Item -Force $Backup $ResolvedAsar
  Write-Host "Restored $ResolvedAsar from backup."
  exit 0
}

if (-not (Test-Path $Userscript)) {
  Write-Error "Userscript not found: $Userscript"
  exit 1
}

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Error 'npx not found; Node.js is required (for @electron/asar).'
  exit 1
}

if ((Test-Path $Unpacked) -and (Get-ChildItem -Force $Unpacked | Select-Object -First 1) -and (-not $Force)) {
  Write-Error "app.asar.unpacked is non-empty ($Unpacked). Repacking would break unpacked native modules. Re-run with -Force if you are sure."
  exit 1
}

if (-not (Test-Path $Backup)) {
  Copy-Item $ResolvedAsar $Backup
  Write-Host "Backup created: $Backup"
}

$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("oc-a11y-" + [System.Guid]::NewGuid().ToString('N'))
$AppDir = Join-Path $Tmp 'app'
New-Item -ItemType Directory -Path $AppDir -Force | Out-Null

try {
  Write-Host "Extracting $ResolvedAsar"
  & npx --yes @electron/asar extract $ResolvedAsar $AppDir
  if ($LASTEXITCODE -ne 0) { throw "asar extract failed" }

  $Renderer = Join-Path $AppDir 'out\renderer'
  $Index = Join-Path $Renderer 'index.html'
  if (-not (Test-Path $Index)) {
    throw "Renderer index.html not found at $Index; unexpected package layout."
  }

  Copy-Item -Force $Userscript (Join-Path $Renderer $InjectName)

  $Injector = @'
const fs = require("fs")
const file = process.argv[2]
const name = process.argv[3]
let html = fs.readFileSync(file, "utf8")
if (html.includes(name)) {
  console.log("Script tag already present; leaving index.html unchanged.")
  process.exit(0)
}
const tag = '<script src="./' + name + '"></script>'
if (/<\/body>/i.test(html)) {
  html = html.replace(/<\/body>/i, tag + "\n</body>")
} else if (/<\/html>/i.test(html)) {
  html = html.replace(/<\/html>/i, tag + "\n</html>")
} else {
  html += "\n" + tag + "\n"
}
fs.writeFileSync(file, html)
console.log("Injected script tag into out/renderer/index.html")
'@

  $Injector | & node - $Index $InjectName
  if ($LASTEXITCODE -ne 0) { throw "index.html injection failed" }

  Write-Host "Repacking $ResolvedAsar"
  & npx --yes @electron/asar pack $AppDir $ResolvedAsar
  if ($LASTEXITCODE -ne 0) { throw "asar pack failed" }

  Write-Host "Done. Start the opencode desktop app."
  Write-Host "Re-run this script after each opencode update (the installer overwrites app.asar)."
} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
