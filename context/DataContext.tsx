
import React, { createContext, useContext, useReducer, useCallback, useEffect, useState, useRef } from 'react';
import { AppState, LedgerEntry, Partner, Account, Item, TransactionType, AccountType, PartnerType, Division, SubDivision, Logo, Warehouse, Employee, AttendanceRecord, Purchase, OriginalOpening, ProductionEntry, OriginalType, OriginalProduct, Category, Section, BundlePurchase, PackingType, LogisticsEntry, SalesInvoice, OngoingOrder, SalesInvoiceItem, ArchivedTransaction, Task, Enquiry, Vehicle, VehicleCharge, SalaryPayment, ChatMessage, PlannerEntry, PlannerEntityType, PlannerPeriodType, GuaranteeCheque, CustomsDocument, CurrencyRate, Currency } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_ITEMS, INITIAL_LEDGER, INITIAL_PARTNERS, EXCHANGE_RATES, INITIAL_ORIGINAL_TYPES, INITIAL_ORIGINAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_SECTIONS, INITIAL_DIVISIONS, INITIAL_SUB_DIVISIONS, INITIAL_LOGOS, INITIAL_PURCHASES, INITIAL_LOGISTICS_ENTRIES, INITIAL_SALES_INVOICES, INITIAL_WAREHOUSES, INITIAL_ONGOING_ORDERS, INITIAL_EMPLOYEES, INITIAL_TASKS, INITIAL_VEHICLES, INITIAL_CHAT_MESSAGES, CURRENT_USER, INITIAL_ORIGINAL_OPENINGS, INITIAL_PRODUCTIONS, INITIAL_PLANNERS, INITIAL_GUARANTEE_CHEQUES, INITIAL_CUSTOMS_DOCUMENTS, INITIAL_CURRENCIES } from '../constants';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { getAccountId } from '../services/accountMap';

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
                const debitSum = action.payload.filter(e => e.accountId === acc.id).reduce((sum, e) => sum + (e.debit || 0), 0);
                const creditSum = action.payload.filter(e => e.accountId === acc.id).reduce((sum, e) => sum + (e.credit || 0), 0);
                let newBalance = 0;
                if ([AccountType.ASSET, AccountType.EXPENSE].includes(acc.type)) {
                    newBalance = debitSum - creditSum;
                } else {
                    newBalance = creditSum - debitSum;
                }
                return { ...acc, balance: newBalance };
            });
            
            // Recalculate partner balances from ledger entries
            const updatedPartners = state.partners.map(partner => {
                const mappedAccountId = getAccountId(partner.id);
                const partnerDebitSum = action.payload.filter(e => e.accountId === mappedAccountId).reduce((sum, e) => sum + (e.debit || 0), 0);
                const partnerCreditSum = action.payload.filter(e => e.accountId === mappedAccountId).reduce((sum, e) => sum + (e.credit || 0), 0);
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
    postTransaction: (entries: Omit<LedgerEntry, 'id'>[]) => void;
    deleteTransaction: (transactionId: string, reason?: string, user?: string) => void;
    addPartner: (partner: Partner) => void;
    addItem: (item: Item, openingStock?: number, skipFirebase?: boolean) => void;
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
    updatePurchase: (purchase: Purchase) => void;
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


    const postTransaction = (entries: Omit<LedgerEntry, 'id'>[]) => {
        const entriesWithFactory = entries.map(entry => ({
            ...entry,
            factoryId: currentFactory?.id || ''
        }));
        
        // Save each ledger entry to Firebase
        if (isFirestoreLoaded) {
            entriesWithFactory.forEach(entry => {
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
                
                addDoc(collection(db, 'ledger'), entryData)
                    .then((docRef) => {
                        console.log('✅ Ledger entry saved to Firebase:', docRef.id);
                    })
                    .catch((error) => {
                        console.error('❌ Error saving ledger entry to Firebase:', error);
                    });
            });
        }
        
        dispatch({ type: 'POST_TRANSACTION', payload: { entries: entriesWithFactory } });
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
    
    const addPurchase = (purchase: Purchase) => {
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

        // Create journal entries
        const inventoryAccount = state.accounts.find(a => a.name.includes('Inventory - Raw Material'));
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
        postTransaction(entries);
    };
    const addBundlePurchase = (bundle: BundlePurchase) => {
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

        addDoc(collection(db, 'partners'), partnerDataForSave)
            .then((docRef) => {
                console.log('✅ Partner saved to Firebase:', docRef.id);
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
                                transactionId: `OB-${docRef.id}`,
                                transactionType: TransactionType.OPENING_BALANCE,
                                accountId: docRef.id,
                                accountName: partner.name,
                                debit: partner.balance,
                                credit: 0,
                                narration: `Opening Balance - ${partner.name}`,
                                factoryId: currentFactory?.id || ''
                            },
                            {
                                ...commonProps,
                                date,
                                transactionId: `OB-${docRef.id}`,
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
                                    transactionId: `OB-${docRef.id}`,
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
                                    transactionId: `OB-${docRef.id}`,
                                    transactionType: TransactionType.OPENING_BALANCE,
                                    accountId: docRef.id,
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
                                    transactionId: `OB-${docRef.id}`,
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
                                    transactionId: `OB-${docRef.id}`,
                                    transactionType: TransactionType.OPENING_BALANCE,
                                    accountId: docRef.id,
                                    accountName: partner.name,
                                    debit: absBalance,
                                    credit: 0,
                                    narration: `Opening Balance - ${partner.name}`,
                                    factoryId: currentFactory?.id || ''
                                }
                            ];
                        }
                    }
                    postTransaction(entries);
                }
            })
            .catch((error) => {
                console.error('❌ Error saving partner to Firebase:', error);
                alert('Failed to save partner: ' + error.message);
            });
    };
    const addItem = (item: Item, openingStock: number = 0, skipFirebase: boolean = false) => {
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
            // Use centralized account mapping
            const finishedGoodsId = getAccountId('105'); // Inventory - Finished Goods
            const capitalId = getAccountId('301'); // Capital
            
            // For positive stock value: Debit Inventory (asset increase), Credit Capital (equity increase)
            // For negative stock value: Credit Inventory (asset decrease), Debit Capital (equity decrease)
            const entries = [
                {
                    date,
                    transactionId: `OB-STK-${item.id}`,
                    transactionType: TransactionType.OPENING_BALANCE,
                    accountId: finishedGoodsId,
                    accountName: 'Inventory - Finished Goods',
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
                    accountName: 'Capital',
                    currency: 'USD',
                    exchangeRate: 1,
                    fcyAmount: Math.abs(stockValue),
                    debit: stockValue < 0 ? Math.abs(stockValue) : 0,
                    credit: stockValue > 0 ? stockValue : 0,
                    narration: `Opening Stock - ${item.name}`,
                    factoryId: currentFactory?.id || ''
                }
            ];
            postTransaction(entries);
        }
        const itemWithFactory = {
            ...item,
            factoryId: currentFactory?.id || ''
        };
        const nextSerial = openingStock + 1; const itemWithStock = { ...itemWithFactory, stockQty: openingStock, nextSerial: nextSerial }; 
        
        dispatch({ type: 'ADD_ITEM', payload: itemWithStock });
        
        // Save to Firebase (remove id field) - skip if already saved via batch
        if (!skipFirebase) {
            const { id: _, ...itemData } = itemWithStock;
            addDoc(collection(db, 'items'), { ...itemData, createdAt: serverTimestamp() })
                .then(() => console.log('✅ Item saved to Firebase'))
                .catch((error) => console.error('❌ Error saving item:', error));
        }
           // Do NOT post duplicate ledger entries for opening stock here
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

    const addOriginalOpening = (opening: OriginalOpening) => {
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
        const rawMaterialInvId = state.accounts.find(a => a.name.includes('Raw Material'))?.id;
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
            postTransaction(entries);
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
    const addProduction = (productions: ProductionEntry[]) => {
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
        
        // Save each production entry to Firebase
        productionsWithFactory.forEach(prod => {
            const { id, ...prodData } = prod;
            console.log('💾 Saving to Firebase:', prodData);
            
            // Remove undefined fields (Firebase doesn't allow undefined values)
            const cleanedData = Object.fromEntries(
                Object.entries(prodData).filter(([_, value]) => value !== undefined)
            );
            
            addDoc(collection(db, 'productions'), { ...cleanedData, createdAt: serverTimestamp() })
                .then(() => console.log('✅ Production entry saved to Firebase'))
                .catch((error) => console.error('❌ Error saving production:', error));
        });
        
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
                    postTransaction(entries);
                }
                
            } else if (wipId) {
                // NORMAL PRODUCTION ACCOUNTING: WIP to FG
                productionsWithFactory.forEach(prod => {
                    const item = state.items.find(i => i.id === prod.itemId);
                    if (!item) {
                        console.log('❌ Item not found for production:', prod.itemId);
                        return;
                    }
                    
                    console.log('📦 Item found:', item.name, 'avgCost:', item.avgCost);
                    
                    // Calculate values using avgCost (can be negative for waste/garbage items)
                    const finishedGoodsValue = prod.qtyProduced * (item.avgCost || 0);
                    const totalKg = prod.weightProduced;
                    const wipCostPerKg = 1; // This should ideally come from the actual WIP cost tracking
                    const wipValueConsumed = totalKg * wipCostPerKg;
                    const productionGain = finishedGoodsValue - wipValueConsumed;
                    
                    console.log('💰 Calculations:', {
                        finishedGoodsValue,
                        totalKg,
                        wipValueConsumed,
                        productionGain
                    });
                    
                    const transactionId = `PROD-${prod.id}`;
                    const entries: Omit<LedgerEntry, 'id'>[] = [
                        // Finished Goods entry (debit if positive, credit if negative value like garbage)
                        {
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
                        },
                        // Credit WIP (reduce work in progress)
                        {
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
                        }
                    ];
                    
                    // If there's a production gain, credit Production Gain account
                    if (productionGain !== 0 && productionGainId) {
                        entries.push({
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
                    
                    postTransaction(entries);
                });
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
        
        // Apply updates to Firebase
        itemStockUpdates.forEach(({ stockQtyDelta, maxSerialEnd }, itemId) => {
            const item = state.items.find(i => i.id === itemId);
            if (item) {
                const updates: any = {
                    stockQty: item.stockQty + stockQtyDelta
                };
                
                if (maxSerialEnd > 0 && item.packingType !== PackingType.KG) {
                    updates.nextSerial = maxSerialEnd + 1;
                }
                
                updateDoc(doc(db, 'items', itemId), updates)
                    .then(() => console.log(`✅ Updated stock for item ${itemId}: stockQty +${stockQtyDelta} = ${updates.stockQty}`))
                    .catch((error) => console.error(`❌ Error updating item ${itemId}:`, error));
            }
        });
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

    const postBaleOpening = (stagedItems: { itemId: string, qty: number, date: string }[]) => {
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
        dispatch({ type: 'ADD_PRODUCTION', payload: productionEntries }); postTransaction(journalEntries);
    };
    const saveLogisticsEntry = (entry: LogisticsEntry) => {
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
        addDoc(collection(db, 'logisticsEntries'), { ...entryData, purchaseId, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Logistics entry saved to Firebase'))
            .catch((error) => console.error('❌ Error saving logistics entry:', error));
    };
    const addSalesInvoice = (invoice: SalesInvoice) => {
        if (!isFirestoreLoaded) {
            console.warn('⚠️ Firebase not loaded, sales invoice not saved to database');
            return;
        }
        
        const invoiceWithFactory = {
            ...invoice,
            factoryId: currentFactory?.id || ''
        };
        
        // Save to Firebase
        const { id, ...invoiceData } = invoiceWithFactory;
        addDoc(collection(db, 'salesInvoices'), { ...invoiceData, createdAt: serverTimestamp() })
            .then(() => console.log('✅ Sales invoice saved to Firebase'))
            .catch((error) => console.error('❌ Error saving sales invoice:', error));
    };
    const updateSalesInvoice = (invoice: SalesInvoice) => dispatch({ type: 'UPDATE_SALES_INVOICE', payload: invoice });
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
        
        const revenueAccount = state.accounts.find(a => a.name.includes('Sales Revenue'));
        const discountAccount = state.accounts.find(a => a.name.includes('Discount'));
        const cogsAccount = state.accounts.find(a => a.name.includes('Cost of Goods Sold'));
        const finishedGoodsAccount = state.accounts.find(a => a.name.includes('Inventory - Finished Goods'));
        const customerName = state.partners.find(p => p.id === invoice.customerId)?.name || 'Unknown Customer';
        
        const revenueId = revenueAccount?.id || '401';
        const discountId = discountAccount?.id || '501';
        const cogsId = cogsAccount?.id || '5000';
        const finishedGoodsId = finishedGoodsAccount?.id || '1202';
        
        // Debit the CUSTOMER's account directly (not general AR) - Sales are in USD, but store with customer's currency for display
        const customerCurrency = (invoice as any).customerCurrency || invoice.currency || 'USD';
        const customerRate = (invoice as any).customerExchangeRate || invoice.exchangeRate || 1;
        const fcyAmountForCustomer = invoice.netTotal * customerRate; // Convert USD to customer's currency using invoice's saved rate
        const entries: Omit<LedgerEntry, 'id'>[] = [ { date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: invoice.customerId, accountName: customerName, currency: customerCurrency, exchangeRate: customerRate, fcyAmount: fcyAmountForCustomer, debit: invoice.netTotal, credit: 0, narration: `Sales Invoice: ${invoice.invoiceNo}`, factoryId: invoice.factoryId } ];
        const totalItemsRevenueUSD = invoice.items.reduce((sum, item) => sum + item.total, 0);
        entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: revenueId, accountName: 'Sales Revenue', currency: 'USD', exchangeRate: 1, fcyAmount: totalItemsRevenueUSD, debit: 0, credit: totalItemsRevenueUSD, narration: `Revenue: ${invoice.invoiceNo}`, factoryId: invoice.factoryId });
        if (invoice.surcharge > 0) { entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: revenueId, accountName: 'Sales Revenue (Surcharge)', currency: 'USD', exchangeRate: 1, fcyAmount: invoice.surcharge, debit: 0, credit: invoice.surcharge, narration: `Surcharge: ${invoice.invoiceNo}`, factoryId: invoice.factoryId }); }
        if (invoice.discount > 0) { entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: discountId, accountName: 'Sales Discount', currency: 'USD', exchangeRate: 1, fcyAmount: invoice.discount, debit: invoice.discount, credit: 0, narration: `Discount: ${invoice.invoiceNo}`, factoryId: invoice.factoryId }); }
        
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
            entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: cogsId, accountName: 'Cost of Goods Sold', currency: 'USD', exchangeRate: 1, fcyAmount: totalCOGS, debit: totalCOGS, credit: 0, narration: `COGS: ${invoice.invoiceNo}`, factoryId: invoice.factoryId });
            // Credit Finished Goods Inventory (Asset decreases)
            entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: finishedGoodsId, accountName: 'Inventory - Finished Goods', currency: 'USD', exchangeRate: 1, fcyAmount: totalCOGS, debit: 0, credit: totalCOGS, narration: `Inventory Reduction: ${invoice.invoiceNo}`, factoryId: invoice.factoryId });
        }
        
        invoice.additionalCosts.forEach(cost => { 
            const amountUSD = cost.amount / cost.exchangeRate; 
            const providerName = state.partners.find(p => p.id === cost.providerId)?.name || 'Unknown Provider';
            // Credit the PROVIDER's account directly
            entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: cost.providerId, accountName: providerName, currency: cost.currency, exchangeRate: cost.exchangeRate, fcyAmount: cost.amount, debit: 0, credit: amountUSD, narration: `${cost.costType} Payable: ${invoice.invoiceNo}`, factoryId: invoice.factoryId }); 
        });
        postTransaction(entries);
    };
    const addDirectSale = (invoice: SalesInvoice, batchLandedCostPerKg: number) => {
        dispatch({ type: 'ADD_SALES_INVOICE', payload: invoice });
        // Save Direct Sale to Firestore (same as addSalesInvoice)
        if (isFirestoreLoaded) {
            const invoiceWithFactory = {
                ...invoice,
                factoryId: currentFactory?.id || ''
            };
            const { id, ...invoiceData } = invoiceWithFactory;
            addDoc(collection(db, 'salesInvoices'), { ...invoiceData, createdAt: serverTimestamp() })
                .then(() => console.log('✅ Direct Sale saved to Firebase'))
                .catch((error) => console.error('❌ Error saving direct sale:', error));
        }
        const transactionId = `DS-${invoice.invoiceNo}`;
        const revenueAccount = state.accounts.find(a => a.name.includes('Sales Revenue'));
        const cogsAccount = state.accounts.find(a => a.name.includes('Cost of Goods Sold - Direct Sales'));
        const inventoryAccount = state.accounts.find(a => a.name.includes('Inventory - Raw Material'));
        const customerName = state.partners.find(p => p.id === invoice.customerId)?.name || 'Unknown Customer';
        
        const revenueId = revenueAccount?.id || '401';
        const cogsId = cogsAccount?.id || '503';
        const rawMatInventoryId = inventoryAccount?.id || '104';
        
        // Debit the CUSTOMER's account directly (not general AR) - Sales are in USD, store with customer's currency for display
        const customerCurrency = (invoice as any).customerCurrency || 'USD';
        const customerRate = (invoice as any).customerExchangeRate || 1;
        const fcyAmountForCustomer = invoice.netTotal * customerRate; // Convert USD to customer's currency
        const entries: Omit<LedgerEntry, 'id'>[] = [
            { date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: invoice.customerId, accountName: customerName, currency: customerCurrency, exchangeRate: customerRate, fcyAmount: fcyAmountForCustomer, debit: invoice.netTotal, credit: 0, narration: `Direct Sale: ${invoice.invoiceNo}`, factoryId: invoice.factoryId },
            { date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: revenueId, accountName: 'Sales Revenue', currency: 'USD', exchangeRate: 1, fcyAmount: invoice.netTotal, debit: 0, credit: invoice.netTotal, narration: `Direct Sale Revenue: ${invoice.invoiceNo}`, factoryId: invoice.factoryId }
        ];
        const totalSoldKg = invoice.items.reduce((sum, i) => sum + i.totalKg, 0);
        const totalCostUSD = totalSoldKg * batchLandedCostPerKg;
        entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: cogsId, accountName: 'COGS - Direct Sales', currency: 'USD', exchangeRate: 1, fcyAmount: totalCostUSD, debit: totalCostUSD, credit: 0, narration: `Cost of Direct Sale: ${invoice.invoiceNo} (${totalSoldKg}kg)`, factoryId: invoice.factoryId });
        entries.push({ date: invoice.date, transactionId, transactionType: TransactionType.SALES_INVOICE, accountId: rawMatInventoryId, accountName: 'Inventory - Raw Materials', currency: 'USD', exchangeRate: 1, fcyAmount: totalCostUSD, debit: 0, credit: totalCostUSD, narration: `Inventory Consumption: Direct Sale ${invoice.invoiceNo}`, factoryId: invoice.factoryId });
        postTransaction(entries);
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
    const processPayroll = (payment: SalaryPayment, sourceAccountId: string) => {
        dispatch({ type: 'PROCESS_PAYROLL', payload: payment });
        const salaryExpenseId = state.accounts.find(a => a.name.includes('Salaries'))?.id || '504';
        const entries: Omit<LedgerEntry, 'id'>[] = [
            { date: payment.paymentDate, transactionId: payment.voucherId, transactionType: TransactionType.PAYMENT_VOUCHER, accountId: salaryExpenseId, accountName: 'Salaries & Wages', currency: 'USD', exchangeRate: 1, fcyAmount: payment.netPaid, debit: payment.netPaid, credit: 0, narration: `Payroll ${payment.monthYear}: ${state.employees.find(e => e.id === payment.employeeId)?.name}`, factoryId: payment.factoryId },
            { date: payment.paymentDate, transactionId: payment.voucherId, transactionType: TransactionType.PAYMENT_VOUCHER, accountId: sourceAccountId, accountName: 'Cash/Bank', currency: 'USD', exchangeRate: 1, fcyAmount: payment.netPaid, debit: 0, credit: payment.netPaid, narration: `Payroll ${payment.monthYear}: ${state.employees.find(e => e.id === payment.employeeId)?.name}`, factoryId: payment.factoryId }
        ];
        postTransaction(entries);
    };
    const addVehicleFine = (vehicleId: string, type: string, amount: number, employeeId: string) => {
        const vehicle = state.vehicles.find(v => v.id === vehicleId); const employee = state.employees.find(e => e.id === employeeId); if (!vehicle || !employee) return;
        const charge: VehicleCharge = { id: generateId(), vehicleId, employeeId, date: new Date().toISOString().split('T')[0], type, amount, journalEntryId: `JV-VF-${generateId()}` }; dispatch({ type: 'ADD_VEHICLE_CHARGE', payload: charge });
        const salaryExpenseId = state.accounts.find(a => a.name.includes('Vehicle Expenses'))?.id || '505'; const otherIncomeId = '401'; 
        const entries: Omit<LedgerEntry, 'id'>[] = [
            { date: charge.date, transactionId: charge.journalEntryId, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: salaryExpenseId, accountName: 'Vehicle Expenses', currency: 'USD', exchangeRate: 1, fcyAmount: amount, debit: amount, credit: 0, narration: `Fine: ${type} - ${vehicle.plateNumber}`, factoryId: currentFactory?.id || '' },
            { date: charge.date, transactionId: charge.journalEntryId, transactionType: TransactionType.JOURNAL_VOUCHER, accountId: otherIncomeId, accountName: 'Other Income / Recoverable', currency: 'USD', exchangeRate: 1, fcyAmount: amount, debit: 0, credit: amount, narration: `Fine Recovery from ${employee.name}`, factoryId: currentFactory?.id || '' }
        ];
        postTransaction(entries);
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
        
        // If deleting a purchase, also delete its ledger entries
        if (type === 'purchases') {
            const purchase = state.purchases.find(p => p.id === id);
            if (purchase) {
                const transactionId = `PI-${purchase.batchNumber || id.toUpperCase()}`;
                console.log(`🗑️ Also deleting ledger entries for transaction: ${transactionId}`);
                deleteTransaction(transactionId, 'Purchase deleted', CURRENT_USER?.name || 'System');
            }
        }
        
        // If deleting a sales invoice, also delete its ledger entries and restore inventory/balances
        if (type === 'salesInvoices') {
            const invoice = state.salesInvoices.find(inv => inv.id === id);
            if (invoice) {
                const transactionId = `INV-${invoice.invoiceNo}`;
                console.log(`🗑️ Also deleting ledger entries for transaction: ${transactionId}`);
                deleteTransaction(transactionId, 'Sales invoice deleted', CURRENT_USER?.name || 'System');
                
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
            deleteTransaction(transactionId, `${type} deleted`, CURRENT_USER?.name || 'System');
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
            deleteProduction,
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
