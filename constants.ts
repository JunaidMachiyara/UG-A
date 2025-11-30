
import { Account, AccountType, AppState, Item, PackingType, Partner, PartnerType, TransactionType, LedgerEntry, Category, Section, OriginalType, OriginalProduct, Division, SubDivision, Logo, Purchase, LogisticsEntry, SalesInvoice, InvoiceAdditionalCost, Warehouse, OngoingOrder, Employee, Task, Vehicle, ChatMessage, OriginalOpening, ProductionEntry, PlannerEntry, PlannerEntityType, PlannerPeriodType, GuaranteeCheque, CustomsDocument } from './types';

// Exchange Rates: 1 USD = X FCY
// To convert FCY to USD: Amount(FCY) / Rate
export const EXCHANGE_RATES = {
    USD: 1,
    EUR: 0.91,
    GBP: 0.76,
    AED: 3.67,
    SAR: 3.75,
    AUD: 1.54
};

export const CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'AED',
    SAR: 'SAR',
    AUD: 'A$'
};

export const CURRENT_USER = { id: 'u1', name: 'Admin User' };

export const RENT_EXPENSE_ID = '509';
export const ELECTRICITY_EXPENSE_ID = '510';
export const EXCHANGE_VARIANCE_ID = '511'; // NEW: For multi-currency transfer variance


export const INITIAL_ACCOUNTS: Account[] = [
    { id: '101', code: '1001', name: 'Cash in Hand (USD)', type: AccountType.ASSET, balance: 15420 },
    { id: '102', code: '1002', name: 'Citibank Main', type: AccountType.ASSET, balance: 85000 },
    { id: '103', code: '1200', name: 'Accounts Receivable', type: AccountType.ASSET, balance: 42000 },
    { id: '104', code: '1300', name: 'Inventory - Raw Material', type: AccountType.ASSET, balance: 120000 },
    { id: '105', code: '1301', name: 'Inventory - Finished Goods', type: AccountType.ASSET, balance: 65000 },
    { id: '201', code: '2001', name: 'Accounts Payable', type: AccountType.LIABILITY, balance: 35000 },
    { id: '202', code: '2002', name: 'Loan from HSBC', type: AccountType.LIABILITY, balance: 50000 },
    { id: '301', code: '3001', name: 'Capital Investment', type: AccountType.EQUITY, balance: 200000 },
    { id: '302', code: '3002', name: 'Owner\'s Drawings', type: AccountType.EQUITY, balance: -5000 }, 
    { id: '401', code: '4001', name: 'Sales Revenue', type: AccountType.REVENUE, balance: 0 },
    { id: '501', code: '5001', name: 'Cost of Goods Sold', type: AccountType.EXPENSE, balance: 0 },
    { id: '502', code: '5002', name: 'Freight Expense', type: AccountType.EXPENSE, balance: 0 }, // For direct payment of freight
    { id: '503', code: '5010', name: 'COGS - Direct Sales', type: AccountType.EXPENSE, balance: 0 },
    { id: '504', code: '5020', name: 'Salaries & Wages', type: AccountType.EXPENSE, balance: 0 },
    { id: '505', code: '5030', name: 'Vehicle Expenses', type: AccountType.EXPENSE, balance: 0 },
    { id: '506', code: '5040', name: 'Office Supplies', type: AccountType.EXPENSE, balance: 0 },
    { id: '507', code: '5050', name: 'Packing Materials', type: AccountType.EXPENSE, balance: 0 },
    { id: '508', code: '5060', name: 'Utilities', type: AccountType.EXPENSE, balance: 0 },
    { id: RENT_EXPENSE_ID, code: '5070', name: 'Rent Expense', type: AccountType.EXPENSE, balance: 0 },
    { id: ELECTRICITY_EXPENSE_ID, code: '5080', name: 'Electricity Expense', type: AccountType.EXPENSE, balance: 0 },
    { id: EXCHANGE_VARIANCE_ID, code: '5090', name: 'Exchange Variance (Gain/Loss)', type: AccountType.EXPENSE, balance: 0 }, // NEW
];

