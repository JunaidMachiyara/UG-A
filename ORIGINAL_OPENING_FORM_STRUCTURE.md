# Original Opening Form - Complete Structure Guide
## For New App Construction

**Module:** Data Entry > Production > Original Opening

---

## 📋 **OVERVIEW**

The Original Opening form allows users to record the consumption of raw materials (used clothing) from purchased batches. When raw materials are "opened" (processed/consumed), they move from inventory to Work in Progress (WIP), enabling production tracking and cost accounting. The form supports two modes: **Supplier Opening** (consuming purchased raw materials) and **Bales Opening** (re-processing finished goods back into raw materials).

**Key Purpose:**
- Track consumption of purchased raw materials
- Move inventory from "Raw Materials" to "Work in Progress"
- Enable production cost tracking
- Support batch-level tracking of material consumption

**Key Difference from Other Forms:**
- **Original Purchase:** Buys raw materials (adds to inventory)
- **Original Opening:** Consumes raw materials (moves to WIP)
- **Bundle Purchase:** Buys finished goods (adds to finished goods inventory)
- **Production:** Converts WIP to finished goods

---

## 🏗️ **FORM STRUCTURE**

The form is divided into **2 main tabs**:

1. **Supplier Opening** (Primary Mode)
   - Consume raw materials from purchased batches
   - Track by Supplier, Original Type, Product, and Batch
   - Calculate cost from purchase history
   - Support staging cart for multiple entries
   - CSV bulk upload support

2. **Bales Opening** (Re-process Mode)
   - Re-process finished goods back into raw materials
   - Consume finished goods inventory
   - Create internal stock entries

---

## 📝 **SECTION-BY-SECTION BREAKDOWN**

### **TAB 1: SUPPLIER OPENING**

#### **SECTION 1: HEADER & TAB NAVIGATION**

**Purpose:** Switch between Supplier Opening and Bales Opening modes

**Components:**
- **Tab Buttons:**
  - **"Supplier Opening"** (Default, Active)
  - **"Bales Opening (Re-process)"**
- **Layout:** Horizontal tabs with underline indicator
- **Active State:** Blue text with blue bottom border
- **Inactive State:** Gray text

---

#### **SECTION 2: ENTRY FORM (Left Column - 7/12 width)**

**Purpose:** Input fields for recording raw material consumption

**Layout:** 2-column grid layout (7 columns left, 5 columns right)

##### **2.1 Date & Supplier Row**

**Layout:** 2-column grid

**2.1.1 Entry Date**
- **Type:** Date Picker
- **Default Value:** Today's date
- **Format:** YYYY-MM-DD
- **Required:** Yes
- **Purpose:** Opening transaction date
- **Layout:** First column in 2-column grid

**2.1.2 Supplier**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only suppliers with available stock (`suppliersWithStock`)
- **Required:** Yes
- **Quick Add:** Available (opens modal to add new supplier)
- **Behavior:** 
  - When selected, clears Original Type, Product, and Batch selections
  - Filters available Original Types to those purchased from this supplier
- **Layout:** Second column in 2-column grid

---

##### **2.2 Original Type & Product Row**

**Layout:** 2-column grid

**2.2.1 Original Type**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only Original Types purchased from selected supplier (`typesForSupplier`)
- **Required:** Yes
- **Disabled When:** No supplier selected
- **Quick Add:** Available (opens modal to add new Original Type)
- **Behavior:**
  - When selected, clears Product and Batch selections
  - Filters available Products and Batches
- **Layout:** First column in 2-column grid

**2.2.2 Original Product (Optional)**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only Products purchased from selected supplier and Original Type (`productsForSelection`)
- **Required:** No (Optional)
- **Disabled When:** No Original Type selected
- **Placeholder:** "All Products..."
- **Behavior:**
  - When selected, filters available Batches
  - If not selected, shows all batches for the Original Type
- **Layout:** Second column in 2-column grid

---

##### **2.3 Batch Number (Optional)**

**Layout:** Full width

