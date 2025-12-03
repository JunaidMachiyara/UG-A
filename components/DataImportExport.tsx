import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Upload, Download, FileText, CheckCircle, AlertCircle, Database, X } from 'lucide-react';
import Papa from 'papaparse';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

type ImportableEntity = 
    | 'items' 
    | 'partners' 
    | 'accounts' 
    | 'originalTypes' 
    | 'categories' 
    | 'sections'
    | 'divisions'
    | 'subDivisions';

interface ImportResult {
    success: number;
    failed: number;
    errors: string[];
}

const CSV_TEMPLATES = {
    items: [
        ['id', 'name', 'category', 'section', 'packingType', 'weightPerUnit', 'avgCost', 'salePrice', 'stockQty', 'openingStock'],
        ['item-001', 'Cotton Yarn 20s', 'cat-raw', 'sec-a', 'Bales', '200', '2.50', '3.00', '1000', '1000']
    ],
    partners: [
        ['id', 'name', 'type', 'country', 'defaultCurrency', 'balance', 'divisionId', 'subDivisionId'],
        ['partner-001', 'ABC Textiles', 'CUSTOMER', 'USA', 'USD', '5000', 'div-1', 'subdiv-1']
    ],
    accounts: [
        ['id', 'name', 'type', 'balance', 'description'],
        ['acc-001', 'Office Rent', 'EXPENSE', '0', 'Monthly office rent expenses']
    ],
    originalTypes: [
        ['id', 'name', 'description'],
        ['ot-001', 'Raw Cotton', 'Unprocessed cotton material']
    ],
    categories: [
        ['id', 'name', 'description'],
        ['cat-001', 'Raw Materials', 'Unprocessed materials']
    ],
    sections: [
        ['id', 'name', 'description'],
        ['sec-001', 'Section A', 'Primary section']
    ],
    divisions: [
        ['id', 'name', 'description'],
        ['div-001', 'Sales Division', 'Main sales department']
    ],
    subDivisions: [
        ['id', 'name', 'divisionId', 'description'],
        ['subdiv-001', 'Export Sales', 'div-001', 'International sales']
    ]
};