export const INITIAL_DIVISIONS: Division[] = [
    { id: 'div1', name: 'Main', location: 'HQ' },
    { id: 'div2', name: 'Kizilay', location: 'Branch' }
];

export const INITIAL_SUB_DIVISIONS: SubDivision[] = [
    { id: 'sd1', divisionId: 'div1', name: 'Local Sales' },
    { id: 'sd2', divisionId: 'div1', name: 'Export Team' },
    { id: 'sd3', divisionId: 'div2', name: 'Wholesale' }
];

export const INITIAL_LOGOS: Logo[] = [
    { id: 'l1', name: 'Usman Global' },
    { id: 'l2', name: 'Al-Karam Exports' }
];

export const INITIAL_WAREHOUSES: Warehouse[] = [
    { id: 'wh1', name: 'Main Warehouse', location: 'HQ Complex' },
    { id: 'wh2', name: 'Overflow Storage', location: 'Industrial Zone' }
];

export const INITIAL_PARTNERS: Partner[] = [
    { id: 'p1', name: 'Global Thrift Buyers Ltd', type: PartnerType.CUSTOMER, balance: 12500, defaultCurrency: 'USD', contact: 'John Doe', country: 'Kenya', divisionId: 'div1', subDivisionId: 'sd2' },
    { id: 'p2', name: 'Euro Collection GmbH', type: PartnerType.SUPPLIER, balance: -20000, defaultCurrency: 'EUR', contact: 'Hans M.', country: 'Germany' },
    { id: 'p3', name: 'Kizilay Sorting Center', type: PartnerType.VENDOR, balance: -1500, defaultCurrency: 'USD', contact: 'Manager', country: 'Turkey' },
    { id: 'p4', name: 'Africa Market Traders', type: PartnerType.CUSTOMER, balance: 29500, defaultCurrency: 'GBP', contact: 'Sarah K.', country: 'Ghana', divisionId: 'div1', subDivisionId: 'sd2' },
    { id: 'p5', name: 'Global Logistics Solutions', type: PartnerType.FREIGHT_FORWARDER, balance: -2500, defaultCurrency: 'USD', contact: 'Logistics Dept', country: 'UAE', scacCode: 'GLS001' },
    { id: 'p6', name: 'FastTrack Clearing Services', type: PartnerType.CLEARING_AGENT, balance: -800, defaultCurrency: 'AED', contact: 'Ahmed Ali', country: 'UAE', licenseNumber: 'CLR-9988' },
    { id: 'p7', name: 'Ocean Bridge Forwarders', type: PartnerType.FREIGHT_FORWARDER, balance: -1200, defaultCurrency: 'EUR', contact: 'Maria S.', country: 'Germany', scacCode: 'OBF222' },
    { id: 'p8', name: 'Port City Agents', type: PartnerType.CLEARING_AGENT, balance: 0, defaultCurrency: 'USD', contact: 'Operations', country: 'Kenya', licenseNumber: 'KRA-554' },
    { id: 'p9', name: 'City Stationery', type: PartnerType.VENDOR, balance: 0, defaultCurrency: 'USD', contact: 'Sales', country: 'Local' },
    { id: 'p10', name: 'Plastic Factory', type: PartnerType.VENDOR, balance: 0, defaultCurrency: 'USD', contact: 'Sales', country: 'Local' },
    { id: 'p11', name: 'Al-Ain Water', type: PartnerType.VENDOR, balance: 0, defaultCurrency: 'USD', contact: 'Driver', country: 'Local' },
    { id: 'p12', name: 'Owner\'s Capital', type: PartnerType.SUPPLIER, balance: 0, defaultCurrency: 'USD', contact: 'Owner', country: 'Local' } // Fallback for Capital injections
];

export const INITIAL_CATEGORIES: Category[] = [
    { id: 'cat1', name: 'Men\'s Wear' },
    { id: 'cat2', name: 'Ladies\' Wear' },
    { id: 'cat3', name: 'Children\'s Wear' },
    { id: 'cat4', name: 'Household' },
    { id: 'cat5', name: 'Shoes & Bags' },
    { id: 'cat-raw', name: 'Raw Material' },
];