**2.3.1 Batch Number**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only batches with remaining stock > 0.01 kg (`batchesForSelection`)
- **Required:** No (Optional)
- **Disabled When:** No Original Type selected
- **Placeholder:** "All Batches..."
- **Display Format:** Shows batch number with remaining stock (e.g., "BATCH-001 (500 Kg)")
- **Behavior:**
  - Only shows batches with available stock
  - Filters by Supplier, Original Type, and optionally Product
  - Calculates remaining stock: `weightPurchased - opened - sold - directSold - iaoAdjustments`
- **Layout:** Full width below Product row

---

##### **2.4 Available Stock Information Box**

**Purpose:** Display current available stock before opening

**Layout:** Gray background box with border, flex layout

**Components:**

**Left Side:**
- **Label:** "Available Stock (Not Yet Opened)" (uppercase, small text, gray)
- **Quantity Display:**
  - **If Units Available:** Shows large number with "Units" label
  - **If Kg Only (Legacy):** Shows "N/A (Kg Only)" with weight below
- **Weight Display:** Shows estimated weight in Kg (small text, gray)
- **Info Message:** "ℹ️ This is physical stock not yet opened/processed" (blue text, small)

**Right Side:**
- **Label:** "Est. Cost/Kg" (uppercase, small text, gray)
- **Cost Display:** Shows average cost per Kg (large, monospace, emerald green)

**Calculation Logic:**
- **Available Qty:** `purchased.qty - opened.qty - sold.qty`
- **Available Weight:** `purchased.weight - opened.weight - sold.weight - iaoAdjustments.weight`
- **Average Cost:** `purchased.cost / purchased.weight` (if weight > 0)

**Note:** IAO (Inventory Adjustment Original) entries are subtracted from available stock

---

##### **2.5 Quantity & Weight Input Row**

**Layout:** 2-column grid

**2.5.1 Opened (Units/Weight)**
- **Type:** Number Input
- **Label:** "Opened (Units/Weight)"
- **Required:** Yes
- **Placeholder:** "0"
- **Purpose:** Quantity of units/weight to open
- **Validation:** 
  - Must be > 0
  - Warns if opening more than available stock (allows override with confirmation)
- **Style:** Bold font
- **Layout:** First column in 2-column grid

**2.5.2 Total Weight (Auto)**
- **Type:** Text Input (Read-only)
- **Label:** "Total Weight (Auto)"
- **Purpose:** Auto-calculated weight based on quantity
- **Calculation:**
  - If available stock has units: `(availableStockInfo.weight / availableStockInfo.qty) * enteredQty`
  - If no units (legacy): Uses entered quantity as weight
- **Display Format:** Shows weight with "Kg" suffix (e.g., "500.0 Kg" or "500 Kg (Est)")
- **Style:** Gray background, disabled cursor
- **Layout:** Second column in 2-column grid

---

##### **2.6 Add to List Button**

- **Type:** Submit Button (form submit)
- **Label:** "+ Add to List"
- **Color:** Green background (green-600), white text
- **Disabled When:**
  - Quantity not entered
  - Original Type not selected
- **Action:**
  - Validates required fields
  - Calculates weight and cost
  - Adds entry to staging cart
  - Resets form fields (Quantity, Batch, Product, Type)
  - Does NOT save immediately (staged for batch save)

---

#### **SECTION 3: CSV BULK UPLOAD**

**Purpose:** Upload multiple opening entries via CSV file

**Layout:** Gray background box with border, below entry form

**Components:**

**3.1 Header**
- **Icon:** FileText icon
- **Title:** "Bulk Upload (CSV)" (bold)

**3.2 Action Buttons (Horizontal Layout)**

**3.2.1 Choose CSV File Button**
- **Type:** File Input (hidden) with styled label
- **Label:** "Choose CSV File" (blue button style)
- **Icon:** Download icon
- **Accept:** `.csv` files only
- **Action:** Triggers CSV parsing and validation

**3.2.2 Download Template Button**
- **Type:** Button
- **Label:** "Download Template" (emerald green button style)
- **Icon:** FileText icon
- **Action:** Downloads CSV template with sample data

