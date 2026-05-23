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

# Patch index.html — bandeau status bar beige + safe area
$htmlPath = "dist\index.html"
if (Test-Path $htmlPath) {
    $html = Get-Content $htmlPath -Raw

    # 1. viewport-fit=cover pour que env(safe-area-inset-top) fonctionne
    $html = $html -replace 'initial-scale=1, shrink-to-fit=no', 'initial-scale=1, shrink-to-fit=no, viewport-fit=cover'

    # 2. Injecter meta tags + styles juste avant </head>
    $inject = @'
  <meta name="theme-color" content="#F2EDE4" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <style id="jovial-statusbar">
    /*
     * black-translucent : le viewport couvre tout l'ecran (y compris sous la barre systeme).
     * env(safe-area-inset-top) = hauteur exacte de la barre (47-59px selon iPhone).
     * body::before cree un bandeau beige fixe qui se glisse derriere la barre transparente.
     * #root est pousse vers le bas pour que le contenu commence sous le bandeau.
     */
    html, body {
      background-color: #F2EDE4;
    }
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: env(safe-area-inset-top);
      background-color: #F2EDE4;
      z-index: 999999;
    }
    #root {
      padding-top: env(safe-area-inset-top);
      background-color: #ffffff;
      box-sizing: border-box;
    }
  </style>
'@
    $html = $html -replace '</head>', "$inject</head>"

    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText("$PSScriptRoot\$htmlPath", $html, $utf8NoBom)
    Write-Host "index.html patche (status bar beige)" -ForegroundColor Green
}

# vercel.json sans BOM
$json = '{"rewrites":[{"source":"/((?!_expo|assets|favicon.png|metadata.json).*)","destination":"/index.html"}]}'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("$PSScriptRoot\dist\vercel.json", $json, $utf8NoBom)
Write-Host "vercel.json ecrit" -ForegroundColor Green

Write-Host ""
Write-Host "Pret a deployer sur Vercel !" -ForegroundColor Cyan
