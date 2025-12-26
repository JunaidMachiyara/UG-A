
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { TransactionType, AccountType, Currency, PartnerType, LedgerEntry } from '../types';
import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from '../constants';
import { EntitySelector } from './EntitySelector';
import { FileText, ArrowRight, ArrowLeftRight, CreditCard, DollarSign, Plus, Trash2, CheckCircle, Calculator, Building, User, RefreshCw, TrendingUp, Filter, Lock, ShieldAlert, Edit2, X, ShoppingBag, Package, RotateCcw, AlertTriangle, Scale } from 'lucide-react';

type VoucherType = 'RV' | 'PV' | 'EV' | 'JV' | 'TR' | 'PB' | 'IA' | 'RTS' | 'WO' | 'BD';

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
    const { state, postTransaction, deleteTransaction, alignBalance, alignFinishedGoodsStock, alignOriginalStock } = useData();
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
    const [iaItemId, setIaItemId] = useState(''); // Inventory Adjustment - Item
    const [iaAdjustmentType, setIaAdjustmentType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
    const [iaQty, setIaQty] = useState('');
    const [iaReason, setIaReason] = useState('');

    const [rtsSupplierId, setRtsSupplierId] = useState(''); // Return to Supplier
    const [rtsItemId, setRtsItemId] = useState('');
    const [rtsQty, setRtsQty] = useState('');
    const [rtsReason, setRtsReason] = useState('');

    const [woAccountId, setWoAccountId] = useState(''); // Write-off
    const [woReason, setWoReason] = useState('');

    const [bdAccountId, setBdAccountId] = useState(''); // Balancing Discrepancy
    const [bdAdjustmentType, setBdAdjustmentType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
    const [bdReason, setBdReason] = useState('');

    // --- Ledger Filtering State ---
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterAccountId, setFilterAccountId] = useState('');
    const [filterVoucherId, setFilterVoucherId] = useState('');
    const [filterMinAmount, setFilterMinAmount] = useState('');
    const [filterMaxAmount, setFilterMaxAmount] = useState('');
    const [voucherToDelete, setVoucherToDelete] = useState('');

    // --- Auth Modal State ---
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authPin, setAuthPin] = useState('');
    const [pendingAction, setPendingAction] = useState<{ type: 'DELETE' | 'EDIT', transactionId: string } | null>(null);

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

    const uniqueVouchers = useMemo(() => {
        // Get unique voucher IDs from ledger
        return Array.from(new Set(state.ledger.map(e => e.transactionId)))
            .map(tid => ({
                id: tid,
                name: tid
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [state.ledger]);

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
    const resetForm = (type: VoucherType) => {
        setVType(type);
        setVoucherNo(generateVoucherId(type));
        // Reset new transaction type states
        setIaItemId('');
        setIaAdjustmentType('INCREASE');
        setIaQty('');
        setIaReason('');
        setRtsSupplierId('');
        setRtsItemId('');
        setRtsQty('');
        setRtsReason('');
        setWoAccountId('');
        setWoReason('');
        setBdAccountId('');
        setBdAdjustmentType('INCREASE');
        setBdReason('');
        
        // Clear all fields
        setSourceId(''); setDestId(''); 
        setAmount(''); setDescription('');
        setFromAmount(''); setToAmount('');
        setCurrency('USD'); setExchangeRate(1);
        setJvRows([{ id: Math.random().toString(), accountId: '', desc: '', debit: 0, credit: 0, currency: 'USD', exchangeRate: 1 }, { id: Math.random().toString(), accountId: '', desc: '', debit: 0, credit: 0, currency: 'USD', exchangeRate: 1 }]);
        
        setPbPaymentMode('CREDIT');
        setPbVendorId('');
        // Reset new transaction type states
        setIaItemId('');
        setIaAdjustmentType('INCREASE');
        setIaQty('');
        setIaReason('');
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
        if (!date) return alert("Date is required");
        if (vType !== 'JV' && vType !== 'TR' && vType !== 'IA' && vType !== 'RTS' && vType !== 'WO' && vType !== 'BD' && (!amount || parseFloat(amount) <= 0)) return alert("Valid amount is required");
        if (vType === 'TR' && (!fromAmount || !toAmount)) return alert("Both Send and Receive amounts are required");
        if (vType !== 'JV' && vType !== 'IA' && vType !== 'RTS' && vType !== 'WO' && vType !== 'BD' && !description) return alert("Description is required");

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
            entries.push({ ...common, transactionType: TransactionType.PAYMENT_VOUCHER, accountId: destId, accountName: destName, debit: baseAmount, credit: 0 });
            entries.push({ ...common, transactionType: TransactionType.PAYMENT_VOUCHER, accountId: sourceId, accountName: sourceName, debit: 0, credit: baseAmount });
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
            // Calculate totals using base amount if available, otherwise use exchange rate
            const totalDr = jvRows.reduce((sum, r) => {
                if (r.baseAmount !== undefined && r.baseAmount !== null && r.debit > 0) {
                    return sum + r.baseAmount;
                }
                return sum + (r.debit / r.exchangeRate);
            }, 0);
            const totalCr = jvRows.reduce((sum, r) => {
                if (r.baseAmount !== undefined && r.baseAmount !== null && r.credit > 0) {
                    return sum + r.baseAmount;
                }
                return sum + (r.credit / r.exchangeRate);
            }, 0);
            if (Math.abs(totalDr - totalCr) > 0.01) return alert(`Journal is unbalanced! Diff: $${(totalDr - totalCr).toFixed(2)}`);
            entries = jvRows.map(row => {
                // Get actual account name
                const account = state.accounts.find(a => a.id === row.accountId);
                const partner = state.partners.find(p => p.id === row.accountId);
                const accountName = account?.name || partner?.name || 'Unknown Account';
                
                // Use base amount if available, otherwise calculate from exchange rate
                const baseDebit = row.baseAmount !== undefined && row.baseAmount !== null && row.debit > 0 
                    ? row.baseAmount 
                    : row.debit / row.exchangeRate;
                const baseCredit = row.baseAmount !== undefined && row.baseAmount !== null && row.credit > 0 
                    ? row.baseAmount 
                    : row.credit / row.exchangeRate;
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
            // Inventory Adjustment
            if (!iaItemId || !iaQty || parseFloat(iaQty) <= 0) return alert("Select item and enter valid quantity");
            if (!iaReason) return alert("Reason is required for inventory adjustment");
            const item = state.items.find(i => i.id === iaItemId);
            if (!item) return alert("Item not found");
            const qty = parseFloat(iaQty);
            const adjustmentValue = qty * (item.avgCost || 0);
            
            // Lookup accounts dynamically (factory-specific, always correct)
            const inventoryAccount = state.accounts.find(a => 
                a.name.includes('Finished Goods') || 
                a.name.includes('Inventory - Finished Goods') ||
                a.code === '105' ||
                a.code === '1202'
            );
            const adjustmentAccount = state.accounts.find(a => 
                a.name.includes('Inventory Adjustment') || 
                a.name.includes('Write-off') ||
                a.code === '503'
            );
            
            if (!inventoryAccount || !adjustmentAccount) {
                const missingAccounts = [];
                if (!inventoryAccount) missingAccounts.push('Inventory - Finished Goods (105 or 1202)');
                if (!adjustmentAccount) missingAccounts.push('Inventory Adjustment (503)');
                return alert(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts.`);
            }
            
            if (iaAdjustmentType === 'INCREASE') {
                entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: inventoryAccount.id, accountName: inventoryAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: adjustmentValue, credit: 0, narration: `Inventory Increase: ${item.name} (${qty} units) - ${iaReason}`, factoryId: state.currentFactory?.id || '' });
                entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: adjustmentAccount.id, accountName: adjustmentAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: 0, credit: adjustmentValue, narration: `Inventory Increase: ${item.name} - ${iaReason}`, factoryId: state.currentFactory?.id || '' });
            } else {
                entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: inventoryAccount.id, accountName: inventoryAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: 0, credit: adjustmentValue, narration: `Inventory Decrease: ${item.name} (${qty} units) - ${iaReason}`, factoryId: state.currentFactory?.id || '' });
                entries.push({ date, transactionId: voucherNo, transactionType: TransactionType.INVENTORY_ADJUSTMENT, accountId: adjustmentAccount.id, accountName: adjustmentAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: adjustmentValue, debit: adjustmentValue, credit: 0, narration: `Inventory Decrease: ${item.name} - ${iaReason}`, factoryId: state.currentFactory?.id || '' });
            }
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
            const discrepancyAccount = state.accounts.find(a => 
                a.name.includes('Discrepancy') || 
                a.name.includes('Suspense') ||
                a.name.includes('Balancing Discrepancy') ||
                a.code === '505'
            );
            
            if (!discrepancyAccount) {
                return alert('Missing required account: Balancing Discrepancy / Suspense (505).\n\nPlease create this account in:\nSetup > Chart of Accounts\n\nRecommended:\n- Code: 505\n- Name: "Balancing Discrepancy" or "Suspense Account"\n- Type: LIABILITY\n- Opening Balance: 0\n\nThe system will automatically find it by code "505" or if the name contains "Discrepancy", "Suspense", or "Balancing Discrepancy".');
            }
            
            // BD vouchers always use current date to show when the adjustment was actually made
            const bdDate = new Date().toISOString().split('T')[0];
            
            if (bdAdjustmentType === 'INCREASE') {
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: bdAccountId, accountName: entityName, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Increase: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
            } else {
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: bdAccountId, accountName: entityName, currency, exchangeRate, fcyAmount, debit: 0, credit: baseAmount, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
                entries.push({ date: bdDate, transactionId: voucherNo, transactionType: TransactionType.BALANCING_DISCREPANCY, accountId: discrepancyAccount.id, accountName: discrepancyAccount.name, currency, exchangeRate, fcyAmount, debit: baseAmount, credit: 0, narration: `Balance Decrease: ${entityName} - ${bdReason}`, factoryId: state.currentFactory?.id || '' });
            }
        }

        await postTransaction(entries);
        alert(`${voucherNo} Posted Successfully!`);
        
        // Reset for next entry
        resetForm(vType);
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
    const filteredLedger = useMemo(() => {
        return state.ledger.filter(entry => {
            if (filterDateFrom && entry.date < filterDateFrom) return false;
            if (filterDateTo && entry.date > filterDateTo) return false;
            if (filterType && entry.transactionType !== filterType) return false;
            if (filterAccountId && entry.accountId !== filterAccountId) return false;
            if (filterVoucherId && entry.transactionId !== filterVoucherId) return false;
            if (filterMinAmount && entry.fcyAmount < parseFloat(filterMinAmount)) return false;
            if (filterMaxAmount && entry.fcyAmount > parseFloat(filterMaxAmount)) return false;
            return true;
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.ledger, filterDateFrom, filterDateTo, filterType, filterAccountId, filterVoucherId, filterMinAmount, filterMaxAmount]);

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

                // Delete old one using Context Action with Metadata
                deleteTransaction(pendingAction.transactionId, 'Edit Reversal', authPin);
                setActiveTab('voucher'); // Switch to edit mode
            }
        }
        setAuthModalOpen(false);
        setPendingAction(null);
    };

    return (
        <div className="space-y-6 w-full">
            {/* Navigation Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
                <button onClick={() => setActiveTab('voucher')} className={`pb-3 px-4 text-sm font-medium transition-all ${activeTab === 'voucher' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>New Voucher</button>
                <button onClick={() => setActiveTab('ledger')} className={`pb-3 px-4 text-sm font-medium transition-all ${activeTab === 'ledger' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>General Ledger</button>
                <button onClick={() => setActiveTab('balance-alignment')} className={`pb-3 px-4 text-sm font-medium transition-all ${activeTab === 'balance-alignment' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Balance Alignment</button>
                <button onClick={() => setActiveTab('stock-alignment')} className={`pb-3 px-4 text-sm font-medium transition-all ${activeTab === 'stock-alignment' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Stock Alignment</button>
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
                                { id: 'RTS', label: 'Return to Supplier', icon: RotateCcw, color: 'text-pink-600' },
                                { id: 'WO', label: 'Write-off', icon: AlertTriangle, color: 'text-red-700' },
                                { id: 'BD', label: 'Balancing Discrepancy', icon: Scale, color: 'text-teal-600' },
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => resetForm(type.id as VoucherType)}
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
                        ) : vType === 'BD' ? null : (
                            // STANDARD FORM (RV, PV, EV, PB, IA, RTS, WO)
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
                        {vType === 'IA' && (
                            <div className="space-y-6 bg-indigo-50 p-6 rounded-xl border-2 border-indigo-200">
                                <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                                    <Package size={20} /> Inventory Adjustment
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Item</label>
                                        <EntitySelector 
                                            entities={state.items.map(i => ({ id: i.id, name: `${i.code} - ${i.name}` }))} 
                                            selectedId={iaItemId} 
                                            onSelect={setIaItemId} 
                                            placeholder="Select Item..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Adjustment Type</label>
                                        <select 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={iaAdjustmentType} 
                                            onChange={e => setIaAdjustmentType(e.target.value as 'INCREASE' | 'DECREASE')}
                                        >
                                            <option value="INCREASE">Increase Inventory</option>
                                            <option value="DECREASE">Decrease Inventory</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Quantity</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={iaQty} 
                                            onChange={e => setIaQty(e.target.value)} 
                                            placeholder="Enter quantity"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Reason *</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800" 
                                            value={iaReason} 
                                            onChange={e => setIaReason(e.target.value)} 
                                            placeholder="Reason for adjustment (required)"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

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
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                            >
                                <CheckCircle size={20} /> Post {vType} Voucher
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
                            <span className="text-xs text-slate-400">Showing {filteredLedger.length} records</span>
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

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm min-w-full">
                                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-xs">
                                    <tr>
                                        <th className="px-4 py-4 whitespace-nowrap">Date</th>
                                        <th className="px-4 py-4 whitespace-nowrap">Voucher</th>
                                        <th className="px-4 py-4 whitespace-nowrap min-w-[200px]">Account</th>
                                        <th className="px-4 py-4 whitespace-nowrap">Account ID</th>
                                        <th className="px-4 py-4 text-right bg-blue-50/50 whitespace-nowrap">Amount (FCY)</th>
                                        <th className="px-4 py-4 text-center whitespace-nowrap">Rate</th>
                                        <th className="px-4 py-4 text-right whitespace-nowrap">Debit ($)</th>
                                        <th className="px-4 py-4 text-right whitespace-nowrap">Credit ($)</th>
                                        <th className="px-4 py-4 min-w-[300px]">Narration</th>
                                        <th className="px-4 py-4 text-center whitespace-nowrap">Manage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-slate-700">
                                    {filteredLedger.map((entry) => {
                                        // Check if this accountId is a partner
                                        const isPartner = state.partners.some(p => p.id === entry.accountId);
                                        const partner = state.partners.find(p => p.id === entry.accountId);
                                        
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
                                                    <button onClick={() => initiateAction('DELETE', entry.transactionId)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete Voucher"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
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
            } else if ([PartnerType.SUPPLIER, PartnerType.VENDOR, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(entity.type)) {
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

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-blue-50">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-600 text-white rounded-lg">
                        <Scale size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Automatic Balance Alignment Utility</h2>
                        <p className="text-sm text-slate-500">Adjust account balances to target values using retroactive adjustment entries</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
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
            p.parentSupplier === selectedSupplierId
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