**3.3 Helper Text**
- **Text:** "CSV must include: Date, Supplier ID, Original Type ID, Quantity. Original Product ID, Batch Number, and Weight (Kg) are optional."
- **Style:** Small text, gray

**CSV Format:**
- **Required Columns:** Date, Supplier ID, Original Type ID, Quantity
- **Optional Columns:** Original Product ID, Batch Number, Weight (Kg)
- **Date Format:** YYYY-MM-DD (auto-converts other formats)
- **Validation:** Validates all entries before adding to staging cart

---

#### **SECTION 4: STAGING CART**

**Purpose:** Review and manage staged entries before final save

**Layout:** Amber/yellow background box (appears when cart has items)

**Display Condition:** Only visible when `stagedOriginalOpenings.length > 0`

**Components:**

**4.1 Header**
- **Icon:** Package icon
- **Title:** "Staging Cart ({count} items)" (bold, amber text)

**4.2 Cart Items List**
- **Layout:** Scrollable list (max-height: 60vh)
- **Each Item Shows:**
  - **Supplier Name** - Original Type Name (bold)
  - **Quantity** Units (Weight in kg) (small text, gray)
  - **Remove Button** (red trash icon)
- **Empty State:** Not shown (cart hidden when empty)

**4.3 Complete & Save All Button**
- **Type:** Button
- **Label:** "Complete & Save All ({count})"
- **Color:** Blue background (blue-600)
- **Disabled When:** Processing (`isProcessingOpenings`)
- **Loading State:**
  - Shows spinning RefreshCw icon
  - Text: "Processing... {current}/{total}"
- **Action:**
  - Validates all entries
  - Processes sequentially (one at a time)
  - Shows progress indicator
  - Saves each entry to database
  - Creates ledger entries
  - Clears cart on success

---

#### **SECTION 5: HISTORY TABLE (Right Column - 5/12 width)**

**Purpose:** Display entries recorded for the selected date

**Layout:** Gray background box, right column, full height

**Components:**

**5.1 Header**
- **Icon:** History icon
- **Title:** "Entries for {date}" (bold, gray text)
- **Date:** Uses `ooDate` from form

**5.2 Entries List**
- **Layout:** Scrollable list (flex-1, min-height: 300px)
- **Empty State:**
  - Shows Package icon (large, gray, low opacity)
  - Text: "No entries for this date." (italic, gray)

**5.3 Entry Card (Each Entry)**
- **Layout:** White background card with border
- **Components:**
  - **Header Row:**
    - **Supplier Name** (bold, left)
    - **Delete Button** (trash icon, right, gray hover to red)
  - **Type Info:**
    - **Original Type Name** (small text, gray)
    - **Batch Number Badge** (if exists, gray background, rounded)
  - **Footer Row:**
    - **Entry ID** (first 6 characters, monospace, small, gray, left)
    - **Quantity & Weight** (right-aligned):
      - **Units** (bold, large)
      - **Weight** (small, gray)

**5.4 Delete Action**
- **Confirmation:** "Delete this opening? This will reverse the accounting entries (restore raw materials and remove WIP/COGS)."
- **Action:** Deletes entry and reverses all ledger entries

---

### **TAB 2: BALES OPENING (Re-process)**

#### **SECTION 1: ENTRY FORM (Left Column - 6/12 width)**

**Purpose:** Re-process finished goods back into raw materials

**Layout:** 2-column grid (6 columns left, 6 columns right)

##### **1.1 Date**
- **Type:** Date Picker
- **Default Value:** Today's date
- **Format:** YYYY-MM-DD
- **Required:** Yes

##### **1.2 Select Finished Good**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only finished goods (`category !== 'Raw Material'`)
- **Required:** Yes
- **Quick Add:** Available
- **Format:** "Code - Name - Category - Package Size"
- **Search Fields:** Code, Name, Category

##### **1.3 Stock Information**
- **Layout:** Gray background box
- **Shows:** Available stock and packing type
- **Format:** "Stock: {qty} {packingType}"

##### **1.4 Open Qty**
- **Type:** Number Input
- **Required:** Yes
- **Purpose:** Quantity of finished goods to re-process
- **Estimated Weight:** Shows below input (calculated from item weight)

