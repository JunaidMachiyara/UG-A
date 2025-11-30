
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState, useRef } from 'react';
import { AppState, LedgerEntry, Partner, Account, Item, TransactionType, AccountType, PartnerType, Division, SubDivision, Logo, Warehouse, Employee, AttendanceRecord, Purchase, OriginalOpening, ProductionEntry, OriginalType, OriginalProduct, Category, Section, BundlePurchase, PackingType, LogisticsEntry, SalesInvoice, OngoingOrder, SalesInvoiceItem, ArchivedTransaction, Task, Enquiry, Vehicle, VehicleCharge, SalaryPayment, ChatMessage, PlannerEntry, PlannerEntityType, PlannerPeriodType, GuaranteeCheque, CustomsDocument } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_ITEMS, INITIAL_LEDGER, INITIAL_PARTNERS, EXCHANGE_RATES, INITIAL_ORIGINAL_TYPES, INITIAL_ORIGINAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_SECTIONS, INITIAL_DIVISIONS, INITIAL_SUB_DIVISIONS, INITIAL_LOGOS, INITIAL_PURCHASES, INITIAL_LOGISTICS_ENTRIES, INITIAL_SALES_INVOICES, INITIAL_WAREHOUSES, INITIAL_ONGOING_ORDERS, INITIAL_EMPLOYEES, INITIAL_TASKS, INITIAL_VEHICLES, INITIAL_CHAT_MESSAGES, CURRENT_USER, INITIAL_ORIGINAL_OPENINGS, INITIAL_PRODUCTIONS, INITIAL_PLANNERS, INITIAL_GUARANTEE_CHEQUES, INITIAL_CUSTOMS_DOCUMENTS } from '../constants';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Helper for simple ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

type Action =
    | { type: 'POST_TRANSACTION'; payload: { entries: Omit<LedgerEntry, 'id'>[] } }
    | { type: 'RESTORE_STATE'; payload: AppState }
    | { type: 'LOAD_PARTNERS'; payload: Partner[] }
    | { type: 'LOAD_ACCOUNTS'; payload: Account[] }
    | { type: 'ADD_PARTNER'; payload: Partner }
    | { type: 'ADD_ITEM'; payload: Item }
    | { type: 'ADD_ACCOUNT'; payload: Account }
    | { type: 'ADD_DIVISION'; payload: Division }
    | { type: 'ADD_SUB_DIVISION'; payload: SubDivision }
    | { type: 'ADD_LOGO'; payload: Logo }
    | { type: 'ADD_WAREHOUSE'; payload: Warehouse }
    | { type: 'ADD_EMPLOYEE'; payload: Employee }
    | { type: 'UPDATE_EMPLOYEE'; payload: Employee }
    | { type: 'ADD_ORIGINAL_TYPE'; payload: OriginalType }
    | { type: 'ADD_ORIGINAL_PRODUCT'; payload: OriginalProduct }
    | { type: 'ADD_CATEGORY'; payload: Category }
    | { type: 'ADD_SECTION'; payload: Section }
    | { type: 'UPDATE_STOCK'; payload: { itemId: string; qtyChange: number } }
    | { type: 'DELETE_ENTITY'; payload: { type: 'partners' | 'items' | 'accounts' | 'employees' | 'divisions' | 'subDivisions' | 'logos' | 'warehouses' | 'originalTypes' | 'originalProducts' | 'categories' | 'sections' | 'originalOpenings' | 'salesInvoices' | 'ongoingOrders' | 'tasks' | 'enquiries' | 'vehicles' | 'planners' | 'guaranteeCheques' | 'customsDocuments'; id: string } }
    | { type: 'DELETE_LEDGER_ENTRIES'; payload: { transactionId: string; reason?: string; user?: string } }
    | { type: 'ADD_ORIGINAL_OPENING'; payload: OriginalOpening }
    | { type: 'ADD_PRODUCTION'; payload: ProductionEntry[] }
    | { type: 'ADD_PURCHASE'; payload: Purchase }
    | { type: 'ADD_BUNDLE_PURCHASE'; payload: BundlePurchase }
    | { type: 'SAVE_LOGISTICS_ENTRY'; payload: LogisticsEntry }
    | { type: 'ADD_SALES_INVOICE'; payload: SalesInvoice }
    | { type: 'UPDATE_SALES_INVOICE'; payload: SalesInvoice }
    | { type: 'POST_SALES_INVOICE'; payload: SalesInvoice }
    | { type: 'ADD_ONGOING_ORDER'; payload: OngoingOrder }
    | { type: 'UPDATE_ONGOING_ORDER'; payload: OngoingOrder }
    | { type: 'ADD_TASK'; payload: Task }
    | { type: 'UPDATE_TASK'; payload: Task }
    | { type: 'ADD_ENQUIRY'; payload: Enquiry }
    | { type: 'UPDATE_ENQUIRY'; payload: Enquiry }
    | { type: 'ADD_VEHICLE'; payload: Vehicle }
    | { type: 'UPDATE_VEHICLE'; payload: Vehicle }
    | { type: 'ADD_VEHICLE_CHARGE'; payload: VehicleCharge }
    | { type: 'SAVE_ATTENDANCE'; payload: AttendanceRecord }
    | { type: 'PROCESS_PAYROLL'; payload: SalaryPayment }
    | { type: 'SEND_MESSAGE'; payload: ChatMessage }
    | { type: 'MARK_CHAT_READ'; payload: { chatId: string, userId: string } }
    | { type: 'ADD_PLANNER_ENTRY'; payload: PlannerEntry }
    | { type: 'UPDATE_PLANNER_ENTRY'; payload: PlannerEntry }
    | { type: 'ADD_GUARANTEE_CHEQUE'; payload: GuaranteeCheque }
    | { type: 'UPDATE_GUARANTEE_CHEQUE'; payload: GuaranteeCheque }
    | { type: 'ADD_CUSTOMS_DOCUMENT'; payload: CustomsDocument };

