param([switch]$SkipGitCheck)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceRoot = Split-Path -Parent $root
$sources = @{
  'fake-artist-new-york' = Join-Path $sourceRoot 'fake-artist-new-york'
  'fake-painter' = Join-Path $sourceRoot 'fake-painter'
  'pick-one-for-me' = Join-Path $sourceRoot 'pick-one-for-me'
  'spyfall' = Join-Path $sourceRoot 'SPYFALL'
  'werewords-companion' = Join-Path (Split-Path $sourceRoot) 'werewords-companion'
}
$excluded = @('.git','node_modules','.openai','_site_stage','dist','*.tar.gz')
foreach ($name in $sources.Keys) {
  $source = $sources[$name]
  if (!(Test-Path -LiteralPath $source)) { throw "Missing source: $source" }
  $destination = Join-Path $root "games\$name"
  New-Item -ItemType Directory -Force -Path $destination | Out-Null
  Get-ChildItem -LiteralPath $destination -Force | Remove-Item -Recurse -Force
  Get-ChildItem -LiteralPath $source -Force | Where-Object { $excluded -notcontains $_.Name } | Copy-Item -Destination $destination -Recurse -Force
}
Write-Output 'Synchronized five independent game snapshots.'
