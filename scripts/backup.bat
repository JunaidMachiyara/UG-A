@echo off
REM Windows Batch Script for Automatic Firestore Backup
REM This script runs the backup.js Node.js script
REM Usage: backup.bat [morning|evening]

cd /d "%~dp0\.."

if "%1"=="" (
    call npm run backup
) else (
    call npm run backup:%1
)

REM Log the backup execution
echo Backup executed at %date% %time% (Type: %1) >> backups\backup-log.txt

