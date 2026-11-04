#Requires -Version 5.1
# ============================================================================
#  start.ps1 — lance TOUT le clone en local en UNE SEULE commande.
#  Usage (PowerShell) :
#     cd C:\Users\<Toi>\XO-game-js\clone
#     powershell -ExecutionPolicy Bypass -File .\start.ps1
#  Prérequis : Node.js >= 22.18 (https://nodejs.org, LTS 22.x).
#  Délègue à scripts/run-all.mjs : base PGlite + schéma + seed + RLS + build +
#  serveur Next, le tout dans CETTE fenêtre (Ctrl+C pour arrêter).
# ============================================================================
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
node scripts/run-all.mjs
