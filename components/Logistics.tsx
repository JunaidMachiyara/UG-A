

import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { LogisticsEntry, PartnerType } from '../types';
import { Truck, AlertCircle, Save, X, Edit2, Bell, Filter, Download, Scale } from 'lucide-react';

export const LogisticsModule: React.FC = () => {
    const { state, saveLogisticsEntry } = useData();
    const [activeTab, setActiveTab] = useState<'tracking' | 'shortage'>('tracking');
    
    // Filters
    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterContainer, setFilterContainer] = useState('');

    // Inline Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<LogisticsEntry>>({});

    // 1. Merge & Prepare Data (The "Placeholder" Logic)
    const combinedLogisticsData = useMemo(() => {
        const rows: any[] = [];

        // Helper to find or create entry
        const getEntry = (purchaseId: string, type: 'ORIGINAL' | 'BUNDLE', container: string, defaultWeight: number) => {
            const existing = state.logisticsEntries.find(l => l.purchaseId === purchaseId && l.purchaseType === type);
            if (existing) return { ...existing, isPlaceholder: false };
            
            // Placeholder
            return {
                id: `TEMP-${purchaseId}`,
                purchaseId,
                purchaseType: type,
                containerNumber: container,
                status: 'In Transit',
                invoicedWeight: defaultWeight,
                receivedWeight: 0,
                shortageKg: 0,
                documentStatus: 'Pending',
                isPlaceholder: true
            } as LogisticsEntry & { isPlaceholder: boolean };
        };

        // A. Original Purchases
        state.purchases.filter(p => p.containerNumber).forEach(p => {
            const entry = getEntry(p.id, 'ORIGINAL', p.containerNumber!, p.weightPurchased);
            const supplier = state.partners.find(par => par.id === p.supplierId);
            const division = state.divisions.find(d => d.id === p.divisionId);
            
            rows.push({
                ...entry,
                batchNumber: p.batchNumber,
                purchaseDate: p.date,
                supplierName: supplier?.name || 'Unknown',
                divisionName: division?.name || '-',
                category: 'Original',
                origType: p.originalType,
                freightForwarderId: p.additionalCosts.find(c => c.costType === 'Freight')?.providerId // Guess FF from costs
            });
        });

        // B. Bundle Purchases
        state.bundlePurchases.filter(p => p.containerNumber).forEach(p => {
            // Approx weight from items if not stored
            const approxWeight = p.items.reduce((sum, item) => {
                 const itemDef = state.items.find(i => i.id === item.itemId);
                 return sum + (item.qty * (itemDef?.weightPerUnit || 0));
            }, 0);

            const entry = getEntry(p.id, 'BUNDLE', p.containerNumber!, approxWeight);
            const supplier = state.partners.find(par => par.id === p.supplierId);
            const division = state.divisions.find(d => d.id === p.divisionId);

            rows.push({
                ...entry,
                batchNumber: p.batchNumber,
                purchaseDate: p.date,
                supplierName: supplier?.name || 'Unknown',
                divisionName: division?.name || '-',
                category: 'Finished Goods',
                origType: 'Stock Lot',
                freightForwarderId: p.additionalCosts.find(c => c.costType === 'Freight')?.providerId
            });
        });

        return rows.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    }, [state.purchases, state.bundlePurchases, state.logisticsEntries, state.partners, state.divisions, state.items]);

    // Apply Filters
    const filteredRows = useMemo(() => {
        return combinedLogisticsData.filter(row => {
            if (filterSupplier && row.supplierName !== filterSupplier) return false;
            if (filterStatus && row.status !== filterStatus) return false;
            if (filterContainer && !row.containerNumber.toLowerCase().includes(filterContainer.toLowerCase())) return false;
            return true;
        });
    }, [combinedLogisticsData, filterSupplier, filterStatus, filterContainer]);

    // Notifications Logic
    const notifications = useMemo(() => {
        const alerts: string[] = [];
        const today = new Date();
        
        combinedLogisticsData.forEach(row => {
            if (row.status === 'Cleared') return;
            
            if (row.eta) {
                const etaDate = new Date(row.eta);
                const diffTime = etaDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 2) {
                    alerts.push(`Container ${row.containerNumber} ETA is in ${diffDays} days.`);
                }
            }
            if (row.etd) {
                const etdDate = new Date(row.etd);
                const diffTime = etdDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 2) {
                    alerts.push(`Container ${row.containerNumber} ETD is in ${diffDays} days.`);
                }
            }
        });
        return alerts;
    }, [combinedLogisticsData]);

    // Handlers
    const handleEditClick = (row: any) => {
        setEditingId(row.id);
        setEditFormData({ ...row });
    };

    const handleEditChange = (field: keyof LogisticsEntry, value: any) => {
        setEditFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        if (!editingId) return;
        
        // If ID starts with TEMP, it's a new entry. Generate real ID.
        const isNew = editingId.startsWith('TEMP');
        const finalId = isNew ? Math.random().toString(36).substr(2, 9) : editingId;
        
        // Ensure mandatory fields from original row are preserved if not in form data
        // We need to merge `editFormData` back into the original structure properly
        // Note: `editFormData` might be incomplete if we only changed one field
        
        // Find original row to get mandatory immutable fields like purchaseId
        const originalRow = combinedLogisticsData.find(r => r.id === editingId);
        if (!originalRow) return;

        const entryToSave: LogisticsEntry = {
            id: finalId,
            purchaseId: originalRow.purchaseId,
            purchaseType: originalRow.purchaseType,
            containerNumber: originalRow.containerNumber,
            status: editFormData.status || originalRow.status,
            invoicedWeight: originalRow.invoicedWeight,
            receivedWeight: editFormData.receivedWeight !== undefined ? Number(editFormData.receivedWeight) : originalRow.receivedWeight,
            shortageKg: (originalRow.invoicedWeight - (editFormData.receivedWeight !== undefined ? Number(editFormData.receivedWeight) : originalRow.receivedWeight)),
            
            etd: editFormData.etd || originalRow.etd,
            eta: editFormData.eta || originalRow.eta,
            portStorage: editFormData.portStorage || originalRow.portStorage,
            doValidation: editFormData.doValidation || originalRow.doValidation,
            groundDate: editFormData.groundDate || originalRow.groundDate,
            arrivalDate: editFormData.arrivalDate || originalRow.arrivalDate,
            
            warehouseId: editFormData.warehouseId || originalRow.warehouseId,
            documentStatus: editFormData.documentStatus || originalRow.documentStatus,
            freightForwarderId: editFormData.freightForwarderId || originalRow.freightForwarderId,
            clearingAgentId: editFormData.clearingAgentId || originalRow.clearingAgentId,
            clearingBillNo: editFormData.clearingBillNo || originalRow.clearingBillNo,
            clearingAmount: editFormData.clearingAmount !== undefined ? Number(editFormData.clearingAmount) : originalRow.clearingAmount,
            
            tallyItems: originalRow.tallyItems // Preserve tally items if any
        };

        saveLogisticsEntry(entryToSave);
        setEditingId(null);
        setEditFormData({});
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><Truck size={24} /></div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Logistics & Shipment Tracking</h1>
                        <p className="text-sm text-slate-500">{filteredRows.length} active shipments</p>
                    </div>
                </div>
                
                {/* Filters & Actions */}
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                            <Bell size={20} />
                            {notifications.length > 0 && (
                                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">{notifications.length}</span>
                            )}
                        </button>
                        {notifications.length > 0 && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-50 hidden group-hover:block">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Alerts</h4>
                                <ul className="space-y-2">
                                    {notifications.map((n, i) => <li key={i} className="text-sm text-slate-700 bg-red-50 p-2 rounded border border-red-100 flex gap-2"><AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" /> {n}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                    
                    <div className="h-8 w-px bg-slate-300 mx-2"></div>
                    
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button onClick={() => setActiveTab('tracking')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'tracking' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Tracking Table</button>
                        <button onClick={() => setActiveTab('shortage')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'shortage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Shortage Report</button>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-50 border-b border-slate-200 p-3 grid grid-cols-4 gap-4 shrink-0 text-sm">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <select className="bg-white border border-slate-300 rounded px-2 py-1 w-full" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
                        <option value="">All Suppliers</option>
                        {Array.from(new Set(combinedLogisticsData.map(r => r.supplierName))).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div><select className="bg-white border border-slate-300 rounded px-2 py-1 w-full" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">All Statuses</option><option value="In Transit">In Transit</option><option value="Arrived">Arrived</option><option value="Cleared">Cleared</option></select></div>
                <div><input type="text" placeholder="Search Container..." className="bg-white border border-slate-300 rounded px-2 py-1 w-full" value={filterContainer} onChange={e => setFilterContainer(e.target.value)} /></div>
                <div className="flex justify-end"><button className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 text-xs font-medium"><Download size={14}/> Export CSV</button></div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-auto bg-white">
                {activeTab === 'tracking' ? (
                    <div className="inline-block min-w-full align-middle">
                        <table className="min-w-full border-collapse text-xs">
                            <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    {['S.No', 'Batch #', 'Load Date', 'Supplier', 'Division', 'Container #', 'Category', 'Inv. Wt', 'Status', 'ETD', 'ETA', 'Port Storage', 'D/o VLD', 'Ground', 'Unload', 'Rec. Wt', 'Warehouse', 'F.FDR', 'Docs', 'C. Agent', 'Clear. Bill', 'Action'].map((h, i) => (
                                        <th key={i} className="border border-slate-300 px-2 py-2 text-left font-bold whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredRows.map((row, idx) => {
                                    const isEditing = editingId === row.id;
                                    return (
                                        <tr key={row.id} className={`${isEditing ? 'bg-yellow-50' : 'hover:bg-slate-50'} transition-colors`}>
                                            <td className="border border-slate-300 px-2 py-1 text-center text-slate-500">{idx + 1}</td>
                                            <td className="border border-slate-300 px-2 py-1 font-mono font-medium">{row.batchNumber}</td>
                                            <td className="border border-slate-300 px-2 py-1 whitespace-nowrap">{row.purchaseDate}</td>
                                            <td className="border border-slate-300 px-2 py-1 max-w-[120px] truncate" title={row.supplierName}>{row.supplierName}</td>
                                            <td className="border border-slate-300 px-2 py-1 max-w-[80px] truncate">{row.divisionName}</td>
                                            <td className="border border-slate-300 px-2 py-1 font-bold text-slate-700">{row.containerNumber}</td>
                                            <td className="border border-slate-300 px-2 py-1">{row.category}</td>
                                            <td className="border border-slate-300 px-2 py-1 text-right font-mono">{row.invoicedWeight.toLocaleString()}</td>
                                            
                                            {/* Editable Fields */}
                                            <td className="border border-slate-300 px-1 py-1">
                                                {isEditing ? (
                                                    <select className="w-24 border border-slate-300 rounded text-xs p-1 bg-white text-slate-800" value={editFormData.status || row.status} onChange={e => handleEditChange('status', e.target.value)}>
                                                        <option value="In Transit">In Transit</option><option value="Arrived">Arrived</option><option value="Cleared">Cleared</option>
                                                    </select>
                                                ) : <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${row.status==='Arrived'?'bg-emerald-100 text-emerald-700':row.status==='Cleared'?'bg-gray-100 text-gray-600':'bg-blue-100 text-blue-700'}`}>{row.status}</span>}
                                            </td>
                                            
                                            {['etd', 'eta', 'portStorage', 'doValidation', 'groundDate', 'arrivalDate'].map(field => (
                                                <td key={field} className="border border-slate-300 px-1 py-1">
                                                    {isEditing ? <input type="date" className="w-24 border border-slate-300 rounded text-xs p-1 bg-white text-slate-800" value={editFormData[field as keyof LogisticsEntry] as string || ''} onChange={e => handleEditChange(field as keyof LogisticsEntry, e.target.value)} /> : row[field as keyof LogisticsEntry] || '-'}
                                                </td>
                                            ))}

                                            <td className="border border-slate-300 px-1 py-1 text-right">
                                                {isEditing ? <input type="number" className="w-20 border border-slate-300 rounded text-xs p-1 text-right bg-white text-slate-800" value={editFormData.receivedWeight ?? row.receivedWeight} onChange={e => handleEditChange('receivedWeight', e.target.value)} /> : (row.receivedWeight || '-')}
                                            </td>

                                            <td className="border border-slate-300 px-1 py-1">
                                                {isEditing ? (
                                                    <select className="w-32 border border-slate-300 rounded text-xs p-1 bg-white text-slate-800" value={editFormData.warehouseId || row.warehouseId || ''} onChange={e => handleEditChange('warehouseId', e.target.value)}>
                                                        <option value="">Select...</option>
                                                        {state.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                    </select>
                                                ) : state.warehouses.find(w => w.id === row.warehouseId)?.name || '-'}
                                            </td>

                                            <td className="border border-slate-300 px-1 py-1">
                                                {isEditing ? (
                                                    <select className="w-32 border border-slate-300 rounded text-xs p-1 bg-white text-slate-800" value={editFormData.freightForwarderId || row.freightForwarderId || ''} onChange={e => handleEditChange('freightForwarderId', e.target.value)}>
                                                        <option value="">Select...</option>
                                                        {state.partners.filter(p=>p.type===PartnerType.FREIGHT_FORWARDER).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                ) : state.partners.find(p => p.id === row.freightForwarderId)?.name || '-'}
                                            </td>

                                            <td className="border border-slate-300 px-1 py-1">
                                                {isEditing ? (
                                                    <select className="w-24 border border-slate-300 rounded text-xs p-1 bg-white text-slate-800" value={editFormData.documentStatus || row.documentStatus || 'Pending'} onChange={e => handleEditChange('documentStatus', e.target.value)}>
                                                        <option value="Pending">Pending</option><option value="Submitted">Submitted</option><option value="Received">Received</option>
                                                    </select>
                                                ) : <span className={`text-[10px] font-bold ${row.documentStatus==='Received'?'text-emerald-600':'text-orange-500'}`}>{row.documentStatus || 'Pending'}</span>}
                                            </td>

                                            <td className="border border-slate-300 px-1 py-1">
                                                {isEditing ? (
                                                    <select className="w-32 border border-slate-300 rounded text-xs p-1 bg-white text-slate-800" value={editFormData.clearingAgentId || row.clearingAgentId || ''} onChange={e => handleEditChange('clearingAgentId', e.target.value)}>
                                                        <option value="">Select...</option>
                                                        {state.partners.filter(p=>p.type===PartnerType.CLEARING_AGENT).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                ) : state.partners.find(p => p.id === row.clearingAgentId)?.name || '-'}
                                            </td>

                                            <td className="border border-slate-300 px-1 py-1 text-right">
                                                {isEditing ? <input type="number" className="w-20 border border-slate-300 rounded text-xs p-1 text-right bg-white text-slate-800" placeholder="Bill Amt" value={editFormData.clearingAmount ?? row.clearingAmount} onChange={e => handleEditChange('clearingAmount', e.target.value)} /> : (row.clearingAmount ? row.clearingAmount.toLocaleString() : '-')}
                                            </td>

                                            <td className="border border-slate-300 px-2 py-1 text-center">
                                                {isEditing ? (
                                                    <div className="flex gap-1 justify-center">
                                                        <button onClick={handleSave} className="bg-emerald-500 text-white p-1 rounded hover:bg-emerald-600"><Save size={14} /></button>
                                                        <button onClick={() => setEditingId(null)} className="bg-slate-300 text-slate-600 p-1 rounded hover:bg-slate-400"><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => handleEditClick(row)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><Edit2 size={14} /></button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-6 max-w-5xl mx-auto">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Scale size={20} className="text-red-500" /> Shortage & Excess Report
                        </h3>
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Container / Batch</th>
                                        <th className="px-6 py-4">Supplier</th>
                                        <th className="px-6 py-4 text-right">Invoiced (Kg)</th>
                                        <th className="px-6 py-4 text-right">Received (Kg)</th>
                                        <th className="px-6 py-4 text-right">Difference</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredRows.filter(r => r.status === 'Arrived' || r.status === 'Cleared').map(row => {
                                        const diff = row.receivedWeight - row.invoicedWeight;
                                        const isShortage = diff < 0;
                                        return (
                                            <tr key={row.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-700">{row.containerNumber}</div>
                                                    <div className="text-xs text-slate-500">Batch: {row.batchNumber}</div>
                                                </td>
                                                <td className="px-6 py-4">{row.supplierName}</td>
                                                <td className="px-6 py-4 text-right font-mono text-slate-500">{row.invoicedWeight.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right font-mono font-bold">{row.receivedWeight.toLocaleString()}</td>
                                                <td className={`px-6 py-4 text-right font-bold font-mono ${isShortage ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {diff > 0 ? '+' : ''}{diff.toLocaleString()} Kg
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${isShortage ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {isShortage ? 'SHORTAGE' : 'EXCESS'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {filteredRows.filter(r => r.status === 'Arrived' || r.status === 'Cleared').length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-8 text-slate-400">No arrived containers found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};