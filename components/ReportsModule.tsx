
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { AccountType, TransactionType, PartnerType } from '../types';
import { 
    PieChart, BarChart, LineChart, Line, Bar, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
    FileText, 
    TrendingUp, 
    Package, 
    Truck, 
    Book, 
    DollarSign, 
    File, 
    List, 
    Factory, 
    Briefcase, 
    ChevronRight, 
    ChevronDown, 
    Search,
    Download,
    Printer,
    ShieldAlert,
    History
} from 'lucide-react';
import { CHART_COLORS } from '../constants';

// --- Types ---
type ReportId = 
    | 'perf-summary' | 'stock-worth' | 'item-sales' | 'non-moving' | 'stock-alerts' | 'prod-analysis'
    | 'orig-stock'
    | 'order-fulfill'
    | 'ledger-report'
    | 'cash-bank-ledger' | 'cash-book' | 'bank-book'
    | 'sales-invoices' | 'purchase-invoices'
    | 'detailed-sales' | 'detailed-purchases'
    | 'orig-combination' | 'daily-prod' | 'rebaling' | 'section-prod' | 'feasibility' | 'yield-analysis'
    | 'balance-sheet' | 'profit-loss' | 'receipt-payment' | 'expense-planner' | 'audit-log';

interface ReportNode {
    id: string;
    label: string;
    icon: any;
    items: { id: ReportId; label: string }[];
}

const REPORT_STRUCTURE: ReportNode[] = [
    {
        id: 'item-perf',
        label: 'Item Performance',
        icon: TrendingUp,
        items: [
            { id: 'perf-summary', label: 'Performance Summary' },
            { id: 'stock-worth', label: 'Stock Worth' },
            { id: 'item-sales', label: 'Item Sales Summary' },
            { id: 'non-moving', label: 'Non-Moving Items' },
            { id: 'stock-alerts', label: 'Stock Alerts' },
            { id: 'prod-analysis', label: 'Production Analysis' },
        ]
    },
    {
        id: 'orig-stock',
        label: 'Original Stock',
        icon: Package,
        items: [
            { id: 'orig-stock', label: 'Original Stock In Hand' },
        ]
    },
    {
        id: 'fulfillment',
        label: 'Fulfillment',
        icon: Truck,
        items: [
            { id: 'order-fulfill', label: 'Order Fulfillment Dashboard' },
        ]
    },
    {
        id: 'ledger',
        label: 'Ledger Reports',
        icon: Book,
        items: [
            { id: 'ledger-report', label: 'General Ledger' },
        ]
    },
    {
        id: 'cash-bank',
        label: 'Cash & Bank',
        icon: DollarSign,
        items: [
            { id: 'cash-bank-ledger', label: 'Cash & Bank Ledger' },
            { id: 'cash-book', label: 'Cash Book' },
            { id: 'bank-book', label: 'Bank Book' },
        ]
    },
    {
        id: 'invoices',
        label: 'Invoices',
        icon: File,
        items: [
            { id: 'sales-invoices', label: 'Sales Invoices' },
            { id: 'purchase-invoices', label: 'Purchase Invoices' },
        ]
    },
    {
        id: 'detailed',
        label: 'Detailed Reports',
        icon: List,
        items: [
            { id: 'detailed-sales', label: 'Detailed Sales' },
            { id: 'detailed-purchases', label: 'Detailed Purchases' },
        ]
    },
    {
        id: 'production',
        label: 'Production',
        icon: Factory,
        items: [
            { id: 'orig-combination', label: 'Original Combination (Yield)' },
            { id: 'yield-analysis', label: 'Production Yield Analysis' },
            { id: 'daily-prod', label: 'Daily Production' },
            { id: 'rebaling', label: 'Re-baling Report' },
            { id: 'section-prod', label: 'Section-wise Production' },
            { id: 'feasibility', label: 'Feasibility Analysis' },
        ]
    },
    {
        id: 'financial',
        label: 'Financial',
        icon: Briefcase,
        items: [
            { id: 'balance-sheet', label: 'Balance Sheet' },
            { id: 'profit-loss', label: 'Profit & Loss' },
            { id: 'receipt-payment', label: 'Receipts & Payments Planner' },
            { id: 'expense-planner', label: 'Expense Planner' },
            { id: 'audit-log', label: 'Audit Trail (Voided)' }, // New Report
        ]
    }
];

// --- Report Components ---

