
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState, useRef } from 'react';
import { AppState, LedgerEntry, Partner, Account, Item, TransactionType, AccountType, PartnerType, Division, SubDivision, Logo, Warehouse, Employee, AttendanceRecord, Purchase, OriginalOpening, ProductionEntry, OriginalType, OriginalProduct, Category, Section, BundlePurchase, PackingType, LogisticsEntry, SalesInvoice, OngoingOrder, SalesInvoiceItem, ArchivedTransaction, Task, Enquiry, Vehicle, VehicleCharge, SalaryPayment, ChatMessage, PlannerEntry, PlannerEntityType, PlannerPeriodType, GuaranteeCheque, CustomsDocument, CurrencyRate, Currency } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_ITEMS, INITIAL_LEDGER, INITIAL_PARTNERS, EXCHANGE_RATES, INITIAL_ORIGINAL_TYPES, INITIAL_ORIGINAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_SECTIONS, INITIAL_DIVISIONS, INITIAL_SUB_DIVISIONS, INITIAL_LOGOS, INITIAL_PURCHASES, INITIAL_LOGISTICS_ENTRIES, INITIAL_SALES_INVOICES, INITIAL_WAREHOUSES, INITIAL_ONGOING_ORDERS, INITIAL_EMPLOYEES, INITIAL_TASKS, INITIAL_VEHICLES, INITIAL_CHAT_MESSAGES, CURRENT_USER, INITIAL_ORIGINAL_OPENINGS, INITIAL_PRODUCTIONS, INITIAL_PLANNERS, INITIAL_GUARANTEE_CHEQUES, INITIAL_CUSTOMS_DOCUMENTS, INITIAL_CURRENCIES } from '../constants';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { useAuth } from './AuthContext';

// Helper for simple ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

