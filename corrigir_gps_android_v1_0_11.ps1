$ErrorActionPreference = 'Stop'

$project = 'C:\disbgestao-git'
$manifest = Join-Path $project 'android\app\src\main\AndroidManifest.xml'

if (-not (Test-Path $manifest)) {
  throw "AndroidManifest.xml nao encontrado em: $manifest"
}

Write-Host '1/4 - Sincronizando plugin de geolocalizacao...' -ForegroundColor Cyan
Set-Location $project
npm install @capacitor/geolocation --save
if ($LASTEXITCODE -ne 0) { throw 'Falha no npm install @capacitor/geolocation.' }

npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Falha no npx cap sync android.' }

Write-Host '2/4 - Aplicando permissoes no AndroidManifest.xml...' -ForegroundColor Cyan
$xml = Get-Content $manifest -Raw

$permissions = @(
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION'
)

foreach ($permission in $permissions) {
  if ($xml -notmatch [regex]::Escape('android:name="' + $permission + '"')) {
    $line = '    <uses-permission android:name="' + $permission + '" />'
    $xml = [regex]::Replace(
      $xml,
      '(?m)^\s*<application\b',
      $line + "`r`n" + '$0',
      1
    )
  }
}

Set-Content -Path $manifest -Value $xml -Encoding utf8

Write-Host '3/4 - Verificando permissoes declaradas...' -ForegroundColor Cyan
$found = Select-String -Path $manifest -Pattern 'ACCESS_COARSE_LOCATION|ACCESS_FINE_LOCATION'
$found | ForEach-Object { Write-Host $_.Line.Trim() -ForegroundColor Green }

if (($found | Measure-Object).Count -lt 2) {
  throw 'As duas permissoes de localizacao nao foram encontradas no AndroidManifest.xml.'
}

Write-Host '4/4 - Verificando plugin Android...' -ForegroundColor Cyan
$gradleFiles = @(
  (Join-Path $project 'android\capacitor.settings.gradle'),
  (Join-Path $project 'android\app\capacitor.build.gradle')
) | Where-Object { Test-Path $_ }

$pluginFound = $false
foreach ($file in $gradleFiles) {
  if (Select-String -Path $file -Pattern 'capacitor-geolocation' -Quiet) {
    $pluginFound = $true
    Write-Host "Plugin encontrado em: $file" -ForegroundColor Green
  }
}

if (-not $pluginFound) {
  Write-Warning 'Nao encontrei capacitor-geolocation nos arquivos Gradle. Confira a saida do npx cap sync android.'
}

Write-Host ''
Write-Host 'CORRECAO GPS APLICADA.' -ForegroundColor Green
Write-Host 'Agora gere o APK com:' -ForegroundColor Yellow
Write-Host '  cd C:\disbgestao-git\android'
Write-Host '  .\gradlew.bat clean'
Write-Host '  .\gradlew.bat assembleDebug'
