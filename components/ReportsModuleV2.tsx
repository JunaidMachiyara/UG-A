
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { AccountType, TransactionType, PlannerPeriodType, PlannerEntityType, PlannerEntry, PartnerType } from '../types';
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
    Truck
} from 'lucide-react';
import { CHART_COLORS } from '../constants';
import { EntitySelector } from './EntitySelector';
import { Link } from 'react-router-dom';

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

    // Metrics
    const totalRevenue = state.accounts.filter(a => a && a.type === AccountType.REVENUE).reduce((sum, a) => sum + Math.abs(a?.balance || 0), 0);
    const totalExpenses = state.accounts.filter(a => a && a.type === AccountType.EXPENSE).reduce((sum, a) => sum + Math.abs(a?.balance || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

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
        </div>
    );
};

// 2. INVENTORY INTELLIGENCE
const InventoryIntelligence: React.FC = () => {
    const { state } = useData();

    // Derived Metrics (Assuming 'cat-raw' is ID for Raw Material category in constants)
    const rawItems = state.items.filter(i => i.category === 'cat-raw'); 
    const fgItems = state.items.filter(i => i.category !== 'cat-raw');

    const rawValue = rawItems.reduce((acc, i) => acc + ((i?.stockQty || 0) * (i?.avgCost || 0)), 0);
    const fgValue = fgItems.reduce((acc, i) => acc + ((i?.stockQty || 0) * (i?.avgCost || 0)), 0);

    const lowStockItems = state.items.filter(i => i.stockQty > 0 && i.stockQty < 50);
    const nonMovingItems = state.items.filter(i => i.stockQty > 0 && !state.salesInvoices.some(inv => inv.items.some(si => si.itemId === i.id)));

    // --- Feasibility Logic ---
    const feasibilityData = useMemo(() => {
        return fgItems.map(item => {
            const margin = (item.salePrice || 0) - item.avgCost;
            const marginPct = item.avgCost > 0 ? (margin / item.avgCost) * 100 : 0;
            
            const salesFreq = state.salesInvoices.filter(inv => inv.items.some(i => i.itemId === item.id)).length;
            
            // Net production change (includes re-baling consumption as negative and production as positive)
            const totalProduced = state.productions.filter(p => p.itemId === item.id).reduce((s, p) => s + p.qtyProduced, 0);
            const totalSold = state.salesInvoices.reduce((s, inv) => s + inv.items.filter(i => i.itemId === item.id).reduce((is, ii) => is + ii.qty, 0), 0);
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
                    <h3 className="text-2xl font-bold text-slate-800">${(rawValue || 0).toLocaleString()}</h3>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
                    <p className="text-xs font-bold text-slate-500 uppercase">Finished Goods Value</p>
                    <h3 className="text-2xl font-bold text-slate-800">${(fgValue || 0).toLocaleString()}</h3>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
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
                                    <td className="px-4 py-3 text-right font-mono">${(i.stockQty * i.avgCost).toLocaleString()}</td>
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
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={fgItems.reduce((acc: any[], item) => {
                                            const catName = state.categories.find(c => c.id === item.category)?.name || item.category || 'Uncategorized';
                                            const existing = acc.find((x: any) => x.name === catName);
                                            if (existing) existing.value += item.stockQty;
                                            else acc.push({ name: catName, value: item.stockQty });
                                            return acc;
                                        }, [])}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {fgItems.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={Object.values(CHART_COLORS)[index % 4]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
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
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Item</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Prod. Cost</th>
                                <th className="px-6 py-4 text-right">Sale Price</th>
                                <th className="px-6 py-4 text-right">Margin</th>
                                <th className="px-6 py-4 text-center">Sales Freq</th>
                                <th className="px-6 py-4 text-center">Prod / Sold (Units)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {feasibilityData.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium text-slate-700">
                                        {item.name}
                                        <div className="text-xs text-slate-400">{state.categories.find(c => c.id === item.category)?.name || item.category}</div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
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
                                    <td className="px-6 py-3 text-right font-mono">${item.avgCost.toFixed(2)}</td>
                                    <td className="px-6 py-3 text-right font-mono">${item.salePrice?.toFixed(2) || '-'}</td>
                                    <td className={`px-6 py-3 text-right font-mono font-bold ${item.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {item.margin.toFixed(2)} ({item.marginPct.toFixed(0)}%)
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

const BalanceSheet: React.FC = () => {
    const { state } = useData();
    
    const assets = state.accounts.filter(a => a.type === AccountType.ASSET);
    const liabilities = state.accounts.filter(a => a.type === AccountType.LIABILITY);
    const equity = state.accounts.filter(a => a.type === AccountType.EQUITY);
    
    // Add customer balances (Accounts Receivable) - grouped as "Debtors"
    const customers = state.partners.filter(p => p.type === PartnerType.CUSTOMER && p.balance > 0);
    const totalCustomersAR = customers.reduce((sum, c) => sum + c.balance, 0);

    // Add negative customer balances (Customer Advances) - grouped as liability
    const negativeCustomers = state.partners.filter(p => p.type === PartnerType.CUSTOMER && p.balance < 0);
    const totalCustomerAdvances = negativeCustomers.reduce((sum, c) => sum + Math.abs(c.balance), 0);

    // Split supplier/vendor balances
    const positiveSuppliers = state.partners.filter(p => [PartnerType.SUPPLIER, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(p.type) && p.balance > 0);
    const totalSupplierAdvances = positiveSuppliers.reduce((sum, s) => sum + s.balance, 0);
    const negativeSuppliers = state.partners.filter(p => [PartnerType.SUPPLIER, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(p.type) && p.balance < 0);
    const totalSuppliersAP = negativeSuppliers.reduce((sum, s) => sum + Math.abs(s.balance), 0);
    
    const revenue = state.accounts.filter(a => a.type === AccountType.REVENUE).reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const expenses = state.accounts.filter(a => a.type === AccountType.EXPENSE).reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const netIncome = revenue - expenses;

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0) + totalCustomersAR + totalSupplierAdvances;
    const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(a.balance), 0) + totalSuppliersAP + totalCustomerAdvances;
    const totalEquity = equity.reduce((sum, a) => sum + Math.abs(a.balance), 0) + netIncome;

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Assets</h3>
                    <div className="space-y-2">
                        {assets.filter(a => a && a.balance !== undefined).map(a => (
                            <div key={a.id} className="flex justify-between text-sm">
                                <span className="text-slate-600">{a.name}</span>
                                <span className="font-mono font-medium">{(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        ))}
                        {totalCustomersAR > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 font-medium">Debtors (Accounts Receivable)</span>
                                <span className="font-mono font-medium">{totalCustomersAR.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        )}
                        {totalSupplierAdvances > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 font-medium">Advances to Suppliers</span>
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
                                {liabilities.filter(a => a && a.balance !== undefined).map(a => (
                                    <div key={a.id} className="flex justify-between text-sm">
                                        <span className="text-slate-600">{a.name}</span>
                                        <span className="font-mono font-medium">{Math.abs(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                ))}
                                {totalSuppliersAP > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 font-medium">Creditors (Accounts Payable)</span>
                                        <span className="font-mono font-medium">{totalSuppliersAP.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
                                <span>{(totalLiabilities || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Equity</h4>
                            <div className="space-y-2">
                                {equity.filter(a => a && a.balance !== undefined).map(a => (
                                    <div key={a.id} className="flex justify-between text-sm">
                                        <span className="text-slate-600">{a.name}</span>
                                        <span className="font-mono font-medium">{Math.abs(a?.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm bg-emerald-50 p-1 rounded">
                                    <span className="text-emerald-700 font-medium">Net Income (Current)</span>
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
        </div>
    );
};

const ReceiptsPaymentsPlanner: React.FC = () => {
    const { state, addPlannerEntry, updatePlannerEntry, deleteEntity } = useData();
    const [periodType, setPeriodType] = useState<PlannerPeriodType>('MONTHLY');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);
    const [addSupplierModalOpen, setAddSupplierModalOpen] = useState(false);

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


    const currentPeriodPlans = useMemo(() => state.planners.filter(p => p.period === currentPeriod), [state.planners, currentPeriod]);

    const customerPlans = useMemo(() => {
        return state.partners.filter(p => p.type === PartnerType.CUSTOMER).map(cust => {
            const plan = currentPeriodPlans.find(p => p.entityId === cust.id && p.entityType === PlannerEntityType.CUSTOMER);
            const lastActual = calculatePeriodActuals(state.ledger, cust.id, PlannerEntityType.CUSTOMER, lastPeriodStartDate, lastPeriodEndDate);
            return {
                customer: cust,
                receivable: cust.balance,
                lastPlan: plan?.lastPlanAmount || 0, 
                lastActual,
                currentPlan: plan?.plannedAmount || 0,
                plannerId: plan?.id
            };
        }).filter(p => p.plannerId || p.currentPlan > 0 || p.receivable !== 0);
    }, [state.partners, currentPeriodPlans, state.ledger, lastPeriodStartDate, lastPeriodEndDate]);

    const supplierPlans = useMemo(() => {
        return state.partners.filter(p => p.type === PartnerType.SUPPLIER).map(sup => {
            const plan = currentPeriodPlans.find(p => p.entityId === sup.id && p.entityType === PlannerEntityType.SUPPLIER);
            const lastActual = calculatePeriodActuals(state.ledger, sup.id, PlannerEntityType.SUPPLIER, lastPeriodStartDate, lastPeriodEndDate);
            return {
                supplier: sup,
                payable: sup.balance,
                lastPlan: plan?.lastPlanAmount || 0,
                lastActual,
                currentPlan: plan?.plannedAmount || 0,
                plannerId: plan?.id
            };
        }).filter(p => p.plannerId || p.currentPlan > 0 || p.payable !== 0);
    }, [state.partners, currentPeriodPlans, state.ledger, lastPeriodStartDate, lastPeriodEndDate]);

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
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2">Customer</th>
                                    <th className="px-4 py-2 text-right">Receivable</th>
                                    <th className="px-4 py-2 text-right">Last Actual</th>
                                    <th className="px-4 py-2 text-right">This Plan</th>
                                    <th className="px-4 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {customerPlans.map(p => (
                                    <tr key={p.customer.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-medium text-slate-700">{p.customer.name}</td>
                                        <td className="px-4 py-2 text-right font-mono">${p.receivable.toLocaleString()}</td>
                                        <td className={`px-4 py-2 text-right font-mono ${p.lastActual >= p.lastPlan ? 'text-emerald-600' : 'text-red-500'}`}>${p.lastActual.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right">
                                            <input 
                                                type="number" 
                                                value={p.currentPlan} 
                                                onChange={e => handlePlanChange(p.customer.id, PlannerEntityType.CUSTOMER, parseFloat(e.target.value || '0'), p.plannerId)} 
                                                className="w-24 border border-blue-300 rounded-lg p-1 text-right bg-blue-50 text-blue-700 text-sm font-bold"
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
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2">Supplier</th>
                                    <th className="px-4 py-2 text-right">Payable</th>
                                    <th className="px-4 py-2 text-right">Last Actual</th>
                                    <th className="px-4 py-2 text-right">This Plan</th>
                                    <th className="px-4 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {supplierPlans.map(p => (
                                    <tr key={p.supplier.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-medium text-slate-700">{p.supplier.name}</td>
                                        <td className="px-4 py-2 text-right font-mono">${Math.abs(p.payable).toLocaleString()}</td>
                                        <td className={`px-4 py-2 text-right font-mono ${p.lastActual <= p.lastPlan ? 'text-emerald-600' : 'text-red-500'}`}>${p.lastActual.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right">
                                            <input 
                                                type="number" 
                                                value={p.currentPlan} 
                                                onChange={e => handlePlanChange(p.supplier.id, PlannerEntityType.SUPPLIER, parseFloat(e.target.value || '0'), p.plannerId)} 
                                                className="w-24 border border-red-300 rounded-lg p-1 text-right bg-red-50 text-red-700 text-sm font-bold"
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
                            entities={state.partners.filter(p => p.type === PartnerType.CUSTOMER && !customerPlans.some(cp => cp.customer.id === p.id))} 
                            selectedId="" 
                            onSelect={(id) => { handlePlanChange(id, PlannerEntityType.CUSTOMER, 0); setAddCustomerModalOpen(false); }} 
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
                            entities={state.partners.filter(p => p.type === PartnerType.SUPPLIER && !supplierPlans.some(sp => sp.supplier.id === p.id))} 
                            selectedId="" 
                            onSelect={(id) => { handlePlanChange(id, PlannerEntityType.SUPPLIER, 0); setAddSupplierModalOpen(false); }} 
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
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        {mode === 'LEDGER' && (
                            <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">ID</th><th className="px-6 py-4">Account</th><th className="px-6 py-4">Narration</th><th className="px-6 py-4 text-right">Debit</th><th className="px-6 py-4 text-right">Credit</th></tr>
                        )}
                        {mode === 'SALES' && (
                            <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Invoice #</th><th className="px-6 py-4">Customer</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Items</th><th className="px-6 py-4 text-right">Total</th></tr>
                        )}
                        {mode === 'PURCHASE' && (
                            <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Batch #</th><th className="px-6 py-4">Supplier</th><th className="px-6 py-4">Type</th><th className="px-6 py-4 text-right">Weight</th><th className="px-6 py-4 text-right">Cost</th></tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.slice(0, 100).map((row: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                {mode === 'LEDGER' && (
                                    <>
                                        <td className="px-6 py-3 whitespace-nowrap text-slate-600">{row.date}</td>
                                        <td className="px-6 py-3 font-mono text-xs font-bold text-blue-600">{row.transactionId}</td>
                                        <td className="px-6 py-3 font-medium text-slate-800">{row.accountName}</td>
                                        <td className="px-6 py-3 text-slate-500 max-w-xs truncate">{row.narration}</td>
                                        <td className="px-6 py-3 text-right font-mono">{row.debit > 0 ? row.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                                        <td className="px-6 py-3 text-right font-mono">{row.credit > 0 ? row.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
                                    </>
                                )}
                                {mode === 'SALES' && (
                                    <>
                                        <td className="px-6 py-3 whitespace-nowrap text-slate-600">{row.date}</td>
                                        <td className="px-6 py-3 font-mono text-xs font-bold text-blue-600">{row.invoiceNo}</td>
                                        <td className="px-6 py-3 font-medium text-slate-800">{state.partners.find(p => p.id === row.customerId)?.name}</td>
                                        <td className="px-6 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>{row.status}</span></td>
                                        <td className="px-6 py-3 text-right">{row.items.length}</td>
                                        <td className="px-6 py-3 text-right font-mono font-bold">${row.netTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    </>
                                )}
                                {mode === 'PURCHASE' && (
                                    <>
                                        <td className="px-6 py-3 whitespace-nowrap text-slate-600">{row.date}</td>
                                        <td className="px-6 py-3 font-mono text-xs font-bold text-blue-600">{row.batchNumber}</td>
                                        <td className="px-6 py-3 font-medium text-slate-800">{state.partners.find(p => p.id === row.supplierId)?.name}</td>
                                        <td className="px-6 py-3 text-slate-500">{row.originalType}</td>
                                        <td className="px-6 py-3 text-right">{row.weightPurchased.toLocaleString()} kg</td>
                                        <td className="px-6 py-3 text-right font-mono font-bold">${row.totalLandedCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
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
    const [workingCostRate, setWorkingCostRate] = useState<number>(0.25);
    const [groupBy, setGroupBy] = useState<'CATEGORY' | 'SECTION'>('CATEGORY');
    const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);

    const yieldData = useMemo(() => {
        const openings = state.originalOpenings.filter(o => o.date >= startDate && o.date <= endDate);
        const totalInputWeight = openings.reduce((sum, i) => sum + i.weightOpened, 0);
        const totalInputCost = openings.reduce((sum, i) => sum + i.totalValue, 0);
        const totalWorkingCost = totalInputWeight * workingCostRate;
        const grandTotalCost = totalInputCost + totalWorkingCost;

        const production = state.productions.filter(p => p.date >= startDate && p.date <= endDate && p.qtyProduced > 0 && !p.isRebaling);
        const grouped: Record<string, { name: string, weight: number, value: number, items: any[] }> = {};
        
        production.forEach(p => {
            const item = state.items.find(i => i.id === p.itemId);
            if (!item) return;
            const groupKey = groupBy === 'CATEGORY' 
                ? (state.categories.find(c => c.id === item.category)?.name || item.category || 'Uncategorized')
                : (state.sections.find(s => s.id === item.section)?.name || item.section || 'No Section');
            
            if (!grouped[groupKey]) grouped[groupKey] = { name: groupKey, weight: 0, value: 0, items: [] };
            const unitValue = priceBasis === 'COST' ? item.avgCost : (item.salePrice || 0);
            grouped[groupKey].weight += p.weightProduced;
            grouped[groupKey].value += p.qtyProduced * unitValue;
            grouped[groupKey].items.push({ name: item.name, qty: p.qtyProduced, weight: p.weightProduced, value: p.qtyProduced * unitValue, price: unitValue });
        });

        const outputs = Object.values(grouped);
        const totalOutputWeight = outputs.reduce((sum, o) => sum + o.weight, 0);
        const totalOutputValue = outputs.reduce((sum, o) => sum + o.value, 0);
        
        return {
            inputs: { weight: totalInputWeight, cost: totalInputCost, working: totalWorkingCost, total: grandTotalCost },
            outputs, totalOutputWeight, totalOutputValue, loss: totalInputWeight - totalOutputWeight, profit: totalOutputValue - grandTotalCost
        };
    }, [state.originalOpenings, state.productions, startDate, endDate, priceBasis, workingCostRate, groupBy, state.items, state.categories, state.sections]);

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
                            <div className="p-4 bg-red-50/50 border-b border-red-100 flex justify-between items-center"><h3 className="font-bold text-red-800">Total Inputs (Cost)</h3><span className="font-mono font-bold text-red-700">${yieldData.inputs.total.toLocaleString()}</span></div>
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center"><span className="text-slate-600">Material Weight</span><span className="font-mono font-bold">{yieldData.inputs.weight.toLocaleString()} Kg</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Raw Material Cost</span><span className="font-mono">${yieldData.inputs.cost.toLocaleString()}</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Working Cost</span><span className="font-mono">${yieldData.inputs.working.toLocaleString()}</span></div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                            <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex justify-between items-center"><h3 className="font-bold text-emerald-800">Total Outputs (Value)</h3><span className="font-mono font-bold text-emerald-700">${yieldData.totalOutputValue.toLocaleString()}</span></div>
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase sticky top-0"><tr><th className="px-4 py-2">{groupBy === 'CATEGORY' ? 'Category' : 'Section'}</th><th className="px-4 py-2 text-right">Kg</th><th className="px-4 py-2 text-right">Value</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {yieldData.outputs.map((o, i) => (
                                            <tr key={i} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDrillCategory(o.name)}>
                                                <td className="px-4 py-2 font-medium text-slate-700">{o.name}</td><td className="px-4 py-2 text-right">{o.weight.toLocaleString()}</td><td className="px-4 py-2 text-right font-mono">${o.value.toLocaleString()}</td>
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
        const accs = state.accounts.map(a => ({ id: a.id, name: a.name, type: a.type, currency: 'USD', isPartner: false }));
        const partners = state.partners.map(p => ({ id: p.id, name: p.name, type: p.type, currency: p.defaultCurrency, isPartner: true }));
        return [...accs, ...partners];
    }, [state.accounts, state.partners]);

    const filteredEntities = useMemo(() => {
        if (accountType === 'ALL') return allEntities;
        return allEntities.filter(e => e.type === accountType);
    }, [allEntities, accountType]);

    const getAccountStats = useCallback((accountId: string) => {
        const openingEntries = state.ledger.filter(e => e.accountId === accountId && e.date < startDate);
        const openingDr = openingEntries.reduce((sum, e) => sum + e.debit, 0);
        const openingCr = openingEntries.reduce((sum, e) => sum + e.credit, 0);
        const openingBal = openingDr - openingCr;
        const periodEntries = state.ledger.filter(e => e.accountId === accountId && e.date >= startDate && e.date <= endDate);
        const periodDr = periodEntries.reduce((sum, e) => sum + e.debit, 0);
        const periodCr = periodEntries.reduce((sum, e) => sum + e.credit, 0);
        return { opening: openingBal, debit: periodDr, credit: periodCr, closing: openingBal + periodDr - periodCr, entries: periodEntries.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) };
    }, [state.ledger, startDate, endDate]);

    const activeEntity = useMemo(() => allEntities.find(e => e.id === selectedAccountId), [allEntities, selectedAccountId]);

    return (
        <div className="space-y-6 animate-in fade-in h-full flex flex-col">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 items-end shrink-0">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">From</label><input type="date" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">To</label><input type="date" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Type</label><select className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm" value={accountType} onChange={e => { setAccountType(e.target.value); setSelectedAccountId(''); }}><option value="ALL">All Types</option><optgroup label="Business Partners"><option value="CUSTOMER">Customers</option><option value="SUPPLIER">Suppliers</option><option value="VENDOR">Vendors</option></optgroup><optgroup label="Chart of Accounts"><option value="ASSET">Assets</option><option value="LIABILITY">Liabilities</option><option value="EXPENSE">Expenses</option><option value="REVENUE">Revenue</option></optgroup></select></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Account</label><div className="relative"><select className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm appearance-none" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}><option value="">-- View Summary --</option>{filteredEntities.map(e => ( <option key={e.id} value={e.id}>{e.name}</option> ))}</select><ChevronDown className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" size={16} /></div></div>
                {activeEntity && activeEntity.currency !== 'USD' && ( <div className="flex items-center gap-2 pb-2"><label className="text-sm font-bold text-slate-700">Show {activeEntity.currency}?</label><button onClick={() => setShowFcy(!showFcy)} className={`w-10 h-5 rounded-full transition-colors relative ${showFcy ? 'bg-blue-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${showFcy ? 'left-6' : 'left-1'}`}></div></button></div> )}
            </div>

            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {!selectedAccountId ? (
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10"><tr><th className="px-6 py-4">Account Name</th><th className="px-6 py-4">Type</th><th className="px-6 py-4 text-right">Opening ($)</th><th className="px-6 py-4 text-right">Debit ($)</th><th className="px-6 py-4 text-right">Credit ($)</th><th className="px-6 py-4 text-right">Closing ($)</th><th className="px-6 py-4 text-center">Action</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">{filteredEntities.map(e => { const stats = getAccountStats(e.id); if (stats.opening === 0 && stats.debit === 0 && stats.credit === 0) return null; return ( <tr key={e.id} className="hover:bg-slate-50 group"><td className="px-6 py-3 font-medium text-slate-800">{e.name}</td><td className="px-6 py-3 text-xs text-slate-500"><span className="bg-slate-100 px-2 py-1 rounded">{e.type}</span></td><td className="px-6 py-3 text-right font-mono text-slate-600">{stats.opening.toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td className="px-6 py-3 text-right font-mono text-slate-600">{stats.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td className="px-6 py-3 text-right font-mono text-slate-600">{stats.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td className={`px-6 py-3 text-right font-mono font-bold ${stats.closing < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{Math.abs(stats.closing).toLocaleString(undefined, {minimumFractionDigits: 2})} {stats.closing < 0 ? 'Cr' : 'Dr'}</td><td className="px-6 py-3 text-center"><button onClick={() => setSelectedAccountId(e.id)} className="text-blue-600 hover:text-blue-800 text-xs font-bold border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">View Ledger</button></td></tr> ); })}</tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {activeEntity && ( <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center"><div><h3 className="text-xl font-bold text-slate-800">{activeEntity.name}</h3><p className="text-sm text-slate-500">Ledger from {startDate} to {endDate} {showFcy && `(${activeEntity.currency})`}</p></div><div className="flex gap-2"><button onClick={() => window.print()} className="bg-white border border-slate-300 px-3 py-1 rounded text-sm flex gap-2"><Printer size={16}/> Print</button></div></div> )}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-slate-500 font-bold uppercase text-xs border-b border-slate-200 sticky top-0 z-10 shadow-sm"><tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Voucher</th><th className="px-6 py-4">Description</th><th className="px-6 py-4 text-right bg-emerald-50/30">Debit</th><th className="px-6 py-4 text-right bg-red-50/30">Credit</th><th className="px-6 py-4 text-right bg-slate-50">Balance</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(() => {
                                        if (!activeEntity) return null;
                                        const stats = getAccountStats(activeEntity.id);
                                        let runningBalance = stats.opening;
                                        return (
                                            <>
                                                <tr className="bg-slate-50 font-bold text-slate-600"><td className="px-6 py-3" colSpan={3}>Opening Balance b/f</td><td className="px-6 py-3 text-right">-</td><td className="px-6 py-3 text-right">-</td><td className="px-6 py-3 text-right bg-slate-100">{showFcy ? 'N/A' : `${Math.abs(stats.opening).toLocaleString(undefined, {minimumFractionDigits: 2})} ${stats.opening < 0 ? 'Cr' : 'Dr'}`}</td></tr>
                                                {stats.entries.map(entry => {
                                                    let debitVal = entry.debit; let creditVal = entry.credit;
                                                    if (showFcy) { if (entry.currency === activeEntity.currency) { debitVal = entry.debit > 0 ? entry.fcyAmount : 0; creditVal = entry.credit > 0 ? entry.fcyAmount : 0; } else { debitVal = 0; creditVal = 0; } }
                                                    runningBalance = runningBalance + entry.debit - entry.credit;
                                                    return ( <tr key={entry.id} className="hover:bg-slate-50"><td className="px-6 py-3 whitespace-nowrap text-slate-600">{entry.date}</td><td className="px-6 py-3"><button onClick={() => setViewVoucherId(entry.transactionId)} className="text-blue-600 hover:underline font-mono text-xs font-bold">{entry.transactionId}</button></td><td className="px-6 py-3 text-slate-700 max-w-xs truncate" title={entry.narration}>{entry.narration}</td><td className="px-6 py-3 text-right font-mono bg-emerald-50/10 text-emerald-700">{debitVal > 0 ? debitVal.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td><td className="px-6 py-3 text-right font-mono bg-red-50/10 text-red-600">{creditVal > 0 ? creditVal.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td><td className="px-6 py-3 text-right font-mono font-bold bg-slate-50 text-slate-700">{showFcy ? '-' : `${Math.abs(runningBalance).toLocaleString(undefined, {minimumFractionDigits: 2})} ${runningBalance < 0 ? 'Cr' : 'Dr'}`}</td></tr> );
                                                })}
                                                <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300"><td className="px-6 py-4" colSpan={3}>Closing Balance c/f</td><td className="px-6 py-4 text-right bg-emerald-50/30 text-emerald-800">{showFcy ? '-' : stats.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td className="px-6 py-4 text-right bg-red-50/30 text-red-800">{showFcy ? '-' : stats.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td><td className="px-6 py-4 text-right bg-slate-200">{showFcy ? '-' : `${Math.abs(stats.closing).toLocaleString(undefined, {minimumFractionDigits: 2})} ${stats.closing < 0 ? 'Cr' : 'Dr'}`}</td></tr>
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
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4"><h3 className="text-xl font-bold text-slate-800">Transaction Details</h3><button onClick={() => setViewVoucherId(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button></div>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4"><div className="grid grid-cols-2 gap-4 text-sm"><div><span className="block text-xs font-bold text-slate-400 uppercase">Voucher ID</span><span className="font-mono font-bold text-blue-600">{viewVoucherId}</span></div><div><span className="block text-xs font-bold text-slate-400 uppercase">Date</span><span className="font-medium text-slate-700">{state.ledger.find(e => e.transactionId === viewVoucherId)?.date}</span></div></div></div>
                        <table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs"><tr><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead><tbody className="divide-y divide-slate-100">{state.ledger.filter(e => e.transactionId === viewVoucherId).map((row, i) => ( <tr key={i}><td className="py-2 pr-4"><div className="font-medium text-slate-800">{row.accountName}</div><div className="text-xs text-slate-500">{row.narration}</div></td><td className="py-2 text-right font-mono">{row.debit > 0 ? row.debit.toLocaleString() : '-'}</td><td className="py-2 text-right font-mono">{row.credit > 0 ? row.credit.toLocaleString() : '-'}</td></tr> ))}</tbody></table>
                        <div className="mt-6 text-right"><button onClick={() => setViewVoucherId(null)} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700">Close</button></div>
                    </div>
                </div>
            )}
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
    const [activeTab, setActiveTab] = useState<'BI' | 'INV' | 'FIN' | 'LEDGER' | 'PROD' | 'EXP'>('BI');

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50">
            {/* Quick Links Section */}
            <div className="bg-gradient-to-r from-blue-600 to-emerald-600 px-8 py-4 shrink-0">
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wide">📊 Specialized Reports</h3>
                    <div className="flex gap-3">
                        <Link 
                            to="/reports/order-fulfillment" 
                            className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-purple-700 rounded-lg text-sm font-semibold transition-all shadow-sm"
                        >
                            <Truck size={16} />
                            Order Fulfillment
                            <ExternalLink size={14} />
                        </Link>
                        <Link 
                            to="/reports/original-stock" 
                            className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-blue-700 rounded-lg text-sm font-semibold transition-all shadow-sm"
                        >
                            <Package size={16} />
                            Original Stock
                            <ExternalLink size={14} />
                        </Link>
                        <Link 
                            to="/reports/item-performance" 
                            className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-emerald-700 rounded-lg text-sm font-semibold transition-all shadow-sm"
                        >
                            <TrendingUp size={16} />
                            Item Performance
                            <ExternalLink size={14} />
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
                    { id: 'PROD', label: 'Production Yield', icon: Factory },
                    { id: 'EXP', label: 'Smart Explorer', icon: Search },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}><tab.icon size={18} />{tab.label}</button>
                ))}
            </div>
            <div className="flex-1 overflow-auto p-8">
                {activeTab === 'BI' && <BiDashboard />}
                {activeTab === 'INV' && <InventoryIntelligence />}
                {activeTab === 'FIN' && <FinancialStatementsContainer />}
                {activeTab === 'LEDGER' && <LedgerReport />}
                {activeTab === 'PROD' && <ProductionYield />}
                {activeTab === 'EXP' && <SmartExplorer />}
            </div>
        </div>
    );
};
