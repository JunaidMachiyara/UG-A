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

            // Calculate sales from invoice items
            const totalSales = relevantInvoices.reduce((sum, invoice) => {
                const invoiceItem = invoice.items.find(i => i.itemId === item.id);
                return sum + (invoiceItem?.quantity || 0);
            }, 0);

            // Calculate revenue from invoice items
            const revenue = relevantInvoices.reduce((sum, invoice) => {
                const invoiceItem = invoice.items.find(i => i.itemId === item.id);
                if (!invoiceItem) return sum;
                return sum + (invoiceItem.quantity * invoiceItem.rate);
            }, 0);

            // Filter production by date range
            const relevantProduction = state.productions.filter(prod => {
                const prodDate = new Date(prod.date);
                const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
                const toDate = dateTo ? new Date(dateTo) : new Date();
                return prod.itemId === item.id && prodDate >= fromDate && prodDate <= toDate;
            });

            const totalProduction = relevantProduction.reduce((sum, prod) => sum + prod.quantityProduced, 0);
            
            // Calculate cost (production cost)
            const productionCost = relevantProduction.reduce((sum, prod) => sum + (prod.totalCost || 0), 0);
            
            const profit = revenue - productionCost;
            const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

            // Simple stock calculation
            const openingStock = item.openingStock || 0;
            const closingStock = openingStock + totalProduction - totalSales;

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

    const totals = useMemo(() => ({
        totalRevenue: performanceData.reduce((sum, item) => sum + item.revenue, 0),
        totalCost: performanceData.reduce((sum, item) => sum + item.cost, 0),
        totalProfit: performanceData.reduce((sum, item) => sum + item.profit, 0),
        totalSales: performanceData.reduce((sum, item) => sum + item.sales, 0)
    }), [performanceData]);

    // Prepare chart data (top 10 items by revenue)
    const chartData = useMemo(() => {
        return performanceData
            .slice(0, 10)
            .map(item => ({
                name: item.itemName.length > 15 ? item.itemName.substring(0, 15) + '...' : item.itemName,
                Revenue: item.revenue,
                Cost: item.cost,
                Profit: item.profit
            }));
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
                        ${totals.totalRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Total Cost</div>
                        <TrendingUp className="text-red-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        ${totals.totalCost.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Total Profit</div>
                        <BarChart3 className="text-emerald-500" size={20} />
                    </div>
                    <div className={`text-2xl font-bold ${totals.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ${totals.totalProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Items Sold</div>
                        <Package2 className="text-purple-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        {totals.totalSales.toLocaleString(undefined, {maximumFractionDigits: 0})}
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
                                        {item.production.toFixed(0)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-red-600">
                                        {item.sales.toFixed(0)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono font-bold text-slate-800">
                                        {item.closingStock.toFixed(0)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-blue-600">
                                        ${item.revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-red-600">
                                        ${item.cost.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                    </td>
                                    <td className={`px-6 py-4 text-sm text-right font-mono font-semibold ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-700'}`}>
                                        ${item.profit.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                    </td>
                                    <td className={`px-6 py-4 text-sm text-right font-mono font-semibold ${item.profitMargin >= 0 ? 'text-emerald-600' : 'text-red-700'}`}>
                                        {item.profitMargin.toFixed(1)}%
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