export const INITIAL_SECTIONS: Section[] = [
    { id: 'sec1', name: 'Main Sorting Floor' },
    { id: 'sec2', name: 'Baling Line A' },
    { id: 'sec3', name: 'Premium Room' },
    { id: 'sec4', name: 'Shoe Grading' },
];

export const INITIAL_ORIGINAL_TYPES: OriginalType[] = [
    { id: 'ot1', name: 'KSA Mix', packingType: PackingType.BALE, packingSize: 80 },
    { id: 'ot2', name: 'European Original', packingType: PackingType.KG, packingSize: 1 },
    { id: 'ot3', name: 'Korean Toys', packingType: PackingType.BOX, packingSize: 20 },
    { id: 'ot4', name: 'Australian Shoes', packingType: PackingType.BAG, packingSize: 25 },
];

export const INITIAL_ORIGINAL_PRODUCTS: OriginalProduct[] = [
    { id: 'op1', originalTypeId: 'ot1', name: 'Mixed Rags' },
    { id: 'op2', originalTypeId: 'ot1', name: 'Cream Quality' },
    { id: 'op3', originalTypeId: 'ot4', name: 'Men Shoes' },
    { id: 'op4', originalTypeId: 'ot4', name: 'Ladies Shoes' },
];

export const INITIAL_ITEMS: Item[] = [
    { id: 'i1', code: 'RM-MIX-KSA', name: 'Original KSA Mix', category: 'cat-raw', packingType: PackingType.KG, avgCost: 0.85, stockQty: 15000, weightPerUnit: 1, nextSerial: 1, salePrice: 0 },
    { id: 'DS-001', code: 'DS-001', name: 'Direct Sale (Raw Material)', category: 'cat-raw', packingType: PackingType.KG, avgCost: 0, stockQty: 0, weightPerUnit: 1, nextSerial: 1, salePrice: 0 },
    { id: 'i2', code: 'FG-MEN-JEAN-A', name: 'Mens Jeans Grade A', category: 'cat1', section: 'sec1', packingType: PackingType.BALE, avgCost: 120, stockQty: 250, weightPerUnit: 45, nextSerial: 251, salePrice: 150 },
    { id: 'i3', code: 'FG-LADIES-TOP-B', name: 'Ladies Tops Grade B', category: 'cat2', section: 'sec1', packingType: PackingType.SACK, avgCost: 45, stockQty: 600, weightPerUnit: 25, salePrice: 65, nextSerial: 601 },
    { id: 'i4', code: 'FG-SHOES-CREAM', name: 'Cream Shoes', category: 'cat5', section: 'sec4', packingType: PackingType.SACK, avgCost: 80, stockQty: 120, weightPerUnit: 25, salePrice: 110, nextSerial: 121 },
    { id: 'i5', code: 'FG-LADIES-SILK', name: 'Ladies Silk Blouse', category: 'cat2', section: 'sec3', packingType: PackingType.BALE, avgCost: 180, stockQty: 50, weightPerUnit: 40, nextSerial: 51, salePrice: 220 },
    { id: 'i6', code: 'FG-MEN-TSHIRT', name: 'Men\'s Cotton T-Shirt', category: 'cat1', section: 'sec2', packingType: PackingType.BALE, avgCost: 95, stockQty: 300, weightPerUnit: 45, nextSerial: 301, salePrice: 130 },
    { id: 'i7', code: 'FG-KIDS-DENIM', name: 'Kids Denim Mix', category: 'cat3', section: 'sec1', packingType: PackingType.SACK, avgCost: 55, stockQty: 150, weightPerUnit: 30, salePrice: 75, nextSerial: 151 },
    { id: 'i8', code: 'FG-HH-BEDSHEET', name: 'Bedsheets Grade A', category: 'cat4', section: 'sec2', packingType: PackingType.BALE, avgCost: 110, stockQty: 80, weightPerUnit: 50, nextSerial: 81, salePrice: 140 },
];

