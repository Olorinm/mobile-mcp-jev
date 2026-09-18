@echo off
setlocal
cd /d "%~dp0"
echo Open http://127.0.0.1:4781 after the server starts.
node scripts\inspector.mjs
pause
