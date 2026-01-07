# Automatic Backup System Setup Guide

This guide explains how to set up automatic daily backups (morning and evening) for your Firestore database.

## 📋 Prerequisites

1. **Node.js** installed (v18 or higher)
2. **Firebase Service Account Key** (JSON file)
3. **Windows Task Scheduler** (for automatic scheduling)

---

## 🔧 Initial Setup

### Step 1: Install Dependencies

```bash
npm install
```

This will install `firebase-admin` and `dotenv` packages required for backups.

### Step 2: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Save the downloaded JSON file as `firebase-service-account.json` in the project root directory

**⚠️ IMPORTANT:** 
- Never commit this file to Git (it's already in `.gitignore`)
- Keep this file secure - it has full access to your Firestore database

### Step 3: Test Manual Backup

Test the backup script manually to ensure it works:

```bash
npm run backup
```

Or specify backup type:
```bash
npm run backup:morning
npm run backup:evening
```

The backup will be saved to:
- `backups/morning/YYYY-MM-DD/backup_TIMESTAMP.json`
- `backups/evening/YYYY-MM-DD/backup_TIMESTAMP.json`

---

## ⏰ Automatic Scheduling (Windows)

### Option 1: Using PowerShell Script (Recommended)

1. **Open PowerShell as Administrator**
   - Right-click PowerShell → "Run as Administrator"

2. **Run the setup script:**
   ```powershell
   cd D:\UG-A-Cursor
   .\scripts\schedule-backup.ps1
   ```

3. **Verify tasks were created:**
   - Open Task Scheduler (`taskschd.msc`)
   - Look for tasks:
     - `UG-Inventory-Backup-Morning` (runs at 8:00 AM daily)
     - `UG-Inventory-Backup-Evening` (runs at 8:00 PM daily)

### Option 2: Manual Task Scheduler Setup

1. **Open Task Scheduler** (`taskschd.msc`)

2. **Create Morning Backup Task:**
   - Click "Create Basic Task"
   - Name: `UG-Inventory-Backup-Morning`
   - Trigger: Daily at 8:00 AM
   - Action: Start a program
   - Program: `D:\UG-A-Cursor\scripts\backup.bat`
   - Arguments: `morning`
   - Check "Run whether user is logged on or not"
   - Check "Run with highest privileges"

3. **Create Evening Backup Task:**
   - Repeat steps above
   - Name: `UG-Inventory-Backup-Evening`
   - Trigger: Daily at 8:00 PM

---

## 📁 Backup Structure

Backups are organized as follows:

```
backups/
├── morning/
│   └── 2026-01-06/
│       ├── backup_2026-01-06_08-00-00.json
│       └── summary_2026-01-06_08-00-00.txt
└── evening/
    └── 2026-01-06/
        ├── backup_2026-01-06_20-00-00.json
        └── summary_2026-01-06_20-00-00.txt
```

### Backup File Format

Each backup JSON file contains:
- **Metadata**: Timestamp, backup type, date, time
- **Collections**: All Firestore collections with their documents

### Summary File

Each backup includes a human-readable summary showing:
- Backup type and timestamp
- Number of collections backed up
- Document counts per collection
- Success/failure status

---

## 🔄 Restoring from Backup

To restore data from a backup:

1. **Locate the backup file** in `backups/morning/` or `backups/evening/`

2. **Use Firebase Console** or create a restore script:
   ```javascript
   // Example restore script (create scripts/restore.js)
   import { initializeApp, cert } from 'firebase-admin/app';
   import { getFirestore } from 'firebase-admin/firestore';
   import { readFileSync } from 'fs';
   
   // Initialize Firebase Admin (same as backup.js)
   // ... initialization code ...
   
   const backupData = JSON.parse(readFileSync('backups/morning/2026-01-06/backup_...json', 'utf8'));
   const db = getFirestore();
   
   // Restore each collection
   for (const [collectionName, documents] of Object.entries(backupData.collections)) {
       const batch = db.batch();
       documents.forEach(doc => {
           const ref = db.collection(collectionName).doc(doc.id);
           batch.set(ref, { ...doc, id: undefined }); // Remove id from data
       });
       await batch.commit();
       console.log(`✅ Restored ${documents.length} documents to ${collectionName}`);
   }
   ```

---

## 🛠️ Troubleshooting

### Backup Script Fails

**Error: "Firebase Service Account file not found"**
- Ensure `firebase-service-account.json` exists in project root
- Or set `FIREBASE_SERVICE_ACCOUNT_PATH` environment variable

**Error: "Permission denied"**
- Check Firebase Service Account has Firestore read permissions
- Verify the JSON file is valid

### Scheduled Task Not Running

1. **Check Task Scheduler:**
   - Open Task Scheduler
   - Find the task → Right-click → "Run"
   - Check "Last Run Result" for errors

2. **Check Task Logs:**
   - In Task Scheduler, select the task
   - Go to "History" tab to see execution logs

3. **Verify Paths:**
   - Ensure `backup.bat` path is correct
   - Ensure Node.js is in system PATH

### Backup Files Not Created

- Check `backups/` directory permissions
- Ensure disk space is available
- Check backup script output in Task Scheduler history

---

## 📊 Monitoring Backups

### Check Backup Status

1. **View backup directory:**
   ```bash
   dir backups\morning
   dir backups\evening
   ```

2. **Check backup log:**
   ```bash
   type backups\backup-log.txt
   ```

3. **View latest backup summary:**
   - Open the most recent `summary_*.txt` file in the backup directory

### Backup Retention

By default, backups are kept indefinitely. To enable automatic cleanup:

1. Edit `scripts/backup.js`
2. Uncomment the cleanup function at the end
3. Adjust retention days as needed

---

## 🔒 Security Notes

1. **Service Account Key:**
   - Never commit `firebase-service-account.json` to Git
   - Store securely and limit access
   - Rotate keys periodically

2. **Backup Files:**
   - Backups contain all your data
   - Store backups securely
   - Consider encrypting sensitive backups

3. **Access Control:**
   - Limit who can access backup directories
   - Use Windows file permissions to restrict access

---

## 📝 Customization

### Change Backup Times

Edit `scripts/schedule-backup.ps1` and change:
- Morning: `/ST 08:00` (8:00 AM)
- Evening: `/ST 20:00` (8:00 PM)

### Add More Collections

Edit `scripts/backup.js` and add collection names to the `COLLECTIONS` array.

### Change Backup Location

Edit `scripts/backup.js` and modify the `backupDir` path.

---

## ✅ Verification Checklist

- [ ] Firebase Service Account key downloaded and saved
- [ ] Manual backup test successful
- [ ] Scheduled tasks created in Task Scheduler
- [ ] Morning backup runs at 8:00 AM
- [ ] Evening backup runs at 8:00 PM
- [ ] Backup files are being created
- [ ] Backup summary files are readable

---

## 📞 Support

If you encounter issues:
1. Check the backup summary files for errors
2. Review Task Scheduler history
3. Test manual backup to isolate issues
4. Check Firebase Console for service account permissions

---

**Last Updated:** January 2026

