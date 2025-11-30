import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Package, AlertCircle, CheckCircle, Clock, TrendingUp, Download, Printer } from 'lucide-react';

interface OrderQueueItem {
    orderId: string;
    orderDate: string;
    customerName: string;
    itemId: string;
    itemName: string;
    totalQty: number;
    shippedQty: number;
    unshippedQty: number;
    status: 'Ready to Ship' | 'Partial' | 'Pending Production';
    shortfall: number;
    predictedDate: string;
    allocatedStock: number;
}

export const OrderFulfillmentDashboard: React.FC = () => {
    const { state } = useData();
    const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
    const [selectedItem, setSelectedItem] = useState<string>('all');

    // Calculate average daily production for last 30 days
    const avgDailyProduction = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        const productionByItem: Record<string, number> = {};
        
        state.productions.forEach(prod => {
            if (prod.date >= thirtyDaysAgoStr && prod.qtyProduced > 0) {
                if (!productionByItem[prod.itemId]) {
                    productionByItem[prod.itemId] = 0;
                }
                productionByItem[prod.itemId] += prod.qtyProduced;
            }
        });
        
        // Divide by 30 to get daily average
        Object.keys(productionByItem).forEach(itemId => {
            productionByItem[itemId] = productionByItem[itemId] / 30;
        });
        
        return productionByItem;
    }, [state.productions]);

    // Calculate current stock by item
    const currentStock = useMemo(() => {
        const stockByItem: Record<string, number> = {};
        state.items.forEach(item => {
            stockByItem[item.id] = item.stockQty || 0;
        });
        return stockByItem;
    }, [state.items]);

    // Build order queue with FIFO allocation
    const orderQueue = useMemo(() => {
        const queue: OrderQueueItem[] = [];
        const stockAvailable: Record<string, number> = { ...currentStock };

        // Get all ongoing orders sorted by date (FIFO)
        const orders = [...state.ongoingOrders]
            .filter(order => {
                const matchCustomer = selectedCustomer === 'all' || order.customerId === selectedCustomer;
                const matchItem = selectedItem === 'all' || order.items.some(i => i.itemId === selectedItem);
                return order.status !== 'Completed' && matchCustomer && matchItem;
            })
            .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

        orders.forEach(order => {
            const customer = state.partners.find(p => p.id === order.customerId);
            
            order.items.forEach(orderItem => {
                if (selectedItem !== 'all' && orderItem.itemId !== selectedItem) return;
                
                const item = state.items.find(i => i.id === orderItem.itemId);
                if (!item) return;

                const unshippedQty = orderItem.quantity - orderItem.shippedQty;
                if (unshippedQty <= 0) return;

                const availableStock = stockAvailable[orderItem.itemId] || 0;
                const allocated = Math.min(unshippedQty, availableStock);
                const shortfall = unshippedQty - allocated;

                // Update available stock after allocation
                stockAvailable[orderItem.itemId] = Math.max(0, availableStock - allocated);

                // Determine status
                let status: OrderQueueItem['status'];
                if (shortfall === 0) {
                    status = 'Ready to Ship';
                } else if (allocated > 0) {
                    status = 'Partial';
                } else {
                    status = 'Pending Production';
                }

                // Calculate predicted fulfillment date
                let predictedDate = 'N/A';
                if (shortfall > 0) {
                    const dailyProd = avgDailyProduction[orderItem.itemId] || 0;
                    if (dailyProd > 0) {
                        const daysToFulfill = Math.ceil(shortfall / dailyProd);
                        const fulfillDate = new Date();
                        fulfillDate.setDate(fulfillDate.getDate() + daysToFulfill);
                        predictedDate = fulfillDate.toISOString().split('T')[0];
                    }
                }

                queue.push({
                    orderId: order.id,
                    orderDate: order.orderDate,
                    customerName: customer?.name || 'Unknown',
                    itemId: orderItem.itemId,
                    itemName: item.name,
                    totalQty: orderItem.quantity,
                    shippedQty: orderItem.shippedQty,
                    unshippedQty,
                    status,
                    shortfall,
                    predictedDate,
                    allocatedStock: allocated
                });
            });
        });

        return queue;
    }, [state.ongoingOrders, state.items, state.partners, selectedCustomer, selectedItem, currentStock, avgDailyProduction]);

    // Calculate KPIs
    const kpis = useMemo(() => {
        const totalDemand = orderQueue.reduce((sum, item) => sum + item.unshippedQty, 0);
        const totalStock = selectedItem === 'all' 
            ? Object.values(currentStock).reduce((sum: number, qty) => sum + (qty as number), 0)
            : currentStock[selectedItem] || 0;
        const avgProduction = selectedItem === 'all'
            ? Object.values(avgDailyProduction).reduce((sum: number, qty) => sum + (qty as number), 0)
            : avgDailyProduction[selectedItem] || 0;

        return { totalDemand, totalStock, avgProduction };
    }, [orderQueue, currentStock, avgDailyProduction, selectedItem]);

    const handlePrint = () => window.print();

    const handleExport = () => {
        const csv = [
            ['Order Date', 'Order ID', 'Customer', 'Item', 'Un-shipped Qty', 'Status', 'Shortfall', 'Predicted Date'],
            ...orderQueue.map(item => [
                item.orderDate,
                item.orderId,
                item.customerName,
                item.itemName,
                item.unshippedQty.toString(),
                item.status,
                item.shortfall.toString(),
                item.predictedDate
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `order-fulfillment-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Order Fulfillment Dashboard</h2>
                    <p className="text-sm text-slate-500 mt-1">FIFO-based order queue with stock allocation simulation</p>
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
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Download size={18} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Customer</label>
                        <select
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">All Customers</option>
                            {state.partners
                                .filter(p => p.type === 'CUSTOMER')
                                .map(customer => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Item</label>
                        <select
                            value={selectedItem}
                            onChange={(e) => setSelectedItem(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">All Items</option>
                            {state.items.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Total Demand (Un-shipped)</div>
                        <Package className="text-red-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{kpis.totalDemand.toLocaleString()} Units</div>
                    <div className="text-xs text-slate-400 mt-2">Across all pending orders</div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Current Stock</div>
                        <CheckCircle className="text-emerald-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">{kpis.totalStock.toLocaleString()} Units</div>
                    <div className="text-xs text-slate-400 mt-2">Available for immediate shipment</div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-sm font-medium text-slate-500">Avg. Daily Production</div>
                        <TrendingUp className="text-blue-500" size={20} />
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{kpis.avgProduction.toFixed(0)} Units/day</div>
                    <div className="text-xs text-slate-400 mt-2">Based on last 30 days</div>
                </div>
            </div>

            {/* Order Queue Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800">Order Fulfillment Queue (FIFO)</h3>
                    <p className="text-xs text-slate-500 mt-1">Orders are allocated stock on a first-come, first-served basis</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Order Date
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Order ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Item
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Un-shipped Qty
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Shortfall
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    Predicted Date
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {orderQueue.map((item, index) => (
                                <tr key={`${item.orderId}-${item.itemId}-${index}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                        {item.orderDate}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono font-medium text-blue-600">
                                        {item.orderId.substring(0, 8)}...
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                        {item.customerName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                        {item.itemName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-bold text-slate-800">
                                        {item.unshippedQty.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                                            item.status === 'Ready to Ship' 
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                : item.status === 'Partial'
                                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                : 'bg-red-100 text-red-700 border border-red-200'
                                        }`}>
                                            {item.status === 'Ready to Ship' && <CheckCircle size={12} />}
                                            {item.status === 'Partial' && <AlertCircle size={12} />}
                                            {item.status === 'Pending Production' && <Clock size={12} />}
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-sm text-right font-mono font-bold ${
                                        item.shortfall > 0 ? 'text-red-600' : 'text-emerald-600'
                                    }`}>
                                        {item.shortfall > 0 ? item.shortfall.toLocaleString() : '0'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                        {item.predictedDate !== 'N/A' && item.shortfall > 0 ? (
                                            <span className="flex items-center gap-2">
                                                <Clock size={14} className="text-slate-400" />
                                                {item.predictedDate}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {orderQueue.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        <Package size={48} className="mx-auto mb-4 text-slate-300" />
                                        No pending orders found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Status Legend:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle size={12} /> Ready to Ship
                        </span>
                        <span className="text-slate-600">= Sufficient stock available</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                            <AlertCircle size={12} /> Partial
                        </span>
                        <span className="text-slate-600">= Can ship partially, rest pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                            <Clock size={12} /> Pending Production
                        </span>
                        <span className="text-slate-600">= No stock, awaiting production</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
