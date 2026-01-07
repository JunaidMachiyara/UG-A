@echo off
REM Morning Backup Script
cd /d "%~dp0\.."
call npm run backup:morning
echo Morning backup executed at %date% %time% >> backups\backup-log.txt

