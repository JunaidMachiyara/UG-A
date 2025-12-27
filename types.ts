
// Enums
export enum PartnerType {
    CUSTOMER = 'CUSTOMER',
    SUPPLIER = 'SUPPLIER',
    SUB_SUPPLIER = 'SUB SUPPLIER',
    VENDOR = 'VENDOR',
    CLEARING_AGENT = 'CLEARING AGENT',
    FREIGHT_FORWARDER = 'FREIGHT FORWARDER',
    COMMISSION_AGENT = 'COMMISSION AGENT'
}

export enum AccountType {
    ASSET = 'ASSET',
    LIABILITY = 'LIABILITY',
    EQUITY = 'EQUITY',
    REVENUE = 'REVENUE',
    EXPENSE = 'EXPENSE'
}

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    FACTORY_ADMIN = 'FACTORY_ADMIN',
    MODULE_USER = 'MODULE_USER',
    DATA_ENTRY_INVENTORY = 'DATA_ENTRY_INVENTORY',
    DATA_ENTRY_ACCOUNTING = 'DATA_ENTRY_ACCOUNTING'
}

export enum PermissionModule {
    DASHBOARD = 'DASHBOARD',
    DATA_ENTRY = 'DATA_ENTRY',
    SALES = 'SALES',
    PURCHASES = 'PURCHASES',
    PRODUCTION = 'PRODUCTION',
    ACCOUNTING = 'ACCOUNTING',
    LOGISTICS = 'LOGISTICS',
    HR = 'HR',
    REPORTS = 'REPORTS',
    CUSTOMS = 'CUSTOMS',
    SETUP = 'SETUP',
    ADMIN = 'ADMIN',
    POSTING = 'POSTING',
    OFFLOADING = 'OFFLOADING',
    CHAT = 'CHAT'
}

export enum TransactionType {
    SALES_INVOICE = 'SI',
    PURCHASE_INVOICE = 'PI',
    RECEIPT_VOUCHER = 'RV',
    PAYMENT_VOUCHER = 'PV',
    EXPENSE_VOUCHER = 'EV',
    INTERNAL_TRANSFER = 'TR',
    JOURNAL_VOUCHER = 'JV',
    PURCHASE_BILL = 'PB', // New: General Purchase / Bill Entry
    PRODUCTION = 'PROD',
    OPENING_BALANCE = 'OB',
    ORIGINAL_OPENING = 'OO',
    INVENTORY_ADJUSTMENT = 'IA', // Inventory adjustments/corrections
    RETURN_TO_SUPPLIER = 'RTS', // Returns to suppliers
    WRITE_OFF = 'WO', // Write-offs
    BALANCING_DISCREPANCY = 'BD' // Balancing discrepancies
}

export enum PackingType {
    BALE = 'Bale',
    SACK = 'Sack',
    KG = 'Kg',
    BOX = 'Box',
    BAG = 'Bag'
}

export type Currency = string; // Dynamic currency codes (USD, EUR, GBP, AED, SAR, etc.)

// Currency Management
export interface CurrencyRate {
    id: string;
    code: string; // Currency code (USD, EUR, GBP, etc.)
    name: string; // Full name (US Dollar, Euro, etc.)
    symbol: string; // Currency symbol ($, €, £, etc.)
    exchangeRate: number; // Exchange rate to base currency (1 USD = X FCY)
    isBaseCurrency: boolean; // True for USD (base currency)
    factoryId: string; // Factory assignment
}

// Factory & User Management Interfaces
export interface Factory {
    id: string;
    name: string; // MAAZ, TALHA, AL ANWAR
    code: string; // Short code (MAZ, TLH, ANW)
    location: string;
    isActive: boolean;
    createdDate: string;
}

export interface User {
    id: string;
    username: string; // Login ID (no email)
    password: string; // Hashed (Firebase Auth will handle this)
    displayName: string;
    role: UserRole;
    factoryId: string; // Which factory user belongs to
    allowedModules?: PermissionModule[]; // For MODULE_USER - which modules they can access
    isActive: boolean;
    createdDate: string;
    lastLogin?: string;
}

