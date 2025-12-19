import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { UserRole, TransactionType, LedgerEntry, PartnerType, SalesInvoice } from '../types';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, Database, Shield, Lock, CheckCircle, XCircle, Building2, Users, ArrowRight, RefreshCw, FileText, Upload, Search, CheckSquare } from 'lucide-react';
import { collection, writeBatch, doc, getDocs, getDoc, query, where, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getExchangeRates } from '../context/DataContext';
import { getAccountId } from '../services/accountMap';
import Papa from 'papaparse';
import { CSVValidator } from './CSVValidator';
import { DataImportExport } from './DataImportExport';
import { FactoryManagement } from './FactoryManagement';
import { UserManagement } from './UserManagement';

type ResetType = 'transactions' | 'complete' | 'factory' | null;

export const AdminModule: React.FC = () => {
    const { state, postTransaction, deleteTransaction } = useData();
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
    const [fixingDivisions, setFixingDivisions] = useState(false);
    const [divisionFixResult, setDivisionFixResult] = useState<{ success: boolean; message: string; updated: number; errors: string[] } | null>(null);
    const [fixingSubDivisions, setFixingSubDivisions] = useState(false);
    const [subDivisionFixResult, setSubDivisionFixResult] = useState<{ success: boolean; message: string; updated: number; errors: string[] } | null>(null);
    const [fixingOriginalProducts, setFixingOriginalProducts] = useState(false);
    const [originalProductFixResult, setOriginalProductFixResult] = useState<{ success: boolean; message: string; updated: number; errors: string[] } | null>(null);
    const [fixingCategories, setFixingCategories] = useState(false);
    const [categoryFixResult, setCategoryFixResult] = useState<{ success: boolean; message: string; updated: number; errors: string[] } | null>(null);
    const [fixingSections, setFixingSections] = useState(false);
    const [sectionFixResult, setSectionFixResult] = useState<{ success: boolean; message: string; updated: number; errors: string[] } | null>(null);
    const [fixingPurchaseLedgers, setFixingPurchaseLedgers] = useState(false);
    const [purchaseLedgerFixResult, setPurchaseLedgerFixResult] = useState<{ success: boolean; message: string; fixed: number; errors: string[] } | null>(null);
    const [deletingAllPurchases, setDeletingAllPurchases] = useState(false);
    const [deletePurchasesResult, setDeletePurchasesResult] = useState<{ success: boolean; message: string; deleted: number; errors: string[] } | null>(null);
    const [verifyingPurchases, setVerifyingPurchases] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{ 
        success: boolean; 
        message: string; 
        obPurEntries: number; 
        piEntries: number; 
        logisticsEntries: number;
        purchases: number;
    } | null>(null);
    const [deletingFactoryItems, setDeletingFactoryItems] = useState(false);
    const [deleteItemsResult, setDeleteItemsResult] = useState<{ success: boolean; message: string; deleted: number; errors: string[] } | null>(null);
    const [activeTab, setActiveTab] = useState<'admin' | 'csv-validator' | 'import-export'>('admin');
    const [scanningLedger, setScanningLedger] = useState(false);
    const [ledgerScanResult, setLedgerScanResult] = useState<{
        duplicates: { transactionId: string; count: number; invoiceNo: string; entryCounts: number[] }[];
        missingHeaders: { transactionId: string; invoiceNo: string; date: string; customerId: string; netTotal: number; factoryId: string }[];
        allInvoices: { transactionId: string; invoiceNo: string; entryCount: number; hasHeader: boolean }[];
        totalSITransactions: number;
    } | null>(null);
    const [removingDuplicates, setRemovingDuplicates] = useState(false);
    const [rebuildingInvoices, setRebuildingInvoices] = useState(false);
    const [deletingAllSalesInvoices, setDeletingAllSalesInvoices] = useState(false);
    const [deleteAllSIResult, setDeleteAllSIResult] = useState<{ success: boolean; message: string; deleted: number; errors: string[] } | null>(null);

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

    // Delete ALL items (and their opening stock ledger entries) for the current factory
    const deleteAllItemsForCurrentFactory = async () => {
        if (!currentFactory) {
            alert('Please select a factory first.');
            return;
        }

        const pin = prompt('Enter Supervisor PIN to delete ALL items for this factory:');
        if (pin !== SUPERVISOR_PIN) {
            alert('Invalid PIN. Operation cancelled.');
            return;
        }

        if (!window.confirm(
            `This will permanently delete ALL items and their opening stock entries for factory "${currentFactory.name}".\n\n` +
            `This is intended only for resetting before a fresh CSV import.\n\n` +
            `Are you sure you want to continue?`
        )) {
            return;
        }

        setDeletingFactoryItems(true);
        setDeleteItemsResult(null);

        try {
            // Load all items for this factory
            const itemsQuery = query(
                collection(db, 'items'),
                where('factoryId', '==', currentFactory.id)
            );
            const snapshot = await getDocs(itemsQuery);

            if (snapshot.empty) {
                setDeleteItemsResult({
                    success: true,
                    message: `No items found for factory ${currentFactory.name}.`,
                    deleted: 0,
                    errors: []
                });
                setDeletingFactoryItems(false);
                return;
            }

            const errors: string[] = [];
            let deleted = 0;

            // First: delete opening stock ledger entries OB-STK-<itemId>
            for (const docSnap of snapshot.docs) {
                const itemId = docSnap.id;
                const data = docSnap.data() as any;
                const name = data.name || itemId;
                const transactionId = `OB-STK-${itemId}`;

                try {
                    await deleteTransaction(transactionId, `Delete Opening Stock for ${name}`, currentUser?.name || 'Admin');
                } catch (err: any) {
                    console.warn('Failed to delete opening stock transaction for item', itemId, err);
                    errors.push(`Item ${name} (${itemId}): could not delete opening stock transaction (${transactionId})`);
                }
            }

            // Then: delete items themselves in batches
            const BATCH_SIZE = 500;
            let batch = writeBatch(db);
            let opCount = 0;

            for (const docSnap of snapshot.docs) {
                batch.delete(docSnap.ref);
                deleted++;
                opCount++;
                if (opCount === BATCH_SIZE) {
                    await batch.commit();
                    batch = writeBatch(db);
                    opCount = 0;
                }
            }
            if (opCount > 0) {
                await batch.commit();
            }

            setDeleteItemsResult({
                success: true,
                message: `Deleted ${deleted} items for factory ${currentFactory.name}.`,
                deleted,
                errors
            });

            // Reload after a short delay so state/Firebase stay in sync
            setTimeout(() => window.location.reload(), 3000);
        } catch (error: any) {
            console.error('Failed to delete items for factory:', error);
            setDeleteItemsResult({
                success: false,
                message: `Failed to delete items for factory: ${error?.message || 'Unknown error'}`,
                deleted: 0,
                errors: []
            });
        } finally {
            setDeletingFactoryItems(false);
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

            {/* Tabs Navigation */}
            <div className="bg-white rounded-lg border border-slate-200 p-1 flex flex-wrap gap-2">
                <button
                    onClick={() => setActiveTab('admin')}
                    className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        activeTab === 'admin'
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                    <Shield size={16} />
                    <span>Admin Tools</span>
                </button>
                {currentUser?.role === UserRole.SUPER_ADMIN && (
                    <>
                        <button
                            onClick={() => setActiveTab('factories')}
                            className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                activeTab === 'factories'
                                    ? 'bg-red-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            <Building2 size={16} />
                            <span>Factories</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                activeTab === 'users'
                                    ? 'bg-red-600 text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            <Users size={16} />
                            <span>Users</span>
                        </button>
                    </>
                )}
                <button
                    onClick={() => setActiveTab('csv-validator')}
                    className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        activeTab === 'csv-validator'
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                    <CheckSquare size={16} />
                    <span>CSV Validator</span>
                </button>
                <button
                    onClick={() => setActiveTab('import-export')}
                    className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        activeTab === 'import-export'
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                    <Upload size={16} />
                    <span>Import/Export</span>
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'factories' && currentUser?.role === UserRole.SUPER_ADMIN && (
                <div>
                    <FactoryManagement />
                </div>
            )}

            {activeTab === 'users' && currentUser?.role === UserRole.SUPER_ADMIN && (
                <div>
                    <UserManagement />
                </div>
            )}

            {activeTab === 'csv-validator' && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <CSVValidator />
                </div>
            )}

            {activeTab === 'import-export' && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <DataImportExport />
                </div>
            )}

            {activeTab === 'admin' && (
                <>

            {/* Quick Links for Super Admin */}
            {currentUser?.role === UserRole.SUPER_ADMIN && (
                <div>
                    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3 px-1">System Administration</h3>
                    {/* Factory Management and User Management moved to tabs above */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                        <p className="font-semibold mb-1">💡 Quick Access</p>
                        <p>Use the tabs above to access <strong>Factories</strong> and <strong>Users</strong> management.</p>
                    </div>

                        {/* Hidden: Data Migration tool - not needed for fresh start, hidden to prevent accidental use */}
                        {/* <button
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
                        </button> */}
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

            {/* Delete ALL Items for Current Factory */}
            <div className="bg-white border-2 border-red-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-100 p-3 rounded-lg">
                        <Trash2 className="text-red-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Delete ALL Items for Current Factory</h3>
                        <p className="text-sm text-slate-600">
                            Permanently delete all inventory items and their opening stock ledger entries for factory "{currentFactory?.name || 'N/A'}".
                        </p>
                    </div>
                </div>

                {deleteItemsResult && (
                    <div
                        className={`p-4 mb-4 rounded-lg border-2 ${
                            deleteItemsResult.success ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'
                        }`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            {deleteItemsResult.success ? (
                                <CheckCircle className="text-emerald-600" size={20} />
                            ) : (
                                <XCircle className="text-red-600" size={20} />
                            )}
                            <span
                                className={`font-bold ${
                                    deleteItemsResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}
                            >
                                {deleteItemsResult.success ? 'Items Deleted' : 'Delete Failed'}
                            </span>
                        </div>
                        <p
                            className={`text-sm ${
                                deleteItemsResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}
                        >
                            {deleteItemsResult.message}
                        </p>
                        {deleteItemsResult.errors.length > 0 && (
                            <ul className="mt-2 text-xs text-red-700 list-disc list-inside">
                                {deleteItemsResult.errors.slice(0, 5).map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                                {deleteItemsResult.errors.length > 5 && (
                                    <li>...and {deleteItemsResult.errors.length - 5} more</li>
                                )}
                            </ul>
                        )}
                    </div>
                )}

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-800">
                        <strong>Warning:</strong> This will remove <strong>all items</strong> for the current factory, including opening
                        stock entries. This is intended only for resetting before a fresh CSV import. This action cannot be undone.
                    </p>
                </div>

                <button
                    onClick={deleteAllItemsForCurrentFactory}
                    disabled={deletingFactoryItems}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
                >
                    {deletingFactoryItems ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Deleting all items...
                        </>
                    ) : (
                        <>
                            <Trash2 size={18} />
                            Delete ALL Items for {currentFactory?.name || 'Current Factory'}
                        </>
                    )}
                </button>
            </div>

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

                            const pin = prompt('Enter Supervisor PIN:');
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
                            <strong className="block mt-2">Requires Supervisor PIN</strong>
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

            {/* Invoice Diagnostics & Factory Fix */}
            <div className="bg-white border-2 border-indigo-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb  -4">
                    <div className="bg-indigo-100 p-3 rounded-lg">
                        <FileText className="text-indigo-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Invoice Diagnostics &amp; Factory Fix</h3>
                        <p className="text-sm text-slate-600">
                            Scan all <strong>Sales Invoices</strong> in Firestore (ignoring factory filters) to find invoices without a valid
                            <code className="font-mono text-xs ml-1 mr-1">factoryId</code> and assign them to the current factory.
                        </p>
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to scan invoices:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            try {
                                const allInvoicesSnap = await getDocs(collection(db, 'salesInvoices'));
                                if (allInvoicesSnap.empty) {
                                    alert('No sales invoices found in Firestore.');
                                    return;
                                }

                                const currentFactoryId = currentFactory?.id || '';
                                const orphanInvoices: { id: string; invoiceNo: string; date: string; factoryId?: string }[] = [];

                                allInvoicesSnap.forEach(docSnap => {
                                    const data = docSnap.data() as any;
                                    const factoryId = data.factoryId;
                                    if (!factoryId || factoryId === '' || factoryId === 'undefined') {
                                        orphanInvoices.push({
                                            id: docSnap.id,
                                            invoiceNo: data.invoiceNo || '(no number)',
                                            date: data.date || '(no date)',
                                            factoryId: factoryId
                                        });
                                    }
                                });

                                const totalCount = allInvoicesSnap.size;
                                if (orphanInvoices.length === 0) {
                                    alert(`Scanned ${totalCount} sales invoices.\n\n✅ No orphan invoices without factoryId were found.`);
                                    return;
                                }

                                const listPreview = orphanInvoices
                                    .slice(0, 20)
                                    .map(inv => `- ${inv.invoiceNo} (Date: ${inv.date}, Firestore ID: ${inv.id}, factoryId: ${inv.factoryId || 'N/A'})`)
                                    .join('\n');

                                const confirmFix = confirm(
                                    `Scanned ${totalCount} sales invoices.\n` +
                                    `Found ${orphanInvoices.length} invoices without a valid factoryId.\n\n` +
                                    `${listPreview}${orphanInvoices.length > 20 ? `\n... and ${orphanInvoices.length > 20 ? `\n... and ${orphanInvoices.length - 20} more` : ''}` : ''}\n\n` +
                                    `Do you want to assign ALL of these invoices to the CURRENT factory (${currentFactory?.name || 'N/A'})?`
                                );

                                if (!confirmFix || !currentFactoryId) {
                                    return;
                                }

                                let updatedCount = 0;
                                for (const inv of orphanInvoices) {
                                    await updateDoc(doc(db, 'salesInvoices', inv.id), {
                                        factoryId: currentFactoryId,
                                        updatedAt: new Date()
                                    });
                                    updatedCount++;
                                }

                                alert(
                                    `✅ Assigned ${updatedCount} orphan invoices to factory "${currentFactory?.name}".\n\n` +
                                    `Please refresh the page. These invoices will now appear under Sales Invoices (View / Update) and in the ledger for this factory.`
                                );
                            } catch (error: any) {
                                console.error('❌ Error scanning/fixing invoices:', error);
                                alert(`Error scanning/fixing invoices: ${error.message || 'Unknown error'}`);
                            }
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
                    >
                        Scan &amp; Fix Orphan Invoices
                    </button>
                </div>
            </div>

            {/* Invoice Ledger Duplicate Detection & Rebuild */}
            <div className="bg-white border-2 border-red-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-100 p-3 rounded-lg">
                        <AlertTriangle className="text-red-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Invoice Ledger Duplicate Detection &amp; Rebuild</h3>
                        <p className="text-sm text-slate-600">
                            Scan <strong>ALL ledger entries</strong> from Firestore to detect duplicate Sales Invoice postings and rebuild missing invoice headers.
                        </p>
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to scan ledger:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            setScanningLedger(true);
                            setLedgerScanResult(null);

                            try {
                                // Scan ALL ledger entries from Firestore (no factory filter)
                                const allLedgerSnap = await getDocs(collection(db, 'ledger'));
                                console.log(`📊 Scanned ${allLedgerSnap.size} total ledger entries from Firestore`);

                                // Filter for Sales Invoice transactions
                                const siEntries: LedgerEntry[] = [];
                                allLedgerSnap.forEach(docSnap => {
                                    const data = docSnap.data() as any;
                                    if (data.transactionType === TransactionType.SALES_INVOICE || 
                                        (data.transactionType === 'SI' || data.transactionType === 'Sales Invoice')) {
                                        siEntries.push({
                                            id: docSnap.id,
                                            ...data,
                                            date: data.date || '',
                                            transactionId: data.transactionId || '',
                                            transactionType: TransactionType.SALES_INVOICE,
                                            accountId: data.accountId || '',
                                            accountName: data.accountName || '',
                                            currency: data.currency || 'USD',
                                            exchangeRate: data.exchangeRate || 1,
                                            fcyAmount: data.fcyAmount || 0,
                                            debit: data.debit || 0,
                                            credit: data.credit || 0,
                                            narration: data.narration || '',
                                            factoryId: data.factoryId || ''
                                        } as LedgerEntry);
                                    }
                                });

                                console.log(`📋 Found ${siEntries.length} Sales Invoice ledger entries`);

                                // Group by transactionId
                                const byTransactionId: Record<string, LedgerEntry[]> = {};
                                siEntries.forEach(entry => {
                                    if (!byTransactionId[entry.transactionId]) {
                                        byTransactionId[entry.transactionId] = [];
                                    }
                                    byTransactionId[entry.transactionId].push(entry);
                                });

                                // Detect duplicates (same transactionId appearing multiple times with different entry sets)
                                // A normal SI transaction has 4-8 entries (Customer debit, Revenue credit, COGS debit, Inventory credit, Additional costs)
                                // If we see 2x or more entries, the invoice was likely posted multiple times
                                const duplicates: { transactionId: string; count: number; invoiceNo: string; entryCounts: number[] }[] = [];
                                Object.keys(byTransactionId).forEach(transactionId => {
                                    const entries = byTransactionId[transactionId];
                                    
                                    // Normal SI has 4-8 entries. If we see >12, it's likely duplicated (2x posting)
                                    // If we see >20, it's likely 3x or more postings
                                    if (entries.length > 12) {
                                        const invoiceNo = transactionId.replace('INV-', '').replace('DS-', '');
                                        
                                        // Group entries by creation timestamp to detect distinct posting sets
                                        // Entries from the same posting should have similar timestamps
                                        const entriesWithTime = entries.map(e => ({
                                            entry: e,
                                            time: e.id // Use Firestore doc ID as proxy (they're sequential)
                                        }));
                                        
                                        // Estimate duplicate count: normal SI has ~6 entries, so divide by 6
                                        const estimatedDuplicateCount = Math.max(2, Math.floor(entries.length / 6));
                                        
                                        duplicates.push({
                                            transactionId,
                                            count: estimatedDuplicateCount,
                                            invoiceNo,
                                            entryCounts: [entries.length]
                                        });
                                    }
                                });

                                // Find missing invoice headers (ledger entries exist but no invoice document)
                                const allInvoicesSnap = await getDocs(collection(db, 'salesInvoices'));
                                const existingInvoiceNos = new Set<string>();
                                allInvoicesSnap.forEach(docSnap => {
                                    const data = docSnap.data() as any;
                                    if (data.invoiceNo) {
                                        existingInvoiceNos.add(data.invoiceNo);
                                    }
                                });

                                // Build list of ALL invoices found (for reference)
                                const allInvoices: { transactionId: string; invoiceNo: string; entryCount: number; hasHeader: boolean }[] = [];
                                Object.keys(byTransactionId).forEach(transactionId => {
                                    const entries = byTransactionId[transactionId];
                                    const invoiceNo = transactionId.replace('INV-', '').replace('DS-', '');
                                    allInvoices.push({
                                        transactionId,
                                        invoiceNo,
                                        entryCount: entries.length,
                                        hasHeader: existingInvoiceNos.has(invoiceNo)
                                    });
                                });
                                allInvoices.sort((a, b) => {
                                    // Sort by invoice number (extract numeric part)
                                    const aNum = parseInt(a.invoiceNo.replace(/[^\d]/g, '')) || 0;
                                    const bNum = parseInt(b.invoiceNo.replace(/[^\d]/g, '')) || 0;
                                    return aNum - bNum;
                                });

                                const missingHeaders: { transactionId: string; invoiceNo: string; date: string; customerId: string; netTotal: number; factoryId: string }[] = [];
                                Object.keys(byTransactionId).forEach(transactionId => {
                                    const entries = byTransactionId[transactionId];
                                    if (entries.length === 0) return;

                                    // Extract invoice number from transactionId (INV-SINV-1005 or DS-1001)
                                    const invoiceNo = transactionId.replace('INV-', '').replace('DS-', '');
                                    
                                    // Skip if invoice header already exists
                                    if (existingInvoiceNos.has(invoiceNo)) {
                                        return;
                                    }

                                    // Find customer entry (debit entry with customer accountId)
                                    const customerEntry = entries.find(e => {
                                        // Customer entry is the debit entry that's not COGS, not revenue, not inventory
                                        return e.debit > 0 && 
                                               !e.accountName.toLowerCase().includes('revenue') &&
                                               !e.accountName.toLowerCase().includes('cogs') &&
                                               !e.accountName.toLowerCase().includes('cost of goods') &&
                                               !e.accountName.toLowerCase().includes('inventory') &&
                                               !e.accountName.toLowerCase().includes('finished goods');
                                    });

                                    if (!customerEntry) {
                                        console.warn(`⚠️ Could not find customer entry for ${transactionId}`);
                                        return;
                                    }

                                    // Get date from first entry
                                    const date = entries[0].date || '';
                                    const customerId = customerEntry.accountId;
                                    const netTotal = customerEntry.debit; // Customer debit = net total
                                    const factoryId = customerEntry.factoryId || currentFactory?.id || '';

                                    missingHeaders.push({
                                        transactionId,
                                        invoiceNo,
                                        date,
                                        customerId,
                                        netTotal,
                                        factoryId
                                    });
                                });

                                setLedgerScanResult({
                                    duplicates,
                                    missingHeaders,
                                    allInvoices,
                                    totalSITransactions: Object.keys(byTransactionId).length
                                });

                                const summary = `📊 Scan Complete:\n\n` +
                                    `Total SI Transactions Found: ${Object.keys(byTransactionId).length}\n` +
                                    `All Invoices: ${allInvoices.map(a => a.invoiceNo).join(', ')}\n\n` +
                                    `⚠️ Duplicates (Same Invoice Posted Multiple Times): ${duplicates.length}\n` +
                                    (duplicates.length > 0 ? duplicates.map(d => `- ${d.invoiceNo}: Posted ${d.count}x times (${d.entryCounts[0]} total entries)`).join('\n') + '\n\n' : '✅ No duplicates found\n\n') +
                                    `📝 Missing Invoice Headers: ${missingHeaders.length}\n` +
                                    (missingHeaders.length > 0 ? missingHeaders.slice(0, 10).map(m => `- ${m.invoiceNo} (Date: ${m.date}, Net: $${m.netTotal.toFixed(2)})`).join('\n') + (missingHeaders.length > 10 ? `\n... and ${missingHeaders.length - 10} more` : '') : '✅ All invoices have headers');

                                alert(summary);
                            } catch (error: any) {
                                console.error('❌ Error scanning ledger:', error);
                                alert(`Error scanning ledger: ${error.message || 'Unknown error'}`);
                            } finally {
                                setScanningLedger(false);
                            }
                        }}
                        disabled={scanningLedger}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                        {scanningLedger ? 'Scanning...' : 'Scan Ledger for Duplicates & Missing Headers'}
                    </button>

                    {ledgerScanResult && (
                        <div className="mt-4 space-y-4">
                            {/* All Invoices Found Section */}
                            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                                <h4 className="font-bold text-blue-900 mb-2">
                                    📋 All Invoices Found in Ledger ({ledgerScanResult.allInvoices.length}):
                                </h4>
                                <p className="text-xs text-blue-700 mb-2">
                                    These are ALL invoices that have ledger entries. If you see gaps (e.g., 1005, 1006 but no 1001-1004), 
                                    it means those invoice numbers were never posted or were deleted.
                                </p>
                                <div className="max-h-40 overflow-y-auto">
                                    <div className="flex flex-wrap gap-2">
                                        {ledgerScanResult.allInvoices.map(inv => (
                                            <span 
                                                key={inv.transactionId} 
                                                className={`text-xs px-2 py-1 rounded ${
                                                    inv.hasHeader 
                                                        ? 'bg-green-100 text-green-700 border border-green-300' 
                                                        : 'bg-amber-100 text-amber-700 border border-amber-300'
                                                }`}
                                                title={inv.hasHeader ? 'Has header document' : 'Missing header document'}
                                            >
                                                {inv.invoiceNo} {inv.hasHeader ? '✓' : '⚠'} ({inv.entryCount} entries)
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Duplicates Section */}
                            {ledgerScanResult.duplicates.length > 0 && (
                                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                                    <h4 className="font-bold text-red-900 mb-2">
                                        ⚠️ Found {ledgerScanResult.duplicates.length} Invoice(s) with Duplicate Ledger Entries:
                                    </h4>
                                    <ul className="list-disc list-inside text-sm text-red-800 mb-3">
                                        {ledgerScanResult.duplicates.map(d => (
                                            <li key={d.transactionId}>
                                                <strong>{d.invoiceNo}</strong> ({d.transactionId}): ~{d.count} duplicate sets detected
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        onClick={async () => {
                                            if (!confirm(`⚠️ This will DELETE duplicate ledger entries for ${ledgerScanResult.duplicates.length} invoice(s).\n\nOnly the FIRST set of entries will be kept. This cannot be undone.\n\nContinue?`)) {
                                                return;
                                            }

                                            const pin = prompt('Enter Supervisor PIN to remove duplicates:');
                                            if (pin !== SUPERVISOR_PIN) {
                                                alert('Invalid PIN. Operation cancelled.');
                                                return;
                                            }

                                            setRemovingDuplicates(true);

                                            try {
                                                let removedCount = 0;
                                                const batch = writeBatch(db);
                                                let batchCount = 0;

                                                for (const dup of ledgerScanResult.duplicates) {
                                                    // Get all entries for this transaction
                                                    const allEntriesSnap = await getDocs(
                                                        query(collection(db, 'ledger'), where('transactionId', '==', dup.transactionId))
                                                    );

                                                    const entries: { id: string; createdAt: any; accountName: string; debit: number }[] = [];
                                                    allEntriesSnap.forEach(docSnap => {
                                                        const data = docSnap.data();
                                                        entries.push({
                                                            id: docSnap.id,
                                                            createdAt: data.createdAt,
                                                            accountName: data.accountName || '',
                                                            debit: data.debit || 0
                                                        });
                                                    });

                                                    // Sort by creation time (oldest first)
                                                    entries.sort((a, b) => {
                                                        if (!a.createdAt || !b.createdAt) return 0;
                                                        return a.createdAt.toMillis() - b.createdAt.toMillis();
                                                    });

                                                    // Find customer debit entries (one per posting set)
                                                    // Customer entry is the debit entry that's not COGS, not revenue, not inventory
                                                    const customerEntries = entries.filter(e => 
                                                        e.debit > 0 && 
                                                        !e.accountName.toLowerCase().includes('revenue') &&
                                                        !e.accountName.toLowerCase().includes('cogs') &&
                                                        !e.accountName.toLowerCase().includes('cost of goods') &&
                                                        !e.accountName.toLowerCase().includes('inventory') &&
                                                        !e.accountName.toLowerCase().includes('finished goods') &&
                                                        !e.accountName.toLowerCase().includes('discount')
                                                    );

                                                    // Keep entries up to and including the first customer entry's set
                                                    // A normal SI has ~6 entries per set, so keep first 6-8 entries
                                                    const entriesToKeep = customerEntries.length > 0 
                                                        ? Math.min(entries.findIndex(e => e.id === customerEntries[0].id) + 8, entries.length)
                                                        : 8; // Fallback: keep first 8 if we can't find customer entry
                                                    
                                                    const entriesToDelete = entries.slice(entriesToKeep);

                                                    for (const entryToDelete of entriesToDelete) {
                                                        const entryRef = doc(db, 'ledger', entryToDelete.id);
                                                        batch.delete(entryRef);
                                                        batchCount++;
                                                        removedCount++;

                                                        if (batchCount >= 400) {
                                                            await batch.commit();
                                                            batchCount = 0;
                                                        }
                                                    }
                                                }

                                                if (batchCount > 0) {
                                                    await batch.commit();
                                                }

                                                alert(`✅ Removed ${removedCount} duplicate ledger entries.\n\nPlease refresh the page to see updated ledger.`);
                                                setLedgerScanResult(null);
                                            } catch (error: any) {
                                                console.error('❌ Error removing duplicates:', error);
                                                alert(`Error removing duplicates: ${error.message || 'Unknown error'}`);
                                            } finally {
                                                setRemovingDuplicates(false);
                                            }
                                        }}
                                        disabled={removingDuplicates}
                                        className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-semibold disabled:opacity-50"
                                    >
                                        {removingDuplicates ? 'Removing...' : 'Remove Duplicate Entries'}
                                    </button>
                                </div>
                            )}

                            {/* Missing Headers Section */}
                            {ledgerScanResult.missingHeaders.length > 0 && (
                                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                                    <h4 className="font-bold text-amber-900 mb-2">
                                        📝 Found {ledgerScanResult.missingHeaders.length} Invoice(s) with Missing Headers:
                                    </h4>
                                    <ul className="list-disc list-inside text-sm text-amber-800 mb-3 max-h-40 overflow-y-auto">
                                        {ledgerScanResult.missingHeaders.slice(0, 20).map(m => (
                                            <li key={m.transactionId}>
                                                <strong>{m.invoiceNo}</strong>: Date {m.date}, Net ${m.netTotal.toFixed(2)}
                                            </li>
                                        ))}
                                        {ledgerScanResult.missingHeaders.length > 20 && (
                                            <li className="text-amber-600 italic">... and {ledgerScanResult.missingHeaders.length - 20} more</li>
                                        )}
                                    </ul>
                                    <button
                                        onClick={async () => {
                                            if (!confirm(`This will CREATE ${ledgerScanResult.missingHeaders.length} invoice header document(s) in Firestore based on ledger entries.\n\nThese invoices will appear in Sales Invoices (View / Update) but will have minimal details (no items list).\n\nContinue?`)) {
                                                return;
                                            }

                                            const pin = prompt('Enter Supervisor PIN to rebuild invoices:');
                                            if (pin !== SUPERVISOR_PIN) {
                                                alert('Invalid PIN. Operation cancelled.');
                                                return;
                                            }

                                            setRebuildingInvoices(true);

                                            try {
                                                if (!currentFactory?.id) {
                                                    alert('❌ Error: No factory selected. Please select a factory first.');
                                                    setRebuildingInvoices(false);
                                                    return;
                                                }

                                                const batch = writeBatch(db);
                                                let batchCount = 0;
                                                let createdCount = 0;

                                                for (const missing of ledgerScanResult.missingHeaders) {
                                                    // CRITICAL: Always use current factory ID (invoices are filtered by factoryId)
                                                    // Even if ledger entry has a different factoryId, we assign to current factory
                                                    const targetFactoryId = currentFactory.id;
                                                    
                                                    // Create minimal invoice header
                                                    const invoiceRef = doc(collection(db, 'salesInvoices'));
                                                    const minimalInvoice: any = {
                                                        invoiceNo: missing.invoiceNo,
                                                        date: missing.date,
                                                        status: 'Posted', // Already posted (ledger entries exist)
                                                        customerId: missing.customerId,
                                                        factoryId: targetFactoryId, // CRITICAL: Must match current factory
                                                        currency: 'USD',
                                                        exchangeRate: 1,
                                                        customerCurrency: 'USD',
                                                        customerExchangeRate: 1,
                                                        discount: 0,
                                                        surcharge: 0,
                                                        items: [], // Empty - we can't reconstruct items from ledger alone
                                                        additionalCosts: [],
                                                        grossTotal: missing.netTotal, // Approximate
                                                        netTotal: missing.netTotal,
                                                        logoId: '',
                                                        createdAt: serverTimestamp()
                                                    };

                                                    batch.set(invoiceRef, minimalInvoice);
                                                    batchCount++;
                                                    createdCount++;

                                                    if (batchCount >= 400) {
                                                        await batch.commit();
                                                        batchCount = 0;
                                                    }
                                                }

                                                if (batchCount > 0) {
                                                    await batch.commit();
                                                }

                                                // Verify invoices were created
                                                const verifyQuery = query(
                                                    collection(db, 'salesInvoices'),
                                                    where('factoryId', '==', currentFactory?.id || '')
                                                );
                                                const verifySnap = await getDocs(verifyQuery);
                                                const createdInvoiceNos = ledgerScanResult.missingHeaders.map(m => m.invoiceNo);
                                                const foundInvoices = verifySnap.docs
                                                    .map(doc => doc.data().invoiceNo)
                                                    .filter(no => createdInvoiceNos.includes(no));
                                                
                                                const factoryWarning = ledgerScanResult.missingHeaders.some(m => 
                                                    m.factoryId && m.factoryId !== '' && m.factoryId !== currentFactory?.id
                                                ) 
                                                    ? `\n\n⚠️ Note: Some invoices were assigned to a different factory. Make sure you're viewing the correct factory.`
                                                    : '';
                                                
                                                const verificationMsg = foundInvoices.length === createdCount
                                                    ? `✅ Verified: All ${createdCount} invoices are now in Firestore.`
                                                    : `⚠️ Warning: Created ${createdCount} invoices, but only ${foundInvoices.length} found with current factory filter.`;
                                                
                                                alert(`${verificationMsg}\n\n` +
                                                    `Factory ID used: ${currentFactory?.id || 'N/A'}\n` +
                                                    `Current Factory: ${currentFactory?.name || 'N/A'}\n` +
                                                    `Created invoices: ${createdInvoiceNos.join(', ')}\n\n` +
                                                    `Please REFRESH THE PAGE (F5 or Ctrl+R) to see these invoices in Sales Invoices (View / Update).` +
                                                    factoryWarning);
                                                setLedgerScanResult(null);
                                            } catch (error: any) {
                                                console.error('❌ Error rebuilding invoices:', error);
                                                alert(`Error rebuilding invoices: ${error.message || 'Unknown error'}`);
                                            } finally {
                                                setRebuildingInvoices(false);
                                            }
                                        }}
                                        disabled={rebuildingInvoices}
                                        className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded text-xs font-semibold disabled:opacity-50"
                                    >
                                        {rebuildingInvoices ? 'Rebuilding...' : 'Rebuild Missing Invoice Headers'}
                                    </button>
                                </div>
                            )}

                            {ledgerScanResult.duplicates.length === 0 && ledgerScanResult.missingHeaders.length === 0 && (
                                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                                    <p className="text-green-800 font-semibold">✅ No issues found! All invoices have proper headers and no duplicates detected.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete All Sales Invoices (Option 2) */}
            <div className="bg-white border-2 border-orange-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-orange-100 p-3 rounded-lg">
                        <Trash2 className="text-orange-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Delete All Sales Invoices (Preserve Opening Balances)</h3>
                        <p className="text-sm text-slate-600">
                            Delete <strong>ALL Sales Invoices</strong> and their ledger entries for the current factory. 
                            This will <strong>reverse inventory reductions</strong> and <strong>restore customer balances</strong>.
                            <br />
                            <strong className="text-green-700">✅ Opening balances (partners & items) will be preserved.</strong>
                        </p>
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                        <p className="text-sm font-semibold text-amber-900 mb-2">
                            ⚠️ This will delete:
                        </p>
                        <ul className="list-disc list-inside text-xs text-amber-800 mb-2 space-y-1">
                            <li>All Sales Invoices (Posted and Unposted) for current factory</li>
                            <li>All ledger entries with <code className="bg-amber-100 px-1 rounded">transactionType = SALES_INVOICE</code></li>
                            <li>Inventory reductions will be reversed (stock restored)</li>
                            <li>Customer AR balances will be reversed</li>
                        </ul>
                        <p className="text-sm font-semibold text-green-700 mt-2">
                            ✅ This will NOT delete:
                        </p>
                        <ul className="list-disc list-inside text-xs text-green-800 mb-2 space-y-1">
                            <li>Opening balance ledger entries (<code className="bg-green-100 px-1 rounded">transactionType = OPENING_BALANCE</code>)</li>
                            <li>Partner opening balances (stored in partner documents)</li>
                            <li>Item opening stock entries</li>
                            <li>Purchases, Productions, or other transactions</li>
                        </ul>
                        <p className="text-xs text-amber-700 mt-2">
                            <strong>Requires Supervisor PIN</strong>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            if (!currentFactory?.id) {
                                alert('❌ Please select a factory first.');
                                return;
                            }

                            const pin = prompt('Enter Supervisor PIN to delete ALL Sales Invoices:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            const confirmText = prompt(
                                `⚠️ WARNING: This will delete ALL Sales Invoices for factory "${currentFactory.name}".\n\n` +
                                `This action:\n` +
                                `- Deletes all Sales Invoice documents\n` +
                                `- Deletes all SALES_INVOICE ledger entries\n` +
                                `- Restores inventory stock\n` +
                                `- Reverses customer balances\n\n` +
                                `Opening balances will be preserved.\n\n` +
                                `Type "DELETE ALL SALES INVOICES" to confirm:`
                            );

                            if (confirmText !== 'DELETE ALL SALES INVOICES') {
                                alert('Confirmation text does not match. Operation cancelled.');
                                return;
                            }

                            setDeletingAllSalesInvoices(true);
                            setDeleteAllSIResult(null);

                            try {
                                const errors: string[] = [];
                                let deletedInvoices = 0;
                                let deletedLedgerEntries = 0;
                                let restoredStockItems = 0;
                                let restoredCustomerBalances = 0;

                                // Step 1: Get all sales invoices for current factory
                                const invoicesQuery = query(
                                    collection(db, 'salesInvoices'),
                                    where('factoryId', '==', currentFactory.id)
                                );
                                const invoicesSnap = await getDocs(invoicesQuery);
                                
                                if (invoicesSnap.empty) {
                                    setDeleteAllSIResult({
                                        success: true,
                                        message: 'No sales invoices found for this factory.',
                                        deleted: 0,
                                        errors: []
                                    });
                                    setDeletingAllSalesInvoices(false);
                                    return;
                                }

                                const invoices: any[] = [];
                                invoicesSnap.forEach(docSnap => {
                                    invoices.push({ id: docSnap.id, ...docSnap.data() });
                                });

                                console.log(`📋 Found ${invoices.length} sales invoices to delete`);

                                // Step 2: Process each invoice (delete ledger entries, restore stock/balances, then delete invoice)
                                for (let i = 0; i < invoices.length; i++) {
                                    const invoice = invoices[i];
                                    
                                    try {
                                        // Delete ledger entries for this invoice
                                        const transactionId = invoice.invoiceNo.startsWith('DS-') 
                                            ? `DS-${invoice.invoiceNo}` 
                                            : `INV-${invoice.invoiceNo}`;
                                        
                                        // Query ALL ledger entries for this transactionId (regardless of factoryId)
                                        // This ensures old entries without factoryId are also deleted
                                        const ledgerQuery = query(
                                            collection(db, 'ledger'),
                                            where('transactionId', '==', transactionId)
                                        );
                                        const ledgerSnap = await getDocs(ledgerQuery);
                                        
                                        const batch = writeBatch(db);
                                        let batchCount = 0;

                                        // Delete ledger entries
                                        ledgerSnap.forEach(docSnap => {
                                            batch.delete(docSnap.ref);
                                            batchCount++;
                                            deletedLedgerEntries++;
                                        });

                                        // Restore inventory stock (if invoice was posted)
                                        if (invoice.status === 'Posted' && invoice.items && invoice.items.length > 0) {
                                            for (const soldItem of invoice.items) {
                                                if (soldItem.itemId && soldItem.qty) {
                                                    try {
                                                        const itemRef = doc(db, 'items', soldItem.itemId);
                                                        const itemDoc = await getDoc(itemRef);
                                                        
                                                        if (itemDoc.exists()) {
                                                            const currentStock = itemDoc.data().stockQty || 0;
                                                            batch.update(itemRef, { stockQty: currentStock + soldItem.qty });
                                                            batchCount++;
                                                            restoredStockItems++;
                                                        }
                                                    } catch (error: any) {
                                                        errors.push(`Failed to restore stock for item ${soldItem.itemId}: ${error.message}`);
                                                    }
                                                }
                                            }
                                        }

                                        // Restore customer balance (if invoice was posted)
                                        if (invoice.status === 'Posted' && invoice.customerId && invoice.netTotal) {
                                            try {
                                                const customerRef = doc(db, 'partners', invoice.customerId);
                                                const customerDoc = await getDoc(customerRef);
                                                
                                                if (customerDoc.exists()) {
                                                    const currentBalance = customerDoc.data().balance || 0;
                                                    batch.update(customerRef, { balance: currentBalance - invoice.netTotal });
                                                    batchCount++;
                                                    restoredCustomerBalances++;
                                                }
                                            } catch (error: any) {
                                                errors.push(`Failed to restore balance for customer ${invoice.customerId}: ${error.message}`);
                                            }
                                        }

                                        // Delete the invoice document
                                        const invoiceRef = doc(db, 'salesInvoices', invoice.id);
                                        batch.delete(invoiceRef);
                                        batchCount++;
                                        deletedInvoices++;

                                        // Commit batch (Firebase limit is 500 operations per batch)
                                        if (batchCount > 0) {
                                            await batch.commit();
                                        }

                                        // Small delay every 10 invoices to avoid rate limiting
                                        if ((i + 1) % 10 === 0) {
                                            await new Promise(resolve => setTimeout(resolve, 200));
                                        }

                                        console.log(`✅ Deleted invoice ${invoice.invoiceNo} (${i + 1}/${invoices.length})`);
                                    } catch (error: any) {
                                        console.error(`❌ Error processing invoice ${invoice.invoiceNo}:`, error);
                                        errors.push(`Invoice ${invoice.invoiceNo}: ${error.message || 'Unknown error'}`);
                                    }
                                }

                                // Step 3: Update local state (remove deleted invoices from state)
                                // This will happen automatically via Firebase listener, but we can also dispatch
                                // Note: The Firebase listener will update state automatically

                                const successMsg = `✅ Successfully deleted ${deletedInvoices} sales invoice(s).\n\n` +
                                    `- Deleted ${deletedLedgerEntries} ledger entries\n` +
                                    `- Restored stock for ${restoredStockItems} item(s)\n` +
                                    `- Restored balances for ${restoredCustomerBalances} customer(s)\n\n` +
                                    (errors.length > 0 ? `⚠️ ${errors.length} error(s) occurred (see console for details).\n\n` : '') +
                                    `Please refresh the page (F5) to see updated data.`;

                                setDeleteAllSIResult({
                                    success: errors.length === 0,
                                    message: successMsg,
                                    deleted: deletedInvoices,
                                    errors
                                });

                                alert(successMsg);
                            } catch (error: any) {
                                console.error('❌ Error deleting all sales invoices:', error);
                                setDeleteAllSIResult({
                                    success: false,
                                    message: `Error: ${error.message || 'Unknown error'}`,
                                    deleted: 0,
                                    errors: [error.message || 'Unknown error']
                                });
                                alert(`❌ Error deleting sales invoices: ${error.message || 'Unknown error'}`);
                            } finally {
                                setDeletingAllSalesInvoices(false);
                            }
                        }}
                        disabled={deletingAllSalesInvoices || !currentFactory}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                        {deletingAllSalesInvoices ? 'Deleting...' : `Delete All Sales Invoices (${state.salesInvoices.filter(inv => inv.factoryId === currentFactory?.id).length} found)`}
                    </button>

                    {deleteAllSIResult && (
                        <div className={`mt-4 p-4 rounded-lg border-2 ${
                            deleteAllSIResult.success 
                                ? 'bg-green-50 border-green-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <p className={`font-semibold ${
                                deleteAllSIResult.success ? 'text-green-800' : 'text-red-800'
                            }`}>
                                {deleteAllSIResult.success ? '✅ Success' : '❌ Errors Occurred'}
                            </p>
                            <p className="text-sm text-slate-700 mt-2 whitespace-pre-line">
                                {deleteAllSIResult.message}
                            </p>
                            {deleteAllSIResult.errors.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs font-semibold text-red-700">Errors:</p>
                                    <ul className="list-disc list-inside text-xs text-red-600 mt-1">
                                        {deleteAllSIResult.errors.slice(0, 10).map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                        {deleteAllSIResult.errors.length > 10 && (
                                            <li>... and {deleteAllSIResult.errors.length - 10} more errors</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Fix Division IDs Section */}
            <div className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-3 rounded-lg">
                        <RefreshCw className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Fix Division IDs</h3>
                        <p className="text-sm text-slate-600">Rename all Divisions to use DIV-1001, DIV-1002 format instead of random IDs</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-blue-900 mb-2">
                            Current Divisions: {state.divisions.length}
                        </p>
                        <p className="text-xs text-blue-700">
                            This will rename all Divisions to use sequential IDs (DIV-1001, DIV-1002, etc.) and update all references in:
                            <ul className="list-disc list-inside mt-1">
                                <li>Partners (divisionId)</li>
                                <li>Purchases (divisionId)</li>
                                <li>Sub Divisions (divisionId - parent reference)</li>
                            </ul>
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>⚠️ Warning:</strong> This operation will:
                            <ul className="list-disc list-inside mt-1">
                                <li>Create new Division documents with new IDs</li>
                                <li>Update all references in related collections</li>
                                <li>Delete old Division documents</li>
                            </ul>
                            <strong className="block mt-2">Requires Supervisor PIN</strong>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to proceed:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            const divisionsToFix = state.divisions.filter(d => !d.id.match(/^DIV-\d+$/));
                            if (divisionsToFix.length === 0) {
                                alert('All Divisions already have correct IDs (DIV-XXXX format).');
                                return;
                            }

                            if (!confirm(`This will rename ${divisionsToFix.length} Divisions. Continue?`)) {
                                return;
                            }

                            setFixingDivisions(true);
                            setDivisionFixResult(null);

                            try {
                                const errors: string[] = [];
                                let updated = 0;
                                const idMapping: Record<string, string> = {};

                                // Step 1: Generate new IDs for all Divisions
                                const divisionsToRename = state.divisions
                                    .filter(d => !d.id.match(/^DIV-\d+$/))
                                    .sort((a, b) => a.name.localeCompare(b.name));

                                const existingDivIds = state.divisions
                                    .filter(d => d.id.match(/^DIV-\d+$/))
                                    .map(d => {
                                        const match = d.id.match(/^DIV-(\d+)$/);
                                        return match ? parseInt(match[1]) : 0;
                                    })
                                    .filter(n => n > 0)
                                    .sort((a, b) => b - a);

                                let nextNumber = existingDivIds.length > 0 ? existingDivIds[0] + 1 : 1001;

                                divisionsToRename.forEach(d => {
                                    const newId = `DIV-${String(nextNumber).padStart(4, '0')}`;
                                    idMapping[d.id] = newId;
                                    nextNumber++;
                                });

                                console.log(`📋 Division ID Mapping:`, idMapping);
                                console.log(`📊 Will rename ${divisionsToRename.length} Divisions`);

                                // Step 2: Create new documents with new IDs
                                const batch = writeBatch(db);
                                let batchCount = 0;
                                const BATCH_SIZE = 500;

                                for (const oldDiv of divisionsToRename) {
                                    const newId = idMapping[oldDiv.id];
                                    if (!newId) continue;

                                    const { id, ...divData } = oldDiv;
                                    const newDivRef = doc(db, 'divisions', newId);
                                    batch.set(newDivRef, {
                                        ...divData,
                                        createdAt: divData.createdAt || new Date(),
                                        updatedAt: new Date()
                                    });

                                    batchCount++;
                                    if (batchCount >= BATCH_SIZE) {
                                        await batch.commit();
                                        console.log(`✅ Committed batch: ${batchCount} new Divisions created`);
                                        batchCount = 0;
                                    }
                                }

                                if (batchCount > 0) {
                                    await batch.commit();
                                    console.log(`✅ Committed final batch: ${batchCount} new Divisions created`);
                                }

                                // Step 3: Update all references in partners
                                console.log('🔄 Updating partners...');
                                const partnersQuery = query(
                                    collection(db, 'partners'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const partnersSnapshot = await getDocs(partnersQuery);
                                const partnersBatch = writeBatch(db);
                                let partnerUpdates = 0;

                                partnersSnapshot.docs.forEach(docSnapshot => {
                                    const partner = docSnapshot.data();
                                    let needsUpdate = false;
                                    const updates: any = {};

                                    if (partner.divisionId && idMapping[partner.divisionId]) {
                                        updates.divisionId = idMapping[partner.divisionId];
                                        needsUpdate = true;
                                    }

                                    if (needsUpdate) {
                                        partnersBatch.update(docSnapshot.ref, updates);
                                        partnerUpdates++;
                                    }
                                });

                                if (partnerUpdates > 0) {
                                    await partnersBatch.commit();
                                    console.log(`✅ Updated ${partnerUpdates} partners`);
                                }

                                // Step 4: Update all references in purchases
                                console.log('🔄 Updating purchases...');
                                const purchasesQuery = query(
                                    collection(db, 'purchases'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const purchasesSnapshot = await getDocs(purchasesQuery);
                                const purchasesBatch = writeBatch(db);
                                let purchaseUpdates = 0;

                                purchasesSnapshot.docs.forEach(docSnapshot => {
                                    const purchase = docSnapshot.data();
                                    let needsUpdate = false;
                                    const updates: any = {};

                                    if (purchase.divisionId && idMapping[purchase.divisionId]) {
                                        updates.divisionId = idMapping[purchase.divisionId];
                                        needsUpdate = true;
                                    }

                                    if (needsUpdate) {
                                        purchasesBatch.update(docSnapshot.ref, updates);
                                        purchaseUpdates++;
                                    }
                                });

                                if (purchaseUpdates > 0) {
                                    await purchasesBatch.commit();
                                    console.log(`✅ Updated ${purchaseUpdates} purchases`);
                                }

                                // Step 5: Update all references in subDivisions (parent reference)
                                console.log('🔄 Updating subDivisions...');
                                const subDivisionsQuery = query(
                                    collection(db, 'subDivisions'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const subDivisionsSnapshot = await getDocs(subDivisionsQuery);
                                const subDivisionsBatch = writeBatch(db);
                                let subDivisionUpdates = 0;

                                subDivisionsSnapshot.docs.forEach(docSnapshot => {
                                    const subDiv = docSnapshot.data();
                                    if (subDiv.divisionId && idMapping[subDiv.divisionId]) {
                                        subDivisionsBatch.update(docSnapshot.ref, {
                                            divisionId: idMapping[subDiv.divisionId]
                                        });
                                        subDivisionUpdates++;
                                    }
                                });

                                if (subDivisionUpdates > 0) {
                                    await subDivisionsBatch.commit();
                                    console.log(`✅ Updated ${subDivisionUpdates} subDivisions`);
                                }

                                // Step 6: Delete old Division documents
                                console.log('🗑️ Deleting old Division documents...');
                                const deleteBatch = writeBatch(db);
                                let deleteCount = 0;

                                for (const oldDiv of divisionsToRename) {
                                    const oldDivRef = doc(db, 'divisions', oldDiv.id);
                                    deleteBatch.delete(oldDivRef);
                                    deleteCount++;

                                    if (deleteCount >= BATCH_SIZE) {
                                        await deleteBatch.commit();
                                        console.log(`✅ Deleted batch: ${deleteCount} old Divisions`);
                                        deleteCount = 0;
                                    }
                                }

                                if (deleteCount > 0) {
                                    await deleteBatch.commit();
                                    console.log(`✅ Deleted final batch: ${deleteCount} old Divisions`);
                                }

                                updated = divisionsToRename.length;

                                setDivisionFixResult({
                                    success: true,
                                    message: `Successfully renamed ${updated} Divisions!\n\n- Created ${updated} new documents\n- Updated ${partnerUpdates} partners\n- Updated ${purchaseUpdates} purchases\n- Updated ${subDivisionUpdates} subDivisions\n- Deleted ${updated} old documents`,
                                    updated,
                                    errors
                                });

                                setTimeout(() => {
                                    window.location.reload();
                                }, 5000);

                            } catch (error: any) {
                                console.error('❌ Error fixing Division IDs:', error);
                                setDivisionFixResult({
                                    success: false,
                                    message: `Failed: ${error.message}`,
                                    updated: 0,
                                    errors: [error.message]
                                });
                            } finally {
                                setFixingDivisions(false);
                            }
                        }}
                        disabled={fixingDivisions || state.divisions.length === 0}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {fixingDivisions ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Renaming Divisions...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} />
                                Fix Division IDs ({state.divisions.filter(d => !d.id.match(/^DIV-\d+$/)).length} need fixing)
                            </>
                        )}
                    </button>

                    {divisionFixResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            divisionFixResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {divisionFixResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <XCircle className="text-red-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    divisionFixResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {divisionFixResult.success ? 'Fix Successful!' : 'Fix Failed'}
                                </span>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${
                                divisionFixResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {divisionFixResult.message}
                            </p>
                            {divisionFixResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-600">
                                    <strong>Errors:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {divisionFixResult.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                        {divisionFixResult.errors.length > 5 && (
                                            <li>... and {divisionFixResult.errors.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            {divisionFixResult.success && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Page will refresh automatically in 5 seconds...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Fix Sub Division IDs Section */}
            <div className="bg-white border-2 border-indigo-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-indigo-100 p-3 rounded-lg">
                        <RefreshCw className="text-indigo-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Fix Sub Division IDs</h3>
                        <p className="text-sm text-slate-600">Rename all Sub Divisions to use SDIV-1001, SDIV-1002 format instead of random IDs</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-indigo-900 mb-2">
                            Current Sub Divisions: {state.subDivisions.length}
                        </p>
                        <p className="text-xs text-indigo-700">
                            This will rename all Sub Divisions to use sequential IDs (SDIV-1001, SDIV-1002, etc.) and update all references in:
                            <ul className="list-disc list-inside mt-1">
                                <li>Partners (subDivisionId)</li>
                                <li>Purchases (subDivisionId)</li>
                            </ul>
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>⚠️ Warning:</strong> This operation will:
                            <ul className="list-disc list-inside mt-1">
                                <li>Create new Sub Division documents with new IDs</li>
                                <li>Update all references in related collections</li>
                                <li>Delete old Sub Division documents</li>
                            </ul>
                            <strong className="block mt-2">Requires Supervisor PIN</strong>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to proceed:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            const subDivisionsToFix = state.subDivisions.filter(sd => !sd.id.match(/^SDIV-\d+$/));
                            if (subDivisionsToFix.length === 0) {
                                alert('All Sub Divisions already have correct IDs (SDIV-XXXX format).');
                                return;
                            }

                            if (!confirm(`This will rename ${subDivisionsToFix.length} Sub Divisions. Continue?`)) {
                                return;
                            }

                            setFixingSubDivisions(true);
                            setSubDivisionFixResult(null);

                            try {
                                const errors: string[] = [];
                                let updated = 0;
                                const idMapping: Record<string, string> = {};

                                // Step 1: Generate new IDs for all Sub Divisions
                                const subDivisionsToRename = state.subDivisions
                                    .filter(sd => !sd.id.match(/^SDIV-\d+$/))
                                    .sort((a, b) => a.name.localeCompare(b.name));

                                const existingSubDivIds = state.subDivisions
                                    .filter(sd => sd.id.match(/^SDIV-\d+$/))
                                    .map(sd => {
                                        const match = sd.id.match(/^SDIV-(\d+)$/);
                                        return match ? parseInt(match[1]) : 0;
                                    })
                                    .filter(n => n > 0)
                                    .sort((a, b) => b - a);

                                let nextNumber = existingSubDivIds.length > 0 ? existingSubDivIds[0] + 1 : 1001;

                                subDivisionsToRename.forEach(sd => {
                                    const newId = `SDIV-${String(nextNumber).padStart(4, '0')}`;
                                    idMapping[sd.id] = newId;
                                    nextNumber++;
                                });

                                console.log(`📋 Sub Division ID Mapping:`, idMapping);
                                console.log(`📊 Will rename ${subDivisionsToRename.length} Sub Divisions`);

                                // Step 2: Create new documents with new IDs
                                const batch = writeBatch(db);
                                let batchCount = 0;
                                const BATCH_SIZE = 500;

                                for (const oldSubDiv of subDivisionsToRename) {
                                    const newId = idMapping[oldSubDiv.id];
                                    if (!newId) continue;

                                    const { id, ...subDivData } = oldSubDiv;
                                    const newSubDivRef = doc(db, 'subDivisions', newId);
                                    batch.set(newSubDivRef, {
                                        ...subDivData,
                                        createdAt: subDivData.createdAt || new Date(),
                                        updatedAt: new Date()
                                    });

                                    batchCount++;
                                    if (batchCount >= BATCH_SIZE) {
                                        await batch.commit();
                                        console.log(`✅ Committed batch: ${batchCount} new Sub Divisions created`);
                                        batchCount = 0;
                                    }
                                }

                                if (batchCount > 0) {
                                    await batch.commit();
                                    console.log(`✅ Committed final batch: ${batchCount} new Sub Divisions created`);
                                }

                                // Step 3: Update all references in partners
                                console.log('🔄 Updating partners...');
                                const partnersQuery = query(
                                    collection(db, 'partners'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const partnersSnapshot = await getDocs(partnersQuery);
                                const partnersBatch = writeBatch(db);
                                let partnerUpdates = 0;

                                partnersSnapshot.docs.forEach(docSnapshot => {
                                    const partner = docSnapshot.data();
                                    let needsUpdate = false;
                                    const updates: any = {};

                                    if (partner.subDivisionId && idMapping[partner.subDivisionId]) {
                                        updates.subDivisionId = idMapping[partner.subDivisionId];
                                        needsUpdate = true;
                                    }

                                    if (needsUpdate) {
                                        partnersBatch.update(docSnapshot.ref, updates);
                                        partnerUpdates++;
                                    }
                                });

                                if (partnerUpdates > 0) {
                                    await partnersBatch.commit();
                                    console.log(`✅ Updated ${partnerUpdates} partners`);
                                }

                                // Step 4: Update all references in purchases
                                console.log('🔄 Updating purchases...');
                                const purchasesQuery = query(
                                    collection(db, 'purchases'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const purchasesSnapshot = await getDocs(purchasesQuery);
                                const purchasesBatch = writeBatch(db);
                                let purchaseUpdates = 0;

                                purchasesSnapshot.docs.forEach(docSnapshot => {
                                    const purchase = docSnapshot.data();
                                    let needsUpdate = false;
                                    const updates: any = {};

                                    if (purchase.subDivisionId && idMapping[purchase.subDivisionId]) {
                                        updates.subDivisionId = idMapping[purchase.subDivisionId];
                                        needsUpdate = true;
                                    }

                                    if (needsUpdate) {
                                        purchasesBatch.update(docSnapshot.ref, updates);
                                        purchaseUpdates++;
                                    }
                                });

                                if (purchaseUpdates > 0) {
                                    await purchasesBatch.commit();
                                    console.log(`✅ Updated ${purchaseUpdates} purchases`);
                                }

                                // Step 5: Delete old Sub Division documents
                                console.log('🗑️ Deleting old Sub Division documents...');
                                const deleteBatch = writeBatch(db);
                                let deleteCount = 0;

                                for (const oldSubDiv of subDivisionsToRename) {
                                    const oldSubDivRef = doc(db, 'subDivisions', oldSubDiv.id);
                                    deleteBatch.delete(oldSubDivRef);
                                    deleteCount++;

                                    if (deleteCount >= BATCH_SIZE) {
                                        await deleteBatch.commit();
                                        console.log(`✅ Deleted batch: ${deleteCount} old Sub Divisions`);
                                        deleteCount = 0;
                                    }
                                }

                                if (deleteCount > 0) {
                                    await deleteBatch.commit();
                                    console.log(`✅ Deleted final batch: ${deleteCount} old Sub Divisions`);
                                }

                                updated = subDivisionsToRename.length;

                                setSubDivisionFixResult({
                                    success: true,
                                    message: `Successfully renamed ${updated} Sub Divisions!\n\n- Created ${updated} new documents\n- Updated ${partnerUpdates} partners\n- Updated ${purchaseUpdates} purchases\n- Deleted ${updated} old documents`,
                                    updated,
                                    errors
                                });

                                setTimeout(() => {
                                    window.location.reload();
                                }, 5000);

                            } catch (error: any) {
                                console.error('❌ Error fixing Sub Division IDs:', error);
                                setSubDivisionFixResult({
                                    success: false,
                                    message: `Failed: ${error.message}`,
                                    updated: 0,
                                    errors: [error.message]
                                });
                            } finally {
                                setFixingSubDivisions(false);
                            }
                        }}
                        disabled={fixingSubDivisions || state.subDivisions.length === 0}
                        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {fixingSubDivisions ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Renaming Sub Divisions...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} />
                                Fix Sub Division IDs ({state.subDivisions.filter(sd => !sd.id.match(/^SDIV-\d+$/)).length} need fixing)
                            </>
                        )}
                    </button>

                    {subDivisionFixResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            subDivisionFixResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {subDivisionFixResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <XCircle className="text-red-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    subDivisionFixResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {subDivisionFixResult.success ? 'Fix Successful!' : 'Fix Failed'}
                                </span>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${
                                subDivisionFixResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {subDivisionFixResult.message}
                            </p>
                            {subDivisionFixResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-600">
                                    <strong>Errors:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {subDivisionFixResult.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                        {subDivisionFixResult.errors.length > 5 && (
                                            <li>... and {subDivisionFixResult.errors.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            {subDivisionFixResult.success && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Page will refresh automatically in 5 seconds...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Fix Original Product IDs Section */}
            <div className="bg-white border-2 border-teal-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-teal-100 p-3 rounded-lg">
                        <RefreshCw className="text-teal-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Fix Original Product IDs</h3>
                        <p className="text-sm text-slate-600">Rename all Original Products to use ORP-1001, ORP-1002 format instead of random IDs</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-teal-900 mb-2">
                            Current Original Products: {state.originalProducts.length}
                        </p>
                        <p className="text-xs text-teal-700">
                            This will rename all Original Products to use sequential IDs (ORP-1001, ORP-1002, etc.) and update all references in:
                            <ul className="list-disc list-inside mt-1">
                                <li>Purchases (originalProductId)</li>
                                <li>Purchase Items (originalProductId)</li>
                            </ul>
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>⚠️ Warning:</strong> This operation will:
                            <ul className="list-disc list-inside mt-1">
                                <li>Create new Original Product documents with new IDs</li>
                                <li>Update all references in related collections</li>
                                <li>Delete old Original Product documents</li>
                            </ul>
                            <strong className="block mt-2">Requires Supervisor PIN</strong>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to proceed:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            const originalProductsToFix = state.originalProducts.filter(op => !op.id.match(/^ORP-\d+$/));
                            if (originalProductsToFix.length === 0) {
                                alert('All Original Products already have correct IDs (ORP-XXXX format).');
                                return;
                            }

                            if (!confirm(`This will rename ${originalProductsToFix.length} Original Products. Continue?`)) {
                                return;
                            }

                            setFixingOriginalProducts(true);
                            setOriginalProductFixResult(null);

                            try {
                                const errors: string[] = [];
                                let updated = 0;
                                const idMapping: Record<string, string> = {};

                                // Step 1: Generate new IDs for all Original Products
                                const originalProductsToRename = state.originalProducts
                                    .filter(op => !op.id.match(/^ORP-\d+$/))
                                    .sort((a, b) => a.name.localeCompare(b.name));

                                const existingOrpIds = state.originalProducts
                                    .filter(op => op.id.match(/^ORP-\d+$/))
                                    .map(op => {
                                        const match = op.id.match(/^ORP-(\d+)$/);
                                        return match ? parseInt(match[1]) : 0;
                                    })
                                    .filter(n => n > 0)
                                    .sort((a, b) => b - a);

                                let nextNumber = existingOrpIds.length > 0 ? existingOrpIds[0] + 1 : 1001;

                                originalProductsToRename.forEach(op => {
                                    const newId = `ORP-${String(nextNumber).padStart(4, '0')}`;
                                    idMapping[op.id] = newId;
                                    nextNumber++;
                                });

                                console.log(`📋 Original Product ID Mapping:`, idMapping);
                                console.log(`📊 Will rename ${originalProductsToRename.length} Original Products`);

                                // Step 2: Create new documents with new IDs
                                const batch = writeBatch(db);
                                let batchCount = 0;
                                const BATCH_SIZE = 500;

                                for (const oldProduct of originalProductsToRename) {
                                    const newId = idMapping[oldProduct.id];
                                    if (!newId) continue;

                                    const { id, ...productData } = oldProduct;
                                    const newProductRef = doc(db, 'originalProducts', newId);
                                    batch.set(newProductRef, {
                                        ...productData,
                                        createdAt: productData.createdAt || new Date(),
                                        updatedAt: new Date()
                                    });

                                    batchCount++;
                                    if (batchCount >= BATCH_SIZE) {
                                        await batch.commit();
                                        console.log(`✅ Committed batch: ${batchCount} new Original Products created`);
                                        batchCount = 0;
                                    }
                                }

                                if (batchCount > 0) {
                                    await batch.commit();
                                    console.log(`✅ Committed final batch: ${batchCount} new Original Products created`);
                                }

                                // Step 3: Update all references in purchases
                                console.log('🔄 Updating purchases...');
                                const purchasesQuery = query(
                                    collection(db, 'purchases'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const purchasesSnapshot = await getDocs(purchasesQuery);
                                const purchasesBatch = writeBatch(db);
                                let purchaseUpdates = 0;

                                purchasesSnapshot.docs.forEach(docSnapshot => {
                                    const purchase = docSnapshot.data();
                                    let needsUpdate = false;
                                    const updates: any = {};

                                    // Update originalProductId (legacy field)
                                    if (purchase.originalProductId && idMapping[purchase.originalProductId]) {
                                        updates.originalProductId = idMapping[purchase.originalProductId];
                                        needsUpdate = true;
                                    }

                                    // Update items array (originalProductId in each item)
                                    if (purchase.items && Array.isArray(purchase.items)) {
                                        const updatedItems = purchase.items.map((item: any) => {
                                            if (item.originalProductId && idMapping[item.originalProductId]) {
                                                return { ...item, originalProductId: idMapping[item.originalProductId] };
                                            }
                                            return item;
                                        });
                                        if (JSON.stringify(updatedItems) !== JSON.stringify(purchase.items)) {
                                            updates.items = updatedItems;
                                            needsUpdate = true;
                                        }
                                    }

                                    if (needsUpdate) {
                                        purchasesBatch.update(docSnapshot.ref, updates);
                                        purchaseUpdates++;
                                    }
                                });

                                if (purchaseUpdates > 0) {
                                    await purchasesBatch.commit();
                                    console.log(`✅ Updated ${purchaseUpdates} purchases`);
                                }

                                // Step 4: Delete old Original Product documents
                                console.log('🗑️ Deleting old Original Product documents...');
                                const deleteBatch = writeBatch(db);
                                let deleteCount = 0;

                                for (const oldProduct of originalProductsToRename) {
                                    const oldProductRef = doc(db, 'originalProducts', oldProduct.id);
                                    deleteBatch.delete(oldProductRef);
                                    deleteCount++;

                                    if (deleteCount >= BATCH_SIZE) {
                                        await deleteBatch.commit();
                                        console.log(`✅ Deleted batch: ${deleteCount} old Original Products`);
                                        deleteCount = 0;
                                    }
                                }

                                if (deleteCount > 0) {
                                    await deleteBatch.commit();
                                    console.log(`✅ Deleted final batch: ${deleteCount} old Original Products`);
                                }

                                updated = originalProductsToRename.length;

                                setOriginalProductFixResult({
                                    success: true,
                                    message: `Successfully renamed ${updated} Original Products!\n\n- Created ${updated} new documents\n- Updated ${purchaseUpdates} purchases\n- Deleted ${updated} old documents`,
                                    updated,
                                    errors
                                });

                                setTimeout(() => {
                                    window.location.reload();
                                }, 5000);

                            } catch (error: any) {
                                console.error('❌ Error fixing Original Product IDs:', error);
                                setOriginalProductFixResult({
                                    success: false,
                                    message: `Failed: ${error.message}`,
                                    updated: 0,
                                    errors: [error.message]
                                });
                            } finally {
                                setFixingOriginalProducts(false);
                            }
                        }}
                        disabled={fixingOriginalProducts || state.originalProducts.length === 0}
                        className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {fixingOriginalProducts ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Renaming Original Products...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} />
                                Fix Original Product IDs ({state.originalProducts.filter(op => !op.id.match(/^ORP-\d+$/)).length} need fixing)
                            </>
                        )}
                    </button>

                    {originalProductFixResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            originalProductFixResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {originalProductFixResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <XCircle className="text-red-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    originalProductFixResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {originalProductFixResult.success ? 'Fix Successful!' : 'Fix Failed'}
                                </span>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${
                                originalProductFixResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {originalProductFixResult.message}
                            </p>
                            {originalProductFixResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-600">
                                    <strong>Errors:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {originalProductFixResult.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                        {originalProductFixResult.errors.length > 5 && (
                                            <li>... and {originalProductFixResult.errors.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            {originalProductFixResult.success && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Page will refresh automatically in 5 seconds...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Fix Category IDs Section */}
            <div className="bg-white border-2 border-purple-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-purple-100 p-3 rounded-lg">
                        <RefreshCw className="text-purple-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Fix Category IDs</h3>
                        <p className="text-sm text-slate-600">Rename all Categories to use CAT-1001, CAT-1002 format instead of random IDs</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-purple-900 mb-2">
                            Current Categories: {state.categories.length}
                        </p>
                        <p className="text-xs text-purple-700">
                            This will rename all Categories to use sequential IDs (CAT-1001, CAT-1002, etc.) and update all references in:
                            <ul className="list-disc list-inside mt-1">
                                <li>Items (category field)</li>
                            </ul>
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>⚠️ Warning:</strong> This operation will:
                            <ul className="list-disc list-inside mt-1">
                                <li>Create new Category documents with new IDs</li>
                                <li>Update all references in Items collection</li>
                                <li>Delete old Category documents</li>
                            </ul>
                            <strong className="block mt-2">Requires Supervisor PIN</strong>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to proceed:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            const categoriesToFix = state.categories.filter(c => !c.id.match(/^CAT-\d+$/));
                            if (categoriesToFix.length === 0) {
                                alert('All Categories already have correct IDs (CAT-XXXX format).');
                                return;
                            }

                            if (!confirm(`This will rename ${categoriesToFix.length} Categories. Continue?`)) {
                                return;
                            }

                            setFixingCategories(true);
                            setCategoryFixResult(null);

                            try {
                                const errors: string[] = [];
                                let updated = 0;
                                const idMapping: Record<string, string> = {};

                                // Step 1: Generate new IDs for all Categories
                                const categoriesToRename = state.categories
                                    .filter(c => !c.id.match(/^CAT-\d+$/))
                                    .sort((a, b) => a.name.localeCompare(b.name));

                                const existingCatIds = state.categories
                                    .filter(c => c.id.match(/^CAT-\d+$/))
                                    .map(c => {
                                        const match = c.id.match(/^CAT-(\d+)$/);
                                        return match ? parseInt(match[1]) : 0;
                                    })
                                    .filter(n => n > 0)
                                    .sort((a, b) => b - a);

                                let nextNumber = existingCatIds.length > 0 ? existingCatIds[0] + 1 : 1001;

                                categoriesToRename.forEach(c => {
                                    const newId = `CAT-${String(nextNumber).padStart(4, '0')}`;
                                    idMapping[c.id] = newId;
                                    nextNumber++;
                                });

                                console.log(`📋 Category ID Mapping:`, idMapping);
                                console.log(`📊 Will rename ${categoriesToRename.length} Categories`);

                                // Step 2: Create new documents with new IDs
                                const batch = writeBatch(db);
                                let batchCount = 0;
                                const BATCH_SIZE = 500;

                                for (const oldCat of categoriesToRename) {
                                    const newId = idMapping[oldCat.id];
                                    if (!newId) continue;

                                    const { id, ...catData } = oldCat;
                                    const newCatRef = doc(db, 'categories', newId);
                                    batch.set(newCatRef, {
                                        ...catData,
                                        createdAt: catData.createdAt || new Date(),
                                        updatedAt: new Date()
                                    });

                                    batchCount++;
                                    if (batchCount >= BATCH_SIZE) {
                                        await batch.commit();
                                        console.log(`✅ Committed batch: ${batchCount} new Categories created`);
                                        batchCount = 0;
                                    }
                                }

                                if (batchCount > 0) {
                                    await batch.commit();
                                    console.log(`✅ Committed final batch: ${batchCount} new Categories created`);
                                }

                                // Step 3: Update all references in items
                                console.log('🔄 Updating items...');
                                const itemsQuery = query(
                                    collection(db, 'items'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const itemsSnapshot = await getDocs(itemsQuery);
                                const itemsBatch = writeBatch(db);
                                let itemUpdates = 0;

                                itemsSnapshot.docs.forEach(docSnapshot => {
                                    const item = docSnapshot.data();
                                    let needsUpdate = false;
                                    const updates: any = {};

                                    if (item.category && idMapping[item.category]) {
                                        updates.category = idMapping[item.category];
                                        needsUpdate = true;
                                    }

                                    if (needsUpdate) {
                                        itemsBatch.update(docSnapshot.ref, updates);
                                        itemUpdates++;
                                    }
                                });

                                if (itemUpdates > 0) {
                                    await itemsBatch.commit();
                                    console.log(`✅ Updated ${itemUpdates} items`);
                                }

                                // Step 4: Delete old Category documents
                                console.log('🗑️ Deleting old Category documents...');
                                const deleteBatch = writeBatch(db);
                                let deleteCount = 0;

                                for (const oldCat of categoriesToRename) {
                                    const oldCatRef = doc(db, 'categories', oldCat.id);
                                    deleteBatch.delete(oldCatRef);
                                    deleteCount++;

                                    if (deleteCount >= BATCH_SIZE) {
                                        await deleteBatch.commit();
                                        console.log(`✅ Deleted batch: ${deleteCount} old Categories`);
                                        deleteCount = 0;
                                    }
                                }

                                if (deleteCount > 0) {
                                    await deleteBatch.commit();
                                    console.log(`✅ Deleted final batch: ${deleteCount} old Categories`);
                                }

                                updated = categoriesToRename.length;

                                setCategoryFixResult({
                                    success: true,
                                    message: `Successfully renamed ${updated} Categories!\n\n- Created ${updated} new documents\n- Updated ${itemUpdates} items\n- Deleted ${updated} old documents`,
                                    updated,
                                    errors
                                });

                                setTimeout(() => {
                                    window.location.reload();
                                }, 5000);

                            } catch (error: any) {
                                console.error('❌ Error fixing Category IDs:', error);
                                setCategoryFixResult({
                                    success: false,
                                    message: `Failed: ${error.message}`,
                                    updated: 0,
                                    errors: [error.message]
                                });
                            } finally {
                                setFixingCategories(false);
                            }
                        }}
                        disabled={fixingCategories || state.categories.length === 0}
                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {fixingCategories ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Renaming Categories...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} />
                                Fix Category IDs ({state.categories.filter(c => !c.id.match(/^CAT-\d+$/)).length} need fixing)
                            </>
                        )}
                    </button>

                    {categoryFixResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            categoryFixResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {categoryFixResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <XCircle className="text-red-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    categoryFixResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {categoryFixResult.success ? 'Fix Successful!' : 'Fix Failed'}
                                </span>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${
                                categoryFixResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {categoryFixResult.message}
                            </p>
                            {categoryFixResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-600">
                                    <strong>Errors:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {categoryFixResult.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                        {categoryFixResult.errors.length > 5 && (
                                            <li>... and {categoryFixResult.errors.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            {categoryFixResult.success && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Page will refresh automatically in 5 seconds...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Fix Section IDs Section */}
            <div className="bg-white border-2 border-indigo-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-indigo-100 p-3 rounded-lg">
                        <RefreshCw className="text-indigo-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Fix Section IDs</h3>
                        <p className="text-sm text-slate-600">Rename all Factory Sections to use SEC-1001, SEC-1002 format instead of random IDs</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-indigo-900 mb-2">
                            Current Sections: {state.sections.length}
                        </p>
                        <p className="text-xs text-indigo-700">
                            This will rename all Factory Sections to use sequential IDs (SEC-1001, SEC-1002, etc.) and update all references in:
                            <ul className="list-disc list-inside mt-1">
                                <li>Items (section field)</li>
                            </ul>
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>⚠️ Warning:</strong> This operation will:
                            <ul className="list-disc list-inside mt-1">
                                <li>Create new Section documents with new IDs</li>
                                <li>Update all references in Items collection</li>
                                <li>Delete old Section documents</li>
                            </ul>
                            <strong className="block mt-2">Requires Supervisor PIN</strong>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to proceed:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            const sectionsToFix = state.sections.filter(s => !s.id.match(/^SEC-\d+$/));
                            if (sectionsToFix.length === 0) {
                                alert('All Sections already have correct IDs (SEC-XXXX format).');
                                return;
                            }

                            if (!confirm(`This will rename ${sectionsToFix.length} Sections. Continue?`)) {
                                return;
                            }

                            setFixingSections(true);
                            setSectionFixResult(null);

                            try {
                                const errors: string[] = [];
                                let updated = 0;
                                const idMapping: Record<string, string> = {};

                                // Step 1: Generate new IDs for all Sections
                                const sectionsToRename = state.sections
                                    .filter(s => !s.id.match(/^SEC-\d+$/))
                                    .sort((a, b) => a.name.localeCompare(b.name));

                                const existingSecIds = state.sections
                                    .filter(s => s.id.match(/^SEC-\d+$/))
                                    .map(s => {
                                        const match = s.id.match(/^SEC-(\d+)$/);
                                        return match ? parseInt(match[1]) : 0;
                                    })
                                    .filter(n => n > 0)
                                    .sort((a, b) => b - a);

                                let nextNumber = existingSecIds.length > 0 ? existingSecIds[0] + 1 : 1001;

                                sectionsToRename.forEach(s => {
                                    const newId = `SEC-${String(nextNumber).padStart(4, '0')}`;
                                    idMapping[s.id] = newId;
                                    nextNumber++;
                                });

                                console.log(`📋 Section ID Mapping:`, idMapping);
                                console.log(`📊 Will rename ${sectionsToRename.length} Sections`);

                                // Step 2: Create new documents with new IDs
                                const batch = writeBatch(db);
                                let batchCount = 0;
                                const BATCH_SIZE = 500;

                                for (const oldSec of sectionsToRename) {
                                    const newId = idMapping[oldSec.id];
                                    if (!newId) continue;

                                    const { id, ...secData } = oldSec;
                                    const newSecRef = doc(db, 'sections', newId);
                                    batch.set(newSecRef, {
                                        ...secData,
                                        createdAt: secData.createdAt || new Date(),
                                        updatedAt: new Date()
                                    });

                                    batchCount++;
                                    if (batchCount >= BATCH_SIZE) {
                                        await batch.commit();
                                        console.log(`✅ Committed batch: ${batchCount} new Sections created`);
                                        batchCount = 0;
                                    }
                                }

                                if (batchCount > 0) {
                                    await batch.commit();
                                    console.log(`✅ Committed final batch: ${batchCount} new Sections created`);
                                }

                                // Step 3: Update all references in items
                                console.log('🔄 Updating items...');
                                const itemsQuery = query(
                                    collection(db, 'items'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const itemsSnapshot = await getDocs(itemsQuery);
                                const itemsBatch = writeBatch(db);
                                let itemUpdates = 0;

                                itemsSnapshot.docs.forEach(docSnapshot => {
                                    const item = docSnapshot.data();
                                    let needsUpdate = false;
                                    const updates: any = {};

                                    if (item.section && idMapping[item.section]) {
                                        updates.section = idMapping[item.section];
                                        needsUpdate = true;
                                    }

                                    if (needsUpdate) {
                                        itemsBatch.update(docSnapshot.ref, updates);
                                        itemUpdates++;
                                    }
                                });

                                if (itemUpdates > 0) {
                                    await itemsBatch.commit();
                                    console.log(`✅ Updated ${itemUpdates} items`);
                                }

                                // Step 4: Delete old Section documents
                                console.log('🗑️ Deleting old Section documents...');
                                const deleteBatch = writeBatch(db);
                                let deleteCount = 0;

                                for (const oldSec of sectionsToRename) {
                                    const oldSecRef = doc(db, 'sections', oldSec.id);
                                    deleteBatch.delete(oldSecRef);
                                    deleteCount++;

                                    if (deleteCount >= BATCH_SIZE) {
                                        await deleteBatch.commit();
                                        console.log(`✅ Deleted batch: ${deleteCount} old Sections`);
                                        deleteCount = 0;
                                    }
                                }

                                if (deleteCount > 0) {
                                    await deleteBatch.commit();
                                    console.log(`✅ Deleted final batch: ${deleteCount} old Sections`);
                                }

                                updated = sectionsToRename.length;

                                setSectionFixResult({
                                    success: true,
                                    message: `Successfully renamed ${updated} Sections!\n\n- Created ${updated} new documents\n- Updated ${itemUpdates} items\n- Deleted ${updated} old documents`,
                                    updated,
                                    errors
                                });

                                setTimeout(() => {
                                    window.location.reload();
                                }, 5000);

                            } catch (error: any) {
                                console.error('❌ Error fixing Section IDs:', error);
                                setSectionFixResult({
                                    success: false,
                                    message: `Failed: ${error.message}`,
                                    updated: 0,
                                    errors: [error.message]
                                });
                            } finally {
                                setFixingSections(false);
                            }
                        }}
                        disabled={fixingSections || state.sections.length === 0}
                        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {fixingSections ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Renaming Sections...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} />
                                Fix Section IDs ({state.sections.filter(s => !s.id.match(/^SEC-\d+$/)).length} need fixing)
                            </>
                        )}
                    </button>

                    {sectionFixResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            sectionFixResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {sectionFixResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <XCircle className="text-red-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    sectionFixResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {sectionFixResult.success ? 'Fix Successful!' : 'Fix Failed'}
                                </span>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${
                                sectionFixResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {sectionFixResult.message}
                            </p>
                            {sectionFixResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-600">
                                    <strong>Errors:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {sectionFixResult.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                        {sectionFixResult.errors.length > 5 && (
                                            <li>... and {sectionFixResult.errors.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            {sectionFixResult.success && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Page will refresh automatically in 5 seconds...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Fix Missing Purchase Ledger Entries Section */}
            <div className="bg-white border-2 border-orange-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-orange-100 p-3 rounded-lg">
                        <RefreshCw className="text-orange-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Fix Missing Purchase Ledger Entries</h3>
                        <p className="text-sm text-slate-600">Create missing Raw Material Inventory and Capital ledger entries for purchases imported via CSV</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-orange-900 mb-2">
                            Current Purchases: {state.purchases.length}
                        </p>
                        <p className="text-xs text-orange-700">
                            This utility will check all purchases and create missing ledger entries for:
                            <ul className="list-disc list-inside mt-1">
                                <li>Raw Material Inventory (Debit) - Account 104</li>
                                <li>Capital (Credit) - Account 301</li>
                            </ul>
                            <strong className="block mt-2">Only creates entries for purchases that don't already have them (safe to run multiple times)</strong>
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>⚠️ Important:</strong> This will create opening balance ledger entries for purchases that were imported via CSV but are missing their accounting entries. Each purchase will create:
                            <ul className="list-disc list-inside mt-1">
                                <li>Debit: Inventory - Raw Materials (by purchase totalLandedCost)</li>
                                <li>Credit: Capital (by purchase totalLandedCost)</li>
                            </ul>
                            <strong className="block mt-2">Requires Supervisor PIN</strong>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to proceed:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            if (!confirm(`This will check ${state.purchases.length} purchases and create missing ledger entries. Continue?`)) {
                                return;
                            }

                            setFixingPurchaseLedgers(true);
                            setPurchaseLedgerFixResult(null);

                            try {
                                const errors: string[] = [];
                                let fixed = 0;
                                let skipped = 0;

                                // Find accounts by name (more reliable than code lookup)
                                const rawMaterialAccount = state.accounts.find(a => 
                                    a.name.includes('Raw Material') || 
                                    a.name.includes('Raw Materials') ||
                                    a.code === '104' || 
                                    a.code === '1200'
                                );
                                const capitalAccount = state.accounts.find(a => 
                                    a.name.includes('Capital') || 
                                    a.code === '301'
                                );

                                if (!rawMaterialAccount || !capitalAccount) {
                                    console.error('❌ Account lookup failed:', {
                                        rawMaterialAccount: rawMaterialAccount?.name || 'NOT FOUND',
                                        capitalAccount: capitalAccount?.name || 'NOT FOUND',
                                        allAccounts: state.accounts.map(a => ({ id: a.id, code: a.code, name: a.name }))
                                    });
                                    setPurchaseLedgerFixResult({
                                        success: false,
                                        message: `Missing required accounts.\nRaw Material Inventory: ${rawMaterialAccount ? `Found (${rawMaterialAccount.name})` : 'NOT FOUND'}\nCapital: ${capitalAccount ? `Found (${capitalAccount.name})` : 'NOT FOUND'}\n\nPlease check your Chart of Accounts.`,
                                        fixed: 0,
                                        errors: ['Required accounts not found']
                                    });
                                    setFixingPurchaseLedgers(false);
                                    return;
                                }

                                const rawMaterialInvId = rawMaterialAccount.id;
                                const capitalId = capitalAccount.id;

                                console.log('✅ Account IDs found:', {
                                    rawMaterial: { id: rawMaterialInvId, name: rawMaterialAccount.name, code: rawMaterialAccount.code },
                                    capital: { id: capitalId, name: capitalAccount.name, code: capitalAccount.code }
                                });

                                console.log('🔍 Checking purchases for missing ledger entries...');

                                for (const purchase of state.purchases) {
                                    try {
                                        // Check if ledger entries already exist for this purchase
                                        const transactionId = `OB-PUR-${purchase.id}`;
                                        const existingEntries = state.ledger.filter(
                                            le => le.transactionId === transactionId
                                        );

                                        // Check if existing entries have correct accountIds
                                        const hasIncorrectAccountId = existingEntries.some(entry => 
                                            (entry.accountName.includes('Raw Material') && entry.accountId !== rawMaterialInvId) ||
                                            (entry.accountName.includes('Capital') && entry.accountId !== capitalId)
                                        );

                                        if (existingEntries.length > 0 && !hasIncorrectAccountId) {
                                            console.log(`⏭️ Purchase ${purchase.batchNumber} already has correct ledger entries, skipping...`);
                                            skipped++;
                                            continue;
                                        }

                                        // If entries exist but have wrong accountIds, delete them first
                                        if (existingEntries.length > 0 && hasIncorrectAccountId) {
                                            console.log(`🔧 Purchase ${purchase.batchNumber} has entries with incorrect accountIds (${existingEntries.map(e => `${e.accountName}:${e.accountId}`).join(', ')}), deleting and recreating...`);
                                            try {
                                                await deleteTransaction(transactionId, 'Fixing incorrect accountId', 'System');
                                                console.log(`✅ Deleted incorrect ledger entries for ${purchase.batchNumber}`);
                                                // Wait a bit for Firebase to sync
                                                await new Promise(resolve => setTimeout(resolve, 500));
                                            } catch (delError: any) {
                                                console.error(`❌ Error deleting old entries for ${purchase.batchNumber}:`, delError);
                                                errors.push(`Failed to delete old entries for ${purchase.batchNumber}: ${delError.message}`);
                                                // Continue anyway - we'll create new entries
                                            }
                                        }

                                        // Create missing ledger entries
                                        const stockValue = purchase.totalLandedCost || purchase.totalCostFCY || 0;
                                        
                                        if (stockValue <= 0) {
                                            console.log(`⚠️ Purchase ${purchase.batchNumber} has zero or negative value, skipping...`);
                                            skipped++;
                                            continue;
                                        }

                                        const entries: Omit<LedgerEntry, 'id'>[] = [
                                            {
                                                date: purchase.date,
                                                transactionId,
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: rawMaterialInvId,
                                                accountName: rawMaterialAccount.name,
                                                currency: 'USD',
                                                exchangeRate: 1,
                                                fcyAmount: stockValue,
                                                debit: stockValue,
                                                credit: 0,
                                                narration: `Opening Stock (Purchase) - ${purchase.originalType} (Batch: ${purchase.batchNumber})`,
                                                factoryId: currentFactory?.id || ''
                                            },
                                            {
                                                date: purchase.date,
                                                transactionId,
                                                transactionType: TransactionType.OPENING_BALANCE,
                                                accountId: capitalId,
                                                accountName: capitalAccount.name,
                                                currency: 'USD',
                                                exchangeRate: 1,
                                                fcyAmount: stockValue,
                                                debit: 0,
                                                credit: stockValue,
                                                narration: `Opening Stock (Purchase) - ${purchase.originalType} (Batch: ${purchase.batchNumber})`,
                                                factoryId: currentFactory?.id || ''
                                            }
                                        ];

                                        await postTransaction(entries);
                                        console.log(`✅ Created ledger entries for purchase ${purchase.batchNumber}: Raw Material Inventory +$${stockValue.toFixed(2)}, Capital +$${stockValue.toFixed(2)}`);
                                        fixed++;

                                        // Small delay every 10 entries to avoid rate limiting
                                        if (fixed % 10 === 0) {
                                            await new Promise(resolve => setTimeout(resolve, 200));
                                        }
                                    } catch (error: any) {
                                        console.error(`❌ Error processing purchase ${purchase.batchNumber}:`, error);
                                        errors.push(`Purchase ${purchase.batchNumber}: ${error.message}`);
                                    }
                                }

                                setPurchaseLedgerFixResult({
                                    success: true,
                                    message: `Successfully created ledger entries!\n\n- Fixed: ${fixed} purchases\n- Skipped: ${skipped} purchases (already had entries or zero value)\n- Errors: ${errors.length}`,
                                    fixed,
                                    errors
                                });

                                // Refresh page after 5 seconds
                                setTimeout(() => {
                                    window.location.reload();
                                }, 5000);

                            } catch (error: any) {
                                console.error('❌ Error fixing purchase ledger entries:', error);
                                setPurchaseLedgerFixResult({
                                    success: false,
                                    message: `Failed: ${error.message}`,
                                    fixed: 0,
                                    errors: [error.message]
                                });
                            } finally {
                                setFixingPurchaseLedgers(false);
                            }
                        }}
                        disabled={fixingPurchaseLedgers || state.purchases.length === 0}
                        className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {fixingPurchaseLedgers ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Creating Missing Ledger Entries...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={18} />
                                Fix Missing Purchase Ledger Entries ({state.purchases.length} purchases to check)
                            </>
                        )}
                    </button>

                    {purchaseLedgerFixResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            purchaseLedgerFixResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {purchaseLedgerFixResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <XCircle className="text-red-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    purchaseLedgerFixResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {purchaseLedgerFixResult.success ? 'Fix Successful!' : 'Fix Failed'}
                                </span>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${
                                purchaseLedgerFixResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {purchaseLedgerFixResult.message}
                            </p>
                            {purchaseLedgerFixResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-600">
                                    <strong>Errors:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {purchaseLedgerFixResult.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                        {purchaseLedgerFixResult.errors.length > 5 && (
                                            <li>... and {purchaseLedgerFixResult.errors.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            {purchaseLedgerFixResult.success && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Page will refresh automatically in 5 seconds to update Balance Sheet...
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete All Purchases Utility */}
            <div className="bg-white border-2 border-red-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-red-100 p-3 rounded-lg">
                        <Trash2 className="text-red-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Delete All Purchases</h3>
                        <p className="text-sm text-slate-600">Delete all purchases and their related ledger entries, logistics entries for clean re-upload</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-red-900 mb-2">
                            Current Purchases: {state.purchases.length}
                        </p>
                        <p className="text-xs text-red-700">
                            This will permanently delete:
                            <ul className="list-disc list-inside mt-1">
                                <li>All purchases ({state.purchases.length} records)</li>
                                <li>All related ledger entries (OB-PUR-XXX transactions)</li>
                                <li>All related LogisticsEntry records</li>
                            </ul>
                            <strong className="block mt-2">Use this before re-uploading CSV to start fresh</strong>
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>⚠️ Warning:</strong> This operation will:
                            <ul className="list-disc list-inside mt-1">
                                <li>Delete all purchases from database</li>
                                <li>Delete all related ledger entries (Raw Material Inventory and Capital entries)</li>
                                <li>Delete all related LogisticsEntry records</li>
                                <li>This action cannot be undone</li>
                            </ul>
                            <strong className="block mt-2">Requires Supervisor PIN</strong>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            const pin = prompt('Enter Supervisor PIN to proceed:');
                            if (pin !== SUPERVISOR_PIN) {
                                alert('Invalid PIN. Operation cancelled.');
                                return;
                            }

                            if (!confirm(`This will DELETE ALL ${state.purchases.length} purchases and their related entries. This cannot be undone. Continue?`)) {
                                return;
                            }

                            if (!confirm('Are you absolutely sure? This will delete everything related to purchases.')) {
                                return;
                            }

                            setDeletingAllPurchases(true);
                            setDeletePurchasesResult(null);

                            try {
                                const errors: string[] = [];
                                let deleted = 0;
                                let ledgerDeleted = 0;
                                let logisticsDeleted = 0;

                                console.log('🗑️ Starting deletion of all purchases...');

                                // Step 1: Batch delete all ledger entries related to purchases (FAST!)
                                console.log('🗑️ Deleting related ledger entries...');
                                const purchaseTransactionIds = new Set<string>();
                                for (const purchase of state.purchases) {
                                    purchaseTransactionIds.add(`OB-PUR-${purchase.id}`);
                                    purchaseTransactionIds.add(`PI-${purchase.batchNumber || purchase.id.toUpperCase()}`);
                                }

                                // Query ALL ledger entries for this factory in ONE query (much faster!)
                                console.log(`🔍 Querying all ledger entries for factory (looking for ${purchaseTransactionIds.size} transaction IDs)...`);
                                const allLedgerQuery = query(
                                    collection(db, 'ledger'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const allLedgerSnapshot = await getDocs(allLedgerQuery);
                                
                                // Filter in memory (fast!)
                                const allLedgerEntries: any[] = [];
                                allLedgerSnapshot.docs.forEach(doc => {
                                    const data = doc.data();
                                    if (purchaseTransactionIds.has(data.transactionId)) {
                                        allLedgerEntries.push({ ref: doc.ref, transactionId: data.transactionId });
                                    }
                                });
                                console.log(`📋 Found ${allLedgerEntries.length} ledger entries to delete`);

                                // Batch delete all ledger entries
                                if (allLedgerEntries.length > 0) {
                                    console.log(`🗑️ Deleting ${allLedgerEntries.length} ledger entries in batches...`);
                                    const BATCH_SIZE = 500;
                                    let currentBatch = writeBatch(db);
                                    let batchCount = 0;
                                    let batchNumber = 1;

                                    for (const entry of allLedgerEntries) {
                                        currentBatch.delete(entry.ref);
                                        batchCount++;
                                        ledgerDeleted++;

                                        if (batchCount >= BATCH_SIZE) {
                                            await currentBatch.commit();
                                            console.log(`✅ Deleted batch ${batchNumber} of ${Math.ceil(allLedgerEntries.length / BATCH_SIZE)} (${ledgerDeleted}/${allLedgerEntries.length} entries)...`);
                                            currentBatch = writeBatch(db);
                                            batchCount = 0;
                                            batchNumber++;
                                        }
                                    }

                                    if (batchCount > 0) {
                                        await currentBatch.commit();
                                        console.log(`✅ Deleted final batch (${ledgerDeleted}/${allLedgerEntries.length} entries)`);
                                    }
                                    console.log(`✅ Completed: Deleted ${ledgerDeleted} ledger entries total`);
                                } else {
                                    console.log(`ℹ️ No ledger entries found to delete`);
                                }

                                // Step 2: Delete all LogisticsEntry records
                                console.log('🗑️ Deleting related LogisticsEntry records...');
                                const logisticsQuery = query(
                                    collection(db, 'logisticsEntries'),
                                    where('factoryId', '==', currentFactory?.id || ''),
                                    where('purchaseType', '==', 'ORIGINAL')
                                );
                                const logisticsSnapshot = await getDocs(logisticsQuery);
                                
                                if (logisticsSnapshot.size > 0) {
                                    const BATCH_SIZE = 500;
                                    let currentBatch = writeBatch(db);
                                    let batchCount = 0;

                                    for (const docSnapshot of logisticsSnapshot.docs) {
                                        currentBatch.delete(docSnapshot.ref);
                                        batchCount++;
                                        logisticsDeleted++;

                                        if (batchCount >= BATCH_SIZE) {
                                            await currentBatch.commit();
                                            console.log(`✅ Deleted batch of ${BATCH_SIZE} logistics entries...`);
                                            currentBatch = writeBatch(db);
                                            batchCount = 0;
                                        }
                                    }

                                    if (batchCount > 0) {
                                        await currentBatch.commit();
                                        console.log(`✅ Deleted final batch of ${batchCount} logistics entries`);
                                    }
                                    console.log(`✅ Deleted ${logisticsDeleted} LogisticsEntry records`);
                                }

                                // Step 3: Delete all purchases
                                console.log('🗑️ Deleting purchase documents...');
                                const purchasesQuery = query(
                                    collection(db, 'purchases'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const purchasesSnapshot = await getDocs(purchasesQuery);
                                
                                if (purchasesSnapshot.size > 0) {
                                    const BATCH_SIZE = 500;
                                    let currentBatch = writeBatch(db);
                                    let batchCount = 0;

                                    for (const docSnapshot of purchasesSnapshot.docs) {
                                        currentBatch.delete(docSnapshot.ref);
                                        batchCount++;
                                        deleted++;

                                        if (batchCount >= BATCH_SIZE) {
                                            await currentBatch.commit();
                                            console.log(`✅ Deleted batch ${Math.floor(deleted / BATCH_SIZE)} of purchases (${deleted}/${purchasesSnapshot.size})...`);
                                            currentBatch = writeBatch(db);
                                            batchCount = 0;
                                        }
                                    }

                                    if (batchCount > 0) {
                                        await currentBatch.commit();
                                        console.log(`✅ Deleted final batch of ${batchCount} purchases`);
                                    }
                                    console.log(`✅ Deleted ${deleted} purchases total`);
                                }

                                setDeletePurchasesResult({
                                    success: true,
                                    message: `Successfully deleted all purchases!\n\n- Deleted: ${deleted} purchases\n- Deleted: ${ledgerDeleted} ledger transactions\n- Deleted: ${logisticsDeleted} LogisticsEntry records\n\nYou can now re-upload your CSV file.`,
                                    deleted,
                                    errors
                                });

                                // Refresh page after 5 seconds
                                setTimeout(() => {
                                    window.location.reload();
                                }, 5000);

                            } catch (error: any) {
                                console.error('❌ Error deleting purchases:', error);
                                setDeletePurchasesResult({
                                    success: false,
                                    message: `Failed: ${error.message}`,
                                    deleted: 0,
                                    errors: [error.message]
                                });
                            } finally {
                                setDeletingAllPurchases(false);
                            }
                        }}
                        disabled={deletingAllPurchases || state.purchases.length === 0}
                        className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {deletingAllPurchases ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Deleting All Purchases...
                            </>
                        ) : (
                            <>
                                <Trash2 size={18} />
                                Delete All Purchases ({state.purchases.length} purchases)
                            </>
                        )}
                    </button>

                    {deletePurchasesResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            deletePurchasesResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-red-50 border-red-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {deletePurchasesResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <XCircle className="text-red-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    deletePurchasesResult.success ? 'text-emerald-900' : 'text-red-900'
                                }`}>
                                    {deletePurchasesResult.success ? 'Deletion Successful!' : 'Deletion Failed'}
                                </span>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${
                                deletePurchasesResult.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                                {deletePurchasesResult.message}
                            </p>
                            {deletePurchasesResult.errors.length > 0 && (
                                <div className="mt-2 text-xs text-red-600">
                                    <strong>Errors:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {deletePurchasesResult.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                        {deletePurchasesResult.errors.length > 5 && (
                                            <li>... and {deletePurchasesResult.errors.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            {deletePurchasesResult.success && (
                                <p className="text-xs text-emerald-600 mt-2">
                                    Page will refresh automatically in 5 seconds. You can then re-upload your CSV.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Verify Purchase Deletion Utility */}
            <div className="bg-white border-2 border-blue-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-3 rounded-lg">
                        <Search className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Verify Purchase Deletion</h3>
                        <p className="text-sm text-slate-600">Check if all purchase-related data has been deleted</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            This utility will check for any remaining:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Purchase documents (should be 0)</li>
                                <li>OB-PUR-XXX ledger entries (CSV imports)</li>
                                <li>PI-XXX ledger entries (regular purchases)</li>
                                <li>LogisticsEntry records (ORIGINAL type)</li>
                            </ul>
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            setVerifyingPurchases(true);
                            setVerificationResult(null);

                            try {
                                console.log('🔍 Verifying purchase deletion...');

                                // Check purchases
                                const purchasesQuery = query(
                                    collection(db, 'purchases'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const purchasesSnapshot = await getDocs(purchasesQuery);
                                const purchasesCount = purchasesSnapshot.size;

                                // Check ledger entries (OB-PUR- and PI-)
                                const allLedgerQuery = query(
                                    collection(db, 'ledger'),
                                    where('factoryId', '==', currentFactory?.id || '')
                                );
                                const allLedgerSnapshot = await getDocs(allLedgerQuery);
                                
                                let obPurCount = 0;
                                let piCount = 0;
                                allLedgerSnapshot.docs.forEach(doc => {
                                    const data = doc.data();
                                    if (data.transactionId?.startsWith('OB-PUR-')) {
                                        obPurCount++;
                                    } else if (data.transactionId?.startsWith('PI-')) {
                                        piCount++;
                                    }
                                });

                                // Check LogisticsEntry records
                                const logisticsQuery = query(
                                    collection(db, 'logisticsEntries'),
                                    where('factoryId', '==', currentFactory?.id || ''),
                                    where('purchaseType', '==', 'ORIGINAL')
                                );
                                const logisticsSnapshot = await getDocs(logisticsQuery);
                                const logisticsCount = logisticsSnapshot.size;

                                const totalRemaining = purchasesCount + obPurCount + piCount + logisticsCount;
                                const isClean = totalRemaining === 0;

                                console.log('📊 Verification Results:', {
                                    purchases: purchasesCount,
                                    obPurEntries: obPurCount,
                                    piEntries: piCount,
                                    logisticsEntries: logisticsCount,
                                    total: totalRemaining
                                });

                                setVerificationResult({
                                    success: isClean,
                                    message: isClean 
                                        ? `✅ All purchase-related data has been deleted successfully!\n\nEverything is clean and ready for re-upload.`
                                        : `⚠️ Found ${totalRemaining} remaining purchase-related record(s):\n\n- Purchases: ${purchasesCount}\n- OB-PUR- ledger entries: ${obPurCount}\n- PI- ledger entries: ${piCount}\n- LogisticsEntry records: ${logisticsCount}\n\nYou may need to run the delete utility again or manually clean these up.`,
                                    obPurEntries: obPurCount,
                                    piEntries: piCount,
                                    logisticsEntries: logisticsCount,
                                    purchases: purchasesCount
                                });

                            } catch (error: any) {
                                console.error('❌ Error verifying purchases:', error);
                                setVerificationResult({
                                    success: false,
                                    message: `Verification failed: ${error.message}`,
                                    obPurEntries: 0,
                                    piEntries: 0,
                                    logisticsEntries: 0,
                                    purchases: 0
                                });
                            } finally {
                                setVerifyingPurchases(false);
                            }
                        }}
                        disabled={verifyingPurchases}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {verifyingPurchases ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Verifying...
                            </>
                        ) : (
                            <>
                                <Search size={18} />
                                Verify Purchase Deletion
                            </>
                        )}
                    </button>

                    {verificationResult && (
                        <div className={`p-4 rounded-lg border-2 ${
                            verificationResult.success 
                                ? 'bg-emerald-50 border-emerald-300' 
                                : 'bg-amber-50 border-amber-300'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {verificationResult.success ? (
                                    <CheckCircle className="text-emerald-600" size={20} />
                                ) : (
                                    <AlertTriangle className="text-amber-600" size={20} />
                                )}
                                <span className={`font-bold ${
                                    verificationResult.success ? 'text-emerald-900' : 'text-amber-900'
                                }`}>
                                    {verificationResult.success ? 'Verification Passed!' : 'Verification Found Issues'}
                                </span>
                            </div>
                            <p className={`text-sm whitespace-pre-line ${
                                verificationResult.success ? 'text-emerald-700' : 'text-amber-700'
                            }`}>
                                {verificationResult.message}
                            </p>
                            {!verificationResult.success && (
                                <div className="mt-3 p-3 bg-white rounded border border-amber-200">
                                    <p className="text-xs font-semibold text-amber-900 mb-2">Detailed Breakdown:</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className={verificationResult.purchases > 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                                            Purchases: {verificationResult.purchases}
                                        </div>
                                        <div className={verificationResult.obPurEntries > 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                                            OB-PUR- Entries: {verificationResult.obPurEntries}
                                        </div>
                                        <div className={verificationResult.piEntries > 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                                            PI- Entries: {verificationResult.piEntries}
                                        </div>
                                        <div className={verificationResult.logisticsEntries > 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                                            Logistics: {verificationResult.logisticsEntries}
                                        </div>
                                    </div>
                                </div>
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
                </>
            )}
        </div>
    );
};