export const INITIAL_LEDGER: LedgerEntry[] = [
    { id: 'l1', date: '2023-10-01', transactionId: 'OB-301', transactionType: TransactionType.OPENING_BALANCE, accountId: '301', accountName: 'Capital Investment', currency: 'USD', exchangeRate: 1, fcyAmount: 200000, debit: 0, credit: 200000, narration: 'Opening Capital' },
    { id: 'l2', date: '2023-10-01', transactionId: 'OB-301', transactionType: TransactionType.OPENING_BALANCE, accountId: '102', accountName: 'Citibank Main', currency: 'USD', exchangeRate: 1, fcyAmount: 200000, debit: 200000, credit: 0, narration: 'Opening Capital' },
    { id: 'l3', date: '2023-10-05', transactionId: 'PI-11000', transactionType: TransactionType.PURCHASE_INVOICE, accountId: '104', accountName: 'Inventory - Raw Material', currency: 'USD', exchangeRate: 1, fcyAmount: 50000, debit: 50000, credit: 0, narration: 'Opening Raw Material' },
    { id: 'l4', date: '2023-10-05', transactionId: 'PI-11000', transactionType: TransactionType.PURCHASE_INVOICE, accountId: '201', accountName: 'Accounts Payable', currency: 'USD', exchangeRate: 1, fcyAmount: 50000, debit: 0, credit: 50000, narration: 'Opening Raw Material' },
];

const TODAY = new Date().toISOString().split('T')[0];
const YESTERDAY = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];

export const INITIAL_PURCHASES: Purchase[] = [
    {
        id: 'pur-arr-1',
        batchNumber: '11001',
        status: 'Arrived',
        date: YESTERDAY,
        supplierId: 'p2',
        originalTypeId: 'ot1', // KSA Mix ID
        originalType: 'KSA Mix',
        originalProductId: 'op1',
        containerNumber: 'MSCU-ARRIVED-01',
        divisionId: 'div1',
        subDivisionId: 'sd2',
        qtyPurchased: 150, // 150 Bales
        weightPurchased: 12000, // 150 * 80kg
        currency: 'EUR',
        exchangeRate: 0.91,
        costPerKgFCY: 0.45,
        totalCostFCY: 5400, // 12000 * 0.45
        additionalCosts: [],
        totalLandedCost: 5934.06, // 5400/0.91 = 5934.06 (USD)
        landedCostPerKg: 0.494
    },
    {
        id: 'pur-tr-1',
        batchNumber: '11002',
        status: 'In Transit',
        date: TODAY,
        supplierId: 'p2',
        originalTypeId: 'ot2', // European Original
        originalType: 'European Original',
        containerNumber: 'MSCU-TRANSIT-02',
        divisionId: 'div1',
        subDivisionId: 'sd2',
        qtyPurchased: 10000, // 10000 Kg
        weightPurchased: 10000,
        currency: 'EUR',
        exchangeRate: 0.91,
        costPerKgFCY: 0.85,
        totalCostFCY: 8500, // 10000 * 0.85
        additionalCosts: [],
        totalLandedCost: 9340.65, // 8500/0.91 = 9340.65 (USD)
        landedCostPerKg: 0.934
    }
];

export const INITIAL_LOGISTICS_ENTRIES: LogisticsEntry[] = [
    {
        id: 'log-arr-1',
        purchaseId: 'pur-arr-1',
        purchaseType: 'ORIGINAL',
        containerNumber: 'MSCU-ARRIVED-01',
        status: 'Arrived',
        arrivalDate: YESTERDAY,
        warehouseId: 'wh1',
        invoicedWeight: 12000,
        receivedWeight: 11950,
        shortageKg: 50
    }
];

