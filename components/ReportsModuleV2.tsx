
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { AccountType, TransactionType, PlannerPeriodType, PlannerEntityType, PlannerEntry, PartnerType, LedgerEntry, PackingType } from '../types';
import { 
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
    LayoutDashboard, 
    TrendingUp, 
    Package, 
    Factory, 
    FileText, 
    Search, 
    Download, 
    ArrowUpRight, 
    ArrowDownRight,
    DollarSign,
    AlertTriangle,
    Layers,
    Calendar,
    BookOpen,
    X,
    Printer,
    ChevronDown,
    BadgeCheck,
    ArrowRight,
    ArrowLeftRight,
    CheckCircle,
    Briefcase,
    Plus,
    Trash2,
    ShieldAlert, 
    ChevronRight,
    ExternalLink,
    Truck,
    History,
    ChevronUp,
    Wallet,
    Users,
    RefreshCw
} from 'lucide-react';
import { CHART_COLORS, EXCHANGE_RATES } from '../constants';
import { EntitySelector } from './EntitySelector';
import { Link, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

// --- Helper Functions for Planners ---
function getNextPeriodDates(periodType: PlannerPeriodType, currentDate: Date): { currentPeriod: string, nextPeriodStartDate: Date, lastPeriodStartDate: Date, lastPeriodEndDate: Date } {
    if (periodType === 'WEEKLY') {
        // Get start of current week (Monday)
        const currentWeekStart = new Date(currentDate);
        currentWeekStart.setDate(currentWeekStart.getDate() - (currentWeekStart.getDay() === 0 ? 6 : currentWeekStart.getDay() - 1)); // Adjust for Sunday being 0
        currentWeekStart.setHours(0, 0, 0, 0);

        // Get start of next week
        const nextWeekStart = new Date(currentWeekStart);
        nextWeekStart.setDate(currentWeekStart.getDate() + 7);

        // Get start of last week
        const lastWeekStart = new Date(currentWeekStart);
        lastWeekStart.setDate(currentWeekStart.getDate() - 7); 

        // Get end of last week (Sunday of previous week)
        const lastWeekEnd = new Date(currentWeekStart);
        lastWeekEnd.setDate(currentWeekStart.getDate() - 1);
        lastWeekEnd.setHours(23, 59, 59, 999);

        // Format for period string (YYYY-WW)
        const year = currentWeekStart.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        const pastDaysOfYear = (currentWeekStart.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        
        const currentPeriod = `${year}-W${String(weekNumber).padStart(2, '0')}`;

        return {
            currentPeriod,
            nextPeriodStartDate: nextWeekStart,
            lastPeriodStartDate: lastWeekStart,
            lastPeriodEndDate: lastWeekEnd
        };
    } else { // MONTHLY
        const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM

        const nextMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        
        // Start of previous month
        const lastMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        // End of previous month
        const lastMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
        lastMonthEnd.setHours(23, 59, 59, 999);

        return {
            currentPeriod: currentMonth,
            nextPeriodStartDate: nextMonthStart,
            lastPeriodStartDate: lastMonthStart,
            lastPeriodEndDate: lastMonthEnd
        };
    }
}

// Calculate actuals for a given entity and period from ledger
function calculatePeriodActuals(ledger: any[], entityId: string, entityType: PlannerEntityType, periodStartDate: Date, periodEndDate: Date): number {
    let actualAmount = 0;
    const startDateString = periodStartDate.toISOString().split('T')[0];
    const endDateString = periodEndDate.toISOString().split('T')[0];

    const relevantEntries = ledger.filter(entry => {
        const entryDate = entry.date;
        return entryDate >= startDateString && entryDate <= endDateString;
    });

    if (entityType === PlannerEntityType.CUSTOMER) {
        // Customer actuals are receipts from them (Credit side of AR or Debit side of Bank/Cash)
        // We look for the credit to the customer's AR account from a RV
        actualAmount = relevantEntries
            .filter(e => e.transactionType === TransactionType.RECEIPT_VOUCHER && e.accountId === entityId)
            .reduce((sum, e) => sum + e.credit, 0); 
    } else if (entityType === PlannerEntityType.SUPPLIER) {
        // Supplier actuals are payments to them (Debit side of AP)
        // We look for the debit to the supplier's AP account from a PV
        actualAmount = relevantEntries
            .filter(e => e.transactionType === TransactionType.PAYMENT_VOUCHER && e.accountId === entityId)
            .reduce((sum, e) => sum + e.debit, 0); 
    } else if (entityType === PlannerEntityType.EXPENSE) {
        // Debits to expense account
        actualAmount = relevantEntries
            .filter(e => [TransactionType.EXPENSE_VOUCHER, TransactionType.PURCHASE_BILL, TransactionType.JOURNAL_VOUCHER].includes(e.transactionType) && e.accountId === entityId)
            .reduce((sum, e) => sum + e.debit, 0); 
    }
    return actualAmount;
}

// --- SUB-COMPONENTS ---

// 1. EXECUTIVE BI DASHBOARD
const BiDashboard: React.FC = () => {
    const { state } = useData();

    // Metrics - Calculate from account balances
    // For REVENUE accounts: credits increase revenue, debits decrease it
    // Balance = creditSum - debitSum (should be positive for revenue)
    const revenueAccounts = state.accounts.filter(a => a && a.type === AccountType.REVENUE);
    const totalRevenue = revenueAccounts.reduce((sum, a) => {
        // For revenue accounts, balance should be positive (credits - debits)
        // But we'll use absolute value to handle any negative balances
        const balance = a?.balance || 0;
        // If balance is negative, it means more debits than credits (unusual but possible)
        // We'll still count it as revenue (absolute value)
        return sum + Math.abs(balance);
    }, 0);
    const expenseAccounts = state.accounts.filter(a => a && a.type === AccountType.EXPENSE);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + Math.abs(a?.balance || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // DIAGNOSTIC: Check revenue account and ledger entries
    const revenueAccount = state.accounts.find(a => 
        a.name.includes('Sales Revenue') || 
        a.name.includes('Revenue') ||
        a.code === '401' ||
        a.type === AccountType.REVENUE
    );
    
    // Calculate revenue from ledger entries (for comparison)
    const revenueLedgerEntries = state.ledger.filter(e => {
        if (e.credit > 0) {
            const account = state.accounts.find(a => a.id === e.accountId);
            return account && account.type === AccountType.REVENUE;
        }
        return false;
    });
    const revenueFromLedger = revenueLedgerEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
    
    // Check for orphaned revenue entries (accountId doesn't match any account)
    const orphanedRevenueEntries = state.ledger.filter(e => {
        if (e.credit > 0 && e.narration?.includes('Revenue') || e.narration?.includes('Sales')) {
            const account = state.accounts.find(a => a.id === e.accountId);
            return !account; // Entry exists but account doesn't
        }
        return false;
    });
    const orphanedRevenueAmount = orphanedRevenueEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
    
    // Check posted sales invoices
    const postedInvoices = state.salesInvoices.filter(inv => inv.status === 'Posted');
    const totalSalesFromInvoices = postedInvoices.reduce((sum, inv) => sum + inv.netTotal, 0);
    
    // Check unposted invoices
    const unpostedInvoices = state.salesInvoices.filter(inv => inv.status !== 'Posted');
    const totalUnpostedSales = unpostedInvoices.reduce((sum, inv) => sum + inv.netTotal, 0);

    // Charts Data
    const salesByCat = useMemo(() => {
        const data: Record<string, number> = {};
        state.salesInvoices.forEach(inv => {
            inv.items.forEach(item => {
                const itemDef = state.items.find(i => i.id === item.itemId);
                const catName = state.categories.find(c => c.id === itemDef?.category)?.name || itemDef?.category || 'Uncategorized';
                data[catName] = (data[catName] || 0) + item.total;
            });
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [state.salesInvoices, state.items, state.categories]);

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={64} className="text-emerald-500" /></div>
                    <p className="text-slate-500 text-sm font-medium uppercase">Net Profit</p>
                    <h3 className="text-3xl font-bold text-slate-800 mt-1">${(netProfit || 0).toLocaleString()}</h3>
                    <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {profitMargin >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        {profitMargin.toFixed(1)}% Margin
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium uppercase">Total Revenue</p>
                    <h3 className="text-3xl font-bold text-blue-600 mt-1">${(totalRevenue || 0).toLocaleString()}</h3>
                    <p className="text-xs text-slate-400 mt-2">Across all divisions</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium uppercase">Total Expenses</p>
                    <h3 className="text-3xl font-bold text-red-500 mt-1">${(totalExpenses || 0).toLocaleString()}</h3>
                    <p className="text-xs text-slate-400 mt-2">COGS + OpEx</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-6">Sales by Category</h4>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                            <BarChart data={salesByCat}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-700 mb-6">Top Customers</h4>
                    <div className="space-y-4">
                        {state.partners
                            .filter(p => p.type === PartnerType.CUSTOMER)
                            .sort((a, b) => {
                                const salesA = state.salesInvoices.filter(i => i.customerId === a.id).reduce((s, i) => s + i.netTotal, 0);
                                const salesB = state.salesInvoices.filter(i => i.customerId === b.id).reduce((s, i) => s + i.netTotal, 0);
                                return salesB - salesA;
                            })
                            .slice(0, 5)
                            .map((cust, idx) => {
                                const totalSales = state.salesInvoices.filter(i => i.customerId === cust.id).reduce((s, i) => s + i.netTotal, 0);
                                return (
                                    <div key={cust.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                            <div>
                                                <div className="font-medium text-slate-800">{cust.name}</div>
                                                <div className="text-xs text-slate-500">{cust.country}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-slate-700">${totalSales.toLocaleString()}</div>
                                            <div className="text-xs text-emerald-600">Balance: ${(cust?.balance || 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* DIAGNOSTIC SECTION - Revenue Analysis - HIDDEN */}
            {false && (totalRevenue === 0 || Math.abs(revenueFromLedger - totalRevenue) > 0.01) && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
                    <h4 className="font-bold text-yellow-800 mb-4 flex items-center gap-2">
                        <AlertTriangle size={20} /> Revenue Diagnostic
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-yellow-700 font-semibold mb-2">Account Analysis:</p>
                            <ul className="space-y-1 text-yellow-600">
                                <li>• Revenue Accounts Found: {revenueAccounts.length}</li>
                                <li>• Revenue Account Balance: ${totalRevenue.toLocaleString()}</li>
                                {revenueAccount ? (
                                    <li className="text-green-600">✓ Revenue Account: {revenueAccount.name} (Code: {revenueAccount.code}, ID: {revenueAccount.id?.substring(0, 20)}...)</li>
                                ) : (
                                    <li className="text-red-600">✗ No Revenue Account Found! (Looking for: "Sales Revenue" or Code 401)</li>
                                )}
                            </ul>
                        </div>
                        <div>
                            <p className="text-yellow-700 font-semibold mb-2">Ledger Analysis:</p>
                            <ul className="space-y-1 text-yellow-600">
                                <li>• Posted Invoices: {postedInvoices.length}</li>
                                <li>• Unposted Invoices: {unpostedInvoices.length} (${totalUnpostedSales.toLocaleString()})</li>
                                <li>• Total Sales (Posted): ${totalSalesFromInvoices.toLocaleString()}</li>
                                <li>• Revenue Ledger Entries: {revenueLedgerEntries.length}</li>
                                <li>• Revenue from Ledger: ${revenueFromLedger.toLocaleString()}</li>
                                {orphanedRevenueEntries.length > 0 && (
                                    <li className="text-red-600 font-bold">⚠️ {orphanedRevenueEntries.length} Orphaned Revenue Entries (${orphanedRevenueAmount.toLocaleString()}) - Account ID mismatch!</li>
                                )}
                                {revenueFromLedger > 0 && totalRevenue === 0 && (
                                    <li className="text-red-600 font-bold">⚠️ MISMATCH: Ledger has ${revenueFromLedger.toLocaleString()} but accounts show $0!</li>
                                )}
                                {totalSalesFromInvoices > 0 && revenueFromLedger === 0 && (
                                    <li className="text-orange-600 font-bold">⚠️ Posted invoices exist but no revenue ledger entries found!</li>
                                )}
                            </ul>
                        </div>
                    </div>
                    {!revenueAccount && (
                        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded">
                            <p className="text-red-800 font-semibold">⚠️ ACTION REQUIRED:</p>
                            <p className="text-red-700 text-sm mt-1">
                                Create a Revenue account in <strong>Setup &gt; Chart of Accounts</strong>:
                                <br />• Code: <strong>401</strong>
                                <br />• Name: <strong>Sales Revenue</strong>
                                <br />• Type: <strong>REVENUE</strong>
                            </p>
                        </div>
                    )}
                    {orphanedRevenueEntries.length > 0 && (
                        <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded">
                            <p className="text-orange-800 font-semibold">⚠️ ORPHANED LEDGER ENTRIES DETECTED:</p>
                            <p className="text-orange-700 text-sm mt-1">
                                Found {orphanedRevenueEntries.length} revenue ledger entries with account IDs that don't match any account.
                                <br />Total Amount: <strong>${orphanedRevenueAmount.toLocaleString()}</strong>
                                <br />
                                <br />This likely means sales invoices were posted before the revenue account existed, or the account ID was wrong.
                                <br />
                                <br />Sample Account IDs from orphaned entries:
                                <br />{Array.from(new Set(orphanedRevenueEntries.slice(0, 5).map(e => e.accountId))).map(id => (
                                    <span key={id} className="font-mono text-xs">• {id}</span>
                                ))}
                                <br />
                                <br />Go to <strong>Admin Module</strong> to fix these entries or re-post the invoices.
                            </p>
                        </div>
                    )}
                    {revenueAccounts.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-blue-800 font-semibold mb-2">Revenue Accounts Details:</p>
                            <div className="text-sm text-blue-700 space-y-1">
                                {revenueAccounts.map(acc => {
                                    // Calculate balance from ledger for this account
                                    const accountLedgerEntries = state.ledger.filter(e => e.accountId === acc.id);
                                    const creditSum = accountLedgerEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
                                    const debitSum = accountLedgerEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
                                    const calculatedBalance = creditSum - debitSum; // REVENUE: credits - debits
                                    const storedBalance = acc.balance || 0;
                                    const hasMismatch = Math.abs(calculatedBalance - storedBalance) > 0.01;
                                    
                                    return (
                                        <div key={acc.id} className={`flex justify-between ${hasMismatch ? 'bg-yellow-100 p-2 rounded' : ''}`}>
                                            <div>
                                                <span>{acc.name} (Code: {acc.code})</span>
                                                {hasMismatch && (
                                                    <span className="text-red-600 text-xs ml-2">⚠️ MISMATCH!</span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono">Stored: ${storedBalance.toLocaleString()}</div>
                                                {hasMismatch && (
                                                    <div className="font-mono text-green-600 text-xs">Calc: ${calculatedBalance.toLocaleString()}</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-blue-600 mt-2">
                                💡 If "MISMATCH" appears, the account balance is not synced with ledger entries. 
                                Use Admin Module &gt; Recalculate All Balances to fix.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// 2. INVENTORY INTELLIGENCE
const InventoryIntelligence: React.FC = () => {
    const { state } = useData();
    const [sortField, setSortField] = useState<string>('totalSold');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [itemFilter, setItemFilter] = useState<string>('');
    const [showLowStockPopup, setShowLowStockPopup] = useState<boolean>(false);
    const [selectedInvoiceNos, setSelectedInvoiceNos] = useState<string[] | null>(null);

    // Calculate Raw Material Value from Original Stock (purchases - openings - direct sales)
    // This matches the Original Stock Report calculation
    const rawMaterialValue = useMemo(() => {
        // Group purchases by supplier and original type
        const stockData: Record<string, Record<string, { weightPurchased: number, weightOpened: number, totalCost: number }>> = {};

        // Add purchases
        state.purchases.forEach(purchase => {
            const supplierId = purchase.supplierId;
            if (!supplierId) return;

            if (purchase.items && purchase.items.length > 0) {
                purchase.items.forEach(item => {
                    const typeId = item.originalTypeId || 'UNKNOWN';
                    if (!stockData[supplierId]) stockData[supplierId] = {};
                    if (!stockData[supplierId][typeId]) {
                        stockData[supplierId][typeId] = { weightPurchased: 0, weightOpened: 0, totalCost: 0 };
                    }
                    stockData[supplierId][typeId].weightPurchased += item.weightPurchased || 0;
                    stockData[supplierId][typeId].totalCost += item.totalCostUSD || 0;
                });
            } else {
                const typeId = purchase.originalTypeId || 'UNKNOWN';
                if (!stockData[supplierId]) stockData[supplierId] = {};
                if (!stockData[supplierId][typeId]) {
                    stockData[supplierId][typeId] = { weightPurchased: 0, weightOpened: 0, totalCost: 0 };
                }
                stockData[supplierId][typeId].weightPurchased += purchase.weightPurchased || 0;
                stockData[supplierId][typeId].totalCost += purchase.totalLandedCost || 0;
            }
        });

        // Subtract openings
        state.originalOpenings.forEach(opening => {
            const supplierId = opening.supplierId;
            if (!supplierId || !stockData[supplierId]) return;
            const typeId = opening.originalType || 'UNKNOWN';
            if (stockData[supplierId][typeId]) {
                stockData[supplierId][typeId].weightOpened += opening.weightOpened || 0;
            }
        });

        // Subtract direct sales
        const directSalesInvoices = state.salesInvoices.filter(inv => 
            inv.status === 'Posted' && (inv.invoiceNo.startsWith('DS-') || inv.invoiceNo.startsWith('DSINV-'))
        );

        directSalesInvoices.forEach(inv => {
            inv.items.forEach(item => {
                if (item.originalPurchaseId) {
                    const purchase = state.purchases.find(p => p.id === item.originalPurchaseId);
                    if (purchase && purchase.supplierId) {
                        const supplierId = purchase.supplierId;
                        const typeId = purchase.originalTypeId || (purchase.items?.[0]?.originalTypeId) || 'UNKNOWN';
                        if (stockData[supplierId] && stockData[supplierId][typeId]) {
                            stockData[supplierId][typeId].weightOpened += item.totalKg || 0;
                        }
                    }
                }
            });
        });

        // Calculate total value: (weightPurchased - weightOpened) * avgCostPerKg
        let totalValue = 0;
        Object.values(stockData).forEach(types => {
            Object.values(types).forEach(data => {
                const weightInHand = data.weightPurchased - data.weightOpened;
                if (weightInHand > 0 && data.weightPurchased > 0) {
                    const avgCostPerKg = data.totalCost / data.weightPurchased;
                    totalValue += weightInHand * avgCostPerKg;
                }
            });
        });

        return totalValue;
    }, [state.purchases, state.originalOpenings, state.salesInvoices]);

    // Finished Goods are all other items (not raw materials)
    const fgItems = useMemo(() => {
        const rawMaterialItemIds = new Set(
            state.items.filter(item => {
                const hasOriginalLink = state.originalOpenings.some(oo => oo.itemId === item.id);
                const hasPurchaseLink = state.purchases.some(p => 
                    p.items?.some(pi => pi.originalProductId === item.id) || 
                    p.originalProductId === item.id
                );
                return hasOriginalLink || hasPurchaseLink;
            }).map(i => i.id)
        );
        return state.items.filter(i => !rawMaterialItemIds.has(i.id));
    }, [state.items, state.originalOpenings, state.purchases]);

    const fgValue = fgItems.reduce((acc, i) => acc + ((i?.stockQty || 0) * (i?.avgCost || 0)), 0);

    // Low Stock Alert: Items with stock < 20% of average stock OR < 50 units (whichever is higher)
    // Calculate average stock per item first
    const avgStockPerItem = state.items.length > 0 
        ? state.items.reduce((sum, i) => sum + (i.stockQty || 0), 0) / state.items.length 
        : 0;
    const lowStockThreshold = Math.max(50, avgStockPerItem * 0.2);
    const lowStockItems = state.items.filter(i => 
        i.stockQty > 0 && i.stockQty < lowStockThreshold
    );

    // Non-Moving Items: Items with stock > 0 but NO sales in ANY POSTED invoices
    // Fixed: Check ALL posted invoices, not just last 90 days
    const nonMovingItems = state.items.filter(i => {
        if (i.stockQty <= 0) return false;
        
        // Check if item has sales in ANY POSTED invoices
        const hasAnySales = state.salesInvoices
            .filter(inv => inv.status === 'Posted')
            .some(inv => inv.items.some(si => si.itemId === i.id));
        
        return !hasAnySales;
    });

    // --- Feasibility Logic ---
    const feasibilityData = useMemo(() => {
        return fgItems.map(item => {
            const avgCost = item.avgCost || 0;
            // Fix NaN issue: Check if salePrice is NaN, undefined, or null
            const salePrice = (item.salePrice !== undefined && item.salePrice !== null && !isNaN(item.salePrice)) ? item.salePrice : 0;
            const margin = salePrice - avgCost;
            const marginPct = avgCost > 0 ? (margin / avgCost) * 100 : 0;
            
            // Calculate sales frequency from invoices (if headers exist)
            const salesFreq = state.salesInvoices.filter(inv => inv.status === 'Posted' && inv.items.some(i => i.itemId === item.id)).length;
            
            // Net production change (includes re-baling consumption as negative and production as positive)
            const totalProduced = state.productions.filter(p => p.itemId === item.id).reduce((s, p) => s + p.qtyProduced, 0);
            
            // Calculate totalSold from invoices (primary source)
            // NOTE: If invoice headers are missing, this will be 0 even if sales occurred
            // This is why SINV-1005/1006 showed 0 sold quantities - they had missing headers
            const totalSold = state.salesInvoices
                .filter(inv => inv.status === 'Posted')
                .reduce((s, inv) => s + inv.items.filter(i => i.itemId === item.id).reduce((is, ii) => is + ii.qty, 0), 0);
            const ratio = totalProduced > 0 ? totalSold / totalProduced : 0;

            let score = 0;
            if (margin > 20) score += 3; else if (margin > 10) score += 1;
            if (salesFreq > 5) score += 3; else if (salesFreq > 0) score += 1;
            if (ratio > 0.8 && ratio < 1.2) score += 2; 

            let status: 'Excellent' | 'Good' | 'Average' | 'Review' | 'Poor' = 'Average';
            if (score >= 7) status = 'Excellent';
            else if (score >= 5) status = 'Good';
            else if (score >= 3) status = 'Average';
            else if (totalProduced > 0 && totalSold === 0) status = 'Poor'; 
            else status = 'Review';

            return {
                ...item,
                margin,
                marginPct,
                salesFreq,
                totalProduced,
                totalSold,
                status
            };
        }).sort((a, b) => {
            const order: Record<string, number> = { 'Excellent': 5, 'Good': 4, 'Average': 3, 'Review': 2, 'Poor': 1 };
            return order[b.status] - order[a.status];
        });
    }, [fgItems, state.salesInvoices, state.productions]);

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-blue-600">
                    <p className="text-xs font-bold text-slate-500 uppercase">Raw Material Value</p>
                    <h3 className="text-2xl font-bold text-slate-800">${(rawMaterialValue || 0).toLocaleString()}</h3>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
                    <p className="text-xs font-bold text-slate-500 uppercase">Finished Goods Value</p>
                    <h3 className="text-2xl font-bold text-slate-800">${(fgValue || 0).toLocaleString()}</h3>
                </div>
                <div 
                    className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500 ${lowStockItems.length > 0 ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                    onClick={() => lowStockItems.length > 0 && setShowLowStockPopup(true)}
                >
                    <p className="text-xs font-bold text-slate-500 uppercase">Low Stock Alerts</p>
                    <h3 className="text-2xl font-bold text-slate-800">{lowStockItems.length} <span className="text-sm font-normal text-slate-400">Items</span></h3>
                    <div className="mt-4 flex items-center gap-2">
                         {lowStockItems.length > 0 ? <AlertTriangle size={16} className="text-amber-500" /> : <CheckCircle size={16} className="text-emerald-500" />}
                         <span className="text-xs text-slate-500">{lowStockItems.length > 0 ? 'Action Required' : 'All good'}</span>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-slate-500">
                    <p className="text-xs font-bold text-slate-500 uppercase">Non-Moving (Dead)</p>
                    <h3 className="text-2xl font-bold text-slate-800">{nonMovingItems.length} <span className="text-sm font-normal text-slate-400">Items</span></h3>
                    <div className="mt-4 flex items-center gap-2">
                        {nonMovingItems.length > 0 ? <TrendingUp size={16} className="text-red-500 rotate-90" /> : <CheckCircle size={16} className="text-emerald-500" />}
                        <span className="text-xs text-slate-500">{nonMovingItems.length > 0 ? 'Review Needed' : 'No dead stock'}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-red-50/50 flex justify-between items-center">
                        <h4 className="font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={18} /> Non-Moving Stock</h4>
                        <button className="text-xs bg-white border border-slate-300 px-2 py-1 rounded text-slate-600">Export</button>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3 text-right">Value ($)</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {nonMovingItems.slice(0, 5).map(i => (
                                <tr key={i.id}>
                                    <td className="px-4 py-3 font-medium text-slate-700">{i.name}</td>
                                    <td className="px-4 py-3 text-right">{i.stockQty}</td>
                                    <td className="px-4 py-3 text-right font-mono">${((i.stockQty || 0) * (i.avgCost || 0)).toLocaleString()}</td>
                                </tr>
                            ))}
                            {nonMovingItems.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">Great! No dead stock found.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-blue-50/50">
                        <h4 className="font-bold text-blue-800 flex items-center gap-2"><Layers size={18} /> Stock by Category</h4>
                    </div>
                    <div className="p-4">
                        {(() => {
                            // Calculate category data with value and percentage
                            const categoryData = fgItems.reduce((acc: any[], item) => {
                                            const catName = state.categories.find(c => c.id === item.category)?.name || item.category || 'Uncategorized';
                                const stockValue = (item.stockQty || 0) * (item.avgCost || 0);
                                            const existing = acc.find((x: any) => x.name === catName);
                                if (existing) {
                                    existing.value += stockValue;
                                    existing.qty += (item.stockQty || 0);
                                } else {
                                    acc.push({ name: catName, value: stockValue, qty: (item.stockQty || 0) });
                                }
                                            return acc;
                            }, []);
                            
                            const totalValue = categoryData.reduce((sum, cat) => sum + cat.value, 0);
                            const categoryDataWithPct = categoryData.map(cat => ({
                                ...cat,
                                percentage: totalValue > 0 ? (cat.value / totalValue) * 100 : 0
                            })).sort((a, b) => b.value - a.value);
                            
                            return (
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                                        <BarChart data={categoryDataWithPct} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                            <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                                            <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={120} />
                                            <Tooltip 
                                                cursor={{fill: '#f8fafc'}} 
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: number, name: string) => {
                                                    if (name === 'value') {
                                                        return [`$${value.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 'Value'];
                                                    }
                                                    if (name === 'percentage') {
                                                        return [`${value.toFixed(1)}%`, 'Share'];
                                                    }
                                                    return [value, name];
                                                }}
                                            />
                                            <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]}>
                                                {categoryDataWithPct.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={Object.values(CHART_COLORS)[index % Object.keys(CHART_COLORS).length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                            </ResponsiveContainer>
                                    <div className="mt-4 text-xs text-slate-600 space-y-1">
                                        {categoryDataWithPct.map((cat, idx) => (
                                            <div key={idx} className="flex justify-between">
                                                <span>{cat.name}</span>
                                                <span className="font-mono">${cat.value.toLocaleString(undefined, {minimumFractionDigits: 2})} ({cat.percentage.toFixed(1)}%)</span>
                        </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Stock Movement Report */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><History className="text-purple-600" /> Stock Movement Report</h4>
                        <p className="text-sm text-slate-500">Track inventory changes: Opening Stock → Quantity Sold → Current Stock</p>
                    </div>
                </div>
                
                {/* Filters */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Category</label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">All Categories</option>
                            {state.categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Item</label>
                        <input
                            type="text"
                            value={itemFilter}
                            onChange={(e) => setItemFilter(e.target.value)}
                            placeholder="Search by item name or code..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setCategoryFilter('all');
                                setItemFilter('');
                            }}
                            className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-full">
                        <thead className="bg-white text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                            <tr>
                                <th 
                                    className="px-4 py-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => {
                                        if (sortField === 'itemCode') {
                                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortField('itemCode');
                                            setSortDirection('asc');
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        Item Code
                                        {sortField === 'itemCode' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-4 min-w-[250px] cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => {
                                        if (sortField === 'itemName') {
                                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortField('itemName');
                                            setSortDirection('asc');
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        Item Name
                                        {sortField === 'itemName' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => {
                                        if (sortField === 'openingStock') {
                                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortField('openingStock');
                                            setSortDirection('desc');
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Opening Stock
                                        {sortField === 'openingStock' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => {
                                        if (sortField === 'totalSold') {
                                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortField('totalSold');
                                            setSortDirection('desc');
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Quantity Sold
                                        {sortField === 'totalSold' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th 
                                    className="px-4 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                                    onClick={() => {
                                        if (sortField === 'currentStock') {
                                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortField('currentStock');
                                            setSortDirection('desc');
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Current Stock
                                        {sortField === 'currentStock' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-4 py-4 text-center whitespace-nowrap">Invoices</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(() => {
                                const itemsWithMovements = state.items
                                    .map(item => {
                                        // Calculate total sold from posted invoices
                                        const totalSold = state.salesInvoices
                                            .filter(inv => inv.status === 'Posted')
                                            .reduce((sum, inv) => 
                                                sum + inv.items
                                                    .filter(si => si.itemId === item.id)
                                                    .reduce((itemSum, si) => itemSum + si.qty, 0), 0
                                            );
                                        
                                        // Get invoices that sold this item
                                        const invoicesWithItem = state.salesInvoices
                                            .filter(inv => inv.status === 'Posted' && inv.items.some(si => si.itemId === item.id))
                                            .map(inv => inv.invoiceNo);
                                        
                                        // Opening stock = current stock + total sold
                                        const openingStock = item.stockQty + totalSold;
                                        
                                        return {
                                            item,
                                            totalSold,
                                            invoicesWithItem,
                                            openingStock,
                                            itemCode: item.code || item.id,
                                            itemName: item.name,
                                            currentStock: item.stockQty || 0
                                        };
                                    })
                                    .filter(data => {
                                        // Apply category filter
                                        if (categoryFilter !== 'all' && data.item.category !== categoryFilter) {
                                            return false;
                                        }
                                        // Apply item name/code filter
                                        if (itemFilter && !data.item.name.toLowerCase().includes(itemFilter.toLowerCase()) && 
                                            !(data.item.code || '').toLowerCase().includes(itemFilter.toLowerCase()) &&
                                            !data.item.id.toLowerCase().includes(itemFilter.toLowerCase())) {
                                            return false;
                                        }
                                        return data.totalSold > 0 || data.item.stockQty > 0;
                                    })
                                    .sort((a, b) => {
                                        let aVal: any, bVal: any;
                                        switch (sortField) {
                                            case 'itemCode':
                                                aVal = a.itemCode || '';
                                                bVal = b.itemCode || '';
                                                return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                                            case 'itemName':
                                                aVal = a.itemName || '';
                                                bVal = b.itemName || '';
                                                return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                                            case 'openingStock':
                                                aVal = a.openingStock || 0;
                                                bVal = b.openingStock || 0;
                                                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                                            case 'totalSold':
                                                aVal = a.totalSold || 0;
                                                bVal = b.totalSold || 0;
                                                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                                            case 'currentStock':
                                                aVal = a.currentStock || 0;
                                                bVal = b.currentStock || 0;
                                                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                                            default:
                                                return b.totalSold - a.totalSold;
                                        }
                                    });
                                
                                if (itemsWithMovements.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-400">
                                                No stock movements found. Items will appear here once they are sold via Sales Invoices.
                                            </td>
                                        </tr>
                                    );
                                }
                                
                                return itemsWithMovements.map(({ item, totalSold, invoicesWithItem, openingStock, itemCode, itemName, currentStock }) => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-3 font-mono text-slate-700">{itemCode}</td>
                                        <td className="px-6 py-3 font-medium text-slate-700">{itemName}</td>
                                        <td className="px-6 py-3 text-right font-mono text-slate-600">
                                            {openingStock.toLocaleString()} <span className="text-xs text-slate-400">units</span>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-red-600 font-semibold">
                                            -{totalSold.toLocaleString()} <span className="text-xs text-slate-400">units</span>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-emerald-600 font-bold">
                                            {currentStock.toLocaleString()} <span className="text-xs text-slate-400">units</span>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <div className="flex flex-col gap-1">
                                                {invoicesWithItem.slice(0, 3).map(invNo => (
                                                    <span 
                                                        key={invNo} 
                                                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedInvoiceNos([invNo]);
                                                        }}
                                                    >
                                                        {invNo}
                                                    </span>
                                                ))}
                                                {invoicesWithItem.length > 3 && (
                                                    <span 
                                                        className="text-xs text-blue-600 cursor-pointer hover:underline"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedInvoiceNos(invoicesWithItem);
                                                        }}
                                                    >
                                                        +{invoicesWithItem.length - 3} more
                                                    </span>
                                                )}
                                                {invoicesWithItem.length === 0 && (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ));
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Feasibility Report */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><BadgeCheck className="text-blue-600" /> Feasibility & Profitability Scoring</h4>
                        <p className="text-sm text-slate-500">Strategic analysis of item performance based on margin, velocity, and demand.</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-full">
                        <thead className="bg-white text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-4 min-w-[250px]">Item</th>
                                <th className="px-4 py-4 text-center whitespace-nowrap">Status</th>
                                <th className="px-4 py-4 text-right whitespace-nowrap">Prod. Cost</th>
                                <th className="px-4 py-4 text-right whitespace-nowrap">Sale Price</th>
                                <th className="px-4 py-4 text-right whitespace-nowrap">Margin</th>
                                <th className="px-4 py-4 text-center whitespace-nowrap">Sales Freq</th>
                                <th className="px-4 py-4 text-center whitespace-nowrap">Prod / Sold (Units)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {feasibilityData.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-700">
                                        {item.name}
                                        <div className="text-xs text-slate-400">{state.categories.find(c => c.id === item.category)?.name || item.category}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                            item.status === 'Excellent' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                            item.status === 'Good' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                            item.status === 'Average' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                            item.status === 'Review' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                            'bg-red-100 text-red-700 border-red-200'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono">${((item.avgCost || 0)).toFixed(2)}</td>
                                    <td className="px-6 py-3 text-right font-mono">${((item.salePrice !== undefined && item.salePrice !== null && !isNaN(item.salePrice)) ? item.salePrice : 0).toFixed(2)}</td>
                                    <td className={`px-6 py-3 text-right font-mono font-bold ${(item.margin || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        ${((item.margin || 0)).toFixed(2)} ({((item.marginPct || 0)).toFixed(0)}%)
                                    </td>
                                    <td className="px-6 py-3 text-center">{item.salesFreq}</td>
                                    <td className="px-6 py-3 text-center text-xs">
                                        <span className="font-bold">{item.totalProduced}</span> / <span>{item.totalSold}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Low Stock Items Popup */}
            {showLowStockPopup && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowLowStockPopup(false)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-amber-500 text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <AlertTriangle size={20} /> Low Stock Items ({lowStockItems.length})
                            </h3>
                            <button onClick={() => setShowLowStockPopup(false)} className="text-white hover:bg-amber-600 rounded p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                            <p className="text-sm text-slate-600 mb-4">
                                Items with stock below threshold (Threshold: {lowStockThreshold.toFixed(0)} units or 20% of average stock)
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Item Code</th>
                                            <th className="px-4 py-3 text-left">Item Name</th>
                                            <th className="px-4 py-3 text-right">Current Stock</th>
                                            <th className="px-4 py-3 text-right">Avg Cost</th>
                                            <th className="px-4 py-3 text-right">Value ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {lowStockItems.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-mono text-slate-700">{item.code || item.id}</td>
                                                <td className="px-4 py-3 font-medium text-slate-700">{item.name}</td>
                                                <td className="px-4 py-3 text-right font-mono text-red-600">{item.stockQty || 0}</td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-600">${(item.avgCost || 0).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-800">
                                                    ${((item.stockQty || 0) * (item.avgCost || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Details Popup */}
            {selectedInvoiceNos && selectedInvoiceNos.length > 0 && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedInvoiceNos(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Invoice Details</h3>
                            <button onClick={() => setSelectedInvoiceNos(null)} className="text-white hover:bg-blue-700 rounded p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">
                            {selectedInvoiceNos.map(invNo => {
                                const invoice = state.salesInvoices.find(inv => inv.invoiceNo === invNo);
                                if (!invoice) return null;
                                
                                const customer = state.partners.find(p => p.id === invoice.customerId);
                                
                                return (
                                    <div key={invNo} className="border border-slate-200 rounded-lg p-4">
                                        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-200">
                                            <div>
                                                <p className="text-xs text-slate-500 font-semibold uppercase">Invoice Number</p>
                                                <p className="text-lg font-bold text-slate-800">{invoice.invoiceNo}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-semibold uppercase">Date</p>
                                                <p className="text-lg font-bold text-slate-800">{invoice.date}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-semibold uppercase">Customer</p>
                                                <p className="text-lg font-bold text-slate-800">{customer?.name || 'Unknown'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 font-semibold uppercase">Status</p>
                                                <p className={`text-lg font-bold ${invoice.status === 'Posted' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {invoice.status}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="mb-4">
                                            <p className="text-xs text-slate-500 font-semibold uppercase mb-2">Items</p>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">Item</th>
                                                            <th className="px-3 py-2 text-right">Qty</th>
                                                            <th className="px-3 py-2 text-right">Rate</th>
                                                            <th className="px-3 py-2 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {invoice.items.map((item, idx) => (
                                                            <tr key={idx}>
                                                                <td className="px-3 py-2 font-medium text-slate-700">{item.itemName}</td>
                                                                <td className="px-3 py-2 text-right font-mono text-slate-600">{item.qty}</td>
                                                                <td className="px-3 py-2 text-right font-mono text-slate-600">${item.rate.toFixed(2)}</td>
                                                                <td className="px-3 py-2 text-right font-mono text-slate-800 font-semibold">${item.total.toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 mb-1">Gross Total</p>
                                                <p className="text-lg font-bold text-slate-800">${invoice.grossTotal.toFixed(2)}</p>
                                            </div>
                                            {invoice.discount > 0 && (
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-500 mb-1">Discount</p>
                                                    <p className="text-lg font-bold text-red-600">-${invoice.discount.toFixed(2)}</p>
                                                </div>
                                            )}
                                            {invoice.surcharge > 0 && (
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-500 mb-1">Surcharge</p>
                                                    <p className="text-lg font-bold text-blue-600">+${invoice.surcharge.toFixed(2)}</p>
                                                </div>
                                            )}
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 mb-1">Net Total</p>
                                                <p className="text-xl font-bold text-emerald-600">${invoice.netTotal.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 3. FINANCIAL STATEMENTS COMPONENTS

const ProfitLoss: React.FC = () => {
    const { state } = useData();
    const revenue = state.accounts.filter(a => a.type === AccountType.REVENUE);
    const expenses = state.accounts.filter(a => a.type === AccountType.EXPENSE);

    const totalRev = revenue.reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const totalExp = expenses.reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const netIncome = totalRev - totalExp;

    return (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-4xl mx-auto animate-in fade-in">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Profit & Loss Statement</h2>
            
            <div className="space-y-8">
                <div>
                    <h3 className="text-lg font-bold text-emerald-600 border-b border-emerald-100 pb-2 mb-3">Revenue</h3>
                    <div className="space-y-2">
                        {revenue.map(a => (
                            <div key={a.id} className="flex justify-between text-sm">
                                <span className="text-slate-600">{a.name}</span>
                                <span className="font-mono">{Math.abs(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-emerald-100 flex justify-between font-bold text-slate-800">
                        <span>Total Revenue</span>
                        <span>{(totalRev || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-red-600 border-b border-red-100 pb-2 mb-3">Expenses</h3>
                    <div className="space-y-2">
                        {expenses.map(a => (
                            <div key={a.id} className="flex justify-between text-sm">
                                <span className="text-slate-600">{a.name}</span>
                                <span className="font-mono">{Math.abs(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-red-100 flex justify-between font-bold text-slate-800">
                        <span>Total Expenses</span>
                        <span>{(totalExp || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>

                <div className={`p-4 rounded-xl flex justify-between items-center text-xl font-bold border ${(netIncome || 0) >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <span>Net Income</span>
                    <span>{(netIncome || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
            </div>
        </div>
    );
};

// Ledger Detail Modal Component
const LedgerDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    type: 'account' | 'debtors' | 'creditors' | 'otherPayables' | 'customerAdvances' | 'supplierAdvances' | 'netIncome' | 'accountBreakdown';
    accountId?: string;
    state: any;
}> = ({ isOpen, onClose, title, type, accountId, state }) => {
    if (!isOpen) return null;

    // Get ledger entries for account
    const accountLedgerEntries = useMemo(() => {
        if (type === 'account' && accountId) {
            return state.ledger
                .filter((e: any) => e.accountId === accountId)
                .sort((a: any, b: any) => {
                    // Sort by date ascending (oldest first), then by transaction ID for same date
                    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
                    if (dateDiff !== 0) return dateDiff;
                    return a.transactionId.localeCompare(b.transactionId);
                });
        }
        return [];
    }, [type, accountId, state.ledger]);

    // Get breakdown data for aggregated items
    const breakdownData = useMemo(() => {
        // Helper: build live partner balances from ledger (debits - credits), excluding reporting-only entries
        const buildPartnerBalanceMap = () => {
            const sums = new Map<string, { debit: number; credit: number }>();
            (state.ledger as any[]).forEach((e: any) => {
                if (!e?.accountId) return;
                if (e.isReportingOnly) return;
                const id = String(e.accountId);
                const existing = sums.get(id) || { debit: 0, credit: 0 };
                existing.debit += Number(e.debit || 0);
                existing.credit += Number(e.credit || 0);
                sums.set(id, existing);
            });
            const balances = new Map<string, number>();
            sums.forEach((v, id) => {
                balances.set(id, v.debit - v.credit);
            });
            return balances;
        };

        // Only build the map when we need partner-based aggregates
        const needsPartnerBalances =
            type === 'debtors' ||
            type === 'creditors' ||
            type === 'customerAdvances' ||
            type === 'supplierAdvances';

        const partnerBalanceMap = needsPartnerBalances ? buildPartnerBalanceMap() : null;
        const getLivePartnerBalance = (partnerId: string) => {
            if (partnerBalanceMap && partnerBalanceMap.has(partnerId)) {
                return partnerBalanceMap.get(partnerId) || 0;
            }
            const partner = state.partners.find((p: any) => p.id === partnerId);
            return partner?.balance || 0;
        };

        if (type === 'debtors') {
            // Customers with net DEBIT (they owe us) – show live balances
            const customers = state.partners
                .filter((p: any) => p.type === PartnerType.CUSTOMER)
                .map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    balance: getLivePartnerBalance(p.id)
                }))
                .filter((p: any) => (p.balance || 0) > 0)
                .sort((a: any, b: any) => b.balance - a.balance);

            return customers;
        }
        if (type === 'creditors') {
            const supplierTypes = [
                PartnerType.SUPPLIER,
                PartnerType.VENDOR,
                PartnerType.FREIGHT_FORWARDER,
                PartnerType.CLEARING_AGENT,
                PartnerType.COMMISSION_AGENT
            ];
            // Suppliers with net CREDIT (we owe them) – show live balances, exclude sub-suppliers
            const creditors = state.partners
                .filter((p: any) => supplierTypes.includes(p.type) && p.type !== PartnerType.SUB_SUPPLIER)
                .map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    balance: getLivePartnerBalance(p.id)
                }))
                .filter((p: any) => (p.balance || 0) < 0)
                .map((p: any) => ({ name: p.name, balance: Math.abs(p.balance || 0) }))
                .sort((a: any, b: any) => b.balance - a.balance);

            return creditors;
        }
        if (type === 'otherPayables') {
            return state.accounts
                .filter((a: any) => {
                    const codeNum = parseInt(a.code || '0');
                    return codeNum >= 2030 && codeNum <= 2099 && (a.balance || 0) !== 0;
                })
                .map((a: any) => ({ name: a.name, balance: Math.abs(a.balance || 0) }))
                .sort((a: any, b: any) => b.balance - a.balance);
        }
        if (type === 'customerAdvances') {
            // Customers with net CREDIT (they have paid us in advance) – show live balances
            const advances = state.partners
                .filter((p: any) => p.type === PartnerType.CUSTOMER)
                .map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    balance: getLivePartnerBalance(p.id)
                }))
                .filter((p: any) => (p.balance || 0) < 0)
                .map((p: any) => ({ name: p.name, balance: Math.abs(p.balance || 0) }))
                .sort((a: any, b: any) => b.balance - a.balance);

            return advances;
        }
        if (type === 'supplierAdvances') {
            const supplierTypes = [
                PartnerType.SUPPLIER,
                PartnerType.VENDOR,
                PartnerType.FREIGHT_FORWARDER,
                PartnerType.CLEARING_AGENT,
                PartnerType.COMMISSION_AGENT
            ];
            // Suppliers with net DEBIT (we have advanced them) – show live balances, exclude sub-suppliers
            const advances = state.partners
                .filter((p: any) => supplierTypes.includes(p.type) && p.type !== PartnerType.SUB_SUPPLIER)
                .map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    balance: getLivePartnerBalance(p.id)
                }))
                .filter((p: any) => (p.balance || 0) > 0)
                .map((p: any) => ({ name: p.name, balance: p.balance || 0 }))
                .sort((a: any, b: any) => b.balance - a.balance);

            return advances;
        }
        if (type === 'netIncome') {
            // Revenue accounts (show Sales Discounts as negative/contra-revenue)
            const revenueAccounts = state.accounts
                .filter((a: any) => a.type === AccountType.REVENUE && (a.balance || 0) !== 0)
                .map((a: any) => {
                    const isContraRevenue = a.name.toLowerCase().includes('sales discount');
                    return { 
                        name: a.name, 
                        balance: isContraRevenue ? -Math.abs(a.balance || 0) : Math.abs(a.balance || 0), 
                        type: isContraRevenue ? 'contra-revenue' : 'revenue' 
                    };
                });
            
            // Expense accounts (exclude Raw Material Consumption - it's inventory movement, not expense)
            const expenseAccounts = state.accounts
                .filter((a: any) => {
                    if (a.type !== AccountType.EXPENSE) return false;
                    if ((a.balance || 0) === 0) return false;
                    if (a.name.toLowerCase().includes('raw material consumption')) return false;
                    if (a.name.toLowerCase().includes('sales discount')) return false; // Already in revenue as contra
                    return true;
                })
                .map((a: any) => ({ name: a.name, balance: Math.abs(a.balance || 0), type: 'expense' }));
            
            // Show Raw Material Consumption separately as "Inventory Movement" for clarity
            const rawMatAccount = state.accounts.find((a: any) => 
                a.name.toLowerCase().includes('raw material consumption') && (a.balance || 0) !== 0
            );
            const inventoryMovements = rawMatAccount ? [{ 
                name: `${rawMatAccount.name} (Inventory Movement - Not in P&L)`, 
                balance: Math.abs(rawMatAccount.balance || 0), 
                type: 'inventory-movement' 
            }] : [];
            
            return [...revenueAccounts, ...expenseAccounts, ...inventoryMovements].sort((a: any, b: any) => Math.abs(b.balance) - Math.abs(a.balance));
        }
        if (type === 'accountBreakdown' && accountId) {
            // Get child accounts for the parent account
            const childAccounts = state.accounts
                .filter((a: any) => a.parentAccountId === accountId)
                .map((a: any) => ({ 
                    name: `${a.code} - ${a.name}`, 
                    balance: a.balance || 0 
                }))
                .sort((a: any, b: any) => Math.abs(b.balance) - Math.abs(a.balance));
            return childAccounts;
        }
        return [];
    }, [type, state.partners, state.accounts]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    {type === 'account' && accountLedgerEntries.length > 0 ? (
                        <div className="space-y-4">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Transaction</th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Narration</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Debit</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Credit</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {(() => {
                                        const account = state.accounts.find((a: any) => a.id === accountId);
                                        let runningBalance = 0;
                                        
                                        return accountLedgerEntries.map((entry: any) => {
                                            // Calculate running balance based on account type
                                            if (account && [AccountType.ASSET, AccountType.EXPENSE].includes(account.type)) {
                                                runningBalance += (entry.debit || 0) - (entry.credit || 0);
                                            } else {
                                                runningBalance += (entry.credit || 0) - (entry.debit || 0);
                                            }
                                            
                                            return (
                                                <tr key={entry.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2">{new Date(entry.date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-2">{entry.transactionType} - {entry.transactionId.slice(0, 8)}</td>
                                                    <td className="px-4 py-2">{entry.narration || '-'}</td>
                                                    <td className="px-4 py-2 text-right font-mono">{(entry.debit || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                    <td className="px-4 py-2 text-right font-mono">{(entry.credit || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                    <td className="px-4 py-2 text-right font-mono">{runningBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    ) : type === 'account' ? (
                        <p className="text-slate-500 text-center py-8">No ledger entries found for this account.</p>
                    ) : breakdownData.length > 0 ? (
                        <div className="space-y-4">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Name</th>
                                        {type === 'netIncome' && (
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Type</th>
                                        )}
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {breakdownData.map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-2">{item.name}</td>
                                            {type === 'netIncome' && (
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        item.type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {item.type === 'revenue' ? 'Revenue' : 'Expense'}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-4 py-2 text-right font-mono font-medium">
                                                {item.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="border-t border-slate-200 pt-4 mt-4">
                                <div className="flex justify-between items-center font-bold">
                                    <span>Total</span>
                                    <span className="font-mono">
                                        {breakdownData.reduce((sum: number, item: any) => sum + item.balance, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-center py-8">No data available.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const BalanceSheet: React.FC = () => {
    const { state } = useData();
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalType, setModalType] = useState<'account' | 'debtors' | 'creditors' | 'otherPayables' | 'customerAdvances' | 'supplierAdvances' | 'netIncome' | 'accountBreakdown'>('account');
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
    const [refreshKey, setRefreshKey] = useState(0); // Force recalculation when data is restored
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Force recalculation when refreshKey changes
    useEffect(() => {
        console.log('🔄 Balance Sheet refresh triggered, refreshKey:', refreshKey);
        console.log('🔄 Current ledger entries:', state.ledger.length);
        console.log('🔄 Current accounts:', state.accounts.length);
        console.log('🔄 Current partners:', state.partners.length);
        setIsRefreshing(false);
    }, [refreshKey, state.ledger.length, state.accounts.length, state.partners.length]);
    
    // Helper function to aggregate parent-child accounts
    const aggregateParentChildAccounts = (accounts: any[]) => {
        // Separate parent and child accounts
        // BACKWARD COMPATIBILITY: Existing accounts don't have parentAccountId field (undefined)
        // Treat undefined, null, and empty string as "no parent" (top-level account)
        const parentAccounts = accounts.filter(a => !a.parentAccountId || a.parentAccountId === '');
        const childAccounts = accounts.filter(a => a.parentAccountId && a.parentAccountId !== '');

        // IMPORTANT:
        // If a child points to a parent that is missing from this category (or is in a different AccountType),
        // the child would be excluded from Balance Sheet totals. That can make the Balance Sheet "out"
        // even when the voucher is perfectly balanced.
        const parentIds = new Set(parentAccounts.map(p => p.id));
        const orphanChildren = childAccounts.filter(c => !parentIds.has(c.parentAccountId!));
        const attachableChildren = childAccounts.filter(c => parentIds.has(c.parentAccountId!));
        
        // Create a map of parent ID to children (only attachable children)
        const parentToChildren = new Map<string, any[]>();
        attachableChildren.forEach(child => {
            if (!parentToChildren.has(child.parentAccountId!)) {
                parentToChildren.set(child.parentAccountId!, []);
            }
            parentToChildren.get(child.parentAccountId!)!.push(child);
        });
        
        // Calculate aggregated totals for parents
        const aggregatedParents = parentAccounts.map(parent => {
            const children = parentToChildren.get(parent.id) || [];
            const childrenTotal = children.reduce((sum, child) => sum + (child.balance || 0), 0);
            const aggregatedBalance = (parent.balance || 0) + childrenTotal;
            return {
                ...parent,
                balance: aggregatedBalance, // Use aggregated balance for display
                hasChildren: children.length > 0,
                childrenCount: children.length
            };
        });

        // Treat orphan children as top-level accounts so they are not dropped from totals.
        const orphanAsTopLevel = orphanChildren.map(child => ({
            ...child,
            hasChildren: false,
            childrenCount: 0
        }));

        // Keep a stable ordering for display (by numeric code where possible)
        const displayAccounts = [...aggregatedParents, ...orphanAsTopLevel].sort((a, b) => {
            const aCode = parseInt(a.code || '0', 10);
            const bCode = parseInt(b.code || '0', 10);
            if (!Number.isNaN(aCode) && !Number.isNaN(bCode) && aCode !== bCode) return aCode - bCode;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
        
        return {
            displayAccounts,
            parentToChildrenMap: parentToChildren
        };
    };
    
    // CRITICAL FIX: Create balance hash to detect when account/partner balances change
    // This ensures Balance Sheet recalculates when data is restored (even if ledger.length doesn't change)
    const accountBalanceHash = useMemo(() => {
        return state.accounts.reduce((sum, a) => sum + (a.balance || 0), 0).toFixed(2) + refreshKey;
    }, [state.accounts, refreshKey]);
    const partnerBalanceHash = useMemo(() => {
        return state.partners.reduce((sum, p) => sum + (p.balance || 0), 0).toFixed(2) + refreshKey;
    }, [state.partners, refreshKey]);
    
    // CRITICAL FIX: Force recalculation when ledger OR balances change
    // This ensures Balance Sheet updates dynamically when transactions are posted/deleted OR data is restored
    const allAssets = useMemo(() => 
        state.accounts.filter(a => a.type === AccountType.ASSET),
        [state.accounts, state.ledger.length, accountBalanceHash] // Include balance hash to detect balance changes
    );
    const allLiabilities = useMemo(() => 
        state.accounts.filter(a => a.type === AccountType.LIABILITY),
        [state.accounts, state.ledger.length, accountBalanceHash] // Include balance hash to detect balance changes
    );
    const allEquity = useMemo(() => 
        state.accounts.filter(a => a.type === AccountType.EQUITY),
        [state.accounts, state.ledger.length, accountBalanceHash] // Include balance hash to detect balance changes
    );
    
    // Aggregate parent-child accounts for each category
    const assetsAggregated = useMemo(() => 
        aggregateParentChildAccounts(allAssets),
        [allAssets, state.ledger.length, accountBalanceHash, refreshKey] // Include refreshKey to force recalculation
    );
    const liabilitiesAggregated = useMemo(() => 
        aggregateParentChildAccounts(allLiabilities),
        [allLiabilities, state.ledger.length, accountBalanceHash, refreshKey] // Include refreshKey to force recalculation
    );
    const equityAggregated = useMemo(() => 
        aggregateParentChildAccounts(allEquity),
        [allEquity, state.ledger.length, accountBalanceHash, refreshKey] // Include refreshKey to force recalculation
    );
    
    const assets = assetsAggregated.displayAccounts;
    const liabilities = liabilitiesAggregated.displayAccounts;
    const equity = equityAggregated.displayAccounts;
    
    // DEBUG: Check for Discrepancy account in each category
    const discrepancyInAssets = assets.find(a => a.name.includes('Discrepancy') || a.code === '505');
    const discrepancyInLiabilities = liabilities.find(a => a.name.includes('Discrepancy') || a.code === '505');
    const discrepancyInEquity = equity.find(a => a.name.includes('Discrepancy') || a.code === '505');
    
    if (discrepancyInAssets || discrepancyInEquity) {
        console.error('❌ CRITICAL: Discrepancy account found in wrong category!', {
            inAssets: !!discrepancyInAssets,
            inEquity: !!discrepancyInEquity,
            account: discrepancyInAssets || discrepancyInEquity
        });
    }
    
    // CRITICAL FIX: Wrap calculations in useMemo with state.ledger dependency
    // Regular liabilities (excluding Other Payable accounts 2030-2099 and Discrepancy account)
    // Discrepancy account is handled separately to correctly show decreases as reductions
    const discrepancyAccount = useMemo(() => 
        liabilities.find(a => 
            a.name.includes('Discrepancy') || 
            a.name.includes('Suspense') ||
            a.code === '505'
        ),
        [liabilities, state.ledger.length]
    );
    const regularLiabilities = useMemo(() => 
        liabilities.filter(a => {
            const codeNum = parseInt(a.code || '0');
            // Exclude Other Payable accounts (2030-2099) and Discrepancy account
            if (codeNum >= 2030 && codeNum <= 2099) return false;
            if (discrepancyAccount && a.id === discrepancyAccount.id) return false;
            return true;
        }),
        [liabilities, discrepancyAccount, state.ledger.length]
    );
    
    // Filter "Other Payable" accounts (codes 2030-2099) for aggregation
    const otherPayableAccounts = useMemo(() => 
        liabilities.filter(a => {
            const codeNum = parseInt(a.code || '0');
            return codeNum >= 2030 && codeNum <= 2099;
        }),
        [liabilities, state.ledger.length]
    );
    const totalOtherPayables = useMemo(() => 
        otherPayableAccounts.reduce((sum, a) => sum + Math.abs(a.balance || 0), 0),
        [otherPayableAccounts]
    );
    
    // CRITICAL FIX: Wrap partner calculations in useMemo with state.ledger dependency
    const supplierLikeTypes = [
        PartnerType.SUPPLIER,
        PartnerType.SUB_SUPPLIER,
        PartnerType.VENDOR,
        PartnerType.FREIGHT_FORWARDER,
        PartnerType.CLEARING_AGENT,
        PartnerType.COMMISSION_AGENT
    ];

    // IMPORTANT:
    // Balance Sheet should NOT rely on stored partner.balance because it can be stale right after restore
    // (or if partner balances were not recalculated yet). Instead, compute balances directly from ledger.
    // Convention used across the app for stored partner balance is:
    //   partnerBalance = totalDebits - totalCredits  (customers positive when they owe us; suppliers negative when we owe them)
    const partnerLedgerBalanceMap = useMemo(() => {
        const map = new Map<string, { debit: number; credit: number }>();
        for (const e of state.ledger as any[]) {
            if (!e?.accountId) continue;
            if ((e as any).isReportingOnly) continue;
            const id = String(e.accountId);
            const existing = map.get(id) || { debit: 0, credit: 0 };
            existing.debit += Number(e.debit || 0);
            existing.credit += Number(e.credit || 0);
            map.set(id, existing);
        }
        const balMap = new Map<string, number>();
        map.forEach((v, id) => {
            balMap.set(id, v.debit - v.credit);
        });
        return balMap;
    }, [state.ledger, refreshKey]);

    const getPartnerLiveBalance = useCallback((partnerId: string) => {
        const live = partnerLedgerBalanceMap.get(partnerId);
        if (typeof live === 'number' && !Number.isNaN(live)) return live;
        const fallback = state.partners.find(p => p.id === partnerId)?.balance;
        return fallback || 0;
    }, [partnerLedgerBalanceMap, state.partners]);
    
    // Add customer balances (Accounts Receivable) - grouped as "Debtors" (ledger-derived)
    const customers = useMemo(() => {
        const customerPartners = state.partners.filter(p => p.type === PartnerType.CUSTOMER);
        const customersWithLiveBalance = customerPartners.map(p => {
            const liveBalance = getPartnerLiveBalance(p.id);
            const storedBalance = p.balance || 0;
            if (Math.abs(liveBalance - storedBalance) > 0.01) {
                console.log(`⚠️ Balance mismatch for customer ${p.name}:`, {
                    stored: storedBalance,
                    live: liveBalance,
                    difference: liveBalance - storedBalance
                });
            }
            return { ...p, balance: liveBalance };
        }).filter(p => (p.balance || 0) > 0);
        
        console.log('🔍 Balance Sheet - Debtors Calculation:', {
            totalCustomers: customerPartners.length,
            customersWithPositiveBalance: customersWithLiveBalance.length,
            totalDebtors: customersWithLiveBalance.reduce((sum, c: any) => sum + (c.balance || 0), 0),
            sampleCustomers: customersWithLiveBalance.slice(0, 5).map((c: any) => ({
                name: c.name,
                storedBalance: customerPartners.find(p => p.id === c.id)?.balance,
                liveBalance: c.balance
            }))
        });
        
        return customersWithLiveBalance;
    }, [state.partners, getPartnerLiveBalance, partnerBalanceHash, refreshKey]);
    const totalCustomersAR = useMemo(() => 
        customers.reduce((sum, c: any) => sum + (c.balance || 0), 0),
        [customers]
    );

    // Add negative customer balances (Customer Advances) - grouped as liability (ledger-derived)
    const negativeCustomers = useMemo(() => {
        return state.partners
            .filter(p => p.type === PartnerType.CUSTOMER)
            .map(p => ({ ...p, balance: getPartnerLiveBalance(p.id) }))
            .filter(p => (p.balance || 0) < 0);
    }, [state.partners, getPartnerLiveBalance, partnerBalanceHash, refreshKey]);
    const totalCustomerAdvances = useMemo(() => 
        negativeCustomers.reduce((sum: number, c: any) => sum + Math.abs(c.balance || 0), 0),
        [negativeCustomers]
    );

    // For suppliers: negative balance = we owe them (Accounts Payable), positive balance = they owe us (Advances)
    // EXCLUDE sub-suppliers from Balance Sheet (only show main suppliers)
    const positiveSuppliers = useMemo(() => {
        return state.partners
            .filter(p => supplierLikeTypes.includes(p.type) && p.type !== PartnerType.SUB_SUPPLIER)
            .map(p => ({ ...p, balance: getPartnerLiveBalance(p.id) }))
            .filter(p => (p.balance || 0) > 0);
    }, [state.partners, supplierLikeTypes, getPartnerLiveBalance, partnerBalanceHash, refreshKey]);
    const totalSupplierAdvances = useMemo(() => 
        positiveSuppliers.reduce((sum: number, s: any) => sum + (s.balance || 0), 0),
        [positiveSuppliers]
    );
    
    // Suppliers with negative balance = Accounts Payable (we owe them)
    // Note: Supplier balances should be stored as NEGATIVE when we owe them (credit balance in ledger = negative in partner.balance)
    // EXCLUDE sub-suppliers from Balance Sheet (only show main suppliers)
    const negativeSuppliers = useMemo(() => {
        return state.partners
            .filter(p => supplierLikeTypes.includes(p.type) && p.type !== PartnerType.SUB_SUPPLIER)
            .map(p => ({ ...p, balance: getPartnerLiveBalance(p.id) }))
            .filter(p => (p.balance || 0) < 0);
    }, [state.partners, supplierLikeTypes, getPartnerLiveBalance, partnerBalanceHash, refreshKey]);
    const totalSuppliersAP = useMemo(() => 
        negativeSuppliers.reduce((sum: number, s: any) => sum + Math.abs(s.balance || 0), 0),
        [negativeSuppliers]
    );
    
    // DEBUG: Log supplier balances to console to help diagnose
    console.log('🔍 Balance Sheet - Supplier Analysis:', {
        totalSuppliers: state.partners.filter(p => supplierLikeTypes.includes(p.type)).length,
        negativeSuppliers: negativeSuppliers.length,
        positiveSuppliers: positiveSuppliers.length,
        totalSuppliersAP: totalSuppliersAP.toFixed(2),
        totalSupplierAdvances: totalSupplierAdvances.toFixed(2),
        sampleNegativeSuppliers: negativeSuppliers.slice(0, 3).map(s => ({ name: s.name, balance: s.balance })),
        allSupplierBalances: state.partners
            .filter(p => supplierLikeTypes.includes(p.type) && Math.abs(p.balance || 0) > 1000)
            .map(s => ({ name: s.name, balance: s.balance, type: s.type }))
            .sort((a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0))
            .slice(0, 10)
    });
    
    // FIX 1: Raw Material Consumption is an INVENTORY MOVEMENT, not a true expense
    // It represents transfer from Raw Materials to WIP/Finished Goods
    // FIX 2: Sales Discounts is a CONTRA-REVENUE - should reduce revenue, not be an expense
    const expenseAccounts = useMemo(() => 
        state.accounts.filter(a => 
            a.type === AccountType.EXPENSE && 
            !a.name.toLowerCase().includes('raw material consumption') &&
            !a.name.toLowerCase().includes('sales discount')
        ),
        [state.accounts, state.ledger.length]
    );
    
    // Calculate expenses from account balances (excluding Raw Material Consumption & Sales Discounts)
    const expenses = useMemo(() => {
        let baseExpenses = expenseAccounts.reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);
        
        // FIX: Also include expenses from orphaned ledger entries (entries where accountId doesn't match any account)
        // This handles cases where PB entries were created with account IDs that no longer exist
        const orphanedExpenseEntries = state.ledger.filter((e: any) => {
            // Check if this is an expense entry (debit > 0) but account not found
            if (e.debit > 0 && e.credit === 0) {
                const account = state.accounts.find((a: any) => a.id === e.accountId);
                // If account not found, check if it's an expense-type transaction
                if (!account && (
                    e.transactionType === TransactionType.PURCHASE_BILL ||
                    e.transactionType === TransactionType.EXPENSE_VOUCHER ||
                    e.accountName?.toLowerCase().includes('expense')
                )) {
                    return true;
                }
            }
            return false;
        });
        
        // Calculate expense balance from orphaned entries
        const orphanedExpenses = orphanedExpenseEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
        
        if (orphanedExpenses > 0) {
            console.warn('⚠️ Found orphaned expense ledger entries:', {
                count: orphanedExpenseEntries.length,
                totalAmount: orphanedExpenses,
                entries: orphanedExpenseEntries.map((e: any) => ({
                    transactionId: e.transactionId,
                    accountId: e.accountId,
                    accountName: e.accountName,
                    debit: e.debit
                }))
            });
        }
        
        return baseExpenses + orphanedExpenses;
    }, [expenseAccounts, state.accounts, state.ledger]);
    
    // Handle Sales Discounts: subtract from revenue (contra-revenue)
    const salesDiscountAccount = useMemo(() => 
        state.accounts.find(a => a.name.toLowerCase().includes('sales discount')),
        [state.accounts, state.ledger.length]
    );
    const salesDiscountValue = useMemo(() => 
        salesDiscountAccount ? Math.abs(salesDiscountAccount.balance || 0) : 0,
        [salesDiscountAccount]
    );
    
    // Revenue minus Sales Discounts
    const grossRevenue = useMemo(() => 
        state.accounts.filter(a => a.type === AccountType.REVENUE).reduce((sum, a) => sum + Math.abs(a.balance || 0), 0),
        [state.accounts, state.ledger.length]
    );
    const revenue = useMemo(() => 
        grossRevenue - salesDiscountValue,
        [grossRevenue, salesDiscountValue]
    );
    
    const netIncome = useMemo(() => 
        revenue - expenses,
        [revenue, expenses]
    );

    // DEBUG: Log expense accounts for PB voucher investigation
    const expenseAccountsWithBalance = expenseAccounts.filter(a => (a.balance || 0) !== 0);
    
    // Check PB-1001 entries in detail
    const pb1001LedgerEntries = state.ledger.filter((e: any) => e.transactionId === 'PB-1001');
    if (pb1001LedgerEntries.length > 0) {
        pb1001LedgerEntries.forEach((e: any, index: number) => {
            const account = state.accounts.find((a: any) => a.id === e.accountId);
            const partner = state.partners.find((p: any) => p.id === e.accountId);
            
            // Try to find account by name if ID doesn't match
            const accountByName = state.accounts.find((a: any) => 
                a.name.toLowerCase() === e.accountName?.toLowerCase() ||
                a.name.toLowerCase().includes('expense') && e.accountName?.toLowerCase().includes('expense')
            );
            
            console.log(`🔍 PB-1001 Entry ${index + 1}:`, {
                accountId: e.accountId,
                accountName: e.accountName,
                accountFound: !!account,
                accountType: account?.type,
                accountCode: account?.code,
                accountBalance: account?.balance,
                isPartner: !!partner,
                partnerName: partner?.name,
                partnerBalance: partner?.balance,
                accountFoundByName: !!accountByName,
                accountByNameId: accountByName?.id,
                accountByNameType: accountByName?.type,
                debit: e.debit,
                credit: e.credit,
                transactionType: e.transactionType,
                narration: e.narration,
                allAccountIds: state.accounts.map((a: any) => ({ id: a.id, name: a.name, type: a.type })).slice(0, 5)
            });
        });
    }
    
    // Always log expense accounts (even if balance is 0) to debug PB-1001 issue
    console.log('🔍 Balance Sheet - Expense Accounts:', {
        totalExpenseAccounts: expenseAccounts.length,
        expenseAccountsWithBalance: expenseAccountsWithBalance.length,
        totalExpenses: expenses,
        allExpenseAccounts: expenseAccounts.map(a => ({
            name: a.name,
            code: a.code,
            balance: a.balance,
            absBalance: Math.abs(a.balance || 0),
            id: a.id
        })),
        expenseAccountsWithBalanceList: expenseAccountsWithBalance.map(a => ({
            name: a.name,
            code: a.code,
            balance: a.balance,
            absBalance: Math.abs(a.balance || 0)
        })),
        // Check for PB-1001 ledger entries
        pb1001Entries: state.ledger.filter((e: any) => e.transactionId === 'PB-1001').map((e: any) => {
            const account = state.accounts.find((a: any) => a.id === e.accountId);
            return {
                accountId: e.accountId,
                accountName: e.accountName,
                accountType: account?.type,
                accountCode: account?.code,
                accountBalance: account?.balance,
                debit: e.debit,
                credit: e.credit,
                transactionType: e.transactionType,
                narration: e.narration
            };
        }),
        // Check all expense accounts to see their balances
        sampleExpenseAccounts: expenseAccounts.slice(0, 5).map(a => ({
            name: a.name,
            code: a.code,
            id: a.id,
            balance: a.balance,
            ledgerEntries: state.ledger.filter((e: any) => e.accountId === a.id).length,
            totalDebits: state.ledger.filter((e: any) => e.accountId === a.id).reduce((sum: number, e: any) => sum + (e.debit || 0), 0),
            totalCredits: state.ledger.filter((e: any) => e.accountId === a.id).reduce((sum: number, e: any) => sum + (e.credit || 0), 0)
        }))
    });

    // CRITICAL FIX: Wrap totals in useMemo with state.ledger dependency
    const totalAssets = useMemo(() => 
        assets.reduce((sum, a) => sum + (a.balance || 0), 0) + totalCustomersAR + totalSupplierAdvances,
        [assets, totalCustomersAR, totalSupplierAdvances, state.ledger.length, refreshKey]
    );
    
    // Calculate regular liabilities (excluding Discrepancy account which is handled separately)
    const regularLiabilitiesTotal = useMemo(() => 
        regularLiabilities.reduce((sum, a) => sum + Math.abs(a.balance || 0), 0),
        [regularLiabilities, state.ledger.length, refreshKey]
    );
    
    // Handle Discrepancy account separately:
    // For LIABILITY type Discrepancy account:
    // - Positive balance = we've increased liabilities (add to total)
    // - Negative balance = we've decreased liabilities (subtract from total, or show as reduction)
    const discrepancyAdjustment = useMemo(() => {
        if (discrepancyAccount) {
            const discrepancyBalance = discrepancyAccount.balance || 0;
            if (discrepancyAccount.type === AccountType.LIABILITY) {
                // For LIABILITY: negative balance means we decreased liabilities (good), so subtract from total
                // Positive balance means we increased liabilities (bad), so add to total
                return discrepancyBalance; // Use actual balance (negative = reduction, positive = increase)
            }
        }
        return 0;
    }, [discrepancyAccount, state.ledger.length]);
    
    // For Discrepancy account (LIABILITY):
    // - Positive balance = liability increased, so add to total
    // - Negative balance = liability decreased, so subtract from total (add negative = subtract)
    // IMPORTANT: Use discrepancyAdjustment directly (don't use || 0 because -300 || 0 = -300, but we want to handle 0 correctly)
    const totalLiabilities = useMemo(() => 
        regularLiabilitiesTotal + totalOtherPayables + totalSuppliersAP + totalCustomerAdvances + discrepancyAdjustment,
        [regularLiabilitiesTotal, totalOtherPayables, totalSuppliersAP, totalCustomerAdvances, discrepancyAdjustment, state.ledger.length, refreshKey]
    );
    // FIXED: Equity should preserve negative balances (like negative inventory costs)
    // If Discrepancy is EQUITY type, include it in equity calculation
    const discrepancyEquityAdjustment = useMemo(() => 
        discrepancyAccount && discrepancyAccount.type === AccountType.EQUITY ? (discrepancyAccount.balance || 0) : 0,
        [discrepancyAccount, state.ledger.length]
    );
    const totalEquity = useMemo(() => 
        equity.reduce((sum, a) => sum + (a.balance || 0), 0) + netIncome + discrepancyEquityAdjustment,
        [equity, netIncome, discrepancyEquityAdjustment, state.ledger.length, refreshKey]
    );
    
    // DEBUG: Log Balance Sheet calculation details
    if (discrepancyAccount) {
        console.log('🔍 Balance Sheet - Discrepancy Account Analysis:', {
            name: discrepancyAccount.name,
            code: discrepancyAccount.code,
            balance: discrepancyAccount.balance,
            absBalance: Math.abs(discrepancyAccount.balance || 0),
            includedInTotalLiabilities: true,
            ledgerEntries: state.ledger.filter((e: any) => e.accountId === discrepancyAccount.id).map((e: any) => ({
                date: e.date,
                transactionId: e.transactionId,
                debit: e.debit,
                credit: e.credit,
                narration: e.narration?.substring(0, 50)
            }))
        });
    }
    
    console.log('🔍 Balance Sheet - Totals:', {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
        difference: (totalLiabilities + totalEquity) - totalAssets,
        assetsBreakdown: {
            assetAccounts: assets.reduce((sum, a) => sum + (a.balance || 0), 0),
            customersAR: totalCustomersAR,
            supplierAdvances: totalSupplierAdvances
        },
        liabilitiesBreakdown: {
            regularLiabilities: regularLiabilities.reduce((sum, a) => sum + Math.abs(a.balance || 0), 0),
            otherPayables: totalOtherPayables,
            suppliersAP: totalSuppliersAP,
            customerAdvances: totalCustomerAdvances
        },
        equityBreakdown: {
            equityAccounts: equity.reduce((sum, a) => sum + (a.balance || 0), 0),
            revenue: revenue,
            expenses: expenses,
            netIncome: netIncome
        }
    });

    const handleAccountClick = (accountId: string, accountName: string) => {
        // Check if this account has children (aggregated account)
        const account = state.accounts.find(a => a.id === accountId);
        const hasChildren = account && !account.parentAccountId && 
            state.accounts.some(a => a.parentAccountId === accountId);
        
        if (hasChildren) {
            // Show breakdown modal for parent account
            setModalTitle(`${accountName} - Breakdown`);
            setModalType('accountBreakdown');
            setSelectedAccountId(accountId);
            setModalOpen(true);
        } else {
            // Show regular account ledger
            setModalTitle(accountName);
            setModalType('account');
            setSelectedAccountId(accountId);
            setModalOpen(true);
        }
    };

    const handleAggregatedClick = (title: string, type: 'debtors' | 'creditors' | 'otherPayables' | 'customerAdvances' | 'supplierAdvances' | 'netIncome') => {
        setModalTitle(title);
        setModalType(type);
        setSelectedAccountId(undefined);
        setModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-800">Balance Sheet</h2>
                <button
                    onClick={() => {
                        console.log('🔄 Refresh button clicked, forcing Balance Sheet recalculation...');
                        setIsRefreshing(true);
                        setRefreshKey(prev => {
                            const newKey = prev + 1;
                            console.log('🔄 Refresh key updated:', newKey);
                            return newKey;
                        });
                    }}
                    disabled={isRefreshing}
                    className={`px-4 py-2 ${isRefreshing ? 'bg-blue-400' : 'bg-blue-600'} text-white rounded-lg ${isRefreshing ? '' : 'hover:bg-blue-700'} font-semibold flex items-center gap-2 transition-colors disabled:cursor-not-allowed`}
                    title="Refresh Balance Sheet (recalculates from current ledger data)"
                >
                    <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            <div className="grid grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Assets</h3>
                    <div className="space-y-2">
                        {assets.filter(a => a && a.balance !== undefined && (a.balance || 0) !== 0).map(a => (
                            <div 
                                key={a.id} 
                                className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded"
                                onClick={() => handleAccountClick(a.id, a.name)}
                            >
                                <span className="text-slate-600 hover:text-blue-600">
                                    {a.name}
                                </span>
                                <span className="font-mono font-medium">
                                    {(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </span>
                            </div>
                        ))}
                        {totalCustomersAR > 0 && (
                            <div className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded" onClick={() => handleAggregatedClick('Debtors (Accounts Receivable)', 'debtors')}>
                                <span className="text-slate-600 font-medium hover:text-blue-600">Debtors (Accounts Receivable)</span>
                                <span className="font-mono font-medium">{totalCustomersAR.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        )}
                        {totalSupplierAdvances > 0 && (
                            <div className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded" onClick={() => handleAggregatedClick('Advances to Suppliers', 'supplierAdvances')}>
                                <span className="text-slate-600 font-medium hover:text-blue-600">Advances to Suppliers</span>
                                <span className="font-mono font-medium">{totalSupplierAdvances.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        )}
                    </div>
                    <div className="border-t border-slate-200 mt-4 pt-2 flex justify-between font-bold text-slate-800">
                        <span>Total Assets</span>
                        <span>{(totalAssets || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Liabilities & Equity</h3>
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Liabilities</h4>
                            <div className="space-y-2">
                                {regularLiabilities.filter(a => a && a.balance !== undefined && (a.balance || 0) !== 0).map(a => (
                                    <div 
                                        key={a.id} 
                                        className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded"
                                        onClick={() => handleAccountClick(a.id, a.name)}
                                    >
                                        <span className="text-slate-600 hover:text-blue-600">
                                            {a.name}
                                        </span>
                                        <span className="font-mono font-medium">
                                            {Math.abs(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                ))}
                                {/* Display Discrepancy account separately with correct sign handling */}
                                {discrepancyAccount && (discrepancyAccount.balance || 0) !== 0 && discrepancyAccount.type === AccountType.LIABILITY && (
                                    <div key={discrepancyAccount.id} className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded" onClick={() => handleAccountClick(discrepancyAccount.id, discrepancyAccount.name)}>
                                        <span className="text-slate-600 hover:text-blue-600">{discrepancyAccount.name}</span>
                                        <span className={`font-mono font-medium ${(discrepancyAccount.balance || 0) < 0 ? 'text-green-600' : ''}`}>
                                            {(discrepancyAccount.balance || 0) < 0 
                                                ? `(${Math.abs(discrepancyAccount.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})})` 
                                                : Math.abs(discrepancyAccount.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                )}
                                {totalOtherPayables > 0 && (
                                    <div className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded" onClick={() => handleAggregatedClick('Other Payables', 'otherPayables')}>
                                        <span className="text-slate-600 font-medium hover:text-blue-600">Other Payables</span>
                                        <span className="font-mono font-medium">{totalOtherPayables.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                )}
                                {totalSuppliersAP > 0 && (
                                    <div className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded" onClick={() => handleAggregatedClick('Creditors (Accounts Payable)', 'creditors')}>
                                        <span className="text-slate-600 font-medium hover:text-blue-600">Creditors (Accounts Payable)</span>
                                        <span className="font-mono font-medium">{totalSuppliersAP.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                )}
                                {totalCustomerAdvances > 0 && (
                                    <div className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded" onClick={() => handleAggregatedClick('Customer Advances (Credit Balances)', 'customerAdvances')}>
                                        <span className="text-slate-600 font-medium hover:text-blue-600">Customer Advances (Credit Balances)</span>
                                        <span className="font-mono font-medium text-blue-700">{totalCustomerAdvances.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-slate-100 mt-2 pt-1 flex justify-between text-sm font-bold text-slate-700">
                                <span>Total Liabilities</span>
                                <span>{(totalLiabilities || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Equity</h4>
                            <div className="space-y-2">
                                {equity.filter(a => a && a.balance !== undefined && (a.balance || 0) !== 0).map(a => (
                                    <div 
                                        key={a.id} 
                                        className="flex justify-between text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded"
                                        onClick={() => handleAccountClick(a.id, a.name)}
                                    >
                                        <span className="text-slate-600 hover:text-blue-600">
                                            {a.name}
                                        </span>
                                        {/* FIXED: Show actual balance (can be negative for items with negative cost) */}
                                        <span className={`font-mono font-medium ${(a?.balance || 0) < 0 ? 'text-red-600' : ''}`}>
                                            {(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm bg-emerald-50 p-1 rounded cursor-pointer hover:bg-emerald-100" onClick={() => handleAggregatedClick('Net Income (Current)', 'netIncome')}>
                                    <span className="text-emerald-700 font-medium hover:text-emerald-800">Net Income (Current)</span>
                                    <span className="font-mono font-bold text-emerald-700">{(netIncome || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                            <div className="border-t border-slate-100 mt-2 pt-1 flex justify-between text-sm font-bold text-slate-700">
                                <span>Total Equity</span>
                                <span>{(totalEquity || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t-2 border-slate-200 mt-4 pt-2 flex justify-between font-bold text-slate-800 text-lg">
                        <span>Total Liabilities & Equity</span>
                        <span>{((totalLiabilities || 0) + (totalEquity || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>
            <LedgerDetailModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalTitle}
                type={modalType}
                accountId={selectedAccountId}
                state={state}
            />
        </div>
    );
};

const ReceiptsPaymentsPlanner: React.FC = () => {
    const { 
        state, 
        addPlannerEntry, 
        updatePlannerEntry, 
        deleteEntity,
        addPlannerCustomer,
        removePlannerCustomer,
        addPlannerSupplier,
        removePlannerSupplier,
        setPlannerWeeklyReset,
        setPlannerMonthlyReset
    } = useData();
    const [periodType, setPeriodType] = useState<PlannerPeriodType>('MONTHLY');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
    const [addSupplierModalOpen, setAddSupplierModalOpen] = useState(false);
    const [resetPromptShown, setResetPromptShown] = useState(false);

    const { currentPeriod, nextPeriodStartDate, lastPeriodStartDate, lastPeriodEndDate } = useMemo(() => 
        getNextPeriodDates(periodType, currentDate), 
    [periodType, currentDate]);

    // Auto-prompt reset mechanism when new period detected
    useEffect(() => {
        if (resetPromptShown) return; // Only show once per page load
        
        const lastResetDate = periodType === 'WEEKLY' 
            ? state.plannerLastWeeklyReset 
            : state.plannerLastMonthlyReset;
        
        if (!lastResetDate) {
            // First time - set current period start as reset date
            const resetDate = lastPeriodStartDate.toISOString().split('T')[0];
            if (periodType === 'WEEKLY') {
                setPlannerWeeklyReset(resetDate);
            } else {
                setPlannerMonthlyReset(resetDate);
            }
            return;
        }

        const lastReset = new Date(lastResetDate);
        const currentPeriodStart = lastPeriodStartDate;
        
        // Check if we're in a new period
        if (currentPeriodStart > lastReset) {
            setResetPromptShown(true);
            
            const userChoice = window.confirm(
                `A new ${periodType.toLowerCase()} period (${currentPeriod}) has started!\n\n` +
                `Would you like to:\n` +
                `• Click OK: Start New Plan (archive current plan, calculate actuals, reset to zero)\n` +
                `• Click Cancel: Continue with Old Plan (keep current values)`
            );
            
            if (userChoice) {
                // Option 1: Start New Plan (Rolling Logic)
                // Get plans from the period that just ended (matching the current period type)
                const periodPattern = periodType === 'WEEKLY' ? /^\d{4}-W\d{2}$/ : /^\d{4}-\d{2}$/;
                const latestPeriod = state.planners
                    .filter(p => {
                        // Match period type (weekly: YYYY-WW, monthly: YYYY-MM)
                        return periodPattern.test(p.period) && p.period !== currentPeriod;
                    })
                    .reduce((latest, p) => p.period > latest ? p.period : latest, '');
                
                if (latestPeriod) {
                    const plansToArchive = state.planners.filter(p => p.period === latestPeriod);
                    
                    plansToArchive.forEach(plan => {
                        // Calculate last period's actual (only receipts/payments)
                        const lastActual = calculatePeriodActuals(
                            state.ledger, 
                            plan.entityId, 
                            plan.entityType, 
                            lastPeriodStartDate, 
                            lastPeriodEndDate
                        );
                        
                        // Check if plan exists for current period
                        const existingCurrentPlan = state.planners.find(
                            p => p.period === currentPeriod && 
                                 p.entityId === plan.entityId && 
                                 p.entityType === plan.entityType
                        );
                        
                        if (existingCurrentPlan) {
                            // Update: Archive current plan to last plan, calculate actuals, clear current
                            updatePlannerEntry({
                                ...existingCurrentPlan,
                                lastPlanAmount: existingCurrentPlan.plannedAmount,
                                lastActualAmount: lastActual,
                                plannedAmount: 0 // Reset to zero
                            });
                        } else {
                            // Create new entry with archived data
                            addPlannerEntry({
                                id: Math.random().toString(36).substr(2, 9),
                                period: currentPeriod,
                                entityId: plan.entityId,
                                entityType: plan.entityType,
                                plannedAmount: 0, // Reset to zero
                                lastPlanAmount: plan.plannedAmount,
                                lastActualAmount: lastActual
                            });
                        }
                    });
                }
                
                // Update reset date
                const resetDate = currentPeriodStart.toISOString().split('T')[0];
                if (periodType === 'WEEKLY') {
                    setPlannerWeeklyReset(resetDate);
                } else {
                    setPlannerMonthlyReset(resetDate);
                }
            } else {
                // Option 2: Continue with Old Plan
                const resetDate = new Date().toISOString().split('T')[0];
                if (periodType === 'WEEKLY') {
                    setPlannerWeeklyReset(resetDate);
                } else {
                    setPlannerMonthlyReset(resetDate);
                }
            }
        }
    }, [periodType, currentPeriod, lastPeriodStartDate, state.plannerLastWeeklyReset, state.plannerLastMonthlyReset, state.planners, state.ledger, lastPeriodEndDate, resetPromptShown, addPlannerEntry, updatePlannerEntry, setPlannerWeeklyReset, setPlannerMonthlyReset]);


    const currentPeriodPlans = useMemo(() => state.planners.filter(p => p.period === currentPeriod), [state.planners, currentPeriod]);

    // Only show customers that are in plannerCustomerIds list
    const customerPlans = useMemo(() => {
        return state.plannerCustomerIds
            .map(customerId => {
                const customer = state.partners.find(p => p.id === customerId && p.type === PartnerType.CUSTOMER);
                if (!customer) return null;
                
                const plan = currentPeriodPlans.find(
                    p => p.entityId === customer.id && p.entityType === PlannerEntityType.CUSTOMER
                );
                const lastActual = calculatePeriodActuals(
                    state.ledger, 
                    customer.id, 
                    PlannerEntityType.CUSTOMER, 
                    lastPeriodStartDate, 
                    lastPeriodEndDate
                );
                
                return {
                    customer,
                    receivable: customer.balance, // Total receivable till date
                    lastPlan: plan?.lastPlanAmount || 0,
                    lastActual, // Last period's actual (receipts only)
                    lastActivity: lastActual, // Same as lastActual (for display)
                    currentPlan: plan?.plannedAmount || 0,
                    plannerId: plan?.id
                };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
    }, [state.plannerCustomerIds, state.partners, currentPeriodPlans, state.ledger, lastPeriodStartDate, lastPeriodEndDate]);

    // Only show suppliers that are in plannerSupplierIds list
    const supplierPlans = useMemo(() => {
        return state.plannerSupplierIds
            .map(supplierId => {
                const supplier = state.partners.find(p => p.id === supplierId && p.type === PartnerType.SUPPLIER);
                if (!supplier) return null;
                
                const plan = currentPeriodPlans.find(
                    p => p.entityId === supplier.id && p.entityType === PlannerEntityType.SUPPLIER
                );
                const lastActual = calculatePeriodActuals(
                    state.ledger, 
                    supplier.id, 
                    PlannerEntityType.SUPPLIER, 
                    lastPeriodStartDate, 
                    lastPeriodEndDate
                );
                
                return {
                    supplier,
                    payable: supplier.balance, // Total payable till date
                    lastPlan: plan?.lastPlanAmount || 0,
                    lastActual, // Last period's actual (payments only)
                    lastActivity: lastActual, // Same as lastActual (for display)
                    currentPlan: plan?.plannedAmount || 0,
                    plannerId: plan?.id
                };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);
    }, [state.plannerSupplierIds, state.partners, currentPeriodPlans, state.ledger, lastPeriodStartDate, lastPeriodEndDate]);

    const handlePlanChange = useCallback((entityId: string, entityType: PlannerEntityType, value: number, plannerId?: string) => {
        const existingPlan = state.planners.find(p => p.id === plannerId);
        if (existingPlan) {
            updatePlannerEntry({ ...existingPlan, plannedAmount: value });
        } else {
            addPlannerEntry({
                id: Math.random().toString(36).substr(2, 9),
                period: currentPeriod,
                entityId,
                entityType,
                plannedAmount: value,
                lastActualAmount: 0,
                lastPlanAmount: 0
            });
        }
    }, [state.planners, currentPeriod, addPlannerEntry, updatePlannerEntry]);

    const handleAddCustomer = useCallback((customerId: string) => {
        addPlannerCustomer(customerId);
        handlePlanChange(customerId, PlannerEntityType.CUSTOMER, 0);
        setAddCustomerModalOpen(false);
    }, [addPlannerCustomer, handlePlanChange]);

    const handleRemoveCustomer = useCallback((customerId: string, plannerId?: string) => {
        if (plannerId) {
            deleteEntity('planners', plannerId);
        }
        removePlannerCustomer(customerId);
    }, [deleteEntity, removePlannerCustomer]);

    const handleAddSupplier = useCallback((supplierId: string) => {
        addPlannerSupplier(supplierId);
        handlePlanChange(supplierId, PlannerEntityType.SUPPLIER, 0);
        setAddSupplierModalOpen(false);
    }, [addPlannerSupplier, handlePlanChange]);

    const handleRemoveSupplier = useCallback((supplierId: string, plannerId?: string) => {
        if (plannerId) {
            deleteEntity('planners', plannerId);
        }
        removePlannerSupplier(supplierId);
    }, [deleteEntity, removePlannerSupplier]);
    
    const totalPlannedReceipts = customerPlans.reduce((sum, p) => sum + p.currentPlan, 0);
    const totalPlannedPayments = supplierPlans.reduce((sum, p) => sum + p.currentPlan, 0);

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setPeriodType('WEEKLY')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${periodType === 'WEEKLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Weekly</button>
                    <button onClick={() => setPeriodType('MONTHLY')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${periodType === 'MONTHLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Monthly</button>
                </div>
                <span className="font-bold text-slate-700">{currentPeriod} Plan</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Receivables */}
                <div className="bg-white rounded-xl border border-blue-200 shadow-sm flex flex-col">
                    <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                        <h4 className="font-bold text-blue-800 flex items-center gap-2"><ArrowDownRight size={18}/> Customer Receivables Planner</h4>
                        <button onClick={() => setAddCustomerModalOpen(true)} className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-bold hover:bg-blue-50"><Plus size={14}/></button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left min-w-full">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2 min-w-[200px]">Customer</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">Current Balance</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">Last Activity</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">Last Period's Plan</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">Last Period's Actual</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">This Period's Plan</th>
                                    <th className="px-4 py-2 text-center whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {customerPlans.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-slate-400">
                                            No customers added to planner. Click the + button to add.
                                        </td>
                                    </tr>
                                ) : (
                                    customerPlans.map(p => (
                                        <tr key={p.customer.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 font-medium text-slate-700">{p.customer.name}</td>
                                            <td className="px-4 py-2 text-right font-mono">${p.receivable.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-600">${p.lastActivity.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-500">${p.lastPlan.toLocaleString()}</td>
                                            <td className={`px-4 py-2 text-right font-mono ${p.lastActual >= p.lastPlan ? 'text-emerald-600' : 'text-red-500'}`}>
                                                ${p.lastActual.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    step="0.01"
                                                    value={p.currentPlan} 
                                                    onChange={e => {
                                                        const value = parseFloat(e.target.value || '0');
                                                        if (value >= 0) {
                                                            handlePlanChange(p.customer.id, PlannerEntityType.CUSTOMER, value, p.plannerId);
                                                        }
                                                    }} 
                                                    className="w-24 border border-blue-300 rounded-lg p-1 text-right bg-blue-50 text-blue-700 text-sm font-bold"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm(`Are you sure you want to remove "${p.customer.name}" from the planner?`)) {
                                                            handleRemoveCustomer(p.customer.id, p.plannerId);
                                                        }
                                                    }} 
                                                    className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                                                    title="Remove from planner"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 border-t border-blue-100 bg-blue-50 text-blue-800 font-bold text-sm flex justify-between">
                        <span>Total Planned Receipts</span>
                        <span>${totalPlannedReceipts.toLocaleString()}</span>
                    </div>
                </div>

                {/* Supplier Payables */}
                <div className="bg-white rounded-xl border border-red-200 shadow-sm flex flex-col">
                    <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                        <h4 className="font-bold text-red-800 flex items-center gap-2"><ArrowUpRight size={18}/> Supplier Payables Planner</h4>
                        <button onClick={() => setAddSupplierModalOpen(true)} className="bg-white text-red-600 px-3 py-1 rounded text-sm font-bold hover:bg-red-50"><Plus size={14}/></button>
                    </div>
                     <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left min-w-full">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2 min-w-[200px]">Supplier</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">Current Balance</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">Last Activity</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">Last Period's Plan</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">Last Period's Actual</th>
                                    <th className="px-4 py-2 text-right whitespace-nowrap">This Period's Plan</th>
                                    <th className="px-4 py-2 text-center whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {supplierPlans.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-slate-400">
                                            No suppliers added to planner. Click the + button to add.
                                        </td>
                                    </tr>
                                ) : (
                                    supplierPlans.map(p => (
                                        <tr key={p.supplier.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 font-medium text-slate-700">{p.supplier.name}</td>
                                            <td className="px-4 py-2 text-right font-mono">${Math.abs(p.payable).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-600">${p.lastActivity.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-500">${p.lastPlan.toLocaleString()}</td>
                                            <td className={`px-4 py-2 text-right font-mono ${p.lastActual <= p.lastPlan ? 'text-emerald-600' : 'text-red-500'}`}>
                                                ${p.lastActual.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    step="0.01"
                                                    value={p.currentPlan} 
                                                    onChange={e => {
                                                        const value = parseFloat(e.target.value || '0');
                                                        if (value >= 0) {
                                                            handlePlanChange(p.supplier.id, PlannerEntityType.SUPPLIER, value, p.plannerId);
                                                        }
                                                    }} 
                                                    className="w-24 border border-red-300 rounded-lg p-1 text-right bg-red-50 text-red-700 text-sm font-bold"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm(`Are you sure you want to remove "${p.supplier.name}" from the planner?`)) {
                                                            handleRemoveSupplier(p.supplier.id, p.plannerId);
                                                        }
                                                    }} 
                                                    className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                                                    title="Remove from planner"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 border-t border-red-100 bg-red-50 text-red-800 font-bold text-sm flex justify-between">
                        <span>Total Planned Payments</span>
                        <span>${totalPlannedPayments.toLocaleString()}</span>
                    </div>
                </div>
            </div>
             {/* Modals */}
             {addCustomerModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Add Customer to Plan</h3>
                        <EntitySelector 
                            entities={state.partners.filter(
                                p => p.type === PartnerType.CUSTOMER && 
                                     !state.plannerCustomerIds.includes(p.id)
                            )} 
                            selectedId="" 
                            onSelect={handleAddCustomer} 
                            placeholder="Select Customer..."
                        />
                        <button onClick={() => setAddCustomerModalOpen(false)} className="mt-4 w-full text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                    </div>
                </div>
            )}
            {addSupplierModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Add Supplier to Plan</h3>
                        <EntitySelector 
                            entities={state.partners.filter(
                                p => p.type === PartnerType.SUPPLIER && 
                                     !state.plannerSupplierIds.includes(p.id)
                            )} 
                            selectedId="" 
                            onSelect={handleAddSupplier} 
                            placeholder="Select Supplier..."
                        />
                        <button onClick={() => setAddSupplierModalOpen(false)} className="mt-4 w-full text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};


const ExpensePlanner: React.FC = () => {
    const { state, addPlannerEntry, updatePlannerEntry, deleteEntity } = useData();
    const [periodType, setPeriodType] = useState<PlannerPeriodType>('MONTHLY');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [addExpenseModalOpen, setAddExpenseModalOpen] = useState(false);

    const { currentPeriod, nextPeriodStartDate, lastPeriodStartDate, lastPeriodEndDate } = useMemo(() => 
        getNextPeriodDates(periodType, currentDate), 
    [periodType, currentDate]);

    useEffect(() => {
        const latestPlannedPeriod = state.planners.reduce((latest: string, p) => 
            p.period > latest ? p.period : latest, 
            '');

        if (latestPlannedPeriod && latestPlannedPeriod !== currentPeriod) {
            const today = new Date();
            if (lastPeriodEndDate < today) {
                 if (window.confirm(`A new ${periodType.toLowerCase()} period (${currentPeriod}) has started! Would you like to carry forward last period's actuals to this period's plan?`)) {
                    const plansToCarryForward = state.planners.filter(p => p.period === latestPlannedPeriod);
                    plansToCarryForward.forEach(plan => {
                        const lastActual = calculatePeriodActuals(state.ledger, plan.entityId, plan.entityType, lastPeriodStartDate, lastPeriodEndDate);
                        const existingCurrentPeriodPlan = state.planners.find(p => p.period === currentPeriod && p.entityId === plan.entityId && p.entityType === plan.entityType);

                        if (existingCurrentPeriodPlan) {
                            updatePlannerEntry({ 
                                ...existingCurrentPeriodPlan, 
                                plannedAmount: lastActual, 
                                lastPlanAmount: existingCurrentPeriodPlan.plannedAmount, 
                                lastActualAmount: lastActual 
                            });
                        } else {
                            addPlannerEntry({
                                id: Math.random().toString(36).substr(2,9),
                                period: currentPeriod,
                                entityId: plan.entityId,
                                entityType: plan.entityType,
                                plannedAmount: lastActual, 
                                lastPlanAmount: plan.plannedAmount, 
                                lastActualAmount: lastActual 
                            });
                        }
                    });
                }
            }
        }
    }, [currentPeriod, periodType, state.planners, state.ledger, lastPeriodEndDate, lastPeriodStartDate, updatePlannerEntry, addPlannerEntry]);

    const expenseAccounts = useMemo(() => state.accounts.filter(a => a.type === AccountType.EXPENSE), [state.accounts]);
    const currentPeriodPlans = useMemo(() => state.planners.filter(p => p.period === currentPeriod), [state.planners, currentPeriod]);

    const expensePlans = useMemo(() => {
        return expenseAccounts.map(expAcc => {
            const plan = currentPeriodPlans.find(p => p.entityId === expAcc.id && p.entityType === PlannerEntityType.EXPENSE);
            const lastActual = calculatePeriodActuals(state.ledger, expAcc.id, PlannerEntityType.EXPENSE, lastPeriodStartDate, lastPeriodEndDate);
            return {
                expenseAccount: expAcc,
                lastPlan: plan?.plannedAmount || 0,
                lastActual,
                currentPlan: plan?.plannedAmount || 0,
                plannerId: plan?.id
            };
        }).filter(p => p.plannerId || p.currentPlan > 0 || p.lastActual > 0);
    }, [expenseAccounts, currentPeriodPlans, state.ledger, lastPeriodStartDate, lastPeriodEndDate]);

    const handlePlanChange = useCallback((entityId: string, entityType: PlannerEntityType, value: number, plannerId?: string) => {
        const existingPlan = state.planners.find(p => p.id === plannerId);
        if (existingPlan) {
            updatePlannerEntry({ ...existingPlan, plannedAmount: value });
        } else {
            addPlannerEntry({
                id: Math.random().toString(36).substr(2,9),
                period: currentPeriod,
                entityId,
                entityType,
                plannedAmount: value,
                lastActualAmount: 0,
                lastPlanAmount: 0
            });
        }
    }, [state.planners, currentPeriod, addPlannerEntry, updatePlannerEntry]);

    const totalPlannedExpenses = expensePlans.reduce((sum, p) => sum + p.currentPlan, 0);

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setPeriodType('WEEKLY')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${periodType === 'WEEKLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Weekly</button>
                    <button onClick={() => setPeriodType('MONTHLY')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${periodType === 'MONTHLY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Monthly</button>
                </div>
                <span className="font-bold text-slate-700">{currentPeriod} Expense Plan</span>
            </div>

            <div className="bg-white rounded-xl border border-amber-200 shadow-sm flex flex-col">
                <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                    <h4 className="font-bold text-amber-800 flex items-center gap-2"><Briefcase size={18}/> Expense Planner</h4>
                    <button onClick={() => setAddExpenseModalOpen(true)} className="bg-white text-amber-600 px-3 py-1 rounded text-sm font-bold hover:bg-amber-50"><Plus size={14}/></button>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2">Expense Account</th>
                                <th className="px-4 py-2 text-right">Last Actual</th>
                                <th className="px-4 py-2 text-right">This Plan</th>
                                <th className="px-4 py-2 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {expensePlans.map(p => (
                                <tr key={p.expenseAccount.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 font-medium text-slate-700">{p.expenseAccount.name}</td>
                                    <td className={`px-4 py-2 text-right font-mono ${p.lastActual <= p.lastPlan ? 'text-emerald-600' : 'text-red-500'}`}>${p.lastActual.toLocaleString()}</td>
                                    <td className="px-4 py-2 text-right">
                                        <input 
                                            type="number" 
                                            value={p.currentPlan} 
                                            onChange={e => handlePlanChange(p.expenseAccount.id, PlannerEntityType.EXPENSE, parseFloat(e.target.value || '0'), p.plannerId)} 
                                            className="w-24 border border-amber-300 rounded-lg p-1 text-right bg-amber-50 text-amber-700 text-sm font-bold"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => p.plannerId && deleteEntity('planners', p.plannerId)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-amber-100 bg-amber-50 text-amber-800 font-bold text-sm flex justify-between">
                    <span>Total Planned Expenses</span>
                    <span>${totalPlannedExpenses.toLocaleString()}</span>
                </div>
            </div>
            {/* Modal */}
            {addExpenseModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Add Expense Account to Plan</h3>
                        <EntitySelector 
                            entities={expenseAccounts.filter(a => !expensePlans.some(ep => ep.expenseAccount.id === a.id))} 
                            selectedId="" 
                            onSelect={(id) => { handlePlanChange(id, PlannerEntityType.EXPENSE, 0); setAddExpenseModalOpen(false); }} 
                            placeholder="Select Expense Account..."
                        />
                        <button onClick={() => setAddExpenseModalOpen(false)} className="mt-4 w-full text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const FinancialStatementsContainer: React.FC = () => {
    const [view, setView] = useState<'PL' | 'BS' | 'RECEIPTS_PAYMENTS' | 'EXPENSE_PLANNER'>('PL');

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-center bg-white p-1 rounded-lg border border-slate-200 w-fit mx-auto shadow-sm">
                <button onClick={() => setView('PL')} className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${view === 'PL' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Profit & Loss</button>
                <button onClick={() => setView('BS')} className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${view === 'BS' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Balance Sheet</button>
                <button onClick={() => setView('RECEIPTS_PAYMENTS')} className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${view === 'RECEIPTS_PAYMENTS' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Receipts & Payments</button>
                <button onClick={() => setView('EXPENSE_PLANNER')} className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${view === 'EXPENSE_PLANNER' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Expense Planner</button>
            </div>

            {view === 'PL' && <ProfitLoss />}
            {view === 'BS' && <BalanceSheet />}
            {view === 'RECEIPTS_PAYMENTS' && <ReceiptsPaymentsPlanner />}
            {view === 'EXPENSE_PLANNER' && <ExpensePlanner />}
        </div>
    );
};

// 4. SMART TRANSACTION EXPLORER
const SmartExplorer: React.FC = () => {
    const { state } = useData();
    const [mode, setMode] = useState<'LEDGER' | 'SALES' | 'PURCHASE'>('LEDGER');
    const [searchTerm, setSearchTerm] = useState('');

    const data = useMemo(() => {
        if (mode === 'LEDGER') return state.ledger;
        if (mode === 'SALES') return state.salesInvoices;
        if (mode === 'PURCHASE') return state.purchases;
        return [];
    }, [mode, state]);

    const filtered = useMemo(() => {
        return data.filter((item: any) => {
            const str = JSON.stringify(item).toLowerCase();
            return str.includes(searchTerm.toLowerCase());
        });
    }, [data, searchTerm]);

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['LEDGER', 'SALES', 'PURCHASE'].map((m) => (
                        <button
                            key={m}
                            onClick={() => setMode(m as any)}
                            className={`px-6 py-2 rounded-md text-xs font-bold transition-all ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {m} EXPLORER
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search IDs, Names, Amounts..." 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium">
                    <Download size={18} /> Export CSV
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-full">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                            {mode === 'LEDGER' && (
                                <tr>
                                    <th className="px-4 py-4 whitespace-nowrap">Date</th>
                                    <th className="px-4 py-4 whitespace-nowrap">ID</th>
                                    <th className="px-4 py-4 min-w-[200px]">Account</th>
                                    <th className="px-4 py-4 min-w-[300px]">Narration</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Debit</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Credit</th>
                                </tr>
                            )}
                            {mode === 'SALES' && (
                                <tr>
                                    <th className="px-4 py-4 whitespace-nowrap">Date</th>
                                    <th className="px-4 py-4 whitespace-nowrap">Invoice #</th>
                                    <th className="px-4 py-4 min-w-[200px]">Customer</th>
                                    <th className="px-4 py-4 whitespace-nowrap">Status</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Items</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Total</th>
                                </tr>
                            )}
                            {mode === 'PURCHASE' && (
                                <tr>
                                    <th className="px-4 py-4 whitespace-nowrap">Date</th>
                                    <th className="px-4 py-4 whitespace-nowrap">Batch #</th>
                                    <th className="px-4 py-4 min-w-[200px]">Supplier</th>
                                    <th className="px-4 py-4 min-w-[150px]">Type</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Weight</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Cost</th>
                                </tr>
                            )}
                        </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.slice(0, 100).map((row: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                {mode === 'LEDGER' && (
                                    <>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.date}</td>
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600 whitespace-nowrap">{row.transactionId}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{row.accountName}</td>
                                        <td className="px-4 py-3 text-slate-500">{row.narration}</td>
                                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap">{row.debit > 0 ? row.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap">{row.credit > 0 ? row.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                                    </>
                                )}
                                {mode === 'SALES' && (
                                    <>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.date}</td>
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600 whitespace-nowrap">{row.invoiceNo}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{state.partners.find(p => p.id === row.customerId)?.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>{row.status}</span></td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">{row.items.length}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">${row.netTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    </>
                                )}
                                {mode === 'PURCHASE' && (
                                    <>
                                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.date}</td>
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600 whitespace-nowrap">{row.batchNumber}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{state.partners.find(p => p.id === row.supplierId)?.name}</td>
                                        <td className="px-4 py-3 text-slate-500">{row.originalType}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">{row.weightPurchased.toLocaleString()} kg</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">${row.totalLandedCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// 5. PRODUCTION REPORTS (Enhanced)
const ProductionYield: React.FC = () => {
    const { state } = useData();
    const [subTab, setSubTab] = useState<'YIELD' | 'DAILY' | 'REBALING'>('YIELD');
    const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [priceBasis, setPriceBasis] = useState<'COST' | 'SALES'>('COST');
    const [workingCostRate, setWorkingCostRate] = useState<number>(0.17);
    const [groupBy, setGroupBy] = useState<'CATEGORY' | 'SECTION'>('CATEGORY');
    const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
    const [sortColumn, setSortColumn] = useState<'name' | 'weight' | 'value' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [inputSortColumn, setInputSortColumn] = useState<'name' | 'weight' | 'value' | null>(null);
    const [inputSortDirection, setInputSortDirection] = useState<'asc' | 'desc'>('desc');

    const yieldData = useMemo(() => {
        const openings = state.originalOpenings.filter(o => o.date >= startDate && o.date <= endDate);
        const totalInputWeight = openings.reduce((sum, i) => sum + i.weightOpened, 0);
        const totalInputCost = openings.reduce((sum, i) => sum + i.totalValue, 0);
        const totalWorkingCost = totalInputWeight * workingCostRate;
        const grandTotalCost = totalInputCost + totalWorkingCost;

        // Group inputs by Original Type
        const inputGrouped: Record<string, { name: string, weight: number, value: number, items: any[] }> = {};
        openings.forEach(opening => {
            const originalTypeName = state.originalTypes.find(ot => ot.id === opening.originalType)?.name || opening.originalType || 'Unknown Type';
            
            if (!inputGrouped[originalTypeName]) {
                inputGrouped[originalTypeName] = { name: originalTypeName, weight: 0, value: 0, items: [] };
            }
            
            inputGrouped[originalTypeName].weight += opening.weightOpened || 0;
            inputGrouped[originalTypeName].value += opening.totalValue || 0;
            inputGrouped[originalTypeName].items.push({
                date: opening.date,
                weight: opening.weightOpened || 0,
                value: opening.totalValue || 0,
                costPerKg: opening.costPerKg || 0
            });
        });

        let inputs = Object.values(inputGrouped);
        // Add percentage share to each input
        inputs = inputs.map(i => ({
            ...i,
            percentage: totalInputCost > 0 ? (i.value / totalInputCost) * 100 : 0
        }));

        const production = state.productions.filter(p => p.date >= startDate && p.date <= endDate && p.qtyProduced > 0 && !p.isRebaling);
        const grouped: Record<string, { name: string, weight: number, value: number, packages: number, items: any[] }> = {};
        
        production.forEach(p => {
            const item = state.items.find(i => i.id === p.itemId);
            if (!item) return;
            const groupKey = groupBy === 'CATEGORY' 
                ? (state.categories.find(c => c.id === item.category)?.name || item.category || 'Uncategorized')
                : (state.sections.find(s => s.id === item.section)?.name || item.section || 'No Section');
            
            if (!grouped[groupKey]) grouped[groupKey] = { name: groupKey, weight: 0, value: 0, packages: 0, items: [] };
            // CRITICAL FIX: Use productionPrice from production entry if available (matches Produced Production screen logic)
            // Priority: productionPrice (from entry) > priceBasis logic (avgCost or salePrice)
            let unitValue: number;
            // First check if production entry has productionPrice set (from CSV or form)
            if (p.productionPrice !== undefined && p.productionPrice !== null && !isNaN(p.productionPrice)) {
                unitValue = p.productionPrice;
            } else if (priceBasis === 'COST') {
                // Fallback to item.avgCost when priceBasis is COST
                unitValue = item.avgCost || 0;
            } else {
                // For SALES basis: Check if salePrice is valid (not NaN, undefined, or null)
                const salePrice = item.salePrice;
                if (salePrice === undefined || salePrice === null || isNaN(salePrice)) {
                    // Fallback to avgCost if salePrice is invalid
                    unitValue = item.avgCost || 0;
                } else {
                    unitValue = salePrice;
                }
            }
            grouped[groupKey].weight += p.weightProduced;
            grouped[groupKey].value += p.qtyProduced * unitValue;
            // Count packages (Bales/Box/Bags) - only count if packingType is BALE, BOX, or BAG
            if (p.packingType === PackingType.BALE || p.packingType === PackingType.BOX || p.packingType === PackingType.BAG) {
                grouped[groupKey].packages += p.qtyProduced;
            }
            grouped[groupKey].items.push({ name: item.name, qty: p.qtyProduced, weight: p.weightProduced, value: p.qtyProduced * unitValue, price: unitValue });
        });

        let outputs = Object.values(grouped);
        const totalOutputWeight = outputs.reduce((sum, o) => sum + o.weight, 0);
        const totalOutputValue = outputs.reduce((sum, o) => sum + o.value, 0);
        
        // Add percentage share to each output
        outputs = outputs.map(o => ({
            ...o,
            percentage: totalOutputValue > 0 ? (o.value / totalOutputValue) * 100 : 0
        }));
        
        return {
            inputs: { weight: totalInputWeight, cost: totalInputCost, working: totalWorkingCost, total: grandTotalCost, grouped: inputs },
            outputs, totalOutputWeight, totalOutputValue, loss: totalInputWeight - totalOutputWeight, profit: totalOutputValue - grandTotalCost
        };
    }, [state.originalOpenings, state.productions, startDate, endDate, priceBasis, workingCostRate, groupBy, state.items, state.categories, state.sections, state.originalTypes]);

    const dailyData = useMemo(() => {
        const prod = state.productions.filter(p => p.date === dailyDate && p.qtyProduced > 0 && !p.isRebaling);
        const openings = state.originalOpenings.filter(o => o.date === dailyDate);
        const openingValue = openings.reduce((s, o) => s + o.totalValue, 0);
        const prodValue = prod.reduce((s, p) => {
            const item = state.items.find(i => i.id === p.itemId);
            return s + (p.qtyProduced * (item?.avgCost || 0));
        }, 0);
        return { prod, openingValue, prodValue };
    }, [state.productions, state.originalOpenings, dailyDate, state.items]);

    const rebalingData = useMemo(() => {
        const entries = state.productions.filter(p => p.date >= startDate && p.date <= endDate && p.id.startsWith('rb-'));
        const transactions: Record<string, { id: string, date: string, inputKg: number, outputKg: number, diff: number }> = {};
        entries.forEach(p => {
            const parts = p.id.split('-');
            const txId = parts[parts.length - 1]; 
            if (!transactions[txId]) transactions[txId] = { id: txId, date: p.date, inputKg: 0, outputKg: 0, diff: 0 };
            if (p.qtyProduced < 0) transactions[txId].inputKg += Math.abs(p.weightProduced);
            else transactions[txId].outputKg += p.weightProduced;
        });
        return Object.values(transactions).map(t => ({ ...t, diff: t.inputKg - t.outputKg }));
    }, [state.productions, startDate, endDate]);

    const [drillCategory, setDrillCategory] = useState<string | null>(null);

    // Sort outputs based on sortColumn and sortDirection
    const sortedOutputs = useMemo(() => {
        if (!sortColumn) return yieldData.outputs;
        const sorted = [...yieldData.outputs].sort((a, b) => {
            let aVal: any, bVal: any;
            if (sortColumn === 'name') {
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
            } else if (sortColumn === 'weight') {
                aVal = a.weight;
                bVal = b.weight;
            } else if (sortColumn === 'value') {
                aVal = a.value;
                bVal = b.value;
            }
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [yieldData.outputs, sortColumn, sortDirection]);

    // Sort inputs based on inputSortColumn and inputSortDirection
    const sortedInputs = useMemo(() => {
        if (!inputSortColumn) return yieldData.inputs.grouped || [];
        const sorted = [...(yieldData.inputs.grouped || [])].sort((a, b) => {
            let aVal: any, bVal: any;
            if (inputSortColumn === 'name') {
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
            } else if (inputSortColumn === 'weight') {
                aVal = a.weight;
                bVal = b.weight;
            } else if (inputSortColumn === 'value') {
                aVal = a.value;
                bVal = b.value;
            }
            if (aVal < bVal) return inputSortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return inputSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [yieldData.inputs.grouped, inputSortColumn, inputSortDirection]);

    const handleSort = (column: 'name' | 'weight' | 'value') => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    };

    const handleInputSort = (column: 'name' | 'weight' | 'value') => {
        if (inputSortColumn === column) {
            setInputSortDirection(inputSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setInputSortColumn(column);
            setInputSortDirection('desc');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in h-full flex flex-col">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['YIELD', 'DAILY', 'REBALING'].map(tab => (
                        <button key={tab} onClick={() => setSubTab(tab as any)} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${subTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tab === 'YIELD' ? 'Yield Analysis' : tab === 'DAILY' ? 'Daily Log' : 'Re-baling Audit'}</button>
                    ))}
                </div>
                {subTab !== 'DAILY' && (
                    <div className="flex items-center gap-2 text-sm bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                        <Calendar size={16} className="text-slate-400" /><input type="date" className="bg-transparent border-none p-1 focus:ring-0" value={startDate} onChange={e => setStartDate(e.target.value)} /><span className="text-slate-400">-</span><input type="date" className="bg-transparent border-none p-1 focus:ring-0" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                )}
            </div>

            {subTab === 'YIELD' && (
                <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
                    <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm shrink-0">
                        <span className="font-bold text-slate-700">Settings:</span>
                        <div className="flex items-center gap-2 border-r border-slate-300 pr-4">
                            <span className="text-slate-500">Basis:</span>
                            <button onClick={() => setPriceBasis('COST')} className={`px-2 py-0.5 rounded text-xs font-bold ${priceBasis === 'COST' ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-600 border'}`}>Cost</button>
                            <button onClick={() => setPriceBasis('SALES')} className={`px-2 py-0.5 rounded text-xs font-bold ${priceBasis === 'SALES' ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-600 border'}`}>Sales</button>
                        </div>
                        <div className="flex items-center gap-2 border-r border-slate-300 pr-4">
                            <span className="text-slate-500">Group By:</span>
                            <select className="bg-white border border-slate-300 rounded text-xs py-1" value={groupBy} onChange={e => setGroupBy(e.target.value as any)}><option value="CATEGORY">Category</option><option value="SECTION">Section</option></select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">Working Cost:</span>
                            <input type="number" step="0.01" className="w-16 border border-slate-300 rounded text-xs p-1" value={workingCostRate} onChange={e => setWorkingCostRate(parseFloat(e.target.value))} /><span className="text-xs text-slate-400">/kg</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-4 bg-red-50/50 border-b border-red-100 flex justify-between items-center">
                                <h3 className="font-bold text-red-800">Total Inputs (Cost)</h3>
                                <span className="font-mono font-bold text-red-700">${yieldData.inputs.total.toLocaleString()}</span>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase sticky top-0">
                                        <tr>
                                            <th 
                                                className="px-4 py-2 cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleInputSort('name')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Original Type
                                                    {inputSortColumn === 'name' && (
                                                        inputSortDirection === 'asc' ? '↑' : '↓'
                                                    )}
                                                </div>
                                            </th>
                                            <th 
                                                className="px-4 py-2 text-right cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleInputSort('weight')}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Kg
                                                    {inputSortColumn === 'weight' && (
                                                        inputSortDirection === 'asc' ? '↑' : '↓'
                                                    )}
                                                </div>
                                            </th>
                                            <th className="px-4 py-2 text-right">Rate/Kg</th>
                                            <th className="px-4 py-2 text-right">% Share</th>
                                            <th 
                                                className="px-4 py-2 text-right cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleInputSort('value')}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Value
                                                    {inputSortColumn === 'value' && (
                                                        inputSortDirection === 'asc' ? '↑' : '↓'
                                                    )}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sortedInputs.map((i, idx) => {
                                            const ratePerKg = i.weight > 0 ? i.value / i.weight : 0;
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-medium text-slate-700">{i.name}</td>
                                                    <td className="px-4 py-2 text-right">{i.weight.toLocaleString()}</td>
                                                    <td className="px-4 py-2 text-right font-mono text-slate-600">${ratePerKg.toFixed(3)}</td>
                                                    <td className="px-4 py-2 text-right font-mono text-slate-600">{i.percentage.toFixed(2)}%</td>
                                                    <td className="px-4 py-2 text-right font-mono">${i.value.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                        {sortedInputs.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-4 text-center text-slate-400">
                                                    No original openings found for the selected date range.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Total Material Weight</span>
                                    <span className="font-mono font-bold">{yieldData.inputs.weight.toLocaleString()} Kg</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Raw Material Cost</span>
                                    <span className="font-mono">${yieldData.inputs.cost.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Working Cost ({workingCostRate}/kg)</span>
                                    <span className="font-mono">${yieldData.inputs.working.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex justify-between items-center"><h3 className="font-bold text-emerald-800">Total Outputs (Value)</h3><span className="font-mono font-bold text-emerald-700">${yieldData.totalOutputValue.toLocaleString()}</span></div>
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase sticky top-0">
                                        <tr>
                                            <th 
                                                className="px-4 py-2 cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('name')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {groupBy === 'CATEGORY' ? 'Category' : 'Section'}
                                                    {sortColumn === 'name' && (
                                                        sortDirection === 'asc' ? '↑' : '↓'
                                                    )}
                                                </div>
                                            </th>
                                            <th 
                                                className="px-4 py-2 text-right cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('weight')}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Kg
                                                    {sortColumn === 'weight' && (
                                                        sortDirection === 'asc' ? '↑' : '↓'
                                                    )}
                                                </div>
                                            </th>
                                            <th className="px-4 py-2 text-right">% Share</th>
                                            <th className="px-4 py-2 text-right">Packages</th>
                                            <th 
                                                className="px-4 py-2 text-right cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('value')}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Value
                                                    {sortColumn === 'value' && (
                                                        sortDirection === 'asc' ? '↑' : '↓'
                                                    )}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sortedOutputs.map((o, i) => (
                                            <tr key={i} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDrillCategory(o.name)}>
                                                <td className="px-4 py-2 font-medium text-slate-700">{o.name}</td>
                                                <td className="px-4 py-2 text-right">{o.weight.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right font-mono text-slate-600">{o.percentage.toFixed(2)}%</td>
                                                <td className="px-4 py-2 text-right font-mono">{o.packages.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right font-mono">${o.value.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 shrink-0">
                        <div className={`p-4 rounded-xl border flex justify-between items-center ${yieldData.loss > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}><div><div className="text-xs font-bold uppercase opacity-70">Weight Variance</div><div className="text-xl font-bold">{Math.abs(yieldData.loss).toLocaleString()} Kg</div></div><div className="text-sm font-medium">{yieldData.loss > 0 ? 'Loss' : 'Gain'}</div></div>
                        <div className={`p-4 rounded-xl border flex justify-between items-center ${yieldData.profit >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}><div><div className="text-xs font-bold uppercase opacity-70">Net Profit</div><div className="text-xl font-bold">${yieldData.profit.toLocaleString()}</div></div><div className="text-sm font-medium">{yieldData.profit >= 0 ? 'Profit' : 'Loss'}</div></div>
                    </div>
                </div>
            )}

            {subTab === 'DAILY' && (
                <div className="flex-1 flex flex-col space-y-6">
                    <div className="flex justify-center bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0">
                        <div className="flex items-center gap-4"><button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate()-1); setDailyDate(d.toISOString().split('T')[0]); }} className="p-1 hover:bg-slate-200 rounded"><ArrowRight className="rotate-180" size={20}/></button><input type="date" className="bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-700" value={dailyDate} onChange={e => setDailyDate(e.target.value)} /><button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate()+1); setDailyDate(d.toISOString().split('T')[0]); }} className="p-1 hover:bg-slate-200 rounded"><ArrowRight size={20}/></button></div>
                    </div>
                    <div className="grid grid-cols-2 gap-6 shrink-0">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center"><div className="text-xs text-slate-500 uppercase font-bold">Input (Opened)</div><div className="text-2xl font-mono font-bold text-slate-800">${dailyData.openingValue.toLocaleString()}</div></div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center"><div className="text-xs text-slate-500 uppercase font-bold">Output (Produced)</div><div className="text-2xl font-mono font-bold text-emerald-600">${dailyData.prodValue.toLocaleString()}</div></div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs"><tr><th className="px-6 py-3">Item</th><th className="px-6 py-3">Packing</th><th className="px-6 py-3 text-right">Qty</th><th className="px-6 py-3 text-right">Kg</th><th className="px-6 py-3 text-right">Est. Worth</th></tr></thead><tbody className="divide-y divide-slate-100">{dailyData.prod.map(p => { const item = state.items.find(i => i.id === p.itemId); const worth = p.qtyProduced * (item?.avgCost || 0); return ( <tr key={p.id} className="hover:bg-slate-50"><td className="px-6 py-3 font-medium text-slate-700">{p.itemName}</td><td className="px-6 py-3 text-slate-500">{p.packingType}</td><td className="px-6 py-3 text-right font-bold">{p.qtyProduced}</td><td className="px-6 py-3 text-right text-slate-500">{p.weightProduced}</td><td className="px-6 py-3 text-right font-mono text-emerald-600">${worth.toLocaleString()}</td></tr> ); })}</tbody></table>
                    </div>
                </div>
            )}

            {subTab === 'REBALING' && (
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-200"><h3 className="font-bold text-slate-700 flex items-center gap-2"><ArrowLeftRight size={18}/> Re-baling Transactions</h3></div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left"><thead className="bg-white text-slate-500 font-bold uppercase text-xs border-b border-slate-100 sticky top-0"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Transaction ID</th><th className="px-6 py-3 text-right">Consumed (Kg)</th><th className="px-6 py-3 text-right">Produced (Kg)</th><th className="px-6 py-3 text-right">Diff / Loss</th><th className="px-6 py-3 text-center">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{rebalingData.map(t => ( <tr key={t.id} className="hover:bg-slate-50 group"><td className="px-6 py-3 text-slate-600">{t.date}</td><td className="px-6 py-3 font-mono text-xs text-blue-600">{t.id}</td><td className="px-6 py-3 text-right font-mono">{t.inputKg.toLocaleString()}</td><td className="px-6 py-3 text-right font-mono">{t.outputKg.toLocaleString()}</td><td className={`px-6 py-3 text-right font-bold ${t.diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{t.diff.toLocaleString()} kg</td><td className="px-6 py-3 text-center">{t.diff > 0 ? ( <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">LOSS</span> ) : ( <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">GAIN</span> )}</td></tr> ))}</tbody></table>
                    </div>
                </div>
            )}

            {drillCategory && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50"><h3 className="text-lg font-bold text-slate-800">Category Details: {drillCategory}</h3><button onClick={() => setDrillCategory(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div>
                        <div className="flex-1 overflow-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase sticky top-0"><tr><th className="px-6 py-3">Item Name</th><th className="px-6 py-3 text-right">Qty</th><th className="px-6 py-3 text-right">Weight</th><th className="px-6 py-3 text-right">Price ({priceBasis})</th><th className="px-6 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{yieldData.outputs.find(c => c.name === drillCategory)?.items.map((item, i) => ( <tr key={i} className="hover:bg-slate-50"><td className="px-6 py-2 font-medium text-slate-700">{item.name}</td><td className="px-6 py-2 text-right">{item.qty}</td><td className="px-6 py-2 text-right">{item.weight} kg</td><td className="px-6 py-2 text-right text-slate-500">${item.price.toFixed(2)}</td><td className="px-6 py-2 text-right font-mono font-bold">${item.value.toLocaleString()}</td></tr> ))}</tbody></table></div>
                    </div>
                </div>
            )}
        </div>
    );
};

// 6. LEDGER REPORT
const LedgerReport: React.FC = () => {
    const { state } = useData();
    const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountType, setAccountType] = useState<string>('ALL'); 
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [showFcy, setShowFcy] = useState(false);
    const [viewVoucherId, setViewVoucherId] = useState<string | null>(null);

    const allEntities = useMemo(() => {
        const accs = state.accounts.map(a => ({ id: a.id, name: a.name, type: a.type, currency: a.currency || 'USD', isPartner: false }));
        const partners = state.partners.map(p => ({ id: p.id, name: p.name, type: p.type, currency: p.defaultCurrency, isPartner: true }));
        return [...accs, ...partners];
    }, [state.accounts, state.partners]);

    const filteredEntities = useMemo(() => {
        let filtered = accountType === 'ALL' ? allEntities : allEntities.filter(e => e.type === accountType);
        // Sort alphabetically by name
        return filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }, [allEntities, accountType]);

    // PERFORMANCE OPTIMIZATION #1: Pre-index ledger by accountId
    const ledgerByAccount = useMemo(() => {
        const index: Record<string, LedgerEntry[]> = {};
        state.ledger.forEach(entry => {
            if (!index[entry.accountId]) {
                index[entry.accountId] = [];
            }
            index[entry.accountId].push(entry);
        });
        return index;
    }, [state.ledger]);

    // PERFORMANCE OPTIMIZATION #2: Pre-filter by date range and convert dates to timestamps
    const startTimestamp = useMemo(() => new Date(startDate).getTime(), [startDate]);
    const endTimestamp = useMemo(() => new Date(endDate).getTime(), [endDate]);
    
    const dateFilteredLedger = useMemo(() => {
        return state.ledger.filter(e => {
            const entryTimestamp = new Date(e.date).getTime();
            return entryTimestamp >= startTimestamp && entryTimestamp <= endTimestamp;
        });
    }, [state.ledger, startTimestamp, endTimestamp]);

    // PERFORMANCE OPTIMIZATION #3: Optimized getAccountStats using pre-indexed data
    const getAccountStats = useCallback((accountId: string) => {
        // Get entries for this account from pre-indexed map (O(1) lookup)
        const accountEntries = ledgerByAccount[accountId] || [];
        
        // Use numeric timestamp comparisons instead of string comparisons
        const openingEntries = accountEntries.filter(e => {
            const entryTimestamp = new Date(e.date).getTime();
            return entryTimestamp < startTimestamp;
        });
        
        // Safely handle undefined/null debit/credit values - default to 0
        const openingDr = openingEntries.reduce((sum, e) => {
            const debit = (e.debit !== undefined && e.debit !== null && !isNaN(e.debit)) ? Number(e.debit) : 0;
            return sum + debit;
        }, 0);
        const openingCr = openingEntries.reduce((sum, e) => {
            const credit = (e.credit !== undefined && e.credit !== null && !isNaN(e.credit)) ? Number(e.credit) : 0;
            return sum + credit;
        }, 0);
        const openingBal = openingDr - openingCr;
        
        // Get period entries from pre-filtered array (much smaller than full ledger)
        const periodEntries = dateFilteredLedger.filter(e => e.accountId === accountId);
        const periodDr = periodEntries.reduce((sum, e) => {
            const debit = (e.debit !== undefined && e.debit !== null && !isNaN(e.debit)) ? Number(e.debit) : 0;
            return sum + debit;
        }, 0);
        const periodCr = periodEntries.reduce((sum, e) => {
            const credit = (e.credit !== undefined && e.credit !== null && !isNaN(e.credit)) ? Number(e.credit) : 0;
            return sum + credit;
        }, 0);
        
        // Ensure all values are valid numbers (not NaN)
        const opening = isNaN(openingBal) ? 0 : openingBal;
        const debit = isNaN(periodDr) ? 0 : periodDr;
        const credit = isNaN(periodCr) ? 0 : periodCr;
        const closing = opening + debit - credit;
        
        // Only sort entries if we're viewing the detail (not summary) - lazy sorting
        // Use slice() to avoid mutating the original array
        const sortedEntries = [...periodEntries].sort((a,b) => {
            const aTime = new Date(a.date).getTime();
            const bTime = new Date(b.date).getTime();
            return aTime - bTime;
        });
        
        return { 
            opening, 
            debit, 
            credit, 
            closing: isNaN(closing) ? 0 : closing, 
            entries: sortedEntries
        };
    }, [ledgerByAccount, dateFilteredLedger, startTimestamp]);

    // PERFORMANCE OPTIMIZATION #4: Use ref for persistent cache that doesn't trigger re-renders
    // Calculate stats on-demand only when rows are rendered
    const accountStatsCacheRef = useRef<Record<string, ReturnType<typeof getAccountStats>>>({});
    
    // Clear cache when filters change
    useEffect(() => {
        accountStatsCacheRef.current = {};
    }, [startDate, endDate, accountType]);

    const activeEntity = useMemo(() => allEntities.find(e => e.id === selectedAccountId), [allEntities, selectedAccountId]);
    
    // PERFORMANCE: Memoize voucher entries to avoid filtering on every render
    const voucherEntries = useMemo(() => {
        if (!viewVoucherId) return [];
        return state.ledger.filter(e => e.transactionId === viewVoucherId);
    }, [state.ledger, viewVoucherId]);

    return (
        <div className="space-y-6 animate-in fade-in h-full flex flex-col">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 items-end shrink-0">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">From</label><input type="date" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label><input type="date" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Type</label>
                    <select 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" 
                        value={accountType} 
                        onChange={e => { setAccountType(e.target.value); setSelectedAccountId(''); }}
                    >
                        <option value="ALL">All Types</option>
                        <optgroup label="Business Partners">
                            <option value="CUSTOMER">Customers</option>
                            <option value="SUPPLIER">Suppliers</option>
                            <option value="SUB SUPPLIER">Sub Suppliers</option>
                            <option value="VENDOR">Vendors</option>
                            <option value="FREIGHT FORWARDER">Freight Forwarder</option>
                            <option value="CLEARING AGENT">Clearing Agent</option>
                            <option value="COMMISSION AGENT">Commission Agent</option>
                        </optgroup>
                        <optgroup label="Chart of Accounts">
                            <option value="ASSET">Assets</option>
                            <option value="LIABILITY">Liabilities</option>
                            <option value="EXPENSE">Expenses</option>
                            <option value="REVENUE">Revenue</option>
                        </optgroup>
                    </select>
                </div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Account</label><div className="relative"><select className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm appearance-none" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}><option value="">-- View Summary --</option>{filteredEntities.map(e => ( <option key={e.id} value={e.id}>{e.name}</option> ))}</select><ChevronDown className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" size={16} /></div></div>
                {activeEntity && activeEntity.currency !== 'USD' && ( 
                    <div className="flex items-center gap-2 pb-2">
                        <label className="text-sm font-bold text-slate-700">View in:</label>
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                            <button 
                                onClick={() => setShowFcy(false)} 
                                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${!showFcy ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
                            >
                                USD (Base)
                            </button>
                            <button 
                                onClick={() => setShowFcy(true)} 
                                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${showFcy ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
                            >
                                {activeEntity.currency} (Default)
                            </button>
                        </div>
                    </div> 
                )}
            </div>

            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {!selectedAccountId ? (
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left min-w-full">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-4 min-w-[250px]">Account Name</th>
                                    <th className="px-4 py-4 whitespace-nowrap">Type</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Opening ($)</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Debit ($)</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Credit ($)</th>
                                    <th className="px-4 py-4 text-right whitespace-nowrap">Closing ($)</th>
                                    <th className="px-4 py-4 text-center whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEntities.map(e => { 
                                    // Calculate stats on-demand (lazy) - only when row is rendered
                                    // Use ref cache to avoid recalculating on every render
                                    if (!accountStatsCacheRef.current[e.id]) {
                                        accountStatsCacheRef.current[e.id] = getAccountStats(e.id);
                                    }
                                    const stats = accountStatsCacheRef.current[e.id];
                                    if (stats.opening === 0 && stats.debit === 0 && stats.credit === 0) return null; 
                                    return ( 
                                        <tr key={e.id} className="hover:bg-slate-50 group">
                                            <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap"><span className="bg-slate-100 px-2 py-1 rounded">{e.type}</span></td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-600 whitespace-nowrap">{stats.opening.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-600 whitespace-nowrap">{stats.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-600 whitespace-nowrap">{stats.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                            <td className={`px-4 py-3 text-right font-mono font-bold whitespace-nowrap ${stats.closing < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                {Math.abs(stats.closing).toLocaleString(undefined, {minimumFractionDigits: 2})} {stats.closing < 0 ? 'Cr' : 'Dr'}
                                            </td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <button onClick={() => setSelectedAccountId(e.id)} className="text-blue-600 hover:text-blue-800 text-xs font-bold border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">
                                                    View Ledger
                                                </button>
                                            </td>
                                        </tr> 
                                    ); 
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {activeEntity && ( 
                            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{activeEntity.name}</h3>
                                    <p className="text-sm text-slate-500">Ledger from {startDate} to {endDate} {showFcy ? `(${activeEntity.currency})` : '(USD)'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => window.print()} className="bg-white border border-slate-300 px-3 py-1 rounded text-sm flex gap-2">
                                        <Printer size={16}/> Print
                                    </button>
                                </div>
                            </div> 
                        )}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left min-w-full">
                                <thead className="bg-white text-slate-500 font-bold uppercase text-xs border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-4 whitespace-nowrap">Date</th>
                                        <th className="px-4 py-4 whitespace-nowrap">Voucher</th>
                                        <th className="px-4 py-4 min-w-[300px]">Description</th>
                                        <th className="px-4 py-4 text-right bg-emerald-50/30 whitespace-nowrap">Debit ({showFcy ? activeEntity?.currency : 'USD'})</th>
                                        <th className="px-4 py-4 text-right bg-red-50/30 whitespace-nowrap">Credit ({showFcy ? activeEntity?.currency : 'USD'})</th>
                                        <th className="px-4 py-4 text-right bg-slate-50 whitespace-nowrap">Balance ({showFcy ? activeEntity?.currency : 'USD'})</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(() => {
                                        if (!activeEntity) return null;
                                        const stats = getAccountStats(activeEntity.id);
                                        
                                        // Get exchange rate for account's default currency
                                        const accountCurrency = state.currencies.find(c => c.code === activeEntity.currency);
                                        const accountCurrencyRate = accountCurrency?.exchangeRate || EXCHANGE_RATES[activeEntity.currency as keyof typeof EXCHANGE_RATES] || 1;
                                        
                                        // Convert opening balance if showing in default currency
                                        let openingBalance = stats.opening;
                                        if (showFcy && activeEntity.currency !== 'USD') {
                                            openingBalance = stats.opening * accountCurrencyRate;
                                        }
                                        
                                        let runningBalance = openingBalance;
                                        
                                        return (
                                            <>
                                                <tr className="bg-slate-50 font-bold text-slate-600">
                                                    <td className="px-4 py-3" colSpan={3}>Opening Balance b/f</td>
                                                    <td className="px-4 py-3 text-right">-</td>
                                                    <td className="px-4 py-3 text-right">-</td>
                                                    <td className="px-4 py-3 text-right bg-slate-100 whitespace-nowrap">
                                                        {`${Math.abs(openingBalance).toLocaleString(undefined, {minimumFractionDigits: 2})} ${openingBalance < 0 ? 'Cr' : 'Dr'}`}
                                                    </td>
                                                </tr>
                                                {stats.entries.map(entry => {
                                                    let debitVal = entry.debit;
                                                    let creditVal = entry.credit;
                                                    
                                                    // Convert to default currency if toggle is on
                                                    if (showFcy && activeEntity.currency !== 'USD') {
                                                        // Convert USD amounts to account's default currency
                                                        debitVal = entry.debit > 0 ? entry.debit * accountCurrencyRate : 0;
                                                        creditVal = entry.credit > 0 ? entry.credit * accountCurrencyRate : 0;
                                                    }
                                                    
                                                    // Update running balance in the selected currency
                                                    if (showFcy && activeEntity.currency !== 'USD') {
                                                        runningBalance = runningBalance + (entry.debit * accountCurrencyRate) - (entry.credit * accountCurrencyRate);
                                                    } else {
                                                        runningBalance = runningBalance + entry.debit - entry.credit;
                                                    }
                                                    
                                                    return ( 
                                                        <tr key={entry.id} className="hover:bg-slate-50">
                                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{entry.date}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <button onClick={() => setViewVoucherId(entry.transactionId)} className="text-blue-600 hover:underline font-mono text-xs font-bold">
                                                                    {entry.transactionId}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-700" title={entry.narration}>{entry.narration}</td>
                                                            <td className="px-4 py-3 text-right font-mono bg-emerald-50/10 text-emerald-700 whitespace-nowrap">
                                                                {debitVal > 0 ? debitVal.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono bg-red-50/10 text-red-600 whitespace-nowrap">
                                                                {creditVal > 0 ? creditVal.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono font-bold bg-slate-50 text-slate-700 whitespace-nowrap">
                                                                {`${Math.abs(runningBalance).toLocaleString(undefined, {minimumFractionDigits: 2})} ${runningBalance < 0 ? 'Cr' : 'Dr'}`}
                                                            </td>
                                                        </tr> 
                                                    );
                                                })}
                                                <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                                                    <td className="px-4 py-4" colSpan={3}>Closing Balance c/f</td>
                                                    <td className="px-4 py-4 text-right bg-emerald-50/30 text-emerald-800 whitespace-nowrap">
                                                        {showFcy && activeEntity.currency !== 'USD' 
                                                            ? (stats.debit * accountCurrencyRate).toLocaleString(undefined, {minimumFractionDigits: 2})
                                                            : stats.debit.toLocaleString(undefined, {minimumFractionDigits: 2})
                                                        }
                                                    </td>
                                                    <td className="px-4 py-4 text-right bg-red-50/30 text-red-800 whitespace-nowrap">
                                                        {showFcy && activeEntity.currency !== 'USD'
                                                            ? (stats.credit * accountCurrencyRate).toLocaleString(undefined, {minimumFractionDigits: 2})
                                                            : stats.credit.toLocaleString(undefined, {minimumFractionDigits: 2})
                                                        }
                                                    </td>
                                                    <td className="px-4 py-4 text-right bg-slate-200 whitespace-nowrap">
                                                        {showFcy && activeEntity.currency !== 'USD'
                                                            ? `${Math.abs(stats.closing * accountCurrencyRate).toLocaleString(undefined, {minimumFractionDigits: 2})} ${stats.closing < 0 ? 'Cr' : 'Dr'}`
                                                            : `${Math.abs(stats.closing).toLocaleString(undefined, {minimumFractionDigits: 2})} ${stats.closing < 0 ? 'Cr' : 'Dr'}`
                                                        }
                                                    </td>
                                                </tr>
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            {/* Drill Down Modal */}
            {viewVoucherId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-5xl w-full animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4"><h3 className="text-xl font-bold text-slate-800">Transaction Details</h3><button onClick={() => setViewVoucherId(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4"><div className="grid grid-cols-2 gap-4 text-sm"><div><span className="block text-xs font-bold text-slate-400 uppercase">Voucher ID</span><span className="font-mono font-bold text-blue-600">{viewVoucherId}</span></div><div><span className="block text-xs font-bold text-slate-400 uppercase">Date</span><span className="font-medium text-slate-700">{voucherEntries[0]?.date || ''}</span></div></div></div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left min-w-full">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 min-w-[300px]">Account</th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">Debit</th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {voucherEntries.map((row, i) => ( 
                                        <tr key={i}>
                                            <td className="px-4 py-2">
                                                <div className="font-medium text-slate-800">{row.accountName}</div>
                                                <div className="text-xs text-slate-500">{row.narration}</div>
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono whitespace-nowrap">{row.debit > 0 ? row.debit.toLocaleString() : '-'}</td>
                                            <td className="px-4 py-2 text-right font-mono whitespace-nowrap">{row.credit > 0 ? row.credit.toLocaleString() : '-'}</td>
                                        </tr> 
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 text-right"><button onClick={() => setViewVoucherId(null)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700">Close</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- CASH MOVEMENT REPORT ---
const CashMovementReport: React.FC = () => {
    const { state } = useData();
    const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [transactionFilter, setTransactionFilter] = useState<'RECEIPTS' | 'PAYMENTS' | 'BOTH'>('BOTH');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [viewVoucherId, setViewVoucherId] = useState<string | null>(null);

    // Filter cash and bank accounts only
    const cashBankAccounts = useMemo(() => {
        return state.accounts.filter(acc => 
            acc.type === AccountType.ASSET && 
            (acc.name.toLowerCase().includes('cash') || acc.name.toLowerCase().includes('bank'))
        );
    }, [state.accounts]);

    // Filter ledger entries based on criteria
    const filteredEntries = useMemo(() => {
        let entries = state.ledger.filter(entry => {
            // Date range filter
            const entryDate = new Date(entry.date).getTime();
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).getTime();
            if (entryDate < start || entryDate > end) return false;

            // Account filter
            if (selectedAccountId && entry.accountId !== selectedAccountId) return false;

            // Transaction type filter
            if (transactionFilter === 'RECEIPTS') {
                if (entry.transactionType !== TransactionType.RECEIPT_VOUCHER) return false;
            } else if (transactionFilter === 'PAYMENTS') {
                if (entry.transactionType !== TransactionType.PAYMENT_VOUCHER) return false;
            } else {
                // BOTH - only show receipt and payment vouchers
                if (entry.transactionType !== TransactionType.RECEIPT_VOUCHER && 
                    entry.transactionType !== TransactionType.PAYMENT_VOUCHER) return false;
            }

            // Only show entries for cash/bank accounts
            const isCashBankAccount = cashBankAccounts.some(acc => acc.id === entry.accountId);
            if (!isCashBankAccount) return false;

            return true;
        });

        // Sort by date
        entries.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            // If same date, sort by transaction ID for consistency
            return a.transactionId.localeCompare(b.transactionId);
        });

        return entries;
    }, [state.ledger, startDate, endDate, transactionFilter, selectedAccountId, cashBankAccounts]);

    // Calculate opening balance (balance before start date)
    const openingBalance = useMemo(() => {
        if (!selectedAccountId) return 0;
        
        const start = new Date(startDate).getTime();
        const openingEntries = state.ledger.filter(entry => {
            const entryDate = new Date(entry.date).getTime();
            return entry.accountId === selectedAccountId && entryDate < start;
        });

        const openingDr = openingEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const openingCr = openingEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
        return openingDr - openingCr;
    }, [state.ledger, startDate, selectedAccountId]);

    // Calculate running balance per account
    const entriesWithBalance = useMemo(() => {
        if (selectedAccountId) {
            // Single account: running balance starts from opening balance
            let runningBalance = openingBalance;
            return filteredEntries.map(entry => {
                const debit = entry.debit || 0;
                const credit = entry.credit || 0;
                runningBalance = runningBalance + debit - credit;
                return {
                    ...entry,
                    runningBalance
                };
            });
        } else {
            // Multiple accounts: calculate running balance per account
            const accountBalances: Record<string, number> = {};
            const accountOpeningBalances: Record<string, number> = {};
            
            // Calculate opening balances per account
            const start = new Date(startDate).getTime();
            cashBankAccounts.forEach(acc => {
                const openingEntries = state.ledger.filter(entry => {
                    const entryDate = new Date(entry.date).getTime();
                    return entry.accountId === acc.id && entryDate < start;
                });
                const openingDr = openingEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
                const openingCr = openingEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
                accountOpeningBalances[acc.id] = openingDr - openingCr;
                accountBalances[acc.id] = accountOpeningBalances[acc.id];
            });
            
            // Calculate running balance for each entry
            return filteredEntries.map(entry => {
                const accountId = entry.accountId;
                const currentBalance = accountBalances[accountId] || 0;
                const debit = entry.debit || 0;
                const credit = entry.credit || 0;
                const newBalance = currentBalance + debit - credit;
                accountBalances[accountId] = newBalance;
                return {
                    ...entry,
                    runningBalance: newBalance
                };
            });
        }
    }, [filteredEntries, selectedAccountId, openingBalance, startDate, state.ledger, cashBankAccounts]);

    return (
        <div className="space-y-6 animate-in fade-in h-full flex flex-col">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end shrink-0">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">From</label>
                    <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label>
                    <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)} 
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                    <select 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" 
                        value={transactionFilter} 
                        onChange={e => setTransactionFilter(e.target.value as 'RECEIPTS' | 'PAYMENTS' | 'BOTH')}
                    >
                        <option value="BOTH">Both</option>
                        <option value="RECEIPTS">Receipts</option>
                        <option value="PAYMENTS">Payments</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account</label>
                    <div className="relative">
                        <select 
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm appearance-none" 
                            value={selectedAccountId} 
                            onChange={e => setSelectedAccountId(e.target.value)}
                        >
                            <option value="">-- All Accounts --</option>
                            {cashBankAccounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>
            </div>

            {/* Report Table */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left min-w-full">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-4 whitespace-nowrap">Date</th>
                                <th className="px-4 py-4 whitespace-nowrap">Voucher</th>
                                <th className="px-4 py-4 min-w-[300px]">Description</th>
                                <th className="px-4 py-4 text-right whitespace-nowrap">Debit ($)</th>
                                <th className="px-4 py-4 text-right whitespace-nowrap">Credit ($)</th>
                                <th className="px-4 py-4 text-right whitespace-nowrap">Running Balance ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {selectedAccountId && openingBalance !== 0 && (
                                <tr className="bg-amber-50">
                                    <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">
                                        Opening Balance
                                    </td>
                                    <td className="px-4 py-3"></td>
                                    <td className="px-4 py-3"></td>
                                    <td className="px-4 py-3 text-right font-mono font-bold">
                                        {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            )}
                            {entriesWithBalance.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                        No transactions found for the selected criteria
                                    </td>
                                </tr>
                            ) : (
                                entriesWithBalance.map((entry, index) => {
                                    return (
                                        <tr key={entry.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                                                {new Date(entry.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <button 
                                                    onClick={() => setViewVoucherId(entry.transactionId)} 
                                                    className="text-blue-600 hover:underline font-mono text-xs font-bold hover:text-blue-800"
                                                >
                                                    {entry.transactionId}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800">{entry.narration || '-'}</div>
                                                <div className="text-xs text-slate-500">{entry.accountName}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                                                {entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                                                {entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                                                {entry.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Voucher Details Modal */}
            {viewVoucherId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-5xl w-full animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h3 className="text-xl font-bold text-slate-800">Transaction Details</h3>
                            <button 
                                onClick={() => setViewVoucherId(null)} 
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase">Voucher ID</span>
                                    <span className="font-mono font-bold text-blue-600">{viewVoucherId}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase">Date</span>
                                    <span className="font-medium text-slate-700">
                                        {state.ledger.find(e => e.transactionId === viewVoucherId)?.date 
                                            ? new Date(state.ledger.find(e => e.transactionId === viewVoucherId)!.date).toLocaleDateString()
                                            : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left min-w-full">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 min-w-[300px]">Account</th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">Debit</th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {state.ledger.filter(e => e.transactionId === viewVoucherId).map((row, i) => ( 
                                        <tr key={i}>
                                            <td className="px-4 py-2">
                                                <div className="font-medium text-slate-800">{row.accountName}</div>
                                                <div className="text-xs text-slate-500">{row.narration}</div>
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                                                {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                                                {row.credit > 0 ? row.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                            </td>
                                        </tr> 
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 text-right">
                            <button 
                                onClick={() => setViewVoucherId(null)} 
                                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- ACCOUNTS RECEIVABLE REPORT ---
const AccountsReceivableReport: React.FC = () => {
    const { state, migrateReceivablesToCustomers } = useData();
    const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [transactionFilter, setTransactionFilter] = useState<'RECEIPTS' | 'PAYMENTS' | 'SALES' | 'ALL'>('ALL');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [viewLedgerAccountId, setViewLedgerAccountId] = useState<string | null>(null);
    const [isMigrating, setIsMigrating] = useState(false);

    // Get all customers
    const customers = useMemo(() => {
        return state.partners.filter(p => p.type === PartnerType.CUSTOMER);
    }, [state.partners]);

    // Calculate account balances using partner balances (includes opening balances)
    const accountBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        customers.forEach(c => {
            balances[c.id] = c.balance || 0;
        });
        return balances;
    }, [customers]);

    // Get filtered customer accounts with their transaction info
    const accountData = useMemo(() => {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        
        // Start with ALL customers that have a balance (including opening balances)
        // Filter by selected customer if specified
        let customersToShow = customers;
        if (selectedCustomerId) {
            customersToShow = customers.filter(c => c.id === selectedCustomerId);
        }
        
        // Filter customers that have a non-zero balance
        customersToShow = customersToShow.filter(c => (c.balance || 0) !== 0);
        
        // Get all customer transactions in date range (for finding latest date)
        const customerTransactions = state.ledger.filter(entry => {
            const entryDate = new Date(entry.date).getTime();
            if (entryDate < start || entryDate > end) return false;
            
            const isCustomerEntry = customersToShow.some(c => c.id === entry.accountId);
            if (!isCustomerEntry) return false;
            
            // Transaction type filter
            if (transactionFilter === 'RECEIPTS') {
                if (entry.transactionType !== TransactionType.RECEIPT_VOUCHER) return false;
            } else if (transactionFilter === 'PAYMENTS') {
                if (entry.transactionType !== TransactionType.PAYMENT_VOUCHER) return false;
            } else if (transactionFilter === 'SALES') {
                if (entry.transactionType !== TransactionType.SALES_INVOICE) return false;
            }
            
            return true;
        });
        
        // Build account map with ALL customers that have balances
        const accountMap: Record<string, { customer: typeof customers[0], latestDate: string, hasTransactions: boolean }> = {};
        
        // Initialize with all customers that have balances
        customersToShow.forEach(customer => {
            accountMap[customer.id] = {
                customer,
                latestDate: '',
                hasTransactions: false
            };
        });
        
        // Update with latest transaction date if they have transactions in the period
        customerTransactions.forEach(entry => {
            const customer = customersToShow.find(c => c.id === entry.accountId);
            if (!customer || !accountMap[entry.accountId]) return;
            
            if (!accountMap[entry.accountId].hasTransactions) {
                accountMap[entry.accountId].latestDate = entry.date;
                accountMap[entry.accountId].hasTransactions = true;
            } else {
                // Update latest date if this entry is newer
                const currentDate = new Date(accountMap[entry.accountId].latestDate).getTime();
                const entryDate = new Date(entry.date).getTime();
                if (entryDate > currentDate) {
                    accountMap[entry.accountId].latestDate = entry.date;
                }
            }
        });
        
        // Convert to array and sort by latest date (most recent first), then by balance
        return Object.values(accountMap).sort((a, b) => {
            // First sort by whether they have transactions in period
            if (!a.hasTransactions && b.hasTransactions) return 1;
            if (a.hasTransactions && !b.hasTransactions) return -1;
            
            // If both have transactions, sort by date
            if (a.hasTransactions && b.hasTransactions) {
                const dateA = new Date(a.latestDate).getTime();
                const dateB = new Date(b.latestDate).getTime();
                if (dateA !== dateB) return dateB - dateA; // Most recent first
            }
            
            // If no transactions or same date, sort by balance (largest first)
            const balanceA = Math.abs(accountBalances[a.customer.id] || 0);
            const balanceB = Math.abs(accountBalances[b.customer.id] || 0);
            return balanceB - balanceA;
        });
    }, [state.ledger, startDate, endDate, transactionFilter, selectedCustomerId, customers, accountBalances]);

    // Get account type for display
    const getAccountType = (accountId: string): string => {
        const customer = customers.find(c => c.id === accountId);
        return customer ? 'CUSTOMER' : '-';
    };

    // Get balance status (Debit or Credit)
    const getBalanceStatus = (balance: number): { text: string; color: string } => {
        if (balance > 0) {
            return { text: 'Debit', color: 'text-red-600' };
        } else if (balance < 0) {
            return { text: 'Credit', color: 'text-green-600' };
        } else {
            return { text: 'Balanced', color: 'text-slate-500' };
        }
    };

    // Get ledger entries for a specific account (for popup)
    const getAccountLedger = (accountId: string) => {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        
        return state.ledger
            .filter(entry => {
                const entryDate = new Date(entry.date).getTime();
                return entry.accountId === accountId && entryDate >= start && entryDate <= end;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (dateA !== dateB) return dateA - dateB;
                return a.transactionId.localeCompare(b.transactionId);
            });
    };

    // Calculate opening balance for account ledger
    const getAccountOpeningBalance = (accountId: string): number => {
        const start = new Date(startDate).getTime();
        const openingEntries = state.ledger.filter(entry => {
            const entryDate = new Date(entry.date).getTime();
            return entry.accountId === accountId && entryDate < start;
        });

        const openingDr = openingEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const openingCr = openingEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
        return openingDr - openingCr;
    };

    return (
        <div className="space-y-6 animate-in fade-in h-full flex flex-col">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end shrink-0">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">From</label>
                    <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label>
                    <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)} 
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                    <select 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" 
                        value={transactionFilter} 
                        onChange={e => setTransactionFilter(e.target.value as 'RECEIPTS' | 'PAYMENTS' | 'SALES' | 'ALL')}
                    >
                        <option value="ALL">All</option>
                        <option value="RECEIPTS">Receipts</option>
                        <option value="PAYMENTS">Payments</option>
                        <option value="SALES">Sales</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account</label>
                    <div className="relative">
                        <select 
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm appearance-none" 
                            value={selectedCustomerId} 
                            onChange={e => setSelectedCustomerId(e.target.value)}
                        >
                            <option value="">-- All Customers --</option>
                            {customers.map(customer => (
                                <option key={customer.id} value={customer.id}>{customer.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>
            </div>

            {/* Report Table + Utilities */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">Customer Balances</h3>
                    <button
                        type="button"
                        disabled={isMigrating}
                        onClick={async () => {
                            if (isMigrating) return;
                            setIsMigrating(true);
                            try {
                                await migrateReceivablesToCustomers();
                            } finally {
                                setIsMigrating(false);
                            }
                        }}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                            isMigrating
                                ? 'bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                        }`}
                        title="One-time utility to move legacy receivables from control account into individual customer accounts"
                    >
                        {isMigrating ? (
                            <>
                                <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                <span>Migrating…</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle size={14} className="text-amber-600" />
                                <span>Run AR Migration Utility</span>
                            </>
                        )}
                    </button>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left min-w-full">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-4 whitespace-nowrap">Date</th>
                                <th className="px-4 py-4 min-w-[250px]">Account</th>
                                <th className="px-4 py-4 whitespace-nowrap">Account Type</th>
                                <th className="px-4 py-4 text-right whitespace-nowrap">Balance ($)</th>
                                <th className="px-4 py-4 text-center whitespace-nowrap">Debit or Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {accountData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        No accounts found for the selected criteria
                                    </td>
                                </tr>
                            ) : (
                                accountData.map((accountInfo) => {
                                    const balance = accountBalances[accountInfo.customer.id] || 0;
                                    const status = getBalanceStatus(balance);
                                    return (
                                        <tr key={accountInfo.customer.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                                                {accountInfo.hasTransactions && accountInfo.latestDate
                                                    ? new Date(accountInfo.latestDate).toLocaleDateString()
                                                    : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button 
                                                    onClick={() => setViewLedgerAccountId(accountInfo.customer.id)} 
                                                    className="text-blue-600 hover:underline font-medium hover:text-blue-800 text-left"
                                                >
                                                    {accountInfo.customer.name}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                                CUSTOMER
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                                                {Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <span className={`font-semibold ${status.color}`}>
                                                    {status.text}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Account Ledger Modal */}
            {viewLedgerAccountId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-6xl w-full animate-in zoom-in-95 max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4 shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Account Ledger</h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {customers.find(c => c.id === viewLedgerAccountId)?.name || 'Unknown Account'}
                                </p>
                            </div>
                            <button 
                                onClick={() => setViewLedgerAccountId(null)} 
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 shrink-0">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase">Account</span>
                                    <span className="font-medium text-slate-700">
                                        {customers.find(c => c.id === viewLedgerAccountId)?.name || '-'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase">Period</span>
                                    <span className="font-medium text-slate-700">
                                        {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase">Opening Balance</span>
                                    <span className="font-mono font-bold text-slate-700">
                                        {getAccountOpeningBalance(viewLedgerAccountId).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left min-w-full">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 whitespace-nowrap">Date</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Voucher</th>
                                        <th className="px-4 py-3 min-w-[300px]">Description</th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">Debit</th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">Credit</th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(() => {
                                        const ledgerEntries = getAccountLedger(viewLedgerAccountId);
                                        let runningBalance = getAccountOpeningBalance(viewLedgerAccountId);
                                        
                                        if (ledgerEntries.length === 0) {
                                            return (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                        No transactions in this period
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return (
                                            <>
                                                {runningBalance !== 0 && (
                                                    <tr className="bg-amber-50">
                                                        <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">
                                                            Opening Balance
                                                        </td>
                                                        <td className="px-4 py-3"></td>
                                                        <td className="px-4 py-3"></td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold">
                                                            {runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                )}
                                                {ledgerEntries.map((entry, i) => {
                                                    runningBalance += (entry.debit || 0) - (entry.credit || 0);
                                                    return (
                                                        <tr key={entry.id} className="hover:bg-slate-50">
                                                            <td className="px-4 py-2 whitespace-nowrap text-slate-700">
                                                                {new Date(entry.date).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-4 py-2 whitespace-nowrap">
                                                                <span className="font-mono text-xs text-slate-600">{entry.transactionId}</span>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <div className="font-medium text-slate-800">{entry.narration || '-'}</div>
                                                                <div className="text-xs text-slate-500">{entry.transactionType}</div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                                                                {entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                                                                {entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono font-bold whitespace-nowrap">
                                                                {runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 text-right shrink-0 border-t border-slate-100 pt-4">
                            <button 
                                onClick={() => setViewLedgerAccountId(null)} 
                                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- ACCOUNTS PAYABLE REPORT ---
const AccountsPayableReport: React.FC = () => {
    const { state } = useData();
    const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [transactionFilter, setTransactionFilter] = useState<'RECEIPTS' | 'PAYMENTS' | 'SALES' | 'ALL'>('ALL');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [viewLedgerAccountId, setViewLedgerAccountId] = useState<string | null>(null);

    // Supplier-like partner types (creditors and other payables)
    const supplierLikeTypes: PartnerType[] = [
        PartnerType.SUPPLIER,
        PartnerType.VENDOR,
        PartnerType.FREIGHT_FORWARDER,
        PartnerType.CLEARING_AGENT,
        PartnerType.COMMISSION_AGENT
    ];

    // Get all suppliers/creditors (exclude sub-suppliers)
    const suppliers = useMemo(() => {
        return state.partners.filter(
            p => supplierLikeTypes.includes(p.type) && p.type !== PartnerType.SUB_SUPPLIER
        );
    }, [state.partners]);

    // Calculate account balances using partner balances (includes opening balances)
    const accountBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        suppliers.forEach(s => {
            balances[s.id] = s.balance || 0;
        });
        return balances;
    }, [suppliers]);

    // Get filtered supplier accounts with their transaction info
    const accountData = useMemo(() => {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        // Start with ALL suppliers that have a balance (including opening balances)
        // Filter by selected supplier if specified
        let suppliersToShow = suppliers;
        if (selectedSupplierId) {
            suppliersToShow = suppliers.filter(s => s.id === selectedSupplierId);
        }
        
        // Filter suppliers that have a non-zero balance
        suppliersToShow = suppliersToShow.filter(s => (s.balance || 0) !== 0);

        // Get all supplier transactions in date range (for finding latest date)
        const supplierTransactions = state.ledger.filter(entry => {
            const entryDate = new Date(entry.date).getTime();
            if (entryDate < start || entryDate > end) return false;

            const isSupplierEntry = suppliersToShow.some(s => s.id === entry.accountId);
            if (!isSupplierEntry) return false;

            // Transaction type filter
            if (transactionFilter === 'RECEIPTS') {
                if (entry.transactionType !== TransactionType.RECEIPT_VOUCHER) return false;
            } else if (transactionFilter === 'PAYMENTS') {
                if (entry.transactionType !== TransactionType.PAYMENT_VOUCHER) return false;
            } else if (transactionFilter === 'SALES') {
                // For payables, treat purchase/expense-type entries as "Sales" filter
                if (
                    entry.transactionType !== TransactionType.PURCHASE_INVOICE &&
                    entry.transactionType !== TransactionType.PURCHASE_BILL &&
                    entry.transactionType !== TransactionType.EXPENSE_VOUCHER
                ) {
                    return false;
                }
            }

            return true;
        });

        // Build account map with ALL suppliers that have balances
        const accountMap: Record<string, { supplier: typeof suppliers[0]; latestDate: string; hasTransactions: boolean }> = {};

        // Initialize with all suppliers that have balances
        suppliersToShow.forEach(supplier => {
            accountMap[supplier.id] = {
                supplier,
                latestDate: '',
                hasTransactions: false
            };
        });

        // Update with latest transaction date if they have transactions in the period
        supplierTransactions.forEach(entry => {
            const supplier = suppliersToShow.find(s => s.id === entry.accountId);
            if (!supplier || !accountMap[entry.accountId]) return;

            if (!accountMap[entry.accountId].hasTransactions) {
                accountMap[entry.accountId].latestDate = entry.date;
                accountMap[entry.accountId].hasTransactions = true;
            } else {
                const currentDate = new Date(accountMap[entry.accountId].latestDate).getTime();
                const entryDate = new Date(entry.date).getTime();
                if (entryDate > currentDate) {
                    accountMap[entry.accountId].latestDate = entry.date;
                }
            }
        });

        // Convert to array and sort by latest date (most recent first), then by balance
        return Object.values(accountMap).sort((a, b) => {
            // First sort by whether they have transactions in period
            if (!a.hasTransactions && b.hasTransactions) return 1;
            if (a.hasTransactions && !b.hasTransactions) return -1;
            
            // If both have transactions, sort by date
            if (a.hasTransactions && b.hasTransactions) {
                const dateA = new Date(a.latestDate).getTime();
                const dateB = new Date(b.latestDate).getTime();
                if (dateA !== dateB) return dateB - dateA; // Most recent first
            }
            
            // If no transactions or same date, sort by balance (largest first)
            const balanceA = Math.abs(accountBalances[a.supplier.id] || 0);
            const balanceB = Math.abs(accountBalances[b.supplier.id] || 0);
            return balanceB - balanceA;
        });
    }, [state.ledger, startDate, endDate, transactionFilter, selectedSupplierId, suppliers, accountBalances]);

    // Get account type (partner type) for display
    const getAccountType = (accountId: string): string => {
        const supplier = suppliers.find(s => s.id === accountId);
        return supplier ? supplier.type : '-';
    };

    // Get balance status (Debit or Credit)
    const getBalanceStatus = (balance: number): { text: string; color: string } => {
        if (balance > 0) {
            return { text: 'Debit', color: 'text-red-600' };
        } else if (balance < 0) {
            return { text: 'Credit', color: 'text-green-600' };
        } else {
            return { text: 'Balanced', color: 'text-slate-500' };
        }
    };

    // Get ledger entries for a specific account (for popup)
    const getAccountLedger = (accountId: string) => {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        return state.ledger
            .filter(entry => {
                const entryDate = new Date(entry.date).getTime();
                return entry.accountId === accountId && entryDate >= start && entryDate <= end;
            })
            .sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (dateA !== dateB) return dateA - dateB;
                return a.transactionId.localeCompare(b.transactionId);
            });
    };

    // Calculate opening balance for account ledger
    const getAccountOpeningBalance = (accountId: string): number => {
        const start = new Date(startDate).getTime();
        const openingEntries = state.ledger.filter(entry => {
            const entryDate = new Date(entry.date).getTime();
            return entry.accountId === accountId && entryDate < start;
        });

        const openingDr = openingEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const openingCr = openingEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
        return openingDr - openingCr;
    };

    return (
        <div className="space-y-6 animate-in fade-in h-full flex flex-col">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end shrink-0">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">From</label>
                    <input
                        type="date"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label>
                    <input
                        type="date"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                    <select
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm"
                        value={transactionFilter}
                        onChange={e =>
                            setTransactionFilter(
                                e.target.value as 'RECEIPTS' | 'PAYMENTS' | 'SALES' | 'ALL'
                            )
                        }
                    >
                        <option value="ALL">All</option>
                        <option value="RECEIPTS">Receipts</option>
                        <option value="PAYMENTS">Payments</option>
                        <option value="SALES">Sales / Bills</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Account
                    </label>
                    <div className="relative">
                        <select
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm appearance-none"
                            value={selectedSupplierId}
                            onChange={e => setSelectedSupplierId(e.target.value)}
                        >
                            <option value="">-- All Creditors --</option>
                            {suppliers.map(supplier => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown
                            className="absolute right-2 top-2.5 text-slate-400 pointer-events-none"
                            size={16}
                        />
                    </div>
                </div>
            </div>

            {/* Report Table */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left min-w-full">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-4 whitespace-nowrap">Date</th>
                                <th className="px-4 py-4 min-w-[250px]">Account</th>
                                <th className="px-4 py-4 whitespace-nowrap">Account Type</th>
                                <th className="px-4 py-4 text-right whitespace-nowrap">Balance ($)</th>
                                <th className="px-4 py-4 text-center whitespace-nowrap">
                                    Debit or Credit
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {accountData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-slate-400"
                                    >
                                        No accounts found for the selected criteria
                                    </td>
                                </tr>
                            ) : (
                                accountData.map(accountInfo => {
                                    const balance =
                                        accountBalances[accountInfo.supplier.id] || 0;
                                    const status = getBalanceStatus(balance);
                                    return (
                                        <tr
                                            key={accountInfo.supplier.id}
                                            className="hover:bg-slate-50"
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                                                {accountInfo.hasTransactions &&
                                                accountInfo.latestDate
                                                    ? new Date(
                                                          accountInfo.latestDate
                                                      ).toLocaleDateString()
                                                    : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() =>
                                                        setViewLedgerAccountId(
                                                            accountInfo.supplier.id
                                                        )
                                                    }
                                                    className="text-blue-600 hover:underline font-medium hover:text-blue-800 text-left"
                                                >
                                                    {accountInfo.supplier.name}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                                {getAccountType(accountInfo.supplier.id)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                                                {Math.abs(balance).toLocaleString(
                                                    undefined,
                                                    {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    }
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <span
                                                    className={`font-semibold ${status.color}`}
                                                >
                                                    {status.text}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Account Ledger Modal */}
            {viewLedgerAccountId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-6xl w-full animate-in zoom-in-95 max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4 shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    Account Ledger
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {suppliers.find(s => s.id === viewLedgerAccountId)
                                        ?.name || 'Unknown Account'}
                                </p>
                            </div>
                            <button
                                onClick={() => setViewLedgerAccountId(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 shrink-0">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase">
                                        Account
                                    </span>
                                    <span className="font-medium text-slate-700">
                                        {suppliers.find(s => s.id === viewLedgerAccountId)
                                            ?.name || '-'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase">
                                        Period
                                    </span>
                                    <span className="font-medium text-slate-700">
                                        {new Date(startDate).toLocaleDateString()} -{' '}
                                        {new Date(endDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase">
                                        Opening Balance
                                    </span>
                                    <span className="font-mono font-bold text-slate-700">
                                        {getAccountOpeningBalance(
                                            viewLedgerAccountId
                                        ).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left min-w-full">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 whitespace-nowrap">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 whitespace-nowrap">
                                            Voucher
                                        </th>
                                        <th className="px-4 py-3 min-w-[300px]">
                                            Description
                                        </th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">
                                            Debit
                                        </th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">
                                            Credit
                                        </th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">
                                            Balance
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(() => {
                                        const ledgerEntries =
                                            getAccountLedger(viewLedgerAccountId);
                                        let runningBalance =
                                            getAccountOpeningBalance(
                                                viewLedgerAccountId
                                            );

                                        if (ledgerEntries.length === 0) {
                                            return (
                                                <tr>
                                                    <td
                                                        colSpan={6}
                                                        className="px-4 py-8 text-center text-slate-400"
                                                    >
                                                        No transactions in this period
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return (
                                            <>
                                                {runningBalance !== 0 && (
                                                    <tr className="bg-amber-50">
                                                        <td
                                                            colSpan={3}
                                                            className="px-4 py-3 font-bold text-slate-700"
                                                        >
                                                            Opening Balance
                                                        </td>
                                                        <td className="px-4 py-3"></td>
                                                        <td className="px-4 py-3"></td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold">
                                                            {runningBalance.toLocaleString(
                                                                undefined,
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2
                                                                }
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                                {ledgerEntries.map(entry => {
                                                    runningBalance +=
                                                        (entry.debit || 0) -
                                                        (entry.credit || 0);
                                                    return (
                                                        <tr
                                                            key={entry.id}
                                                            className="hover:bg-slate-50"
                                                        >
                                                            <td className="px-4 py-2 whitespace-nowrap text-slate-700">
                                                                {new Date(
                                                                    entry.date
                                                                ).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-4 py-2 whitespace-nowrap">
                                                                <span className="font-mono text-xs text-slate-600">
                                                                    {
                                                                        entry.transactionId
                                                                    }
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <div className="font-medium text-slate-800">
                                                                    {entry.narration ||
                                                                        '-'}
                                                                </div>
                                                                <div className="text-xs text-slate-500">
                                                                    {
                                                                        entry.transactionType
                                                                    }
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                                                                {entry.debit > 0
                                                                    ? entry.debit.toLocaleString(
                                                                          undefined,
                                                                          {
                                                                              minimumFractionDigits: 2,
                                                                              maximumFractionDigits: 2
                                                                          }
                                                                      )
                                                                    : '-'}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                                                                {entry.credit > 0
                                                                    ? entry.credit.toLocaleString(
                                                                          undefined,
                                                                          {
                                                                              minimumFractionDigits: 2,
                                                                              maximumFractionDigits: 2
                                                                          }
                                                                      )
                                                                    : '-'}
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono font-bold whitespace-nowrap">
                                                                {runningBalance.toLocaleString(
                                                                    undefined,
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-6 text-right shrink-0 border-t border-slate-100 pt-4">
                            <button
                                onClick={() => setViewLedgerAccountId(null)}
                                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- DAY BOOK REPORT ---
const DayBookReport: React.FC = () => {
    const { state } = useData();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
    const [viewVoucherId, setViewVoucherId] = useState<string | null>(null);

    // Get all transaction types for filter
    const transactionTypes = useMemo(() => {
        const types = new Set<string>();
        state.ledger.forEach(entry => {
            if (entry.transactionType) {
                types.add(entry.transactionType);
            }
        });
        return Array.from(types).sort();
    }, [state.ledger]);

    // Filter entries by entry date (createdAt) and voucher type
    // Note: createdAt is stored in Firebase but might not be in the TypeScript interface
    const filteredEntries = useMemo(() => {
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDateObj);
        endOfDay.setHours(23, 59, 59, 999);

        let entries = state.ledger.filter(entry => {
            // Filter by entry date (createdAt) - when the entry was created/entered into the system
            // This allows showing entries entered on one date but with transaction date of previous date
            const entryWithCreatedAt = entry as any;
            let matchesEntryDate = false;
            
            if (entryWithCreatedAt.createdAt) {
                // createdAt is a Firestore Timestamp, convert to Date
                let createdAtDate: Date;
                if (entryWithCreatedAt.createdAt.toDate) {
                    createdAtDate = entryWithCreatedAt.createdAt.toDate();
                } else if (entryWithCreatedAt.createdAt.seconds) {
                    createdAtDate = new Date(entryWithCreatedAt.createdAt.seconds * 1000);
                } else {
                    createdAtDate = new Date(entryWithCreatedAt.createdAt);
                }
                createdAtDate.setHours(0, 0, 0, 0);
                matchesEntryDate = createdAtDate.getTime() === selectedDateObj.getTime();
            } else {
                // Fallback: If createdAt not available, use transaction date
                // This happens if createdAt wasn't loaded from Firebase
                const transactionDate = new Date(entry.date);
                transactionDate.setHours(0, 0, 0, 0);
                matchesEntryDate = transactionDate.getTime() === selectedDateObj.getTime();
            }
            
            if (!matchesEntryDate) return false;

            // Filter by voucher type
            if (voucherTypeFilter !== 'ALL' && entry.transactionType !== voucherTypeFilter) {
                return false;
            }

            // Exclude reporting-only entries
            if ((entry as any).isReportingOnly) {
                return false;
            }

            return true;
        });

        // Group by transactionId
        const groupedByTransaction: { [key: string]: typeof entries } = {};
        entries.forEach(entry => {
            if (!groupedByTransaction[entry.transactionId]) {
                groupedByTransaction[entry.transactionId] = [];
            }
            groupedByTransaction[entry.transactionId].push(entry);
        });

        // Separate PROD transactions from others for aggregation
        const prodTransactions: typeof entries = [];
        const nonProdTransactions: Array<[string, typeof entries]> = [];

        Object.entries(groupedByTransaction).forEach(([txId, txEntries]) => {
            const firstEntry = txEntries[0];
            if (firstEntry.transactionType === TransactionType.PRODUCTION) {
                // Collect all PROD entries for aggregation
                prodTransactions.push(...txEntries);
            } else {
                // Keep non-PROD transactions as individual entries
                nonProdTransactions.push([txId, txEntries]);
            }
        });

        // Aggregate PROD transactions into a single entry
        const finalTransactions: Array<[string, typeof entries]> = [];
        
        if (prodTransactions.length > 0) {
            // Create aggregated PROD entry
            finalTransactions.push(['PRODUCTION-AGGREGATED', prodTransactions]);
        }

        // Add non-PROD transactions
        finalTransactions.push(...nonProdTransactions);

        // Sort transactions by entry date (createdAt), then by transaction ID
        const sortedTransactions = finalTransactions.sort(([txIdA, entriesA], [txIdB, entriesB]) => {
            // Get entry date (createdAt) for sorting
            const getEntryDate = (entry: typeof entriesA[0]) => {
                const entryWithCreatedAt = entry as any;
                if (entryWithCreatedAt.createdAt) {
                    if (entryWithCreatedAt.createdAt.toDate) {
                        return entryWithCreatedAt.createdAt.toDate().getTime();
                    } else if (entryWithCreatedAt.createdAt.seconds) {
                        return entryWithCreatedAt.createdAt.seconds * 1000;
                    } else {
                        return new Date(entryWithCreatedAt.createdAt).getTime();
                    }
                }
                // Fallback to transaction date
                return new Date(entry.date).getTime();
            };
            
            const dateA = getEntryDate(entriesA[0]);
            const dateB = getEntryDate(entriesB[0]);
            if (dateA !== dateB) return dateA - dateB;
            return txIdA.localeCompare(txIdB);
        });

        return sortedTransactions;
    }, [state.ledger, selectedDate, voucherTypeFilter]);

    // Get voucher type label
    const getVoucherTypeLabel = (type: TransactionType | string) => {
        const labels: { [key: string]: string } = {
            [TransactionType.SALES_INVOICE]: 'Sales Invoice (SI)',
            [TransactionType.PURCHASE_INVOICE]: 'Purchase Invoice (PI)',
            [TransactionType.RECEIPT_VOUCHER]: 'Receipt Voucher (RV)',
            [TransactionType.PAYMENT_VOUCHER]: 'Payment Voucher (PV)',
            [TransactionType.EXPENSE_VOUCHER]: 'Expense Voucher (EV)',
            [TransactionType.JOURNAL_VOUCHER]: 'Journal Voucher (JV)',
            [TransactionType.INTERNAL_TRANSFER]: 'Transfer (TR)',
            [TransactionType.PURCHASE_BILL]: 'Purchase Bill (PB)',
            [TransactionType.BALANCING_DISCREPANCY]: 'Balance Discrepancy (BD)',
            [TransactionType.INVENTORY_ADJUSTMENT]: 'Inventory Adjustment (IA)',
            [TransactionType.OPENING_BALANCE]: 'Opening Balance (OB)',
            [TransactionType.PRODUCTION]: 'Production (PROD)',
        };
        return labels[type] || type;
    };

    // Calculate totals for a transaction
    const getTransactionTotals = (entries: typeof state.ledger) => {
        const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
        return { totalDebit, totalCredit };
    };

    // Get voucher entries for detail view
    const voucherEntries = useMemo(() => {
        if (!viewVoucherId) return [];
        return state.ledger.filter(e => e.transactionId === viewVoucherId);
    }, [state.ledger, viewVoucherId]);

    // Export Daybook to Excel
    const handleExportToExcel = () => {
        // Prepare data for export - flatten all entries with complete details
        const exportData: any[] = [];
        const unbalancedTransactions: Array<{
            transactionId: string;
            transactionType: string;
            totalDebit: number;
            totalCredit: number;
            imbalance: number;
            entryCount: number;
            date: string;
        }> = [];
        
        filteredEntries.forEach(([transactionId, entries]) => {
            const totals = getTransactionTotals(entries);
            const firstEntry = entries[0];
            const isAggregatedProd = transactionId === 'PRODUCTION-AGGREGATED';
            
            // Check if transaction is balanced (allow 0.01 tolerance for rounding)
            const imbalance = Math.abs(totals.totalDebit - totals.totalCredit);
            const isBalanced = imbalance <= 0.01;
            
            // Track unbalanced transactions for summary sheet
            if (!isBalanced) {
                unbalancedTransactions.push({
                    transactionId,
                    transactionType: getVoucherTypeLabel(firstEntry.transactionType),
                    totalDebit: totals.totalDebit,
                    totalCredit: totals.totalCredit,
                    imbalance: totals.totalDebit - totals.totalCredit,
                    entryCount: entries.length,
                    date: firstEntry.date
                });
            }
            
            // Get account code if available (checks both Chart of Accounts and Partners)
            const getAccountCode = (accountId: string) => {
                // First check Chart of Accounts
                const account = state.accounts.find(a => a.id === accountId);
                if (account?.code) {
                    return account.code;
                }
                // If not found, check Partners (customers, suppliers, etc.)
                const partner = state.partners.find(p => p.id === accountId);
                if (partner?.code) {
                    return partner.code;
                }
                // Return empty if no code found
                return '';
            };
            
            // Handle aggregated production entries - group by original transaction ID
            if (isAggregatedProd) {
                const groupedByOriginalTx: { [key: string]: typeof entries } = {};
                entries.forEach(entry => {
                    if (!groupedByOriginalTx[entry.transactionId]) {
                        groupedByOriginalTx[entry.transactionId] = [];
                    }
                    groupedByOriginalTx[entry.transactionId].push(entry);
                });
                
                // Export each original production transaction separately
                Object.entries(groupedByOriginalTx).forEach(([originalTxId, txEntries]) => {
                    const txTotals = getTransactionTotals(txEntries);
                    
                    txEntries.forEach((entry, index) => {
                        const accountCode = getAccountCode(entry.accountId);
                        const entryWithCreatedAt = entry as any;
                        
                        // Get entry timestamp if available
                        let entryTimestamp = '';
                        if (entryWithCreatedAt.createdAt) {
                            let createdAtDate: Date;
                            if (entryWithCreatedAt.createdAt.toDate) {
                                createdAtDate = entryWithCreatedAt.createdAt.toDate();
                            } else if (entryWithCreatedAt.createdAt.seconds) {
                                createdAtDate = new Date(entryWithCreatedAt.createdAt.seconds * 1000);
                            } else {
                                createdAtDate = new Date(entryWithCreatedAt.createdAt);
                            }
                            entryTimestamp = createdAtDate.toISOString();
                        }
                        
                        exportData.push({
                            'Transaction ID': originalTxId,
                            'Entry Date': selectedDate,
                            'Transaction Date': entry.date,
                            'Entry Timestamp': entryTimestamp,
                            'Transaction Type': getVoucherTypeLabel(entry.transactionType),
                            'Transaction Type Code': entry.transactionType,
                            'Account Code': accountCode,
                            'Account Name': entry.accountName,
                            'Account ID': entry.accountId,
                            'Currency': entry.currency || 'USD',
                            'Exchange Rate': entry.exchangeRate || 1,
                            'FCY Amount': entry.fcyAmount || 0,
                            'Debit (USD)': entry.debit > 0 ? entry.debit : '',
                            'Credit (USD)': entry.credit > 0 ? entry.credit : '',
                            'Narration': entry.narration || '',
                            'Factory ID': entry.factoryId || '',
                            'Is Adjustment': (entry as any).isAdjustment ? 'Yes' : 'No',
                            'Is Reporting Only': (entry as any).isReportingOnly ? 'Yes' : 'No',
                            'Entry Index': index + 1,
                            'Total Entries in Transaction': txEntries.length,
                            'Transaction Total Debit': txTotals.totalDebit,
                            'Transaction Total Credit': txTotals.totalCredit,
                            'Transaction Balance': txTotals.totalDebit - txTotals.totalCredit,
                            'Is Balanced': Math.abs(txTotals.totalDebit - txTotals.totalCredit) <= 0.01 ? 'Yes' : 'NO - UNBALANCED',
                            'Imbalance Amount': Math.abs(txTotals.totalDebit - txTotals.totalCredit) > 0.01 ? Math.abs(txTotals.totalDebit - txTotals.totalCredit) : '',
                            'Is Aggregated Production': 'Yes'
                        });
                    });
                    
                    // Add summary row for this production transaction
                    const txImbalance = Math.abs(txTotals.totalDebit - txTotals.totalCredit);
                    exportData.push({
                        'Transaction ID': originalTxId,
                        'Entry Date': selectedDate,
                        'Transaction Date': txEntries[0].date,
                        'Entry Timestamp': '',
                        'Transaction Type': getVoucherTypeLabel(TransactionType.PRODUCTION),
                        'Transaction Type Code': TransactionType.PRODUCTION,
                        'Account Code': '',
                        'Account Name': '=== PRODUCTION TRANSACTION TOTAL ===',
                        'Account ID': '',
                        'Currency': 'USD',
                        'Exchange Rate': '',
                        'FCY Amount': '',
                        'Debit (USD)': txTotals.totalDebit > 0 ? txTotals.totalDebit : '',
                        'Credit (USD)': txTotals.totalCredit > 0 ? txTotals.totalCredit : '',
                        'Narration': `Total for ${originalTxId}`,
                        'Factory ID': txEntries[0].factoryId || '',
                        'Is Adjustment': '',
                        'Is Reporting Only': '',
                        'Entry Index': '',
                        'Total Entries in Transaction': txEntries.length,
                        'Transaction Total Debit': txTotals.totalDebit,
                        'Transaction Total Credit': txTotals.totalCredit,
                        'Transaction Balance': txTotals.totalDebit - txTotals.totalCredit,
                        'Is Balanced': txImbalance <= 0.01 ? 'Yes' : 'NO - UNBALANCED',
                        'Imbalance Amount': txImbalance > 0.01 ? txImbalance : '',
                        'Is Aggregated Production': 'Yes'
                    });
                });
            } else {
                // Regular transaction - export all entries
                entries.forEach((entry, index) => {
                    const accountCode = getAccountCode(entry.accountId);
                    const entryWithCreatedAt = entry as any;
                    
                    // Get entry timestamp if available
                    let entryTimestamp = '';
                    if (entryWithCreatedAt.createdAt) {
                        let createdAtDate: Date;
                        if (entryWithCreatedAt.createdAt.toDate) {
                            createdAtDate = entryWithCreatedAt.createdAt.toDate();
                        } else if (entryWithCreatedAt.createdAt.seconds) {
                            createdAtDate = new Date(entryWithCreatedAt.createdAt.seconds * 1000);
                        } else {
                            createdAtDate = new Date(entryWithCreatedAt.createdAt);
                        }
                        entryTimestamp = createdAtDate.toISOString();
                    }
                    
                    exportData.push({
                        'Transaction ID': transactionId,
                        'Entry Date': selectedDate,
                        'Transaction Date': entry.date,
                        'Entry Timestamp': entryTimestamp,
                        'Transaction Type': getVoucherTypeLabel(entry.transactionType),
                        'Transaction Type Code': entry.transactionType,
                        'Account Code': accountCode,
                        'Account Name': entry.accountName,
                        'Account ID': entry.accountId,
                        'Currency': entry.currency || 'USD',
                        'Exchange Rate': entry.exchangeRate || 1,
                        'FCY Amount': entry.fcyAmount || 0,
                        'Debit (USD)': entry.debit > 0 ? entry.debit : '',
                        'Credit (USD)': entry.credit > 0 ? entry.credit : '',
                        'Narration': entry.narration || '',
                        'Factory ID': entry.factoryId || '',
                        'Is Adjustment': (entry as any).isAdjustment ? 'Yes' : 'No',
                        'Is Reporting Only': (entry as any).isReportingOnly ? 'Yes' : 'No',
                        'Entry Index': index + 1,
                        'Total Entries in Transaction': entries.length,
                        'Transaction Total Debit': totals.totalDebit,
                        'Transaction Total Credit': totals.totalCredit,
                        'Transaction Balance': totals.totalDebit - totals.totalCredit,
                        'Is Balanced': Math.abs(totals.totalDebit - totals.totalCredit) <= 0.01 ? 'Yes' : 'NO - UNBALANCED',
                        'Imbalance Amount': Math.abs(totals.totalDebit - totals.totalCredit) > 0.01 ? Math.abs(totals.totalDebit - totals.totalCredit) : '',
                        'Is Aggregated Production': 'No'
                    });
                });
                
                // Add a summary row after each transaction
                const txImbalance = Math.abs(totals.totalDebit - totals.totalCredit);
                exportData.push({
                    'Transaction ID': transactionId,
                    'Entry Date': selectedDate,
                    'Transaction Date': firstEntry.date,
                    'Entry Timestamp': '',
                    'Transaction Type': getVoucherTypeLabel(firstEntry.transactionType),
                    'Transaction Type Code': firstEntry.transactionType,
                    'Account Code': '',
                    'Account Name': '=== TRANSACTION TOTAL ===',
                    'Account ID': '',
                    'Currency': 'USD',
                    'Exchange Rate': '',
                    'FCY Amount': '',
                    'Debit (USD)': totals.totalDebit > 0 ? totals.totalDebit : '',
                    'Credit (USD)': totals.totalCredit > 0 ? totals.totalCredit : '',
                    'Narration': `Total for ${transactionId}`,
                    'Factory ID': firstEntry.factoryId || '',
                    'Is Adjustment': '',
                    'Is Reporting Only': '',
                    'Entry Index': '',
                    'Total Entries in Transaction': entries.length,
                    'Transaction Total Debit': totals.totalDebit,
                    'Transaction Total Credit': totals.totalCredit,
                    'Transaction Balance': totals.totalDebit - totals.totalCredit,
                    'Is Balanced': txImbalance <= 0.01 ? 'Yes' : 'NO - UNBALANCED',
                    'Imbalance Amount': txImbalance > 0.01 ? txImbalance : '',
                    'Is Aggregated Production': 'No'
                });
            }
        });
        
        // Calculate grand totals
        const grandTotalDebit = filteredEntries.reduce((sum, [_, entries]) => {
            return sum + getTransactionTotals(entries).totalDebit;
        }, 0);
        const grandTotalCredit = filteredEntries.reduce((sum, [_, entries]) => {
            return sum + getTransactionTotals(entries).totalCredit;
        }, 0);
        
        // Add grand total row
        exportData.push({
            'Transaction ID': '',
            'Entry Date': selectedDate,
            'Transaction Date': '',
            'Entry Timestamp': '',
            'Transaction Type': '',
            'Transaction Type Code': '',
            'Account Code': '',
            'Account Name': '=== GRAND TOTAL ===',
            'Account ID': '',
            'Currency': 'USD',
            'Exchange Rate': '',
            'FCY Amount': '',
            'Debit (USD)': grandTotalDebit > 0 ? grandTotalDebit : '',
            'Credit (USD)': grandTotalCredit > 0 ? grandTotalCredit : '',
            'Narration': `Grand Total for ${selectedDate}`,
            'Factory ID': state.currentFactory?.id || '',
            'Is Adjustment': '',
            'Is Reporting Only': '',
            'Entry Index': '',
            'Total Entries in Transaction': filteredEntries.length,
            'Transaction Total Debit': grandTotalDebit,
            'Transaction Total Credit': grandTotalCredit,
            'Transaction Balance': grandTotalDebit - grandTotalCredit,
            'Is Balanced': Math.abs(grandTotalDebit - grandTotalCredit) <= 0.01 ? 'Yes' : 'NO - UNBALANCED',
            'Imbalance Amount': Math.abs(grandTotalDebit - grandTotalCredit) > 0.01 ? Math.abs(grandTotalDebit - grandTotalCredit) : '',
            'Is Aggregated Production': ''
        });
        
        // Create summary data for unbalanced transactions
        const summaryData: any[] = [
            {
                'Summary': '=== DAYBOOK VALIDATION SUMMARY ===',
                'Date': selectedDate,
                'Factory': state.currentFactory?.name || 'All',
                'Voucher Type Filter': voucherTypeFilter === 'ALL' ? 'All Types' : getVoucherTypeLabel(voucherTypeFilter),
                'Total Transactions': filteredEntries.length,
                'Balanced Transactions': filteredEntries.length - unbalancedTransactions.length,
                'Unbalanced Transactions': unbalancedTransactions.length,
                'Grand Total Debit': grandTotalDebit,
                'Grand Total Credit': grandTotalCredit,
                'Grand Total Imbalance': grandTotalDebit - grandTotalCredit
            },
            {}, // Empty row
            {
                'Summary': '=== UNBALANCED TRANSACTIONS ===',
                'Date': '',
                'Factory': '',
                'Voucher Type Filter': '',
                'Total Transactions': '',
                'Balanced Transactions': '',
                'Unbalanced Transactions': '',
                'Grand Total Debit': '',
                'Grand Total Credit': '',
                'Grand Total Imbalance': ''
            }
        ];
        
        if (unbalancedTransactions.length > 0) {
            summaryData.push({
                'Summary': 'Transaction ID',
                'Date': 'Transaction Type',
                'Factory': 'Entry Count',
                'Voucher Type Filter': 'Total Debit',
                'Total Transactions': 'Total Credit',
                'Balanced Transactions': 'Imbalance',
                'Unbalanced Transactions': 'Status',
                'Grand Total Debit': '',
                'Grand Total Credit': '',
                'Grand Total Imbalance': ''
            });
            
            unbalancedTransactions.forEach(tx => {
                summaryData.push({
                    'Summary': tx.transactionId,
                    'Date': tx.date,
                    'Factory': tx.transactionType,
                    'Voucher Type Filter': tx.entryCount,
                    'Total Transactions': tx.totalDebit,
                    'Balanced Transactions': tx.totalCredit,
                    'Unbalanced Transactions': tx.imbalance,
                    'Grand Total Debit': tx.imbalance > 0 ? 'Debit > Credit' : 'Credit > Debit',
                    'Grand Total Credit': '',
                    'Grand Total Imbalance': ''
                });
            });
        } else {
            summaryData.push({
                'Summary': '✅ All transactions are balanced!',
                'Date': '',
                'Factory': '',
                'Voucher Type Filter': '',
                'Total Transactions': '',
                'Balanced Transactions': '',
                'Unbalanced Transactions': '',
                'Grand Total Debit': '',
                'Grand Total Credit': '',
                'Grand Total Imbalance': ''
            });
        }
        
        // Create workbook and worksheets
        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Set column widths for summary sheet
        const summaryColWidths = [
            { wch: 30 }, // Summary
            { wch: 12 }, // Date
            { wch: 20 }, // Factory
            { wch: 20 }, // Voucher Type Filter
            { wch: 18 }, // Total Transactions
            { wch: 20 }, // Balanced Transactions
            { wch: 22 }, // Unbalanced Transactions
            { wch: 18 }, // Grand Total Debit
            { wch: 18 }, // Grand Total Credit
            { wch: 20 }  // Grand Total Imbalance
        ];
        wsSummary['!cols'] = summaryColWidths;
        
        // Set column widths for better readability
        const colWidths = [
            { wch: 20 }, // Transaction ID
            { wch: 12 }, // Entry Date
            { wch: 12 }, // Transaction Date
            { wch: 20 }, // Entry Timestamp
            { wch: 25 }, // Transaction Type
            { wch: 15 }, // Transaction Type Code
            { wch: 12 }, // Account Code
            { wch: 30 }, // Account Name
            { wch: 15 }, // Account ID
            { wch: 10 }, // Currency
            { wch: 12 }, // Exchange Rate
            { wch: 12 }, // FCY Amount
            { wch: 12 }, // Debit (USD)
            { wch: 12 }, // Credit (USD)
            { wch: 40 }, // Narration
            { wch: 15 }, // Factory ID
            { wch: 12 }, // Is Adjustment
            { wch: 15 }, // Is Reporting Only
            { wch: 12 }, // Entry Index
            { wch: 20 }, // Total Entries in Transaction
            { wch: 20 }, // Transaction Total Debit
            { wch: 20 }, // Transaction Total Credit
            { wch: 18 }, // Transaction Balance
            { wch: 15 }, // Is Balanced
            { wch: 15 }, // Imbalance Amount
            { wch: 20 }  // Is Aggregated Production
        ];
        ws['!cols'] = colWidths;
        
        // Add worksheets to workbook (Summary first, then Daybook)
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
        XLSX.utils.book_append_sheet(wb, ws, 'Daybook');
        
        // Generate filename
        const dateStr = selectedDate.replace(/-/g, '');
        const factoryName = state.currentFactory?.name || 'All';
        const filename = `Daybook_${factoryName}_${dateStr}_${voucherTypeFilter === 'ALL' ? 'AllTypes' : voucherTypeFilter}.xlsx`;
        
        // Write file
        XLSX.writeFile(wb, filename);
    };

    return (
        <div className="space-y-6 animate-in fade-in h-full flex flex-col">
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-end shrink-0">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Entry Date</label>
                    <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)} 
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Voucher Type</label>
                    <select 
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" 
                        value={voucherTypeFilter} 
                        onChange={e => setVoucherTypeFilter(e.target.value)}
                    >
                        <option value="ALL">All Types</option>
                        {transactionTypes.map(type => (
                            <option key={type} value={type}>{getVoucherTypeLabel(type)}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportToExcel}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2"
                        disabled={filteredEntries.length === 0}
                    >
                        <Download size={16} />
                        Export Excel
                    </button>
                    <button
                        onClick={() => {
                            const printWindow = window.open('', '_blank');
                            if (printWindow) {
                                printWindow.document.write(`
                                    <html>
                                        <head><title>Day Book - ${selectedDate}</title></head>
                                        <body>
                                            <h2>Day Book - ${selectedDate}</h2>
                                            <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
                                                <thead>
                                                    <tr>
                                                        <th>Voucher</th><th>Date</th><th>Type</th><th>Account</th><th>Debit</th><th>Credit</th><th>Narration</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${filteredEntries.flatMap(([txId, entries]) => 
                                                        entries.map(entry => `
                                                            <tr>
                                                                <td>${txId}</td>
                                                                <td>${entry.date}</td>
                                                                <td>${getVoucherTypeLabel(entry.transactionType)}</td>
                                                                <td>${entry.accountName}</td>
                                                                <td>${entry.debit > 0 ? entry.debit.toFixed(2) : ''}</td>
                                                                <td>${entry.credit > 0 ? entry.credit.toFixed(2) : ''}</td>
                                                                <td>${entry.narration}</td>
                                                            </tr>
                                                        `).join('')
                                                    ).join('')}
                                                </tbody>
                                            </table>
                                        </body>
                                    </html>
                                `);
                                printWindow.document.close();
                                printWindow.print();
                            }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"
                    >
                        <Printer size={16} />
                        Print
                    </button>
                </div>
            </div>

            {/* Report Title */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
                <h2 className="text-lg font-bold text-slate-800">
                    Day Book - {new Date(selectedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Showing all entries {voucherTypeFilter !== 'ALL' ? `of type ${getVoucherTypeLabel(voucherTypeFilter)}` : ''} entered on this date
                </p>
            </div>

            {/* Transactions List */}
            <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-200 shadow-sm">
                {filteredEntries.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-semibold">No entries found</p>
                        <p className="text-sm mt-2">No vouchers were entered on {new Date(selectedDate).toLocaleDateString()}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredEntries.map(([transactionId, entries]) => {
                            const totals = getTransactionTotals(entries);
                            const firstEntry = entries[0];
                            const isAggregatedProd = transactionId === 'PRODUCTION-AGGREGATED';
                            
                            // For aggregated PROD, show "Production" instead of transaction ID
                            const displayLabel = isAggregatedProd ? 'Production' : transactionId;
                            const voucherType = isAggregatedProd 
                                ? 'Production (PROD)' 
                                : getVoucherTypeLabel(firstEntry.transactionType);
                            
                            // Group entries by original transaction ID for aggregated PROD
                            const groupedByOriginalTx: { [key: string]: typeof entries } = {};
                            if (isAggregatedProd) {
                                entries.forEach(entry => {
                                    if (!groupedByOriginalTx[entry.transactionId]) {
                                        groupedByOriginalTx[entry.transactionId] = [];
                                    }
                                    groupedByOriginalTx[entry.transactionId].push(entry);
                                });
                            }
                            
                            return (
                                <div key={transactionId} className="p-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setViewVoucherId(viewVoucherId === transactionId ? null : transactionId)}
                                                className="text-blue-600 hover:text-blue-800"
                                            >
                                                {viewVoucherId === transactionId ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            </button>
                                            <div>
                                                <span className="font-mono font-bold text-slate-800">{displayLabel}</span>
                                                <span className="ml-3 text-sm text-slate-500">{voucherType}</span>
                                                {isAggregatedProd && (
                                                    <span className="ml-2 text-xs text-slate-400">
                                                        ({Object.keys(groupedByOriginalTx).length} entries)
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm text-slate-400">{firstEntry.date}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-slate-600">
                                                Debit: <span className="font-bold text-green-700">${totals.totalDebit.toFixed(2)}</span>
                                            </span>
                                            <span className="text-slate-600">
                                                Credit: <span className="font-bold text-red-700">${totals.totalCredit.toFixed(2)}</span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {viewVoucherId === transactionId && (
                                        <div className="mt-3 ml-7 bg-slate-50 rounded-lg p-3 border border-slate-200">
                                            {isAggregatedProd ? (
                                                // Show grouped production entries
                                                <div className="space-y-4">
                                                    {Object.entries(groupedByOriginalTx).map(([originalTxId, txEntries]) => {
                                                        const txTotals = getTransactionTotals(txEntries);
                                                        return (
                                                            <div key={originalTxId} className="bg-white rounded p-3 border border-slate-200">
                                                                <div className="font-semibold text-slate-700 mb-2 pb-2 border-b border-slate-200">
                                                                    {originalTxId} - {getVoucherTypeLabel(TransactionType.PRODUCTION)}
                                                                </div>
                                                                <table className="w-full text-sm">
                                                                    <thead className="bg-slate-100 text-slate-600 font-bold">
                                                                        <tr>
                                                                            <th className="px-3 py-2 text-left">Account</th>
                                                                            <th className="px-3 py-2 text-right">Debit ($)</th>
                                                                            <th className="px-3 py-2 text-right">Credit ($)</th>
                                                                            <th className="px-3 py-2 text-left">Narration</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {txEntries.map((entry, idx) => (
                                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                                <td className="px-3 py-2 font-medium">{entry.accountName}</td>
                                                                                <td className="px-3 py-2 text-right font-mono">
                                                                                    {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-right font-mono">
                                                                                    {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-slate-500 italic">{entry.narration}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                    <tfoot className="bg-slate-100 font-bold">
                                                                        <tr>
                                                                            <td className="px-3 py-2">Subtotal</td>
                                                                            <td className="px-3 py-2 text-right text-green-700">${txTotals.totalDebit.toFixed(2)}</td>
                                                                            <td className="px-3 py-2 text-right text-red-700">${txTotals.totalCredit.toFixed(2)}</td>
                                                                            <td className="px-3 py-2"></td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="bg-blue-50 rounded p-3 border border-blue-200">
                                                        <table className="w-full text-sm">
                                                            <tfoot className="font-bold">
                                                                <tr>
                                                                    <td className="px-3 py-2">Total Production</td>
                                                                    <td className="px-3 py-2 text-right text-green-700">${totals.totalDebit.toFixed(2)}</td>
                                                                    <td className="px-3 py-2 text-right text-red-700">${totals.totalCredit.toFixed(2)}</td>
                                                                    <td className="px-3 py-2"></td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                // Show regular transaction entries
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-100 text-slate-600 font-bold">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">Account</th>
                                                            <th className="px-3 py-2 text-right">Debit ($)</th>
                                                            <th className="px-3 py-2 text-right">Credit ($)</th>
                                                            <th className="px-3 py-2 text-left">Narration</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {entries.map((entry, idx) => (
                                                            <tr key={idx} className="hover:bg-white">
                                                                <td className="px-3 py-2 font-medium">{entry.accountName}</td>
                                                                <td className="px-3 py-2 text-right font-mono">
                                                                    {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono">
                                                                    {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                                                                </td>
                                                                <td className="px-3 py-2 text-slate-500 italic">{entry.narration}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="bg-slate-100 font-bold">
                                                        <tr>
                                                            <td className="px-3 py-2">Total</td>
                                                            <td className="px-3 py-2 text-right text-green-700">${totals.totalDebit.toFixed(2)}</td>
                                                            <td className="px-3 py-2 text-right text-red-700">${totals.totalCredit.toFixed(2)}</td>
                                                            <td className="px-3 py-2"></td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- AUDIT LOG REPORT ---
const AuditLogReport: React.FC = () => {
    const { state } = useData();
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-slate-800 text-white p-6 rounded-xl shadow-md">
                <div className="flex items-center gap-3 mb-2"><ShieldAlert size={24} className="text-red-400" /><h2 className="text-xl font-bold">Secure Audit Trail</h2></div>
                <p className="text-slate-300 text-sm">This log contains an immutable record of all transactions that have been voided, deleted, or edited in the system.</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200"><tr><th className="px-6 py-4">Deleted At</th><th className="px-6 py-4">Voucher ID</th><th className="px-6 py-4">Reason</th><th className="px-6 py-4">Auth By (PIN)</th><th className="px-6 py-4 text-right">Value ($)</th><th className="px-6 py-4 text-center">Details</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {state.archive.map(entry => (
                            <React.Fragment key={entry.id}>
                                <tr className="hover:bg-red-50 transition-colors"><td className="px-6 py-4 text-slate-500">{new Date(entry.deletedAt).toLocaleString()}</td><td className="px-6 py-4 font-mono font-bold text-slate-700">{entry.originalTransactionId}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${entry.reason.includes('Edit') ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{entry.reason}</span></td><td className="px-6 py-4 font-mono text-xs">{entry.deletedBy}</td><td className="px-6 py-4 text-right font-mono font-bold">${entry.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td className="px-6 py-4 text-center"><button onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)} className="text-slate-400 hover:text-slate-600">{expandedRow === entry.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td></tr>
                                {expandedRow === entry.id && ( <tr className="bg-slate-50 border-b border-slate-100"><td colSpan={6} className="p-4"><div className="bg-white border border-slate-200 rounded-lg p-3 text-xs"><h4 className="font-bold text-slate-500 mb-2 uppercase">Original Transaction Data</h4><table className="w-full"><thead><tr className="text-slate-400 border-b border-slate-100"><th className="text-left py-1">Account</th><th className="text-right py-1">Debit</th><th className="text-right py-1">Credit</th><th className="text-left py-1 pl-4">Narration</th></tr></thead><tbody>{entry.entries.map((row, i) => ( <tr key={i} className="border-b border-slate-50 last:border-0"><td className="py-1 font-medium">{row.accountName}</td><td className="py-1 text-right font-mono">{row.debit > 0 ? row.debit.toFixed(2) : '-'}</td><td className="py-1 text-right font-mono">{row.credit > 0 ? row.credit.toFixed(2) : '-'}</td><td className="py-1 pl-4 text-slate-500 italic">{row.narration}</td></tr> ))}</tbody></table></div></td></tr> )}
                            </React.Fragment>
                        ))}
                        {state.archive.length === 0 && ( <tr><td colSpan={6} className="text-center py-8 text-slate-400 italic">No audit records found.</td></tr> )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- MAIN MODULE SHELL ---

export const ReportsModuleV2: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab') as 'BI' | 'INV' | 'FIN' | 'LEDGER' | 'DAYBOOK' | 'PROD' | 'EXP' | 'CASH' | 'AR' | 'AP' | null;
    const [activeTab, setActiveTab] = useState<'BI' | 'INV' | 'FIN' | 'LEDGER' | 'DAYBOOK' | 'PROD' | 'EXP' | 'CASH' | 'AR' | 'AP'>(tabFromUrl || 'BI');
    
    // Update URL when tab changes
    useEffect(() => {
        if (tabFromUrl && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl]);
    
    const handleTabChange = (tab: 'BI' | 'INV' | 'FIN' | 'LEDGER' | 'DAYBOOK' | 'PROD' | 'EXP' | 'CASH' | 'AR' | 'AP') => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50">
            {/* Quick Links Section - Responsive */}
            <div className="bg-gradient-to-r from-blue-600 to-emerald-600 px-4 lg:px-8 py-3 lg:py-4 shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <h3 className="text-white font-bold text-xs lg:text-sm uppercase tracking-wide">📊 Specialized Reports</h3>
                    <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
                        <Link 
                            to="/reports/order-fulfillment" 
                            className="flex items-center justify-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-white/90 hover:bg-white text-purple-700 rounded-lg text-xs lg:text-sm font-semibold transition-all shadow-sm"
                        >
                            <Truck size={14} className="lg:w-4 lg:h-4" />
                            <span className="whitespace-nowrap">Order Fulfillment</span>
                            <ExternalLink size={12} className="lg:w-3.5 lg:h-3.5" />
                        </Link>
                        <Link 
                            to="/reports/original-stock" 
                            className="flex items-center justify-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-white/90 hover:bg-white text-blue-700 rounded-lg text-xs lg:text-sm font-semibold transition-all shadow-sm"
                        >
                            <Package size={14} className="lg:w-4 lg:h-4" />
                            <span className="whitespace-nowrap">Original Stock</span>
                            <ExternalLink size={12} className="lg:w-3.5 lg:h-3.5" />
                        </Link>
                        <Link 
                            to="/reports/item-performance" 
                            className="flex items-center justify-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-white/90 hover:bg-white text-emerald-700 rounded-lg text-xs lg:text-sm font-semibold transition-all shadow-sm"
                        >
                            <TrendingUp size={14} className="lg:w-4 lg:h-4" />
                            <span className="whitespace-nowrap">Item Performance</span>
                            <ExternalLink size={12} className="lg:w-3.5 lg:h-3.5" />
                        </Link>
                    </div>
                </div>
            </div>

            <div className="bg-white border-b border-slate-200 px-8 flex items-center gap-8 shadow-sm shrink-0 overflow-x-auto">
                {[
                    { id: 'BI', label: 'Executive Dashboard', icon: LayoutDashboard },
                    { id: 'INV', label: 'Inventory Intelligence', icon: Package },
                    { id: 'FIN', label: 'Financial Statements', icon: FileText },
                    { id: 'LEDGER', label: 'General Ledger', icon: BookOpen },
                    { id: 'DAYBOOK', label: 'Day Book', icon: Calendar },
                    { id: 'PROD', label: 'Production Yield', icon: Factory },
                    { id: 'EXP', label: 'Smart Explorer', icon: Search },
                    { id: 'CASH', label: 'Cash Movement', icon: Wallet },
                    { id: 'AR', label: 'Accounts Receivable', icon: Users },
                    { id: 'AP', label: 'Accounts Payable', icon: Briefcase },
                ].map(tab => (
                    <button key={tab.id} onClick={() => handleTabChange(tab.id as any)} className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}><tab.icon size={18} />{tab.label}</button>
                ))}
            </div>
            <div className="flex-1 overflow-auto p-8">
                {activeTab === 'BI' && <BiDashboard />}
                {activeTab === 'INV' && <InventoryIntelligence />}
                {activeTab === 'FIN' && <FinancialStatementsContainer />}
                {activeTab === 'LEDGER' && <LedgerReport />}
                {activeTab === 'DAYBOOK' && <DayBookReport />}
                {activeTab === 'PROD' && <ProductionYield />}
                {activeTab === 'EXP' && <SmartExplorer />}
                {activeTab === 'CASH' && <CashMovementReport />}
                {activeTab === 'AR' && <AccountsReceivableReport />}
                {activeTab === 'AP' && <AccountsPayableReport />}
            </div>
        </div>
    );
};
