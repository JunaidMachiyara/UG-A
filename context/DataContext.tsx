
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState, useRef } from 'react';
import { AppState, LedgerEntry, Partner, Account, Item, TransactionType, AccountType, PartnerType, Division, SubDivision, Logo, Warehouse, Employee, AttendanceRecord, Purchase, OriginalOpening, ProductionEntry, OriginalType, OriginalProduct, Category, Section, BundlePurchase, PackingType, LogisticsEntry, SalesInvoice, OngoingOrder, SalesInvoiceItem, ArchivedTransaction, Task, Enquiry, Vehicle, VehicleCharge, SalaryPayment, ChatMessage, PlannerEntry, PlannerEntityType, PlannerPeriodType, GuaranteeCheque, CustomsDocument, CurrencyRate, Currency } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_ITEMS, INITIAL_LEDGER, INITIAL_PARTNERS, EXCHANGE_RATES, INITIAL_ORIGINAL_TYPES, INITIAL_ORIGINAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_SECTIONS, INITIAL_DIVISIONS, INITIAL_SUB_DIVISIONS, INITIAL_LOGOS, INITIAL_PURCHASES, INITIAL_LOGISTICS_ENTRIES, INITIAL_SALES_INVOICES, INITIAL_WAREHOUSES, INITIAL_ONGOING_ORDERS, INITIAL_EMPLOYEES, INITIAL_TASKS, INITIAL_VEHICLES, INITIAL_CHAT_MESSAGES, CURRENT_USER, INITIAL_ORIGINAL_OPENINGS, INITIAL_PRODUCTIONS, INITIAL_PLANNERS, INITIAL_GUARANTEE_CHEQUES, INITIAL_CUSTOMS_DOCUMENTS, INITIAL_CURRENCIES } from '../constants';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { getAccountId } from '../services/accountMap';

// Helper for simple ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

// Firestore cannot store `undefined`. Even with `ignoreUndefinedProperties`, it's safer to
// proactively remove undefined values, especially for nested objects/arrays.
function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

