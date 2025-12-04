import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Download, Printer, Package, TrendingDown, TrendingUp } from 'lucide-react';

interface StockSummary {
    originalTypeId: string;
    originalTypeName: string;
    supplierId?: string; // Track which supplier this stock is from
    totalPurchased: number;
    totalOpened: number;
    inHand: number;
    avgCostPerKg: number;
    totalValue: number;
}

export const OriginalStockReport: React.FC = () => {
    const { state } = useData();
    const [selectedSupplier, setSelectedSupplier] = useState<string>('all');

    // Calculate stock summary
    const stockData = useMemo(() => {
        const summary = new Map<string, StockSummary>();

        // Filter purchases by supplier FIRST
        const filteredPurchases = selectedSupplier === 'all' 
            ? state.purchases 
            : state.purchases.filter(p => p.supplierId === selectedSupplier);

        // Aggregate filtered purchases
        filteredPurchases.forEach(purchase => {
            // Create unique key combining Supplier, Type ID and Product ID
            const key = purchase.originalProductId 
                ? `${purchase.supplierId}-${purchase.originalTypeId}-${purchase.originalProductId}`
                : `${purchase.supplierId}-${purchase.originalTypeId}`;
                
            if (!summary.has(key)) {
                summary.set(key, {
                    originalTypeId: purchase.originalTypeId,
                    originalTypeName: purchase.originalType,
                    supplierId: purchase.supplierId,
                    totalPurchased: 0,
                    totalOpened: 0,
                    inHand: 0,
                    avgCostPerKg: 0,
                    totalValue: 0
                });
            }
            const item = summary.get(key)!;
            item.totalPurchased += purchase.weightPurchased;
            
            // Calculate weighted average cost
            const purchaseCost = purchase.totalLandedCost / purchase.weightPurchased;
            item.avgCostPerKg = ((item.avgCostPerKg * (item.totalPurchased - purchase.weightPurchased)) + 
                                (purchaseCost * purchase.weightPurchased)) / item.totalPurchased;
        });

        // Subtract openings (consumption)
        state.originalOpenings.forEach(opening => {
            const typeMatch = Array.from(summary.values()).find(s => 
                s.originalTypeName === opening.originalType &&
                (selectedSupplier === 'all' || s.supplierId === opening.supplierId)
            );
            if (typeMatch) {
                typeMatch.totalOpened += opening.weightOpened;
            }
        });

        // Calculate in hand and value
        summary.forEach(item => {
            item.inHand = item.totalPurchased - item.totalOpened;
            item.totalValue = item.inHand * item.avgCostPerKg;
        });

        return Array.from(summary.values())
            .filter(item => item.inHand > 0 || item.totalPurchased > 0) // Show items with any activity
            .sort((a, b) => b.inHand - a.inHand);
    }, [state.purchases, state.originalOpenings, selectedSupplier]);

    const totals = useMemo(() => ({
        totalPurchased: stockData.reduce((sum, item) => sum + item.totalPurchased, 0),
        totalOpened: stockData.reduce((sum, item) => sum + item.totalOpened, 0),
        totalInHand: stockData.reduce((sum, item) => sum + item.inHand, 0),
        totalValue: stockData.reduce((sum, item) => sum + item.totalValue, 0)
    }), [stockData]);

    const handlePrint = () => window.print();
    
    const handleExport = () => {
        const csv = [
            ['Original Type', 'Total Purchased (Kg)', 'Total Consumed (Kg)', 'In Hand (Kg)', 'Avg Cost/Kg', 'Total Value (USD)'],
            ...stockData.map(item => [
                item.originalTypeName,
                item.totalPurchased.toFixed(2),
                item.totalOpened.toFixed(2),
                item.inHand.toFixed(2),
                item.avgCostPerKg.toFixed(2),
                item.totalValue.toFixed(2)
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `original-stock-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Original Stock Report</h2>
                    <p className="text-sm text-slate-500 mt-1">Raw material inventory analysis</p>
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
                <div className="flex gap-4 items-center">
                    <label className="text-sm font-medium text-slate-700">Filter by Supplier:</label>
                    <select
                        value={selectedSupplier}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">All Suppliers</option>
                        {state.partners
                            .filter(p => p.type === 'SUPPLIER')
                            .map(supplier => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                </option>
                            ))}
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Total Purchased</div>
                        <TrendingUp className="text-blue-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{totals.totalPurchased.toFixed(0)} Kg</div>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Total Consumed</div>
                        <TrendingDown className="text-red-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{totals.totalOpened.toFixed(0)} Kg</div>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">In Hand</div>
                        <Package className="text-emerald-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">{totals.totalInHand.toFixed(0)} Kg</div>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Total Value</div>
                        <div className="text-blue-500 text-xl font-bold">$</div>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">${totals.totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Original Type
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Total Purchased (Kg)
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Total Consumed (Kg)
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    In Hand (Kg)
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Avg Cost/Kg
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Total Value (USD)
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stockData.map((item) => (
                                <tr key={item.originalTypeId} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {item.originalTypeName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-slate-700">
                                        {item.totalPurchased.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-red-600">
                                        {item.totalOpened.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono font-bold text-emerald-600">
                                        {item.inHand.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-slate-700">
                                        ${item.avgCostPerKg.toFixed(3)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono font-semibold text-blue-600">
                                        ${item.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </td>
                                </tr>
                            ))}
                            {stockData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {stockData.length > 0 && (
                            <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                                <tr className="font-bold">
                                    <td className="px-6 py-4 text-sm text-slate-800">TOTAL</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-slate-800">
                                        {totals.totalPurchased.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-red-700">
                                        {totals.totalOpened.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-emerald-700 text-lg">
                                        {totals.totalInHand.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-slate-800">
                                        -
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-blue-700 text-lg">
                                        ${totals.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};
