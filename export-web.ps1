# export-web.ps1 — Build + patch pour Vercel
# Usage : ./export-web.ps1

Set-Location $PSScriptRoot

Write-Host "Export Expo..." -ForegroundColor Cyan
npx expo export --platform web
if (-not $?) { Write-Host "Erreur lors de l'export." -ForegroundColor Red; exit 1 }

# Rename node_modules -> pkg (Vercel bloque /assets/node_modules/)
$src = "dist\assets\node_modules"
$dst = "dist\assets\pkg"
if (Test-Path $src) {
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    Rename-Item -Path $src -NewName "pkg"
    Write-Host "Renomme assets/node_modules -> assets/pkg" -ForegroundColor Green
}

# Patch le bundle JS
$bundles = Get-ChildItem -Path "dist\_expo\static\js\web" -Filter "*.js" -ErrorAction SilentlyContinue
foreach ($f in $bundles) {
    (Get-Content $f.FullName -Raw) -replace '/assets/node_modules/', '/assets/pkg/' | Set-Content $f.FullName -NoNewline
}
Write-Host "Bundle JS patche" -ForegroundColor Green

# vercel.json sans BOM
$json = '{"rewrites":[{"source":"/((?!_expo|assets|favicon.png|metadata.json).*)","destination":"/index.html"}]}'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("$PSScriptRoot\dist\vercel.json", $json, $utf8NoBom)
Write-Host "vercel.json ecrit" -ForegroundColor Green

Write-Host ""
Write-Host "Pret a deployer sur Vercel !" -ForegroundColor Cyan
