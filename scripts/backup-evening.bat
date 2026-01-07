@echo off
REM Evening Backup Script
cd /d "%~dp0\.."
call npm run backup:evening
echo Evening backup executed at %date% %time% >> backups\backup-log.txt

