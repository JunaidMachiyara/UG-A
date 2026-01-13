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
    const { state, postTransaction, deleteTransaction, addOriginalOpening, updateItem, fixMissingPurchaseLedgerEntries, fixMissingSalesInvoiceLedgerEntries } = useData();
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
    const [fixingSalesInvoiceLedgers, setFixingSalesInvoiceLedgers] = useState(false);
    const [salesInvoiceLedgerFixResult, setSalesInvoiceLedgerFixResult] = useState<{ success: boolean; message: string; fixed: number; errors: string[] } | null>(null);
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

            {/* FIX: Recalculate Supplier Balances from Ledger Entries */}
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <RefreshCw className="text-green-600" size={24} />
                    <h3 className="text-lg font-bold text-green-900">✅ FIX: Recalculate Supplier Balances from Ledger</h3>
                </div>

                <div className="bg-white border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-green-800 mb-2 font-bold">
                        This will recalculate ALL supplier balances from ledger entries and ensure they're stored correctly.
                    </p>
                    <p className="text-sm text-green-700 mb-2">
                        <strong>Key Fix:</strong> Supplier balances should be NEGATIVE when we owe them (credit balance in ledger).
                        This utility uses the EXACT same calculation logic as the system's reducer.
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                        if (!currentFactory?.id) {
                            alert('Please select a factory first');
                                return;
                            }

                        const confirmFix = confirm(
                            'This will recalculate ALL supplier balances from ledger entries.\n\n' +
                            'Supplier balances will be stored as NEGATIVE when we owe them (correct).\n\n' +
                            'This will fix the Balance Sheet imbalance.\n\n' +
                            'Continue?'
                        );

                        if (!confirmFix) return;

                        try {
                            const supplierTypes = [
                                PartnerType.SUPPLIER,
                                PartnerType.VENDOR,
                                PartnerType.FREIGHT_FORWARDER,
                                PartnerType.CLEARING_AGENT,
                                PartnerType.COMMISSION_AGENT
                            ];

                            let fixedCount = 0;
                            const fixes: Array<{ name: string; oldBalance: number; newBalance: number }> = [];

                            for (const partner of state.partners.filter(p => supplierTypes.includes(p.type))) {
                                const partnerId = partner.id;
                                const partnerCode = partner.code;

                                // Use EXACT same logic as reducer (LOAD_LEDGERS action)
                                // Step 1: Get opening balance from opening balance entries
                                const openingBalanceEntries = state.ledger.filter((e: any) => {
                                    if (e.transactionType !== TransactionType.OPENING_BALANCE) return false;
                                    return e.transactionId === `OB-${partnerId}` || 
                                           (partnerCode && e.transactionId === `OB-${partnerCode}`);
                                });
                                
                                let openingBalance = 0;
                                if (openingBalanceEntries.length > 0) {
                                    const apEntry = openingBalanceEntries.find((e: any) => 
                                        e.accountName?.includes('Accounts Payable') || 
                                        e.accountName?.includes('Payable')
                                    );
                                    if (apEntry) {
                                        // If AP account is credited, we owe them (negative balance)
                                        openingBalance = apEntry.credit > 0 ? -apEntry.credit : apEntry.debit;
                                    } else {
                                        const obDebitSum = openingBalanceEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
                                        const obCreditSum = openingBalanceEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);
                                        openingBalance = obCreditSum - obDebitSum;
                                    }
                                }
                                
                                // Step 2: Get regular entries (purchases, payments) where accountId === partnerId
                                const regularEntries = state.ledger.filter((e: any) => {
                                    if (e.accountId !== partnerId) return false;
                                    if (e.transactionId === `OB-${partnerId}`) return false;
                                    if (partnerCode && e.transactionId === `OB-${partnerCode}`) return false;
                                    return true;
                                });
                                const regularDebitSum = regularEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
                                const regularCreditSum = regularEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);
                                const regularBalance = regularCreditSum - regularDebitSum;
                                
                                // Step 3: Combine opening balance with regular balance
                                const newBalance = openingBalance + regularBalance;

                                // Only update if balance changed significantly
                                const oldBalance = partner.balance || 0;
                                if (Math.abs(newBalance - oldBalance) > 0.01) {
                                    fixes.push({
                                        name: partner.name,
                                        oldBalance,
                                        newBalance
                                    });

                                    // Update in Firebase
                                    await updateDoc(doc(db, 'partners', partnerId), {
                                        balance: newBalance,
                                        updatedAt: serverTimestamp()
                                    });

                                    fixedCount++;
                                }
                            }

                            if (fixedCount === 0) {
                                alert('✅ All supplier balances are already correct! No updates needed.');
                            } else {
                                const details = fixes.slice(0, 10).map(f => 
                                    `${f.name}: ${f.oldBalance.toFixed(2)} → ${f.newBalance.toFixed(2)}`
                                ).join('\n');
                                
                                const moreText = fixes.length > 10 ? `\n... and ${fixes.length - 10} more` : '';
                                
                                alert(
                                    `✅ Fixed ${fixedCount} supplier balance(s):\n\n${details}${moreText}\n\n` +
                                    `Please refresh the page to see the updated Balance Sheet.`
                                );
                                
                                setTimeout(() => window.location.reload(), 2000);
                            }
                            } catch (error: any) {
                            alert(`❌ Error fixing balances: ${error.message}`);
                            console.error('Error fixing supplier balances:', error);
                        }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                    ✅ Fix All Supplier Balances from Ledger
                    </button>
            </div>

            {/* DIAGNOSE: Check Supplier Balances in Balance Sheet */}
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="text-yellow-600" size={24} />
                    <h3 className="text-lg font-bold text-yellow-900">🔍 Diagnose: Supplier Balances in Balance Sheet</h3>
                    </div>
                
                <div className="bg-white border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-yellow-800 mb-2">
                        Check which suppliers have balances and why they might not be showing in the Balance Sheet.
                    </p>
                </div>

                    <button
                    onClick={() => {
                        const supplierTypes = [
                            PartnerType.SUPPLIER,
                            PartnerType.VENDOR,
                            PartnerType.FREIGHT_FORWARDER,
                            PartnerType.CLEARING_AGENT,
                            PartnerType.COMMISSION_AGENT
                        ];
                        
                        const allSuppliers = state.partners.filter(p => supplierTypes.includes(p.type));
                        const negativeSuppliers = allSuppliers.filter(p => (p.balance || 0) < 0);
                        const positiveSuppliers = allSuppliers.filter(p => (p.balance || 0) > 0);
                        const zeroSuppliers = allSuppliers.filter(p => (p.balance || 0) === 0);
                        
                        const totalAP = negativeSuppliers.reduce((sum, s) => sum + Math.abs(s.balance || 0), 0);
                        const totalAdvances = positiveSuppliers.reduce((sum, s) => sum + (s.balance || 0), 0);
                        
                        const details = [
                            `Total Suppliers: ${allSuppliers.length}`,
                            `Negative Balance (AP): ${negativeSuppliers.length} - Total: $${totalAP.toFixed(2)}`,
                            `Positive Balance (Advances): ${positiveSuppliers.length} - Total: $${totalAdvances.toFixed(2)}`,
                            `Zero Balance: ${zeroSuppliers.length}`,
                            '',
                            'Top 10 Suppliers by Balance (Absolute):',
                            ...allSuppliers
                                .map(s => ({ name: s.name, balance: s.balance || 0, type: s.type }))
                                .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
                                .slice(0, 10)
                                .map(s => `  ${s.name}: $${s.balance.toFixed(2)} ${s.balance < 0 ? '(AP - we owe them)' : s.balance > 0 ? '(Advance - they owe us)' : '(Zero)'}`)
                        ].join('\n');
                        
                        console.log('🔍 Supplier Balance Diagnosis:', {
                            allSuppliers: allSuppliers.length,
                            negativeSuppliers: negativeSuppliers.length,
                            positiveSuppliers: positiveSuppliers.length,
                            totalAP,
                            totalAdvances,
                            details
                        });
                        
                        alert(`Supplier Balance Analysis:\n\n${details}\n\nCheck browser console (F12) for detailed breakdown.`);
                    }}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold mb-3"
                >
                    🔍 Check Supplier Balances
                    </button>
            </div>

            {/* EMERGENCY: Fix Partner Balances - Use System's Own Calculation */}
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="text-red-600" size={24} />
                    <h3 className="text-lg font-bold text-red-900">⚠️ EMERGENCY FIX: Restore Partner Balances</h3>
                </div>

                <div className="bg-white border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-800 mb-2 font-bold">
                        If balances were incorrectly updated, use one of these options:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-red-700 space-y-2 ml-2">
                        <li><strong>If you have a backup:</strong> Go to Admin &gt; Import/Export &gt; Partners and restore from backup</li>
                        <li><strong>If no backup:</strong> Refresh the page (F5) to reload from Firebase, then manually fix balances in Setup &gt; Business Partners</li>
                        <li><strong>Or use the button below:</strong> This will trigger the system&apos;s own balance calculation (same as when ledger loads)</li>
                    </ol>
                            </div>

                <div className="flex gap-3">
                                    <button
                        onClick={() => {
                            alert('Please refresh the page (F5 or Ctrl+R) to reload all data from Firebase.\n\nAfter refresh, you may need to manually correct partner balances in Setup > Business Partners.');
                            window.location.reload();
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                    >
                        🔄 Refresh Page (Reload from Firebase)
                                    </button>
                    
                                    <button
                                        onClick={async () => {
                                                if (!currentFactory?.id) {
                                alert('Please select a factory first');
                                                    return;
                                                }

                            const confirmFix = confirm(
                                'This will trigger the system to recalculate partner balances using the EXACT same logic as when ledger entries load.\n\n' +
                                'This should restore correct balances.\n\n' +
                                'Continue?'
                            );

                            if (!confirmFix) return;

                            try {
                                // Trigger a LOAD_LEDGERS action which will recalculate all partner balances
                                // We'll simulate this by dispatching the action with current ledger entries
                                alert('⚠️ This feature requires access to the data context dispatch function.\n\n' +
                                      'Please refresh the page instead (F5), and the system will automatically recalculate balances when ledger entries load.\n\n' +
                                      'If balances are still wrong after refresh, you may need to manually fix them in Setup > Business Partners.');
                                
                                window.location.reload();
                                            } catch (error: any) {
                                alert(`❌ Error: ${error.message}`);
                                console.error('Error:', error);
                            }
                        }}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold"
                    >
                        🔧 Trigger System Recalculation
                                    </button>
                </div>
            </div>

            {/* Recalculate Partner Balances from Ledger Entries - DISABLED */}
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 mt-8 opacity-60">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="text-gray-600" size={24} />
                    <h3 className="text-lg font-bold text-gray-700">⚠️ DISABLED: Recalculate Partner Balances</h3>
                    </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-800 mb-2 font-bold">
                        This utility has been temporarily disabled due to calculation issues.
                    </p>
                    <p className="text-sm text-gray-700">
                        Please use the "Reload All Partners from Firebase" utility above instead.
                        </p>
                    </div>
                </div>

            {/* Find and Fix Orphaned Purchase Ledger Entries */}
            <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="text-purple-600" size={24} />
                    <h3 className="text-lg font-bold text-purple-900">Find & Fix Orphaned Purchase Ledger Entries</h3>
                </div>
                
                <div className="bg-white border border-purple-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-purple-800 mb-2">
                        This utility finds purchase ledger entries (PI-*) where only one side exists (orphaned entries).
                        This can happen if a purchase was deleted but only one ledger entry was removed.
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                        try {
                            // Find all PI- transactions
                            const piTransactions = new Set<string>();
                            state.ledger.forEach((entry: any) => {
                                if (entry.transactionId && entry.transactionId.startsWith('PI-')) {
                                    piTransactions.add(entry.transactionId);
                                }
                            });

                            // Check each transaction for orphaned entries
                            const orphanedEntries: any[] = [];
                            const transactionGroups: { [key: string]: any[] } = {};

                            // Group entries by transactionId
                            state.ledger.forEach((entry: any) => {
                                if (entry.transactionId && entry.transactionId.startsWith('PI-')) {
                                    if (!transactionGroups[entry.transactionId]) {
                                        transactionGroups[entry.transactionId] = [];
                                    }
                                    transactionGroups[entry.transactionId].push(entry);
                                }
                            });

                            // Find transactions with only 1 entry (orphaned)
                            Object.entries(transactionGroups).forEach(([transactionId, entries]) => {
                                if (entries.length === 1) {
                                    orphanedEntries.push(...entries);
                                }
                            });

                            if (orphanedEntries.length === 0) {
                                alert('✅ No orphaned purchase ledger entries found! All PI- transactions have both debit and credit entries.');
                                return;
                            }

                            // Show details
                            const details = orphanedEntries.map(e => 
                                `Transaction: ${e.transactionId}\nAccount: ${e.accountName}\nAmount: $${(e.debit || e.credit || 0).toFixed(2)}\nDate: ${e.date}`
                            ).join('\n\n');

                            const confirmDelete = confirm(
                                `Found ${orphanedEntries.length} orphaned purchase ledger entry/entries:\n\n${details}\n\n` +
                                `These entries are missing their matching entry and can cause Balance Sheet imbalance.\n\n` +
                                `Do you want to delete these orphaned entries?`
                            );

                            if (confirmDelete) {
                                // Delete orphaned entries from Firebase
                                let deletedCount = 0;
                                for (const entry of orphanedEntries) {
                                    try {
                                        // Find and delete the specific entry
                                        const ledgerQuery = query(
                                            collection(db, 'ledger'),
                                            where('transactionId', '==', entry.transactionId),
                                            where('accountId', '==', entry.accountId),
                                            where('factoryId', '==', currentFactory?.id || '')
                                        );
                                        const snapshot = await getDocs(ledgerQuery);
                                        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                                        await Promise.all(deletePromises);
                                        deletedCount += snapshot.docs.length;
                                                    } catch (error: any) {
                                        console.error(`Error deleting entry ${entry.transactionId}:`, error);
                                    }
                                }

                                alert(`✅ Deleted ${deletedCount} orphaned purchase ledger entry/entries.\n\nPlease refresh the page to see updated Balance Sheet.`);
                                setTimeout(() => window.location.reload(), 1000);
                                                }
                                            } catch (error: any) {
                            alert(`❌ Error: ${error.message}`);
                            console.error('Error finding orphaned entries:', error);
                        }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                >
                    Find & Delete Orphaned Purchase Entries
                    </button>
            </div>

            {/* Fix Missing Purchase Ledger Entries Section */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <RefreshCw className="text-blue-600" size={24} />
                    <h3 className="text-lg font-bold text-blue-900">Fix Missing Purchase Ledger Entries</h3>
                </div>
                
                <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800 mb-2">
                        This utility fixes purchases that were saved but don't have complete ledger entries.
                        It will:
                    </p>
                    <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                        <li>Find purchases without ledger entries or with unbalanced entries</li>
                        <li>Delete any incomplete/unbalanced entries</li>
                        <li>Create new, properly balanced ledger entries</li>
                        <li>Include all additional costs (Freight, Clearing, Commission, etc.)</li>
                    </ul>
                    <p className="text-sm text-blue-600 mt-2 font-semibold">
                        ⚠️ Use this if you entered purchases but got "Unbalanced transaction" errors.
                    </p>
                </div>

                <button
                    onClick={async () => {
                        if (!confirm('This will fix ledger entries for all purchases that need them.\n\nContinue?')) {
                            return;
                        }
                        setFixingPurchaseLedgers(true);
                        setPurchaseLedgerFixResult(null);
                        try {
                            await fixMissingPurchaseLedgerEntries();
                            // The function shows its own alert and refreshes, so we don't need to set result here
                        } catch (error: any) {
                            setPurchaseLedgerFixResult({
                                success: false,
                                message: error.message || 'Unknown error',
                                fixed: 0,
                                errors: [error.message || 'Unknown error']
                            });
                        } finally {
                            setFixingPurchaseLedgers(false);
                        }
                    }}
                    disabled={fixingPurchaseLedgers}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {fixingPurchaseLedgers ? (
                        <>
                            <RefreshCw className="animate-spin" size={16} />
                            Fixing...
                        </>
                    ) : (
                        <>
                            <CheckCircle size={16} />
                            Fix Missing Purchase Ledger Entries
                        </>
                    )}
                </button>

                {purchaseLedgerFixResult && (
                    <div className={`mt-4 p-4 rounded-lg ${purchaseLedgerFixResult.success ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                        <p className={`font-semibold ${purchaseLedgerFixResult.success ? 'text-green-800' : 'text-red-800'}`}>
                            {purchaseLedgerFixResult.success ? '✅ Success!' : '❌ Error'}
                        </p>
                        <p className="text-sm mt-1">{purchaseLedgerFixResult.message}</p>
                        {purchaseLedgerFixResult.errors.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-semibold">Errors:</p>
                                <ul className="text-sm list-disc list-inside">
                                    {purchaseLedgerFixResult.errors.map((err, idx) => (
                                        <li key={idx}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Fix Missing Sales Invoice Ledger Entries Section */}
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <RefreshCw className="text-green-600" size={24} />
                    <h3 className="text-lg font-bold text-green-900">Fix Missing Sales Invoice Ledger Entries</h3>
                </div>
                
                <div className="bg-white border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-green-800 mb-2">
                        This utility fixes sales invoices that were saved but don't have complete ledger entries.
                        It will:
                    </p>
                    <ul className="text-sm text-green-800 list-disc list-inside space-y-1">
                        <li>Find sales invoices without ledger entries or with unbalanced entries</li>
                        <li>Delete any incomplete/unbalanced entries</li>
                        <li>Create new, properly balanced ledger entries</li>
                        <li>Include all revenue, COGS, inventory reduction, discounts, surcharges, and additional costs</li>
                    </ul>
                    <p className="text-sm text-green-600 mt-2 font-semibold">
                        ⚠️ Use this if you have sales invoices that were never posted or have missing entries.
                    </p>
                </div>

                <button
                    onClick={async () => {
                        if (!confirm('This will fix ledger entries for all sales invoices that need them.\n\nContinue?')) {
                            return;
                        }
                        setFixingSalesInvoiceLedgers(true);
                        setSalesInvoiceLedgerFixResult(null);
                        try {
                            await fixMissingSalesInvoiceLedgerEntries();
                            // The function shows its own alert, so we don't need to set result here
                        } catch (error: any) {
                            setSalesInvoiceLedgerFixResult({
                                success: false,
                                message: error.message || 'Unknown error',
                                fixed: 0,
                                errors: [error.message || 'Unknown error']
                            });
                        } finally {
                            setFixingSalesInvoiceLedgers(false);
                        }
                    }}
                    disabled={fixingSalesInvoiceLedgers}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {fixingSalesInvoiceLedgers ? (
                        <>
                            <RefreshCw className="animate-spin" size={16} />
                            Fixing...
                        </>
                    ) : (
                        <>
                            <CheckCircle size={16} />
                            Fix Missing Sales Invoice Ledger Entries
                        </>
                    )}
                </button>

                {salesInvoiceLedgerFixResult && (
                    <div className={`mt-4 p-4 rounded-lg ${salesInvoiceLedgerFixResult.success ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                        <p className={`font-semibold ${salesInvoiceLedgerFixResult.success ? 'text-green-800' : 'text-red-800'}`}>
                            {salesInvoiceLedgerFixResult.success ? '✅ Success!' : '❌ Error'}
                        </p>
                        <p className="text-sm mt-1">{salesInvoiceLedgerFixResult.message}</p>
                        {salesInvoiceLedgerFixResult.errors.length > 0 && (
                            <div className="mt-2">
                                <p className="text-sm font-semibold">Errors:</p>
                                <ul className="text-sm list-disc list-inside">
                                    {salesInvoiceLedgerFixResult.errors.map((err, idx) => (
                                        <li key={idx}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Diagnostic: What System Missed Section */}
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <Search className="text-yellow-600" size={24} />
                    <h3 className="text-lg font-bold text-yellow-900">Diagnostic: What System Missed</h3>
                </div>
                
                <div className="bg-white border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-yellow-800 mb-2">
                        This diagnostic tool shows what entries might be missing even though the Balance Sheet is balanced.
                        It checks for:
                    </p>
                    <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
                        <li>Purchases without ledger entries</li>
                        <li>Unbalanced transactions (debits ≠ credits)</li>
                        <li>Sales invoices without ledger entries</li>
                        <li>Balance Discrepancy account breakdown</li>
                        <li>Transactions with missing accounts or partners</li>
                    </ul>
                </div>

                <button
                    onClick={() => {
                        const issues: string[] = [];
                        const details: any = {
                            purchasesWithoutEntries: [],
                            unbalancedTransactions: [],
                            salesInvoicesWithoutEntries: [],
                            balanceDiscrepancyBreakdown: null,
                            missingAccounts: []
                        };

                        // 1. Check purchases without ledger entries
                        state.purchases.forEach(purchase => {
                            const transactionId = `PI-${purchase.batchNumber || purchase.id.toUpperCase()}`;
                            const entries = state.ledger.filter(e => 
                                e.transactionId === transactionId && 
                                !(e as any).isReportingOnly
                            );
                            
                            if (entries.length === 0) {
                                details.purchasesWithoutEntries.push({
                                    batch: purchase.batchNumber || purchase.id,
                                    date: purchase.date,
                                    supplier: state.partners.find(p => p.id === purchase.supplierId)?.name || 'Unknown',
                                    totalCost: purchase.totalCostFCY
                                });
                            } else {
                                // Check if balanced
                                const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                                const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                                const imbalance = Math.abs(totalDebits - totalCredits);
                                
                                if (imbalance > 0.01) {
                                    details.unbalancedTransactions.push({
                                        transactionId,
                                        type: 'Purchase',
                                        batch: purchase.batchNumber || purchase.id,
                                        debits: totalDebits,
                                        credits: totalCredits,
                                        imbalance
                                    });
                                }
                            }
                        });

                        // 2. Check sales invoices without ledger entries
                        state.salesInvoices.forEach(invoice => {
                            const transactionId = `INV-${invoice.invoiceNo}`;
                            const entries = state.ledger.filter(e => 
                                e.transactionId === transactionId && 
                                !(e as any).isReportingOnly
                            );
                            
                            if (entries.length === 0) {
                                details.salesInvoicesWithoutEntries.push({
                                    invoiceNo: invoice.invoiceNo,
                                    date: invoice.date,
                                    customer: state.partners.find(p => p.id === invoice.customerId)?.name || 'Unknown',
                                    total: invoice.netTotal
                                });
                            } else {
                                // Check if balanced
                                const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                                const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                                const imbalance = Math.abs(totalDebits - totalCredits);
                                
                                if (imbalance > 0.01) {
                                    details.unbalancedTransactions.push({
                                        transactionId,
                                        type: 'Sales Invoice',
                                        invoiceNo: invoice.invoiceNo,
                                        debits: totalDebits,
                                        credits: totalCredits,
                                        imbalance
                                    });
                                }
                            }
                        });

                        // 3. Check all transactions for balance
                        const transactionGroups: { [key: string]: any[] } = {};
                        state.ledger.forEach(entry => {
                            if (entry.transactionId && !(entry as any).isReportingOnly) {
                                if (!transactionGroups[entry.transactionId]) {
                                    transactionGroups[entry.transactionId] = [];
                                }
                                transactionGroups[entry.transactionId].push(entry);
                            }
                        });

                        // Check for BD transactions with only 1 entry (critical issue)
                        const bdTransactionsWithSingleEntry: any[] = [];
                        Object.entries(transactionGroups).forEach(([txId, entries]) => {
                            // Check if this is a BD transaction
                            const isBD = txId.startsWith('BD-') || entries.some(e => e.transactionType === TransactionType.BALANCING_DISCREPANCY);
                            
                            if (isBD && entries.length === 1) {
                                bdTransactionsWithSingleEntry.push({
                                    transactionId: txId,
                                    entryCount: entries.length,
                                    entry: entries[0],
                                    hasDebit: entries[0].debit > 0,
                                    hasCredit: entries[0].credit > 0,
                                    amount: entries[0].debit || entries[0].credit || 0
                                });
                            }
                        });
                        
                        // Add to details for reporting
                        details.bdTransactionsWithSingleEntry = bdTransactionsWithSingleEntry;

                        Object.entries(transactionGroups).forEach(([txId, entries]) => {
                            const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                            const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                            const imbalance = Math.abs(totalDebits - totalCredits);
                            
                            if (imbalance > 0.01 && !details.unbalancedTransactions.find(u => u.transactionId === txId)) {
                                details.unbalancedTransactions.push({
                                    transactionId: txId,
                                    type: 'Other',
                                    debits: totalDebits,
                                    credits: totalCredits,
                                    imbalance
                                });
                            }
                        });

                        // 4. Balance Discrepancy breakdown
                        const discrepancyAccount = state.accounts.find(a => 
                            a.name.includes('Balance Discrepancy') || 
                            a.name.includes('Discrepancy') ||
                            a.code === '505'
                        );
                        
                        if (discrepancyAccount) {
                            const discrepancyEntries = state.ledger.filter(e => 
                                e.accountId === discrepancyAccount.id
                            );
                            
                            const totalDebit = discrepancyEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
                            const totalCredit = discrepancyEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
                            
                            details.balanceDiscrepancyBreakdown = {
                                accountName: discrepancyAccount.name,
                                balance: discrepancyAccount.balance || 0,
                                totalDebit,
                                totalCredit,
                                entryCount: discrepancyEntries.length,
                                recentEntries: discrepancyEntries
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .slice(0, 10)
                                    .map(e => ({
                                        date: e.date,
                                        transactionId: e.transactionId,
                                        narration: e.narration,
                                        debit: e.debit,
                                        credit: e.credit
                                    }))
                            };
                        }

                        // 5. Check for missing accounts/partners in ledger entries
                        state.ledger.forEach(entry => {
                            if (!(entry as any).isReportingOnly) {
                                const account = state.accounts.find(a => a.id === entry.accountId);
                                const partner = state.partners.find(p => p.id === entry.accountId);
                                
                                if (!account && !partner) {
                                    if (!details.missingAccounts.find((m: any) => m.id === entry.accountId)) {
                                        details.missingAccounts.push({
                                            id: entry.accountId,
                                            accountName: entry.accountName,
                                            transactionId: entry.transactionId,
                                            date: entry.date
                                        });
                                    }
                                }
                            }
                        });

                        // Build report message
                        let report = '📊 DIAGNOSTIC REPORT: What System Missed\n\n';
                        report += `═══════════════════════════════════════\n\n`;

                        if (details.purchasesWithoutEntries.length > 0) {
                            report += `❌ PURCHASES WITHOUT LEDGER ENTRIES (${details.purchasesWithoutEntries.length}):\n`;
                            details.purchasesWithoutEntries.forEach((p: any) => {
                                report += `  • Batch ${p.batch} (${p.date}): ${p.supplier} - $${p.totalCost.toFixed(2)}\n`;
                            });
                            report += '\n';
                        }

                        if (details.salesInvoicesWithoutEntries.length > 0) {
                            report += `❌ SALES INVOICES WITHOUT LEDGER ENTRIES (${details.salesInvoicesWithoutEntries.length}):\n`;
                            details.salesInvoicesWithoutEntries.forEach((inv: any) => {
                                report += `  • ${inv.invoiceNo} (${inv.date}): ${inv.customer} - $${inv.total.toFixed(2)}\n`;
                            });
                            report += '\n';
                        }

                        // Add BD transactions with single entry to report
                        if (details.bdTransactionsWithSingleEntry && details.bdTransactionsWithSingleEntry.length > 0) {
                            report += `❌ CRITICAL: BD TRANSACTIONS WITH ONLY 1 ENTRY (${details.bdTransactionsWithSingleEntry.length}):\n`;
                            report += `These BD vouchers are missing their second entry (debit or credit). This causes balance sheet imbalance!\n\n`;
                            details.bdTransactionsWithSingleEntry.forEach((bd: any) => {
                                report += `  • ${bd.transactionId}: Only ${bd.entryCount} entry found\n`;
                                report += `    - Account: ${bd.entry.accountName}\n`;
                                report += `    - ${bd.hasDebit ? 'Debit' : 'Credit'}: $${bd.amount.toFixed(2)}\n`;
                                report += `    - Missing: ${bd.hasDebit ? 'Credit entry' : 'Debit entry'}\n`;
                                report += `    - Date: ${bd.entry.date}\n`;
                            });
                            report += '\n';
                            report += `💡 SOLUTION: Delete these BD transactions and recreate them properly with both debit and credit entries.\n\n`;
                        }

                        if (details.unbalancedTransactions.length > 0) {
                            report += `⚠️ UNBALANCED TRANSACTIONS (${details.unbalancedTransactions.length}):\n`;
                            details.unbalancedTransactions.forEach((u: any) => {
                                report += `  • ${u.transactionId} (${u.type}): Debits $${u.debits.toFixed(2)}, Credits $${u.credits.toFixed(2)}, Imbalance $${u.imbalance.toFixed(2)}\n`;
                            });
                            report += '\n';
                        }

                        if (details.balanceDiscrepancyBreakdown) {
                            const bd = details.balanceDiscrepancyBreakdown;
                            report += `💰 BALANCE DISCREPANCY BREAKDOWN:\n`;
                            report += `  Account: ${bd.accountName}\n`;
                            report += `  Current Balance: $${bd.balance.toFixed(2)}\n`;
                            report += `  Total Debits: $${bd.totalDebit.toFixed(2)}\n`;
                            report += `  Total Credits: $${bd.totalCredit.toFixed(2)}\n`;
                            report += `  Entry Count: ${bd.entryCount}\n`;
                            if (bd.recentEntries.length > 0) {
                                report += `  Recent Entries (last 10):\n`;
                                bd.recentEntries.forEach((e: any) => {
                                    report += `    • ${e.date} - ${e.transactionId}: ${e.narration} (Dr: $${e.debit.toFixed(2)}, Cr: $${e.credit.toFixed(2)})\n`;
                                });
                            }
                            report += '\n';
                        }

                        if (details.missingAccounts.length > 0) {
                            report += `⚠️ LEDGER ENTRIES WITH MISSING ACCOUNTS/PARTNERS (${details.missingAccounts.length}):\n`;
                            details.missingAccounts.forEach((m: any) => {
                                report += `  • Account ID: ${m.id}, Name: ${m.accountName}, Transaction: ${m.transactionId}\n`;
                            });
                            report += '\n';
                        }

                        if (details.purchasesWithoutEntries.length === 0 && 
                            details.salesInvoicesWithoutEntries.length === 0 && 
                            details.unbalancedTransactions.length === 0 && 
                            details.missingAccounts.length === 0) {
                            report += `✅ NO ISSUES FOUND!\n\n`;
                            report += `All purchases and sales invoices have complete ledger entries.\n`;
                            report += `All transactions are balanced.\n`;
                            if (details.balanceDiscrepancyBreakdown) {
                                report += `\nNote: Balance Discrepancy account has ${details.balanceDiscrepancyBreakdown.entryCount} entries with a balance of $${details.balanceDiscrepancyBreakdown.balance.toFixed(2)}.\n`;
                                report += `This is normal if you've used the Balance Discrepancy utility to adjust accounts.\n`;
                            }
                        }

                        report += `\n═══════════════════════════════════════\n`;
                        report += `\n💡 TIP: Use "Fix Missing Purchase Ledger Entries" to fix purchase issues.`;

                        // Show in alert (might be long, but user can scroll)
                        alert(report);
                        
                        // Also log to console for detailed inspection
                        console.log('📊 Full Diagnostic Details:', details);
                    }}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold flex items-center gap-2"
                >
                    <Search size={16} />
                    Run Diagnostic: What System Missed
                </button>
            </div>

            {/* Delete Partners by Type Utility Section */}
            <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-6 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <Users className="text-orange-600" size={24} />
                    <h3 className="text-lg font-bold text-orange-900">Delete Partners by Type</h3>
                </div>

                <div className="bg-white border border-orange-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-orange-800 mb-2">
                        <strong>⚠️ DESTRUCTIVE OPERATION:</strong> This utility will permanently delete all partners of the selected type for the selected factory:
                    </p>
                    <ul className="list-disc list-inside text-sm text-orange-700 space-y-1 ml-4">
                        <li>Delete ALL partners of the selected type (Supplier, Customer, Vendor, or All Types)</li>
                        <li>Delete associated opening balance ledger entries</li>
                        <li>This action CANNOT be undone</li>
                            </ul>
                    <p className="text-xs text-orange-600 mt-3 font-semibold">
                        Only proceed if you are absolutely certain. Make sure to backup your data first.
                        </p>
                    </div>

                <DeletePartnersByTypeUtility />
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

// Delete Partners by Type Utility Component
const DeletePartnersByTypeUtility: React.FC = () => {
    const { state } = useData();
    const { currentFactory, factories } = useAuth();
    const [selectedFactoryId, setSelectedFactoryId] = useState<string>(currentFactory?.id || '');
    const [selectedPartnerType, setSelectedPartnerType] = useState<PartnerType | 'ALL' | ''>('');
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

    // Get partners count for selected type and factory
    const getPartnersCount = () => {
        if (!selectedFactoryId || !selectedPartnerType) return 0;
        if (selectedPartnerType === 'ALL') {
            return state.partners.filter(p => p.factoryId === selectedFactoryId).length;
        }
        return state.partners.filter(p => 
            p.factoryId === selectedFactoryId && p.type === selectedPartnerType
        ).length;
    };

    // Delete opening balance ledger entries for a partner
    const deletePartnerOpeningBalances = async (partnerId: string, partnerCode: string | undefined) => {
        try {
            // Delete entries with OB-{partnerId} (for manually added partners)
            const obByIdQuery = query(
                collection(db, 'ledger'),
                where('transactionId', '==', `OB-${partnerId}`),
                where('factoryId', '==', selectedFactoryId)
            );
            const obByIdSnapshot = await getDocs(obByIdQuery);
            
            // Delete entries with OB-{partnerCode} (for CSV imported partners)
            let obByCodeSnapshot = { empty: true, docs: [] };
            if (partnerCode) {
                const obByCodeQuery = query(
                    collection(db, 'ledger'),
                    where('transactionId', '==', `OB-${partnerCode}`),
                    where('factoryId', '==', selectedFactoryId)
                );
                obByCodeSnapshot = await getDocs(obByCodeQuery);
            }

            const allEntries = [...obByIdSnapshot.docs, ...(obByCodeSnapshot.docs || [])];
            
            if (allEntries.length > 0) {
                // Delete in batches
                for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
                                const batch = writeBatch(db);
                    const batchEntries = allEntries.slice(i, i + BATCH_SIZE);
                    batchEntries.forEach(doc => batch.delete(doc.ref));
                                        await batch.commit();
                }
                return allEntries.length;
            }
            return 0;
        } catch (error: any) {
            console.error(`Error deleting opening balances for partner ${partnerId}:`, error);
            return 0;
        }
    };

    // Main delete function
    const executeDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!selectedFactoryId) {
            addLog('error', '❌ Please select a factory.');
            return;
        }

        if (!selectedPartnerType || selectedPartnerType === '') {
            addLog('error', '❌ Please select a partner type.');
            return;
        }

        if (pinCode !== SUPERVISOR_PIN) {
            addLog('error', '❌ Invalid PIN code.');
                                return;
                            }

        if (!isArmed) {
            addLog('error', '❌ Please arm the utility by toggling the switch.');
                                return;
                            }

        const partnersCount = getPartnersCount();
        if (partnersCount === 0) {
            const typeLabel = selectedPartnerType === 'ALL' ? 'partners' : `${selectedPartnerType} partners`;
            addLog('warning', `⚠️ No ${typeLabel} found for the selected factory.`);
                                return;
                            }

        setIsProcessing(true);
        setLogs([]);
        const typeLabel = selectedPartnerType === 'ALL' ? 'partner(s)' : `${selectedPartnerType} partner(s)`;
        addLog('info', `🚀 Starting deletion of ${partnersCount} ${typeLabel}...`);
        addLog('warning', 'This is a destructive operation. All selected partners will be permanently deleted.');

        try {
            const factory = factories.find(f => f.id === selectedFactoryId);
            const factoryName = factory?.name || selectedFactoryId;

            // Get all partners of the selected type for the selected factory
            const partnersToDelete = selectedPartnerType === 'ALL'
                ? state.partners.filter(p => p.factoryId === selectedFactoryId)
                : state.partners.filter(p => 
                    p.factoryId === selectedFactoryId && p.type === selectedPartnerType
                );

            addLog('info', `Found ${partnersToDelete.length} ${selectedPartnerType === 'ALL' ? 'partner(s)' : selectedPartnerType + ' partner(s)'} to delete.`);

            let deletedCount = 0;
            let deletedOpeningBalances = 0;
            let errors: string[] = [];

            // Delete partners in batches
            for (let i = 0; i < partnersToDelete.length; i += BATCH_SIZE) {
                                const batch = writeBatch(db);
                const batchPartners = partnersToDelete.slice(i, i + BATCH_SIZE);
                
                for (const partner of batchPartners) {
                    try {
                        // Delete opening balance ledger entries first
                        const partnerCode = (partner as any).code;
                        const deletedOB = await deletePartnerOpeningBalances(partner.id, partnerCode);
                        if (deletedOB > 0) {
                            deletedOpeningBalances += deletedOB;
                            addLog('info', `Deleted ${deletedOB} opening balance entries for ${partner.name}`);
                        }

                        // Delete partner document
                        const partnerRef = doc(db, 'partners', partner.id);
                        batch.delete(partnerRef);
                        deletedCount++;
                    } catch (error: any) {
                        const errorMsg = `Error deleting partner ${partner.name}: ${error?.message || 'Unknown error'}`;
                        errors.push(errorMsg);
                        addLog('error', errorMsg);
                    }
                }

                try {
                                    await batch.commit();
                    addLog('success', `✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Deleted ${batchPartners.length} partner(s)`);
                } catch (error: any) {
                    const errorMsg = `Error committing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error?.message || 'Unknown error'}`;
                    errors.push(errorMsg);
                    addLog('error', errorMsg);
                }
            }

            addLog('success', `🎉 Deletion completed!`);
            addLog('info', `✅ Deleted ${deletedCount} ${selectedPartnerType === 'ALL' ? 'partner(s)' : selectedPartnerType + ' partner(s)'}`);
            if (deletedOpeningBalances > 0) {
                addLog('info', `✅ Deleted ${deletedOpeningBalances} opening balance ledger entries`);
            }
            if (errors.length > 0) {
                addLog('warning', `⚠️ ${errors.length} error(s) occurred during deletion. Check logs above.`);
            }

            // Reset form
            setPinCode('');
            setIsArmed(false);
            setIsProcessing(false);
            setSelectedPartnerType('');

        } catch (error: any) {
            addLog('error', `❌ Error during deletion: ${error?.message || 'Unknown error'}`);
            console.error('Delete Partners Error:', error);
            setIsProcessing(false);
        }
    };

    const partnersCount = getPartnersCount();
    const isReady = selectedFactoryId && selectedPartnerType && pinCode === SUPERVISOR_PIN && isArmed && !isProcessing;

    return (
        <div className="space-y-4">
            {/* Factory Selector */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Select Factory <span className="text-red-500">*</span>
                </label>
                <select
                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
                    value={selectedFactoryId}
                    onChange={(e) => {
                        setSelectedFactoryId(e.target.value);
                        setSelectedPartnerType('');
                        setLogs([]);
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

            {/* Partner Type Selector */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Select Partner Type <span className="text-red-500">*</span>
                </label>
                <select
                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
                    value={selectedPartnerType}
                    onChange={(e) => {
                        setSelectedPartnerType(e.target.value as PartnerType | '');
                        setLogs([]);
                    }}
                    disabled={!selectedFactoryId || isProcessing}
                >
                    <option value="">-- Select Partner Type --</option>
                    <option value="ALL">All Partners (All Types)</option>
                    <option value={PartnerType.SUPPLIER}>Supplier</option>
                    <option value={PartnerType.CUSTOMER}>Customer</option>
                    <option value={PartnerType.VENDOR}>Vendor</option>
                    <option value={PartnerType.SUB_SUPPLIER}>Sub Supplier</option>
                    <option value={PartnerType.FREIGHT_FORWARDER}>Freight Forwarder</option>
                    <option value={PartnerType.CLEARING_AGENT}>Clearing Agent</option>
                    <option value={PartnerType.COMMISSION_AGENT}>Commission Agent</option>
                </select>
                {selectedPartnerType && partnersCount > 0 && (
                    <p className="text-sm text-orange-700 mt-2 font-semibold">
                        ⚠️ Found {partnersCount} {selectedPartnerType === 'ALL' ? 'partner(s)' : selectedPartnerType + ' partner(s)'} to delete
                    </p>
                )}
            </div>

            {/* Security PIN */}
                    <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                    Security PIN <span className="text-red-500">*</span>
                </label>
                <input
                    type="password"
                    className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Enter supervisor PIN"
                    value={pinCode}
                    onChange={(e) => {
                        setPinCode(e.target.value);
                        setIsArmed(false); // Reset armed state when PIN changes
                    }}
                    disabled={!selectedFactoryId || !selectedPartnerType || isProcessing}
                />
                </div>

            {/* Arming Toggle */}
            <div className="flex items-center gap-3 bg-slate-100 p-4 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        className="w-5 h-5 text-orange-600 focus:ring-orange-500 rounded"
                        checked={isArmed}
                        onChange={(e) => setIsArmed(e.target.checked)}
                        disabled={!selectedFactoryId || !selectedPartnerType || pinCode !== SUPERVISOR_PIN || isProcessing}
                    />
                    <span className="text-sm font-bold text-slate-700">
                        Arm Utility (Enable Delete Button)
                    </span>
                </label>
                    </div>

            {/* Execute Button */}
                    <button
                onClick={executeDelete}
                disabled={!isReady}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                    !isReady
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl'
                }`}
            >
                {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="animate-spin" size={20} />
                        Deleting Partners...
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        <Trash2 size={20} />
                        Delete {partnersCount > 0 ? `${partnersCount} ` : ''}{selectedPartnerType === 'ALL' ? 'All Partners' : selectedPartnerType || 'Partners'}
                    </span>
                        )}
                    </button>

            {/* Terminal/Logging UI */}
            {logs.length > 0 && (
                <div className="bg-slate-900 text-green-400 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs">
                        <span>Terminal Output</span>
                            </div>
                    {logs.map((log, idx) => (
                        <div
                            key={idx}
                            className={`mb-1 ${
                                log.type === 'error'
                                    ? 'text-red-400'
                                    : log.type === 'warning'
                                    ? 'text-yellow-400'
                                    : log.type === 'success'
                                    ? 'text-green-400'
                                    : 'text-slate-300'
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