const BalanceSheet: React.FC = () => {
    const { state } = useData();
    const assets = state.accounts.filter(a => a.type === AccountType.ASSET);
    const liabilities = state.accounts.filter(a => a.type === AccountType.LIABILITY);
    const equity = state.accounts.filter(a => a.type === AccountType.EQUITY);

    // Split customer balances
    const customers = state.partners.filter(p => p.type === PartnerType.CUSTOMER && p.balance > 0);
    const totalCustomersAR = customers.reduce((sum, c) => sum + c.balance, 0);
    const negativeCustomers = state.partners.filter(p => p.type === PartnerType.CUSTOMER && p.balance < 0);
    // FIXED: Customer advances should be positive (they're a liability)
    const totalCustomerAdvances = negativeCustomers.reduce((sum, c) => sum + Math.abs(c.balance), 0);

    // Split supplier/vendor/agent balances
    const supplierTypes = [PartnerType.SUPPLIER, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT];
    const positiveSupplierBalances = state.partners.filter(p => supplierTypes.includes(p.type) && p.balance > 0);
    const totalAdvancesToSuppliers = positiveSupplierBalances.reduce((sum, s) => sum + s.balance, 0);
    const negativeSupplierBalances = state.partners.filter(p => supplierTypes.includes(p.type) && p.balance < 0);
    // FIXED: Creditors (Accounts Payable) should be positive (they're a liability)
    const totalCreditors = negativeSupplierBalances.reduce((sum, s) => sum + Math.abs(s.balance), 0);

    // Net Income Calculation for Equity Section
    const revenue = state.accounts.filter(a => a.type === AccountType.REVENUE).reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const expenses = state.accounts.filter(a => a.type === AccountType.EXPENSE).reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const netIncome = revenue - expenses;

    // Total assets: sum of asset accounts + positive customer balance + positive supplier/agent advances
    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0) + totalCustomersAR + totalAdvancesToSuppliers;
    // FIXED: Total liabilities: liabilities (credit-normal, positive) + creditors + customer advances
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0) + totalCreditors + totalCustomerAdvances;
    // FIXED: Equity should preserve negative balances (like Owner's Drawings)
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0) + netIncome;

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-2 gap-8">
                {/* Assets */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Assets</h3>
                    <div className="space-y-2">
                        {assets.filter(a => a && a.balance !== undefined).map(a => (
                            <div key={a.id} className="flex justify-between text-sm">
                                <span className="text-slate-600">{a.name}</span>
                                <span className={`font-mono font-medium ${(a?.balance || 0) < 0 ? 'text-red-600' : ''}`}>
                                    {(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </span>
                            </div>
                        ))}
                        {totalCustomersAR > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 font-medium">Debtors (Accounts Receivable)</span>
                                <span className="font-mono font-medium">{totalCustomersAR.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        )}
                        {totalAdvancesToSuppliers > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 font-medium">Advances to Suppliers</span>
                                <span className="font-mono font-medium">{totalAdvancesToSuppliers.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        )}
                    </div>
                    <div className="border-t border-slate-200 mt-4 pt-2 flex justify-between font-bold text-slate-800">
                        <span>Total Assets</span>
                        <span className={totalAssets < 0 ? 'text-red-600' : ''}>
                            {totalAssets.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                    </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Liabilities & Equity</h3>
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Liabilities</h4>
                            <div className="space-y-2">
                                {liabilities.filter(a => a && a.balance !== undefined).map(a => (
                                    <div key={a.id} className="flex justify-between text-sm">
                                        <span className="text-slate-600">{a.name}</span>
                                        <span className={`font-mono font-medium ${(a?.balance || 0) < 0 ? 'text-red-600' : ''}`}>
                                            {(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                ))}
                                {totalCreditors > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 font-medium">Creditors (Accounts Payable)</span>
                                        <span className="font-mono font-medium">{totalCreditors.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                )}
                                {totalCustomerAdvances > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 font-medium">Customer Advances (Credit Balances)</span>
                                        <span className="font-mono font-medium text-blue-700">{totalCustomerAdvances.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-slate-100 mt-2 pt-1 flex justify-between text-sm font-bold text-slate-700">
                                <span>Total Liabilities</span>
                                <span className={totalLiabilities < 0 ? 'text-red-600' : ''}>
                                    {totalLiabilities.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Equity</h4>
                            <div className="space-y-2">
                                {equity.filter(a => a && a.balance !== undefined).map(a => (
                                    <div key={a.id} className="flex justify-between text-sm">
                                        <span className="text-slate-600">{a.name}</span>
                                        {/* FIXED: Show actual balance (Owner's Drawings can be negative) */}
                                        <span className={`font-mono font-medium ${(a?.balance || 0) < 0 ? 'text-red-600' : ''}`}>
                                            {(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm bg-emerald-50 p-1 rounded">
                                    <span className="text-emerald-700 font-medium">Net Income (Current)</span>
                                    <span className={`font-mono font-bold ${netIncome < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                        {netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </span>
                                </div>
                            </div>
                            <div className="border-t border-slate-100 mt-2 pt-1 flex justify-between text-sm font-bold text-slate-700">
                                <span>Total Equity</span>
                                <span className={totalEquity < 0 ? 'text-red-600' : ''}>
                                    {totalEquity.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t-2 border-slate-200 mt-4 pt-2 flex justify-between font-bold text-slate-800 text-lg">
                        <span>Total Liabilities & Equity</span>
                        <span className={Math.abs(totalAssets - (totalLiabilities + totalEquity)) > 0.01 ? 'text-red-600' : ''}>
                            {((totalLiabilities || 0) + (totalEquity || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                    </div>
                    {/* Balance Sheet Validation */}
                    {Math.abs(totalAssets - (totalLiabilities + totalEquity)) > 0.01 && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-700 font-medium">
                                ⚠️ Balance Sheet does not balance! Difference: ${Math.abs(totalAssets - (totalLiabilities + totalEquity)).toFixed(2)}
                            </p>
                            <p className="text-xs text-red-600 mt-1">
                                Assets: ${totalAssets.toFixed(2)} | Liabilities + Equity: ${(totalLiabilities + totalEquity).toFixed(2)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

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

const StockWorth: React.FC = () => {
    const { state } = useData();
    
    // Group by Category
    const categoryWorth = useMemo(() => {
        const stats: Record<string, number> = {};
        state.items.forEach(item => {
            const value = (item?.stockQty || 0) * (item?.weightPerUnit || 0) * (item?.avgCost || 0);
            stats[item.category] = (stats[item.category] || 0) + value;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    }, [state.items]);

    const totalWorth = categoryWorth.reduce((sum, c) => sum + c.value, 0);

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-1">
                    <h3 className="text-slate-500 text-sm font-medium uppercase mb-2">Total Inventory Value</h3>
                    <div className="text-3xl font-bold text-slate-800">${(totalWorth || 0).toLocaleString()}</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-1">
                    <h3 className="text-slate-500 text-sm font-medium uppercase mb-2">Total SKUs</h3>
                    <div className="text-3xl font-bold text-blue-600">{state.items.length}</div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4">Stock Valuation by Category</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryWorth}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                            <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3">Item Code</th>
                            <th className="px-6 py-3">Description</th>
                            <th className="px-6 py-3 text-right">Stock Qty</th>
                            <th className="px-6 py-3 text-right">Avg Cost</th>
                            <th className="px-6 py-3 text-right">Total Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {state.items.map(item => {
                            const val = (item?.stockQty || 0) * (item?.weightPerUnit || 0) * (item?.avgCost || 0);
                            return (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-mono text-xs">{item.code}</td>
                                    <td className="px-6 py-3 font-medium">{item.name}</td>
                                    <td className="px-6 py-3 text-right">{item.stockQty} {item.packingType}</td>
                                    <td className="px-6 py-3 text-right">${(item?.avgCost || 0).toFixed(2)}</td>
                                    <td className="px-6 py-3 text-right font-bold">${(val || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AuditLogReport: React.FC = () => {
    const { state } = useData();
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-slate-800 text-white p-6 rounded-xl shadow-md">
                <div className="flex items-center gap-3 mb-2">
                    <ShieldAlert size={24} className="text-red-400" />
                    <h2 className="text-xl font-bold">Secure Audit Trail</h2>
                </div>
                <p className="text-slate-300 text-sm">
                    This log contains an immutable record of all transactions that have been voided, deleted, or edited in the system.
                </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Deleted At</th>
                            <th className="px-6 py-4">Voucher ID</th>
                            <th className="px-6 py-4">Reason</th>
                            <th className="px-6 py-4">Auth By (PIN)</th>
                            <th className="px-6 py-4 text-right">Value ($)</th>
                            <th className="px-6 py-4 text-center">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {state.archive.map(entry => (
                            <React.Fragment key={entry.id}>
                                <tr className="hover:bg-red-50 transition-colors">
                                    <td className="px-6 py-4 text-slate-500">{new Date(entry.deletedAt).toLocaleString()}</td>
                                    <td className="px-6 py-4 font-mono font-bold text-slate-700">{entry.originalTransactionId}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${entry.reason.includes('Edit') ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                            {entry.reason}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs">{entry.deletedBy}</td>
                                    <td className="px-6 py-4 text-right font-mono font-bold">${entry.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                                            className="text-slate-400 hover:text-slate-600"
                                        >
                                            {expandedRow === entry.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                    </td>
                                </tr>
                                {expandedRow === entry.id && (
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <td colSpan={6} className="p-4">
                                            <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs">
                                                <h4 className="font-bold text-slate-500 mb-2 uppercase">Original Transaction Data</h4>
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="text-slate-400 border-b border-slate-100">
                                                            <th className="text-left py-1">Account</th>
                                                            <th className="text-right py-1">Debit</th>
                                                            <th className="text-right py-1">Credit</th>
                                                            <th className="text-left py-1 pl-4">Narration</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {entry.entries.map((row, i) => (
                                                            <tr key={i} className="border-b border-slate-50 last:border-0">
                                                                <td className="py-1 font-medium">{row.accountName}</td>
                                                                <td className="py-1 text-right font-mono">{row.debit > 0 ? row.debit.toFixed(2) : '-'}</td>
                                                                <td className="py-1 text-right font-mono">{row.credit > 0 ? row.credit.toFixed(2) : '-'}</td>
                                                                <td className="py-1 pl-4 text-slate-500 italic">{row.narration}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        {state.archive.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-400 italic">No audit records found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const OriginalStockReport: React.FC = () => {
    const { state } = useData();
    const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');

    // Calculate stock by grouping purchases and subtracting openings
    const stockData = useMemo(() => {
        const grouped: Record<string, Record<string, Record<string, { qtyPurchased: number, weightPurchased: number, qtyOpened: number, weightOpened: number, totalCost: number }>>> = {};

        // Filter purchases by supplier
        const filteredPurchases = selectedSupplier === 'ALL' 
            ? state.purchases 
            : state.purchases.filter(p => p.supplierId === selectedSupplier);

        console.log('🔍 DEBUG: All Purchases:', state.purchases.map(p => ({
            id: p.id,
            supplier: state.partners.find(s => s.id === p.supplierId)?.name,
            originalTypeId: p.originalTypeId,
            originalProductId: p.originalProductId,
            hasItems: !!p.items,
            itemsCount: p.items?.length || 0,
            items: p.items?.map(i => ({
                typeId: i.originalTypeId,
                typeName: state.originalTypes.find(t => t.id === i.originalTypeId)?.name,
                productId: i.originalProductId,
                productIdLength: i.originalProductId?.length || 0,
                productName: i.originalProductId ? state.originalProducts?.find(op => op.id === i.originalProductId)?.name : 'NO PRODUCT'
            }))
        })));

        console.log('🔍 Available Original Products:', state.originalProducts?.map(p => ({ id: p.id, name: p.name })));

        // Add purchases (multi-type support) - NOW GROUPED BY SUPPLIER FIRST
        filteredPurchases.forEach(purchase => {
            const supplierId = purchase.supplierId;
            if (!grouped[supplierId]) grouped[supplierId] = {};

            if (purchase.items && purchase.items.length > 0) {
                // New multi-type purchase
                purchase.items.forEach(item => {
                    if (!grouped[supplierId][item.originalTypeId]) grouped[supplierId][item.originalTypeId] = {};
                    const productKey = (item.originalProductId && item.originalProductId.trim() !== '') ? item.originalProductId : 'NO_PRODUCT';
                    console.log('🔍 Processing item - TypeId:', item.originalTypeId, 'ProductId:', item.originalProductId, 'ProductKey:', productKey);
                    if (!grouped[supplierId][item.originalTypeId][productKey]) {
                        grouped[supplierId][item.originalTypeId][productKey] = { qtyPurchased: 0, weightPurchased: 0, qtyOpened: 0, weightOpened: 0, totalCost: 0 };
                    }
                    grouped[supplierId][item.originalTypeId][productKey].qtyPurchased += item.qtyPurchased;
                    grouped[supplierId][item.originalTypeId][productKey].weightPurchased += item.weightPurchased;
                    grouped[supplierId][item.originalTypeId][productKey].totalCost += item.totalCostUSD;
                });
            } else {
                // Legacy single-type purchase
                const typeId = purchase.originalTypeId || 'UNKNOWN';
                const productKey = purchase.originalProductId || 'NO_PRODUCT';
                if (!grouped[supplierId][typeId]) grouped[supplierId][typeId] = {};
                if (!grouped[supplierId][typeId][productKey]) {
                    grouped[supplierId][typeId][productKey] = { qtyPurchased: 0, weightPurchased: 0, qtyOpened: 0, weightOpened: 0, totalCost: 0 };
                }
                grouped[supplierId][typeId][productKey].qtyPurchased += purchase.qtyPurchased || 0;
                grouped[supplierId][typeId][productKey].weightPurchased += purchase.weightPurchased || 0;
                grouped[supplierId][typeId][productKey].totalCost += purchase.totalLandedCost || 0;
            }
        });

        // Filter openings by supplier
        const filteredOpenings = selectedSupplier === 'ALL' 
            ? state.originalOpenings 
            : state.originalOpenings.filter(o => o.supplierId === selectedSupplier);

        // Subtract openings - ONLY for suppliers already in grouped data
        filteredOpenings.forEach(opening => {
            const supplierId = opening.supplierId;
            if (!supplierId) return; // Skip if no supplier
            
            // CRITICAL FIX: Only process openings for suppliers that exist in grouped (from purchases)
            // This prevents adding suppliers that weren't in the filtered purchase list
            if (!grouped[supplierId]) return;

            const typeId = opening.originalType || 'UNKNOWN';
            const productKey = 'NO_PRODUCT'; // Openings don't track product level
            if (!grouped[supplierId][typeId]) grouped[supplierId][typeId] = {};
            if (!grouped[supplierId][typeId][productKey]) {
                grouped[supplierId][typeId][productKey] = { qtyPurchased: 0, weightPurchased: 0, qtyOpened: 0, weightOpened: 0, totalCost: 0 };
            }
            grouped[supplierId][typeId][productKey].qtyOpened += opening.qtyOpened;
            grouped[supplierId][typeId][productKey].weightOpened += opening.weightOpened;
        });

        return grouped;
    }, [state.purchases, state.originalOpenings, selectedSupplier]);

    const totalStockWeight = Object.values(stockData).reduce((sum, types) => 
        sum + Object.values(types).reduce((s1, products) => 
            s1 + Object.values(products).reduce((s2, p) => s2 + (p.weightPurchased - p.weightOpened), 0), 0), 0
    );

    const totalStockValue = Object.values(stockData).reduce((sum, types) => 
        sum + Object.values(types).reduce((s1, products) => 
            s1 + Object.values(products).reduce((s2, p) => s2 + p.totalCost, 0), 0), 0
    );

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-600">Filter by Supplier:</label>
                    <select 
                        className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 min-w-[200px]"
                        value={selectedSupplier}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                    >
                        <option value="ALL">All Suppliers</option>
                        {state.partners.filter(p => p.type === 'SUPPLIER').map(supplier => (
                            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                    </select>
                    {selectedSupplier !== 'ALL' && (
                        <button 
                            onClick={() => setSelectedSupplier('ALL')}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Clear Filter
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-slate-500 text-sm font-medium uppercase mb-2">Total Suppliers</h3>
                    <div className="text-3xl font-bold text-blue-600">{Object.keys(stockData).length}</div>
                    <p className="text-xs text-slate-400 mt-1">With stock in hand</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-slate-500 text-sm font-medium uppercase mb-2">Total Stock (Weight)</h3>
                    <div className="text-3xl font-bold text-slate-800">{totalStockWeight.toLocaleString()} Kg</div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-slate-500 text-sm font-medium uppercase mb-2">Total Stock Value</h3>
                    <div className="text-3xl font-bold text-emerald-600">${totalStockValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
            </div>

            {/* Stock Table Grouped by Original Type */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800">Original Stock by Supplier, Type & Product</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        {selectedSupplier === 'ALL' 
                            ? 'Showing stock from all suppliers (grouped separately)' 
                            : `Filtered for: ${state.partners.find(p => p.id === selectedSupplier)?.name || 'Unknown'}`
                        }
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3">Supplier</th>
                                <th className="px-6 py-3">Original Type</th>
                                <th className="px-6 py-3">Product (Optional)</th>
                                <th className="px-6 py-3 text-right">Purchased (Qty)</th>
                                <th className="px-6 py-3 text-right">Purchased (Kg)</th>
                                <th className="px-6 py-3 text-right">Opened (Qty)</th>
                                <th className="px-6 py-3 text-right">Opened (Kg)</th>
                                <th className="px-6 py-3 text-right bg-emerald-50">In Stock (Qty)</th>
                                <th className="px-6 py-3 text-right bg-emerald-50">In Stock (Kg)</th>
                                <th className="px-6 py-3 text-right">Value (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {Object.entries(stockData).flatMap(([supplierId, types]) => {
                                const supplier = state.partners.find(p => p.id === supplierId);
                                const supplierName = supplier?.name || supplierId;
                                
                                return Object.entries(types).flatMap(([typeId, products]) => {
                                    const originalType = state.originalTypes.find(t => t.id === typeId);
                                    const typeName = originalType?.name || typeId;
                                    
                                    // Get all product rows for this type
                                    const productRows = Object.entries(products).map(([productKey, data], idx) => {
                                        const originalProduct = productKey !== 'NO_PRODUCT' 
                                            ? state.originalProducts?.find(p => p.id === productKey)
                                            : null;
                                        const productName = originalProduct?.name || '-';
                                        
                                        const stockQty = data.qtyPurchased - data.qtyOpened;
                                        const stockWeight = data.weightPurchased - data.weightOpened;

                                        if (stockQty <= 0 && stockWeight <= 0) return null; // Hide empty stock

                                        return (
                                            <tr key={`${supplierId}-${typeId}-${productKey}`} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-medium text-blue-700">{supplierName}</td>
                                                <td className="px-6 py-3 font-bold text-slate-800">{typeName}</td>
                                                <td className="px-6 py-3 text-slate-600 italic">{productName}</td>
                                                <td className="px-6 py-3 text-right font-mono">{data.qtyPurchased}</td>
                                                <td className="px-6 py-3 text-right font-mono">{data.weightPurchased.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-right font-mono text-red-600">{data.qtyOpened}</td>
                                                <td className="px-6 py-3 text-right font-mono text-red-600">{data.weightOpened.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-right font-mono font-bold bg-emerald-50 text-emerald-700">{stockQty}</td>
                                                <td className="px-6 py-3 text-right font-mono font-bold bg-emerald-50 text-emerald-700">{stockWeight.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-right font-mono text-slate-700">${data.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                            </tr>
                                        );
                                    }).filter(Boolean); // Remove null entries
                                    
                                    return productRows;
                                });
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const PlaceholderReport: React.FC<{ title: string }> = ({ title }) => (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 animate-in fade-in">
        <FileText size={48} className="mb-4 opacity-20" />
        <h3 className="text-lg font-semibold text-slate-600">{title}</h3>
        <p className="text-sm mt-2">This report is under construction.</p>
    </div>
);

// Production Yield Analysis Report
const YieldAnalysisReport: React.FC = () => {
    const { state } = useData();
    const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'custom'>('7days');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const yieldData = useMemo(() => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];

        let filterStart = '';
        let filterEnd = today;
        
        switch (dateFilter) {
            case 'today': 
                filterStart = today; 
                filterEnd = today;
                break;
            case 'yesterday': 
                filterStart = yesterday; 
                filterEnd = yesterday;
                break;
            case '7days': 
                filterStart = sevenDaysAgo; 
                break;
            case '30days': 
                filterStart = thirtyDaysAgo; 
                break;
            case 'custom':
                filterStart = startDate || sevenDaysAgo;
                filterEnd = endDate || today;
                break;
        }

        // Filter data by date range
        const openings = (state.originalOpenings || []).filter(b => b.date >= filterStart && b.date <= filterEnd);
        const productions = (state.productions || []).filter(p => 
            p.date >= filterStart && 
            p.date <= filterEnd && 
            p.qtyProduced > 0 && 
            !p.isRebaling // Exclude re-baling from production reports
        );

        // Calculate totals
        const totalRawMaterialKg = openings.reduce((sum, o) => sum + (o.weightOpened || 0), 0);
        const totalFinishedGoodsKg = productions.reduce((sum, p) => sum + (p.weightProduced || 0), 0);
        const yieldPercentage = totalRawMaterialKg > 0 ? (totalFinishedGoodsKg / totalRawMaterialKg) * 100 : 0;
        const wastageKg = totalRawMaterialKg - totalFinishedGoodsKg;
        const wastagePercentage = totalRawMaterialKg > 0 ? (wastageKg / totalRawMaterialKg) * 100 : 0;

        // Group by category
        const categoryBreakdown = productions.reduce((acc, p) => {
            const item = state.items.find(i => i.id === p.itemId);
            const category = item?.category || 'Unknown';
            const avgCost = item?.avgCost || 0;
            const worth = p.qtyProduced * avgCost;
            
            const existing = acc.find(x => x.category === category);
            if (existing) {
                existing.qty += p.qtyProduced;
                existing.weight += (p.weightProduced || 0);
                existing.worth += worth;
            } else {
                acc.push({ category, qty: p.qtyProduced, weight: p.weightProduced || 0, worth });
            }
            return acc;
        }, [] as { category: string; qty: number; weight: number; worth: number }[]);

        // Original combinations
        const originalCombinations = openings.reduce((acc, o) => {
            const item = state.items.find(i => i.id === o.itemId);
            const originalType = o.originalType || item?.name || 'Unknown';
            const existing = acc.find(x => x.originalType === originalType);
            if (existing) {
                existing.weight += (o.weightOpened || 0);
                existing.count += 1;
            } else {
                acc.push({ originalType, weight: o.weightOpened || 0, count: 1 });
            }
            return acc;
        }, [] as { originalType: string; weight: number; count: number }[]);

        // Net profit/loss: (Total Production Worth) - (Raw Material Cost + Working Cost)
        const totalWorth = categoryBreakdown.reduce((sum, c) => sum + c.worth, 0);
        const rawMaterialCost = totalRawMaterialKg * 1; // $1 per kg for raw material
        const workingCost = totalRawMaterialKg * 0.25; // $0.25 per kg working cost
        const netProfitLoss = totalWorth - (rawMaterialCost + workingCost);

        return {
            totalRawMaterialKg,
            totalFinishedGoodsKg,
            yieldPercentage,
            wastageKg,
            wastagePercentage,
            categoryBreakdown: categoryBreakdown.sort((a, b) => b.weight - a.weight),
            originalCombinations: originalCombinations.sort((a, b) => b.weight - a.weight),
            netProfitLoss,
            totalWorth
        };
    }, [state.originalOpenings, state.productions, state.items, dateFilter, startDate, endDate]);

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <h3 className="text-lg font-bold text-slate-800">Date Filter</h3>
                    <div className="flex gap-2">
                        {(['today', 'yesterday', '7days', '30days', 'custom'] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setDateFilter(filter)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                                    dateFilter === filter
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {filter === 'today' ? 'Today' : filter === 'yesterday' ? 'Yesterday' : filter === '7days' ? 'Last 7 Days' : filter === '30days' ? 'Last 30 Days' : 'Custom'}
                            </button>
                        ))}
                    </div>
                    {dateFilter === 'custom' && (
                        <div className="flex gap-2 items-center">
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg" />
                            <span className="text-slate-500">to</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg" />
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200 shadow-sm">
                    <div className="text-xs font-bold text-amber-700 uppercase mb-1">Raw Material</div>
                    <div className="text-2xl font-bold text-amber-900">{yieldData.totalRawMaterialKg.toLocaleString()}</div>
                    <div className="text-xs text-amber-600">Kg Opened</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl border border-emerald-200 shadow-sm">
                    <div className="text-xs font-bold text-emerald-700 uppercase mb-1">Finished Goods</div>
                    <div className="text-2xl font-bold text-emerald-900">{yieldData.totalFinishedGoodsKg.toLocaleString()}</div>
                    <div className="text-xs text-emerald-600">Kg Produced</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 shadow-sm">
                    <div className="text-xs font-bold text-blue-700 uppercase mb-1">Yield %</div>
                    <div className="text-2xl font-bold text-blue-900">{yieldData.yieldPercentage.toFixed(1)}%</div>
                    <div className="text-xs text-blue-600">Efficiency</div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200 shadow-sm">
                    <div className="text-xs font-bold text-red-700 uppercase mb-1">Wastage</div>
                    <div className="text-2xl font-bold text-red-900">{yieldData.wastagePercentage.toFixed(1)}%</div>
                    <div className="text-xs text-red-600">{yieldData.wastageKg.toFixed(0)} Kg</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 shadow-sm">
                    <div className="text-xs font-bold text-purple-700 uppercase mb-1">Net P/L</div>
                    <div className={`text-2xl font-bold ${yieldData.netProfitLoss >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                        ${yieldData.netProfitLoss.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </div>
                    <div className="text-xs text-purple-600">Profit/Loss</div>
                </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Production by Category</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b-2 border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">Category</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-700">Quantity</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-700">Weight (Kg)</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-700">Worth ($)</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-700">% of Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {yieldData.categoryBreakdown.map((cat, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-800">{cat.category}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{cat.qty.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-800">{cat.weight.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">${cat.worth.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                    <td className="px-4 py-3 text-right text-blue-600 font-bold">{((cat.weight / yieldData.totalFinishedGoodsKg) * 100).toFixed(1)}%</td>
                                </tr>
                            ))}
                            <tr className="bg-slate-100 font-bold">
                                <td className="px-4 py-3">TOTAL</td>
                                <td className="px-4 py-3 text-right">{yieldData.categoryBreakdown.reduce((sum, c) => sum + c.qty, 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">{yieldData.totalFinishedGoodsKg.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-emerald-700">${yieldData.totalWorth.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                <td className="px-4 py-3 text-right text-blue-600">100.0%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Original Recipe Mix Table */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Original Recipe Mix (Input Combinations)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b-2 border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left font-bold text-slate-700">Original Type</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-700">Weight Opened (Kg)</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-700">Times Used</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-700">% of Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {yieldData.originalCombinations.map((orig, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-800">{orig.originalType}</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-800">{orig.weight.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-blue-600 font-bold">{orig.count}x</td>
                                    <td className="px-4 py-3 text-right text-amber-600 font-bold">{((orig.weight / yieldData.totalRawMaterialKg) * 100).toFixed(1)}%</td>
                                </tr>
                            ))}
                            <tr className="bg-slate-100 font-bold">
                                <td className="px-4 py-3">TOTAL</td>
                                <td className="px-4 py-3 text-right">{yieldData.totalRawMaterialKg.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">{yieldData.originalCombinations.reduce((sum, o) => sum + o.count, 0)}</td>
                                <td className="px-4 py-3 text-right text-amber-600">100.0%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- Main Reports Module ---

export const ReportsModule: React.FC = () => {
    const [activeReport, setActiveReport] = useState<ReportId>('perf-summary');
    const [expandedCategory, setExpandedCategory] = useState<string | null>('financial');

    const toggleCategory = (id: string) => {
        setExpandedCategory(expandedCategory === id ? null : id);
    };

    const renderReport = () => {
        switch (activeReport) {
            case 'balance-sheet': return <BalanceSheet />;
            case 'profit-loss': return <ProfitLoss />;
            case 'stock-worth': return <StockWorth />;
            case 'orig-stock': return <OriginalStockReport />;
            case 'audit-log': return <AuditLogReport />;
            case 'yield-analysis': return <YieldAnalysisReport />;
            default: return <PlaceholderReport title={REPORT_STRUCTURE.flatMap(c => c.items).find(i => i.id === activeReport)?.label || 'Report'} />;
        }
    };

    return (
        <div className="flex h-[calc(100vh-80px)]">
            {/* Sidebar Navigation */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto shrink-0">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Reports Center</h2>
                    <p className="text-xs text-slate-500">Business Intelligence & Finance</p>
                </div>
                <div className="p-3 space-y-1">
                    {REPORT_STRUCTURE.map(cat => (
                        <div key={cat.id} className="mb-1">
                            <button
                                onClick={() => toggleCategory(cat.id)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${expandedCategory === cat.id ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <cat.icon size={18} className={expandedCategory === cat.id ? 'text-blue-600' : 'text-slate-400'} />
                                    <span className="text-sm">{cat.label}</span>
                                </div>
                                {expandedCategory === cat.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            
                            {/* Sub Menu */}
                            {expandedCategory === cat.id && (
                                <div className="ml-4 mt-1 pl-4 border-l border-slate-200 space-y-1 animate-in slide-in-from-left-2 duration-200">
                                    {cat.items.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveReport(item.id)}
                                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeReport === item.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
                {/* Header */}
                <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {REPORT_STRUCTURE.flatMap(c => c.items).find(i => i.id === activeReport)?.label}
                    </h2>
                    <div className="flex gap-2">
                        <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg" title="Print"><Printer size={20} /></button>
                        <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg" title="Export"><Download size={20} /></button>
                    </div>
                </div>

                {/* Report Area */}
                <div className="flex-1 overflow-auto p-8">
                    {renderReport()}
                </div>
            </div>
        </div>
    );
};