##### **1.5 Add to List Button**
- **Type:** Submit Button
- **Label:** "Add to List"
- **Color:** Dark gray/black background
- **Action:** Adds to staging cart (does not save immediately)

---

#### **SECTION 2: STAGED ENTRIES & HISTORY (Right Column - 6/12 width)**

**Layout:** Gray background box, full height

##### **2.1 Staged Entries Section**

**Header:**
- **Title:** "Staged Entries" (bold)
- **Post All Button:** (if staged entries exist) Emerald green button

**Entries List:**
- **Layout:** Scrollable list
- **Each Entry Shows:**
  - **Item Name** (bold)
  - **Quantity** units • **Weight** kg (small text)
  - **Remove Button** (red X icon)

##### **2.2 History Section**

**Header:**
- **Title:** "History ({date})" (bold, uppercase, small text, gray)

**History List:**
- **Layout:** Scrollable list (max-height: 40vh)
- **Filter:** Shows entries for selected date where `supplierId === 'SUP-INTERNAL-STOCK'`
- **Each Entry Shows:**
  - **Item Name** (from `originalType`, removes "FROM-" prefix)
  - **Status Badge:** "Posted" (green checkmark icon)
  - **Quantity** units

---

## 🔄 **WORKFLOW & DATA FLOW**

### **Supplier Opening Workflow:**

1. **Select Date** (defaults to today)
2. **Select Supplier** (filters available Original Types)
3. **Select Original Type** (filters available Products and Batches)
4. **Select Product** (optional, further filters Batches)
5. **Select Batch** (optional, shows remaining stock)
6. **Review Available Stock** (shows qty, weight, cost)
7. **Enter Quantity** (units or weight)
8. **Review Auto-Calculated Weight**
9. **Click "Add to List"** (adds to staging cart)
10. **Repeat Steps 2-9** for additional entries
11. **Review Staging Cart** (remove items if needed)
12. **Click "Complete & Save All"** (processes all entries)

### **CSV Upload Workflow:**

1. **Click "Download Template"** (get CSV format)
2. **Fill CSV** with opening entries
3. **Click "Choose CSV File"** (select filled CSV)
4. **System Validates** (checks required fields, finds entities)
5. **Entries Added to Staging Cart** (if valid)
6. **Review Cart** (remove invalid entries if needed)
7. **Click "Complete & Save All"** (processes all entries)

### **Bales Opening Workflow:**

1. **Select Date**
2. **Select Finished Good** (from finished goods inventory)
3. **Review Available Stock**
4. **Enter Open Quantity**
5. **Click "Add to List"** (adds to staging cart)
6. **Repeat Steps 2-5** for additional items
7. **Click "Post All"** (saves all staged entries)

---

## 📊 **DATA STRUCTURE**

### **OriginalOpening Object:**

```typescript
{
  id: string;                    // Unique identifier (random string)
  date: string;                  // Opening date (YYYY-MM-DD)
  supplierId: string;            // Supplier partner ID (or 'SUP-INTERNAL-STOCK' for Bales Opening)
  originalType: string;          // Original Type ID (e.g., "OT-001"), NOT the name!
  originalProductId?: string;    // Optional Original Product ID
  batchNumber?: string;          // Optional batch number from purchase
  qtyOpened: number;             // Quantity opened (units)
  weightOpened: number;          // Weight opened (Kg)
  costPerKg: number;             // Cost per Kg (USD, from purchase history)
  totalValue: number;            // Total value (USD, calculated: weight × costPerKg)
  factoryId: string;             // Factory assignment
}
```

---

## 🎯 **KEY CALCULATIONS**

### **Available Stock Calculation:**