const initialState: AppState = {
    accounts: [], // Will load from Firebase
    partners: [], // Will load from Firebase
    items: INITIAL_ITEMS,
    divisions: INITIAL_DIVISIONS,
    subDivisions: INITIAL_SUB_DIVISIONS,
    logos: INITIAL_LOGOS,
    warehouses: INITIAL_WAREHOUSES,
    employees: INITIAL_EMPLOYEES,
    attendance: [],
    salaryPayments: [],
    tasks: INITIAL_TASKS,
    enquiries: [],
    vehicles: INITIAL_VEHICLES,
    vehicleCharges: [],
    originalTypes: INITIAL_ORIGINAL_TYPES,
    originalProducts: INITIAL_ORIGINAL_PRODUCTS,
    categories: INITIAL_CATEGORIES,
    sections: INITIAL_SECTIONS,
    ledger: INITIAL_LEDGER,
    archive: [],
    productionHistory: [],
    productions: INITIAL_PRODUCTIONS, // LOADED
    purchases: INITIAL_PURCHASES,
    bundlePurchases: [],
    originalOpenings: INITIAL_ORIGINAL_OPENINGS, // LOADED
    logisticsEntries: INITIAL_LOGISTICS_ENTRIES,
    salesInvoices: INITIAL_SALES_INVOICES,
    ongoingOrders: INITIAL_ONGOING_ORDERS,
    chatMessages: INITIAL_CHAT_MESSAGES,
    planners: INITIAL_PLANNERS,
    guaranteeCheques: INITIAL_GUARANTEE_CHEQUES,
    customsDocuments: INITIAL_CUSTOMS_DOCUMENTS
};

const dataReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'RESTORE_STATE': {
            console.log('✅ RESTORING STATE FROM FIREBASE');
            return action.payload;
        }
        case 'LOAD_PARTNERS': {
            console.log('✅ LOADED PARTNERS FROM FIREBASE:', action.payload.length);
            return { ...state, partners: action.payload };
        }
        case 'LOAD_ACCOUNTS': {
            console.log('✅ LOADED ACCOUNTS FROM FIREBASE:', action.payload.length);
            return { ...state, accounts: action.payload };
        }
        case 'POST_TRANSACTION': {
            const newEntries = action.payload.entries.map(e => ({
                ...e,
                id: generateId()
            }));
            const updatedAccounts = state.accounts.map(acc => {
                const debitSum = newEntries.filter(e => e.accountId === acc.id).reduce((sum, e) => sum + e.debit, 0);
                const creditSum = newEntries.filter(e => e.accountId === acc.id).reduce((sum, e) => sum + e.credit, 0);
                let newBalance = acc.balance;
                if ([AccountType.ASSET, AccountType.EXPENSE].includes(acc.type)) {
                    newBalance = acc.balance + debitSum - creditSum;
                } else {
                    newBalance = acc.balance + creditSum - debitSum;
                }
                return { ...acc, balance: newBalance };
            });
            // Update Partner balances from AR/AP accounts
            const updatedPartners = state.partners.map(partner => {
                const partnerDebitSum = newEntries.filter(e => e.accountId === partner.id).reduce((sum, e) => sum + e.debit, 0);
                const partnerCreditSum = newEntries.filter(e => e.accountId === partner.id).reduce((sum, e) => sum + e.credit, 0);
                
                let newPartnerBalance = partner.balance;
                // For Customers (AR), a debit to AR increases their balance (they owe us more)
                // For Suppliers/Vendors (AP), a credit to AP increases our liability (we owe them more)
                // The balance stored in Partner object should reflect their AR/AP status
                if ([PartnerType.CUSTOMER].includes(partner.type)) { 
                    newPartnerBalance = partner.balance + partnerDebitSum - partnerCreditSum;
                } else { 
                    newPartnerBalance = partner.balance + partnerCreditSum - partnerDebitSum;
                }
                return { ...partner, balance: newPartnerBalance };
            });

            return {
                ...state,
                ledger: [...state.ledger, ...newEntries],
                accounts: updatedAccounts,
                partners: updatedPartners
            };
        }
        case 'UPDATE_STOCK': {
            const updatedItems = state.items.map(item => {
                if (item.id === action.payload.itemId) {
                    return { ...item, stockQty: item.stockQty + action.payload.qtyChange };
                }
                return item;
            });
            return { ...state, items: updatedItems };
        }
        case 'ADD_PARTNER': return { ...state, partners: [...state.partners, action.payload] };
        case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] };
        case 'ADD_ACCOUNT': return { ...state, accounts: [...state.accounts, action.payload] };
        case 'ADD_DIVISION': return { ...state, divisions: [...state.divisions, action.payload] };
        case 'ADD_SUB_DIVISION': return { ...state, subDivisions: [...state.subDivisions, action.payload] };
        case 'ADD_LOGO': return { ...state, logos: [...state.logos, action.payload] };
        case 'ADD_WAREHOUSE': return { ...state, warehouses: [...state.warehouses, action.payload] };
        case 'ADD_EMPLOYEE': return { ...state, employees: [...state.employees, action.payload] };
        case 'UPDATE_EMPLOYEE': return { ...state, employees: state.employees.map(e => e.id === action.payload.id ? action.payload : e) };
        case 'ADD_TASK': return { ...state, tasks: [action.payload, ...state.tasks] };
        case 'UPDATE_TASK': return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
        case 'ADD_ENQUIRY': return { ...state, enquiries: [action.payload, ...state.enquiries] };
        case 'UPDATE_ENQUIRY': return { ...state, enquiries: state.enquiries.map(e => e.id === action.payload.id ? action.payload : e) };
        case 'ADD_VEHICLE': return { ...state, vehicles: [...state.vehicles, action.payload] };
        case 'UPDATE_VEHICLE': return { ...state, vehicles: state.vehicles.map(v => v.id === action.payload.id ? action.payload : v) };
        case 'ADD_VEHICLE_CHARGE': return { ...state, vehicleCharges: [...state.vehicleCharges, action.payload] };
        case 'SAVE_ATTENDANCE': {
            const exists = state.attendance.findIndex(a => a.employeeId === action.payload.employeeId && a.date === action.payload.date);
            const newAttendance = [...state.attendance];
            if (exists >= 0) newAttendance[exists] = action.payload;
            else newAttendance.push(action.payload);
            return { ...state, attendance: newAttendance };
        }
        case 'PROCESS_PAYROLL': return { ...state, salaryPayments: [...state.salaryPayments, action.payload] };
        case 'SEND_MESSAGE': return { ...state, chatMessages: [...state.chatMessages, action.payload] };
        case 'MARK_CHAT_READ': {
            const updatedMessages = state.chatMessages.map(msg => {
                if (msg.chatId === action.payload.chatId && !msg.readBy.includes(action.payload.userId)) {
                    return { ...msg, readBy: [...msg.readBy, action.payload.userId] };
                }
                return msg;
            });
            return { ...state, chatMessages: updatedMessages };
        }
        case 'ADD_PLANNER_ENTRY': return { ...state, planners: [...state.planners, action.payload] };
        case 'UPDATE_PLANNER_ENTRY': return { ...state, planners: state.planners.map(p => p.id === action.payload.id ? action.payload : p) };
        case 'ADD_ORIGINAL_TYPE': return { ...state, originalTypes: [...state.originalTypes, action.payload] };
        case 'ADD_ORIGINAL_PRODUCT': return { ...state, originalProducts: [...state.originalProducts, action.payload] };
        case 'ADD_CATEGORY': return { ...state, categories: [...state.categories, action.payload] };
        case 'ADD_SECTION': return { ...state, sections: [...state.sections, action.payload] };
        case 'ADD_ORIGINAL_OPENING': return { ...state, originalOpenings: [action.payload, ...state.originalOpenings] };
        case 'ADD_PURCHASE': return { ...state, purchases: [action.payload, ...state.purchases] };
        case 'ADD_BUNDLE_PURCHASE': return { ...state, bundlePurchases: [action.payload, ...state.bundlePurchases] };
        case 'ADD_PRODUCTION': {
            const updatedItems = state.items.map(item => {
                const productionEntry = action.payload.find(p => p.itemId === item.id);
                if (productionEntry) {
                    const isProduction = productionEntry.qtyProduced > 0;
                    const isTracked = item.packingType !== PackingType.KG;
                    return {
                        ...item,
                        stockQty: item.stockQty + productionEntry.qtyProduced,
                        nextSerial: (item.nextSerial && isProduction && isTracked) 
                            ? item.nextSerial + productionEntry.qtyProduced 
                            : item.nextSerial
                    };
                }
                return item;
            });
            return {
                ...state,
                items: updatedItems,
                productions: [...state.productions, ...action.payload]
            };
        }
        case 'SAVE_LOGISTICS_ENTRY': {
            const entry = action.payload;
            const existingIdx = state.logisticsEntries.findIndex(e => e.purchaseId === entry.purchaseId);
            let updatedEntries = [...state.logisticsEntries];
            if (existingIdx >= 0) { updatedEntries[existingIdx] = entry; } 
            else { updatedEntries.push(entry); }
            let updatedPurchases = state.purchases;
            if (entry.purchaseType === 'ORIGINAL') {
                 updatedPurchases = state.purchases.map(p => p.id === entry.purchaseId ? { ...p, status: entry.status } : p);
            }
            return { ...state, logisticsEntries: updatedEntries, purchases: updatedPurchases };
        }
        case 'ADD_SALES_INVOICE': return { ...state, salesInvoices: [action.payload, ...state.salesInvoices] };
        case 'UPDATE_SALES_INVOICE': return { ...state, salesInvoices: state.salesInvoices.map(inv => inv.id === action.payload.id ? action.payload : inv) };
        case 'POST_SALES_INVOICE': {
            const updatedInvoices = state.salesInvoices.map(inv => inv.id === action.payload.id ? { ...action.payload, status: 'Posted' } : inv);
            const updatedPartners = state.partners.map(p => p.id === action.payload.customerId ? { ...p, balance: p.balance + action.payload.netTotal } : p);
            const updatedItems = state.items.map(item => {
                const soldItem = action.payload.items.find(i => i.itemId === item.id);
                if (soldItem) return { ...item, stockQty: item.stockQty - soldItem.qty };
                return item;
            });
            return { ...state, salesInvoices: updatedInvoices as SalesInvoice[], partners: updatedPartners, items: updatedItems };
        }
        case 'ADD_ONGOING_ORDER': return { ...state, ongoingOrders: [action.payload, ...state.ongoingOrders] };
        case 'UPDATE_ONGOING_ORDER': return { ...state, ongoingOrders: state.ongoingOrders.map(o => o.id === action.payload.id ? action.payload : o) };
        case 'ADD_GUARANTEE_CHEQUE': return { ...state, guaranteeCheques: [action.payload, ...state.guaranteeCheques] };
        case 'UPDATE_GUARANTEE_CHEQUE': return { ...state, guaranteeCheques: state.guaranteeCheques.map(g => g.id === action.payload.id ? action.payload : g) };
        case 'ADD_CUSTOMS_DOCUMENT': return { ...state, customsDocuments: [action.payload, ...state.customsDocuments] };
        case 'DELETE_ENTITY': return { ...state, [action.payload.type]: (state[action.payload.type] as any[]).filter((i: any) => i.id !== action.payload.id) };
        case 'DELETE_LEDGER_ENTRIES': {
             const entriesToRemove = state.ledger.filter(e => e.transactionId === action.payload.transactionId);
             if (entriesToRemove.length === 0) return state;
             const totalValue = entriesToRemove.reduce((sum, e) => sum + (e.debit > 0 ? e.debit : 0), 0);
             const archiveEntry: ArchivedTransaction = {
                 id: generateId(),
                 originalTransactionId: action.payload.transactionId,
                 deletedAt: new Date().toISOString(),
                 deletedBy: action.payload.user || 'Unknown',
                 reason: action.payload.reason || 'Deletion',
                 entries: entriesToRemove,
                 totalValue
             };
             const correctedAccounts = state.accounts.map(acc => {
                const debitRemoved = entriesToRemove.filter(e => e.accountId === acc.id).reduce((sum, e) => sum + e.debit, 0);
                const creditRemoved = entriesToRemove.filter(e => e.accountId === acc.id).reduce((sum, e) => sum + e.credit, 0);
                let newBalance = acc.balance;
                if ([AccountType.ASSET, AccountType.EXPENSE].includes(acc.type)) {
                    newBalance = acc.balance - debitRemoved + creditRemoved;
                } else {
                    newBalance = acc.balance - creditRemoved + debitRemoved;
                }
                return { ...acc, balance: newBalance };
             });
             return { ...state, ledger: state.ledger.filter(e => e.transactionId !== action.payload.transactionId), accounts: correctedAccounts, archive: [archiveEntry, ...state.archive] };
        }
        default: return state;
    }
};

