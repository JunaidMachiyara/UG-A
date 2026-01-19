
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { TransactionType, AccountType, Currency, PartnerType, LedgerEntry } from '../types';
import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from '../constants';
import { EntitySelector } from './EntitySelector';
import { FileText, ArrowRight, ArrowLeftRight, CreditCard, DollarSign, Plus, Trash2, CheckCircle, Calculator, Building, User, RefreshCw, TrendingUp, Filter, Lock, ShieldAlert, Edit2, X, ShoppingBag, Package, RotateCcw, AlertTriangle, Scale, Printer, ChevronUp, ChevronDown, Upload } from 'lucide-react';
import { db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import Papa from 'papaparse';

type VoucherType = 'RV' | 'PV' | 'EV' | 'JV' | 'TR' | 'PB' | 'IA' | 'IAO' | 'RTS' | 'WO' | 'BD' | 'MJV';

interface JvRow {
    id: string;
    accountId: string;
    desc: string;
    debit: number;
    credit: number;
    currency: Currency;
    exchangeRate: number;
    baseAmount?: number; // Base Amount in USD - when entered, auto-calculates exchange rate
}

// Supervisor PIN for secure actions (Hardcoded for clone)
const SUPERVISOR_PIN = '7860';

export const Accounting: React.FC = () => {
    const { state, postTransaction, deleteTransaction, deleteLedgerEntry, alignBalance, alignFinishedGoodsStock, alignOriginalStock } = useData();
    const [activeTab, setActiveTab] = useState<'voucher' | 'ledger' | 'balance-alignment' | 'stock-alignment'>('voucher');

    // --- Voucher State ---
    const [vType, setVType] = useState<VoucherType>('RV');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [voucherNo, setVoucherNo] = useState('');
    
    // Entities / Accounts Selection
    const [sourceId, setSourceId] = useState(''); // Paid From / Transfer From / Customer / Vendor (Credit in PB)
    const [destId, setDestId] = useState('');   // Paid To / Transfer To / Deposit To / Expense (Debit in PB)
    const [pbPaymentMode, setPbPaymentMode] = useState<'CREDIT' | 'CASH'>('CREDIT');
    const [pbVendorId, setPbVendorId] = useState(''); // Used specifically for PB Cash Mode to track vendor for narration
    
    // Financials (Single Sided - RV, PV, EV, PB)
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<Currency>('USD');
    const [exchangeRate, setExchangeRate] = useState<number>(1);
    
    // Financials (Dual Sided - TR / Exchange)
    const [fromAmount, setFromAmount] = useState('');
    const [fromCurrency, setFromCurrency] = useState<Currency>('USD');
    const [fromRate, setFromRate] = useState<number>(1);
    
    const [toAmount, setToAmount] = useState('');
    const [toCurrency, setToCurrency] = useState<Currency>('USD');
    const [toRate, setToRate] = useState<number>(1);

    const [description, setDescription] = useState('');

    // Journal Voucher Rows
    const [jvRows, setJvRows] = useState<JvRow[]>([
        { id: '1', accountId: '', desc: '', debit: 0, credit: 0, currency: 'USD', exchangeRate: 1 },
        { id: '2', accountId: '', desc: '', debit: 0, credit: 0, currency: 'USD', exchangeRate: 1 }
    ]);

    // New Transaction Types State
    // Inventory Adjustment - New Table-Based Design
    interface ItemAdjustment {
        itemId: string;
        adjustmentQty: number | '';
        adjustmentWorth: number | '';
    }
    const [iaItemAdjustments, setIaItemAdjustments] = useState<Record<string, ItemAdjustment>>({});
    const [iaReason, setIaReason] = useState('');
    const [iaFilterCode, setIaFilterCode] = useState('');
    const [iaFilterCategory, setIaFilterCategory] = useState('');
    const [iaFilterItemName, setIaFilterItemName] = useState('');
    
    // Table sorting state for IA
    const [iaSortColumn, setIaSortColumn] = useState<string>('');
    const [iaSortDirection, setIaSortDirection] = useState<'asc' | 'desc'>('asc');
    
    // Target Mode for Inventory Adjustment (similar to IAO)
    interface ItemTarget {
        itemId: string;
        targetQty: number | '';
        targetWorth: number | '';
    }
    const [iaTargets, setIaTargets] = useState<Record<string, ItemTarget>>({});
    const [iaUseTargetMode, setIaUseTargetMode] = useState(false); // Default to Adjustment Mode for backward compatibility

    // Computed filter options for IA
    const iaFilterOptions = useMemo(() => {
        const codes = Array.from(new Set(state.items.map(i => i.code))).sort();
        const categories = Array.from(new Set(
            state.items.map(i => {
                const cat = state.categories.find(c => c.id === i.category || c.name === i.category);
                return cat?.name || i.category;
            })
        )).filter(Boolean).sort();
        const itemNames = Array.from(new Set(state.items.map(i => i.name))).sort();
        
        return {
            codes: codes.map(code => ({ id: code, name: code })),
            categories: categories.map(cat => ({ id: cat, name: cat })),
            itemNames: itemNames.map(name => ({ id: name, name: name }))
        };
    }, [state.items, state.categories]);

    // Original Stock Adjustment - Table-Based Design
    interface OriginalStockAdjustment {
        key: string; // supplierId-subSupplierId-originalTypeId[-productId]
        adjustmentWeight: number | '';
        adjustmentWorth: number | '';
    }
    const [iaoAdjustments, setIaoAdjustments] = useState<Record<string, OriginalStockAdjustment>>({});
    const [iaoReason, setIaoReason] = useState('');
    const [iaoFilterCode, setIaoFilterCode] = useState('');
    const [iaoFilterOriginalType, setIaoFilterOriginalType] = useState('');
    const [iaoFilterSupplier, setIaoFilterSupplier] = useState('');
    
    // NEW SIMPLE ORIGINAL STOCK ADJUSTMENT - Target Values Approach
    interface OriginalStockTarget {
        key: string;
        targetWeight: number | '';
        targetWorth: number | '';
    }
    const [iaoTargets, setIaoTargets] = useState<Record<string, OriginalStockTarget>>({});
    const [useSimpleMode, setUseSimpleMode] = useState(true); // Default to Target Mode (true = Target Mode, false = Adjustment Mode)

    const [rtsSupplierId, setRtsSupplierId] = useState(''); // Return to Supplier
    const [rtsItemId, setRtsItemId] = useState('');
    const [rtsQty, setRtsQty] = useState('');
    const [rtsReason, setRtsReason] = useState('');

    const [woAccountId, setWoAccountId] = useState(''); // Write-off
    const [woReason, setWoReason] = useState('');

    const [bdAccountId, setBdAccountId] = useState(''); // Balancing Discrepancy
    const [bdAdjustmentType, setBdAdjustmentType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
    const [bdReason, setBdReason] = useState('');

    // Manual JV Entry Utility for Original Stock Adjustment
    const [mjvProductId, setMjvProductId] = useState('');
    const [mjvTypeId, setMjvTypeId] = useState('');
    const [mjvSupplierId, setMjvSupplierId] = useState('');
    const [mjvWeight, setMjvWeight] = useState('');
    const [mjvWorth, setMjvWorth] = useState('');
    const [mjvReason, setMjvReason] = useState('Manual Adjustment');

    // --- Ledger Filtering State ---
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterAccountId, setFilterAccountId] = useState('');
    const [filterVoucherId, setFilterVoucherId] = useState('');
    const [filterMinAmount, setFilterMinAmount] = useState('');
    const [filterMaxAmount, setFilterMaxAmount] = useState('');
    const [ledgerVisibleCount, setLedgerVisibleCount] = useState<number>(200);
    
    // PERFORMANCE: Debounce ledger filters so typing/clicking doesn't re-filter 10k+ rows on every change
    const [debouncedLedgerFilters, setDebouncedLedgerFilters] = useState({
        filterDateFrom: '',
        filterDateTo: '',
        filterType: '',
        filterAccountId: '',
        filterVoucherId: '',
        filterMinAmount: '',
        filterMaxAmount: ''
    });
    
    useEffect(() => {
        // Reset pagination whenever filters change
        setLedgerVisibleCount(200);
        
        const handle = setTimeout(() => {
            setDebouncedLedgerFilters({
                filterDateFrom,
                filterDateTo,
                filterType,
                filterAccountId,
                filterVoucherId,
                filterMinAmount,
                filterMaxAmount
            });
        }, 250);
        
        return () => clearTimeout(handle);
    }, [filterDateFrom, filterDateTo, filterType, filterAccountId, filterVoucherId, filterMinAmount, filterMaxAmount]);
    
    // Ledger table sorting state
    const [ledgerSortColumn, setLedgerSortColumn] = useState<string>('date');
    const [ledgerSortDirection, setLedgerSortDirection] = useState<'asc' | 'desc'>('desc');
    const [voucherToDelete, setVoucherToDelete] = useState('');

    // --- Auth Modal State ---
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authPin, setAuthPin] = useState('');
    const [pendingAction, setPendingAction] = useState<{ type: 'DELETE' | 'EDIT', transactionId: string } | null>(null);
    
    // --- Edit Mode State (to prevent data loss) ---
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
    const [originalEntries, setOriginalEntries] = useState<LedgerEntry[]>([]);
    
    // Loading and Progress States
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');

    // --- Computed Options ---
    const cashBankAccounts = useMemo(() => 
        state.accounts.filter(a => a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank') || a.type === AccountType.ASSET)
        .map(a => ({ id: a.id, name: `${a.code} - ${a.name}` })), 
    [state.accounts]);

    const expenseAccounts = useMemo(() => 
        state.accounts.filter(a => a.type === AccountType.EXPENSE)
        .map(a => ({ id: a.id, name: `${a.code} - ${a.name}` })), 
    [state.accounts]);

    const allAccounts = useMemo(() => {
        // Include Chart of Accounts
        const accounts = state.accounts.map(a => ({ id: a.id, name: `${a.code} - ${a.name}` }));
        // Include Partners (they are accounts in the ledger system)
        const partners = state.partners.map(p => ({ id: p.id, name: `${p.name} (${p.type})` }));
        return [...accounts, ...partners];
    }, [state.accounts, state.partners]);

    // PERFORMANCE: Building voucher list can be expensive on large ledgers.
    // Only compute when user is on General Ledger tab.
    const uniqueVouchers = useMemo(() => {
        if (activeTab !== 'ledger') return [];
        return Array.from(new Set(state.ledger.map(e => e.transactionId)))
            .map(tid => ({ id: tid, name: tid }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [activeTab, state.ledger]);

    // PERFORMANCE: Original Stock Data parsing is heavy (and very noisy in console).
    // It should only run when needed (Original Stock Adjustment / Stock Alignment screens).
    const originalStockData = useMemo(() => {
        const needsOriginalStockData = activeTab === 'stock-alignment' || vType === 'IAO' || vType === 'MJV';
        if (!needsOriginalStockData) return [];
        const summary = new Map<string, {
            key: string;
            originalTypeId: string;
            originalTypeName: string;
            supplierId: string;
            supplierName: string;
            subSupplierId?: string;
            subSupplierName?: string;
            originalProductId?: string;
            originalProductName?: string;
            weightInHand: number;
            worth: number;
            avgCostPerKg: number;
        }>();

        // Aggregate purchases
        state.purchases.forEach(purchase => {
            const items = purchase.items && purchase.items.length > 0 
                ? purchase.items 
                : [{
                    originalTypeId: purchase.originalTypeId,
                    originalType: purchase.originalType,
                    originalProductId: purchase.originalProductId,
                    subSupplierId: undefined,
                    weightPurchased: purchase.weightPurchased,
                    totalCostUSD: purchase.totalLandedCost || (purchase.totalCostFCY / (purchase.exchangeRate || 1))
                }];

            items.forEach(purchaseItem => {
                const key = purchaseItem.originalProductId 
                    ? `${purchase.supplierId}-${purchaseItem.subSupplierId || 'none'}-${purchaseItem.originalTypeId}-${purchaseItem.originalProductId}`
                    : `${purchase.supplierId}-${purchaseItem.subSupplierId || 'none'}-${purchaseItem.originalTypeId}`;
                
                if (!summary.has(key)) {
                    const supplier = state.partners.find(p => p.id === purchase.supplierId);
                    const subSupplier = purchaseItem.subSupplierId ? state.partners.find(p => p.id === purchaseItem.subSupplierId) : undefined;
                    const originalType = state.originalTypes.find(ot => ot.id === purchaseItem.originalTypeId);
                    const originalProduct = purchaseItem.originalProductId ? state.originalProducts.find(op => op.id === purchaseItem.originalProductId) : undefined;
                    
                    summary.set(key, {
                        key,
                        originalTypeId: purchaseItem.originalTypeId,
                        originalTypeName: purchaseItem.originalType || originalType?.name || 'Unknown',
                        supplierId: purchase.supplierId,
                        supplierName: supplier?.name || 'Unknown',
                        subSupplierId: purchaseItem.subSupplierId,
                        subSupplierName: subSupplier?.name,
                        originalProductId: purchaseItem.originalProductId,
                        originalProductName: originalProduct?.name,
                        weightInHand: 0,
                        worth: 0,
                        avgCostPerKg: 0
                    });
                }
                
                const item = summary.get(key)!;
                item.weightInHand += purchaseItem.weightPurchased || 0;
                const purchaseCost = (purchaseItem.totalCostUSD || 0) / (purchaseItem.weightPurchased || 1);
                item.avgCostPerKg = ((item.avgCostPerKg * (item.weightInHand - (purchaseItem.weightPurchased || 0))) + 
                                    (purchaseCost * (purchaseItem.weightPurchased || 0))) / item.weightInHand;
            });
        });

        // Subtract openings
        state.originalOpenings.forEach(opening => {
            const matchingKeys = Array.from(summary.keys()).filter(key => {
                const item = summary.get(key)!;
                return item.originalTypeId === opening.originalType && item.supplierId === opening.supplierId;
            });
            
            if (matchingKeys.length > 0) {
                const weightPerItem = opening.weightOpened / matchingKeys.length;
                matchingKeys.forEach(key => {
                    const item = summary.get(key)!;
                    item.weightInHand -= weightPerItem;
                });
            }
        });

        // Subtract direct sales
        const directSalesInvoices = state.salesInvoices.filter(inv => 
            inv.status === 'Posted' && (inv.invoiceNo.startsWith('DS-') || inv.invoiceNo.startsWith('DSINV-'))
        );

        directSalesInvoices.forEach(invoice => {
            invoice.items.forEach(invItem => {
                if (invItem.originalPurchaseId) {
                    const purchase = state.purchases.find(p => p.id === invItem.originalPurchaseId);
                    if (purchase) {
                        const purchaseItems = purchase.items && purchase.items.length > 0 
                            ? purchase.items 
                            : [{
                                originalTypeId: purchase.originalTypeId,
                                originalProductId: purchase.originalProductId,
                                subSupplierId: undefined
                            }];

                        const matchingPurchaseItem = purchaseItems.find(pi => 
                            pi.originalTypeId === invItem.originalTypeId &&
                            (pi.originalProductId || '') === (invItem.originalProductId || '')
                        );
                        
                        if (matchingPurchaseItem) {
                            const key = matchingPurchaseItem.originalProductId 
                                ? `${purchase.supplierId}-${matchingPurchaseItem.subSupplierId || 'none'}-${matchingPurchaseItem.originalTypeId}-${matchingPurchaseItem.originalProductId}`
                                : `${purchase.supplierId}-${matchingPurchaseItem.subSupplierId || 'none'}-${matchingPurchaseItem.originalTypeId}`;
                            
                            const stockItem = summary.get(key);
                            if (stockItem) {
                                stockItem.weightInHand -= invItem.totalKg || 0;
                            }
                        }
                    }
                }
            });
        });

        // Calculate worth for all items BEFORE processing adjustments
        // This ensures current worth is available when converting targets to adjustments
        summary.forEach((item) => {
            if (item.weightInHand > 0 && item.avgCostPerKg > 0) {
                item.worth = item.weightInHand * item.avgCostPerKg;
            }
        });

        // Apply Original Stock Adjustments from ledger entries
        // Look for INVENTORY_ADJUSTMENT transactions with "Original Stock" in narration
        const adjustmentEntries = state.ledger.filter(entry => 
            entry.transactionType === TransactionType.INVENTORY_ADJUSTMENT &&
            entry.narration && 
            (entry.narration.includes('Original Stock Increase') || entry.narration.includes('Original Stock Decrease')) &&
            entry.accountName && 
            (entry.accountName.includes('Raw Materials') || entry.accountName.includes('Inventory - Raw Materials'))
        );

        console.log('📊 Original Stock Data - Found adjustment entries:', adjustmentEntries.length);

        // Group adjustments by transaction ID to get the full adjustment details
        const adjustmentTransactions = new Map<string, { increase: boolean; amount: number; narration: string; weight: number | null }>();
        adjustmentEntries.forEach(entry => {
            if (!adjustmentTransactions.has(entry.transactionId)) {
                const isIncrease = entry.narration?.includes('Original Stock Increase') || false;
                const amount = isIncrease ? (entry.debit || 0) : (entry.credit || 0);
                
                // Parse weight from narration: "Weight: -1 kg" or "Weight: 5 kg" or "Weight: N/A"
                const weightMatch = entry.narration?.match(/Weight:\s*([-\d.]+|N\/A)\s*kg/i);
                const weight = weightMatch && weightMatch[1] !== 'N/A' && weightMatch[1] !== 'N/A' ? parseFloat(weightMatch[1]) : null;
                
                adjustmentTransactions.set(entry.transactionId, {
                    increase: isIncrease,
                    amount: amount,
                    narration: entry.narration || '',
                    weight: weight
                });
            }
        });

        console.log('📊 Original Stock Data - Adjustment transactions:', Array.from(adjustmentTransactions.entries()).map(([id, adj]) => ({
            transactionId: id,
            increase: adj.increase,
            amount: adj.amount,
            weight: adj.weight,
            narration: adj.narration.substring(0, 100)
        })));

        // Track which items have been adjusted so we don't overwrite their worth
        const adjustedItemKeys = new Set<string>();
        
        // Calculate NET adjustments per item (sum all adjustments for each item)
        // This prevents sequential application from overwriting values
        const netAdjustmentsByItem = new Map<string, { weight: number; worth: number }>();
        
        // Track "set to zero" adjustments separately - these override the final value to be exactly 0
        const setToZeroAdjustments = new Map<string, { transactionId: string; typeName: string; supplierName: string; targetWeight: number; targetWorth: number }>();
        const targetModeAdjustments = new Map<string, { transactionId: string; typeName: string; supplierName: string; targetWeight: number | null; targetWorth: number | null }>();
        
        // First pass: Calculate net adjustments for each item
        adjustmentTransactions.forEach((adjustment, transactionId) => {
            const narration = adjustment.narration;
            // Parse narration: "Original Stock Increase/Decrease: {typeName} ({supplierName}) (Weight: {weight} kg, Worth: ${value}) - {reason}"
            // Example: "Original Stock Decrease: CROATIA (USMAN GLOBAL (ASIF BHAI)) (Weight: -1 kg, Worth: $1.00) - adj"
            // Note: Supplier name may contain nested parentheses, so we need a more robust parsing approach
            
            // First, extract the type name (everything after "Increase/Decrease: " until the first " (")
            const typeMatch = narration.match(/Original Stock (Increase|Decrease):\s*([^(]+?)\s*\(/);
            if (!typeMatch) {
                console.warn('⚠️ Original Stock Data - Could not parse type name from narration:', narration);
                return;
            }
            
            const isIncrease = typeMatch[1] === 'Increase';
            const typeName = typeMatch[2].trim();
            
            // Extract supplier name - find content between first "(" after type name and the ")" before " (Weight:"
            // We need to handle nested parentheses, so we'll find the matching ")" before " (Weight:"
            const weightIndex = narration.indexOf(' (Weight:');
            if (weightIndex === -1) {
                console.warn('⚠️ Original Stock Data - Could not find Weight in narration:', narration);
                return;
            }
            
            // Find the supplier name - it's between the first "(" after type name and the ")" before " (Weight:"
            // The typeMatch[0] includes everything up to and including the opening paren
            // Find the position of the opening paren (it's the last character of the match)
            const typeMatchStart = narration.indexOf(typeMatch[0]);
            if (typeMatchStart === -1) {
                console.warn('⚠️ Original Stock Data - Could not find type match in narration:', narration);
                return;
            }
            const firstParenIndex = typeMatchStart + typeMatch[0].length - 1; // The opening paren is the last char of typeMatch[0]
            
            // Find the matching closing paren before " (Weight:" by counting parentheses
            // We need to find the outer closing paren, not the inner one
            let parenCount = 1; // Start at 1 because we're starting at the opening paren
            let supplierEndIndex = -1;
            for (let i = firstParenIndex + 1; i < weightIndex; i++) {
                if (narration[i] === '(') {
                    parenCount++;
                } else if (narration[i] === ')') {
                    parenCount--;
                    // When parenCount reaches 0, we've found the matching closing paren for the first opening paren
                    if (parenCount === 0) {
                        supplierEndIndex = i;
                        break;
                    }
                }
            }
            
            if (supplierEndIndex === -1) {
                console.warn('⚠️ Original Stock Data - Could not find matching closing paren for supplier:', narration);
                return;
            }
            
            const supplierName = narration.substring(firstParenIndex + 1, supplierEndIndex).trim();
            
            console.log('📊 Original Stock Data - Supplier name extraction:', {
                typeMatchStart,
                typeMatchLength: typeMatch[0].length,
                firstParenIndex,
                supplierEndIndex,
                extracted: supplierName,
                fullNarration: narration,
                substring: narration.substring(firstParenIndex, supplierEndIndex + 1),
                charAtFirstParen: narration[firstParenIndex],
                charAtSupplierEnd: narration[supplierEndIndex]
            });
            
            // Check if this is a zero-worth adjustment (user explicitly set worth to 0)
            const isZeroWorthAdjustment = narration.includes('[Zero-Worth Adjustment: Stock worth set to $0.00]');
            
            // Check if this is a "set to zero" adjustment (both weight and worth set to 0)
            const isSetToZeroAdjustment = narration.includes('[SET-TO-ZERO:');
            
            // Extract target values from narration if available (for target mode adjustments)
            // Look for pattern: (Target Weight: X.XX kg) (Target Worth: $Y.YY)
            let targetWeight: number | null = null;
            let targetWorth: number | null = null;
            const targetWeightMatch = narration.match(/\(Target Weight:\s*([\d.-]+)\s*kg\)/);
            const targetWorthMatch = narration.match(/\(Target Worth:\s*\$\s*([\d.-]+)\)/);
            
            if (targetWeightMatch) {
                const parsed = parseFloat(targetWeightMatch[1]);
                targetWeight = isNaN(parsed) ? null : parsed;
            }
            if (targetWorthMatch) {
                const parsed = parseFloat(targetWorthMatch[1]);
                targetWorth = isNaN(parsed) ? null : parsed;
                // Explicitly handle 0 - it's a valid target value
                if (parsed === 0) {
                    targetWorth = 0;
                }
            }
            
            // If this is a SET-TO-ZERO adjustment, ensure we have target values
            if (isSetToZeroAdjustment) {
                // Also try to extract from SET-TO-ZERO marker format: [SET-TO-ZERO: Target Weight=X kg, Target Worth=$Y]
                const setToZeroWeightMatch = narration.match(/\[SET-TO-ZERO: Target Weight=([\d.-]+)\s*kg/);
                const setToZeroWorthMatch = narration.match(/\[SET-TO-ZERO:.*Target Worth=\$\s*([\d.-]+)\]/);
                if (setToZeroWeightMatch && targetWeight === null) {
                    targetWeight = parseFloat(setToZeroWeightMatch[1]);
                }
                if (setToZeroWorthMatch && targetWorth === null) {
                    targetWorth = parseFloat(setToZeroWorthMatch[1]);
                }
                console.log('📊 Original Stock Data - SET-TO-ZERO adjustment detected:', {
                    transactionId,
                    targetWeight,
                    targetWorth
                });
            } else if (targetWeight !== null || targetWorth !== null) {
                // Regular target mode adjustment (not set to zero)
                console.log('📊 Original Stock Data - Target mode adjustment detected:', {
                    transactionId,
                    targetWeight,
                    targetWorth
                });
            }
            
            // Extract worth from "Worth: $X.XX" or use 0 if it's a zero-worth adjustment
            let worthAdjustment = 0;
            if (isZeroWorthAdjustment || isSetToZeroAdjustment) {
                // User explicitly set worth to 0 - use 0 regardless of ledger value
                worthAdjustment = isSetToZeroAdjustment ? (targetWorth || 0) : 0;
                console.log('📊 Original Stock Data - Zero-worth adjustment detected, using 0 for worth');
            } else {
                const worthMatch = narration.match(/Worth:\s*\$\s*([\d.]+)/);
                worthAdjustment = worthMatch ? parseFloat(worthMatch[1]) : adjustment.amount;
            }
            
            console.log('📊 Original Stock Data - Parsing adjustment:', {
                transactionId,
                narration: narration.substring(0, 150),
                typeName,
                supplierName,
                worthAdjustment,
                isIncrease,
                isZeroWorthAdjustment,
                adjustmentWeight: adjustment.weight,
                adjustmentAmount: adjustment.amount
            });
            
            console.log('📊 Original Stock Data - Looking for matches:', {
                typeName,
                supplierName,
                worthAdjustment,
                availableItems: Array.from(summary.values()).map(item => ({
                    typeName: item.originalTypeName,
                    supplierName: item.supplierName,
                    supplierNameIncludes: item.supplierName.includes(supplierName),
                    supplierNameEndsWith: item.supplierName.endsWith(supplierName)
                }))
            });
            
            // Find matching stock items
            // Try exact match first
            let matchingItems = Array.from(summary.values()).filter(item => 
                item.originalTypeName === typeName && 
                item.supplierName === supplierName
            );
            
            // If no exact match, try partial match (supplier name might be nested)
            if (matchingItems.length === 0) {
                matchingItems = Array.from(summary.values()).filter(item => 
                    item.originalTypeName === typeName && 
                    (item.supplierName.includes(supplierName) || supplierName.includes(item.supplierName))
                );
            }
            
            console.log('📊 Original Stock Data - Matching items found:', matchingItems.length, matchingItems.map(item => ({
                key: item.key,
                typeName: item.originalTypeName,
                supplierName: item.supplierName,
                beforeWeight: item.weightInHand,
                beforeWorth: item.worth
            })));
            
            if (matchingItems.length > 0) {
                matchingItems.forEach(item => {
                    // If target values are specified (from target mode), track them separately
                    // This applies to both SET-TO-ZERO and regular target mode adjustments
                    if (targetWeight !== null || targetWorth !== null) {
                        if (isSetToZeroAdjustment) {
                            // SET-TO-ZERO: both weight and worth should be 0
                            setToZeroAdjustments.set(item.key, {
                                transactionId,
                                typeName,
                                supplierName,
                                targetWeight: targetWeight ?? 0,
                                targetWorth: targetWorth ?? 0
                            });
                            console.log('📊 Original Stock Data - SET-TO-ZERO adjustment tracked:', {
                                key: item.key,
                                transactionId,
                                typeName,
                                supplierName,
                                targetWeight: targetWeight ?? 0,
                                targetWorth: targetWorth ?? 0
                            });
                        } else {
                            // Regular target mode adjustment: apply target values directly
                            targetModeAdjustments.set(item.key, {
                                transactionId,
                                typeName,
                                supplierName,
                                targetWeight,
                                targetWorth
                            });
                            console.log('📊 Original Stock Data - Target mode adjustment tracked:', {
                                key: item.key,
                                transactionId,
                                typeName,
                                supplierName,
                                targetWeight,
                                targetWorth
                            });
                        }
                        // Skip normal adjustment accumulation for target mode adjustments
                        // We'll apply them directly in a later pass
                        return;
                    }
                    
                    // Calculate weight adjustment
                    let weightDelta = 0;
                    if (isIncrease) {
                        // Increase: add to stock
                        if (adjustment.weight !== null && !isNaN(adjustment.weight)) {
                            weightDelta = adjustment.weight;
                        } else if (item.avgCostPerKg > 0) {
                            weightDelta = worthAdjustment / item.avgCostPerKg;
                        }
                    } else {
                        // Decrease: subtract from stock
                        if (adjustment.weight !== null && !isNaN(adjustment.weight)) {
                            weightDelta = adjustment.weight; // weight is already negative for decrease
                        } else if (item.avgCostPerKg > 0) {
                            weightDelta = -(worthAdjustment / item.avgCostPerKg);
                        }
                    }
                    
                    // Calculate worth adjustment
                    const worthDelta = isIncrease ? worthAdjustment : -worthAdjustment;
                    
                    // Accumulate net adjustments for this item
                    if (!netAdjustmentsByItem.has(item.key)) {
                        netAdjustmentsByItem.set(item.key, { weight: 0, worth: 0 });
                    }
                    const netAdjustment = netAdjustmentsByItem.get(item.key)!;
                    netAdjustment.weight += weightDelta;
                    netAdjustment.worth += worthDelta;
                    
                    console.log('📊 Original Stock Data - Accumulating adjustment:', {
                        key: item.key,
                        transactionId,
                        weightDelta,
                        worthDelta,
                        netWeight: netAdjustment.weight,
                        netWorth: netAdjustment.worth
                    });
                });
            } else {
                console.warn('⚠️ Original Stock Data - No matching items found for adjustment:', {
                    typeName,
                    supplierName
                });
            }
        });
        
        // Second pass: Apply net adjustments to items (this prevents sequential overwrites)
        console.log('📊 Original Stock Data - Applying net adjustments to items:', {
            totalItems: netAdjustmentsByItem.size,
            items: Array.from(netAdjustmentsByItem.entries()).map(([key, adj]) => ({
                key,
                netWeight: adj.weight,
                netWorth: adj.worth
            }))
        });
        
        netAdjustmentsByItem.forEach((netAdjustment, itemKey) => {
            const item = summary.get(itemKey);
            if (item) {
                const beforeWeight = item.weightInHand;
                const beforeWorth = item.worth;
                
                // Apply net weight adjustment
                item.weightInHand += netAdjustment.weight;
                
                // Apply net worth adjustment
                item.worth += netAdjustment.worth;
                
                // Mark this item as adjusted so we don't overwrite its worth later
                adjustedItemKeys.add(itemKey);
                
                console.log('📊 Original Stock Data - Applied NET adjustment:', {
                    key: itemKey,
                    beforeWeight,
                    afterWeight: item.weightInHand,
                    beforeWorth,
                    afterWorth: item.worth,
                    netWeightAdjustment: netAdjustment.weight,
                    netWorthAdjustment: netAdjustment.worth,
                    weightChanged: beforeWeight !== item.weightInHand,
                    worthChanged: beforeWorth !== item.worth
                });
            } else {
                console.warn('⚠️ Original Stock Data - Item not found in summary for key:', itemKey);
            }
        });
        
        // Third pass: Apply target mode adjustments (set to specific target values)
        // This applies to all adjustments where target values were specified
        console.log('📊 Original Stock Data - Applying target mode adjustments:', {
            totalItems: targetModeAdjustments.size,
            items: Array.from(targetModeAdjustments.entries()).map(([key, info]) => ({
                key,
                transactionId: info.transactionId,
                typeName: info.typeName,
                targetWeight: info.targetWeight,
                targetWorth: info.targetWorth
            }))
        });
        
        targetModeAdjustments.forEach((targetInfo, itemKey) => {
            const item = summary.get(itemKey);
            if (item) {
                const beforeWeight = item.weightInHand;
                const beforeWorth = item.worth;
                
                // Apply target values (use current value if target not specified)
                // Explicitly handle 0 values - they are valid targets
                if (targetInfo.targetWeight !== null && targetInfo.targetWeight !== undefined) {
                    item.weightInHand = targetInfo.targetWeight;
                }
                if (targetInfo.targetWorth !== null && targetInfo.targetWorth !== undefined) {
                    // Explicitly set worth to target value, even if it's 0
                    // This prevents recalculation from weight * avgCostPerKg
                    item.worth = targetInfo.targetWorth;
                }
                
                // Mark this item as adjusted
                adjustedItemKeys.add(itemKey);
                
                console.log('📊 Original Stock Data - Applied target mode adjustment:', {
                    key: itemKey,
                    transactionId: targetInfo.transactionId,
                    typeName: targetInfo.typeName,
                    beforeWeight,
                    afterWeight: item.weightInHand,
                    beforeWorth,
                    afterWorth: item.worth,
                    targetWeight: targetInfo.targetWeight,
                    targetWorth: targetInfo.targetWorth
                });
            } else {
                console.warn('⚠️ Original Stock Data - Item not found in summary for target mode key:', itemKey);
            }
        });
        
        // Fourth pass: Apply "set to zero" adjustments AFTER all other adjustments
        // This ensures that items set to zero remain at zero, regardless of other adjustments
        // CRITICAL: This pass runs LAST to override any previous adjustments
        console.log('📊 Original Stock Data - Applying SET-TO-ZERO adjustments:', {
            totalItems: setToZeroAdjustments.size,
            items: Array.from(setToZeroAdjustments.entries()).map(([key, info]) => ({
                key,
                transactionId: info.transactionId,
                typeName: info.typeName,
                targetWeight: info.targetWeight,
                targetWorth: info.targetWorth
            }))
        });
        
        setToZeroAdjustments.forEach((setToZeroInfo, itemKey) => {
            const item = summary.get(itemKey);
            if (item) {
                const beforeWeight = item.weightInHand;
                const beforeWorth = item.worth;
                
                // IMPORTANT: SET-TO-ZERO adjustments are point-in-time write-offs
                // They set stock to 0,0 at the time of the adjustment
                // However, if NEW purchases were made AFTER the adjustment, we should preserve them
                // 
                // Strategy: Only apply SET-TO-ZERO if the current stock is less than or equal to
                // what it was when the adjustment was made. If stock has increased (new purchases),
                // the new purchases should be preserved.
                //
                // For now, we apply SET-TO-ZERO as a final override, but this means:
                // - Old stock set to 0,0 will stay at 0,0 ✅
                // - New purchases made AFTER the adjustment will also be set to 0,0 ⚠️
                //
                // If you want new purchases to NOT be affected, you should:
                // 1. Delete the SET-TO-ZERO adjustment transaction, OR
                // 2. Make a new adjustment to set the stock to the desired value (including new purchases)
                
                // CRITICAL: Force the item to the exact target values (usually 0,0)
                // This OVERRIDES any previous adjustments - items set to 0,0 MUST stay at 0,0
                // NOTE: This will also set NEW purchases to 0 if they were made after this adjustment
                item.weightInHand = setToZeroInfo.targetWeight;
                item.worth = setToZeroInfo.targetWorth;
                
                // Mark this item as adjusted (prevents recalculation)
                adjustedItemKeys.add(itemKey);
                
                console.log('📊 Original Stock Data - Applied SET-TO-ZERO adjustment (FINAL OVERRIDE):', {
                    key: itemKey,
                    transactionId: setToZeroInfo.transactionId,
                    typeName: setToZeroInfo.typeName,
                    beforeWeight,
                    beforeWorth,
                    afterWeight: item.weightInHand,
                    afterWorth: item.worth,
                    targetWeight: setToZeroInfo.targetWeight,
                    targetWorth: setToZeroInfo.targetWorth,
                    warning: 'This will set stock to 0,0 including any NEW purchases made after this adjustment',
                    note: 'To preserve new purchases, delete this adjustment or create a new adjustment with the desired values'
                });
            } else {
                console.warn('⚠️ Original Stock Data - Item not found in summary for SET-TO-ZERO key:', itemKey);
            }
        });

        // Recalculate worth ONLY for items that were NOT adjusted
        // This preserves the adjustment worth values that were explicitly set (including 0)
        summary.forEach(item => {
            // CRITICAL SAFEGUARD: Items in setToZeroAdjustments MUST NEVER be recalculated
            // They were explicitly set to 0,0 and must remain at 0,0 forever
            if (setToZeroAdjustments.has(item.key)) {
                const setToZeroInfo = setToZeroAdjustments.get(item.key)!;
                // Force to exact target values (guaranteed to be 0,0 for SET-TO-ZERO)
                item.weightInHand = setToZeroInfo.targetWeight;
                item.worth = setToZeroInfo.targetWorth;
                console.log('📊 Original Stock Data - CRITICAL: Enforcing SET-TO-ZERO values (final safeguard):', {
                    key: item.key,
                    enforcedWeight: item.weightInHand,
                    enforcedWorth: item.worth,
                    guarantee: 'This item is locked at 0,0 - cannot be changed by recalculation'
                });
                return; // Skip to next item - do not recalculate
            }
            
            // Calculate worth for all items (weight * avgCostPerKg)
            // This ensures worth is always correct, even if no adjustments exist
            if (!adjustedItemKeys.has(item.key)) {
                // For non-adjusted items, calculate worth from weight and cost
            item.worth = item.weightInHand * item.avgCostPerKg;
            } else {
                // For adjusted items, worth was already set correctly during adjustment
                // Don't overwrite it - it may differ from weight * avgCostPerKg if adjustment worth was specified
                // This includes cases where worth was explicitly set to 0
                const calculatedWorth = item.weightInHand * item.avgCostPerKg;
                console.log('📊 Original Stock Data - Preserving adjustment worth for:', {
                    key: item.key,
                    weight: item.weightInHand,
                    worth: item.worth,
                    avgCostPerKg: item.avgCostPerKg,
                    calculatedWorth: calculatedWorth,
                    isZero: item.worth === 0,
                    wouldBeRecalculated: calculatedWorth !== item.worth
                });
                
                // Double-check: if worth is 0 and was explicitly set, never recalculate it
                // This prevents historical adjustments from overwriting explicit 0 values
                if (item.worth === 0 && (targetModeAdjustments.has(item.key) || setToZeroAdjustments.has(item.key))) {
                    console.log('📊 Original Stock Data - Explicitly preserving zero worth for:', {
                        key: item.key,
                        reason: 'Target worth was explicitly set to 0'
                    });
                    // Worth is already 0, no need to change it
                }
            }
        });

        // Final pass: Ensure worth is calculated for all items that weren't explicitly adjusted
        summary.forEach((item, key) => {
            if (!adjustedItemKeys.has(key)) {
                // For non-adjusted items, calculate worth from weight and cost
                item.worth = item.weightInHand * item.avgCostPerKg;
            }
        });

        // Return all items from summary (they were all purchased at some point)
        // Don't filter by weight > 0 because adjustments may have reduced weight to 0 or negative
        return Array.from(summary.values())
            .sort((a, b) => b.weightInHand - a.weightInHand);
    }, [activeTab, vType, state.purchases, state.originalOpenings, state.salesInvoices, state.partners, state.originalTypes, state.originalProducts, state.ledger]);

    const payees = useMemo(() => {
        // PV: Used for Suppliers, Vendors, Employees, OR paying off Liability/Equity (Drawings)
        // Also used for PB Vendors
        const partners = state.partners.filter(p => 
            [PartnerType.SUPPLIER, PartnerType.VENDOR, PartnerType.COMMISSION_AGENT, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.SUB_SUPPLIER].includes(p.type)
        ).map(p => ({ id: p.id, name: `${p.name} (${p.type})` }));
        const employees = state.employees.map(e => ({ id: e.id, name: `${e.name} (Employee)` }));
        const liabilities = state.accounts.filter(a => a.type === AccountType.LIABILITY || a.type === AccountType.EQUITY).map(a => ({ id: a.id, name: `${a.name} (Account)` }));
        const customers = state.partners.filter(p => p.type === PartnerType.CUSTOMER).map(p => ({ id: p.id, name: `${p.name} (Customer Refund)` }));
        return [...partners, ...employees, ...liabilities, ...customers];
    }, [state.partners, state.employees, state.accounts]);

    const payers = useMemo(() => {
        // RV: Used for Customers, Revenue, OR receiving Capital/Loans
        const customers = state.partners.filter(p => p.type === PartnerType.CUSTOMER).map(p => ({ id: p.id, name: p.name }));
        // Include Equity (Capital) and Liability (Loans) here for receiving money
        const fundingAccs = state.accounts.filter(a => a.type === AccountType.REVENUE || a.type === AccountType.EQUITY || a.type === AccountType.LIABILITY).map(a => ({ id: a.id, name: `${a.name} (${a.type})` }));
        const suppliers = state.partners.filter(p => p.type === PartnerType.SUPPLIER).map(p => ({ id: p.id, name: `${p.name} (Supplier Refund)` }));
        return [...customers, ...fundingAccs, ...suppliers];
    }, [state.partners, state.accounts]);

    // --- Helpers for ID Generation ---
    const generateVoucherId = useCallback((type: VoucherType) => {
        const prefix = type + '-';
        const maxId = state.ledger
            .filter(l => l.transactionId.startsWith(prefix))
            .map(l => parseInt(l.transactionId.replace(prefix, '')))
            .filter(n => !isNaN(n))
            .reduce((max, curr) => curr > max ? curr : max, 1000);
        return `${prefix}${maxId + 1}`;
    }, [state.ledger]);

    // --- Form Reset Logic ---
    const resetForm = (type: VoucherType, preCalculatedVoucherNo?: string) => {
        setVType(type);
        // Use pre-calculated voucher number if provided, otherwise generate new one
        setVoucherNo(preCalculatedVoucherNo || generateVoucherId(type));
        // Reset new transaction type states
        setIaItemAdjustments({});
        setIaTargets({});
        setIaUseTargetMode(false);
        setIaReason('');
        setIaFilterCode('');
        setIaFilterCategory('');
        setIaFilterItemName('');
        setIaoAdjustments({});
        setIaoTargets({});
        setUseSimpleMode(true); // Reset to Target Mode
        setIaoReason('');
        setIaoFilterCode('');
        setIaoFilterOriginalType('');
        setIaoFilterSupplier('');
        setRtsSupplierId('');
        setRtsItemId('');
        setRtsQty('');
        setRtsReason('');
        setWoAccountId('');
        setWoReason('');
        setBdAccountId('');
        setBdAdjustmentType('INCREASE');
        setBdReason('');
        setMjvProductId('');
        setMjvTypeId('');
        setMjvSupplierId('');
        setMjvWeight('');
        setMjvReason('Manual Adjustment');
        
        // Clear all fields
        setSourceId(''); setDestId(''); 
        setAmount(''); setDescription('');
        setFromAmount(''); setToAmount('');
        setCurrency('USD'); setExchangeRate(1);
        setJvRows([{ id: Math.random().toString(), accountId: '', desc: '', debit: 0, credit: 0, currency: 'USD', exchangeRate: 1 }, { id: Math.random().toString(), accountId: '', desc: '', debit: 0, credit: 0, currency: 'USD', exchangeRate: 1 }]);
        
        setPbPaymentMode('CREDIT');
        setPbVendorId('');
        setRtsSupplierId('');
        setRtsItemId('');
        setRtsQty('');
        setRtsReason('');
        setWoAccountId('');
        setWoReason('');
        setBdAccountId('');
        setBdAdjustmentType('INCREASE');
        setBdReason('');
    };

    // Initial Load
    useEffect(() => {
        if (!voucherNo) resetForm('RV');
    }, []);

    // Rate Effects
    useEffect(() => { setExchangeRate(EXCHANGE_RATES[currency] || 1); }, [currency]);
    useEffect(() => { setFromRate(EXCHANGE_RATES[fromCurrency] || 1); }, [fromCurrency]);
    useEffect(() => { setToRate(EXCHANGE_RATES[toCurrency] || 1); }, [toCurrency]);

    const handleCalculateTransfer = () => {
        if (!fromAmount) return;
        const baseUSD = parseFloat(fromAmount) / fromRate;
        const targetAmount = baseUSD * toRate;
        setToAmount(targetAmount.toFixed(2));
    };

    const getTransferVariance = () => {
        const fromBase = parseFloat(fromAmount || '0') / fromRate;
        const toBase = parseFloat(toAmount || '0') / toRate;
        return toBase - fromBase;
    };

    // --- Actions ---
    const handleSave = async () => {
        // Prevent double-clicks and concurrent processing
        if (isProcessing) {
            console.warn('⚠️ Save operation already in progress. Please wait...');
            return;
        }
        
        if (!date) return alert("Date is required");
        
        // Variable to store item stock update function for IA vouchers
        let pendingItemUpdates: (() => Promise<void>) | null = null;
        
        // Declare account variables at function scope for use in logging/debugging
        let inventoryAccount: Account | undefined = undefined;
        let adjustmentAccount: Account | undefined = undefined;
        if (vType !== 'JV' && vType !== 'TR' && vType !== 'IA' && vType !== 'IAO' && vType !== 'MJV' && vType !== 'RTS' && vType !== 'WO' && vType !== 'BD' && (!amount || parseFloat(amount) <= 0)) return alert("Valid amount is required");
        if (vType === 'TR' && (!fromAmount || !toAmount)) return alert("Both Send and Receive amounts are required");
        if (vType !== 'JV' && vType !== 'IA' && vType !== 'IAO' && vType !== 'RTS' && vType !== 'WO' && vType !== 'BD' && !description) return alert("Description is required");
        
        // CRITICAL: Preserve voucher number when editing - DO NOT regenerate
        // Store the original transaction ID and voucher number before any processing
        const isEditing = !!editingTransactionId;
        const originalTransactionId = editingTransactionId;
        const originalVoucherNo = voucherNo; // Preserve the voucher number from edit mode
        
        // If we're editing, delete the old transaction FIRST (before creating new one)
        // This ensures we don't lose data if save fails
        if (originalTransactionId) {
            try {
                setIsProcessing(true);
                setProcessingMessage('🔄 Deleting old transaction...');
                
                console.log(`🔄 Editing transaction: ${originalTransactionId}, preserving voucher number: ${originalVoucherNo}`);
                await deleteTransaction(originalTransactionId, 'Edit Reversal', authPin);
                
                setProcessingMessage('⏳ Verifying deletion...');
                // CRITICAL: Wait a moment for Firestore to sync the deletion
                // This prevents race conditions where new entries are posted before old ones are deleted
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Verify deletion by checking Firebase directly (not state, which may be stale)
                const ledgerQuery = query(
                    collection(db, 'ledger'), 
                    where('transactionId', '==', originalTransactionId),
                    where('factoryId', '==', state.currentFactory?.id || '')
                );
                const ledgerSnapshot = await getDocs(ledgerQuery);
                
                if (!ledgerSnapshot.empty) {
                    console.warn(`⚠️ Warning: ${ledgerSnapshot.size} entries still exist in Firebase after deletion. Retrying...`);
                    setProcessingMessage('🔄 Retrying deletion...');
                    // Retry deletion
                    await deleteTransaction(originalTransactionId, 'Edit Reversal (Retry)', authPin);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Verify again after retry
                    const retrySnapshot = await getDocs(ledgerQuery);
                    if (!retrySnapshot.empty) {
                        setIsProcessing(false);
                        setProcessingMessage('');
                        throw new Error(`Failed to delete ${retrySnapshot.size} existing entries for transaction ${originalTransactionId}. Please delete them manually before editing.`);
                    }
                }
                
                console.log(`✅ Old transaction deleted successfully: ${originalTransactionId}`);
                setProcessingMessage('⏳ Syncing balances...');
                
                // CRITICAL: Wait longer for Firebase balance updates and listeners to complete
                // This ensures balances are fully synced and all Firebase listeners have processed before posting new entries
                // Increased from 300ms to 800ms to handle multiple Firebase listener updates
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // CRITICAL: Keep editingTransactionId set until AFTER new entries are posted
                // This prevents race conditions and ensures we can verify deletion
            } catch (error) {
                setIsProcessing(false);
                setProcessingMessage('');
                console.error('❌ Failed to delete original transaction:', error);
                alert('Failed to delete original transaction. Edit cancelled.');
                return;
            }
        }

        let entries: Omit<LedgerEntry, 'id'>[] = [];
        const baseAmount = parseFloat(amount) / exchangeRate;
        const fcyAmount = parseFloat(amount);

        const common = {
            date,
            transactionId: voucherNo,
            currency,
            exchangeRate,
            fcyAmount,
            narration: description
        };

        if (vType === 'RV') {
            if (!sourceId || !destId) return alert("Select Received From and Deposit To");
            // Resolve actual account/partner names
            const destAccount = state.accounts.find(a => a.id === destId);
            const sourceAccount = state.accounts.find(a => a.id === sourceId);
            const sourcePartner = state.partners.find(p => p.id === sourceId);
            const destName = destAccount?.name || 'Cash/Bank';
            const sourceName = sourcePartner?.name || sourceAccount?.name || 'Payer';
            entries.push({ ...common, transactionType: TransactionType.RECEIPT_VOUCHER, accountId: destId, accountName: destName, debit: baseAmount, credit: 0 });
            entries.push({ ...common, transactionType: TransactionType.RECEIPT_VOUCHER, accountId: sourceId, accountName: sourceName, debit: 0, credit: baseAmount });
        } else if (vType === 'PV') {
            if (!sourceId || !destId) return alert("Select Paid To and Paid From");
            // Resolve actual account/partner names
            const sourceAccount = state.accounts.find(a => a.id === sourceId);
            const destAccount = state.accounts.find(a => a.id === destId);
            const destPartner = state.partners.find(p => p.id === destId);
            const sourceName = sourceAccount?.name || 'Bank/Cash';
            const destName = destPartner?.name || destAccount?.name || 'Payee';
            
            // Check if payment is to a sub-supplier
            const isSubSupplier = destPartner && destPartner.type === PartnerType.SUB_SUPPLIER && destPartner.parentSupplierId;
            const actualPayeeId = isSubSupplier ? destPartner.parentSupplierId : destId;
            const actualPayee = isSubSupplier 
                ? state.partners.find(p => p.id === actualPayeeId) 
                : destPartner;
            const actualPayeeName = actualPayee?.name || destAccount?.name || 'Payee';
            
            // Normal accounting entry: Debit main supplier (or direct payee), Credit Cash/Bank
            entries.push({ 
                ...common, 
                transactionType: TransactionType.PAYMENT_VOUCHER, 
                accountId: actualPayeeId, 
                accountName: actualPayeeName, 
                debit: baseAmount, 
                credit: 0,
                narration: isSubSupplier ? `Payment to ${destName} (via ${actualPayeeName}) - ${description}` : `${description}`
            });
            entries.push({ 
                ...common, 
                transactionType: TransactionType.PAYMENT_VOUCHER, 
                accountId: sourceId, 
                accountName: sourceName, 
                debit: 0, 
                credit: baseAmount 
            });
            
            // Reporting-only entry for sub-supplier (if payment is to sub-supplier)
            if (isSubSupplier && destPartner) {
                entries.push({
                    ...common,
                    transactionType: TransactionType.PAYMENT_VOUCHER,
                    accountId: destId, // Sub-supplier ID
                    accountName: destName, // Sub-supplier name
                    debit: 0,
                    credit: baseAmount,
                    narration: `Payment (via ${actualPayeeName}) - ${description}`,
                    isReportingOnly: true // Mark as reporting-only entry
                });
                console.log(`📊 Added sub-supplier reporting entry for payment: ${destName} - ${baseAmount}`);
            }
        } else if (vType === 'EV') {
            if (!sourceId || !destId) return alert("Select Expense and Paid From");
            // Resolve actual account names
            const destAccount = state.accounts.find(a => a.id === destId);
            const sourceAccount = state.accounts.find(a => a.id === sourceId);
            const destName = destAccount?.name || 'Expense';
            const sourceName = sourceAccount?.name || 'Bank/Cash';
            entries.push({ ...common, transactionType: TransactionType.EXPENSE_VOUCHER, accountId: destId, accountName: destName, debit: baseAmount, credit: 0 });
            entries.push({ ...common, transactionType: TransactionType.EXPENSE_VOUCHER, accountId: sourceId, accountName: sourceName, debit: 0, credit: baseAmount });
        } else if (vType === 'PB') {
            if (!destId) return alert("Select Expense Account");
            
            // PB Mapping: destId = Expense (Debit)
            // If Credit Mode: sourceId = Vendor (Credit)
            // If Cash Mode: sourceId = Cash/Bank (Credit), pbVendorId = Vendor Name
            
            let creditAccount = '';
            let vendorName = '';
            
            if (pbPaymentMode === 'CREDIT') {
                if (!sourceId) return alert("Select Vendor");
                creditAccount = sourceId;
                vendorName = state.partners.find(p => p.id === sourceId)?.name || 'Unknown';
            } else {
                if (!sourceId) return alert("Select Pay From Account"); // Cash Account
                creditAccount = sourceId;
                vendorName = pbVendorId ? (state.partners.find(p => p.id === pbVendorId)?.name || 'Vendor') : 'Cash Vendor';
            }

            const narr = pbPaymentMode === 'CASH' ? `Cash Bill: ${vendorName} - ${description}` : `Credit Bill: ${vendorName} - ${description}`;

            // Resolve actual account names
            const destAccount = state.accounts.find(a => a.id === destId);
            const creditAccountObj = state.accounts.find(a => a.id === creditAccount);
            const creditPartner = state.partners.find(p => p.id === creditAccount);
            const destName = destAccount?.name || 'Expense';
            const creditName = pbPaymentMode === 'CREDIT' ? (creditPartner?.name || 'Vendor Payable') : (creditAccountObj?.name || 'Cash/Bank');
            entries.push({ ...common, narration: narr, transactionType: TransactionType.PURCHASE_BILL, accountId: destId, accountName: destName, debit: baseAmount, credit: 0 });
            entries.push({ ...common, narration: narr, transactionType: TransactionType.PURCHASE_BILL, accountId: creditAccount, accountName: creditName, debit: 0, credit: baseAmount });

        } else if (vType === 'TR') {
            if (!sourceId || !destId) return alert("Select Transfer From and To");
            if (sourceId === destId) return alert("Source and Destination cannot be the same");
            const fromBase = parseFloat(fromAmount) / fromRate;
            const toBase = parseFloat(toAmount) / toRate;
            const variance = toBase - fromBase;
            // Resolve actual account names
            const sourceAccount = state.accounts.find(a => a.id === sourceId);
            const destAccount = state.accounts.find(a => a.id === destId);
            const sourceName = sourceAccount?.name || 'Transfer From';
            const destName = destAccount?.name || 'Transfer To';
            entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INTERNAL_TRANSFER, narration: description, accountId: sourceId, accountName: sourceName, currency: fromCurrency, exchangeRate: fromRate, fcyAmount: parseFloat(fromAmount), debit: 0, credit: fromBase });
            entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INTERNAL_TRANSFER, narration: description, accountId: destId, accountName: destName, currency: toCurrency, exchangeRate: toRate, fcyAmount: parseFloat(toAmount), debit: toBase, credit: 0 });
            if (Math.abs(variance) > 0.01) {
                // Lookup exchange variance account dynamically (factory-specific, always correct)
                const varianceAccount = state.accounts.find(a => 
                    a.name.includes('Exchange') ||
                    a.name.includes('Exchange Variance') ||
                    a.code === '502'
                );
                
                if (!varianceAccount) {
                    console.warn('⚠️ Exchange Variance account not found. Skipping variance entry.');
                } else {
                    if (variance < 0) {
                        entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INTERNAL_TRANSFER, narration: 'Exchange Loss', accountId: varianceAccount.id, accountName: varianceAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: Math.abs(variance), debit: Math.abs(variance), credit: 0, factoryId: state.currentFactory?.id || '' });
                    } else {
                        entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INTERNAL_TRANSFER, narration: 'Exchange Gain', accountId: varianceAccount.id, accountName: varianceAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: variance, debit: 0, credit: variance, factoryId: state.currentFactory?.id || '' });
                    }
                }
            }
        } else if (vType === 'JV') {
            // Validate JV rows: filter out empty rows and validate required fields
            const validRows = jvRows.filter(r => r.accountId && ((r.debit > 0) || (r.credit > 0)));
            
            if (validRows.length < 2) {
                return alert('Journal Voucher requires at least 2 entries with accounts and amounts.');
            }
            
            // Check if there's at least one debit and one credit
            const hasDebit = validRows.some(r => r.debit > 0);
            const hasCredit = validRows.some(r => r.credit > 0);
            
            if (!hasDebit || !hasCredit) {
                return alert('Journal Voucher must have at least one Debit entry and one Credit entry.');
            }
            
            // Calculate totals using base amount if available, otherwise use exchange rate
            const totalDr = validRows.reduce((sum, r) => {
                if (r.baseAmount !== undefined && r.baseAmount !== null && r.baseAmount > 0 && r.debit > 0) {
                    return sum + r.baseAmount;
                }
                if (r.debit > 0 && r.exchangeRate > 0) {
                    return sum + (r.debit / r.exchangeRate);
                }
                return sum;
            }, 0);
            const totalCr = validRows.reduce((sum, r) => {
                if (r.baseAmount !== undefined && r.baseAmount !== null && r.baseAmount > 0 && r.credit > 0) {
                    return sum + r.baseAmount;
                }
                if (r.credit > 0 && r.exchangeRate > 0) {
                    return sum + (r.credit / r.exchangeRate);
                }
                return sum;
            }, 0);
            
            // Validate exchange rates for all rows
            for (const row of validRows) {
                if (row.exchangeRate <= 0 || isNaN(row.exchangeRate)) {
                    const account = state.accounts.find(a => a.id === row.accountId);
                    const partner = state.partners.find(p => p.id === row.accountId);
                    const accountName = account?.name || partner?.name || 'Unknown Account';
                    return alert(`Invalid exchange rate for account "${accountName}". Please check the currency and exchange rate.`);
                }
            }
            
            // Check if totals balance (allow 0.01 tolerance for floating point precision)
            const difference = Math.abs(totalDr - totalCr);
            if (difference > 0.01) {
                const diffAmount = totalDr - totalCr;
                return alert(`Journal Voucher is unbalanced!\n\nTotal Debit (USD): $${totalDr.toFixed(2)}\nTotal Credit (USD): $${totalCr.toFixed(2)}\nDifference: $${Math.abs(diffAmount).toFixed(2)} ${diffAmount > 0 ? '(Debit > Credit)' : '(Credit > Debit)'}\n\nPlease ensure Debit and Credit totals are equal.`);
            }
            
            entries = validRows.map(row => {
                // Get actual account name
                const account = state.accounts.find(a => a.id === row.accountId);
                const partner = state.partners.find(p => p.id === row.accountId);
                const accountName = account?.name || partner?.name || 'Unknown Account';
                
                // Use base amount if available, otherwise calculate from exchange rate
                const baseDebit = row.baseAmount !== undefined && row.baseAmount !== null && row.baseAmount > 0 && row.debit > 0
                    ? row.baseAmount 
                    : (row.debit > 0 ? row.debit / row.exchangeRate : 0);
                const baseCredit = row.baseAmount !== undefined && row.baseAmount !== null && row.baseAmount > 0 && row.credit > 0
                    ? row.baseAmount 
                    : (row.credit > 0 ? row.credit / row.exchangeRate : 0);
                // Recalculate exchange rate if base amount was used (for accurate fcyAmount)
                const effectiveRate = row.baseAmount !== undefined && row.baseAmount !== null && row.baseAmount > 0
                    ? (row.debit > 0 ? row.debit : row.credit) / row.baseAmount
                    : row.exchangeRate;
                
                return { 
                    date, 
                    transactionId: voucherNo, 
                    transactionType: TransactionType.JOURNAL_VOUCHER, 
                    accountId: row.accountId, 
                    accountName: accountName, 
                    currency: row.currency, 
                    exchangeRate: effectiveRate, 
                    fcyAmount: row.debit > 0 ? row.debit : row.credit, 
                    debit: baseDebit, 
                    credit: baseCredit, 
                    narration: row.desc || description || 'Manual Journal',
                    factoryId: state.currentFactory?.id || ''
                };
            });
        } else if (vType === 'IA') {
            // Inventory Adjustment - New Table-Based Design
            if (!iaReason) return alert("Reason is required for inventory adjustment");
            
            // If in target mode, convert targets to adjustments
            let finalAdjustments = iaItemAdjustments;
            if (iaUseTargetMode && Object.keys(iaTargets).length > 0) {
                console.log('📊 IA Voucher - Converting targets to adjustments on-the-fly');
                const convertedAdjustments: Record<string, ItemAdjustment> = {};
                Object.entries(iaTargets).forEach(([itemId, target]: [string, ItemTarget]) => {
                    const item = state.items.find(i => i.id === itemId);
                    if (!item) return;
                    const currentQty = item.stockQty || 0;
                    const currentWorth = currentQty * (item.avgCost || 0);
                    
                    // Check if values were explicitly provided (including 0)
                    const hasExplicitQty = target.targetQty !== '' && target.targetQty !== null && target.targetQty !== undefined;
                    const hasExplicitWorth = target.targetWorth !== '' && target.targetWorth !== null && target.targetWorth !== undefined;
                    
                    if (!hasExplicitQty && !hasExplicitWorth) return;
                    
                    // Parse target values
                    const targetQty = hasExplicitQty 
                        ? (typeof target.targetQty === 'number' ? target.targetQty : parseFloat(String(target.targetQty)))
                        : currentQty;
                    const targetWorth = hasExplicitWorth 
                        ? (typeof target.targetWorth === 'number' ? target.targetWorth : parseFloat(String(target.targetWorth)))
                        : currentWorth;
                    
                    // Calculate adjustments
                    const adjustmentQty = targetQty - currentQty;
                    const adjustmentWorth = targetWorth - currentWorth;
                    
                    // Only add if there's a change
                    if (adjustmentQty !== 0 || adjustmentWorth !== 0) {
                        convertedAdjustments[itemId] = {
                            itemId,
                            adjustmentQty: adjustmentQty !== 0 ? adjustmentQty : '',
                            adjustmentWorth: adjustmentWorth !== 0 ? adjustmentWorth : ''
                        };
                    }
                });
                
                finalAdjustments = { ...iaItemAdjustments, ...convertedAdjustments };
                console.log('📊 IA Voucher - Converted targets:', {
                    targetCount: Object.keys(iaTargets).length,
                    convertedCount: Object.keys(convertedAdjustments).length,
                    finalAdjustmentsCount: Object.keys(finalAdjustments).length
                });
            }
            
            // Get items with adjustments (either qty or worth has value)
            const itemsWithAdjustments: Array<[string, ItemAdjustment]> = Object.entries(finalAdjustments).filter(([itemId, adj]) => {
                const adjustment = adj as ItemAdjustment;
                const hasQty = adjustment.adjustmentQty !== '' && adjustment.adjustmentQty !== null && adjustment.adjustmentQty !== undefined && adjustment.adjustmentQty !== 0;
                const hasWorth = adjustment.adjustmentWorth !== '' && adjustment.adjustmentWorth !== null && adjustment.adjustmentWorth !== undefined && adjustment.adjustmentWorth !== 0;
                return hasQty || hasWorth;
            }) as Array<[string, ItemAdjustment]>;
            
            console.log('🔍 Inventory Adjustment Debug:', {
                totalItemsInState: Object.keys(iaItemAdjustments).length,
                itemsWithAdjustments: itemsWithAdjustments.length,
                adjustments: Object.entries(finalAdjustments).map(([itemId, adj]) => {
                    const adjustment = adj as ItemAdjustment;
                    return {
                    itemId,
                    itemCode: state.items.find(i => i.id === itemId)?.code || 'NOT FOUND',
                        adjustmentQty: adjustment.adjustmentQty,
                        adjustmentWorth: adjustment.adjustmentWorth,
                        hasQty: adjustment.adjustmentQty !== '' && adjustment.adjustmentQty !== null && adjustment.adjustmentQty !== undefined && adjustment.adjustmentQty !== 0,
                        hasWorth: adjustment.adjustmentWorth !== '' && adjustment.adjustmentWorth !== null && adjustment.adjustmentWorth !== undefined && adjustment.adjustmentWorth !== 0
                    };
                })
            });
            
            if (itemsWithAdjustments.length === 0) {
                return alert("Please enter adjustment quantity or worth for at least one item.");
            }
            
            // Lookup accounts dynamically (factory-specific, always correct)
            inventoryAccount = state.accounts.find(a => 
                a.name.includes('Finished Goods') || 
                a.name.includes('Inventory - Finished Goods') ||
                a.code === '105' ||
                a.code === '1202'
            );
            // FIXED: Inventory adjustments should post to Owner's Capital (EQUITY), not EXPENSE
            // This ensures inventory increases increase equity (Owner's Capital), not reduce Net Income
            // Lookup Owner's Capital account (preferred for inventory adjustments)
            // Priority: Code 301 first, then by name, then any EQUITY account
            // Note: Owner's Capital is a fundamental account, so we check factoryId but also allow accounts without factoryId (backward compatibility)
            
            // First: Try to find account with code 301 (exact match preferred)
            adjustmentAccount = state.accounts.find(a => 
                a.code === '301' &&
                a.type === AccountType.EQUITY &&
                (!a.factoryId || a.factoryId === state.currentFactory?.id)
            );
            
            // Second: If code 301 not found, try by name (Owner's Capital)
            if (!adjustmentAccount) {
                adjustmentAccount = state.accounts.find(a => 
                    (a.name.includes('Owner\'s Capital') || 
                     a.name.includes('Owner Capital')) &&
                    a.type === AccountType.EQUITY &&
                    (!a.factoryId || a.factoryId === state.currentFactory?.id)
                );
            }
            
            // Third: Fallback - try Inventory Adjustment account (EQUITY type only)
            if (!adjustmentAccount) {
                adjustmentAccount = state.accounts.find(a => 
                    (a.name.includes('Inventory Adjustment') || 
                a.name.includes('Write-off') ||
                     a.code === '503') &&
                    a.type === AccountType.EQUITY &&
                    (!a.factoryId || a.factoryId === state.currentFactory?.id)
                );
            }
            
            // Fourth: Final fallback - Any EQUITY account (ignoring factoryId if needed)
            if (!adjustmentAccount) {
                adjustmentAccount = state.accounts.find(a => 
                    a.type === AccountType.EQUITY &&
                    (!a.factoryId || a.factoryId === state.currentFactory?.id)
                );
            }
            
            // Fifth: Ultimate fallback - Any EQUITY account regardless of factoryId
            if (!adjustmentAccount) {
                adjustmentAccount = state.accounts.find(a => 
                    (a.code === '301' || a.name.includes('Owner\'s Capital') || a.name.includes('Owner Capital')) &&
                    a.type === AccountType.EQUITY
                );
            }
            
            if (!inventoryAccount || !adjustmentAccount) {
                // Debug: Log all accounts to help diagnose
                console.error('❌ Inventory Adjustment Account Lookup Failed:', {
                    currentFactory: state.currentFactory?.id,
                    currentFactoryName: state.currentFactory?.name,
                    totalAccounts: state.accounts.length,
                    accountsWith301: state.accounts.filter(a => a.code === '301'),
                    accountsWithCapital: state.accounts.filter(a => a.name.includes('Capital')),
                    equityAccounts: state.accounts.filter(a => a.type === AccountType.EQUITY).map(a => ({ 
                        code: a.code, 
                        name: a.name, 
                        factoryId: a.factoryId,
                        id: a.id 
                    })),
                    inventoryAccountFound: !!inventoryAccount,
                    adjustmentAccountFound: !!adjustmentAccount
                });
                
                const missingAccounts = [];
                if (!inventoryAccount) missingAccounts.push('Inventory - Finished Goods (105 or 1202)');
                if (!adjustmentAccount) missingAccounts.push('Owner\'s Capital (301) - EQUITY type');
                return alert(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts.\n\nCheck browser console (F12) for detailed debug information.`);
            }
            
            // CRITICAL: Log account IDs to verify they match Balance Sheet calculation
            console.log('🔍 Inventory Adjustment Account Lookup:', {
                inventoryAccount: {
                    id: inventoryAccount.id,
                    name: inventoryAccount.name,
                    code: inventoryAccount.code,
                    type: inventoryAccount.type
                },
                adjustmentAccount: {
                    id: adjustmentAccount.id,
                    name: adjustmentAccount.name,
                    code: adjustmentAccount.code,
                    type: adjustmentAccount.type
                }
            });
            
            // Store item updates for Firestore (to update after posting ledger entries)
            const itemStockUpdates: Array<{ itemId: string; newStockQty: number; newAvgCost: number }> = [];
            
            // Process each item with adjustment (using finalAdjustments which may include converted targets)
            for (const [itemId, adj] of itemsWithAdjustments as Array<[string, ItemAdjustment]>) {
                const item = state.items.find(i => i.id === itemId);
                if (!item) {
                    console.error(`❌ Item not found for ID: ${itemId}`);
                    alert(`Error: Item with ID ${itemId} not found. Please refresh the page and try again.`);
                    continue;
                }
                
                // Validate adjustment values
                let adjustmentQty = 0;
                let adjustmentWorth = 0;
                
                try {
                    adjustmentQty = adj.adjustmentQty !== '' && adj.adjustmentQty !== null && adj.adjustmentQty !== undefined 
                        ? parseFloat(String(adj.adjustmentQty)) 
                        : 0;
                    adjustmentWorth = adj.adjustmentWorth !== '' && adj.adjustmentWorth !== null && adj.adjustmentWorth !== undefined 
                        ? parseFloat(String(adj.adjustmentWorth)) 
                        : 0;
                    
                    // Check for NaN
                    if (isNaN(adjustmentQty)) {
                        console.error(`❌ Invalid adjustmentQty for item ${item.code} (${itemId}):`, adj.adjustmentQty);
                        alert(`Error: Invalid adjustment quantity for item ${item.code}. Please clear the field and re-enter.`);
                        continue;
                    }
                    if (isNaN(adjustmentWorth)) {
                        console.error(`❌ Invalid adjustmentWorth for item ${item.code} (${itemId}):`, adj.adjustmentWorth);
                        alert(`Error: Invalid adjustment worth for item ${item.code}. Please clear the field and re-enter.`);
                        continue;
                    }
                } catch (error) {
                    console.error(`❌ Error parsing adjustment values for item ${item.code} (${itemId}):`, error, adj);
                    alert(`Error processing adjustment for item ${item.code}. Please clear the adjustment fields and re-enter.`);
                    continue;
                }
                
                // Determine adjustment value: use worth if provided, otherwise calculate from qty * avgCost
                let adjustmentValue = 0;
                if (adjustmentWorth !== 0) {
                    adjustmentValue = Math.abs(adjustmentWorth);
                } else if (adjustmentQty !== 0) {
                    adjustmentValue = Math.abs(adjustmentQty) * (item.avgCost || 0);
                } else {
                    continue; // Skip if both are 0
                }
                
                // Ensure item.stockQty is a valid number (default to 0 if undefined/null/NaN)
                const currentStockQty = (item.stockQty !== undefined && item.stockQty !== null && !isNaN(item.stockQty)) 
                    ? Number(item.stockQty) 
                    : 0;
                
                // Calculate new stock quantity
                const newStockQty = currentStockQty + adjustmentQty;
                
                // Validate newStockQty is not NaN
                if (isNaN(newStockQty)) {
                    console.error(`❌ Invalid newStockQty calculation for item ${item.code} (${itemId}):`, {
                        currentStockQty,
                        adjustmentQty,
                        itemStockQty: item.stockQty,
                        item
                    });
                    alert(`Error: Invalid stock quantity calculation for item ${item.code}. Please check the item's current stock and try again.`);
                    continue;
                }
                
                // Ensure item.avgCost is a valid number (default to 0 if undefined/null/NaN)
                const currentAvgCost = (item.avgCost !== undefined && item.avgCost !== null && !isNaN(item.avgCost)) 
                    ? Number(item.avgCost) 
                    : 0;
                
                // Calculate new average cost: if worth is provided, recalculate avgCost
                let newAvgCost = currentAvgCost;
                if (adjustmentWorth !== 0 && adjustmentQty !== 0) {
                    // If both worth and qty are provided, recalculate avgCost
                    const currentValue = currentStockQty * currentAvgCost;
                    const newValue = currentValue + adjustmentWorth;
                    newAvgCost = newStockQty > 0 ? newValue / newStockQty : currentAvgCost;
                } else if (adjustmentQty !== 0 && adjustmentWorth === 0) {
                    // If only qty is provided, keep existing avgCost
                    newAvgCost = currentAvgCost;
                } else if (adjustmentWorth !== 0 && adjustmentQty === 0) {
                    // If only worth is provided (value adjustment), recalculate avgCost
                    const currentValue = currentStockQty * currentAvgCost;
                    const newValue = currentValue + adjustmentWorth;
                    newAvgCost = currentStockQty > 0 ? newValue / currentStockQty : currentAvgCost;
                }
                
                // Validate newAvgCost is not NaN
                if (isNaN(newAvgCost)) {
                    console.error(`❌ Invalid newAvgCost calculation for item ${item.code} (${itemId}):`, {
                        currentStockQty,
                        currentAvgCost,
                        adjustmentQty,
                        adjustmentWorth,
                        newStockQty
                    });
                    alert(`Error: Invalid average cost calculation for item ${item.code}. Please check the item's current cost and try again.`);
                    continue;
                }
                
                // Store update for later
                itemStockUpdates.push({ itemId, newStockQty, newAvgCost });
                
                console.log(`✅ Prepared stock update for ${item.code} (${itemId}):`, {
                    currentStockQty,
                    adjustmentQty,
                    newStockQty,
                    currentAvgCost,
                    adjustmentWorth,
                    newAvgCost
                });
                
                // Determine if increase or decrease based on sign
                const isIncrease = (adjustmentQty > 0) || (adjustmentWorth > 0);
                
                if (isIncrease) {
                    entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: inventoryAccount.id, accountName: inventoryAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: adjustmentValue, credit: 0, narration: `Inventory Increase: ${item.name} (Qty: ${adjustmentQty || 'N/A'}, Worth: $${adjustmentValue.toFixed(2)}) - ${iaReason}`, factoryId: state.currentFactory?.id || '' });
                    entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: adjustmentAccount.id, accountName: adjustmentAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: 0, credit: adjustmentValue, narration: `Inventory Increase: ${item.name} - ${iaReason}`, factoryId: state.currentFactory?.id || '' });
                } else {
                    entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: inventoryAccount.id, accountName: inventoryAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: 0, credit: adjustmentValue, narration: `Inventory Decrease: ${item.name} (Qty: ${adjustmentQty || 'N/A'}, Worth: $${adjustmentValue.toFixed(2)}) - ${iaReason}`, factoryId: state.currentFactory?.id || '' });
                    entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: adjustmentAccount.id, accountName: adjustmentAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: adjustmentValue, credit: 0, narration: `Inventory Decrease: ${item.name} - ${iaReason}`, factoryId: state.currentFactory?.id || '' });
                }
            }
            
            // Store item updates to execute after posting ledger entries
            // We'll call this after postTransaction succeeds
            pendingItemUpdates = async () => {
                for (const update of itemStockUpdates) {
                    try {
                        // Validate update values - ensure they are valid numbers
                        const validatedStockQty = (update.newStockQty !== undefined && update.newStockQty !== null && !isNaN(update.newStockQty)) 
                            ? Number(update.newStockQty) 
                            : null;
                        const validatedAvgCost = (update.newAvgCost !== undefined && update.newAvgCost !== null && !isNaN(update.newAvgCost)) 
                            ? Number(update.newAvgCost) 
                            : null;
                        
                        if (validatedStockQty === null || validatedAvgCost === null) {
                            const item = state.items.find(i => i.id === update.itemId);
                            console.error(`❌ Invalid update values for item ${item?.code || update.itemId}:`, {
                                itemId: update.itemId,
                                newStockQty: update.newStockQty,
                                newAvgCost: update.newAvgCost,
                                validatedStockQty,
                                validatedAvgCost
                            });
                            alert(`Error: Invalid values for item ${item?.code || update.itemId}.\n\nStock Qty: ${update.newStockQty}\nAvg Cost: ${update.newAvgCost}\n\nStock update skipped. Please check the item data and try again.`);
                            continue;
                        }
                        
                        const itemRef = doc(db, 'items', update.itemId);
                        await updateDoc(itemRef, {
                            stockQty: validatedStockQty,
                            avgCost: validatedAvgCost,
                            updatedAt: serverTimestamp()
                        });
                        
                        const item = state.items.find(i => i.id === update.itemId);
                        console.log(`✅ Item ${item?.code || update.itemId} (${update.itemId}) stock updated: Qty=${validatedStockQty}, AvgCost=${validatedAvgCost.toFixed(2)}`);
                    } catch (error: any) {
                        const item = state.items.find(i => i.id === update.itemId);
                        console.error(`❌ Error updating item ${item?.code || update.itemId} (${update.itemId}) in Firestore:`, error);
                        alert(`Warning: Failed to update stock for item ${item?.code || update.itemId}.\n\nError: ${error?.message || error}\n\nPlease check the console for details and update manually if needed.`);
                    }
                }
            };
        } else if (vType === 'IAO') {
            // Original Stock Adjustment - Simplified Design (following IA pattern)
            if (!iaoReason) {
                return alert("Reason is required for original stock adjustment");
            }
            
            // If in target mode, convert targets to adjustments
            let finalAdjustments = iaoAdjustments;
            if (useSimpleMode && Object.keys(iaoTargets).length > 0) {
                console.log('📊 IAO Voucher - Converting targets to adjustments on-the-fly');
                const convertedAdjustments: Record<string, OriginalStockAdjustment> = {};
                Object.entries(iaoTargets).forEach(([key, target]: [string, OriginalStockTarget]) => {
                    const item = originalStockData.find(i => i.key === key);
                    if (!item) return;
                    const currentWeight = item.weightInHand || 0;
                    const currentWorth = item.worth || 0;
                    
                    // Check if values were explicitly provided (including 0)
                    const hasExplicitWeight = target.targetWeight !== '' && target.targetWeight !== null && target.targetWeight !== undefined;
                    const hasExplicitWorth = target.targetWorth !== '' && target.targetWorth !== null && target.targetWorth !== undefined;
                    
                    if (!hasExplicitWeight && !hasExplicitWorth) return;
                    
                    // Parse target values
                    const targetWeight = hasExplicitWeight 
                        ? (typeof target.targetWeight === 'number' ? target.targetWeight : parseFloat(String(target.targetWeight)))
                        : currentWeight;
                    const targetWorth = hasExplicitWorth 
                        ? (typeof target.targetWorth === 'number' ? target.targetWorth : parseFloat(String(target.targetWorth)))
                        : currentWorth;
                    
                    // Validate parsed values
                    if (isNaN(targetWeight) || isNaN(targetWorth)) {
                        console.error(`❌ Invalid target values for key ${key}:`, { targetWeight, targetWorth, currentWeight, currentWorth });
                        return;
                    }
                    
                    // Calculate adjustments (target - current)
                    const adjustmentWeight = targetWeight - currentWeight;
                    const adjustmentWorth = targetWorth - currentWorth;
                    
                    console.log(`📊 IAO Target Conversion for ${key}:`, {
                        currentWeight,
                        currentWorth,
                        targetWeight,
                        targetWorth,
                        adjustmentWeight,
                        adjustmentWorth,
                        itemAvgCost: item.avgCostPerKg,
                        calculatedWorth: currentWeight * item.avgCostPerKg
                    });
                    
                    // CRITICAL FIX: If currentWorth is 0 but we have weight and avgCost, recalculate worth
                    if (currentWorth === 0 && currentWeight > 0 && item.avgCostPerKg > 0) {
                        const recalculatedWorth = currentWeight * item.avgCostPerKg;
                        console.log(`⚠️ IAO Target Conversion - Recalculating worth: ${currentWorth} -> ${recalculatedWorth}`);
                        // Recalculate adjustment with correct current worth
                        const correctedAdjustmentWorth = targetWorth - recalculatedWorth;
                        console.log(`⚠️ IAO Target Conversion - Corrected adjustment worth: ${adjustmentWorth} -> ${correctedAdjustmentWorth}`);
                        // Use corrected adjustment
                        if (Math.abs(correctedAdjustmentWorth) > 0.01) {
                            convertedAdjustments[key] = {
                                key,
                                adjustmentWeight: adjustmentWeight !== 0 ? adjustmentWeight : '',
                                adjustmentWorth: correctedAdjustmentWorth !== 0 ? correctedAdjustmentWorth : ''
                            };
                            return; // Skip the code below that would use the wrong adjustment
                        }
                    }
                    
                    // Only add if there's a change
                    if (adjustmentWeight !== 0 || adjustmentWorth !== 0) {
                        convertedAdjustments[key] = {
                            key,
                            adjustmentWeight: adjustmentWeight !== 0 ? adjustmentWeight : '',
                            adjustmentWorth: adjustmentWorth !== 0 ? adjustmentWorth : ''
                        };
                    }
                });
                
                finalAdjustments = { ...iaoAdjustments, ...convertedAdjustments };
                console.log('📊 IAO Voucher - Converted targets:', {
                    targetCount: Object.keys(iaoTargets).length,
                    convertedCount: Object.keys(convertedAdjustments).length,
                    finalAdjustmentsCount: Object.keys(finalAdjustments).length
                });
            }
            
            // Get adjustments with values
            const adjustmentsWithValues: Array<[string, OriginalStockAdjustment]> = Object.entries(finalAdjustments).filter(([key, adj]) => {
                const adjustment = adj as OriginalStockAdjustment;
                const hasWeight = adjustment.adjustmentWeight !== '' && adjustment.adjustmentWeight !== null && adjustment.adjustmentWeight !== undefined && adjustment.adjustmentWeight !== 0;
                const hasWorth = adjustment.adjustmentWorth !== '' && adjustment.adjustmentWorth !== null && adjustment.adjustmentWorth !== undefined && adjustment.adjustmentWorth !== 0;
                return hasWeight || hasWorth;
            }) as Array<[string, OriginalStockAdjustment]>;
            
            if (adjustmentsWithValues.length === 0) {
                return alert("Please enter adjustment weight or worth for at least one original stock item.");
            }
            
            // Lookup accounts
            const inventoryAccount = state.accounts.find(a => 
                a.name.includes('Raw Materials') || 
                a.name.includes('Inventory - Raw Materials') ||
                a.code === '104' ||
                a.code === '1201'
            );
            const adjustmentAccount = state.accounts.find(a => 
                (a.name.includes('Inventory Adjustment') || 
                 a.name.includes('Write-off') ||
                 a.code === '503') &&
                (a.type === AccountType.EXPENSE || a.type === AccountType.EQUITY)
            );
            
            // Fallback for backward compatibility
            if (!adjustmentAccount) {
                const found = state.accounts.find(a => 
                a.name.includes('Inventory Adjustment') || 
                a.name.includes('Write-off') ||
                a.code === '503'
            );
                if (found && found.type === AccountType.ASSET) {
                    return alert(`❌ CRITICAL ERROR: Inventory Adjustment account "${found.name}" is an ASSET account.\n\nThis will cause Balance Sheet imbalance. The account should be:\n- Type: EXPENSE (recommended) or EQUITY\n- Code: 503\n\nPlease update the account type in Setup > Chart of Accounts.`);
                }
            }
            
            if (!inventoryAccount || !adjustmentAccount) {
                const missingAccounts = [];
                if (!inventoryAccount) missingAccounts.push('Inventory - Raw Materials (104 or 1201)');
                if (!adjustmentAccount) missingAccounts.push('Inventory Adjustment (503) - EXPENSE or EQUITY type');
                return alert(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts.`);
            }
            
            // Process each adjustment
            for (const [key, adj] of adjustmentsWithValues) {
                const adjustment = adj as OriginalStockAdjustment;
                const stockItem = originalStockData.find(item => item.key === key);
                if (!stockItem) {
                    console.error(`❌ Original stock item not found for key: ${key}`);
                    continue;
                }
                
                const originalType = state.originalTypes.find(ot => ot.id === stockItem.originalTypeId);
                const supplier = state.partners.find(p => p.id === stockItem.supplierId);
                const subSupplier = stockItem.subSupplierId ? state.partners.find(p => p.id === stockItem.subSupplierId) : undefined;
                
                if (!originalType || !supplier) {
                    console.error(`❌ Missing data for key ${key}:`, { originalType: !!originalType, supplier: !!supplier });
                    continue;
                }
                
                // Parse adjustment values
                const adjustmentWeight = (adjustment.adjustmentWeight !== '' && adjustment.adjustmentWeight !== null && adjustment.adjustmentWeight !== undefined) 
                    ? parseFloat(String(adjustment.adjustmentWeight)) 
                    : 0;
                const adjustmentWorth = (adjustment.adjustmentWorth !== '' && adjustment.adjustmentWorth !== null && adjustment.adjustmentWorth !== undefined) 
                    ? parseFloat(String(adjustment.adjustmentWorth)) 
                    : 0;
                
                if (isNaN(adjustmentWeight) || isNaN(adjustmentWorth)) {
                    console.error(`❌ Invalid adjustment values for key ${key}`);
                    continue;
                }
                
                // Determine adjustment value: use worth if provided, otherwise calculate from weight
                let adjustmentValue = 0;
                if (adjustmentWorth !== 0) {
                    adjustmentValue = Math.abs(adjustmentWorth);
                } else if (adjustmentWeight !== 0) {
                    // Calculate from weight using avgCostPerKg
                    adjustmentValue = Math.abs(adjustmentWeight) * (stockItem.avgCostPerKg || 0);
                } else {
                    continue; // Skip if both are 0
                }
                
                if (adjustmentValue === 0 || isNaN(adjustmentValue)) {
                    console.error(`❌ Invalid adjustment value for key ${key}`);
                    continue;
                }
                
                // Determine if increase or decrease
                const isIncrease = (adjustmentWeight > 0) || (adjustmentWorth > 0);
                
                const displayName = stockItem.originalProductId 
                    ? `${originalType.name} - ${state.originalProducts.find(op => op.id === stockItem.originalProductId)?.name || ''}`
                    : originalType.name;
                const supplierName = subSupplier ? `${supplier.name} / ${subSupplier.name}` : supplier.name;
                
                // Create ledger entries
                if (isIncrease) {
                    entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: inventoryAccount.id, accountName: inventoryAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: adjustmentValue, credit: 0, narration: `Original Stock Increase: ${displayName} (${supplierName}) (Weight: ${adjustmentWeight || 'N/A'} kg, Worth: $${adjustmentValue.toFixed(2)}) - ${iaoReason}`, factoryId: state.currentFactory?.id || '' });
                    entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: adjustmentAccount.id, accountName: adjustmentAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: 0, credit: adjustmentValue, narration: `Original Stock Increase: ${displayName} - ${iaoReason}`, factoryId: state.currentFactory?.id || '' });
                } else {
                    // For decrease, ensure weight is negative in narration for correct parsing
                    const weightDisplay = adjustmentWeight < 0 ? adjustmentWeight : -Math.abs(adjustmentWeight);
                    entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: inventoryAccount.id, accountName: inventoryAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: 0, credit: adjustmentValue, narration: `Original Stock Decrease: ${displayName} (${supplierName}) (Weight: ${weightDisplay} kg, Worth: $${adjustmentValue.toFixed(2)}) - ${iaoReason}`, factoryId: state.currentFactory?.id || '' });
                    entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: adjustmentAccount.id, accountName: adjustmentAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: adjustmentValue, credit: 0, narration: `Original Stock Decrease: ${displayName} - ${iaoReason}`, factoryId: state.currentFactory?.id || '' });
                }
            }
            
            if (entries.length === 0) {
                return alert("No valid adjustments to process. Please check your adjustment values.");
            }
            
            // Note: Available stock for opening and direct sale is now calculated from ledger entries
            // The IAO adjustments are automatically reflected in available stock calculations
            // See DataEntry.tsx availableStockInfo and dsBatches calculations which now include IAO adjustments
        } else if (vType === 'MJV') {
            // Manual JV Entry Helper for Original Stock Adjustment
            if (!mjvTypeId || !mjvSupplierId) {
                return alert("Please select Type and Supplier.");
            }
            if (!mjvWeight && !mjvWorth) {
                return alert("Please enter either Weight or Worth adjustment.");
            }
            if (!mjvReason) {
                return alert("Please enter a reason for the adjustment.");
            }

            // Parse weight and worth
            const weight = mjvWeight ? parseFloat(mjvWeight) : NaN;
            const worth = mjvWorth ? parseFloat(mjvWorth) : NaN;
            
            // Check if at least one valid (non-zero, non-NaN) value is provided
            const hasValidWeight = !isNaN(weight) && weight !== 0;
            const hasValidWorth = !isNaN(worth) && worth !== 0;
            
            if (!hasValidWeight && !hasValidWorth) {
                return alert("Please enter a valid non-zero weight or worth adjustment.");
            }

            // Find the original type and supplier
            const originalType = state.originalTypes.find(ot => ot.id === mjvTypeId);
            const supplier = state.partners.find(p => p.id === mjvSupplierId);
            
            if (!originalType || !supplier) {
                return alert("Original Type or Supplier not found. Please check your selections.");
            }

            // Find current stock to get avgCostPerKg
            const key = mjvProductId 
                ? `${mjvSupplierId}-none-${mjvTypeId}-${mjvProductId}`
                : `${mjvSupplierId}-none-${mjvTypeId}`;
            
            const stockItem = originalStockData.find(item => item.key === key);
            if (!stockItem) {
                return alert("No stock found for the selected combination. Please verify Product, Type, and Supplier.");
            }

            // Calculate adjustment values
            const avgCostPerKg = stockItem.avgCostPerKg || 0;
            let adjustmentWorth = 0;
            let adjustmentWeight = 0;
            let isIncrease = false;

            if (worth !== 0 && !isNaN(worth)) {
                // Worth is explicitly provided
                adjustmentWorth = Math.abs(worth);
                isIncrease = worth > 0;
                // Calculate weight from worth (preserve sign)
                if (avgCostPerKg > 0) {
                    adjustmentWeight = worth > 0 
                        ? (adjustmentWorth / avgCostPerKg) 
                        : -(adjustmentWorth / avgCostPerKg);
                } else {
                    return alert("Average cost per kg is 0. Cannot calculate weight from worth. Please check purchase history or enter weight instead.");
                }
            } else if (weight !== 0 && !isNaN(weight)) {
                // Only weight is provided, calculate worth
                if (avgCostPerKg === 0) {
                    return alert("Average cost per kg is 0. Cannot calculate worth. Please check purchase history or enter worth instead.");
                }
                adjustmentWeight = weight; // Keep the sign (positive or negative)
                adjustmentWorth = Math.abs(weight) * avgCostPerKg;
                isIncrease = weight > 0;
                // Apply sign to worth based on weight
                if (weight < 0) adjustmentWorth = -adjustmentWorth;
            } else {
                return alert("Invalid adjustment values. Please enter weight or worth.");
            }

            // Get product name if selected
            const product = mjvProductId ? state.originalProducts.find(p => p.id === mjvProductId) : null;
            const displayName = product 
                ? `${originalType.name} - ${product.name}`
                : originalType.name;

            // Lookup accounts
            const inventoryAccount = state.accounts.find(a => 
                a.name.includes('Raw Materials') || 
                a.name.includes('Inventory - Raw Materials') ||
                a.code === '104' ||
                a.code === '1201'
            );
            const adjustmentAccount = state.accounts.find(a => 
                a.name.includes('Inventory Adjustment') || 
                a.name.includes('Write-off') ||
                a.code === '503'
            );

            if (!inventoryAccount || !adjustmentAccount) {
                const missingAccounts = [];
                if (!inventoryAccount) missingAccounts.push('Inventory - Raw Materials (104 or 1201)');
                if (!adjustmentAccount) missingAccounts.push('Inventory Adjustment (503)');
                return alert(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts.`);
            }

            // Create the two JV entries
            if (isIncrease) {
                // Entry 1: Inventory - Raw Materials (Debit)
                entries.push({
                    date,
                    transactionId: voucherNo,
                    transactionType: TransactionType.INVENTORY_ADJUSTMENT,
                    accountId: inventoryAccount.id,
                    accountName: inventoryAccount.name,
                    currency: 'USD',
                    exchangeRate: 1,
                    fcyAmount: adjustmentWorth,
                    debit: adjustmentWorth,
                    credit: 0,
                    narration: `Original Stock Increase: ${displayName} (${supplier.name}) (Weight: ${Math.abs(adjustmentWeight).toFixed(2)} kg, Worth: $${adjustmentWorth.toFixed(2)}) - ${mjvReason}`,
                    factoryId: state.currentFactory?.id || ''
                });
                // Entry 2: Inventory Adjustment (Credit)
                entries.push({
                    date,
                    transactionId: voucherNo,
                    transactionType: TransactionType.INVENTORY_ADJUSTMENT,
                    accountId: adjustmentAccount.id,
                    accountName: adjustmentAccount.name,
                    currency: 'USD',
                    exchangeRate: 1,
                    fcyAmount: adjustmentWorth,
                    debit: 0,
                    credit: adjustmentWorth,
                    narration: `Original Stock Increase: ${displayName} - ${mjvReason}`,
                    factoryId: state.currentFactory?.id || ''
                });
            } else {
                // Entry 1: Inventory - Raw Materials (Credit)
                entries.push({
                    date,
                    transactionId: voucherNo,
                    transactionType: TransactionType.INVENTORY_ADJUSTMENT,
                    accountId: inventoryAccount.id,
                    accountName: inventoryAccount.name,
                    currency: 'USD',
                    exchangeRate: 1,
                    fcyAmount: adjustmentWorth,
                    debit: 0,
                    credit: adjustmentWorth,
                    narration: `Original Stock Decrease: ${displayName} (${supplier.name}) (Weight: ${adjustmentWeight.toFixed(2)} kg, Worth: $${adjustmentWorth.toFixed(2)}) - ${mjvReason}`,
                    factoryId: state.currentFactory?.id || ''
                });
                // Entry 2: Inventory Adjustment (Debit)
                entries.push({
                    date,
                    transactionId: voucherNo,
                    transactionType: TransactionType.INVENTORY_ADJUSTMENT,
                    accountId: adjustmentAccount.id,
                    accountName: adjustmentAccount.name,
                    currency: 'USD',
                    exchangeRate: 1,
                    fcyAmount: adjustmentWorth,
                    debit: adjustmentWorth,
                    credit: 0,
                    narration: `Original Stock Decrease: ${displayName} - ${mjvReason}`,
                    factoryId: state.currentFactory?.id || ''
                });
            }

            console.log('📊 MJV - Entries created:', {
                count: entries.length,
                entries: entries.map(e => ({
                    accountName: e.accountName,
                    debit: e.debit,
                    credit: e.credit,
                    narration: e.narration
                }))
            });
        } else if (vType === 'RTS') {
            // Return to Supplier
            if (!rtsSupplierId || !rtsItemId || !rtsQty || parseFloat(rtsQty) <= 0) return alert("Select supplier, item and enter valid quantity");
            if (!rtsReason) return alert("Reason is required for return to supplier");
            const item = state.items.find(i => i.id === rtsItemId);
            const supplier = state.partners.find(p => p.id === rtsSupplierId);
            if (!item || !supplier) return alert("Item or supplier not found");
            const qty = parseFloat(rtsQty);
            const returnValue = qty * (item.avgCost || 0);
            
            // Lookup inventory account dynamically (factory-specific, always correct)
            const inventoryAccount = state.accounts.find(a => 
                a.name.includes('Finished Goods') || 
                a.name.includes('Inventory - Finished Goods') ||
                a.code === '105' ||
                a.code === '1202'
            );
            
            if (!inventoryAccount) {
                return alert('Missing required account: Inventory - Finished Goods (105 or 1202). Please ensure this account exists in Setup > Chart of Accounts.');
            }
            
            entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.RETURN_TO_SUPPLIER, accountId: inventoryAccount.id, accountName: inventoryAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: returnValue, debit: 0, credit: returnValue, narration: `Return to Supplier: ${item.name} (${qty} units) to ${supplier.name} - ${rtsReason}`, factoryId: state.currentFactory?.id || '' });
            entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.RETURN_TO_SUPPLIER, accountId: rtsSupplierId, accountName: supplier.name, currency: 'USD', exchangeRate: 1, fcyAmount: returnValue, debit: returnValue, credit: 0, narration: `Return: ${item.name} (${qty} units) - ${rtsReason}`, factoryId: state.currentFactory?.id || '' });
        } else if (vType === 'WO') {
            // Write-off
            if (!woAccountId || !amount || parseFloat(amount) <= 0) return alert("Select account and enter valid amount");
            if (!woReason) return alert("Reason is required for write-off");
            const account = state.accounts.find(a => a.id === woAccountId);
            if (!account) return alert("Account not found");
            
            // Lookup write-off account dynamically (factory-specific, always correct)
            const writeOffAccount = state.accounts.find(a => 
                a.name.includes('Write-off') || 
                a.name.includes('Bad Debt') ||
                a.code === '504'
            );
            
            if (!writeOffAccount) {
                return alert('Missing required account: Write-off / Bad Debt (504). Please ensure this account exists in Setup > Chart of Accounts.');
            }
            
            entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.WRITE_OFF, accountId: woAccountId, accountName: account.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Write-off: ${account.name} - ${woReason}`, factoryId: state.currentFactory?.id || '' });
            entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.WRITE_OFF, accountId: writeOffAccount.id, accountName: writeOffAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Write-off: ${account.name} - ${woReason}`, factoryId: state.currentFactory?.id || '' });
        } else if (vType === 'BD') {
            // Balancing Discrepancy
            if (!bdAccountId || !amount || parseFloat(amount) <= 0) return alert("Select account and enter valid amount");
            if (!bdReason) return alert("Reason is required for balancing discrepancy");
            
            // Check if it's an account or a partner
            const account = state.accounts.find(a => a.id === bdAccountId);
            const partner = state.partners.find(p => p.id === bdAccountId);
            
            if (!account && !partner) return alert("Account/Partner not found");
            
            // Use account name or partner name
            const entityName = account ? account.name : (partner ? partner.name : 'Unknown');
            
            // Lookup discrepancy account dynamically (factory-specific, always correct)
            // Try EQUITY first (preferred for balancing), then LIABILITY
            // IMPORTANT: Allow accounts without factoryId (backward compatibility) OR matching factoryId
            let discrepancyAccount = state.accounts.find(a => 
                (a.name.includes('Discrepancy') || 
                a.name.includes('Suspense') ||
                a.name.includes('Balancing Discrepancy') ||
                 a.code === '505') &&
                a.type === AccountType.EQUITY &&
                (!a.factoryId || a.factoryId === state.currentFactory?.id)
            );
            
            if (!discrepancyAccount) {
                // Fallback to LIABILITY if EQUITY not found
                discrepancyAccount = state.accounts.find(a => 
                    (a.name.includes('Discrepancy') || 
                     a.name.includes('Suspense') ||
                     a.name.includes('Balancing Discrepancy') ||
                     a.code === '505') &&
                    a.type === AccountType.LIABILITY &&
                    (!a.factoryId || a.factoryId === state.currentFactory?.id)
                );
            }
            
            // Final fallback: Ignore factoryId completely (for accounts that might have wrong factoryId)
            if (!discrepancyAccount) {
                discrepancyAccount = state.accounts.find(a => 
                    (a.name.includes('Discrepancy') || 
                     a.name.includes('Suspense') ||
                     a.name.includes('Balancing Discrepancy') ||
                     a.code === '505') &&
                    (a.type === AccountType.EQUITY || a.type === AccountType.LIABILITY)
                );
            }
            
            if (!discrepancyAccount) {
                // Debug: Log all accounts to help diagnose
                console.error('❌ BD Account Lookup Failed:', {
                    currentFactory: state.currentFactory?.id,
                    totalAccounts: state.accounts.length,
                    accountsWith505: state.accounts.filter(a => a.code === '505'),
                    accountsWithDiscrepancy: state.accounts.filter(a => a.name.includes('Discrepancy') || a.name.includes('Suspense')),
                    equityAccounts: state.accounts.filter(a => a.type === AccountType.EQUITY).map(a => ({ code: a.code, name: a.name, factoryId: a.factoryId })),
                    liabilityAccounts: state.accounts.filter(a => a.type === AccountType.LIABILITY).map(a => ({ code: a.code, name: a.name, factoryId: a.factoryId }))
                });
                return alert('Missing required account: Balancing Discrepancy / Suspense (505).\n\nPlease create this account in:\nSetup > Chart of Accounts\n\nRecommended:\n- Code: 505\n- Name: "Balancing Discrepancy" or "Suspense Account"\n- Type: EQUITY (preferred) or LIABILITY\n- Opening Balance: 0\n\nThe system will automatically find it by code "505" or if the name contains "Discrepancy", "Suspense", or "Balancing Discrepancy".');
            }
            
            const isEquityAccount = discrepancyAccount.type === AccountType.EQUITY;
            
            // Determine if the target account is a liability account
            const isLiabilityAccount = account && account.type === AccountType.LIABILITY;
            // For partners, check if it's a supplier-like partner (negative balance = liability)
            const isSupplierPartner = partner && [PartnerType.SUPPLIER, PartnerType.VENDOR, PartnerType.SUB_SUPPLIER, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(partner.type);
            const isLiabilityEntity = isLiabilityAccount || isSupplierPartner;
            
            console.log('🔍 BD Entry Creation:', {
                entityName,
                entityId: bdAccountId,
                adjustmentType: bdAdjustmentType,
                amount: baseAmount,
                isLiabilityAccount,
                isSupplierPartner,
                isLiabilityEntity,
                discrepancyAccount: {
                    id: discrepancyAccount.id,
                    name: discrepancyAccount.name,
                    type: discrepancyAccount.type,
                    isEquity: isEquityAccount
                }
            });
            
            // BD vouchers always use current date to show when the adjustment was actually made
            const bdDate = new Date().toISOString().split('T')[0];
            
            if (bdAdjustmentType === 'INCREASE') {
                // INCREASE logic:
                // For ASSETS: Debit asset (increases), Credit Discrepancy
                // For LIABILITIES: Credit liability (increases), Debit Discrepancy (decreases discrepancy)
                // For PARTNERS (Customers): Debit partner (increases asset), Credit Discrepancy
                // For PARTNERS (Suppliers): Credit partner (increases liability), Debit Discrepancy
                
                if (isLiabilityEntity) {
                    // CRITICAL FIX: Check current balance of liability account
                    // If balance is negative, "increase" means make it more negative (away from zero) = DEBIT
                    // If balance is positive, "increase" means make it more positive (away from zero) = CREDIT
                    let currentBalance = 0;
                    if (account) {
                        currentBalance = account.balance || 0;
                    } else if (partner) {
                        currentBalance = partner.balance || 0;
                    }
                    
                    const isNegativeBalance = currentBalance < 0;
                    
                    if (isNegativeBalance) {
                        // Negative balance: Debit to increase (make more negative, away from zero)
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: bdAccountId, accountName: entityName, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                        console.log(`⚠️ BD Entry: Liability account has negative balance (${currentBalance}). Using DEBIT to increase (make more negative).`);
                    } else {
                        // Positive balance: Credit to increase (make more positive, away from zero)
                        entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: bdAccountId, accountName: entityName, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                    }
                    
                    // Use EQUITY account (Owner's Capital) for offset to prevent Balance Sheet double-counting
                    const capitalAccount = state.accounts.find(a => 
                        (a.name.includes('Capital') || a.name.includes('Owner\'s Capital')) &&
                        a.type === AccountType.EQUITY
                    ) || state.accounts.find(a => a.type === AccountType.EQUITY && a.code === '3000');
                    
                    if (capitalAccount) {
                        if (isNegativeBalance) {
                            // Negative balance: Credit Capital (increases equity) to balance the Debit
                            entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: capitalAccount.id, accountName: capitalAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                        } else {
                            // Positive balance: Debit Capital (decreases equity) to balance the Credit
                            entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: capitalAccount.id, accountName: capitalAccount.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                        }
                        console.log('✅ BD Entry: Using Capital account for offset to avoid Balance Sheet double-counting.');
                    } else {
                        // Fallback: Use Discrepancy account
                        if (isEquityAccount) {
                            if (isNegativeBalance) {
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
            } else {
                                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                            }
                        } else {
                            // Discrepancy is LIABILITY
                            if (isNegativeBalance) {
                                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                            } else {
                                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                            }
                            console.warn('⚠️ BD Entry: Discrepancy account is LIABILITY. This may cause Balance Sheet imbalance. Consider using Owner\'s Capital instead.');
                        }
                    }
                } else {
                    // ASSET or CUSTOMER: Debit account/partner (increases asset), Credit Discrepancy
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: bdAccountId, accountName: entityName, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                    if (isEquityAccount) {
                        // If Discrepancy is EQUITY: Credit Discrepancy (increases equity) to balance
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
            } else {
                        // If Discrepancy is LIABILITY: Credit Discrepancy (increases liability) to balance
                        entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                    }
                }
            } else {
                // DECREASE logic:
                // For ASSETS: Credit asset (decreases), Debit Discrepancy
                // For LIABILITIES: Debit liability (decreases), Credit Discrepancy (increases discrepancy)
                // For PARTNERS (Customers): Credit partner (decreases asset), Debit Discrepancy
                // For PARTNERS (Suppliers): Debit partner (decreases liability), Credit Discrepancy
                
                if (isLiabilityEntity) {
                    // CRITICAL FIX: Check current balance of liability account
                    // If balance is negative, "decrease" means make it less negative (toward zero) = CREDIT
                    // If balance is positive, "decrease" means make it less positive (toward zero) = DEBIT
                    let currentBalance = 0;
                    if (account) {
                        currentBalance = account.balance || 0;
                    } else if (partner) {
                        currentBalance = partner.balance || 0;
                    }
                    
                    // For liability accounts: negative balance = they owe us (asset), positive balance = we owe them (liability)
                    // For DECREASE: If negative, Credit to make less negative. If positive, Debit to make less positive.
                    const isNegativeBalance = currentBalance < 0;
                    
                    if (isNegativeBalance) {
                        // Negative balance: Credit to decrease (make less negative, toward zero)
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: bdAccountId, accountName: entityName, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                        console.log(`⚠️ BD Entry: Liability account has negative balance (${currentBalance}). Using CREDIT to decrease (make less negative).`);
                    } else {
                        // Positive balance: Debit to decrease (make less positive, toward zero)
                        entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: bdAccountId, accountName: entityName, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                    }
                    
                    // CRITICAL FIX: Always use EQUITY account (Owner's Capital) for offset when decreasing liability
                    // This prevents Balance Sheet double-counting caused by Math.abs() calculation
                    const capitalAccount = state.accounts.find(a => 
                        (a.name.includes('Capital') || a.name.includes('Owner\'s Capital')) &&
                        a.type === AccountType.EQUITY
                    ) || state.accounts.find(a => a.type === AccountType.EQUITY && a.code === '3000');
                    
                    if (capitalAccount) {
                        if (isNegativeBalance) {
                            // Negative balance: Debit Capital (decreases equity) to balance the Credit
                            entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: capitalAccount.id, accountName: capitalAccount.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                        } else {
                            // Positive balance: Credit Capital (increases equity) to balance the Debit
                            entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: capitalAccount.id, accountName: capitalAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                        }
                        console.log('✅ BD Entry: Using Capital account for offset to avoid Balance Sheet double-counting.');
                    } else {
                        // Fallback: Use Discrepancy account
                        if (isEquityAccount) {
                            if (isNegativeBalance) {
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                            } else {
                                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                            }
                        } else {
                            // Discrepancy is LIABILITY - warn about potential imbalance
                            if (isNegativeBalance) {
                                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                            } else {
                                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                            }
                            console.warn('⚠️ BD Entry: Discrepancy account is LIABILITY. This may cause Balance Sheet imbalance. Consider using Owner\'s Capital instead.');
                        }
                    }
                } else {
                    // ASSET or CUSTOMER: Credit account/partner (decreases asset), Debit Discrepancy
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: bdAccountId, accountName: entityName, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                    if (isEquityAccount) {
                        // If Discrepancy is EQUITY: Debit Discrepancy (decreases equity) to balance
                        entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                    } else {
                        // If Discrepancy is LIABILITY: Debit Discrepancy (decreases liability) to balance
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                    }
                }
            }
            
            console.log('✅ BD Entries Created:', {
                totalEntries: entries.length,
                entries: entries.map(e => ({
                    accountId: e.accountId,
                    accountName: e.accountName,
                    debit: e.debit,
                    credit: e.credit,
                    narration: e.narration
                })),
                totalDebits: entries.reduce((sum, e) => sum + (e.debit || 0), 0),
                totalCredits: entries.reduce((sum, e) => sum + (e.credit || 0), 0)
            });
        }

        // 🛡️ DOUBLE-ENTRY VALIDATION: Ensure edited voucher is balanced
        if (entries.length > 0) {
            const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
            const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
            const imbalance = Math.abs(totalDebits - totalCredits);

            if (imbalance > 0.01) { // Allow small rounding differences (0.01)
                alert(`❌ DOUBLE-ENTRY ACCOUNTING ERROR: Voucher is unbalanced!\n\n` +
                    `Total Debits: $${totalDebits.toFixed(2)}\n` +
                    `Total Credits: $${totalCredits.toFixed(2)}\n` +
                    `Imbalance: $${imbalance.toFixed(2)}\n\n` +
                    `In double-entry accounting, debits MUST equal credits.\n` +
                    `Please correct the voucher entries and try again.`);
                return;
            }

            // Ensure at least one debit and one credit entry exists
            const hasDebit = entries.some(e => (e.debit || 0) > 0);
            const hasCredit = entries.some(e => (e.credit || 0) > 0);

            if (!hasDebit || !hasCredit) {
                alert(`❌ DOUBLE-ENTRY ACCOUNTING ERROR: Voucher is missing required entries!\n\n` +
                    `Double-entry accounting requires:\n` +
                    `- At least ONE debit entry\n` +
                    `- At least ONE credit entry\n\n` +
                    `Please add both debit and credit entries.`);
                return;
            }
        }

        // NOTE: Old transaction deletion is handled at the beginning of handleSave (lines 992-1005)
        // This duplicate check has been removed to prevent confusion and ensure voucher number is preserved

        // Log entries before posting to verify account IDs (for IA vouchers)
        if (vType === 'IA' && inventoryAccount && adjustmentAccount) {
            console.log('📊 Inventory Adjustment - Ledger Entries to Post:', {
                totalEntries: entries.length,
                entries: entries.map(e => ({
                    accountId: e.accountId,
                    accountName: e.accountName,
                    debit: e.debit,
                    credit: e.credit,
                    transactionId: e.transactionId
                })),
                expectedAccountIds: {
                    inventoryAccountId: inventoryAccount.id,
                    adjustmentAccountId: adjustmentAccount.id
                },
                'Note': 'Balance Sheet calculates balances by matching ledgerEntry.accountId === account.id. Verify these IDs match.'
            });
            
            // CRITICAL: Verify account IDs match what's in state
            const inventoryAccountInState = state.accounts.find(a => a.id === inventoryAccount.id);
            const adjustmentAccountInState = state.accounts.find(a => a.id === adjustmentAccount.id);
            
            if (!inventoryAccountInState) {
                console.error('❌ CRITICAL: Inventory Account ID not found in state.accounts!', {
                    lookupId: inventoryAccount.id,
                    lookupName: inventoryAccount.name,
                    'Available account IDs': state.accounts.filter(a => a.name.includes('Finished Goods')).map(a => ({ id: a.id, name: a.name }))
                });
            }
            if (!adjustmentAccountInState) {
                console.error('❌ CRITICAL: Adjustment Account ID not found in state.accounts!', {
                    lookupId: adjustmentAccount.id,
                    lookupName: adjustmentAccount.name,
                    'Available account IDs': state.accounts.filter(a => a.name.includes('Adjustment') || a.name.includes('Write-off')).map(a => ({ id: a.id, name: a.name }))
                });
            }
        }
        
        // Log before posting
        console.log('📊 About to post transaction:', {
            vType,
            entriesCount: entries.length,
            voucherNo,
            totalDebits: entries.reduce((sum, e) => sum + (e.debit || 0), 0),
            totalCredits: entries.reduce((sum, e) => sum + (e.credit || 0), 0)
        });
        
        try {
        // Debug logging for BD transactions
        if (vType === 'BD') {
            console.log('📤 Posting BD Transaction:', {
                voucherNo,
                totalEntries: entries.length,
                entries: entries.map(e => ({
                    accountId: e.accountId,
                    accountName: e.accountName,
                    debit: e.debit,
                    credit: e.credit,
                    transactionId: e.transactionId
                })),
                totalDebits: entries.reduce((sum, e) => sum + (e.debit || 0), 0),
                totalCredits: entries.reduce((sum, e) => sum + (e.credit || 0), 0)
            });
        }

        if (!isProcessing) {
            setIsProcessing(true);
        }
        setProcessingMessage('📤 Posting new transaction...');
        
        await postTransaction(entries);
            console.log('✅ Transaction posted successfully:', voucherNo);
            
            setProcessingMessage('⏳ Syncing balances...');
            // CRITICAL: Wait longer for balance updates to complete in Firebase
            // This ensures balances are fully synced and all Firebase listeners have processed
            // Increased from 300ms to 800ms to handle multiple Firebase listener updates during edit
            await new Promise(resolve => setTimeout(resolve, 800));
            
            if (isEditing) {
                console.log(`✅ Edit complete: Old transaction ${originalTransactionId} deleted, new transaction ${voucherNo} posted with balances synced`);
            }
            
            setIsProcessing(false);
            setProcessingMessage('');
        } catch (error: any) {
            setIsProcessing(false);
            setProcessingMessage('');
            console.error('❌ Error posting transaction:', error);
            alert(`Failed to post transaction: ${error?.message || error}`);
            return;
        }
        
        // Update item stocks in Firestore if this was an IA voucher
        if (pendingItemUpdates) {
            await pendingItemUpdates();
        }
        
        // CRITICAL: Clear edit state AFTER successful posting
        // This ensures the voucher number is preserved during the entire edit process
        const wasEditing = !!originalTransactionId;
        if (originalTransactionId) {
            console.log(`✅ Edit complete: Transaction ${originalTransactionId} replaced with voucher ${voucherNo}`);
            setEditingTransactionId(null);
            setOriginalEntries([]);
        }
        
        // For IA vouchers, add reminder about Balance Sheet
        if (vType === 'IA') {
            alert(`${voucherNo} Posted Successfully!${wasEditing ? ' (Original entry replaced)' : ''}\n\n✅ Ledger entries created.\n✅ Item stock and costs updated.\n\n💡 Please refresh the Balance Sheet page to see the changes.`);
        } else if (vType === 'IAO') {
            console.log(`✅ IAO Voucher ${voucherNo} posted successfully with ${entries.length} ledger entries`);
            alert(`${voucherNo} Posted Successfully!${wasEditing ? ' (Original entry replaced)' : ''}\n\n✅ Ledger entries created for Original Stock Adjustment.\n\n💡 Please refresh the Balance Sheet page to see the changes.`);
            // Clear IAO adjustments and targets after successful posting
            setIaoAdjustments({});
            setIaoTargets({});
            setIaoReason('');
        } else if (vType === 'MJV') {
            console.log(`✅ MJV Voucher ${voucherNo} posted successfully with ${entries.length} ledger entries`);
            alert(`${voucherNo} Posted Successfully!${wasEditing ? ' (Original entry replaced)' : ''}\n\n✅ Two JV entries created for Original Stock Adjustment.\n\n💡 Please refresh the Balance Sheet page to see the changes.`);
            // Clear MJV form after successful posting
            setMjvProductId('');
            setMjvTypeId('');
            setMjvSupplierId('');
            setMjvWeight('');
            setMjvWorth('');
            setMjvReason('Manual Adjustment');
        } else {
        alert(`${voucherNo} Posted Successfully!${wasEditing ? ' (Original entry replaced)' : ''}`);
        }
        
        // CRITICAL: Generate next voucher number BEFORE resetting form
        // This ensures consecutive saves get unique numbers even if state.ledger hasn't updated yet
        // Parse the current voucher number and increment it directly
        const prefix = vType + '-';
        let nextVoucherNo: string;
        
        if (voucherNo && voucherNo.startsWith(prefix)) {
            // Extract number from current voucher (e.g., "JV-1001" -> 1001)
            const currentNum = parseInt(voucherNo.replace(prefix, ''));
            if (!isNaN(currentNum)) {
                // Increment directly from the voucher that was just posted
                nextVoucherNo = `${prefix}${currentNum + 1}`;
                console.log(`🔄 Generated next voucher number: ${nextVoucherNo} (from ${voucherNo})`);
            } else {
                // Fallback to generateVoucherId if parsing fails
                nextVoucherNo = generateVoucherId(vType);
            }
        } else {
            // Fallback to generateVoucherId if voucherNo doesn't match pattern
            nextVoucherNo = generateVoucherId(vType);
        }
        
        // Reset form with the pre-calculated voucher number
        resetForm(vType, nextVoucherNo);
        
        // Ensure processing state is cleared (safety check)
        setIsProcessing(false);
        setProcessingMessage('');
    };

    // JV Helpers
    const updateJvRow = (id: string, field: keyof JvRow, value: any) => {
        setJvRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            
            const updatedRow = { ...r, [field]: value };
            
            // Auto-calculate exchange rate when base amount is entered (PRIORITY: Base Amount takes precedence)
            if (field === 'baseAmount') {
                if (value !== undefined && value !== null && value !== '') {
                    const baseAmt = parseFloat(value);
                    const foreignAmt = updatedRow.debit > 0 ? updatedRow.debit : updatedRow.credit;
                    if (foreignAmt > 0 && baseAmt > 0 && !isNaN(baseAmt)) {
                        updatedRow.exchangeRate = foreignAmt / baseAmt;
                    }
                } else {
                    // When base amount is cleared, revert to default exchange rate for currency
                    const selectedCurrency = state.currencies.find(curr => curr.code === updatedRow.currency);
                    if (selectedCurrency) {
                        updatedRow.exchangeRate = selectedCurrency.exchangeRate || 1;
                    }
                }
            }
            // Auto-calculate base amount when exchange rate is manually changed (only if base amount wasn't set)
            else if (field === 'exchangeRate' && updatedRow.exchangeRate > 0) {
                // Only auto-calculate if base amount is not set (user preference: base amount takes priority)
                if (updatedRow.baseAmount === undefined || updatedRow.baseAmount === null || updatedRow.baseAmount === 0) {
                    const foreignAmt = updatedRow.debit > 0 ? updatedRow.debit : updatedRow.credit;
                    if (foreignAmt > 0) {
                        updatedRow.baseAmount = foreignAmt / updatedRow.exchangeRate;
                    }
                }
            }
            // Auto-calculate base amount when debit/credit changes (only if base amount wasn't manually set)
            else if ((field === 'debit' || field === 'credit') && updatedRow.exchangeRate > 0) {
                // Only auto-calculate if base amount is not set (user preference: base amount takes priority)
                if (updatedRow.baseAmount === undefined || updatedRow.baseAmount === null || updatedRow.baseAmount === 0) {
                    const foreignAmt = updatedRow.debit > 0 ? updatedRow.debit : updatedRow.credit;
                    if (foreignAmt > 0) {
                        updatedRow.baseAmount = foreignAmt / updatedRow.exchangeRate;
                    }
                }
            }
            
            return updatedRow;
        }));
    };
    const addJvRow = () => setJvRows([...jvRows, { id: Math.random().toString(), accountId: '', desc: '', debit: 0, credit: 0, currency: 'USD', exchangeRate: 1 }]);
    const removeJvRow = (id: string) => setJvRows(prev => prev.filter(r => r.id !== id));

    // --- Ledger Logic ---
    // PERFORMANCE: Pre-convert date filters to timestamps for faster comparison
    const filterDateFromTimestamp = useMemo(() => 
        debouncedLedgerFilters.filterDateFrom ? new Date(debouncedLedgerFilters.filterDateFrom).getTime() : null, 
        [debouncedLedgerFilters.filterDateFrom]
    );
    const filterDateToTimestamp = useMemo(() => 
        debouncedLedgerFilters.filterDateTo ? new Date(debouncedLedgerFilters.filterDateTo).getTime() : null, 
        [debouncedLedgerFilters.filterDateTo]
    );
    const filterMinAmountNum = useMemo(() => 
        debouncedLedgerFilters.filterMinAmount ? parseFloat(debouncedLedgerFilters.filterMinAmount) : null, 
        [debouncedLedgerFilters.filterMinAmount]
    );
    const filterMaxAmountNum = useMemo(() => 
        debouncedLedgerFilters.filterMaxAmount ? parseFloat(debouncedLedgerFilters.filterMaxAmount) : null, 
        [debouncedLedgerFilters.filterMaxAmount]
    );
    
    const filteredLedger = useMemo(() => {
        // Early exit if no filters and no ledger entries
        if (state.ledger.length === 0) return [];
        
        // Filter with optimized comparisons (numeric timestamps instead of string dates)
        const filtered = state.ledger.filter(entry => {
            // Fast path: if no filters, return all entries
            if (!filterDateFromTimestamp && !filterDateToTimestamp && !debouncedLedgerFilters.filterType && 
                !debouncedLedgerFilters.filterAccountId && !debouncedLedgerFilters.filterVoucherId && !filterMinAmountNum && !filterMaxAmountNum) {
                return true;
            }
            
            // Date filter (numeric comparison is faster)
            if (filterDateFromTimestamp || filterDateToTimestamp) {
                const entryTimestamp = new Date(entry.date).getTime();
                if (filterDateFromTimestamp && entryTimestamp < filterDateFromTimestamp) return false;
                if (filterDateToTimestamp && entryTimestamp > filterDateToTimestamp) return false;
            }
            
            // Type filter (fast string comparison)
            if (debouncedLedgerFilters.filterType && entry.transactionType !== debouncedLedgerFilters.filterType) return false;
            
            // Account filter (fast string comparison)
            if (debouncedLedgerFilters.filterAccountId && entry.accountId !== debouncedLedgerFilters.filterAccountId) return false;
            
            // Voucher filter (fast string comparison)
            if (debouncedLedgerFilters.filterVoucherId && entry.transactionId !== debouncedLedgerFilters.filterVoucherId) return false;
            
            // Amount filters (numeric comparison)
            if (filterMinAmountNum !== null && (entry.fcyAmount || 0) < filterMinAmountNum) return false;
            if (filterMaxAmountNum !== null && (entry.fcyAmount || 0) > filterMaxAmountNum) return false;
            
            return true;
        });
        
        // Sort only if we have entries (avoid unnecessary sort on empty array)
        if (filtered.length === 0) return [];
        
        // Sort based on selected column and direction
        const sorted = [...filtered].sort((a, b) => {
            let aValue: any;
            let bValue: any;
            
            switch (ledgerSortColumn) {
                case 'date':
                    aValue = new Date(a.date).getTime();
                    bValue = new Date(b.date).getTime();
                    break;
                case 'voucher':
                    aValue = a.transactionId || '';
                    bValue = b.transactionId || '';
                    break;
                case 'account':
                    aValue = a.accountName || '';
                    bValue = b.accountName || '';
                    break;
                case 'amount':
                    aValue = a.fcyAmount || 0;
                    bValue = b.fcyAmount || 0;
                    break;
                case 'debit':
                    aValue = a.debit || 0;
                    bValue = b.debit || 0;
                    break;
                case 'credit':
                    aValue = a.credit || 0;
                    bValue = b.credit || 0;
                    break;
                case 'narration':
                    aValue = a.narration || '';
                    bValue = b.narration || '';
                    break;
                default:
                    // Default to date sorting
                    aValue = new Date(a.date).getTime();
                    bValue = new Date(b.date).getTime();
            }
            
            // Handle comparison
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                const comparison = aValue.localeCompare(bValue);
                return ledgerSortDirection === 'asc' ? comparison : -comparison;
            } else {
                const comparison = aValue - bValue;
                return ledgerSortDirection === 'asc' ? comparison : -comparison;
            }
        });
        
        return sorted;
    }, [state.ledger, filterDateFromTimestamp, filterDateToTimestamp, debouncedLedgerFilters.filterType, debouncedLedgerFilters.filterAccountId, debouncedLedgerFilters.filterVoucherId, filterMinAmountNum, filterMaxAmountNum, ledgerSortColumn, ledgerSortDirection]);
    
    // PERFORMANCE: Only render the first N rows; user can load more
    const visibleLedger = useMemo(() => {
        if (activeTab !== 'ledger') return [];
        return filteredLedger.slice(0, ledgerVisibleCount);
    }, [activeTab, filteredLedger, ledgerVisibleCount]);
    
    // PERFORMANCE: Pre-index partners by ID to avoid O(n*m) lookups in map
    const partnerIndex = useMemo(() => {
        const index: Record<string, typeof state.partners[0]> = {};
        state.partners.forEach(p => {
            index[p.id] = p;
        });
        return index;
    }, [state.partners]);

    // --- Secure Action Handlers ---
    const initiateAction = (type: 'DELETE' | 'EDIT', transactionId: string) => {
        setPendingAction({ type, transactionId });
        setAuthPin('');
        setAuthModalOpen(true);
    };

    const confirmAuthAction = () => {
        if (authPin !== SUPERVISOR_PIN) {
            alert("Invalid PIN. Access Denied.");
            return;
        }
        
        if (pendingAction) {
            if (pendingAction.type === 'DELETE') {
                deleteTransaction(pendingAction.transactionId, 'Manual Deletion', authPin); // Pass PIN as User ID
                alert(`Transaction ${pendingAction.transactionId} deleted.`);
            } else if (pendingAction.type === 'EDIT') {
                // Edit Workflow: Load data -> Delete Old -> Switch Tab
                // Crucially, we do NOT call resetForm here, so state persists.
                const entries = state.ledger.filter(l => l.transactionId === pendingAction.transactionId);
                if (entries.length === 0) return;

                const first = entries[0];
                
                // Try to determine Type
                let loadedType: VoucherType = 'JV';
                if (first.transactionType === TransactionType.RECEIPT_VOUCHER) loadedType = 'RV';
                else if (first.transactionType === TransactionType.PAYMENT_VOUCHER) loadedType = 'PV';
                else if (first.transactionType === TransactionType.EXPENSE_VOUCHER) loadedType = 'EV';
                else if (first.transactionType === TransactionType.INTERNAL_TRANSFER) loadedType = 'TR';
                else if (first.transactionType === TransactionType.PURCHASE_BILL) loadedType = 'PB';

                // Basic Hydration
                setVType(loadedType);
                setDate(first.date);
                setVoucherNo(first.transactionId); // Keep ID for edit (re-post)
                setDescription(first.narration);
                
                // Hydrate JV rows
                if (loadedType === 'JV') {
                    setJvRows(entries.map(e => ({
                        id: Math.random().toString(),
                        accountId: e.accountId,
                        desc: e.narration,
                        debit: e.debit * e.exchangeRate, // Convert back to entered amount
                        credit: e.credit * e.exchangeRate,
                        currency: e.currency,
                        exchangeRate: e.exchangeRate,
                        baseAmount: e.debit > 0 ? e.debit : e.credit // Set base amount from ledger entry
                    })));
                } else if (loadedType === 'TR') {
                    const creditEntry = entries.find(e => e.credit > 0);
                    const debitEntry = entries.find(e => e.debit > 0 && e.accountId !== '502'); // Ignore variance acc for display
                    if (creditEntry) {
                        setSourceId(creditEntry.accountId);
                        setFromAmount(creditEntry.fcyAmount.toString());
                        setFromCurrency(creditEntry.currency);
                        setFromRate(creditEntry.exchangeRate);
                    }
                    if (debitEntry) {
                        setDestId(debitEntry.accountId);
                        setToAmount(debitEntry.fcyAmount.toString());
                        setToCurrency(debitEntry.currency);
                        setToRate(debitEntry.exchangeRate);
                    }
                } else {
                    // Simple vouchers (RV, PV, EV, PB)
                    setAmount(first.fcyAmount.toString());
                    setCurrency(first.currency);
                    setExchangeRate(first.exchangeRate);
                    
                    // Guess IDs based on Debit/Credit patterns
                    if (loadedType === 'PV') {
                        // PV: Credit is Source (Cash/Bank), Debit is Dest (Payee)
                        setSourceId(entries.find(e => e.credit > 0)?.accountId || '');
                        setDestId(entries.find(e => e.debit > 0)?.accountId || '');
                    } else if (loadedType === 'RV') {
                        // RV: Debit is Dest (Bank), Credit is Source (Customer)
                        setDestId(entries.find(e => e.debit > 0)?.accountId || '');
                        setSourceId(entries.find(e => e.credit > 0)?.accountId || '');
                    } else if (loadedType === 'EV') {
                        setSourceId(entries.find(e => e.credit > 0)?.accountId || '');
                        setDestId(entries.find(e => e.debit > 0)?.accountId || '');
                    } else if (loadedType === 'PB') {
                        // PB: Debit is Expense (Dest), Credit is Vendor/Cash (Source)
                        setDestId(entries.find(e => e.debit > 0)?.accountId || '');
                        const creditEntry = entries.find(e => e.credit > 0);
                        if (creditEntry) {
                            setSourceId(creditEntry.accountId);
                            // Detect Cash vs Credit based on account type
                            const acc = state.accounts.find(a => a.id === creditEntry.accountId);
                            if (acc?.type === AccountType.ASSET) {
                                setPbPaymentMode('CASH');
                                // Hard to recover original vendor ID if just narration, so we leave it or parse narration
                            } else {
                                setPbPaymentMode('CREDIT');
                            }
                        }
                    }
                }

                // Store original entries and transaction ID for edit mode
                // DO NOT delete yet - only delete when new entry is successfully saved
                // This prevents data loss if user abandons the edit
                setOriginalEntries([...entries]); // Create a copy
                setEditingTransactionId(pendingAction.transactionId);
                setActiveTab('voucher'); // Switch to edit mode
            }
        }
        setAuthModalOpen(false);
        setPendingAction(null);
    };

    return (
        <div className="space-y-6 w-full">
            {/* Processing Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
                        <div className="flex flex-col items-center gap-4">
                            <RefreshCw size={48} className="animate-spin text-blue-600" />
                            <h3 className="text-xl font-bold text-slate-800">Processing Transaction</h3>
                            <p className="text-slate-600 text-center">{processingMessage || 'Please wait...'}</p>
                            <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Navigation Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
                <button onClick={() => {
                    // If switching away from voucher tab while editing, warn user
                    if (activeTab === 'voucher' && editingTransactionId) {
                        if (confirm('You are editing a transaction. Switching tabs will cancel the edit and restore the original entry. Continue?')) {
                            // Restore original entry
                            const restoreOriginal = async () => {
                                try {
                                    const entriesToRestore = originalEntries.map(({ id, ...entry }) => entry);
                                    await postTransaction(entriesToRestore);
                                    setEditingTransactionId(null);
                                    setOriginalEntries([]);
                                    setActiveTab('voucher');
                                } catch (error) {
                                    console.error('❌ Failed to restore original transaction:', error);
                                    alert('Warning: Could not restore original transaction. Please check the ledger.');
                                }
                            };
                            restoreOriginal();
                        }
                    } else {
                        setActiveTab('voucher');
                    }
                }} className={`pb-3 px-4 text-sm font-medium transition-all ${activeTab === 'voucher' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                    New Voucher
                    {editingTransactionId && <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded">Editing</span>}
                </button>
                <button onClick={() => {
                    // If switching away from voucher tab while editing, warn user
                    if (activeTab === 'voucher' && editingTransactionId) {
                        if (confirm('You are editing a transaction. Switching tabs will cancel the edit and restore the original entry. Continue?')) {
                            const restoreOriginal = async () => {
                                try {
                                    const entriesToRestore = originalEntries.map(({ id, ...entry }) => entry);
                                    await postTransaction(entriesToRestore);
                                    setEditingTransactionId(null);
                                    setOriginalEntries([]);
                                    setActiveTab('ledger');
                                } catch (error) {
                                    console.error('❌ Failed to restore original transaction:', error);
                                    alert('Warning: Could not restore original transaction. Please check the ledger.');
                                }
                            };
                            restoreOriginal();
                        }
                    } else {
                        setActiveTab('ledger');
                    }
                }} className={`pb-3 px-4 text-sm font-medium transition-all ${activeTab === 'ledger' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>General Ledger</button>
                <button onClick={() => {
                    if (activeTab === 'voucher' && editingTransactionId) {
                        if (confirm('You are editing a transaction. Switching tabs will cancel the edit and restore the original entry. Continue?')) {
                            const restoreOriginal = async () => {
                                try {
                                    const entriesToRestore = originalEntries.map(({ id, ...entry }) => entry);
                                    await postTransaction(entriesToRestore);
                                    setEditingTransactionId(null);
                                    setOriginalEntries([]);
                                    setActiveTab('balance-alignment');
                                } catch (error) {
                                    console.error('❌ Failed to restore original transaction:', error);
                                    alert('Warning: Could not restore original transaction. Please check the ledger.');
                                }
                            };
                            restoreOriginal();
                        }
                    } else {
                        setActiveTab('balance-alignment');
                    }
                }} className={`pb-3 px-4 text-sm font-medium transition-all ${activeTab === 'balance-alignment' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Balance Alignment</button>
                <button onClick={() => {
                    if (activeTab === 'voucher' && editingTransactionId) {
                        if (confirm('You are editing a transaction. Switching tabs will cancel the edit and restore the original entry. Continue?')) {
                            const restoreOriginal = async () => {
                                try {
                                    const entriesToRestore = originalEntries.map(({ id, ...entry }) => entry);
                                    await postTransaction(entriesToRestore);
                                    setEditingTransactionId(null);
                                    setOriginalEntries([]);
                                    setActiveTab('stock-alignment');
                                } catch (error) {
                                    console.error('❌ Failed to restore original transaction:', error);
                                    alert('Warning: Could not restore original transaction. Please check the ledger.');
                                }
                            };
                            restoreOriginal();
                        }
                    } else {
                        setActiveTab('stock-alignment');
                    }
                }} className={`pb-3 px-4 text-sm font-medium transition-all ${activeTab === 'stock-alignment' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Stock Alignment</button>
            </div>

            {activeTab === 'voucher' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-blue-600 text-white rounded-lg"><FileText size={24}/></div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Financial Entry</h2>
                                <p className="text-sm text-slate-500">Record payments, receipts, and adjustments</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <label className="block text-xs font-bold text-slate-400 uppercase">Voucher ID</label>
                            <div className="text-xl font-mono font-bold text-slate-700">{voucherNo}</div>
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* 1. Voucher Type Selection - Now manually triggers reset */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                                { id: 'RV', label: 'Receipt Voucher', icon: ArrowRight, color: 'text-emerald-600' },
                                { id: 'PV', label: 'Payment Voucher', icon: CreditCard, color: 'text-red-600' },
                                { id: 'PB', label: 'Purchase Bill', icon: ShoppingBag, color: 'text-orange-600' },
                                { id: 'EV', label: 'Expense Voucher', icon: DollarSign, color: 'text-amber-600' },
                                { id: 'JV', label: 'Journal Voucher', icon: FileText, color: 'text-blue-600' },
                                { id: 'TR', label: 'Internal Transfer', icon: RefreshCw, color: 'text-purple-600' },
                                { id: 'IA', label: 'Inventory Adjustment', icon: Package, color: 'text-indigo-600' },
                                { id: 'IAO', label: 'Original Stock Adjustment', icon: ShoppingBag, color: 'text-purple-600' },
                                { id: 'RTS', label: 'Return to Supplier', icon: RotateCcw, color: 'text-pink-600' },
                                { id: 'WO', label: 'Write-off', icon: AlertTriangle, color: 'text-red-700' },
                                { id: 'BD', label: 'Balancing Discrepancy', icon: Scale, color: 'text-teal-600' },
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => {
                                        // If we're editing and switching to a different voucher type, restore original entry
                                        if (editingTransactionId && type.id !== vType) {
                                            if (confirm('You are editing a transaction. Switching voucher types will cancel the edit and restore the original entry. Continue?')) {
                                                const restoreOriginal = async () => {
                                                    try {
                                                        const entriesToRestore = originalEntries.map(({ id, ...entry }) => entry);
                                                        await postTransaction(entriesToRestore);
                                                        setEditingTransactionId(null);
                                                        setOriginalEntries([]);
                                                        resetForm(type.id as VoucherType);
                                                    } catch (error) {
                                                        console.error('❌ Failed to restore original transaction:', error);
                                                        alert('Warning: Could not restore original transaction. Please check the ledger.');
                                                    }
                                                };
                                                restoreOriginal();
                                            }
                                        } else {
                                            resetForm(type.id as VoucherType);
                                        }
                                    }}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${vType === type.id ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-slate-100 bg-white hover:border-blue-200 hover:bg-slate-50'}`}
                                >
                                    <type.icon className={`mb-1 ${type.color}`} size={20} />
                                    <span className={`font-bold text-xs ${vType === type.id ? 'text-blue-800' : 'text-slate-600'}`}>{type.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* 2. Common Header */}
                        <div className="grid grid-cols-3 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                {vType === 'BD' ? (
                                    <div className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2.5 text-slate-600 text-sm">
                                        <div className="font-semibold">{new Date().toISOString().split('T')[0]}</div>
                                        <div className="text-xs text-slate-500 mt-1">(Uses current date automatically)</div>
                                    </div>
                                ) : (
                                    <input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" value={date} onChange={e => setDate(e.target.value)} />
                                )}
                            </div>
                            {vType !== 'JV' && vType !== 'TR' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Currency</label>
                                        <select className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>
                                            {state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Exchange Rate</label>
                                        <input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" value={exchangeRate} onChange={e => setExchangeRate(parseFloat(e.target.value))} />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 3. Dynamic Form */}
                        {vType === 'JV' ? (
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-700">Journal Entries</h3>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 font-bold text-slate-600">
                                            <tr>
                                                <th className="px-4 py-3">Account</th>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3 w-24">Currency</th>
                                                <th className="px-4 py-3 w-28">Base Amount (USD)</th>
                                                <th className="px-4 py-3 w-20">Rate (auto)</th>
                                                <th className="px-4 py-3 text-right">Debit (FCY)</th>
                                                <th className="px-4 py-3 text-right">Credit (FCY)</th>
                                                <th className="px-4 py-3 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {jvRows.map(row => (
                                                <tr key={row.id}>
                                                    <td className="px-2 py-2">
                                                        <EntitySelector 
                                                            entities={allAccounts} 
                                                            selectedId={row.accountId} 
                                                            onSelect={(id) => updateJvRow(row.id, 'accountId', id)} 
                                                            placeholder="Select Account"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2"><input type="text" className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={row.desc} onChange={e => updateJvRow(row.id, 'desc', e.target.value)} /></td>
                                                    <td className="px-2 py-2">
                                                        <select className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={row.currency} onChange={e => { 
                                                            updateJvRow(row.id, 'currency', e.target.value); 
                                                            const selectedCurrency = state.currencies.find(curr => curr.code === e.target.value); 
                                                            if (selectedCurrency && (!row.baseAmount || row.baseAmount === 0)) {
                                                                updateJvRow(row.id, 'exchangeRate', selectedCurrency.exchangeRate || 1);
                                                            }
                                                        }}>
                                                            {state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}
                                                        </select>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            className="w-full border border-slate-300 rounded p-2 text-right bg-white text-slate-800 font-mono" 
                                                            placeholder="Enter USD"
                                                            value={row.baseAmount !== undefined && row.baseAmount !== null ? row.baseAmount : ''} 
                                                            onChange={e => {
                                                                const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                                updateJvRow(row.id, 'baseAmount', val);
                                                            }}
                                                            title="Enter base amount in USD - exchange rate will be auto-calculated"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input 
                                                            type="number" 
                                                            step="0.0001"
                                                            className="w-full border border-slate-300 rounded p-2 text-center bg-slate-50 text-slate-600 font-mono text-xs" 
                                                            value={row.exchangeRate.toFixed(4)} 
                                                            onChange={e => updateJvRow(row.id, 'exchangeRate', parseFloat(e.target.value))}
                                                            title="Auto-calculated when base amount is entered"
                                                            readOnly={row.baseAmount !== undefined && row.baseAmount !== null && row.baseAmount > 0}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2"><input type="number" step="0.01" className="w-full border border-slate-300 rounded p-2 text-right bg-white text-slate-800" disabled={row.credit > 0} value={row.debit} onChange={e => updateJvRow(row.id, 'debit', parseFloat(e.target.value))} /></td>
                                                    <td className="px-2 py-2"><input type="number" step="0.01" className="w-full border border-slate-300 rounded p-2 text-right bg-white text-slate-800" disabled={row.debit > 0} value={row.credit} onChange={e => updateJvRow(row.id, 'credit', parseFloat(e.target.value))} /></td>
                                                    <td className="px-2 py-2 text-center"><button onClick={() => removeJvRow(row.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 font-bold text-slate-700">
                                            <tr>
                                                <td colSpan={5} className="px-4 py-3 text-right">Totals (Base USD):</td>
                                                <td className="px-4 py-3 text-right">
                                                    {jvRows.reduce((s, r) => {
                                                        if (r.baseAmount !== undefined && r.baseAmount !== null && r.debit > 0) {
                                                            return s + r.baseAmount;
                                                        }
                                                        return s + (r.debit / r.exchangeRate);
                                                    }, 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {jvRows.reduce((s, r) => {
                                                        if (r.baseAmount !== undefined && r.baseAmount !== null && r.credit > 0) {
                                                            return s + r.baseAmount;
                                                        }
                                                        return s + (r.credit / r.exchangeRate);
                                                    }, 0).toFixed(2)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <button onClick={addJvRow} className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1"><Plus size={16}/> Add Line</button>
                            </div>
                        ) : vType === 'TR' ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                    {/* Left: Source (Credit) */}
                                    <div className="md:col-span-5 space-y-4 p-6 bg-slate-50 rounded-xl border border-slate-200">
                                        <h3 className="font-bold text-slate-700 text-sm uppercase flex items-center gap-2"><ArrowRight size={16} className="text-red-500"/> Withdrawing From (Source)</h3>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Source Account</label>
                                            <EntitySelector entities={cashBankAccounts} selectedId={sourceId} onSelect={setSourceId} placeholder="Select Source Account..." />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label><select className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-800" value={fromCurrency} onChange={e => setFromCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c=><option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Ex. Rate (to Base)</label><input type="number" className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-800" value={fromRate} onChange={e => setFromRate(parseFloat(e.target.value))} /></div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Amount Sent</label>
                                            <input type="number" className="w-full bg-white border border-slate-300 rounded p-2 font-bold text-slate-800" value={fromAmount} onChange={e => setFromAmount(e.target.value)} placeholder="0.00" />
                                        </div>
                                    </div>

                                    {/* Middle: Converter */}
                                    <div className="md:col-span-2 flex flex-col items-center justify-center h-full py-8">
                                        <div className="p-3 bg-blue-50 rounded-full text-blue-600 mb-2"><ArrowLeftRight size={24} /></div>
                                        <button onClick={handleCalculateTransfer} className="text-xs bg-slate-800 text-white px-3 py-1 rounded hover:bg-slate-700">Auto Convert</button>
                                    </div>

                                    {/* Right: Dest (Debit) */}
                                    <div className="md:col-span-5 space-y-4 p-6 bg-slate-50 rounded-xl border border-slate-200">
                                        <h3 className="font-bold text-slate-700 text-sm uppercase flex items-center gap-2"><ArrowRight size={16} className="text-emerald-500"/> Depositing To (Destination)</h3>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Destination Account</label>
                                            <EntitySelector entities={cashBankAccounts} selectedId={destId} onSelect={setDestId} placeholder="Select Dest Account..." />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label><select className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-800" value={toCurrency} onChange={e => setToCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c=><option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Ex. Rate (to Base)</label><input type="number" className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-800" value={toRate} onChange={e => setToRate(parseFloat(e.target.value))} /></div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">Amount Received</label>
                                            <input type="number" className="w-full bg-white border border-slate-300 rounded p-2 font-bold text-slate-800" value={toAmount} onChange={e => setToAmount(e.target.value)} placeholder="0.00" />
                                        </div>
                                    </div>
                                </div>

                                {/* Variance Check */}
                                {(fromAmount && toAmount) && (
                                    <div className="flex justify-center items-center gap-4 text-sm mt-4 bg-slate-100 p-2 rounded-lg">
                                        <span>Sent Value: <strong>${(parseFloat(fromAmount)/fromRate).toFixed(2)}</strong></span>
                                        <span>Received Value: <strong>${(parseFloat(toAmount)/toRate).toFixed(2)}</strong></span>
                                        <span className={`font-bold px-2 py-1 rounded ${getTransferVariance() >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            Exchange {getTransferVariance() >= 0 ? 'Gain' : 'Loss'}: ${Math.abs(getTransferVariance()).toFixed(2)}
                                        </span>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Transfer Description</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                                        placeholder="E.g. Exchange EUR to USD for Payment..." 
                                        value={description} 
                                        onChange={e => setDescription(e.target.value)} 
                                    />
                                </div>
                            </div>
                        ) : vType === 'BD' || vType === 'IA' || vType === 'IAO' ? null : (
                            // STANDARD FORM (RV, PV, EV, PB, RTS, WO)
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* LEFT SIDE: SOURCE & DESTINATION */}
                                <div className="space-y-6">
                                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                        {/* Dynamic Labels based on Voucher Type */}
                                        {vType === 'RV' && (
                                            <>
                                                <div className="mb-4">
                                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><User size={16}/> Received From (Credit)</label>
                                                    <EntitySelector entities={payers} selectedId={sourceId} onSelect={setSourceId} placeholder="Select Payer (Customer/Capital/Loan)..." />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Building size={16}/> Deposit To (Debit)</label>
                                                    <EntitySelector entities={cashBankAccounts} selectedId={destId} onSelect={setDestId} placeholder="Select Cash/Bank..." />
                                                </div>
                                            </>
                                        )}
                                        {vType === 'PV' && (
                                            <>
                                                <div className="mb-4">
                                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><User size={16}/> Paid To (Debit)</label>
                                                    <EntitySelector entities={payees} selectedId={destId} onSelect={setDestId} placeholder="Select Supplier/Vendor/Account..." />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Building size={16}/> Paid From (Credit)</label>
                                                    <EntitySelector entities={cashBankAccounts} selectedId={sourceId} onSelect={setSourceId} placeholder="Select Cash/Bank..." />
                                                </div>
                                            </>
                                        )}
                                        {vType === 'EV' && (
                                            <>
                                                <div className="mb-4">
                                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><FileText size={16}/> Expense Account (Debit)</label>
                                                    <EntitySelector entities={expenseAccounts} selectedId={destId} onSelect={setDestId} placeholder="Select Expense..." />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Building size={16}/> Paid From (Credit)</label>
                                                    <EntitySelector entities={cashBankAccounts} selectedId={sourceId} onSelect={setSourceId} placeholder="Select Cash/Bank..." />
                                                </div>
                                            </>
                                        )}
                                        {vType === 'PB' && (
                                            <>
                                                <div className="mb-4">
                                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><FileText size={16}/> Purchase / Expense (Debit)</label>
                                                    <EntitySelector entities={expenseAccounts} selectedId={destId} onSelect={setDestId} placeholder="Select Item/Expense Category..." />
                                                </div>
                                                
                                                <div className="flex bg-slate-200 p-1 rounded-lg mb-4">
                                                    <button onClick={() => setPbPaymentMode('CREDIT')} className={`flex-1 py-1 text-xs font-bold rounded-md ${pbPaymentMode === 'CREDIT' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Pay Later (Credit)</button>
                                                    <button onClick={() => setPbPaymentMode('CASH')} className={`flex-1 py-1 text-xs font-bold rounded-md ${pbPaymentMode === 'CASH' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}>Pay Now (Cash)</button>
                                                </div>

                                                {pbPaymentMode === 'CREDIT' ? (
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><User size={16}/> Vendor (Credit)</label>
                                                        <EntitySelector entities={payees} selectedId={sourceId} onSelect={setSourceId} placeholder="Select Supplier/Vendor..." />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><User size={16}/> Vendor (Reference)</label>
                                                            <EntitySelector entities={payees} selectedId={pbVendorId} onSelect={setPbVendorId} placeholder="Select Vendor (Optional)..." />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Building size={16}/> Pay From (Credit)</label>
                                                            <EntitySelector entities={cashBankAccounts} selectedId={sourceId} onSelect={setSourceId} placeholder="Select Cash/Bank..." />
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT SIDE: AMOUNT & DESC */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Amount ({currency})</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-4 text-slate-400 font-bold">{CURRENCY_SYMBOLS[currency]}</span>
                                            <input 
                                                type="number" 
                                                className="w-full pl-10 pr-4 py-4 bg-white border border-slate-300 rounded-xl text-3xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-200" 
                                                placeholder="0.00" 
                                                value={amount} 
                                                onChange={e => setAmount(e.target.value)} 
                                            />
                                        </div>
                                        {exchangeRate !== 1 && amount && (
                                            <p className="text-right text-sm text-slate-500 mt-2 font-mono">
                                                ≈ ${(parseFloat(amount) / exchangeRate).toLocaleString()} USD
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Description / Narration</label>
                                        <textarea 
                                            className="w-full bg-white border border-slate-300 rounded-xl p-4 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none h-32" 
                                            placeholder="Enter transaction details..." 
                                            value={description} 
                                            onChange={e => setDescription(e.target.value)} 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* New Transaction Type Forms */}
                        {vType === 'IA' && (() => {
                            // Filter finished goods items
                            // Note: Using regular filter/sort instead of useMemo to avoid hooks in conditional
                            let filteredItems = state.items.filter(item => {
                                const matchesCode = !iaFilterCode || item.code === iaFilterCode;
                                const categoryName = state.categories.find(c => c.id === item.category || c.name === item.category)?.name || item.category;
                                const matchesCategory = !iaFilterCategory || categoryName === iaFilterCategory;
                                const matchesName = !iaFilterItemName || item.name === iaFilterItemName;
                                return matchesCode && matchesCategory && matchesName;
                            });
                            
                            // Apply sorting
                            if (iaSortColumn) {
                                filteredItems = [...filteredItems].sort((a, b) => {
                                    let aValue: any;
                                    let bValue: any;
                                    
                                    switch (iaSortColumn) {
                                        case 'code':
                                            aValue = a.code || '';
                                            bValue = b.code || '';
                                            break;
                                        case 'name':
                                            aValue = a.name || '';
                                            bValue = b.name || '';
                                            break;
                                        case 'category':
                                            const aCat = state.categories.find(c => c.id === a.category || c.name === a.category)?.name || a.category || '';
                                            const bCat = state.categories.find(c => c.id === b.category || c.name === b.category)?.name || b.category || '';
                                            aValue = aCat;
                                            bValue = bCat;
                                            break;
                                        case 'packageSize':
                                            aValue = a.weightPerUnit || 0;
                                            bValue = b.weightPerUnit || 0;
                                            break;
                                        case 'quantity':
                                            aValue = a.stockQty || 0;
                                            bValue = b.stockQty || 0;
                                            break;
                                        case 'worth':
                                            aValue = (a.stockQty || 0) * (a.avgCost || 0);
                                            bValue = (b.stockQty || 0) * (b.avgCost || 0);
                                            break;
                                        default:
                                            return 0;
                                    }
                                    
                                    // Handle string vs number comparison
                                    if (typeof aValue === 'string' && typeof bValue === 'string') {
                                        const comparison = aValue.localeCompare(bValue);
                                        return iaSortDirection === 'asc' ? comparison : -comparison;
                                    } else {
                                        const comparison = (aValue as number) - (bValue as number);
                                        return iaSortDirection === 'asc' ? comparison : -comparison;
                                    }
                                });
                            }

                            // Handle column sorting
                            const handleSort = (column: string) => {
                                if (iaSortColumn === column) {
                                    // Toggle direction if same column
                                    setIaSortDirection(iaSortDirection === 'asc' ? 'desc' : 'asc');
                                } else {
                                    // New column, default to ascending
                                    setIaSortColumn(column);
                                    setIaSortDirection('asc');
                                }
                            };
                            
                            // Update item adjustment function
                            const updateItemAdjustment = (itemId: string, field: 'adjustmentQty' | 'adjustmentWorth', value: string) => {
                                try {
                                    // Clean the value - remove any invalid characters
                                    const cleanedValue = value.trim();
                                    
                                    // If empty, set to empty string
                                    if (cleanedValue === '' || cleanedValue === '-' || cleanedValue === '.') {
                                        setIaItemAdjustments(prev => ({
                                            ...prev,
                                            [itemId]: {
                                                ...prev[itemId],
                                                itemId,
                                                [field]: ''
                                            }
                                        }));
                                        return;
                                    }
                                    
                                    // Try to parse as float
                                    const parsed = parseFloat(cleanedValue);
                                    if (isNaN(parsed)) {
                                        console.warn(`Invalid number for ${field} on item ${itemId}:`, value);
                                        // Don't update if invalid
                                        return;
                                    }
                                    
                                    setIaItemAdjustments(prev => ({
                                        ...prev,
                                        [itemId]: {
                                            ...prev[itemId],
                                            itemId,
                                            [field]: parsed
                                        }
                                    }));
                                } catch (error) {
                                    console.error(`Error updating adjustment for item ${itemId}:`, error);
                                }
                            };
                            
                            // Utility to clear adjustment for a specific item
                            const clearItemAdjustment = (itemId: string) => {
                                setIaItemAdjustments(prev => {
                                    const updated = { ...prev };
                                    if (updated[itemId]) {
                                        updated[itemId] = {
                                            ...updated[itemId],
                                            adjustmentQty: '',
                                            adjustmentWorth: ''
                                        };
                                    }
                                    return updated;
                                });
                            };

                            // Print/Export function for Inventory Adjustment table
                            const handlePrintInventoryAdjustment = () => {
                                if (filteredItems.length === 0) {
                                    alert('No items to print');
                                    return;
                                }

                                // Prepare data for printing
                                const printData = filteredItems.map(item => {
                                    const categoryName = state.categories.find(c => c.id === item.category || c.name === item.category)?.name || item.category;
                                    const currentWorth = (item.stockQty || 0) * (item.avgCost || 0);
                                    const adjustment = iaItemAdjustments[item.id] || { itemId: item.id, adjustmentQty: '', adjustmentWorth: '' };
                                    
                                    return {
                                        'Code': item.code,
                                        'Item Name': item.name,
                                        'Category': categoryName,
                                        'Package Size (Kg)': (item.weightPerUnit || 0).toFixed(2),
                                        'Quantity in Hand': (item.stockQty || 0).toFixed(2),
                                        'Worth (USD)': currentWorth.toFixed(2),
                                        'Adjustment Quantity': adjustment.adjustmentQty !== '' ? String(adjustment.adjustmentQty) : '0',
                                        'Adjustment Worth (USD)': adjustment.adjustmentWorth !== '' ? parseFloat(String(adjustment.adjustmentWorth)).toFixed(2) : '0.00'
                                    };
                                });

                                // Create CSV content
                                const headers = Object.keys(printData[0]);
                                const csvRows = [
                                    headers.join(','),
                                    ...printData.map(row => 
                                        headers.map(header => {
                                            const value = row[header as keyof typeof row];
                                            // Escape commas and quotes in CSV
                                            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                                                return `"${value.replace(/"/g, '""')}"`;
                                            }
                                            return value;
                                        }).join(',')
                                    )
                                ];
                                const csvContent = csvRows.join('\n');

                                // Create a blob and download
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', `Inventory_Adjustment_${new Date().toISOString().split('T')[0]}.csv`);
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);

                                // Also create a printable HTML version
                                const printWindow = window.open('', '_blank');
                                if (printWindow) {
                                    const htmlContent = `
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <title>Inventory Adjustment - Finished Goods</title>
                                            <style>
                                                body { font-family: Arial, sans-serif; margin: 20px; }
                                                h1 { color: #1e40af; margin-bottom: 10px; }
                                                .info { margin-bottom: 20px; color: #666; }
                                                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                                th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-weight: bold; }
                                                td { border: 1px solid #cbd5e1; padding: 8px; }
                                                .text-right { text-align: right; }
                                                .bg-yellow { background-color: #fef3c7; }
                                                .footer { margin-top: 30px; font-size: 12px; color: #666; }
                                            </style>
                                        </head>
                                        <body>
                                            <h1>Inventory Adjustment - Finished Goods</h1>
                                            <div class="info">
                                                <p><strong>Date:</strong> ${date || 'N/A'}</p>
                                                <p><strong>Reason:</strong> ${iaReason || 'N/A'}</p>
                                                <p><strong>Voucher ID:</strong> ${voucherNo}</p>
                                            </div>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Code</th>
                                                        <th>Item Name</th>
                                                        <th>Category</th>
                                                        <th class="text-right">Package Size (Kg)</th>
                                                        <th class="text-right">Quantity in Hand</th>
                                                        <th class="text-right">Worth (USD)</th>
                                                        <th class="text-right bg-yellow">Adjustment Quantity</th>
                                                        <th class="text-right bg-yellow">Adjustment Worth (USD)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${printData.map(row => `
                                                        <tr>
                                                            <td>${row['Code']}</td>
                                                            <td>${row['Item Name']}</td>
                                                            <td>${row['Category']}</td>
                                                            <td class="text-right">${row['Package Size (Kg)']}</td>
                                                            <td class="text-right">${row['Quantity in Hand']}</td>
                                                            <td class="text-right">$${row['Worth (USD)']}</td>
                                                            <td class="text-right bg-yellow">${row['Adjustment Quantity']}</td>
                                                            <td class="text-right bg-yellow">$${row['Adjustment Worth (USD)']}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                            <div class="footer">
                                                <p>Generated on: ${new Date().toLocaleString()}</p>
                                            </div>
                                        </body>
                                        </html>
                                    `;
                                    printWindow.document.write(htmlContent);
                                    printWindow.document.close();
                                    printWindow.focus();
                                    // Wait for content to load, then print
                                    setTimeout(() => {
                                        printWindow.print();
                                    }, 250);
                                }
                            };

                            return (
                            <div className="space-y-6 bg-indigo-50 p-6 rounded-xl border-2 border-indigo-200">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                                        <Package size={20} /> Inventory Adjustment (Finished Goods)
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setIaUseTargetMode(!iaUseTargetMode)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2"
                                        >
                                            {iaUseTargetMode ? 'Switch to Adjustment Mode' : 'Switch to Target Mode'}
                                        </button>
                                    <button
                                        onClick={handlePrintInventoryAdjustment}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                                        title="Print/Export Table"
                                    >
                                        <Printer size={18} /> Print/Export
                                    </button>
                                    </div>
                                </div>
                                
                                {iaUseTargetMode && (
                                    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                                        <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                                            <CheckCircle size={18} /> Target Mode
                                        </h4>
                                        <p className="text-sm text-green-700">
                                            Enter the <strong>target values</strong> you want for each item. The system will automatically calculate and apply the adjustments.
                                        </p>
                                    </div>
                                )}

                                {/* CSV Upload Section */}
                                {(() => {
                                    // CSV Upload Handler for Inventory Adjustment
                                    const handleInventoryAdjustmentCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        Papa.parse(file, {
                                            header: true,
                                            skipEmptyLines: true,
                                            complete: (results) => {
                                                const errors: string[] = [];
                                                const newAdjustments: Record<string, ItemAdjustment> = { ...iaItemAdjustments };
                                                const newTargets: Record<string, ItemTarget> = { ...iaTargets };
                                                let successCount = 0;

                                                for (let idx = 0; idx < results.data.length; idx++) {
                                                    const row = results.data[idx] as any;
                                                    
                                                    // Validate required columns
                                                    if (!row['Item Code'] || row['Item Code'].trim() === '') {
                                                        errors.push(`Row ${idx + 2}: Missing Item Code`);
                                                        continue;
                                                    }

                                                    const itemCode = row['Item Code'].trim();
                                                    
                                                    // Find item by code
                                                    const item = state.items.find(i => i.code === itemCode);
                                                    if (!item) {
                                                        errors.push(`Row ${idx + 2}: Item with code "${itemCode}" not found`);
                                                        continue;
                                                    }

                                                    // Parse Current Stock (quantity)
                                                    const csvCurrentStock = row['Current Stock'] !== undefined && row['Current Stock'] !== '' 
                                                        ? parseFloat(String(row['Current Stock']).trim()) 
                                                        : null;
                                                    
                                                    // Parse Current Stock Worth (value)
                                                    const csvCurrentWorth = row['Current Stock Worth'] !== undefined && row['Current Stock Worth'] !== '' 
                                                        ? parseFloat(String(row['Current Stock Worth']).trim()) 
                                                        : null;

                                                    if (csvCurrentStock === null && csvCurrentWorth === null) {
                                                        errors.push(`Row ${idx + 2}: Both "Current Stock" and "Current Stock Worth" are missing. At least one is required.`);
                                                        continue;
                                                    }

                                                    // Get system's current values
                                                    const systemCurrentStock = item.stockQty || 0;
                                                    const systemCurrentWorth = (item.stockQty || 0) * (item.avgCost || 0);

                                                    if (iaUseTargetMode) {
                                                        // Target Mode: Store target values directly
                                                        newTargets[item.id] = {
                                                            itemId: item.id,
                                                            targetQty: csvCurrentStock !== null ? csvCurrentStock : '',
                                                            targetWorth: csvCurrentWorth !== null ? csvCurrentWorth : ''
                                                        };
                                                    } else {
                                                        // Adjustment Mode: Calculate and store adjustments
                                                        let adjustmentQty: number | '' = '';
                                                        let adjustmentWorth: number | '' = '';

                                                        if (csvCurrentStock !== null) {
                                                            // Calculate quantity adjustment
                                                            adjustmentQty = csvCurrentStock - systemCurrentStock;
                                                        }

                                                        if (csvCurrentWorth !== null) {
                                                            // Calculate worth adjustment
                                                            adjustmentWorth = csvCurrentWorth - systemCurrentWorth;
                                                        } else if (csvCurrentStock !== null && item.avgCost) {
                                                            // If only quantity provided, calculate worth adjustment based on current avgCost
                                                            adjustmentWorth = (adjustmentQty as number) * item.avgCost;
                                                        }

                                                        // Update adjustments
                                                        newAdjustments[item.id] = {
                                                            itemId: item.id,
                                                            adjustmentQty: adjustmentQty !== 0 ? adjustmentQty : '',
                                                            adjustmentWorth: adjustmentWorth !== 0 ? adjustmentWorth : ''
                                                        };
                                                    }

                                                    successCount++;
                                                }

                                                // Update state based on mode
                                                if (iaUseTargetMode) {
                                                    setIaTargets(newTargets);
                                                } else {
                                                    setIaItemAdjustments(newAdjustments);
                                                }

                                                // Show results
                                                if (errors.length > 0) {
                                                    alert(`CSV Upload Complete:\n\n✅ Successfully processed: ${successCount} item(s)\n❌ Errors: ${errors.length}\n\nErrors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}`);
                                                } else {
                                                    alert(`✅ CSV Upload Complete!\n\nSuccessfully processed ${successCount} item(s).\n${iaUseTargetMode ? 'Target values' : 'Adjustments'} have been ${iaUseTargetMode ? 'populated' : 'calculated and populated'} in the table below.`);
                                                }

                                                // Reset file input
                                                e.target.value = '';
                                            },
                                            error: (error) => {
                                                alert(`❌ Error parsing CSV: ${error.message}`);
                                            }
                                        });
                                    };

                                    // Download CSV Template
                                    const downloadInventoryAdjustmentTemplate = () => {
                                        const template = [
                                            ['Item Code', 'Current Stock', 'Current Stock Worth'],
                                            ['ITEM-001', '100', '5000.00'],
                                            ['ITEM-002', '50', '2500.00']
                                        ];

                                        const csvContent = template.map(row => row.join(',')).join('\n');
                                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                        const link = document.createElement('a');
                                        const url = URL.createObjectURL(blob);
                                        link.setAttribute('href', url);
                                        link.setAttribute('download', 'Inventory_Adjustment_Template.csv');
                                        link.style.visibility = 'hidden';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    };

                                    return (
                                        <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-sm">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                                    <Upload size={18} className="text-blue-600" /> Upload CSV for Bulk Adjustment
                                                </h4>
                                                <button
                                                    onClick={downloadInventoryAdjustmentTemplate}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                                                >
                                                    <FileText size={14} /> Download Template
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs text-slate-600">
                                                    Upload a CSV file with columns: <strong>Item Code</strong>, <strong>Current Stock</strong>, <strong>Current Stock Worth</strong>
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {iaUseTargetMode 
                                                        ? 'In Target Mode: CSV values will be set as target values directly. The system will calculate adjustments automatically when you post.'
                                                        : 'In Adjustment Mode: The system will calculate adjustments by comparing CSV values with current system values.'}
                                                </p>
                                                <input
                                                    type="file"
                                                    accept=".csv"
                                                    onChange={handleInventoryAdjustmentCSVUpload}
                                                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                                    
                                    {/* Filters */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-lg border border-slate-200">
                                    <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Code</label>
                                        <EntitySelector 
                                                entities={[{ id: '', name: 'All Codes' }, ...iaFilterOptions.codes]} 
                                                selectedId={iaFilterCode} 
                                                onSelect={(id) => setIaFilterCode(id || '')} 
                                                placeholder="Select or search code..."
                                        />
                                    </div>
                                    <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Category</label>
                                            <EntitySelector 
                                                entities={[{ id: '', name: 'All Categories' }, ...iaFilterOptions.categories]} 
                                                selectedId={iaFilterCategory} 
                                                onSelect={(id) => setIaFilterCategory(id || '')} 
                                                placeholder="Select or search category..."
                                            />
                                    </div>
                                    <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Item Name</label>
                                            <EntitySelector 
                                                entities={[{ id: '', name: 'All Items' }, ...iaFilterOptions.itemNames]} 
                                                selectedId={iaFilterItemName} 
                                                onSelect={(id) => setIaFilterItemName(id || '')} 
                                                placeholder="Select or search item name..."
                                        />
                                    </div>
                                    </div>

                                    {/* Reason Field */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Reason for Adjustment *</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={iaReason} 
                                            onChange={e => setIaReason(e.target.value)} 
                                            placeholder="Reason for adjustment (required)"
                                        />
                                    </div>

                                    {/* Items Table */}
                                    <div className="bg-white rounded-lg border border-slate-300 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-100 border-b-2 border-slate-300">
                                                    <tr>
                                                        <th 
                                                            className="px-4 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                                                            onClick={() => handleSort('code')}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                Code
                                                                {iaSortColumn === 'code' && (
                                                                    iaSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th 
                                                            className="px-4 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                                                            onClick={() => handleSort('name')}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                Item Name
                                                                {iaSortColumn === 'name' && (
                                                                    iaSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th 
                                                            className="px-4 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                                                            onClick={() => handleSort('category')}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                Category
                                                                {iaSortColumn === 'category' && (
                                                                    iaSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th 
                                                            className="px-4 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                                                            onClick={() => handleSort('packageSize')}
                                                        >
                                                            <div className="flex items-center justify-end gap-2">
                                                                Package Size (Kg)
                                                                {iaSortColumn === 'packageSize' && (
                                                                    iaSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th 
                                                            className="px-4 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                                                            onClick={() => handleSort('quantity')}
                                                        >
                                                            <div className="flex items-center justify-end gap-2">
                                                                Quantity in Hand
                                                                {iaSortColumn === 'quantity' && (
                                                                    iaSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th 
                                                            className="px-4 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-200 select-none transition-colors"
                                                            onClick={() => handleSort('worth')}
                                                        >
                                                            <div className="flex items-center justify-end gap-2">
                                                                Worth (USD)
                                                                {iaSortColumn === 'worth' && (
                                                                    iaSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                                )}
                                                            </div>
                                                        </th>
                                                        {iaUseTargetMode ? (
                                                            <>
                                                                <th className="px-4 py-3 text-right font-bold text-slate-700 bg-green-50">Target Quantity</th>
                                                                <th className="px-4 py-3 text-right font-bold text-slate-700 bg-green-50">Target Worth (USD)</th>
                                                                <th className="px-4 py-3 text-right font-bold text-slate-700 bg-yellow-50">Calculated Adjustment Qty</th>
                                                                <th className="px-4 py-3 text-right font-bold text-slate-700 bg-yellow-50">Calculated Adjustment Worth</th>
                                                            </>
                                                        ) : (
                                                            <>
                                                        <th className="px-4 py-3 text-right font-bold text-slate-700 bg-yellow-50">Adjustment Quantity</th>
                                                        <th className="px-4 py-3 text-right font-bold text-slate-700 bg-yellow-50">Adjustment Worth (USD)</th>
                                                            </>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {filteredItems.map(item => {
                                                        const categoryName = state.categories.find(c => c.id === item.category || c.name === item.category)?.name || item.category;
                                                        const currentQty = item.stockQty || 0;
                                                        const currentWorth = currentQty * (item.avgCost || 0);
                                                        const adjustment = iaItemAdjustments[item.id] || { itemId: item.id, adjustmentQty: '', adjustmentWorth: '' };
                                                        const target = iaTargets[item.id] || { itemId: item.id, targetQty: '', targetWorth: '' };
                                                        
                                                        // Calculate target values and differences
                                                        const targetQty = target.targetQty === '' ? currentQty : (typeof target.targetQty === 'number' ? target.targetQty : parseFloat(String(target.targetQty)) || 0);
                                                        const targetWorth = target.targetWorth === '' ? currentWorth : (typeof target.targetWorth === 'number' ? target.targetWorth : parseFloat(String(target.targetWorth)) || 0);
                                                        const qtyDiff = targetQty - currentQty;
                                                        const worthDiff = targetWorth - currentWorth;
                                                        
                                                        return (
                                                            <tr key={item.id} className="hover:bg-slate-50">
                                                                <td className="px-4 py-3 font-mono text-slate-700">{item.code}</td>
                                                                <td className="px-4 py-3 text-slate-800">{item.name}</td>
                                                                <td className="px-4 py-3 text-slate-600">{categoryName}</td>
                                                                <td className="px-4 py-3 text-right font-mono text-slate-600">{(item.weightPerUnit || 0).toFixed(2)}</td>
                                                                {iaUseTargetMode ? (
                                                                    <>
                                                                        <td className="px-4 py-3 text-right font-mono text-slate-700">{currentQty.toFixed(2)}</td>
                                                                        <td className="px-4 py-3 text-right font-mono text-slate-700">${currentWorth.toFixed(2)}</td>
                                                                        <td className="px-4 py-3 text-right bg-green-50">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                placeholder={currentQty.toFixed(2)}
                                                                                value={
                                                                                    target.targetQty === '' || target.targetQty === null || target.targetQty === undefined 
                                                                                        ? '' 
                                                                                        : (target.targetQty === 0 ? '0' : String(target.targetQty))
                                                                                }
                                                                                onChange={(e) => {
                                                                                    let val: number | '';
                                                                                    if (e.target.value === '') {
                                                                                        val = '';
                                                                                    } else {
                                                                                        const parsed = parseFloat(e.target.value);
                                                                                        if (isNaN(parsed)) {
                                                                                            val = '';
                                                                                        } else {
                                                                                            val = parsed;
                                                                                        }
                                                                                    }
                                                                                    setIaTargets(prev => ({
                                                                                        ...prev,
                                                                                        [item.id]: {
                                                                                            itemId: item.id,
                                                                                            targetQty: val,
                                                                                            targetWorth: prev[item.id]?.targetWorth || ''
                                                                                        }
                                                                                    }));
                                                                                }}
                                                                                className="w-24 px-2 py-1 border border-green-300 rounded text-right text-sm focus:ring-2 focus:ring-green-500"
                                                                            />
                                                                            {qtyDiff !== 0 && (
                                                                                <div className={`text-xs mt-1 ${qtyDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                                    {qtyDiff > 0 ? '+' : ''}{qtyDiff.toFixed(2)}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right bg-green-50">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                placeholder={currentWorth.toFixed(2)}
                                                                                value={
                                                                                    target.targetWorth === '' || target.targetWorth === null || target.targetWorth === undefined 
                                                                                        ? '' 
                                                                                        : (target.targetWorth === 0 ? '0' : String(target.targetWorth))
                                                                                }
                                                                                onChange={(e) => {
                                                                                    let val: number | '';
                                                                                    if (e.target.value === '') {
                                                                                        val = '';
                                                                                    } else {
                                                                                        const parsed = parseFloat(e.target.value);
                                                                                        if (isNaN(parsed)) {
                                                                                            val = '';
                                                                                        } else {
                                                                                            val = parsed;
                                                                                        }
                                                                                    }
                                                                                    setIaTargets(prev => ({
                                                                                        ...prev,
                                                                                        [item.id]: {
                                                                                            itemId: item.id,
                                                                                            targetQty: prev[item.id]?.targetQty || '',
                                                                                            targetWorth: val
                                                                                        }
                                                                                    }));
                                                                                }}
                                                                                className="w-24 px-2 py-1 border border-green-300 rounded text-right text-sm focus:ring-2 focus:ring-green-500"
                                                                            />
                                                                            {worthDiff !== 0 && (
                                                                                <div className={`text-xs mt-1 ${worthDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                                    {worthDiff > 0 ? '+' : ''}${worthDiff.toFixed(2)}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right bg-yellow-50 font-mono text-sm">
                                                                            {qtyDiff !== 0 ? (qtyDiff > 0 ? '+' : '') + qtyDiff.toFixed(2) : '0.00'}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right bg-yellow-50 font-mono text-sm">
                                                                            {worthDiff !== 0 ? (worthDiff > 0 ? '+' : '') + '$' + worthDiff.toFixed(2) : '$0.00'}
                                                                        </td>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <td className="px-4 py-3 text-right font-mono text-slate-700">{currentQty.toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right font-mono text-slate-700">${currentWorth.toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right bg-yellow-50">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <input 
                                                                            type="number" 
                                                                            className="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                                                            value={adjustment.adjustmentQty === '' || adjustment.adjustmentQty === null || adjustment.adjustmentQty === undefined ? '' : adjustment.adjustmentQty} 
                                                                            onChange={e => updateItemAdjustment(item.id, 'adjustmentQty', e.target.value)}
                                                                            onBlur={e => {
                                                                                const val = e.target.value.trim();
                                                                                if (val && (isNaN(parseFloat(val)) || val === '-' || val === '.')) {
                                                                                    alert(`Invalid quantity for ${item.code}. Clearing field.`);
                                                                                    setIaItemAdjustments(prev => ({
                                                                                        ...prev,
                                                                                        [item.id]: {
                                                                                            ...prev[item.id],
                                                                                            itemId: item.id,
                                                                                            adjustmentQty: '',
                                                                                            adjustmentWorth: prev[item.id]?.adjustmentWorth || ''
                                                                                        }
                                                                                    }));
                                                                                }
                                                                            }}
                                                                            placeholder="0"
                                                                        />
                                                                        {(adjustment.adjustmentQty !== '' && adjustment.adjustmentQty !== null && adjustment.adjustmentQty !== undefined && adjustment.adjustmentQty !== 0) && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setIaItemAdjustments(prev => ({
                                                                                        ...prev,
                                                                                        [item.id]: {
                                                                                            ...prev[item.id],
                                                                                            itemId: item.id,
                                                                                            adjustmentQty: '',
                                                                                            adjustmentWorth: prev[item.id]?.adjustmentWorth || ''
                                                                                        }
                                                                                    }));
                                                                                }}
                                                                                className="text-red-500 hover:text-red-700 p-1"
                                                                                title="Clear adjustment quantity"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right bg-yellow-50">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <input 
                                                                            type="number" 
                                                                            step="0.01"
                                                                            className="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                                                            value={adjustment.adjustmentWorth === '' || adjustment.adjustmentWorth === null || adjustment.adjustmentWorth === undefined ? '' : adjustment.adjustmentWorth} 
                                                                            onChange={e => updateItemAdjustment(item.id, 'adjustmentWorth', e.target.value)}
                                                                            onBlur={e => {
                                                                                const val = e.target.value.trim();
                                                                                if (val && (isNaN(parseFloat(val)) || val === '-' || val === '.')) {
                                                                                    alert(`Invalid worth for ${item.code}. Clearing field.`);
                                                                                    setIaItemAdjustments(prev => ({
                                                                                        ...prev,
                                                                                        [item.id]: {
                                                                                            ...prev[item.id],
                                                                                            itemId: item.id,
                                                                                            adjustmentQty: prev[item.id]?.adjustmentQty || '',
                                                                                            adjustmentWorth: ''
                                                                                        }
                                                                                    }));
                                                                                }
                                                                            }}
                                                                            placeholder="0.00"
                                                                        />
                                                                        {(adjustment.adjustmentWorth !== '' && adjustment.adjustmentWorth !== null && adjustment.adjustmentWorth !== undefined && adjustment.adjustmentWorth !== 0) && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setIaItemAdjustments(prev => ({
                                                                                        ...prev,
                                                                                        [item.id]: {
                                                                                            ...prev[item.id],
                                                                                            itemId: item.id,
                                                                                            adjustmentQty: prev[item.id]?.adjustmentQty || '',
                                                                                            adjustmentWorth: ''
                                                                                        }
                                                                                    }));
                                                                                }}
                                                                                className="text-red-500 hover:text-red-700 p-1"
                                                                                title="Clear adjustment worth"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                    </>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                </div>
                                        {filteredItems.length === 0 && (
                                            <div className="p-8 text-center text-slate-500">
                                                No items found matching the filters.
                            </div>
                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {vType === 'IAO' && (() => {
                            // Filter original stock data based on filters
                            // Note: Using regular filter instead of useMemo to avoid hooks in conditional
                            const filteredOriginalStockData = originalStockData.filter(item => {
                                const matchesCode = !iaoFilterCode || item.originalTypeName.toLowerCase().includes(iaoFilterCode.toLowerCase());
                                const matchesType = !iaoFilterOriginalType || item.originalTypeName.toLowerCase().includes(iaoFilterOriginalType.toLowerCase());
                                const matchesSupplier = !iaoFilterSupplier || item.supplierName.toLowerCase().includes(iaoFilterSupplier.toLowerCase()) || (item.subSupplierName && item.subSupplierName.toLowerCase().includes(iaoFilterSupplier.toLowerCase()));
                                return matchesCode && matchesType && matchesSupplier;
                            });

                            // Update original adjustment function
                            const updateOriginalAdjustment = (key: string, field: 'adjustmentWeight' | 'adjustmentWorth', value: string) => {
                                setIaoAdjustments(prev => ({
                                    ...prev,
                                    [key]: {
                                        ...prev[key],
                                        key,
                                        [field]: value === '' ? '' : parseFloat(value) || ''
                                    }
                                }));
                            };

                            return (
                                <div className="space-y-6 bg-purple-50 p-6 rounded-xl border-2 border-purple-200">
                                    <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                                        <ShoppingBag size={20} /> Original Stock Adjustment
                                    </h3>
                                        <button
                                            onClick={() => setUseSimpleMode(!useSimpleMode)}
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 flex items-center gap-2"
                                        >
                                            {useSimpleMode ? 'Switch to Adjustment Mode' : 'Switch to Target Mode'}
                                        </button>
                                    </div>
                                    
                                    {useSimpleMode ? (
                                        // NEW SIMPLE MODE - Target Values
                                        <div className="space-y-4">
                                            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                                                <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                                                    <CheckCircle size={18} /> Simple Target Mode
                                                </h4>
                                                <p className="text-sm text-green-700">
                                                    Enter the <strong>target values</strong> you want for each item. The system will automatically calculate and apply the adjustments.
                                                </p>
                                            </div>
                                            
                                            {/* Filters */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-1">FILTER BY CODE</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Search code..."
                                                        value={iaoFilterCode}
                                                        onChange={(e) => setIaoFilterCode(e.target.value)}
                                                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-1">FILTER BY ORIGINAL TYPE</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Search original type..."
                                                        value={iaoFilterOriginalType}
                                                        onChange={(e) => setIaoFilterOriginalType(e.target.value)}
                                                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-1">FILTER BY SUPPLIER</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Search supplier..."
                                                        value={iaoFilterSupplier}
                                                        onChange={(e) => setIaoFilterSupplier(e.target.value)}
                                                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* Reason */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                    Reason for Adjustment <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Reason for adjustment (required)"
                                                    value={iaoReason}
                                                    onChange={(e) => setIaoReason(e.target.value)}
                                                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                    required
                                                />
                                            </div>
                                            
                                            {/* Table */}
                                            <div className="bg-white rounded-lg border-2 border-slate-300 overflow-hidden">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-slate-100">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Code</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Original Type Name</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Supplier</th>
                                                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Sub Supplier</th>
                                                                <th className="px-4 py-3 text-right font-semibold text-slate-700">Current Weight (Kg)</th>
                                                                <th className="px-4 py-3 text-right font-semibold text-slate-700">Current Worth (USD)</th>
                                                                <th className="px-4 py-3 text-right font-semibold text-slate-700 bg-green-50">Target Weight (Kg)</th>
                                                                <th className="px-4 py-3 text-right font-semibold text-slate-700 bg-green-50">Target Worth (USD)</th>
                                                                <th className="px-4 py-3 text-right font-semibold text-slate-700 bg-yellow-50">Calculated Adjustment Weight</th>
                                                                <th className="px-4 py-3 text-right font-semibold text-slate-700 bg-yellow-50">Calculated Adjustment Worth</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredOriginalStockData.map((item) => {
                                                                const target = iaoTargets[item.key] || { key: item.key, targetWeight: '', targetWorth: '' };
                                                                const currentWeight = item.weightInHand || 0;
                                                                const currentWorth = item.worth || 0;
                                                                const targetWeight = target.targetWeight === '' ? currentWeight : (typeof target.targetWeight === 'number' ? target.targetWeight : parseFloat(String(target.targetWeight)) || 0);
                                                                const targetWorth = target.targetWorth === '' ? currentWorth : (typeof target.targetWorth === 'number' ? target.targetWorth : parseFloat(String(target.targetWorth)) || 0);
                                                                const weightDiff = targetWeight - currentWeight;
                                                                const worthDiff = targetWorth - currentWorth;
                                                                
                                                                return (
                                                                    <tr key={item.key} className="border-b border-slate-200 hover:bg-slate-50">
                                                                        <td className="px-4 py-3 font-mono text-xs">{item.originalTypeId}</td>
                                                                        <td className="px-4 py-3">
                                                                            {item.originalTypeName}
                                                                            {item.originalProductName && <span className="text-slate-500 text-xs"> - {item.originalProductName}</span>}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-slate-600">{item.supplierName}</td>
                                                                        <td className="px-4 py-3 text-slate-500 text-xs">{item.subSupplierName || '-'}</td>
                                                                        <td className="px-4 py-3 text-right font-mono text-slate-700">{currentWeight.toFixed(2)}</td>
                                                                        <td className="px-4 py-3 text-right font-mono text-slate-700">${currentWorth.toFixed(2)}</td>
                                                                        <td className="px-4 py-3 text-right bg-green-50">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                placeholder={currentWeight.toFixed(2)}
                                                                                value={
                                                                                    target.targetWeight === '' || target.targetWeight === null || target.targetWeight === undefined 
                                                                                        ? '' 
                                                                                        : (target.targetWeight === 0 ? '0' : String(target.targetWeight))
                                                                                }
                                                                                onChange={(e) => {
                                                                                    let val: number | '';
                                                                                    if (e.target.value === '') {
                                                                                        val = '';
                                                                                    } else {
                                                                                        const parsed = parseFloat(e.target.value);
                                                                                        if (isNaN(parsed)) {
                                                                                            val = '';
                                                                                        } else {
                                                                                            val = parsed;
                                                                                        }
                                                                                    }
                                                                                    setIaoTargets(prev => ({
                                                                                        ...prev,
                                                                                        [item.key]: {
                                                                                            key: item.key,
                                                                                            targetWeight: val,
                                                                                            targetWorth: prev[item.key]?.targetWorth || ''
                                                                                        }
                                                                                    }));
                                                                                }}
                                                                                className="w-24 px-2 py-1 border border-green-300 rounded text-right text-sm focus:ring-2 focus:ring-green-500"
                                                                            />
                                                                            {weightDiff !== 0 && (
                                                                                <div className={`text-xs mt-1 ${weightDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                                    {weightDiff > 0 ? '+' : ''}{weightDiff.toFixed(2)}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right bg-green-50">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                placeholder={currentWorth.toFixed(2)}
                                                                                value={
                                                                                    target.targetWorth === '' || target.targetWorth === null || target.targetWorth === undefined 
                                                                                        ? '' 
                                                                                        : (target.targetWorth === 0 ? '0' : String(target.targetWorth))
                                                                                }
                                                                                onChange={(e) => {
                                                                                    let val: number | '';
                                                                                    if (e.target.value === '') {
                                                                                        val = '';
                                                                                    } else {
                                                                                        const parsed = parseFloat(e.target.value);
                                                                                        if (isNaN(parsed)) {
                                                                                            val = '';
                                                                                        } else {
                                                                                            val = parsed;
                                                                                        }
                                                                                    }
                                                                                    setIaoTargets(prev => ({
                                                                                        ...prev,
                                                                                        [item.key]: {
                                                                                            key: item.key,
                                                                                            targetWeight: prev[item.key]?.targetWeight || '',
                                                                                            targetWorth: val
                                                                                        }
                                                                                    }));
                                                                                }}
                                                                                className="w-24 px-2 py-1 border border-green-300 rounded text-right text-sm focus:ring-2 focus:ring-green-500"
                                                                            />
                                                                            {worthDiff !== 0 && (
                                                                                <div className={`text-xs mt-1 ${worthDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                                    {worthDiff > 0 ? '+' : ''}${worthDiff.toFixed(2)}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right bg-yellow-50 font-mono text-sm">
                                                                            {weightDiff !== 0 ? (weightDiff > 0 ? '+' : '') + weightDiff.toFixed(2) : '0.00'}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right bg-yellow-50 font-mono text-sm">
                                                                            {worthDiff !== 0 ? (worthDiff > 0 ? '+' : '') + '$' + worthDiff.toFixed(2) : '$0.00'}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // OLD MODE - Adjustment Values (existing code)
                                        <>
                                    
                                    {/* CSV Upload Section */}
                                    {(() => {
                                        // CSV Upload Handler for Original Stock Adjustment
                                        const handleOriginalStockAdjustmentCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            Papa.parse(file, {
                                                header: true,
                                                skipEmptyLines: true,
                                                complete: (results) => {
                                                    const errors: string[] = [];
                                                    const newAdjustments: Record<string, OriginalStockAdjustment> = { ...iaoAdjustments };
                                                    const newTargets: Record<string, OriginalStockTarget> = { ...iaoTargets };
                                                    let successCount = 0;
                                                    const warnings: string[] = [];

                                                    for (let idx = 0; idx < results.data.length; idx++) {
                                                        const row = results.data[idx] as any;
                                                        
                                                        // Validate required columns
                                                        if (!row['Code'] || row['Code'].trim() === '') {
                                                            errors.push(`Row ${idx + 2}: Missing Code`);
                                                            continue;
                                                        }

                                                        const code = row['Code'].trim();
                                                        
                                                        // Find matching entries by originalTypeId (Code)
                                                        const matchingItems = originalStockData.filter(item => item.originalTypeId === code);
                                                        
                                                        if (matchingItems.length === 0) {
                                                            errors.push(`Row ${idx + 2}: No original stock entry found with Code "${code}"`);
                                                            continue;
                                                        }

                                                        if (matchingItems.length > 1) {
                                                            warnings.push(`Row ${idx + 2}: Code "${code}" matches ${matchingItems.length} entries. All will be updated.`);
                                                        }

                                                        // Parse Current Weight (Kg)
                                                        const csvCurrentWeight = row['Kg'] !== undefined && row['Kg'] !== '' 
                                                            ? parseFloat(String(row['Kg']).trim()) 
                                                            : null;
                                                        
                                                        // Parse Current Worth (value)
                                                        const csvCurrentWorth = row['Worth'] !== undefined && row['Worth'] !== '' 
                                                            ? parseFloat(String(row['Worth']).trim()) 
                                                            : null;

                                                        if (csvCurrentWeight === null && csvCurrentWorth === null) {
                                                            errors.push(`Row ${idx + 2}: Both "Kg" and "Worth" are missing. At least one is required.`);
                                                            continue;
                                                        }

                                                        // Update all matching entries
                                                        matchingItems.forEach(item => {
                                                            if (useSimpleMode) {
                                                                // Target Mode: Store target values directly
                                                                newTargets[item.key] = {
                                                                    key: item.key,
                                                                    targetWeight: csvCurrentWeight !== null ? csvCurrentWeight : '',
                                                                    targetWorth: csvCurrentWorth !== null ? csvCurrentWorth : ''
                                                                };
                                                            } else {
                                                                // Adjustment Mode: Calculate and store adjustments
                                                                const systemCurrentWeight = item.weightInHand || 0;
                                                                const systemCurrentWorth = item.worth || 0;

                                                                let adjustmentWeight: number | '' = '';
                                                                let adjustmentWorth: number | '' = '';

                                                                if (csvCurrentWeight !== null) {
                                                                    adjustmentWeight = csvCurrentWeight - systemCurrentWeight;
                                                                }

                                                                if (csvCurrentWorth !== null) {
                                                                    adjustmentWorth = csvCurrentWorth - systemCurrentWorth;
                                                                } else if (csvCurrentWeight !== null && item.avgCostPerKg) {
                                                                    adjustmentWorth = (adjustmentWeight as number) * item.avgCostPerKg;
                                                                }

                                                                newAdjustments[item.key] = {
                                                                    key: item.key,
                                                                    adjustmentWeight: adjustmentWeight !== 0 ? adjustmentWeight : '',
                                                                    adjustmentWorth: adjustmentWorth !== 0 ? adjustmentWorth : ''
                                                                };
                                                            }
                                                        });

                                                        successCount++;
                                                    }

                                                    // Update state based on mode
                                                    if (useSimpleMode) {
                                                        setIaoTargets(newTargets);
                                                    } else {
                                                        setIaoAdjustments(newAdjustments);
                                                    }

                                                    // Show results
                                                    let message = '';
                                                    if (successCount > 0) {
                                                        message += `✅ Successfully processed: ${successCount} row(s)\n`;
                                                    }
                                                    if (warnings.length > 0) {
                                                        message += `\n⚠️ Warnings: ${warnings.length}\n${warnings.slice(0, 5).join('\n')}${warnings.length > 5 ? `\n... and ${warnings.length - 5} more` : ''}\n`;
                                                    }
                                                    if (errors.length > 0) {
                                                        message += `\n❌ Errors: ${errors.length}\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}`;
                                                    }

                                                    if (errors.length > 0 || warnings.length > 0) {
                                                        alert(`CSV Upload Complete:\n\n${message}`);
                                                    } else {
                                                        alert(`✅ CSV Upload Complete!\n\nSuccessfully processed ${successCount} row(s).\n${useSimpleMode ? 'Target values' : 'Adjustments'} have been ${useSimpleMode ? 'populated' : 'calculated and populated'} in the table below.`);
                                                    }

                                                    // Reset file input
                                                    e.target.value = '';
                                                },
                                                error: (error) => {
                                                    alert(`❌ Error parsing CSV: ${error.message}`);
                                                }
                                            });
                                        };

                                        // Download CSV Template for Original Stock Adjustment
                                        const downloadOriginalStockAdjustmentTemplate = () => {
                                            // Get unique codes from originalStockData
                                            const uniqueCodes = Array.from(new Set(originalStockData.map(item => item.originalTypeId))).slice(0, 5);
                                            
                                            const template = [
                                                ['Code', 'Kg', 'Worth'],
                                                ...uniqueCodes.map(code => {
                                                    const sampleItem = originalStockData.find(item => item.originalTypeId === code);
                                                    return [
                                                        code,
                                                        sampleItem ? (sampleItem.weightInHand || 0).toFixed(2) : '0.00',
                                                        sampleItem ? (sampleItem.worth || 0).toFixed(2) : '0.00'
                                                    ];
                                                })
                                            ];

                                            const csvContent = template.map(row => row.join(',')).join('\n');
                                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                            const link = document.createElement('a');
                                            const url = URL.createObjectURL(blob);
                                            link.setAttribute('href', url);
                                            link.setAttribute('download', 'Original_Stock_Adjustment_Template.csv');
                                            link.style.visibility = 'hidden';
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                        };

                                        return (
                                            <div className="bg-white border-2 border-purple-300 rounded-lg p-4 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                                        <Upload size={18} className="text-purple-600" /> Upload CSV for Bulk Adjustment
                                                    </h4>
                                                    <button
                                                        onClick={downloadOriginalStockAdjustmentTemplate}
                                                        className="text-xs text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1"
                                                    >
                                                        <FileText size={14} /> Download Template
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-xs text-slate-600">
                                                        Upload a CSV file with columns: <strong>Code</strong>, <strong>Kg</strong>, <strong>Worth</strong>
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {useSimpleMode 
                                                            ? 'In Target Mode: CSV values will be set as target values directly. The system will calculate adjustments automatically when you post.'
                                                            : 'In Adjustment Mode: The system will calculate adjustments by comparing CSV values with current system values. If a Code matches multiple entries (different suppliers), all matching entries will be updated.'}
                                                    </p>
                                                    <input
                                                        type="file"
                                                        accept=".csv"
                                                        onChange={handleOriginalStockAdjustmentCSVUpload}
                                                        className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    
                                    {/* Filters */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-lg border border-slate-200">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Code</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 text-sm" 
                                                value={iaoFilterCode} 
                                                onChange={e => setIaoFilterCode(e.target.value)} 
                                                placeholder="Search code..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Original Type</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 text-sm" 
                                                value={iaoFilterOriginalType} 
                                                onChange={e => setIaoFilterOriginalType(e.target.value)} 
                                                placeholder="Search original type..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filter by Supplier</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 text-sm" 
                                                value={iaoFilterSupplier} 
                                                onChange={e => setIaoFilterSupplier(e.target.value)} 
                                                placeholder="Search supplier..."
                                            />
                                        </div>
                                    </div>

                                    {/* Reason Field */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Reason for Adjustment *</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={iaoReason} 
                                            onChange={e => setIaoReason(e.target.value)} 
                                            placeholder="Reason for adjustment (required)"
                                        />
                                    </div>

                                    {/* Original Stock Table */}
                                    <div className="bg-white rounded-lg border border-slate-300 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-100 border-b-2 border-slate-300">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-bold text-slate-700">Code</th>
                                                        <th className="px-4 py-3 text-left font-bold text-slate-700">Original Type Name</th>
                                                        <th className="px-4 py-3 text-left font-bold text-slate-700">Supplier</th>
                                                        <th className="px-4 py-3 text-left font-bold text-slate-700">Sub Supplier</th>
                                                        <th className="px-4 py-3 text-right font-bold text-slate-700">Weight in Hand (Kg)</th>
                                                        <th className="px-4 py-3 text-right font-bold text-slate-700">Worth (USD)</th>
                                                        <th className="px-4 py-3 text-right font-bold text-slate-700 bg-yellow-50">Adjustment Weight (Kg)</th>
                                                        <th className="px-4 py-3 text-right font-bold text-slate-700 bg-yellow-50">Adjustment Worth (USD)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {filteredOriginalStockData.map(item => {
                                                        const adjustment = iaoAdjustments[item.key] || { key: item.key, adjustmentWeight: '', adjustmentWorth: '' };
                                                        
                                                        // Ensure values are always strings for controlled inputs
                                                        const adjustmentWeightValue = adjustment.adjustmentWeight !== '' && adjustment.adjustmentWeight !== null && adjustment.adjustmentWeight !== undefined 
                                                            ? String(adjustment.adjustmentWeight) 
                                                            : '';
                                                        const adjustmentWorthValue = adjustment.adjustmentWorth !== '' && adjustment.adjustmentWorth !== null && adjustment.adjustmentWorth !== undefined 
                                                            ? String(adjustment.adjustmentWorth) 
                                                            : '';
                                                        
                                                        return (
                                                            <tr key={item.key} className="hover:bg-slate-50">
                                                                <td className="px-4 py-3 font-mono text-slate-700">{item.originalTypeId}</td>
                                                                <td className="px-4 py-3 text-slate-800">
                                                                    {item.originalTypeName}
                                                                    {item.originalProductName && <span className="text-slate-500 text-xs"> - {item.originalProductName}</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-600">{item.supplierName}</td>
                                                                <td className="px-4 py-3 text-slate-500 text-xs">{item.subSupplierName || '-'}</td>
                                                                <td className="px-4 py-3 text-right font-mono text-slate-700">{(item.weightInHand || 0).toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right font-mono text-slate-700">${(item.worth || 0).toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right bg-yellow-50">
                                                                    <input 
                                                                        type="number" 
                                                                        step="0.01"
                                                                        className="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                                                        value={adjustmentWeightValue} 
                                                                        onChange={e => updateOriginalAdjustment(item.key, 'adjustmentWeight', e.target.value)}
                                                                        placeholder="0.00"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 text-right bg-yellow-50">
                                                                    <input 
                                                                        type="number" 
                                                                        step="0.01"
                                                                        className="w-24 px-2 py-1 border border-slate-300 rounded text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                                                        value={adjustmentWorthValue} 
                                                                        onChange={e => updateOriginalAdjustment(item.key, 'adjustmentWorth', e.target.value)}
                                                                        placeholder="0.00"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {filteredOriginalStockData.length === 0 && (
                                            <div className="p-8 text-center text-slate-500">
                                                No original stock found matching the filters.
                                            </div>
                                        )}
                                    </div>
                                        </>
                                    )}
                                </div>
                            );
                        })()}

                        {vType === 'RTS' && (
                            <div className="space-y-6 bg-pink-50 p-6 rounded-xl border-2 border-pink-200">
                                <h3 className="text-lg font-bold text-pink-900 flex items-center gap-2">
                                    <RotateCcw size={20} /> Return to Supplier
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Supplier</label>
                                        <EntitySelector 
                                            entities={state.partners.filter(p => p.type === PartnerType.SUPPLIER).map(p => ({ id: p.id, name: p.name }))} 
                                            selectedId={rtsSupplierId} 
                                            onSelect={setRtsSupplierId} 
                                            placeholder="Select Supplier..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Item</label>
                                        <EntitySelector 
                                            entities={state.items.map(i => ({ id: i.id, name: `${i.code} - ${i.name}` }))} 
                                            selectedId={rtsItemId} 
                                            onSelect={setRtsItemId} 
                                            placeholder="Select Item..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Quantity</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={rtsQty} 
                                            onChange={e => setRtsQty(e.target.value)} 
                                            placeholder="Enter quantity"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Reason *</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={rtsReason} 
                                            onChange={e => setRtsReason(e.target.value)} 
                                            placeholder="Reason for return (required)"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {vType === 'MJV' && (() => {
                            // Get available suppliers
                            const availableSuppliers = state.partners.filter(p => p.type === PartnerType.SUPPLIER || p.type === 'SUPPLIER');

                            // Filter Original Types based on selected Supplier (from originalStockData)
                            const filteredTypes = mjvSupplierId
                                ? originalStockData
                                    .filter(item => item.supplierId === mjvSupplierId)
                                    .map(item => ({
                                        id: item.originalTypeId,
                                        name: item.originalTypeName
                                    }))
                                    .filter((type, index, self) => 
                                        index === self.findIndex(t => t.id === type.id)
                                    )
                                : [];

                            // Filter Products based on selected Type
                            const filteredProducts = mjvTypeId
                                ? (state.originalProducts || []).filter(p => p.originalTypeId === mjvTypeId)
                                : [];

                            // Find current stock info for selected combination
                            let currentStockInfo = null;
                            if (mjvTypeId && mjvSupplierId) {
                                const key = mjvProductId 
                                    ? `${mjvSupplierId}-none-${mjvTypeId}-${mjvProductId}`
                                    : `${mjvSupplierId}-none-${mjvTypeId}`;
                                
                                currentStockInfo = originalStockData.find(item => item.key === key) || null;
                            }

                            // Calculate adjustment values
                            // Priority: If worth is provided, use it; otherwise calculate from weight
                            let adjustmentWorth = 0;
                            let adjustmentWeight = 0;
                            
                            if (mjvWorth && !isNaN(parseFloat(mjvWorth))) {
                                // Worth is explicitly provided
                                adjustmentWorth = parseFloat(mjvWorth);
                                // Calculate weight from worth if worth is provided
                                if (currentStockInfo && currentStockInfo.avgCostPerKg > 0) {
                                    adjustmentWeight = adjustmentWorth / currentStockInfo.avgCostPerKg;
                                    // Preserve sign from worth
                                    if (adjustmentWorth < 0) adjustmentWeight = -Math.abs(adjustmentWeight);
                                    else adjustmentWeight = Math.abs(adjustmentWeight);
                                }
                            } else if (mjvWeight && currentStockInfo) {
                                // Only weight is provided, calculate worth
                                const weight = parseFloat(mjvWeight);
                                if (!isNaN(weight) && weight !== 0) {
                                    adjustmentWeight = weight;
                                    adjustmentWorth = Math.abs(weight) * (currentStockInfo.avgCostPerKg || 0);
                                    // Preserve sign from weight
                                    if (weight < 0) adjustmentWorth = -adjustmentWorth;
                                }
                            }
                            
                            // For display purposes
                            const calculatedWorth = Math.abs(adjustmentWorth);
                            const calculatedWeight = Math.abs(adjustmentWeight);

                            return (
                                <div className="space-y-6 bg-green-50 p-6 rounded-xl border-2 border-green-200">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-green-900 flex items-center gap-2">
                                            <Calculator size={20} /> Manual JV Entry Helper - Original Stock Adjustment
                                        </h3>
                                    </div>
                                    
                                    <div className="bg-white rounded-lg p-4 border border-green-200">
                                        <p className="text-sm text-slate-600 mb-4">
                                            This utility helps you create the 2 JV entries for Original Stock Adjustment. 
                                            Select <strong>Supplier</strong> first, then <strong>Original Type</strong> (filtered by supplier), 
                                            then <strong>Product</strong> (optional, filtered by type), and enter the weight adjustment. 
                                            The system will automatically show current stock info and calculate the worth to generate both entries.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Supplier Selection - FIRST */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                                Supplier Name <span className="text-red-500">*</span>
                                            </label>
                                            <EntitySelector
                                                entities={availableSuppliers.map(s => ({ id: s.id, name: s.name }))}
                                                selectedId={mjvSupplierId}
                                                onSelect={(id) => {
                                                    setMjvSupplierId(id);
                                                    setMjvTypeId(''); // Reset type when supplier changes
                                                    setMjvProductId(''); // Reset product when supplier changes
                                                }}
                                                placeholder="Select Supplier..."
                                                className="w-full"
                                            />
                                            {mjvSupplierId && filteredTypes.length === 0 && (
                                                <p className="text-xs text-amber-600 mt-1">No original types found for this supplier</p>
                                            )}
                                        </div>

                                        {/* Type Selection - SECOND (depends on Supplier) */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                                Original Type <span className="text-red-500">*</span>
                                            </label>
                                            <EntitySelector
                                                entities={filteredTypes}
                                                selectedId={mjvTypeId}
                                                onSelect={(id) => {
                                                    setMjvTypeId(id);
                                                    setMjvProductId(''); // Reset product when type changes
                                                }}
                                                placeholder={mjvSupplierId ? "Select Original Type..." : "Select Supplier first"}
                                                className="w-full"
                                                disabled={!mjvSupplierId}
                                            />
                                            {mjvSupplierId && !mjvTypeId && filteredTypes.length > 0 && (
                                                <p className="text-xs text-slate-500 mt-1">{filteredTypes.length} type(s) available</p>
                                            )}
                                        </div>

                                        {/* Product Selection - THIRD (depends on Type) */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                                Product Name <span className="text-slate-400 text-xs">(Optional)</span>
                                            </label>
                                            <EntitySelector
                                                entities={filteredProducts.map(p => ({ id: p.id, name: p.name }))}
                                                selectedId={mjvProductId}
                                                onSelect={setMjvProductId}
                                                placeholder={mjvTypeId ? "Select Product (Optional)..." : "Select Original Type first"}
                                                className="w-full"
                                                disabled={!mjvTypeId}
                                            />
                                            {mjvTypeId && filteredProducts.length === 0 && (
                                                <p className="text-xs text-slate-500 mt-1">No products found for this type (you can proceed without product)</p>
                                            )}
                                        </div>

                                        {/* Weight Input */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                                Weight Adjustment (kg) <span className="text-slate-400 text-xs">(Optional if Worth is entered)</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-green-500 outline-none"
                                                value={mjvWeight}
                                                onChange={e => {
                                                    setMjvWeight(e.target.value);
                                                    // Clear worth when weight is manually entered
                                                    if (e.target.value) setMjvWorth('');
                                                }}
                                                placeholder="Enter weight (e.g., -198461 for decrease)"
                                                disabled={!!mjvWorth}
                                            />
                                            <p className="text-xs text-slate-500 mt-1">
                                                Use negative for decrease, positive for increase. Leave empty if entering Worth instead.
                                            </p>
                                        </div>

                                        {/* Worth Input */}
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                                Worth Adjustment ($) <span className="text-slate-400 text-xs">(Optional if Weight is entered)</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-green-500 outline-none"
                                                value={mjvWorth}
                                                onChange={e => {
                                                    setMjvWorth(e.target.value);
                                                    // Clear weight when worth is manually entered
                                                    if (e.target.value) setMjvWeight('');
                                                }}
                                                placeholder="Enter worth (e.g., -5558.33 for decrease)"
                                                disabled={!!mjvWeight}
                                            />
                                            <p className="text-xs text-slate-500 mt-1">
                                                Use negative for decrease, positive for increase. Leave empty if entering Weight instead.
                                            </p>
                                        </div>

                                        {/* Reason */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                                Reason <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-green-500 outline-none"
                                                value={mjvReason}
                                                onChange={e => setMjvReason(e.target.value)}
                                                placeholder="Enter reason for adjustment"
                                            />
                                        </div>
                                    </div>

                                    {/* Current Stock Info - Show when Supplier and Type are selected */}
                                    {mjvSupplierId && mjvTypeId && (
                                        <div className={`border rounded-lg p-4 ${currentStockInfo ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                                            <h4 className={`font-bold mb-2 ${currentStockInfo ? 'text-blue-900' : 'text-amber-900'}`}>
                                                {currentStockInfo ? 'Current Stock Information' : 'Stock Information'}
                                            </h4>
                                            {currentStockInfo ? (
                                                <div className="grid grid-cols-3 gap-4 text-sm">
                                                    <div>
                                                        <span className={`${currentStockInfo ? 'text-blue-600' : 'text-amber-600'} font-semibold`}>Weight in Hand:</span>
                                                        <span className="ml-2 text-slate-700 font-mono">{currentStockInfo.weightInHand.toFixed(2)} kg</span>
                                                    </div>
                                                    <div>
                                                        <span className={`${currentStockInfo ? 'text-blue-600' : 'text-amber-600'} font-semibold`}>Current Worth:</span>
                                                        <span className="ml-2 text-slate-700 font-mono">${currentStockInfo.worth.toFixed(2)}</span>
                                                    </div>
                                                    <div>
                                                        <span className={`${currentStockInfo ? 'text-blue-600' : 'text-amber-600'} font-semibold`}>Avg Cost/Kg:</span>
                                                        <span className="ml-2 text-slate-700 font-mono">${currentStockInfo.avgCostPerKg.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-amber-700">
                                                    <p>No stock found for this combination.</p>
                                                    <p className="text-xs mt-1">Please verify Supplier and Original Type selection, or check if there are any purchases for this combination.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Calculated Adjustment Preview */}
                                    {((mjvWeight && !isNaN(parseFloat(mjvWeight))) || (mjvWorth && !isNaN(parseFloat(mjvWorth)))) && calculatedWorth > 0 && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                            <h4 className="font-bold text-yellow-900 mb-2">Adjustment Summary</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="text-yellow-700 font-semibold">Weight Adjustment:</span>
                                                    <span className="ml-2 text-slate-700 font-mono">
                                                        {mjvWeight ? parseFloat(mjvWeight).toFixed(2) : calculatedWeight.toFixed(2)} kg
                                                        {mjvWorth && !mjvWeight && <span className="text-xs text-slate-500"> (calculated)</span>}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-yellow-700 font-semibold">Worth Adjustment:</span>
                                                    <span className="ml-2 text-slate-700 font-mono font-bold">
                                                        ${mjvWorth ? parseFloat(mjvWorth).toFixed(2) : calculatedWorth.toFixed(2)}
                                                        {mjvWeight && !mjvWorth && <span className="text-xs text-slate-500"> (calculated)</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Preview of Entries */}
                                    {mjvTypeId && mjvSupplierId && ((mjvWeight && !isNaN(parseFloat(mjvWeight))) || (mjvWorth && !isNaN(parseFloat(mjvWorth)))) && calculatedWorth > 0 && (
                                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
                                            <h4 className="font-bold text-slate-900 mb-3">Preview of JV Entries to be Created:</h4>
                                            <div className="space-y-3 text-sm">
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <div className="font-semibold text-slate-700 mb-1">Entry 1: Inventory - Raw Materials</div>
                                                    <div className="text-slate-600">
                                                        {(adjustmentWeight > 0 || adjustmentWorth > 0) ? 'Debit' : 'Credit'}: ${calculatedWorth.toFixed(2)}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        Narration: Original Stock {(adjustmentWeight > 0 || adjustmentWorth > 0) ? 'Increase' : 'Decrease'}: {filteredTypes.find(t => t.id === mjvTypeId)?.name || currentStockInfo?.originalTypeName || ''} {mjvProductId ? `- ${filteredProducts.find(p => p.id === mjvProductId)?.name || ''}` : ''} ({availableSuppliers.find(s => s.id === mjvSupplierId)?.name || ''}) (Weight: {calculatedWeight.toFixed(2)} kg, Worth: ${calculatedWorth.toFixed(2)}) - {mjvReason}
                                                    </div>
                                                </div>
                                                <div className="bg-white p-3 rounded border border-slate-200">
                                                    <div className="font-semibold text-slate-700 mb-1">Entry 2: Inventory Adjustment</div>
                                                    <div className="text-slate-600">
                                                        {(adjustmentWeight > 0 || adjustmentWorth > 0) ? 'Credit' : 'Debit'}: ${calculatedWorth.toFixed(2)}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        Narration: Original Stock {(adjustmentWeight > 0 || adjustmentWorth > 0) ? 'Increase' : 'Decrease'}: {filteredTypes.find(t => t.id === mjvTypeId)?.name || currentStockInfo?.originalTypeName || ''} - {mjvReason}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {vType === 'WO' && (
                            <div className="space-y-6 bg-red-50 p-6 rounded-xl border-2 border-red-200">
                                <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                                    <AlertTriangle size={20} /> Write-off
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Account to Write-off</label>
                                        <EntitySelector 
                                            entities={allAccounts} 
                                            selectedId={woAccountId} 
                                            onSelect={setWoAccountId} 
                                            placeholder="Select Account..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Amount ({currency})</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-2xl font-bold text-slate-800" 
                                            value={amount} 
                                            onChange={e => setAmount(e.target.value)} 
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Reason *</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={woReason} 
                                            onChange={e => setWoReason(e.target.value)} 
                                            placeholder="Reason for write-off (required)"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {vType === 'BD' && (
                            <div className="space-y-6 bg-teal-50 p-6 rounded-xl border-2 border-teal-200">
                                <h3 className="text-lg font-bold text-teal-900 flex items-center gap-2">
                                    <Scale size={20} /> Balancing Discrepancy
                                </h3>
                                
                                {/* CSV Upload Section */}
                                {(() => {
                                    // CSV Upload Handler for Balance Discrepancy
                                    const handleBalanceDiscrepancyCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        // Check for discrepancy account first (prefer EQUITY, fallback to LIABILITY)
                                        // IMPORTANT: Allow accounts without factoryId (backward compatibility) OR matching factoryId
                                        let discrepancyAccount = state.accounts.find(a => 
                                            (a.name.includes('Discrepancy') || 
                                             a.name.includes('Suspense') ||
                                             a.name.includes('Balancing Discrepancy') ||
                                             a.code === '505') &&
                                            a.type === AccountType.EQUITY &&
                                            (!a.factoryId || a.factoryId === state.currentFactory?.id)
                                        );
                                        
                                        if (!discrepancyAccount) {
                                            discrepancyAccount = state.accounts.find(a => 
                                                (a.name.includes('Discrepancy') || 
                                                 a.name.includes('Suspense') ||
                                                 a.name.includes('Balancing Discrepancy') ||
                                                 a.code === '505') &&
                                                a.type === AccountType.LIABILITY &&
                                                (!a.factoryId || a.factoryId === state.currentFactory?.id)
                                            );
                                        }
                                        
                                        if (!discrepancyAccount) {
                                            alert('Missing required account: Balancing Discrepancy / Suspense (505).\n\nPlease create this account in:\nSetup > Chart of Accounts\n\nRecommended:\n- Code: 505\n- Name: "Balancing Discrepancy" or "Suspense Account"\n- Type: EQUITY (preferred) or LIABILITY\n- Opening Balance: 0');
                                            e.target.value = '';
                                            return;
                                        }
                                        
                                        const isEquityAccount = discrepancyAccount.type === AccountType.EQUITY;

                                        Papa.parse(file, {
                                            header: true,
                                            skipEmptyLines: true,
                                            complete: async (results) => {
                                                const errors: string[] = [];
                                                const warnings: string[] = [];
                                                let successCount = 0;
                                                let processedCount = 0;
                                                const totalRows = results.data.length;

                                                // Process each row and create transactions
                                                for (let idx = 0; idx < results.data.length; idx++) {
                                                    const row = results.data[idx] as any;
                                                    
                                                    // Validate required columns
                                                    if (!row['Code'] || row['Code'].trim() === '') {
                                                        errors.push(`Row ${idx + 2}: Missing Code`);
                                                        continue;
                                                    }

                                                    const code = row['Code'].trim();
                                                    
                                                    // Parse Current Balance
                                                    if (row['Current Balance'] === undefined || row['Current Balance'] === '' || row['Current Balance'] === null) {
                                                        errors.push(`Row ${idx + 2}: Missing Current Balance for Code "${code}"`);
                                                        continue;
                                                    }

                                                    const csvCurrentBalance = parseFloat(String(row['Current Balance']).trim());
                                                    if (isNaN(csvCurrentBalance)) {
                                                        errors.push(`Row ${idx + 2}: Invalid Current Balance for Code "${code}"`);
                                                        continue;
                                                    }

                                                    // Find account or partner by code
                                                    const account = state.accounts.find(a => a.code === code);
                                                    const partner = state.partners.find(p => p.code === code);
                                                    
                                                    if (!account && !partner) {
                                                        errors.push(`Row ${idx + 2}: No account or partner found with Code "${code}"`);
                                                        continue;
                                                    }

                                                    const entityId = account ? account.id : partner!.id;
                                                    const entityName = account ? account.name : partner!.name;
                                                    
                                                    // Calculate current system balance
                                                    const accountEntries = state.ledger.filter((e: any) => e.accountId === entityId);
                                                    const debitSum = accountEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
                                                    const creditSum = accountEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);
                                                    
                                                    let systemBalance = 0;
                                                    
                                                    if (account) {
                                                        // Account balance calculation
                                                        if ([AccountType.ASSET, AccountType.EXPENSE].includes(account.type)) {
                                                            systemBalance = debitSum - creditSum;
                                                        } else {
                                                            systemBalance = creditSum - debitSum;
                                                        }
                                                    } else if (partner) {
                                                        // Partner balance calculation
                                                        if (partner.type === PartnerType.CUSTOMER) {
                                                            // Customers: debit increases balance (they owe us) - positive
                                                            systemBalance = debitSum - creditSum;
                                                        } else if ([PartnerType.SUPPLIER, PartnerType.SUB_SUPPLIER, PartnerType.VENDOR, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(partner.type)) {
                                                            // Suppliers/sub-suppliers/vendors/agents: credit increases liability (we owe them) - negative
                                                            systemBalance = creditSum - debitSum;
                                                        } else {
                                                            systemBalance = debitSum - creditSum;
                                                        }
                                                    }

                                                    // Calculate adjustment needed
                                                    const adjustmentNeeded = csvCurrentBalance - systemBalance;
                                                    
                                                    // Skip if no adjustment needed (within 0.01 tolerance)
                                                    if (Math.abs(adjustmentNeeded) < 0.01) {
                                                        warnings.push(`Row ${idx + 2}: Code "${code}" already at target balance (${csvCurrentBalance.toFixed(2)})`);
                                                        continue;
                                                    }

                                                    // Determine adjustment type
                                                    const isIncrease = adjustmentNeeded > 0;
                                                    const adjustmentAmount = Math.abs(adjustmentNeeded);
                                                    
                                                    // Determine if the target account is a liability account
                                                    const isLiabilityAccount = account && account.type === AccountType.LIABILITY;
                                                    // For partners, check if it's a supplier-like partner (negative balance = liability)
                                                    const isSupplierPartner = partner && [PartnerType.SUPPLIER, PartnerType.VENDOR, PartnerType.SUB_SUPPLIER, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(partner.type);
                                                    const isLiabilityEntity = isLiabilityAccount || isSupplierPartner;
                                                    
                                                    // Generate voucher number
                                                    const bdDate = new Date().toISOString().split('T')[0];
                                                    const timestamp = Date.now();
                                                    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                                                    const voucherNo = `BD-${bdDate.replace(/-/g, '')}-${timestamp}-${randomSuffix}`;
                                                    
                                                    // Create balanced entries
                                                    const entries: Omit<LedgerEntry, 'id'>[] = [];
                                                    const currency: Currency = 'USD';
                                                    const exchangeRate = 1;
                                                    const fcyAmount = adjustmentAmount;
                                                    const baseAmount = adjustmentAmount;
                                                    const reason = `CSV Bulk Adjustment: Target Balance ${csvCurrentBalance.toFixed(2)}, System Balance ${systemBalance.toFixed(2)}`;

                                                    if (isIncrease) {
                                                        // INCREASE logic:
                                                        // For ASSETS: Debit asset (increases), Credit Discrepancy
                                                        // For LIABILITIES: Credit liability (increases), Debit Discrepancy (decreases discrepancy)
                                                        // For PARTNERS (Customers): Debit partner (increases asset), Credit Discrepancy
                                                        // For PARTNERS (Suppliers): Credit partner (increases liability), Debit Discrepancy
                                                        
                                                        if (isLiabilityEntity) {
                                                            // LIABILITY: Credit liability account (increases liability), Debit Discrepancy (decreases discrepancy)
                                                            entries.push({ 
                                                                date: bdDate, 
                                                                transactionId: voucherNo, 
                                                                transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                accountId: entityId, 
                                                                accountName: entityName, 
                                                                currency, 
                                                                exchangeRate, 
                                                                fcyAmount, 
                                                                debit: 0, 
                                                                credit: baseAmount, 
                                                                narration: `Balance Increase: ${entityName} - ${reason}`, 
                                                                factoryId: state.currentFactory?.id || '' 
                                                            });
                                                            if (isEquityAccount) {
                                                                // If Discrepancy is EQUITY: Debit Discrepancy (decreases equity) to balance
                                                                entries.push({ 
                                                                    date: bdDate, 
                                                                    transactionId: voucherNo, 
                                                                    transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                    accountId: discrepancyAccount.id, 
                                                                    accountName: discrepancyAccount.name, 
                                                                    currency, 
                                                                    exchangeRate, 
                                                                    fcyAmount, 
                                                                    debit: baseAmount, 
                                                                    credit: 0, 
                                                                    narration: `Balance Increase: ${entityName} - ${reason}`, 
                                                                    factoryId: state.currentFactory?.id || '' 
                                                                });
                                                            } else {
                                                                // If Discrepancy is LIABILITY: Debit Discrepancy (decreases liability) to balance
                                                                entries.push({ 
                                                                    date: bdDate, 
                                                                    transactionId: voucherNo, 
                                                                    transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                    accountId: discrepancyAccount.id, 
                                                                    accountName: discrepancyAccount.name, 
                                                                    currency, 
                                                                    exchangeRate, 
                                                                    fcyAmount, 
                                                                    debit: baseAmount, 
                                                                    credit: 0, 
                                                                    narration: `Balance Increase: ${entityName} - ${reason}`, 
                                                                    factoryId: state.currentFactory?.id || '' 
                                                                });
                                                            }
                                                        } else {
                                                            // ASSET or CUSTOMER: Debit account/partner (increases asset), Credit Discrepancy
                                                            entries.push({ 
                                                                date: bdDate, 
                                                                transactionId: voucherNo, 
                                                                transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                accountId: entityId, 
                                                                accountName: entityName, 
                                                                currency, 
                                                                exchangeRate, 
                                                                fcyAmount, 
                                                                debit: baseAmount, 
                                                                credit: 0, 
                                                                narration: `Balance Increase: ${entityName} - ${reason}`, 
                                                                factoryId: state.currentFactory?.id || '' 
                                                            });
                                                            if (isEquityAccount) {
                                                                // If Discrepancy is EQUITY: Debit Discrepancy (decreases equity) to balance
                                                                entries.push({ 
                                                                    date: bdDate, 
                                                                    transactionId: voucherNo, 
                                                                    transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                    accountId: discrepancyAccount.id, 
                                                                    accountName: discrepancyAccount.name, 
                                                                    currency, 
                                                                    exchangeRate, 
                                                                    fcyAmount, 
                                                                    debit: baseAmount, 
                                                                    credit: 0, 
                                                                    narration: `Balance Increase: ${entityName} - ${reason}`, 
                                                                    factoryId: state.currentFactory?.id || '' 
                                                                });
                                                            } else {
                                                                // If Discrepancy is LIABILITY: Credit Discrepancy (increases liability) to balance
                                                                entries.push({ 
                                                                    date: bdDate, 
                                                                    transactionId: voucherNo, 
                                                                    transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                    accountId: discrepancyAccount.id, 
                                                                    accountName: discrepancyAccount.name, 
                                                                    currency, 
                                                                    exchangeRate, 
                                                                    fcyAmount, 
                                                                    debit: 0, 
                                                                    credit: baseAmount, 
                                                                    narration: `Balance Increase: ${entityName} - ${reason}`, 
                                                                    factoryId: state.currentFactory?.id || '' 
                                                                });
                                                            }
                                                        }
                                                    } else {
                                                        // DECREASE logic:
                                                        // For ASSETS: Credit asset (decreases), Debit Discrepancy
                                                        // For LIABILITIES: Debit liability (decreases), Credit Discrepancy (increases discrepancy)
                                                        // For PARTNERS (Customers): Credit partner (decreases asset), Debit Discrepancy
                                                        // For PARTNERS (Suppliers): Debit partner (decreases liability), Credit Discrepancy
                                                        
                                                        if (isLiabilityEntity) {
                                                            // LIABILITY: Debit liability account (decreases liability), Credit Discrepancy (increases discrepancy)
                                                            entries.push({ 
                                                                date: bdDate, 
                                                                transactionId: voucherNo, 
                                                                transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                accountId: entityId, 
                                                                accountName: entityName, 
                                                                currency, 
                                                                exchangeRate, 
                                                                fcyAmount, 
                                                                debit: baseAmount, 
                                                                credit: 0, 
                                                                narration: `Balance Decrease: ${entityName} - ${reason}`, 
                                                                factoryId: state.currentFactory?.id || '' 
                                                            });
                                                            if (isEquityAccount) {
                                                                // If Discrepancy is EQUITY: Credit Discrepancy (increases equity) to balance
                                                                entries.push({ 
                                                                    date: bdDate, 
                                                                    transactionId: voucherNo, 
                                                                    transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                    accountId: discrepancyAccount.id, 
                                                                    accountName: discrepancyAccount.name, 
                                                                    currency, 
                                                                    exchangeRate, 
                                                                    fcyAmount, 
                                                                    debit: 0, 
                                                                    credit: baseAmount, 
                                                                    narration: `Balance Decrease: ${entityName} - ${reason}`, 
                                                                    factoryId: state.currentFactory?.id || '' 
                                                                });
                                                            } else {
                                                                // If Discrepancy is LIABILITY: Credit Discrepancy (increases liability) to balance
                                                                entries.push({ 
                                                                    date: bdDate, 
                                                                    transactionId: voucherNo, 
                                                                    transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                    accountId: discrepancyAccount.id, 
                                                                    accountName: discrepancyAccount.name, 
                                                                    currency, 
                                                                    exchangeRate, 
                                                                    fcyAmount, 
                                                                    debit: 0, 
                                                                    credit: baseAmount, 
                                                                    narration: `Balance Decrease: ${entityName} - ${reason}`, 
                                                                    factoryId: state.currentFactory?.id || '' 
                                                                });
                                                            }
                                                        } else {
                                                            // ASSET or CUSTOMER: Credit account/partner (decreases asset), Debit Discrepancy
                                                            entries.push({ 
                                                                date: bdDate, 
                                                                transactionId: voucherNo, 
                                                                transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                accountId: entityId, 
                                                                accountName: entityName, 
                                                                currency, 
                                                                exchangeRate, 
                                                                fcyAmount, 
                                                                debit: 0, 
                                                                credit: baseAmount, 
                                                                narration: `Balance Decrease: ${entityName} - ${reason}`, 
                                                                factoryId: state.currentFactory?.id || '' 
                                                            });
                                                            if (isEquityAccount) {
                                                                // If Discrepancy is EQUITY: Debit Discrepancy (decreases equity) to balance
                                                                entries.push({ 
                                                                    date: bdDate, 
                                                                    transactionId: voucherNo, 
                                                                    transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                    accountId: discrepancyAccount.id, 
                                                                    accountName: discrepancyAccount.name, 
                                                                    currency, 
                                                                    exchangeRate, 
                                                                    fcyAmount, 
                                                                    debit: baseAmount, 
                                                                    credit: 0, 
                                                                    narration: `Balance Decrease: ${entityName} - ${reason}`, 
                                                                    factoryId: state.currentFactory?.id || '' 
                                                                });
                                                            } else {
                                                                // If Discrepancy is LIABILITY: Debit Discrepancy (decreases liability) to balance
                                                                entries.push({ 
                                                                    date: bdDate, 
                                                                    transactionId: voucherNo, 
                                                                    transactionType: TransactionType.BALANCING_DISCREPANCY, 
                                                                    accountId: discrepancyAccount.id, 
                                                                    accountName: discrepancyAccount.name, 
                                                                    currency, 
                                                                    exchangeRate, 
                                                                    fcyAmount, 
                                                                    debit: baseAmount, 
                                                                    credit: 0, 
                                                                    narration: `Balance Decrease: ${entityName} - ${reason}`, 
                                                                    factoryId: state.currentFactory?.id || '' 
                                                                });
                                                            }
                                                        }
                                                    }

                                                    // Post transaction
                                                    try {
                                                        await postTransaction(entries);
                                                        successCount++;
                                                        processedCount++;
                                                        
                                                        // Show progress for large files
                                                        if (totalRows > 10 && processedCount % 10 === 0) {
                                                            console.log(`Processed ${processedCount}/${totalRows} rows...`);
                                                        }
                                                    } catch (error: any) {
                                                        errors.push(`Row ${idx + 2}: Failed to post adjustment for Code "${code}": ${error.message || 'Unknown error'}`);
                                                    }
                                                }

                                                // Show results
                                                let message = '';
                                                if (successCount > 0) {
                                                    message += `✅ Successfully processed: ${successCount} account(s)\n`;
                                                }
                                                if (warnings.length > 0) {
                                                    message += `\n⚠️ Warnings: ${warnings.length}\n${warnings.slice(0, 5).join('\n')}${warnings.length > 5 ? `\n... and ${warnings.length - 5} more` : ''}\n`;
                                                }
                                                if (errors.length > 0) {
                                                    message += `\n❌ Errors: ${errors.length}\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}`;
                                                }

                                                if (errors.length > 0 || warnings.length > 0) {
                                                    alert(`CSV Upload Complete:\n\n${message}`);
                                                } else {
                                                    alert(`✅ CSV Upload Complete!\n\nSuccessfully processed ${successCount} account(s).\nAll balance adjustments have been posted to the ledger.`);
                                                }

                                                // Reset file input
                                                e.target.value = '';
                                            },
                                            error: (error) => {
                                                alert(`❌ Error parsing CSV: ${error.message}`);
                                                e.target.value = '';
                                            }
                                        });
                                    };

                                    // Download CSV Template for Balance Discrepancy
                                    const downloadBalanceDiscrepancyTemplate = () => {
                                        // Get sample accounts and partners
                                        const sampleAccounts = state.accounts.slice(0, 5).map(acc => {
                                            const accountEntries = state.ledger.filter((e: any) => e.accountId === acc.id);
                                            const debitSum = accountEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
                                            const creditSum = accountEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);
                                            let balance = 0;
                                            if ([AccountType.ASSET, AccountType.EXPENSE].includes(acc.type)) {
                                                balance = debitSum - creditSum;
                                            } else {
                                                balance = creditSum - debitSum;
                                            }
                                            return [acc.code || '', balance.toFixed(2)];
                                        });
                                        
                                        const samplePartners = state.partners.slice(0, 3).map(partner => {
                                            const accountEntries = state.ledger.filter((e: any) => e.accountId === partner.id);
                                            const debitSum = accountEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
                                            const creditSum = accountEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);
                                            let balance = 0;
                                            if (partner.type === PartnerType.CUSTOMER) {
                                                balance = debitSum - creditSum;
                                            } else if ([PartnerType.SUPPLIER, PartnerType.VENDOR, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(partner.type)) {
                                                balance = creditSum - debitSum;
                                            } else {
                                                balance = debitSum - creditSum;
                                            }
                                            return [partner.code || '', balance.toFixed(2)];
                                        });

                                        const template = [
                                            ['Code', 'Current Balance'],
                                            ...sampleAccounts,
                                            ...samplePartners
                                        ];

                                        const csvContent = template.map(row => row.join(',')).join('\n');
                                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                        const link = document.createElement('a');
                                        const url = URL.createObjectURL(blob);
                                        link.setAttribute('href', url);
                                        link.setAttribute('download', 'Balance_Discrepancy_Template.csv');
                                        link.style.visibility = 'hidden';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    };

                                    return (
                                        <div className="bg-white border-2 border-teal-300 rounded-lg p-4 shadow-sm">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                                    <Upload size={18} className="text-teal-600" /> Upload CSV for Bulk Balance Adjustment
                                                </h4>
                                                <button
                                                    onClick={downloadBalanceDiscrepancyTemplate}
                                                    className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1"
                                                >
                                                    <FileText size={14} /> Download Template
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs text-slate-600">
                                                    Upload a CSV file with columns: <strong>Code</strong>, <strong>Current Balance</strong>
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    The system will calculate adjustments by comparing CSV "Current Balance" with system balance and create proper debit/credit entries to balance the Balance Sheet. Each row will be posted as a separate transaction.
                                                </p>
                                                <input
                                                    type="file"
                                                    accept=".csv"
                                                    onChange={handleBalanceDiscrepancyCSVUpload}
                                                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                                
                                {/* Account/Partner Balance Display */}
                                {(() => {
                                    if (!bdAccountId) return null;
                                    
                                    // Check if it's an account or a partner
                                    const selectedAccount = state.accounts.find((a: any) => a.id === bdAccountId);
                                    const selectedPartner = state.partners.find((p: any) => p.id === bdAccountId);
                                    
                                    if (!selectedAccount && !selectedPartner) return null;
                                    
                                    // Calculate balance from ledger entries
                                    const accountEntries = state.ledger.filter((e: any) => e.accountId === bdAccountId);
                                    const debitSum = accountEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
                                    const creditSum = accountEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);
                                    
                                    let accountBalance = 0;
                                    let entityName = '';
                                    
                                    if (selectedAccount) {
                                        // Account balance calculation
                                        if ([AccountType.ASSET, AccountType.EXPENSE].includes(selectedAccount.type)) {
                                            accountBalance = debitSum - creditSum;
                                        } else {
                                            accountBalance = creditSum - debitSum;
                                        }
                                        entityName = selectedAccount.name;
                                    } else if (selectedPartner) {
                                        // Partner balance calculation
                                        if (selectedPartner.type === PartnerType.CUSTOMER) {
                                            // Customers: debit increases balance (they owe us) - positive
                                            accountBalance = debitSum - creditSum;
                                        } else if ([PartnerType.SUPPLIER, PartnerType.VENDOR, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(selectedPartner.type)) {
                                            // Suppliers/agents: credit increases liability (we owe them) - negative
                                            accountBalance = creditSum - debitSum;
                                        } else {
                                            accountBalance = debitSum - creditSum;
                                        }
                                        entityName = selectedPartner.name;
                                    }
                                    
                                    return (
                                        <div className="bg-white p-4 rounded-lg border border-teal-200">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="text-xs text-slate-500 mb-1">
                                                        {selectedAccount ? 'Selected Account' : 'Selected Partner'}
                                                    </div>
                                                    <div className="font-bold text-slate-800">{entityName}</div>
                                                    {selectedPartner && (
                                                        <div className="text-xs text-slate-500 mt-1">({selectedPartner.type})</div>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-500 mb-1">Current Balance</div>
                                                    <div className={`text-2xl font-bold font-mono ${accountBalance >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                                                        ${accountBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setAmount(Math.abs(accountBalance).toFixed(2))}
                                                className="mt-2 text-xs text-teal-600 hover:text-teal-800 font-medium underline"
                                            >
                                                Use Current Balance as Adjustment Amount
                                            </button>
                                        </div>
                                    );
                                })()}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Account *</label>
                                        <EntitySelector 
                                            entities={allAccounts} 
                                            selectedId={bdAccountId} 
                                            onSelect={setBdAccountId} 
                                            placeholder="Select Account..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Adjustment Type</label>
                                        <select 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={bdAdjustmentType} 
                                            onChange={e => setBdAdjustmentType(e.target.value as 'INCREASE' | 'DECREASE')}
                                        >
                                            <option value="INCREASE">Increase Balance</option>
                                            <option value="DECREASE">Decrease Balance</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Adjustment Amount ({currency}) *</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-2xl font-bold text-slate-800" 
                                            value={amount} 
                                            onChange={e => setAmount(e.target.value)} 
                                            placeholder="0.00"
                                        />
                                        <div className="text-xs text-slate-500 mt-1">Enter the amount to adjust (not the target balance)</div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Reason *</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={bdReason} 
                                            onChange={e => setBdReason(e.target.value)} 
                                            placeholder="Reason for discrepancy (required)"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="border-t border-slate-100 pt-6 flex justify-end">
                            <button 
                                onClick={handleSave}
                                disabled={isProcessing}
                                className={`${isProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2 disabled:opacity-70`}
                            >
                                {isProcessing ? (
                                    <>
                                        <RefreshCw size={20} className="animate-spin" /> Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={20} /> Post {vType} Voucher
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LEDGER TAB */}
            {activeTab === 'ledger' && (
                <div className="space-y-4 animate-in fade-in">
                    {/* Advanced Filter Bar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
                        <div className="flex items-center gap-2 text-slate-500 mb-1"><Filter size={16} /><span className="text-xs font-bold uppercase">Filters</span></div>
                        <div>
                            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">From Date</label>
                            <input type="date" className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-sm" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">To Date</label>
                            <input type="date" className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-sm" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Type</label>
                            <select
                                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-sm w-40"
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                            >
                                <option value="">All Types</option>
                                <option value={TransactionType.SALES_INVOICE}>Sales Invoice (SI)</option>
                                <option value={TransactionType.RECEIPT_VOUCHER}>Receipt (RV)</option>
                                <option value={TransactionType.PAYMENT_VOUCHER}>Payment (PV)</option>
                                <option value={TransactionType.EXPENSE_VOUCHER}>Expense (EV)</option>
                                <option value={TransactionType.PURCHASE_BILL}>Purchase Bill (PB)</option>
                                <option value={TransactionType.JOURNAL_VOUCHER}>Journal (JV)</option>
                                <option value={TransactionType.INTERNAL_TRANSFER}>Transfer (TR)</option>
                            </select>
                        </div>
                        <div className="w-48">
                            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Account</label>
                            <EntitySelector
                                entities={allAccounts}
                                selectedId={filterAccountId}
                                onSelect={(id) => setFilterAccountId(id || '')}
                                placeholder="All Accounts"
                            />
                        </div>
                        <div className="w-48">
                            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Voucher</label>
                            <EntitySelector
                                entities={uniqueVouchers}
                                selectedId={filterVoucherId}
                                onSelect={(id) => setFilterVoucherId(id || '')}
                                placeholder="All Vouchers"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Min Amount</label>
                            <input type="number" placeholder="Min" className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-sm w-24" value={filterMinAmount} onChange={e => setFilterMinAmount(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Max Amount</label>
                            <input type="number" placeholder="Max" className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-sm w-24" value={filterMaxAmount} onChange={e => setFilterMaxAmount(e.target.value)} />
                        </div>
                        <div className="flex-1 text-right">
                            <span className="text-xs text-slate-400">
                                Showing {Math.min(filteredLedger.length, ledgerVisibleCount)} of {filteredLedger.length} records
                            </span>
                        </div>
                    </div>

                    {/* Delete Voucher Section */}
                    <div className="bg-white p-4 rounded-xl border-2 border-red-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <Trash2 className="text-red-600" size={20} />
                            <h4 className="font-bold text-slate-800">Delete Voucher</h4>
                        </div>
                        <div className="flex gap-3 items-end">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Voucher to Delete</label>
                                <EntitySelector
                                    entities={uniqueVouchers}
                                    selectedId={voucherToDelete}
                                    onSelect={(voucherId) => setVoucherToDelete(voucherId || '')}
                                    placeholder="Select voucher to delete..."
                                />
                            </div>
                            <button
                                onClick={async () => {
                                    if (!voucherToDelete) {
                                        alert('Please select a voucher to delete.');
                                        return;
                                    }

                                    const pin = prompt(`Enter Supervisor PIN to delete voucher "${voucherToDelete}":`);
                                    if (pin !== SUPERVISOR_PIN) {
                                        alert('Invalid PIN. Operation cancelled.');
                                        return;
                                    }

                                    const confirmText = prompt(
                                        `⚠️ WARNING: This will delete ALL ledger entries for voucher "${voucherToDelete}".\n\n` +
                                        `This action cannot be undone.\n\n` +
                                        `Type "DELETE ${voucherToDelete}" to confirm:`
                                    );

                                    if (confirmText !== `DELETE ${voucherToDelete}`) {
                                        alert('Confirmation text does not match. Operation cancelled.');
                                        return;
                                    }

                                    try {
                                        // Use deleteTransaction which handles archiving and deletion
                                        await deleteTransaction(voucherToDelete, 'Manual deletion via General Ledger', 'Admin');
                                        setVoucherToDelete(''); // Clear selection
                                        alert(`✅ Successfully deleted all ledger entries for voucher "${voucherToDelete}".\n\nPlease refresh the page (F5) to see updated data.`);
                                    } catch (error: any) {
                                        console.error(`❌ Error deleting voucher ${voucherToDelete}:`, error);
                                        alert(`❌ Error deleting voucher: ${error.message || 'Unknown error'}`);
                                    }
                                }}
                                disabled={!voucherToDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Trash2 size={16} /> Delete Voucher
                            </button>
                        </div>
                        <p className="text-xs text-red-600 mt-2">
                            ⚠️ This will delete ALL ledger entries for the selected voucher. Requires Supervisor PIN.
                        </p>
                    </div>

                    {/* Delete All SET-TO-ZERO Adjustments - Hidden (no longer in use) */}

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm min-w-full">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-xs">
                                <tr>
                                        <th 
                                            className="px-4 py-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => {
                                                if (ledgerSortColumn === 'date') {
                                                    setLedgerSortDirection(ledgerSortDirection === 'asc' ? 'desc' : 'asc');
                                                } else {
                                                    setLedgerSortColumn('date');
                                                    setLedgerSortDirection('desc');
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-1">
                                                Date
                                                {ledgerSortColumn === 'date' && (
                                                    ledgerSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="px-4 py-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => {
                                                if (ledgerSortColumn === 'voucher') {
                                                    setLedgerSortDirection(ledgerSortDirection === 'asc' ? 'desc' : 'asc');
                                                } else {
                                                    setLedgerSortColumn('voucher');
                                                    setLedgerSortDirection('asc');
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-1">
                                                Voucher
                                                {ledgerSortColumn === 'voucher' && (
                                                    ledgerSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="px-4 py-4 whitespace-nowrap min-w-[200px] cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => {
                                                if (ledgerSortColumn === 'account') {
                                                    setLedgerSortDirection(ledgerSortDirection === 'asc' ? 'desc' : 'asc');
                                                } else {
                                                    setLedgerSortColumn('account');
                                                    setLedgerSortDirection('asc');
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-1">
                                                Account
                                                {ledgerSortColumn === 'account' && (
                                                    ledgerSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-4 py-4 whitespace-nowrap">Account ID</th>
                                        <th 
                                            className="px-4 py-4 text-right bg-blue-50/50 whitespace-nowrap cursor-pointer hover:bg-blue-100 select-none"
                                            onClick={() => {
                                                if (ledgerSortColumn === 'amount') {
                                                    setLedgerSortDirection(ledgerSortDirection === 'asc' ? 'desc' : 'asc');
                                                } else {
                                                    setLedgerSortColumn('amount');
                                                    setLedgerSortDirection('desc');
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                Amount (FCY)
                                                {ledgerSortColumn === 'amount' && (
                                                    ledgerSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-4 py-4 text-center whitespace-nowrap">Rate</th>
                                        <th 
                                            className="px-4 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => {
                                                if (ledgerSortColumn === 'debit') {
                                                    setLedgerSortDirection(ledgerSortDirection === 'asc' ? 'desc' : 'asc');
                                                } else {
                                                    setLedgerSortColumn('debit');
                                                    setLedgerSortDirection('desc');
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                Debit ($)
                                                {ledgerSortColumn === 'debit' && (
                                                    ledgerSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="px-4 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => {
                                                if (ledgerSortColumn === 'credit') {
                                                    setLedgerSortDirection(ledgerSortDirection === 'asc' ? 'desc' : 'asc');
                                                } else {
                                                    setLedgerSortColumn('credit');
                                                    setLedgerSortDirection('desc');
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                Credit ($)
                                                {ledgerSortColumn === 'credit' && (
                                                    ledgerSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="px-4 py-4 min-w-[300px] cursor-pointer hover:bg-slate-100 select-none"
                                            onClick={() => {
                                                if (ledgerSortColumn === 'narration') {
                                                    setLedgerSortDirection(ledgerSortDirection === 'asc' ? 'desc' : 'asc');
                                                } else {
                                                    setLedgerSortColumn('narration');
                                                    setLedgerSortDirection('asc');
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-1">
                                                Narration
                                                {ledgerSortColumn === 'narration' && (
                                                    ledgerSortDirection === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-4 py-4 text-center whitespace-nowrap">Manage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-700">
                                    {visibleLedger.map((entry) => {
                                        // Fast O(1) lookup instead of O(n) find/some
                                        const partner = partnerIndex[entry.accountId];
                                        const isPartner = !!partner;
                                        
                                        return (
                                    <tr key={entry.id} className="hover:bg-slate-50 group">
                                            <td className="px-4 py-4 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                                            <td className="px-4 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                                            <div className="font-bold text-slate-700">{entry.transactionId}</div>
                                            <div className="text-[10px] bg-slate-100 inline-block px-1 rounded">{entry.transactionType}</div>
                                        </td>
                                            <td className="px-4 py-4 font-medium">{entry.accountName}</td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {isPartner && partner ? (
                                                    <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200" title={`Partner ID: ${entry.accountId} | ${partner.name} (${partner.type})`}>
                                                        {partner.code || entry.accountId}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono bg-blue-50/30 whitespace-nowrap">
                                            {entry.fcyAmount ? (
                                                <span>{CURRENCY_SYMBOLS[entry.currency] || entry.currency} {entry.fcyAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            ) : '-'}
                                        </td>
                                            <td className="px-4 py-4 text-center text-xs text-slate-500 whitespace-nowrap">{entry.exchangeRate !== 1 ? entry.exchangeRate.toFixed(4) : '-'}</td>
                                            <td className="px-4 py-4 text-right font-mono whitespace-nowrap">{entry.debit > 0 ? entry.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                                            <td className="px-4 py-4 text-right font-mono whitespace-nowrap">{entry.credit > 0 ? entry.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                                            <td className="px-4 py-4 text-slate-500">{entry.narration}</td>
                                            <td className="px-4 py-4 text-center whitespace-nowrap">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => initiateAction('EDIT', entry.transactionId)} className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Voucher"><Edit2 size={16} /></button>
                                                <button onClick={() => initiateAction('DELETE', entry.transactionId)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete Entire Voucher"><Trash2 size={16} /></button>
                                                <button 
                                                    onClick={async () => {
                                                        if (!window.confirm(`⚠️ Delete this individual ledger entry?\n\nAccount: ${entry.accountName}\nAmount: $${(entry.debit || entry.credit || 0).toFixed(2)}\nNarration: ${entry.narration}\n\nThis will NOT affect other entries in the voucher.`)) {
                                                            return;
                                                        }
                                                        const pin = prompt('Enter Supervisor PIN to delete this entry:');
                                                        if (pin !== SUPERVISOR_PIN) {
                                                            alert('❌ Invalid PIN! Deletion cancelled.');
                                                            return;
                                                        }
                                                        try {
                                                            console.log(`🗑️ Deleting entry: ${entry.id}`, entry);
                                                            await deleteLedgerEntry(entry.id, 'Individual entry deletion', pin);
                                                            // Force a small delay to allow state to update
                                                            await new Promise(resolve => setTimeout(resolve, 1000));
                                                            alert('✅ Entry deleted successfully!\n\n⚠️ IMPORTANT: Please refresh the page (F5) to see updated Balance Sheet.\n\nAfter refresh, check:\n1. Balance Sheet discrepancy should be reduced\n2. If still unbalanced, check browser console (F12) for Balance Sheet calculation logs');
                                                        } catch (error: any) {
                                                            alert(`❌ Error deleting entry: ${error.message || 'Unknown error'}`);
                                                        }
                                                    }}
                                                    className="p-1 text-orange-500 hover:bg-orange-50 rounded transition-colors" 
                                                    title="Delete This Entry Only (Safer - Won't affect Opening Balances)"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                        </div>
                    </div>
                    
                    {/* Pagination / Load more */}
                    {filteredLedger.length > visibleLedger.length && (
                        <div className="flex justify-center">
                            <button
                                onClick={() => setLedgerVisibleCount(prev => Math.min(prev + 200, filteredLedger.length))}
                                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                            >
                                Load 200 more ({visibleLedger.length} / {filteredLedger.length})
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Auth Modal */}
            {authModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-sm animate-in zoom-in-95">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <ShieldAlert className="text-red-600" /> Supervisor Access
                            </h3>
                            <button onClick={() => setAuthModalOpen(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                            This action ({pendingAction?.type}) requires authorization. Please enter the Supervisor PIN.
                        </p>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">PIN Code</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input 
                                    type="password" 
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-red-500 outline-none" 
                                    value={authPin}
                                    onChange={e => setAuthPin(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <button 
                            onClick={confirmAuthAction}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg"
                        >
                            Verify & Proceed
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'balance-alignment' && (
                <BalanceAlignmentComponent state={state} alignBalance={alignBalance} />
            )}

            {activeTab === 'stock-alignment' && (
                <StockAlignmentComponent 
                    state={state} 
                    alignFinishedGoodsStock={alignFinishedGoodsStock}
                    alignOriginalStock={alignOriginalStock}
                />
            )}
        </div>
    );
};

// Balance Alignment Component
const BalanceAlignmentComponent: React.FC<{ 
    state: any; 
    alignBalance: (entityId: string, entityType: 'partner' | 'account', targetBalance: number) => Promise<{ success: boolean; message: string; adjustmentAmount?: number; transactionId?: string }> 
}> = ({ state, alignBalance }) => {
    const [fixNaNTab, setFixNaNTab] = useState<'fix' | 'align'>('align');
    const [entityType, setEntityType] = useState<'partner' | 'account'>('partner');
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [targetBalance, setTargetBalance] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; adjustmentAmount?: number; transactionId?: string } | null>(null);

    // Calculate current balance
    const currentBalanceInfo = useMemo(() => {
        if (!selectedEntityId) return null;

        let entity: any;
        let accountId: string;

        if (entityType === 'partner') {
            entity = state.partners.find((p: any) => p.id === selectedEntityId);
            if (!entity) return null;
            accountId = selectedEntityId;
        } else {
            entity = state.accounts.find((a: any) => a.id === selectedEntityId);
            if (!entity) return null;
            accountId = selectedEntityId;
        }

        // Get all ledger entries for this account (excluding adjustments)
        const relevantEntries = state.ledger.filter((e: any) => 
            e.accountId === accountId && !e.isAdjustment
        );

        const totalDebits = relevantEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
        const totalCredits = relevantEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);

        let currentBalance = 0;
        if (entityType === 'partner') {
            if (entity.type === PartnerType.CUSTOMER) {
                currentBalance = totalDebits - totalCredits;
            } else if ([PartnerType.SUPPLIER, PartnerType.SUB_SUPPLIER, PartnerType.VENDOR, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(entity.type)) {
                currentBalance = totalCredits - totalDebits;
            } else {
                currentBalance = totalDebits - totalCredits;
            }
        } else {
            if ([AccountType.ASSET, AccountType.EXPENSE].includes(entity.type)) {
                currentBalance = totalDebits - totalCredits;
            } else {
                currentBalance = totalCredits - totalDebits;
            }
        }

        // Find earliest transaction
        const earliestEntry = relevantEntries.length > 0
            ? relevantEntries.reduce((earliest: any, e: any) => 
                e.date < earliest.date ? e : earliest
              )
            : null;

        const adjustmentDate = earliestEntry
            ? (() => {
                const date = new Date(earliestEntry.date);
                date.setDate(date.getDate() - 1);
                return date.toISOString().split('T')[0];
            })()
            : `${new Date().getFullYear()}-01-01`;

        return {
            entity,
            currentBalance,
            totalDebits,
            totalCredits,
            transactionCount: relevantEntries.length,
            adjustmentDate
        };
    }, [selectedEntityId, entityType, state.ledger, state.partners, state.accounts]);

    const handleAlign = async () => {
        if (!selectedEntityId || !targetBalance) {
            alert('Please select an entity and enter target balance');
            return;
        }

        const target = parseFloat(targetBalance);
        if (isNaN(target)) {
            alert('Please enter a valid target balance');
            return;
        }

        setIsProcessing(true);
        setResult(null);

        try {
            const result = await alignBalance(selectedEntityId, entityType, target);
            setResult(result);
            if (result.success) {
                setTargetBalance(''); // Clear target after success
            }
        } catch (error) {
            setResult({ success: false, message: `Error: ${(error as Error).message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    const availablePartners = state.partners.filter((p: any) => 
        [PartnerType.CUSTOMER, PartnerType.SUPPLIER, PartnerType.VENDOR, 
         PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(p.type)
    );

    const adjustmentAmount = currentBalanceInfo && targetBalance
        ? parseFloat(targetBalance) - currentBalanceInfo.currentBalance
        : null;

    // Fix NaN balances utility
    const [fixNaNEntities, setFixNaNEntities] = useState<Array<{ id: string; name: string; type: 'partner' | 'account'; currentBalance: number | null }>>([]);
    const [isScanningNaN, setIsScanningNaN] = useState(false);
    const [isFixingNaN, setIsFixingNaN] = useState(false);

    const scanForNaNBalances = useCallback(() => {
        setIsScanningNaN(true);
        const entitiesWithNaN: Array<{ id: string; name: string; type: 'partner' | 'account'; currentBalance: number | null | undefined }> = [];

        try {
            // Check partners
            state.partners.forEach((partner: any) => {
                const balance = partner.balance;
                // Check for undefined, null, NaN, or string "NaN"
                const isInvalid = balance === undefined || 
                                  balance === null || 
                                  (typeof balance === 'number' && isNaN(balance)) ||
                                  (typeof balance === 'string' && balance.toLowerCase() === 'nan');
                
                if (isInvalid) {
                    entitiesWithNaN.push({
                        id: partner.id,
                        name: partner.name || 'Unnamed Partner',
                        type: 'partner',
                        currentBalance: balance
                    });
                }
            });

            // Check accounts
            state.accounts.forEach((account: any) => {
                const balance = account.balance;
                // Check for undefined, null, NaN, or string "NaN"
                const isInvalid = balance === undefined || 
                                  balance === null || 
                                  (typeof balance === 'number' && isNaN(balance)) ||
                                  (typeof balance === 'string' && balance.toLowerCase() === 'nan');
                
                if (isInvalid) {
                    entitiesWithNaN.push({
                        id: account.id,
                        name: account.name || 'Unnamed Account',
                        type: 'account',
                        currentBalance: balance
                    });
                }
            });

            console.log(`🔍 Scan complete: Found ${entitiesWithNaN.length} entities with invalid balances:`, entitiesWithNaN);
            setFixNaNEntities(entitiesWithNaN);
            
            // Show user feedback
            if (entitiesWithNaN.length === 0) {
                alert('✅ Scan Complete!\n\nNo entities with invalid balances (NaN, undefined, or null) were found.\n\nAll partners and accounts have valid balance values.');
            } else {
                alert(`⚠️ Scan Complete!\n\nFound ${entitiesWithNaN.length} entity/entities with invalid balances:\n\n${entitiesWithNaN.map(e => `• ${e.name} (${e.type})`).join('\n')}\n\nReview the list below and click "Fix" to correct them.`);
            }
        } catch (error) {
            console.error('❌ Error scanning for NaN balances:', error);
            alert(`❌ Error scanning for NaN balances:\n\n${error}\n\nPlease check the console (F12) for more details.`);
        } finally {
            setIsScanningNaN(false);
        }
    }, [state.partners, state.accounts]);

    const fixNaNBalances = async () => {
        if (fixNaNEntities.length === 0) {
            alert('No NaN balances found. Please scan first.');
            return;
        }

        if (!confirm(`Fix ${fixNaNEntities.length} entity/entities with NaN balances? This will set their balance to 0 in Firestore.`)) {
            return;
        }

        setIsFixingNaN(true);
        let fixed = 0;
        let errors = 0;

        try {
            for (const entity of fixNaNEntities) {
                try {
                    const collectionName = entity.type === 'partner' ? 'partners' : 'accounts';
                    const entityRef = doc(db, collectionName, entity.id);
                    await updateDoc(entityRef, {
                        balance: 0,
                        updatedAt: serverTimestamp()
                    });
                    console.log(`✅ Fixed ${entity.name} (${entity.type}): balance set to 0`);
                    fixed++;
                } catch (error: any) {
                    console.error(`❌ Error fixing ${entity.name}:`, error);
                    errors++;
                }
            }

            alert(`Fixed ${fixed} entity/entities. ${errors > 0 ? `${errors} error(s) occurred. Please check console for details.` : ''}`);
            setFixNaNEntities([]);
        } catch (error: any) {
            console.error('❌ Error fixing NaN balances:', error);
            alert(`Error fixing NaN balances: ${error?.message || error}`);
        } finally {
            setIsFixingNaN(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-blue-50">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-600 text-white rounded-lg">
                        <Scale size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Balance Alignment & NaN Fix Utility</h2>
                        <p className="text-sm text-slate-500">Fix NaN balances or adjust account balances to target values</p>
                    </div>
                </div>
            </div>

            {/* Tab Selection */}
            <div className="border-b border-slate-200">
                <div className="flex gap-2 px-6 pt-4">
                    <button
                        onClick={() => setFixNaNTab('align')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            fixNaNTab === 'align'
                                ? 'border-b-2 border-purple-600 text-purple-600'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Align Balance
                    </button>
                    <button
                        onClick={() => {
                            setFixNaNTab('fix');
                            scanForNaNBalances();
                        }}
                        className={`px-4 py-2 font-medium transition-colors ${
                            fixNaNTab === 'fix'
                                ? 'border-b-2 border-red-600 text-red-600'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Fix NaN Balances
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {fixNaNTab === 'fix' ? (
                    <div className="space-y-4">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h3 className="font-bold text-yellow-800 mb-2">Fix NaN Balances</h3>
                            <p className="text-sm text-yellow-700">
                                This utility scans for partners and accounts with NaN, undefined, or null balances and fixes them by setting the balance to 0 in Firestore.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    console.log('🔍 Scan button clicked');
                                    scanForNaNBalances();
                                }}
                                disabled={isScanningNaN}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isScanningNaN ? 'Scanning...' : 'Scan for NaN Balances'}
                            </button>
                            {fixNaNEntities.length > 0 && (
                                <button
                                    onClick={fixNaNBalances}
                                    disabled={isFixingNaN}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {isFixingNaN ? 'Fixing...' : `Fix ${fixNaNEntities.length} Entity/Entities`}
                                </button>
                            )}
                        </div>

                        {fixNaNEntities.length > 0 && (
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Type</th>
                                            <th className="px-4 py-2 text-left">Name</th>
                                            <th className="px-4 py-2 text-left">Current Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {fixNaNEntities.map(entity => (
                                            <tr key={`${entity.type}-${entity.id}`}>
                                                <td className="px-4 py-2">
                                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">{entity.type}</span>
                                                </td>
                                                <td className="px-4 py-2 font-medium">{entity.name}</td>
                                                <td className="px-4 py-2 text-red-600 font-mono">
                                                    {entity.currentBalance === null ? 'null' : entity.currentBalance === undefined ? 'undefined' : 'NaN'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {fixNaNEntities.length === 0 && !isScanningNaN && (
                            <div className="text-center py-8">
                                <div className="inline-flex items-center gap-2 text-slate-500">
                                    <RefreshCw size={20} className="text-slate-400" />
                                    <span>Click "Scan for NaN Balances" to find entities with invalid balances</span>
                                </div>
                            </div>
                        )}
                        
                        {fixNaNEntities.length === 0 && isScanningNaN && (
                            <div className="text-center py-8">
                                <div className="inline-flex items-center gap-2 text-blue-600">
                                    <RefreshCw size={20} className="animate-spin" />
                                    <span className="font-medium">Scanning partners and accounts...</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                {/* Entity Type Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Entity Type</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setEntityType('partner');
                                setSelectedEntityId('');
                                setTargetBalance('');
                                setResult(null);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                entityType === 'partner'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            Partner (Customer/Supplier/Vendor)
                        </button>
                        <button
                            onClick={() => {
                                setEntityType('account');
                                setSelectedEntityId('');
                                setTargetBalance('');
                                setResult(null);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                entityType === 'account'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            Account
                        </button>
                    </div>
                </div>

                {/* Entity Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Select {entityType === 'partner' ? 'Partner' : 'Account'}
                    </label>
                    {entityType === 'partner' ? (
                        <EntitySelector
                            entities={availablePartners}
                            selectedId={selectedEntityId}
                            onSelect={setSelectedEntityId}
                            placeholder="Select Partner..."
                            className="w-full"
                        />
                    ) : (
                        <EntitySelector
                            entities={state.accounts}
                            selectedId={selectedEntityId}
                            onSelect={setSelectedEntityId}
                            placeholder="Select Account..."
                            className="w-full"
                        />
                    )}
                </div>

                {/* Current Balance Display */}
                {currentBalanceInfo && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">Current Balance Analysis</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <div className="text-xs text-slate-500 mb-1">Sum of Debits</div>
                                <div className="font-mono font-bold text-slate-800">${currentBalanceInfo.totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 mb-1">Sum of Credits</div>
                                <div className="font-mono font-bold text-slate-800">${currentBalanceInfo.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 mb-1">Current Balance</div>
                                <div className={`font-mono font-bold text-lg ${currentBalanceInfo.currentBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                    ${currentBalanceInfo.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 mb-1">Transactions</div>
                                <div className="font-mono font-bold text-slate-800">{currentBalanceInfo.transactionCount}</div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="text-xs text-slate-500">Adjustment will be dated: <span className="font-mono font-semibold text-slate-700">{currentBalanceInfo.adjustmentDate}</span></div>
                        </div>
                    </div>
                )}

                {/* Target Balance Input */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Target Balance (USD)</label>
                    <input
                        type="number"
                        step="0.01"
                        value={targetBalance}
                        onChange={(e) => setTargetBalance(e.target.value)}
                        placeholder="Enter target balance..."
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono"
                    />
                </div>

                {/* Adjustment Preview */}
                {adjustmentAmount !== null && Math.abs(adjustmentAmount) >= 0.01 && (
                    <div className={`p-4 rounded-lg border-2 ${adjustmentAmount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                        <h3 className="text-sm font-bold text-slate-700 mb-2">Adjustment Preview</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Current Balance:</span>
                                <span className="font-mono font-bold">${currentBalanceInfo?.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Target Balance:</span>
                                <span className="font-mono font-bold">${parseFloat(targetBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-300">
                                <span className="font-semibold text-slate-700">Required Adjustment:</span>
                                <span className={`font-mono font-bold text-lg ${adjustmentAmount > 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                    {adjustmentAmount > 0 ? '+' : ''}${adjustmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Result Message */}
                {result && (
                    <div className={`p-4 rounded-lg border-2 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                            {result.success ? '✓ Success' : '✗ Error'}
                        </div>
                        <div className="text-sm mt-1 text-slate-700">{result.message}</div>
                        {result.transactionId && (
                            <div className="text-xs mt-2 font-mono text-slate-600">Transaction ID: {result.transactionId}</div>
                        )}
                    </div>
                )}

                {/* Action Button */}
                <button
                    onClick={handleAlign}
                    disabled={!selectedEntityId || !targetBalance || isProcessing || (adjustmentAmount !== null && Math.abs(adjustmentAmount) < 0.01)}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <RefreshCw size={18} className="animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Scale size={18} />
                            Post Balance Adjustment
                        </>
                    )}
                </button>

                {/* Info Box */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
                        <div className="text-xs text-amber-800">
                            <div className="font-semibold mb-1">How it works:</div>
                            <ul className="list-disc list-inside space-y-1 text-amber-700">
                                <li>Calculates current balance from all ledger entries (excluding previous adjustments)</li>
                                <li>Creates a retroactive Journal Voucher dated before the first transaction</li>
                                <li>Adjustment entries are marked with system flag for audit transparency</li>
                                <li>Does not modify existing transactions - only adds new adjustment entries</li>
                                <li>Adjustment is posted to Capital/Retained Earnings account</li>
                            </ul>
                        </div>
                    </div>
                </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Stock Alignment Component
const StockAlignmentComponent: React.FC<{ 
    state: any; 
    alignFinishedGoodsStock: (itemId: string, targetQty?: number, targetValue?: number) => Promise<{ success: boolean; message: string; adjustmentAmount?: number; transactionId?: string }>;
    alignOriginalStock: (originalTypeId: string, supplierId: string, targetWeight?: number, targetValue?: number, subSupplierId?: string) => Promise<{ success: boolean; message: string; adjustmentAmount?: number; transactionId?: string }>;
}> = ({ state, alignFinishedGoodsStock, alignOriginalStock }) => {
    const [stockType, setStockType] = useState<'finished-goods' | 'original'>('finished-goods');
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [selectedOriginalTypeId, setSelectedOriginalTypeId] = useState<string>('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [selectedSubSupplierId, setSelectedSubSupplierId] = useState<string>('');
    const [targetQty, setTargetQty] = useState<string>('');
    const [targetWeight, setTargetWeight] = useState<string>('');
    const [targetValue, setTargetValue] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; adjustmentAmount?: number; transactionId?: string } | null>(null);

    // Calculate current stock for Finished Goods
    const finishedGoodsInfo = useMemo(() => {
        if (!selectedItemId || stockType !== 'finished-goods') return null;
        const item = state.items.find((i: any) => i.id === selectedItemId);
        if (!item) return null;

        const currentQty = item.stockQty || 0;
        const currentAvgCost = item.avgCost || 0;
        const currentValue = currentQty * currentAvgCost;

        return {
            item,
            currentQty,
            currentAvgCost,
            currentValue
        };
    }, [selectedItemId, stockType, state.items]);

    // Calculate current stock for Original Purchase
    const originalStockInfo = useMemo(() => {
        if (!selectedOriginalTypeId || !selectedSupplierId || stockType !== 'original') return null;

        const originalType = state.originalTypes.find((ot: any) => ot.id === selectedOriginalTypeId);
        if (!originalType) return null;

        const relevantPurchases = state.purchases.filter((p: any) => 
            p.supplierId === selectedSupplierId &&
            (p.items?.some((item: any) => 
                item.originalTypeId === selectedOriginalTypeId &&
                (selectedSubSupplierId ? item.subSupplierId === selectedSubSupplierId : true)
            ) || (!p.items && p.originalTypeId === selectedOriginalTypeId))
        );

        let totalPurchased = 0;
        let totalCost = 0;

        relevantPurchases.forEach((purchase: any) => {
            if (purchase.items && purchase.items.length > 0) {
                purchase.items.forEach((item: any) => {
                    if (item.originalTypeId === selectedOriginalTypeId && 
                        (selectedSubSupplierId ? item.subSupplierId === selectedSubSupplierId : true)) {
                        totalPurchased += item.weightPurchased;
                        totalCost += item.totalCostUSD;
                    }
                });
            } else if (purchase.originalTypeId === selectedOriginalTypeId) {
                totalPurchased += purchase.weightPurchased;
                totalCost += purchase.totalLandedCost;
            }
        });

        const relevantOpenings = state.originalOpenings.filter((o: any) => 
            o.originalType === selectedOriginalTypeId && 
            o.supplierId === selectedSupplierId
        );
        const totalOpened = relevantOpenings.reduce((sum: number, o: any) => sum + o.weightOpened, 0);

        const directSales = state.salesInvoices
            .filter((inv: any) => inv.status === 'Posted' && (inv.invoiceNo.startsWith('DS-') || inv.invoiceNo.startsWith('DSINV-')))
            .reduce((sum: number, inv: any) => {
                return sum + inv.items
                    .filter((item: any) => item.originalPurchaseId && 
                        relevantPurchases.some((p: any) => p.id === item.originalPurchaseId))
                    .reduce((itemSum: number, item: any) => itemSum + item.totalKg, 0);
            }, 0);

        const currentWeight = totalPurchased - totalOpened - directSales;
        const currentAvgCostPerKg = totalPurchased > 0 ? totalCost / totalPurchased : 0;
        const currentValue = currentWeight * currentAvgCostPerKg;

        return {
            originalType,
            currentWeight,
            currentAvgCostPerKg,
            currentValue,
            totalPurchased,
            totalOpened,
            directSales
        };
    }, [selectedOriginalTypeId, selectedSupplierId, selectedSubSupplierId, stockType, state.purchases, state.originalOpenings, state.salesInvoices, state.originalTypes]);

    const handleAlignFinishedGoods = async () => {
        if (!selectedItemId) {
            alert('Please select an item');
            return;
        }

        const qty = targetQty ? parseFloat(targetQty) : undefined;
        const value = targetValue ? parseFloat(targetValue) : undefined;

        // Both quantity and value (worth) are required
        if (qty === undefined || value === undefined) {
            alert('Please enter both target quantity and target value (worth). Avg Cost will be calculated as: Worth ÷ Quantity');
            return;
        }

        if (qty <= 0) {
            alert('Target quantity must be greater than 0');
            return;
        }

        setIsProcessing(true);
        setResult(null);

        try {
            const result = await alignFinishedGoodsStock(selectedItemId, qty, value);
            setResult(result);
            if (result.success) {
                setTargetQty('');
                setTargetValue('');
            }
        } catch (error) {
            setResult({ success: false, message: `Error: ${(error as Error).message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAlignOriginal = async () => {
        if (!selectedOriginalTypeId || !selectedSupplierId) {
            alert('Please select Original Type and Supplier');
            return;
        }

        const weight = targetWeight ? parseFloat(targetWeight) : undefined;
        const value = targetValue ? parseFloat(targetValue) : undefined;

        if (weight === undefined && value === undefined) {
            alert('Please enter target weight or value (or both)');
            return;
        }

        setIsProcessing(true);
        setResult(null);

        try {
            const result = await alignOriginalStock(
                selectedOriginalTypeId, 
                selectedSupplierId, 
                weight, 
                value,
                selectedSubSupplierId || undefined
            );
            setResult(result);
            if (result.success) {
                setTargetWeight('');
                setTargetValue('');
            }
        } catch (error) {
            setResult({ success: false, message: `Error: ${(error as Error).message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    const availableSubSuppliers = useMemo(() => {
        if (!selectedSupplierId) return [];
        return state.partners.filter((p: any) => 
            p.type === PartnerType.SUB_SUPPLIER && 
            (p.parentSupplierId || (p as any).parentSupplier) === selectedSupplierId
        );
    }, [selectedSupplierId, state.partners]);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-600 text-white rounded-lg">
                        <Package size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Stock Alignment Utility</h2>
                        <p className="text-sm text-slate-500">Adjust stock quantities and values for Finished Goods and Original Purchase stock</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Stock Type Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Stock Type</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setStockType('finished-goods');
                                setSelectedItemId('');
                                setTargetQty('');
                                setTargetValue('');
                                setResult(null);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                stockType === 'finished-goods'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            Finished Goods
                        </button>
                        <button
                            onClick={() => {
                                setStockType('original');
                                setSelectedOriginalTypeId('');
                                setSelectedSupplierId('');
                                setSelectedSubSupplierId('');
                                setTargetWeight('');
                                setTargetValue('');
                                setResult(null);
                            }}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                stockType === 'original'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            Original Purchase Stock
                        </button>
                    </div>
                </div>

                {stockType === 'finished-goods' ? (
                    <>
                        {/* Item Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Select Item</label>
                            <EntitySelector
                                entities={state.items}
                                selectedId={selectedItemId}
                                onSelect={setSelectedItemId}
                                placeholder="Select Item..."
                                className="w-full"
                            />
                        </div>

                        {/* Current Stock Display */}
                        {finishedGoodsInfo && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-700 mb-3">Current Stock</h3>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">Quantity (Packages)</div>
                                        <div className="font-mono font-bold text-slate-800">{finishedGoodsInfo.currentQty.toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">Avg Cost/Unit</div>
                                        <div className="font-mono font-bold text-slate-800">${finishedGoodsInfo.currentAvgCost.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">Total Value</div>
                                        <div className={`font-mono font-bold text-lg ${finishedGoodsInfo.currentValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            ${finishedGoodsInfo.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Target Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Target Quantity (Packages) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={targetQty}
                                    onChange={(e) => setTargetQty(e.target.value)}
                                    placeholder="Enter target quantity"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Target Worth/Value (USD) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                    placeholder="Enter target worth (value)"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                                    required
                                />
                                <div className="text-xs text-slate-500 mt-1">Avg Cost = Worth ÷ Quantity</div>
                            </div>
                        </div>

                        {/* Adjustment Preview */}
                        {finishedGoodsInfo && targetQty && targetValue && (
                            <div className="p-4 rounded-lg border-2 bg-green-50 border-green-200">
                                <h3 className="text-sm font-bold text-slate-700 mb-2">Adjustment Preview</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Current Qty:</span>
                                        <span className="font-mono font-bold">{finishedGoodsInfo.currentQty.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Target Qty:</span>
                                        <span className="font-mono font-bold">{parseFloat(targetQty).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Current Worth:</span>
                                        <span className="font-mono font-bold">${finishedGoodsInfo.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Target Worth:</span>
                                        <span className="font-mono font-bold">${parseFloat(targetValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-slate-300">
                                        <span className="text-slate-600">Current Avg Cost:</span>
                                        <span className="font-mono font-bold">${finishedGoodsInfo.currentAvgCost.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600 font-semibold">Calculated Avg Cost:</span>
                                        <span className="font-mono font-bold text-green-700">
                                            ${(parseFloat(targetValue) / parseFloat(targetQty)).toFixed(2)}
                                            <span className="text-xs text-slate-500 ml-1">(Worth ÷ Qty)</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Button */}
                        <button
                            onClick={handleAlignFinishedGoods}
                            disabled={!selectedItemId || isProcessing || !targetQty || !targetValue}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Package size={18} />
                                    Post Stock Adjustment
                                </>
                            )}
                        </button>
                    </>
                ) : (
                    <>
                        {/* Original Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Select Original Type</label>
                            <EntitySelector
                                entities={state.originalTypes}
                                selectedId={selectedOriginalTypeId}
                                onSelect={setSelectedOriginalTypeId}
                                placeholder="Select Original Type..."
                                className="w-full"
                            />
                        </div>

                        {/* Supplier Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Select Supplier</label>
                            <EntitySelector
                                entities={state.partners.filter((p: any) => p.type === PartnerType.SUPPLIER)}
                                selectedId={selectedSupplierId}
                                onSelect={(id) => {
                                    setSelectedSupplierId(id);
                                    setSelectedSubSupplierId(''); // Clear sub supplier when main supplier changes
                                }}
                                placeholder="Select Supplier..."
                                className="w-full"
                            />
                        </div>

                        {/* Sub Supplier Selection (Optional) */}
                        {availableSubSuppliers.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Select Sub Supplier (Optional)</label>
                                <EntitySelector
                                    entities={availableSubSuppliers}
                                    selectedId={selectedSubSupplierId}
                                    onSelect={setSelectedSubSupplierId}
                                    placeholder="All Sub Suppliers"
                                    className="w-full"
                                />
                            </div>
                        )}

                        {/* Current Stock Display */}
                        {originalStockInfo && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-700 mb-3">Current Stock</h3>
                                <div className="grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">Weight (Kg)</div>
                                        <div className="font-mono font-bold text-slate-800">{originalStockInfo.currentWeight.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">Avg Cost/Kg</div>
                                        <div className="font-mono font-bold text-slate-800">${originalStockInfo.currentAvgCostPerKg.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">Total Value</div>
                                        <div className={`font-mono font-bold text-lg ${originalStockInfo.currentValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            ${originalStockInfo.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">Purchased</div>
                                        <div className="font-mono font-bold text-slate-800">{originalStockInfo.totalPurchased.toFixed(2)} Kg</div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                                    Opened: {originalStockInfo.totalOpened.toFixed(2)} Kg | Direct Sales: {originalStockInfo.directSales.toFixed(2)} Kg
                                </div>
                            </div>
                        )}

                        {/* Target Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Target Weight (Kg) - Optional</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={targetWeight}
                                    onChange={(e) => setTargetWeight(e.target.value)}
                                    placeholder="Leave blank to keep current"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Target Value (USD) - Optional</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={targetValue}
                                    onChange={(e) => setTargetValue(e.target.value)}
                                    placeholder="Leave blank to keep current"
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                                />
                            </div>
                        </div>

                        {/* Adjustment Preview */}
                        {originalStockInfo && (targetWeight || targetValue) && (
                            <div className="p-4 rounded-lg border-2 bg-green-50 border-green-200">
                                <h3 className="text-sm font-bold text-slate-700 mb-2">Adjustment Preview</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Current Weight:</span>
                                        <span className="font-mono font-bold">{originalStockInfo.currentWeight.toFixed(2)} Kg</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Target Weight:</span>
                                        <span className="font-mono font-bold">{targetWeight ? parseFloat(targetWeight).toFixed(2) : originalStockInfo.currentWeight.toFixed(2)} Kg</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Current Value:</span>
                                        <span className="font-mono font-bold">${originalStockInfo.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Target Value:</span>
                                        <span className="font-mono font-bold">${targetValue ? parseFloat(targetValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : originalStockInfo.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Button */}
                        <button
                            onClick={handleAlignOriginal}
                            disabled={!selectedOriginalTypeId || !selectedSupplierId || isProcessing || (!targetWeight && !targetValue)}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Package size={18} />
                                    Post Stock Adjustment
                                </>
                            )}
                        </button>
                    </>
                )}

                {/* Result Message */}
                {result && (
                    <div className={`p-4 rounded-lg border-2 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                            {result.success ? '✓ Success' : '✗ Error'}
                        </div>
                        <div className="text-sm mt-1 text-slate-700">{result.message}</div>
                        {result.transactionId && (
                            <div className="text-xs mt-2 font-mono text-slate-600">Transaction ID: {result.transactionId}</div>
                        )}
                    </div>
                )}

                {/* Info Box */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                        <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
                        <div className="text-xs text-amber-800">
                            <div className="font-semibold mb-1">How it works:</div>
                            <ul className="list-disc list-inside space-y-1 text-amber-700">
                                <li>Calculates current stock from purchases, openings, and sales</li>
                                <li>Creates a retroactive Inventory Adjustment entry dated before the first transaction</li>
                                <li>Adjustment entries are marked with system flag for audit transparency</li>
                                <li>Does not modify existing transactions - only adds new adjustment entries</li>
                                <li>For Finished Goods: Updates item stockQty and avgCost in Firestore</li>
                                <li>Adjustment is posted to Capital/Retained Earnings account</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};