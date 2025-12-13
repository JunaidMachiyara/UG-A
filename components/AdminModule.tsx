import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { UserRole, TransactionType, LedgerEntry, PartnerType } from '../types';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, Database, Shield, Lock, CheckCircle, XCircle, Building2, Users, ArrowRight, RefreshCw, FileText, Upload } from 'lucide-react';
import { collection, writeBatch, doc, getDocs, query, where, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getExchangeRates } from '../context/DataContext';
import Papa from 'papaparse';

type ResetType = 'transactions' | 'complete' | 'factory' | null;

export const AdminModule: React.FC = () => {
    const { state, postTransaction } = useData();
    const { currentUser, currentFactory } = useAuth();
    const navigate = useNavigate();
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [resetType, setResetType] = useState<ResetType>(null);
    const [confirmText, setConfirmText] = useState('');
    const [pinCode, setPinCode] = useState('');
    const [resetting, setResetting] = useState(false);
    const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);
    const [fixingBalances, setFixingBalances] = useState(false);
    const [balanceFixResult, setBalanceFixResult] = useState<{ success: boolean; message: string; fixed: number } | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvData, setCsvData] = useState<any[]>([]);
    const [fixingOriginalTypes, setFixingOriginalTypes] = useState(false);
    const [originalTypeFixResult, setOriginalTypeFixResult] = useState<{ success: boolean; message: string; updated: number; errors: string[] } | null>(null);

    const CONFIRMATION_TEXT = 'DELETE ALL DATA';
    const ADMIN_PIN = '1234'; // You should change this to a secure PIN
    const SUPERVISOR_PIN = '7860';


    const handleResetRequest = (type: ResetType) => {
        setResetType(type);
        setShowConfirmModal(true);
        setConfirmText('');
        setPinCode('');
        setResetResult(null);
    };

    const executeReset = async (factoryArg?: { id: string }) => {
        if (confirmText !== CONFIRMATION_TEXT) {
            alert('Please type the confirmation text exactly');
            return;
        }

        if (pinCode !== ADMIN_PIN) {
            alert('Invalid PIN code');
            return;
        }

        setResetting(true);
        setResetResult(null);

        try {
            // Use factoryArg for factory reset, otherwise undefined

            // Collections to delete for transaction reset
            const transactionCollections = [
                'ledger',
                'salesInvoices',
                'purchases',
                'productions',
                'originalOpenings',
                'bundlePurchases',
                'logisticsEntries',
                'ongoingOrders',
                'archive',
                'attendance',
                'salaryPayments',
                'vehicleCharges',
                'chatMessages',
                'planners',
                'guaranteeCheques',
                'customsDocuments'
            ];

            // Additional collections to delete for complete/factory reset
            const setupCollections = [
                'items',
                'partners',
                'accounts',
                'divisions',
                'subDivisions',
                'logos',
                'warehouses',
                'employees',
                'originalTypes',
                'originalProducts',
                'categories',
                'sections',
                'tasks',
                'enquiries',
                'vehicles'
            ];

            let collectionsToDelete: string[] = [];
            if (resetType === 'complete') {
                collectionsToDelete = [...transactionCollections, ...setupCollections];
            } else if (resetType === 'factory') {
                collectionsToDelete = [...transactionCollections, ...setupCollections];
            } else {
                collectionsToDelete = transactionCollections;
            }

            let totalDeleted = 0;
            const { currentFactory } = useAuth();

            const factoryToUse = factoryArg || currentFactory;
            for (const collectionName of collectionsToDelete) {
                let snapshot;
                // For factory reset, filter by factoryId if possible
                if (resetType === 'factory' && factoryToUse && [
                    'items','partners','accounts','divisions','subDivisions','logos','warehouses','employees','originalTypes','originalProducts','categories','sections','ledger','salesInvoices','purchases','productions','originalOpenings','bundlePurchases','logisticsEntries','ongoingOrders','archive','attendance','salaryPayments','vehicleCharges','chatMessages','planners','guaranteeCheques','customsDocuments','tasks','enquiries','vehicles'
                ].includes(collectionName)) {
                    const q = query(collection(db, collectionName), where('factoryId', '==', factoryToUse.id));
                    snapshot = await getDocs(q);
                } else {
                    const collectionRef = collection(db, collectionName);
                    snapshot = await getDocs(collectionRef);
                }
                if (snapshot.empty) continue;
                // Firebase allows max 500 operations per batch
                const batches = [];
                let currentBatch = writeBatch(db);
                let operationCount = 0;
                snapshot.docs.forEach((document) => {
                    currentBatch.delete(document.ref);
                    operationCount++;
                    totalDeleted++;
                    if (operationCount === 500) {
                        batches.push(currentBatch);
                        currentBatch = writeBatch(db);
                        operationCount = 0;
                    }
                });
                if (operationCount > 0) {
                    batches.push(currentBatch);
                }
                // Commit all batches
                for (const batch of batches) {
                    await batch.commit();
                }
                console.log(`✅ Deleted ${snapshot.size} documents from ${collectionName}`);
            }

            setResetResult({
                success: true,
                message: `Successfully deleted ${totalDeleted} records from ${collectionsToDelete.length} collections.`
            });

            // Reset all item stock quantities to 0 and partner balances to 0 for transaction reset
            if (resetType === 'transactions') {
                try {
                    // Reset Items Stock
                    const itemsRef = collection(db, 'items');
                    const itemsSnapshot = await getDocs(itemsRef);
                    
                    if (!itemsSnapshot.empty) {
                        const batches = [];
                        let currentBatch = writeBatch(db);
                        let operationCount = 0;

                        itemsSnapshot.docs.forEach((itemDoc) => {
                            currentBatch.update(itemDoc.ref, { stockQty: 0 });
                            operationCount++;

                            if (operationCount === 500) {
                                batches.push(currentBatch);
                                currentBatch = writeBatch(db);
                                operationCount = 0;
                            }
                        });

                        if (operationCount > 0) {
                            batches.push(currentBatch);
                        }

                        for (const batch of batches) {
                            await batch.commit();
                        }
                        
                        console.log(`✅ Reset stock quantities for ${itemsSnapshot.size} items to 0`);
                    }

                    // Reset Partner Balances
                    const partnersRef = collection(db, 'partners');
                    const partnersSnapshot = await getDocs(partnersRef);
                    
                    if (!partnersSnapshot.empty) {
                        const batches = [];
                        let currentBatch = writeBatch(db);
                        let operationCount = 0;

                        partnersSnapshot.docs.forEach((partnerDoc) => {
                            currentBatch.update(partnerDoc.ref, { balance: 0 });
                            operationCount++;

                            if (operationCount === 500) {
                                batches.push(currentBatch);
                                currentBatch = writeBatch(db);
                                operationCount = 0;
                            }
                        });

                        if (operationCount > 0) {
                            batches.push(currentBatch);
                        }

                        for (const batch of batches) {
                            await batch.commit();
                        }
                        
                        console.log(`✅ Reset balances for ${partnersSnapshot.size} partners to 0`);
                    }
                } catch (error) {
                    console.error('Failed to reset stock/balances:', error);
                }
            }

            // Reload page after 3 seconds
            setTimeout(() => {
                window.location.reload();
            }, 3000);

        } catch (error) {
            console.error('Reset failed:', error);
            setResetResult({
                success: false,
                message: `Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        } finally {
            setResetting(false);
        }
    };

    // Pass currentFactory to executeReset for factory reset
    const handleConfirmReset = () => {
        if (resetType === 'factory') {
            executeReset(currentFactory);
        } else {
            executeReset();
        }
    };
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                    <Shield size={32} />
                    <h2 className="text-2xl font-bold">Administration Panel</h2>
                </div>
                <p className="text-red-100">Sensitive operations - Use with extreme caution</p>
            </div>

            {/* Quick Links for Super Admin */}
            {currentUser?.role === UserRole.SUPER_ADMIN && (
                <div>
                    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">System Administration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => navigate('/admin/factories')}
                            className="bg-white border-2 border-indigo-200 hover:border-indigo-400 p-6 rounded-lg text-left transition-all hover:shadow-lg group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-indigo-100 p-3 rounded-lg">
                                    <Building2 className="text-indigo-600" size={28} />
                                </div>
                                <ArrowRight className="text-indigo-400 group-hover:translate-x-1 transition-transform" size={24} />
                            </div>
                            <h3 className="font-bold text-lg text-indigo-900 mb-1">Factory Management</h3>
                            <p className="text-sm text-indigo-600">Add, edit, and manage factory locations</p>
                        </button>

                        <button
                            onClick={() => navigate('/admin/users')}
                            className="bg-white border-2 border-blue-200 hover:border-blue-400 p-6 rounded-lg text-left transition-all hover:shadow-lg group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-blue-100 p-3 rounded-lg">
                                    <Users className="text-blue-600" size={28} />
                                </div>
                                <ArrowRight className="text-blue-400 group-hover:translate-x-1 transition-transform" size={24} />
                            </div>
                            <h3 className="font-bold text-lg text-blue-900 mb-1">User Management</h3>
                            <p className="text-sm text-blue-600">Create users and assign roles & permissions</p>
                        </button>

                        <button
                            onClick={() => navigate('/admin/migration')}
                            className="bg-white border-2 border-emerald-200 hover:border-emerald-400 p-6 rounded-lg text-left transition-all hover:shadow-lg group"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-emerald-100 p-3 rounded-lg">
                                    <RefreshCw className="text-emerald-600" size={28} />
                                </div>
                                <ArrowRight className="text-emerald-400 group-hover:translate-x-1 transition-transform" size={24} />
                            </div>
                            <h3 className="font-bold text-lg text-emerald-900 mb-1">Data Migration</h3>
                            <p className="text-sm text-emerald-600">Bulk add factoryId to existing data</p>
                        </button>
                    </div>
                </div>
            )}

            {/* Database Management Section */}
            <div>
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">Database Management</h3>

            {/* Warning Banner */}
            <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 shrink-0 mt-1" size={24} />
                    <div>
                        <h3 className="font-bold text-amber-900 mb-2">⚠️ Critical Warning</h3>
                        <p className="text-amber-800 text-sm">
                            The operations on this page are <strong>IRREVERSIBLE</strong>. Once executed, deleted data 
                            cannot be recovered. Always ensure you have a backup before proceeding.
                        </p>
                    </div>
                </div>
            </div>

            {/* System Statistics */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Database size={20} />
                    Current Database Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Items</div>
                        <div className="text-2xl font-bold text-slate-800">{state.items.length}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Partners</div>
                        <div className="text-2xl font-bold text-slate-800">{state.partners.length}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Ledger Entries</div>
                        <div className="text-2xl font-bold text-slate-800">{state.ledger.length}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Sales Invoices</div>
                        <div className="text-2xl font-bold text-slate-800">{state.salesInvoices.length}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Purchases</div>
                        <div className="text-2xl font-bold text-slate-800">{state.purchases.length}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Productions</div>
                        <div className="text-2xl font-bold text-slate-800">{state.productions.length}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Ongoing Orders</div>
                        <div className="text-2xl font-bold text-slate-800">{state.ongoingOrders.length}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Accounts</div>
                        <div className="text-2xl font-bold text-slate-800">{state.accounts.length}</div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-none sm:rounded-xl shadow-2xl max-w-lg w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
                        <div className={`px-6 py-4 border-b ${
                            resetType === 'complete' 
                                ? 'bg-red-50 border-red-200' 
                                : 'bg-orange-50 border-orange-200'
                        }`}>
                            <div className="flex items-center gap-3">
                                <Lock className={resetType === 'complete' ? 'text-red-600' : 'text-orange-600'} size={24} />
                                <h3 className="font-bold text-slate-800 text-lg">
                                    {resetType === 'complete' ? 'Complete Hard Reset' : 'Transaction Reset'} - Final Confirmation
                                </h3>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className={`p-4 rounded-lg border-2 ${
                                resetType === 'complete' 
                                    ? 'bg-red-50 border-red-300' 
                                    : 'bg-orange-50 border-orange-300'
                            }`}>
                                <p className="font-bold text-slate-900 mb-2">
                                    ⚠️ You are about to permanently delete:
                                </p>
                                {resetType === 'complete' ? (
                                    <ul className="text-sm text-red-700 space-y-1 ml-4">
                                        <li>• {state.ledger.length} Ledger Entries</li>
                                        <li>• {state.salesInvoices.length} Sales Invoices</li>
                                        <li>• {state.purchases.length} Purchases</li>
                                        <li>• {state.productions.length} Production Records</li>
                                        <li className="font-bold mt-2">• {state.items.length} Items</li>
                                        <li className="font-bold">• {state.partners.length} Partners</li>
                                        <li className="font-bold">• {state.accounts.length} Accounts</li>
                                        <li className="font-bold">• ALL other setup data</li>
                                    </ul>
                                ) : (
                                    <ul className="text-sm text-orange-700 space-y-1 ml-4">
                                        <li>• {state.ledger.length} Ledger Entries</li>
                                        <li>• {state.salesInvoices.length} Sales Invoices</li>
                                        <li>• {state.purchases.length} Purchases</li>
                                        <li>• {state.productions.length} Production Records</li>
                                        <li>• {state.ongoingOrders.length} Ongoing Orders</li>
                                        <li>• All other transaction data</li>
                                    </ul>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Type "{CONFIRMATION_TEXT}" to confirm:
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-red-500 font-mono ${
                                        confirmText === CONFIRMATION_TEXT 
                                            ? 'border-green-500 bg-green-50' 
                                            : 'border-slate-300'
                                    }`}
                                    placeholder={CONFIRMATION_TEXT}
                                    autoComplete="off"
                                />
                                {confirmText && confirmText !== CONFIRMATION_TEXT && (
                                    <p className="text-xs text-red-600 mt-1">Text doesn't match. Type exactly: {CONFIRMATION_TEXT}</p>
                                )}
                                {confirmText === CONFIRMATION_TEXT && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                        <CheckCircle size={12} /> Text confirmed
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Enter Admin PIN:
                                </label>
                                <input
                                    type="password"
                                    value={pinCode}
                                    onChange={(e) => setPinCode(e.target.value)}
                                    className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-red-500 font-mono ${
                                        pinCode === ADMIN_PIN 
                                            ? 'border-green-500 bg-green-50' 
                                            : 'border-slate-300'
                                    }`}
                                    placeholder="Enter PIN"
                                    autoComplete="off"
                                />
                                {pinCode && pinCode !== ADMIN_PIN && (
                                    <p className="text-xs text-red-600 mt-1">Invalid PIN</p>
                                )}
                                {pinCode === ADMIN_PIN && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                        <CheckCircle size={12} /> PIN verified
                                    </p>
                                )}
                            </div>

                            {resetResult && (
                                <div className={`p-4 rounded-lg border-2 ${
                                    resetResult.success 
                                        ? 'bg-emerald-50 border-emerald-300' 
                                        : 'bg-red-50 border-red-300'
                                }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {resetResult.success ? (
                                            <CheckCircle className="text-emerald-600" size={20} />
                                        ) : (
                                            <XCircle className="text-red-600" size={20} />
                                        )}
                                        <span className={`font-bold ${
                                            resetResult.success ? 'text-emerald-900' : 'text-red-900'
                                        }`}>
                                            {resetResult.success ? 'Reset Successful!' : 'Reset Failed'}
                                        </span>
                                    </div>
                                    <p className={`text-sm ${
                                        resetResult.success ? 'text-emerald-700' : 'text-red-700'
                                    }`}>
                                        {resetResult.message}
                                    </p>
                                    {resetResult.success && (
                                        <p className="text-xs text-emerald-600 mt-2">
                                            Page will refresh automatically in 3 seconds...
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                disabled={resetting}
                                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmReset}
                                disabled={resetting || confirmText !== CONFIRMATION_TEXT || pinCode !== ADMIN_PIN}
                                className={`flex-1 px-4 py-2 rounded-lg font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                                    resetType === 'complete' 
                                        ? 'bg-red-600 hover:bg-red-700' 
                                        : 'bg-orange-600 hover:bg-orange-700'
                                }`}
                            >
                                {resetting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={18} />
                                        Confirm & Execute
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fix Missing Opening Balances Section */}
            <div className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-3 rounded-lg">
                        <FileText className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Fix Missing Opening Balances</h3>
                        <p className="text-sm text-slate-600">Create missing opening balance ledger entries for partners</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Auto-detect missing opening balances */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-blue-900">
                                Partners Missing Opening Balance Entries:
                            </p>
                            <button
                                onClick={() => {
                                    const missing = state.partners.filter(partner => {
                                        const hasOpeningBalance = state.ledger.some(e => 
                                            e.transactionId === `OB-${partner.id}` && 
                                            e.transactionType === TransactionType.OPENING_BALANCE
                                        );
                                        return !hasOpeningBalance;
                                    });
                                    
                                    if (missing.length === 0) {
                                        alert('✅ All partners have opening balance entries!');
                                    } else {
                                        // Create CSV content
                                        const csvContent = 'id,balance\n' + missing.map(p => `${p.id},${p.balance || 0}`).join('\n');
                                        const blob = new Blob([csvContent], { type: 'text/csv' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'missing_opening_balances.csv';
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        
                                        alert(`Found ${missing.length} partners without opening balance entries.\n\nCSV file downloaded with their IDs and current balances.\n\nYou can edit the balances in the CSV and upload it to fix them.`);
                                    }
                                }}
                                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Download Missing List as CSV
                            </button>
                        </div>
                        <p className="text-xs text-blue-700">
                            Click to download a CSV file with all partners that don't have opening balance entries. Edit the balances and upload to fix them.
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>Instructions:</strong> Upload a CSV file with columns: <code>id</code> (partner ID like CUS-001), <code>balance</code> (opening balance amount).
                            This will create missing opening balance ledger entries for partners that don't have them.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Upload CSV with Partner IDs and Balances:
                        </label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    setCsvFile(file);
                                    Papa.parse(file, {
                                        header: true,
                                        complete: (results) => {
                                            setCsvData(results.data);
                                        },
                                        error: (error) => {
                                            alert(`Error parsing CSV: ${error.message}`);
                                        }
                                    });
                                }
                            }}
                            className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        {csvData.length > 0 && (
                            <p className="text-sm text-emerald-600 mt-2">
                                ✓ Loaded {csvData.length} records from CSV
                            </p>
                        )}
                    </div>

                    <button
                        onClick={async () => {
                            if (!csvFile || csvData.length === 0) {
                                alert('Please upload a CSV file first');
                                return;
                            }

                            const pin = prompt('Enter Supervisor PIN (7860):');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            setFixingBalances(true);
                            setBalanceFixResult(null);

                            try {
                                let fixed = 0;
                                let skipped = 0;
                                let errors: string[] = [];
                                const totalRows = csvData.length;

                                for (let idx = 0; idx < csvData.length; idx++) {
                                    const row = csvData[idx];
                                    
                                    try {
                                        const partnerId = row.id || row.ID || row.Id;
                                        const balanceStr = row.balance || row.Balance || row.BAL || '0';
                                        const balance = parseFloat(balanceStr.toString()) || 0;

                                        if (!partnerId) {
                                            errors.push(`Row ${idx + 2}: Missing partner ID`);
                                            continue;
                                        }

                                        if (balance === 0) {
                                            skipped++;
                                            continue;
                                        }

                                        const partner = state.partners.find(p => p.id === partnerId);
                                        if (!partner) {
                                            errors.push(`Row ${idx + 2}: Partner ${partnerId} not found`);
                                            continue;
                                        }

                                        // Check if already has opening balance
                                        const hasOpeningBalance = state.ledger.some(e => 
                                            e.transactionId === `OB-${partnerId}` && 
                                            e.transactionType === TransactionType.OPENING_BALANCE
                                        );
                                        if (hasOpeningBalance) {
                                            skipped++;
                                            continue; // Skip if already has opening balance
                                        }

                                    // Create opening balance entries
                                    const prevYear = new Date().getFullYear() - 1;
                                    const date = `${prevYear}-12-31`;
                                    const openingEquityId = state.accounts.find(a => a.name.includes('Capital'))?.id || '301';
                                    const currency = partner.defaultCurrency || 'USD';
                                    const exchangeRates = getExchangeRates(state.currencies);
                                    const rate = exchangeRates[currency] || 1;
                                    const fcyAmt = balance * rate;
                                    const commonProps = { currency, exchangeRate: rate, fcyAmount: Math.abs(fcyAmt) };

                                    let entries: Omit<LedgerEntry, 'id'>[] = [];
                                    if (partner.type === PartnerType.CUSTOMER) {
                                        entries = [
                                            {
                                                ...commonProps,
                                                date,
                                                transactionId: `OB-${partnerId}`,
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: partnerId,
                                                accountName: partner.name,
                                                debit: balance,
                                                credit: 0,
                                                narration: `Opening Balance - ${partner.name}`,
                                                factoryId: currentFactory?.id || ''
                                            },
                                            {
                                                ...commonProps,
                                                date,
                                                transactionId: `OB-${partnerId}`,
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: openingEquityId,
                                                accountName: 'Opening Equity',
                                                debit: 0,
                                                credit: balance,
                                                narration: `Opening Balance - ${partner.name}`,
                                                factoryId: currentFactory?.id || ''
                                            }
                                        ];
                                    } else {
                                        const absBalance = Math.abs(balance);
                                        if (balance < 0) {
                                            entries = [
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${partnerId}`,
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: openingEquityId,
                                                    accountName: 'Opening Equity',
                                                    debit: absBalance,
                                                    credit: 0,
                                                    narration: `Opening Balance - ${partner.name}`,
                                                    factoryId: currentFactory?.id || ''
                                                },
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${partnerId}`,
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: partnerId,
                                                    accountName: partner.name,
                                                    debit: 0,
                                                    credit: absBalance,
                                                    narration: `Opening Balance - ${partner.name}`,
                                                    factoryId: currentFactory?.id || ''
                                                }
                                            ];
                                        } else {
                                            entries = [
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${partnerId}`,
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: openingEquityId,
                                                    accountName: 'Opening Equity',
                                                    debit: 0,
                                                    credit: absBalance,
                                                    narration: `Opening Balance - ${partner.name}`,
                                                    factoryId: currentFactory?.id || ''
                                                },
                                                {
                                                    ...commonProps,
                                                    date,
                                                    transactionId: `OB-${partnerId}`,
                                                    transactionType: TransactionType.OPENING_BALANCE,
                                                    accountId: partnerId,
                                                    accountName: partner.name,
                                                    debit: absBalance,
                                                    credit: 0,
                                                    narration: `Opening Balance - ${partner.name}`,
                                                    factoryId: currentFactory?.id || ''
                                                }
                                            ];
                                        }
                                    }

                                        // Post the entries
                                        postTransaction(entries);
                                        fixed++;
                                        console.log(`✅ Created opening balance for ${partner.name} (${partnerId}): ${balance}`);

                                        // Small delay to avoid rate limiting
                                        if (fixed % 10 === 0) {
                                            await new Promise(resolve => setTimeout(resolve, 100));
                                        }
                                    } catch (error: any) {
                                        console.error(`❌ Error processing row ${idx + 2}:`, error);
                                        errors.push(`Row ${idx + 2}: ${error.message || 'Unknown error'}`);
                                        // Continue with next row instead of stopping
                                    }
                                }

                                const message = `Processed ${totalRows} rows: ${fixed} created, ${skipped} skipped (already exist or zero balance), ${errors.length} errors.`;
                                setBalanceFixResult({
                                    success: fixed > 0,
                                    message: message + (errors.length > 0 ? `\n\nErrors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more` : ''}` : ''),
                                    fixed
                                });

                                // Refresh page after 3 seconds
                                setTimeout(() => {
                                    window.location.reload();
                                }, 3000);

                            } catch (error: any) {
                                setBalanceFixResult({
                                    success: false,
                                    message: `Failed: ${error.message}`,
                                    fixed: 0
                                });
                            } finally {
                                setFixingBalances(false);
                            }
                        }}
                        disabled={fixingBalances || !csvFile || csvData.length === 0}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {fixingBalances ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Creating Opening Balance Entries...
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                Fix Missing Opening Balances
                            </>
                        )}
                    </button>

                    {balanceFixResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            balanceFixResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {balanceFixResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <XCircle className="text-red-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    balanceFixResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {balanceFixResult.success ? 'Fix Successful!' : 'Fix Failed'}
                                </span>
                            </div>
                            <p className={`text-sm ${
                                balanceFixResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {balanceFixResult.message}
                            </p>
                            {balanceFixResult.success && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Page will refresh automatically in 3 seconds to update balances...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Fix Original Type IDs Section */}
            <div className="bg-white border-2 border-purple-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-purple-100 p-3 rounded-lg">
                        <RefreshCw className="text-purple-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Fix Original Type IDs</h3>
                        <p className="text-sm text-slate-600">Rename all Original Types to use OT-1001, OT-1002 format instead of random IDs</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-purple-900 mb-2">
                            Current Original Types: {state.originalTypes.length}
                        </p>
                        <p className="text-xs text-purple-700">
                            This will rename all Original Types to use sequential IDs (OT-1001, OT-1002, etc.) and update all references in:
                            <ul className="list-disc list-inside mt-1">
                                <li>Purchases (originalTypeId)</li>
                                <li>Original Openings (originalType)</li>
                                <li>Original Products (originalTypeId)</li>
                            </ul>
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>⚠️ Warning:</strong> This operation will:
                            <ul className="list-disc list-inside mt-1">
                                <li>Create new Original Type documents with new IDs</li>
                                <li>Update all references in related collections</li>
                                <li>Delete old Original Type documents</li>
                            </ul>
                            <strong className="block mt-2">Requires Supervisor PIN (7860)</strong>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to proceed:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            if (!confirm(`This will rename ${state.originalTypes.length} Original Types. Continue?`)) {
                                return;
                            }

                            setFixingOriginalTypes(true);
                            setOriginalTypeFixResult(null);

                            try {
                                const errors: string[] = [];
                                let updated = 0;
                                const idMapping: Record<string, string> = {}; // oldId -> newId

                                // Step 1: Generate new IDs for all Original Types
                                const originalTypesToRename = state.originalTypes
                                    .filter(ot => !ot.id.match(/^OT-\d+$/)) // Only rename those not already in OT-XXXX format
                                    .sort((a, b) => a.name.localeCompare(b.name)); // Sort by name for consistent ordering

                                const existingOtIds = state.originalTypes
                                    .filter(ot => ot.id.match(/^OT-\d+$/))
                                    .map(ot => {
                                        const match = ot.id.match(/^OT-(\d+)$/);
                                        return match ? parseInt(match[1]) : 0;
                                    })
                                    .filter(n => n > 0)
                                    .sort((a, b) => b - a);

                                let nextNumber = existingOtIds.length > 0 ? existingOtIds[0] + 1 : 1001;

                                originalTypesToRename.forEach(ot => {
                                    const newId = `OT-${nextNumber}`;
                                    idMapping[ot.id] = newId;
                                    nextNumber++;
                                });

                                console.log(`📋 ID Mapping:`, idMapping);
                                console.log(`📊 Will rename ${originalTypesToRename.length} Original Types`);

                                // Step 2: Create new documents with new IDs
                                const batch = writeBatch(db);
                                let batchCount = 0;
                                const BATCH_SIZE = 500;

                                for (const oldType of originalTypesToRename) {
                                    const newId = idMapping[oldType.id];
                                    if (!newId) continue;

                                    const { id, ...typeData } = oldType;
                                    const newTypeRef = doc(db, 'originalTypes', newId);
                                    batch.set(newTypeRef, {
                                        ...typeData,
                                        createdAt: typeData.createdAt || new Date(),
                                        updatedAt: new Date()
                                    });

                                    batchCount++;
                                    if (batchCount >= BATCH_SIZE) {
                                        await batch.commit();
                                        console.log(`✅ Committed batch: ${batchCount} new Original Types created`);
                                        batchCount = 0;
                                    }
                                }

                                if (batchCount > 0) {
                                    await batch.commit();
                                    console.log(`✅ Committed final batch: ${batchCount} new Original Types created`);
                                }

                                // Step 3: Update all references in purchases
                                console.log('🔄 Updating purchases...');
                                const purchasesQuery = query(
                                    collection(db, 'purchases'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const purchasesSnapshot = await getDocs(purchasesQuery);
                                const purchaseBatch = writeBatch(db);
                                let purchaseUpdates = 0;

                                purchasesSnapshot.docs.forEach(docSnapshot => {
                                    const purchase = docSnapshot.data();
                                    let needsUpdate = false;
                                    const updates: any = {};

                                    // Update originalTypeId
                                    if (purchase.originalTypeId && idMapping[purchase.originalTypeId]) {
                                        updates.originalTypeId = idMapping[purchase.originalTypeId];
                                        needsUpdate = true;
                                    }

                                    // Update items array
                                    if (purchase.items && Array.isArray(purchase.items)) {
                                        const updatedItems = purchase.items.map((item: any) => {
                                            if (item.originalTypeId && idMapping[item.originalTypeId]) {
                                                return { ...item, originalTypeId: idMapping[item.originalTypeId] };
                                            }
                                            return item;
                                        });
                                        if (JSON.stringify(updatedItems) !== JSON.stringify(purchase.items)) {
                                            updates.items = updatedItems;
                                            needsUpdate = true;
                                        }
                                    }

                                    if (needsUpdate) {
                                        purchaseBatch.update(docSnapshot.ref, updates);
                                        purchaseUpdates++;
                                    }
                                });

                                if (purchaseUpdates > 0) {
                                    await purchaseBatch.commit();
                                    console.log(`✅ Updated ${purchaseUpdates} purchases`);
                                }

                                // Step 4: Update all references in originalOpenings
                                console.log('🔄 Updating originalOpenings...');
                                const openingsQuery = query(
                                    collection(db, 'originalOpenings'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const openingsSnapshot = await getDocs(openingsQuery);
                                const openingsBatch = writeBatch(db);
                                let openingUpdates = 0;

                                openingsSnapshot.docs.forEach(docSnapshot => {
                                    const opening = docSnapshot.data();
                                    if (opening.originalType && idMapping[opening.originalType]) {
                                        openingsBatch.update(docSnapshot.ref, {
                                            originalType: idMapping[opening.originalType]
                                        });
                                        openingUpdates++;
                                    }
                                });

                                if (openingUpdates > 0) {
                                    await openingsBatch.commit();
                                    console.log(`✅ Updated ${openingUpdates} originalOpenings`);
                                }

                                // Step 5: Update all references in originalProducts
                                console.log('🔄 Updating originalProducts...');
                                const productsQuery = query(
                                    collection(db, 'originalProducts'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const productsSnapshot = await getDocs(productsQuery);
                                const productsBatch = writeBatch(db);
                                let productUpdates = 0;

                                productsSnapshot.docs.forEach(docSnapshot => {
                                    const product = docSnapshot.data();
                                    if (product.originalTypeId && idMapping[product.originalTypeId]) {
                                        productsBatch.update(docSnapshot.ref, {
                                            originalTypeId: idMapping[product.originalTypeId]
                                        });
                                        productUpdates++;
                                    }
                                });

                                if (productUpdates > 0) {
                                    await productsBatch.commit();
                                    console.log(`✅ Updated ${productUpdates} originalProducts`);
                                }

                                // Step 6: Delete old Original Type documents
                                console.log('🗑️ Deleting old Original Type documents...');
                                const deleteBatch = writeBatch(db);
                                let deleteCount = 0;

                                for (const oldType of originalTypesToRename) {
                                    const oldTypeRef = doc(db, 'originalTypes', oldType.id);
                                    deleteBatch.delete(oldTypeRef);
                                    deleteCount++;

                                    if (deleteCount >= BATCH_SIZE) {
                                        await deleteBatch.commit();
                                        console.log(`✅ Deleted batch: ${deleteCount} old Original Types`);
                                        deleteCount = 0;
                                    }
                                }

                                if (deleteCount > 0) {
                                    await deleteBatch.commit();
                                    console.log(`✅ Deleted final batch: ${deleteCount} old Original Types`);
                                }

                                updated = originalTypesToRename.length;

                                setOriginalTypeFixResult({
                                    success: true,
                                    message: `Successfully renamed ${updated} Original Types!\n\n- Created ${updated} new documents\n- Updated ${purchaseUpdates} purchases\n- Updated ${openingUpdates} originalOpenings\n- Updated ${productUpdates} originalProducts\n- Deleted ${updated} old documents`,
                                    updated,
                                    errors
                                });

                                // Refresh page after 5 seconds
                                setTimeout(() => {
                                    window.location.reload();
                                }, 5000);

                            } catch (error: any) {
                                console.error('❌ Error fixing Original Type IDs:', error);
                                setOriginalTypeFixResult({
                                    success: false,
                                    message: `Failed: ${error.message}`,
                                    updated: 0,
                                    errors: [error.message]
                                });
                            } finally {
                                setFixingOriginalTypes(false);
                            }
                        }}
                        disabled={fixingOriginalTypes || state.originalTypes.length === 0}
                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {fixingOriginalTypes ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Renaming Original Types...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} />
                                Fix Original Type IDs ({state.originalTypes.filter(ot => !ot.id.match(/^OT-\d+$/)).length} need fixing)
                            </>
                        )}
                    </button>

                    {originalTypeFixResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            originalTypeFixResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {originalTypeFixResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <XCircle className="text-red-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    originalTypeFixResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {originalTypeFixResult.success ? 'Fix Successful!' : 'Fix Failed'}
                                </span>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${
                                originalTypeFixResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {originalTypeFixResult.message}
                            </p>
                            {originalTypeFixResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-600">
                                    <strong>Errors:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {originalTypeFixResult.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                        {originalTypeFixResult.errors.length > 5 && (
                                            <li>... and {originalTypeFixResult.errors.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            {originalTypeFixResult.success && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Page will refresh automatically in 5 seconds...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Security Notice */}
            <div className="bg-slate-800 text-white rounded-lg p-6">
                <div className="flex items-start gap-3">
                    <Shield className="shrink-0 mt-1" size={24} />
                    <div>
                        <h3 className="font-bold mb-2">Security Notice</h3>
                        <p className="text-sm text-slate-300">
                            Default Admin PIN is <code className="bg-slate-700 px-2 py-1 rounded">1234</code>. 
                            For production use, change this in the AdminModule.tsx file (line 13).
                        </p>
                    </div>
                </div>
            </div>
            </div> {/* Close Database Management Section */}
        </div>
    );
};
