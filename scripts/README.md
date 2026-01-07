# Backup Scripts

This directory contains scripts for automatic Firestore database backups.

## Files

- `backup.js` - Main backup script (Node.js)
- `backup.bat` - Windows batch wrapper for backup.js
- `schedule-backup.ps1` - PowerShell script to set up Windows Task Scheduler

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get Firebase Service Account Key:**
   - Firebase Console → Project Settings → Service Accounts
   - Generate New Private Key
   - Save as `firebase-service-account.json` in project root

3. **Test backup:**
   ```bash
   npm run backup
   ```

4. **Schedule automatic backups:**
   - Open PowerShell as Administrator
   - Run: `.\scripts\schedule-backup.ps1`

See `BACKUP_SYSTEM_SETUP.md` in project root for detailed instructions.