```typescript
// Filter purchases by Supplier, Original Type, Product (optional), Batch (optional)
const relevantPurchases = purchases.filter(p => 
  p.supplierId === supplierId &&
  (p.originalTypeId || p.originalType) === originalType &&
  (!productId || p.originalProductId === productId) &&
  (!batchNumber || p.batchNumber === batchNumber)
);

// Sum purchased quantities
const purchased = relevantPurchases.reduce((acc, p) => ({
  qty: acc.qty + p.qtyPurchased,
  weight: acc.weight + p.weightPurchased,
  cost: acc.cost + p.totalLandedCost
}), { qty: 0, weight: 0, cost: 0 });

// Sum opened quantities
const opened = originalOpenings.filter(o => 
  o.supplierId === supplierId &&
  o.originalType === originalType &&
  (!productId || o.originalProductId === productId) &&
  (!batchNumber || o.batchNumber === batchNumber)
).reduce((acc, o) => ({
  qty: acc.qty + o.qtyOpened,
  weight: acc.weight + o.weightOpened
}), { qty: 0, weight: 0 });

// Sum sold quantities (from posted sales invoices)
const sold = salesInvoices.filter(inv => inv.status === 'Posted')
  .reduce((acc, inv) => {
    // Sum items that reference this purchase
    inv.items.forEach(item => {
      const purchase = purchases.find(p => p.id === item.originalPurchaseId);
      if (purchase && matchesCriteria(purchase)) {
        acc.qty += item.qty;
        acc.weight += item.totalKg;
      }
    });
    return acc;
  }, { qty: 0, weight: 0 });

// Subtract IAO adjustments (Inventory Adjustment Original)
const iaoAdjustments = ledger
  .filter(entry => entry.transactionType === 'INVENTORY_ADJUSTMENT')
  .filter(entry => entry.narration.includes('original stock'))
  .filter(entry => matchesSupplierAndType(entry))
  .reduce((acc, entry) => {
    // Parse weight adjustment from narration
    const weightMatch = entry.narration.match(/Weight:\s*([+-]?\d+\.?\d*)\s*kg/i);
    if (weightMatch) {
      acc.weight += parseFloat(weightMatch[1]);
    }
    return acc;
  }, { weight: 0 });

// Calculate available stock
const availableQty = purchased.qty - opened.qty - sold.qty;
const availableWeight = purchased.weight - opened.weight - sold.weight - iaoAdjustments.weight;
const avgCostPerKg = purchased.weight > 0 ? (purchased.cost / purchased.weight) : 0;
```

### **Weight Calculation:**

```typescript
// If available stock has units
if (availableStockInfo.qty > 0) {
  const weightPerUnit = availableStockInfo.weight / availableStockInfo.qty;
  const estimatedWeight = weightPerUnit * enteredQty;
} else {
  // Legacy data (Kg only, no units)
  const estimatedWeight = enteredQty; // Treat entered qty as weight
}
```

### **Cost Calculation:**

```typescript
// Average cost from purchase history
const avgCostPerKg = purchased.cost / purchased.weight;

// Total value for opening entry
const totalValue = weightOpened * avgCostPerKg;
```

---

## ✅ **VALIDATION RULES**

### **Before Adding to Staging Cart:**

- ✅ **Date:** Must be selected
- ✅ **Supplier:** Must be selected (must have available stock)
- ✅ **Original Type:** Must be selected (must be purchased from supplier)
- ✅ **Quantity:** Must be entered and > 0
- ⚠️ **Warning:** If opening more than available stock, shows confirmation dialog
- ⚠️ **Product:** Optional (filters batches if selected)
- ⚠️ **Batch:** Optional (filters to specific batch if selected)

### **Before Completing Staged Entries:**

- ✅ All entries must have:
  - Supplier ID
  - Original Type
  - Date
  - Quantity > 0
- ✅ At least one entry in staging cart

### **CSV Validation:**

- ✅ **Required Fields:** Date, Supplier ID, Original Type ID, Quantity
- ✅ **Date Format:** YYYY-MM-DD (auto-converts other formats)
- ✅ **Supplier:** Must exist in partners
- ✅ **Original Type:** Must exist in originalTypes
- ✅ **Original Product:** Must exist (if provided)
- ✅ **Quantity:** Must be > 0
- ⚠️ **Weight:** Optional (auto-calculated if not provided)
- ⚠️ **Batch Number:** Optional

---

## 🔍 **FILTERING LOGIC**

### **Suppliers with Stock:**

