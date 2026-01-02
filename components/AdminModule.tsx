import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { UserRole, TransactionType, LedgerEntry, PartnerType, SalesInvoice, AccountType } from '../types';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, Database, Shield, Lock, CheckCircle, XCircle, Building2, Users, ArrowRight, RefreshCw, FileText, Upload, Download, Search, CheckSquare, Package } from 'lucide-react';
import { collection, writeBatch, doc, getDocs, getDoc, query, where, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getExchangeRates } from '../context/DataContext';
import { getAccountId } from '../services/accountMap';
import Papa from 'papaparse';
import { CSVValidator } from './CSVValidator';
import { DataImportExport } from './DataImportExport';
import { FactoryManagement } from './FactoryManagement';
import { UserManagement } from './UserManagement';
import { CentralItemDatabase } from './CentralItemDatabase';

type ResetType = 'transactions' | 'complete' | 'factory' | null;

export const AdminModule: React.FC = () => {
    const { state, postTransaction, deleteTransaction, addOriginalOpening, updateItem } = useData();
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
    const [diagnosingProductionBalance, setDiagnosingProductionBalance] = useState(false);
    const [productionBalanceDiagnosis, setProductionBalanceDiagnosis] = useState<{ 
        totalProductions: number; 
        missingOpenings: number; 
        totalMissingWipValue: number; 
        impactOnAssets: number;
        impactOnEquity: number;
        details: Array<{ productionId: string; date: string; itemName: string; value: number; weight: number }>;
    } | null>(null);
    const [fixingProductionBalance, setFixingProductionBalance] = useState(false);
    const [productionBalanceFixResult, setProductionBalanceFixResult] = useState<{ success: boolean; message: string; fixed: number; errors: string[] } | null>(null);
    const [unbalancedTransactions, setUnbalancedTransactions] = useState<Array<{
        transactionId: string;
        transactionType: string;
        date: string;
        totalDebit: number;
        totalCredit: number;
        imbalance: number;
        entryCount: number;
        entries: any[];
    }>>([]);
    const [fixingUnbalancedTransactions, setFixingUnbalancedTransactions] = useState(false);
    const [unbalancedProgress, setUnbalancedProgress] = useState<{ current: number; total: number; batch: number; totalBatches: number } | null>(null);
    const [ledgerImbalance, setLedgerImbalance] = useState<number | null>(null);
    const [fixingLedgerBalance, setFixingLedgerBalance] = useState(false);
    const [balanceSheetDifference, setBalanceSheetDifference] = useState<number | null>(null);
    const [recalculatingBalances, setRecalculatingBalances] = useState(false);
    const [unbalancedFixResult, setUnbalancedFixResult] = useState<{ success: boolean; message: string; fixed: number; errors: string[] } | null>(null);
    const [invoicesWithoutCOGS, setInvoicesWithoutCOGS] = useState<Array<{ invoiceNo: string; date: string; totalCOGS: number; hasCOGS: boolean; hasInventoryReduction: boolean; factoryId: string }>>([]);
    const [fixingCOGSEntries, setFixingCOGSEntries] = useState(false);
    const [cogsFixResult, setCogsFixResult] = useState<{ success: boolean; message: string; fixed: number; errors: string[] } | null>(null);
    const [totalMissingCOGS, setTotalMissingCOGS] = useState(0);
    const [balanceSheetImbalance, setBalanceSheetImbalance] = useState(0);
    const [productionsMissingCredit, setProductionsMissingCredit] = useState<Array<{ productionId: string; date: string; itemName: string; value: number; issue: string }>>([]);
    const [fixingProductionCredits, setFixingProductionCredits] = useState(false);
    const [productionCreditFixResult, setProductionCreditFixResult] = useState<{ success: boolean; message: string; fixed: number; errors: string[] } | null>(null);
    const [productionCreditProgress, setProductionCreditProgress] = useState<{ current: number; total: number; batch: number; totalBatches: number } | null>(null);
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
    const [itemsWithInvalidSalePrice, setItemsWithInvalidSalePrice] = useState<Array<{ id: string; code: string; name: string; category: string; avgCost: number; salePrice: any; issue: string }>>([]);
    const [fixingInvalidSalePrices, setFixingInvalidSalePrices] = useState(false);
    const [invalidSalePriceFixResult, setInvalidSalePriceFixResult] = useState<{ success: boolean; message: string; fixed: number; errors: string[] } | null>(null);
    const [activeTab, setActiveTab] = useState<'admin' | 'csv-validator' | 'import-export' | 'central-items'>('admin');
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
                <button
                    onClick={() => setActiveTab('central-items')}
                    className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                        activeTab === 'central-items'
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                    <Database size={16} />
                    <span>Central Items</span>
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

            {activeTab === 'central-items' && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                    <CentralItemDatabase />
                </div>
            )}

            {activeTab === 'admin' && (
                <>

            {/* Quick Links for Super Admin */}
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

            {/* Removed unused utilities: Delete ALL Items, Fix Missing Opening Balances, Fix Original Type IDs, Invoice Diagnostics, Delete All Sales Invoices, Fix Division IDs, Fix Sub Division IDs, Fix Original Product IDs, Fix Category IDs, Fix Section IDs, Fix Missing Purchase Ledger Entries, Production Balance Sheet Diagnostic, Comprehensive Balance Sheet Diagnostic, Transaction Integrity Diagnostic, Balance Sheet Deep Diagnostic, Delete All Purchases, Verify Purchase Deletion - All sections removed */}
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

            {/* Factory Reset Utility Section */}
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="text-red-600" size={24} />
                    <h3 className="text-lg font-bold text-red-900">Factory Reset Utility</h3>
                </div>
                
                <div className="bg-white border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-800 mb-2">
                        <strong>⚠️ DESTRUCTIVE OPERATION:</strong> This utility will completely reset all data for the selected factory:
                    </p>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-4">
                        <li>Delete ALL ledger entries</li>
                        <li>Delete ALL transactions (Purchases, Sales, Productions, etc.)</li>
                        <li>Reset Cash and Bank accounts to $0</li>
                        <li>Reset Customer and Supplier balances to $0</li>
                        <li>Reset Stock (Items and Original Stock) to 0</li>
                    </ul>
                    <p className="text-xs text-red-600 mt-3 font-semibold">
                        This action CANNOT be undone. Only proceed if you are absolutely certain.
                    </p>
                </div>

                <FactoryResetUtility />
            </div>

            {/* Data Backup & Restore Utility Section */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <Database className="text-blue-600" size={24} />
                    <h3 className="text-lg font-bold text-blue-900">Data Backup & Restore Utility</h3>
                </div>
                
                <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800 mb-2">
                        <strong>📦 Backup & Restore:</strong> Create a complete backup of all factory data or restore from a previous backup.
                    </p>
                    <ul className="list-disc list-inside text-sm text-blue-700 space-y-1 ml-4">
                        <li>Backup includes: Master data, Transactions, Ledger entries, Stock, Balances</li>
                        <li>Restore will replace all existing data for the selected factory</li>
                        <li>Backups are factory-specific and cannot be restored to a different factory</li>
                    </ul>
                </div>

                <DataBackupRestoreUtility />
            </div>
                </>
            )}
        </div>
    );
};

