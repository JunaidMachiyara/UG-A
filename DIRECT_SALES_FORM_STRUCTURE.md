# Direct Sales Form - Complete Structure Guide
## For New App Construction

**Module:** Data Entry > Sales > Direct Sales

---

## 📋 **OVERVIEW**

The Direct Sales form allows users to record sales of raw materials directly to customers without processing them into finished goods. Unlike Sales Invoice (which sells finished goods), Direct Sales sells raw materials from purchased batches. The form supports **multi-currency transactions** and creates a sales invoice automatically when recorded. Each direct sale is a single transaction (not cart-based), but users can record multiple sales in sequence.

**Key Purpose:**
- Sell raw materials directly to customers
- Track sales by batch (links to original purchase)
- Support multi-currency transactions
- Calculate profit (sale price - landed cost)
- Create accounting entries (Sales Revenue, Customer AR, COGS, Raw Material Inventory)
- Update raw material stock quantities

**Key Difference from Other Forms:**
- **Sales Invoice:** Sells finished goods (uses cart system)
- **Direct Sales:** Sells raw materials directly (single sale per transaction)
- **Original Purchase:** Buys raw materials (adds to inventory)
- **Original Opening:** Consumes raw materials (moves to WIP)

---

## 🔄 **SINGLE-SALE LOOP PROCESS** ⭐ **KEY FEATURE**

The Direct Sales form uses a **single-sale workflow** where each transaction records one sale. Users can record multiple sales in sequence, creating a loop process.

