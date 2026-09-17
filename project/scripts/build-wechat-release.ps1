param(
  [string]$CocosCreatorPath = $env:COCOS_CREATOR_PATH
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$repoRoot = Split-Path -Parent $projectRoot
$buildRoot = Join-Path $projectRoot 'build\wechatgame'
$artifactsRoot = Join-Path $repoRoot 'artifacts'
$stdoutPath = Join-Path $artifactsRoot 'cocos-build-wechat-release.stdout.log'
$stderrPath = Join-Path $artifactsRoot 'cocos-build-wechat-release.stderr.log'

if (-not $CocosCreatorPath) {
  $CocosCreatorPath = 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe'
}

if (-not (Test-Path -LiteralPath $CocosCreatorPath)) {
  throw "Cocos Creator not found: $CocosCreatorPath"
}

New-Item -ItemType Directory -Path $artifactsRoot -Force | Out-Null

$startedAt = Get-Date
$process = Start-Process `
  -FilePath $CocosCreatorPath `
  -ArgumentList @('--project', $projectRoot, '--build', 'platform=wechatgame') `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru `
  -Wait

$latestLog = Get-ChildItem (Join-Path $projectRoot 'temp\builder\log') -File -Filter 'wechatgame*.log' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $latestLog -or $latestLog.LastWriteTime -lt $startedAt.AddSeconds(-5)) {
  throw "Release build log was not updated. Launcher exit code: $($process.ExitCode)"
}

$buildFinished = Select-String -Path $latestLog.FullName -SimpleMatch 'build Task (wechatgame) Finished' -Quiet
if (-not $buildFinished) {
  throw "Release build did not finish successfully. Log: $($latestLog.FullName)"
}

& node (Join-Path $PSScriptRoot 'apply-wechatgame-appid.mjs')
if ($LASTEXITCODE -ne 0) {
  throw "AppID injection failed with exit code $LASTEXITCODE"
}

$generatedConfig = Get-Content -Raw -Encoding UTF8 (Join-Path $buildRoot 'project.config.json') | ConvertFrom-Json
$engineFile = Get-Item (Join-Path $buildRoot 'cocos-js\cc.js')
$totalBytes = (Get-ChildItem -Recurse -File $buildRoot | Measure-Object Length -Sum).Sum

[pscustomobject]@{
  success = $true
  launcherExitCode = $process.ExitCode
  log = $latestLog.FullName
  appid = $generatedConfig.appid
  engine = $engineFile.FullName
  engineBytes = $engineFile.Length
  totalBytes = $totalBytes
} | ConvertTo-Json
