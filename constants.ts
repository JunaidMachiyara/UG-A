
import { Account, AccountType, AppState, Item, PackingType, Partner, PartnerType, TransactionType, LedgerEntry, Category, Section, OriginalType, OriginalProduct, Division, SubDivision, Logo, Port, Purchase, LogisticsEntry, SalesInvoice, InvoiceAdditionalCost, Warehouse, OngoingOrder, Employee, Task, Vehicle, ChatMessage, OriginalOpening, ProductionEntry, PlannerEntry, PlannerEntityType, PlannerPeriodType, GuaranteeCheque, CustomsDocument, CurrencyRate } from './types';

// Initial Currency Rates
export const INITIAL_CURRENCIES: CurrencyRate[] = [
    { id: 'USD', code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, isBaseCurrency: true, factoryId: '' },
    { id: 'EUR', code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 0.91, isBaseCurrency: false, factoryId: '' },
    { id: 'GBP', code: 'GBP', name: 'British Pound', symbol: '£', exchangeRate: 0.76, isBaseCurrency: false, factoryId: '' },
    { id: 'AED', code: 'AED', name: 'UAE Dirham', symbol: 'AED', exchangeRate: 3.67, isBaseCurrency: false, factoryId: '' },
    { id: 'SAR', code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', exchangeRate: 3.75, isBaseCurrency: false, factoryId: '' },
    { id: 'AUD', code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchangeRate: 1.54, isBaseCurrency: false, factoryId: '' }
];

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

export const RENT_EXPENSE_ID = '5220';
export const ELECTRICITY_EXPENSE_ID = '5230';
export const EXCHANGE_VARIANCE_ID = '5510'; // Foreign Exchange Loss


export const INITIAL_ACCOUNTS: Account[] = [
    // ========================================
    // 1000-1999: ASSETS
    // ========================================
    
    // 1000-1099: Current Assets - Cash & Bank
    { id: '1001', code: '1001', name: 'Cash on Hand', type: AccountType.ASSET, balance: 0 },
    { id: '1002', code: '1002', name: 'Petty Cash', type: AccountType.ASSET, balance: 0 },
    { id: '1010', code: '1010', name: 'Bank - Current Account', type: AccountType.ASSET, balance: 0 },
    { id: '1011', code: '1011', name: 'Bank - Savings Account', type: AccountType.ASSET, balance: 0 },
    
    // 1100-1199: Current Assets - Receivables
    { id: '1100', code: '1100', name: 'Accounts Receivable - Trade', type: AccountType.ASSET, balance: 0 },
    { id: '1101', code: '1101', name: 'Accounts Receivable - Other', type: AccountType.ASSET, balance: 0 },
    { id: '1110', code: '1110', name: 'Notes Receivable', type: AccountType.ASSET, balance: 0 },
    { id: '1120', code: '1120', name: 'Advances to Suppliers', type: AccountType.ASSET, balance: 0 },
    { id: '1130', code: '1130', name: 'Employee Advances', type: AccountType.ASSET, balance: 0 },
    
    // 1200-1299: Current Assets - Inventory
    { id: '1200', code: '1200', name: 'Inventory - Raw Materials', type: AccountType.ASSET, balance: 0 },
    { id: '1201', code: '1201', name: 'Inventory - Work in Progress', type: AccountType.ASSET, balance: 0 },
    { id: '1202', code: '1202', name: 'Inventory - Finished Goods', type: AccountType.ASSET, balance: 0 },
    { id: '1210', code: '1210', name: 'Inventory - Packing Materials', type: AccountType.ASSET, balance: 0 },
    { id: '1220', code: '1220', name: 'Goods in Transit', type: AccountType.ASSET, balance: 0 },
    
    // 1300-1399: Current Assets - Other
    { id: '1300', code: '1300', name: 'Prepaid Expenses', type: AccountType.ASSET, balance: 0 },
    { id: '1301', code: '1301', name: 'Prepaid Rent', type: AccountType.ASSET, balance: 0 },
    { id: '1302', code: '1302', name: 'Prepaid Insurance', type: AccountType.ASSET, balance: 0 },
    { id: '1310', code: '1310', name: 'Security Deposits', type: AccountType.ASSET, balance: 0 },
    { id: '1320', code: '1320', name: 'Tax Refundable', type: AccountType.ASSET, balance: 0 },
    
    // 1500-1699: Fixed Assets - Property, Plant & Equipment
    { id: '1500', code: '1500', name: 'Land', type: AccountType.ASSET, balance: 0 },
    { id: '1510', code: '1510', name: 'Buildings', type: AccountType.ASSET, balance: 0 },
    { id: '1520', code: '1520', name: 'Machinery & Equipment', type: AccountType.ASSET, balance: 0 },
    { id: '1530', code: '1530', name: 'Vehicles', type: AccountType.ASSET, balance: 0 },
    { id: '1540', code: '1540', name: 'Furniture & Fixtures', type: AccountType.ASSET, balance: 0 },
    { id: '1550', code: '1550', name: 'Office Equipment', type: AccountType.ASSET, balance: 0 },
    { id: '1560', code: '1560', name: 'Computers & IT Equipment', type: AccountType.ASSET, balance: 0 },
    
    // 1700-1799: Accumulated Depreciation (Contra-Asset)
    { id: '1710', code: '1710', name: 'Accumulated Depreciation - Buildings', type: AccountType.ASSET, balance: 0 },
    { id: '1720', code: '1720', name: 'Accumulated Depreciation - Machinery', type: AccountType.ASSET, balance: 0 },
    { id: '1730', code: '1730', name: 'Accumulated Depreciation - Vehicles', type: AccountType.ASSET, balance: 0 },
    { id: '1740', code: '1740', name: 'Accumulated Depreciation - Furniture', type: AccountType.ASSET, balance: 0 },
    
    // ========================================
    // 2000-2999: LIABILITIES
    // ========================================
    
    // 2000-2099: Current Liabilities - Payables
    { id: '2000', code: '2000', name: 'Accounts Payable - Trade', type: AccountType.LIABILITY, balance: 0 },
    { id: '2001', code: '2001', name: 'Accounts Payable - Other', type: AccountType.LIABILITY, balance: 0 },
    { id: '2010', code: '2010', name: 'Notes Payable - Short Term', type: AccountType.LIABILITY, balance: 0 },
    { id: '2020', code: '2020', name: 'Advances from Customers', type: AccountType.LIABILITY, balance: 0 },
    
    // 2100-2199: Current Liabilities - Accrued Expenses
    { id: '2100', code: '2100', name: 'Accrued Salaries & Wages', type: AccountType.LIABILITY, balance: 0 },
    { id: '2101', code: '2101', name: 'Accrued Utilities', type: AccountType.LIABILITY, balance: 0 },
    { id: '2102', code: '2102', name: 'Accrued Rent', type: AccountType.LIABILITY, balance: 0 },
    { id: '2110', code: '2110', name: 'Interest Payable', type: AccountType.LIABILITY, balance: 0 },
    
    // 2200-2299: Current Liabilities - Taxes
    { id: '2200', code: '2200', name: 'Income Tax Payable', type: AccountType.LIABILITY, balance: 0 },
    { id: '2201', code: '2201', name: 'Sales Tax Payable (VAT)', type: AccountType.LIABILITY, balance: 0 },
    { id: '2202', code: '2202', name: 'Customs Duty Payable', type: AccountType.LIABILITY, balance: 0 },
    { id: '2210', code: '2210', name: 'Employee Tax Withholding', type: AccountType.LIABILITY, balance: 0 },
    
    // 2300-2399: Current Liabilities - Other
    { id: '2300', code: '2300', name: 'Unearned Revenue', type: AccountType.LIABILITY, balance: 0 },
    { id: '2310', code: '2310', name: 'Customer Deposits', type: AccountType.LIABILITY, balance: 0 },
    { id: '2320', code: '2320', name: 'Bank Overdraft', type: AccountType.LIABILITY, balance: 0 },
    
    // 2500-2699: Long-term Liabilities
    { id: '2500', code: '2500', name: 'Long-term Bank Loan', type: AccountType.LIABILITY, balance: 0 },
    { id: '2510', code: '2510', name: 'Notes Payable - Long Term', type: AccountType.LIABILITY, balance: 0 },
    { id: '2520', code: '2520', name: 'Mortgage Payable', type: AccountType.LIABILITY, balance: 0 },
    
    // ========================================
    // 3000-3999: EQUITY
    // ========================================
    { id: '3000', code: '3000', name: 'Owner\'s Capital', type: AccountType.EQUITY, balance: 0 },
    { id: '3001', code: '3001', name: 'Additional Capital Investment', type: AccountType.EQUITY, balance: 0 },
    { id: '3100', code: '3100', name: 'Owner\'s Drawings', type: AccountType.EQUITY, balance: 0 },
    { id: '3200', code: '3200', name: 'Retained Earnings', type: AccountType.EQUITY, balance: 0 },
    { id: '3300', code: '3300', name: 'Current Year Profit/Loss', type: AccountType.EQUITY, balance: 0 },
    { id: '3400', code: '3400', name: 'Production Gain', type: AccountType.EQUITY, balance: 0 },
    
    // ========================================
    // 4000-4999: REVENUE
    // ========================================
    { id: '4000', code: '4000', name: 'Sales Revenue - Domestic', type: AccountType.REVENUE, balance: 0 },
    { id: '4001', code: '4001', name: 'Sales Revenue - Export', type: AccountType.REVENUE, balance: 0 },
    { id: '4010', code: '4010', name: 'Sales Revenue - Services', type: AccountType.REVENUE, balance: 0 },
    { id: '4100', code: '4100', name: 'Sales Returns & Allowances', type: AccountType.REVENUE, balance: 0 },
    { id: '4110', code: '4110', name: 'Sales Discounts', type: AccountType.REVENUE, balance: 0 },
    { id: '4200', code: '4200', name: 'Other Income', type: AccountType.REVENUE, balance: 0 },
    { id: '4201', code: '4201', name: 'Interest Income', type: AccountType.REVENUE, balance: 0 },
    { id: '4202', code: '4202', name: 'Rental Income', type: AccountType.REVENUE, balance: 0 },
    { id: '4210', code: '4210', name: 'Foreign Exchange Gain', type: AccountType.REVENUE, balance: 0 },
    
    // ========================================
    // 5000-5999: EXPENSES
    // ========================================
    
    // 5000-5099: Cost of Goods Sold
    { id: '5000', code: '5000', name: 'Cost of Goods Sold - Materials', type: AccountType.EXPENSE, balance: 0 },
    { id: '5001', code: '5001', name: 'Cost of Goods Sold - Direct Sales', type: AccountType.EXPENSE, balance: 0 },
    { id: '5010', code: '5010', name: 'Raw Material Consumption', type: AccountType.EXPENSE, balance: 0 },
    { id: '5020', code: '5020', name: 'Manufacturing Labor', type: AccountType.EXPENSE, balance: 0 },
    { id: '5030', code: '5030', name: 'Manufacturing Overhead', type: AccountType.EXPENSE, balance: 0 },
    { id: '5040', code: '5040', name: 'Freight Inward', type: AccountType.EXPENSE, balance: 0 },
    { id: '5050', code: '5050', name: 'Customs & Duties', type: AccountType.EXPENSE, balance: 0 },
    
    // 5100-5199: Operating Expenses - Selling & Distribution
    { id: '5100', code: '5100', name: 'Sales Commissions', type: AccountType.EXPENSE, balance: 0 },
    { id: '5110', code: '5110', name: 'Freight Outward', type: AccountType.EXPENSE, balance: 0 },
    { id: '5120', code: '5120', name: 'Advertising & Marketing', type: AccountType.EXPENSE, balance: 0 },
    { id: '5130', code: '5130', name: 'Packing Materials', type: AccountType.EXPENSE, balance: 0 },
    { id: '5140', code: '5140', name: 'Delivery Expenses', type: AccountType.EXPENSE, balance: 0 },
    
    // 5200-5299: Operating Expenses - Administrative
    { id: '5200', code: '5200', name: 'Salaries & Wages - Admin', type: AccountType.EXPENSE, balance: 0 },
    { id: '5210', code: '5210', name: 'Employee Benefits', type: AccountType.EXPENSE, balance: 0 },
    { id: '5220', code: '5220', name: 'Office Rent', type: AccountType.EXPENSE, balance: 0 },
    { id: '5221', code: '5221', name: 'Warehouse Rent', type: AccountType.EXPENSE, balance: 0 },
    { id: '5230', code: '5230', name: 'Utilities - Electricity', type: AccountType.EXPENSE, balance: 0 },
    { id: '5231', code: '5231', name: 'Utilities - Water', type: AccountType.EXPENSE, balance: 0 },
    { id: '5232', code: '5232', name: 'Utilities - Internet & Phone', type: AccountType.EXPENSE, balance: 0 },
    { id: '5240', code: '5240', name: 'Office Supplies', type: AccountType.EXPENSE, balance: 0 },
    { id: '5250', code: '5250', name: 'Repairs & Maintenance', type: AccountType.EXPENSE, balance: 0 },
    { id: '5260', code: '5260', name: 'Insurance Expense', type: AccountType.EXPENSE, balance: 0 },
    { id: '5270', code: '5270', name: 'Professional Fees', type: AccountType.EXPENSE, balance: 0 },
    { id: '5280', code: '5280', name: 'Bank Charges & Fees', type: AccountType.EXPENSE, balance: 0 },
    
    // 5300-5399: Operating Expenses - Vehicle & Transportation
    { id: '5300', code: '5300', name: 'Vehicle Fuel', type: AccountType.EXPENSE, balance: 0 },
    { id: '5310', code: '5310', name: 'Vehicle Maintenance', type: AccountType.EXPENSE, balance: 0 },
    { id: '5320', code: '5320', name: 'Vehicle Insurance', type: AccountType.EXPENSE, balance: 0 },
    { id: '5330', code: '5330', name: 'Vehicle Registration & Licensing', type: AccountType.EXPENSE, balance: 0 },
    
    // 5400-5499: Operating Expenses - Depreciation
    { id: '5400', code: '5400', name: 'Depreciation - Buildings', type: AccountType.EXPENSE, balance: 0 },
    { id: '5410', code: '5410', name: 'Depreciation - Machinery', type: AccountType.EXPENSE, balance: 0 },
    { id: '5420', code: '5420', name: 'Depreciation - Vehicles', type: AccountType.EXPENSE, balance: 0 },
    { id: '5430', code: '5430', name: 'Depreciation - Furniture', type: AccountType.EXPENSE, balance: 0 },
    
    // 5500-5599: Financial Expenses
    { id: '5500', code: '5500', name: 'Interest Expense', type: AccountType.EXPENSE, balance: 0 },
    { id: '5510', code: '5510', name: 'Foreign Exchange Loss', type: AccountType.EXPENSE, balance: 0 },
    { id: '5520', code: '5520', name: 'Bad Debt Expense', type: AccountType.EXPENSE, balance: 0 },
    
    // 5900-5999: Other Expenses
    { id: '5900', code: '5900', name: 'Miscellaneous Expenses', type: AccountType.EXPENSE, balance: 0 },
    { id: '5910', code: '5910', name: 'Penalties & Fines', type: AccountType.EXPENSE, balance: 0 },
    { id: EXCHANGE_VARIANCE_ID, code: '5510', name: 'Foreign Exchange Loss', type: AccountType.EXPENSE, balance: 0 },
];

export const INITIAL_DIVISIONS: Division[] = [];

export const INITIAL_SUB_DIVISIONS: SubDivision[] = [];

export const INITIAL_LOGOS: Logo[] = [];

export const INITIAL_PORTS: Port[] = [];

export const INITIAL_WAREHOUSES: Warehouse[] = [];

export const INITIAL_PARTNERS: Partner[] = [];

export const INITIAL_CATEGORIES: Category[] = [];

export const INITIAL_SECTIONS: Section[] = [];

export const INITIAL_ORIGINAL_TYPES: OriginalType[] = [];

export const INITIAL_ORIGINAL_PRODUCTS: OriginalProduct[] = [];

export const INITIAL_ITEMS: Item[] = [];

export const INITIAL_LEDGER: LedgerEntry[] = [];
// Removed hardcoded opening entries - these will be created fresh during setup

const TODAY = new Date().toISOString().split('T')[0];
const YESTERDAY = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];

