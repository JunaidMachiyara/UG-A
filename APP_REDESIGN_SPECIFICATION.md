# Usman Global Inventory & ERP System - Complete Application Specification

## 📋 **EXECUTIVE SUMMARY**

**Application Name:** Usman Global Inventory & ERP System  
**Business Domain:** Used Clothing Inventory & Management System  
**Technology Stack:** React + TypeScript + Vite + Firebase (Firestore)  
**Purpose:** Comprehensive ERP system for managing multi-factory operations in the used clothing/textile industry, featuring double-entry accounting, production grading, multi-currency support, and AI-driven analytics.

---

## 🏢 **BUSINESS OVERVIEW**

### **Industry Context**
- **Business Type:** Used clothing/textile trading and processing
- **Operations:** Purchase raw materials (used clothing) → Process/Grade → Sell finished goods
- **Multi-Factory Setup:** Supports multiple factories (MAAZ, TALHA, AL ANWAR) with independent operations
- **Supply Chain:** International suppliers → Container shipments → Warehouses → Production → Customers

### **Core Business Flow**
1. **Purchase** - Buy raw materials (original clothing) from suppliers
2. **Original Opening** - Open containers/process raw materials
3. **Production** - Grade/sort materials into finished goods (items)
4. **Sales** - Sell finished goods to customers or sell raw materials directly

---

## 🏗️ **SYSTEM ARCHITECTURE**

### **Multi-Factory Architecture**
- Each factory operates independently with its own:
  - Inventory (raw materials & finished goods)
  - Accounts & Partners
  - Production records
  - Sales & Purchases
  - Employees & HR data
- Super Admin can switch between factories
- Factory-specific data isolation via `factoryId` field

### **User Roles & Permissions**
1. **SUPER_ADMIN** - Full system access, all factories
2. **FACTORY_ADMIN** - Full access to assigned factory
3. **MODULE_USER** - Limited to assigned modules (view/create/edit, no delete)
4. **DATA_ENTRY_INVENTORY** - Sales, Purchase, Production modules only
5. **DATA_ENTRY_ACCOUNTING** - Accounting, Ledger, Vouchers only

### **Permission Modules**
- DASHBOARD, DATA_ENTRY, SALES, PURCHASES, PRODUCTION, ACCOUNTING, LOGISTICS, HR, REPORTS, CUSTOMS, SETUP, ADMIN, POSTING, OFFLOADING, CHAT

---

## 📦 **CORE MODULES**

### **1. DASHBOARD MODULE**
**Purpose:** Executive overview of business metrics

**Features:**
- Cash in Hand & Bank Balance
- Accounts Receivable & Payable
- Raw Material Stock Value
- Finished Goods Stock Value
- Revenue, Expenses, Net Profit
- Sales by Category charts
- Production Analysis
- Quick navigation to reports

**Metrics Calculated:**
- Total Revenue (from REVENUE accounts)
- Total Expenses (from EXPENSE accounts)
- Net Profit & Profit Margin
- Stock valuations (raw materials & finished goods)

---

### **2. DATA ENTRY MODULE**
**Purpose:** Core transaction entry for Production, Purchases, and Sales

#### **2.1 PRODUCTION SUB-MODULES**

##### **A. Original Opening**
**Purpose:** Consume raw material batches (open containers/process raw materials)

**Process:**
1. Select supplier (or 'INTERNAL' for bales opening)
2. Select Original Type (e.g., "KSA Mix")
3. Select Original Product (optional, e.g., "Mixed Rags")
4. Enter batch number, quantity (units), weight (kg)
5. System calculates cost per kg from purchase history (FIFO)
6. Creates ledger entries:
   - **DEBIT:** Work in Progress (WIP)
   - **CREDIT:** Inventory - Raw Materials

**Stock Impact:**
- Reduces available raw material stock
- Increases WIP inventory

**Features:**
- Batch tracking
- Supplier-based opening
- Internal bales opening (for finished goods)
- CSV upload support

##### **B. Finished Goods Production**
**Purpose:** Record output of graded/sorted items from production

