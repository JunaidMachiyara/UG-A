import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { getExchangeRates } from '../context/DataContext';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Database, X } from 'lucide-react';
import Papa from 'papaparse';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { TransactionType, LedgerEntry } from '../types';
import { getAccountId } from '../services/accountMap';

type ImportableEntity = 
    | 'items' 
    | 'partners' 
    | 'accounts' 
    | 'originalTypes' 
    | 'categories' 
    | 'sections'
    | 'divisions'
    | 'subDivisions'
    | 'purchases';

interface ImportResult {
    success: number;
    failed: number;
    errors: string[];
}

const CSV_TEMPLATES = {
    items: [
        ['id', 'name', 'category', 'section', 'packingType', 'weightPerUnit', 'avgCost', 'salePrice', 'stockQty', 'openingStock'],
        ['item-001', 'Cotton Yarn 20s', 'cat-raw', 'sec-a', 'Bales', '200', '2.50', '3.00', '1000', '1000']
    ],
    partners: [
        ['id', 'name', 'type', 'country', 'defaultCurrency', 'balance', 'divisionId', 'subDivisionId'],
        ['', 'ABC Textiles', 'CUSTOMER', 'USA', 'USD', '5000', 'div-1', 'subdiv-1'],
        ['', 'XYZ Suppliers', 'SUPPLIER', 'UAE', 'AED', '0', 'div-1', '']
    ],
    accounts: [
        ['id', 'name', 'type', 'balance', 'description'],
        ['acc-001', 'Office Rent', 'EXPENSE', '0', 'Monthly office rent expenses']
    ],
    originalTypes: [
        ['id', 'name', 'packingType', 'packingSize'],
        ['ot-001', 'Raw Cotton', 'Bale', '45']
    ],
    originalProducts: [
        ['id', 'name', 'originalTypeId'],
        ['op-001', 'Mixed Rags', 'ot-001']
    ],
    categories: [
        ['id', 'name'],
        ['cat-001', 'Raw Materials']
    ],
    sections: [
        ['id', 'name'],
        ['sec-001', 'Section A']
    ],
    divisions: [
        ['id', 'name', 'location'],
        ['div-001', 'Sales Division', 'Dubai HQ']
    ],
    subDivisions: [
        ['id', 'name', 'divisionId'],
        ['subdiv-001', 'Export Sales', 'div-001']
    ],
    logos: [
        ['id', 'name'],
        ['logo-001', 'Usman Global']
    ],
    warehouses: [
        ['id', 'name', 'location'],
        ['wh-001', 'Main Warehouse', 'Dubai']
    ],
    purchases: [
        ['supplierId', 'subSupplierId', 'originalTypeId', 'originalProductId', 'weightPurchased', 'costPerKgFCY', 'totalCostFCY', 'batchNumber', 'containerNumber', 'divisionId', 'subDivisionId', 'status', 'receivedWeight'],
        ['SUP-1001', '', 'OT-001', 'ORP-1001', '10000', '2.50', '25000', 'BATCH-001', 'CONT-12345', 'DIV-001', 'SUBDIV-001', 'Arrived', '9950'],
        ['SUP-1002', 'SUB-1001', 'OT-002', '', '5000', '3.00', '15000', '', '', 'DIV-001', '', 'In Transit', '']
    ]
};