### **Process Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Date: [YYYY-MM-DD]                                  │  │
│  │  Customer: [Dropdown]                                │  │
│  │  Customer Currency: [Auto] (Read-only)              │  │
│  │  Exchange Rate: [Auto] (Editable)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Select Stock Section:                               │  │
│  │  Supplier: [Dropdown]                               │  │
│  │  Batch Number: [Dropdown] (Available Stock)         │  │
│  │  [Shows: Landed Cost/Kg, Available Stock]          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Quantity (Kg): [Number Input]                       │  │
│  │  Sale Rate (USD/Kg): [Number Input]                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│            handleRecordDirectSale()                         │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              VALIDATION & CALCULATION                 │  │
│  │  • Validate required fields                          │  │
│  │  • Check stock availability                          │  │
│  │  • Calculate totals                                  │  │
│  │  • Calculate profit (sale - cost)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              DATABASE & ACCOUNTING                     │  │
│  │  • Create Sales Invoice (DS- prefix)                 │  │
│  │  • Create Ledger Entries                             │  │
│  │  • Update Raw Material Stock                         │  │
│  │  • Link to Original Purchase Batch                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│                    Form Cleared                            │
│                    Ready for Next Sale                     │
└─────────────────────────────────────────────────────────────┘
```

### **Loop Process Steps:**

1. **User Sets Date:**
   - Selects sale date (defaults to today)

2. **User Selects Customer:**
   - Selects customer from dropdown
   - Customer currency auto-populates (from customer's `defaultCurrency`)
   - Exchange rate auto-populates (from currency setup)
   - User can manually update exchange rate if needed

3. **User Selects Stock:**
   - Selects supplier (filters available batches)
   - Selects batch number (shows available stock)
   - System displays:
     - Landed Cost per Kg
     - Available stock (remaining weight)

4. **User Enters Sale Details:**
   - Enters quantity (Kg)
   - Enters sale rate (USD per Kg)
   - System calculates:
     - Net Total = Quantity × Rate
     - Profit = Net Total - (Quantity × Landed Cost/Kg)

5. **User Clicks "Record Direct Sale":**
   - System validates:
     - Customer selected
     - Batch selected
     - Quantity entered
     - Rate entered
     - Stock availability (quantity ≤ available stock)
   - Creates sales invoice automatically
   - Creates ledger entries
   - Updates stock quantities
   - Shows success message
   - Clears form (ready for next sale)

6. **Loop Continues:**
   - Form ready for next direct sale
   - Process repeats from Step 1

---

## 💱 **MULTI-CURRENCY SUPPORT** ⭐ **KEY FEATURE**

The Direct Sales form provides multi-currency support with automatic conversion to base currency (USD) for accounting while preserving customer currency for display.

### **Currency Architecture:**

**1. Base Currency (USD):**
- All accounting entries stored in USD
- Sale rate entered in USD
- Ledger entries use USD amounts
- Ensures consistent accounting

**2. Customer Default Currency:**
- Auto-populated from customer's `defaultCurrency` field
- Used for display in ledger narration
- Stored in invoice as `customerCurrency` and `customerExchangeRate`
- Shown for reference only (not used for rate entry)

**3. Rate Entry:**
- **Always in USD:** Sale rate is always entered in USD per Kg
- **No Conversion:** Unlike Sales Invoice, there's no currency toggle
- **Display:** Customer currency shown for ledger reference only

### **Currency Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│  Customer Selected                                           │
│                          ↓                                  │
│  Customer Currency Auto-Populated                            │
│  (from customer.defaultCurrency)                            │
│                          ↓                                  │
│  Exchange Rate Auto-Populated                               │
│  (from currency setup or fallback)                          │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Rate Entry:                                         │  │
│  │  • Always in USD                                     │  │
│  │  • Label: "Sale Rate (USD / Kg)"                   │  │
│  │  • No currency toggle                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  Invoice Created:                                           │
│  • currency: 'USD' (always)                                │
│  • exchangeRate: 1 (always)                                │
│  • customerCurrency: {customerCurrency} (for display)     │
│  • customerExchangeRate: {exchangeRate} (for display)     │
│                          ↓                                  │
│  Ledger Entries:                                            │
│  • All amounts in USD                                      │
│  • Narration shows customer currency for reference         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ **FORM STRUCTURE**

The form is divided into **5 main sections**:

1. **Mode Toggle** (New Direct Sale / View / Update)
2. **Basic Sale Information** (Date, Customer, Currency)
3. **Stock Selection** (Supplier, Batch, Stock Info) ⭐ **BATCH SELECTION**
4. **Sale Details** (Quantity, Rate)
5. **View / Update Mode** (List and delete existing direct sales)

---

## 📝 **SECTION-BY-SECTION BREAKDOWN**

### **SECTION 1: MODE TOGGLE**

**Purpose:** Switch between creating new direct sales and viewing existing ones

**Layout:** Horizontal tabs with underline indicator

**Components:**
- **"New Direct Sale" Button:** Switches to create mode (shows form)
- **"View / Update" Button:** Switches to view mode (shows list of direct sales)
- **Active State:** Blue text with blue bottom border
- **Inactive State:** Gray text

**Behavior:**
- When switching to "New Direct Sale": Clears form, resets all fields
- When switching to "View / Update": Shows filtered list of direct sales

---

### **SECTION 2: BASIC SALE INFORMATION**

**Purpose:** Basic sale identification and customer details

**Layout:** 2-column grid

#### **2.1 Date**

- **Type:** Date Picker
- **Default Value:** Today's date
- **Format:** YYYY-MM-DD
- **Required:** Yes
- **Purpose:** Direct sale transaction date
- **Layout:** First column in 2-column grid

#### **2.2 Customer**

- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only CUSTOMER partners
- **Required:** Yes
- **Quick Add:** Not available (must add via Setup)
- **Behavior:**
  - When selected, auto-populates customer currency and exchange rate
- **Layout:** Second column in 2-column grid

---

### **SECTION 3: STOCK SELECTION** ⭐ **BATCH SELECTION**

**Purpose:** Select raw material batch to sell from available stock

**Layout:** Gray background box (slate-50), border, padding, rounded corners

#### **3.1 Section Header**

- **Title:** "Select Stock" (bold, uppercase, small text, slate-700)
- **Layout:** Margin bottom

#### **3.2 Supplier Selection**

- **Type:** Dropdown Selector (EntitySelector)
- **Label:** "Supplier"
- **Options:** Filtered to show only SUPPLIER partners
- **Required:** Yes (to show batches)
- **Purpose:** Filter batches by supplier
- **Behavior:**
  - When selected, filters available batches to those from this supplier
  - Clears batch selection when changed
- **Layout:** Full width, margin bottom

#### **3.3 Batch Number Selection**

- **Type:** Dropdown Selector (EntitySelector)
- **Label:** "Batch Number (Available Stock)"
- **Options:** Filtered to show only batches with remaining stock > 0.01 kg (`dsBatches`)
- **Required:** Yes (to record sale)
- **Disabled When:** No supplier selected
- **Placeholder:** "Select Batch..." or "Select Supplier First"
- **Display Format:** Shows batch number with remaining stock (e.g., "BATCH-001 (500 Kg)")
- **Behavior:**
  - Only shows batches with available stock
  - Filters by selected supplier
  - Calculates remaining stock: `weightPurchased - opened - sold - directSold - iaoAdjustments`
- **Layout:** Full width, margin bottom

#### **3.4 Batch Information Display**

**Layout:** White background box with blue border, flex layout, margin top

**Display Condition:** Only shown when batch is selected (`dsSelectedBatch`)

**Components:**

**Left Side:**
- **Label:** "Landed Cost / Kg" (small text, uppercase, slate-500)
- **Value:** Shows landed cost per Kg (large, monospace, bold, slate-800)
- **Format:** `$${landedCostPerKg.toFixed(3)}`
- **Source:** From selected batch's `landedCostPerKg`

**Right Side:**
- **Label:** "Available" (small text, uppercase, slate-500)
- **Value:** Shows remaining stock (large, bold, emerald-600)
- **Format:** `{remaining.toLocaleString()} Kg`
- **Source:** From selected batch's `remaining` weight

**Purpose:** Shows key information about selected batch before sale

---

### **SECTION 4: SALE DETAILS**

**Purpose:** Enter quantity and sale rate

**Layout:** 2-column grid

#### **4.1 Quantity (Kg)**

- **Type:** Number Input
- **Label:** "Quantity (Kg)"
- **Required:** Yes
- **Purpose:** Quantity of raw material to sell (in kilograms)
- **Validation:** 
  - Must be > 0
  - Must be ≤ available stock (shows alert if exceeds)
- **Style:** Bold font
- **Layout:** First column in 2-column grid

#### **4.2 Sale Rate (USD / Kg)**

- **Type:** Number Input
- **Label:** "Sale Rate (USD / Kg)"
- **Required:** Yes
- **Purpose:** Sale price per kilogram in USD
- **Validation:** Must be valid number (not NaN)
- **Style:** Bold font
- **Layout:** Second column in 2-column grid

**Note:** Rate is always entered in USD (unlike Sales Invoice which has currency toggle)

---

### **SECTION 5: CUSTOMER CURRENCY DISPLAY** ⭐ **MULTI-CURRENCY**

**Purpose:** Display customer currency and exchange rate for ledger reference

**Layout:** 2-column grid, gray background box (slate-50), border, padding

#### **5.1 Customer Currency**

- **Type:** Text Input (Read-only)
- **Label:** "Customer Currency" (small text, uppercase, slate-500)
- **Purpose:** Display customer's default currency (for reference)
- **Auto-Population:** From customer's `defaultCurrency` field
- **Style:** Gray background (slate-100), monospace font, small text, bold
- **Helper Text:** "For ledger display" (small text, gray)
- **Layout:** First column in 2-column grid

#### **5.2 Exchange Rate**

- **Type:** Number Input
- **Label:** "Exchange Rate" (small text, uppercase, slate-500)
- **Purpose:** Exchange rate from customer currency to USD (for ledger display)
- **Auto-Population:** From currency setup when customer selected
- **Editable:** Yes (user can override)
- **Step:** 0.0001 (allows decimal precision)
- **Helper Text:** "Update if needed" (small text, gray)
- **Style:** Monospace font, small text
- **Layout:** Second column in 2-column grid

**Exchange Rate Auto-Population Logic:**
```typescript
// When customer selected:
1. Get customer's defaultCurrency
2. Find currency in state.currencies
3. If found: Use currency.exchangeRate
4. If not found: Use fallback EXCHANGE_RATES[currency] || 1
5. Set dsExchangeRate
```

---

### **SECTION 6: RECORD DIRECT SALE BUTTON**

**Purpose:** Record the direct sale and create invoice

**Layout:** Full width, margin top

#### **6.1 Record Direct Sale Button**

- **Type:** Button
- **Label:** "Record Direct Sale"
- **Icon:** Truck icon (left side)
- **Color:** Blue background (blue-600), white text
- **Disabled When:**
  - Batch not selected (`!dsSelectedBatch`)
  - Quantity not entered (`!dsQty`)
- **Action:**
  - Calls `handleRecordDirectSale()`
  - Validates required fields
  - Checks stock availability
  - Calculates totals and profit
  - Creates sales invoice automatically
  - Creates ledger entries
  - Updates stock quantities
  - Clears form
  - Shows success message
- **Style:** Full width, bold font, large padding, rounded corners, shadow, hover effect, disabled state (slate-300)

---

### **SECTION 7: VIEW / UPDATE MODE**

**Purpose:** List and manage existing direct sales

**Layout:** White background box, border, overflow hidden

#### **7.1 Direct Sales Table**

**Layout:** Full width table

**Columns:**
- **Date:** Sale date
- **Invoice #:** Invoice number (monospace, bold, blue) - starts with "DS-" or "DSINV-"
- **Customer:** Customer name
- **Qty (Kg):** Quantity sold (right-aligned, monospace)
- **Net Total:** Net total amount (right-aligned, monospace, shows currency)
- **Status:** Status badge (Unposted = yellow, Posted = emerald)
- **Actions:** Delete button

**7.1.1 Filtering Logic:**

**Direct Sales Identification:**
- Invoice number starts with "DS-" or "DSINV-"
- OR invoice items have `originalPurchaseId` field (links to raw material batch)

**7.1.2 Delete Action**
- **Button:** Trash icon (red)
- **Confirmation:** Requires Master Key (Supervisor PIN)
- **Message:** "Delete this sales invoice? This will reverse all accounting entries (restore Finished Goods, Customer AR, and Sales Revenue)."
- **Action:** Deletes invoice and reverses all ledger entries

---

## 🔄 **SINGLE-SALE LOOP PROCESS - DETAILED WORKFLOW**

### **Step 1: User Sets Date**

User selects sale date:
- Defaults to today
- Format: YYYY-MM-DD

### **Step 2: User Selects Customer**

User selects customer from dropdown:

**2.1 Auto-Population:**
- Customer currency auto-populates from `customer.defaultCurrency`
- Exchange rate auto-populates from currency setup

**2.2 Currency Display:**
- Customer currency shown in read-only field
- Exchange rate shown (editable)
- User can manually update exchange rate if needed

### **Step 3: User Selects Stock**

User selects supplier and batch:

**3.1 Select Supplier:**
- Selects supplier from dropdown
- Filters available batches to those from this supplier
- Clears batch selection

**3.2 Select Batch:**
- Selects batch from dropdown
- Only shows batches with remaining stock > 0.01 kg
- Displays batch information:
  - Landed Cost per Kg
  - Available stock (remaining weight)

**3.3 Batch Filtering Logic:**

**Available Batches Calculation:**
```typescript
// Filter purchases by supplier
const matchingPurchases = purchases.filter(p => p.supplierId === supplierId);

