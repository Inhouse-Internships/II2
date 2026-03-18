@echo off
cd /d "%~dp0"
start "Backend Server" cmd /k "cd backend && npm run dev"
start "Frontend Server" cmd /k "cd frontend && npm run dev"
echo Servers are starting...