```typescript
// Only show suppliers who have purchased raw materials
const suppliersWithStock = partners.filter(p => 
  p.type === PartnerType.SUPPLIER &&
  purchases.some(pur => pur.supplierId === p.id)
);
```

### **Original Types for Supplier:**

```typescript
// Collect all Original Types from purchases for this supplier
const typesForSupplier = purchases
  .filter(p => p.supplierId === supplierId)
  .flatMap(p => {
    // Handle multi-item purchases
    if (p.items && p.items.length > 0) {
      return p.items.map(item => item.originalTypeId || item.originalType);
    }
    // Handle legacy single-item purchases
    return [p.originalTypeId || p.originalType];
  })
  .filter(Boolean)
  .map(typeId => {
    const master = originalTypes.find(ot => ot.id === typeId || ot.name === typeId);
    return { id: typeId, name: master?.name || typeId };
  });
```

### **Products for Selection:**

```typescript
// Get all unique Original Products from purchases for this supplier and type
const productsForSelection = purchases
  .filter(p => p.supplierId === supplierId)
  .flatMap(p => {
    if (p.items && p.items.length > 0) {
      return p.items
        .filter(item => (item.originalTypeId || item.originalType) === originalType)
        .map(item => item.originalProductId)
        .filter(Boolean);
    }
    if ((p.originalTypeId || p.originalType) === originalType) {
      return [p.originalProductId].filter(Boolean);
    }
    return [];
  })
  .filter((id, index, self) => self.indexOf(id) === index) // Unique
  .map(productId => {
    const product = originalProducts.find(op => op.id === productId && op.originalTypeId === originalType);
    return product ? { id: product.id, name: product.name } : null;
  })
  .filter(Boolean);
```

### **Batches for Selection:**

```typescript
// Only show batches with remaining stock > 0.01 kg
const batchesForSelection = purchases
  .filter(p => {
    // Match supplier
    if (p.supplierId !== supplierId) return false;
    
    // Match type and product (if selected)
    const typeMatches = /* check purchase type matches selected type */;
    const productMatches = /* check purchase product matches selected product */;
    if (!typeMatches || !productMatches) return false;
    
    // Calculate remaining stock
    const opened = originalOpenings
      .filter(o => o.batchNumber === p.batchNumber && /* other criteria */)
      .reduce((sum, o) => sum + o.weightOpened, 0);
    
    const sold = /* calculate sold weight */;
    const directSold = /* calculate direct sales */;
    const iaoAdjustments = /* calculate IAO adjustments */;
    
    const remaining = p.weightPurchased - opened - sold - directSold - iaoAdjustments;
    
    return remaining > 0.01; // Only show if stock remains
  })
  .map(p => ({ id: p.batchNumber, name: p.batchNumber }));
```

---

## 🎨 **UI/UX DESIGN NOTES**

### **Visual Hierarchy:**

- **Primary Actions:** Green button (Add to List), Blue button (Complete & Save All)
- **Secondary Actions:** Red buttons (Remove, Delete)
- **Information Boxes:** Gray backgrounds with borders
- **Staging Cart:** Amber/yellow background for emphasis
- **History Section:** Gray background, right column

### **Form Layout:**

- **Grid System:** 2-column grid for date/supplier, type/product rows
- **Responsive:** Adapts to screen size (7/12 left, 5/12 right on desktop)
- **Spacing:** Consistent padding and margins
- **Grouping:** Related fields grouped in rows

### **Feedback:**

- **Disabled States:** Gray background when disabled
- **Required Fields:** Visual indicators (bold labels)
- **Validation:** Confirmation dialog for over-opening stock
- **Progress:** Loading spinner and progress counter during batch save
- **Empty States:** Clear messages when no data

### **Accessibility:**

- **Labels:** Clear, descriptive labels
- **Placeholders:** Helpful placeholder text
- **Empty States:** Clear messages when cart/history is empty
- **Error Messages:** Clear validation feedback

---

## 🔍 **EDGE CASES & SPECIAL BEHAVIORS**

### **1. Over-Opening Stock**