// For each purchase, calculate remaining stock
const remaining = weightPurchased - opened - sold - directSold - iaoAdjustments;

// Only show if remaining > 0.01 kg
return remaining > 0.01;
```

**Remaining Stock Calculation:**
```typescript
// Weight purchased
const weightPurchased = purchase.weightPurchased;

// Weight opened (consumed in production)
const opened = originalOpenings
    .filter(o => o.batchNumber === purchase.batchNumber && /* other criteria */)
    .reduce((sum, o) => sum + o.weightOpened, 0);

// Weight sold (via sales invoices)
const sold = salesInvoices
    .filter(inv => inv.status === 'Posted')
    .reduce((sum, inv) => {
        return sum + inv.items
            .filter(i => i.originalPurchaseId === purchase.id)
            .reduce((is, item) => is + item.totalKg, 0);
    }, 0);

// Weight sold via direct sales
const directSold = directSales
    .filter(ds => ds.batchId === purchase.id && ds.supplierId === supplierId)
    .reduce((sum, ds) => sum + ds.quantity, 0);

// IAO adjustments (Inventory Adjustment Original)
const iaoAdjustments = /* calculate from ledger entries */;

// Remaining stock
const remaining = weightPurchased - opened - sold - directSold - iaoAdjustments;
```

### **Step 4: User Enters Sale Details**

User enters quantity and rate:

**4.1 Enter Quantity:**
- Enters quantity in Kg
- Must be > 0
- Must be ≤ available stock (validated on submit)

**4.2 Enter Sale Rate:**
- Enters rate in USD per Kg
- Always in USD (no currency toggle)
- Must be valid number

### **Step 5: User Clicks "Record Direct Sale"**

**5.1 Validation:**
- Customer must be selected
- Batch must be selected
- Quantity must be entered and > 0
- Rate must be entered and valid number
- Quantity must be ≤ available stock

**5.2 Calculations:**

**Net Total:**
```typescript
const netTotal = qty * rate;
```

**Raw Material Cost:**
```typescript
const landedCostPerKg = selectedBatch.landedCostPerKg;
const totalRawMaterialCost = qty * landedCostPerKg;
```

**Profit:**
```typescript
const profit = netTotal - totalRawMaterialCost;
```

**5.3 Create Sales Invoice:**

**Generate Invoice Number:**
```typescript
// Find max existing DS invoice number
const maxDsInv = salesInvoices
    .map(i => i.invoiceNo.startsWith('DS-') 
        ? parseInt(i.invoiceNo.replace('DS-', '')) 
        : 0)
    .filter(n => !isNaN(n))
    .reduce((max, curr) => curr > max ? curr : max, 1000);
