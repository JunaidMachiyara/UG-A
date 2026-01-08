/**
 * Script to generate 700 Employee Advance Accounts CSV
 * Codes: 1400-2099
 * Parent Account: 1130 - Employee Advances
 * 
 * Usage: node scripts/generate-employee-accounts.js
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const START_CODE = 1400;
const END_CODE = 2099;
const TOTAL_ACCOUNTS = 700;
const PARENT_ACCOUNT_CODE = '1130';
const ACCOUNT_TYPE = 'ASSET';
const CURRENCY = 'USD';

// Generate CSV data
const generateCSV = () => {
    const headers = ['code', 'name', 'type', 'balance', 'currency', 'parentAccountCode'];
    const rows = [];
    
    // Generate 700 placeholder accounts
    for (let i = 0; i < TOTAL_ACCOUNTS; i++) {
        const code = START_CODE + i;
        const accountNumber = String(i + 1).padStart(3, '0');
        const name = `Employee Advance - Employee ${accountNumber}`;
        
        rows.push([
            code.toString(),
            name,
            ACCOUNT_TYPE,
            '0',
            CURRENCY,
            PARENT_ACCOUNT_CODE
        ]);
    }
    
    // Combine headers and rows
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    return csvContent;
};

// Generate the CSV file
const csvContent = generateCSV();
const outputPath = join(__dirname, 'employee-accounts-template.csv');

writeFileSync(outputPath, csvContent, 'utf8');

console.log('✅ Employee Accounts CSV Generated Successfully!');
console.log(`📁 File saved to: ${outputPath}`);
console.log(`📊 Total accounts: ${TOTAL_ACCOUNTS}`);
console.log(`🔢 Code range: ${START_CODE}-${END_CODE}`);
console.log(`👤 Parent Account: ${PARENT_ACCOUNT_CODE} - Employee Advances`);
console.log('\n📋 Next Steps:');
console.log('1. Open: Admin > Import/Export > Accounts');
console.log('2. Download the template to see the format');
console.log('3. Edit the CSV file to replace "Employee XXX" with actual employee names');
console.log('4. Upload the edited CSV file');
console.log('\n💡 Tip: You can edit the CSV in Excel/LibreOffice to replace placeholder names with real employee names.');
