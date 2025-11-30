

import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { SalesInvoice, SalesInvoiceItem, Currency } from '../types';
import { EXCHANGE_RATES } from '../constants';
import { ClipboardCheck, ArrowLeft, Save, CheckCircle, AlertCircle, Calendar, User, FileText } from 'lucide-react';

export const PostingModule: React.FC = () => {
    const { state, postSalesInvoice } = useData();
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    
    // Edit State for the selected invoice items
    const [editItems, setEditItems] = useState<SalesInvoiceItem[]>([]);
    
    // Derived: Unposted Invoices
    const unpostedInvoices = useMemo(() => 
        state.salesInvoices.filter(inv => inv.status === 'Unposted').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [state.salesInvoices]);

    const activeInvoice = useMemo(() => 
        state.salesInvoices.find(inv => inv.id === selectedInvoiceId),
    [selectedInvoiceId, state.salesInvoices]);

    useEffect(() => {
        if (activeInvoice) {
            // Initialize edit state with current items
            // Ensure they have currency/rate defaults if missing
            setEditItems(activeInvoice.items.map(item => ({
                ...item,
                currency: item.currency || activeInvoice.currency,
                exchangeRate: item.exchangeRate || activeInvoice.exchangeRate,
                rate: item.rate
            })));
        }
    }, [activeInvoice]);

    const handleItemChange = (itemId: string, field: keyof SalesInvoiceItem, value: any) => {
        setEditItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const updated = { ...item, [field]: value };
                
                // If currency changes, update exchange rate default
                if (field === 'currency') {
                    updated.exchangeRate = EXCHANGE_RATES[value as Currency] || 1;
                }
                
                // Recalculate Total
                if (field === 'rate' || field === 'qty') {
                    updated.total = updated.qty * updated.rate;
                }
                
                return updated;
            }
            return item;
        }));
    };

    const handlePost = () => {
        if (!activeInvoice) return;
        
        // Validate
        if (editItems.some(i => i.rate <= 0)) {
            alert("All items must have a valid selling rate greater than 0.");
            return;
        }

        // Calculate new totals based on edits
        const newGrossTotal = editItems.reduce((sum, item) => sum + item.total, 0);
        
        // Convert Additional Costs to Invoice Currency for display Net Total consistency
        // Note: The ledger logic uses the raw cost objects, so this net total is mostly for the document record
        const costsTotal = activeInvoice.additionalCosts.reduce((s, c) => s + (c.amount * (c.exchangeRate / activeInvoice.exchangeRate)), 0); 
        const newNetTotal = newGrossTotal - activeInvoice.discount + activeInvoice.surcharge + costsTotal;

        const finalizedInvoice: SalesInvoice = {
            ...activeInvoice,
            items: editItems,
            grossTotal: newGrossTotal,
            netTotal: newNetTotal
        };

        if (window.confirm(`Are you sure you want to Post Invoice ${activeInvoice.invoiceNo}? This will update the General Ledger and Stock.`)) {
            postSalesInvoice(finalizedInvoice);
            setSelectedInvoiceId(null);
        }
    };

    if (selectedInvoiceId && activeInvoice) {
        // --- DETAIL VIEW ---
        return (
            <div className="max-w-5xl mx-auto animate-in slide-in-from-right duration-300">
                <div className="flex items-center gap-4 mb-6">
                    <button 
                        onClick={() => setSelectedInvoiceId(null)}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            Post Invoice: {activeInvoice.invoiceNo}
                        </h2>
                        <p className="text-slate-500 text-sm">Review rates and finalize financial posting</p>
                    </div>
                    <div className="ml-auto flex gap-3">
                         <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm text-slate-600 flex items-center gap-2">
                            <User size={16} /> {state.partners.find(p => p.id === activeInvoice.customerId)?.name}
                         </div>
                         <div className="bg-slate-100 px-4 py-2 rounded-lg text-sm text-slate-600 flex items-center gap-2">
                            <Calendar size={16} /> {activeInvoice.date}
                         </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700">Item Pricing & Currency</h3>
                        <div className="text-xs text-slate-500 bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Status: Unposted Draft
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3">Item Details</th>
                                    <th className="px-4 py-3 text-right">Qty</th>
                                    <th className="px-4 py-3 text-right">Pkg Size</th>
                                    <th className="px-4 py-3 text-right">Total Kg</th>
                                    <th className="px-4 py-3 w-32">Currency</th>
                                    <th className="px-4 py-3 w-24">Ex. Rate</th>
                                    <th className="px-4 py-3 w-32 text-right">Rate / Unit</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {editItems.map(item => {
                                    const itemDef = state.items.find(i => i.id === item.itemId);
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800">{item.itemName}</div>
                                                <div className="text-xs text-slate-500">{itemDef?.category}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600 font-mono">{item.qty}</td>
                                            <td className="px-4 py-3 text-right text-slate-500">{itemDef?.weightPerUnit} kg</td>
                                            <td className="px-4 py-3 text-right text-slate-500">{(item.qty * (itemDef?.weightPerUnit || 0)).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <select 
                                                    value={item.currency} 
                                                    onChange={(e) => handleItemChange(item.id, 'currency', e.target.value)}
                                                    className="w-full p-1 border border-slate-300 rounded text-xs bg-white text-slate-800"
                                                >
                                                    {Object.keys(EXCHANGE_RATES).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input 
                                                    type="number" 
                                                    value={item.exchangeRate}
                                                    onChange={(e) => handleItemChange(item.id, 'exchangeRate', parseFloat(e.target.value))}
                                                    className="w-full p-1 border border-slate-300 rounded text-xs text-center bg-white text-slate-800"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <input 
                                                    type="number" 
                                                    value={item.rate}
                                                    onChange={(e) => handleItemChange(item.id, 'rate', parseFloat(e.target.value))}
                                                    className="w-full p-1 border border-blue-300 rounded text-sm text-right font-bold text-blue-700 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                                {item.total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Additional Costs Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase">Additional Costs (Review Only)</h4>
                        {activeInvoice.additionalCosts.length === 0 ? (
                            <div className="text-sm text-slate-400 italic">No additional costs added.</div>
                        ) : (
                            <div className="space-y-2">
                                {activeInvoice.additionalCosts.map(cost => (
                                    <div key={cost.id} className="flex justify-between text-sm bg-white p-2 rounded border border-slate-200">
                                        <span>{cost.costType}</span>
                                        <span className="font-mono">{cost.amount.toLocaleString()} {cost.currency}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                            * These costs will be credited to the respective agents upon posting.
                        </div>
                    </div>
                    
                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-6 flex flex-col justify-between">
                         <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-600">Sub Total:</span>
                                <span className="font-bold text-slate-800">{editItems.reduce((s, i) => s + i.total, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-600">Adjustments (Discount/Surcharge):</span>
                                <span className="font-mono text-slate-800">{(activeInvoice.surcharge - activeInvoice.discount).toLocaleString()}</span>
                            </div>
                             <div className="flex justify-between text-sm mb-4">
                                <span className="text-slate-600">Pass-through Costs (Approx):</span>
                                <span className="font-mono text-slate-800">
                                    {activeInvoice.additionalCosts.reduce((s, c) => s + (c.amount * (c.exchangeRate / activeInvoice.exchangeRate)), 0).toLocaleString(undefined, {maximumFractionDigits: 2})}
                                </span>
                            </div>
                            <div className="border-t border-blue-200 pt-4 flex justify-between items-center">
                                <span className="text-lg font-bold text-blue-900">Grand Total</span>
                                <span className="text-2xl font-mono font-bold text-blue-700">
                                     {(
                                         editItems.reduce((s, i) => s + i.total, 0) - 
                                         activeInvoice.discount + 
                                         activeInvoice.surcharge + 
                                         activeInvoice.additionalCosts.reduce((s, c) => s + (c.amount * (c.exchangeRate / activeInvoice.exchangeRate)), 0)
                                     ).toLocaleString(undefined, {maximumFractionDigits: 2})}
                                </span>
                            </div>
                         </div>
                         <button 
                            onClick={handlePost}
                            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={20} /> Save & Post Invoice
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- LIST VIEW ---
    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
                    <ClipboardCheck size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Posting Queue</h1>
                    <p className="text-slate-500">Review and finalize Sales Invoices to update the General Ledger</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Unposted Invoices ({unpostedInvoices.length})</h3>
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                        <AlertCircle size={14} /> Pending Review
                    </div>
                </div>
                
                {unpostedInvoices.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <CheckCircle size={48} className="mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-medium text-slate-600">All caught up!</h3>
                        <p>No unposted invoices found in the queue.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white text-slate-500 uppercase text-xs font-bold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Invoice #</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4 text-right">Net Amount</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {unpostedInvoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{inv.invoiceNo}</td>
                                    <td className="px-6 py-4 text-slate-600">{inv.date}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        {state.partners.find(p => p.id === inv.customerId)?.name}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono">
                                        {inv.netTotal.toLocaleString(undefined, {minimumFractionDigits: 2})} {inv.currency}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => setSelectedInvoiceId(inv.id)}
                                            className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-medium transition-colors text-xs uppercase tracking-wide"
                                        >
                                            Rates & Post
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};