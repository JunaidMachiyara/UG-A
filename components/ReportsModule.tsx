
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { AccountType, TransactionType } from '../types';
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
    | 'orig-combination' | 'daily-prod' | 'rebaling' | 'section-prod' | 'feasibility'
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
    
    // Net Income Calculation for Equity Section
    const revenue = state.accounts.filter(a => a.type === AccountType.REVENUE).reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const expenses = state.accounts.filter(a => a.type === AccountType.EXPENSE).reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const netIncome = revenue - expenses;

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const totalEquity = equity.reduce((sum, a) => sum + Math.abs(a.balance), 0) + netIncome;

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-2 gap-8">
                {/* Assets */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Assets</h3>
                    <div className="space-y-2">
                        {assets.map(a => (
                            <div key={a.id} className="flex justify-between text-sm">
                                <span className="text-slate-600">{a.name}</span>
                                <span className="font-mono font-medium">{a.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-slate-200 mt-4 pt-2 flex justify-between font-bold text-slate-800">
                        <span>Total Assets</span>
                        <span>{totalAssets.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Liabilities & Equity</h3>
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Liabilities</h4>
                            <div className="space-y-2">
                                {liabilities.map(a => (
                                    <div key={a.id} className="flex justify-between text-sm">
                                        <span className="text-slate-600">{a.name}</span>
                                        <span className="font-mono font-medium">{Math.abs(a.balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-slate-100 mt-2 pt-1 flex justify-between text-sm font-bold text-slate-700">
                                <span>Total Liabilities</span>
                                <span>{totalLiabilities.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Equity</h4>
                            <div className="space-y-2">
                                {equity.map(a => (
                                    <div key={a.id} className="flex justify-between text-sm">
                                        <span className="text-slate-600">{a.name}</span>
                                        <span className="font-mono font-medium">{Math.abs(a.balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm bg-emerald-50 p-1 rounded">
                                    <span className="text-emerald-700 font-medium">Net Income (Current)</span>
                                    <span className="font-mono font-bold text-emerald-700">{netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                            <div className="border-t border-slate-100 mt-2 pt-1 flex justify-between text-sm font-bold text-slate-700">
                                <span>Total Equity</span>
                                <span>{totalEquity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>
                    <div className="border-t-2 border-slate-200 mt-4 pt-2 flex justify-between font-bold text-slate-800 text-lg">
                        <span>Total Liabilities & Equity</span>
                        <span>{(totalLiabilities + totalEquity).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
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
                                <span className="font-mono">{Math.abs(a.balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-emerald-100 flex justify-between font-bold text-slate-800">
                        <span>Total Revenue</span>
                        <span>{totalRev.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-red-600 border-b border-red-100 pb-2 mb-3">Expenses</h3>
                    <div className="space-y-2">
                        {expenses.map(a => (
                            <div key={a.id} className="flex justify-between text-sm">
                                <span className="text-slate-600">{a.name}</span>
                                <span className="font-mono">{Math.abs(a.balance).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-red-100 flex justify-between font-bold text-slate-800">
                        <span>Total Expenses</span>
                        <span>{totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>

                <div className={`p-4 rounded-xl flex justify-between items-center text-xl font-bold border ${netIncome >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <span>Net Income</span>
                    <span>{netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
            const value = item.stockQty * item.weightPerUnit * item.avgCost; // Simplified valuation
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
                    <div className="text-3xl font-bold text-slate-800">${totalWorth.toLocaleString()}</div>
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
                            const val = item.stockQty * item.weightPerUnit * item.avgCost; // Logic: Cost is usually per Kg in back-end logic, check this
                            return (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-mono text-xs">{item.code}</td>
                                    <td className="px-6 py-3 font-medium">{item.name}</td>
                                    <td className="px-6 py-3 text-right">{item.stockQty} {item.packingType}</td>
                                    <td className="px-6 py-3 text-right">${item.avgCost.toFixed(2)}</td>
                                    <td className="px-6 py-3 text-right font-bold">${val.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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

const PlaceholderReport: React.FC<{ title: string }> = ({ title }) => (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 animate-in fade-in">
        <FileText size={48} className="mb-4 opacity-20" />
        <h3 className="text-lg font-semibold text-slate-600">{title}</h3>
        <p className="text-sm mt-2">This report is under construction.</p>
    </div>
);

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
            case 'audit-log': return <AuditLogReport />;
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