export interface Permission {
    module: PermissionModule;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

// Interfaces for Inventory Classification
export interface OriginalType {
    id: string;
    name: string; // e.g., "KSA Mix"
    packingType: PackingType; // e.g., Bale
    packingSize: number; // e.g., 45kg
}

export interface OriginalProduct {
    id: string;
    originalTypeId: string; // Parent Link
    name: string; // e.g., "Mixed Rags"
}

export interface Category {
    id: string;
    name: string; // e.g., "Men's Wear"
}

export interface Section {
    id: string;
    name: string; // e.g., "Sorting Line A"
}

export interface Account {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    balance: number; // In USD (Base Currency)
    currency?: Currency; // For Bank/Cash accounts in foreign currency
    factoryId: string; // Factory assignment
}

export interface Partner {
    id: string;
    code?: string; // User-created partner code/identifier
    name: string;
    type: PartnerType;
    balance: number; // In USD
    defaultCurrency: Currency;
    contact: string;
    country: string;
    email?: string;
    phone?: string;
    
    // Factory Assignment
    factoryId: string;
    
    // Structure Fields
    divisionId?: string;
    subDivisionId?: string;

    // Type Specific Fields
    creditLimit?: number;       // Customer
    taxId?: string;             // Supplier/Vendor
    commissionRate?: number;    // Commission Agent
    parentSupplier?: string;    // Sub Supplier
    licenseNumber?: string;     // Clearing Agent
    scacCode?: string;          // Freight Forwarder
}

export interface Item {
    id: string;
    code: string;
    name: string;
    category: string; // Should link to Category ID or Name
    section?: string; // Should link to Section ID or Name
    packingType: PackingType;
    avgCost: number; // Production cost per unit (can be negative for waste/garbage)
    stockQty: number; // In Units (Bales/Sacks) or Kg depending on packing
    weightPerUnit: number; // Approx Kg per unit
    salePrice?: number; // USD
    nextSerial?: number; // Auto-increment for Bales/Sacks/Boxes/Bags. (Opening Stock + 1)
    factoryId: string; // Factory assignment
}

export interface Division {
    id: string; // Firebase document ID (auto-generated)
    code: string; // Business code (user-assignable, e.g., DIV-001)
    name: string;
    location: string;
    factoryId: string;
}

export interface SubDivision {
    id: string; // Firebase document ID (auto-generated)
    code: string; // Business code (user-assignable, e.g., SUBDIV-001)
    divisionId: string; // References Division code (not Firebase ID)
    name: string;
    factoryId: string;
}

export interface Logo {
    id: string;
    name: string; // e.g. "Usman Global", "UG Trading"
}

export interface Warehouse {
    id: string;
    name: string;
    location?: string;
}

export interface Employee {
    id: string;
    name: string;
    designation: string;
    status: 'Active' | 'Inactive' | 'Terminated';
    onDuty: 'Yes' | 'No';
    factoryId: string; // Factory assignment
    offDutyReason?: string;
    offDutyStart?: string;
    offDutyEnd?: string;
    
    // Personal
    dob?: string;
    nationality?: string;
    address?: string;
    phone?: string;
    email?: string;
    
    // Visa / Legal
    companyVisa: 'Yes' | 'No';
    passportNumber: string;
    passportExpiry?: string;
    visaStatus?: string;
    visaExpiry?: string;
    visaDate?: string; // Issue Date
    visaRenewalDate?: string; // Auto-calculated
    
    // Financial
    bankName?: string;
    accountNumber?: string;
    iban?: string;
    basicSalary: number; // USD
    salaryIncrementDate?: string;
    advancesBalance: number; // Updated via vouchers
    openingBalance?: number;
    
    joinDate?: string;
    reference?: string;
    complaints?: string;
}

export interface AttendanceRecord {
    id: string;
    employeeId: string;
    date: string; // YYYY-MM-DD
    status: 'P' | 'A' | 'L' | 'HD' | 'PL' | 'SL' | 'H'; // Present, Absent, Late, Half Day, Paid Leave, Sick Leave, Holiday
    remarks?: string;
}

export interface SalaryPayment {
    id: string;
    employeeId: string;
    paymentDate: string;
    monthYear: string; // e.g., "09-2025"
    basicSalary: number;
    payableDays: number;
    deductions: number;
    advancesDeducted: number;
    netPaid: number;
    paymentMethod: 'Cash' | 'Bank';
    voucherId: string; // Link to PV
    factoryId: string; // Factory assignment
}

export interface Task {
    id: string;
    description: string;
    createdDate: string;
    isDone: boolean;
    comments?: string;
    status: 'Pending' | 'Acknowledged' | 'Completed';
}

export interface Enquiry {
    id: string;
    description: string; // e.g., Loan Request
    employeeId?: string; // Optional link
    requestDate: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    adminComments?: string;
}

export interface Vehicle {
    id: string;
    plateNumber: string;
    model: string;
    registrationExpiry: string;
    insuranceExpiry: string;
    assignedToEmployeeId?: string;
    status: 'Active' | 'Maintenance' | 'Sold';
}

export interface VehicleCharge {
    id: string;
    vehicleId: string;
    employeeId: string; // Who was driving/assigned
    date: string;
    type: string; // e.g. "Speeding Fine"
    amount: number;
    journalEntryId: string;
}

export interface LedgerEntry {
    id: string;
    date: string; // ISO Date
    transactionId: string;
    transactionType: TransactionType;
    accountId: string;
    accountName: string; // Denormalized for ease
    factoryId: string; // Factory assignment
    
    // Multi-Currency Fields
    currency: Currency;
    exchangeRate: number; // 1 USD = X FCY
    fcyAmount: number; // Foreign Currency Amount
    
    // Base Currency (USD) for Balancing
    debit: number; 
    credit: number;
    
    narration: string;
    
    // System flags
    isAdjustment?: boolean; // True for system-generated balance adjustment entries
}

export interface PurchaseAdditionalCost {
    id: string;
    costType: 'Freight' | 'Clearing' | 'Commission' | 'Other';
    providerId: string; // ID of the partner (Agent or Supplier)
    currency: Currency;
    exchangeRate: number;
    amountFCY: number;
    amountUSD: number; // Calculated Base Amount
}

export interface BundlePurchaseItem {
    id: string; // unique id for list key
    itemId: string;
    qty: number;
    rateFCY: number;
    totalFCY: number;
    totalUSD: number;
}

export interface BundlePurchase {
    id: string;
    batchNumber: string;
    date: string;
    supplierId: string;
    containerNumber?: string;
    divisionId?: string;
    subDivisionId?: string;
    factoryId: string; // Factory assignment
    currency: Currency;
    exchangeRate: number;
    items: BundlePurchaseItem[];
    additionalCosts: PurchaseAdditionalCost[];
    totalAmountFCY: number;
    totalAmountUSD: number;
}

// Multi-Original Type Support for Purchase
export interface PurchaseOriginalItem {
    id: string;
    originalTypeId: string; // ID of OriginalType
    originalType: string; // Display Name
    originalProductId?: string; // ID of OriginalProduct
    subSupplierId?: string; // ID of Sub Supplier
    weightPurchased: number; // Kg for this specific original type
    qtyPurchased: number; // Units (calculated based on packing size)
    costPerKgFCY: number; // Price per Kg in Foreign Currency
    discountPerKgFCY?: number;
    surchargePerKgFCY?: number;
    totalCostFCY: number; // Net cost for this original type in FCY
    totalCostUSD: number; // Converted to USD
}

export interface Purchase {
    id: string;
    batchNumber: string; // NEW: Editable, Auto-Populated
    status: 'In Transit' | 'Arrived' | 'Cleared'; // NEW: Logistics Status
    
    date: string;
    supplierId: string; // Legacy: for backward compatibility
    mainSupplierId?: string; // Main supplier for composite purchase
    subSuppliers?: string[]; // Array of sub-supplier IDs
    isComposite?: boolean; // Flag to indicate composite purchase
    compositeMap?: { subSupplierId: string; item: PurchaseOriginalItem }[]; // Optional mapping
    factoryId: string; // Factory assignment
    
    // Legacy fields (kept for backward compatibility, but use items[] for multi-type)
    originalTypeId: string; // ID of first item (for backward compatibility)
    originalType: string; // Display Name of first item
    originalProductId?: string; // ID of OriginalProduct of first item
    
    // NEW: Multi-Original Type Support
    items: PurchaseOriginalItem[]; // Array of original types in this container
    
    // Logistics & Destination
    containerNumber?: string;
    divisionId?: string;
    subDivisionId?: string;
    
    qtyPurchased: number; // Total Units across all items
    weightPurchased: number; // Total Kg across all items
    
    // Material Cost
    currency: Currency;
    exchangeRate: number;
    
    // Legacy pricing (kept for backward compatibility - sum of all items)
    costPerKgFCY: number; // Average price
    discountPerKgFCY?: number;
    surchargePerKgFCY?: number;
    
    totalCostFCY: number; // Net Total Material Cost (sum of all items)
    
    // Landed Cost Components
    additionalCosts: PurchaseAdditionalCost[];
    
    // Final Landed Cost (Material USD + Additional Costs USD)
    totalLandedCost: number; 
    landedCostPerKg: number;
}

export interface OriginalOpening {
    id: string;
    date: string;
    supplierId: string; // or 'INTERNAL' for Bales Opening
    originalType: string; // Stores originalTypeId (e.g., "OT-001"), not the name!
    originalProductId?: string; // Optional original product ID
    batchNumber?: string; // Optional batch tracking
    qtyOpened: number;
    weightOpened: number; // Kg
    costPerKg: number; // USD
    totalValue: number; // USD
}

export interface ProductionEntry {
    id: string;
    date: string;
    itemId: string;
    itemName: string;
    packingType: PackingType;
    factoryId: string; // Factory assignment
    qtyProduced: number; // Units
    weightProduced: number; // Total Kg
    serialStart?: number; // Was baleStart. Start of the sequence for this batch
    serialEnd?: number;   // Was baleEnd. End of the sequence for this batch
    isRebaling?: boolean; // Flag to distinguish re-baling from actual production
    productionPrice?: number; // Production price per unit (from CSV or avgProdPrice from form)
}

export interface InvoiceItem {
    itemId: string;
    qty: number;
    rate: number;
    total: number;
}

export interface ProductionBatch {
    id: string;
    date: string;
    inputRawMaterialId: string; // Linking to original purchase
    inputQty: number; // Kg consumed
    outputItems: { itemId: string; qty: number; grade: string }[];
    totalCost: number; // Allocated cost
}

export interface LogisticsEntry {
    id: string;
    purchaseId: string; // Links to Purchase or BundlePurchase
    purchaseType: 'ORIGINAL' | 'BUNDLE';
    containerNumber: string;
    status: 'In Transit' | 'Arrived' | 'Cleared';
    
    // Dates
    etd?: string; // Estimated Time Departure
    eta?: string; // Estimated Time Arrival
    portStorage?: string;
    doValidation?: string; // D/o VLD
    groundDate?: string;
    arrivalDate?: string; // Unload Date
    
    // Locations
    warehouseId?: string;
    
    // Weights
    invoicedWeight: number;
    receivedWeight: number;
    shortageKg: number; // Invoiced - Received
    
    // Documentation & Clearing
    documentStatus?: 'Pending' | 'Submitted' | 'Received';
    freightForwarderId?: string;
    clearingAgentId?: string;
    clearingBillNo?: string;
    clearingAmount?: number;

    // Only for Bundle Purchases
    tallyItems?: { itemId: string; qty: number; weight: number }[];
}

// --- Sales Invoice Interfaces ---

export interface SalesInvoiceItem {
    id: string;
    itemId: string;
    itemName: string;
    qty: number; // Units
    rate: number; // Per Unit
    total: number;
    totalKg: number;
    
    // Per-row currency override (Optional, defaults to Invoice Currency)
    currency?: Currency;
    exchangeRate?: number;
    
    // For Direct Sales: Link back to the original raw material batch
    originalPurchaseId?: string;
    
    // For Ongoing Orders: Link back to the order ID
    sourceOrderId?: string;
}

export interface InvoiceAdditionalCost {
    id: string;
    costType: 'Freight' | 'Clearing' | 'Commission' | 'Customs' | 'Other';
    providerId?: string; // Optional for customs
    customName?: string; // Custom name when costType is 'Customs' or 'Other'
    amount: number;
    currency: Currency;
    exchangeRate: number; // To Invoice Currency
}

export interface SalesInvoice {
    id: string;
    invoiceNo: string;
    date: string;
    status: 'Unposted' | 'Posted';
    
    customerId: string;
    factoryId: string; // Factory assignment
    logoId: string;
    packingColor?: string;
    
    // Logistics
    containerNumber?: string;
    divisionId?: string;
    subDivisionId?: string;
    portOfDestinationId?: string; // Port of destination
    
    // Financials
    currency: Currency; // Invoice Currency (always USD for accounting)
    exchangeRate: number; // Base to Invoice (always 1 for USD)
    
    // Customer's currency for ledger display (optional for direct sales)
    customerCurrency?: Currency;
    customerExchangeRate?: number;
    
    discount: number;
    surcharge: number;
    
    items: SalesInvoiceItem[];
    additionalCosts: InvoiceAdditionalCost[];
    