export const INITIAL_PURCHASES: Purchase[] = [];

export const INITIAL_LOGISTICS_ENTRIES: LogisticsEntry[] = [];

export const INITIAL_SALES_INVOICES: SalesInvoice[] = [];

export const INITIAL_ONGOING_ORDERS: OngoingOrder[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_VEHICLES: Vehicle[] = [];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [];

export const INITIAL_ORIGINAL_OPENINGS: OriginalOpening[] = [];

export const INITIAL_PRODUCTIONS: ProductionEntry[] = [];

export const INITIAL_PLANNERS: PlannerEntry[] = [];
export const INITIAL_PLANNER_CUSTOMER_IDS: string[] = [];
export const INITIAL_PLANNER_SUPPLIER_IDS: string[] = [];
export const INITIAL_PLANNER_LAST_WEEKLY_RESET: string = '';
export const INITIAL_PLANNER_LAST_MONTHLY_RESET: string = '';

export const INITIAL_GUARANTEE_CHEQUES: GuaranteeCheque[] = [];

export const INITIAL_CUSTOMS_DOCUMENTS: CustomsDocument[] = [];

export const CHART_COLORS = {
    primary: '#3b82f6', 
    secondary: '#10b981', 
    accent: '#f59e0b', 
    danger: '#ef4444', 
    dark: '#1e293b' 
};
