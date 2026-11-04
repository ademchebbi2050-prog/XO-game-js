@echo off
rem Lance TOUT le clone en local, dans UNE seule fenêtre (double-clic sur ce fichier).
rem Prérequis: Node.js >= 22.18 installe (https://nodejs.org, LTS 22.x).
cd /d %~dp0
node scripts/run-all.mjs
pause