type Action =
    | { type: 'POST_TRANSACTION'; payload: { entries: Omit<LedgerEntry, 'id'>[] } }
    | { type: 'RESTORE_STATE'; payload: AppState }
    | { type: 'LOAD_PARTNERS'; payload: Partner[] }
    | { type: 'LOAD_ACCOUNTS'; payload: Account[] }
    | { type: 'LOAD_ITEMS'; payload: Item[] }
    | { type: 'LOAD_CATEGORIES'; payload: Category[] }
    | { type: 'LOAD_SECTIONS'; payload: Section[] }
    | { type: 'LOAD_WAREHOUSES'; payload: Warehouse[] }
    | { type: 'LOAD_DIVISIONS'; payload: Division[] }
    | { type: 'LOAD_SUBDIVISIONS'; payload: SubDivision[] }
    | { type: 'LOAD_LOGOS'; payload: Logo[] }
    | { type: 'LOAD_ORIGINAL_TYPES'; payload: OriginalType[] }
    | { type: 'LOAD_ORIGINAL_PRODUCTS'; payload: OriginalProduct[] }
    | { type: 'LOAD_EMPLOYEES'; payload: Employee[] }
    | { type: 'LOAD_CURRENCIES'; payload: CurrencyRate[] }
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
    | { type: 'ADD_CURRENCY'; payload: CurrencyRate }
    | { type: 'UPDATE_STOCK'; payload: { itemId: string; qtyChange: number } }
    | { type: 'DELETE_ENTITY'; payload: { type: 'partners' | 'items' | 'accounts' | 'employees' | 'divisions' | 'subDivisions' | 'logos' | 'warehouses' | 'originalTypes' | 'originalProducts' | 'categories' | 'sections' | 'originalOpenings' | 'salesInvoices' | 'ongoingOrders' | 'tasks' | 'enquiries' | 'vehicles' | 'planners' | 'guaranteeCheques' | 'customsDocuments' | 'currencies'; id: string } }
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
    // Factory & User Management
    factories: [],
    users: [],
    currentUser: null,
    currentFactory: null,
    
    accounts: [], // Will load from Firebase
    partners: [], // Will load from Firebase
    items: INITIAL_ITEMS,
    divisions: INITIAL_DIVISIONS,
    subDivisions: INITIAL_SUB_DIVISIONS,
    logos: INITIAL_LOGOS,
    warehouses: INITIAL_WAREHOUSES,
    currencies: [], // Will load from Firebase
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
        case 'LOAD_ITEMS': {
            console.log('✅ LOADED ITEMS FROM FIREBASE:', action.payload.length);
            return { ...state, items: action.payload };
        }
        case 'LOAD_CATEGORIES': {
            console.log('✅ LOADED CATEGORIES FROM FIREBASE:', action.payload.length);
            return { ...state, categories: action.payload };
        }
        case 'LOAD_SECTIONS': {
            console.log('✅ LOADED SECTIONS FROM FIREBASE:', action.payload.length);
            return { ...state, sections: action.payload };
        }
        case 'LOAD_WAREHOUSES': {
            console.log('✅ LOADED WAREHOUSES FROM FIREBASE:', action.payload.length);
            return { ...state, warehouses: action.payload };
        }
        case 'LOAD_DIVISIONS': {
            console.log('✅ LOADED DIVISIONS FROM FIREBASE:', action.payload.length);
            return { ...state, divisions: action.payload };
        }
        case 'LOAD_SUBDIVISIONS': {
            console.log('✅ LOADED SUBDIVISIONS FROM FIREBASE:', action.payload.length);
            return { ...state, subDivisions: action.payload };
        }
        case 'LOAD_LOGOS': {
            console.log('✅ LOADED LOGOS FROM FIREBASE:', action.payload.length);
            return { ...state, logos: action.payload };
        }
        case 'LOAD_ORIGINAL_TYPES': {
            console.log('✅ LOADED ORIGINAL_TYPES FROM FIREBASE:', action.payload.length);
            return { ...state, originalTypes: action.payload };
        }
        case 'LOAD_ORIGINAL_PRODUCTS': {
            console.log('✅ LOADED ORIGINAL_PRODUCTS FROM FIREBASE:', action.payload.length);
            return { ...state, originalProducts: action.payload };
        }
        case 'LOAD_EMPLOYEES': {
            console.log('✅ LOADED EMPLOYEES FROM FIREBASE:', action.payload.length);
            return { ...state, employees: action.payload };
        }
        case 'LOAD_CURRENCIES': {
            console.log('✅ LOADED CURRENCIES FROM FIREBASE:', action.payload.length);
            return { ...state, currencies: action.payload };
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
        case 'ADD_CURRENCY': return { ...state, currencies: [...state.currencies, action.payload] };
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
    addAccount: (account: Account) => Promise<void>;
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
    addCurrency: (currency: CurrencyRate) => void;
    updateCurrency: (currencyId: string, updates: Partial<CurrencyRate>) => Promise<void>;
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
    const { currentFactory } = useAuth(); // Access current factory for filtering
    
    // 🛡️ CRITICAL SAFEGUARD: Firebase Connection State
    const [isFirestoreLoaded, setIsFirestoreLoaded] = useState(false);
    const [firestoreStatus, setFirestoreStatus] = useState<'disconnected' | 'loading' | 'loaded' | 'error'>('disconnected');
    const [firestoreError, setFirestoreError] = useState<string | null>(null);
    const isUpdatingFromFirestore = useRef(false);

    // 🔥 FIREBASE SYNC: Load partners and accounts from Firestore in real-time
    useEffect(() => {
        if (!currentFactory) {
            console.log('⏳ Waiting for factory selection...');
            return;
        }

        console.log(`🔥 Connecting to Firebase Collections for factory: ${currentFactory.name}...`);
        setFirestoreStatus('loading');

        // Listen to Partners collection - FILTERED by factoryId
        const partnersQuery = query(
            collection(db, 'partners'),
            where('factoryId', '==', currentFactory.id)
        );
        const unsubscribePartners = onSnapshot(
            partnersQuery,
            (snapshot) => {
                const partners: Partner[] = [];
                snapshot.forEach((doc) => {
                    const partnerData = doc.data();
                    const { id: _, ...dataWithoutId } = partnerData; // Remove old client-generated id from data
                    console.log(`👥 Loading partner from Firebase:`, {
                        firestoreId: doc.id,
                        oldDataId: partnerData.id,
                        name: partnerData.name
                    });
                    partners.push({
                        ...dataWithoutId,
                        id: doc.id // Use Firebase document ID
                    } as Partner);
                });
                console.log(`✅ LOADED ${partners.length} PARTNERS FROM FIREBASE`);
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_PARTNERS', payload: partners });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => {
                console.error('❌ Error loading partners:', error);
                setFirestoreError(error.message);
            }
        );

        // Listen to Accounts collection - FILTERED by factoryId
        const accountsQuery = query(
            collection(db, 'accounts'),
            where('factoryId', '==', currentFactory.id)
        );
        const unsubscribeAccounts = onSnapshot(
            accountsQuery,
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

        // Listen to Items collection - FILTERED by factoryId
        const itemsQuery = query(collection(db, 'items'), where('factoryId', '==', currentFactory.id));
        const unsubscribeItems = onSnapshot(
            itemsQuery,
            (snapshot) => {
                const items: Item[] = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() } as Item);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_ITEMS', payload: items });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading items:', error)
        );

        // Listen to Categories collection - FILTERED by factoryId
        const categoriesQuery = query(collection(db, 'categories'), where('factoryId', '==', currentFactory.id));
        const unsubscribeCategories = onSnapshot(
            categoriesQuery,
            (snapshot) => {
                const categories: Category[] = [];
                snapshot.forEach((doc) => {
                    categories.push({ id: doc.id, ...doc.data() } as Category);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_CATEGORIES', payload: categories });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading categories:', error)
        );

        // Listen to Sections collection - FILTERED by factoryId
        const sectionsQuery = query(collection(db, 'sections'), where('factoryId', '==', currentFactory.id));
        const unsubscribeSections = onSnapshot(
            sectionsQuery,
            (snapshot) => {
                const sections: Section[] = [];
                snapshot.forEach((doc) => {
                    sections.push({ id: doc.id, ...doc.data() } as Section);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_SECTIONS', payload: sections });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading sections:', error)
        );

        // Listen to Warehouses collection - FILTERED by factoryId
        const warehousesQuery = query(collection(db, 'warehouses'), where('factoryId', '==', currentFactory.id));
        const unsubscribeWarehouses = onSnapshot(
            warehousesQuery,
            (snapshot) => {
                const warehouses: Warehouse[] = [];
                snapshot.forEach((doc) => {
                    warehouses.push({ id: doc.id, ...doc.data() } as Warehouse);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_WAREHOUSES', payload: warehouses });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading warehouses:', error)
        );

        // Listen to Divisions collection - FILTERED by factoryId
        const divisionsQuery = query(collection(db, 'divisions'), where('factoryId', '==', currentFactory.id));
        const unsubscribeDivisions = onSnapshot(
            divisionsQuery,
            (snapshot) => {
                const divisions: Division[] = [];
                snapshot.forEach((doc) => {
                    divisions.push({ id: doc.id, ...doc.data() } as Division);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_DIVISIONS', payload: divisions });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading divisions:', error)
        );

        // Listen to SubDivisions collection - FILTERED by factoryId
        const subDivisionsQuery = query(collection(db, 'subDivisions'), where('factoryId', '==', currentFactory.id));
        const unsubscribeSubDivisions = onSnapshot(
            subDivisionsQuery,
            (snapshot) => {
                const subDivisions: SubDivision[] = [];
                snapshot.forEach((doc) => {
                    subDivisions.push({ id: doc.id, ...doc.data() } as SubDivision);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_SUBDIVISIONS', payload: subDivisions });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading subDivisions:', error)
        );

        // Listen to Logos collection - FILTERED by factoryId
        const logosQuery = query(collection(db, 'logos'), where('factoryId', '==', currentFactory.id));
        const unsubscribeLogos = onSnapshot(
            logosQuery,
            (snapshot) => {
                const logos: Logo[] = [];
                snapshot.forEach((doc) => {
                    logos.push({ id: doc.id, ...doc.data() } as Logo);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_LOGOS', payload: logos });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading logos:', error)
        );

        // Listen to OriginalTypes collection - FILTERED by factoryId
        const originalTypesQuery = query(collection(db, 'originalTypes'), where('factoryId', '==', currentFactory.id));
        const unsubscribeOriginalTypes = onSnapshot(
            originalTypesQuery,
            (snapshot) => {
                const originalTypes: OriginalType[] = [];
                snapshot.forEach((doc) => {
                    originalTypes.push({ id: doc.id, ...doc.data() } as OriginalType);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_ORIGINAL_TYPES', payload: originalTypes });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading originalTypes:', error)
        );

        // Listen to OriginalProducts collection - FILTERED by factoryId
        const originalProductsQuery = query(collection(db, 'originalProducts'), where('factoryId', '==', currentFactory.id));
        const unsubscribeOriginalProducts = onSnapshot(
            originalProductsQuery,
            (snapshot) => {
                const originalProducts: OriginalProduct[] = [];
                snapshot.forEach((doc) => {
                    originalProducts.push({ id: doc.id, ...doc.data() } as OriginalProduct);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_ORIGINAL_PRODUCTS', payload: originalProducts });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading originalProducts:', error)
        );

        // Listen to Employees collection - FILTERED by factoryId
        const employeesQuery = query(collection(db, 'employees'), where('factoryId', '==', currentFactory.id));
        const unsubscribeEmployees = onSnapshot(
            employeesQuery,
            (snapshot) => {
                const employees: Employee[] = [];
                snapshot.forEach((doc) => {
                    employees.push({ id: doc.id, ...doc.data() } as Employee);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_EMPLOYEES', payload: employees });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading employees:', error)
        );

        const currenciesQuery = query(collection(db, 'currencies'), where('factoryId', '==', currentFactory.id));
        const unsubscribeCurrencies = onSnapshot(
            currenciesQuery,
            (snapshot) => {
                const currencies: CurrencyRate[] = [];
                snapshot.forEach((doc) => {
                    currencies.push({ id: doc.id, ...doc.data() } as CurrencyRate);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_CURRENCIES', payload: currencies });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading currencies:', error)
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
            unsubscribeItems();
            unsubscribeCategories();
            unsubscribeSections();
            unsubscribeWarehouses();
            unsubscribeDivisions();
            unsubscribeSubDivisions();
            unsubscribeLogos();
            unsubscribeOriginalTypes();
            unsubscribeOriginalProducts();
            unsubscribeEmployees();
            unsubscribeCurrencies();
        };
    }, [currentFactory]); // Re-run when factory changes

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


    const postTransaction = (entries: Omit<LedgerEntry, 'id'>[]) => {
        const entriesWithFactory = entries.map(entry => ({
            ...entry,
            factoryId: currentFactory?.id || ''
        }));
        dispatch({ type: 'POST_TRANSACTION', payload: { entries: entriesWithFactory } });
    };
    const deleteTransaction = (transactionId: string, reason?: string, user?: string) => dispatch({ type: 'DELETE_LEDGER_ENTRIES', payload: { transactionId, reason, user } });
    const addPurchase = (purchase: Purchase) => {
        const purchaseWithFactory = {
            ...purchase,
            factoryId: currentFactory?.id || ''
        };
        const typeDef = state.originalTypes.find(t => t.id === purchaseWithFactory.originalTypeId);
        const packingSize = typeDef ? typeDef.packingSize : 1; 
        const calculatedQty = purchaseWithFactory.weightPurchased / packingSize;
        const purchaseWithQty = { ...purchaseWithFactory, qtyPurchased: calculatedQty };
        dispatch({ type: 'ADD_PURCHASE', payload: purchaseWithQty });
        const inventoryId = '104'; 
        const apId = '201'; 
        const transactionId = `PI-${purchaseWithFactory.batchNumber || purchaseWithFactory.id.toUpperCase()}`;
        const entries: Omit<LedgerEntry, 'id'>[] = [
            { date: purchaseWithFactory.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: inventoryId, accountName: 'Inventory - Raw Material', currency: 'USD', exchangeRate: 1, fcyAmount: purchaseWithFactory.totalLandedCost, debit: purchaseWithFactory.totalLandedCost, credit: 0, narration: `Purchase: ${purchaseWithFactory.originalType} (Batch: ${purchaseWithFactory.batchNumber})` }
        ];
        const materialCostUSD = purchaseWithFactory.totalCostFCY / purchaseWithFactory.exchangeRate;
        entries.push({ date: purchaseWithFactory.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: apId, accountName: 'Accounts Payable', currency: purchaseWithFactory.currency, exchangeRate: purchaseWithFactory.exchangeRate, fcyAmount: purchaseWithFactory.totalCostFCY, debit: 0, credit: materialCostUSD, narration: `Material Cost: ${state.partners.find(p=>p.id===purchaseWithFactory.supplierId)?.name}` });
        purchaseWithFactory.additionalCosts.forEach(cost => {
            const providerName = state.partners.find(p => p.id === cost.providerId)?.name || 'Unknown Provider';
            entries.push({ date: purchase.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: apId, accountName: 'Accounts Payable', currency: cost.currency, exchangeRate: cost.exchangeRate, fcyAmount: cost.amountFCY, debit: 0, credit: cost.amountUSD, narration: `${cost.costType}: ${providerName}` });
        });
        postTransaction(entries);
    };
    const addBundlePurchase = (bundle: BundlePurchase) => {
        const bundleWithFactory = {
            ...bundle,
            factoryId: currentFactory?.id || ''
        };
        dispatch({ type: 'ADD_BUNDLE_PURCHASE', payload: bundleWithFactory });
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

        // Auto-add factoryId from current factory
        const partnerWithFactory = {
            ...partner,
            factoryId: currentFactory?.id || ''
        };

        // Remove id and prepare data for Firebase
        const { id, ...partnerDataToSave } = partnerWithFactory;
        const partnerData = {
            ...partnerDataToSave,
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
                // Firebase listener will handle adding to local state
            })
            .catch((error) => {
                console.error('❌ Error saving partner to Firebase:', error);
                alert('Failed to save partner: ' + error.message);
            });

        // Handle opening balance if needed
        if (partner.balance !== 0) {
            const prevYear = new Date().getFullYear() - 1; const date = `${prevYear}-12-31`; const openingEquityId = state.accounts.find(a => a.name.includes('Capital'))?.id || '301'; const arId = state.accounts.find(a => a.name.includes('Receivable'))?.id || '103'; const apId = state.accounts.find(a => a.name.includes('Payable'))?.id || '201';
            let entries: Omit<LedgerEntry, 'id'>[] = []; 
            const currency = partner.defaultCurrency || 'USD'; 
            const exchangeRates = getExchangeRates(state.currencies);
            const rate = exchangeRates[currency] || 1; 
            const fcyAmt = partner.balance * rate; 
            const commonProps = { currency, exchangeRate: rate, fcyAmount: Math.abs(fcyAmt) };
            if (partner.balance > 0) { entries = [ { ...commonProps, date, transactionId: `OB-${partner.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: arId, accountName: 'Accounts Receivable', debit: partner.balance, credit: 0, narration: `Opening Balance - ${partner.name}` }, { ...commonProps, date, transactionId: `OB-${partner.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: openingEquityId, accountName: 'Opening Equity', debit: 0, credit: partner.balance, narration: `Opening Balance - ${partner.name}` } ]; } 
            else { const absBalance = Math.abs(partner.balance); entries = [ { ...commonProps, date, transactionId: `OB-${partner.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: openingEquityId, accountName: 'Opening Equity', debit: absBalance, credit: 0, narration: `Opening Balance - ${partner.name}` }, { ...commonProps, date, transactionId: `OB-${partner.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: apId, accountName: 'Accounts Payable', debit: 0, credit: absBalance, narration: `Opening Balance - ${partner.name}` } ]; }
            postTransaction(entries);
        }
    };
    const addItem = (item: Item, openingStock: number = 0) => {
        const itemWithFactory = {
            ...item,
            factoryId: currentFactory?.id || ''
        };
        const nextSerial = openingStock + 1; const itemWithStock = { ...itemWithFactory, stockQty: openingStock, nextSerial: nextSerial }; 
        
        dispatch({ type: 'ADD_ITEM', payload: itemWithStock });
        
        // Save to Firebase (remove id field)
        const { id: _, ...itemData } = itemWithStock;
        addDoc(collection(db, 'items'), { ...itemData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Item saved to Firebase'))
            .catch((error) => console.error('❌ Error saving item:', error));
        if (openingStock > 0 && item.avgCost > 0) {
             const prevYear = new Date().getFullYear() - 1; const date = `${prevYear}-12-31`; const stockValue = openingStock * item.avgCost; const inventoryId = item.category === 'Raw Material' ? '104' : '105'; const capitalId = '301';
             const entries: Omit<LedgerEntry, 'id'>[] = [ { date, transactionId: `OB-STK-${item.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: inventoryId, accountName: 'Inventory Asset', currency: 'USD', exchangeRate: 1, fcyAmount: stockValue, debit: stockValue, credit: 0, narration: `Opening Stock - ${item.name}` }, { date, transactionId: `OB-STK-${item.id}`, transactionType: TransactionType.OPENING_BALANCE, accountId: capitalId, accountName: 'Capital', currency: 'USD', exchangeRate: 1, fcyAmount: stockValue, debit: 0, credit: stockValue, narration: `Opening Stock - ${item.name}` } ]; postTransaction(entries);
        }
    };
    const addOriginalOpening = (opening: OriginalOpening) => {
        const openingWithFactory = {
            ...opening,
            factoryId: currentFactory?.id || ''
        };
        dispatch({ type: 'ADD_ORIGINAL_OPENING', payload: openingWithFactory });
        const fgInvId = state.accounts.find(a => a.name.includes('Finished Goods'))?.id || '105'; const expenseId = state.accounts.find(a => a.name.includes('Cost of Goods'))?.id || '501'; const transactionId = `OO-${openingWithFactory.id}`;
        const entries: Omit<LedgerEntry, 'id'>[] = [ { date: openingWithFactory.date, transactionId, transactionType: TransactionType.ORIGINAL_OPENING, accountId: fgInvId, accountName: 'Inventory - Finished Goods (WIP)', currency: 'USD', exchangeRate: 1, fcyAmount: openingWithFactory.totalValue, debit: openingWithFactory.totalValue, credit: 0, narration: `Consumption: ${openingWithFactory.originalType} (${openingWithFactory.weightOpened}kg)` }, { date: openingWithFactory.date, transactionId, transactionType: TransactionType.ORIGINAL_OPENING, accountId: expenseId, accountName: 'Raw Material Consumption Expense', currency: 'USD', exchangeRate: 1, fcyAmount: openingWithFactory.totalValue, debit: 0, credit: openingWithFactory.totalValue, narration: `Consumption: ${openingWithFactory.originalType} (${openingWithFactory.weightOpened}kg)` } ]; postTransaction(entries);
    };
    const deleteOriginalOpening = (id: string) => { dispatch({ type: 'DELETE_ENTITY', payload: { type: 'originalOpenings', id } }); const transactionId = `OO-${id}`; dispatch({ type: 'DELETE_LEDGER_ENTRIES', payload: { transactionId, reason: 'Delete Original Opening', user: 'Admin' } }); };
    const addProduction = (productions: ProductionEntry[]) => {
        const productionsWithFactory = productions.map(prod => ({
            ...prod,
            factoryId: currentFactory?.id || ''
        }));
        dispatch({ type: 'ADD_PRODUCTION', payload: productionsWithFactory });
    };
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
    const saveLogisticsEntry = (entry: LogisticsEntry) => {
        const entryWithFactory = {
            ...entry,
            factoryId: currentFactory?.id || ''
        };
        dispatch({ type: 'SAVE_LOGISTICS_ENTRY', payload: entryWithFactory });
    };
    const addSalesInvoice = (invoice: SalesInvoice) => {
        const invoiceWithFactory = {
            ...invoice,
            factoryId: currentFactory?.id || ''
        };
        dispatch({ type: 'ADD_SALES_INVOICE', payload: invoiceWithFactory });
    };
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
    const addOngoingOrder = (order: OngoingOrder) => {
        const orderWithFactory = {
            ...order,
            factoryId: currentFactory?.id || ''
        };
        dispatch({ type: 'ADD_ONGOING_ORDER', payload: orderWithFactory });
    };
    const processOrderShipment = (orderId: string, shipmentItems: { itemId: string, shipQty: number }[]) => {
        const order = state.ongoingOrders.find(o => o.id === orderId); if (!order) return;
        const updatedItems = order.items.map(item => { const ship = shipmentItems.find(s => s.itemId === item.itemId); if (ship) return { ...item, shippedQuantity: item.shippedQuantity + ship.shipQty }; return item; });
        const isFullyShipped = updatedItems.every(i => i.shippedQuantity >= i.quantity); const hasSomeShipped = updatedItems.some(i => i.shippedQuantity > 0); const newStatus = isFullyShipped ? 'Completed' : hasSomeShipped ? 'PartiallyShipped' : 'Active';
        const updatedOrder: OngoingOrder = { ...order, items: updatedItems, status: newStatus }; dispatch({ type: 'UPDATE_ONGOING_ORDER', payload: updatedOrder });
        const customer = state.partners.find(p => p.id === order.customerId); 
        const currency = customer?.defaultCurrency || 'USD'; 
        const exchangeRates = getExchangeRates(state.currencies);
        const rate = exchangeRates[currency] || 1; 
        const invoiceItems: SalesInvoiceItem[] = [];
        shipmentItems.forEach(ship => { if (ship.shipQty <= 0) return; const itemDef = state.items.find(i => i.id === ship.itemId); if (!itemDef) return; const unitRate = itemDef.salePrice || 0; invoiceItems.push({ id: generateId(), itemId: ship.itemId, itemName: itemDef.name, qty: ship.shipQty, rate: unitRate, total: ship.shipQty * unitRate, totalKg: ship.shipQty * itemDef.weightPerUnit, currency: currency, exchangeRate: rate, sourceOrderId: order.id }); });
        if (invoiceItems.length === 0) return;
        const maxInv = state.salesInvoices.map(i => parseInt(i.invoiceNo.replace('SINV-', ''))).filter(n => !isNaN(n)).reduce((max, curr) => curr > max ? curr : max, 1000); const nextInvNo = `SINV-${maxInv + 1}`; const grossTotal = invoiceItems.reduce((sum, i) => sum + i.total, 0);
        const newInvoice: SalesInvoice = { id: generateId(), invoiceNo: nextInvNo, date: new Date().toISOString().split('T')[0], status: 'Unposted', customerId: order.customerId, logoId: state.logos[0]?.id || '', currency: currency, exchangeRate: rate, divisionId: customer?.divisionId, subDivisionId: customer?.subDivisionId, discount: 0, surcharge: 0, items: invoiceItems, additionalCosts: [], grossTotal: grossTotal, netTotal: grossTotal };
        dispatch({ type: 'ADD_SALES_INVOICE', payload: newInvoice });
    };
    const addEmployee = (employee: Employee) => {
        const employeeWithFactory = {
            ...employee,
            factoryId: currentFactory?.id || ''
        };
        dispatch({ type: 'ADD_EMPLOYEE', payload: employeeWithFactory });
        const { id: _, ...employeeData } = employeeWithFactory;
        addDoc(collection(db, 'employees'), { ...employeeData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Employee saved to Firebase'))
            .catch((error) => console.error('❌ Error saving employee:', error));
    };
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
    const addOriginalType = (type: OriginalType) => {
        const typeWithFactory = { ...type, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_ORIGINAL_TYPE', payload: typeWithFactory });
        const { id: _, ...typeData } = typeWithFactory;
        addDoc(collection(db, 'originalTypes'), { ...typeData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ OriginalType saved'))
            .catch((error) => console.error('❌ Error saving originalType:', error));
    };
    const addOriginalProduct = (prod: OriginalProduct) => {
        const prodWithFactory = { ...prod, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_ORIGINAL_PRODUCT', payload: prodWithFactory });
        const { id: _, ...prodData } = prodWithFactory;
        addDoc(collection(db, 'originalProducts'), { ...prodData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ OriginalProduct saved'))
            .catch((error) => console.error('❌ Error saving originalProduct:', error));
    };
    const addCategory = (cat: Category) => {
        const categoryWithFactory = { ...cat, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_CATEGORY', payload: categoryWithFactory });
        const { id: _, ...categoryData } = categoryWithFactory;
        addDoc(collection(db, 'categories'), { ...categoryData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Category saved'))
            .catch((error) => console.error('❌ Error saving category:', error));
    };
    const addSection = (sec: Section) => {
        const sectionWithFactory = { ...sec, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_SECTION', payload: sectionWithFactory });
        const { id: _, ...sectionData } = sectionWithFactory;
        addDoc(collection(db, 'sections'), { ...sectionData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Section saved'))
            .catch((error) => console.error('❌ Error saving section:', error));
    };

    const addCurrency = (currency: CurrencyRate) => {
        const currencyWithFactory = { ...currency, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_CURRENCY', payload: currencyWithFactory });
        const { id: _, ...currencyData } = currencyWithFactory;
        addDoc(collection(db, 'currencies'), { ...currencyData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Currency saved'))
            .catch((error) => console.error('❌ Error saving currency:', error));
    };

    const updateCurrency = async (currencyId: string, updates: Partial<CurrencyRate>) => {
        try {
            await updateDoc(doc(db, 'currencies', currencyId), updates);
            console.log('✅ Currency updated');
        } catch (error) {
            console.error('❌ Error updating currency:', error);
        }
    };

    const addAccount = async (account: Account): Promise<void> => {
        const accountWithFactory = {
            ...account,
            factoryId: currentFactory?.id || ''
        };
        
        // Remove id field - Firebase generates it
        const { id, ...accountData } = accountWithFactory;
        
        // Save to Firebase (listener will add to local state)
        try {
            const docRef = await addDoc(collection(db, 'accounts'), { ...accountData, createdAt: serverTimestamp() });
            // Firebase listener will handle adding to local state with real ID
        } catch (error) {
            console.error('❌ Error saving account:', error);
            throw error;
        }
    };
    const addDivision = (division: Division) => {
        const divisionWithFactory = { ...division, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_DIVISION', payload: divisionWithFactory });
        const { id: _, ...divisionData } = divisionWithFactory;
        addDoc(collection(db, 'divisions'), { ...divisionData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Division saved'))
            .catch((error) => console.error('❌ Error saving division:', error));
    };
    const addSubDivision = (subDivision: SubDivision) => {
        const subDivisionWithFactory = { ...subDivision, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_SUB_DIVISION', payload: subDivisionWithFactory });
        const { id: _, ...subDivisionData } = subDivisionWithFactory;
        addDoc(collection(db, 'subDivisions'), { ...subDivisionData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ SubDivision saved'))
            .catch((error) => console.error('❌ Error saving subDivision:', error));
    };
    const addLogo = (logo: Logo) => {
        const logoWithFactory = { ...logo, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_LOGO', payload: logoWithFactory });
        const { id: _, ...logoData } = logoWithFactory;
        addDoc(collection(db, 'logos'), { ...logoData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Logo saved'))
            .catch((error) => console.error('❌ Error saving logo:', error));
    };
    const addWarehouse = (warehouse: Warehouse) => {
        const warehouseWithFactory = { ...warehouse, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_WAREHOUSE', payload: warehouseWithFactory });
        const { id: _, ...warehouseData } = warehouseWithFactory;
        addDoc(collection(db, 'warehouses'), { ...warehouseData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Warehouse saved'))
            .catch((error) => console.error('❌ Error saving warehouse:', error));
    };
    const deleteEntity = (type: any, id: string) => {
        console.log(`🗑️ Attempting to delete ${type}/${id}`);
        dispatch({ type: 'DELETE_ENTITY', payload: { type, id } });
        // Delete from Firebase
        deleteDoc(doc(db, type, id))
            .then(() => console.log(`✅ Deleted ${type}/${id} from Firebase`))
            .catch((error) => {
                console.error(`❌ Error deleting ${type}/${id}:`, error);
                console.error('Full error:', error);
            });
    };
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
            addCurrency,
            updateCurrency,
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

// Helper function to get exchange rates from currencies
export const getExchangeRates = (currencies: CurrencyRate[]): Record<string, number> => {
    const rates: Record<string, number> = { USD: 1 }; // Always include USD as base
    currencies.forEach(currency => {
        rates[currency.code] = currency.exchangeRate;
    });
    return rates;
};