export const INITIAL_SALES_INVOICES: SalesInvoice[] = [
    {
        id: 'inv-post-1',
        invoiceNo: 'SINV-1001',
        date: '2023-11-15',
        status: 'Posted',
        customerId: 'p1',
        logoId: 'l1',
        containerNumber: 'CONT-EXP-001',
        divisionId: 'div1',
        subDivisionId: 'sd2',
        currency: 'USD',
        exchangeRate: 1,
        discount: 0,
        surcharge: 0,
        items: [
            { id: 'sii-1', itemId: 'i2', itemName: 'Mens Jeans Grade A', qty: 50, rate: 155, total: 7750, totalKg: 2250, currency: 'USD', exchangeRate: 1 },
            { id: 'sii-2', itemId: 'i3', itemName: 'Ladies Tops Grade B', qty: 100, rate: 65, total: 6500, totalKg: 2500, currency: 'USD', exchangeRate: 1 }
        ],
        additionalCosts: [],
        grossTotal: 14250,
        netTotal: 14250
    },
    {
        id: 'inv-unp-1',
        invoiceNo: 'SINV-1002',
        date: TODAY,
        status: 'Unposted',
        customerId: 'p4',
        logoId: 'l1',
        containerNumber: 'CONT-PENDING-002',
        divisionId: 'div1',
        subDivisionId: 'sd2',
        currency: 'GBP',
        exchangeRate: 0.76,
        discount: 100,
        surcharge: 0,
        items: [
            { id: 'sii-3', itemId: 'i6', itemName: 'Men\'s Cotton T-Shirt', qty: 200, rate: 100, total: 20000, totalKg: 9000, currency: 'GBP', exchangeRate: 0.76 }
        ],
        additionalCosts: [
            { id: 'cost-1', costType: 'Freight', providerId: 'p5', amount: 1500, currency: 'USD', exchangeRate: 0.76 }
        ],
        grossTotal: 20000,
        netTotal: 21873.68
    }
];

export const INITIAL_ONGOING_ORDERS: OngoingOrder[] = [
    {
        id: 'oo-1',
        orderNo: 'OO-1001',
        date: TODAY,
        customerId: 'p1',
        status: 'Active',
        items: [
            { itemId: 'i2', quantity: 200, shippedQuantity: 0 },
            { itemId: 'i3', quantity: 500, shippedQuantity: 0 }
        ]
    }
];

export const INITIAL_EMPLOYEES: Employee[] = [
    { id: 'e1', name: 'John Smith', designation: 'Warehouse Manager', status: 'Active', onDuty: 'Yes', companyVisa: 'Yes', passportNumber: 'US123456', basicSalary: 2500, advancesBalance: 0, visaRenewalDate: '2025-10-01' },
    { id: 'e2', name: 'Maria Garcia', designation: 'Accountant', status: 'Active', onDuty: 'Yes', companyVisa: 'Yes', passportNumber: 'ES987654', basicSalary: 3000, advancesBalance: 500, visaRenewalDate: '2024-05-15' },
];

export const INITIAL_TASKS: Task[] = [
    { id: 't1', description: 'Renew Trade License', createdDate: '2024-01-10', isDone: false, status: 'Pending' },
    { id: 't2', description: 'Order Safety Gear', createdDate: '2024-01-12', isDone: true, status: 'Completed', comments: 'Ordered from Supplier X' },
];

export const INITIAL_VEHICLES: Vehicle[] = [
    { id: 'v1', plateNumber: 'DUBAI A 12345', model: 'Toyota Hiace', registrationExpiry: '2024-12-01', insuranceExpiry: '2024-12-01', status: 'Active', assignedToEmployeeId: 'e1' },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
    {
        id: 'msg1',
        chatId: 'general',
        senderId: 'e1',
        senderName: 'John Smith',
        text: 'Welcome to the new system everyone! Please check your profiles.',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        readBy: ['e1', 'u1']
    },
    {
        id: 'msg2',
        chatId: 'general',
        senderId: 'e2',
        senderName: 'Maria Garcia',
        text: 'I have updated the latest accounts. Please review.',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        readBy: ['e2'] 
    }
];

// --- MOCK PRODUCTION DATA FOR REPORTS ---
export const INITIAL_ORIGINAL_OPENINGS: OriginalOpening[] = [
    {
        id: 'oo-mock-1',
        date: TODAY,
        supplierId: 'p2',
        originalType: 'ot1', // KSA Mix
        batchNumber: '11001',
        qtyOpened: 50,
        weightOpened: 4000, // 50 * 80kg
        costPerKg: 0.494,
        totalValue: 1976
    }
];

