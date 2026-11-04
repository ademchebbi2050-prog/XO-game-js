#Requires -Version 5.1
# ============================================================================
#  start.ps1 — lance TOUT le clone en local en UNE SEULE commande.
#  Usage (PowerShell) :
#     cd C:\Users\<Toi>\XO-game-js\clone
#     powershell -ExecutionPolicy Bypass -File .\start.ps1
#  Prérequis : Node.js >= 22.18 (https://nodejs.org, LTS 22.x) + Git.
#  Le serveur reste au premier plan (Ctrl+C pour arrêter). La base de données
#  tourne dans une seconde fenêtre PowerShell (à fermer manuellement).
# ============================================================================
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# --- 0. Node >= 22.18 ---
Step "Vérification de Node.js"
$nv = (node -v) -replace '^v', ''
$parts = $nv.Split('.') | ForEach-Object { [int]$_ }
if ($parts[0] -lt 22 -or ($parts[0] -eq 22 -and $parts[1] -lt 18)) {
  Write-Host "Node $nv détecté — il faut Node >= 22.18 (LTS 22.x)." -ForegroundColor Red
  Write-Host "Installe-le sur https://nodejs.org, ferme/rouvre PowerShell, puis relance ce script."
  exit 1
}
Write-Host "Node v$nv OK"

# --- 1. .env ---
Step "Fichier .env"
if (-not (Test-Path ".env")) {
  Copy-Item .env.example .env
  Write-Host ".env créé depuis .env.example (PRISMA_CLIENT_ENGINE_TYPE=client inclus)"
} else {
  Write-Host ".env déjà présent"
}

# --- 2. dépendances ---
Step "Dépendances (npm install si besoin)"
if (-not (Test-Path "node_modules")) {
  npm install
} else {
  Write-Host "node_modules déjà là"
}

# --- 3. hosts ---
Step "Vérification du fichier hosts"
$hostsOk = $false
try {
  $r = Resolve-DnsName app.localhost -ErrorAction Stop
  if ($r[0].IPAddress -eq "127.0.0.1") { $hostsOk = $true }
} catch { }
if (-not $hostsOk) {
  Write-Host "app.localhost ne pointe pas sur 127.0.0.1 !" -ForegroundColor Yellow
  Write-Host "Ouvre EN ADMINISTRATEUR :  notepad C:\Windows\System32\drivers\etc\hosts"
  Write-Host "et ajoute cette ligne à la fin :"
  Write-Host "  127.0.0.1 app.localhost boutique-a.localhost boutique-b.localhost"
  Write-Host "Sauvegarde, puis relance ce script. (Sans ça, seules les URLs localhost:3000 marchent.)"
  exit 1
}
Write-Host "hosts OK (app.localhost -> 127.0.0.1)"

# --- 4. base de données (fenêtre séparée) ---
Step "Base de données PGlite (fenêtre séparée)"
$dbRunning = $false
try {
  $dbRunning = (Test-NetConnection -ComputerName 127.0.0.1 -Port 5433 -WarningAction SilentlyContinue).TcpTestSucceeded
} catch { }
if (-not $dbRunning) {
  Start-Process powershell -WorkingDirectory $root -ArgumentList "-NoExit -Command `"node scripts/pglite-server.mjs`""
  Write-Host "Attente du démarrage de PGlite sur 127.0.0.1:5433..."
  $ok = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
      if ((Test-NetConnection -ComputerName 127.0.0.1 -Port 5433 -WarningAction SilentlyContinue).TcpTestSucceeded) { $ok = $true; break }
    } catch { }
  }
  if (-not $ok) { Write-Host "PGlite ne démarre pas — regarde la fenêtre 'db' et copie l'erreur ici." -ForegroundColor Red; exit 1 }
}
Write-Host "PGlite OK sur 127.0.0.1:5433"

# --- 5. schéma + seed + RLS (idempotents) ---
Step "Schéma + données de démo + RLS"
npm run db:setup
node scripts/enable-rls.mjs

# --- 6. build si besoin ---
Step "Build (si .next absent)"
if (-not (Test-Path ".next\BUILD_ID")) {
  npm run build
} else {
  Write-Host ".next déjà buildé"
}

# --- 7. serveur au premier plan ---
Step "Diagnostic (node scripts/check.mjs)"
node scripts/check.mjs

Step "Démarrage du serveur (Ctrl+C pour arrêter)"
Write-Host ""
Write-Host "  Dashboard :  http://app.localhost:3000/app/login   (demo@exemple.tn / demo1234)"
Write-Host "  Boutique A : http://boutique-a.localhost:3000/"
Write-Host "  Boutique B : http://boutique-b.localhost:3000/"
Write-Host "  Tests :     node tests/isolation/run.mjs   (dans un 3e terminal)"
Write-Host ""
npx next start -p 3000 -H 0.0.0.0
