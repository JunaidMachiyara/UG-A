# Sales Invoice Form - Complete Structure Guide
## For New App Construction

**Module:** Data Entry > Sales > Sales Invoices > New Invoice

---

## 📋 **OVERVIEW**

The Sales Invoice form allows users to create invoices for customers, recording sales of finished goods. The form supports a **cart-based workflow** where users can add multiple items before finalizing, and includes comprehensive **multi-currency support** allowing rates to be entered in either the customer's default currency or the base currency (USD), with automatic conversion for accounting purposes.

**Key Purpose:**
- Create sales invoices for customers
- Record sales of finished goods
- Support multi-currency transactions
- Track logistics and additional costs
- Create accounting entries (Sales Revenue, Customer AR, Finished Goods Inventory)
- Update item stock quantities

**Key Difference from Other Forms:**
- **Bundle Purchase:** Buys finished goods (adds to inventory)
- **Finished Goods Production:** Produces finished goods (adds to inventory)
- **Sales Invoice:** Sells finished goods (reduces inventory, creates revenue)
- **Direct Sales:** Sells raw materials directly

---

## 🔄 **ADD TO CART LOOP PROCESS** ⭐ **KEY FEATURE**

The Sales Invoice form uses a **cart-based workflow** that allows users to add multiple items before finalizing. This loop process is the core of the form's functionality.

### **Process Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Customer: [Dropdown]                                │  │
│  │  Invoice #: [Input]                                   │  │
│  │  Date: [Date Picker]                                 │  │
│  │  Customer Currency: [Auto] (Read-only)              │  │
│  │  Exchange Rate: [Auto] (Editable)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Rate Currency: [USD / Customer Currency] Toggle    │  │
│  │  Item: [Dropdown]                                    │  │
│  │  Qty: [Number Input]                                 │  │
│  │  Rate/Unit: [Number Input] (Currency shown)        │  │
│  │  [Add Item] Button                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│              handleAddSiItem()                               │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SALES INVOICE CART                       │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │ Item | Qty | Kg | Rate | Total | [Remove] │   │  │
│  │  │ (Shows both currencies if customer currency)│   │  │
│  │  │ [Entry 1]                                    │   │  │
│  │  │ [Entry 2]                                    │   │  │
│  │  │ [Entry 3]                                    │   │  │
│  │  │ ...                                          │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│            handleFinalizeInvoice()                          │
│                          ↓                                  │
│              Opens Summary Modal                            │
│                          ↓                                  │
│              saveInvoice()                                  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              DATABASE & ACCOUNTING                     │  │
│  │  • Save to Firebase (salesInvoices collection)      │  │
│  │  • Create Ledger Entries                              │  │
│  │  • Update Item Stock Quantities                       │  │
│  │  • All amounts stored in USD for accounting          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│                    Cart Cleared                             │
│                    Form Ready for Next Invoice              │
└─────────────────────────────────────────────────────────────┘
```

### **Loop Process Steps:**

1. **User Sets Customer:**
   - Selects customer from dropdown
   - Customer currency auto-populates (from customer's `defaultCurrency`)
   - Exchange rate auto-populates (from currency setup)
   - User can manually update exchange rate if needed

2. **User Sets Rate Currency:**
   - Toggles between "USD (Base Currency)" and "{Customer Currency} (Customer Currency)"
   - This determines which currency rates are entered in

3. **Add Item to Cart:**
   - Selects item from dropdown
   - Rate auto-populates (from last sale to this customer OR item's salePrice)
   - Enters quantity
   - Optionally adjusts rate
   - Clicks "Add Item" button

4. **Item Processing:**
   - If rate entered in customer currency: Converts to USD (`rateUSD = rateEntered / exchangeRate`)
   - If rate entered in USD: Uses directly
   - Creates `SalesInvoiceItem` object:
     - Stores rate in USD (for accounting)
     - Stores original entered rate/currency (for display)
   - Adds to `siCart` array
   - Clears form fields

5. **Cart Display:**
   - Shows items in table
   - If customer currency ≠ USD: Shows both currencies (customer currency prominent, USD in parentheses)
   - If customer currency = USD: Shows USD only
   - User can remove items

6. **Repeat Steps 3-5:**
   - User can add multiple items
   - Each item can have different rates
   - Cart displays all items

7. **Add Additional Costs (Optional):**
   - User can add freight, clearing, commission, etc.
   - Each cost can be in different currency
   - Costs converted to USD for accounting

8. **Click "Invoice Complete":**
   - Opens summary modal
   - Shows all items and totals
   - User reviews and confirms

9. **Save Invoice:**
   - Validates customer and cart
   - Calculates totals (all in USD)
   - Saves to database
   - Creates ledger entries
   - Updates stock quantities
   - Clears cart
   - Shows success message

10. **Loop Continues:**
    - Form ready for next invoice
    - Process repeats from Step 1

---

## 💱 **MULTI-CURRENCY SUPPORT** ⭐ **KEY FEATURE**

The Sales Invoice form provides comprehensive multi-currency support with automatic conversion to base currency (USD) for accounting while preserving customer currency for display.

### **Currency Architecture:**

**1. Base Currency (USD):**
- All accounting entries stored in USD
- Ledger entries use USD amounts
- Balance sheet calculations in USD
- Ensures consistent accounting

**2. Customer Default Currency:**
- Auto-populated from customer's `defaultCurrency` field
- Used for display and rate entry (if selected)
- Stored in invoice as `customerCurrency` and `customerExchangeRate`
- Shown in ledger narration for reference

**3. Rate Currency Toggle:**
- User can choose to enter rates in:
  - **USD (Base Currency):** Rates entered directly in USD
  - **Customer Currency:** Rates entered in customer's currency, auto-converted to USD

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
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Rate Currency Toggle:                                │ │
│  │  [USD] or [Customer Currency]                         │ │
│  └──────────────────────────────────────────────────────┘ │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  IF Customer Currency Selected:                       │ │
│  │  • User enters rate in customer currency             │ │
│  │  • System converts: rateUSD = rateFCY / exchangeRate │ │
│  │  • Stores both: rateUSD (for accounting)            │ │
│  │  • Stores: originalEnteredRate (for display)        │ │
│  └──────────────────────────────────────────────────────┘ │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  IF USD Selected:                                     │ │
│  │  • User enters rate in USD                           │ │
│  │  • System uses directly: rateUSD = rateEntered      │ │
│  │  • Stores: rateUSD only                             │ │
│  └──────────────────────────────────────────────────────┘ │
│                          ↓                                  │
│  Cart Display:                                             │
│  • Shows customer currency (if ≠ USD)                     │
│  • Shows USD in parentheses (if customer currency used)  │
│  • Shows USD only (if USD selected)                      │
│                          ↓                                  │
│  Invoice Saved:                                            │
│  • All amounts stored in USD                              │
│  • customerCurrency and customerExchangeRate stored      │
│  • Ledger entries in USD                                  │
│  • Narration shows customer currency for reference        │
└─────────────────────────────────────────────────────────────┘
```

### **Currency Conversion Logic:**