// NOTE: In `.tsx`, generic arrow functions like `const fn = <T,>(...) => ...`
// can be parsed as JSX by Babel. Use a function declaration to keep Vite dev happy.
function stripUndefinedDeep<T>(value: T): T {
    if (value === undefined) return value;
    if (Array.isArray(value)) {
        return value
            .map(v => stripUndefinedDeep(v))
            .filter(v => v !== undefined) as any;
    }
    if (isPlainObject(value)) {
        const out: Record<string, unknown> = {};
        Object.entries(value).forEach(([k, v]) => {
            const cleaned = stripUndefinedDeep(v);
            if (cleaned !== undefined) out[k] = cleaned;
        });
        return out as any;
    }
    return value;
}

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
    | { type: 'LOAD_PURCHASES'; payload: Purchase[] }
    | { type: 'LOAD_BUNDLE_PURCHASES'; payload: BundlePurchase[] }
    | { type: 'LOAD_LEDGER'; payload: LedgerEntry[] }
    | { type: 'LOAD_PRODUCTIONS'; payload: ProductionEntry[] }
    | { type: 'LOAD_ORIGINAL_OPENINGS'; payload: OriginalOpening[] }
    | { type: 'LOAD_LOGISTICS_ENTRIES'; payload: LogisticsEntry[] }
    | { type: 'LOAD_SALES_INVOICES'; payload: SalesInvoice[] }
    | { type: 'LOAD_ONGOING_ORDERS'; payload: OngoingOrder[] }
    | { type: 'LOAD_ATTENDANCE'; payload: AttendanceRecord[] }
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
    | { type: 'UPDATE_PURCHASE'; payload: Purchase }
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
            console.log('📊 Current ledger entries in state:', state.ledger.length);
            
            // IMPORTANT: If ledger entries exist, recalculate balances from ledger instead of using stored balances
            // This ensures balances are always accurate based on ledger entries
            if (state.ledger.length > 0) {
                console.log('📊 Recalculating account balances from ledger entries (ignoring stored balances)');
                const updatedAccounts = action.payload.map(acc => {
                    const accountEntries = state.ledger.filter(e => e.accountId === acc.id);
                    const debitSum = accountEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
                    const creditSum = accountEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
                    let newBalance = 0;
                    if ([AccountType.ASSET, AccountType.EXPENSE].includes(acc.type)) {
                        newBalance = debitSum - creditSum;
                    } else {
                        // For LIABILITY, EQUITY, REVENUE: Credit increases, Debit decreases
                        newBalance = creditSum - debitSum;
                    }
                    
                    // Debug logging for Capital account
                    if (acc.name.includes('Capital') && accountEntries.length > 0) {
                        console.log(`📊 LOAD_ACCOUNTS: Capital balance recalculated:`, {
                            storedBalance: acc.balance,
                            calculatedBalance: newBalance,
                            debitSum,
                            creditSum,
                            formula: `creditSum - debitSum = ${creditSum} - ${debitSum} = ${newBalance}`
                        });
                    }
                    
                    return { ...acc, balance: newBalance };
                });
                return { ...state, accounts: updatedAccounts };
            } else {
                console.log('⚠️ No ledger entries in state yet - using stored balances from Firebase');
                // Check if Capital account has a stored balance that might be wrong
                const capitalAccount = action.payload.find(a => a.name.includes('Capital'));
                if (capitalAccount) {
                    console.log(`📊 Capital account stored balance in Firebase: ${capitalAccount.balance}`);
                }
            }
            return { ...state, accounts: action.payload };
        }
        case 'LOAD_ITEMS': {
            console.log('✅ LOADED ITEMS FROM FIREBASE:', action.payload.length);
            // Calculate total finished goods value
            const finishedGoodsValue = action.payload
                .filter(item => item.factoryId === state.currentFactory?.id)
                .reduce((sum, item) => sum + ((item.stockQty || 0) * (item.avgCost || 0)), 0);

            // Update Inventory - Finished Goods account (id: '1202')
            const updatedAccounts = state.accounts.map(acc =>
                acc.id === '1202'
                    ? { ...acc, balance: finishedGoodsValue }
                    : acc
            );

            return { ...state, items: action.payload, accounts: updatedAccounts };
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
        case 'LOAD_PURCHASES': {
            console.log('✅ LOADED PURCHASES FROM FIREBASE:', action.payload.length);
            return { ...state, purchases: action.payload };
        }
        case 'LOAD_BUNDLE_PURCHASES': {
            console.log('✅ LOADED BUNDLE PURCHASES FROM FIREBASE:', action.payload.length);
            return { ...state, bundlePurchases: action.payload };
        }
        case 'LOAD_LEDGER': {
            console.log('✅ LOADED LEDGER ENTRIES FROM FIREBASE:', action.payload.length);
            
            // Recalculate account balances from all ledger entries
            const updatedAccounts = state.accounts.map(acc => {
                const accountEntries = action.payload.filter(e => e.accountId === acc.id);
                const debitSum = accountEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
                const creditSum = accountEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
                let newBalance = 0;
                if ([AccountType.ASSET, AccountType.EXPENSE].includes(acc.type)) {
                    newBalance = debitSum - creditSum;
                } else {
                    // For LIABILITY, EQUITY, REVENUE: Credit increases, Debit decreases
                    // Balance = Credits - Debits
                    newBalance = creditSum - debitSum;
                }
                
                // Debug logging for Capital account
                if (acc.name.includes('Capital') && accountEntries.length > 0) {
                    console.log(`📊 Capital Account Balance Calculation:`, {
                        accountName: acc.name,
                        accountId: acc.id,
                        accountType: acc.type,
                        debitSum,
                        creditSum,
                        formula: acc.type === AccountType.EQUITY ? `creditSum - debitSum = ${creditSum} - ${debitSum}` : `debitSum - creditSum = ${debitSum} - ${creditSum}`,
                        calculatedBalance: newBalance,
                        oldBalance: acc.balance,
                        entryCount: accountEntries.length,
                        entries: accountEntries.map(e => ({
                            transactionId: e.transactionId,
                            debit: e.debit,
                            credit: e.credit,
                            narration: e.narration,
                            stockValue: e.narration?.includes('Opening Stock') ? (e.debit > 0 ? -e.debit : e.credit) : null
                        }))
                    });
                }
                
                return { ...acc, balance: newBalance };
            });
            
            // Recalculate partner balances from ledger entries
            // IMPORTANT: Ledger entries use partner.id directly as accountId (not mapped account ID)
            const updatedPartners = state.partners.map(partner => {
                // Check both partner.id and mapped account ID for backward compatibility
                const mappedAccountId = getAccountId(partner.id);
                const partnerDebitSum = action.payload.filter(e => 
                    e.accountId === partner.id || e.accountId === mappedAccountId
                ).reduce((sum, e) => sum + (e.debit || 0), 0);
                const partnerCreditSum = action.payload.filter(e => 
                    e.accountId === partner.id || e.accountId === mappedAccountId
                ).reduce((sum, e) => sum + (e.credit || 0), 0);
                let newPartnerBalance = 0;
                if (partner.type === PartnerType.CUSTOMER) {
                    // Customers: debit increases balance (they owe us) - positive
                    newPartnerBalance = partnerDebitSum - partnerCreditSum;
                } else if ([PartnerType.SUPPLIER, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(partner.type)) {
                    // Suppliers/agents: 
                    // Debit increases positive balance (advance to supplier - asset)
                    // Credit increases negative balance (accounts payable - liability)
                    // Formula: debit - credit (same as customers, but negative = AP, positive = advance)
                    newPartnerBalance = partnerDebitSum - partnerCreditSum;
                } else {
                    // Other partners: default logic
                    newPartnerBalance = partnerDebitSum - partnerCreditSum;
                }
                return { ...partner, balance: newPartnerBalance };
            });
            
            return { ...state, ledger: action.payload, accounts: updatedAccounts, partners: updatedPartners };
        }
        case 'LOAD_PRODUCTIONS': {
            console.log('✅ LOADED PRODUCTIONS FROM FIREBASE:', action.payload.length);
            return { ...state, productions: action.payload };
        }
        case 'LOAD_ORIGINAL_OPENINGS': {
            console.log('✅ LOADED ORIGINAL OPENINGS FROM FIREBASE:', action.payload.length);
            return { ...state, originalOpenings: action.payload };
        }
        case 'LOAD_LOGISTICS_ENTRIES': {
            console.log('✅ LOADED LOGISTICS ENTRIES FROM FIREBASE:', action.payload.length);
            return { ...state, logisticsEntries: action.payload };
        }
        case 'LOAD_SALES_INVOICES': {
            console.log('✅ LOADED SALES INVOICES FROM FIREBASE:', action.payload.length);
            return { ...state, salesInvoices: action.payload };
        }
        case 'LOAD_ONGOING_ORDERS': {
            console.log('✅ LOADED ONGOING ORDERS FROM FIREBASE:', action.payload.length);
            return { ...state, ongoingOrders: action.payload };
        }
        case 'LOAD_ATTENDANCE': {
            console.log('✅ LOADED ATTENDANCE FROM FIREBASE:', action.payload.length);
            return { ...state, attendance: action.payload };
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
                // For Customers (AR), a debit increases their balance (they owe us more) - positive
                // For Suppliers (AP), a credit increases our liability - stored as NEGATIVE
                if ([PartnerType.CUSTOMER].includes(partner.type)) { 
                    newPartnerBalance = partner.balance + partnerDebitSum - partnerCreditSum;
                } else { 
                    // Suppliers: 
                    // - Credit increases liability (we owe more) = balance becomes more negative
                    // - Debit decreases liability (we pay/advance) = balance becomes less negative (more positive)
                    // Formula: balance - credit + debit = balance + debit - credit (same as customers)
                    // This maintains: positive balance = advance to supplier (asset), negative balance = accounts payable (liability)
                    newPartnerBalance = partner.balance + partnerDebitSum - partnerCreditSum;
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
        case 'UPDATE_DIVISION': return { ...state, divisions: state.divisions.map(d => d.id === action.payload.id ? action.payload : d) };
        case 'ADD_SUB_DIVISION': return { ...state, subDivisions: [...state.subDivisions, action.payload] };
        case 'UPDATE_SUB_DIVISION': return { ...state, subDivisions: state.subDivisions.map(sd => sd.id === action.payload.id ? action.payload : sd) };
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
                // Aggregate all production entries for this item
                const itemProductions = action.payload.filter(p => p.itemId === item.id);
                if (itemProductions.length > 0) {
                    const totalQtyChange = itemProductions.reduce((sum, p) => sum + p.qtyProduced, 0);
                    const maxSerialEnd = Math.max(
                        ...itemProductions
                            .filter(p => p.serialEnd !== undefined)
                            .map(p => p.serialEnd || 0),
                        0
                    );
                    const isTracked = item.packingType !== PackingType.KG;
                    
                    return {
                        ...item,
                        stockQty: item.stockQty + totalQtyChange,
                        nextSerial: (maxSerialEnd > 0 && isTracked) 
                            ? maxSerialEnd + 1
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
        case 'UPDATE_PURCHASE': return { ...state, purchases: state.purchases.map(p => p.id === action.payload.id ? action.payload : p) };
        case 'POST_SALES_INVOICE': {
            const updatedInvoices = state.salesInvoices.map(inv => inv.id === action.payload.id ? { ...action.payload, status: 'Posted' } : inv);
            // Customer balance updated in USD (all sales are in USD now)
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
    postTransaction: (entries: Omit<LedgerEntry, 'id'>[]) => Promise<void>;
    deleteTransaction: (transactionId: string, reason?: string, user?: string) => void;
    addPartner: (partner: Partner) => Promise<void>;
    addItem: (item: Item, openingStock?: number, skipFirebase?: boolean) => Promise<void>;
    addAccount: (account: Account) => Promise<void>;
    updateAccount: (id: string, account: Account) => Promise<void>;
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
    processPayroll: (payment: SalaryPayment, sourceAccountId: string) => Promise<void>;
    addVehicleFine: (vehicleId: string, type: string, amount: number, employeeId: string) => Promise<void>;
    sendMessage: (msg: ChatMessage) => void;
    markChatRead: (chatId: string) => void;
    addOriginalType: (type: OriginalType) => Promise<void>;
    addOriginalProduct: (prod: OriginalProduct) => void;
    addCategory: (cat: Category) => void;
    addSection: (sec: Section) => void;
    addCurrency: (currency: CurrencyRate) => void;
    updateCurrency: (currencyId: string, updates: Partial<CurrencyRate>) => Promise<void>;
    addOriginalOpening: (opening: OriginalOpening) => Promise<void>;
    deleteOriginalOpening: (id: string) => void;
    addProduction: (productions: ProductionEntry[]) => Promise<void>;
    deleteProduction: (id: string) => Promise<void>;
    deleteProductionsForDate: (date: string) => Promise<number>;
    postBaleOpening: (stagedItems: { itemId: string, qty: number, date: string }[]) => Promise<void>;
    addPurchase: (purchase: Purchase) => Promise<void>;
    updatePurchase: (purchase: Purchase) => void;
    addBundlePurchase: (purchase: BundlePurchase) => Promise<void>;
    saveLogisticsEntry: (entry: LogisticsEntry) => Promise<void>;
    addSalesInvoice: (invoice: SalesInvoice) => void;
    updateSalesInvoice: (invoice: SalesInvoice) => void;
    postSalesInvoice: (invoice: SalesInvoice) => Promise<void>;
    addDirectSale: (invoice: SalesInvoice, batchLandedCostPerKg: number) => Promise<void>;
    addOngoingOrder: (order: OngoingOrder) => void;
    processOrderShipment: (orderId: string, shipmentItems: { itemId: string, shipQty: number }[]) => void;
    deleteEntity: (type: any, id: string) => Promise<void>;
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
                    const data = doc.data() as any;
                    // Preserve business ID/code stored in the document; fall back to Firestore ID only if missing
                    const businessId = data.id || doc.id;
                    categories.push({ ...data, id: businessId } as Category);
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
                    const data = doc.data() as any;
                    const businessId = data.id || doc.id;
                    sections.push({ ...data, id: businessId } as Section);
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

        // Listen to Purchases collection - FILTERED by factoryId
        const purchasesQuery = query(collection(db, 'purchases'), where('factoryId', '==', currentFactory.id));
        const unsubscribePurchases = onSnapshot(
            purchasesQuery,
            (snapshot) => {
                const purchases: Purchase[] = [];
                snapshot.forEach((doc) => {
                    purchases.push({ id: doc.id, ...doc.data() } as Purchase);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_PURCHASES', payload: purchases });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading purchases:', error)
        );

        // Listen to BundlePurchases collection - FILTERED by factoryId
        const bundlePurchasesQuery = query(collection(db, 'bundlePurchases'), where('factoryId', '==', currentFactory.id));
        const unsubscribeBundlePurchases = onSnapshot(
            bundlePurchasesQuery,
            (snapshot) => {
                const bundlePurchases: BundlePurchase[] = [];
                snapshot.forEach((doc) => {
                    bundlePurchases.push({ id: doc.id, ...doc.data() } as BundlePurchase);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_BUNDLE_PURCHASES', payload: bundlePurchases });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading bundle purchases:', error)
        );

        // Listen to Ledger collection - FILTERED by factoryId
        const ledgerQuery = query(collection(db, 'ledger'), where('factoryId', '==', currentFactory.id));
        const unsubscribeLedger = onSnapshot(
            ledgerQuery,
            (snapshot) => {
                const ledgerEntries: LedgerEntry[] = [];
                snapshot.forEach((doc) => {
                    ledgerEntries.push({ id: doc.id, ...doc.data() } as LedgerEntry);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_LEDGER', payload: ledgerEntries });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading ledger:', error)
        );

        // Listen to Productions collection - FILTERED by factoryId
        const productionsQuery = query(collection(db, 'productions'), where('factoryId', '==', currentFactory.id));
        const unsubscribeProductions = onSnapshot(
            productionsQuery,
            (snapshot) => {
                const productions: ProductionEntry[] = [];
                snapshot.forEach((doc) => {
                    productions.push({ id: doc.id, ...doc.data() } as ProductionEntry);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_PRODUCTIONS', payload: productions });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading productions:', error)
        );

        // Listen to Original Openings collection - FILTERED by factoryId
        const originalOpeningsQuery = query(collection(db, 'originalOpenings'), where('factoryId', '==', currentFactory.id));
        const unsubscribeOriginalOpenings = onSnapshot(
            originalOpeningsQuery,
            (snapshot) => {
                const originalOpenings: OriginalOpening[] = [];
                snapshot.forEach((doc) => {
                    originalOpenings.push({ id: doc.id, ...doc.data() } as OriginalOpening);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_ORIGINAL_OPENINGS', payload: originalOpenings });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading original openings:', error)
        );

        // Listen to Logistics Entries collection - FILTERED by factoryId
        const logisticsEntriesQuery = query(collection(db, 'logisticsEntries'), where('factoryId', '==', currentFactory.id));
        const unsubscribeLogisticsEntries = onSnapshot(
            logisticsEntriesQuery,
            (snapshot) => {
                const logisticsEntries: LogisticsEntry[] = [];
                snapshot.forEach((doc) => {
                    logisticsEntries.push({ id: doc.id, ...doc.data() } as LogisticsEntry);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_LOGISTICS_ENTRIES', payload: logisticsEntries });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading logistics entries:', error)
        );

        // Listen to Sales Invoices collection - FILTERED by factoryId
        const salesInvoicesQuery = query(collection(db, 'salesInvoices'), where('factoryId', '==', currentFactory.id));
        const unsubscribeSalesInvoices = onSnapshot(
            salesInvoicesQuery,
            (snapshot) => {
                const salesInvoices: SalesInvoice[] = [];
                snapshot.forEach((doc) => {
                    salesInvoices.push({ id: doc.id, ...doc.data() } as SalesInvoice);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_SALES_INVOICES', payload: salesInvoices });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading sales invoices:', error)
        );

        // Listen to Ongoing Orders collection - FILTERED by factoryId
        const ongoingOrdersQuery = query(collection(db, 'ongoingOrders'), where('factoryId', '==', currentFactory.id));
        const unsubscribeOngoingOrders = onSnapshot(
            ongoingOrdersQuery,
            (snapshot) => {
                const ongoingOrders: OngoingOrder[] = [];
                snapshot.forEach((doc) => {
                    ongoingOrders.push({ id: doc.id, ...doc.data() } as OngoingOrder);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_ONGOING_ORDERS', payload: ongoingOrders });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading ongoing orders:', error)
        );

        // Listen to Attendance collection - FILTERED by factoryId
        const attendanceQuery = query(collection(db, 'attendance'), where('factoryId', '==', currentFactory.id));
        const unsubscribeAttendance = onSnapshot(
            attendanceQuery,
            (snapshot) => {
                const attendance: AttendanceRecord[] = [];
                snapshot.forEach((doc) => {
                    attendance.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
                });
                isUpdatingFromFirestore.current = true;
                dispatch({ type: 'LOAD_ATTENDANCE', payload: attendance });
                setTimeout(() => { isUpdatingFromFirestore.current = false; }, 100);
            },
            (error) => console.error('❌ Error loading attendance:', error)
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
            unsubscribePurchases();
            unsubscribeBundlePurchases();
            unsubscribeLedger();
            unsubscribeProductions();
            unsubscribeOriginalOpenings();
            unsubscribeLogisticsEntries();
            unsubscribeSalesInvoices();
            unsubscribeOngoingOrders();
            unsubscribeAttendance();
        };
    }, [currentFactory]); // Re-run when factory changes

    // Debug helper - expose state to window for console debugging
    useEffect(() => {
        (window as any).debugState = state;
        (window as any).debugInfo = () => {
            console.log('=== DEBUG INFO ===');
            console.log('Purchases:', state.purchases.length);
            console.log('Purchase Details:', state.purchases.map(p => ({ id: p.id, batch: p.batchNumber, value: p.totalValue })));
            console.log('Ledger Entries (PI-):', state.ledger.filter(e => e.transactionId?.startsWith('PI-')).length);
            console.log('Ledger Details:', state.ledger.filter(e => e.transactionId?.startsWith('PI-')).map(e => ({ tx: e.transactionId, account: e.accountId, debit: e.debit, credit: e.credit })));
        };
    }, [state]);

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


    const postTransaction = async (entries: Omit<LedgerEntry, 'id'>[]) => {
        const entriesWithFactory = entries.map(entry => ({
            ...entry,
            factoryId: currentFactory?.id || ''
        }));
        
        // Update local state immediately (optimistic update)
        dispatch({ type: 'POST_TRANSACTION', payload: { entries: entriesWithFactory } });
        
        // Save each ledger entry to Firebase with proper awaiting
        if (isFirestoreLoaded) {
            // Process in smaller batches to avoid Firebase rate limiting
            const LEDGER_BATCH_SIZE = 50; // Firebase allows 500 operations per batch, but we use 50 for safety
            
            for (let i = 0; i < entriesWithFactory.length; i += LEDGER_BATCH_SIZE) {
                const batch = writeBatch(db);
                const batchEntries = entriesWithFactory.slice(i, i + LEDGER_BATCH_SIZE);
                
                for (const entry of batchEntries) {
                    const entryData = {
                        ...entry,
                        createdAt: serverTimestamp()
                    };
                    
                    // Remove undefined values
                    Object.keys(entryData).forEach(key => {
                        if ((entryData as any)[key] === undefined) {
                            (entryData as any)[key] = null;
                        }
                    });
                    
                    // Add to batch
                    const ledgerRef = doc(collection(db, 'ledger'));
                    batch.set(ledgerRef, entryData);
                }
                
                try {
                    // Commit batch and wait for completion
                    await batch.commit();
                    console.log(`✅ Saved ledger batch ${Math.floor(i / LEDGER_BATCH_SIZE) + 1}/${Math.ceil(entriesWithFactory.length / LEDGER_BATCH_SIZE)}: ${batchEntries.length} entries`);
                    
                    // Small delay between batches to avoid rate limiting
                    if (i + LEDGER_BATCH_SIZE < entriesWithFactory.length) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                } catch (error: any) {
                    console.error(`❌ Error saving ledger batch ${Math.floor(i / LEDGER_BATCH_SIZE) + 1}:`, error);
                    // Continue with next batch even if one fails
                }
            }
        }
    };
    
    const deleteTransaction = async (transactionId: string, reason?: string, user?: string) => {
        // Get entries to archive before deletion
        const entriesToArchive = state.ledger.filter(e => e.transactionId === transactionId);
        
        if (entriesToArchive.length === 0) {
            console.warn(`⚠️ No ledger entries found for transaction ${transactionId}`);
            return;
        }
        
        // Create archive entry
        const totalValue = entriesToArchive.reduce((sum, e) => sum + (e.debit > 0 ? e.debit : 0), 0);
        const archiveEntry: ArchivedTransaction = {
            id: generateId(),
            originalTransactionId: transactionId,
            deletedAt: new Date().toISOString(),
            deletedBy: user || 'Unknown',
            reason: reason || 'Deletion',
            entries: entriesToArchive,
            totalValue
        };
        
        // Save archive to Firebase BEFORE deleting
        try {
            const archiveData = {
                ...archiveEntry,
                factoryId: currentFactory?.id || '',
                createdAt: serverTimestamp()
            };
            await addDoc(collection(db, 'archive'), archiveData);
            console.log(`📦 Archived transaction ${transactionId} to Firebase`);
        } catch (error) {
            console.error(`❌ Error archiving transaction ${transactionId}:`, error);
        }
        
        // Delete from state
        dispatch({ type: 'DELETE_LEDGER_ENTRIES', payload: { transactionId, reason, user } });
        
        // Delete from Firebase
        const ledgerQuery = query(collection(db, 'ledger'), where('transactionId', '==', transactionId), where('factoryId', '==', currentFactory?.id || ''));
        const ledgerSnapshot = await getDocs(ledgerQuery);
        
        console.log(`🗑️ Deleting ${ledgerSnapshot.size} ledger entries for transaction ${transactionId}`);
        
        const deletePromises = ledgerSnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
        await Promise.all(deletePromises);
        
        console.log(`✅ Deleted all ledger entries for transaction ${transactionId}`);
    };
    
    const addPurchase = async (purchase: Purchase, skipPartnerLedger: boolean = false) => {
        // 🛡️ SAFEGUARD: Don't sync if Firebase not loaded yet
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, purchase not saved to database');
            return;
        }

        const purchaseWithFactory = {
            ...purchase,
            factoryId: currentFactory?.id || ''
        };
        
        // If items array exists (new multi-type purchase), use it to calculate qty
        // Otherwise, fall back to legacy single-type approach
        let purchaseWithQty: Purchase;
        
        if (purchaseWithFactory.items && purchaseWithFactory.items.length > 0) {
            // NEW: Multi-type purchase - qtyPurchased already calculated in items
            const totalQty = purchaseWithFactory.items.reduce((sum, item) => sum + item.qtyPurchased, 0);
            purchaseWithQty = { ...purchaseWithFactory, qtyPurchased: totalQty };
        } else {
            // LEGACY: Single-type purchase - calculate qty from packing size
            const typeDef = state.originalTypes.find(t => t.id === purchaseWithFactory.originalTypeId);
            const packingSize = typeDef ? typeDef.packingSize : 1; 
            const calculatedQty = purchaseWithFactory.weightPurchased / packingSize;
            purchaseWithQty = { ...purchaseWithFactory, qtyPurchased: calculatedQty };
        }
        
        // Save to Firebase
        const { id, ...purchaseDataToSave } = purchaseWithQty;
        const purchaseData = {
            ...purchaseDataToSave,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Remove undefined values (Firestore doesn't accept them)
        Object.keys(purchaseData).forEach(key => {
            if ((purchaseData as any)[key] === undefined) {
                (purchaseData as any)[key] = null;
            }
        });

        addDoc(collection(db, 'purchases'), purchaseData)
            .then((docRef) => {
                console.log('✅ Purchase saved to Firebase:', docRef.id);
                // Firebase listener will handle adding to local state
            })
            .catch((error) => {
                console.error('❌ Error saving purchase to Firebase:', error);
                alert('Failed to save purchase: ' + error.message);
            });

        // Skip ledger entries if requested (for CSV imports of existing stock)
        if (skipPartnerLedger) {
            console.log('⏭️ Skipping partner ledger entries for purchase (CSV import mode)');
            return;
        }

        // Create journal entries
        // Use Raw Material INVENTORY (ASSET) account, not consumption expense
        const inventoryAccount = state.accounts.find(a => 
            a.type === AccountType.ASSET && (
                a.name.includes('Inventory - Raw Material') ||
                a.name.includes('Inventory - Raw Materials') ||
                a.name.includes('Raw Material Inventory') ||
                a.code === '104' ||
                a.code === '1200'
            )
        );
        const apAccount = state.accounts.find(a => a.name.includes('Accounts Payable'));
        
        if (!inventoryAccount || !apAccount) {
            console.error('❌ Required accounts not found! Inventory:', inventoryAccount, 'AP:', apAccount);
            alert('Warning: Chart of Accounts is incomplete. Please ensure "Inventory - Raw Materials" and "Accounts Payable" accounts exist.');
            return;
        }
        
        const inventoryId = inventoryAccount.id;
        const apId = apAccount.id;
        const transactionId = `PI-${purchaseWithFactory.batchNumber || purchaseWithFactory.id.toUpperCase()}`;
        const entries: Omit<LedgerEntry, 'id'>[] = [
            { date: purchaseWithFactory.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: inventoryId, accountName: 'Inventory - Raw Materials', currency: 'USD', exchangeRate: 1, fcyAmount: purchaseWithFactory.totalLandedCost, debit: purchaseWithFactory.totalLandedCost, credit: 0, narration: `Purchase: ${purchaseWithFactory.originalType} (Batch: ${purchaseWithFactory.batchNumber})`, factoryId: purchaseWithFactory.factoryId }
        ];
        const materialCostUSD = purchaseWithFactory.totalCostFCY / purchaseWithFactory.exchangeRate;
        const supplierName = state.partners.find(p=>p.id===purchaseWithFactory.supplierId)?.name || 'Unknown Supplier';
        // Credit the SUPPLIER's account directly (not general AP)
        entries.push({ date: purchaseWithFactory.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: purchaseWithFactory.supplierId, accountName: supplierName, currency: purchaseWithFactory.currency, exchangeRate: purchaseWithFactory.exchangeRate, fcyAmount: purchaseWithFactory.totalCostFCY, debit: 0, credit: materialCostUSD, narration: `Material Cost: ${supplierName}`, factoryId: purchaseWithFactory.factoryId });
        // ...existing code...
        purchaseWithFactory.additionalCosts.forEach(cost => {
            const providerName = state.partners.find(p => p.id === cost.providerId)?.name || 'Unknown Provider';
            // Credit the PROVIDER's account directly (freight forwarder, clearing agent, etc.)
            entries.push({ date: purchase.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: cost.providerId, accountName: providerName, currency: cost.currency, exchangeRate: cost.exchangeRate, fcyAmount: cost.amountFCY, debit: 0, credit: cost.amountUSD, narration: `${cost.costType}: ${providerName}`, factoryId: purchaseWithFactory.factoryId });
        });
        await postTransaction(entries);
    };
    const addBundlePurchase = async (bundle: BundlePurchase) => {
        // 🛡️ SAFEGUARD: Don't sync if Firebase not loaded yet
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, bundle purchase not saved to database');
            return;
        }

        const bundleWithFactory = {
            ...bundle,
            factoryId: currentFactory?.id || ''
        };
        
        // Save to Firebase
        const { id, ...bundleDataToSave } = bundleWithFactory;
        const bundleData = {
            ...bundleDataToSave,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Remove undefined values (Firestore doesn't accept them)
        Object.keys(bundleData).forEach(key => {
            if ((bundleData as any)[key] === undefined) {
                (bundleData as any)[key] = null;
            }
        });

        addDoc(collection(db, 'bundlePurchases'), bundleData)
            .then((docRef) => {
                console.log('✅ Bundle purchase saved to Firebase:', docRef.id);
                // Firebase listener will handle adding to local state
            })
            .catch((error) => {
                console.error('❌ Error saving bundle purchase to Firebase:', error);
                alert('Failed to save bundle purchase: ' + error.message);
            });

        // Create journal entries
        const apId = '201'; const inventoryAssetId = '105'; const transactionId = `BUN-${bundle.batchNumber}`; const entries: Omit<LedgerEntry, 'id'>[] = [];
        const materialCostUSD = bundle.items.reduce((sum, item) => sum + item.totalUSD, 0); const materialCostFCY = bundle.items.reduce((sum, item) => sum + item.totalFCY, 0);
        entries.push({ date: bundle.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: inventoryAssetId, accountName: 'Inventory - Finished Goods', currency: 'USD', exchangeRate: 1, fcyAmount: materialCostUSD, debit: materialCostUSD, credit: 0, narration: `Bundle Purchase Material: ${bundle.batchNumber}`, factoryId: bundle.factoryId });
        entries.push({ date: bundle.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: apId, accountName: 'Accounts Payable', currency: bundle.currency, exchangeRate: bundle.exchangeRate, fcyAmount: materialCostFCY, debit: 0, credit: materialCostUSD, narration: `Bundle Purchase: ${state.partners.find(p=>p.id===bundle.supplierId)?.name}`, factoryId: bundle.factoryId });
            // ...existing code...
        bundle.additionalCosts.forEach(cost => {
            const providerName = state.partners.find(p => p.id === cost.providerId)?.name || 'Unknown';
            entries.push({ date: bundle.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: inventoryAssetId, accountName: 'Inventory - Finished Goods', currency: 'USD', exchangeRate: 1, fcyAmount: cost.amountUSD, debit: cost.amountUSD, credit: 0, narration: `${cost.costType} (Capitalized): ${providerName}`, factoryId: bundle.factoryId });
            entries.push({ date: bundle.date, transactionId, transactionType: TransactionType.PURCHASE_INVOICE, accountId: apId, accountName: 'Accounts Payable', currency: cost.currency, exchangeRate: cost.exchangeRate, fcyAmount: cost.amountFCY, debit: 0, credit: cost.amountUSD, narration: `${cost.costType}: ${providerName}`, factoryId: bundle.factoryId });
                    // ...existing code...
        });
        await postTransaction(entries);
    };
    const addPartner = async (partner: Partner) => {
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

        // Use provided ID or generate one
        let partnerId = partner.id;
        if (!partnerId || partnerId.trim() === '') {
            // Auto-generate ID if not provided
            const prefix = partner.type === PartnerType.SUPPLIER ? 'SUP' :
                          partner.type === PartnerType.CUSTOMER ? 'CUS' :
                          partner.type === PartnerType.SUB_SUPPLIER ? 'SUB' :
                          partner.type === PartnerType.VENDOR ? 'VEN' :
                          partner.type === PartnerType.CLEARING_AGENT ? 'CLA' :
                          partner.type === PartnerType.FREIGHT_FORWARDER ? 'FFW' :
                          partner.type === PartnerType.COMMISSION_AGENT ? 'COM' : 'PTN';
            
            const sameTypePartners = state.partners.filter(p => p.type === partner.type);
            const existingIds = sameTypePartners
                .map(p => {
                    const match = p.id?.match(new RegExp(`^${prefix}-(\\d+)$`));
                    return match ? parseInt(match[1]) : 0;
                })
                .filter(n => n > 0)
                .sort((a, b) => b - a);
            
            const nextNumber = existingIds.length > 0 ? existingIds[0] + 1 : 1001;
            partnerId = `${prefix}-${nextNumber}`;
        } else {
            partnerId = partnerId.trim();
            // Check if ID/code already exists for THIS factory (allow same code across factories)
            const existingPartner = state.partners.find(p => 
                (p.id === partnerId || (p as any).code === partnerId) && 
                p.factoryId === currentFactory?.id
            );
            if (existingPartner) {
                alert(`Partner ID/Code "${partnerId}" already exists for this factory. Please use a different ID.`);
                return;
            }
            
            // Also check in Firebase to be safe (per factory)
            try {
                const partnersQuery = query(
                    collection(db, 'partners'),
                    where('factoryId', '==', currentFactory?.id || '')
                );
                const partnersSnapshot = await getDocs(partnersQuery);
                const existsInFirebase = partnersSnapshot.docs.some(doc => {
                    const data = doc.data();
                    return data.id === partnerId || data.code === partnerId;
                });
                if (existsInFirebase) {
                    alert(`Partner ID/Code "${partnerId}" already exists in database for this factory. Please use a different ID.`);
                    return;
                }
            } catch (error) {
                console.error('Error checking partner ID:', error);
            }
        }

        // Remove id from data (we'll use it as document ID)
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

        // CRITICAL FIX: Save partner with balance = 0 if opening balance exists
        // The balance will be calculated from ledger entries via POST_TRANSACTION to avoid double counting
        // This prevents the issue where positive supplier balances become negative due to:
        // 1. Partner saved with balance = X
        // 2. Opening balance entry posted (adds X to balance)
        // 3. Result: balance becomes 2X or gets inverted
        // Solution: Save with balance = 0, let opening balance entry set the correct balance
        const partnerDataForSave = partner.balance !== 0 
            ? { ...partnerData, balance: 0 }
            : partnerData;

        // Use setDoc with the provided/generated ID as document ID
        setDoc(doc(db, 'partners', partnerId), partnerDataForSave)
            .then(async () => {
                console.log('✅ Partner saved to Firebase with ID:', partnerId);
                // Firebase listener will handle adding to local state

                // Handle opening balance if needed
                if (partner.balance !== 0) {
                    const prevYear = new Date().getFullYear() - 1;
                    const date = `${prevYear}-12-31`;
                    const openingEquityId = state.accounts.find(a => a.name.includes('Capital'))?.id || '301';
                    const apId = state.accounts.find(a => a.name.includes('Payable'))?.id || '201';
                    let entries: Omit<LedgerEntry, 'id'>[] = [];
                    const currency = partner.defaultCurrency || 'USD';
                    const exchangeRates = getExchangeRates(state.currencies);
                    const rate = exchangeRates[currency] || 1;
                    const fcyAmt = partner.balance * rate;
                    const commonProps = { currency, exchangeRate: rate, fcyAmount: Math.abs(fcyAmt) };
                    if (partner.type === 'CUSTOMER') {
                        // Debit the individual customer's account (not generic AR)
                        entries = [
                            {
                                ...commonProps,
                                date,
                                transactionId: `OB-${partnerId}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: partnerId,
                                accountName: partner.name,
                                debit: partner.balance,
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
                                credit: partner.balance,
                                narration: `Opening Balance - ${partner.name}`,
                                factoryId: currentFactory?.id || ''
                            }
                        ];
                    } else {
                        // Suppliers, Vendors, etc.
                        // Negative balance = Accounts Payable (we owe them) - Credit supplier account
                        // Positive balance = Advance to Supplier (we paid in advance) - Debit supplier account
                        const absBalance = Math.abs(partner.balance);
                        
                        if (partner.balance < 0) {
                            // Negative: Accounts Payable (liability)
                            // Credit supplier account (increases liability/negative balance)
                            // Debit Opening Equity
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
                            // Positive: Advance to Supplier (asset)
                            // Debit supplier account (increases positive balance/asset)
                            // Credit Opening Equity
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
                    await postTransaction(entries);
                }
            })
            .catch((error) => {
                console.error('❌ Error saving partner to Firebase:', error);
                alert('Failed to save partner: ' + error.message);
            });
    };
    const addItem = async (item: Item, openingStock: number = 0, skipFirebase: boolean = false) => {
        // 🛡️ SAFEGUARD: Don't sync if Firebase not loaded yet
        if (!isFirestoreLoaded && !skipFirebase) {
            console.warn('⚠️ Firebase not loaded, item not saved to database');
            dispatch({ type: 'ADD_ITEM', payload: { ...item, stockQty: openingStock, nextSerial: openingStock + 1 } });
            return;
        }
        
        // Post ledger entries for opening stock if present (handles both positive and negative costs)
        if (openingStock > 0 && item.avgCost !== 0) {
            const prevYear = new Date().getFullYear() - 1;
            const date = `${prevYear}-12-31`;
            const stockValue = openingStock * item.avgCost;
            
            // Lookup accounts dynamically (factory-specific, always correct)
            const finishedGoodsAccount = state.accounts.find(a => 
                a.name.includes('Finished Goods') || 
                a.name.includes('Inventory - Finished Goods') ||
                a.code === '105'
            );
            const capitalAccount = state.accounts.find(a => 
                a.name.includes('Capital') || 
                a.name.includes('Owner\'s Capital') ||
                a.code === '301'
            );
            
            if (!finishedGoodsAccount || !capitalAccount) {
                const missingAccounts = [];
                if (!finishedGoodsAccount) missingAccounts.push('Inventory - Finished Goods (105)');
                if (!capitalAccount) missingAccounts.push('Capital (301)');
                console.error(`❌ Required accounts not found: ${missingAccounts.join(', ')}`);
                alert(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts.`);
                return; // Don't create item if accounts are missing
            }
            
            const finishedGoodsId = finishedGoodsAccount.id;
            const capitalId = capitalAccount.id;
            
            // For positive stock value: Debit Inventory (asset increase), Credit Capital (equity increase)
            // For negative stock value: Credit Inventory (asset decrease), Debit Capital (equity decrease)
            const entries = [
                {
                    date,
                    transactionId: `OB-STK-${item.id}`,
                    transactionType: TransactionType.OPENING_BALANCE,
                    accountId: finishedGoodsId,
                    accountName: finishedGoodsAccount.name,
                    currency: 'USD',
                    exchangeRate: 1,
                    fcyAmount: Math.abs(stockValue),
                    debit: stockValue > 0 ? stockValue : 0,
                    credit: stockValue < 0 ? Math.abs(stockValue) : 0,
                    narration: `Opening Stock - ${item.name}`,
                    factoryId: currentFactory?.id || ''
                },
                {
                    date,
                    transactionId: `OB-STK-${item.id}`,
                    transactionType: TransactionType.OPENING_BALANCE,
                    accountId: capitalId,
                    accountName: capitalAccount.name,
                    currency: 'USD',
                    exchangeRate: 1,
                    fcyAmount: Math.abs(stockValue),
                    debit: stockValue < 0 ? Math.abs(stockValue) : 0,
                    credit: stockValue > 0 ? stockValue : 0,
                    narration: `Opening Stock - ${item.name}`,
                    factoryId: currentFactory?.id || ''
                }
            ];
            await postTransaction(entries);
        }
        const itemWithFactory = {
            ...item,
            factoryId: currentFactory?.id || ''
        };
        const nextSerial = openingStock + 1; const itemWithStock = { ...itemWithFactory, stockQty: openingStock, nextSerial: nextSerial }; 
        
        // Only dispatch ADD_ITEM if not skipping Firebase (Firebase listener will handle it)
        // When skipFirebase=true, the batch write already saved to Firebase, and the listener will add it to state
        if (!skipFirebase) {
            dispatch({ type: 'ADD_ITEM', payload: itemWithStock });
            
            // Save to Firebase (remove id field)
            const { id: _, ...itemData } = itemWithStock;
            addDoc(collection(db, 'items'), { ...itemData, createdAt: serverTimestamp() })
                .then(() => console.log('✅ Item saved to Firebase'))
                .catch((error) => console.error('❌ Error saving item:', error));
        }
        // When skipFirebase=true, Firebase listener will add the item to state automatically
        // We only need to handle opening stock ledger entries here
    };

    const updateItem = async (id: string, updatedItem: Item) => {
        const itemWithFactory = {
            ...updatedItem,
            factoryId: currentFactory?.id || ''
        };
        
        // Update in state
        dispatch({ type: 'UPDATE_ENTITY', payload: { type: 'items', id, data: itemWithFactory } });
        
        // Update in Firebase
        try {
            // Try direct update by document ID
            await updateDoc(doc(db, 'items', id), itemWithFactory);
            console.log(`✅ Updated item ${id} in Firebase`);
        } catch (error: any) {
            // If direct update fails, try to find and update by query
            console.warn(`⚠️ Could not update by ID, searching...`, error);
            try {
                const itemsQuery = query(
                    collection(db, 'items'),
                    where('factoryId', '==', currentFactory?.id || ''),
                    where('code', '==', updatedItem.code)
                );
                const snapshot = await getDocs(itemsQuery);
                if (!snapshot.empty) {
                    await updateDoc(snapshot.docs[0].ref, itemWithFactory);
                    console.log(`✅ Updated item by query match`);
                } else {
                    console.error(`❌ Item not found in Firebase`);
                }
            } catch (queryError) {
                console.error(`❌ Error updating item by query:`, queryError);
            }
        }
    };

    const addOriginalOpening = async (opening: OriginalOpening) => {
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, original opening not saved to database');
            return;
        }
        
        const openingWithFactory = {
            ...opening,
            factoryId: currentFactory?.id || ''
        };
        
        // Save to Firebase
        const { id, ...openingData } = openingWithFactory;
        // Remove undefined fields (Firebase doesn't allow undefined values)
        const cleanedData = Object.fromEntries(
            Object.entries(openingData).filter(([_, value]) => value !== undefined)
        );
        addDoc(collection(db, 'originalOpenings'), { ...cleanedData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Original Opening saved to Firebase'))
            .catch((error) => console.error('❌ Error saving original opening:', error));
        
        // Create accounting entries for raw material consumption
        // Always use the INVENTORY (ASSET) account, not the expense account
        const rawMaterialInvId = state.accounts.find(a => 
            a.type === AccountType.ASSET && (
                a.name.includes('Inventory - Raw Material') ||
                a.name.includes('Inventory - Raw Materials') ||
                a.name.includes('Raw Material Inventory') ||
                a.code === '104' ||
                a.code === '1200'
            )
        )?.id;
        const wipId = state.accounts.find(a => a.name.includes('Work in Progress'))?.id;
        
        if (rawMaterialInvId && wipId) {
            const transactionId = `OO-${openingWithFactory.id}`;
            const entries: Omit<LedgerEntry, 'id'>[] = [
                // Credit Raw Materials (reduce inventory)
                {
                    date: openingWithFactory.date,
                    transactionId,
                    transactionType: TransactionType.ORIGINAL_OPENING,
                    accountId: rawMaterialInvId,
                    accountName: 'Inventory - Raw Materials',
                    currency: 'USD',
                    exchangeRate: 1,
                    fcyAmount: openingWithFactory.totalValue,
                    debit: 0,
                    credit: openingWithFactory.totalValue,
                    narration: `Raw Material Consumption: ${openingWithFactory.originalType} (${openingWithFactory.weightOpened}kg)`,
                    factoryId: openingWithFactory.factoryId
                },
                // Debit WIP (transfer to work in progress)
                {
                    date: openingWithFactory.date,
                    transactionId,
                    transactionType: TransactionType.ORIGINAL_OPENING,
                    accountId: wipId,
                    accountName: 'Work in Progress (Inventory)',
                    currency: 'USD',
                    exchangeRate: 1,
                    fcyAmount: openingWithFactory.totalValue,
                    debit: openingWithFactory.totalValue,
                    credit: 0,
                    narration: `Raw Material Consumption: ${openingWithFactory.originalType} (${openingWithFactory.weightOpened}kg)`,
                    factoryId: openingWithFactory.factoryId
                }
            ];
            await postTransaction(entries);
        } else {
            console.error('❌ Original Opening accounting failed: Missing accounts', {
                rawMaterialInvId,
                wipId,
                availableAccounts: state.accounts.map(a => a.name)
            });
        }
        
        dispatch({ type: 'ADD_ORIGINAL_OPENING', payload: openingWithFactory });
    };
    const deleteOriginalOpening = async (id: string) => {
        // Delete ledger entries first
        const transactionId = `OO-${id}`;
        await deleteTransaction(transactionId, 'Delete Original Opening', CURRENT_USER?.name || 'Admin');
        
        // Delete from state
        dispatch({ type: 'DELETE_ENTITY', payload: { type: 'originalOpenings', id } });
        
        // Try to delete from Firebase by document ID
        try {
            await deleteDoc(doc(db, 'originalOpenings', id));
            console.log(`✅ Deleted original opening ${id} from Firebase`);
        } catch (error: any) {
            // If direct delete fails (wrong ID), try to find and delete by query
            console.warn(`⚠️ Could not delete by ID, searching...`, error);
            try {
                const openingsQuery = query(
                    collection(db, 'originalOpenings'), 
                    where('factoryId', '==', currentFactory?.id || '')
                );
                const snapshot = await getDocs(openingsQuery);
                const deletePromises: Promise<void>[] = [];
                snapshot.docs.forEach(docSnapshot => {
                    const data = docSnapshot.data();
                    // Match by a unique combination of fields
                    if (data.date && data.supplierId && data.originalType && data.qtyOpened) {
                        const opening = state.originalOpenings.find(o => o.id === id);
                        if (opening && 
                            data.date === opening.date &&
                            data.supplierId === opening.supplierId &&
                            data.originalType === opening.originalType &&
                            data.qtyOpened === opening.qtyOpened) {
                            deletePromises.push(deleteDoc(docSnapshot.ref));
                        }
                    }
                });
                await Promise.all(deletePromises);
                console.log(`✅ Deleted original opening by query match`);
            } catch (queryError) {
                console.error(`❌ Error deleting original opening by query:`, queryError);
            }
        }
        
        // Auto-refresh to update balances
        console.log('🔄 Refreshing page to update Balance Sheet...');
        setTimeout(() => window.location.reload(), 500);
    };
    const addProduction = async (productions: ProductionEntry[]) => {
        console.log('🟢 addProduction called with:', productions);
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, production not saved to database');
            return;
        }
        
        const productionsWithFactory = productions.map(prod => ({
            ...prod,
            factoryId: currentFactory?.id || ''
        }));
        
        console.log('🟢 Productions with factory:', productionsWithFactory);
        
        // Save production entries to Firebase using batch writes (FAST for bulk uploads!)
        const BATCH_SIZE = 500; // Firebase limit
        const productionBatches: any[][] = [];
        
        for (let i = 0; i < productionsWithFactory.length; i += BATCH_SIZE) {
            productionBatches.push(productionsWithFactory.slice(i, i + BATCH_SIZE));
        }
        
        for (let batchIdx = 0; batchIdx < productionBatches.length; batchIdx++) {
            const batch = writeBatch(db);
            const batchProds = productionBatches[batchIdx];
            
            for (const prod of batchProds) {
                const { id, ...prodData } = prod;
                // Remove undefined fields (Firebase doesn't allow undefined values)
                const cleanedData = Object.fromEntries(
                    Object.entries(prodData).filter(([_, value]) => value !== undefined)
                );
                
                const prodRef = doc(collection(db, 'productions'));
                batch.set(prodRef, { ...cleanedData, createdAt: serverTimestamp() });
            }
            
            await batch.commit();
            console.log(`✅ Batch ${batchIdx + 1}/${productionBatches.length}: Saved ${batchProds.length} production entries to Firebase`);
        }
        
        // Create accounting entries for production
        const fgInvId = state.accounts.find(a => a.name.includes('Inventory - Finished Goods'))?.id;
        const wipId = state.accounts.find(a => a.name.includes('Work in Progress'))?.id;
        const productionGainId = state.accounts.find(a => a.name.includes('Production Gain'))?.id;
        
        if (fgInvId) {
            // Check if this is a re-baling transaction
            const isRebalingTransaction = productionsWithFactory.some(p => p.isRebaling);
            
            if (isRebalingTransaction) {
                // RE-BALING ACCOUNTING: FG to FG transformation
                const transactionId = `REBALE-${productionsWithFactory[0].id}`;
                
                // Calculate total value consumed and produced
                const consumedItems = productionsWithFactory.filter(p => p.qtyProduced < 0);
                const producedItems = productionsWithFactory.filter(p => p.qtyProduced > 0);
                
                const totalConsumedValue = consumedItems.reduce((sum, prod) => {
                    const item = state.items.find(i => i.id === prod.itemId);
                    return sum + Math.abs(prod.qtyProduced) * (item?.avgCost || 0);
                }, 0);
                
                const totalProducedValue = producedItems.reduce((sum, prod) => {
                    const item = state.items.find(i => i.id === prod.itemId);
                    return sum + prod.qtyProduced * (item?.avgCost || 0);
                }, 0);
                
                const rebalingGainLoss = totalProducedValue - totalConsumedValue;
                
                console.log('🔄 Re-baling Transaction:', {
                    totalConsumedValue,
                    totalProducedValue,
                    rebalingGainLoss
                });
                
                const entries: Omit<LedgerEntry, 'id'>[] = [];
                
                // Credit FG Inventory for consumed items
                if (totalConsumedValue > 0) {
                    entries.push({
                        date: productionsWithFactory[0].date,
                        transactionId,
                        transactionType: TransactionType.PRODUCTION,
                        accountId: fgInvId,
                        accountName: 'Inventory - Finished Goods',
                        currency: 'USD',
                        exchangeRate: 1,
                        fcyAmount: totalConsumedValue,
                        debit: 0,
                        credit: totalConsumedValue,
                        narration: `Re-baling: Consumed ${consumedItems.map(p => `${Math.abs(p.qtyProduced)} ${p.itemName}`).join(', ')}`,
                        factoryId: productionsWithFactory[0].factoryId
                    });
                }
                
                // Debit FG Inventory for produced items
                if (totalProducedValue > 0) {
                    entries.push({
                        date: productionsWithFactory[0].date,
                        transactionId,
                        transactionType: TransactionType.PRODUCTION,
                        accountId: fgInvId,
                        accountName: 'Inventory - Finished Goods',
                        currency: 'USD',
                        exchangeRate: 1,
                        fcyAmount: totalProducedValue,
                        debit: totalProducedValue,
                        credit: 0,
                        narration: `Re-baling: Produced ${producedItems.map(p => `${p.qtyProduced} ${p.itemName}`).join(', ')}`,
                        factoryId: productionsWithFactory[0].factoryId
                    });
                }
                
                // Record re-baling gain/loss
                if (rebalingGainLoss !== 0 && productionGainId) {
                    entries.push({
                        date: productionsWithFactory[0].date,
                        transactionId,
                        transactionType: TransactionType.PRODUCTION,
                        accountId: productionGainId,
                        accountName: 'Production Gain',
                        currency: 'USD',
                        exchangeRate: 1,
                        fcyAmount: Math.abs(rebalingGainLoss),
                        debit: rebalingGainLoss < 0 ? Math.abs(rebalingGainLoss) : 0,
                        credit: rebalingGainLoss > 0 ? rebalingGainLoss : 0,
                        narration: `Re-baling ${rebalingGainLoss > 0 ? 'Gain' : 'Loss'}`,
                        factoryId: productionsWithFactory[0].factoryId
                    });
                }
                
                if (entries.length > 0) {
                    await postTransaction(entries);
                }
                
            } else if (wipId) {
                // NORMAL PRODUCTION ACCOUNTING: WIP to FG
                // BATCHED: Collect all ledger entries first, then post in one go (FAST!)
                const allLedgerEntries: Omit<LedgerEntry, 'id'>[] = [];
                
                for (const prod of productionsWithFactory) {
                    try {
                        const item = state.items.find(i => i.id === prod.itemId);
                        if (!item) {
                            console.log('❌ Item not found for production:', prod.itemId);
                            continue;
                        }
                        
                        // Calculate values using avgCost (can be negative for waste/garbage items)
                        const finishedGoodsValue = prod.qtyProduced * (item.avgCost || 0);
                        const totalKg = prod.weightProduced;
                        const wipCostPerKg = 1; // This should ideally come from the actual WIP cost tracking
                        const wipValueConsumed = totalKg * wipCostPerKg;
                        const productionGain = finishedGoodsValue - wipValueConsumed;
                        
                        const transactionId = `PROD-${prod.id}`;
                        
                        // Finished Goods entry (debit if positive, credit if negative value like garbage)
                        allLedgerEntries.push({
                            date: prod.date,
                            transactionId,
                            transactionType: TransactionType.PRODUCTION,
                            accountId: fgInvId,
                            accountName: 'Inventory - Finished Goods',
                            currency: 'USD',
                            exchangeRate: 1,
                            fcyAmount: Math.abs(finishedGoodsValue),
                            debit: finishedGoodsValue >= 0 ? finishedGoodsValue : 0,
                            credit: finishedGoodsValue < 0 ? Math.abs(finishedGoodsValue) : 0,
                            narration: `Production: ${prod.itemName} (${prod.qtyProduced} units, ${totalKg}kg)`,
                            factoryId: prod.factoryId
                        });
                        
                        // Credit WIP (reduce work in progress)
                        allLedgerEntries.push({
                            date: prod.date,
                            transactionId,
                            transactionType: TransactionType.PRODUCTION,
                            accountId: wipId,
                            accountName: 'Work in Progress (Inventory)',
                            currency: 'USD',
                            exchangeRate: 1,
                            fcyAmount: wipValueConsumed,
                            debit: 0,
                            credit: wipValueConsumed,
                            narration: `Production: ${prod.itemName} (${totalKg}kg raw material consumed)`,
                            factoryId: prod.factoryId
                        });
                        
                        // If there's a production gain, credit Production Gain account
                        if (productionGain !== 0 && productionGainId) {
                            allLedgerEntries.push({
                                date: prod.date,
                                transactionId,
                                transactionType: TransactionType.PRODUCTION,
                                accountId: productionGainId,
                                accountName: 'Production Gain',
                                currency: 'USD',
                                exchangeRate: 1,
                                fcyAmount: Math.abs(productionGain),
                                debit: productionGain < 0 ? Math.abs(productionGain) : 0,
                                credit: productionGain > 0 ? productionGain : 0,
                                narration: `Production ${productionGain > 0 ? 'Gain' : 'Loss'}: ${prod.itemName}`,
                                factoryId: prod.factoryId
                            });
                        }
                    } catch (error: any) {
                        console.error('❌ Error preparing production accounting:', error);
                    }
                }
                
                // Post all ledger entries in one batch (much faster!)
                if (allLedgerEntries.length > 0) {
                    await postTransaction(allLedgerEntries);
                    console.log(`✅ Created ${allLedgerEntries.length} ledger entries for ${productionsWithFactory.length} production entries in one batch`);
                }
            }
        }
        
        // First dispatch to update local state
        dispatch({ type: 'ADD_PRODUCTION', payload: productionsWithFactory });
        
        // Then update item stock quantities in Firebase based on production changes
        const itemStockUpdates = new Map<string, { stockQtyDelta: number; maxSerialEnd: number }>();
        
        productionsWithFactory.forEach(prod => {
            const existing = itemStockUpdates.get(prod.itemId);
            const currentDelta = existing?.stockQtyDelta || 0;
            const currentMaxSerial = existing?.maxSerialEnd || 0;
            
            itemStockUpdates.set(prod.itemId, {
                stockQtyDelta: currentDelta + prod.qtyProduced,
                maxSerialEnd: Math.max(currentMaxSerial, prod.serialEnd || 0)
            });
        });
        
        // Apply updates to Firebase using batch writes (FAST!)
        if (itemStockUpdates.size > 0) {
            const BATCH_SIZE = 500;
            const itemUpdateBatches: Array<Array<[string, { stockQtyDelta: number; maxSerialEnd: number }]>> = [];
            
            const itemUpdatesArray = Array.from(itemStockUpdates.entries());
            for (let i = 0; i < itemUpdatesArray.length; i += BATCH_SIZE) {
                itemUpdateBatches.push(itemUpdatesArray.slice(i, i + BATCH_SIZE));
            }
            
            for (let batchIdx = 0; batchIdx < itemUpdateBatches.length; batchIdx++) {
                const batch = writeBatch(db);
                const batchUpdates = itemUpdateBatches[batchIdx];
                
                for (const [itemId, { stockQtyDelta, maxSerialEnd }] of batchUpdates) {
                    const item = state.items.find(i => i.id === itemId);
                    if (item) {
                        const updates: any = {
                            stockQty: item.stockQty + stockQtyDelta
                        };
                        
                        if (maxSerialEnd > 0 && item.packingType !== PackingType.KG) {
                            updates.nextSerial = maxSerialEnd + 1;
                        }
                        
                        batch.update(doc(db, 'items', itemId), updates);
                    }
                }
                
                await batch.commit();
                console.log(`✅ Batch ${batchIdx + 1}/${itemUpdateBatches.length}: Updated stock for ${batchUpdates.length} items`);
            }
        }
    };

    const deleteProduction = async (id: string) => {
        // Delete ledger entries first
        const transactionId = `PROD-${id}`;
        await deleteTransaction(transactionId, 'Delete Production', CURRENT_USER?.name || 'Admin');
        
        // Delete from state
        dispatch({ type: 'DELETE_ENTITY', payload: { type: 'productions', id } });
        
        // Try to delete from Firebase by document ID
        try {
            await deleteDoc(doc(db, 'productions', id));
            console.log(`✅ Deleted production ${id} from Firebase`);
        } catch (error: any) {
            // If direct delete fails (wrong ID), try to find and delete by query
            console.warn(`⚠️ Could not delete by ID, searching...`, error);
            try {
                const productionsQuery = query(
                    collection(db, 'productions'), 
                    where('factoryId', '==', currentFactory?.id || '')
                );
                const snapshot = await getDocs(productionsQuery);
                const deletePromises: Promise<void>[] = [];
                snapshot.docs.forEach(docSnapshot => {
                    const data = docSnapshot.data();
                    // Match by a unique combination of fields
                    if (data.date && data.itemId && data.qtyProduced) {
                        const production = state.productions.find(p => p.id === id);
                        if (production && 
                            data.date === production.date &&
                            data.itemId === production.itemId &&
                            data.qtyProduced === production.qtyProduced) {
                            deletePromises.push(deleteDoc(docSnapshot.ref));
                        }
                    }
                });
                await Promise.all(deletePromises);
                console.log(`✅ Deleted production by query match`);
            } catch (queryError) {
                console.error(`❌ Error deleting production by query:`, queryError);
            }
        }
        
        // Auto-refresh to update balances
        console.log('🔄 Refreshing page to update Balance Sheet...');
        setTimeout(() => window.location.reload(), 500);
    };

    const deleteProductionsForDate = async (date: string): Promise<number> => {
        const factoryId = currentFactory?.id || '';
        const productionsForDate = state.productions.filter(p => p.date === date && p.factoryId === factoryId);
        if (productionsForDate.length === 0) return 0;

        // 1) Delete ALL ledger transactions for production on that date (use ledger transaction IDs, not production doc IDs)
        const productionTxnIds = Array.from(new Set(
            state.ledger
                .filter(e => e.factoryId === factoryId && e.date === date && e.transactionType === TransactionType.PRODUCTION)
                .map(e => e.transactionId)
        ));

        for (const txnId of productionTxnIds) {
            await deleteTransaction(txnId, `Delete Production (${date})`, CURRENT_USER?.name || 'Admin');
        }

        // 2) Reverse item stock changes for those production entries
        // (production adds qtyProduced to stock; deleting should subtract it back out)
        const qtyByItem = new Map<string, number>();
        productionsForDate.forEach(p => {
            qtyByItem.set(p.itemId, (qtyByItem.get(p.itemId) || 0) + (p.qtyProduced || 0));
        });

        const itemEntries = Array.from(qtyByItem.entries());
        const ITEM_BATCH_SIZE = 500;
        for (let i = 0; i < itemEntries.length; i += ITEM_BATCH_SIZE) {
            const batch = writeBatch(db);
            for (const [itemId, qtyDelta] of itemEntries.slice(i, i + ITEM_BATCH_SIZE)) {
                const item = state.items.find(it => it.id === itemId);
                if (!item) continue;
                batch.update(doc(db, 'items', itemId), { stockQty: (item.stockQty || 0) - qtyDelta });
            }
            await batch.commit();
        }

        // 3) Delete production documents (these are already Firestore doc IDs in state)
        const PROD_BATCH_SIZE = 500;
        for (let i = 0; i < productionsForDate.length; i += PROD_BATCH_SIZE) {
            const batch = writeBatch(db);
            productionsForDate.slice(i, i + PROD_BATCH_SIZE).forEach(p => {
                batch.delete(doc(db, 'productions', p.id));
            });
            await batch.commit();
        }

        // Optimistically update local state (listeners will also reconcile)
        dispatch({ type: 'LOAD_PRODUCTIONS', payload: state.productions.filter(p => p.date !== date) });

        // Single refresh (do NOT refresh per entry)
        console.log('🔄 Refreshing page to update Balance Sheet...');
        setTimeout(() => window.location.reload(), 500);

        return productionsForDate.length;
    };

    const postBaleOpening = async (stagedItems: { itemId: string, qty: number, date: string }[]) => {
        if (stagedItems.length === 0) return;
        const transactionId = generateId(); const expenseId = state.accounts.find(a => a.name.includes('Cost of Goods'))?.id || '501'; const fgInvId = state.accounts.find(a => a.name.includes('Finished Goods'))?.id || '105';
        const productionEntries: ProductionEntry[] = []; const journalEntries: Omit<LedgerEntry, 'id'>[] = [];
        stagedItems.forEach(itemData => {
            const item = state.items.find(i => i.id === itemData.itemId); if (!item) return;
            const totalKg = itemData.qty * item.weightPerUnit; const value = totalKg * item.avgCost;
            productionEntries.push({ id: `NEG-PROD-${item.id}-${transactionId}`, date: itemData.date, itemId: item.id, itemName: item.name, packingType: item.packingType, qtyProduced: -itemData.qty, weightProduced: -totalKg, factoryId: currentFactory?.id || '' });
            const dummyOpening: OriginalOpening = { id: `OO-INT-${item.id}-${transactionId}`, date: itemData.date, supplierId: 'SUP-INTERNAL-STOCK', originalType: `FROM-${item.name}`, qtyOpened: itemData.qty, weightOpened: totalKg, costPerKg: item.avgCost, totalValue: value };
            dispatch({ type: 'ADD_ORIGINAL_OPENING', payload: dummyOpening });
            journalEntries.push({ date: itemData.date, transactionId: `JV-BO-${transactionId}`, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: expenseId, accountName: 'Raw Material Consumption Expense', currency: 'USD', exchangeRate: 1, fcyAmount: value, debit: value, credit: 0, narration: `Bale Opening: ${item.name} (${itemData.qty} Units)`, factoryId: currentFactory?.id || '' });
            journalEntries.push({ date: itemData.date, transactionId: `JV-BO-${transactionId}`, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: fgInvId, accountName: 'Inventory - Finished Goods', currency: 'USD', exchangeRate: 1, fcyAmount: value, debit: 0, credit: value, narration: `Bale Opening: ${item.name} (${itemData.qty} Units)`, factoryId: currentFactory?.id || '' });
        });
        dispatch({ type: 'ADD_PRODUCTION', payload: productionEntries });
        await postTransaction(journalEntries);
    };
    const saveLogisticsEntry = async (entry: LogisticsEntry): Promise<void> => {
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, logistics entry not saved to database');
            return;
        }
        
        const entryWithFactory = {
            ...entry,
            factoryId: currentFactory?.id || ''
        };
        
        // Save to Firebase
        const { purchaseId, ...entryData } = entryWithFactory;
        try {
            await addDoc(collection(db, 'logisticsEntries'), { ...entryData, purchaseId, createdAt: serverTimestamp() });
            console.log(`✅ Logistics entry saved to Firebase (Purchase: ${purchaseId}, Container: ${entry.containerNumber})`);
        } catch (error: any) {
            console.error(`❌ Error saving logistics entry (Purchase: ${purchaseId}, Container: ${entry.containerNumber}):`, error);
            throw error; // Re-throw so caller can handle it
        }
    };
    const addSalesInvoice = (invoice: SalesInvoice) => {
        try {
            const invoiceWithFactory = {
                ...invoice,
                factoryId: currentFactory?.id || ''
            };
            
            // Update local state immediately (optimistic update)
            dispatch({ type: 'ADD_SALES_INVOICE', payload: invoiceWithFactory });
            
            // Save to Firebase if loaded
            if (isFirestoreLoaded) {
                const { id, ...invoiceData } = invoiceWithFactory;
                const cleanedInvoiceData = stripUndefinedDeep(invoiceData);
                addDoc(collection(db, 'salesInvoices'), { ...cleanedInvoiceData, createdAt: serverTimestamp() })
                    .then(() => console.log('✅ Sales invoice saved to Firebase'))
                    .catch((error) => {
                        console.error('❌ Error saving sales invoice to Firebase:', error);
                        // Keep the optimistic update - user can see the invoice even if Firebase save fails
                    });
            } else {
                console.warn('⚠️ Firebase not loaded, sales invoice saved to local state only');
            }
        } catch (error) {
            console.error('❌ Error in addSalesInvoice:', error);
            throw error; // Re-throw so caller can handle it
        }
    };
    const updateSalesInvoice = (invoice: SalesInvoice) => {
        const invoiceWithFactory = {
            ...invoice,
            factoryId: currentFactory?.id || ''
        };
        
        // Update local state immediately
        dispatch({ type: 'UPDATE_SALES_INVOICE', payload: invoiceWithFactory });
        
        // Save to Firebase if loaded
        if (isFirestoreLoaded) {
            const invoiceRef = doc(db, 'salesInvoices', invoice.id);
            const { id, ...invoiceData } = invoiceWithFactory;
            const cleanedInvoiceData = stripUndefinedDeep(invoiceData);
            updateDoc(invoiceRef, { ...cleanedInvoiceData, updatedAt: serverTimestamp() })
                .then(() => console.log('✅ Sales invoice updated in Firebase'))
                .catch((error) => {
                    console.error('❌ Error updating sales invoice:', error);
                    // Revert local state update if Firebase update fails
                    const originalInvoice = state.salesInvoices.find(inv => inv.id === invoice.id);
                    if (originalInvoice) {
                        dispatch({ type: 'UPDATE_SALES_INVOICE', payload: originalInvoice });
                    }
                });
        } else {
            console.warn('⚠️ Firebase not loaded, sales invoice updated in local state only');
        }
    };
    const updatePurchase = (purchase: Purchase) => dispatch({ type: 'UPDATE_PURCHASE', payload: purchase });
    const postSalesInvoice = async (invoice: SalesInvoice) => {
        // Prevent double posting - check if entries already exist
        const transactionId = `INV-${invoice.invoiceNo}`;
        const existingEntries = state.ledger.filter(e => e.transactionId === transactionId);
        if (existingEntries.length > 0) {
            alert('⚠️ This invoice has already been posted! Ledger entries exist.');
            console.warn('Prevented double posting for:', invoice.invoiceNo);
            return;
        }
        
        dispatch({ type: 'POST_SALES_INVOICE', payload: invoice });
        
        // Update status in Firestore (find by matching invoice data since we don't store Firebase doc ID)
        if (isFirestoreLoaded) {
            try {
                const invoicesRef = collection(db, 'salesInvoices');
                const q = query(invoicesRef, where('invoiceNo', '==', invoice.invoiceNo));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const docRef = snapshot.docs[0].ref;
                    await updateDoc(docRef, { status: 'Posted' });
                    console.log('✅ Invoice status updated to Posted in Firestore');
                }
            } catch (error) {
                console.error('❌ Error updating invoice status:', error);
            }
        }
        
        // Lookup accounts dynamically (factory-specific, always correct)
        const revenueAccount = state.accounts.find(a => 
            a.name.includes('Sales Revenue') ||
            a.code === '401'
        );
        const discountAccount = state.accounts.find(a => 
            a.name.includes('Discount') ||
            a.code === '501'
        );
        const cogsAccount = state.accounts.find(a => 
            a.name.includes('Cost of Goods Sold') ||
            a.code === '5000' ||
            a.code === '503'
        );
        const finishedGoodsAccount = state.accounts.find(a => 
            a.name.includes('Inventory - Finished Goods') ||
            a.name.includes('Finished Goods') ||
            a.code === '105' ||
            a.code === '1202'
        );
        const customerName = state.partners.find(p => p.id === invoice.customerId)?.name || 'Unknown Customer';
        
        if (!revenueAccount || !cogsAccount || !finishedGoodsAccount) {
            const missingAccounts = [];
            if (!revenueAccount) missingAccounts.push('Sales Revenue (401)');
            if (!cogsAccount) missingAccounts.push('Cost of Goods Sold (5000 or 503)');
            if (!finishedGoodsAccount) missingAccounts.push('Inventory - Finished Goods (105 or 1202)');
            alert(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts.`);
            return;
        }
        
        const revenueId = revenueAccount.id;
        const discountId = discountAccount?.id; // Optional account
        const cogsId = cogsAccount.id;
        const finishedGoodsId = finishedGoodsAccount.id;
        
        // Debit the CUSTOMER's account directly (not general AR) - Sales are in USD, but store with customer's currency for display
        const customerCurrency = (invoice as any).customerCurrency || invoice.currency || 'USD';
        const customerRate = (invoice as any).customerExchangeRate || invoice.exchangeRate || 1;
        const fcyAmountForCustomer = invoice.netTotal * customerRate; // Convert USD to customer's currency using invoice's saved rate
        const entries: Omit<LedgerEntry, 'id'>[] = [ { date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: invoice.customerId, accountName: customerName, currency: customerCurrency, exchangeRate: customerRate, fcyAmount: fcyAmountForCustomer, debit: invoice.netTotal, credit: 0, narration: `Sales Invoice: ${invoice.invoiceNo}`, factoryId: invoice.factoryId } ];
        const totalItemsRevenueUSD = invoice.items.reduce((sum, item) => sum + item.total, 0);
        entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: revenueId, accountName: revenueAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: totalItemsRevenueUSD, debit: 0, credit: totalItemsRevenueUSD, narration: `Revenue: ${invoice.invoiceNo}`, factoryId: invoice.factoryId });
        if (invoice.surcharge > 0) { entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: revenueId, accountName: revenueAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: invoice.surcharge, debit: 0, credit: invoice.surcharge, narration: `Surcharge: ${invoice.invoiceNo}`, factoryId: invoice.factoryId }); }
        if (invoice.discount > 0 && discountId && discountAccount) { entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: discountId, accountName: discountAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: invoice.discount, debit: invoice.discount, credit: 0, narration: `Discount: ${invoice.invoiceNo}`, factoryId: invoice.factoryId }); }
        
        // Calculate COGS based on item avgCost and reduce Finished Goods inventory
        const totalCOGS = invoice.items.reduce((sum, item) => {
            const itemDef = state.items.find(i => i.id === item.itemId);
            if (!itemDef) return sum;
            // COGS = quantity × avgCost (avgCost is per unit)
            const itemCOGS = item.qty * itemDef.avgCost;
            return sum + itemCOGS;
        }, 0);
        
        if (totalCOGS > 0) {
            // Debit COGS (Expense increases)
            entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: cogsId, accountName: cogsAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: totalCOGS, debit: totalCOGS, credit: 0, narration: `COGS: ${invoice.invoiceNo}`, factoryId: invoice.factoryId });
            // Credit Finished Goods Inventory (Asset decreases)
            entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: finishedGoodsId, accountName: finishedGoodsAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: totalCOGS, debit: 0, credit: totalCOGS, narration: `Inventory Reduction: ${invoice.invoiceNo}`, factoryId: invoice.factoryId });
        }
        
        invoice.additionalCosts.forEach(cost => { 
            const amountUSD = cost.amount / cost.exchangeRate;
            
            // For Customs/Other (no providerId), post to general Accounts Payable
            // For Freight/Clearing/Commission (with providerId), post to provider's account
            if (cost.providerId) {
                const providerName = state.partners.find(p => p.id === cost.providerId)?.name || 'Unknown Provider';
                // Credit the PROVIDER's account directly
                entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: cost.providerId, accountName: providerName, currency: cost.currency, exchangeRate: cost.exchangeRate, fcyAmount: cost.amount, debit: 0, credit: amountUSD, narration: `${cost.costType} Payable: ${invoice.invoiceNo}`, factoryId: invoice.factoryId });
            } else {
                // Customs/Other: Post to general Accounts Payable account
                const apAccount = state.accounts.find(a => 
                    a.name.includes('Accounts Payable') ||
                    a.name.includes('Accounts Payable - Other') ||
                    a.code === '2001' ||
                    a.code === '201'
                );
                
                if (apAccount) {
                    const customDescription = (cost as any).customDescription || cost.costType;
                    entries.push({ 
                        date: invoice.date, 
                        transactionId, 
                        transactionType: TransactionType.SALES_INVOICE, 
                        accountId: apAccount.id, 
                        accountName: apAccount.name, 
                        currency: cost.currency, 
                        exchangeRate: cost.exchangeRate, 
                        fcyAmount: cost.amount, 
                        debit: 0, 
                        credit: amountUSD, 
                        narration: `${cost.costType} Payable: ${customDescription} (${invoice.invoiceNo})`, 
                        factoryId: invoice.factoryId 
                    });
                } else {
                    console.error(`❌ Accounts Payable account not found for ${cost.costType} cost in invoice ${invoice.invoiceNo}`);
                }
            }
        });
        await postTransaction(entries);
    };
    const addDirectSale = async (invoice: SalesInvoice, batchLandedCostPerKg: number) => {
        dispatch({ type: 'ADD_SALES_INVOICE', payload: invoice });
        // Save Direct Sale to Firestore (same as addSalesInvoice)
        if (isFirestoreLoaded) {
            const invoiceWithFactory = {
                ...invoice,
                factoryId: currentFactory?.id || ''
            };
            const { id, ...invoiceData } = invoiceWithFactory;
            const cleanedInvoiceData = stripUndefinedDeep(invoiceData);
            addDoc(collection(db, 'salesInvoices'), { ...cleanedInvoiceData, createdAt: serverTimestamp() })
                .then(() => console.log('✅ Direct Sale saved to Firebase'))
                .catch((error) => console.error('❌ Error saving direct sale:', error));
        }
        const transactionId = `DS-${invoice.invoiceNo}`;
        // Lookup accounts dynamically (factory-specific, always correct)
        const revenueAccount = state.accounts.find(a => 
            a.name.includes('Sales Revenue') ||
            a.code === '401'
        );
        const cogsAccount = state.accounts.find(a => 
            a.name.includes('Cost of Goods Sold - Direct Sales') ||
            a.name.includes('Cost of Goods Sold') ||
            a.code === '503'
        );
        const inventoryAccount = state.accounts.find(a => 
            a.type === AccountType.ASSET && (
                a.name.includes('Inventory - Raw Material') ||
                a.name.includes('Inventory - Raw Materials') ||
                a.name.includes('Raw Material Inventory') ||
                a.code === '104' ||
                a.code === '1200'
            )
        );
        const customerName = state.partners.find(p => p.id === invoice.customerId)?.name || 'Unknown Customer';
        
        if (!revenueAccount || !cogsAccount || !inventoryAccount) {
            const missingAccounts = [];
            if (!revenueAccount) missingAccounts.push('Sales Revenue (401)');
            if (!cogsAccount) missingAccounts.push('Cost of Goods Sold - Direct Sales (503)');
            if (!inventoryAccount) missingAccounts.push('Inventory - Raw Material (104)');
            alert(`Missing required accounts: ${missingAccounts.join(', ')}. Please ensure these accounts exist in Setup > Chart of Accounts.`);
            return;
        }
        
        const revenueId = revenueAccount.id;
        const cogsId = cogsAccount.id;
        const rawMatInventoryId = inventoryAccount.id;
        
        // Debit the CUSTOMER's account directly (not general AR) - Sales are in USD, store with customer's currency for display
        const customerCurrency = (invoice as any).customerCurrency || 'USD';
        const customerRate = (invoice as any).customerExchangeRate || 1;
        const fcyAmountForCustomer = invoice.netTotal * customerRate; // Convert USD to customer's currency
        const entries: Omit<LedgerEntry, 'id'>[] = [
            { date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: invoice.customerId, accountName: customerName, currency: customerCurrency, exchangeRate: customerRate, fcyAmount: fcyAmountForCustomer, debit: invoice.netTotal, credit: 0, narration: `Direct Sale: ${invoice.invoiceNo}`, factoryId: invoice.factoryId },
            { date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: revenueId, accountName: revenueAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: invoice.netTotal, debit: 0, credit: invoice.netTotal, narration: `Direct Sale Revenue: ${invoice.invoiceNo}`, factoryId: invoice.factoryId }
        ];
        const totalSoldKg = invoice.items.reduce((sum, i) => sum + i.totalKg, 0);
        const totalCostUSD = totalSoldKg * batchLandedCostPerKg;
        entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: cogsId, accountName: cogsAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: totalCostUSD, debit: totalCostUSD, credit: 0, narration: `Cost of Direct Sale: ${invoice.invoiceNo} (${totalSoldKg}kg)`, factoryId: invoice.factoryId });
        entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: rawMatInventoryId, accountName: inventoryAccount.name, currency: 'USD', exchangeRate: 1, fcyAmount: totalCostUSD, debit: 0, credit: totalCostUSD, narration: `Inventory Consumption: Direct Sale ${invoice.invoiceNo}`, factoryId: invoice.factoryId });
        await postTransaction(entries);
    };
    const addOngoingOrder = (order: OngoingOrder) => {
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, ongoing order not saved to database');
            return;
        }
        
        const orderWithFactory = {
            ...order,
            factoryId: currentFactory?.id || ''
        };
        
        // Save to Firebase
        const { id, ...orderData } = orderWithFactory;
        addDoc(collection(db, 'ongoingOrders'), { ...orderData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Ongoing order saved to Firebase'))
            .catch((error) => console.error('❌ Error saving ongoing order:', error));
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
        const newInvoice: SalesInvoice = { id: generateId(), invoiceNo: nextInvNo, date: new Date().toISOString().split('T')[0], status: 'Unposted', customerId: order.customerId, logoId: state.logos[0]?.id || '', currency: 'USD', exchangeRate: 1, customerCurrency: currency, customerExchangeRate: rate, divisionId: customer?.divisionId, subDivisionId: customer?.subDivisionId, discount: 0, surcharge: 0, items: invoiceItems, additionalCosts: [], grossTotal: grossTotal, netTotal: grossTotal, factoryId: currentFactory?.id || '' };
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
    const saveAttendance = (record: AttendanceRecord) => {
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, attendance not saved to database');
            return;
        }
        
        const recordWithFactory = {
            ...record,
            factoryId: currentFactory?.id || ''
        };
        
        // Save to Firebase
        addDoc(collection(db, 'attendance'), { ...recordWithFactory, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Attendance saved to Firebase'))
            .catch((error) => console.error('❌ Error saving attendance:', error));
    };
    const processPayroll = async (payment: SalaryPayment, sourceAccountId: string) => {
        dispatch({ type: 'PROCESS_PAYROLL', payload: payment });
        const salaryExpenseId = state.accounts.find(a => a.name.includes('Salaries'))?.id || '504';
        const entries: Omit<LedgerEntry, 'id'>[] = [
            { date: payment.paymentDate, transactionId: payment.voucherId, transactionType: TransactionType.PAYMENT_VOUCHER, accountId: salaryExpenseId, accountName: 'Salaries & Wages', currency: 'USD', exchangeRate: 1, fcyAmount: payment.netPaid, debit: payment.netPaid, credit: 0, narration: `Payroll ${payment.monthYear}: ${state.employees.find(e => e.id === payment.employeeId)?.name}`, factoryId: payment.factoryId },
            { date: payment.paymentDate, transactionId: payment.voucherId, transactionType: TransactionType.PAYMENT_VOUCHER, accountId: sourceAccountId, accountName: 'Cash/Bank', currency: 'USD', exchangeRate: 1, fcyAmount: payment.netPaid, debit: 0, credit: payment.netPaid, narration: `Payroll ${payment.monthYear}: ${state.employees.find(e => e.id === payment.employeeId)?.name}`, factoryId: payment.factoryId }
        ];
        await postTransaction(entries);
    };
    const addVehicleFine = async (vehicleId: string, type: string, amount: number, employeeId: string) => {
        const vehicle = state.vehicles.find(v => v.id === vehicleId); const employee = state.employees.find(e => e.id === employeeId); if (!vehicle || !employee) return;
        const charge: VehicleCharge = { id: generateId(), vehicleId, employeeId, date: new Date().toISOString().split('T')[0], type, amount, journalEntryId: `JV-VF-${generateId()}` }; dispatch({ type: 'ADD_VEHICLE_CHARGE', payload: charge });
        const salaryExpenseId = state.accounts.find(a => a.name.includes('Vehicle Expenses'))?.id || '505'; const otherIncomeId = '401'; 
        const entries: Omit<LedgerEntry, 'id'>[] = [
            { date: charge.date, transactionId: charge.journalEntryId, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: salaryExpenseId, accountName: 'Vehicle Expenses', currency: 'USD', exchangeRate: 1, fcyAmount: amount, debit: amount, credit: 0, narration: `Fine: ${type} - ${vehicle.plateNumber}`, factoryId: currentFactory?.id || '' },
            { date: charge.date, transactionId: charge.journalEntryId, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: otherIncomeId, accountName: 'Other Income / Recoverable', currency: 'USD', exchangeRate: 1, fcyAmount: amount, debit: 0, credit: amount, narration: `Fine Recovery from ${employee.name}`, factoryId: currentFactory?.id || '' }
        ];
        await postTransaction(entries);
    };
    const sendMessage = (msg: ChatMessage) => dispatch({ type: 'SEND_MESSAGE', payload: msg });
    const markChatRead = (chatId: string) => dispatch({ type: 'MARK_CHAT_READ', payload: { chatId, userId: CURRENT_USER.id } });
    const addOriginalType = async (type: OriginalType) => {
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, original type not saved to database');
            dispatch({ type: 'ADD_ORIGINAL_TYPE', payload: { ...type, factoryId: currentFactory?.id || '' } });
            return;
        }

        const typeWithFactory = { ...type, factoryId: currentFactory?.id || '' };
        
        // Use provided ID or generate one
        let originalTypeId = type.id;
        if (!originalTypeId || originalTypeId.trim() === '') {
            // Auto-generate ID if not provided
            const prefix = 'OT';
            const existingIds = state.originalTypes
                .map(ot => {
                    const match = ot.id?.match(/^OT-(\d+)$/);
                    return match ? parseInt(match[1]) : 0;
                })
                .filter(n => n > 0)
                .sort((a, b) => b - a);
            
            const nextNumber = existingIds.length > 0 ? existingIds[0] + 1 : 1001;
            originalTypeId = `${prefix}-${nextNumber}`;
        } else {
            originalTypeId = originalTypeId.trim();
            // Check if ID already exists
            const existingType = state.originalTypes.find(ot => ot.id === originalTypeId);
            if (existingType) {
                alert(`Original Type ID "${originalTypeId}" already exists. Please use a different ID.`);
                return;
            }
            
            // Also check in Firebase to be safe
            try {
                const typeDoc = await getDoc(doc(db, 'originalTypes', originalTypeId));
                if (typeDoc.exists()) {
                    alert(`Original Type ID "${originalTypeId}" already exists in database. Please use a different ID.`);
                    return;
                }
            } catch (error) {
                console.error('Error checking original type ID:', error);
            }
        }

        // Remove id from data (we'll use it as document ID)
        const { id, ...typeDataToSave } = typeWithFactory;
        const typeData = {
            ...typeDataToSave,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Remove undefined values (Firestore doesn't accept them)
        Object.keys(typeData).forEach(key => {
            if ((typeData as any)[key] === undefined) {
                (typeData as any)[key] = null;
            }
        });

        // Use setDoc with the provided/generated ID as document ID
        setDoc(doc(db, 'originalTypes', originalTypeId), typeData)
            .then(() => {
                console.log('✅ OriginalType saved to Firebase with ID:', originalTypeId);
                // Firebase listener will handle adding to local state
            })
            .catch((error) => {
                console.error('❌ Error saving originalType:', error);
                alert('Failed to save original type: ' + error.message);
            });
    };
    const addOriginalProduct = (prod: OriginalProduct) => {
        const prodWithFactory = { ...prod, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_ORIGINAL_PRODUCT', payload: prodWithFactory });

        // Use the business Code (id) as the Firestore document ID so UI can display it.
        const { id, ...prodData } = prodWithFactory;
        const cleanedData = stripUndefinedDeep(prodData);
        setDoc(doc(db, 'originalProducts', id), { ...cleanedData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
            .then(() => console.log('✅ OriginalProduct saved with ID:', id))
            .catch((error) => console.error('❌ Error saving originalProduct:', error));
    };
    const addCategory = (cat: Category) => {
        const categoryWithFactory = { ...cat, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_CATEGORY', payload: categoryWithFactory });
        // Preserve the business ID in Firestore so UI can show it
        addDoc(collection(db, 'categories'), { ...categoryWithFactory, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Category saved'))
            .catch((error) => console.error('❌ Error saving category:', error));
    };
    const addSection = (sec: Section) => {
        const sectionWithFactory = { ...sec, factoryId: currentFactory?.id || '' };
        dispatch({ type: 'ADD_SECTION', payload: sectionWithFactory });
        addDoc(collection(db, 'sections'), { ...sectionWithFactory, createdAt: serverTimestamp() })
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

    const updateAccount = async (id: string, account: Account): Promise<void> => {
        // Get the old account balance before updating
        const oldAccount = state.accounts.find(a => a.id === id);
        const oldBalance = oldAccount?.balance || 0;
        const newBalance = account.balance || 0;
        const balanceDifference = newBalance - oldBalance;
        
        const accountWithFactory = {
            ...account,
            factoryId: currentFactory?.id || ''
        };
        
        // Update in state
        dispatch({ type: 'UPDATE_ENTITY', payload: { type: 'accounts', id, data: accountWithFactory } });
        
        // Update in Firebase
        try {
            await updateDoc(doc(db, 'accounts', id), accountWithFactory);
            console.log(`✅ Updated account ${id} in Firebase`);
            
            // If balance changed, create ledger entries to balance the equation
            if (Math.abs(balanceDifference) > 0.01) {
                const prevYear = new Date().getFullYear() - 1;
                const date = `${prevYear}-12-31`;
                const currency = account.currency || 'USD';
                const exchangeRates = getExchangeRates(state.currencies);
                const rate = exchangeRates[currency] || 1;
                const fcyAmt = Math.abs(balanceDifference) * rate;
                
                // Find Capital or Opening Equity account
                // Lookup Capital account dynamically (factory-specific, always correct)
                const capitalAccount = state.accounts.find(a => 
                    a.name.includes('Capital') || 
                    a.name.includes('Owner\'s Capital') ||
                    a.name.includes('Opening Equity') ||
                    a.code === '301'
                );
                if (!capitalAccount) {
                    console.error('❌ Capital account not found');
                    alert('Capital account not found. Please ensure Capital account exists in Setup > Chart of Accounts.');
                    return;
                }
                const capitalId = capitalAccount.id;
                const capitalAccountName = capitalAccount.name;
                
                // Determine if this is an asset or liability/equity account
                const isAssetOrExpense = [AccountType.ASSET, AccountType.EXPENSE].includes(account.type);
                
                let entries: Omit<LedgerEntry, 'id'>[] = [];
                
                if (isAssetOrExpense) {
                    // For Asset accounts: Debit increases, Credit decreases
                    if (balanceDifference > 0) {
                        // Balance increased: Debit asset, Credit equity
                        entries = [
                            {
                                date,
                                transactionId: `OB-ADJ-${id}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: id,
                                accountName: account.name,
                                currency,
                                exchangeRate: rate,
                                fcyAmount: fcyAmt,
                                debit: balanceDifference,
                                credit: 0,
                                narration: `Opening Balance Adjustment - ${account.name}`,
                                factoryId: currentFactory?.id || ''
                            },
                            {
                                date,
                                transactionId: `OB-ADJ-${id}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: capitalId,
                                accountName: capitalAccountName,
                                currency,
                                exchangeRate: rate,
                                fcyAmount: fcyAmt,
                                debit: 0,
                                credit: balanceDifference,
                                narration: `Opening Balance Adjustment - ${account.name}`,
                                factoryId: currentFactory?.id || ''
                            }
                        ];
                    } else {
                        // Balance decreased: Credit asset, Debit equity
                        entries = [
                            {
                                date,
                                transactionId: `OB-ADJ-${id}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: id,
                                accountName: account.name,
                                currency,
                                exchangeRate: rate,
                                fcyAmount: fcyAmt,
                                debit: 0,
                                credit: Math.abs(balanceDifference),
                                narration: `Opening Balance Adjustment - ${account.name}`,
                                factoryId: currentFactory?.id || ''
                            },
                            {
                                date,
                                transactionId: `OB-ADJ-${id}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: capitalId,
                                accountName: capitalAccountName,
                                currency,
                                exchangeRate: rate,
                                fcyAmount: fcyAmt,
                                debit: Math.abs(balanceDifference),
                                credit: 0,
                                narration: `Opening Balance Adjustment - ${account.name}`,
                                factoryId: currentFactory?.id || ''
                            }
                        ];
                    }
                } else {
                    // For Liability/Equity accounts: Credit increases, Debit decreases
                    if (balanceDifference > 0) {
                        // Balance increased: Credit liability/equity, Debit equity (contra)
                        entries = [
                            {
                                date,
                                transactionId: `OB-ADJ-${id}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: id,
                                accountName: account.name,
                                currency,
                                exchangeRate: rate,
                                fcyAmount: fcyAmt,
                                debit: 0,
                                credit: balanceDifference,
                                narration: `Opening Balance Adjustment - ${account.name}`,
                                factoryId: currentFactory?.id || ''
                            },
                            {
                                date,
                                transactionId: `OB-ADJ-${id}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: capitalId,
                                accountName: capitalAccountName,
                                currency,
                                exchangeRate: rate,
                                fcyAmount: fcyAmt,
                                debit: balanceDifference,
                                credit: 0,
                                narration: `Opening Balance Adjustment - ${account.name}`,
                                factoryId: currentFactory?.id || ''
                            }
                        ];
                    } else {
                        // Balance decreased: Debit liability/equity, Credit equity
                        entries = [
                            {
                                date,
                                transactionId: `OB-ADJ-${id}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: id,
                                accountName: account.name,
                                currency,
                                exchangeRate: rate,
                                fcyAmount: fcyAmt,
                                debit: Math.abs(balanceDifference),
                                credit: 0,
                                narration: `Opening Balance Adjustment - ${account.name}`,
                                factoryId: currentFactory?.id || ''
                            },
                            {
                                date,
                                transactionId: `OB-ADJ-${id}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: capitalId,
                                accountName: capitalAccountName,
                                currency,
                                exchangeRate: rate,
                                fcyAmount: fcyAmt,
                                debit: 0,
                                credit: Math.abs(balanceDifference),
                                narration: `Opening Balance Adjustment - ${account.name}`,
                                factoryId: currentFactory?.id || ''
                            }
                        ];
                    }
                }
                
                // Post the ledger entries
                if (entries.length > 0) {
                    await postTransaction(entries);
                    console.log(`✅ Posted opening balance adjustment entries for account ${id}`);
                }
            }
        } catch (error: any) {
            console.error(`❌ Error updating account:`, error);
            throw error;
        }
    };
    const addDivision = (division: Division) => {
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, division saved to local state only');
            const divisionWithFactory = { ...division, factoryId: currentFactory?.id || '', code: division.code || division.id || '' };
            dispatch({ type: 'ADD_DIVISION', payload: divisionWithFactory });
            return;
        }

        // Use code field, fallback to id for backward compatibility
        const divisionCode = division.code || division.id || '';
        
        // Check for duplicate code (per factory)
        if (divisionCode) {
            const existingDivision = state.divisions.find(d => 
                d.factoryId === currentFactory?.id && 
                (d.code || d.id) === divisionCode.trim()
            );
            if (existingDivision) {
                alert(`Division Code "${divisionCode}" already exists for this factory. Please use a different code.`);
                return;
            }
        }

        // Auto-generate code if not provided
        let finalCode = divisionCode.trim();
        if (!finalCode) {
            const prefix = 'DIV';
            const existingCodes = state.divisions
                .filter(d => d.factoryId === currentFactory?.id)
                .map(d => {
                    const code = d.code || d.id;
                    const match = code?.match(/^DIV-(\d+)$/);
                    return match ? parseInt(match[1]) : 0;
                })
                .filter(n => n > 0)
                .sort((a, b) => b - a);
            const nextNumber = existingCodes.length > 0 ? existingCodes[0] + 1 : 1001;
            finalCode = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
        }

        const divisionWithFactory = { 
            ...division, 
            factoryId: currentFactory?.id || '',
            code: finalCode
        };
        
        // Update local state immediately (optimistic update)
        dispatch({ type: 'ADD_DIVISION', payload: divisionWithFactory });
        
        // Save to Firebase (Firebase will auto-generate document ID)
        const { id: _, ...divisionData } = divisionWithFactory;
        addDoc(collection(db, 'divisions'), { ...divisionData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Division saved to Firebase'))
            .catch((error) => {
                console.error('❌ Error saving division to Firebase:', error);
                // Keep optimistic update - user can see the division even if Firebase save fails
            });
    };
    const addSubDivision = (subDivision: SubDivision) => {
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, subDivision saved to local state only');
            const subDivisionWithFactory = { ...subDivision, factoryId: currentFactory?.id || '', code: subDivision.code || subDivision.id || '' };
            dispatch({ type: 'ADD_SUB_DIVISION', payload: subDivisionWithFactory });
            return;
        }

        // Use code field, fallback to id for backward compatibility
        const subDivisionCode = subDivision.code || subDivision.id || '';
        
        // Check for duplicate code (per factory)
        if (subDivisionCode) {
            const existingSubDivision = state.subDivisions.find(sd => 
                sd.factoryId === currentFactory?.id && 
                (sd.code || sd.id) === subDivisionCode.trim()
            );
            if (existingSubDivision) {
                alert(`Sub-Division Code "${subDivisionCode}" already exists for this factory. Please use a different code.`);
                return;
            }
        }

        // Auto-generate code if not provided
        let finalCode = subDivisionCode.trim();
        if (!finalCode) {
            const prefix = 'SUBDIV';
            const existingCodes = state.subDivisions
                .filter(sd => sd.factoryId === currentFactory?.id)
                .map(sd => {
                    const code = sd.code || sd.id;
                    const match = code?.match(/^SUBDIV-(\d+)$/);
                    return match ? parseInt(match[1]) : 0;
                })
                .filter(n => n > 0)
                .sort((a, b) => b - a);
            const nextNumber = existingCodes.length > 0 ? existingCodes[0] + 1 : 1001;
            finalCode = `${prefix}-${String(nextNumber).padStart(3, '0')}`;
        }

        const subDivisionWithFactory = { 
            ...subDivision, 
            factoryId: currentFactory?.id || '',
            code: finalCode
        };
        
        // Update local state immediately (optimistic update)
        dispatch({ type: 'ADD_SUB_DIVISION', payload: subDivisionWithFactory });
        
        // Save to Firebase (Firebase will auto-generate document ID)
        const { id: _, ...subDivisionData } = subDivisionWithFactory;
        addDoc(collection(db, 'subDivisions'), { ...subDivisionData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ SubDivision saved to Firebase'))
            .catch((error) => {
                console.error('❌ Error saving subDivision to Firebase:', error);
                // Keep optimistic update - user can see the subDivision even if Firebase save fails
            });
    };
    const updateDivision = (id: string, division: Division) => {
        const divisionWithFactory = { 
            ...division, 
            id, // Preserve the Firebase document ID
            factoryId: currentFactory?.id || '',
            code: division.code || division.id || ''
        };
        
        // Check for duplicate code (per factory, excluding current division)
        if (divisionWithFactory.code) {
            const existingDivision = state.divisions.find(d => 
                d.id !== id &&
                d.factoryId === currentFactory?.id && 
                (d.code || d.id) === divisionWithFactory.code.trim()
            );
            if (existingDivision) {
                alert(`Division Code "${divisionWithFactory.code}" already exists for this factory. Please use a different code.`);
                return;
            }
        }
        
        // Update local state immediately
        dispatch({ type: 'UPDATE_DIVISION', payload: divisionWithFactory });
        
        // Save to Firebase if loaded
        if (isFirestoreLoaded) {
            const divisionRef = doc(db, 'divisions', id);
            const { id: _, ...divisionData } = divisionWithFactory;
            updateDoc(divisionRef, { ...divisionData, updatedAt: serverTimestamp() })
                .then(() => console.log('✅ Division updated in Firebase'))
                .catch((error) => {
                    console.error('❌ Error updating division in Firebase:', error);
                    // Revert local state update if Firebase update fails
                    const originalDivision = state.divisions.find(d => d.id === id);
                    if (originalDivision) {
                        dispatch({ type: 'UPDATE_DIVISION', payload: originalDivision });
                    }
                });
        } else {
            console.warn('⚠️ Firebase not loaded, division updated in local state only');
        }
    };
    const updateSubDivision = (id: string, subDivision: SubDivision) => {
        const subDivisionWithFactory = { 
            ...subDivision, 
            id, // Preserve the Firebase document ID
            factoryId: currentFactory?.id || '',
            code: subDivision.code || subDivision.id || ''
        };
        
        // Check for duplicate code (per factory, excluding current subDivision)
        if (subDivisionWithFactory.code) {
            const existingSubDivision = state.subDivisions.find(sd => 
                sd.id !== id &&
                sd.factoryId === currentFactory?.id && 
                (sd.code || sd.id) === subDivisionWithFactory.code.trim()
            );
            if (existingSubDivision) {
                alert(`Sub-Division Code "${subDivisionWithFactory.code}" already exists for this factory. Please use a different code.`);
                return;
            }
        }
        
        // Update local state immediately
        dispatch({ type: 'UPDATE_SUB_DIVISION', payload: subDivisionWithFactory });
        
        // Save to Firebase if loaded
        if (isFirestoreLoaded) {
            const subDivisionRef = doc(db, 'subDivisions', id);
            const { id: _, ...subDivisionData } = subDivisionWithFactory;
            updateDoc(subDivisionRef, { ...subDivisionData, updatedAt: serverTimestamp() })
                .then(() => console.log('✅ SubDivision updated in Firebase'))
                .catch((error) => {
                    console.error('❌ Error updating subDivision in Firebase:', error);
                    // Revert local state update if Firebase update fails
                    const originalSubDivision = state.subDivisions.find(sd => sd.id === id);
                    if (originalSubDivision) {
                        dispatch({ type: 'UPDATE_SUB_DIVISION', payload: originalSubDivision });
                    }
                });
        } else {
            console.warn('⚠️ Firebase not loaded, subDivision updated in local state only');
        }
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
    const deleteEntity = async (type: any, id: string) => {
        console.log(`🗑️ Attempting to delete ${type}/${id}`);
        
        // Special handling for certain entity types - require PIN
        if (type === 'partners' || type === 'items' || type === 'accounts') {
            const pin = prompt('Enter Supervisor PIN to delete:');
            if (pin !== '7860') {
                alert('Invalid PIN. Deletion cancelled.');
                return;
            }
        }
        
        // If deleting a partner, also delete/archive their opening balance ledger entries
        if (type === 'partners') {
            const partner = state.partners.find(p => p.id === id);
            if (partner) {
                // Find all ledger entries for this partner (opening balances and transactions)
                const partnerLedgerEntries = state.ledger.filter(e => 
                    e.accountId === id && 
                    (e.transactionType === TransactionType.OPENING_BALANCE || 
                     e.transactionType === TransactionType.RECEIPT_VOUCHER ||
                     e.transactionType === TransactionType.PAYMENT_VOUCHER ||
                     e.transactionType === TransactionType.EXPENSE_VOUCHER ||
                     e.transactionType === TransactionType.JOURNAL_VOUCHER ||
                     e.transactionType === TransactionType.PURCHASE_BILL ||
                     e.transactionType === TransactionType.INVENTORY_ADJUSTMENT ||
                     e.transactionType === TransactionType.RETURN_TO_SUPPLIER ||
                     e.transactionType === TransactionType.WRITE_OFF ||
                     e.transactionType === TransactionType.BALANCING_DISCREPANCY)
                );
                
                if (partnerLedgerEntries.length > 0) {
                    // Get unique transaction IDs
                    const transactionIds = Array.from(new Set(partnerLedgerEntries.map(e => e.transactionId)));
                    
                    console.log(`🗑️ Found ${partnerLedgerEntries.length} ledger entries for partner ${partner.name}. Archiving ${transactionIds.length} transactions.`);
                    
                    // Archive each transaction
                    transactionIds.forEach((transactionId) => {
                        deleteTransaction(String(transactionId), `Partner "${partner.name}" deleted`, CURRENT_USER?.name || 'System');
                    });
                }
            }
        }
        
        // If deleting an item, also delete/archive its opening stock ledger entries
        if (type === 'items') {
            const item = state.items.find(i => i.id === id);
            if (item) {
                // Check if item should have opening stock ledger entries
                const openingStock = item.openingStock || item.stockQty || 0;
                const avgCost = item.avgCost || 0;
                const shouldHaveEntries = openingStock > 0 && avgCost !== 0;
                
                console.log(`📦 Item deletion check:`, {
                    name: item.name,
                    id: item.id,
                    openingStock: openingStock,
                    avgCost: avgCost,
                    stockQty: item.stockQty,
                    shouldHaveEntries: shouldHaveEntries,
                    expectedValue: openingStock * avgCost
                });
                
                // Find opening stock ledger entries for this item
                const openingStockTransactionId = `OB-STK-${id}`;
                console.log(`🔍 Looking for ledger entries with transactionId: ${openingStockTransactionId}`);
                console.log(`📊 Total ledger entries in state: ${state.ledger.length}`);
                
                const itemLedgerEntries = state.ledger.filter(e => 
                    e.transactionId === openingStockTransactionId
                );
                
                console.log(`🔍 Found ${itemLedgerEntries.length} ledger entries for item ${item.name}`);
                if (itemLedgerEntries.length > 0) {
                    console.log(`📋 Ledger entries:`, itemLedgerEntries.map(e => ({
                        accountId: e.accountId,
                        accountName: e.accountName,
                        debit: e.debit,
                        credit: e.credit
                    })));
                } else if (shouldHaveEntries) {
                    console.warn(`⚠️ WARNING: Item should have opening stock ledger entries (${openingStock} × ${avgCost} = ${openingStock * avgCost}) but none found!`);
                    console.warn(`⚠️ This means the opening stock ledger entries were never created during import.`);
                }
                
                // First, try to find entries by transactionId in local state
                if (itemLedgerEntries.length > 0) {
                    console.log(`🗑️ Found ${itemLedgerEntries.length} opening stock ledger entries for item ${item.name}. Archiving transaction.`);
                    
                    // Update account balances BEFORE deleting ledger entries (so we have the data)
                    const finishedGoodsAccount = state.accounts.find(a => 
                        a.name.includes('Finished Goods') || a.name.includes('Inventory - Finished Goods')
                    );
                    const capitalAccount = state.accounts.find(a => 
                        a.name.includes('Capital') || a.name.includes('Opening Equity')
                    );
                    
                    const finishedGoodsEntry = itemLedgerEntries.find(e => 
                        finishedGoodsAccount && (e.accountId === finishedGoodsAccount.id || e.accountName?.includes('Finished Goods'))
                    );
                    const capitalEntry = itemLedgerEntries.find(e => 
                        capitalAccount && (e.accountId === capitalAccount.id || e.accountName?.includes('Capital'))
                    );
                    
                    // Archive the opening stock transaction (await to ensure it completes)
                    await deleteTransaction(openingStockTransactionId, `Item "${item.name}" deleted`, CURRENT_USER?.name || 'System');
                    console.log(`✅ Ledger entries deleted for item ${item.name}`);
                    
                    // Update account balances in Firebase
                    if (finishedGoodsAccount && finishedGoodsEntry) {
                        // For assets: removing debit increases balance, removing credit decreases balance
                        const balanceChange = finishedGoodsEntry.credit - finishedGoodsEntry.debit;
                        const newBalance = finishedGoodsAccount.balance + balanceChange;
                        
                        try {
                            await updateDoc(doc(db, 'accounts', finishedGoodsAccount.id), { balance: newBalance });
                            console.log(`✅ Updated Finished Goods account (${finishedGoodsAccount.id}) balance in Firebase: ${finishedGoodsAccount.balance} → ${newBalance}`);
                        } catch (error) {
                            console.error('❌ Error updating Finished Goods account:', error);
                        }
                    }
                    
                    if (capitalAccount && capitalEntry) {
                        // For equity: removing credit increases balance, removing debit decreases balance
                        const balanceChange = capitalEntry.debit - capitalEntry.credit;
                        const newBalance = capitalAccount.balance + balanceChange;
                        
                        try {
                            await updateDoc(doc(db, 'accounts', capitalAccount.id), { balance: newBalance });
                            console.log(`✅ Updated Capital account (${capitalAccount.id}) balance in Firebase: ${capitalAccount.balance} → ${newBalance}`);
                        } catch (error) {
                            console.error('❌ Error updating Capital account:', error);
                        }
                    }
                } else {
                    // Not found in local state - search Firebase by narration (transactionId might not match)
                    console.warn(`⚠️ No opening stock ledger entries found in local state for item ${item.name} (transactionId: ${openingStockTransactionId})`);
                    console.log(`📋 Item details:`, {
                        id: item.id,
                        name: item.name,
                        openingStock: item.openingStock,
                        avgCost: item.avgCost,
                        stockQty: item.stockQty
                    });
                    
                    console.log(`🔍 Searching Firebase for ledger entries by narration: "Opening Stock - ${item.name}"`);
                    try {
                        // Search by narration first (most reliable when transactionId doesn't match)
                        const itemNameQuery = query(
                            collection(db, 'ledger'),
                            where('narration', '==', `Opening Stock - ${item.name}`),
                            where('factoryId', '==', currentFactory?.id || '')
                        );
                        const itemNameSnapshot = await getDocs(itemNameQuery);
                        console.log(`📊 Found ${itemNameSnapshot.size} ledger entries with item name in narration`);
                        
                        if (itemNameSnapshot.size > 0) {
                            console.log(`✅ Using narration-based search to find and delete ledger entries`);
                            const entriesToDelete = itemNameSnapshot.docs;
                            const entries = entriesToDelete.map(doc => doc.data() as LedgerEntry);
                            
                            // Delete the entries
                            const deletePromises = entriesToDelete.map(docSnapshot => deleteDoc(docSnapshot.ref));
                            await Promise.all(deletePromises);
                            console.log(`✅ Deleted ${entriesToDelete.length} ledger entries directly from Firebase using narration`);
                            
                            // Update account balances
                            const finishedGoodsAccount = state.accounts.find(a => 
                                a.name.includes('Finished Goods') || a.name.includes('Inventory - Finished Goods')
                            );
                            const capitalAccount = state.accounts.find(a => 
                                a.name.includes('Capital') || a.name.includes('Opening Equity')
                            );
                            
                            if (finishedGoodsAccount) {
                                const finishedGoodsEntry = entries.find(e => 
                                    e.accountId === finishedGoodsAccount.id || 
                                    e.accountName?.includes('Finished Goods')
                                );
                                if (finishedGoodsEntry) {
                                    const balanceChange = finishedGoodsEntry.credit - finishedGoodsEntry.debit;
                                    const newBalance = finishedGoodsAccount.balance + balanceChange;
                                    await updateDoc(doc(db, 'accounts', finishedGoodsAccount.id), { balance: newBalance });
                                    console.log(`✅ Updated Finished Goods account (${finishedGoodsAccount.id}) balance: ${finishedGoodsAccount.balance} → ${newBalance}`);
                                }
                            }
                            
                            if (capitalAccount) {
                                const capitalEntry = entries.find(e => 
                                    e.accountId === capitalAccount.id || 
                                    e.accountName?.includes('Capital')
                                );
                                if (capitalEntry) {
                                    const balanceChange = capitalEntry.debit - capitalEntry.credit;
                                    const newBalance = capitalAccount.balance + balanceChange;
                                    await updateDoc(doc(db, 'accounts', capitalAccount.id), { balance: newBalance });
                                    console.log(`✅ Updated Capital account (${capitalAccount.id}) balance: ${capitalAccount.balance} → ${newBalance}`);
                                }
                            }
                        } else {
                            // Also try transactionId search as fallback
                            console.log(`🔍 Trying transactionId search as fallback: ${openingStockTransactionId}`);
                            const ledgerQuery = query(
                                collection(db, 'ledger'), 
                                where('transactionId', '==', openingStockTransactionId),
                                where('factoryId', '==', currentFactory?.id || '')
                            );
                            const ledgerSnapshot = await getDocs(ledgerQuery);
                            console.log(`📊 Found ${ledgerSnapshot.size} ledger entries in Firebase for this transaction`);
                            
                            if (ledgerSnapshot.size > 0) {
                                // Delete directly from Firebase
                                const deletePromises = ledgerSnapshot.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
                                await Promise.all(deletePromises);
                                console.log(`✅ Deleted ${ledgerSnapshot.size} ledger entries directly from Firebase`);
                                
                                // Update account balances
                                const entries = ledgerSnapshot.docs.map(doc => doc.data() as LedgerEntry);
                                const finishedGoodsAccount = state.accounts.find(a => 
                                    a.name.includes('Finished Goods') || a.name.includes('Inventory - Finished Goods')
                                );
                                const capitalAccount = state.accounts.find(a => 
                                    a.name.includes('Capital') || a.name.includes('Opening Equity')
                                );
                                
                                if (finishedGoodsAccount) {
                                    const finishedGoodsEntry = entries.find(e => 
                                        e.accountId === finishedGoodsAccount.id || 
                                        e.accountName?.includes('Finished Goods')
                                    );
                                    if (finishedGoodsEntry) {
                                        const balanceChange = finishedGoodsEntry.credit - finishedGoodsEntry.debit;
                                        const newBalance = finishedGoodsAccount.balance + balanceChange;
                                        await updateDoc(doc(db, 'accounts', finishedGoodsAccount.id), { balance: newBalance });
                                        console.log(`✅ Updated Finished Goods account (${finishedGoodsAccount.id}) balance: ${newBalance}`);
                                    }
                                }
                                
                                if (capitalAccount) {
                                    const capitalEntry = entries.find(e => 
                                        e.accountId === capitalAccount.id || 
                                        e.accountName?.includes('Capital')
                                    );
                                    if (capitalEntry) {
                                        const balanceChange = capitalEntry.debit - capitalEntry.credit;
                                        const newBalance = capitalAccount.balance + balanceChange;
                                        await updateDoc(doc(db, 'accounts', capitalAccount.id), { balance: newBalance });
                                        console.log(`✅ Updated Capital account (${capitalAccount.id}) balance: ${newBalance}`);
                                    }
                                }
                            } else {
                                // No entries found - check if item should have them and manually adjust
                                const openingStock = item.openingStock || item.stockQty || 0;
                                const avgCost = item.avgCost || 0;
                                const hasOpeningStock = openingStock > 0 && avgCost !== 0;
                                
                                if (hasOpeningStock) {
                                    const expectedValue = openingStock * avgCost;
                                    console.warn(`⚠️ Item has opening stock (${openingStock} × ${avgCost} = ${expectedValue}) but no ledger entries found!`);
                                    console.log(`💡 Manually adjusting account balances to reverse the opening stock value.`);
                                    
                                    // Manually adjust the account balances
                                    const finishedGoodsAccount = state.accounts.find(a => 
                                        a.name.includes('Finished Goods') || a.name.includes('Inventory - Finished Goods')
                                    );
                                    const capitalAccount = state.accounts.find(a => 
                                        a.name.includes('Capital') || a.name.includes('Opening Equity')
                                    );
                                    
                                    if (finishedGoodsAccount && capitalAccount) {
                                        const stockValue = openingStock * avgCost;
                                        const finishedGoodsChange = stockValue > 0 ? -stockValue : Math.abs(stockValue);
                                        const capitalChange = stockValue > 0 ? -stockValue : Math.abs(stockValue);
                                        
                                        const newFinishedGoodsBalance = finishedGoodsAccount.balance + finishedGoodsChange;
                                        const newCapitalBalance = capitalAccount.balance + capitalChange;
                                        
                                        try {
                                            await updateDoc(doc(db, 'accounts', finishedGoodsAccount.id), { balance: newFinishedGoodsBalance });
                                            console.log(`✅ Manually updated Finished Goods account (${finishedGoodsAccount.id}) balance: ${finishedGoodsAccount.balance} → ${newFinishedGoodsBalance}`);
                                            
                                            await updateDoc(doc(db, 'accounts', capitalAccount.id), { balance: newCapitalBalance });
                                            console.log(`✅ Manually updated Capital account (${capitalAccount.id}) balance: ${capitalAccount.balance} → ${newCapitalBalance}`);
                                        } catch (error) {
                                            console.error('❌ Error manually updating account balances:', error);
                                        }
                                    }
                                } else {
                                    console.log(`ℹ️ Item has no opening stock (openingStock: ${openingStock}, avgCost: ${avgCost}), so no ledger entries expected.`);
                                }
                            }
                        }
                    } catch (firebaseError) {
                        console.error('❌ Error searching Firebase for ledger entries:', firebaseError);
                    }
                }
            }
        }
        
        // If deleting a purchase, also delete its ledger entries and related records
        if (type === 'purchases') {
            const purchase = state.purchases.find(p => p.id === id);
            if (purchase) {
                // Delete ledger entries for regular purchases (PI-XXX)
                const transactionId = `PI-${purchase.batchNumber || id.toUpperCase()}`;
                console.log(`🗑️ Deleting ledger entries for transaction: ${transactionId}`);
                await deleteTransaction(transactionId, 'Purchase deleted', CURRENT_USER?.name || 'System');
                
                // Delete ledger entries for CSV-imported purchases (OB-PUR-XXX)
                const csvTransactionId = `OB-PUR-${purchase.id}`;
                console.log(`🗑️ Deleting CSV import ledger entries for transaction: ${csvTransactionId}`);
                await deleteTransaction(csvTransactionId, 'Purchase deleted', CURRENT_USER?.name || 'System');
                
                // Delete related LogisticsEntry records
                const relatedLogistics = state.logisticsEntries.filter(le => le.purchaseId === purchase.id);
                console.log(`🗑️ Deleting ${relatedLogistics.length} LogisticsEntry record(s) for purchase ${purchase.batchNumber}`);
                for (const logisticsEntry of relatedLogistics) {
                    try {
                        await deleteDoc(doc(db, 'logisticsEntries', logisticsEntry.id));
                        console.log(`✅ Deleted LogisticsEntry ${logisticsEntry.id}`);
                    } catch (error: any) {
                        console.error(`❌ Error deleting LogisticsEntry ${logisticsEntry.id}:`, error);
                    }
                }
            }
        }
        
        // If deleting a sales invoice, also delete its ledger entries and restore inventory/balances
        if (type === 'salesInvoices') {
            const invoice = state.salesInvoices.find(inv => inv.id === id);
            if (invoice) {
                const transactionId = `INV-${invoice.invoiceNo}`;
                console.log(`🗑️ Also deleting ledger entries for transaction: ${transactionId}`);
                await deleteTransaction(transactionId, 'Sales invoice deleted', CURRENT_USER?.name || 'System');
                
                // Restore item stock quantities (reverse the sale)
                if (invoice.status === 'Posted') {
                    invoice.items.forEach(soldItem => {
                        const itemRef = doc(db, 'items', soldItem.itemId);
                        const item = state.items.find(i => i.id === soldItem.itemId);
                        if (item) {
                            updateDoc(itemRef, { stockQty: item.stockQty + soldItem.qty })
                                .then(() => console.log(`✅ Restored stock for ${item.name}: +${soldItem.qty}`))
                                .catch((error) => console.error(`❌ Error restoring stock:`, error));
                        }
                    });
                    
                    // Restore customer balance (reverse AR)
                    const customerRef = doc(db, 'partners', invoice.customerId);
                    const customer = state.partners.find(p => p.id === invoice.customerId);
                    if (customer) {
                        updateDoc(customerRef, { balance: customer.balance - invoice.netTotal })
                            .then(() => console.log(`✅ Restored customer balance: -${invoice.netTotal}`))
                            .catch((error) => console.error(`❌ Error restoring customer balance:`, error));
                    }
                }
            }
        }
        
        // If deleting payment/receipt/expense/journal vouchers, delete their ledger entries
        if (type === 'paymentVouchers' || type === 'receiptVouchers' || type === 'expenseVouchers' || type === 'journalVouchers') {
            // Transaction ID format: PV-XXX, RV-XXX, EV-XXX, JV-XXX
            const prefix = type === 'paymentVouchers' ? 'PV' : 
                          type === 'receiptVouchers' ? 'RV' : 
                          type === 'expenseVouchers' ? 'EV' : 'JV';
            const transactionId = `${prefix}-${id}`;
            console.log(`🗑️ Also deleting ledger entries for transaction: ${transactionId}`);
            await deleteTransaction(transactionId, `${type} deleted`, CURRENT_USER?.name || 'System');
        }
        
        // Archive invoices and purchases instead of deleting them
        if (type === 'salesInvoices' || type === 'purchases') {
            const entity = type === 'salesInvoices' 
                ? state.salesInvoices.find((inv: any) => inv.id === id)
                : state.purchases.find((pur: any) => pur.id === id);
            
            if (entity) {
                // Archive the document
                const archiveData = {
                    ...entity,
                    archivedAt: serverTimestamp(),
                    archivedBy: CURRENT_USER?.name || 'System',
                    originalId: id,
                    originalType: type
                };
                
                addDoc(collection(db, 'archive'), archiveData)
                    .then(() => {
                        console.log(`📦 Archived ${type}/${id} to Firebase archive`);
                        // Then delete from original collection
                        deleteDoc(doc(db, type, id))
                            .then(() => {
                                console.log(`✅ Deleted ${type}/${id} from Firebase (archived)`);
                                dispatch({ type: 'DELETE_ENTITY', payload: { type, id } });
                                // Auto-refresh to update balances
                                console.log('🔄 Refreshing page to update Balance Sheet...');
                                setTimeout(() => window.location.reload(), 500);
                            })
                            .catch((error) => {
                                console.error(`❌ Error deleting ${type}/${id}:`, error);
                            });
                    })
                    .catch((error) => {
                        console.error(`❌ Error archiving ${type}/${id}:`, error);
                        // Still delete from state even if archive fails
                        dispatch({ type: 'DELETE_ENTITY', payload: { type, id } });
                    });
            } else {
                // Entity not found, just delete from state
                dispatch({ type: 'DELETE_ENTITY', payload: { type, id } });
            }
        } else {
            // For other entities, delete normally (no archive needed)
            dispatch({ type: 'DELETE_ENTITY', payload: { type, id } });
            // Delete from Firebase
            deleteDoc(doc(db, type, id))
                .then(() => {
                    console.log(`✅ Deleted ${type}/${id} from Firebase`);
                    // For items, reload to ensure balance sheet is updated
                    if (type === 'items') {
                        window.location.reload();
                    }
                })
                .catch((error) => {
                    console.error(`❌ Error deleting ${type}/${id}:`, error);
                });
        }
    };
    const updateStock = (itemId: string, qtyChange: number) => dispatch({ type: 'UPDATE_STOCK', payload: { itemId, qtyChange } });
    const addPlannerEntry = (entry: PlannerEntry) => dispatch({ type: 'ADD_PLANNER_ENTRY', payload: entry });
    const updatePlannerEntry = (entry: PlannerEntry) => dispatch({ type: 'UPDATE_PLANNER_ENTRY', payload: entry });
    const addGuaranteeCheque = (cheque: GuaranteeCheque) => dispatch({ type: 'ADD_GUARANTEE_CHEQUE', payload: cheque });
    const updateGuaranteeCheque = (cheque: GuaranteeCheque) => dispatch({ type: 'UPDATE_GUARANTEE_CHEQUE', payload: cheque });
    const addCustomsDocument = (doc: CustomsDocument) => dispatch({ type: 'ADD_CUSTOMS_DOCUMENT', payload: doc });

    // Cleanup orphaned ledger entries (entries whose purchase/invoice no longer exists)
    const cleanupOrphanedLedger = async () => {
        if (!currentFactory?.id) {
            alert('No factory selected');
            return;
        }
        
        const purchaseTransactions = state.purchases.map(p => `PI-${p.batchNumber || p.id.toUpperCase()}`);
        const invoiceTransactions = state.salesInvoices.map(inv => `INV-${inv.invoiceNo}`);
        const openingTransactions = state.originalOpenings.map(oo => `OO-${oo.id}`);
        const productionTransactions = state.productions.map(prod => `PROD-${prod.id}`);
        const validTransactions = [...purchaseTransactions, ...invoiceTransactions, ...openingTransactions, ...productionTransactions];
        
        console.log('Valid Transactions:', validTransactions);
        console.log('Opening Transactions:', openingTransactions);
        
        // Find orphaned entries in state (transactions with no corresponding source document)
        const orphanedInState = state.ledger.filter(e => 
            e.transactionId && 
            (e.transactionId.startsWith('PI-') || e.transactionId.startsWith('INV-') || 
             e.transactionId.startsWith('OO-') || e.transactionId.startsWith('PROD-')) &&
            !validTransactions.includes(e.transactionId)
        );
        
        console.log(`Found ${orphanedInState.length} orphaned ledger entries in state`);
        console.log('Orphaned transactions:', [...new Set(orphanedInState.map(e => e.transactionId))]);
        
        // ALSO find duplicate entries (each OO should have exactly 2 entries: 1 debit WIP, 1 credit Raw Mat)
        const transactionCounts: { [key: string]: number } = {};
        state.ledger.forEach(e => {
            if (e.transactionId && (e.transactionId.startsWith('PI-') || e.transactionId.startsWith('INV-') || 
                                    e.transactionId.startsWith('OO-') || e.transactionId.startsWith('PROD-'))) {
                transactionCounts[e.transactionId] = (transactionCounts[e.transactionId] || 0) + 1;
            }
        });
        
        const duplicates = Object.entries(transactionCounts).filter(([txId, count]) => {
            if (txId.startsWith('OO-')) return count !== 2; // OO should have exactly 2 entries
            if (txId.startsWith('PROD-')) return count > 4; // Production can have 3-4 entries
            return count > 3; // Others
        });
        console.log(`Found ${duplicates.length} transactions with incorrect entry count:`, duplicates);
        
        // Delete from Firebase
        const ledgerQuery = query(collection(db, 'ledger'), where('factoryId', '==', currentFactory.id));
        const snapshot = await getDocs(ledgerQuery);
        
        let deletedCount = 0;
        const deletePromises: Promise<void>[] = [];
        
        snapshot.docs.forEach(docSnapshot => {
            const entry = docSnapshot.data();
            const txId = entry.transactionId;
            
            // Delete orphaned entries (no matching source document)
            if (txId && (txId.startsWith('PI-') || txId.startsWith('INV-') || 
                        txId.startsWith('OO-') || txId.startsWith('PROD-')) && 
                !validTransactions.includes(txId)) {
                deletePromises.push(deleteDoc(docSnapshot.ref));
                deletedCount++;
                console.log(`Deleting orphaned entry for ${txId}`);
            }
        });
        
        await Promise.all(deletePromises);
        
        alert(`Cleanup complete!\nDeleted ${deletedCount} orphaned ledger entries from Firebase.\nPage will refresh automatically...`);
        console.log(`✅ Cleanup complete: deleted ${deletedCount} entries`);
        
        // Auto-refresh to reload clean data
        setTimeout(() => window.location.reload(), 1000);
    };

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
            updateItem,
            addAccount,
            updateAccount,
            addDivision,
            updateDivision,
            addSubDivision,
            updateSubDivision,
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
            deleteProduction,
            deleteProductionsForDate,
            postBaleOpening,
            addPurchase,
            updatePurchase,
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
            addCustomsDocument,
            cleanupOrphanedLedger
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
