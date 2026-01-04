import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { getExchangeRates } from '../context/DataContext';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Database, X, Copy, Check } from 'lucide-react';
import Papa from 'papaparse';
import { collection, writeBatch, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { TransactionType, LedgerEntry, Partner, AccountType } from '../types';
// Removed getAccountId import - using dynamic account lookup from state.accounts instead

type ImportableEntity = 
    | 'items' 
    | 'partners' 
    | 'accounts' 
    | 'originalTypes' 
    | 'categories' 
    | 'sections'
    | 'divisions'
    | 'subDivisions'
    | 'purchases'
    | 'originalProducts'
    | 'logos'
    | 'warehouses';

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
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [validItemCount, setValidItemCount] = useState(0);
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

            // CRITICAL VALIDATION: Detect if wrong entity type is selected
            // Check if CSV contains partner data (has 'type' field) when Items is selected
            if (selectedEntity === 'items') {
                const hasTypeField = parsedData.some(row => row.type && 
                    ['CUSTOMER', 'SUPPLIER', 'VENDOR', 'SUB SUPPLIER', 'CLEARING AGENT'].includes(row.type.toUpperCase().trim())
                );
                if (hasTypeField) {
                    const partnerCount = parsedData.filter(row => row.type && 
                        ['CUSTOMER', 'SUPPLIER', 'VENDOR', 'SUB SUPPLIER', 'CLEARING AGENT'].includes(row.type.toUpperCase().trim())
                    ).length;
                    alert(`❌ CRITICAL ERROR: You selected "Items" but your CSV contains Partner data!\n\nFound ${partnerCount} partner(s) with 'type' field (CUSTOMER, SUPPLIER, etc.).\n\nPlease:\n1. Select "Partners" from the entity dropdown\n2. Re-upload your CSV file\n\nImport cancelled to prevent data corruption.`);
                    setImporting(false);
                    return;
                }
            }
            
            // Check if CSV contains item data (has 'category' or 'section' field) when Partners is selected
            if (selectedEntity === 'partners') {
                const hasItemFields = parsedData.some(row => row.category || row.section || row.avgCost || row.openingStock);
                if (hasItemFields && !parsedData.some(row => row.type && 
                    ['CUSTOMER', 'SUPPLIER', 'VENDOR', 'SUB SUPPLIER', 'CLEARING AGENT'].includes(row.type.toUpperCase().trim())
                )) {
                    alert(`❌ CRITICAL ERROR: You selected "Partners" but your CSV appears to contain Item data!\n\nFound fields like 'category', 'section', 'avgCost', or 'openingStock' which are Item fields.\n\nPlease:\n1. Select "Items" from the entity dropdown\n2. Re-upload your CSV file\n\nImport cancelled to prevent data corruption.`);
                    setImporting(false);
                    return;
                }
            }

            // Special handling for large item imports - use batch writes
            if (selectedEntity === 'items' && parsedData.length > 100) {
                // Batch import for large item lists (1500+ items)
                const BATCH_SIZE = 500; // Firebase limit is 500 operations per batch
                const validItems: any[] = [];
                const seenCodes = new Set<string>(); // Track item codes to prevent duplicates
                
                console.log(`≡ƒôè Starting import of ${parsedData.length} items`);
                
                // Build validation sets for categories and sections (for THIS factory only)
                const validCategoryIds = new Set(state.categories.map(c => c.id));
                const validCategoryNames = new Set(state.categories.map(c => c.name.toLowerCase().trim()));
                const validSectionIds = new Set(state.sections.map(s => s.id));
                const validSectionNames = new Set(state.sections.map(s => s.name.toLowerCase().trim()));
                
                // Validate and prepare all items first
                for (let index = 0; index < parsedData.length; index++) {
                    const row = parsedData[index];
                    if (!row.name) {
                        errors.push(`Row ${index + 2}: Missing required field 'name'`);
                        continue;
                    }
                    
                    // Validate category if provided
                    const categoryCode = row.category?.trim();
                    if (categoryCode) {
                        const categoryExists = validCategoryIds.has(categoryCode) || 
                                              validCategoryNames.has(categoryCode.toLowerCase());
                        if (!categoryExists) {
                            errors.push(`Row ${index + 2}: Category "${categoryCode}" does not exist in Setup. Please create this category first or use an existing category.`);
                            continue; // Skip this item
                        }
                    }
                    
                    // Validate section if provided
                    const sectionCode = row.section?.trim();
                    if (sectionCode) {
                        const sectionExists = validSectionIds.has(sectionCode) || 
                                             validSectionNames.has(sectionCode.toLowerCase());
                        if (!sectionExists) {
                            errors.push(`Row ${index + 2}: Section "${sectionCode}" does not exist in Setup. Please create this section first or use an existing section.`);
                            continue; // Skip this item
                        }
                    }
                    
                    // Generate unique ID and code
                    const itemCode = row.code || row.id || `ITEM-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
                    
                    // Check for duplicate codes in the CSV itself
                    if (seenCodes.has(itemCode)) {
                        console.warn(`ΓÜá∩╕Å Duplicate item code in CSV row ${index + 2}: ${itemCode}`);
                        errors.push(`Row ${index + 2}: Duplicate item code: ${itemCode}`);
                        continue;
                    }
                    seenCodes.add(itemCode);
                    
                    const openingStock = parseFloat(row.openingStock) || 0;
                    const avgCost = parseFloat(row.avgCost) || 0;
                    
                    // Validate opening stock has avgCost
                    if (openingStock > 0 && (avgCost === 0 || isNaN(avgCost))) {
                        errors.push(`Row ${index + 2}: Item "${row.name}" has opening stock (${openingStock}) but avgCost is missing or zero. Ledger entries will NOT be created. Please provide avgCost to create opening stock ledger entries.`);
                        // Still import item, but warn about missing ledger entries
                    }
                    
                    const item = {
                        id: row.id || itemCode, // Use the unique code as ID if no ID provided
                        code: itemCode,
                        name: row.name,
                        category: categoryCode || '',
                        section: sectionCode || '',
                        packingType: row.packingType || 'Kg',
                        weightPerUnit: parseFloat(row.weightPerUnit) || 0,
                        avgCost: avgCost,
                        salePrice: parseFloat(row.salePrice) || 0,
                        stockQty: parseFloat(row.stockQty) || 0,
                        openingStock: openingStock,
                        nextSerial: openingStock + 1,
                        factoryId: currentFactory?.id || ''
                    };
                    validItems.push(item);
                }
                
                console.log(`Γ£à Prepared ${validItems.length} unique items for import (from ${parsedData.length} CSV rows)`);
                
                // Show validation summary before import
                if (errors.length > 0) {
                    const validationErrs = errors.filter(e => e.includes('does not exist') || e.includes('Ledger entries will NOT'));
                    const otherErrs = errors.filter(e => !validationErrs.includes(e));
                    
                    if (validItems.length === 0) {
                        // Show all errors in modal for user to note
                        setValidationErrors([...validationErrs, ...otherErrs]);
                        setValidItemCount(0);
                        setShowValidationModal(true);
                        setImporting(false);
                        return;
                    }
                    
                    // Show validation modal with errors for user to note
                    setValidationErrors([...validationErrs, ...otherErrs]);
                    setValidItemCount(validItems.length);
                    setShowValidationModal(true);
                    setImporting(false);
                    return; // Wait for user to review and confirm
                }
                
                // Process in batches with delays to avoid rate limiting
                console.log(`≡ƒôª Starting batch processing: ${validItems.length} items in ${Math.ceil(validItems.length / BATCH_SIZE)} batch(es)`);
                
                // First, check for existing items with same (factoryId, code) to UPDATE them instead of creating duplicates
                const itemsCollection = collection(db, 'items');
                const existingItemsQuery = query(itemsCollection, where('factoryId', '==', currentFactory?.id || ''));
                const existingItemsSnapshot = await getDocs(existingItemsQuery);
                const existingItemsMap = new Map<string, { docId: string; existingData: any }>(); // Map: code -> {docId, existingData}
                existingItemsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.code) {
                        existingItemsMap.set(data.code, { docId: doc.id, existingData: data });
                    }
                });

                // Separate items into new and existing
                const itemsToCreate: any[] = [];
                const itemsToUpdate: Array<{ item: any; docId: string }> = [];
                
                validItems.forEach(item => {
                    const existing = existingItemsMap.get(item.code);
                    if (existing) {
                        itemsToUpdate.push({ item, docId: existing.docId });
                        console.log(`🔄 Will UPDATE item ${item.name} (code: ${item.code}) - existing document ID: ${existing.docId}`);
                    } else {
                        itemsToCreate.push(item);
                        console.log(`➕ Will CREATE new item ${item.name} (code: ${item.code})`);
                    }
                });

                if (itemsToCreate.length === 0 && itemsToUpdate.length === 0) {
                    alert('No items to import.');
                    setImporting(false);
                    return;
                }

                if (itemsToUpdate.length > 0) {
                    console.log(`📝 ${itemsToUpdate.length} item(s) will be updated, ${itemsToCreate.length} item(s) will be created.`);
                }

                // Process in batches with delays to avoid rate limiting
                const allItems = [...itemsToCreate, ...itemsToUpdate.map(u => u.item)];
                for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
                    const batch = writeBatch(db);
                    const batchItems = allItems.slice(i, i + BATCH_SIZE);
                    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                    
                    console.log(`≡ƒôª Batch ${batchNumber}: Preparing ${batchItems.length} items for Firebase write`);
                    const itemsInBatch: string[] = [];
                    
                    for (const item of batchItems) {
                        const existing = existingItemsMap.get(item.code);
                        const { id: csvId, ...itemData } = item;
                        
                        if (existing) {
                            // UPDATE existing item
                            const itemRef = doc(db, 'items', existing.docId);
                            const itemDataForUpdate = {
                                ...itemData,
                                code: csvId || item.code, // Preserve code
                                updatedAt: serverTimestamp()
                            };
                            
                            console.log(`  🔄 Updating in batch: ${item.name} (code: ${itemDataForUpdate.code}, Firestore ID: ${existing.docId})`);
                            itemsInBatch.push(`${item.name} (${itemDataForUpdate.code}) [UPDATED]`);
                            
                            batch.update(itemRef, itemDataForUpdate);
                        } else {
                            // CREATE new item
                            const itemRef = doc(collection(db, 'items'));
                            const itemDataForSave = {
                                ...itemData,
                                code: csvId || item.code || `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                createdAt: serverTimestamp()
                            };
                            
                            console.log(`  ➕ Creating in batch: ${item.name} (code: ${itemDataForSave.code}, Firestore ID: ${itemRef.id})`);
                            itemsInBatch.push(`${item.name} (${itemDataForSave.code}) [NEW]`);
                            
                            batch.set(itemRef, itemDataForSave);
                        }
                    }
                    
                    // Commit batch with error handling
                    try {
                        console.log(`≡ƒÆ╛ Batch ${batchNumber}: Committing ${batchItems.length} items to Firebase...`);
                        console.log(`   Items in this batch:`, itemsInBatch);
                        await batch.commit();
                        console.log(`Γ£à Batch ${batchNumber} COMMITTED: ${batchItems.length} items written to Firebase`);
                        
                        // Wait for Firebase listener to load items before creating ledger entries
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Create opening stock ledger entries directly (don't call addItem - it causes duplicates)
                        // Firebase listener already loaded items to state, we just need to create ledger entries
                        
                        // Lookup accounts dynamically (factory-specific, always correct)
                        const finishedGoodsAccount = state.accounts.find(a => 
                            a.name.includes('Finished Goods') || 
                            a.name.includes('Inventory - Finished Goods') ||
                            a.code === '105'
                        );
                        const capitalAccount = state.accounts.find(a => 
                            a.name.includes('Capital') || 
                            a.name.includes('Owner\'s Capital') ||
                            a.code === '301'
                        );
                        
                        if (!finishedGoodsAccount || !capitalAccount) {
                            const missingAccounts = [];
                            if (!finishedGoodsAccount) missingAccounts.push('Inventory - Finished Goods (105)');
                            if (!capitalAccount) missingAccounts.push('Capital (301)');
                            console.error(`❌ Required accounts not found: ${missingAccounts.join(', ')}`);
                            errors.push(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts.`);
                            // Continue with other items, but skip ledger entries
                        } else {
                            const finishedGoodsId = finishedGoodsAccount.id;
                            const capitalId = capitalAccount.id;
                            
                            for (const item of batchItems) {
                                const openingStock = item.openingStock || 0;
                                const avgCost = item.avgCost || 0;
                                
                                if (openingStock > 0 && avgCost !== 0) {
                                    const prevYear = new Date().getFullYear() - 1;
                                    const date = `${prevYear}-12-31`;
                                    const stockValue = openingStock * avgCost;
                                    // Generate unique transactionId with timestamp to allow separate deletion of each upload
                                    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                                    const transactionId = `OB-STK-${item.code || item.id}-${uniqueId}`;
                                    
                                    const entries = [
                                        {
                                            date,
                                            transactionId: transactionId,
                                            transactionType: TransactionType.OPENING_BALANCE,
                                            accountId: finishedGoodsId,
                                            accountName: finishedGoodsAccount.name,
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
                                            transactionId: transactionId,
                                            transactionType: TransactionType.OPENING_BALANCE,
                                            accountId: capitalId,
                                            accountName: capitalAccount.name,
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
                        }
                        
                        successCount += batchItems.length;
                        
                        // Small delay between batches to avoid rate limiting
                        if (i + BATCH_SIZE < validItems.length) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (batchError: any) {
                        console.error(`Γ¥î Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError);
                        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} (rows ${i + 2}-${i + batchItems.length + 1}) failed: ${batchError.message}`);
                    }
                }
            }
            
            // Special handling for partner imports - use batch writes (both large and small batches)
            if (selectedEntity === 'partners' && parsedData.length > 0) {
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
                
                // First, check for existing partners with same (factoryId, id/code) to prevent overwrites
                const partnersCollection = collection(db, 'partners');
                const existingPartnersQuery = query(partnersCollection, where('factoryId', '==', currentFactory?.id || ''));
                const existingPartnersSnapshot = await getDocs(existingPartnersQuery);
                const existingPartnerCodes = new Set<string>();
                existingPartnersSnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Check both id and code fields (some partners may have code field)
                    if (data.id) existingPartnerCodes.add(data.id);
                    if (data.code) existingPartnerCodes.add(data.code);
                });

                // Filter out partners that already exist with same code/id for this factory
                const partnersToImport = validPartners.filter(partner => {
                    if (existingPartnerCodes.has(partner.id)) {
                        console.warn(`⚠️ Skipping partner ${partner.name} (id: ${partner.id}) - already exists for factory ${currentFactory?.name}`);
                        return false;
                    }
                    return true;
                });

                if (partnersToImport.length === 0) {
                    alert('All partners already exist for this factory. No partners imported.');
                    setImporting(false);
                    return;
                }

                if (partnersToImport.length < validPartners.length) {
                    alert(`${validPartners.length - partnersToImport.length} partner(s) skipped (already exist). ${partnersToImport.length} new partner(s) will be imported.`);
                }

                // Process in batches with delays to avoid rate limiting
                let totalLedgerEntriesCreated = 0; // Track total entries across all batches
                for (let i = 0; i < partnersToImport.length; i += BATCH_SIZE) {
                    const batch = writeBatch(db);
                    const batchPartners = partnersToImport.slice(i, i + BATCH_SIZE);
                    
                    for (const partner of batchPartners) {
                        // Use CSV 'id' as business code, let Firestore auto-generate document ID
                        const { id: csvId, openingBalance, ...partnerData } = partner;
                        // Create auto-generated document ID (Firestore will assign it)
                        const partnerRef = doc(collection(db, 'partners'));
                        
                        // Store CSV id as code field (or keep it as id field for backward compatibility)
                        // Note: We'll store it as 'code' to distinguish from Firestore document ID
                        const partnerDataForSave = {
                            ...partnerData,
                            code: csvId, // Store CSV id as code field
                            balance: partner.openingBalance || 0, // Save actual balance for Balance Sheet accuracy
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        };
                        
                        // Remove undefined values
                        Object.keys(partnerDataForSave).forEach(key => {
                            if ((partnerDataForSave as any)[key] === undefined) {
                                (partnerDataForSave as any)[key] = null;
                            }
                        });
                        
                        console.log(`💾 Saving partner to Firebase: ${partner.name} (code: ${csvId}, Firestore ID: ${partnerRef.id})`);
                        batch.set(partnerRef, partnerDataForSave);
                    }
                    
                    // Commit batch with error handling
                    try {
                        await batch.commit();
                        console.log(`Γ£à Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(partnersToImport.length / BATCH_SIZE)} saved: ${batchPartners.length} partners to Firebase`);
                        
                        // Wait for Firebase listener to load partners into state
                        // Increased wait time and add retry logic for better reliability
                        let retryCount = 0;
                        const maxRetries = 5;
                        let allPartnersFound = false;
                        
                        while (retryCount < maxRetries && !allPartnersFound) {
                            await new Promise(resolve => setTimeout(resolve, 1000 + (retryCount * 500))); // Increasing delay
                            
                            // Defensive check: ensure state is still available
                            if (!state || !state.partners) {
                                console.error('❌ State or state.partners is undefined during partner lookup. DataProvider may have unmounted.');
                                errors.push('Critical error: Application state became unavailable during import. Please try again.');
                                break;
                            }
                            
                            // Check if all partners are in state
                            const foundCount = batchPartners.filter(p => {
                                const csvId = p.id;
                                try {
                                    const found = state.partners.some(sp => {
                                        const codeMatch = (sp as any).code === csvId;
                                        const nameMatch = sp.name.toLowerCase().trim() === p.name.toLowerCase().trim();
                                        if (codeMatch || nameMatch) {
                                            console.log(`   ✅ Found in state: ${p.name} (looking for code: ${csvId}, found code: ${(sp as any).code || 'N/A'}, found ID: ${sp.id})`);
                                        }
                                        return codeMatch || nameMatch;
                                    });
                                    if (!found) {
                                        console.log(`   ⏳ Not yet in state: ${p.name} (code: ${csvId}). Available codes: ${state.partners.slice(0, 3).map((sp: any) => sp.code || sp.id).join(', ')}...`);
                                    }
                                    return found;
                                } catch (err) {
                                    console.error(`Error checking partner ${p.name}:`, err);
                                    return false;
                                }
                            }).length;
                            
                            if (foundCount === batchPartners.length) {
                                allPartnersFound = true;
                                console.log(`✅ All ${batchPartners.length} partners loaded into state after ${retryCount + 1} attempt(s)`);
                            } else {
                                retryCount++;
                                console.log(`⏳ Waiting for partners to load... Found ${foundCount}/${batchPartners.length} (attempt ${retryCount}/${maxRetries})`);
                            }
                        }
                        
                        if (!allPartnersFound) {
                            console.warn(`⚠️ Not all partners loaded into state after ${maxRetries} attempts. Proceeding with available partners.`);
                        }
                        
                        // After successful batch commit, handle opening balance ledger entries
                        // Note: Firebase listener will automatically add partners to local state
                        // Process opening balances with a small delay to avoid rate limiting
                        let balanceEntriesCreated = 0;
                        let partnersNotFound: string[] = [];
                        
                        for (let pIdx = 0; pIdx < batchPartners.length; pIdx++) {
                            const partner = batchPartners[pIdx];
                            // Handle opening balance if needed (similar to addPartner logic)
                            if (partner.openingBalance !== 0) {
                                try {
                                    // Find the partner in state by code to get its Firestore document ID
                                    const csvId = partner.id; // This is the CSV id (now stored as code)
                                    
                                    // Defensive check: ensure state is still available
                                    if (!state || !state.partners || !state.accounts) {
                                        const errorMsg = `Critical error: Application state became unavailable while creating ledger entries for partner "${partner.name}". DataProvider may have unmounted.`;
                                        console.error(`❌ ${errorMsg}`);
                                        errors.push(errorMsg);
                                        throw new Error(errorMsg);
                                    }
                                    
                                    // Try multiple lookup strategies
                                    let savedPartner = state.partners.find(p => 
                                        (p as any).code === csvId
                                    );
                                    
                                    // If not found by code, try by name (case-insensitive)
                                    if (!savedPartner) {
                                        savedPartner = state.partners.find(p => 
                                            p.name.toLowerCase().trim() === partner.name.toLowerCase().trim() &&
                                            p.type === partner.type
                                        );
                                    }
                                    
                                    // If still not found, try by ID (in case code wasn't set properly)
                                    if (!savedPartner) {
                                        savedPartner = state.partners.find(p => 
                                            p.id === csvId || (p as any).id === csvId
                                        );
                                    }
                                    
                                    // FALLBACK: If not found in state, query Firebase directly
                                    if (!savedPartner) {
                                        console.warn(`⚠️ Partner "${partner.name}" (code: ${csvId}) not found in state. Querying Firebase directly...`);
                                        try {
                                            const partnersQuery = query(
                                                collection(db, 'partners'),
                                                where('factoryId', '==', currentFactory?.id || ''),
                                                where('code', '==', csvId)
                                            );
                                            const partnersSnapshot = await getDocs(partnersQuery);
                                            
                                            if (!partnersSnapshot.empty) {
                                                const firebasePartner = partnersSnapshot.docs[0].data();
                                                savedPartner = {
                                                    id: partnersSnapshot.docs[0].id,
                                                    name: firebasePartner.name,
                                                    type: firebasePartner.type,
                                                    ...firebasePartner
                                                } as Partner;
                                                console.log(`✅ Found partner "${partner.name}" in Firebase directly: ID=${savedPartner.id}, Code=${(savedPartner as any).code || 'N/A'}`);
                                            } else {
                                                // Try by name as fallback
                                                const partnersByNameQuery = query(
                                                    collection(db, 'partners'),
                                                    where('factoryId', '==', currentFactory?.id || '')
                                                );
                                                const allPartnersSnapshot = await getDocs(partnersByNameQuery);
                                                const foundByName = allPartnersSnapshot.docs.find(doc => {
                                                    const data = doc.data();
                                                    return data.name.toLowerCase().trim() === partner.name.toLowerCase().trim() &&
                                                           data.type === partner.type;
                                                });
                                                
                                                if (foundByName) {
                                                    const firebasePartner = foundByName.data();
                                                    savedPartner = {
                                                        id: foundByName.id,
                                                        name: firebasePartner.name,
                                                        type: firebasePartner.type,
                                                        ...firebasePartner
                                                    } as any;
                                                    console.log(`✅ Found partner "${partner.name}" in Firebase by name: ID=${savedPartner.id}, Code=${(savedPartner as any).code || 'N/A'}`);
                                                }
                                            }
                                        } catch (firebaseError: any) {
                                            console.error(`❌ Error querying Firebase for partner "${partner.name}":`, firebaseError);
                                        }
                                    }
                                    
                                    if (!savedPartner) {
                                        // Enhanced debugging: log what's actually in state
                                        console.error(`❌ Could not find partner "${partner.name}" (code: ${csvId}, type: ${partner.type})`);
                                        console.error(`   Available partners in state (${state.partners.length}):`, 
                                            state.partners.slice(0, 5).map(p => ({
                                                id: p.id,
                                                code: (p as any).code || 'N/A',
                                                name: p.name,
                                                type: p.type
                                            }))
                                        );
                                        const errorMsg = `Could not find partner "${partner.name}" (code: ${csvId}, type: ${partner.type}) in state after save. Available partners: ${state.partners.length}`;
                                        console.error(`❌ ${errorMsg}`);
                                        partnersNotFound.push(`${partner.name} (${csvId})`);
                                        errors.push(`Partner "${partner.name}" not found in state - ledger entries NOT created. Please check console for details.`);
                                        continue;
                                    }
                                    
                                    console.log(`✅ Found partner "${partner.name}" in state: ID=${savedPartner.id}, Code=${(savedPartner as any).code || 'N/A'}`);
                                    
                                    const prevYear = new Date().getFullYear() - 1;
                                    const date = `${prevYear}-12-31`;
                                    
                                    // Defensive check: ensure accounts are available
                                    if (!state.accounts || state.accounts.length === 0) {
                                        const errorMsg = `Critical error: Accounts not available while creating ledger entries for partner "${partner.name}".`;
                                        console.error(`❌ ${errorMsg}`);
                                        errors.push(errorMsg);
                                        continue;
                                    }
                                    
                                    // Lookup Capital account dynamically (factory-specific, always correct)
                                    const capitalAccount = state.accounts.find(a => 
                                        a.name.includes('Capital') || 
                                        a.name.includes('Owner\'s Capital') ||
                                        a.code === '301'
                                    );
                                    
                                    if (!capitalAccount) {
                                        console.error(`❌ Capital account not found for partner ${partner.name}`);
                                        errors.push(`Missing Capital account. Please ensure Capital account exists in Setup > Chart of Accounts.`);
                                        continue; // Skip this partner's opening balance
                                    }
                                    
                                    const openingEquityId = capitalAccount.id;
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
                                                transactionId: `OB-${csvId}`, // Use CSV code for transaction ID
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: savedPartner.id, // Use Firestore document ID
                                                accountName: partner.name,
                                                debit: partner.openingBalance,
                                                credit: 0,
                                                narration: `Opening Balance - ${partner.name}`,
                                                factoryId: currentFactory?.id || ''
                                            },
                                            {
                                                ...commonProps,
                                                date,
                                                transactionId: `OB-${csvId}`, // Use CSV code for transaction ID
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: openingEquityId,
                                                accountName: capitalAccount.name,
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
                                                transactionId: `OB-${csvId}`, // Use CSV code for transaction ID
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: openingEquityId,
                                                accountName: capitalAccount.name,
                                                debit: absBalance,
                                                credit: 0,
                                                narration: `Opening Balance - ${partner.name}`,
                                                factoryId: currentFactory?.id || ''
                                            },
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${csvId}`, // Use CSV code for transaction ID
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: savedPartner.id, // Use Firestore document ID
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
                                                transactionId: `OB-${csvId}`, // Use CSV code for transaction ID
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: openingEquityId,
                                                accountName: capitalAccount.name,
                                                debit: 0,
                                                credit: absBalance,
                                                narration: `Opening Balance - ${partner.name}`,
                                                factoryId: currentFactory?.id || ''
                                            },
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${csvId}`, // Use CSV code for transaction ID
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: savedPartner.id, // Use Firestore document ID
                                                    accountName: partner.name,
                                                    debit: absBalance,
                                                    credit: 0,
                                                    narration: `Opening Balance - ${partner.name}`,
                                                    factoryId: currentFactory?.id || ''
                                                }
                                            ];
                                        }
                                    }
                                    
                                    // Defensive check before posting transaction
                                    if (!postTransaction) {
                                        throw new Error('postTransaction function is not available. DataProvider may have unmounted.');
                                    }
                                    
                                    await postTransaction(entries);
                                    balanceEntriesCreated++;
                                    totalLedgerEntriesCreated += entries.length;
                                    console.log(`✅ Created opening balance ledger entries for partner "${partner.name}" (${entries.length} entries)`);
                                    
                                    // Small delay every 10 partners to avoid Firebase rate limiting
                                    if ((pIdx + 1) % 10 === 0) {
                                        await new Promise(resolve => setTimeout(resolve, 200));
                                    }
                                } catch (error: any) {
                                    const errorMsg = error?.message || 'Unknown error';
                                    console.error(`❌ Error creating opening balance for ${partner.name}:`, error);
                                    
                                    // Check if it's a DataProvider error
                                    if (errorMsg.includes('useData') || errorMsg.includes('DataProvider')) {
                                        errors.push(`CRITICAL: Application state error for partner "${partner.name}". Please refresh and try again.`);
                                        throw error; // Re-throw to stop processing
                                    } else {
                                        errors.push(`Failed to create opening balance for ${partner.name}: ${errorMsg}`);
                                    }
                                }
                            }
                        }
                        
                        if (balanceEntriesCreated > 0) {
                            console.log(`✅ Created ${balanceEntriesCreated} opening balance entries for batch ${Math.floor(i / BATCH_SIZE) + 1}`);
                        } else {
                            console.warn(`⚠️ No opening balance entries created for batch ${Math.floor(i / BATCH_SIZE) + 1}. Check if partners have openingBalance !== 0.`);
                        }
                        
                        if (partnersNotFound.length > 0) {
                            console.error(`❌ ${partnersNotFound.length} partner(s) not found in state after save:`, partnersNotFound);
                            errors.push(`${partnersNotFound.length} partner(s) not found in state - ledger entries NOT created: ${partnersNotFound.join(', ')}`);
                        }
                        
                        successCount += batchPartners.length;
                        
                        // Small delay between batches to avoid rate limiting
                        if (i + BATCH_SIZE < validPartners.length) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (batchError: any) {
                        console.error(`Γ¥î Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError);
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
                
                console.log(`≡ƒôè Starting import of ${parsedData.length} purchases (Original Stock)`);
                console.log(`≡ƒôà Using upload date: ${uploadDate}`);
                
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
                    const supplier = state.partners.find(p => 
                        p.id === supplierId || (p as any).code === supplierId
                    );
                    if (!supplier) {
                        errors.push(`Row ${index + 2}: Supplier with ID/Code "${supplierId}" not found. Please create supplier first or use the correct Code from Business Partners (CODE column).`);
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
                        const subSupplier = state.partners.find(p => 
                            p.id === subSupplierId || (p as any).code === subSupplierId
                        );
                        if (!subSupplier) {
                            errors.push(`Row ${index + 2}: Sub Supplier with ID/Code "${subSupplierId}" not found. Please create sub supplier first or leave blank. Use the Code from Business Partners (CODE column).`);
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
                    
                    // Optional fields - lookup by code
                    let divisionId = undefined;
                    if (row.divisionId?.trim()) {
                        const divisionCode = row.divisionId.trim();
                        const division = state.divisions.find(d => 
                            d.factoryId === currentFactory?.id && 
                            (d.code || d.id) === divisionCode
                        );
                        if (division) {
                            divisionId = division.code || division.id; // Store code, not Firebase ID
                        } else {
                            errors.push(`Row ${index + 2}: Division Code "${divisionCode}" not found. Please create the division first or use correct code.`);
                            continue;
                        }
                    }
                    
                    let subDivisionId = undefined;
                    if (row.subDivisionId?.trim()) {
                        const subDivisionCode = row.subDivisionId.trim();
                        const subDivision = state.subDivisions.find(sd => 
                            sd.factoryId === currentFactory?.id && 
                            (sd.code || sd.id) === subDivisionCode
                        );
                        if (subDivision) {
                            subDivisionId = subDivision.code || subDivision.id; // Store code, not Firebase ID
                        } else {
                            errors.push(`Row ${index + 2}: SubDivision Code "${subDivisionCode}" not found. Please create the subDivision first or use correct code.`);
                            continue;
                        }
                    }
                    
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
                
                console.log(`Γ£à Prepared ${validPurchases.length} valid purchases for import (from ${parsedData.length} CSV rows)`);
                
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
                        console.log(`Γ£à Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validPurchases.length / BATCH_SIZE)} committed: ${batchPurchases.length} purchases saved to Firebase`);
                        
                        // Wait for Firebase listener to load purchases
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Create LogisticsEntry records for Arrived/Cleared containers (offloading data)
                        // This tracks receivedWeight vs invoicedWeight (purchase weight)
                        let logisticsEntriesCreated = 0;
                        let logisticsEntriesFailed: string[] = [];
                        
                        for (const purchase of batchPurchases) {
                            // Create logistics entries for ALL purchases with container numbers and status Arrived/Cleared
                            // Not just those with csvLogisticsData (which only exists if receivedWeight was provided)
                            if (purchase.containerNumber && (purchase.status === 'Arrived' || purchase.status === 'Cleared')) {
                                try {
                                    // Get logistics data from CSV if available, otherwise use purchase data
                                    const logisticsData = (purchase as any).csvLogisticsData;
                                    const invoicedWeight = logisticsData?.invoicedWeight || purchase.weightPurchased;
                                    const receivedWeight = logisticsData?.receivedWeight || purchase.weightPurchased; // Default to invoiced if not provided
                                    const shortageKg = invoicedWeight - receivedWeight;
                                    
                                    const logisticsEntry: any = {
                                        id: `LOG-${purchase.id}-${Date.now()}`,
                                        purchaseId: purchase.id,
                                        purchaseType: 'ORIGINAL' as const,
                                        containerNumber: purchase.containerNumber,
                                        status: purchase.status,
                                        arrivalDate: purchase.status === 'Arrived' || purchase.status === 'Cleared' ? purchase.date : undefined,
                                        invoicedWeight: invoicedWeight,
                                        receivedWeight: receivedWeight,
                                        shortageKg: shortageKg
                                    };
                                    
                                    // Use saveLogisticsEntry to save offloading data (now async)
                                    await saveLogisticsEntry(logisticsEntry);
                                    logisticsEntriesCreated++;
                                    console.log(`✅ Created LogisticsEntry for purchase ${purchase.batchNumber} (Container: ${purchase.containerNumber}, Invoice: ${invoicedWeight}kg, Received: ${receivedWeight}kg, Shortage: ${shortageKg}kg)`);
                                    
                                    // Small delay to avoid rate limiting
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                } catch (error: any) {
                                    const errorMsg = `Failed to create LogisticsEntry for batch ${purchase.batchNumber} (Container: ${purchase.containerNumber}): ${error.message}`;
                                    console.error(`❌ ${errorMsg}`);
                                    logisticsEntriesFailed.push(purchase.batchNumber);
                                    errors.push(errorMsg);
                                }
                            } else if (purchase.containerNumber && purchase.status === 'In Transit') {
                                // For In Transit purchases, we don't create logistics entries yet (will be created on offloading)
                                console.log(`ℹ️ Purchase ${purchase.batchNumber} (Container: ${purchase.containerNumber}) is "In Transit" - logistics entry will be created on offloading`);
                            } else if (!purchase.containerNumber) {
                                // No container number - no logistics entry needed
                                console.log(`ℹ️ Purchase ${purchase.batchNumber} has no container number - skipping logistics entry`);
                            }
                        }
                        
                        if (logisticsEntriesCreated > 0) {
                            console.log(`✅ Created ${logisticsEntriesCreated} logistics entries for batch ${Math.floor(i / BATCH_SIZE) + 1}`);
                        }
                        
                        if (logisticsEntriesFailed.length > 0) {
                            console.error(`❌ Failed to create ${logisticsEntriesFailed.length} logistics entries: ${logisticsEntriesFailed.join(', ')}`);
                        }
                        
                        // Create opening balance ledger entries for Raw Material Inventory and Capital
                        // BATCHED: Collect all entries first, then post in one batch for speed
                        
                        // Lookup Raw Material INVENTORY account dynamically (factory-specific, always correct)
                        // IMPORTANT: Restrict to ASSET accounts so we don't accidentally pick
                        // expense accounts like "Raw Material Consumption"
                        const rawMaterialAccount = state.accounts.find(a => 
                            a.type === AccountType.ASSET && (
                                a.name.includes('Inventory - Raw Material') ||
                                a.name.includes('Inventory - Raw Materials') ||
                                a.name.includes('Raw Material Inventory') ||
                                a.code === '104' ||
                                a.code === '1200'
                            )
                        );
                        const capitalAccount = state.accounts.find(a => 
                            a.name.includes('Capital') || 
                            a.name.includes('Owner\'s Capital') ||
                            a.code === '301'
                        );
                        
                        if (!rawMaterialAccount || !capitalAccount) {
                            const missingAccounts = [];
                            if (!rawMaterialAccount) missingAccounts.push('Inventory - Raw Material (104 or 1200)');
                            if (!capitalAccount) missingAccounts.push('Capital (301)');
                            console.error(`❌ Account lookup failed for purchase ledger entries: ${missingAccounts.join(', ')}`);
                            errors.push(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts. Ledger entries NOT created for ${batchPurchases.length} purchase(s).`);
                        } else {
                            console.log(`✅ Found required accounts: Raw Material="${rawMaterialAccount.name}" (${rawMaterialAccount.id}), Capital="${capitalAccount.name}" (${capitalAccount.id})`);
                            const rawMaterialInvId = rawMaterialAccount.id;
                            const capitalId = capitalAccount.id;
                            
                            // Collect all ledger entries for this batch
                            const allLedgerEntries: Omit<LedgerEntry, 'id'>[] = [];
                            
                            for (const purchase of batchPurchases) {
                                try {
                                    const stockValue = purchase.totalLandedCost || purchase.totalCostFCY || 0;
                                    
                                    if (stockValue <= 0) {
                                        console.log(`ΓÜá∩╕Å Purchase ${purchase.batchNumber} has zero value, skipping ledger entries`);
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
                                    console.error(`Γ¥î Error preparing ledger entries for purchase ${purchase.batchNumber}:`, error);
                                    errors.push(`Failed to prepare ledger entries for batch ${purchase.batchNumber}: ${error.message}`);
                                }
                            }
                            
                            // Post all ledger entries in ONE batch call (much faster!)
                            if (allLedgerEntries.length > 0) {
                                try {
                                    await postTransaction(allLedgerEntries);
                                    console.log(`✅ Created ${allLedgerEntries.length} ledger entries (${batchPurchases.length} purchase(s)) in one batch`);
                                    console.log(`   - ${allLedgerEntries.length / 2} purchase(s) with opening stock ledger entries`);
                                } catch (error: any) {
                                    console.error(`❌ Error posting batch ledger entries:`, error);
                                    errors.push(`Failed to post ledger entries batch: ${error.message}. ${allLedgerEntries.length} ledger entries were prepared but NOT saved.`);
                                }
                            } else {
                                const purchasesWithValue = batchPurchases.filter(p => (p.totalLandedCost || p.totalCostFCY || 0) > 0).length;
                                if (purchasesWithValue > 0) {
                                    console.warn(`⚠️ No ledger entries created for batch ${Math.floor(i / BATCH_SIZE) + 1}, but ${purchasesWithValue} purchase(s) have values. This should not happen.`);
                                    errors.push(`Warning: ${purchasesWithValue} purchase(s) have values but no ledger entries were created. Please check console for details.`);
                                } else {
                                    console.log(`ℹ️ No ledger entries needed for batch ${Math.floor(i / BATCH_SIZE) + 1} - all purchases have zero value`);
                                }
                            }
                        }
                        
                        successCount += batchPurchases.length;
                        
                        // Small delay between batches
                        if (i + BATCH_SIZE < validPurchases.length) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (batchError: any) {
                        console.error(`Γ¥î Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError);
                        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} (rows ${i + 2}-${i + batchPurchases.length + 1}) failed: ${batchError.message}`);
                    }
                }
            }
            
            // Handle items/partners with batch writes (even for small batches)
            // This prevents duplicates - items/partners are processed here, NOT in the individual path below
            if (selectedEntity === 'items' && parsedData.length <= 100) {
                
                // CRITICAL VALIDATION: Re-check for wrong entity type (small batches)
                const hasTypeField = parsedData.some(row => row.type && 
                    ['CUSTOMER', 'SUPPLIER', 'VENDOR', 'SUB SUPPLIER', 'CLEARING AGENT'].includes(row.type.toUpperCase().trim())
                );
                if (hasTypeField) {
                    const partnerCount = parsedData.filter(row => row.type && 
                        ['CUSTOMER', 'SUPPLIER', 'VENDOR', 'SUB SUPPLIER', 'CLEARING AGENT'].includes(row.type.toUpperCase().trim())
                    ).length;
                    alert(`❌ CRITICAL ERROR: You selected "Items" but your CSV contains Partner data!\n\nFound ${partnerCount} partner(s) with 'type' field (CUSTOMER, SUPPLIER, etc.).\n\nPlease:\n1. Select "Partners" from the entity dropdown\n2. Re-upload your CSV file\n\nImport cancelled to prevent data corruption.`);
                    setImporting(false);
                    return;
                }
                
                const BATCH_SIZE = 500; // Firebase limit is 500 operations per batch
                const validItems: any[] = [];
                
                // Build validation sets for categories and sections (for THIS factory only)
                const validCategoryIds = new Set(state.categories.map(c => c.id));
                const validCategoryNames = new Set(state.categories.map(c => c.name.toLowerCase().trim()));
                const validSectionIds = new Set(state.sections.map(s => s.id));
                const validSectionNames = new Set(state.sections.map(s => s.name.toLowerCase().trim()));
                
                // Validate and prepare all items first
                for (let index = 0; index < parsedData.length; index++) {
                    const row = parsedData[index];
                    if (!row.name) {
                        errors.push(`Row ${index + 2}: Missing required field 'name'`);
                        continue;
                    }
                    
                    // Validate category if provided
                    const categoryCode = row.category?.trim();
                    if (categoryCode) {
                        const categoryExists = validCategoryIds.has(categoryCode) || 
                                              validCategoryNames.has(categoryCode.toLowerCase());
                        if (!categoryExists) {
                            errors.push(`Row ${index + 2}: Category "${categoryCode}" does not exist in Setup. Please create this category first or use an existing category.`);
                            continue; // Skip this item
                        }
                    }
                    
                    // Validate section if provided
                    const sectionCode = row.section?.trim();
                    if (sectionCode) {
                        const sectionExists = validSectionIds.has(sectionCode) || 
                                             validSectionNames.has(sectionCode.toLowerCase());
                        if (!sectionExists) {
                            errors.push(`Row ${index + 2}: Section "${sectionCode}" does not exist in Setup. Please create this section first or use an existing section.`);
                            continue; // Skip this item
                        }
                    }
                    
                    const openingStock = parseFloat(row.openingStock) || 0;
                    const avgCost = parseFloat(row.avgCost) || 0;
                    
                    // Validate opening stock has avgCost
                    if (openingStock > 0 && (avgCost === 0 || isNaN(avgCost))) {
                        errors.push(`Row ${index + 2}: Item "${row.name}" has opening stock (${openingStock}) but avgCost is missing or zero. Ledger entries will NOT be created. Please provide avgCost to create opening stock ledger entries.`);
                        // Still import item, but warn about missing ledger entries
                    }
                    
                    const item = {
                        id: row.id || `ITEM-${Date.now()}-${index}`,
                        code: row.code || row.id || `ITEM-${Date.now()}-${index}`,
                        name: row.name,
                        category: categoryCode || '',
                        section: sectionCode || '',
                        packingType: row.packingType || 'Kg',
                        weightPerUnit: parseFloat(row.weightPerUnit) || 0,
                        avgCost: avgCost,
                        salePrice: parseFloat(row.salePrice) || 0,
                        stockQty: parseFloat(row.stockQty) || 0,
                        openingStock: openingStock,
                        nextSerial: openingStock + 1,
                        factoryId: currentFactory?.id || ''
                    };
                    validItems.push(item);
                }
                
                // Show validation summary before import
                if (errors.length > 0) {
                    const validationErrs = errors.filter(e => e.includes('does not exist') || e.includes('Ledger entries will NOT'));
                    const otherErrs = errors.filter(e => !validationErrs.includes(e));
                    
                    if (validItems.length === 0) {
                        // Show all errors in modal for user to note
                        setValidationErrors([...validationErrs, ...otherErrs]);
                        setValidItemCount(0);
                        setShowValidationModal(true);
                        setImporting(false);
                        return;
                    }
                    
                    // Show validation modal with errors for user to note
                    setValidationErrors([...validationErrs, ...otherErrs]);
                    setValidItemCount(validItems.length);
                    setShowValidationModal(true);
                    setImporting(false);
                    return; // Wait for user to review and confirm
                }
                
                // First, check for existing items with same (factoryId, code) to UPDATE them instead of creating duplicates
                const itemsCollection = collection(db, 'items');
                const existingItemsQuery = query(itemsCollection, where('factoryId', '==', currentFactory?.id || ''));
                const existingItemsSnapshot = await getDocs(existingItemsQuery);
                const existingItemsMap = new Map<string, { docId: string; existingData: any }>(); // Map: code -> {docId, existingData}
                existingItemsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.code) {
                        existingItemsMap.set(data.code, { docId: doc.id, existingData: data });
                    }
                });

                // Separate items into new and existing
                const itemsToCreate: any[] = [];
                const itemsToUpdate: Array<{ item: any; docId: string }> = [];
                
                validItems.forEach(item => {
                    const existing = existingItemsMap.get(item.code);
                    if (existing) {
                        itemsToUpdate.push({ item, docId: existing.docId });
                        console.log(`🔄 Will UPDATE item ${item.name} (code: ${item.code}) - existing document ID: ${existing.docId}`);
                    } else {
                        itemsToCreate.push(item);
                        console.log(`➕ Will CREATE new item ${item.name} (code: ${item.code})`);
                    }
                });

                if (itemsToCreate.length === 0 && itemsToUpdate.length === 0) {
                    alert('No items to import.');
                    setImporting(false);
                    return;
                }

                if (itemsToUpdate.length > 0) {
                    console.log(`📝 ${itemsToUpdate.length} item(s) will be updated, ${itemsToCreate.length} item(s) will be created.`);
                }

                // Process in batches with delays to avoid rate limiting
                const allItems = [...itemsToCreate, ...itemsToUpdate.map(u => u.item)];
                for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
                    const batch = writeBatch(db);
                    const batchItems = allItems.slice(i, i + BATCH_SIZE);
                    
                    for (const item of batchItems) {
                        const existing = existingItemsMap.get(item.code);
                        const { id, ...itemData } = item;
                        
                        if (existing) {
                            // UPDATE existing item
                            const itemRef = doc(db, 'items', existing.docId);
                            batch.update(itemRef, {
                                ...itemData,
                                code: item.code, // Preserve code
                                updatedAt: serverTimestamp()
                            });
                            console.log(`🔄 Updating item ${item.name} (code: ${item.code})`);
                        } else {
                            // CREATE new item
                            const itemRef = id 
                                ? doc(db, 'items', id)  // Use item's ID as document ID if provided
                                : doc(collection(db, 'items'));  // Auto-generate if no ID
                            batch.set(itemRef, {
                                ...itemData,
                                createdAt: serverTimestamp()
                            });
                            console.log(`➕ Creating new item ${item.name} (code: ${item.code})`);
                        }
                    }
                    
                    // Commit batch with error handling
                    try {
                        await batch.commit();
                        
                        // After successful batch commit, add to local state and handle opening stock ledger entries
                        // Wait for Firebase listener to load items before creating ledger entries
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Create opening stock ledger entries directly (don't call addItem - it causes duplicates)
                        // Firebase listener already loaded items to state, we just need to create ledger entries
                        
                        // Lookup accounts dynamically (factory-specific, always correct)
                        const finishedGoodsAccount = state.accounts.find(a => 
                            a.name.includes('Finished Goods') || 
                            a.name.includes('Inventory - Finished Goods') ||
                            a.code === '105'
                        );
                        const capitalAccount = state.accounts.find(a => 
                            a.name.includes('Capital') || 
                            a.name.includes('Owner\'s Capital') ||
                            a.code === '301'
                        );
                        
                        if (!finishedGoodsAccount || !capitalAccount) {
                            const missingAccounts = [];
                            if (!finishedGoodsAccount) missingAccounts.push('Inventory - Finished Goods (105)');
                            if (!capitalAccount) missingAccounts.push('Capital (301)');
                            console.error(`❌ Required accounts not found: ${missingAccounts.join(', ')}`);
                            errors.push(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts.`);
                            // Continue with other items, but skip ledger entries
                        } else {
                            const finishedGoodsId = finishedGoodsAccount.id;
                            const capitalId = capitalAccount.id;
                            
                            for (const item of batchItems) {
                                const openingStock = item.openingStock || 0;
                                const avgCost = item.avgCost || 0;
                                
                                if (openingStock > 0 && avgCost !== 0) {
                                    const prevYear = new Date().getFullYear() - 1;
                                    const date = `${prevYear}-12-31`;
                                    const stockValue = openingStock * avgCost;
                                    // Generate unique transactionId with timestamp to allow separate deletion of each upload
                                    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                                    const transactionId = `OB-STK-${item.code || item.id}-${uniqueId}`;
                                    
                                    const entries = [
                                        {
                                            date,
                                            transactionId: transactionId,
                                            transactionType: TransactionType.OPENING_BALANCE,
                                            accountId: finishedGoodsId,
                                            accountName: finishedGoodsAccount.name,
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
                                            transactionId: transactionId,
                                            transactionType: TransactionType.OPENING_BALANCE,
                                            accountId: capitalId,
                                            accountName: capitalAccount.name,
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
                        }
                        
                        successCount += batchItems.length;
                        console.log(`Γ£à Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validItems.length / BATCH_SIZE)} saved: ${batchItems.length} items to Firebase`);
                        
                        // Small delay between batches to avoid rate limiting
                        if (i + BATCH_SIZE < validItems.length) {
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    } catch (batchError: any) {
                        console.error(`Γ¥î Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError);
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
                                console.warn('ΓÜá∩╕Å Items should be processed via batch writes, not individual addItem');
                                break;
                            }
                            case 'partners': {
                                // Partners are handled via batch writes above - should never reach here
                                console.warn('ΓÜá∩╕Å Partners should be processed via batch writes, not individual addPartner');
                                break;
                            }
                            case 'purchases': {
                                // Purchases are handled via batch writes above - should never reach here
                                console.warn('ΓÜá∩╕Å Purchases should be processed via batch writes, not individual addPurchase');
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
                                // CSV id field becomes code field
                                const divisionCode = row.id || row.code || '';
                                
                                // Check for duplicate code (per factory)
                                if (divisionCode && divisionCode.trim() !== '') {
                                    const trimmedCode = divisionCode.trim();
                                    const existingDivision = state.divisions.find(d => 
                                        d.factoryId === state.currentFactory?.id && 
                                        (d.code || d.id) === trimmedCode
                                    );
                                    if (existingDivision) {
                                        errors.push(`Row ${index + 2}: Division Code "${trimmedCode}" already exists. Skipping.`);
                                        continue;
                                    }
                                }
                                
                                // Auto-generate code if not provided
                                let finalCode = divisionCode.trim();
                                if (!finalCode) {
                                    const prefix = 'DIV';
                                    const existingCodes = state.divisions
                                        .filter(d => d.factoryId === state.currentFactory?.id)
                                        .map((d: any) => {
                                            const code = d.code || d.id;
                                            const match = code?.match(/^DIV-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0)
                                        .sort((a, b) => b - a);
                                    const processedCodes = parsedData.slice(0, index)
                                        .filter((r: any) => (r.id || r.code) && (r.id || r.code).match(/^DIV-(\d+)$/))
                                        .map((r: any) => {
                                            const code = r.id || r.code;
                                            const match = code.match(/^DIV-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0);
                                    const allCodes = [...existingCodes, ...processedCodes].sort((a, b) => b - a);
                                    const nextNumber = allCodes.length > 0 ? allCodes[0] + 1 : 1001;
                                    finalCode = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
                                }
                                
                                // Location is optional (can be blank)
                                const division = {
                                    code: finalCode,
                                    name: row.name,
                                    location: row.location || '',
                                    factoryId: state.currentFactory?.id || ''
                                };
                                addDivision(division);
                                successCount++;
                                break;
                            }
                            case 'subDivisions': {
                                if (!row.divisionId) {
                                    errors.push(`Row ${index + 2}: SubDivision missing required field 'divisionId' (Division Code)`);
                                    continue;
                                }
                                
                                // Lookup parent division by code (not Firebase ID)
                                const parentDivisionCode = row.divisionId.trim();
                                const parentDivision = state.divisions.find(d => 
                                    d.factoryId === state.currentFactory?.id && 
                                    (d.code || d.id) === parentDivisionCode
                                );
                                if (!parentDivision) {
                                    errors.push(`Row ${index + 2}: Division Code "${parentDivisionCode}" not found. Please create the division first.`);
                                    continue;
                                }
                                
                                // CSV id field becomes code field
                                const subDivisionCode = row.id || row.code || '';
                                
                                // Check for duplicate code (per factory)
                                if (subDivisionCode && subDivisionCode.trim() !== '') {
                                    const trimmedCode = subDivisionCode.trim();
                                    const existingSubDivision = state.subDivisions.find(sd => 
                                        sd.factoryId === state.currentFactory?.id && 
                                        (sd.code || sd.id) === trimmedCode
                                    );
                                    if (existingSubDivision) {
                                        errors.push(`Row ${index + 2}: SubDivision Code "${trimmedCode}" already exists. Skipping.`);
                                        continue;
                                    }
                                }
                                
                                // Auto-generate code if not provided
                                let finalCode = subDivisionCode.trim();
                                if (!finalCode) {
                                    const prefix = 'SUBDIV';
                                    const existingCodes = state.subDivisions
                                        .filter(sd => sd.factoryId === state.currentFactory?.id)
                                        .map((sd: any) => {
                                            const code = sd.code || sd.id;
                                            const match = code?.match(/^SUBDIV-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0)
                                        .sort((a, b) => b - a);
                                    const processedCodes = parsedData.slice(0, index)
                                        .filter((r: any) => (r.id || r.code) && (r.id || r.code).match(/^SUBDIV-(\d+)$/))
                                        .map((r: any) => {
                                            const code = r.id || r.code;
                                            const match = code.match(/^SUBDIV-(\d+)$/);
                                            return match ? parseInt(match[1]) : 0;
                                        })
                                        .filter(n => n > 0);
                                    const allCodes = [...existingCodes, ...processedCodes].sort((a, b) => b - a);
                                    const nextNumber = allCodes.length > 0 ? allCodes[0] + 1 : 1001;
                                    finalCode = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
                                }
                                
                                const subDivision = {
                                    code: finalCode,
                                    name: row.name,
                                    divisionId: parentDivisionCode, // Store division code, not Firebase ID
                                    factoryId: state.currentFactory?.id || ''
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

            // Calculate ledger entries created for partners and purchases
            let ledgerEntriesInfo = '';
            if (selectedEntity === 'partners' && successCount > 0) {
                // Count partners with opening balance from the imported data
                const partnersWithBalance = parsedData.filter((row: any) => {
                    const balance = row.balance ? parseFloat(row.balance) : 0;
                    return balance !== 0;
                }).length;
                
                // Count ledger entry errors
                const ledgerErrors = errors.filter(e => e.includes('not found in state') || e.includes('ledger entries NOT created') || e.includes('CRITICAL')).length;
                const successfulLedgerEntries = (partnersWithBalance - ledgerErrors) * 2; // Each partner with balance creates 2 ledger entries
                
                if (partnersWithBalance > 0) {
                    if (ledgerErrors === 0) {
                        ledgerEntriesInfo = ` (${partnersWithBalance} partner(s) with opening balances → ${successfulLedgerEntries} ledger entries created ✅)`;
                    } else {
                        ledgerEntriesInfo = ` (${partnersWithBalance} partner(s) with opening balances → ${successfulLedgerEntries} ledger entries created, ${ledgerErrors} partner(s) failed ❌)`;
                    }
                } else {
                    ledgerEntriesInfo = ` (No opening balances - no ledger entries needed)`;
                }
            } else if (selectedEntity === 'purchases' && successCount > 0) {
                // Count purchases with value from the imported data
                const purchasesWithValue = parsedData.filter((row: any) => {
                    const totalCost = parseFloat(row.totalCostFCY) || (parseFloat(row.weightPurchased) || 0) * (parseFloat(row.costPerKgFCY) || 0);
                    return totalCost > 0;
                }).length;
                
                // Count purchases that should have logistics entries (Arrived/Cleared with container)
                const purchasesWithLogistics = parsedData.filter((row: any) => {
                    const status = (row.status?.trim() || 'Arrived').toUpperCase();
                    return (status === 'ARRIVED' || status === 'CLEARED') && row.containerNumber;
                }).length;
                
                const infoParts: string[] = [];
                if (purchasesWithValue > 0) {
                    infoParts.push(`${purchasesWithValue} purchase(s) with values - ledger entries should be created`);
                }
                if (purchasesWithLogistics > 0) {
                    infoParts.push(`${purchasesWithLogistics} purchase(s) with containers (Arrived/Cleared) - logistics entries should be created`);
                }
                
                if (infoParts.length > 0) {
                    ledgerEntriesInfo = ` (${infoParts.join(', ')})`;
                }
            }
            
            console.log(`✅ Successfully imported ${successCount} ${selectedEntity}${ledgerEntriesInfo}`);

            // Show detailed error message if ledger entries failed
            if (selectedEntity === 'partners' && errors.some(e => e.includes('not found in state') || e.includes('ledger entries NOT created'))) {
                const ledgerErrors = errors.filter(e => e.includes('not found in state') || e.includes('ledger entries NOT created'));
                alert(`⚠️ IMPORT WARNING:\n\n${successCount} partner(s) imported successfully.\n\nHowever, ${ledgerErrors.length} partner(s) had issues creating ledger entries:\n\n${ledgerErrors.slice(0, 5).join('\n')}${ledgerErrors.length > 5 ? `\n... and ${ledgerErrors.length - 5} more` : ''}\n\nPlease check the console for details and verify ledger entries in Accounting > Ledger.`);
            } else if (selectedEntity === 'purchases' && errors.some(e => e.includes('Missing required accounts') || e.includes('ledger entries NOT created') || e.includes('No ledger entries created') || e.includes('logistics entry'))) {
                const ledgerErrors = errors.filter(e => e.includes('Missing required accounts') || e.includes('ledger entries NOT created') || e.includes('No ledger entries created') || e.includes('no ledger entries were created'));
                const logisticsErrors = errors.filter(e => e.includes('logistics entry') || e.includes('LogisticsEntry'));
                if (ledgerErrors.length > 0 || logisticsErrors.length > 0) {
                    const allErrors = [...ledgerErrors, ...logisticsErrors];
                    alert(`⚠️ IMPORT WARNING:\n\n${successCount} purchase(s) imported successfully.\n\nHowever, some issues occurred:\n\n${allErrors.slice(0, 3).join('\n')}${allErrors.length > 3 ? `\n... and ${allErrors.length - 3} more` : ''}\n\nPlease check the console for details and verify:\n- Ledger entries in Accounting > Ledger\n- Logistics entries in Logistics module`);
                }
            }

            setImportResult({
                success: successCount,
                failed: errors.length,
                errors
            });

            console.log('≡ƒôè ========== IMPORT COMPLETE ==========');
            console.log(`Γ£à Total items processed: ${successCount}`);
            console.log(`Γ¥î Total errors: ${errors.length}`);
            console.log('ΓÅ│ Waiting 15 seconds before reloading page...');
            console.log('≡ƒôï Please copy all logs above before page reloads');
            console.log('==========================================');
            
            // Wait 15 seconds before reloading so user can copy logs
            if (successCount > 0) {
                setTimeout(() => {
                    console.log('≡ƒöä Reloading page now...');
                    window.location.reload();
                }, 15000);
            }
        } catch (error) {
            console.error('❌ Import error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : '';
            console.error('Error stack:', errorStack);
            
            // Check if it's a DataProvider error
            if (errorMessage.includes('useData must be used within a DataProvider') || errorMessage.includes('DataProvider')) {
                alert(`❌ CRITICAL ERROR: Application state became unavailable during import.\n\nThis usually happens if:\n1. The page was refreshed during import\n2. There was a network error\n3. Firebase connection was lost\n\nError: ${errorMessage}\n\nPlease:\n1. Check your internet connection\n2. Refresh the page\n3. Try importing again with a smaller batch\n\nIf the problem persists, check the browser console (F12) for details.`);
            } else {
                alert(`Import failed: ${errorMessage}\n\nPlease check the browser console (F12) for more details.`);
            }
            
            // Ensure importing state is reset even if there's an error
            try {
                setImporting(false);
            } catch (resetError) {
                console.error('Failed to reset importing state:', resetError);
            }
        }
    };

    const exportExisting = (entity: ImportableEntity) => {
        let data: any[] = [];
        
        switch (entity) {
            case 'items':
                data = state.items.map(item => ({
                    id: item.id,
                    code: item.code, // Include user-assigned code
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
                    id: d.code || d.id, // Export code, fallback to id for backward compatibility
                    name: d.name,
                    location: d.location || ''
                }));
                break;
            case 'subDivisions':
                data = state.subDivisions.map(sd => ({
                    id: sd.code || sd.id, // Export code, fallback to id for backward compatibility
                    name: sd.name,
                    divisionId: sd.divisionId // This is the division code
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
                                    <div key={index} className="text-red-600">ΓÇó {error}</div>
                                ))}
                            </div>
                        </div>
                    )}
                    {importResult.success > 0 && (
                        <div className="mt-4 p-4 bg-blue-100 border border-blue-200 rounded-lg text-blue-800 text-sm">
                            Γä╣∩╕Å Page will refresh automatically to load new data from Firebase...
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

            {/* Validation Error Modal */}
            {showValidationModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="text-amber-600" size={28} />
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">Validation Results</h3>
                                        <p className="text-sm text-slate-600 mt-1">
                                            {validItemCount > 0 
                                                ? `${validItemCount} item(s) are valid and ready to import`
                                                : 'No items can be imported due to validation errors'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowValidationModal(false);
                                        setValidationErrors([]);
                                    }}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-slate-800">
                                        ⚠️ {validationErrors.length} Validation Error(s) Found:
                                    </h4>
                                    <button
                                        onClick={() => {
                                            const errorText = validationErrors.join('\n');
                                            navigator.clipboard.writeText(errorText);
                                            alert('Errors copied to clipboard!');
                                        }}
                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-100 flex items-center gap-2"
                                    >
                                        <Copy size={14} />
                                        Copy All Errors
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mb-4">
                                    Please note down these errors, fix your CSV file, and upload again.
                                </p>
                            </div>
                            
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 max-h-[400px] overflow-y-auto">
                                <div className="space-y-2">
                                    {validationErrors.map((error, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded border border-slate-200 text-sm">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                                                <span className="text-slate-700 font-mono">{error}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowValidationModal(false);
                                    setValidationErrors([]);
                                    setValidItemCount(0);
                                }}
                                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold"
                            >
                                Close & Fix CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