export const DataImportExport: React.FC = () => {
    const { state, addItem, addPartner, addAccount } = useData();
    const { currentFactory } = useAuth();
    const [selectedEntity, setSelectedEntity] = useState<ImportableEntity>('items');
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const downloadTemplate = (entity: ImportableEntity) => {
        const template = CSV_TEMPLATES[entity];
        const csv = template.map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${entity}_template.csv`;
        a.click();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setParsedData(results.data);
                setShowPreview(true);
                setImportResult(null);
            },
            error: (error) => {
                alert(`Error parsing CSV: ${error.message}`);
            }
        });
    };

    const validateAndImport = async () => {
        if (parsedData.length === 0) {
            alert('No data to import');
            return;
        }

        setImporting(true);
        const errors: string[] = [];
        let successCount = 0;

        try {
            const batch = writeBatch(db);
            const collectionName = selectedEntity;

            if (!currentFactory) {
                alert('No factory selected. Please select a factory first.');
                setImporting(false);
                return;
            }

            parsedData.forEach((row: any, index: number) => {
                try {
                    // Basic validation
                    if (!row.id || !row.name) {
                        errors.push(`Row ${index + 1}: Missing required fields (id, name)`);
                        return;
                    }

                    // Entity-specific transformations
                    let document: any = { 
                        ...row,
                        factoryId: currentFactory.id // Add factoryId to all imports
                    };

                    if (selectedEntity === 'items') {
                        document = {
                            ...row,
                            weightPerUnit: parseFloat(row.weightPerUnit) || 0,
                            avgCost: parseFloat(row.avgCost) || 0,
                            salePrice: parseFloat(row.salePrice) || 0,
                            stockQty: parseFloat(row.stockQty) || 0,
                            openingStock: parseFloat(row.openingStock) || 0
                        };
                    } else if (selectedEntity === 'partners') {
                        document = {
                            ...row,
                            balance: parseFloat(row.balance) || 0
                        };
                    } else if (selectedEntity === 'accounts') {
                        document = {
                            ...row,
                            balance: parseFloat(row.balance) || 0
                        };
                    }

                    const docRef = doc(db, collectionName, row.id);
                    batch.set(docRef, document);
                    successCount++;
                } catch (err) {
                    errors.push(`Row ${index + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
            });

            if (successCount > 0) {
                await batch.commit();
                console.log(`✅ Successfully imported ${successCount} ${selectedEntity}`);
            }

            setImportResult({
                success: successCount,
                failed: errors.length,
                errors
            });

            // Refresh page to reload data from Firebase
            if (successCount > 0) {
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        } catch (error) {
            alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setImporting(false);
        }
    };

    const exportExisting = (entity: ImportableEntity) => {
        let data: any[] = [];
        
        switch (entity) {
            case 'items':
                data = state.items.map(item => ({
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    section: item.section,
                    packingType: item.packingType,
                    weightPerUnit: item.weightPerUnit,
                    avgCost: item.avgCost,
                    salePrice: item.salePrice || 0,
                    stockQty: item.stockQty,
                    openingStock: item.openingStock || 0
                }));
                break;
            case 'partners':
                data = state.partners.map(p => ({
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    country: p.country,
                    defaultCurrency: p.defaultCurrency,
                    balance: p.balance,
                    divisionId: p.divisionId || '',
                    subDivisionId: p.subDivisionId || ''
                }));
                break;
            case 'accounts':
                data = state.accounts.map(a => ({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    balance: a.balance,
                    description: a.description || ''
                }));
                break;
            default:
                alert('Export not implemented for this entity yet');
                return;
        }

        if (data.length === 0) {
            alert('No data to export');
            return;
        }

        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${entity}_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                    <Database size={32} />
                    <h2 className="text-2xl font-bold">Bulk Data Import/Export</h2>
                </div>
                <p className="text-purple-100">Import thousands of records from CSV files or export existing data</p>
            </div>

            {/* Entity Selector */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Select Entity Type</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.keys(CSV_TEMPLATES).map((entity) => (
                        <button
                            key={entity}
                            onClick={() => {
                                setSelectedEntity(entity as ImportableEntity);
                                setParsedData([]);
                                setShowPreview(false);
                                setImportResult(null);
                            }}
                            className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                                selectedEntity === entity
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {entity.charAt(0).toUpperCase() + entity.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Download Template */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Download className="text-blue-600" size={24} />
                        <h3 className="font-bold text-slate-800">Download Template</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                        Download a pre-formatted CSV template with sample data for <strong>{selectedEntity}</strong>
                    </p>
                    <button
                        onClick={() => downloadTemplate(selectedEntity)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-semibold"
                    >
                        <Download size={18} />
                        Download {selectedEntity} Template
                    </button>
                </div>

                {/* Export Existing */}
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <FileText className="text-emerald-600" size={24} />
                        <h3 className="font-bold text-slate-800">Export Existing Data</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                        Export current <strong>{selectedEntity}</strong> data ({
                            selectedEntity === 'items' ? state.items.length :
                            selectedEntity === 'partners' ? state.partners.length :
                            selectedEntity === 'accounts' ? state.accounts.length :
                            '0'
                        } records) to CSV
                    </p>
                    <button
                        onClick={() => exportExisting(selectedEntity)}
                        className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 font-semibold"
                    >
                        <FileText size={18} />
                        Export {selectedEntity}
                    </button>
                </div>
            </div>

            {/* Upload */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Upload className="text-purple-600" size={24} />
                    <h3 className="font-bold text-slate-800">Upload CSV File</h3>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="csv-upload"
                    />
                    <label
                        htmlFor="csv-upload"
                        className="cursor-pointer flex flex-col items-center gap-3"
                    >
                        <Upload className="text-purple-600" size={48} />
                        <div>
                            <p className="text-lg font-semibold text-slate-800">
                                Click to upload {selectedEntity} CSV
                            </p>
                            <p className="text-sm text-slate-500 mt-1">
                                Supports CSV files up to 10MB
                            </p>
                        </div>
                        <div className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700">
                            Browse Files
                        </div>
                    </label>
                </div>
            </div>

            {/* Preview & Import */}
            {showPreview && parsedData.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-slate-800">Preview Data</h3>
                            <p className="text-sm text-slate-600">{parsedData.length} records found</p>
                        </div>
                        <button
                            onClick={() => setShowPreview(false)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    {Object.keys(parsedData[0]).map((key) => (
                                        <th key={key} className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                                            {key}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {parsedData.slice(0, 50).map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50">
                                        {Object.values(row).map((value: any, i) => (
                                            <td key={i} className="px-4 py-2 text-slate-700">
                                                {value?.toString() || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {parsedData.length > 50 && (
                            <div className="p-4 bg-slate-50 text-center text-sm text-slate-600">
                                Showing first 50 of {parsedData.length} records
                            </div>
                        )}
                    </div>
                    <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                        <div className="text-sm text-slate-600">
                            Ready to import {parsedData.length} {selectedEntity}
                        </div>
                        <button
                            onClick={validateAndImport}
                            disabled={importing}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold disabled:bg-slate-400 flex items-center gap-2"
                        >
                            {importing ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <Database size={18} />
                                    Import to Firebase
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Import Result */}
            {importResult && (
                <div className={`rounded-lg border p-6 ${
                    importResult.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                }`}>
                    <div className="flex items-center gap-3 mb-4">
                        {importResult.failed > 0 ? (
                            <AlertCircle className="text-amber-600" size={24} />
                        ) : (
                            <CheckCircle className="text-emerald-600" size={24} />
                        )}
                        <h3 className="font-bold text-slate-800">Import Results</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                            <div className="text-sm text-slate-600">Successfully Imported</div>
                            <div className="text-2xl font-bold text-emerald-600">{importResult.success}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-red-200">
                            <div className="text-sm text-slate-600">Failed</div>
                            <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                        </div>
                    </div>
                    {importResult.errors.length > 0 && (
                        <div className="bg-white rounded-lg p-4 border border-amber-200">
                            <h4 className="font-semibold text-slate-700 mb-2">Errors:</h4>
                            <div className="max-h-48 overflow-y-auto text-sm text-slate-600 space-y-1">
                                {importResult.errors.map((error, index) => (
                                    <div key={index} className="text-red-600">• {error}</div>
                                ))}
                            </div>
                        </div>
                    )}
                    {importResult.success > 0 && (
                        <div className="mt-4 p-4 bg-blue-100 border border-blue-200 rounded-lg text-blue-800 text-sm">
                            ℹ️ Page will refresh automatically to load new data from Firebase...
                        </div>
                    )}
                </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <FileText size={20} />
                    How to Import Data
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                    <li>Select the entity type you want to import (Items, Partners, Accounts, etc.)</li>
                    <li>Download the CSV template to see the required column format</li>
                    <li>Fill in your data in Excel/Google Sheets following the template format</li>
                    <li>Save as CSV file</li>
                    <li>Upload the CSV file using the upload button above</li>
                    <li>Preview the data to ensure it looks correct</li>
                    <li>Click "Import to Firebase" to add all records to your database</li>
                    <li>Page will refresh automatically to show new data</li>
                </ol>
            </div>
        </div>
    );
};