const nextDsInvNo = `DS-${maxDsInv + 1}`;
```

**Create Invoice Item:**
```typescript
const invoiceItem: SalesInvoiceItem = {
    id: Math.random().toString(36).substr(2, 9),
    itemId: 'DS-001', // Special item ID for direct sales
    itemName: `Direct Sale - ${selectedBatch.purchase.originalType}`,
    qty: qty, // Quantity in Kg (1 unit = 1 kg for direct sales)
    rate: rate, // Rate in USD per Kg
    total: netTotal, // Total in USD
    totalKg: qty, // Total weight (same as quantity)
    originalPurchaseId: purchaseId // Link to original purchase batch
};
```

**Create Invoice:**
```typescript
const invoice: SalesInvoice = {
    id: Math.random().toString(36).substr(2, 9),
    invoiceNo: nextDsInvNo, // e.g., "DS-1001"
    date: dsDate,
    status: 'Posted', // Direct sales are posted immediately
    customerId: dsCustomer,
    factoryId: state.currentFactory?.id || '',
    logoId: state.logos[0]?.id || '', // Default logo
    currency: 'USD', // Always USD for accounting
    exchangeRate: 1, // USD base
    customerCurrency: dsCurrency, // Customer currency for display
    customerExchangeRate: dsExchangeRate, // Exchange rate for display
    discount: 0,
    surcharge: 0,
    items: [invoiceItem], // Single item (not cart-based)
    additionalCosts: [],
    grossTotal: netTotal,
    netTotal: netTotal
};
```

**5.4 Update Stock:**
```typescript
// If batch has originalProductId, update raw material item stock
if (selectedBatch.purchase.originalProductId) {
    const rawMaterialItem = items.find(i => i.id === selectedBatch.purchase.originalProductId);
    if (rawMaterialItem) {
        updateStock(rawMaterialItem.id, -qty); // Decrease stock
    }
}
```

**5.5 Save Invoice:**
- Calls `addDirectSale(invoice, landedCostPerKg)`
- Saves to Firebase
- Creates ledger entries (via accounting logic)
- Updates stock quantities

**5.6 Clear Form:**
- Clears quantity (`setDsQty('')`)
- Clears rate (`setDsRate('')`)
- Clears batch selection (`setDsPurchaseId('')`)
- Keeps customer and date (for next sale)
- Shows success message

### **Step 6: Loop Continues**

Form ready for next sale:
- Date and customer remain selected
- User can select different batch
- Process repeats from Step 3

---

## 💱 **MULTI-CURRENCY SUPPORT - DETAILED**

### **Currency Architecture:**

**1. Base Currency (USD):**
- **Purpose:** All accounting entries stored in USD
- **Why:** Ensures consistent accounting and balance sheet calculations
- **Storage:** All `rate`, `total`, `grossTotal`, `netTotal` fields in USD

**2. Customer Default Currency:**
- **Source:** Customer's `defaultCurrency` field
- **Purpose:** Display in ledger narration for reference
- **Storage:** Stored as `customerCurrency` and `customerExchangeRate` in invoice
- **Display:** Shown in ledger narration (e.g., "Direct Sale: DS-1001 - Customer Name (AED 500.00)")

**3. Rate Entry:**
- **Always USD:** Sale rate is always entered in USD per Kg
- **No Toggle:** Unlike Sales Invoice, there's no currency toggle
- **Label:** "Sale Rate (USD / Kg)"
- **Purpose:** Simplifies direct sales (raw materials typically priced in USD)

### **Currency Flow:**

**When Customer Selected:**
```
Customer Selected: "ABC Customer" (defaultCurrency: "AED")
                ↓