// Factory Reset Utility Component
const FactoryResetUtility: React.FC = () => {
    const { state } = useData();
    const { currentFactory, factories } = useAuth();
    const [selectedFactoryId, setSelectedFactoryId] = useState<string>(currentFactory?.id || '');
    const [pinCode, setPinCode] = useState('');
    const [isArmed, setIsArmed] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<Array<{ time: string; type: 'info' | 'success' | 'error' | 'warning'; message: string }>>([]);
    const SUPERVISOR_PIN = '7860';
    const BATCH_SIZE = 500; // Firestore batch limit

    // Helper function to add log
    const addLog = (type: 'info' | 'success' | 'error' | 'warning', message: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { time, type, message }]);
        console.log(`[${time}] ${type.toUpperCase()}: ${message}`);
    };

    // Chunked deletion helper
    const chunkedDelete = async (collectionName: string, factoryId: string, description: string): Promise<number> => {
        addLog('info', `Fetching ${description}...`);
        const q = query(collection(db, collectionName), where('factoryId', '==', factoryId));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs;
        const total = docs.length;
        
        if (total === 0) {
            addLog('info', `No ${description} found.`);
            return 0;
        }

        addLog('info', `Found ${total} ${description}. Deleting in batches of ${BATCH_SIZE}...`);
        
        let deleted = 0;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const batchDocs = docs.slice(i, i + BATCH_SIZE);
            batchDocs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            deleted += batchDocs.length;
            addLog('success', `Deleted ${deleted}/${total} ${description} (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
        }
        
        addLog('success', `✅ Completed: ${total} ${description} deleted.`);
        return total;
    };

    // Reset balances helper
    const resetBalances = async (factoryId: string): Promise<void> => {
        addLog('info', 'Resetting account balances...');
        
        // Get all accounts for this factory
        const accountsQuery = query(collection(db, 'accounts'), where('factoryId', '==', factoryId));
        const accountsSnapshot = await getDocs(accountsQuery);
        
        let updated = 0;
        const batch = writeBatch(db);
        
        accountsSnapshot.docs.forEach(doc => {
            const account = doc.data();
            // Reset Cash and Bank accounts to 0 (identified by name)
            if (account.name?.includes('Cash') || account.name?.includes('Bank') || account.name?.includes('cash') || account.name?.includes('bank')) {
                batch.update(doc.ref, { balance: 0, updatedAt: serverTimestamp() });
                updated++;
            }
        });
        
        if (updated > 0) {
            await batch.commit();
            addLog('success', `✅ Reset ${updated} Cash/Bank account balances to $0.`);
        } else {
            addLog('info', 'No Cash/Bank accounts found to reset.');
        }

        // Reset Partner balances
        addLog('info', 'Resetting partner balances...');
        const partnersQuery = query(collection(db, 'partners'), where('factoryId', '==', factoryId));
        const partnersSnapshot = await getDocs(partnersQuery);
        
        updated = 0;
        const partnerBatch = writeBatch(db);
        
        partnersSnapshot.docs.forEach(doc => {
            partnerBatch.update(doc.ref, { balance: 0, updatedAt: serverTimestamp() });
            updated++;
        });
        
        if (updated > 0) {
            await partnerBatch.commit();
            addLog('success', `✅ Reset ${updated} partner balances to $0.`);
        } else {
            addLog('info', 'No partners found to reset.');
        }
    };

    // Reset stock helper
    const resetStock = async (factoryId: string): Promise<void> => {
        addLog('info', 'Resetting stock...');
        
        // Reset Items stock
        const itemsQuery = query(collection(db, 'items'), where('factoryId', '==', factoryId));
        const itemsSnapshot = await getDocs(itemsQuery);
        
        let updated = 0;
        const batch = writeBatch(db);
        
        itemsSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { 
                stockQty: 0, 
                avgCost: 0,
                nextSerial: 1,
                updatedAt: serverTimestamp() 
            });
            updated++;
        });
        
        if (updated > 0) {
            await batch.commit();
            addLog('success', `✅ Reset ${updated} items stock to 0.`);
        } else {
            addLog('info', 'No items found to reset.');
        }

        // Note: Original stock is calculated from purchases and adjustments
        // Since we're deleting all purchases and ledger entries, original stock will be 0 automatically
        addLog('info', 'Original stock will be reset automatically (no purchases/adjustments remain).');
    };

    // Main reset function
    const executeFactoryReset = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!selectedFactoryId) {
            alert('Please select a factory.');
            return;
        }

        if (pinCode !== SUPERVISOR_PIN) {
            alert('Invalid PIN code.');
            return;
        }

        if (!isArmed) {
            alert('Please ARM the utility first by toggling the switch.');
            return;
        }

        const factory = factories.find(f => f.id === selectedFactoryId);
        if (!factory) {
            alert('Factory not found.');
            return;
        }

        if (!confirm(`⚠️ FINAL CONFIRMATION:\n\nYou are about to DELETE ALL DATA for factory:\n"${factory.name}"\n\nThis action CANNOT be undone!\n\nClick OK to proceed or Cancel to abort.`)) {
            return;
        }

        setIsProcessing(true);
        setLogs([]);
        addLog('info', `🚀 Starting Factory Reset for: ${factory.name}`);
        addLog('warning', 'This is a destructive operation. All data will be permanently deleted.');

        try {
            // Step 1: Delete all ledger entries
            await chunkedDelete('ledger', selectedFactoryId, 'ledger entries');

            // Step 2: Delete all transactions
            await chunkedDelete('salesInvoices', selectedFactoryId, 'sales invoices');
            await chunkedDelete('purchases', selectedFactoryId, 'purchases');
            await chunkedDelete('productions', selectedFactoryId, 'productions');
            await chunkedDelete('originalOpenings', selectedFactoryId, 'original openings');
            await chunkedDelete('bundlePurchases', selectedFactoryId, 'bundle purchases');
            await chunkedDelete('logisticsEntries', selectedFactoryId, 'logistics entries');
            await chunkedDelete('ongoingOrders', selectedFactoryId, 'ongoing orders');
            await chunkedDelete('archive', selectedFactoryId, 'archived transactions');

            // Step 3: Reset balances
            await resetBalances(selectedFactoryId);

            // Step 4: Reset stock
            await resetStock(selectedFactoryId);

            addLog('success', '🎉 Factory Reset completed successfully!');
            addLog('info', 'All data for this factory has been reset to zero.');

            // Reset form
            setPinCode('');
            setIsArmed(false);
            setIsProcessing(false);

        } catch (error: any) {
            addLog('error', `❌ Error during reset: ${error?.message || 'Unknown error'}`);
            console.error('Factory Reset Error:', error);
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Factory Selector */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Select Factory to Reset <span className="text-red-500">*</span>
                </label>
                <select
                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-red-500 outline-none"
                    value={selectedFactoryId}
                    onChange={(e) => {
                        setSelectedFactoryId(e.target.value);
                        setIsArmed(false);
                        setPinCode('');
                    }}
                    disabled={isProcessing}
                >
                    <option value="">-- Select Factory --</option>
                    {factories && factories.length > 0 ? (
                        factories.map(factory => (
                            <option key={factory.id} value={factory.id}>
                                {factory.name} ({factory.code})
                            </option>
                        ))
                    ) : (
                        <option value="" disabled>No factories available</option>
                    )}
                </select>
            </div>

            {/* Arming Sequence */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Enter Supervisor PIN <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="password"
                        className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-red-500 outline-none font-mono"
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        placeholder="Enter PIN (7860)"
                        disabled={isProcessing || !selectedFactoryId}
                    />
                </div>

                <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg p-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">
                            ARM Utility
                        </label>
                        <p className="text-xs text-slate-500">
                            Toggle this switch to enable the Execute button
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isArmed}
                            onChange={(e) => setIsArmed(e.target.checked)}
                            disabled={isProcessing || !selectedFactoryId || pinCode !== SUPERVISOR_PIN}
                        />
                        <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                </div>
            </div>

            {/* Execute Button */}
            <button
                onClick={executeFactoryReset}
                disabled={!selectedFactoryId || !isArmed || pinCode !== SUPERVISOR_PIN || isProcessing}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                    !selectedFactoryId || !isArmed || pinCode !== SUPERVISOR_PIN || isProcessing
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl'
                }`}
            >
                {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="animate-spin" size={20} />
                        Processing Reset...
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        <AlertTriangle size={20} />
                        EXECUTE FACTORY RESET
                    </span>
                )}
            </button>

            {/* Terminal/Logging UI */}
            {logs.length > 0 && (
                <div className="bg-slate-900 text-green-400 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs">
                        <Database size={14} />
                        <span>Terminal Output</span>
                    </div>
                    {logs.map((log, index) => (
                        <div
                            key={index}
                            className={`mb-1 ${
                                log.type === 'error' ? 'text-red-400' :
                                log.type === 'success' ? 'text-green-400' :
                                log.type === 'warning' ? 'text-yellow-400' :
                                'text-slate-300'
                            }`}
                        >
                            <span className="text-slate-500">[{log.time}]</span> {log.message}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Data Backup & Restore Utility Component
const DataBackupRestoreUtility: React.FC = () => {
    const { factories } = useAuth();
    const [selectedFactoryId, setSelectedFactoryId] = useState<string>('');
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [backupFile, setBackupFile] = useState<File | null>(null);
    const [logs, setLogs] = useState<Array<{ time: string; type: 'info' | 'success' | 'error' | 'warning'; message: string }>>([]);

    // Helper function to add log
    const addLog = (type: 'info' | 'success' | 'error' | 'warning', message: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { time, type, message }]);
        console.log(`[${time}] ${type.toUpperCase()}: ${message}`);
    };

    // Collections to backup (all factory-specific)
    const collectionsToBackup = [
        // Master Data
        { name: 'partners', description: 'Partners (Suppliers/Customers)' },
        { name: 'accounts', description: 'Accounts' },
        { name: 'items', description: 'Items' },
        { name: 'originalTypes', description: 'Original Types' },
        { name: 'originalProducts', description: 'Original Products' },
        { name: 'categories', description: 'Categories' },
        { name: 'sections', description: 'Sections' },
        { name: 'divisions', description: 'Divisions' },
        { name: 'subDivisions', description: 'Sub Divisions' },
        { name: 'logos', description: 'Logos' },
        { name: 'warehouses', description: 'Warehouses' },
        { name: 'ports', description: 'Ports' },
        { name: 'employees', description: 'Employees' },
        { name: 'currencies', description: 'Currencies' },
        // Transactional Data
        { name: 'ledger', description: 'Ledger Entries' },
        { name: 'purchases', description: 'Purchases' },
        { name: 'bundlePurchases', description: 'Bundle Purchases' },
        { name: 'salesInvoices', description: 'Sales Invoices' },
        { name: 'productions', description: 'Productions' },
        { name: 'originalOpenings', description: 'Original Openings' },
        { name: 'logisticsEntries', description: 'Logistics Entries' },
        { name: 'ongoingOrders', description: 'Ongoing Orders' },
        { name: 'archive', description: 'Archived Transactions' },
        { name: 'planners', description: 'Planners' },
        { name: 'guaranteeCheques', description: 'Guarantee Cheques' },
        { name: 'customsDocuments', description: 'Customs Documents' }
    ];

    // Backup function
    const backupFactoryData = async () => {
        if (!selectedFactoryId) {
            alert('Please select a factory to backup.');
            return;
        }

        const factory = factories.find(f => f.id === selectedFactoryId);
        if (!factory) {
            alert('Factory not found.');
            return;
        }

        setIsBackingUp(true);
        setLogs([]);
        addLog('info', `🚀 Starting backup for factory: ${factory.name}`);

        try {
            const backupData: any = {
                factoryId: selectedFactoryId,
                factoryName: factory.name,
                factoryCode: factory.code,
                backupDate: new Date().toISOString(),
                version: '1.0',
                collections: {} as Record<string, any[]>
            };

            // Backup each collection
            for (const coll of collectionsToBackup) {
                try {
                    addLog('info', `Backing up ${coll.description}...`);
                    const q = query(collection(db, coll.name), where('factoryId', '==', selectedFactoryId));
                    const snapshot = await getDocs(q);
                    const data = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    backupData.collections[coll.name] = data;
                    addLog('success', `✅ Backed up ${data.length} ${coll.description}`);
                } catch (error: any) {
                    addLog('error', `❌ Error backing up ${coll.description}: ${error?.message || 'Unknown error'}`);
                }
            }

            // Create and download JSON file
            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `factory-backup-${factory.code}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            addLog('success', '🎉 Backup completed successfully!');
            addLog('info', `File downloaded: ${link.download}`);
            setIsBackingUp(false);

        } catch (error: any) {
            addLog('error', `❌ Backup failed: ${error?.message || 'Unknown error'}`);
            console.error('Backup Error:', error);
            setIsBackingUp(false);
        }
    };

    // Restore function
    const restoreFactoryData = async () => {
        if (!selectedFactoryId) {
            addLog('error', '❌ Please select a factory to restore.');
            return;
        }

        if (!backupFile) {
            addLog('error', '❌ Please select a backup file to restore.');
            return;
        }

        const factory = factories.find(f => f.id === selectedFactoryId);
        if (!factory) {
            addLog('error', '❌ Factory not found.');
            return;
        }

        // Use in-page confirmation instead of browser confirm
        addLog('warning', `⚠️ WARNING: This will REPLACE ALL existing data for factory "${factory.name}".`);
        addLog('warning', '⚠️ This action CANNOT be undone!');
        
        // For now, proceed directly (user has already confirmed by clicking the button)
        // In the future, we could add an arming sequence like the Factory Reset utility

        setIsRestoring(true);
        setLogs([]);
        addLog('info', `🚀 Starting restore for factory: ${factory.name}`);

        try {
            // Read backup file
            addLog('info', 'Reading backup file...');
            const fileText = await backupFile.text();
            const backupData = JSON.parse(fileText);

            // Validate backup file
            if (!backupData.factoryId || !backupData.collections) {
                throw new Error('Invalid backup file format.');
            }

            // Verify factory match
            if (backupData.factoryId !== selectedFactoryId) {
                if (!confirm(`⚠️ WARNING: Backup is for a different factory (${backupData.factoryName || backupData.factoryId}).\n\nRestoring to "${factory.name}" may cause data inconsistencies.\n\nContinue anyway?`)) {
                    setIsRestoring(false);
                    return;
                }
            }

            addLog('info', `Backup Date: ${backupData.backupDate || 'Unknown'}`);
            addLog('info', `Backup Factory: ${backupData.factoryName || backupData.factoryId}`);

            const BATCH_SIZE = 500;
            let totalRestored = 0;

            // Restore each collection
            for (const coll of collectionsToBackup) {
                const collectionData = backupData.collections[coll.name];
                if (!collectionData || !Array.isArray(collectionData)) {
                    addLog('warning', `⚠️ No data found for ${coll.description} in backup.`);
                    continue;
                }

                if (collectionData.length === 0) {
                    addLog('info', `No ${coll.description} to restore.`);
                    continue;
                }

                try {
                    addLog('info', `Restoring ${collectionData.length} ${coll.description}...`);

                    // Delete existing data for this factory
                    const existingQuery = query(collection(db, coll.name), where('factoryId', '==', selectedFactoryId));
                    const existingSnapshot = await getDocs(existingQuery);
                    
                    if (existingSnapshot.size > 0) {
                        addLog('info', `Deleting ${existingSnapshot.size} existing ${coll.description}...`);
                        for (let i = 0; i < existingSnapshot.docs.length; i += BATCH_SIZE) {
                            const batch = writeBatch(db);
                            const batchDocs = existingSnapshot.docs.slice(i, i + BATCH_SIZE);
                            batchDocs.forEach(doc => batch.delete(doc.ref));
                            await batch.commit();
                        }
                    }

                    // Restore data in batches
                    for (let i = 0; i < collectionData.length; i += BATCH_SIZE) {
                        const batch = writeBatch(db);
                        const batchData = collectionData.slice(i, i + BATCH_SIZE);
                        
                        batchData.forEach((item: any) => {
                            const { id, ...itemData } = item;
                            // Ensure factoryId matches selected factory
                            const docRef = doc(collection(db, coll.name), id);
                            batch.set(docRef, {
                                ...itemData,
                                factoryId: selectedFactoryId,
                                restoredAt: serverTimestamp()
                            });
                        });
                        
                        await batch.commit();
                        totalRestored += batchData.length;
                        addLog('success', `Restored ${totalRestored}/${collectionData.length} ${coll.description} (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
                    }

                    addLog('success', `✅ Completed: ${collectionData.length} ${coll.description} restored.`);
                } catch (error: any) {
                    addLog('error', `❌ Error restoring ${coll.description}: ${error?.message || 'Unknown error'}`);
                }
            }

            addLog('success', '🎉 Restore completed successfully!');
            addLog('info', 'Please refresh the page to see the restored data.');
            setIsRestoring(false);
            setBackupFile(null);

        } catch (error: any) {
            addLog('error', `❌ Restore failed: ${error?.message || 'Unknown error'}`);
            console.error('Restore Error:', error);
            setIsRestoring(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Factory Selector */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Select Factory <span className="text-red-500">*</span>
                </label>
                <select
                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={selectedFactoryId}
                    onChange={(e) => {
                        const factoryId = e.target.value;
                        setSelectedFactoryId(factoryId);
                        if (factoryId) {
                            // Reset backup file when factory changes (backups are factory-specific)
                            setBackupFile(null);
                            addLog('info', `Factory selected: ${factories.find(f => f.id === factoryId)?.name || factoryId}`);
                        }
                        setLogs([]);
                    }}
                    disabled={isBackingUp || isRestoring}
                >
                    <option value="">-- Select Factory --</option>
                    {factories && factories.length > 0 ? (
                        factories.map(factory => (
                            <option key={factory.id} value={factory.id}>
                                {factory.name} ({factory.code})
                            </option>
                        ))
                    ) : (
                        <option value="" disabled>No factories available</option>
                    )}
                </select>
            </div>

            {/* Backup Section */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <Download size={18} /> Backup Data
                </h4>
                <p className="text-sm text-green-700 mb-3">
                    Create a complete backup of all data for the selected factory. The backup will be downloaded as a JSON file.
                </p>
                <button
                    onClick={backupFactoryData}
                    disabled={!selectedFactoryId || isBackingUp || isRestoring}
                    className={`w-full py-3 rounded-lg font-bold transition-all ${
                        !selectedFactoryId || isBackingUp || isRestoring
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
                    }`}
                >
                    {isBackingUp ? (
                        <span className="flex items-center justify-center gap-2">
                            <RefreshCw className="animate-spin" size={18} />
                            Creating Backup...
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            <Download size={18} />
                            Create Backup
                        </span>
                    )}
                </button>
            </div>

            {/* Restore Section */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                    <Upload size={18} /> Restore Data
                </h4>
                <p className="text-sm text-amber-700 mb-3">
                    Restore data from a previous backup file. This will REPLACE all existing data for the selected factory.
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Select Backup File <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="file"
                            accept=".json"
                            className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    setBackupFile(file);
                                    addLog('info', `Selected backup file: ${file.name}`);
                                    console.log('Backup file set:', file.name, 'Factory selected:', selectedFactoryId);
                                } else {
                                    setBackupFile(null);
                                    addLog('warning', 'No file selected');
                                }
                            }}
                            disabled={isBackingUp || isRestoring}
                        />
                    </div>
                    {(!selectedFactoryId || !backupFile) && !isRestoring && (
                        <div className="text-xs text-amber-700 bg-amber-100 border border-amber-300 rounded p-2 mb-2">
                            <strong>Required:</strong>
                            {!selectedFactoryId && <span className="ml-2">• Select a factory</span>}
                            {!backupFile && <span className="ml-2">• Select a backup file</span>}
                            <div className="mt-1 text-xs text-slate-600">
                                Debug: Factory={selectedFactoryId ? '✓' : '✗'}, File={backupFile ? '✓' : '✗'}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={restoreFactoryData}
                        disabled={!selectedFactoryId || !backupFile || isBackingUp || isRestoring}
                        className={`w-full py-3 rounded-lg font-bold transition-all ${
                            !selectedFactoryId || !backupFile || isBackingUp || isRestoring
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-xl'
                        }`}
                    >
                        {isRestoring ? (
                            <span className="flex items-center justify-center gap-2">
                                <RefreshCw className="animate-spin" size={18} />
                                Restoring Data...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <Upload size={18} />
                                Restore from Backup
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Terminal/Logging UI */}
            {logs.length > 0 && (
                <div className="bg-slate-900 text-green-400 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs">
                        <Database size={14} />
                        <span>Terminal Output</span>
                    </div>
                    {logs.map((log, index) => (
                        <div
                            key={index}
                            className={`mb-1 ${
                                log.type === 'error' ? 'text-red-400' :
                                log.type === 'success' ? 'text-green-400' :
                                log.type === 'warning' ? 'text-yellow-400' :
                                'text-slate-300'
                            }`}
                        >
                            <span className="text-slate-500">[{log.time}]</span> {log.message}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