export const DataImportExport: React.FC = () => {
    const { 
        state, 
        addItem, 
        addPartner, 
        addAccount,
        addDivision,
        addSubDivision,
        addLogo,
        addWarehouse,
        addOriginalType,
        addOriginalProduct,
        addCategory,
        addSection,
        addPurchase,
        saveLogisticsEntry,
        postTransaction
    } = useData();
    const { currentFactory } = useAuth();
    const [selectedEntity, setSelectedEntity] = useState<ImportableEntity>('items');
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const downloadTemplate = (entity: ImportableEntity) => {
        const template = CSV_TEMPLATES[entity];
        const csv = template.map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${entity}_template.csv`;
        a.click();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setParsedData(results.data);
                setShowPreview(true);
                setImportResult(null);
            },
            error: (error) => {
                alert(`Error parsing CSV: ${error.message}`);
            }
        });
    };

    const validateAndImport = async () => {
        if (parsedData.length === 0) {
            alert('No data to import');
            return;
        }

        setImporting(true);
        const errors: string[] = [];
        let successCount = 0;

        try {
            if (!currentFactory) {
                alert('No factory selected. Please select a factory first.');
                setImporting(false);
                return;
            }

            // Special handling for large item imports - use batch writes
            if (selectedEntity === 'items' && parsedData.length > 100) {
                // Batch import for large item lists (1500+ items)
                const BATCH_SIZE = 500; // Firebase limit is 500 operations per batch
                const validItems: any[] = [];
                const seenCodes = new Set<string>(); // Track item codes to prevent duplicates
                
                console.log(`📊 Starting import of ${parsedData.length} items`);
                
                // Validate and prepare all items first
                for (let index = 0; index < parsedData.length; index++) {
                    const row = parsedData[index];
                    if (!row.name) {
                        errors.push(`Row ${index + 2}: Missing required field 'name'`);
                        continue;
                    }
                    
                    // Generate unique ID and code
                    const itemCode = row.code || row.id || `ITEM-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
                    
                    // Check for duplicate codes in the CSV itself
                    if (seenCodes.has(itemCode)) {
                        console.warn(`⚠️ Duplicate item code in CSV row ${index + 2}: ${itemCode}`);
                        errors.push(`Row ${index + 2}: Duplicate item code: ${itemCode}`);
                        continue;
                    }
                    seenCodes.add(itemCode);
                    
                    const openingStock = parseFloat(row.openingStock) || 0;
                    const item = {
                        id: row.id || itemCode, // Use the unique code as ID if no ID provided
                        code: itemCode,
                        name: row.name,
                        category: row.category || '',
                        section: row.section || '',
                        packingType: row.packingType || 'Kg',
                        weightPerUnit: parseFloat(row.weightPerUnit) || 0,
                        avgCost: parseFloat(row.avgCost) || 0,
                        salePrice: parseFloat(row.salePrice) || 0,
                        stockQty: parseFloat(row.stockQty) || 0,
                        openingStock: openingStock,
                        nextSerial: openingStock + 1,
                        factoryId: currentFactory?.id || ''
                    };
                    validItems.push(item);
                }
                
                console.log(`✅ Prepared ${validItems.length} unique items for import (from ${parsedData.length} CSV rows)`);
                
                // Process in batches with delays to avoid rate limiting
                console.log(`📦 Starting batch processing: ${validItems.length} items in ${Math.ceil(validItems.length / BATCH_SIZE)} batch(es)`);
                
                for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
                    const batch = writeBatch(db);
                    const batchItems = validItems.slice(i, i + BATCH_SIZE);
                    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                    
                    console.log(`📦 Batch ${batchNumber}: Preparing ${batchItems.length} items for Firebase write`);
                    const itemsInBatch: string[] = [];
                    
                    for (const item of batchItems) {
                        // Prepare for batch write - use item's ID as document ID if provided
                        const { id, ...itemData } = item;
                        const itemRef = id 
                            ? doc(db, 'items', id)  // Use item's ID as document ID
                            : doc(collection(db, 'items'));  // Auto-generate if no ID
                        
                        console.log(`  📝 Adding to batch: ${item.name} (code: ${item.code}, id: ${id || 'auto-generated'}, ref: ${itemRef.id})`);
                        itemsInBatch.push(`${item.name} (${item.code})`);
                        
                        batch.set(itemRef, {
                            ...itemData,
                            createdAt: serverTimestamp()
                        });
                    }
                    
                    // Commit batch with error handling
                    try {
                        console.log(`💾 Batch ${batchNumber}: Committing ${batchItems.length} items to Firebase...`);
                        console.log(`   Items in this batch:`, itemsInBatch);
                        await batch.commit();
                        console.log(`✅ Batch ${batchNumber} COMMITTED: ${batchItems.length} items written to Firebase`);
                        
                        // Wait for Firebase listener to load items before creating ledger entries
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Create opening stock ledger entries directly (don't call addItem - it causes duplicates)
                        // Firebase listener already loaded items to state, we just need to create ledger entries
                        for (const item of batchItems) {
                            const openingStock = item.openingStock || 0;
                            const avgCost = item.avgCost || 0;
                            
                            if (openingStock > 0 && avgCost !== 0) {
                                const prevYear = new Date().getFullYear() - 1;
                                const date = `${prevYear}-12-31`;
                                const stockValue = openingStock * avgCost;
                                
                                // Get account IDs using the same method as addItem
                                const finishedGoodsId = getAccountId('105'); // Inventory - Finished Goods
                                const capitalId = getAccountId('301'); // Capital
                                
                                const entries = [
                                    {
                                        date,
                                        transactionId: `OB-STK-${item.id || item.code}`,
                                        transactionType: TransactionType.OPENING_BALANCE,
                                        accountId: finishedGoodsId,
                                        accountName: 'Inventory - Finished Goods',
                                        currency: item.defaultCurrency || 'USD',
                                        exchangeRate: 1,
                                        fcyAmount: Math.abs(stockValue),
                                        debit: stockValue > 0 ? stockValue : 0,
                                        credit: stockValue < 0 ? Math.abs(stockValue) : 0,
                                        narration: `Opening Stock - ${item.name}`,
                                        factoryId: currentFactory?.id || ''
                                    },
                                    {
                                        date,
                                        transactionId: `OB-STK-${item.id || item.code}`,
                                        transactionType: TransactionType.OPENING_BALANCE,
                                        accountId: capitalId,
                                        accountName: 'Capital',
                                        currency: item.defaultCurrency || 'USD',
                                        exchangeRate: 1,
                                        fcyAmount: Math.abs(stockValue),
                                        debit: stockValue < 0 ? Math.abs(stockValue) : 0,
                                        credit: stockValue > 0 ? stockValue : 0,
                                        narration: `Opening Stock - ${item.name}`,
                                        factoryId: currentFactory?.id || ''
                                    }
                                ];
                                await postTransaction(entries);
                            }
                            
                            // Small delay every 10 items to avoid rate limiting
                            if (batchItems.indexOf(item) % 10 === 9) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        }
                        
                        successCount += batchItems.length;
                        
                        // Small delay between batches to avoid rate limiting
                        if (i + BATCH_SIZE < validItems.length) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (batchError: any) {
                        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError);
                        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} (rows ${i + 2}-${i + batchItems.length + 1}) failed: ${batchError.message}`);
                    }
                }
            }
            
            // Special handling for large partner imports - use batch writes
            if (selectedEntity === 'partners' && parsedData.length > 50) {
                // Batch import for large partner lists (210+ partners)
                const BATCH_SIZE = 500; // Firebase limit is 500 operations per batch
                const validPartners: any[] = [];
                
                // Validate and prepare all partners first
                for (let index = 0; index < parsedData.length; index++) {
                    const row = parsedData[index];
                    if (!row.name) {
                        errors.push(`Row ${index + 2}: Missing required field 'name'`);
                        continue;
                    }
                    
                    if (!row.type) {
                        errors.push(`Row ${index + 2}: Partner missing required field 'type'`);
                        continue;
                    }
                    
                    // Check for duplicate by name and type (if ID not provided)
                    if (!row.id || row.id.trim() === '') {
                        const existingPartner = state.partners.find((p: any) => 
                            p.name.toLowerCase().trim() === row.name.toLowerCase().trim() && 
                            p.type === row.type
                        );
                        if (existingPartner) {
                            errors.push(`Row ${index + 2}: Partner "${row.name}" (${row.type}) already exists with ID "${existingPartner.id}". Please include the ID in CSV to update, or delete existing partner first.`);
                            continue;
                        }
                    }
                    
                    // Support both defaultCur and defaultCurrency column names
                    const defaultCurrency = row.defaultCurrency || row.defaultCur || 'USD';
                    
                    // Auto-generate ID if not provided
                    let partnerId = row.id;
                    if (!partnerId || partnerId.trim() === '') {
                        // Get prefix based on partner type
                        let prefix = 'PTN'; // Default prefix
                        switch(row.type) {
                            case 'SUPPLIER': prefix = 'SUP'; break;
                            case 'CUSTOMER': prefix = 'CUS'; break;
                            case 'SUB SUPPLIER': prefix = 'SUB'; break;
                            case 'VENDOR': prefix = 'VEN'; break;
                            case 'CLEARING AGENT': prefix = 'CLA'; break;
                            case 'FREIGHT_FORWARDER':
                            case 'FREIGHT FORWARDER': prefix = 'FFW'; break;
                            case 'COMMISSION AGENT': prefix = 'COM'; break;
                        }
                        
                        // Find existing partners of same type to get next number
                        const sameTypePartners = state.partners.filter((p: any) => p.type === row.type);
                        const existingIds = sameTypePartners
                            .map((p: any) => {
                                // Extract number from IDs like SUP-1001, CUS-1002, etc.
                                const match = p.id?.match(new RegExp(`^${prefix}-(\\d+)$`));
                                return match ? parseInt(match[1]) : 0;
                            })
                            .filter(n => n > 0)
                            .sort((a, b) => b - a);
                        
                        // Also check already processed rows in this import
                        const processedIds = parsedData.slice(0, index)
                            .filter((r: any) => r.type === row.type && r.id)
                            .map((r: any) => {
                                const match = r.id?.match(new RegExp(`^${prefix}-(\\d+)$`));
                                return match ? parseInt(match[1]) : 0;
                            })
                            .filter(n => n > 0);
                        
                        const allIds = [...existingIds, ...processedIds].sort((a, b) => b - a);
                        const nextNumber = allIds.length > 0 ? allIds[0] + 1 : 1001;
                        partnerId = `${prefix}-${nextNumber}`;
                    }
                    
                    // Parse balance from CSV (can be positive or negative)
                    const balance = row.balance ? parseFloat(row.balance) : 0;
                    
                    const partner = {
                        id: partnerId,
                        name: row.name,
                        type: row.type,
                        balance: balance, // Will be set to 0 when saving, balance handled via ledger
                        defaultCurrency: defaultCurrency,
                        contact: row.contact || '',
                        country: row.country || '',
                        phone: row.phone || '',
                        email: row.email || '',
                        divisionId: row.divisionId || undefined,
                        subDivisionId: row.subDivisionId || undefined,
                        creditLimit: row.creditLimit ? parseFloat(row.creditLimit) : undefined,
                        taxId: row.taxId || undefined,
                        commissionRate: row.commissionRate ? parseFloat(row.commissionRate) : undefined,
                        parentSupplier: row.parentSupplier || undefined,
                        licenseNumber: row.licenseNumber || undefined,
                        scacCode: row.scacCode || undefined,
                        factoryId: currentFactory?.id || '',
                        openingBalance: balance // Store original balance for ledger entry creation
                    };
                    validPartners.push(partner);
                }
                
                // Process in batches with delays to avoid rate limiting
                for (let i = 0; i < validPartners.length; i += BATCH_SIZE) {
                    const batch = writeBatch(db);
                    const batchPartners = validPartners.slice(i, i + BATCH_SIZE);
                    
                    for (const partner of batchPartners) {
                        // Prepare for batch write - use partner's ID as document ID
                        const { id, openingBalance, ...partnerData } = partner;
                        const partnerRef = doc(db, 'partners', id);
                        
                        // Save with balance = 0, opening balance will be handled via ledger
                        const partnerDataForSave = {
                            ...partnerData,
                            balance: 0, // Save with 0, balance comes from ledger
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        };
                        
                        // Remove undefined values
                        Object.keys(partnerDataForSave).forEach(key => {
                            if ((partnerDataForSave as any)[key] === undefined) {
                                (partnerDataForSave as any)[key] = null;
                            }
                        });
                        
                        batch.set(partnerRef, partnerDataForSave);
                    }
                    
                    // Commit batch with error handling
                    try {
                        await batch.commit();
                        console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validPartners.length / BATCH_SIZE)} saved: ${batchPartners.length} partners to Firebase`);
                        
                        // After successful batch commit, handle opening balance ledger entries
                        // Note: Firebase listener will automatically add partners to local state
                        // Process opening balances with a small delay to avoid rate limiting
                        let balanceEntriesCreated = 0;
                        for (let pIdx = 0; pIdx < batchPartners.length; pIdx++) {
                            const partner = batchPartners[pIdx];
                            // Handle opening balance if needed (similar to addPartner logic)
                            if (partner.openingBalance !== 0) {
                                try {
                                    const prevYear = new Date().getFullYear() - 1;
                                    const date = `${prevYear}-12-31`;
                                    const openingEquityId = state.accounts.find(a => a.name.includes('Capital'))?.id || '301';
                                    const currency = partner.defaultCurrency || 'USD';
                                    const exchangeRates = getExchangeRates(state.currencies);
                                    const rate = exchangeRates[currency] || 1;
                                    const fcyAmt = partner.openingBalance * rate;
                                    const commonProps = { currency, exchangeRate: rate, fcyAmount: Math.abs(fcyAmt) };
                                    
                                    let entries: Omit<LedgerEntry, 'id'>[] = [];
                                    if (partner.type === 'CUSTOMER') {
                                        entries = [
                                            {
                                                ...commonProps,
                                                date,
                                                transactionId: `OB-${partner.id}`,
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: partner.id,
                                                accountName: partner.name,
                                                debit: partner.openingBalance,
                                                credit: 0,
                                                narration: `Opening Balance - ${partner.name}`,
                                                factoryId: currentFactory?.id || ''
                                            },
                                            {
                                                ...commonProps,
                                                date,
                                                transactionId: `OB-${partner.id}`,
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: openingEquityId,
                                                accountName: 'Opening Equity',
                                                debit: 0,
                                                credit: partner.openingBalance,
                                                narration: `Opening Balance - ${partner.name}`,
                                                factoryId: currentFactory?.id || ''
                                            }
                                        ];
                                    } else {
                                        // Suppliers, Vendors, etc.
                                        const absBalance = Math.abs(partner.openingBalance);
                                        if (partner.openingBalance < 0) {
                                            // Negative: Accounts Payable
                                            entries = [
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${partner.id}`,
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: openingEquityId,
                                                    accountName: 'Opening Equity',
                                                    debit: absBalance,
                                                    credit: 0,
                                                    narration: `Opening Balance - ${partner.name}`,
                                                    factoryId: currentFactory?.id || ''
                                                },
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${partner.id}`,
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: partner.id,
                                                    accountName: partner.name,
                                                    debit: 0,
                                                    credit: absBalance,
                                                    narration: `Opening Balance - ${partner.name}`,
                                                    factoryId: currentFactory?.id || ''
                                                }
                                            ];
                                        } else {
                                            // Positive: Advance to Supplier
                                            entries = [
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${partner.id}`,
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: openingEquityId,
                                                    accountName: 'Opening Equity',
                                                    debit: 0,
                                                    credit: absBalance,
                                                    narration: `Opening Balance - ${partner.name}`,
                                                    factoryId: currentFactory?.id || ''
                                                },
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${partner.id}`,
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: partner.id,
                                                    accountName: partner.name,
                                                    debit: absBalance,
                                                    credit: 0,
                                                    narration: `Opening Balance - ${partner.name}`,
                                                    factoryId: currentFactory?.id || ''
                                                }
                                            ];
                                        }
                                    }
                                    await postTransaction(entries);
                                    balanceEntriesCreated++;
                                    
                                    // Small delay every 10 partners to avoid Firebase rate limiting
                                    if ((pIdx + 1) % 10 === 0) {
                                        await new Promise(resolve => setTimeout(resolve, 200));
                                    }
                                } catch (error: any) {
                                    console.error(`❌ Error creating opening balance for ${partner.name}:`, error);
                                    errors.push(`Failed to create opening balance for ${partner.name}: ${error.message}`);
                                }
                            }
                        }
                        
                        if (balanceEntriesCreated > 0) {
                            console.log(`✅ Created ${balanceEntriesCreated} opening balance entries for batch ${Math.floor(i / BATCH_SIZE) + 1}`);
                        }
                        
                        successCount += batchPartners.length;
                        
                        // Small delay between batches to avoid rate limiting
                        if (i + BATCH_SIZE < validPartners.length) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (batchError: any) {
                        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError);
                        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} (rows ${i + 2}-${i + batchPartners.length + 1}) failed: ${batchError.message}`);
                    }
                }
            }
            
            // Handle purchases with batch writes (for CSV imports of existing stock)
            if (selectedEntity === 'purchases' && parsedData.length > 0) {
                const BATCH_SIZE = 500;
                const validPurchases: any[] = [];
                
                // Use current date as upload date
                const uploadDate = new Date().toISOString().split('T')[0];
                
                // Track batch and container numbers for auto-generation
                let batchCounter = 1;
                let containerCounter = 1;
                
                // Get existing batch numbers to find next available
                const existingBatches = state.purchases.map(p => p.batchNumber).filter(b => b);
                const existingBatchNumbers = existingBatches
                    .map(b => {
                        const match = b.match(/^BATCH-(\d+)$/i);
                        return match ? parseInt(match[1]) : 0;
                    })
                    .filter(n => n > 0)
                    .sort((a, b) => b - a);
                if (existingBatchNumbers.length > 0) {
                    batchCounter = existingBatchNumbers[0] + 1;
                }
                
                const existingContainers = state.purchases.map(p => p.containerNumber).filter(c => c);
                const existingContainerNumbers = existingContainers
                    .map(c => {
                        const match = c.match(/^CONT-(\d+)$/i);
                        return match ? parseInt(match[1]) : 0;
                    })
                    .filter(n => n > 0)
                    .sort((a, b) => b - a);
                if (existingContainerNumbers.length > 0) {
                    containerCounter = existingContainerNumbers[0] + 1;
                }
                
                console.log(`📊 Starting import of ${parsedData.length} purchases (Original Stock)`);
                console.log(`📅 Using upload date: ${uploadDate}`);
                
                // Validate and prepare all purchases first
                for (let index = 0; index < parsedData.length; index++) {
                    const row = parsedData[index];
                    
                    // Required fields validation
                    if (!row.supplierId) {
                        errors.push(`Row ${index + 2}: Missing required field 'supplierId'`);
                        continue;
                    }
                    if (!row.originalTypeId) {
                        errors.push(`Row ${index + 2}: Missing required field 'originalTypeId'`);
                        continue;
                    }
                    if (!row.weightPurchased || parseFloat(row.weightPurchased) <= 0) {
                        errors.push(`Row ${index + 2}: Missing or invalid 'weightPurchased'`);
                        continue;
                    }
                    if (!row.costPerKgFCY || parseFloat(row.costPerKgFCY) <= 0) {
                        errors.push(`Row ${index + 2}: Missing or invalid 'costPerKgFCY'`);
                        continue;
                    }
                    
                    // Validate supplier exists
                    const supplierId = row.supplierId.trim();
                    const supplier = state.partners.find(p => p.id === supplierId);
                    if (!supplier) {
                        errors.push(`Row ${index + 2}: Supplier with ID "${supplierId}" not found. Please create supplier first.`);
                        continue;
                    }
                    
                    // Validate original type exists
                    const originalTypeId = row.originalTypeId.trim();
                    const originalTypeObj = state.originalTypes.find(t => t.id === originalTypeId);
                    if (!originalTypeObj) {
                        errors.push(`Row ${index + 2}: Original Type with ID "${originalTypeId}" not found. Please create original type first.`);
                        continue;
                    }
                    const originalTypeName = originalTypeObj.name;
                    
                    // Validate subSupplier if provided (optional)
                    let subSupplierId = row.subSupplierId?.trim();
                    if (subSupplierId) {
                        const subSupplier = state.partners.find(p => p.id === subSupplierId);
                        if (!subSupplier) {
                            errors.push(`Row ${index + 2}: Sub Supplier with ID "${subSupplierId}" not found. Please create sub supplier first or leave blank.`);
                            continue;
                        }
                    }
                    
                    // Validate originalProductId if provided (optional)
                    let originalProductId = row.originalProductId?.trim();
                    if (originalProductId) {
                        const originalProduct = state.originalProducts.find(op => op.id === originalProductId);
                        if (!originalProduct) {
                            errors.push(`Row ${index + 2}: Original Product with ID "${originalProductId}" not found. Please create original product first or leave blank.`);
                            continue;
                        }
                        // Validate that the original product belongs to the selected original type
                        if (originalProduct.originalTypeId !== originalTypeId) {
                            errors.push(`Row ${index + 2}: Original Product "${originalProductId}" does not belong to Original Type "${originalTypeId}". Please use a product that belongs to this type or leave blank.`);
                            continue;
                        }
                    }
                    
                    // Parse numeric fields
                    const weightPurchased = parseFloat(row.weightPurchased);
                    const costPerKgFCY = parseFloat(row.costPerKgFCY);
                    const totalCostFCY = parseFloat(row.totalCostFCY) || (weightPurchased * costPerKgFCY);
                    
                    // Calculate qtyPurchased from weightPurchased and originalType packingSize
                    const packingSize = originalTypeObj?.packingSize || 1;
                    const qtyPurchased = weightPurchased / packingSize;
                    
                    // Auto-generate batchNumber if not provided
                    let batchNumber = row.batchNumber?.trim();
                    if (!batchNumber) {
                        batchNumber = `BATCH-${String(batchCounter).padStart(3, '0')}`;
                        batchCounter++;
                    }
                    
                    // Auto-generate containerNumber if not provided
                    let containerNumber = row.containerNumber?.trim();
                    if (!containerNumber) {
                        containerNumber = `CONT-${String(containerCounter).padStart(3, '0')}`;
                        containerCounter++;
                    }
                    
                    // Status - default to "Arrived" if not provided
                    const status = (row.status?.trim() || 'Arrived') as 'In Transit' | 'Arrived' | 'Cleared';
                    if (!['In Transit', 'Arrived', 'Cleared'].includes(status)) {
                        errors.push(`Row ${index + 2}: Invalid status "${row.status}". Must be: In Transit, Arrived, or Cleared`);
                        continue;
                    }
                    
                    // Optional fields
                    const divisionId = row.divisionId?.trim() || undefined;
                    const subDivisionId = row.subDivisionId?.trim() || undefined;
                    
                    // receivedWeight (offloading weight) - only for Arrived/Cleared containers
                    // - If status is "Arrived" or "Cleared" and receivedWeight is blank, use weightPurchased (assume no shortage)
                    // - If status is "In Transit", receivedWeight should be blank (not received yet)
                    let receivedWeight = 0;
                    if ((status === 'Arrived' || status === 'Cleared') && row.receivedWeight) {
                        receivedWeight = parseFloat(row.receivedWeight);
                    } else if ((status === 'Arrived' || status === 'Cleared') && !row.receivedWeight) {
                        // If Arrived/Cleared and no receivedWeight provided, assume same as invoice (no shortage)
                        receivedWeight = weightPurchased;
                    }
                    // For "In Transit", receivedWeight stays 0 (will be provided on offloading)
                    
                    // Calculate landed cost (costPerKgFCY is the cost up to now)
                    // For CSV imports, costPerKgFCY is the landed cost per kg
                    const landedCostPerKg = costPerKgFCY;
                    const totalLandedCost = weightPurchased * landedCostPerKg;
                    
                    const purchase: any = {
                        id: row.id || `PUR-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                        batchNumber: batchNumber,
                        status: status,
                        date: uploadDate, // Use upload date
                        supplierId: supplierId,
                        subSuppliers: subSupplierId ? [subSupplierId] : undefined,
                        originalTypeId: originalTypeId,
                        originalType: originalTypeName,
                        originalProductId: originalProductId || undefined,
                        containerNumber: containerNumber || undefined,
                        divisionId: divisionId,
                        subDivisionId: subDivisionId,
                        weightPurchased: weightPurchased,
                        qtyPurchased: qtyPurchased,
                        currency: 'USD' as any,
                        exchangeRate: 1, // Always USD
                        costPerKgFCY: costPerKgFCY,
                        totalCostFCY: totalCostFCY,
                        additionalCosts: [], // No additional costs for CSV imports
                        totalLandedCost: totalLandedCost,
                        landedCostPerKg: landedCostPerKg,
                        items: originalProductId ? [{
                            originalTypeId: originalTypeId,
                            originalType: originalTypeName,
                            originalProductId: originalProductId,
                            weightPurchased: weightPurchased,
                            qtyPurchased: qtyPurchased,
                            costPerKgFCY: costPerKgFCY,
                            totalCostFCY: totalCostFCY
                        }] : [], // Single-type purchase with optional original product
                        factoryId: currentFactory?.id || ''
                    };
                    
                    // Store logistics data for Arrived/Cleared containers (receivedWeight for offloading)
                    if (receivedWeight > 0 && containerNumber) {
                        (purchase as any).csvLogisticsData = {
                            receivedWeight: receivedWeight,
                            invoicedWeight: weightPurchased,
                            shortageKg: weightPurchased - receivedWeight
                        };
                    }
                    
                    validPurchases.push(purchase);
                }
                
                console.log(`✅ Prepared ${validPurchases.length} valid purchases for import (from ${parsedData.length} CSV rows)`);
                
                // Process in batches
                for (let i = 0; i < validPurchases.length; i += BATCH_SIZE) {
                    const batch = writeBatch(db);
                    const batchPurchases = validPurchases.slice(i, i + BATCH_SIZE);
                    
                    for (const purchase of batchPurchases) {
                        const { id, csvLogisticsData, ...purchaseData } = purchase;
                        const purchaseRef = doc(db, 'purchases', id);
                        
                        // Remove undefined values
                        const cleanedData: any = {};
                        Object.keys(purchaseData).forEach(key => {
                            if (purchaseData[key] !== undefined) {
                                cleanedData[key] = purchaseData[key];
                            }
                        });
                        
                        batch.set(purchaseRef, {
                            ...cleanedData,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                    }
                    
                    try {
                        await batch.commit();
                        console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validPurchases.length / BATCH_SIZE)} committed: ${batchPurchases.length} purchases saved to Firebase`);
                        
                        // Wait for Firebase listener to load purchases
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Create LogisticsEntry records for Arrived/Cleared containers (offloading data)
                        // This tracks receivedWeight vs invoicedWeight (purchase weight)
                        for (const purchase of batchPurchases) {
                            if ((purchase as any).csvLogisticsData && purchase.containerNumber) {
                                const logisticsData = (purchase as any).csvLogisticsData;
                                try {
                                    const logisticsEntry: any = {
                                        id: `LOG-${purchase.id}-${Date.now()}`,
                                        purchaseId: purchase.id,
                                        purchaseType: 'ORIGINAL' as const,
                                        containerNumber: purchase.containerNumber,
                                        status: purchase.status,
                                        arrivalDate: purchase.status === 'Arrived' || purchase.status === 'Cleared' ? purchase.date : undefined,
                                        invoicedWeight: logisticsData.invoicedWeight,
                                        receivedWeight: logisticsData.receivedWeight,
                                        shortageKg: logisticsData.shortageKg
                                    };
                                    
                                    // Use saveLogisticsEntry to save offloading data
                                    saveLogisticsEntry(logisticsEntry);
                                    console.log(`✅ Created LogisticsEntry for purchase ${purchase.batchNumber} (Invoice: ${logisticsData.invoicedWeight}kg, Received: ${logisticsData.receivedWeight}kg, Shortage: ${logisticsData.shortageKg}kg)`);
                                } catch (error: any) {
                                    console.error(`❌ Error creating LogisticsEntry for purchase ${purchase.batchNumber}:`, error);
                                    errors.push(`Failed to create LogisticsEntry for batch ${purchase.batchNumber}: ${error.message}`);
                                }
                            }
                        }
                        
                        // Create opening balance ledger entries for Raw Material Inventory and Capital
                        // BATCHED: Collect all entries first, then post in one batch for speed
                        const rawMaterialAccount = state.accounts.find(a => 
                            a.name.includes('Raw Material') || 
                            a.name.includes('Raw Materials') ||
                            a.code === '104' || 
                            a.code === '1200'
                        );
                        const capitalAccount = state.accounts.find(a => 
                            a.name.includes('Capital') || 
                            a.code === '301'
                        );
                        
                        if (!rawMaterialAccount || !capitalAccount) {
                            console.error('❌ Account lookup failed for purchase ledger entries:', {
                                rawMaterialAccount: rawMaterialAccount?.name || 'NOT FOUND',
                                capitalAccount: capitalAccount?.name || 'NOT FOUND'
                            });
                            errors.push(`Missing required accounts. Raw Material: ${rawMaterialAccount ? 'Found' : 'NOT FOUND'}, Capital: ${capitalAccount ? 'Found' : 'NOT FOUND'}`);
                        } else {
                            const rawMaterialInvId = rawMaterialAccount.id;
                            const capitalId = capitalAccount.id;
                            
                            // Collect all ledger entries for this batch
                            const allLedgerEntries: Omit<LedgerEntry, 'id'>[] = [];
                            
                            for (const purchase of batchPurchases) {
                                try {
                                    const stockValue = purchase.totalLandedCost || purchase.totalCostFCY || 0;
                                    
                                    if (stockValue <= 0) {
                                        console.log(`⚠️ Purchase ${purchase.batchNumber} has zero value, skipping ledger entries`);
                                        continue;
                                    }
                                    
                                    const transactionId = `OB-PUR-${purchase.id}`;
                                    
                                    allLedgerEntries.push(
                                        {
                                            date: purchase.date,
                                            transactionId,
                                            transactionType: TransactionType.OPENING_BALANCE,
                                            accountId: rawMaterialInvId,
                                            accountName: rawMaterialAccount.name,
                                            currency: 'USD',
                                            exchangeRate: 1,
                                            fcyAmount: stockValue,
                                            debit: stockValue,
                                            credit: 0,
                                            narration: `Opening Stock (Purchase) - ${purchase.originalType} (Batch: ${purchase.batchNumber})`,
                                            factoryId: currentFactory?.id || ''
                                        },
                                        {
                                            date: purchase.date,
                                            transactionId,
                                            transactionType: TransactionType.OPENING_BALANCE,
                                            accountId: capitalId,
                                            accountName: capitalAccount.name,
                                            currency: 'USD',
                                            exchangeRate: 1,
                                            fcyAmount: stockValue,
                                            debit: 0,
                                            credit: stockValue,
                                            narration: `Opening Stock (Purchase) - ${purchase.originalType} (Batch: ${purchase.batchNumber})`,
                                            factoryId: currentFactory?.id || ''
                                        }
                                    );
                                } catch (error: any) {
                                    console.error(`❌ Error preparing ledger entries for purchase ${purchase.batchNumber}:`, error);
                                    errors.push(`Failed to prepare ledger entries for batch ${purchase.batchNumber}: ${error.message}`);
                                }
                            }
                            
                            // Post all ledger entries in ONE batch call (much faster!)
                            if (allLedgerEntries.length > 0) {
                                try {
                                    await postTransaction(allLedgerEntries);
                                    console.log(`✅ Created ${allLedgerEntries.length} ledger entries (${batchPurchases.length} purchases) in one batch`);
                                } catch (error: any) {
                                    console.error(`❌ Error posting batch ledger entries:`, error);
                                    errors.push(`Failed to post ledger entries batch: ${error.message}`);
                                }
                            }
                        }
                        
                        successCount += batchPurchases.length;
                        
                        // Small delay between batches
                        if (i + BATCH_SIZE < validPurchases.length) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (batchError: any) {
                        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError);
                        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} (rows ${i + 2}-${i + batchPurchases.length + 1}) failed: ${batchError.message}`);
                    }
                }
            }
            
            // Handle items/partners with batch writes (even for small batches)
            // This prevents duplicates - items/partners are processed here, NOT in the individual path below
            if ((selectedEntity === 'items' && parsedData.length <= 100) ||
                (selectedEntity === 'partners' && parsedData.length <= 50)) {
                const BATCH_SIZE = 500; // Firebase limit is 500 operations per batch
                const validItems: any[] = [];
                
                // Validate and prepare all items first
                for (let index = 0; index < parsedData.length; index++) {
                    const row = parsedData[index];
                    if (!row.name) {
                        errors.push(`Row ${index + 2}: Missing required field 'name'`);
                        continue;
                    }
                    
                    const openingStock = parseFloat(row.openingStock) || 0;
                    const item = {
                        id: row.id || `ITEM-${Date.now()}-${index}`,
                        code: row.code || row.id || `ITEM-${Date.now()}-${index}`,
                        name: row.name,
                        category: row.category || '',
                        section: row.section || '',
                        packingType: row.packingType || 'Kg',
                        weightPerUnit: parseFloat(row.weightPerUnit) || 0,
                        avgCost: parseFloat(row.avgCost) || 0,
                        salePrice: parseFloat(row.salePrice) || 0,
                        stockQty: parseFloat(row.stockQty) || 0,
                        openingStock: openingStock,
                        nextSerial: openingStock + 1,
                        factoryId: currentFactory?.id || ''
                    };
                    validItems.push(item);
                }
                
                // Process in batches with delays to avoid rate limiting
                for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
                    const batch = writeBatch(db);
                    const batchItems = validItems.slice(i, i + BATCH_SIZE);
                    
                    for (const item of batchItems) {
                        // Prepare for batch write - use item's ID as document ID if provided
                        const { id, ...itemData } = item;
                        const itemRef = id 
                            ? doc(db, 'items', id)  // Use item's ID as document ID
                            : doc(collection(db, 'items'));  // Auto-generate if no ID
                        batch.set(itemRef, {
                            ...itemData,
                            createdAt: serverTimestamp()
                        });
                    }
                    
                    // Commit batch with error handling
                    try {
                        await batch.commit();
                        
                        // After successful batch commit, add to local state and handle opening stock ledger entries
                        // Wait for Firebase listener to load items before creating ledger entries
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Create opening stock ledger entries directly (don't call addItem - it causes duplicates)
                        // Firebase listener already loaded items to state, we just need to create ledger entries
                        for (const item of batchItems) {
                            const openingStock = item.openingStock || 0;
                            const avgCost = item.avgCost || 0;
                            
                            if (openingStock > 0 && avgCost !== 0) {
                                const prevYear = new Date().getFullYear() - 1;
                                const date = `${prevYear}-12-31`;
                                const stockValue = openingStock * avgCost;
                                
                                // Get account IDs using the same method as addItem
                                const finishedGoodsId = getAccountId('105'); // Inventory - Finished Goods
                                const capitalId = getAccountId('301'); // Capital
                                
                                const entries = [
                                    {
                                        date,
                                        transactionId: `OB-STK-${item.id || item.code}`,
                                        transactionType: TransactionType.OPENING_BALANCE,
                                        accountId: finishedGoodsId,
                                        accountName: 'Inventory - Finished Goods',
                                        currency: item.defaultCurrency || 'USD',
                                        exchangeRate: 1,
                                        fcyAmount: Math.abs(stockValue),
                                        debit: stockValue > 0 ? stockValue : 0,
                                        credit: stockValue < 0 ? Math.abs(stockValue) : 0,
                                        narration: `Opening Stock - ${item.name}`,
                                        factoryId: currentFactory?.id || ''
                                    },
                                    {
                                        date,
                                        transactionId: `OB-STK-${item.id || item.code}`,
                                        transactionType: TransactionType.OPENING_BALANCE,
                                        accountId: capitalId,
                                        accountName: 'Capital',
                                        currency: item.defaultCurrency || 'USD',
                                        exchangeRate: 1,
                                        fcyAmount: Math.abs(stockValue),
                                        debit: stockValue < 0 ? Math.abs(stockValue) : 0,
                                        credit: stockValue > 0 ? stockValue : 0,
                                        narration: `Opening Stock - ${item.name}`,
                                        factoryId: currentFactory?.id || ''
                                    }
                                ];
                                await postTransaction(entries);
                            }
                            
                            // Small delay every 10 items to avoid rate limiting
                            if (batchItems.indexOf(item) % 10 === 9) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        }
                        
                        successCount += batchItems.length;
                        console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validItems.length / BATCH_SIZE)} saved: ${batchItems.length} items to Firebase`);
                        
                        // Small delay between batches to avoid rate limiting
                        if (i + BATCH_SIZE < validItems.length) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (batchError: any) {
                        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError);
                        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} (rows ${i + 2}-${i + batchItems.length + 1}) failed: ${batchError.message}`);
                    }
                }
            }
            
            // Handle other entities (NOT items/partners/purchases - those are handled above with batch writes)
            // Items, partners, and purchases are already processed via batch writes above, so skip them here
            if (selectedEntity !== 'items' && selectedEntity !== 'partners' && selectedEntity !== 'purchases') {
                // Use proper add functions for other entities
                for (let index = 0; index < parsedData.length; index++) {
                    const row = parsedData[index];
                    try {
                        // Basic validation - name is required, id can be auto-generated
                        if (!row.name) {
                            errors.push(`Row ${index + 2}: Missing required field 'name'`);
                            continue;
                        }

                        // Entity-specific validation and transformation
                        try {
                            switch (selectedEntity) {
                            case 'items': {
                                // Items are handled via batch writes above - should never reach here
                                console.warn('⚠️ Items should be processed via batch writes, not individual addItem');
                                break;
                            }
                            case 'partners': {
                                // Partners are handled via batch writes above - should never reach here
                                console.warn('⚠️ Partners should be processed via batch writes, not individual addPartner');
                                break;
                            }
                            case 'purchases': {
                                // Purchases are handled via batch writes above - should never reach here
                                console.warn('⚠️ Purchases should be processed via batch writes, not individual addPurchase');
                                break;
                            }
                            case 'partners': {
                                // Type is required
                                if (!row.type) {
                                    errors.push(`Row ${index + 2}: Partner missing required field 'type'`);
                                    continue;
                                }
                                
                                // Auto-generate ID if not provided
                                let partnerId = row.id;
                                if (!partnerId || partnerId.trim() === '') {
                                    // Get prefix based on partner type
                                    let prefix = 'PTN'; // Default prefix
                                    switch(row.type) {
                                        case 'SUPPLIER': prefix = 'SUP'; break;
                                        case 'CUSTOMER': prefix = 'CUS'; break;
                                        case 'SUB SUPPLIER': prefix = 'SUB'; break;
                                        case 'VENDOR': prefix = 'VEN'; break;
                                        case 'CLEARING AGENT': prefix = 'CLA'; break;
                                        case 'FREIGHT FORWARDER': prefix = 'FFW'; break;
                                        case 'COMMISSION AGENT': prefix = 'COM'; break;
                                    }
                                    
                                    // Find existing partners of same type to get next number
                                    const sameTypePartners = state.partners.filter((p: any) => p.type === row.type);
                                    const existingIds = sameTypePartners
                                        .map((p: any) => {
                                            // Extract number from IDs like SUP-1001, CUS-1002, etc.
                                            const match = p.id?.match(new RegExp(`^${prefix}-(\\d+)$`));
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0)
                                        .sort((a, b) => b - a);
                                    
                                    // Also check already processed rows in this import
                                    const processedIds = parsedData.slice(0, index)
                                        .filter((r: any) => r.type === row.type && r.id)
                                        .map((r: any) => {
                                            const match = r.id?.match(new RegExp(`^${prefix}-(\\d+)$`));
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0);
                                    
                                    const allIds = [...existingIds, ...processedIds].sort((a, b) => b - a);
                                    const nextNumber = allIds.length > 0 ? allIds[0] + 1 : 1001;
                                    partnerId = `${prefix}-${nextNumber}`;
                                }
                                
                                // Parse balance from CSV (can be positive or negative)
                                // Support case-insensitive column names
                                const balanceStr = row.balance || row.Balance || row.BAL || '0';
                                const balance = balanceStr ? parseFloat(balanceStr.toString()) : 0;
                                if (isNaN(balance)) {
                                    errors.push(`Row ${index + 2}: Invalid balance value "${balanceStr}"`);
                                    continue;
                                }
                                
                                // Support both defaultCur and defaultCurrency column names (case-insensitive)
                                const defaultCurrency = (row.defaultCurrency || row.defaultCur || row.DefaultCurrency || row.DefaultCur || 'USD').trim();
                                
                                const partner = {
                                    id: partnerId,
                                    name: row.name,
                                    type: row.type,
                                    balance: balance, // Set balance from CSV - addPartner will handle opening balance entries
                                    defaultCurrency: defaultCurrency,
                                    contact: row.contact || '',
                                    country: row.country || '',
                                    phone: row.phone || '',
                                    email: row.email || '',
                                    divisionId: row.divisionId || undefined,
                                    subDivisionId: row.subDivisionId || undefined,
                                    creditLimit: row.creditLimit ? parseFloat(row.creditLimit) : undefined,
                                    taxId: row.taxId || undefined,
                                    commissionRate: row.commissionRate ? parseFloat(row.commissionRate) : undefined,
                                    parentSupplier: row.parentSupplier || undefined,
                                    licenseNumber: row.licenseNumber || undefined,
                                    scacCode: row.scacCode || undefined
                                };
                                await addPartner(partner);
                                successCount++;
                                break;
                            }
                            case 'accounts': {
                                const account = {
                                    id: row.id,
                                    code: row.code || row.id,
                                    name: row.name,
                                    type: row.type,
                                    balance: parseFloat(row.balance) || 0,
                                    description: row.description || '',
                                    currency: row.currency || 'USD'
                                };
                                await addAccount(account);
                                successCount++;
                                break;
                            }
                            case 'divisions': {
                                // Auto-generate ID if not provided
                                let divisionId = row.id;
                                if (!divisionId || divisionId.trim() === '') {
                                    const prefix = 'DIV';
                                    const existingIds = state.divisions
                                        .map((d: any) => {
                                            const match = d.id?.match(/^DIV-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0)
                                        .sort((a, b) => b - a);
                                    const processedIds = parsedData.slice(0, index)
                                        .filter((r: any) => r.id && r.id.match(/^DIV-(\d+)$/))
                                        .map((r: any) => {
                                            const match = r.id.match(/^DIV-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0);
                                    const allIds = [...existingIds, ...processedIds].sort((a, b) => b - a);
                                    const nextNumber = allIds.length > 0 ? allIds[0] + 1 : 1001;
                                    divisionId = `${prefix}-${nextNumber}`;
                                }
                                // Location is optional (can be blank)
                                const division = {
                                    id: divisionId,
                                    name: row.name,
                                    location: row.location || ''
                                };
                                addDivision(division);
                                successCount++;
                                break;
                            }
                            case 'subDivisions': {
                                if (!row.divisionId) {
                                    errors.push(`Row ${index + 2}: SubDivision missing required field 'divisionId'`);
                                    continue;
                                }
                                // Auto-generate ID if not provided
                                let subDivisionId = row.id;
                                if (!subDivisionId || subDivisionId.trim() === '') {
                                    const prefix = 'SDIV';
                                    const existingIds = state.subDivisions
                                        .map((sd: any) => {
                                            const match = sd.id?.match(/^SDIV-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0)
                                        .sort((a, b) => b - a);
                                    const processedIds = parsedData.slice(0, index)
                                        .filter((r: any) => r.id && r.id.match(/^SDIV-(\d+)$/))
                                        .map((r: any) => {
                                            const match = r.id.match(/^SDIV-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0);
                                    const allIds = [...existingIds, ...processedIds].sort((a, b) => b - a);
                                    const nextNumber = allIds.length > 0 ? allIds[0] + 1 : 1001;
                                    subDivisionId = `${prefix}-${nextNumber}`;
                                }
                                const subDivision = {
                                    id: subDivisionId,
                                    name: row.name,
                                    divisionId: row.divisionId
                                };
                                addSubDivision(subDivision);
                                successCount++;
                                break;
                            }
                            case 'originalTypes': {
                                if (!row.packingType || !row.packingSize) {
                                    errors.push(`Row ${index + 2}: OriginalType missing required fields (packingType, packingSize)`);
                                    continue;
                                }
                                // Auto-generate ID if not provided
                                let originalTypeId = row.id;
                                if (!originalTypeId || originalTypeId.trim() === '') {
                                    const prefix = 'OT';
                                    const existingIds = state.originalTypes
                                        .map((ot: any) => {
                                            const match = ot.id?.match(/^OT-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0)
                                        .sort((a, b) => b - a);
                                    const processedIds = parsedData.slice(0, index)
                                        .filter((r: any) => r.id && r.id.match(/^OT-(\d+)$/))
                                        .map((r: any) => {
                                            const match = r.id.match(/^OT-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0);
                                    const allIds = [...existingIds, ...processedIds].sort((a, b) => b - a);
                                    const nextNumber = allIds.length > 0 ? allIds[0] + 1 : 1001;
                                    originalTypeId = `${prefix}-${nextNumber}`;
                                }
                                const originalType = {
                                    id: originalTypeId.trim(),
                                    name: row.name,
                                    packingType: row.packingType,
                                    packingSize: parseFloat(row.packingSize) || 0
                                };
                                await addOriginalType(originalType);
                                successCount++;
                                break;
                            }
                            case 'originalProducts': {
                                if (!row.originalTypeId) {
                                    errors.push(`Row ${index + 2}: OriginalProduct missing required field 'originalTypeId'`);
                                    continue;
                                }
                                // Auto-generate ID if not provided
                                let originalProductId = row.id;
                                if (!originalProductId || originalProductId.trim() === '') {
                                    const prefix = 'ORP';
                                    const existingIds = state.originalProducts
                                        .map((op: any) => {
                                            const match = op.id?.match(/^ORP-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0)
                                        .sort((a, b) => b - a);
                                    const processedIds = parsedData.slice(0, index)
                                        .filter((r: any) => r.id && r.id.match(/^ORP-(\d+)$/))
                                        .map((r: any) => {
                                            const match = r.id.match(/^ORP-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0);
                                    const allIds = [...existingIds, ...processedIds].sort((a, b) => b - a);
                                    const nextNumber = allIds.length > 0 ? allIds[0] + 1 : 1001;
                                    originalProductId = `${prefix}-${nextNumber}`;
                                }
                                const originalProduct = {
                                    id: originalProductId,
                                    name: row.name,
                                    originalTypeId: row.originalTypeId
                                };
                                addOriginalProduct(originalProduct);
                                successCount++;
                                break;
                            }
                            case 'categories': {
                                const category = {
                                    id: row.id,
                                    name: row.name
                                };
                                addCategory(category);
                                successCount++;
                                break;
                            }
                            case 'sections': {
                                const section = {
                                    id: row.id,
                                    name: row.name
                                };
                                addSection(section);
                                successCount++;
                                break;
                            }
                            case 'logos': {
                                const logo = {
                                    id: row.id,
                                    name: row.name
                                };
                                addLogo(logo);
                                successCount++;
                                break;
                            }
                            case 'warehouses': {
                                // Auto-generate ID if not provided
                                let warehouseId = row.id;
                                if (!warehouseId || warehouseId.trim() === '') {
                                    const prefix = 'WH';
                                    const existingIds = state.warehouses
                                        .map((w: any) => {
                                            const match = w.id?.match(/^WH-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0)
                                        .sort((a, b) => b - a);
                                    const processedIds = parsedData.slice(0, index)
                                        .filter((r: any) => r.id && r.id.match(/^WH-(\d+)$/))
                                        .map((r: any) => {
                                            const match = r.id.match(/^WH-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0);
                                    const allIds = [...existingIds, ...processedIds].sort((a, b) => b - a);
                                    const nextNumber = allIds.length > 0 ? allIds[0] + 1 : 1001;
                                    warehouseId = `${prefix}-${nextNumber}`;
                                }
                                const warehouse = {
                                    id: warehouseId,
                                    name: row.name,
                                    location: row.location || undefined
                                };
                                addWarehouse(warehouse);
                                successCount++;
                                break;
                            }
                            default:
                                errors.push(`Row ${index + 2}: Unknown entity type ${selectedEntity}`);
                        }
                        } catch (entityErr) {
                            errors.push(`Row ${index + 2}: ${entityErr instanceof Error ? entityErr.message : 'Unknown error'}`);
                        }
                    } catch (err) {
                        errors.push(`Row ${index + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    }
                }
            }

            console.log(`✅ Successfully imported ${successCount} ${selectedEntity}`);

            setImportResult({
                success: successCount,
                failed: errors.length,
                errors
            });

            console.log('📊 ========== IMPORT COMPLETE ==========');
            console.log(`✅ Total items processed: ${successCount}`);
            console.log(`❌ Total errors: ${errors.length}`);
            console.log('⏳ Waiting 15 seconds before reloading page...');
            console.log('📋 Please copy all logs above before page reloads');
            console.log('==========================================');
            
            // Wait 15 seconds before reloading so user can copy logs
            if (successCount > 0) {
                setTimeout(() => {
                    console.log('🔄 Reloading page now...');
                    window.location.reload();
                }, 15000);
            }
        } catch (error) {
            console.error('❌ Import error:', error);
            alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setImporting(false);
        }
    };

    const exportExisting = (entity: ImportableEntity) => {
        let data: any[] = [];
        
        switch (entity) {
            case 'items':
                data = state.items.map(item => ({
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    section: item.section,
                    packingType: item.packingType,
                    weightPerUnit: item.weightPerUnit,
                    avgCost: item.avgCost,
                    salePrice: item.salePrice || 0,
                    stockQty: item.stockQty,
                    openingStock: item.openingStock || 0
                }));
                break;
            case 'partners':
                data = state.partners.map(p => ({
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    country: p.country,
                    defaultCurrency: p.defaultCurrency,
                    balance: p.balance,
                    divisionId: p.divisionId || '',
                    subDivisionId: p.subDivisionId || ''
                }));
                break;
            case 'accounts':
                data = state.accounts.map(a => ({
                    id: a.id,
                    code: a.code,
                    name: a.name,
                    type: a.type,
                    balance: a.balance,
                    description: a.description || '',
                    currency: a.currency || 'USD'
                }));
                break;
            case 'divisions':
                data = state.divisions.map(d => ({
                    id: d.id,
                    name: d.name,
                    location: d.location || ''
                }));
                break;
            case 'subDivisions':
                data = state.subDivisions.map(sd => ({
                    id: sd.id,
                    name: sd.name,
                    divisionId: sd.divisionId
                }));
                break;
            case 'originalTypes':
                data = state.originalTypes.map(ot => ({
                    id: ot.id,
                    name: ot.name,
                    packingType: ot.packingType,
                    packingSize: ot.packingSize
                }));
                break;
            case 'originalProducts':
                data = state.originalProducts.map(op => ({
                    id: op.id,
                    name: op.name,
                    originalTypeId: op.originalTypeId
                }));
                break;
            case 'categories':
                data = state.categories.map(c => ({
                    id: c.id,
                    name: c.name
                }));
                break;
            case 'sections':
                data = state.sections.map(s => ({
                    id: s.id,
                    name: s.name
                }));
                break;
            case 'logos':
                data = state.logos.map(l => ({
                    id: l.id,
                    name: l.name
                }));
                break;
            case 'warehouses':
                data = state.warehouses.map(w => ({
                    id: w.id,
                    name: w.name,
                    location: w.location || ''
                }));
                break;
            case 'purchases':
                data = state.purchases.map(p => {
                    // Find LogisticsEntry for this purchase to get receivedWeight
                    const logistics = state.logisticsEntries.find(le => 
                        le.purchaseId === p.id && 
                        le.purchaseType === 'ORIGINAL'
                    );
                    return {
                        supplierId: p.supplierId,
                        subSupplierId: p.subSuppliers && p.subSuppliers.length > 0 ? p.subSuppliers[0] : '',
                        originalTypeId: p.originalTypeId,
                        originalProductId: p.originalProductId || (p.items && p.items.length > 0 ? p.items[0].originalProductId : '') || '',
                        weightPurchased: p.weightPurchased,
                        costPerKgFCY: p.costPerKgFCY,
                        totalCostFCY: p.totalCostFCY,
                        batchNumber: p.batchNumber || '',
                        containerNumber: p.containerNumber || '',
                        divisionId: p.divisionId || '',
                        subDivisionId: p.subDivisionId || '',
                        status: p.status,
                        receivedWeight: logistics?.receivedWeight || (p.status === 'Arrived' || p.status === 'Cleared' ? p.weightPurchased : '')
                    };
                });
                break;
            default:
                alert('Export not implemented for this entity yet');
                return;
        }

        if (data.length === 0) {
            alert('No data to export');
            return;
        }

        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${entity}_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                    <Database size={32} />
                    <h2 className="text-2xl font-bold">Bulk Data Import/Export</h2>
                </div>
                <p className="text-purple-100">Import thousands of records from CSV files or export existing data</p>
            </div>

            {/* Entity Selector */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Select Entity Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.keys(CSV_TEMPLATES).map((entity) => (
                        <button
                            key={entity}
                            onClick={() => {
                                setSelectedEntity(entity as ImportableEntity);
                                setParsedData([]);
                                setShowPreview(false);
                                setImportResult(null);
                            }}
                            className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                                selectedEntity === entity
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {entity.charAt(0).toUpperCase() + entity.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Download Template */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Download className="text-blue-600" size={24} />
                        <h3 className="font-bold text-slate-800">Download Template</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                        Download a pre-formatted CSV template with sample data for <strong>{selectedEntity}</strong>
                    </p>
                    <button
                        onClick={() => downloadTemplate(selectedEntity)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-semibold"
                    >
                        <Download size={18} />
                        Download {selectedEntity} Template
                    </button>
                </div>

                {/* Export Existing */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <FileText className="text-emerald-600" size={24} />
                        <h3 className="font-bold text-slate-800">Export Existing Data</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                        Export current <strong>{selectedEntity}</strong> data ({
                            selectedEntity === 'items' ? state.items.length :
                            selectedEntity === 'partners' ? state.partners.length :
                            selectedEntity === 'purchases' ? state.purchases.length :
                            selectedEntity === 'accounts' ? state.accounts.length :
                            selectedEntity === 'divisions' ? state.divisions.length :
                            selectedEntity === 'subDivisions' ? state.subDivisions.length :
                            selectedEntity === 'originalTypes' ? state.originalTypes.length :
                            selectedEntity === 'originalProducts' ? state.originalProducts.length :
                            selectedEntity === 'categories' ? state.categories.length :
                            selectedEntity === 'sections' ? state.sections.length :
                            selectedEntity === 'logos' ? state.logos.length :
                            selectedEntity === 'warehouses' ? state.warehouses.length :
                            selectedEntity === 'purchases' ? state.purchases.length :
                            '0'
                        } records) to CSV
                    </p>
                    <button
                        onClick={() => exportExisting(selectedEntity)}
                        className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 font-semibold"
                    >
                        <FileText size={18} />
                        Export {selectedEntity}
                    </button>
                </div>
            </div>

            {/* Upload */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Upload className="text-purple-600" size={24} />
                    <h3 className="font-bold text-slate-800">Upload CSV File</h3>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="csv-upload"
                    />
                    <label
                        htmlFor="csv-upload"
                        className="cursor-pointer flex flex-col items-center gap-3"
                    >
                        <Upload className="text-purple-600" size={48} />
                        <div>
                            <p className="text-lg font-semibold text-slate-800">
                                Click to upload {selectedEntity} CSV
                            </p>
                            <p className="text-sm text-slate-500 mt-1">
                                Supports CSV files up to 10MB
                            </p>
                        </div>
                        <div className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700">
                            Browse Files
                        </div>
                    </label>
                </div>
            </div>

            {/* Preview & Import */}
            {showPreview && parsedData.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-slate-800">Preview Data</h3>
                            <p className="text-sm text-slate-600">{parsedData.length} records found</p>
                        </div>
                        <button
                            onClick={() => setShowPreview(false)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    {Object.keys(parsedData[0]).map((key) => (
                                        <th key={key} className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                                            {key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {parsedData.slice(0, 50).map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50">
                                        {Object.values(row).map((value: any, i) => (
                                            <td key={i} className="px-4 py-2 text-slate-700">
                                                {value?.toString() || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {parsedData.length > 50 && (
                            <div className="p-4 bg-slate-50 text-center text-sm text-slate-600">
                                Showing first 50 of {parsedData.length} records
                            </div>
                        )}
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                        <div className="text-sm text-slate-600">
                            Ready to import {parsedData.length} {selectedEntity}
                        </div>
                        <button
                            onClick={validateAndImport}
                            disabled={importing}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold disabled:bg-slate-400 flex items-center gap-2"
                        >
                            {importing ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Database size={18} />
                                    Import to Firebase
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Import Result */}
            {importResult && (
                <div className={`rounded-lg border p-6 ${
                    importResult.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                }`}>
                    <div className="flex items-center gap-3 mb-4">
                        {importResult.failed > 0 ? (
                            <AlertCircle className="text-amber-600" size={24} />
                        ) : (
                            <CheckCircle className="text-emerald-600" size={24} />
                        )}
                        <h3 className="font-bold text-slate-800">Import Results</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                            <div className="text-sm text-slate-600">Successfully Imported</div>
                            <div className="text-2xl font-bold text-emerald-600">{importResult.success}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-red-200">
                            <div className="text-sm text-slate-600">Failed</div>
                            <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                        </div>
                    </div>
                    {importResult.errors.length > 0 && (
                        <div className="bg-white rounded-lg p-4 border border-amber-200">
                            <h4 className="font-semibold text-slate-700 mb-2">Errors:</h4>
                            <div className="max-h-48 overflow-y-auto text-sm text-slate-600 space-y-1">
                                {importResult.errors.map((error, index) => (
                                    <div key={index} className="text-red-600">• {error}</div>
                                ))}
                            </div>
                        </div>
                    )}
                    {importResult.success > 0 && (
                        <div className="mt-4 p-4 bg-blue-100 border border-blue-200 rounded-lg text-blue-800 text-sm">
                            ℹ️ Page will refresh automatically to load new data from Firebase...
                        </div>
                    )}
                </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <FileText size={20} />
                    How to Import Data
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                    <li>Select the entity type you want to import (Items, Partners, Accounts, etc.)</li>
                    <li>Download the CSV template to see the required column format</li>
                    <li>Fill in your data in Excel/Google Sheets following the template format</li>
                    <li>Save as CSV file</li>
                    <li>Upload the CSV file using the upload button above</li>
                    <li>Preview the data to ensure it looks correct</li>
                    <li>Click "Import to Firebase" to add all records to your database</li>
                    <li>Page will refresh automatically to show new data</li>
                </ol>
            </div>
        </div>
    );
};