Customer Currency Auto-Populated: "AED"
Exchange Rate Auto-Populated: 3.67
                ↓
Rate Entry Field Shows: "Sale Rate (USD / Kg)"
User Enters: 2.50 USD/Kg
                ↓
Invoice Created:
  - currency: 'USD'
  - exchangeRate: 1
  - customerCurrency: 'AED'
  - customerExchangeRate: 3.67
  - rate: 2.50 USD
  - total: 250.00 USD (for 100 Kg)
                ↓
Ledger Entry Narration:
  "Direct Sale: DS-1001 - ABC Customer (AED 917.50)"
  (250.00 USD × 3.67 = 917.50 AED)
```

### **Currency Display:**

**In Form:**
- Customer Currency: Read-only display (for reference)
- Exchange Rate: Editable (user can update)
- Rate Entry: Always shows "USD / Kg"

**In Ledger:**
- All amounts in USD
- Narration shows customer currency for reference
- Format: "Direct Sale: {invoiceNo} - {customerName} ({customerCurrency} {amountFCY})"

---

## 📊 **DATA STRUCTURE**

### **Direct Sale Invoice Item:**

```typescript
interface SalesInvoiceItem {
    id: string;                    // Unique identifier (random string)
    itemId: string;                // Always 'DS-001' for direct sales
    itemName: string;              // Format: "Direct Sale - {originalType}"
    qty: number;                   // Quantity in Kg (1 unit = 1 kg)
    rate: number;                   // Rate per Kg (ALWAYS in USD)
    total: number;                  // Total (ALWAYS in USD)
    totalKg: number;                // Total weight (same as qty)
    originalPurchaseId: string;    // Link to original purchase batch ID
}
```

### **Direct Sale Invoice:**

```typescript
interface SalesInvoice {
    id: string;                     // Unique identifier
    invoiceNo: string;              // Invoice number (e.g., "DS-1001")
    date: string;                   // Sale date (YYYY-MM-DD)
    status: 'Posted';               // Always 'Posted' (posted immediately)
    
    customerId: string;             // Customer partner ID
    factoryId: string;             // Factory assignment
    logoId: string;                // Logo ID (default logo)
    
    // Financials (Accounting - Always USD)
    currency: Currency;            // Always 'USD' for accounting
    exchangeRate: number;          // Always 1 for USD
    
    // Customer Currency (for display)
    customerCurrency?: Currency;   // Customer's default currency
    customerExchangeRate?: number; // Exchange rate (customer currency to USD)
    
    discount: number;              // Always 0 for direct sales
    surcharge: number;             // Always 0 for direct sales
    
    items: SalesInvoiceItem[];     // Single item array (not cart)
    additionalCosts: [];           // Always empty for direct sales
    
    grossTotal: number;            // Gross total (USD) = netTotal
    netTotal: number;              // Net total (USD)
}
```

### **Batch Selection Object:**

```typescript
interface BatchOption {
    id: string;                    // Purchase ID
    name: string;                  // Format: "Batch #{batchNumber} ({remaining} Kg)"
    remaining: number;             // Remaining stock in Kg
    landedCostPerKg: number;      // Landed cost per Kg (USD)
    purchase: Purchase;            // Original purchase object
}
```

---

## 🎯 **KEY CALCULATIONS**

### **Remaining Stock Calculation:**

```typescript
// For each purchase batch:
const remaining = weightPurchased - opened - sold - directSold - iaoAdjustments;

// Where:
// - weightPurchased: From purchase record
// - opened: Sum of originalOpenings for this batch
// - sold: Sum of salesInvoices items with originalPurchaseId = purchase.id
// - directSold: Sum of directSales for this batch
// - iaoAdjustments: Inventory Adjustment Original entries from ledger
```

### **Net Total Calculation:**

```typescript
const netTotal = qty * rate;
// Example: 100 Kg × $2.50/Kg = $250.00
```

### **Raw Material Cost Calculation:**

```typescript
const totalRawMaterialCost = qty * landedCostPerKg;
// Example: 100 Kg × $1.50/Kg = $150.00
```

### **Profit Calculation:**

```typescript
const profit = netTotal - totalRawMaterialCost;
// Example: $250.00 - $150.00 = $100.00 profit
```

### **Invoice Number Generation:**

```typescript
// Find max existing DS invoice number
const maxDsInv = salesInvoices
    .map(i => {
        if (i.invoiceNo.startsWith('DS-')) {
            return parseInt(i.invoiceNo.replace('DS-', ''));
        }
        return 0;
    })
    .filter(n => !isNaN(n))
    .reduce((max, curr) => curr > max ? curr : max, 1000);

// Generate next number
const nextDsInvNo = `DS-${maxDsInv + 1}`;
// Example: If max is DS-1000, next is DS-1001
```

---

## ✅ **VALIDATION RULES**

### **Before Recording Sale:**

- ✅ **Customer:** Must be selected
- ✅ **Supplier:** Must be selected (to show batches)
- ✅ **Batch:** Must be selected
- ✅ **Quantity:** Must be entered and > 0
- ✅ **Rate:** Must be entered and valid number (not NaN)
- ✅ **Stock Availability:** Quantity must be ≤ available stock
  - Shows alert: "Insufficient stock! Max available: {remaining} Kg"

### **Stock Validation:**

- ✅ **Batch Must Have Stock:** Only batches with remaining > 0.01 kg are shown
- ✅ **Quantity Check:** Validates quantity doesn't exceed available stock
- ✅ **Real-Time Calculation:** Remaining stock calculated from:
  - Purchased weight
  - Minus opened weight
  - Minus sold weight (sales invoices)
  - Minus direct sold weight
  - Minus IAO adjustments

---

## 🔍 **BATCH SELECTION LOGIC**

### **Batch Filtering:**

**Step 1: Filter by Supplier**
```typescript
const matchingPurchases = purchases.filter(p => p.supplierId === supplierId);
```

**Step 2: Calculate Remaining Stock for Each Purchase**

**2.1 Calculate Opened Weight:**
```typescript
const opened = originalOpenings
    .filter(o => {
        // Match batch number and supplier
        if (o.batchNumber !== purchase.batchNumber || o.supplierId !== supplierId) return false;
        
        // For multi-item purchases, check if opening's originalType matches any item
        if (purchase.items && purchase.items.length > 0) {
            return purchase.items.some(item => {
                const itemTypeId = item.originalTypeId || item.originalType;
                return o.originalType === itemTypeId || 
                       o.originalType === item.originalType ||
                       (originalTypes.find(t => t.id === itemTypeId)?.name === o.originalType);
            });
        }
        // For legacy purchases, check top-level originalType
        const purchaseTypeId = purchase.originalTypeId || purchase.originalType;
        return o.originalType === purchaseTypeId ||
               (originalTypes.find(t => t.id === purchaseTypeId)?.name === o.originalType);
    })
    .reduce((sum, o) => sum + o.weightOpened, 0);
```

**2.2 Calculate Sold Weight (Sales Invoices):**
```typescript
const sold = salesInvoices
    .filter(inv => inv.status === 'Posted')
    .reduce((sum, inv) => {
        return sum + inv.items
            .filter(i => i.originalPurchaseId === purchase.id)
            .reduce((is, item) => is + item.totalKg, 0);
    }, 0);
```

**2.3 Calculate Direct Sold Weight:**
```typescript
const directSold = directSales
    .filter(ds => ds.batchId === purchase.id && ds.supplierId === supplierId)
    .reduce((sum, ds) => sum + ds.quantity, 0);
```

**2.4 Calculate IAO Adjustments:**
```typescript
const iaoAdjustments = ledger
    .filter(entry => entry.transactionType === 'INVENTORY_ADJUSTMENT')
    .filter(entry => {
        if (!entry.narration) return false;
        const narration = entry.narration.toLowerCase();
        if (!narration.includes('original stock')) return false;
        if (supplierName && !narration.includes(supplierName.toLowerCase())) return false;
        // Match original type names
        if (!purchaseTypeNames.some(typeName => narration.includes(typeName.toLowerCase()))) return false;
        // Match batch number if specified
        if (purchase.batchNumber && !narration.includes(`batch: ${purchase.batchNumber}`.toLowerCase())) {
            if (narration.includes('batch:')) return false;
        }
        return true;
    })
    .reduce((acc, entry) => {
        const weightMatch = entry.narration.match(/Weight:\s*([+-]?\d+\.?\d*)\s*kg/i);
        if (weightMatch && weightMatch[1] !== 'N/A') {
            const weightAdjustment = parseFloat(weightMatch[1]);
            if (!isNaN(weightAdjustment)) {
                acc += weightAdjustment;
            }
        }
        return acc;
    }, 0);
```

**2.5 Calculate Remaining:**
```typescript
const remaining = purchase.weightPurchased - opened - sold - directSold - iaoAdjustments;
```

**Step 3: Filter and Format**
```typescript
// Only show batches with remaining > 0.01 kg
const batchesWithStock = matchingPurchases.filter(p => remaining > 0.01);

// Format for dropdown
return batchesWithStock.map(p => ({
    id: p.id, // Purchase ID
    name: `Batch #${p.batchNumber} (${remaining.toLocaleString()} Kg)`,
    remaining: remaining,
    landedCostPerKg: p.landedCostPerKg,
    purchase: p
}));
```

---

## 🔄 **ACCOUNTING IMPACT**

### **When Direct Sale is Recorded:**

**1. Sales Invoice Created:**
- Invoice number: "DS-{number}" (e.g., "DS-1001")
- Status: 'Posted' (posted immediately)
- Single item linked to original purchase batch

**2. Ledger Entries Created:**

**Entry 1: Debit Customer Account**
```
Account: Customer AR Account (direct debit to customer)
Debit: netTotalUSD
Credit: 0
Narration: "Direct Sale: {invoiceNo} - {customerName} ({customerCurrency} {netTotalFCY})"
```

**Entry 2: Credit Sales Revenue**
```
Account: Sales Revenue Account
Debit: 0
Credit: grossTotalUSD
Narration: "Direct Sale: {invoiceNo} - {customerName}"
```

**Entry 3: Debit Cost of Goods Sold - Direct Sales**
```
Account: COGS - Direct Sales Account
Debit: totalRawMaterialCost
Credit: 0
Narration: "Cost of Direct Sale: {invoiceNo} ({qty}kg)"
```

**Entry 4: Credit Raw Material Inventory**
```
Account: Inventory - Raw Material Account
Debit: 0
Credit: totalRawMaterialCost
Narration: "Direct Sale: {invoiceNo} - {originalType} ({qty}kg)"
```

**3. Inventory Impact:**
- Raw Material inventory decreases
- Item stock quantity updated (if batch has originalProductId)
- Available stock for batch decreases

**4. Balance Sheet Impact:**
- Customer AR increases
- Sales Revenue increases (P&L)
- COGS increases (P&L, reduces profit)
- Raw Material Inventory decreases
- Net Income increases (if profit positive)

---

## 🎨 **UI/UX DESIGN NOTES**

### **Visual Hierarchy:**

- **Primary Actions:** Blue button (Record Direct Sale)
- **Secondary Actions:** Red buttons (Delete)
- **Information Boxes:** Gray backgrounds with borders
- **Batch Info:** Blue border for emphasis

### **Form Layout:**

- **Grid System:** 2-column grid for date/customer, quantity/rate
- **Responsive:** Adapts to screen size
- **Spacing:** Consistent padding and margins
- **Grouping:** Related fields grouped logically

### **Multi-Currency Visual Indicators:**

- **Currency Labels:** Clear currency labels
- **Read-only Display:** Customer currency shown in gray (read-only)
- **Rate Label:** Always shows "USD / Kg" (no confusion)

### **Feedback:**

- **Disabled States:** Gray background when disabled
- **Required Fields:** Visual indicators
- **Stock Validation:** Clear error message if insufficient stock
- **Success:** Success message on save
- **Batch Info:** Clear display of cost and availability

### **Accessibility:**

- **Labels:** Clear, descriptive labels
- **Placeholders:** Helpful placeholder text
- **Disabled States:** Clear when fields are disabled
- **Error Messages:** Clear validation feedback

---

## 🔍 **EDGE CASES & SPECIAL BEHAVIORS**

### **1. Insufficient Stock**

- **Validation:** Checks if quantity > available stock
- **Alert:** "Insufficient stock! Max available: {remaining} Kg"
- **Action:** User must reduce quantity or select different batch

### **2. Batch Without Stock**

- **Filtering:** Batches with remaining ≤ 0.01 kg are not shown
- **Behavior:** User cannot select batches without stock

### **3. Customer Without Default Currency**

- **Fallback:** Uses USD
- **Exchange Rate:** Set to 1
- **Display:** Shows USD in customer currency field

### **4. Batch Selection After Supplier Change**

- **Behavior:** Batch selection cleared when supplier changes
- **Reason:** Batches are supplier-specific

### **5. Invoice Number Generation**

- **Starting Point:** Starts at DS-1001 (if no existing DS invoices)
- **Increment:** Finds max existing number and adds 1
- **Format:** Always "DS-{number}"

### **6. Stock Update**

- **Condition:** Only updates if batch has `originalProductId`
- **Action:** Decreases raw material item stock by quantity sold
- **Purpose:** Maintains item-level stock tracking

### **7. Immediate Posting**

- **Behavior:** Direct sales are posted immediately (status: 'Posted')
- **Reason:** No need for review/approval (simpler workflow)
- **Difference:** Unlike Sales Invoice which starts as 'Unposted'

---

## 💡 **DESIGN RECOMMENDATIONS FOR NEW APP**

### **1. Single-Sale Workflow**

- Keep form simple (no cart needed)
- Clear batch selection
- Show stock information prominently
- Allow quick entry for multiple sales

### **2. Batch Selection**

- Filter by supplier clearly
- Show available stock prominently
- Display landed cost for reference
- Prevent selection of batches without stock

### **3. Multi-Currency Support**

- Auto-populate customer currency
- Show exchange rate clearly
- Keep rate entry in USD (simpler)
- Display customer currency for reference

### **4. Stock Validation**

- Validate stock availability
- Show clear error messages
- Display available stock prominently
- Prevent over-selling

### **5. Profit Calculation**

- Calculate profit automatically
- Show profit in confirmation (if needed)
- Use landed cost from batch
- Track profit in accounting

---

## 📊 **COMPARISON: DIRECT SALES vs SALES INVOICE**

| Aspect | Sales Invoice | Direct Sales |
|--------|--------------|--------------|
| **Item Type** | Finished Goods | Raw Materials |
| **Cart System** | Yes (multiple items) | No (single sale) |
| **Rate Currency** | USD or Customer Currency (toggle) | Always USD |
| **Invoice Prefix** | SINV- | DS- |
| **Status** | Unposted (then Posted) | Posted (immediately) |
| **Stock Source** | Finished Goods Inventory | Raw Material Batches |
| **Batch Linking** | No | Yes (originalPurchaseId) |
| **COGS Account** | COGS (general) | COGS - Direct Sales |
| **Inventory Account** | Finished Goods | Raw Material |
| **Additional Costs** | Yes | No |

---

## 🎯 **USER WORKFLOW SUMMARY**

### **Record Direct Sale:**

1. **Select Date** (defaults to today)
2. **Select Customer** (auto-populates currency and exchange rate)
3. **Select Supplier** (filters batches)
4. **Select Batch** (shows available stock and landed cost)
5. **Enter Quantity** (Kg)
6. **Enter Sale Rate** (USD per Kg)
7. **Review Customer Currency** (for reference)
8. **Update Exchange Rate** (if needed)
9. **Click "Record Direct Sale"**
10. **Confirm:** Success message, form cleared (ready for next sale)

### **View / Update:**

1. **Switch to "View / Update" Tab**
2. **View Direct Sales Table** (filtered by DS- prefix)
3. **Find Sale** in table
4. **Delete Sale** (if needed, requires PIN)

---

## 📋 **FORM FIELD SUMMARY TABLE**

| Section | Field Name | Type | Required | Default | Auto-Populated From |
|---------|-----------|------|----------|---------|-------------------|
| Basic Info | Date | Date | Yes | Today | System date |
| Basic Info | Customer | Dropdown | Yes | - | - |
| Stock Selection | Supplier | Dropdown | Yes | - | - |
| Stock Selection | Batch Number | Dropdown | Yes | - | Selected Supplier |
| Sale Details | Quantity (Kg) | Number | Yes | - | - |
| Sale Details | Sale Rate (USD/Kg) | Number | Yes | - | - |
| Currency | Customer Currency | Text (Read-only) | - | - | Customer defaultCurrency |
| Currency | Exchange Rate | Number | Yes | 1.0 | Currency setup |

---

## 🎨 **VISUAL LAYOUT STRUCTURE**

```
┌─────────────────────────────────────────────────────────┐
│  [New Direct Sale] [View / Update]                      │
├─────────────────────────────────────────────────────────┤
│  Direct Sale (Raw Material)                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Date | Customer                                  │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Select Stock                                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Supplier: [Dropdown]                             │  │
│  │ Batch Number: [Dropdown]                         │  │
│  │                                                   │  │
│  │ ┌─────────────────────────────────────────────┐  │  │
│  │ │ Landed Cost/Kg: $X.XXX                     │  │  │
│  │ │ Available: XXX Kg                           │  │  │
│  │ └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Quantity (Kg) | Sale Rate (USD / Kg)                   │
├─────────────────────────────────────────────────────────┤
│  Customer Currency: [AED] (Read-only)                  │
│  Exchange Rate: [3.67] (Editable)                     │
├─────────────────────────────────────────────────────────┤
│  [Record Direct Sale]                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 **ACCOUNTING FLOW SUMMARY**

