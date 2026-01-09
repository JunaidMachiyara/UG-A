/**
 * Script to find Balance Sheet discrepancies for a specific factory
 * Checks ALL ledger entries (not just today) to find the $100 discrepancy
 * Usage: node scripts/check-balance-discrepancy.js <factoryId>
 */

import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
    } catch (error) {
        console.error('❌ Error initializing Firebase:', error.message);
        process.exit(1);
    }
}

const db = admin.firestore();

async function checkBalanceDiscrepancy(factoryId) {
    if (!factoryId) {
        console.error('❌ Factory ID is required!');
        console.log('\nUsage: node scripts/check-balance-discrepancy.js <factoryId>');
        console.log('\nExample: node scripts/check-balance-discrepancy.js e4HjvvOZklpkEnQavwkb');
        process.exit(1);
    }

    console.log(`\n🔍 Checking Balance Sheet Discrepancy for Factory: ${factoryId}\n`);
    console.log('='.repeat(80));

    try {
        // Get factory name
        const factoryDoc = await db.collection('factories').doc(factoryId).get();
        const factoryName = factoryDoc.exists ? factoryDoc.data().name : 'Unknown';
        console.log(`🏭 Factory: ${factoryName} (${factoryId})\n`);

        // Get ALL ledger entries for this factory (not just today)
        console.log('📊 Loading ALL ledger entries for this factory...');
        const ledgerQuery = await db.collection('ledger')
            .where('factoryId', '==', factoryId)
            .get();

        console.log(`✅ Found ${ledgerQuery.size} total ledger entries\n`);

        // Group by transaction ID to check for unbalanced transactions
        const transactions = {};
        const unbalances = [];
        const hundredDollarEntries = [];

        ledgerQuery.forEach(doc => {
            const entry = { id: doc.id, ...doc.data() };
            const transactionId = entry.transactionId || entry.id;

            if (!transactions[transactionId]) {
                transactions[transactionId] = [];
            }
            transactions[transactionId].push(entry);
        });

        // Check each transaction for balance
        console.log('🔍 Checking Transaction Balances:\n');
        Object.keys(transactions).forEach(transactionId => {
            const entries = transactions[transactionId];
            const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
            const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
            const difference = totalDebit - totalCredit;

            // Check for $100 amounts
            entries.forEach(entry => {
                const debit = entry.debit || 0;
                const credit = entry.credit || 0;
                if (Math.abs(debit - 100) < 0.01 || Math.abs(credit - 100) < 0.01) {
                    hundredDollarEntries.push({
                        transactionId,
                        entry,
                        debit,
                        credit,
                        date: entry.date,
                        accountName: entry.accountName
                    });
                }
            });

            if (Math.abs(difference) > 0.01) {
                unbalances.push({
                    transactionId,
                    entries,
                    totalDebit,
                    totalCredit,
                    difference
                });
            }
        });

        // Report findings
        if (unbalances.length > 0) {
            console.log(`❌ FOUND ${unbalances.length} UNBALANCED TRANSACTIONS:\n`);
            unbalances.slice(0, 10).forEach(({ transactionId, totalDebit, totalCredit, difference, entries }) => {
                console.log(`Transaction ID: ${transactionId}`);
                console.log(`  Debit Total: ${totalDebit.toFixed(2)}`);
                console.log(`  Credit Total: ${totalCredit.toFixed(2)}`);
                console.log(`  Difference: ${difference.toFixed(2)}`);
                console.log(`  Date: ${entries[0]?.date || 'N/A'}`);
                console.log(`  Entries (${entries.length}):`);
                entries.forEach(e => {
                    console.log(`    - ${e.accountName || 'Unknown'}: Debit ${(e.debit || 0).toFixed(2)}, Credit ${(e.credit || 0).toFixed(2)}`);
                });
                console.log('');
            });
            if (unbalances.length > 10) {
                console.log(`... and ${unbalances.length - 10} more unbalanced transactions\n`);
            }
        } else {
            console.log('✅ All transactions are balanced\n');
        }

        if (hundredDollarEntries.length > 0) {
            console.log(`💰 FOUND ${hundredDollarEntries.length} ENTRIES WITH $100 AMOUNTS:\n`);
            hundredDollarEntries.forEach(({ transactionId, entry, debit, credit, date, accountName }) => {
                console.log(`Transaction ID: ${transactionId}`);
                console.log(`  Date: ${date || 'N/A'}`);
                console.log(`  Account: ${accountName || 'Unknown'}`);
                console.log(`  Debit: ${debit.toFixed(2)}, Credit: ${credit.toFixed(2)}`);
                console.log(`  Narration: ${entry.narration || 'N/A'}`);
                console.log('');
            });
        } else {
            console.log('💰 No entries with exactly $100 found\n');
        }

        // Calculate Balance Sheet the same way the app does
        console.log('\n📊 Calculating Balance Sheet (Same as App):\n');
        
        // Get accounts for this factory
        const accountsQuery = await db.collection('accounts')
            .where('factoryId', '==', factoryId)
            .get();
        
        console.log(`✅ Found ${accountsQuery.size} accounts for this factory`);

        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        accountsQuery.forEach(doc => {
            const account = { id: doc.id, ...doc.data() };
            const balance = account.balance || 0;

            if (account.type === 'ASSET') {
                totalAssets += balance;
            } else if (account.type === 'LIABILITY') {
                totalLiabilities += balance;
            } else if (account.type === 'EQUITY') {
                totalEquity += balance;
            }
        });

        // Get partners - check which ones are used in this factory's transactions
        const partnersQuery = await db.collection('partners').get();
        const partnerIdsUsed = new Set();
        
        ledgerQuery.forEach(doc => {
            const entry = doc.data();
            if (entry.partnerId) partnerIdsUsed.add(entry.partnerId);
        });

        let debtors = 0;
        let creditors = 0;
        let customerAdvances = 0;
        let supplierAdvances = 0;

        partnersQuery.forEach(doc => {
            const partner = { id: doc.id, ...doc.data() };
            if (!partnerIdsUsed.has(partner.id)) return;
            
            const balance = partner.balance || 0;

            if (partner.type === 'CUSTOMER') {
                if (balance > 0) debtors += balance;
                else customerAdvances += Math.abs(balance);
            } else if (['SUPPLIER', 'FREIGHT_FORWARDER', 'CLEARING_AGENT', 'COMMISSION_AGENT'].includes(partner.type)) {
                if (balance < 0) creditors += Math.abs(balance);
                else supplierAdvances += balance;
            }
        });

        const totalCurrentAssets = totalAssets + debtors + supplierAdvances;
        const totalCurrentLiabilities = totalLiabilities + customerAdvances + creditors;
        const totalEquityFinal = totalEquity;
        const totalLiabilitiesAndEquity = totalCurrentLiabilities + totalEquityFinal;

        const discrepancy = totalCurrentAssets - totalLiabilitiesAndEquity;

        console.log(`\n${'='.repeat(80)}`);
        console.log('BALANCE SHEET CALCULATION:');
        console.log(`${'='.repeat(80)}\n`);

        console.log('ASSETS:');
        console.log(`  Accounts: ${totalAssets.toFixed(2)}`);
        console.log(`  Debtors: ${debtors.toFixed(2)}`);
        console.log(`  Supplier Advances: ${supplierAdvances.toFixed(2)}`);
        console.log(`  TOTAL ASSETS: ${totalCurrentAssets.toFixed(2)}\n`);

        console.log('LIABILITIES:');
        console.log(`  Accounts: ${totalLiabilities.toFixed(2)}`);
        console.log(`  Creditors: ${creditors.toFixed(2)}`);
        console.log(`  Customer Advances: ${customerAdvances.toFixed(2)}`);
        console.log(`  TOTAL LIABILITIES: ${totalCurrentLiabilities.toFixed(2)}\n`);

        console.log('EQUITY:');
        console.log(`  TOTAL EQUITY: ${totalEquityFinal.toFixed(2)}\n`);

        console.log(`TOTAL LIABILITIES & EQUITY: ${totalLiabilitiesAndEquity.toFixed(2)}\n`);

        console.log(`${'='.repeat(80)}`);
        console.log(`🎯 DISCREPANCY: ${discrepancy.toFixed(2)}`);
        console.log(`${'='.repeat(80)}\n`);

        if (Math.abs(discrepancy - 100) < 0.01) {
            console.log('✅ FOUND THE EXACT $100 DISCREPANCY!\n');
            console.log('Check the unbalanced transactions and $100 entries above.\n');
        } else if (Math.abs(discrepancy) > 0.01) {
            console.log(`⚠️  Discrepancy is ${discrepancy.toFixed(2)}, not exactly $100.\n`);
            console.log('Check the unbalanced transactions above.\n');
        } else {
            console.log('✅ Balance Sheet is balanced!\n');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
    }
}

// Get factory ID from command line
const factoryId = process.argv[2];

checkBalanceDiscrepancy(factoryId)
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });