
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
    ORIGINAL_OPENING = 'OO'
}

export enum PackingType {
    BALE = 'Bale',
    SACK = 'Sack',
    KG = 'Kg',
    BOX = 'Box',
    BAG = 'Bag'
}

export type Currency = 'USD' | 'EUR' | 'GBP' | 'AED' | 'SAR' | 'AUD';

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
}

export interface Partner {
    id: string;
    name: string;
    type: PartnerType;
    balance: number; // In USD
    defaultCurrency: Currency;
    contact: string;
    country: string;
    email?: string;
    phone?: string;
    
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
    avgCost: number; // Moving Weighted Average Cost (USD)
    stockQty: number; // In Units (Bales/Sacks) or Kg depending on packing
    weightPerUnit: number; // Approx Kg per unit
    salePrice?: number; // USD
    nextSerial?: number; // Auto-increment for Bales/Sacks/Boxes/Bags. (Opening Stock + 1)
}

export interface Division {
    id: string;
    name: string;
    location: string;
}

export interface SubDivision {
    id: string;
    divisionId: string;
    name: string;
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
    
    // Multi-Currency Fields
    currency: Currency;
    exchangeRate: number; // 1 USD = X FCY
    fcyAmount: number; // Foreign Currency Amount
    
    // Base Currency (USD) for Balancing
    debit: number; 
    credit: number;
    
    narration: string;
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
    
    currency: Currency;
    exchangeRate: number;
    
    items: BundlePurchaseItem[];
    additionalCosts: PurchaseAdditionalCost[];
    
    totalAmountFCY: number;
    totalAmountUSD: number;
}

export interface Purchase {
    id: string;
    batchNumber: string; // NEW: Editable, Auto-Populated
    status: 'In Transit' | 'Arrived' | 'Cleared'; // NEW: Logistics Status
    
    date: string;
    supplierId: string;
    originalTypeId: string; // ID of OriginalType (Strict Linking)
    originalType: string; // Display Name
    originalProductId?: string; // ID of OriginalProduct
    
    // Logistics & Destination
    containerNumber?: string;
    divisionId?: string;
    subDivisionId?: string;
    
    qtyPurchased: number; // Units
    weightPurchased: number; // Total Kg
    
    // Material Cost
    currency: Currency;
    exchangeRate: number;
    
    // Pricing Breakdown (Per Kg in FCY)
    costPerKgFCY: number; // Gross Price
    discountPerKgFCY?: number;
    surchargePerKgFCY?: number;
    
    totalCostFCY: number; // Net Total Material Cost
    
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
    originalType: string; // Stores ID if linked to Purchase, or custom string for Bales Opening
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
    qtyProduced: number; // Units
    weightProduced: number; // Total Kg
    serialStart?: number; // Was baleStart. Start of the sequence for this batch
    serialEnd?: number;   // Was baleEnd. End of the sequence for this batch
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
    logoId: string;
    packingColor?: string;
    
    // Logistics
    containerNumber?: string;
    divisionId?: string;
    subDivisionId?: string;
    
    // Financials
    currency: Currency; // Invoice Currency
    exchangeRate: number; // Base to Invoice
    
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
    partners: Partner[];
    accounts: Account[];
    items: Item[];
    divisions: Division[];
    subDivisions: SubDivision[];
    logos: Logo[];
    warehouses: Warehouse[];
    
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
