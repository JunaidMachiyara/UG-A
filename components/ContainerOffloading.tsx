
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { EntitySelector } from './EntitySelector';
import { LogisticsEntry, Purchase, BundlePurchase, ProductionEntry, PackingType } from '../types';
import { Container, Truck, CheckCircle, Scale, Building, Plus, X } from 'lucide-react';

export const ContainerOffloading: React.FC = () => {
    const { state, saveLogisticsEntry, addProduction } = useData();

    // Filters
    const [filterStatus, setFilterStatus] = useState<'In Transit' | 'Arrived' | 'Cleared'>('In Transit');
    const [filterSupplier, setFilterSupplier] = useState('');
    const [selectedContainerId, setSelectedContainerId] = useState(''); // This mimics the ID of a LogisticsEntry (real or placeholder)
    
    // Form State
    const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().split('T')[0]);
    const [warehouseId, setWarehouseId] = useState('');
    
    // Original Purchase Inputs
    const [receivedWeight, setReceivedWeight] = useState('');
    
    // Bundle Purchase Tally Inputs
    const [tallyItemId, setTallyItemId] = useState('');
    const [tallyQty, setTallyQty] = useState('');
    const [tallyList, setTallyList] = useState<{ id: string, itemId: string, qty: number, weight: number }[]>([]);

    // Initialize Warehouse if default exists
    useEffect(() => {
        if (state.warehouses.length > 0 && !warehouseId) {
            setWarehouseId(state.warehouses[0].id);
        }
    }, [state.warehouses]);

    // --- Derived Data Logic ---
    
    // Flatten Purchases and BundlePurchases into a unified "Shipment" list
    // Check if a LogisticsEntry already exists for them. If so, use it. If not, create a placeholder.
    const allShipments = useMemo(() => {
        const shipments: LogisticsEntry[] = [];

        // Debug: Log all purchases to see which ones have container numbers
        if (process.env.NODE_ENV === 'development') {
            console.log('📦 All Purchases:', state.purchases.map(p => ({
                id: p.id,
                batchNumber: p.batchNumber,
                containerNumber: p.containerNumber,
                status: p.status,
                supplierId: p.supplierId
            })));
        }

        // 1. Process Original Purchases
        state.purchases.forEach(p => {
            // Skip purchases without container number (empty string, null, or undefined)
            const containerNum = p.containerNumber?.trim() || '';
            if (!containerNum || containerNum === '') {
                if (process.env.NODE_ENV === 'development') {
                    console.log('⏭️ Skipping purchase without container:', p.batchNumber, p.id);
                }
                return;
            }
            const existingEntry = state.logisticsEntries.find(le => le.purchaseId === p.id && le.purchaseType === 'ORIGINAL');
            
            if (existingEntry) {
                shipments.push(existingEntry);
            } else {
                // Placeholder - use purchase status if available, otherwise default to 'In Transit'
                // For opening stock purchases, status should be 'Arrived' or 'Cleared'
                const purchaseStatus = p.status || 'In Transit';
                const logisticsStatus = (purchaseStatus === 'Arrived' || purchaseStatus === 'Cleared') 
                    ? purchaseStatus 
                    : 'In Transit';
                
                shipments.push({
                    id: `PLACEHOLDER-ORIG-${p.id}`,
                    purchaseId: p.id,
                    purchaseType: 'ORIGINAL',
                    containerNumber: p.containerNumber,
                    status: logisticsStatus,
                    invoicedWeight: p.weightPurchased,
                    receivedWeight: (purchaseStatus === 'Arrived' || purchaseStatus === 'Cleared') ? p.weightPurchased : 0,
                    shortageKg: 0
                });
            }
        });

        // 2. Process Bundle Purchases
        state.bundlePurchases.forEach(p => {
             // Skip purchases without container number (empty string, null, or undefined)
             if (!p.containerNumber || p.containerNumber.trim() === '') return;
             const existingEntry = state.logisticsEntries.find(le => le.purchaseId === p.id && le.purchaseType === 'BUNDLE');
             
             if (existingEntry) {
                 shipments.push(existingEntry);
             } else {
                 // Placeholder - use purchase status if available, otherwise default to 'In Transit'
                 // For opening stock purchases, status should be 'Arrived' or 'Cleared'
                 const purchaseStatus = p.status || 'In Transit';
                 const logisticsStatus = (purchaseStatus === 'Arrived' || purchaseStatus === 'Cleared') 
                     ? purchaseStatus 
                     : 'In Transit';
                 
                 // For Bundles, Invoiced Weight is sum of item weights (approx) or 0 if not tracked by weight on purchase
                 // Let's assume calculated from items for now
                 const approxWeight = p.items.reduce((sum, item) => {
                     const itemDef = state.items.find(i => i.id === item.itemId);
                     return sum + (item.qty * (itemDef?.weightPerUnit || 0));
                 }, 0);

                 shipments.push({
                    id: `PLACEHOLDER-BUN-${p.id}`,
                    purchaseId: p.id,
                    purchaseType: 'BUNDLE',
                    containerNumber: p.containerNumber,
                    status: logisticsStatus,
                    invoicedWeight: approxWeight,
                    receivedWeight: (purchaseStatus === 'Arrived' || purchaseStatus === 'Cleared') ? approxWeight : 0,
                    shortageKg: 0
                });
             }
        });

        return shipments;
    }, [state.purchases, state.bundlePurchases, state.logisticsEntries, state.items]);

    // Apply Filters
    const filteredShipments = useMemo(() => {
        const filtered = allShipments.filter(s => {
            // Status filter
            if (s.status !== filterStatus) return false;
            
            // Filter by Supplier (need to lookup supplier ID from purchase)
            if (filterSupplier) {
                let supplierId = '';
                if (s.purchaseType === 'ORIGINAL') {
                    const purchase = state.purchases.find(p => p.id === s.purchaseId);
                    supplierId = purchase?.supplierId || '';
                } else {
                    const bundlePurchase = state.bundlePurchases.find(p => p.id === s.purchaseId);
                    supplierId = bundlePurchase?.supplierId || '';
                }
                if (supplierId !== filterSupplier) return false;
            }
            return true;
        });
        
        // Debug logging (only in development)
        if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Container Offloading Filter Debug:', {
                totalShipments: allShipments.length,
                filterStatus,
                filterSupplier,
                filteredCount: filtered.length,
                allShipments: allShipments.map(s => ({
                    id: s.id,
                    containerNumber: s.containerNumber,
                    status: s.status,
                    purchaseId: s.purchaseId
                }))
            });
        }
        
        return filtered;
    }, [allShipments, filterStatus, filterSupplier, state.purchases, state.bundlePurchases]);

    // Active Shipment Data
    const activeShipment = useMemo(() => allShipments.find(s => s.id === selectedContainerId), [allShipments, selectedContainerId]);
    
    const activePurchaseDetails = useMemo(() => {
        if (!activeShipment) return null;
        if (activeShipment.purchaseType === 'ORIGINAL') {
            const p = state.purchases.find(x => x.id === activeShipment.purchaseId);
            return {
                supplierName: state.partners.find(par => par.id === p?.supplierId)?.name,
                division: state.divisions.find(d => d.id === p?.divisionId)?.name,
                subDivision: state.subDivisions.find(d => d.id === p?.subDivisionId)?.name,
                originalType: p?.originalType,
                batch: p?.batchNumber
            };
        } else {
            const p = state.bundlePurchases.find(x => x.id === activeShipment.purchaseId);
             return {
                supplierName: state.partners.find(par => par.id === p?.supplierId)?.name,
                division: state.divisions.find(d => d.id === p?.divisionId)?.name,
                subDivision: state.subDivisions.find(d => d.id === p?.subDivisionId)?.name,
                originalType: 'Bundle Purchase (Stock Lot)',
                batch: p?.batchNumber
            };
        }
    }, [activeShipment, state.purchases, state.bundlePurchases, state.partners, state.divisions, state.subDivisions]);

    // Populate form when selection changes
    useEffect(() => {
        if (activeShipment) {
            setWarehouseId(activeShipment.warehouseId || (state.warehouses.length > 0 ? state.warehouses[0].id : ''));
            if (activeShipment.receivedWeight > 0) setReceivedWeight(activeShipment.receivedWeight.toString());
            else setReceivedWeight('');
            
            if (activeShipment.tallyItems) {
                // Restore tally list if exists
                 const restoredList = activeShipment.tallyItems.map(ti => {
                     const itemDef = state.items.find(i => i.id === ti.itemId);
                     return {
                         id: Math.random().toString(),
                         itemId: ti.itemId,
                         qty: ti.qty,
                         weight: ti.weight
                     }
                 });
                 setTallyList(restoredList);
            } else {
                setTallyList([]);
            }
        }
    }, [selectedContainerId, activeShipment, state.items, state.warehouses]);


    // --- Handlers ---

    const handleAddTally = () => {
        if (!tallyItemId || !tallyQty) return;
        const itemDef = state.items.find(i => i.id === tallyItemId);
        if (!itemDef) return;
        
        const qty = parseFloat(tallyQty);
        setTallyList([...tallyList, {
            id: Math.random().toString(),
            itemId: tallyItemId,
            qty: qty,
            weight: qty * itemDef.weightPerUnit
        }]);
        setTallyItemId('');
        setTallyQty('');
    };

    const handleSave = async () => {
        if (!activeShipment) {
            alert('Please select a container to off-load.');
            return;
        }
        if (!warehouseId) {
            alert('Please select a warehouse destination.');
            return;
        }

        let finalReceivedWeight = 0;
        let finalTallyItems: any[] | undefined = undefined;

        if (activeShipment.purchaseType === 'ORIGINAL') {
            if (!receivedWeight || parseFloat(receivedWeight) <= 0) {
                alert('Please enter a valid received weight (must be greater than 0)');
                return;
            }
            finalReceivedWeight = parseFloat(receivedWeight);
        } else {
            // Bundle Purchase from Tally
            if (tallyList.length === 0) {
                alert('Please tally at least one item before finalizing.');
                return;
            }
            finalReceivedWeight = tallyList.reduce((acc, curr) => acc + curr.weight, 0);
            finalTallyItems = tallyList.map(t => ({ itemId: t.itemId, qty: t.qty, weight: t.weight }));
        }

        const shortage = activeShipment.invoicedWeight - finalReceivedWeight;

        // Construct the LogisticsEntry (If it was placeholder, we create new ID, else keep ID)
        const isPlaceholder = activeShipment.id.startsWith('PLACEHOLDER');
        
        const entry: LogisticsEntry = {
            id: isPlaceholder ? Math.random().toString(36).substr(2, 9) : activeShipment.id,
            purchaseId: activeShipment.purchaseId,
            purchaseType: activeShipment.purchaseType,
            containerNumber: activeShipment.containerNumber,
            arrivalDate: arrivalDate,
            status: 'Arrived',
            warehouseId: warehouseId,
            invoicedWeight: activeShipment.invoicedWeight,
            receivedWeight: finalReceivedWeight,
            shortageKg: shortage,
            tallyItems: finalTallyItems
        };

        // Inventory Logic: Create Production Entries if it is a Finished Goods Purchase
        if (activeShipment.purchaseType === 'BUNDLE') {
            const productionEntries: ProductionEntry[] = tallyList.map(t => {
                const item = state.items.find(i => i.id === t.itemId);
                return {
                    id: `PROD-OFF-${entry.id}-${t.itemId}-${Math.random().toString(36).substr(2, 5)}`,
                    date: arrivalDate,
                    itemId: t.itemId,
                    itemName: item?.name || 'Unknown',
                    packingType: item?.packingType || PackingType.KG,
                    qtyProduced: t.qty,
                    weightProduced: t.weight,
                    // Note: Off-loading does not usually trigger "new bale numbering" unless specifically requested, 
                    // assuming supplier bale numbers. If tracking internal, nextSerial would increment.
                    // Based on standard logic, stock increases.
                };
            });
            addProduction(productionEntries);
        }

        await saveLogisticsEntry(entry);
        alert('Container Off-loaded Successfully!');
        
        // Reset and refresh
        setSelectedContainerId('');
        setReceivedWeight('');
        setTallyList([]);
        setFilterStatus('In Transit'); // Reset filter to hide the just arrived item (refresh list)
    };

    // Calculate live shortage for UI display
    const currentReceived = activeShipment?.purchaseType === 'ORIGINAL' 
        ? parseFloat(receivedWeight || '0')
        : tallyList.reduce((acc, curr) => acc + curr.weight, 0);
        
    const shortageDiff = activeShipment ? currentReceived - activeShipment.invoicedWeight : 0;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Container size={24} /></div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Container Off-Loading</h2>
                        <p className="text-sm text-slate-500">Track arrivals and reconcile weights</p>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                     <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status Filter</label>
                        <select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                            <option value="In Transit">In Transit</option>
                            <option value="Arrived">Arrived</option>
                            <option value="Cleared">Cleared</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Supplier Filter</label>
                        <EntitySelector
                            entities={state.partners.filter(p => p.type === 'SUPPLIER')}
                            selectedId={filterSupplier}
                            onSelect={setFilterSupplier}
                            placeholder="All Suppliers"
                        />
                    </div>
                    <div className="md:col-span-2">
                         <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Container</label>
                         <EntitySelector
                            entities={filteredShipments.map(s => ({
                                id: s.id,
                                name: `${s.containerNumber} (${s.purchaseType === 'ORIGINAL' ? 'Original' : 'Bundle'})`
                            }))}
                            selectedId={selectedContainerId}
                            onSelect={setSelectedContainerId}
                            placeholder="Select Container..."
                        />
                    </div>
                </div>

                {activeShipment && activePurchaseDetails && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Details Panel */}
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div><div className="text-xs text-slate-400 uppercase font-bold">Supplier</div><div className="font-medium text-slate-700">{activePurchaseDetails.supplierName}</div></div>
                            <div><div className="text-xs text-slate-400 uppercase font-bold">Batch / Type</div><div className="font-medium text-slate-700">{activePurchaseDetails.batch} - {activePurchaseDetails.originalType}</div></div>
                            <div><div className="text-xs text-slate-400 uppercase font-bold">Division</div><div className="font-medium text-slate-700">{activePurchaseDetails.division || '-'} / {activePurchaseDetails.subDivision || '-'}</div></div>
                            <div><div className="text-xs text-slate-400 uppercase font-bold">Invoiced Weight</div><div className="font-mono text-lg font-bold text-slate-800">{activeShipment.invoicedWeight.toLocaleString()} Kg</div></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left: Operations Inputs */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-medium text-slate-600 mb-1">Arrival Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} /></div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1">Assign Warehouse</label>
                                        <EntitySelector
                                            entities={state.warehouses}
                                            selectedId={warehouseId}
                                            onSelect={setWarehouseId}
                                            placeholder="Select Warehouse..."
                                        />
                                    </div>
                                </div>

                                {activeShipment.purchaseType === 'ORIGINAL' ? (
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <label className="block text-sm font-bold text-blue-800 mb-2">Enter Received Weight (Kg)</label>
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="number" 
                                                className="flex-1 text-2xl font-bold p-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                                                placeholder="0.00"
                                                value={receivedWeight}
                                                onChange={e => setReceivedWeight(e.target.value)}
                                            />
                                            <Scale className="text-blue-400" size={32} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-slate-700 text-sm">Bundle Tally Sheet</div>
                                        <div className="p-4 space-y-4">
                                            <div className="flex gap-2">
                                                <div className="flex-1"><EntitySelector entities={state.items} selectedId={tallyItemId} onSelect={setTallyItemId} placeholder="Item..." /></div>
                                                <div className="w-24"><input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="Qty" value={tallyQty} onChange={e => setTallyQty(e.target.value)} /></div>
                                                <button onClick={handleAddTally} disabled={!tallyItemId || !tallyQty} className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700"><Plus size={18} /></button>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto space-y-1">
                                                {tallyList.map(t => (
                                                    <div key={t.id} className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded">
                                                        <span>{state.items.find(i=>i.id===t.itemId)?.name} x {t.qty}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-mono text-slate-500">{t.weight} kg</span>
                                                            <button onClick={() => setTallyList(tallyList.filter(x => x.id !== t.id))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {tallyList.length === 0 && <div className="text-center text-xs text-slate-400 italic">No items tallied</div>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: Summary & Action */}
                            <div className="flex flex-col justify-between bg-slate-50 rounded-xl border border-slate-200 p-6">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle className="text-emerald-500" /> Reconciliation</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Invoiced Weight:</span>
                                            <span className="font-mono font-medium">{activeShipment.invoicedWeight.toLocaleString()} Kg</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Received Weight:</span>
                                            <span className="font-mono font-bold text-blue-700">{currentReceived.toLocaleString()} Kg</span>
                                        </div>
                                        <div className={`flex justify-between text-lg border-t border-slate-200 pt-3 mt-2 font-bold ${shortageDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            <span>{shortageDiff >= 0 ? 'Excess:' : 'Shortage:'}</span>
                                            <span>{shortageDiff > 0 ? '+' : ''}{shortageDiff.toLocaleString()} Kg</span>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSave}
                                    className="w-full mt-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Truck size={20} /> Finalize Off-Loading
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