### **Direct Sale Transaction Accounting:**

1. **Identify Transaction:**
   - Invoice number starts with "DS-" or "DSINV-"
   - Invoice item has `originalPurchaseId` field

2. **Calculate Values:**
   - Net Total = qty × rate (USD)
   - Raw Material Cost = qty × landedCostPerKg (USD)
   - Profit = Net Total - Raw Material Cost

3. **Create Ledger Entries:**
   - Debit Customer AR (netTotal)
   - Credit Sales Revenue (netTotal)
   - Debit COGS - Direct Sales (rawMaterialCost)
   - Credit Raw Material Inventory (rawMaterialCost)

4. **Update Stock:**
   - Decrease raw material item stock (if originalProductId exists)
   - Available batch stock decreases

5. **Balance Sheet Impact:**
   - Customer AR increases
   - Sales Revenue increases
   - COGS increases (reduces profit)
   - Raw Material Inventory decreases
   - Net Income increases (if profit positive)

---

## 💱 **MULTI-CURRENCY EXAMPLES**

### **Example 1: Customer Currency = AED**

**Customer Selected:**
- Customer Currency: AED (auto-populated)
- Exchange Rate: 3.67 (auto-populated)

**Sale Details:**
- Batch: BATCH-001 (Available: 500 Kg, Landed Cost: $1.50/Kg)
- Quantity: 100 Kg
- Rate Entered: 2.50 USD/Kg

**Calculations:**
- Net Total: 100 × 2.50 = $250.00 USD
- Raw Material Cost: 100 × 1.50 = $150.00 USD
- Profit: $250.00 - $150.00 = $100.00 USD

**Invoice Created:**
- currency: 'USD'
- exchangeRate: 1
- customerCurrency: 'AED'
- customerExchangeRate: 3.67
- netTotal: 250.00 USD

**Ledger Narration:**
- "Direct Sale: DS-1001 - ABC Customer (AED 917.50)"
- (250.00 USD × 3.67 = 917.50 AED)

### **Example 2: Customer Currency = USD**

**Customer Selected:**
- Customer Currency: USD (auto-populated)
- Exchange Rate: 1.00 (auto-populated)

**Sale Details:**
- Batch: BATCH-002 (Available: 300 Kg, Landed Cost: $1.75/Kg)
- Quantity: 50 Kg
- Rate Entered: 3.00 USD/Kg

**Calculations:**
- Net Total: 50 × 3.00 = $150.00 USD
- Raw Material Cost: 50 × 1.75 = $87.50 USD
- Profit: $150.00 - $87.50 = $62.50 USD

**Invoice Created:**
- currency: 'USD'
- exchangeRate: 1
- customerCurrency: 'USD'
- customerExchangeRate: 1.00
- netTotal: 150.00 USD

**Ledger Narration:**
- "Direct Sale: DS-1002 - XYZ Customer (USD 150.00)"

---

**End of Structure Guide**