export const INITIAL_PRODUCTIONS: ProductionEntry[] = [
    {
        id: 'prod-mock-1',
        date: TODAY,
        itemId: 'i2', // Men's Jeans Grade A
        itemName: 'Mens Jeans Grade A',
        packingType: PackingType.BALE,
        qtyProduced: 25,
        weightProduced: 1125, // 25 * 45kg
        serialStart: 251,
        serialEnd: 275
    },
    {
        id: 'prod-mock-2',
        date: TODAY,
        itemId: 'i3', // Ladies Tops
        itemName: 'Ladies Tops Grade B',
        packingType: PackingType.SACK,
        qtyProduced: 60,
        weightProduced: 1500, // 60 * 25kg
        serialStart: 601,
        serialEnd: 660
    },
    {
        id: 'prod-mock-3',
        date: TODAY,
        itemId: 'i6', // Men T-Shirt
        itemName: 'Men\'s Cotton T-Shirt',
        packingType: PackingType.BALE,
        qtyProduced: 15,
        weightProduced: 675, // 15 * 45kg
        serialStart: 301,
        serialEnd: 315
    }
];

// --- FINANCIAL PLANNER DATA ---
export const INITIAL_PLANNERS: PlannerEntry[] = [
    {
        id: 'rp-p1',
        period: '2024-W25', // Example: Current Week
        entityId: 'p1', // Global Thrift Buyers
        entityType: PlannerEntityType.CUSTOMER,
        plannedAmount: 5000,
        lastActualAmount: 4800,
        lastPlanAmount: 5200
    },
    {
        id: 'rp-p2',
        period: '2024-W25',
        entityId: 'p2', // Euro Collection
        entityType: PlannerEntityType.SUPPLIER,
        plannedAmount: 10000,
        lastActualAmount: 9500,
        lastPlanAmount: 11000
    },
     {
        id: 'exp-p1',
        period: '2024-M06', // Example: Current Month
        entityId: RENT_EXPENSE_ID, 
        entityType: PlannerEntityType.EXPENSE,
        plannedAmount: 3000,
        lastActualAmount: 2950,
        lastPlanAmount: 3000
    },
    {
        id: 'exp-p2',
        period: '2024-M06',
        entityId: ELECTRICITY_EXPENSE_ID,
        entityType: PlannerEntityType.EXPENSE,
        plannedAmount: 800,
        lastActualAmount: 850,
        lastPlanAmount: 750
    }
];

// --- MOCK DATA FOR CUSTOMS MODULE ---
export const INITIAL_GUARANTEE_CHEQUES: GuaranteeCheque[] = [
    {
        id: 'gc1',
        entryDate: TODAY,
        boeNo: 'BOE-1001',
        destination: 'Jebel Ali Free Zone',
        shipper: 'Euro Collection GmbH',
        stock: 'Used Clothing Mix',
        weight: 12000,
        amount: 5400,
        containerNo: 'MSCU-ARRIVED-01',
        chequeDate: TODAY,
        chequeNo: 'CHQ-998877',
        chequeAmount: 10000,
        status: 'Submitted'
    }
];

export const INITIAL_CUSTOMS_DOCUMENTS: CustomsDocument[] = [
    {
        id: 'doc1',
        fileName: 'Bill of Lading - MSCU123.pdf',
        fileType: 'application/pdf',
        fileUrl: '#', // Mock URL
        description: 'BL for Container MSCU-ARRIVED-01',
        uploadDate: YESTERDAY,
        uploadedBy: 'Admin User'
    },
    {
        id: 'doc2',
        fileName: 'Packing List - 11001.jpg',
        fileType: 'image/jpeg',
        fileUrl: '#',
        description: 'Packing List for Batch 11001',
        uploadDate: TODAY,
        uploadedBy: 'Admin User'
    }
];

export const CHART_COLORS = {
    primary: '#3b82f6', 
    secondary: '#10b981', 
    accent: '#f59e0b', 
    danger: '#ef4444', 
    dark: '#1e293b' 
};