**When Rate Entered in Customer Currency:**
```typescript
// User enters rate in customer currency (e.g., AED 12.50)
const rateEntered = 12.50; // AED
const exchangeRate = 3.67; // AED to USD

// Convert to USD for accounting
const rateUSD = rateEntered / exchangeRate; // 12.50 / 3.67 = 3.41 USD

// Store in item
{
    rate: rateUSD,                    // 3.41 USD (for accounting)
    total: qty * rateUSD,             // Total in USD
    currency: 'AED',                  // Customer currency
    exchangeRate: 3.67,               // Exchange rate used
    originalEnteredRate: 12.50        // Original rate entered (for display)
}
```

**When Rate Entered in USD:**
```typescript
// User enters rate in USD
const rateEntered = 3.41; // USD

// Use directly
const rateUSD = rateEntered; // 3.41 USD

// Store in item
{
    rate: rateUSD,                    // 3.41 USD
    total: qty * rateUSD,             // Total in USD
    currency: 'USD',                   // Base currency
    // No exchangeRate or originalEnteredRate needed
}
```

---

## 🏗️ **FORM STRUCTURE**

The form is divided into **7 main sections**:

1. **Mode Toggle** (New Invoice / View / Update)
2. **Core Invoice Information** (Customer, Invoice #, Date, Currency)
3. **Logistics & Destination**
4. **Item Entry & Cart** ⭐ **ADD TO CART**
5. **Additional Costs** (Pass-through costs)
6. **Summary Modal** (Review before save)
7. **View / Update Mode** (List and edit existing invoices)

---

## 📝 **SECTION-BY-SECTION BREAKDOWN**

### **SECTION 1: MODE TOGGLE**

**Purpose:** Switch between creating new invoices and viewing/updating existing ones

**Layout:** Horizontal tabs with underline indicator

**Components:**
- **"New Invoice" Button:** Switches to create mode (shows form)
- **"View / Update" Button:** Switches to view mode (shows list of invoices)
- **Active State:** Blue text with blue bottom border
- **Inactive State:** Gray text

**Behavior:**
- When switching to "New Invoice": Clears form, resets cart
- When switching to "View / Update": Shows filtered list of invoices

---

### **SECTION 2: CORE INVOICE INFORMATION**

**Purpose:** Basic invoice identification and customer details

**Layout:** 4-column grid, white background box with border

#### **2.1 Customer / Supplier**

- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only CUSTOMER or SUPPLIER partners
- **Required:** Yes
- **Quick Add:** Available (opens modal to add new partner)
- **Behavior:**
  - When selected, auto-populates customer currency and exchange rate
  - Auto-populates division/sub-division if customer has them set
- **Layout:** First column in 4-column grid

#### **2.2 Invoice Number**

- **Type:** Text Input
- **Required:** Yes
- **Default:** Auto-increments (e.g., "SINV-001")
- **Format:** "SINV-{number}"
- **Editable:** Yes (user can change)
- **Style:** Monospace font, bold
- **Layout:** Second column in 4-column grid

#### **2.3 Date**

- **Type:** Date Picker
- **Default Value:** Today's date
- **Format:** YYYY-MM-DD
- **Required:** Yes
- **Purpose:** Invoice transaction date
- **Layout:** Third column in 4-column grid

#### **2.4 Customer Currency** ⭐ **MULTI-CURRENCY**

- **Type:** Text Input (Read-only)
- **Label:** "Customer Currency"
- **Purpose:** Display customer's default currency (for reference)
- **Auto-Population:** From customer's `defaultCurrency` field
- **Style:** Gray background (slate-100), monospace font, small text, bold
- **Helper Text:** "For ledger display" (small text, gray)
- **Layout:** Fourth column in 4-column grid

#### **2.5 Branding / Logo**

- **Type:** Dropdown Selector (EntitySelector)
- **Options:** All logos from Setup
- **Required:** Yes (marked with red asterisk)
- **Quick Add:** Available
- **Purpose:** Logo/branding for invoice
- **Layout:** First column in second row

#### **2.6 Packing Color**

- **Type:** Dropdown Select
- **Options:** None, Blue, Red, Green, White, Yellow
- **Required:** No (Optional)
- **Default:** "None"
- **Purpose:** Packing color specification
- **Layout:** Second column in second row

#### **2.7 Exchange Rate** ⭐ **MULTI-CURRENCY**

- **Type:** Number Input
- **Label:** "Exchange Rate"
- **Purpose:** Exchange rate from customer currency to USD
- **Auto-Population:** From currency setup when customer selected
- **Editable:** Yes (user can override)
- **Step:** 0.0001 (allows decimal precision)
- **Helper Text:** "Update if needed" (small text, gray)
- **Style:** Monospace font, small text
- **Layout:** Third column in second row

**Exchange Rate Auto-Population Logic:**
```typescript
// When customer selected:
1. Get customer's defaultCurrency
2. Find currency in state.currencies
3. If found: Use currency.exchangeRate
4. If not found: Use fallback EXCHANGE_RATES[currency] || 1
5. Set siExchangeRate
```

---

### **SECTION 3: LOGISTICS & DESTINATION**

**Purpose:** Track container, division, sub-division, and port information

**Layout:** Gray background box (slate-50), border, padding

#### **3.1 Section Header**

- **Icon:** Truck icon
- **Title:** "Logistics & Destination" (bold, slate-700)
- **Layout:** Flex, items-center, gap-2, margin bottom

#### **3.2 Logistics Fields (4-column grid)**

**3.2.1 Container Number**
- **Type:** Text Input
- **Label:** "Container" (small text, uppercase, slate-500)
- **Required:** No (Optional)
- **Purpose:** Container/shipment tracking number
- **Layout:** First column

**3.2.2 Division**
- **Type:** Dropdown Selector (EntitySelector)
- **Label:** "Division" (required, marked with red asterisk)
- **Options:** All divisions from Setup
- **Required:** Yes
- **Quick Add:** Available
- **Auto-Population:** From customer's `divisionId` if set
- **Layout:** Second column

**3.2.3 Sub-Division**
- **Type:** Dropdown Selector (EntitySelector)
- **Label:** "Sub-Division" (small text, uppercase, slate-500)
- **Options:** Filtered to show only sub-divisions belonging to selected Division
- **Required:** No (Optional)
- **Disabled:** Yes (until Division is selected)
- **Quick Add:** Available (pre-fills divisionId)
- **Auto-Population:** From customer's `subDivisionId` if set
- **Layout:** Third column

**3.2.4 Port of Destination**
- **Type:** Dropdown Selector (EntitySelector)
- **Label:** "Port of Destination" (small text, uppercase, slate-500)
- **Options:** All ports from Setup
- **Required:** No (Optional)
- **Quick Add:** Available
- **Purpose:** Destination port for shipment
- **Layout:** Fourth column

#### **3.3 Discount & Surcharge (2-column grid)**

**3.3.1 Discount**
- **Type:** Number Input
- **Label:** "Discount" (small text, uppercase, slate-500)
- **Required:** No (Optional)
- **Placeholder:** "0.00"
- **Purpose:** Discount amount (in customer currency for display, USD for accounting)
- **Layout:** First column

**3.3.2 Surcharge**
- **Type:** Number Input
- **Label:** "Surcharge" (small text, uppercase, slate-500)
- **Required:** No (Optional)
- **Placeholder:** "0.00"
- **Purpose:** Surcharge amount (in customer currency for display, USD for accounting)
- **Layout:** Second column

---

### **SECTION 4: ITEM ENTRY & CART** ⭐ **ADD TO CART**

**Purpose:** Add multiple items to invoice cart with multi-currency rate entry

**Layout:** Border-top separator, padding top

#### **4.1 Rate Currency Toggle** ⭐ **MULTI-CURRENCY**

**Layout:** Flex layout, justify-between, margin bottom

**4.1.1 Section Title**
- **Text:** "Item Entry" (bold, slate-700)

**4.1.2 Rate Currency Selector**
- **Type:** Dropdown Select
- **Label:** "Rate Currency:" (small text, gray, semibold)
- **Options:**
  - "USD (Base Currency)"
  - "{Customer Currency} (Customer Currency)" (e.g., "AED (Customer Currency)")
- **Purpose:** Determines which currency rates are entered in
- **Behavior:**
  - When "USD" selected: Rates entered directly in USD
  - When "Customer Currency" selected: Rates entered in customer currency, auto-converted to USD
- **Helper Text:** (if customer currency selected and ≠ USD) Shows "(Rate ÷ {exchangeRate} = USD)"
- **Style:** White background, border, rounded, small text, semibold
- **Title Tooltip:** "Select currency for entering item rates (applies to all items in this invoice)"

#### **4.2 Add Item Form**

**Layout:** Gray background box (slate-100), padding, rounded corners, margin bottom

**Grid Layout:** 12-column grid

**4.2.1 Item Selection (Column Span: 6)**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** All items from system (`state.items`)
- **Required:** Yes (to add to cart)
- **Quick Add:** Available (opens modal to add new item)
- **Format Options:**
  - **Display Format:** "Code - Name - Category - Package Size"
  - **Selected Format:** "Code - Name - Package Size"
- **Search Fields:** Code, Name, Category
- **Purpose:** Select finished goods item to sell
- **Auto-Population:** When item selected AND customer selected:
  - Rate auto-populates from last sale to this customer (if exists)
  - OR from item's `salePrice` (if exists)

**4.2.2 Quantity Input (Column Span: 2)**
- **Type:** Number Input
- **Label:** "Qty" (small text, uppercase, slate-500)
- **Required:** Yes (to add to cart)
- **Placeholder:** "0"
- **Purpose:** Quantity of units to sell
- **Validation:** Must be > 0 (allows zero and negative for business requirements)
- **Style:** Small text, white background

**4.2.3 Rate Input (Column Span: 2)** ⭐ **MULTI-CURRENCY**
- **Type:** Number Input
- **Label:** "Rate/Unit ({currency})" (shows selected currency)
  - If USD selected: "Rate/Unit (USD)"
  - If Customer Currency selected: "Rate/Unit ({customerCurrency})"
- **Required:** Yes (to add to cart)
- **Placeholder:** "0.00"
- **Purpose:** Price per unit in selected currency
- **Auto-Population:** 
  - From last sale to this customer (if exists)
  - OR from item's `salePrice` (if exists)
- **Helper Text:** (if customer currency selected and ≠ USD) "Will convert to USD automatically"
- **Style:** Small text, white background
- **Validation:** Must be valid number (not NaN)

**4.2.4 Add Item Button (Column Span: 2)**
- **Type:** Button
- **Label:** "Add Item"
- **Color:** Blue background (blue-600), white text
- **Disabled When:**
  - Item not selected (`!siItemId`)
  - Quantity not entered (`!siItemQty`)
- **Action:**
  - Calls `handleAddSiItem()`
  - Validates required fields
  - Converts rate to USD if needed
  - Creates `SalesInvoiceItem` object
  - Adds to `siCart` array
  - Clears form fields (Item, Quantity, Rate)
- **Style:** Full width, bold font, hover effect

#### **4.3 Cart Display Table**

**Layout:** Full width table with border, rounded corners

**4.3.1 Table Header**

**Background:** Slate-50
**Text:** Bold, slate-600
**Border:** Bottom border (slate-200)

**Columns:**

1. **Item** (Left-aligned)
   - Shows: Item name
   - Format: Regular font

2. **Qty** (Right-aligned)
   - Shows: Quantity sold
   - Format: Regular font, no decimals

3. **Total Kg** (Right-aligned)
   - Shows: Total weight in kilograms
   - Format: Regular font, gray text (slate-500)
   - Calculation: `qty × item.weightPerUnit`

4. **Rate ({currency})** (Right-aligned) ⭐ **MULTI-CURRENCY**
   - **If Customer Currency ≠ USD and Rate Currency = Customer:**
     - Shows: Rate in customer currency (bold)
     - Format: `originalEnteredRate.toFixed(2)`
   - **If Rate Currency = USD:**
     - Shows: Rate in USD
     - Format: `rate.toFixed(2)`

5. **Total ({currency})** (Right-aligned) ⭐ **MULTI-CURRENCY**
   - **If Customer Currency ≠ USD and Rate Currency = Customer:**
     - Shows: Total in customer currency (bold)
     - Format: `(qty × originalEnteredRate).toFixed(2)`
   - **If Rate Currency = USD:**
     - Shows: Total in USD (bold)
     - Format: `total.toFixed(2)`

6. **Rate (USD)** (Right-aligned, conditional) ⭐ **MULTI-CURRENCY**
   - **Only shown if:** Customer Currency ≠ USD AND Rate Currency = Customer
   - Shows: Rate in USD (small text, gray)
   - Format: `rate.toFixed(2)` (in parentheses)

7. **Total (USD)** (Right-aligned, conditional) ⭐ **MULTI-CURRENCY**
   - **Only shown if:** Customer Currency ≠ USD AND Rate Currency = Customer
   - Shows: Total in USD (small text, gray)
   - Format: `total.toFixed(2)` (in parentheses)

8. **Action** (Center-aligned)
   - Shows: Trash icon (red)
   - Action: Removes item from cart
   - Hover: Darker red

**4.3.2 Table Body**

**Empty State:**
- **Text:** "No items added" (centered, italic, gray)
- **Colspan:** 6 or 8 columns (depending on currency display)

**Entry Rows:**
- **Hover Effect:** Light gray background (slate-50)
- **Border:** Bottom border between rows (slate-100)

**4.3.3 Currency Display Logic:**

```typescript
// Determine what to show
const showOriginal = siRateCurrency === 'customer' && 
                     siCurrency !== 'USD' && 
                     (item.currency === siCurrency || item.originalEnteredRate);

if (showOriginal) {
    // Show customer currency prominently, USD in parentheses
    // Rate: originalEnteredRate (bold)
    // Total: qty × originalEnteredRate (bold)
    // Rate (USD): rate (small, gray, parentheses)
    // Total (USD): total (small, gray, parentheses)
} else {
    // Show USD only
    // Rate: rate
    // Total: total (bold)
}
```

---

### **SECTION 5: ADDITIONAL COSTS**

**Purpose:** Add pass-through costs (freight, clearing, commission, etc.)

**Layout:** Border-top separator, padding top

#### **5.1 Section Header**

- **Title:** "Additional Costs (Pass-through)" (bold, slate-700)
- **Layout:** Margin bottom

#### **5.2 Add Cost Form**

**Layout:** Gray background box (slate-50), border, padding, rounded corners

**Flex Layout:** Flex wrap (responsive)

**5.2.1 Cost Type**
- **Type:** Dropdown Select
- **Options:** Freight, Clearing, Commission, Customs, Other
- **Default:** "Freight"
- **Required:** Yes (to add cost)
- **Behavior:** 
  - When changed, clears provider/custom name fields
  - If "Customs" or "Other": Shows text input for custom name
  - If not: Shows provider dropdown
- **Layout:** Width: 128px (w-32)

**5.2.2 Provider / Custom Name**
- **Type:** Conditional Input
  - **If "Customs" or "Other":** Text input for custom name
  - **If Not:** Dropdown Selector (EntitySelector) for partner
- **Options (for non-Customs/Other):**
  - Freight: Freight Forwarders
  - Clearing: Clearing Agents
  - Commission: Commission Agents
  - Also includes VENDOR type
- **Required:** Yes (to add cost)
- **Quick Add:** Available (for partner selection)
- **Layout:** Width: 1/3 (w-1/3)

**5.2.3 Currency**
- **Type:** Dropdown Select
- **Options:** All currencies from Setup (`state.currencies`)
- **Default:** USD or first currency
- **Purpose:** Currency for this additional cost
- **Layout:** Width: 96px (w-24)

**5.2.4 Amount**
- **Type:** Number Input
- **Placeholder:** "Amount"
- **Required:** Yes (to add cost)
- **Purpose:** Cost amount in selected currency
- **Layout:** Width: 128px (w-32)

**5.2.5 Add Button**
- **Type:** Button
- **Label:** "Add"
- **Color:** Dark gray/black background (slate-800), white text
- **Disabled When:**
  - Provider not selected (or custom name empty for Customs/Other)
  - Amount not entered
- **Action:** Adds cost to `siCosts` array
- **Style:** Small text, medium font weight, hover effect

#### **5.3 Costs List Display**

**Layout:** Space-y-1, below input form

**Each Cost Shows:**
- **Cost Type** and **Provider Name** (or custom name for Customs/Other)
- **Amount** in FCY with currency symbol (monospace font)
- **Remove Button** (X icon, red)

**Display Format:**
```
Freight (Provider Name)    12.50 AED    [✕]
Clearing (Agent Name)      5.00 USD     [✕]
Customs (VAT)              100.00 EUR   [✕]
```

---

### **SECTION 6: FINALIZE BUTTON**

**Purpose:** Complete invoice and open summary modal

**Layout:** Margin top, padding top, border-top separator, flex justify-end

#### **6.1 Invoice Complete Button**

- **Type:** Button
- **Label:** "Invoice Complete"
- **Icon:** CheckCircle icon (left side)
- **Color:** Emerald green background (emerald-600), white text
- **Action:**
  - Calls `handleFinalizeInvoice()`
  - Validates customer and cart
  - Opens summary modal (`setShowSiSummary(true)`)
- **Style:** Large padding, bold font, rounded corners, shadow, hover effect

---

### **SECTION 7: SUMMARY MODAL** ⭐ **MULTI-CURRENCY DISPLAY**

**Purpose:** Review invoice details before saving

**Layout:** Fixed overlay modal, centered, max-width 4xl

#### **7.1 Modal Header**

- **Background:** Blue gradient (blue-600 to blue-700), white text
- **Title:** "Sales Invoice Summary" (large, bold)
- **Subtitle:** "Review and confirm invoice details" (small, blue-100)
- **Close Button:** X icon (top right)

#### **7.2 Invoice Header Section**

**Layout:** 2-column grid, padding bottom, border bottom

**Fields:**
- **Invoice Number:** Shows `siInvoiceNo`
- **Date:** Shows `siDate`
- **Customer:** Shows customer name (looked up from partners)
- **Container:** Shows container number or "N/A"

#### **7.3 Items Table**

**Layout:** Full width table

**Columns:**
- **Item:** Item name
- **Qty:** Quantity
- **Kg:** Total weight
- **Rate ({currency}):** Rate in customer currency (if customer currency used) or USD
- **Total ({currency}):** Total in customer currency (if customer currency used) or USD

**Display Logic:**
```typescript
// For each item:
const displayRate = item.originalEnteredRate || item.rate || 0;
const displayTotal = item.originalEnteredRate 
    ? (item.qty || 0) * item.originalEnteredRate 
    : (item.total || 0);
```

**Totals Row:**
- Shows sum of quantities
- Shows sum of weights
- Empty cells for rate/total columns

#### **7.4 Summary Section** ⭐ **MULTI-CURRENCY**

**Layout:** Gray background box (slate-50), padding, rounded corners

**Calculations:**

**All calculations done in USD first:**
```typescript
// Calculate in USD (for accounting)
const grossTotalUSD = siCart.reduce((s, i) => s + (i.total || 0), 0);
const discountUSD = parseFloat(siDiscount || '0');
const surchargeUSD = parseFloat(siSurcharge || '0');
const additionalCostsUSD = siCosts.reduce((s, c) => {
    const costUSD = c.currency === 'USD' 
        ? (c.amount || 0) 
        : (c.amount || 0) / (c.exchangeRate || 1);
    return s + costUSD;
}, 0);
const netTotalUSD = grossTotalUSD - discountUSD + surchargeUSD + additionalCostsUSD;
```

**Convert to Customer Currency for Display:**
```typescript
// Convert to customer currency (for display)
const grossTotalFCY = siCurrency !== 'USD' 
    ? grossTotalUSD * siExchangeRate 
    : grossTotalUSD;
const discountFCY = siCurrency !== 'USD' 
    ? discountUSD * siExchangeRate 
    : discountUSD;
const surchargeFCY = siCurrency !== 'USD' 
    ? surchargeUSD * siExchangeRate 
    : surchargeUSD;
const additionalCostsFCY = siCurrency !== 'USD' 
    ? additionalCostsUSD * siExchangeRate 
    : additionalCostsUSD;
const netTotalFCY = siCurrency !== 'USD' 
    ? netTotalUSD * siExchangeRate 
    : netTotalUSD;
```

**Display:**
- **Gross Total:** Shows in customer currency (if ≠ USD) or USD
- **Discount:** Shows if > 0 (red text, negative sign)
- **Surcharge:** Shows if > 0 (emerald text, positive sign)
- **Additional Costs:** Shows if costs exist (blue text, positive sign)
- **Net Total:** Shows in customer currency (if ≠ USD) or USD (bold, large text, border-top separator)

#### **7.5 Modal Footer**

**Layout:** Gray background (slate-50), border-top, padding, flex justify-end

**Buttons:**
- **Cancel Button:** Closes modal, gray text
- **Confirm & Save Invoice Button:** Emerald green, saves invoice, closes modal

---

### **SECTION 8: VIEW / UPDATE MODE**

**Purpose:** List and edit existing invoices

**Layout:** White background box, border, overflow hidden

#### **8.1 Filters**

**Layout:** Gray background (slate-50), border-bottom, padding, flex wrap

**8.1.1 Filter by Date**
- **Type:** Date Picker
- **Purpose:** Filter invoices by date
- **Layout:** Flex-1, min-width 200px

**8.1.2 Filter by Customer**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** All CUSTOMER partners
- **Purpose:** Filter invoices by customer
- **Layout:** Flex-1, min-width 200px

**8.1.3 Clear Filters Button**
- **Type:** Button
- **Label:** "Clear Filters"
- **Action:** Clears both filters
- **Style:** Gray background, gray text

#### **8.2 Invoices Table**

**Layout:** Full width table

**Columns:**
- **Date:** Invoice date
- **Invoice #:** Invoice number (monospace, bold, blue)
- **Customer:** Customer name
- **Net Total:** Net total amount (right-aligned, monospace)
- **Status:** Status badge (Unposted = yellow, Posted = emerald)
- **Actions:** Edit and Delete buttons

**8.2.1 Edit Action**
- **Button:** Edit icon
- **Action:** Calls `handleEditInvoice(inv)`
- **Behavior:**
  - Switches to create mode
  - Populates all form fields
  - Loads cart with invoice items
  - Loads additional costs
  - Sets `siId` to invoice ID

**8.2.2 Delete Action**
- **Button:** Trash icon
- **Confirmation:** Requires Master Key (Supervisor PIN)
- **Message:** "Delete this sales invoice? This will reverse all accounting entries (restore Finished Goods, Customer AR, and Sales Revenue)."
- **Action:** Deletes invoice and reverses all ledger entries

---

## 🔄 **ADD TO CART LOOP PROCESS - DETAILED WORKFLOW**

### **Step 1: User Sets Customer**

User selects customer from dropdown:

**1.1 Auto-Population:**
- Customer currency auto-populates from `customer.defaultCurrency`
- Exchange rate auto-populates from currency setup
- Division/sub-division auto-populate if customer has them set

**1.2 Currency Display:**
- Customer currency shown in read-only field
- Exchange rate shown (editable)
- User can manually update exchange rate if needed

### **Step 2: User Sets Rate Currency**

User selects rate currency toggle:

**2.1 Options:**
- "USD (Base Currency)"
- "{Customer Currency} (Customer Currency)"

**2.2 Behavior:**
- Determines which currency rates are entered in
- Applies to all items in invoice
- Helper text shows conversion formula if customer currency selected

### **Step 3: Add Item to Cart**

User adds item:

**3.1 Select Item:**
- Selects item from dropdown
- Rate auto-populates (from last sale to customer OR item's salePrice)

**3.2 Enter Quantity:**
- Enters quantity
- Must be > 0 (allows zero and negative for business requirements)

**3.3 Enter/Adjust Rate:**
- Rate shown in selected currency
- User can adjust if needed
- Helper text shows conversion info if customer currency

**3.4 Click "Add Item":**

**3.4.1 Validation:**
- Item must be selected
- Quantity must be entered
- Rate must be valid number (not NaN)

**3.4.2 Rate Conversion (if customer currency):**
```typescript
if (siRateCurrency === 'customer' && siCurrency !== 'USD') {
    originalRate = rateEntered; // Store original
    originalCurrency = siCurrency; // Store currency
    rateUSD = rateEntered / siExchangeRate; // Convert to USD
}
```

**3.4.3 Create Item Object:**
```typescript
const newItem: SalesInvoiceItem = {
    id: Math.random().toString(36).substr(2, 9),
    itemId: item.id,
    itemName: item.name,
    qty: qty,
    rate: rateUSD, // Always USD for accounting
    total: qty * rateUSD, // Total in USD
    totalKg: qty * item.weightPerUnit,
    currency: originalCurrency || siCurrency,
    exchangeRate: siRateCurrency === 'customer' && siCurrency !== 'USD' 
        ? siExchangeRate 
        : undefined,
    originalEnteredRate: siRateCurrency === 'customer' && siCurrency !== 'USD' 
        ? originalRate 
        : undefined
};
```

**3.4.4 Add to Cart:**
- Adds `newItem` to `siCart` array
- Cart updates immediately (React state)

**3.4.5 Clear Form:**
- Resets `siItemId` to ''
- Resets `siItemQty` to ''
- Resets `siItemRate` to ''
- Form ready for next item

### **Step 4: Cart Display**

Cart shows items:

**4.1 Currency Display:**
- If customer currency ≠ USD AND rate currency = customer:
  - Shows customer currency prominently (bold)
  - Shows USD in parentheses (small, gray)
- If rate currency = USD:
  - Shows USD only

**4.2 Item Details:**
- Item name
- Quantity
- Total weight (kg)
- Rate (in appropriate currency)
- Total (in appropriate currency)
- Remove button

### **Step 5: Repeat Steps 3-4**

User can add multiple items:
- Each item independent
- Each can have different rates
- Cart displays all items
- User can remove items

### **Step 6: Add Additional Costs (Optional)**

User can add costs:
- Select cost type
- Select provider or enter custom name
- Select currency
- Enter amount
- Click "Add"
- Cost added to `siCosts` array

### **Step 7: Finalize Invoice**

User clicks "Invoice Complete":

**7.1 Validation:**
- Customer must be selected
- Cart must have at least one item

**7.2 Open Summary Modal:**
- Shows all items
- Shows totals in customer currency (if ≠ USD)
- User reviews and confirms

**7.3 Save Invoice:**

**7.3.1 Calculate Totals (USD):**
```typescript
const grossTotal = siCart.reduce((s, i) => s + (i.total || 0), 0);
const costsTotal = siCosts.reduce((s, c) => {
    const costUSD = c.currency === 'USD' 
        ? (c.amount || 0) 
        : (c.amount || 0) / (c.exchangeRate || 1);
    return s + costUSD;
}, 0);
const netTotal = grossTotal - parseFloat(siDiscount || '0') + 
                 parseFloat(siSurcharge || '0') + costsTotal;
```

**7.3.2 Create Invoice Object:**
```typescript
const newInvoice: SalesInvoice = {
    id: siId || Math.random().toString(36).substr(2, 9),
    invoiceNo: siInvoiceNo,
    date: siDate,
    status: 'Unposted',
    customerId: siCustomer,
    logoId: siLogo,
    packingColor: siColor,
    containerNumber: siContainer,
    divisionId: siDivision,
    subDivisionId: siSubDivision,
    currency: 'USD', // Always USD for accounting
    exchangeRate: 1, // USD base
    customerCurrency: siCurrency, // Customer currency for display
    customerExchangeRate: siExchangeRate, // Exchange rate for display
    discount: parseFloat(siDiscount || '0'),
    surcharge: parseFloat(siSurcharge || '0'),
    items: siCart,
    additionalCosts: siCosts,
    grossTotal,
    netTotal,
    factoryId: state.currentFactory?.id || ''
};
```

**7.3.3 Save to Database:**
- Calls `addSalesInvoice(newInvoice)` or `updateSalesInvoice(newInvoice)`
- Saves to Firebase
- Creates ledger entries (via posting)
- Updates stock quantities

**7.3.4 Clear Form:**
- Clears cart (`setSiCart([])`)
- Clears costs (`setSiCosts([])`)
- Resets customer and other fields
- Closes summary modal
- Shows success message

### **Step 8: Loop Continues**

Form ready for next invoice:
- Customer selection cleared
- Form fields cleared
- Cart empty
- Process repeats from Step 1

---

## 💱 **MULTI-CURRENCY SUPPORT - DETAILED**

### **Currency Architecture:**

**1. Base Currency (USD):**
- **Purpose:** All accounting entries stored in USD
- **Why:** Ensures consistent accounting and balance sheet calculations
- **Storage:** All `rate`, `total`, `grossTotal`, `netTotal` fields in USD

**2. Customer Default Currency:**
- **Source:** Customer's `defaultCurrency` field
- **Purpose:** Display and rate entry convenience
- **Storage:** Stored as `customerCurrency` and `customerExchangeRate` in invoice
- **Display:** Shown in ledger narration and invoice display

**3. Rate Currency Toggle:**
- **Options:**
  - **USD (Base Currency):** Enter rates directly in USD
  - **Customer Currency:** Enter rates in customer currency, auto-convert to USD
- **Scope:** Applies to all items in invoice
- **Purpose:** Allows users to work in customer's currency while maintaining USD accounting

### **Currency Conversion Flow:**

**When Customer Currency Selected:**

```
User Enters Rate: 12.50 AED
                ↓
Exchange Rate: 3.67 (AED to USD)
                ↓
Convert to USD: 12.50 ÷ 3.67 = 3.41 USD
                ↓
Store in Item:
  - rate: 3.41 USD (for accounting)
  - originalEnteredRate: 12.50 (for display)
  - currency: 'AED'
  - exchangeRate: 3.67
                ↓
Display in Cart:
  - Rate: 12.50 AED (bold)
  - Total: 125.00 AED (bold)
  - Rate (USD): (3.41) (small, gray)
  - Total (USD): (34.10) (small, gray)
```

**When USD Selected:**

```
User Enters Rate: 3.41 USD
                ↓
Use Directly: 3.41 USD
                ↓
Store in Item:
  - rate: 3.41 USD
  - total: 34.10 USD
  - currency: 'USD'
  - (no exchangeRate or originalEnteredRate)
                ↓
Display in Cart:
  - Rate: 3.41 USD
  - Total: 34.10 USD (bold)
```

### **Currency Display Rules:**

**Cart Table Display:**

**If Customer Currency ≠ USD AND Rate Currency = Customer:**
- **Rate Column:** Shows customer currency rate (bold)
- **Total Column:** Shows customer currency total (bold)
- **Rate (USD) Column:** Shows USD rate (small, gray, parentheses)
- **Total (USD) Column:** Shows USD total (small, gray, parentheses)

**If Rate Currency = USD:**
- **Rate Column:** Shows USD rate
- **Total Column:** Shows USD total (bold)
- **No additional columns**

**Summary Modal Display:**

- Shows all amounts in customer currency (if ≠ USD)
- Calculations done in USD first, then converted for display
- Net Total shown prominently in customer currency

### **Additional Costs Currency:**

- Each additional cost can be in different currency
- Converted to USD for accounting: `costUSD = amount / exchangeRate`
- Displayed in original currency in costs list
- Included in net total calculation (converted to USD)

---

## 📊 **DATA STRUCTURE**

### **SalesInvoiceItem Object:**

```typescript
interface SalesInvoiceItem {
    id: string;                    // Unique identifier (random string)
    itemId: string;                // Item ID (links to Item)
    itemName: string;              // Item name (denormalized)
    qty: number;                   // Quantity sold (units)
    rate: number;                   // Rate per unit (ALWAYS in USD for accounting)
    total: number;                  // Total (ALWAYS in USD for accounting)
    totalKg: number;                // Total weight (kg) = qty × weightPerUnit
    
    // Multi-currency fields (optional)
    currency?: Currency;            // Customer currency (if rate entered in customer currency)
    exchangeRate?: number;          // Exchange rate used (if customer currency)
    originalEnteredRate?: number;   // Original rate entered (if customer currency)
    
    // Optional linking fields
    originalPurchaseId?: string;    // For Direct Sales: Link to raw material batch
    sourceOrderId?: string;        // For Ongoing Orders: Link to order ID
}
```

### **SalesInvoice Object:**

```typescript
interface SalesInvoice {
    id: string;                     // Unique identifier
    invoiceNo: string;              // Invoice number (e.g., "SINV-001")
    date: string;                   // Invoice date (YYYY-MM-DD)
    status: 'Unposted' | 'Posted';  // Invoice status
    
    customerId: string;             // Customer partner ID
    factoryId: string;             // Factory assignment
    logoId: string;                // Logo/branding ID
    packingColor?: string;         // Packing color (optional)
    
    // Logistics
    containerNumber?: string;       // Container number (optional)
    divisionId?: string;           // Division ID (optional)
    subDivisionId?: string;        // Sub-division ID (optional)
    portOfDestinationId?: string; // Port of destination (optional)
    
    // Financials (Accounting - Always USD)
    currency: Currency;            // Always 'USD' for accounting
    exchangeRate: number;          // Always 1 for USD
    
    // Customer Currency (for display)
    customerCurrency?: Currency;   // Customer's default currency
    customerExchangeRate?: number; // Exchange rate (customer currency to USD)
    
    discount: number;              // Discount amount (USD)
    surcharge: number;             // Surcharge amount (USD)
    
    items: SalesInvoiceItem[];     // Array of items in cart
    additionalCosts: InvoiceAdditionalCost[]; // Additional costs
    
    grossTotal: number;            // Gross total (USD)
    netTotal: number;              // Net total (USD)
}
```

### **InvoiceAdditionalCost Object:**

```typescript
interface InvoiceAdditionalCost {
    id: string;                    // Unique identifier (random string)
    costType: string;              // 'Freight', 'Clearing', 'Commission', 'Customs', 'Other'
    providerId?: string;           // Provider partner ID (if not Customs/Other)
    customName?: string;           // Custom name (if Customs/Other)
    amount: number;                // Amount in selected currency
    currency: Currency;            // Currency for this cost
    exchangeRate: number;          // Exchange rate (currency to USD)
}
```

---

## 🎯 **KEY CALCULATIONS**

### **Rate Conversion:**

**When Rate Entered in Customer Currency:**
```typescript
const rateUSD = rateEntered / exchangeRate;
// Example: 12.50 AED ÷ 3.67 = 3.41 USD
```

**When Rate Entered in USD:**
```typescript
const rateUSD = rateEntered;
// Example: 3.41 USD = 3.41 USD
```

### **Total Calculations:**

**Per Item:**
```typescript
const totalUSD = qty * rateUSD;
const totalKg = qty * item.weightPerUnit;
```

**Gross Total:**
```typescript
const grossTotalUSD = siCart.reduce((s, i) => s + (i.total || 0), 0);
```

**Additional Costs Total:**
```typescript
const additionalCostsUSD = siCosts.reduce((s, c) => {
    const costUSD = c.currency === 'USD' 
        ? (c.amount || 0) 
        : (c.amount || 0) / (c.exchangeRate || 1);
    return s + costUSD;
}, 0);
```

**Net Total:**
```typescript
const netTotalUSD = grossTotalUSD - discountUSD + surchargeUSD + additionalCostsUSD;
```

**Display Totals (Customer Currency):**
```typescript
const grossTotalFCY = siCurrency !== 'USD' 
    ? grossTotalUSD * siExchangeRate 
    : grossTotalUSD;
// Similar for discount, surcharge, additionalCosts, netTotal
```

---

## ✅ **VALIDATION RULES**

### **Before Adding to Cart:**

- ✅ **Item:** Must be selected
- ✅ **Quantity:** Must be entered and valid number
- ✅ **Rate:** Must be valid number (not NaN)
- ⚠️ **Rate Currency:** Selected via toggle (applies to all items)

### **Before Finalizing:**

- ✅ **Customer:** Must be selected
- ✅ **Cart:** Must have at least one item
- ✅ **Invoice Number:** Must be entered
- ✅ **Date:** Must be entered
- ✅ **Logo:** Must be selected (required)
- ⚠️ **Division:** Must be selected (required)
- ⚠️ **Additional Costs:** Optional

### **Currency Validation:**

- ✅ **Customer Currency:** Auto-populated (cannot be empty)
- ✅ **Exchange Rate:** Must be > 0
- ✅ **Rate Conversion:** Validates division by exchange rate
- ✅ **Display:** Shows appropriate currency based on toggle

---

## 🔍 **AUTO-POPULATION LOGIC**

### **When Customer Selected:**

**1. Customer Currency:**
```typescript
const customer = state.partners.find(p => p.id === siCustomer);
if (customer && customer.defaultCurrency) {
    setSiCurrency(customer.defaultCurrency);
}
```

**2. Exchange Rate:**
```typescript
const currencyData = state.currencies.find(c => c.code === customer.defaultCurrency);
if (currencyData && currencyData.exchangeRate) {
    setSiExchangeRate(currencyData.exchangeRate);
} else {
    const fallbackRate = EXCHANGE_RATES[customer.defaultCurrency] || 1;
    setSiExchangeRate(fallbackRate);
}
```

**3. Division/Sub-Division:**
```typescript
if (customer.divisionId) setSiDivision(customer.divisionId);
if (customer.subDivisionId) setSiSubDivision(customer.subDivisionId);
```

### **When Item Selected:**

**Rate Auto-Population Priority:**
1. **Last Sale to Customer:** Find last posted invoice for this customer with this item, use that rate
2. **Item's Sale Price:** Use item's `salePrice` if available
3. **Empty:** Leave empty if neither available

**Logic:**
```typescript
// Find last posted invoice for this customer with this item
const lastInvoiceWithItem = state.salesInvoices
    .filter(inv => inv.customerId === siCustomer && inv.status === 'Posted')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .find(inv => inv.items.some(invItem => invItem.itemId === siItemId));

if (lastInvoiceWithItem) {
    const lastItem = lastInvoiceWithItem.items.find(invItem => invItem.itemId === siItemId);
    if (lastItem) {
        setSiItemRate(lastItem.rate.toString()); // Use last sale rate
        return;
    }
}

// Fallback to item's sale price
if (item.salePrice) {
    setSiItemRate(item.salePrice.toString());
}
```

---

## 🎨 **UI/UX DESIGN NOTES**

### **Visual Hierarchy:**

- **Primary Actions:** Blue button (Add Item), Emerald green button (Invoice Complete)
- **Secondary Actions:** Red buttons (Remove, Delete)
- **Information Boxes:** Gray backgrounds with borders
- **Cart Display:** Prominent table with clear currency indicators

### **Form Layout:**

- **Grid System:** 4-column grid for core info, 12-column grid for item entry
- **Responsive:** Adapts to screen size
- **Spacing:** Consistent padding and margins
- **Grouping:** Related fields grouped logically

### **Multi-Currency Visual Indicators:**

- **Currency Labels:** Clear currency labels in headers and inputs
- **Dual Display:** Customer currency prominent, USD in parentheses (when applicable)
- **Color Coding:** Different styles for different currencies
- **Helper Text:** Conversion formulas shown when applicable

### **Feedback:**

- **Disabled States:** Gray background when disabled
- **Required Fields:** Visual indicators (red asterisk)
- **Validation:** Clear error messages
- **Empty States:** Clear messages when cart is empty
- **Success:** Success message on save

### **Accessibility:**

- **Labels:** Clear, descriptive labels
- **Placeholders:** Helpful placeholder text
- **Currency Indicators:** Clear currency symbols and labels
- **Empty States:** Clear messages when no data

---

## 🔍 **EDGE CASES & SPECIAL BEHAVIORS**

### **1. Empty Cart**

- Finalize button disabled
- Cart table shows "No items added" message
- User must add at least one item

### **2. Customer Currency = USD**

- No conversion needed
- Rate currency toggle shows "USD" option only
- Cart shows USD only (no dual display)
- Exchange rate = 1

### **3. Rate Currency Toggle Change**

- Changing toggle doesn't affect existing cart items
- Only affects new items added after toggle change
- Existing items retain their original currency display

### **4. Exchange Rate Update**

- User can manually update exchange rate
- Affects conversion of new items added
- Doesn't affect existing cart items (they use their stored exchangeRate)

### **5. Item Deletion**

- If item deleted after adding to cart, entry shows "Unknown"
- System handles gracefully
- User can remove invalid entries

### **6. Zero/Negative Rates**

- Allowed for business requirements
- System validates only that rate is valid number (not NaN)
- Can represent returns, adjustments, etc.

### **7. Multiple Currencies in Additional Costs**

- Each cost can be in different currency
- All converted to USD for accounting
- Displayed in original currency in costs list

### **8. Customer Without Default Currency**

- Falls back to USD
- Exchange rate = 1
- Rate currency toggle shows USD only

---

## 💡 **DESIGN RECOMMENDATIONS FOR NEW APP**

### **1. Add to Cart System**

- Make cart visible and prominent
- Show real-time totals
- Allow easy item removal
- Display currency clearly
- Support multiple items

### **2. Multi-Currency Support**

- Auto-populate customer currency
- Provide clear currency indicators
- Show conversion formulas
- Display both currencies when applicable
- Store USD for accounting, customer currency for display

### **3. Rate Entry**

- Auto-populate from last sale
- Support both currency options
- Show conversion in real-time
- Validate exchange rates
- Handle edge cases gracefully

### **4. Validation & Feedback**

- Validate before adding to cart
- Show clear error messages
- Provide confirmation before save
- Display totals clearly
- Show success/error results

### **5. Summary Modal**

- Show all details clearly
- Display in customer currency
- Show conversion breakdown
- Provide clear totals
- Allow easy cancellation

---

## 📊 **COMPARISON: SALES INVOICE vs OTHER FORMS**

| Aspect | Sales Invoice | Bundle Purchase | Production |
|--------|--------------|-----------------|------------|
| **Purpose** | Sell finished goods | Buy finished goods | Produce finished goods |
| **Cart System** | Yes | Yes | Yes |
| **Multi-Currency** | Yes (Base + Customer) | Yes (Supplier currency) | No |
| **Rate Currency Toggle** | Yes | No | No |
| **Stock Impact** | Decreases | Increases | Increases |
| **Accounting** | Revenue, AR, FG | Inventory, Payable | WIP, FG, Gain |

---

## 🔄 **ACCOUNTING IMPACT**

### **When Sales Invoice is Posted:**

**1. Ledger Entries Created:**

**Entry 1: Debit Accounts Receivable (Customer)**
```
Account: Customer AR Account
Debit: netTotalUSD
Credit: 0
Narration: "Sales Invoice: {invoiceNo} - {customerName} ({customerCurrency} {netTotalFCY})"
```

**Entry 2: Credit Sales Revenue**
```
Account: Sales Revenue Account
Debit: 0
Credit: grossTotalUSD
Narration: "Sales Invoice: {invoiceNo} - {customerName}"
```

**Entry 3: Debit Cost of Goods Sold**
```
Account: COGS Account
Debit: costOfGoodsSold (calculated from item costs)
Credit: 0
Narration: "Sales Invoice: {invoiceNo} - COGS"
```

**Entry 4: Credit Finished Goods Inventory**
```
Account: Inventory - Finished Goods
Debit: 0
Credit: costOfGoodsSold
Narration: "Sales Invoice: {invoiceNo} - {item names}"
```

**2. Inventory Impact:**
- Finished Goods inventory decreases
- Item stock quantities updated
- Stock reduced by quantities sold

**3. Balance Sheet Impact:**
- Accounts Receivable increases
- Sales Revenue increases (P&L)
- Finished Goods Inventory decreases
- Net Income increases

---

## 🎯 **USER WORKFLOW SUMMARY**

### **Create New Invoice:**

1. **Select Customer** (auto-populates currency and exchange rate)
2. **Enter Invoice Number** (auto-increments)
3. **Select Date** (defaults to today)
4. **Review Customer Currency** (read-only, for reference)
5. **Update Exchange Rate** (if needed)
6. **Select Logo** (required)
7. **Set Packing Color** (optional)
8. **Set Logistics** (container, division, sub-division, port)
9. **Set Discount/Surcharge** (optional)
10. **Select Rate Currency** (USD or Customer Currency)
11. **Add Items to Cart:**
    - Select item (rate auto-populates)
    - Enter quantity
    - Adjust rate if needed
    - Click "Add Item"
    - Repeat for more items
12. **Add Additional Costs** (optional, repeat as needed)
13. **Review Cart** (remove items if needed)
14. **Click "Invoice Complete"** (opens summary modal)
15. **Review Summary** (check totals, items, costs)
16. **Click "Confirm & Save Invoice"** (saves invoice)
17. **Confirm:** Success message, form resets

### **View / Update Invoice:**

1. **Switch to "View / Update" Tab**
2. **Filter by Date** (optional)
3. **Filter by Customer** (optional)
4. **Find Invoice** in table
5. **Click Edit** (loads invoice into form)
6. **Make Changes** (items, costs, etc.)
7. **Click "Invoice Complete"** (saves updates)

---

## 📋 **FORM FIELD SUMMARY TABLE**

| Section | Field Name | Type | Required | Default | Auto-Populated From |
|---------|-----------|------|----------|---------|-------------------|
| Core Info | Customer | Dropdown | Yes | - | - |
| Core Info | Invoice # | Text | Yes | Auto (SINV-001+) | Previous invoices |
| Core Info | Date | Date | Yes | Today | System date |
| Core Info | Customer Currency | Text (Read-only) | - | - | Customer defaultCurrency |
| Core Info | Exchange Rate | Number | Yes | 1.0 | Currency setup |
| Core Info | Logo | Dropdown | Yes | - | - |
| Core Info | Packing Color | Dropdown | No | None | - |
| Logistics | Container | Text | No | - | - |
| Logistics | Division | Dropdown | Yes | - | Customer divisionId |
| Logistics | Sub-Division | Dropdown | No | - | Customer subDivisionId |
| Logistics | Port of Destination | Dropdown | No | - | - |
| Logistics | Discount | Number | No | 0 | - |
| Logistics | Surcharge | Number | No | 0 | - |
| Item Entry | Rate Currency | Dropdown | Yes | USD | - |
| Item Entry | Item | Dropdown | Yes* | - | - |
| Item Entry | Quantity | Number | Yes* | - | - |
| Item Entry | Rate/Unit | Number | Yes* | - | Last sale or item salePrice |
| Additional Costs | Cost Type | Dropdown | Yes* | Freight | - |
| Additional Costs | Provider/Name | Dropdown/Text | Yes* | - | - |
| Additional Costs | Currency | Dropdown | Yes* | USD | - |
| Additional Costs | Amount | Number | Yes* | - | - |

*Required only when adding to cart/cost list

---

## 🎨 **VISUAL LAYOUT STRUCTURE**

```
┌─────────────────────────────────────────────────────────┐
│  [New Invoice] [View / Update]                          │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │ Customer | Invoice # | Date | Customer Currency │  │
│  │ Logo | Packing Color | Exchange Rate            │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Logistics & Destination                                 │
│  Container | Division | Sub-Division | Port             │
│  Discount | Surcharge                                   │
├─────────────────────────────────────────────────────────┤
│  Item Entry                                             │
│  Rate Currency: [USD / Customer Currency] Toggle        │
│  ┌───────────────────────────────────────────────────┐  │
│  │ [Item Selector] [Qty] [Rate] [Add Item]         │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Item | Qty | Kg | Rate | Total | [Remove]        │  │
│  │ (Shows both currencies if customer currency)      │  │
│  │ [Entry 1]                                         │  │
│  │ [Entry 2]                                         │  │
│  │ ...                                               │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Additional Costs                                       │
│  [Type] [Provider] [Currency] [Amount] [Add]          │
│  [Cost List Display]                                   │
├─────────────────────────────────────────────────────────┤
│  [Invoice Complete]                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 💱 **MULTI-CURRENCY EXAMPLES**

### **Example 1: Customer Currency = AED**

**Customer Selected:**
- Customer Currency: AED (auto-populated)
- Exchange Rate: 3.67 (auto-populated)

**Rate Currency Toggle:**
- Selected: "AED (Customer Currency)"

**Add Item:**
- Item: Men's T-Shirts
- Qty: 10
- Rate Entered: 12.50 AED
- **Conversion:** 12.50 ÷ 3.67 = 3.41 USD
- **Stored:** rate = 3.41 USD, originalEnteredRate = 12.50

**Cart Display:**
```
Item            Qty  Kg    Rate (AED)  Total (AED)  Rate (USD)  Total (USD)
Men's T-Shirts   10  450   12.50       125.00       (3.41)      (34.10)
```

**Summary Modal:**
- Gross Total: AED 125.00
- Net Total: AED 125.00

**Invoice Saved:**
- All amounts stored in USD (rate: 3.41, total: 34.10)
- customerCurrency: 'AED'
- customerExchangeRate: 3.67

### **Example 2: Customer Currency = USD**

**Customer Selected:**
- Customer Currency: USD (auto-populated)
- Exchange Rate: 1.00 (auto-populated)

**Rate Currency Toggle:**
- Selected: "USD (Base Currency)"

**Add Item:**
- Item: Women's Dresses
- Qty: 5
- Rate Entered: 15.00 USD
- **No Conversion:** 15.00 USD = 15.00 USD
- **Stored:** rate = 15.00 USD

**Cart Display:**
```
Item            Qty  Kg    Rate (USD)  Total (USD)
Women's Dresses  5   225   15.00       75.00
```

**Summary Modal:**
- Gross Total: USD 75.00
- Net Total: USD 75.00

**Invoice Saved:**
- All amounts stored in USD (rate: 15.00, total: 75.00)
- customerCurrency: 'USD'
- customerExchangeRate: 1.00

---

**End of Structure Guide**
