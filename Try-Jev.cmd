@echo off
setlocal
cd /d "%~dp0"
node scripts\opencode-run.mjs jev %*
pause