    grossTotal: number;
    netTotal: number;
}

// --- Ongoing Orders ---
export type OngoingOrderStatus = 'Active' | 'PartiallyShipped' | 'Completed' | 'Cancelled';

export interface OngoingOrderItem {
    itemId: string;
    quantity: number; // Total ordered
    shippedQuantity: number; // Total shipped so far
}

export interface OngoingOrder {
    id: string;
    orderNo: string; // e.g. OO-1001
    date: string;
    customerId: string;
    status: OngoingOrderStatus;
    items: OngoingOrderItem[];
}

// --- Archive Interface ---
export interface ArchivedTransaction {
    id: string; // Archive ID
    originalTransactionId: string;
    deletedAt: string;
    deletedBy: string; // PIN or User
    reason: string; // 'Manual Delete' | 'Edit Reversal'
    entries: LedgerEntry[];
    totalValue: number; // Total Debit (Base USD)
}

// --- Chat Interface ---
export interface ChatMessage {
    id: string;
    chatId: string; // 'general' or 'u1_u2' (sorted IDs for private)
    senderId: string;
    senderName: string;
    text: string;
    image?: string; // Base64
    timestamp: string; // ISO String
    readBy: string[]; // Array of User IDs
}

// --- Planner Interfaces ---
export type PlannerPeriodType = 'WEEKLY' | 'MONTHLY';

export enum PlannerEntityType {
    CUSTOMER = 'CUSTOMER',
    SUPPLIER = 'SUPPLIER',
    EXPENSE = 'EXPENSE'
}

export interface PlannerEntry {
    id: string;
    period: string; // YYYY-MM or YYYY-Wxx
    entityId: string;
    entityType: PlannerEntityType;
    plannedAmount: number;
    lastPlanAmount?: number;
    lastActualAmount?: number;
}

// --- Customs Module Interfaces ---

export type ChequeStatus = 'Submitted' | 'Returned' | 'Cashed';

export interface GuaranteeCheque {
    id: string;
    entryDate: string;
    boeNo: string; // Bill of Entry
    destination: string;
    shipper: string;
    stock: string;
    weight: number;
    amount: number; // Invoice Amount
    containerNo: string;
    chequeDate: string;
    chequeNo: string;
    chequeAmount: number;
    status: ChequeStatus;
}

export interface CustomsDocument {
    id: string;
    fileName: string;
    fileType: string; // MIME
    fileUrl: string;
    description: string;
    uploadDate: string;
    uploadedBy: string;
}

// Global State
export interface AppState {
    // Factory & User Management
    factories: Factory[];
    users: User[];
    currentUser: User | null;
    currentFactory: Factory | null;
    
    partners: Partner[];
    accounts: Account[];
    items: Item[];
    divisions: Division[];
    subDivisions: SubDivision[];
    logos: Logo[];
    warehouses: Warehouse[];
    ports: Port[];
    currencies: CurrencyRate[]; // Currency management
    
    // HR & Fleet
    employees: Employee[];
    attendance: AttendanceRecord[];
    salaryPayments: SalaryPayment[];
    tasks: Task[];
    enquiries: Enquiry[];
    vehicles: Vehicle[];
    vehicleCharges: VehicleCharge[];
    
    // Inventory Classifications
    originalTypes: OriginalType[];
    originalProducts: OriginalProduct[];
    categories: Category[];
    sections: Section[];

    ledger: LedgerEntry[];
    archive: ArchivedTransaction[]; // NEW: Archive
    productionHistory: ProductionBatch[]; // Legacy/Complex
    productions: ProductionEntry[]; // New simplified model
    purchases: Purchase[];
    bundlePurchases: BundlePurchase[];
    originalOpenings: OriginalOpening[];
    logisticsEntries: LogisticsEntry[];
    salesInvoices: SalesInvoice[];
    ongoingOrders: OngoingOrder[];
    
    // Chat
    chatMessages: ChatMessage[];
    
    // Reports
    planners: PlannerEntry[];
    plannerCustomerIds: string[]; // List of customer IDs currently in the planner
    plannerSupplierIds: string[]; // List of supplier IDs currently in the planner
    plannerLastWeeklyReset: string; // YYYY-MM-DD format
    plannerLastMonthlyReset: string; // YYYY-MM-DD format

    // Customs Module
    guaranteeCheques: GuaranteeCheque[];
    customsDocuments: CustomsDocument[];
}

export interface DashboardMetrics {
    cashInHand: number;
    bankBalance: number;
    receivables: number;
    payables: number;
    stockValueRaw: number;
    stockValueFG: number;
}
