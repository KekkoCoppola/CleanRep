@echo off
rem ==========================================================================
rem  CleanRep - compila l'APK Android di debug.
rem  Doppio click per avviarlo. Se l'APK esiste gia' viene ricompilato e
rem  sovrascritto. Risultato: apk\CleanRep-debug.apk (nella cartella progetto).
rem ==========================================================================
setlocal EnableExtensions
title CleanRep - Build APK
cd /d "%~dp0"

set "APK_OUT=%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
set "APK_DIR=%~dp0apk"
set "APK_FINAL=%APK_DIR%\CleanRep-debug.apk"

echo ============================================
echo   CleanRep - compilazione APK di debug
echo ============================================
echo.

rem --- Node.js: dal PATH, altrimenti la versione portable in LOCALAPPDATA
where npm >nul 2>nul
if not errorlevel 1 goto node_ok
for /d %%D in ("%LOCALAPPDATA%\nodejs-portable\node-*") do set "NODE_DIR=%%~fD"
if defined NODE_DIR set "PATH=%NODE_DIR%;%PATH%"
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRORE] npm non trovato. Installa Node.js o la versione portable in %%LOCALAPPDATA%%\nodejs-portable
  goto fail
)
:node_ok

rem --- JDK 17 e Android SDK
if not defined JAVA_HOME if exist "D:\ISTALLAZION_PROGRAMMI\Temurin-17\bin\java.exe" set "JAVA_HOME=D:\ISTALLAZION_PROGRAMMI\Temurin-17"
if not defined JAVA_HOME (
  echo [ERRORE] JAVA_HOME non impostato: serve il JDK 17.
  goto fail
)
if not defined ANDROID_HOME if exist "D:\AndroidSdk" set "ANDROID_HOME=D:\AndroidSdk"
if not defined ANDROID_HOME (
  echo [ERRORE] ANDROID_HOME non impostato: serve l'Android SDK.
  goto fail
)
echo JDK:     %JAVA_HOME%
echo SDK:     %ANDROID_HOME%
echo.

rem --- Dipendenze (solo la prima volta)
if not exist "node_modules" (
  echo Installazione dipendenze npm...
  call npm install
  if errorlevel 1 goto fail
)

rem --- Via l'APK precedente: se la build fallisce non resta un file vecchio che sembra nuovo
if exist "%APK_OUT%" del /f /q "%APK_OUT%"
if exist "%APK_FINAL%" del /f /q "%APK_FINAL%"

rem --- Build web + typecheck + cap sync + Gradle assembleDebug
call npm run android:apk
if errorlevel 1 goto fail
if not exist "%APK_OUT%" (
  echo [ERRORE] Gradle ha finito ma l'APK non e' stato generato.
  goto fail
)

if not exist "%APK_DIR%" mkdir "%APK_DIR%"
copy /y "%APK_OUT%" "%APK_FINAL%" >nul
for %%A in ("%APK_FINAL%") do set /a "APK_MB=%%~zA / 1048576"

echo.
echo ============================================
echo   [OK] APK compilato (%APK_MB% MB)
echo ============================================
echo   %APK_FINAL%
echo.
echo   Originale Gradle:
echo   %APK_OUT%
echo.
echo   Per installarlo sul telefono collegato via USB con debug USB attivo:
echo   "%ANDROID_HOME%\platform-tools\adb.exe" install -r "%APK_FINAL%"
echo.
pause
exit /b 0

:fail
echo.
echo ============================================
echo   [ERRORE] Compilazione APK fallita: vedi i messaggi sopra.
echo ============================================
pause
exit /b 1
