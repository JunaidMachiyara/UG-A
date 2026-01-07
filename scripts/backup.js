/**
 * Automatic Firestore Backup Script
 * Backs up all Firestore collections to JSON files
 * 
 * Usage: node scripts/backup.js [morning|evening]
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: join(__dirname, '..', '.env') });

// Firebase Admin SDK initialization
// Note: You need to download service account key from Firebase Console
// Firebase Console → Project Settings → Service Accounts → Generate New Private Key
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || join(__dirname, '..', 'firebase-service-account.json');

let db;

try {
    // Check if Firebase Admin is already initialized
    if (getApps().length === 0) {
        if (!existsSync(serviceAccountPath)) {
            console.error('❌ Firebase Service Account file not found!');
            console.error(`   Expected location: ${serviceAccountPath}`);
            console.error('\n📋 Setup Instructions:');
            console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
            console.error('2. Click "Generate New Private Key"');
            console.error('3. Save the JSON file as "firebase-service-account.json" in the project root');
            console.error('4. Or set FIREBASE_SERVICE_ACCOUNT_PATH environment variable');
            process.exit(1);
        }

        const serviceAccountContent = await readFile(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountContent);
        
        initializeApp({
            credential: cert(serviceAccount)
        });
    }
    
    db = getFirestore();
    console.log('✅ Firebase Admin initialized');
} catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    process.exit(1);
}

// List of all collections to backup
const COLLECTIONS = [
    'accounts',
    'partners',
    'items',
    'categories',
    'sections',
    'divisions',
    'subDivisions',
    'logos',
    'warehouses',
    'ports',
    'originalTypes',
    'originalProducts',
    'purchases',
    'bundlePurchases',
    'originalOpenings',
    'productions',
    'salesInvoices',
    'ongoingOrders',
    'logistics',
    'ledger',
    'employees',
    'currencies',
    'tasks',
    'enquiries',
    'vehicles',
    'planners',
    'guaranteeCheques',
    'customusDocuments',
    'attendance',
    'chats'
];

async function backupCollection(collectionName) {
    try {
        console.log(`📦 Backing up collection: ${collectionName}...`);
        const snapshot = await db.collection(collectionName).get();
        const data = [];
        
        snapshot.forEach(doc => {
            data.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`   ✅ ${collectionName}: ${data.length} documents`);
        return { collection: collectionName, data, count: data.length };
    } catch (error) {
        console.error(`   ❌ Error backing up ${collectionName}:`, error.message);
        return { collection: collectionName, data: [], count: 0, error: error.message };
    }
}

async function createBackup() {
    const backupType = process.argv[2] || 'auto'; // morning, evening, or auto
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    
    // Determine backup type based on time if auto
    let actualBackupType = backupType;
    if (backupType === 'auto') {
        const hour = now.getHours();
        actualBackupType = hour < 12 ? 'morning' : 'evening';
    }
    
    const backupDir = join(__dirname, '..', 'backups', actualBackupType, dateStr);
    
    // Create backup directory
    if (!existsSync(backupDir)) {
        await mkdir(backupDir, { recursive: true });
    }
    
    const backupFile = join(backupDir, `backup_${timestamp}.json`);
    const summaryFile = join(backupDir, `summary_${timestamp}.txt`);
    
    console.log('\n🚀 Starting Firestore Backup...');
    console.log(`📅 Date: ${now.toLocaleString()}`);
    console.log(`🕐 Type: ${actualBackupType.toUpperCase()}`);
    console.log(`📁 Backup Directory: ${backupDir}\n`);
    
    const startTime = Date.now();
    const backupData = {
        metadata: {
            timestamp: now.toISOString(),
            backupType: actualBackupType,
            date: dateStr,
            time: timeStr,
            version: '1.0'
        },
        collections: {}
    };
    
    const summary = {
        timestamp: now.toLocaleString(),
        backupType: actualBackupType,
        totalCollections: COLLECTIONS.length,
        successful: 0,
        failed: 0,
        totalDocuments: 0,
        collections: []
    };
    
    // Backup all collections
    for (const collectionName of COLLECTIONS) {
        const result = await backupCollection(collectionName);
        backupData.collections[collectionName] = result.data;
        
        if (result.error) {
            summary.failed++;
            summary.collections.push({
                name: collectionName,
                status: 'FAILED',
                count: 0,
                error: result.error
            });
        } else {
            summary.successful++;
            summary.totalDocuments += result.count;
            summary.collections.push({
                name: collectionName,
                status: 'SUCCESS',
                count: result.count
            });
        }
    }
    
    // Save backup JSON file
    await writeFile(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    
    // Save summary file
    const summaryText = `
╔══════════════════════════════════════════════════════════╗
║          FIRESTORE BACKUP SUMMARY                        ║
╚══════════════════════════════════════════════════════════╝

Backup Type: ${summary.backupType.toUpperCase()}
Timestamp: ${summary.timestamp}
Duration: ${((Date.now() - startTime) / 1000).toFixed(2)} seconds

Collections: ${summary.totalCollections}
✅ Successful: ${summary.successful}
❌ Failed: ${summary.failed}
📄 Total Documents: ${summary.totalDocuments.toLocaleString()}

Backup File: ${backupFile}
Summary File: ${summaryFile}

────────────────────────────────────────────────────────────
COLLECTION DETAILS:
────────────────────────────────────────────────────────────
${summary.collections.map(c => 
    `${c.status === 'SUCCESS' ? '✅' : '❌'} ${c.name.padEnd(25)} ${c.count.toString().padStart(6)} documents${c.error ? ` - ERROR: ${c.error}` : ''}`
).join('\n')}

────────────────────────────────────────────────────────────
Backup completed successfully!
────────────────────────────────────────────────────────────
`;
    
    await writeFile(summaryFile, summaryText, 'utf8');
    
    console.log('\n' + summaryText);
    console.log(`\n✅ Backup completed! Files saved to: ${backupDir}`);
    
    // Keep only last 30 days of backups (optional cleanup)
    // This can be enabled if you want automatic cleanup
    // await cleanupOldBackups(backupDir, 30);
}

// Run backup
createBackup()
    .then(() => {
        console.log('\n✅ Backup process completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Backup process failed:', error);
        process.exit(1);
    });

