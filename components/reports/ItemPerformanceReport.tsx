import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Download, Printer, TrendingUp, DollarSign, BarChart3, Package2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ItemPerformance {
    itemId: string;
    itemName: string;
    category: string;
    section: string;
    openingStock: number;
    production: number;
    sales: number;
    closingStock: number;
    revenue: number;
    cost: number;
    profit: number;
    profitMargin: number;
}

export const ItemPerformanceReport: React.FC = () => {
    const { state } = useData();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedSection, setSelectedSection] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    // Get unique categories and sections
    const categories = useMemo(() => {
        const uniqueCategoryIds = Array.from(new Set(state.items.map(item => item.category).filter(Boolean)));
        return uniqueCategoryIds.map(catId => {
            const category = state.categories.find(c => c.id === catId);
            return {
                id: catId,
                name: category?.name || catId // Use category name if found, otherwise fallback to ID
            };
        });
    }, [state.items, state.categories]);

    const sections = useMemo(() => {
        return Array.from(new Set(state.items.map(item => item.section).filter(Boolean)));
    }, [state.items]);

    // Calculate item performance
    const performanceData = useMemo(() => {
        const result: ItemPerformance[] = [];

        state.items.forEach(item => {
            // Apply filters
            if (selectedCategory !== 'all' && item.category !== selectedCategory) return;
            if (selectedSection !== 'all' && item.section !== selectedSection) return;

            // Filter sales invoices by date range
            const relevantInvoices = state.salesInvoices.filter(invoice => {
                const invoiceDate = new Date(invoice.date);
                const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
                const toDate = dateTo ? new Date(dateTo) : new Date();
                return invoice.status === 'Posted' && invoiceDate >= fromDate && invoiceDate <= toDate;
            });

            // Calculate sales from invoice items (use qty, not quantity)
            const totalSales = relevantInvoices.reduce((sum, invoice) => {
                const invoiceItem = invoice.items.find(i => i.itemId === item.id);
                return sum + (invoiceItem?.qty || 0);
            }, 0);

            // Calculate revenue from invoice items (use qty, not quantity)
            // Fix NaN issue: Handle invalid rate values
            const revenue = relevantInvoices.reduce((sum, invoice) => {
                const invoiceItem = invoice.items.find(i => i.itemId === item.id);
                if (!invoiceItem) return sum;
                const rate = invoiceItem.rate || 0;
                const qty = invoiceItem.qty || 0;
                // Check for NaN
                if (isNaN(rate) || isNaN(qty)) return sum;
                return sum + (qty * rate);
            }, 0);

            // Filter production by date range (exclude re-baling)
            const relevantProduction = state.productions.filter(prod => {
                const prodDate = new Date(prod.date);
                const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
                const toDate = dateTo ? new Date(dateTo) : new Date();
                return prod.itemId === item.id && 
                       !prod.isRebaling && 
                       prod.qtyProduced > 0 &&
                       prodDate >= fromDate && 
                       prodDate <= toDate;
            });

            // Use qtyProduced, not quantityProduced
            const totalProduction = relevantProduction.reduce((sum, prod) => {
                const qty = prod.qtyProduced || 0;
                return isNaN(qty) ? sum : sum + qty;
            }, 0);
            
            // Calculate cost (production cost): qtyProduced * productionPrice (or avgCost if not set)
            const productionCost = relevantProduction.reduce((sum, prod) => {
                const qty = prod.qtyProduced || 0;
                if (isNaN(qty) || qty <= 0) return sum;
                // Use productionPrice if available, otherwise use item.avgCost
                const unitCost = prod.productionPrice || item.avgCost || 0;
                if (isNaN(unitCost)) return sum;
                return sum + (qty * unitCost);
            }, 0);
            
            // Fix NaN handling for profit calculation
            const validRevenue = isNaN(revenue) ? 0 : revenue;
            const validCost = isNaN(productionCost) ? 0 : productionCost;
            const profit = validRevenue - validCost;
            const profitMargin = validRevenue > 0 ? (profit / validRevenue) * 100 : 0;

            // Calculate opening stock: current stock + sales - production (for the period)
            // This gives us the stock at the start of the period
            const currentStock = item.stockQty || 0;
            const openingStock = Math.max(0, currentStock + totalSales - totalProduction);
            const closingStock = currentStock; // Current stock is the closing stock

            result.push({
                itemId: item.id,
                itemName: item.name,
                category: item.category,
                section: item.section,
                openingStock,
                production: totalProduction,
                sales: totalSales,
                closingStock,
                revenue,
                cost: productionCost,
                profit,
                profitMargin
            });
        });

        return result.sort((a, b) => b.revenue - a.revenue);
    }, [state.items, state.salesInvoices, state.productions, selectedCategory, selectedSection, dateFrom, dateTo]);

    const totals = useMemo(() => {
        const revenue = performanceData.reduce((sum, item) => {
            const val = isNaN(item.revenue) ? 0 : item.revenue;
            return sum + val;
        }, 0);
        const cost = performanceData.reduce((sum, item) => {
            const val = isNaN(item.cost) ? 0 : item.cost;
            return sum + val;
        }, 0);
        const profit = performanceData.reduce((sum, item) => {
            const val = isNaN(item.profit) ? 0 : item.profit;
            return sum + val;
        }, 0);
        const sales = performanceData.reduce((sum, item) => {
            const val = isNaN(item.sales) ? 0 : item.sales;
            return sum + val;
        }, 0);
        return {
            totalRevenue: revenue,
            totalCost: cost,
            totalProfit: profit,
            totalSales: sales
        };
    }, [performanceData]);

    // Prepare chart data (top 10 items by revenue)
    const chartData = useMemo(() => {
        return performanceData
            .slice(0, 10)
            .map(item => ({
                name: item.itemName.length > 15 ? item.itemName.substring(0, 15) + '...' : item.itemName,
                Revenue: isNaN(item.revenue) ? 0 : item.revenue,
                Cost: isNaN(item.cost) ? 0 : item.cost,
                Profit: isNaN(item.profit) ? 0 : item.profit
            }))
            .filter(item => item.Revenue > 0 || item.Cost > 0 || item.Profit !== 0); // Only show items with data
    }, [performanceData]);

    const handlePrint = () => window.print();

    const handleExport = () => {
        const csv = [
            ['Item', 'Category', 'Section', 'Opening Stock', 'Production', 'Sales', 'Closing Stock', 'Revenue (USD)', 'Cost (USD)', 'Profit (USD)', 'Profit Margin (%)'],
            ...performanceData.map(item => [
                item.itemName,
                item.category,
                item.section,
                item.openingStock.toFixed(2),
                item.production.toFixed(2),
                item.sales.toFixed(2),
                item.closingStock.toFixed(2),
                item.revenue.toFixed(2),
                item.cost.toFixed(2),
                item.profit.toFixed(2),
                item.profitMargin.toFixed(2)
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `item-performance-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Item Performance Report</h2>
                    <p className="text-sm text-slate-500 mt-1">Production, sales, and profitability analysis</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                    >
                        <Printer size={18} />
                        Print
                    </button>
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                    >
                        <Download size={18} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Section</label>
                        <select
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">All Sections</option>
                            {sections.map(sec => (
                                <option key={sec} value={sec}>{sec}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">From Date</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">To Date</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Total Revenue</div>
                        <DollarSign className="text-blue-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        ${isNaN(totals.totalRevenue) ? '0' : totals.totalRevenue.toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Total Cost</div>
                        <TrendingUp className="text-red-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        ${isNaN(totals.totalCost) ? '0' : totals.totalCost.toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Total Profit</div>
                        <BarChart3 className="text-emerald-500" size={20} />
                    </div>
                    <div className={`text-2xl font-bold ${totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ${isNaN(totals.totalProfit) ? '0' : totals.totalProfit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Items Sold</div>
                        <Package2 className="text-purple-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        {isNaN(totals.totalSales) ? '0' : totals.totalSales.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </div>
                </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Top 10 Items - Revenue vs Cost vs Profit</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                            <Legend />
                            <Bar dataKey="Revenue" fill="#3b82f6" />
                            <Bar dataKey="Cost" fill="#ef4444" />
                            <Bar dataKey="Profit" fill="#10b981" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Item
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Opening
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Production
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Sales
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Closing
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Revenue
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Cost
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Profit
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Margin %
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {performanceData.map((item) => (
                                <tr key={item.itemId} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {item.itemName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {state.categories.find(c => c.id === item.category)?.name || item.category}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-slate-700">
                                        {item.openingStock.toFixed(0)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-blue-600">
                                        {isNaN(item.production) ? '0' : item.production.toFixed(0)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-red-600">
                                        {isNaN(item.sales) ? '0' : item.sales.toFixed(0)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono font-bold text-slate-800">
                                        {isNaN(item.closingStock) ? '0' : item.closingStock.toFixed(0)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-blue-600">
                                        ${isNaN(item.revenue) ? '0' : item.revenue.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-red-600">
                                        ${isNaN(item.cost) ? '0' : item.cost.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                    </td>
                                    <td className={`px-6 py-4 text-sm text-right font-mono font-semibold ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-700'}`}>
                                        ${isNaN(item.profit) ? '0' : item.profit.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                    </td>
                                    <td className={`px-6 py-4 text-sm text-right font-mono font-semibold ${item.profitMargin >= 0 ? 'text-emerald-600' : 'text-red-700'}`}>
                                        {isNaN(item.profitMargin) ? '0.0' : item.profitMargin.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                            {performanceData.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                                        No data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
