param(
  [string]$ClientName = 'Codex'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$repoRoot = Split-Path -Parent $projectRoot
$buildPath = Join-Path $projectRoot 'build\wechatgame'
$artifactPath = Join-Path $repoRoot 'artifacts\wechat-simulator-initial.png'

$evaluateSource = 'function(){ var context=GameGlobal.__gameContextWindow; if(!context){ return { waiting:true }; } var canvas=context.screencanvas; var dataUrl=canvas.toDataURL(); var slash=String.fromCharCode(47); var name=String.fromCharCode(115,104,111,116,46,112,110,103); var base64Name=String.fromCharCode(98,97,115,101,54,52); var comma=String.fromCharCode(44); var base64=dataUrl.slice(dataUrl.indexOf(comma)+1); var path=wx.env.USER_DATA_PATH+slash+name; wx.getFileSystemManager().writeFileSync(path,base64,base64Name); return { path:path, base64Length:base64.length }; }'

$evaluateSucceeded = $false
$resultText = ''
for ($attempt = 1; $attempt -le 10; $attempt += 1) {
  $result = & wechatide -c $ClientName automation_evaluate `
    --project $buildPath `
    --fn-source $evaluateSource
  $resultText = $result -join "`n"

  $failed = $LASTEXITCODE -ne 0 -or $resultText -match '"ok"\s*:\s*false'
  $waiting = $resultText -match '"waiting"\s*:\s*true'
  if (-not $failed -and -not $waiting) {
    $evaluateSucceeded = $true
    break
  }

  if ($attempt -lt 10) {
    Start-Sleep -Seconds 1
  }
}

if (-not $evaluateSucceeded) {
  throw "wechatide automation_evaluate failed: $resultText"
}

$simulatorRoots = Get-ChildItem -Path $env:LOCALAPPDATA -Directory -Force -ErrorAction SilentlyContinue |
  ForEach-Object { Join-Path $_.FullName 'User Data' } |
  Where-Object { Test-Path -LiteralPath $_ }

$candidateFiles = @()
foreach ($simulatorRoot in $simulatorRoots) {
  $candidateFiles += Get-ChildItem -Path $simulatorRoot -Recurse -File -Filter 'shot.png' -Force -ErrorAction SilentlyContinue
}

$source = $candidateFiles |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $source) {
  throw 'Simulator screenshot file was not found.'
}

$artifactDir = Split-Path -Parent $artifactPath
New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
Copy-Item -LiteralPath $source.FullName -Destination $artifactPath -Force

Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($artifactPath)
try {
  [pscustomobject]@{
    success = $true
    source = $source.FullName
    artifact = $artifactPath
    width = $image.Width
    height = $image.Height
    bytes = (Get-Item -LiteralPath $artifactPath).Length
  } | ConvertTo-Json
} finally {
  $image.Dispose()
}
