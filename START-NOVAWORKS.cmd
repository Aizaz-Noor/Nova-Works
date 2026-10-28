@echo off
setlocal
cd /d "%~dp0"
if not exist "backend\node_modules\express\package.json" goto setup
if not exist "app\client\node_modules\vite\package.json" goto setup
call npm.cmd run build:client
if errorlevel 1 goto failed
echo.
echo Open http://127.0.0.1:3048/ and choose Explore demo workspace.
echo Keep this window open while using NovaWorks. Press Ctrl+C to stop.
echo.
call npm.cmd run start:demo
if errorlevel 1 goto failed
exit /b 0
:setup
echo First-time setup is required. Run these in this folder:
echo npm.cmd ci --prefix backend
echo npm.cmd ci --prefix app/client
pause
exit /b 1
:failed
echo NovaWorks could not start. Read the error above; an older preview may still occupy port 3048.
pause
exit /b 1