interface DataContextType {
    state: AppState;
    isFirestoreLoaded: boolean;
    firestoreStatus: 'disconnected' | 'loading' | 'loaded' | 'error';
    firestoreError: string | null;
    postTransaction: (entries: Omit<LedgerEntry, 'id'>[]) => void;
    deleteTransaction: (transactionId: string, reason?: string, user?: string) => void;
    addPartner: (partner: Partner) => void;
    addItem: (item: Item, openingStock?: number) => void;
    addAccount: (account: Account) => void;
    addDivision: (division: Division) => void;
    addSubDivision: (subDivision: SubDivision) => void;
    addLogo: (logo: Logo) => void;
    addWarehouse: (warehouse: Warehouse) => void;
    addEmployee: (employee: Employee) => void;
    updateEmployee: (employee: Employee) => void;
    addTask: (task: Task) => void;
    updateTask: (task: Task) => void;
    addEnquiry: (enquiry: Enquiry) => void;
    updateEnquiry: (enquiry: Enquiry) => void;
    addVehicle: (vehicle: Vehicle) => void;
    updateVehicle: (vehicle: Vehicle) => void;
    saveAttendance: (record: AttendanceRecord) => void;
    processPayroll: (payment: SalaryPayment, sourceAccountId: string) => void;
    addVehicleFine: (vehicleId: string, type: string, amount: number, employeeId: string) => void;
    sendMessage: (msg: ChatMessage) => void;
    markChatRead: (chatId: string) => void;
    addOriginalType: (type: OriginalType) => void;
    addOriginalProduct: (prod: OriginalProduct) => void;
    addCategory: (cat: Category) => void;
    addSection: (sec: Section) => void;
    addOriginalOpening: (opening: OriginalOpening) => void;
    deleteOriginalOpening: (id: string) => void;
    addProduction: (productions: ProductionEntry[]) => void;
    postBaleOpening: (stagedItems: { itemId: string, qty: number, date: string }[]) => void;
    addPurchase: (purchase: Purchase) => void;
    addBundlePurchase: (purchase: BundlePurchase) => void;
    saveLogisticsEntry: (entry: LogisticsEntry) => void;
    addSalesInvoice: (invoice: SalesInvoice) => void;
    updateSalesInvoice: (invoice: SalesInvoice) => void;
    postSalesInvoice: (invoice: SalesInvoice) => void;
    addDirectSale: (invoice: SalesInvoice, batchLandedCostPerKg: number) => void;
    addOngoingOrder: (order: OngoingOrder) => void;
    processOrderShipment: (orderId: string, shipmentItems: { itemId: string, shipQty: number }[]) => void;
    deleteEntity: (type: any, id: string) => void;
    updateStock: (itemId: string, qtyChange: number) => void;
    addPlannerEntry: (entry: PlannerEntry) => void;
    updatePlannerEntry: (entry: PlannerEntry) => void;
    addGuaranteeCheque: (cheque: GuaranteeCheque) => void;
    updateGuaranteeCheque: (cheque: GuaranteeCheque) => void;
    addCustomsDocument: (doc: CustomsDocument) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(dataReducer, initialState);
    
    // 🛡️ CRITICAL SAFEGUARD: Firebase Connection State
    const [isFirestoreLoaded, setIsFirestoreLoaded] = useState(false);
    const [firestoreStatus, setFirestoreStatus] = useState<'disconnected' | 'loading' | 'loaded' | 'error'>('disconnected');
    const [firestoreError, setFirestoreError] = useState<string | null>(null);
    const isUpdatingFromFirestore = useRef(false);

