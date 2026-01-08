/**
 * Script to directly generate Employee Advance Accounts in Firebase
 * Codes: 1400-2099
 * Parent Account: 1130 - Employee Advances
 * 
 * This script requires:
 * - Firebase Admin SDK configured
 * - firebase-service-account.json in project root
 * 
 * Usage: node scripts/generate-employee-accounts-direct.js [factoryId]
 */

import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        const serviceAccountPath = join(__dirname, '..', 'firebase-service-account.json');
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized');
    } catch (error) {
        console.error('❌ Error initializing Firebase Admin:', error.message);
        console.error('💡 Make sure firebase-service-account.json exists in project root');
        process.exit(1);
    }
}

const db = admin.firestore();

// Configuration
const START_CODE = 1400;
const TOTAL_ACCOUNTS = 700;
const PARENT_ACCOUNT_CODE = '1130';
const ACCOUNT_TYPE = 'ASSET';
const CURRENCY = 'USD';

async function generateEmployeeAccounts(factoryId) {
    if (!factoryId) {
        console.error('❌ Factory ID is required');
        console.log('Usage: node scripts/generate-employee-accounts-direct.js <factoryId>');
        process.exit(1);
    }

    console.log(`🚀 Generating ${TOTAL_ACCOUNTS} Employee Advance Accounts...`);
    console.log(`🏭 Factory ID: ${factoryId}`);
    console.log(`🔢 Code range: ${START_CODE}-${START_CODE + TOTAL_ACCOUNTS - 1}`);
    console.log(`👤 Parent Account: ${PARENT_ACCOUNT_CODE} - Employee Advances\n`);

    try {
        // Find parent account (1130)
        const parentAccountQuery = await db.collection('accounts')
            .where('code', '==', PARENT_ACCOUNT_CODE)
            .where('factoryId', '==', factoryId)
            .limit(1)
            .get();

        if (parentAccountQuery.empty) {
            console.error(`❌ Parent account ${PARENT_ACCOUNT_CODE} not found for factory ${factoryId}`);
            console.log('💡 Please create account "1130 - Employee Advances" first in Setup > Chart of Accounts');
            process.exit(1);
        }

        const parentAccount = parentAccountQuery.docs[0];
        const parentAccountId = parentAccount.id;
        console.log(`✅ Found parent account: ${parentAccount.data().name} (ID: ${parentAccountId})\n`);

        // Check existing accounts to find next available code
        const existingAccountsQuery = await db.collection('accounts')
            .where('factoryId', '==', factoryId)
            .get();

        const existingCodes = new Set();
        existingAccountsQuery.forEach(doc => {
            const code = parseInt(doc.data().code);
            if (!isNaN(code) && code >= START_CODE && code < START_CODE + TOTAL_ACCOUNTS) {
                existingCodes.add(code);
            }
        });

        console.log(`📊 Found ${existingCodes.size} existing accounts in range ${START_CODE}-${START_CODE + TOTAL_ACCOUNTS - 1}`);

        // Generate accounts
        const batch = db.batch();
        let created = 0;
        let skipped = 0;
        const batchSize = 500; // Firestore batch limit

        for (let i = 0; i < TOTAL_ACCOUNTS; i++) {
            const code = START_CODE + i;
            
            // Skip if already exists
            if (existingCodes.has(code)) {
                skipped++;
                continue;
            }

            const accountNumber = String(i + 1).padStart(3, '0');
            const accountName = `Employee Advance - Employee ${accountNumber}`;

            const accountRef = db.collection('accounts').doc();
            batch.set(accountRef, {
                code: code.toString(),
                name: accountName,
                type: ACCOUNT_TYPE,
                balance: 0,
                currency: CURRENCY,
                factoryId: factoryId,
                parentAccountId: parentAccountId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            created++;

            // Commit batch if we reach the limit
            if (created % batchSize === 0) {
                await batch.commit();
                console.log(`✅ Created ${created} accounts...`);
            }
        }

        // Commit remaining accounts
        if (created % batchSize !== 0) {
            await batch.commit();
        }

        console.log(`\n✅ Successfully created ${created} Employee Advance Accounts!`);
        if (skipped > 0) {
            console.log(`⚠️  Skipped ${skipped} accounts (already exist)`);
        }
        console.log(`\n📋 Next Steps:`);
        console.log(`1. Go to: Setup > Chart of Accounts`);
        console.log(`2. You'll see accounts like "1400 - Employee Advance - Employee 001"`);
        console.log(`3. Edit each account name to match actual employee names`);
        console.log(`4. Or use the CSV import feature to update names in bulk`);

    } catch (error) {
        console.error('❌ Error generating accounts:', error);
        process.exit(1);
    }
}

// Get factory ID from command line argument
const factoryId = process.argv[2];
generateEmployeeAccounts(factoryId)
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
