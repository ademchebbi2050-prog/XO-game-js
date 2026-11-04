@echo off
rem Lance le clone en local (une seule action : double-clic sur ce fichier).
cd /d %~dp0
powershell -ExecutionPolicy Bypass -File .\start.ps1
pause