- **Behavior:** Warns user if opening more than available stock
- **Confirmation:** "Warning: You are opening more than the calculated available stock ({qty}). Do you want to proceed?"
- **Action:** User can proceed or cancel
- **Note:** System allows override but logs warning

### **2. Legacy Data (Kg Only, No Units)**

- **Behavior:** If `availableStockInfo.qty === 0` but `availableStockInfo.weight > 0`
- **Display:** Shows "N/A (Kg Only)" for quantity
- **Weight Calculation:** Treats entered quantity as weight directly

### **3. Missing Purchase Data**

- **Behavior:** If no purchases found for supplier/type combination
- **Available Stock:** Shows 0 qty, 0 weight, $0.00 cost
- **Validation:** Still allows entry (user can proceed)

### **4. Batch Selection Filtering**

- **Behavior:** Only shows batches with remaining stock > 0.01 kg
- **Calculation:** Considers opened, sold, direct sales, and IAO adjustments
- **Empty State:** If all batches consumed, dropdown shows no options

### **5. CSV Upload Errors**

- **Behavior:** Validates each row, collects errors
- **Display:** Shows alert with error count and first few errors
- **Action:** Invalid rows skipped, valid rows added to staging cart

### **6. Staging Cart Processing**

- **Behavior:** Processes entries sequentially (one at a time)
- **Progress:** Shows "Processing... {current}/{total}"
- **Error Handling:** Continues processing even if one entry fails
- **Result:** Shows success/error count in alert

### **7. IAO Adjustments**

- **Behavior:** Inventory Adjustment Original entries affect available stock
- **Calculation:** Subtracts/adjusts weight based on ledger entries
- **Matching:** Matches by supplier name and type name in narration
- **Format:** Narration includes "Original Stock" and weight adjustment

---

## 💡 **DESIGN RECOMMENDATIONS FOR NEW APP**

### **1. Clear Stock Information**

- Always show available stock prominently
- Display cost information clearly
- Warn when over-opening stock
- Show batch-level details when batch selected

### **2. Staging Cart System**

- Make cart visible and prominent
- Show entry details clearly
- Allow easy removal
- Provide batch save with progress

### **3. CSV Upload**

- Provide clear template
- Show validation errors
- Support bulk operations
- Allow review before save

### **4. History Display**

- Show entries for selected date
- Allow quick deletion
- Display key information (supplier, type, qty, weight)
- Provide visual feedback

### **5. Filtering Logic**

- Cascade filters (Supplier → Type → Product → Batch)
- Show only relevant options
- Handle empty states gracefully
- Support optional selections

### **6. Validation & Feedback**

- Validate before adding to cart
- Show clear error messages
- Provide confirmation for risky actions
- Display progress during batch operations

---

## 📊 **COMPARISON: SUPPLIER OPENING vs BALES OPENING**

| Aspect | Supplier Opening | Bales Opening |
|--------|-----------------|---------------|
| **Source** | Purchased raw materials | Finished goods inventory |
| **Supplier** | External supplier | Internal ('SUP-INTERNAL-STOCK') |
| **Original Type** | From purchase | "FROM-{ItemName}" |
| **Purpose** | Consume purchased stock | Re-process finished goods |
| **Cost Calculation** | From purchase history | From finished goods cost |
| **Batch Tracking** | Yes (optional) | No |
| **Product Selection** | Yes (optional) | No |
| **CSV Upload** | Yes | No |
| **Staging Cart** | Yes | Yes |

---

## 🔄 **ACCOUNTING IMPACT**

### **When Original Opening is Saved:**

1. **Ledger Entries Created:**
   - **Debit:** Work in Progress (WIP) - `totalValue`
   - **Credit:** Inventory - Raw Materials - `totalValue`

2. **Inventory Impact:**
   - Raw Materials inventory decreases
   - Work in Progress increases
   - Available stock for opening decreases

3. **Cost Tracking:**
   - Cost per Kg calculated from purchase history
   - Total value = weight × costPerKg
   - Cost flows to WIP for production tracking

### **When Original Opening is Deleted:**

