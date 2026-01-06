import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Item } from '../types';
import { Database, Plus, Edit, Trash2, Download, Upload, Search, CheckCircle, XCircle } from 'lucide-react';
import Papa from 'papaparse';

const CENTRAL_FACTORY_ID = 'CENTRAL';

export const CentralItemDatabase: React.FC = () => {
    const { state } = useData();
    const { currentFactory, factories } = useAuth();
    const [centralItems, setCentralItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [importing, setImporting] = useState(false);
    const [selectedFactoryId, setSelectedFactoryId] = useState<string>('');

    // Form state
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        category: '',
        section: '',
        packingType: 'Kg' as const,
        weightPerUnit: 0,
        salePrice: 0
    });

    // Load central items
    useEffect(() => {
        loadCentralItems();
    }, []);

    const loadCentralItems = async () => {
        try {
            setLoading(true);
            const itemsQuery = query(
                collection(db, 'items'),
                where('factoryId', '==', CENTRAL_FACTORY_ID)
            );
            const snapshot = await getDocs(itemsQuery);
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Item));
            setCentralItems(items);
        } catch (error) {
            console.error('Error loading central items:', error);
            alert('Error loading central items');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.code) {
            alert('Name and Code are required');
            return;
        }

        try {
            if (editingItem) {
                // Update existing
                const itemRef = doc(db, 'items', editingItem.id);
                await updateDoc(itemRef, {
                    ...formData,
                    updatedAt: serverTimestamp()
                });
                alert('Item updated successfully');
            } else {
                // Create new
                // Check for duplicate code
                const duplicate = centralItems.find(item => item.code === formData.code);
                if (duplicate) {
                    alert(`Item with code "${formData.code}" already exists in Central Database`);
                    return;
                }

                await addDoc(collection(db, 'items'), {
                    ...formData,
                    factoryId: CENTRAL_FACTORY_ID,
                    stockQty: 0,
                    avgCost: 0,
                    nextSerial: 1,
                    createdAt: serverTimestamp()
                });
                alert('Item added to Central Database successfully');
            }
            
            setShowAddModal(false);
            setEditingItem(null);
            resetForm();
            loadCentralItems();
        } catch (error: any) {
            console.error('Error saving item:', error);
            alert(`Error saving item: ${error.message}`);
        }
    };

    const handleDelete = async (item: Item) => {
        if (!confirm(`Are you sure you want to delete "${item.name}" (${item.code}) from Central Database?`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'items', item.id));
            alert('Item deleted successfully');
            loadCentralItems();
        } catch (error: any) {
            console.error('Error deleting item:', error);
            alert(`Error deleting item: ${error.message}`);
        }
    };

    const handleEdit = (item: Item) => {
        setEditingItem(item);
        setFormData({
            code: item.code,
            name: item.name,
            category: item.category || '',
            section: item.section || '',
            packingType: item.packingType,
            weightPerUnit: item.weightPerUnit || 0,
            salePrice: item.salePrice || 0
        });
        setShowAddModal(true);
    };

    const handleImportToFactory = async () => {
        if (!selectedFactoryId) {
            alert('Please select a factory to import items to');
            return;
        }

        if (centralItems.length === 0) {
            alert('No items in Central Database to import');
            return;
        }

        if (!confirm(`Import ${centralItems.length} item(s) from Central Database to selected factory?\n\nThis will create factory-specific copies with stock = 0.`)) {
            return;
        }

        try {
            setImporting(true);
            const BATCH_SIZE = 500;
            let imported = 0;
            let skipped = 0;

            // Get existing items for the factory
            const factoryItemsQuery = query(
                collection(db, 'items'),
                where('factoryId', '==', selectedFactoryId)
            );
            const factoryItemsSnapshot = await getDocs(factoryItemsQuery);
            const existingCodes = new Set<string>();
            factoryItemsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.code) {
                    existingCodes.add(data.code);
                }
            });

            // Import in batches
            for (let i = 0; i < centralItems.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const batchItems = centralItems.slice(i, i + BATCH_SIZE);
                let batchCount = 0;

                for (const centralItem of batchItems) {
                    if (existingCodes.has(centralItem.code)) {
                        skipped++;
                        continue;
                    }

                    const itemRef = doc(collection(db, 'items'));
                    batch.set(itemRef, {
                        code: centralItem.code,
                        name: centralItem.name,
                        category: centralItem.category || '',
                        section: centralItem.section || '',
                        packingType: centralItem.packingType,
                        weightPerUnit: centralItem.weightPerUnit || 0,
                        salePrice: centralItem.salePrice || 0,
                        stockQty: 0,
                        avgCost: 0,
                        nextSerial: 1,
                        factoryId: selectedFactoryId,
                        createdAt: serverTimestamp()
                    });
                    batchCount++;
                    imported++;
                }

                if (batchCount > 0) {
                    await batch.commit();
                }
            }

            alert(`✅ Imported ${imported} item(s) to factory.\n${skipped > 0 ? `⚠️ ${skipped} item(s) skipped (already exist).` : ''}`);
            setImporting(false);
        } catch (error: any) {
            console.error('Error importing items:', error);
            alert(`Error importing items: ${error.message}`);
            setImporting(false);
        }
    };

    const handleExportCSV = () => {
        const csvData = centralItems.map(item => ({
            id: item.code,
            code: item.code,
            name: item.name,
            category: item.category || '',
            section: item.section || '',
            packingType: item.packingType,
            weightPerUnit: item.weightPerUnit || 0,
            salePrice: item.salePrice || 0,
            avgCost: 0,
            stockQty: 0,
            openingStock: 0
        }));

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `central_items_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const BATCH_SIZE = 500;
                    let imported = 0;
                    let skipped = 0;

                    // Get existing codes
                    const existingCodes = new Set(centralItems.map(item => item.code));

                    for (let i = 0; i < results.data.length; i += BATCH_SIZE) {
                        const batch = writeBatch(db);
                        const batchData = results.data.slice(i, i + BATCH_SIZE);
                        let batchCount = 0;

                        for (const row of batchData as any[]) {
                            if (!row.name || !row.code) continue;
                            
                            if (existingCodes.has(row.code)) {
                                skipped++;
                                continue;
                            }

                            const itemRef = doc(collection(db, 'items'));
                            batch.set(itemRef, {
                                code: row.code,
                                name: row.name,
                                category: row.category || '',
                                section: row.section || '',
                                packingType: row.packingType || 'Kg',
                                weightPerUnit: parseFloat(row.weightPerUnit) || 0,
                                salePrice: parseFloat(row.salePrice) || 0,
                                stockQty: 0,
                                avgCost: 0,
                                nextSerial: 1,
                                factoryId: CENTRAL_FACTORY_ID,
                                createdAt: serverTimestamp()
                            });
                            batchCount++;
                            imported++;
                            existingCodes.add(row.code);
                        }

                        if (batchCount > 0) {
                            await batch.commit();
                        }
                    }

                    alert(`✅ Imported ${imported} item(s) to Central Database.\n${skipped > 0 ? `⚠️ ${skipped} item(s) skipped (already exist).` : ''}`);
                    loadCentralItems();
                } catch (error: any) {
                    alert(`Error importing CSV: ${error.message}`);
                }
            },
            error: (error) => {
                alert(`Error parsing CSV: ${error.message}`);
            }
        });
    };

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            category: '',
            section: '',
            packingType: 'Kg',
            weightPerUnit: 0,
            salePrice: 0
        });
    };

    const filteredItems = centralItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const validCategories = state.categories || [];
    const validSections = state.sections || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                    <Database size={32} />
                    <h2 className="text-2xl font-bold">Central Item Database</h2>
                </div>
                <p className="text-purple-100">Shared item catalog accessible by all factories</p>
            </div>

            {/* Actions Bar */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setEditingItem(null);
                        setShowAddModal(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-semibold"
                >
                    <Plus size={18} />
                    Add Item
                </button>
                <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-semibold"
                >
                    <Download size={18} />
                    Export CSV
                </button>
                <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold cursor-pointer">
                    <Upload size={18} />
                    Import CSV
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleImportCSV}
                        className="hidden"
                    />
                </label>
            </div>

            {/* Import to Factory Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-3">Import to Factory</h3>
                <div className="flex flex-wrap items-center gap-4">
                    <select
                        value={selectedFactoryId}
                        onChange={(e) => setSelectedFactoryId(e.target.value)}
                        className="px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">-- Select Factory --</option>
                        {factories.map(factory => (
                            <option key={factory.id} value={factory.id}>
                                {factory.name} ({factory.code})
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleImportToFactory}
                        disabled={!selectedFactoryId || importing || centralItems.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                    >
                        {importing ? 'Importing...' : 'Import All to Factory'}
                    </button>
                    <span className="text-sm text-blue-700">
                        {centralItems.length} item(s) in Central Database
                    </span>
                </div>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Code</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Section</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Packing</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Weight/Unit</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Sale Price</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                        Loading...
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                        {searchTerm ? 'No items found matching your search' : 'No items in Central Database'}
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{item.code}</td>
                                        <td className="px-4 py-3 text-sm text-slate-900">{item.name}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{item.category || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{item.section || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{item.packingType}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{item.weightPerUnit || 0} kg</td>
                                        <td className="px-4 py-3 text-sm text-slate-600">${item.salePrice || 0}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Edit"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingItem ? 'Edit Item' : 'Add Item to Central Database'}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingItem(null);
                                    resetForm();
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Code *</label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        disabled={!!editingItem}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="">-- Select Category --</option>
                                        {validCategories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Section</label>
                                    <select
                                        value={formData.section}
                                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="">-- Select Section --</option>
                                        {validSections.map(sec => (
                                            <option key={sec.id} value={sec.id}>{sec.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Packing Type</label>
                                    <select
                                        value={formData.packingType}
                                        onChange={(e) => setFormData({ ...formData, packingType: e.target.value as any })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        <option value="Kg">Kg</option>
                                        <option value="Bale">Bale</option>
                                        <option value="Sack">Sack</option>
                                        <option value="Box">Box</option>
                                        <option value="Bag">Bag</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Weight per Unit (kg)</label>
                                    <input
                                        type="number"
                                        value={formData.weightPerUnit}
                                        onChange={(e) => setFormData({ ...formData, weightPerUnit: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Sale Price (USD)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.salePrice}
                                        onChange={(e) => setFormData({ ...formData, salePrice: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingItem(null);
                                    resetForm();
                                }}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                            >
                                {editingItem ? 'Update' : 'Add'} Item
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};