**Process:**
1. Select item (finished good)
2. Enter production date, quantity produced
3. Enter production price (or uses item's avgCost)
4. System auto-calculates:
   - Weight produced (qty × weightPerUnit)
   - Serial numbers (for tracked items: Bale, Sack, Box, Bag)
   - Production value

**Ledger Entries Created:**
- **WITH Original Opening (WIP exists):**
  - **DEBIT:** Inventory - Finished Goods
  - **CREDIT:** Work in Progress (WIP) - FIFO consumption
  - **CREDIT:** Production Gain / Capital (difference)

- **WITHOUT Original Opening (no WIP):**
  - **DEBIT:** Inventory - Finished Goods
  - **CREDIT:** Production Gain / Capital

**Stock Updates:**
- Item `stockQty` increases
- Item `nextSerial` updated (for tracked items)
- Item `avgCost` updated (if production price provided)

**Features:**
- Serial number tracking (auto-increment)
- FIFO WIP consumption
- Production price override
- CSV upload support
- Batch production entry

##### **C. Produced Production (View/Filter)**
**Purpose:** View and filter production entries

**Features:**
- Date range filtering
- Item filtering
- Production summary
- Edit/Delete (with supervisor PIN)

##### **D. Re-baling**
**Purpose:** Convert loose stock or re-process items

**Process:**
1. Select item to consume
2. Enter quantity to consume
3. Select item to produce
4. Enter quantity to produce
5. System creates production entry with `isRebaling: true` flag

**Use Cases:**
- Re-baling loose stock
- Converting between item types
- Re-processing damaged items

#### **2.2 PURCHASE SUB-MODULES**

##### **A. Original Purchase**
**Purpose:** Buy raw material batches from suppliers

**Process:**
1. Enter batch number (auto-populated, editable)
2. Select supplier (or main supplier for composite)
3. Select sub-suppliers (for composite purchases)
4. Add original types to cart:
   - Original Type (e.g., "KSA Mix")
   - Original Product (optional)
   - Sub Supplier (optional)
   - Weight purchased (kg)
   - Price per kg (in foreign currency)
   - Discount/Surcharge per kg
5. Add additional costs:
   - Freight (provider: Freight Forwarder)
   - Clearing (provider: Clearing Agent)
   - Commission (provider: Commission Agent)
   - Other (custom costs)
6. System calculates:
   - Total material cost (FCY & USD)
   - Landed cost (material + additional costs)
   - Landed cost per kg

**Ledger Entries Created:**
- **DEBIT:** Inventory - Raw Materials (totalLandedCost)
- **CREDIT:** Supplier Account (materialCostUSD)
- **CREDIT:** Additional Cost Providers (freight/clearing/commission)

**Stock Updates:**
- Purchase record saved
- Available stock tracked in `state.purchases`
- Multi-original type support (composite purchases)

**Features:**
- Multi-currency support
- Composite purchases (multiple sub-suppliers)
- Additional costs tracking
- Container number tracking
- Division/Sub-division assignment
- Status tracking (In Transit, Arrived, Cleared)
- CSV upload support

##### **B. Bundle Purchase**
**Purpose:** Buy pre-sorted finished goods (Stock Lots)

**Process:**
1. Select supplier
2. Add items to cart (finished goods)
3. Enter quantity, rate (per unit), currency
4. System calculates total

**Ledger Entries:**
- **DEBIT:** Inventory - Finished Goods
- **CREDIT:** Supplier Account

**Features:**
- Direct finished goods purchase
- Multi-item support
- Currency conversion

#### **2.3 SALES SUB-MODULES**

##### **A. Sales Invoices**
**Purpose:** Create invoices for finished goods sales

**Process:**
1. Generate invoice number (auto-increment)
2. Select customer
3. Select logo (for invoice header)
4. Add items:
   - Item (finished good)
   - Quantity
   - Rate (per unit, in USD)
   - Total (auto-calculated)
5. Add additional costs:
   - Freight, Clearing, Commission, Customs, Other
6. Apply discount/surcharge
7. System calculates:
   - Gross total
   - Net total

**Status:**
- **Unposted:** Draft invoice (no ledger entries)
- **Posted:** Creates ledger entries and reduces inventory

**Ledger Entries (when Posted):**
- **DEBIT:** Customer Account (netTotal)
- **CREDIT:** Sales Revenue (totalItemsRevenueUSD)
- **CREDIT:** Revenue (Surcharge) - if surcharge exists
- **DEBIT:** COGS - Finished Goods (cost of goods sold)
- **CREDIT:** Inventory - Finished Goods (reduce inventory)

**Stock Updates:**
- Item `stockQty` decreases (FIFO)
- COGS calculated from item avgCost

**Features:**
- Multi-currency support (invoice currency + customer currency)
- Container number tracking
- Division/Sub-division assignment
- Port of destination
- Ongoing order linking
- Direct sale linking (for raw material sales)
- Print/Export functionality

##### **B. Direct Sales**
**Purpose:** Sell raw materials directly (without production)

**Process:**
1. Select customer
2. Select original purchase batch
3. Enter quantity/weight to sell
4. Enter rate (per kg)
5. System creates sales invoice with direct sale flag

**Ledger Entries:**
- **DEBIT:** Customer Account
- **CREDIT:** Sales Revenue
- **DEBIT:** COGS - Raw Materials
- **CREDIT:** Inventory - Raw Materials

**Features:**
- Direct raw material sales
- Batch tracking
- FIFO cost calculation

##### **C. Ongoing Orders**
**Purpose:** Manage long-term orders with partial shipments

**Process:**
1. Create order with items and quantities
2. Status: Active → Partially Shipped → Completed
3. Link shipments to order
4. Track shipped vs ordered quantities

**Features:**
- Order tracking
- Partial shipment support
- Status management
- Invoice linking

---

### **3. ACCOUNTING MODULE**
**Purpose:** Double-entry accounting system with vouchers, ledger, and utilities

#### **3.1 VOUCHER TYPES**

##### **A. Receipt Voucher (RV)**
**Purpose:** Record money received

**Process:**
1. Select "Paid From" (Customer/Partner)
2. Select "Deposit To" (Cash/Bank Account)
3. Enter amount, currency, exchange rate
4. Enter description

**Ledger Entries:**
- **DEBIT:** Cash/Bank Account
- **CREDIT:** Customer/Partner Account

##### **B. Payment Voucher (PV)**
**Purpose:** Record money paid

**Process:**
1. Select "Paid To" (Supplier/Vendor/Expense)
2. Select "Paid From" (Cash/Bank Account)
3. Enter amount, currency, exchange rate
4. Enter description

**Ledger Entries:**
- **DEBIT:** Supplier/Vendor/Expense Account
- **CREDIT:** Cash/Bank Account

##### **C. Expense Voucher (EV)**
**Purpose:** Record expenses

**Process:**
1. Select expense account
2. Select "Paid From" (Cash/Bank)
3. Enter amount, description

**Ledger Entries:**
- **DEBIT:** Expense Account
- **CREDIT:** Cash/Bank Account

##### **D. Journal Voucher (JV)**
**Purpose:** Manual double-entry adjustments

**Process:**
1. Add multiple rows
2. Each row: Account, Description, Debit, Credit, Currency, Exchange Rate
3. System validates: Total Debits = Total Credits

**Features:**
- Multi-row support
- Multi-currency
- Balance validation

##### **E. Transfer Voucher (TR)**
**Purpose:** Transfer between accounts (e.g., Cash to Bank)

**Process:**
1. Select "Transfer From" (Account)
2. Select "Transfer To" (Account)
3. Enter amounts in both currencies (if different)
4. System handles currency conversion

**Ledger Entries:**
- **DEBIT:** Destination Account
- **CREDIT:** Source Account

##### **F. Purchase Bill (PB)**
**Purpose:** General purchase/bill entry

**Modes:**
- **CREDIT Mode:** Supplier credit purchase
  - **DEBIT:** Expense/Asset Account
  - **CREDIT:** Supplier Account

- **CASH Mode:** Cash purchase
  - **DEBIT:** Expense/Asset Account
  - **CREDIT:** Cash/Bank Account

##### **G. Inventory Adjustment (IA)**
**Purpose:** Adjust finished goods inventory quantities/values

**Modes:**
- **Adjustment Mode:** Enter adjustment qty/worth
- **Target Mode:** Enter target qty/worth (system calculates adjustment)

**Process:**
1. Filter items (by code, category, name)
2. Enter adjustments per item
3. Enter reason
4. System creates ledger entries:
   - **DEBIT/CREDIT:** Inventory - Finished Goods
   - **CREDIT/DEBIT:** Inventory Adjustment Account

**Stock Updates:**
- Item `stockQty` adjusted
- Item `avgCost` recalculated (if worth adjusted)

##### **H. Original Stock Adjustment (IAO)**
**Purpose:** Adjust raw material inventory quantities/values

**Modes:**
- **Adjustment Mode:** Enter adjustment weight/worth
- **Target Mode:** Enter target weight/worth

**Process:**
1. Filter by supplier, original type, original product
2. Enter adjustments per combination
3. Enter reason
4. System creates ledger entries:
   - **DEBIT/CREDIT:** Inventory - Raw Materials
   - **CREDIT/DEBIT:** Inventory Adjustment Account

**Stock Updates:**
- Raw material stock adjusted
- Average cost per kg recalculated

##### **I. Return to Supplier (RTS)**
**Purpose:** Return items to supplier

**Process:**
1. Select supplier
2. Select item
3. Enter quantity
4. Enter reason
5. System creates ledger entries:
   - **DEBIT:** Supplier Account
   - **CREDIT:** Inventory - Finished Goods

**Stock Updates:**
- Item `stockQty` decreases

##### **J. Write-Off (WO)**
**Purpose:** Write off inventory/expenses

**Process:**
1. Select account (inventory or expense)
2. Enter amount
3. Enter reason
4. System creates ledger entries:
   - **DEBIT:** Write-Off Account
   - **CREDIT:** Source Account

##### **K. Balancing Discrepancy (BD)**
**Purpose:** Adjust account balances for discrepancies

**Process:**
1. Select account
2. Select adjustment type (INCREASE/DECREASE)
3. Enter amount
4. Enter reason
5. System creates ledger entries:
   - **DEBIT/CREDIT:** Account
   - **CREDIT/DEBIT:** Balancing Discrepancy Account

##### **L. Manual JV for Original Stock (MJV)**
**Purpose:** Manual adjustment for original stock with specific supplier/product

**Process:**
1. Select supplier, original type, original product
2. Enter weight, worth
3. Enter reason
4. Creates manual journal entries for raw materials

#### **3.2 GENERAL LEDGER**
**Purpose:** View all ledger entries with filtering

**Features:**
- Date range filtering
- Transaction type filtering
- Account filtering
- Voucher ID filtering
- Amount range filtering
- Sorting (date, account, amount)
- Pagination (200 entries per page)
- Export functionality

#### **3.3 BALANCE ALIGNMENT UTILITIES**
**Purpose:** Align account/partner balances with ledger calculations

**Features:**
- Recalculate account balances from ledger
- Recalculate partner balances from ledger
- Fix mismatches automatically
- Generate diagnostic reports

#### **3.4 STOCK ALIGNMENT UTILITIES**
**Purpose:** Align inventory stock quantities/values

**Features:**
- Align finished goods stock
- Align original stock
- Recalculate average costs
- Generate alignment reports

---

### **4. REPORTS MODULE**
**Purpose:** Comprehensive reporting and analytics

#### **4.1 EXECUTIVE BI DASHBOARD**
**Features:**
- Revenue, Expenses, Net Profit metrics
- Sales by Category charts
- Production Analysis
- Cash Flow trends
- Account balances overview

#### **4.2 INVENTORY REPORTS**
- **Original Stock Report:** Raw material inventory by supplier, type, product
- **Item Performance Report:** Finished goods sales performance
- **Stock Valuation:** Current stock values

#### **4.3 FINANCIAL REPORTS**
- **Balance Sheet:** Assets, Liabilities, Equity
- **Profit & Loss:** Revenue, Expenses, Net Profit
- **Trial Balance:** All account balances
- **Account Statement:** Individual account transactions
- **Partner Statement:** Customer/Supplier balances and transactions

#### **4.4 PRODUCTION REPORTS**
- **Production Analysis:** Production by item, date, category
- **Yield Analysis:** Production efficiency metrics
- **WIP Report:** Work in Progress status

#### **4.5 SALES REPORTS**
- **Sales by Customer:** Customer-wise sales summary
- **Sales by Item:** Item-wise sales performance
- **Order Fulfillment Dashboard:** Ongoing orders status
- **Sales Trends:** Time-series sales analysis

#### **4.6 DAYBOOK**
**Purpose:** Daily transaction summary

**Features:**
- Date-wise transaction listing
- Transaction type grouping
- Total debits/credits per day
- Export functionality

#### **4.7 CASH BOOK**
**Purpose:** Cash transactions only

**Features:**
- Cash receipts
- Cash payments
- Cash balance tracking

#### **4.8 ACCOUNTS RECEIVABLE (AR)**
**Purpose:** Customer outstanding balances

**Features:**
- Customer-wise outstanding
- Aging analysis
- Payment tracking

#### **4.9 ACCOUNTS PAYABLE (AP)**
**Purpose:** Supplier outstanding balances

**Features:**
- Supplier-wise outstanding
- Aging analysis
- Payment tracking

---

### **5. LOGISTICS MODULE**
**Purpose:** Track container shipments and logistics

**Features:**
- Container number tracking
- Status: In Transit → Arrived → Cleared
- ETD/ETA tracking
- Port storage dates
- DO Validation dates
- Ground date, Arrival date
- Warehouse assignment
- Weight tracking (invoiced vs received)
- Shortage calculation
- Document status tracking
- Freight Forwarder assignment
- Clearing Agent assignment
- Clearing bill number & amount
- Tally items (for bundle purchases)

---

### **6. CUSTOMS MODULE**
**Purpose:** Manage customs documentation and guarantee cheques

**Features:**
- **Guarantee Cheques:**
  - Bill of Entry (BOE) tracking
  - Destination, Shipper, Stock tracking
  - Weight, Amount, Container Number
  - Cheque details (date, number, amount)
  - Status: Submitted → Returned → Cashed

- **Customs Documents:**
  - File upload
  - Document description
  - Upload date tracking
  - Uploaded by tracking

---

### **7. HR MODULE**
**Purpose:** Employee management, attendance, payroll

**Features:**
- **Employee Management:**
  - Personal information (name, DOB, nationality, address, phone, email)
  - Designation, Status (Active/Inactive/Terminated)
  - On Duty status
  - Visa information (company visa, passport, visa status, expiry)
  - Financial (bank, account, IBAN, basic salary, salary increment date)
  - Advances balance tracking
  - Join date, reference, complaints

- **Attendance:**
  - Daily attendance recording
  - Status: P (Present), A (Absent), L (Late), HD (Half Day), PL (Paid Leave), SL (Sick Leave), H (Holiday)
  - Remarks field

- **Payroll:**
  - Salary payment processing
  - Payable days calculation
  - Deductions tracking
  - Advances deduction
  - Net paid calculation
  - Payment method (Cash/Bank)
  - Voucher linking

- **Tasks:**
  - Task creation and assignment
  - Status: Pending → Acknowledged → Completed
  - Comments tracking

- **Enquiries:**
  - Employee enquiries (e.g., loan requests)
  - Status: Pending → Approved → Rejected
  - Admin comments

- **Fleet Management:**
  - Vehicle registration
  - Plate number, model
  - Registration expiry, insurance expiry
  - Employee assignment
  - Status: Active → Maintenance → Sold
  - Vehicle charges tracking (fines, etc.)

---

### **8. SETUP MODULE**
**Purpose:** Master data management

**Features:**
- **Partners:** Customers, Suppliers, Sub Suppliers, Vendors, Clearing Agents, Freight Forwarders, Commission Agents
- **Accounts:** Chart of Accounts (Asset, Liability, Equity, Revenue, Expense)
- **Items:** Finished goods with codes, categories, sections, packing types
- **Original Types:** Raw material types (e.g., "KSA Mix")
- **Original Products:** Sub-classification of original types
- **Categories:** Item categories (e.g., "Men's Wear")
- **Sections:** Production sections (e.g., "Sorting Line A")
- **Divisions:** Factory divisions
- **Sub-Divisions:** Sub-divisions within divisions
- **Logos:** Company logos for invoices
- **Warehouses:** Warehouse locations
- **Ports:** Port of destination/shipment
- **Currencies:** Currency management with exchange rates
- **Employees:** Employee master data

**Quick Add Feature:**
- Modal-based quick addition
- Context-aware defaults
- Validation

---

### **9. ADMIN MODULE**
**Purpose:** System administration and utilities

**Features:**
- **Factory Management:** Create, edit factories (Super Admin only)
- **User Management:** Create, edit users, assign roles (Super Admin only)
- **Database Utilities:**
  - Balance recalculation
  - Stock alignment
  - Diagnostic reports
  - Factory reset utility
  - Balance discrepancy fixes
- **CSV Import/Export:**
  - Partners, Accounts, Items, Purchases, Productions, Sales, etc.
  - Bulk data operations
- **CSV Validator:**
  - Pre-import validation
  - Error detection
  - Data integrity checks
- **Backup System:**
  - Automated backups (morning/evening)
  - Manual backup
  - Restore functionality

---

### **10. POSTING MODULE**
**Purpose:** Post unposted transactions (sales invoices, etc.)

**Features:**
- View unposted transactions
- Batch posting
- Post individual transactions
- Validation before posting

---

### **11. OFFLOADING MODULE**
**Purpose:** Container offloading operations

**Features:**
- Container offloading tracking
- Weight verification
- Tally operations

---

### **12. CHAT MODULE**
**Purpose:** Internal communication

**Features:**
- General chat
- Private messaging
- Image sharing
- Read receipts
- Unread count tracking

---

## 💰 **ACCOUNTING FLOW DETAILS**

### **Double-Entry Accounting System**
- **Base Currency:** USD
- **Multi-Currency Support:** All transactions support foreign currencies with exchange rates
- **Balance Validation:** All transactions must be balanced (Total Debits = Total Credits)
- **Account Types:** Asset, Liability, Equity, Revenue, Expense

### **Complete Business Flow Accounting**

#### **1. PURCHASE (Buy Original)**
```
DEBIT:  Inventory - Raw Materials     $X (totalLandedCost)
CREDIT: Supplier Account              $X (materialCostUSD)
CREDIT: Additional Cost Providers   $Y (freight/clearing/commission)
```
- Supplier balance becomes more negative (liability increases)
- Raw material inventory increases

#### **2. ORIGINAL OPENING (Open Original)**
```
CREDIT: Inventory - Raw Materials     $X (totalValue)
DEBIT:  Work in Progress (WIP)        $X (totalValue)
```
- Raw material inventory decreases
- WIP inventory increases

#### **3. PRODUCTION (Produce Finished Goods)**
**With WIP:**
```
DEBIT:  Inventory - Finished Goods    $X (finishedGoodsValue)
CREDIT: Work in Progress (WIP)        $Y (wipValueConsumed - FIFO)
CREDIT: Production Gain / Capital     $Z (capitalCredit = X - Y)
```

**Without WIP:**
```
DEBIT:  Inventory - Finished Goods    $X (finishedGoodsValue)
CREDIT: Production Gain / Capital     $X (same as finishedGoodsValue)
```
- Finished goods inventory increases
- WIP decreases (if exists)
- Production gain increases

#### **4. SALES (Sale Finished Goods)**
```
DEBIT:  Customer Account              $X (netTotal)
CREDIT: Sales Revenue                 $Y (totalItemsRevenueUSD)
CREDIT: Revenue (Surcharge)          $Z (if surcharge exists)
DEBIT:  COGS - Finished Goods         $W (cost of goods sold)
CREDIT: Inventory - Finished Goods    $W (reduce inventory)
```
- Customer balance increases (they owe us)
- Revenue increases
- COGS increases (expense)
- Finished goods inventory decreases

#### **5. DIRECT SALE (Sell Raw Material)**
```
DEBIT:  Customer Account              $X (netTotal)
CREDIT: Sales Revenue                 $Y (revenue)
DEBIT:  COGS - Raw Materials          $W (cost of goods sold)
CREDIT: Inventory - Raw Materials     $W (reduce inventory)
```
- Customer balance increases
- Revenue increases
- COGS increases
- Raw material inventory decreases

### **Account Balance Calculation**
- **Assets:** Balance = Debit Sum - Credit Sum (positive = asset)
- **Liabilities:** Balance = Credit Sum - Debit Sum (positive = liability)
- **Equity:** Balance = Credit Sum - Debit Sum (positive = equity)
- **Revenue:** Balance = Credit Sum - Debit Sum (positive = revenue)
- **Expense:** Balance = Debit Sum - Credit Sum (positive = expense)

### **Partner Balance Calculation**
- **Customers:** Balance = Debit Sum - Credit Sum (positive = they owe us)
- **Suppliers:** Balance = Credit Sum - Debit Sum (positive = we owe them)

---

## 📊 **DATA MODELS**

### **Core Entities**

#### **Factory**
```typescript
{
  id: string;
  name: string; // MAAZ, TALHA, AL ANWAR
  code: string; // MAZ, TLH, ANW
  location: string;
  isActive: boolean;
  createdDate: string;
}
```

#### **User**
```typescript
{
  id: string;
  username: string; // Login ID
  password: string; // Hashed
  displayName: string;
  role: UserRole;
  factoryId: string;
  allowedModules?: PermissionModule[];
  isActive: boolean;
  createdDate: string;
  lastLogin?: string;
}
```

#### **Partner**
```typescript
{
  id: string;
  code?: string;
  name: string;
  type: PartnerType; // CUSTOMER, SUPPLIER, SUB_SUPPLIER, VENDOR, CLEARING_AGENT, FREIGHT_FORWARDER, COMMISSION_AGENT
  balance: number; // In USD
  defaultCurrency: Currency;
  contact: string;
  country: string;
  email?: string;
  phone?: string;
  factoryId: string;
  divisionId?: string;
  subDivisionId?: string;
  // Type-specific fields
  creditLimit?: number; // Customer
  taxId?: string; // Supplier/Vendor
  commissionRate?: number; // Commission Agent
  parentSupplierId?: string; // Sub Supplier
  licenseNumber?: string; // Clearing Agent
  scacCode?: string; // Freight Forwarder
}
```

#### **Account**
```typescript
{
  id: string;
  code: string;
  name: string;
  type: AccountType; // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  balance: number; // In USD
  currency?: Currency; // For Bank/Cash accounts
  factoryId: string;
  parentAccountId?: string; // For grouping
}
```

#### **Item (Finished Goods)**
```typescript
{
  id: string;
  code: string;
  name: string;
  category: string; // Category ID
  section?: string; // Section ID
  packingType: PackingType; // Bale, Sack, Kg, Box, Bag
  avgCost: number; // Production cost per unit
  stockQty: number; // In Units
  weightPerUnit: number; // Approx Kg per unit
  salePrice?: number; // USD
  nextSerial?: number; // Auto-increment for tracked items
  factoryId: string;
}
```

#### **OriginalType (Raw Material Type)**
```typescript
{
  id: string;
  code?: string;
  name: string; // e.g., "KSA Mix"
  packingType: PackingType; // e.g., Bale
  packingSize: number; // e.g., 45kg
}
```

#### **OriginalProduct**
```typescript
{
  id: string;
  code?: string;
  originalTypeId: string; // Parent Link
  name: string; // e.g., "Mixed Rags"
}
```

#### **Purchase**
```typescript
{
  id: string;
  batchNumber: string; // Editable, Auto-Populated
  status: 'In Transit' | 'Arrived' | 'Cleared';
  date: string;
  supplierId: string; // Main supplier
  mainSupplierId?: string; // For composite purchase
  subSuppliers?: string[]; // Array of sub-supplier IDs
  isComposite?: boolean;
  factoryId: string;
  
  // Multi-Original Type Support
  items: PurchaseOriginalItem[]; // Array of original types
  
  // Legacy fields (for backward compatibility)
  originalTypeId: string;
  originalType: string;
  originalProductId?: string;
  
  // Logistics
  containerNumber?: string;
  divisionId?: string;
  subDivisionId?: string;
  
  qtyPurchased: number; // Total Units
  weightPurchased: number; // Total Kg
  
  // Material Cost
  currency: Currency;
  exchangeRate: number;
  costPerKgFCY: number; // Average price
  discountPerKgFCY?: number;
  surchargePerKgFCY?: number;
  totalCostFCY: number; // Net Total Material Cost
  
  // Landed Cost Components
  additionalCosts: PurchaseAdditionalCost[];
  
  // Final Landed Cost
  totalLandedCost: number; // Material USD + Additional Costs USD
  landedCostPerKg: number;
}
```

#### **OriginalOpening**
```typescript
{
  id: string;
  date: string;
  supplierId: string; // or 'INTERNAL' for Bales Opening
  originalType: string; // Stores originalTypeId
  originalProductId?: string;
  batchNumber?: string;
  qtyOpened: number;
  weightOpened: number; // Kg
  costPerKg: number; // USD
  totalValue: number; // USD
  factoryId: string;
}
```

#### **ProductionEntry**
```typescript
{
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  packingType: PackingType;
  factoryId: string;
  qtyProduced: number; // Units
  weightProduced: number; // Total Kg
  serialStart?: number; // Start of sequence
  serialEnd?: number; // End of sequence
  isRebaling?: boolean; // Flag for re-baling
  productionPrice?: number; // Production price per unit
}
```

#### **SalesInvoice**
```typescript
{
  id: string;
  invoiceNo: string;
  date: string;
  status: 'Unposted' | 'Posted';
  customerId: string;
  factoryId: string;
  logoId: string;
  packingColor?: string;
  
  // Logistics
  containerNumber?: string;
  divisionId?: string;
  subDivisionId?: string;
  portOfDestinationId?: string;
  
  // Financials
  currency: Currency; // Invoice Currency (always USD for accounting)
  exchangeRate: number; // Base to Invoice (always 1 for USD)
  customerCurrency?: Currency; // Customer's currency for display
  customerExchangeRate?: number;
  
  discount: number;
  surcharge: number;
  
  items: SalesInvoiceItem[];
  additionalCosts: InvoiceAdditionalCost[];
  
  grossTotal: number;
  netTotal: number;
}
```

#### **LedgerEntry**
```typescript
{
  id: string;
  date: string; // ISO Date
  transactionId: string;
  transactionType: TransactionType;
  accountId: string;
  accountName: string; // Denormalized
  factoryId: string;
  
  // Multi-Currency Fields
  currency: Currency;
  exchangeRate: number; // 1 USD = X FCY
  fcyAmount: number; // Foreign Currency Amount
  
  // Base Currency (USD) for Balancing
  debit: number;
  credit: number;
  
  narration: string;
  
  // System flags
  isAdjustment?: boolean; // System-generated balance adjustment
  isReportingOnly?: boolean; // Does not affect accounting/balance sheet
}
```

---

## 🔄 **KEY BUSINESS PROCESSES**

### **1. Purchase to Production Flow**
1. **Purchase** raw materials from supplier
   - Create Purchase record
   - Create ledger entries (debit inventory, credit supplier)
   - Track by batch number, container number

2. **Original Opening** to consume raw materials
   - Select purchase batch
   - Enter quantity/weight opened
   - Create ledger entries (credit raw materials, debit WIP)
   - Reduce available raw material stock

3. **Production** to create finished goods
   - Select item to produce
   - Enter quantity produced
   - System consumes WIP (FIFO)
   - Create ledger entries (debit finished goods, credit WIP/Capital)
   - Increase finished goods stock

4. **Sales** to sell finished goods
   - Create sales invoice
   - Add items, quantities, rates
   - Post invoice (creates ledger entries)
   - Reduce finished goods stock
   - Increase customer balance

### **2. Direct Sale Flow**
1. **Purchase** raw materials
2. **Direct Sale** (skip production)
   - Select purchase batch
   - Enter quantity/weight to sell
   - Create sales invoice
   - Post invoice (creates ledger entries)
   - Reduce raw material stock
   - Increase customer balance

### **3. Multi-Currency Transactions**
- All transactions support foreign currencies
- Exchange rates stored per transaction
- Base currency (USD) used for accounting
- Foreign currency amounts stored for display
- Automatic conversion to USD for ledger entries

### **4. Inventory Valuation**
- **Raw Materials:** FIFO cost from purchases
- **Finished Goods:** Production cost (avgCost per item)
- **WIP:** FIFO consumption from original openings
- **Stock Adjustments:** Manual adjustments via IA/IAO vouchers

---

## 🛠️ **TECHNICAL IMPLEMENTATION**

### **Technology Stack**
- **Frontend:** React 19.2.0, TypeScript 5.8.2
- **Build Tool:** Vite 6.2.0
- **Backend:** Firebase (Firestore)
- **Authentication:** Custom (username/password)
- **State Management:** React Context API + useReducer
- **Routing:** React Router DOM 7.9.6
- **Charts:** Recharts 3.5.0
- **CSV Processing:** PapaParse 5.5.3
- **AI Integration:** Google Gemini API (@google/genai 1.30.0)

### **Data Storage**
- **Firebase Firestore Collections:**
  - factories, users
  - partners, accounts, items
  - purchases, bundlePurchases
  - originalOpenings, productions
  - salesInvoices, ongoingOrders
  - ledger (ledgerEntries)
  - logisticsEntries
  - employees, attendance, salaryPayments
  - tasks, enquiries, vehicles
  - chatMessages
  - planners
  - guaranteeCheques, customsDocuments
  - currencies
  - originalTypes, originalProducts, categories, sections
  - divisions, subDivisions, logos, warehouses, ports

### **Key Features**
- **Real-time Updates:** Firebase onSnapshot listeners
- **Batch Operations:** Firebase batch writes for performance
- **CSV Import/Export:** Bulk data operations
- **Multi-Factory Support:** Factory-based data isolation
- **Role-Based Access Control:** Permission-based module access
- **Double-Entry Accounting:** Enforced balance validation
- **Multi-Currency:** Full foreign currency support
- **FIFO Inventory:** First-In-First-Out cost calculation
- **Serial Number Tracking:** Auto-increment for tracked items
- **Archive System:** Deleted transactions archived
- **Backup System:** Automated daily backups

---

## 📝 **IMPORTANT NOTES FOR REDESIGN**

### **Known Issues to Address**
1. **Accounting Flow Complexity:**
   - Multiple entry points for same transaction type
   - Complex WIP consumption logic
   - Balance discrepancy handling
   - Account ID mismatches in some flows

2. **Data Integrity:**
   - Some transactions may have missing ledger entries
   - Balance sheet imbalances possible
   - Partner balance calculation inconsistencies

3. **Performance:**
   - Large ledger datasets (10k+ entries)
   - Filtering and sorting performance
   - Real-time updates on large datasets

4. **User Experience:**
   - Complex forms with many fields
   - Multiple steps for simple operations
   - Limited validation feedback

### **Recommendations for Redesign**
1. **Simplify Accounting Flows:**
   - Single entry point per transaction type
   - Clear separation of concerns
   - Automated ledger entry creation
   - Better error handling and validation

2. **Improve Data Model:**
   - Normalize data structures
   - Clear relationships between entities
   - Consistent ID patterns
   - Better indexing strategy

3. **Enhance User Experience:**
   - Simplified forms
   - Better validation and error messages
   - Progressive disclosure
   - Clear workflow guidance

4. **Performance Optimization:**
   - Pagination for large datasets
   - Virtual scrolling
   - Optimistic updates
   - Caching strategy

5. **Better Testing:**
   - Unit tests for accounting logic
   - Integration tests for workflows
   - E2E tests for critical paths

---

## 🎯 **CONCLUSION**

This application is a comprehensive ERP system for the used clothing/textile industry with:
- **Multi-factory support** with independent operations
- **Complete double-entry accounting** system
- **Production management** with grading and sorting
- **Inventory management** for raw materials and finished goods
- **Sales and purchase** management
- **Logistics and customs** tracking
- **HR and payroll** management
- **Comprehensive reporting** and analytics

The system handles complex business flows with multi-currency support, FIFO inventory costing, and automated ledger entry creation. However, the accounting flows have become complex over time and would benefit from simplification and better structure in a redesign.

---

**End of Specification Document**