    // 🔥 FIREBASE SYNC: Load partners and accounts from Firestore in real-time
    useEffect(() => {
        console.log('🔥 Connecting to Firebase Collections...');
        setFirestoreStatus('loading');

        // Listen to Partners collection
        const unsubscribePartners = onSnapshot(
            collection(db, 'partners'),
            (snapshot) => {
                const partners: Partner[] = [];
                snapshot.forEach((doc) => {
                    partners.push({
                        id: doc.id,
                        ...doc.data()
                    } as Partner);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_PARTNERS', payload: partners });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => {
                console.error('❌ Error loading partners:', error);
                setFirestoreError(error.message);
            }
        );

        // Listen to Accounts collection
        const unsubscribeAccounts = onSnapshot(
            collection(db, 'accounts'),
            (snapshot) => {
                const accounts: Account[] = [];
                snapshot.forEach((doc) => {
                    accounts.push({
                        id: doc.id,
                        ...doc.data()
                    } as Account);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_ACCOUNTS', payload: accounts });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => {
                console.error('❌ Error loading accounts:', error);
                setFirestoreError(error.message);
            }
        );

        // Mark as loaded after initial connection
        setTimeout(() => {
            setIsFirestoreLoaded(true);
            setFirestoreStatus('loaded');
            console.log('🟢 Firebase sync enabled!');
        }, 1000);

        return () => {
            unsubscribePartners();
            unsubscribeAccounts();
        };
    }, []);

    // 🛡️ CRITICAL: This effect is DISABLED in Phase 1 (READ-ONLY)
    // It will be enabled in Phase 2 after user confirmation
    /* WRITE OPERATIONS DISABLED
    useEffect(() => {
        if (!isFirestoreLoaded) {
            console.log('⛔ Waiting for Firestore to load before syncing changes...');
            return;
        }
        
        if (isUpdatingFromFirestore.current) {
            console.log('⛔ Skip sync - update came from Firestore');
            return;
        }
        
        // Phase 2: Auto-sync will be enabled here
        console.log('💾 Would sync to Firebase (currently disabled)');
    }, [state, isFirestoreLoaded]);
    */


    const postTransaction = (entries: Omit<LedgerEntry, 'id'>[]) => dispatch({ type: 'POST_TRANSACTION', payload: { entries } });
    const deleteTransaction = (transactionId: string, reason?: string, user?: string) => dispatch({ type: 'DELETE_LEDGER_ENTRIES', payload: { transactionId, reason, user } });
    const addPurchase = (purchase: Purchase) => {
        const typeDef = state.originalTypes.find(t => t.id === purchase.originalTypeId);
        const packingSize = typeDef ? typeDef.packingSize : 1; 
        const calculatedQty = purchase.weightPurchased / packingSize;
        const purchaseWithQty = { ...purchase, qtyPurchased: calculatedQty };
        dispatch({ type: 'ADD_PURCHASE', payload: purchaseWithQty });
        const inventoryId = '104'; 
        const apId = '201'; 
        const transactionId = `PI-${purchase.batchNumber || purchase.id.toUpperCase()}`;
        const entries: Omit<LedgerEntry, 'id'>[] = [
            { date: purchase.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: inventoryId, accountName: 'Inventory - Raw Material', currency: 'USD', exchangeRate: 1, fcyAmount: purchase.totalLandedCost, debit: purchase.totalLandedCost, credit: 0, narration: `Purchase: ${purchase.originalType} (Batch: ${purchase.batchNumber})` }
        ];
        const materialCostUSD = purchase.totalCostFCY / purchase.exchangeRate;
        entries.push({ date: purchase.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: apId, accountName: 'Accounts Payable', currency: purchase.currency, exchangeRate: purchase.exchangeRate, fcyAmount: purchase.totalCostFCY, debit: 0, credit: materialCostUSD, narration: `Material Cost: ${state.partners.find(p=>p.id===purchase.supplierId)?.name}` });
        purchase.additionalCosts.forEach(cost => {
            const providerName = state.partners.find(p => p.id === cost.providerId)?.name || 'Unknown Provider';
            entries.push({ date: purchase.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: apId, accountName: 'Accounts Payable', currency: cost.currency, exchangeRate: cost.exchangeRate, fcyAmount: cost.amountFCY, debit: 0, credit: cost.amountUSD, narration: `${cost.costType}: ${providerName}` });
        });
        postTransaction(entries);
    };
    const addBundlePurchase = (bundle: BundlePurchase) => {
        dispatch({ type: 'ADD_BUNDLE_PURCHASE', payload: bundle });
        const apId = '201'; const inventoryAssetId = '105'; const transactionId = `BUN-${bundle.batchNumber}`; const entries: Omit<LedgerEntry, 'id'>[] = [];
        const materialCostUSD = bundle.items.reduce((sum, item) => sum + item.totalUSD, 0); const materialCostFCY = bundle.items.reduce((sum, item) => sum + item.totalFCY, 0);
        entries.push({ date: bundle.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: inventoryAssetId, accountName: 'Inventory - Finished Goods', currency: 'USD', exchangeRate: 1, fcyAmount: materialCostUSD, debit: materialCostUSD, credit: 0, narration: `Bundle Purchase Material: ${bundle.batchNumber}` });
        entries.push({ date: bundle.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: apId, accountName: 'Accounts Payable', currency: bundle.currency, exchangeRate: bundle.exchangeRate, fcyAmount: materialCostFCY, debit: 0, credit: materialCostUSD, narration: `Bundle Purchase: ${state.partners.find(p=>p.id===bundle.supplierId)?.name}` });
        bundle.additionalCosts.forEach(cost => {
            const providerName = state.partners.find(p => p.id === cost.providerId)?.name || 'Unknown';
            entries.push({ date: bundle.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: inventoryAssetId, accountName: 'Inventory - Finished Goods', currency: 'USD', exchangeRate: 1, fcyAmount: cost.amountUSD, debit: cost.amountUSD, credit: 0, narration: `${cost.costType} (Capitalized): ${providerName}` });
            entries.push({ date: bundle.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: apId, accountName: 'Accounts Payable', currency: cost.currency, exchangeRate: cost.exchangeRate, fcyAmount: cost.amountFCY, debit: 0, credit: cost.amountUSD, narration: `${cost.costType}: ${providerName}` });
        });
        postTransaction(entries);
    };
    const addPartner = (partner: Partner) => {
        // 🛡️ SAFEGUARD: Don't sync if Firebase not loaded yet
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, partner not saved to database');
            dispatch({ type: 'ADD_PARTNER', payload: partner });
            return;
        }

        // First update local state immediately (optimistic update)
        dispatch({ type: 'ADD_PARTNER', payload: partner });

        // Then save to Firebase
        const partnerData = {
            ...partner,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Remove undefined values (Firestore doesn't accept them)
        Object.keys(partnerData).forEach(key => {
            if ((partnerData as any)[key] === undefined) {
                (partnerData as any)[key] = null;
            }
        });

        addDoc(collection(db, 'partners'), partnerData)
            .then((docRef) => {
                console.log('✅ Partner saved to Firebase:', docRef.id);
            })
            .catch((error) => {
                console.error('❌ Error saving partner to Firebase:', error);
                alert('Failed to save partner: ' + error.message);
            });

        // Handle opening balance if needed
        if (partner.balance !== 0) {
            const prevYear = new Date().getFullYear() - 1; const date = `${prevYear}-12-31`; const openingEquityId = state.accounts.find(a => a.name.includes('Capital'))?.id || '301'; const arId = state.accounts.find(a => a.name.includes('Receivable'))?.id || '103'; const apId = state.accounts.find(a => a.name.includes('Payable'))?.id || '201';
            let entries: Omit<LedgerEntry, 'id'>[] = []; const currency = partner.defaultCurrency || 'USD'; const rate = EXCHANGE_RATES[currency] || 1; const fcyAmt = partner.balance * rate; const commonProps = { currency, exchangeRate: rate, fcyAmount: Math.abs(fcyAmt) };
            if (partner.balance > 0) { entries = [ { ...commonProps, date, transactionId: `OB-${partner.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: arId, accountName: 'Accounts Receivable', debit: partner.balance, credit: 0, narration: `Opening Balance - ${partner.name}` }, { ...commonProps, date, transactionId: `OB-${partner.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: openingEquityId, accountName: 'Opening Equity', debit: 0, credit: partner.balance, narration: `Opening Balance - ${partner.name}` } ]; } 
            else { const absBalance = Math.abs(partner.balance); entries = [ { ...commonProps, date, transactionId: `OB-${partner.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: openingEquityId, accountName: 'Opening Equity', debit: absBalance, credit: 0, narration: `Opening Balance - ${partner.name}` }, { ...commonProps, date, transactionId: `OB-${partner.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: apId, accountName: 'Accounts Payable', debit: 0, credit: absBalance, narration: `Opening Balance - ${partner.name}` } ]; }
            postTransaction(entries);
        }
    };
    const addItem = (item: Item, openingStock: number = 0) => {
        const nextSerial = openingStock + 1; const itemWithStock = { ...item, stockQty: openingStock, nextSerial: nextSerial }; dispatch({ type: 'ADD_ITEM', payload: itemWithStock });
        if (openingStock > 0 && item.avgCost > 0) {
             const prevYear = new Date().getFullYear() - 1; const date = `${prevYear}-12-31`; const stockValue = openingStock * item.avgCost; const inventoryId = item.category === 'Raw Material' ? '104' : '105'; const capitalId = '301';
             const entries: Omit<LedgerEntry, 'id'>[] = [ { date, transactionId: `OB-STK-${item.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: inventoryId, accountName: 'Inventory Asset', currency: 'USD', exchangeRate: 1, fcyAmount: stockValue, debit: stockValue, credit: 0, narration: `Opening Stock - ${item.name}` }, { date, transactionId: `OB-STK-${item.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: capitalId, accountName: 'Capital', currency: 'USD', exchangeRate: 1, fcyAmount: stockValue, debit: 0, credit: stockValue, narration: `Opening Stock - ${item.name}` } ]; postTransaction(entries);
        }
    };
    const addOriginalOpening = (opening: OriginalOpening) => {
        dispatch({ type: 'ADD_ORIGINAL_OPENING', payload: opening });
        const fgInvId = state.accounts.find(a => a.name.includes('Finished Goods'))?.id || '105'; const expenseId = state.accounts.find(a => a.name.includes('Cost of Goods'))?.id || '501'; const transactionId = `OO-${opening.id}`;
        const entries: Omit<LedgerEntry, 'id'>[] = [ { date: opening.date, transactionId, transactionType: TransactionType.ORIGINAL_OPENING, accountId: fgInvId, accountName: 'Inventory - Finished Goods (WIP)', currency: 'USD', exchangeRate: 1, fcyAmount: opening.totalValue, debit: opening.totalValue, credit: 0, narration: `Consumption: ${opening.originalType} (${opening.weightOpened}kg)` }, { date: opening.date, transactionId, transactionType: TransactionType.ORIGINAL_OPENING, accountId: expenseId, accountName: 'Raw Material Consumption Expense', currency: 'USD', exchangeRate: 1, fcyAmount: opening.totalValue, debit: 0, credit: opening.totalValue, narration: `Consumption: ${opening.originalType} (${opening.weightOpened}kg)` } ]; postTransaction(entries);
    };
    const deleteOriginalOpening = (id: string) => { dispatch({ type: 'DELETE_ENTITY', payload: { type: 'originalOpenings', id } }); const transactionId = `OO-${id}`; dispatch({ type: 'DELETE_LEDGER_ENTRIES', payload: { transactionId, reason: 'Delete Original Opening', user: 'Admin' } }); };
    const addProduction = (productions: ProductionEntry[]) => dispatch({ type: 'ADD_PRODUCTION', payload: productions });
    const postBaleOpening = (stagedItems: { itemId: string, qty: number, date: string }[]) => {
        if (stagedItems.length === 0) return;
        const transactionId = generateId(); const expenseId = state.accounts.find(a => a.name.includes('Cost of Goods'))?.id || '501'; const fgInvId = state.accounts.find(a => a.name.includes('Finished Goods'))?.id || '105';
        const productionEntries: ProductionEntry[] = []; const journalEntries: Omit<LedgerEntry, 'id'>[] = [];
        stagedItems.forEach(itemData => {
            const item = state.items.find(i => i.id === itemData.itemId); if (!item) return;
            const totalKg = itemData.qty * item.weightPerUnit; const value = totalKg * item.avgCost;
            productionEntries.push({ id: `NEG-PROD-${item.id}-${transactionId}`, date: itemData.date, itemId: item.id, itemName: item.name, packingType: item.packingType, qtyProduced: -itemData.qty, weightProduced: -totalKg });
            const dummyOpening: OriginalOpening = { id: `OO-INT-${item.id}-${transactionId}`, date: itemData.date, supplierId: 'SUP-INTERNAL-STOCK', originalType: `FROM-${item.name}`, qtyOpened: itemData.qty, weightOpened: totalKg, costPerKg: item.avgCost, totalValue: value };
            dispatch({ type: 'ADD_ORIGINAL_OPENING', payload: dummyOpening });
            journalEntries.push({ date: itemData.date, transactionId: `JV-BO-${transactionId}`, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: expenseId, accountName: 'Raw Material Consumption Expense', currency: 'USD', exchangeRate: 1, fcyAmount: value, debit: value, credit: 0, narration: `Bale Opening: ${item.name} (${itemData.qty} Units)` });
            journalEntries.push({ date: itemData.date, transactionId: `JV-BO-${transactionId}`, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: fgInvId, accountName: 'Inventory - Finished Goods', currency: 'USD', exchangeRate: 1, fcyAmount: value, debit: 0, credit: value, narration: `Bale Opening: ${item.name} (${itemData.qty} Units)` });
        });
        dispatch({ type: 'ADD_PRODUCTION', payload: productionEntries }); postTransaction(journalEntries);
    };
    const saveLogisticsEntry = (entry: LogisticsEntry) => dispatch({ type: 'SAVE_LOGISTICS_ENTRY', payload: entry });
    const addSalesInvoice = (invoice: SalesInvoice) => dispatch({ type: 'ADD_SALES_INVOICE', payload: invoice });
    const updateSalesInvoice = (invoice: SalesInvoice) => dispatch({ type: 'UPDATE_SALES_INVOICE', payload: invoice });
    const postSalesInvoice = (invoice: SalesInvoice) => {
        dispatch({ type: 'POST_SALES_INVOICE', payload: invoice });
        const transactionId = `INV-${invoice.invoiceNo}`; const arId = '103'; const revenueId = '401'; const apId = '201'; const discountId = state.accounts.find(a => a.name.includes('Discount'))?.id || '501';
        const entries: Omit<LedgerEntry, 'id'>[] = [ { date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: arId, accountName: 'Accounts Receivable', currency: invoice.currency, exchangeRate: invoice.exchangeRate, fcyAmount: invoice.netTotal, debit: invoice.netTotal / invoice.exchangeRate, credit: 0, narration: `Sales Invoice: ${invoice.invoiceNo}` } ];
        const totalItemsRevenueUSD = invoice.items.reduce((sum, item) => { const itemRate = item.exchangeRate || invoice.exchangeRate; return sum + (item.total / itemRate); }, 0);
        entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: revenueId, accountName: 'Sales Revenue', currency: 'USD', exchangeRate: 1, fcyAmount: totalItemsRevenueUSD, debit: 0, credit: totalItemsRevenueUSD, narration: `Revenue: ${invoice.invoiceNo}` });
        if (invoice.surcharge > 0) { const surchargeUSD = invoice.surcharge / invoice.exchangeRate; entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: revenueId, accountName: 'Sales Revenue (Surcharge)', currency: 'USD', exchangeRate: 1, fcyAmount: surchargeUSD, debit: 0, credit: surchargeUSD, narration: `Surcharge: ${invoice.invoiceNo}` }); }
        if (invoice.discount > 0) { const discountUSD = invoice.discount / invoice.exchangeRate; entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: discountId, accountName: 'Sales Discount', currency: 'USD', exchangeRate: 1, fcyAmount: discountUSD, debit: discountUSD, credit: 0, narration: `Discount: ${invoice.invoiceNo}` }); }
        invoice.additionalCosts.forEach(cost => { const amountUSD = cost.amount / cost.exchangeRate; entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: apId, accountName: 'Accounts Payable', currency: cost.currency, exchangeRate: cost.exchangeRate, fcyAmount: cost.amount, debit: 0, credit: amountUSD, narration: `${cost.costType} Payable: ${invoice.invoiceNo}` }); });
        postTransaction(entries);
    };
    const addDirectSale = (invoice: SalesInvoice, batchLandedCostPerKg: number) => {
        dispatch({ type: 'ADD_SALES_INVOICE', payload: invoice });
        const transactionId = `DS-${invoice.invoiceNo}`; const arId = '103'; const revenueId = '401'; const cogsId = state.accounts.find(a => a.name.includes('COGS - Direct'))?.id || '503'; const rawMatInventoryId = '104';
        const entries: Omit<LedgerEntry, 'id'>[] = [ { date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: arId, accountName: 'Accounts Receivable', currency: invoice.currency, exchangeRate: invoice.exchangeRate, fcyAmount: invoice.netTotal, debit: invoice.netTotal / invoice.exchangeRate, credit: 0, narration: `Direct Sale: ${invoice.invoiceNo}` }, { date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: revenueId, accountName: 'Sales Revenue', currency: 'USD', exchangeRate: 1, fcyAmount: invoice.netTotal / invoice.exchangeRate, debit: 0, credit: invoice.netTotal / invoice.exchangeRate, narration: `Direct Sale Revenue: ${invoice.invoiceNo}` } ];
        const totalSoldKg = invoice.items.reduce((sum, i) => sum + i.totalKg, 0); const totalCostUSD = totalSoldKg * batchLandedCostPerKg;
        entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: cogsId, accountName: 'COGS - Direct Sales', currency: 'USD', exchangeRate: 1, fcyAmount: totalCostUSD, debit: totalCostUSD, credit: 0, narration: `Cost of Direct Sale: ${invoice.invoiceNo} (${totalSoldKg}kg)` });
        entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: rawMatInventoryId, accountName: 'Inventory - Raw Material', currency: 'USD', exchangeRate: 1, fcyAmount: totalCostUSD, debit: 0, credit: totalCostUSD, narration: `Inventory Consumption: Direct Sale ${invoice.invoiceNo}` });
        postTransaction(entries);
    };
    const addOngoingOrder = (order: OngoingOrder) => dispatch({ type: 'ADD_ONGOING_ORDER', payload: order });
    const processOrderShipment = (orderId: string, shipmentItems: { itemId: string, shipQty: number }[]) => {
        const order = state.ongoingOrders.find(o => o.id === orderId); if (!order) return;
        const updatedItems = order.items.map(item => { const ship = shipmentItems.find(s => s.itemId === item.itemId); if (ship) return { ...item, shippedQuantity: item.shippedQuantity + ship.shipQty }; return item; });
        const isFullyShipped = updatedItems.every(i => i.shippedQuantity >= i.quantity); const hasSomeShipped = updatedItems.some(i => i.shippedQuantity > 0); const newStatus = isFullyShipped ? 'Completed' : hasSomeShipped ? 'PartiallyShipped' : 'Active';
        const updatedOrder: OngoingOrder = { ...order, items: updatedItems, status: newStatus }; dispatch({ type: 'UPDATE_ONGOING_ORDER', payload: updatedOrder });
        const customer = state.partners.find(p => p.id === order.customerId); const currency = customer?.defaultCurrency || 'USD'; const rate = EXCHANGE_RATES[currency] || 1; const invoiceItems: SalesInvoiceItem[] = [];
        shipmentItems.forEach(ship => { if (ship.shipQty <= 0) return; const itemDef = state.items.find(i => i.id === ship.itemId); if (!itemDef) return; const unitRate = itemDef.salePrice || 0; invoiceItems.push({ id: generateId(), itemId: ship.itemId, itemName: itemDef.name, qty: ship.shipQty, rate: unitRate, total: ship.shipQty * unitRate, totalKg: ship.shipQty * itemDef.weightPerUnit, currency: currency, exchangeRate: rate, sourceOrderId: order.id }); });
        if (invoiceItems.length === 0) return;
        const maxInv = state.salesInvoices.map(i => parseInt(i.invoiceNo.replace('SINV-', ''))).filter(n => !isNaN(n)).reduce((max, curr) => curr > max ? curr : max, 1000); const nextInvNo = `SINV-${maxInv + 1}`; const grossTotal = invoiceItems.reduce((sum, i) => sum + i.total, 0);
        const newInvoice: SalesInvoice = { id: generateId(), invoiceNo: nextInvNo, date: new Date().toISOString().split('T')[0], status: 'Unposted', customerId: order.customerId, logoId: state.logos[0]?.id || '', currency: currency, exchangeRate: rate, divisionId: customer?.divisionId, subDivisionId: customer?.subDivisionId, discount: 0, surcharge: 0, items: invoiceItems, additionalCosts: [], grossTotal: grossTotal, netTotal: grossTotal };
        dispatch({ type: 'ADD_SALES_INVOICE', payload: newInvoice });
    };
    const addEmployee = (employee: Employee) => dispatch({ type: 'ADD_EMPLOYEE', payload: employee });
    const updateEmployee = (employee: Employee) => dispatch({ type: 'UPDATE_EMPLOYEE', payload: employee });
    const addTask = (task: Task) => dispatch({ type: 'ADD_TASK', payload: task });
    const updateTask = (task: Task) => dispatch({ type: 'UPDATE_TASK', payload: task });
    const addEnquiry = (enquiry: Enquiry) => dispatch({ type: 'ADD_ENQUIRY', payload: enquiry });
    const updateEnquiry = (enquiry: Enquiry) => dispatch({ type: 'UPDATE_ENQUIRY', payload: enquiry });
    const addVehicle = (vehicle: Vehicle) => dispatch({ type: 'ADD_VEHICLE', payload: vehicle });
    const updateVehicle = (vehicle: Vehicle) => dispatch({ type: 'UPDATE_VEHICLE', payload: vehicle });
    const saveAttendance = (record: AttendanceRecord) => dispatch({ type: 'SAVE_ATTENDANCE', payload: record });
    const processPayroll = (payment: SalaryPayment, sourceAccountId: string) => {
        dispatch({ type: 'PROCESS_PAYROLL', payload: payment });
        const salaryExpenseId = state.accounts.find(a => a.name.includes('Salaries'))?.id || '504';
        const entries: Omit<LedgerEntry, 'id'>[] = [ { date: payment.paymentDate, transactionId: payment.voucherId, transactionType: TransactionType.PAYMENT_VOUCHER, accountId: salaryExpenseId, accountName: 'Salaries & Wages', currency: 'USD', exchangeRate: 1, fcyAmount: payment.netPaid, debit: payment.netPaid, credit: 0, narration: `Payroll ${payment.monthYear}: ${state.employees.find(e => e.id === payment.employeeId)?.name}` }, { date: payment.paymentDate, transactionId: payment.voucherId, transactionType: TransactionType.PAYMENT_VOUCHER, accountId: sourceAccountId, accountName: 'Cash/Bank', currency: 'USD', exchangeRate: 1, fcyAmount: payment.netPaid, debit: 0, credit: payment.netPaid, narration: `Payroll ${payment.monthYear}: ${state.employees.find(e => e.id === payment.employeeId)?.name}` } ]; postTransaction(entries);
    };
    const addVehicleFine = (vehicleId: string, type: string, amount: number, employeeId: string) => {
        const vehicle = state.vehicles.find(v => v.id === vehicleId); const employee = state.employees.find(e => e.id === employeeId); if (!vehicle || !employee) return;
        const charge: VehicleCharge = { id: generateId(), vehicleId, employeeId, date: new Date().toISOString().split('T')[0], type, amount, journalEntryId: `JV-VF-${generateId()}` }; dispatch({ type: 'ADD_VEHICLE_CHARGE', payload: charge });
        const salaryExpenseId = state.accounts.find(a => a.name.includes('Vehicle Expenses'))?.id || '505'; const otherIncomeId = '401'; 
        const entries: Omit<LedgerEntry, 'id'>[] = [ { date: charge.date, transactionId: charge.journalEntryId, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: salaryExpenseId, accountName: 'Vehicle Expenses', currency: 'USD', exchangeRate: 1, fcyAmount: amount, debit: amount, credit: 0, narration: `Fine: ${type} - ${vehicle.plateNumber}` }, { date: charge.date, transactionId: charge.journalEntryId, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: otherIncomeId, accountName: 'Other Income / Recoverable', currency: 'USD', exchangeRate: 1, fcyAmount: amount, debit: 0, credit: amount, narration: `Fine Recovery from ${employee.name}` } ]; postTransaction(entries);
    };
    const sendMessage = (msg: ChatMessage) => dispatch({ type: 'SEND_MESSAGE', payload: msg });
    const markChatRead = (chatId: string) => dispatch({ type: 'MARK_CHAT_READ', payload: { chatId, userId: CURRENT_USER.id } });
    const addOriginalType = (type: OriginalType) => dispatch({ type: 'ADD_ORIGINAL_TYPE', payload: type });
    const addOriginalProduct = (prod: OriginalProduct) => dispatch({ type: 'ADD_ORIGINAL_PRODUCT', payload: prod });
    const addCategory = (cat: Category) => dispatch({ type: 'ADD_CATEGORY', payload: cat });
    const addSection = (sec: Section) => dispatch({ type: 'ADD_SECTION', payload: sec });
    const addAccount = (account: Account) => dispatch({ type: 'ADD_ACCOUNT', payload: account });
    const addDivision = (division: Division) => dispatch({ type: 'ADD_DIVISION', payload: division });
    const addSubDivision = (subDivision: SubDivision) => dispatch({ type: 'ADD_SUB_DIVISION', payload: subDivision });
    const addLogo = (logo: Logo) => dispatch({ type: 'ADD_LOGO', payload: logo });
    const addWarehouse = (warehouse: Warehouse) => dispatch({ type: 'ADD_WAREHOUSE', payload: warehouse });
    const deleteEntity = (type: any, id: string) => dispatch({ type: 'DELETE_ENTITY', payload: { type, id } });
    const updateStock = (itemId: string, qtyChange: number) => dispatch({ type: 'UPDATE_STOCK', payload: { itemId, qtyChange } });
    const addPlannerEntry = (entry: PlannerEntry) => dispatch({ type: 'ADD_PLANNER_ENTRY', payload: entry });
    const updatePlannerEntry = (entry: PlannerEntry) => dispatch({ type: 'UPDATE_PLANNER_ENTRY', payload: entry });
    const addGuaranteeCheque = (cheque: GuaranteeCheque) => dispatch({ type: 'ADD_GUARANTEE_CHEQUE', payload: cheque });
    const updateGuaranteeCheque = (cheque: GuaranteeCheque) => dispatch({ type: 'UPDATE_GUARANTEE_CHEQUE', payload: cheque });
    const addCustomsDocument = (doc: CustomsDocument) => dispatch({ type: 'ADD_CUSTOMS_DOCUMENT', payload: doc });

    return (
        <DataContext.Provider value={{
            state,
            isFirestoreLoaded,
            firestoreStatus,
            firestoreError,
            postTransaction,
            deleteTransaction,
            addPartner,
            addItem,
            addAccount,
            addDivision,
            addSubDivision,
            addLogo,
            addWarehouse,
            addEmployee,
            updateEmployee,
            addTask,
            updateTask,
            addEnquiry,
            updateEnquiry,
            addVehicle,
            updateVehicle,
            addVehicleFine,
            saveAttendance,
            processPayroll,
            sendMessage,
            markChatRead,
            addOriginalType,
            addOriginalProduct,
            addCategory,
            addSection,
            addOriginalOpening,
            deleteOriginalOpening,
            addProduction,
            postBaleOpening,
            addPurchase,
            addBundlePurchase,
            saveLogisticsEntry,
            addSalesInvoice,
            updateSalesInvoice,
            postSalesInvoice,
            addDirectSale,
            addOngoingOrder,
            processOrderShipment,
            deleteEntity,
            updateStock,
            addPlannerEntry,
            updatePlannerEntry,
            addGuaranteeCheque,
            updateGuaranteeCheque,
            addCustomsDocument
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error("useData must be used within a DataProvider");
    }
    return context;
};
