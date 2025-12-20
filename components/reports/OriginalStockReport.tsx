import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Download, Printer, Package, TrendingDown, TrendingUp, X } from 'lucide-react';
import { SalesInvoice, PartnerType } from '../../types';
import { EntitySelector } from '../EntitySelector';

interface StockSummary {
    originalTypeId: string;
    originalTypeName: string;
    supplierId?: string; // Track which supplier this stock is from
    totalPurchased: number;
    totalOpened: number;
    totalDirectSold: number;
    inHand: number;
    avgCostPerKg: number;
    avgSaleRatePerKg: number;
    totalDirectSaleRevenue: number;
    totalDirectSaleCost: number;
    profitLoss: number;
    directSaleInvoices: SalesInvoice[];
    totalValue: number;
}

export const OriginalStockReport: React.FC = () => {
    const { state } = useData();
    const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
    const [selectedInvoices, setSelectedInvoices] = useState<SalesInvoice[] | null>(null);

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
                    totalDirectSold: 0,
                    inHand: 0,
                    avgCostPerKg: 0,
                    avgSaleRatePerKg: 0,
                    totalDirectSaleRevenue: 0,
                    totalDirectSaleCost: 0,
                    profitLoss: 0,
                    directSaleInvoices: [],
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
            // Match by supplierId and originalTypeId (opening.originalType stores the ID)
            const matchingKeys = Array.from(summary.keys()).filter(key => {
                const item = summary.get(key)!;
                // Direct ID match (opening.originalType is actually the ID despite the name)
                const idMatch = item.originalTypeId === opening.originalType;
                const supplierMatch = item.supplierId === opening.supplierId;
                return idMatch && (selectedSupplier === 'all' || supplierMatch);
            });
            
            matchingKeys.forEach(key => {
                const item = summary.get(key)!;
                item.totalOpened += opening.weightOpened;
            });
        });

        // Calculate direct sales (Posted invoices with DS- or DSINV- prefix)
        const directSalesInvoices = state.salesInvoices.filter(inv => 
            inv.status === 'Posted' && (inv.invoiceNo.startsWith('DS-') || inv.invoiceNo.startsWith('DSINV-'))
        );

        directSalesInvoices.forEach(invoice => {
            invoice.items.forEach(item => {
                if (item.originalPurchaseId) {
                    // Find the purchase this sale came from (search all purchases, not just filtered)
                    const purchase = state.purchases.find(p => p.id === item.originalPurchaseId);
                    if (purchase) {
                        // Skip if supplier filter is active and doesn't match
                        if (selectedSupplier !== 'all' && purchase.supplierId !== selectedSupplier) {
                            return;
                        }
                        
                        const key = purchase.originalProductId 
                            ? `${purchase.supplierId}-${purchase.originalTypeId}-${purchase.originalProductId}`
                            : `${purchase.supplierId}-${purchase.originalTypeId}`;
                        
                        const stockItem = summary.get(key);
                        if (stockItem) {
                            stockItem.totalDirectSold += item.totalKg;
                            stockItem.totalDirectSaleRevenue += item.total; // USD
                            stockItem.totalDirectSaleCost += item.totalKg * purchase.landedCostPerKg;
                            
                            // Only add invoice once per stock item
                            if (!stockItem.directSaleInvoices.find(inv => inv.id === invoice.id)) {
                                stockItem.directSaleInvoices.push(invoice);
                            }
                        }
                    }
                }
            });
        });

        // Calculate in hand, averages, and profit/loss
        summary.forEach(item => {
            item.inHand = item.totalPurchased - item.totalOpened - item.totalDirectSold;
            item.totalValue = item.inHand * item.avgCostPerKg;
            if (item.totalDirectSold > 0) {
                item.avgSaleRatePerKg = item.totalDirectSaleRevenue / item.totalDirectSold;
                item.profitLoss = item.totalDirectSaleRevenue - item.totalDirectSaleCost;
                // Calculate margin as percentage
                item.margin = item.totalDirectSaleRevenue > 0
                  ? ((item.totalDirectSaleRevenue - item.totalDirectSaleCost) / item.totalDirectSaleRevenue) * 100
                  : 0;
            } else {
                item.avgSaleRatePerKg = 0;
                item.profitLoss = 0;
                item.margin = 0;
            }
        });

        return Array.from(summary.values())
            .filter(item => item.inHand > 0 || item.totalPurchased > 0) // Show items with any activity
            .sort((a, b) => b.inHand - a.inHand);
    }, [state.purchases, state.originalOpenings, state.salesInvoices, selectedSupplier]);

    const totals = useMemo(() => ({
        totalPurchased: stockData.reduce((sum, item) => sum + item.totalPurchased, 0),
        totalOpened: stockData.reduce((sum, item) => sum + item.totalOpened, 0),
        totalDirectSold: stockData.reduce((sum, item) => sum + item.totalDirectSold, 0),
        totalInHand: stockData.reduce((sum, item) => sum + item.inHand, 0),
        totalValue: stockData.reduce((sum, item) => sum + item.totalValue, 0),
        totalConsumed: stockData.reduce((sum, item) => sum + item.totalOpened + item.totalDirectSold, 0)
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
                    <div className="min-w-[200px]">
                        <EntitySelector
                            entities={[
                                { id: 'all', name: 'All Suppliers' },
                                ...state.partners.filter(p => p.type === PartnerType.SUPPLIER)
                            ]}
                            selectedId={selectedSupplier}
                            onSelect={(id) => setSelectedSupplier(id || 'all')}
                            placeholder="All Suppliers"
                            className="w-full"
                        />
                    </div>
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
                    <div className="text-2xl font-bold text-slate-800">{totals.totalConsumed.toFixed(0)} Kg</div>
                    <div className="text-xs text-slate-500 mt-1">
                        Opened: {totals.totalOpened.toFixed(0)} Kg | Direct Sales: {totals.totalDirectSold.toFixed(0)} Kg
                    </div>
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
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Original Type</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Purchased (Kg)</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Consumed (Kg)</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">In Hand (Kg)</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Avg Cost/Kg</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Avg Sale/Kg<br/>(Direct Sales)</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Profit/Loss<br/>(Direct Sales)</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Margin (%)</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Value (USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stockData.map((item) => (
                                <tr key={item.originalTypeId} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.originalTypeName}</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-slate-700">{item.totalPurchased.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-red-600">
                                        {(item.totalOpened + item.totalDirectSold).toFixed(2)}
                                        {item.totalDirectSold > 0 && (
                                            <div className="text-xs text-slate-500">
                                                (Opened: {item.totalOpened.toFixed(0)} + Sold: {item.totalDirectSold.toFixed(0)})
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-mono font-bold text-emerald-600">{item.inHand.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-slate-700">${item.avgCostPerKg.toFixed(3)}</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-blue-600">{item.avgSaleRatePerKg > 0 ? `$${item.avgSaleRatePerKg.toFixed(3)}` : '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right">{item.profitLoss !== 0 ? (<button onClick={() => setSelectedInvoices(item.directSaleInvoices)} className={`font-mono font-semibold underline cursor-pointer hover:opacity-70 ${item.profitLoss > 0 ? 'text-emerald-600' : 'text-red-600'}`}>${item.profitLoss.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</button>) : '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono text-purple-600">{item.margin !== undefined ? `${item.margin.toFixed(2)}%` : '0%'}</td>
                                    <td className="px-6 py-4 text-sm text-right font-mono font-semibold text-blue-600">${item.totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                </tr>
                            ))}
                            {stockData.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
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
                                    <td className="px-6 py-4 text-sm text-right font-mono text-slate-800">
                                        -
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

            {/* Invoice Details Modal */}
            {selectedInvoices && selectedInvoices.length > 0 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedInvoices(null)}>
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Direct Sale Invoices</h3>
                            <button onClick={() => setSelectedInvoices(null)} className="text-white hover:bg-blue-700 rounded p-1">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                            <div className="space-y-4">
                                {selectedInvoices.map(inv => (
                                    <div key={inv.id} className="border border-slate-200 rounded-lg p-4">
                                        <div className="grid grid-cols-3 gap-4 mb-3 pb-3 border-b border-slate-200">
                                            <div>
                                                <div className="text-xs text-slate-500">Invoice #</div>
                                                <div className="font-mono font-bold text-blue-600">{inv.invoiceNo}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500">Date</div>
                                                <div className="font-medium">{inv.date}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500">Customer</div>
                                                <div className="font-medium">{state.partners.find(p => p.id === inv.customerId)?.name}</div>
                                            </div>
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Item</th>
                                                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Qty (Kg)</th>
                                                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Rate/Kg</th>
                                                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {inv.items.map(item => (
                                                    <tr key={item.id} className="border-t border-slate-100">
                                                        <td className="px-3 py-2">{item.itemName}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{item.totalKg.toFixed(2)}</td>
                                                        <td className="px-3 py-2 text-right font-mono">${item.rate.toFixed(3)}</td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold">${item.total.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                                <tr>
                                                    <td colSpan={3} className="px-3 py-2 text-right font-bold">Net Total:</td>
                                                    <td className="px-3 py-2 text-right font-mono font-bold text-blue-600">${inv.netTotal.toFixed(2)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