1. **Ledger Entries Reversed:**
   - **Debit:** Inventory - Raw Materials (restore)
   - **Credit:** Work in Progress (remove)

2. **Inventory Impact:**
   - Raw Materials inventory restored
   - Work in Progress decreased
   - Available stock for opening increases

---

## 🎯 **USER WORKFLOW SUMMARY**

### **Supplier Opening:**

1. **Select Date** (defaults to today)
2. **Select Supplier** (filters types)
3. **Select Original Type** (filters products/batches)
4. **Select Product** (optional, further filters)
5. **Select Batch** (optional, specific batch)
6. **Review Available Stock** (qty, weight, cost)
7. **Enter Quantity** (units/weight)
8. **Review Auto-Calculated Weight**
9. **Click "Add to List"** (adds to staging cart)
10. **Repeat for More Entries** (optional)
11. **Review Staging Cart** (remove if needed)
12. **Click "Complete & Save All"** (saves all entries)
13. **Review History** (see entries for date)

### **CSV Bulk Upload:**

1. **Click "Download Template"**
2. **Fill CSV** with entries
3. **Click "Choose CSV File"**
4. **Review Validation** (errors shown if any)
5. **Review Staging Cart** (valid entries added)
6. **Click "Complete & Save All"**

### **Bales Opening:**

1. **Switch to "Bales Opening" Tab**
2. **Select Date**
3. **Select Finished Good**
4. **Review Available Stock**
5. **Enter Open Quantity**
6. **Click "Add to List"**
7. **Repeat for More Items** (optional)
8. **Click "Post All"** (saves all entries)

---

## 📋 **FORM FIELD SUMMARY TABLE**

| Section | Field Name | Type | Required | Default | Auto-Populated From |
|---------|-----------|------|----------|---------|-------------------|
| Supplier Opening | Date | Date | Yes | Today | System date |
| Supplier Opening | Supplier | Dropdown | Yes | - | - |
| Supplier Opening | Original Type | Dropdown | Yes | - | Selected Supplier |
| Supplier Opening | Original Product | Dropdown | No | - | Selected Type |
| Supplier Opening | Batch Number | Dropdown | No | - | Selected Type/Product |
| Supplier Opening | Quantity | Number | Yes | - | - |
| Supplier Opening | Weight | Text (Auto) | - | - | Calculated from Qty |
| Bales Opening | Date | Date | Yes | Today | System date |
| Bales Opening | Finished Good | Dropdown | Yes | - | - |
| Bales Opening | Open Quantity | Number | Yes | - | - |

---

## 🎨 **VISUAL LAYOUT STRUCTURE**

```
┌─────────────────────────────────────────────────────────┐
│  [Supplier Opening] [Bales Opening (Re-process)]        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌─────────────────────┐ │
│  │ Entry Date               │  │ Entries for {date}   │ │
│  │ Supplier                 │  │                      │ │
│  │                          │  │ [Entry Card]        │ │
│  │ Original Type            │  │ - Supplier Name      │ │
│  │ Original Product (Opt)   │  │ - Type Name          │ │
│  │ Batch Number (Opt)       │  │ - Qty & Weight       │ │
│  │                          │  │                      │ │
│  │ [Available Stock Info]   │  │ [Entry Card]        │ │
│  │ - Qty: XXX Units         │  │ ...                  │ │
│  │ - Weight: XXX Kg        │  │                      │ │
│  │ - Cost: $X.XXX/Kg        │  │                      │ │
│  │                          │  │                      │ │
│  │ Opened (Units/Weight)   │  │                      │ │
│  │ Total Weight (Auto)      │  │                      │ │
│  │                          │  │                      │ │
│  │ [+ Add to List]          │  │                      │ │
│  │                          │  │                      │ │
│  │ [CSV Upload Section]     │  │                      │ │
│  │ [Choose File] [Template] │  │                      │ │
│  │                          │  │                      │ │
│  │ [Staging Cart]           │  │                      │ │
│  │ - Entry 1                │  │                      │ │
│  │ - Entry 2                │  │                      │ │
│  │ [Complete & Save All]    │  │                      │ │
│  └──────────────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

**End of Structure Guide**
