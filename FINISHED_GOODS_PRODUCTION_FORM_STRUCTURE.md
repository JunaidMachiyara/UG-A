# Finished Goods Production Form - Complete Structure Guide
## For New App Construction

**Module:** Data Entry > Production > Finished Goods Production

---

## 📋 **OVERVIEW**

The Finished Goods Production form allows users to record the production of finished goods from Work in Progress (WIP). When raw materials are processed into finished goods, the system tracks production quantities, weights, serial numbers, and creates accounting entries. The form implements a **staging/cart-based workflow** where users can add multiple production entries to a temporary cart before finalizing and saving them to the database.

**Key Purpose:**
- Record production of finished goods from WIP
- Track production quantities, weights, and serial numbers
- Create accounting entries (Finished Goods Inventory, WIP Consumption, Production Gain)
- Update item stock quantities and serial numbers
- Support batch production entry with validation

**Key Difference from Other Forms:**
- **Original Opening:** Consumes raw materials (moves to WIP)
- **Finished Goods Production:** Converts WIP to finished goods (moves to Finished Goods Inventory)
- **Bundle Purchase:** Buys finished goods (adds to finished goods inventory)
- **Re-baling:** Re-processes finished goods back into different finished goods

---

## 🔄 **CART LOOP PROCESS** ⭐ **KEY FEATURE**

The Finished Goods Production form uses a **staging/cart-based workflow** that allows users to add multiple production entries before finalizing. This loop process is the core of the form's functionality.

### **Process Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Production Date: [YYYY-MM-DD]                       │  │
│  │  Item: [Dropdown - Select Item]                       │  │
│  │  Quantity: [Number Input]                             │  │
│  │  Avg Cost: [Number Input - Optional]                 │  │
│  │  [Add to List] Button                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│              handleStageProduction()                         │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              STAGED PRODUCTION CART                   │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │ Item Name | Qty | Weight | Serial | [Remove] │   │  │
│  │  │ [Entry 1]                                     │   │  │
│  │  │ [Entry 2]                                     │   │  │
│  │  │ [Entry 3]                                     │   │  │
│  │  │ ...                                           │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │  Total Units: XXX                                    │  │
│  │  [Finalize & Save] Button                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│            handleFinalizeProduction()                        │
│                          ↓                                  │
│              addProduction(stagedProds)                      │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              DATABASE & ACCOUNTING                     │  │
│  │  • Save to Firebase (productions collection)         │  │
│  │  • Create Ledger Entries                              │  │
│  │  • Update Item Stock Quantities                       │  │
│  │  • Update Serial Numbers                              │  │
│  │  • Consume WIP (FIFO)                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│                    Cart Cleared                             │
│                    Form Ready for Next Entry                │
└─────────────────────────────────────────────────────────────┘
```

### **Loop Process Steps:**

1. **User Enters Data:**
   - Selects production date
   - Selects item from dropdown
   - Enters quantity
   - Optionally overrides production price

2. **Click "Add to List":**
   - Validates required fields
   - Calculates serial numbers (if tracked item)
   - Calculates weight (qty × weightPerUnit)
   - Creates `ProductionEntry` object
   - Adds to `stagedProds` array (cart)
   - Clears form fields (ready for next entry)
   - Updates `tempSerialTracker` for next serial

3. **Repeat Steps 1-2:**
   - User can add multiple items to cart
   - Each entry is independent
   - Serial numbers auto-increment per item
   - Cart displays all staged entries

4. **Review Cart:**
   - View all staged entries
   - Remove entries if needed
   - See total units count

5. **Click "Finalize & Save":**
   - Opens summary modal (shows comparison with yesterday)
   - User confirms
   - Processes all entries sequentially
   - Saves to database
   - Creates ledger entries
   - Updates stock quantities
   - Clears cart
   - Resets form

6. **Loop Continues:**
   - Form ready for next batch of entries
   - Process repeats from Step 1

---

## 🏗️ **FORM STRUCTURE**

The form is divided into **4 main sections**:

1. **Production Date & CSV Upload** (Top Section)
2. **Manual Entry Form** (Left Column - 7/12 width)
3. **Staging Cart** (Right Column - 5/12 width) ⭐ **CART LOOP**
4. **Saved Entries History** (Bottom Section)

---

## 📝 **SECTION-BY-SECTION BREAKDOWN**

### **SECTION 1: PRODUCTION DATE & CSV UPLOAD**

**Purpose:** Set production date and provide CSV bulk upload functionality

**Layout:** Full width, top section

#### **1.1 Production Date**

- **Type:** Date Picker
- **Default Value:** Today's date
- **Format:** YYYY-MM-DD
- **Required:** Yes
- **Purpose:** Production transaction date
- **Behavior:** 
  - When changed, clears staging cart (`setStagedProds([])`)
  - Filters saved entries history by date
- **Layout:** First field, full width

#### **1.2 CSV Bulk Upload Section** ⭐ **CSV UPDATE SYSTEM**

**Purpose:** Upload multiple production entries via CSV file

**Layout:** Gray background box with border

**Components:**

**1.2.1 Header**
- **Icon:** FileText icon
- **Title:** "Bulk Upload (CSV)" (bold, slate-700)

**1.2.2 Action Buttons (Horizontal Layout)**

**1.2.2.1 Choose CSV File Button**
- **Type:** File Input (hidden) with styled label
- **Label:** "Choose CSV File" (blue button style)
- **Icon:** Download icon
- **Accept:** `.csv` files only
- **Action:** Triggers `handleProductionCSVUpload` function
- **Style:** Blue background (blue-600), white text, hover effect

**1.2.2.2 Download Template Button**
- **Type:** Anchor link (`<a>` tag)
- **Label:** "Template" (emerald green button style)
- **Icon:** FileText icon
- **Href:** `/production_template.csv`
- **Action:** Downloads CSV template file
- **Style:** Emerald green background (emerald-600), white text, hover effect

**1.2.3 Helper Text**
- **Text:** "CSV must include: Production Date, Item ID, Quantity. Production Price is optional (will use Avg Production Price from Setup if not provided)"
- **Style:** Small text (text-xs), gray (slate-500), margin top

**CSV Format:**
```csv
Production Date,Item ID,Quantity,Production Price
2025-01-15,ITEM-001,100,12.50
2025-01-15,ITEM-002,50,15.00
2025-01-15,ITEM-003,25,
```

**CSV Processing Flow:**
1. **Parse CSV** using Papa.parse library
2. **Validate Each Row:**
   - Check required fields (Production Date, Item ID, Quantity)
   - Find item by code or ID
   - Validate quantity > 0
   - Parse date format (YYYY-MM-DD)
3. **Calculate Values:**
   - Weight = Quantity × item.weightPerUnit
   - Production Price = CSV value OR item.avgCost OR 0
   - Serial numbers (if tracked item)
4. **Add to Staging Cart:**
   - Creates `ProductionEntry` objects
   - Adds to `stagedProds` array
   - Updates `tempSerialTracker`
5. **Show Results:**
   - Success: "Successfully loaded {count} production entry(ies) from CSV"
   - Errors: Shows validation errors for invalid rows

**CSV Validation:**
- ✅ **Required Fields:** Production Date, Item ID, Quantity
- ✅ **Item Must Exist:** Item ID must match item code or ID in system
- ✅ **Quantity Must Be Positive:** Must be > 0
- ✅ **Date Format:** YYYY-MM-DD (auto-converts other formats)
- ⚠️ **Production Price:** Optional (uses item.avgCost if not provided)

**1.2.4 Divider**

- **Layout:** Horizontal divider with centered text
- **Text:** "OR ADD MANUALLY" (uppercase, small text, gray)
- **Purpose:** Separates CSV upload from manual entry

---

### **SECTION 2: MANUAL ENTRY FORM (Left Column - 7/12 width)**

**Purpose:** Input fields for manually recording production entries

**Layout:** Left column (7/12 width), vertical stack

#### **2.1 Select Item**

- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only finished goods (`category !== 'Raw Material'`)
- **Required:** Yes (to add to cart)
- **Quick Add:** Available (opens modal to add new item)
- **Format Options:**
  - **Display Format:** "Code - Name - Category - Package Size"
  - **Selected Format:** "Code - Name - Package Size"
- **Search Fields:** Code, Name, Category
- **Purpose:** Select finished goods item to produce
- **Behavior:**
  - When selected, auto-populates `prodAvgCost` from item's `avgCost`
  - Shows packing type and next serial number below dropdown

**2.1.1 Packing Type & Serial Display**

- **Layout:** Small text below dropdown, flex layout
- **Shows:**
  - **Packing Type:** Item's packing type (Bale, Sack, Box, Bag, Kg)
  - **Next Serial:** Shows next serial number if item is tracked (not Kg)
  - **Format:** "Packing: {type} (Next Serial: #{number})"
- **Style:** Small text (text-xs), gray (slate-500)

#### **2.2 Quantity (Units)**

- **Type:** Number Input
- **Label:** "Quantity (Units)"
- **Required:** Yes (to add to cart)
- **Placeholder:** "0"
- **Purpose:** Quantity of units to produce
- **Validation:** Must be > 0
- **Style:** Bold font, full width

#### **2.3 Avg Cost (USD per Unit)**

- **Type:** Number Input
- **Label:** "Avg Cost (USD per Unit)"
- **Required:** No (Optional)
- **Placeholder:** "0.00"
- **Step:** 0.01 (allows decimal precision)
- **Purpose:** Production price per unit (override item's avgCost)
- **Auto-Population:**
  - When item selected, auto-populates from item's `avgCost`
  - User can override
  - Clears when no item selected
- **Style:** Bold font, full width

#### **2.4 Add to List Button**

- **Type:** Button (form submit)
- **Label:** "+ Add to List"
- **Icon:** Plus icon (left side)
- **Color:** White background, blue border, blue text
- **Disabled When:**
  - Item not selected (`!prodItemId`)
  - Quantity not entered (`!prodQty`)
- **Action:** 
  - Calls `handleStageProduction()`
  - Validates required fields
  - Calculates serial numbers (if tracked)
  - Calculates weight
  - Creates `ProductionEntry` object
  - Adds to `stagedProds` cart
  - Clears form fields (Item, Quantity, Avg Cost)
  - Updates `tempSerialTracker`
- **Style:** Full width, medium padding, hover effect (blue-50 background)

---

### **SECTION 3: STAGING CART** ⭐ **CART LOOP DISPLAY**

**Purpose:** Display and manage staged production entries before finalization

**Layout:** Right column (5/12 width), gray background box, full height

#### **3.1 Cart Header**

- **Layout:** Flex layout, justify-between
- **Components:**
  - **Title:** "Staged Entries" (bold, slate-700)
  - **Count Badge:** Shows number of entries (blue background, blue text, rounded-full)
- **Style:** Margin bottom

#### **3.2 Cart Items List**

**Layout:** Scrollable list (flex-1, overflow-y-auto, min-height: 200px)

**Empty State:**
- **Icon:** Layers icon (large, gray, low opacity)
- **Text:** "No items added yet" (gray, small)
- **Layout:** Centered, full height flex column

**Entry Cards (When Cart Has Items):**

Each entry displays as a card:

**3.2.1 Entry Card Layout**
- **Background:** White
- **Border:** Slate-200 border
- **Padding:** Medium (p-3)
- **Layout:** Flex, justify-between, items-center
- **Hover Effect:** Group hover for remove button visibility

**3.2.2 Entry Card Content**

**Left Side:**
- **Item Name:** 
  - **Format:** "{Code} - {Item Name}" (bold, slate-800, small text)
  - **Fallback:** Shows itemId if code not found
- **Item Details:** (small text, gray, flex gap layout)
  - **Category Name:** Shows category name (not ID)
  - **Separator:** "•"
  - **Quantity & Packing:** "{qty} {packingType}s ({weightPerUnit}Kg each)"
  - **Serial Range:** (if tracked item) Shows "#{serialStart} - #{serialEnd}" (emerald green, monospace, emerald-50 background)

**Right Side:**
- **Remove Button:**
  - **Icon:** Trash2 icon
  - **Style:** Gray by default, red on hover
  - **Visibility:** Hidden by default, shows on card hover (opacity-0 group-hover:opacity-100)
  - **Action:** Removes entry from `stagedProds` array

**3.2.3 Entry Card Example:**
```
┌─────────────────────────────────────────┐
│ ITEM-001 - Men's T-Shirts          [🗑️] │
│ Men's Wear • 10 Bales (45Kg each)       │
│ #101 - #110                             │
└─────────────────────────────────────────┘
```

#### **3.3 Cart Footer**

**Layout:** Border-top separator, padding top, margin-top auto

**3.3.1 Total Units Display**
- **Layout:** Flex, justify-between
- **Label:** "Total Units:" (medium font, slate-700)
- **Value:** Sum of all `qtyProduced` in cart (medium font, slate-700)
- **Calculation:** `stagedProds.reduce((sum, p) => sum + p.qtyProduced, 0)`

**3.3.2 Finalize & Save Button**
- **Type:** Button
- **Label:** "Finalize & Save"
- **Icon:** Save icon (left side)
- **Color:** Emerald green background (emerald-600), white text
- **Disabled When:**
  - Cart is empty (`stagedProds.length === 0`)
- **Action:**
  - Opens production summary modal (`setShowProdSummary(true)`)
  - Modal shows comparison with yesterday's production
  - User confirms to proceed
- **Style:** Full width, bold font, large padding, shadow, disabled state (slate-300)

---

### **SECTION 4: SAVED ENTRIES HISTORY**

**Purpose:** Display production entries already saved for the selected date

**Layout:** Full width (12/12), below main form, border-top separator

#### **4.1 History Header**

- **Icon:** History icon (slate-400)
- **Title:** "Saved Entries ({prodDate})" (bold, slate-700)
- **Layout:** Flex, items-center, gap-2, margin bottom

#### **4.2 History Table**

**Layout:** Overflow-x-auto, full width table

**Table Structure:**

**4.2.1 Table Header**
- **Background:** Slate-50
- **Text:** Uppercase, small text (text-xs), slate-500
- **Columns:**
  1. **Item** (left-aligned)
  2. **Qty** (left-aligned)
  3. **Weight** (left-aligned)
  4. **Serials** (left-aligned)
  5. **Action** (right-aligned)

**4.2.2 Table Body**

**Empty State:**
- **Text:** "No production saved for this date." (centered, gray, italic, small text)
- **Colspan:** 5 columns

**Entry Rows:**
- **Hover Effect:** Light gray background (slate-50)
- **Columns:**
  1. **Item:** Item name (medium font, slate-700)
  2. **Qty:** "{qtyProduced} {packingType}" (regular text)
  3. **Weight:** "{weightProduced} kg" (gray text, slate-500)
  4. **Serials:** 
     - If tracked: "#{serialStart} - #{serialEnd}" (monospace, small text, slate-600)
     - If not tracked: "-" (dash)
  5. **Action:** 
     - **Delete Button:** Trash2 icon (red-500, hover red-700, hover red-50 background)
     - **Action:** Calls `handleDeleteProduction(p.id)` with PIN confirmation

**4.2.3 Delete Action**
- **Confirmation:** Requires Supervisor PIN
- **Message:** "Delete this production? This will reverse all accounting entries (restore Work in Progress, remove Finished Goods and Production Gain)."
- **Action:** Deletes production and reverses all ledger entries

---

## 🔄 **CART LOOP PROCESS - DETAILED WORKFLOW**

### **Step 1: User Input**

User fills form:
- Selects production date (defaults to today)
- Selects item from dropdown
- Enters quantity
- Optionally overrides production price

**Auto-Population:**
- When item selected, `prodAvgCost` auto-populates from item's `avgCost`
- Shows packing type and next serial number

### **Step 2: Add to Cart**

User clicks "Add to List" button:

**2.1 Validation:**
- ✅ Item must be selected
- ✅ Quantity must be entered and > 0
- ✅ Item must exist in system

**2.2 Calculations:**
- **Serial Numbers** (if tracked item):
  - Gets next serial from `tempSerialTracker` OR existing productions OR item.nextSerial
  - `serialStart` = next number
  - `serialEnd` = serialStart + qty - 1
  - Updates `tempSerialTracker[itemId]` = serialEnd + 1
- **Weight:** `qty × item.weightPerUnit`
- **Production Price:** Uses `prodAvgCost` OR `item.avgCost` OR 0

**2.3 Create Entry:**
```typescript
const newEntry: ProductionEntry = {
    id: Math.random().toString(36).substr(2, 9), // Temporary ID
    date: prodDate,
    itemId: item.id,
    itemName: item.name,
    packingType: item.packingType,
    qtyProduced: qty,
    weightProduced: qty * item.weightPerUnit,
    serialStart: serialStart, // If tracked
    serialEnd: serialEnd,     // If tracked
    factoryId: state.currentFactory?.id || '',
    productionPrice: productionPrice
};
```

**2.4 Add to Cart:**
- Adds `newEntry` to `stagedProds` array
- Cart updates immediately (React state)

**2.5 Clear Form:**
- Resets `prodItemId` to ''
- Resets `prodQty` to ''
- Resets `prodAvgCost` to ''
- Form ready for next entry

### **Step 3: Repeat (Optional)**

User can repeat Steps 1-2 to add more items:
- Each entry is independent
- Serial numbers auto-increment per item
- Cart displays all entries
- User can remove entries from cart

### **Step 4: Review Cart**

User reviews staged entries:
- Sees all items in cart
- Sees quantities, weights, serial numbers
- Sees total units count
- Can remove entries if needed

### **Step 5: Finalize**

User clicks "Finalize & Save":

**5.1 Open Summary Modal:**
- Shows comparison with yesterday's production
- Shows variance (today vs yesterday)
- User reviews and confirms

**5.2 Process Entries:**
- Sets `isProcessingProduction` = true (prevents double-click)
- Calls `addProduction(stagedProds)` for each entry sequentially
- Each entry:
  - Saves to Firebase
  - Creates ledger entries
  - Updates item stock quantities
  - Updates serial numbers
  - Consumes WIP (FIFO)

**5.3 Clear Cart:**
- Clears `stagedProds` array
- Clears `tempSerialTracker`
- Closes summary modal
- Resets `isProcessingProduction` = false

**5.4 Show Results:**
- Success message
- Warning if any items skipped (invalid prices)

### **Step 6: Loop Continues**

Form ready for next batch:
- Date remains selected
- Form fields cleared
- Cart empty
- Process repeats from Step 1

---

## 📊 **CSV UPLOAD SYSTEM** ⭐ **KEY FEATURE**

### **CSV Upload Process Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│  User Clicks "Choose CSV File"                             │
│                          ↓                                  │
│  File Selected (Papa.parse)                                │
│                          ↓                                  │
│  Parse CSV (header: true, skipEmptyLines: true)            │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FOR EACH ROW:                                       │  │
│  │  1. Validate Required Fields                        │  │
│  │  2. Find Item by Code/ID                            │  │
│  │  3. Validate Quantity > 0                           │  │
│  │  4. Parse Date Format                               │  │
│  │  5. Calculate Weight                                │  │
│  │  6. Get Production Price                            │  │
│  │  7. Calculate Serial Numbers (if tracked)           │  │
│  │  8. Create ProductionEntry                          │  │
│  │  9. Add to parsedEntries Array                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  Collect Errors (if any)                                  │
│                          ↓                                  │
│  Add Valid Entries to Staging Cart                        │
│  (stagedProds = [...stagedProds, ...parsedEntries])       │
│                          ↓                                  │
│  Update tempSerialTracker                                  │
│                          ↓                                  │
│  Show Success/Error Message                                │
│                          ↓                                  │
│  User Reviews Cart                                         │
│                          ↓                                  │
│  User Clicks "Finalize & Save"                            │
│  (Same as manual entry finalization)                       │
└─────────────────────────────────────────────────────────────┘
```

### **CSV Format Specification:**

**Required Columns:**
- **Production Date:** Date in YYYY-MM-DD format
- **Item ID:** Item code or ID (must exist in system)
- **Quantity:** Number of units produced (must be > 0)

**Optional Columns:**
- **Production Price:** Price per unit (if not provided, uses item's avgCost)

**CSV Example:**
```csv
Production Date,Item ID,Quantity,Production Price
2025-01-15,ITEM-001,100,12.50
2025-01-15,ITEM-002,50,15.00
2025-01-15,ITEM-003,25,
2025-01-15,ITEM-004,200,10.00
```

### **CSV Processing Logic:**

**Location:** `components/DataEntry.tsx` lines 2676-2750

**Step-by-Step:**

1. **File Selection:**
   - User selects CSV file
   - File input triggers `handleProductionCSVUpload`

2. **CSV Parsing:**
   - Uses Papa.parse library
   - Header: true (first row is column names)
   - SkipEmptyLines: true

3. **Row Validation:**
   ```typescript
   // Check required fields
   if (!row['Production Date'] || !row['Item ID'] || !row['Quantity']) {
       errors.push(`Row ${idx + 2}: Missing required fields`);
       continue;
   }
   
   // Find item
   const item = state.items.find(i => 
       i.code === row['Item ID'] || i.id === row['Item ID']
   );
   if (!item) {
       errors.push(`Row ${idx + 2}: Item "${row['Item ID']}" not found`);
       continue;
   }
   
   // Validate quantity
   const qty = parseFloat(row['Quantity']);
   if (isNaN(qty) || qty <= 0) {
       errors.push(`Row ${idx + 2}: Invalid quantity`);
       continue;
   }
   ```

4. **Date Parsing:**
   ```typescript
   let productionDate = row['Production Date'];
   // Handle different date formats
   if (!/^\d{4}-\d{2}-\d{2}$/.test(productionDate)) {
       const dateObj = new Date(productionDate);
       if (!isNaN(dateObj.getTime())) {
           const year = dateObj.getFullYear();
           const month = String(dateObj.getMonth() + 1).padStart(2, '0');
           const day = String(dateObj.getDate()).padStart(2, '0');
           productionDate = `${year}-${month}-${day}`;
       }
   }
   ```

5. **Calculate Values:**
   ```typescript
   // Weight calculation
   const weightProduced = qty * item.weightPerUnit;
   
   // Production price (priority: CSV > item.avgCost > 0)
   const productionPrice = row['Production Price'] 
       ? parseFloat(row['Production Price'])
       : (item.avgCost || 0);
   ```

6. **Serial Number Calculation:**
   ```typescript
   let serialStart: number | undefined;
   let serialEnd: number | undefined;
   
   if (item.packingType !== PackingType.KG) {
       const startNum = getNextSerialNumber(item.id);
       serialStart = startNum;
       serialEnd = startNum + qty - 1;
       // Update temp tracker
       setTempSerialTracker(prev => ({
           ...prev,
           [item.id]: (serialEnd || 0) + 1
       }));
   }
   ```

7. **Create Entry:**
   ```typescript
   const entry: ProductionEntry = {
       id: Math.random().toString(36).substr(2, 9),
       date: productionDate,
       itemId: item.id,
       itemName: item.name,
       packingType: item.packingType,
       qtyProduced: qty,
       weightProduced: weightProduced,
       serialStart: serialStart,
       serialEnd: serialEnd,
       factoryId: state.currentFactory?.id || '',
       productionPrice: productionPrice
   };
   parsedEntries.push(entry);
   ```

8. **Add to Cart:**
   ```typescript
   setStagedProds([...stagedProds, ...parsedEntries]);
   ```

9. **Show Results:**
   - If errors: Shows error count and first few errors
   - If success: Shows "Successfully loaded {count} production entry(ies) from CSV"

### **CSV Validation Rules:**

- ✅ **Production Date:** Required, must be valid date format
- ✅ **Item ID:** Required, must exist in system (matches code or ID)
- ✅ **Quantity:** Required, must be > 0
- ⚠️ **Production Price:** Optional (uses item.avgCost if not provided)
- ✅ **Item Must Be Finished Good:** Item category must not be "Raw Material"

### **CSV Error Handling:**

- **Missing Fields:** Row skipped, error added to errors array
- **Item Not Found:** Row skipped, error added
- **Invalid Quantity:** Row skipped, error added
- **Invalid Date:** Row skipped, error added
- **Valid Rows:** Added to staging cart
- **Error Display:** Shows first few errors in alert, full list in console

---

## 📊 **DATA STRUCTURE**

### **ProductionEntry Object:**

```typescript
interface ProductionEntry {
    id: string;                    // Unique identifier (random string before save)
    date: string;                  // Production date (YYYY-MM-DD)
    itemId: string;                // Item ID (links to Item)
    itemName: string;              // Item name (denormalized)
    packingType: PackingType;      // Bale, Sack, Kg, Box, Bag
    factoryId: string;             // Factory assignment
    qtyProduced: number;           // Quantity produced (units)
    weightProduced: number;        // Total weight (kg) = qty × weightPerUnit
    serialStart?: number;          // Start serial number (if tracked)
    serialEnd?: number;            // End serial number (if tracked)
    isRebaling?: boolean;          // Flag for re-baling operations
    productionPrice?: number;      // Production price per unit (override)
}
```

### **Staging Cart State:**

```typescript
// Array of ProductionEntry objects
const stagedProds: ProductionEntry[] = [
    {
        id: "abc123",
        date: "2025-01-15",
        itemId: "ITEM-001",
        itemName: "Men's T-Shirts",
        packingType: PackingType.BALE,
        qtyProduced: 10,
        weightProduced: 450,  // 10 × 45kg
        serialStart: 101,
        serialEnd: 110,
        factoryId: "FACTORY-001",
        productionPrice: 12.50
    },
    // ... more entries
];
```

### **Temp Serial Tracker:**

```typescript
// Tracks next serial number per item for current session
const tempSerialTracker: Record<string, number> = {
    "ITEM-001": 111,  // Next serial for ITEM-001
    "ITEM-002": 56,   // Next serial for ITEM-002
    // ...
};
```

---

## 🎯 **KEY CALCULATIONS**

### **Serial Number Calculation:**

```typescript
const getNextSerialNumber = (itemId: string): number => {
    // Priority 1: Check tempSerialTracker (current session)
    if (tempSerialTracker[itemId]) {
        return tempSerialTracker[itemId];
    }
    
    // Priority 2: Check existing productions (find max serialEnd)
    const itemProductions = state.productions.filter(p => 
        p.itemId === itemId && p.serialEnd
    );
    if (itemProductions.length > 0) {
        const maxSerial = Math.max(...itemProductions.map(p => p.serialEnd || 0));
        return maxSerial + 1;
    }
    
    // Priority 3: Use item's nextSerial
    const item = state.items.find(i => i.id === itemId);
    return item?.nextSerial || 1;
};
```

**Serial Number Application:**
- Only for tracked items (Bale, Sack, Box, Bag)
- NOT for items with `packingType === 'Kg'`
- `serialStart` = calculated next number
- `serialEnd` = `serialStart + qty - 1`
- Updates `tempSerialTracker` after each addition

### **Weight Calculation:**

```typescript
weightProduced = qtyProduced × item.weightPerUnit
```

**Example:**
- Item: "Men's T-Shirts" with `weightPerUnit = 45 kg`
- Quantity: 10 units
- **Weight Produced:** 10 × 45 = **450 kg**

### **Production Price Priority:**

```typescript
// Priority order:
1. prodAvgCost (user-entered override)
2. item.avgCost (from Setup > Items)
3. 0 (fallback, item will be skipped if 0)
```

### **Total Units Calculation:**

```typescript
totalUnits = stagedProds.reduce((sum, p) => sum + p.qtyProduced, 0)
```

---

## ✅ **VALIDATION RULES**

### **Before Adding to Cart:**

- ✅ **Item:** Must be selected (finished goods only)
- ✅ **Quantity:** Must be entered and > 0
- ⚠️ **Production Price:** Optional (uses item.avgCost if not provided)
- ✅ **Item Must Exist:** Item must be in system

### **Before Finalizing:**

- ✅ **Cart Must Have Entries:** `stagedProds.length > 0`
- ✅ **All Entries Must Have:**
  - Item ID
  - Quantity > 0
  - Date
  - Production Price > 0 (or item.avgCost > 0)

### **CSV Validation:**

- ✅ **Required Fields:** Production Date, Item ID, Quantity
- ✅ **Item Must Exist:** Item ID must match item code or ID
- ✅ **Quantity Must Be Positive:** Must be > 0
- ✅ **Date Format:** YYYY-MM-DD (auto-converts other formats)
- ⚠️ **Production Price:** Optional (uses item.avgCost if not provided)

---

## 🔍 **SERIAL NUMBER TRACKING**

### **Serial Number Logic:**

1. **Check Temp Tracker:** If item has entries in current session, use next number from tracker
2. **Check Existing Productions:** Find max `serialEnd` for this item in database
3. **Use Item's nextSerial:** Fall back to item's `nextSerial` property
4. **Fallback:** Start at 1

### **Serial Number Updates:**

**During Staging:**
- `tempSerialTracker[itemId]` tracks next serial for current session
- Updated after each addition to cart

**After Finalization:**
- Item's `nextSerial` updated in database
- `tempSerialTracker` cleared

### **Serial Number Display:**

- **In Cart:** Shows "#{serialStart} - #{serialEnd}" (emerald green badge)
- **In History:** Shows "#{serialStart} - #{serialEnd}" (monospace, small text)
- **Not Tracked:** Shows "-" (dash) for Kg items

---

## 🎨 **UI/UX DESIGN NOTES**

### **Visual Hierarchy:**

- **Primary Actions:** Blue button (Add to List), Emerald green button (Finalize & Save)
- **Secondary Actions:** Red buttons (Remove, Delete)
- **Information Boxes:** Gray backgrounds with borders
- **Staging Cart:** Right column, prominent display
- **CSV Upload:** Top section, easy access

### **Form Layout:**

- **Grid System:** 7/12 left (form), 5/12 right (cart)
- **Responsive:** Adapts to screen size
- **Spacing:** Consistent padding and margins
- **Grouping:** Related fields grouped logically

### **Feedback:**

- **Disabled States:** Gray background when disabled
- **Required Fields:** Visual indicators
- **Validation:** Clear error messages
- **Progress:** Loading spinner during finalization
- **Empty States:** Clear messages when cart/history is empty

### **Accessibility:**

- **Labels:** Clear, descriptive labels
- **Placeholders:** Helpful placeholder text
- **Empty States:** Clear messages when no data
- **Error Messages:** Clear validation feedback

---

## 🔍 **EDGE CASES & SPECIAL BEHAVIORS**

### **1. Empty Cart**

- Submit button disabled
- Cart shows "No items added yet" message
- User must add at least one item

### **2. Serial Number Conflicts**

- Temp tracker prevents conflicts within session
- Database check prevents conflicts across sessions
- Auto-increments correctly

### **3. Missing Production Price**

- Uses item's avgCost if not provided
- Skips item if both missing (shows warning)
- CSV allows optional Production Price column

### **4. Date Change**

- Changing date clears staging cart
- History filters by selected date
- Each date has independent cart

### **5. Item Deletion**

- If item deleted after adding to cart, entry shows "Unknown"
- System handles gracefully
- User can remove invalid entries

### **6. CSV Upload Errors**

- Invalid rows skipped
- Valid rows added to cart
- Errors shown in alert
- User can review and fix

### **7. Processing State**

- `isProcessingProduction` prevents double-click
- Shows loading spinner
- Disables buttons during processing
- Prevents form interaction

---

## 💡 **DESIGN RECOMMENDATIONS FOR NEW APP**

### **1. Cart Loop System**

- Make cart visible and prominent
- Show real-time updates
- Allow easy item removal
- Display totals clearly
- Provide batch save functionality

### **2. CSV Upload**

- Provide clear template
- Show validation errors
- Support bulk operations
- Allow review before save
- Handle errors gracefully

### **3. Serial Number Tracking**

- Auto-calculate serials
- Show next serial in UI
- Prevent conflicts
- Update in real-time
- Support tracked and non-tracked items

### **4. Validation & Feedback**

- Validate before adding to cart
- Show clear error messages
- Provide confirmation for finalization
- Display progress during save
- Show success/error results

### **5. History Display**

- Show entries for selected date
- Allow quick deletion
- Display key information
- Provide visual feedback

---

## 📊 **COMPARISON: MANUAL vs CSV ENTRY**

| Aspect | Manual Entry | CSV Upload |
|--------|-------------|------------|
| **Input Method** | Form fields | CSV file |
| **Speed** | One entry at a time | Multiple entries at once |
| **Validation** | Real-time | Batch validation |
| **Error Handling** | Immediate feedback | Error list |
| **Serial Numbers** | Auto-calculated | Auto-calculated |
| **Cart Addition** | Immediate | After parsing |
| **Finalization** | Same process | Same process |

---

## 🔄 **ACCOUNTING IMPACT**

### **When Production is Saved:**

1. **Ledger Entries Created:**
   - **Debit:** Inventory - Finished Goods (production value)
   - **Credit:** Work in Progress (WIP consumed, if applicable)
   - **Credit:** Production Gain / Capital (difference)

2. **Inventory Impact:**
   - Finished Goods inventory increases
   - Work in Progress decreases (if consumed)
   - Item stock quantities updated
   - Serial numbers updated

3. **Cost Tracking:**
   - Production value = qty × productionPrice
   - WIP consumed using FIFO logic
   - Production gain = finishedGoodsValue - wipValueConsumed

---

## 🎯 **USER WORKFLOW SUMMARY**

### **Manual Entry:**

1. **Select Production Date** (defaults to today)
2. **Select Item** (auto-populates production price)
3. **Enter Quantity**
4. **Optionally Override Production Price**
5. **Click "Add to List"** (adds to cart)
6. **Repeat Steps 2-5** for more items
7. **Review Cart** (remove items if needed)
8. **Click "Finalize & Save"** (opens summary modal)
9. **Confirm** (processes all entries)
10. **Review Results** (success/error message)

### **CSV Upload:**

1. **Click "Download Template"** (get CSV format)
2. **Fill CSV** with production entries
3. **Click "Choose CSV File"** (select filled CSV)
4. **System Validates** (checks required fields, finds items)
5. **Entries Added to Cart** (if valid)
6. **Review Cart** (remove invalid entries if needed)
7. **Click "Finalize & Save"** (same as manual entry)
8. **Confirm** (processes all entries)
9. **Review Results** (success/error message)

---

## 📋 **FORM FIELD SUMMARY TABLE**

| Section | Field Name | Type | Required | Default | Auto-Populated From |
|---------|-----------|------|----------|---------|-------------------|
| Date | Production Date | Date | Yes | Today | System date |
| Manual Entry | Item | Dropdown | Yes* | - | - |
| Manual Entry | Quantity | Number | Yes* | - | - |
| Manual Entry | Avg Cost | Number | No | - | Item avgCost |
| CSV Upload | CSV File | File | Yes* | - | - |
| CSV Upload | Production Date | Date | Yes* | - | CSV row |
| CSV Upload | Item ID | Text | Yes* | - | CSV row |
| CSV Upload | Quantity | Number | Yes* | - | CSV row |
| CSV Upload | Production Price | Number | No* | - | CSV row or item avgCost |

*Required only when adding to cart

---

## 🎨 **VISUAL LAYOUT STRUCTURE**

```
┌─────────────────────────────────────────────────────────┐
│  Production Date: [YYYY-MM-DD]                          │
├─────────────────────────────────────────────────────────┤
│  [CSV Upload Section]                                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Bulk Upload (CSV)                                 │  │
│  │ [Choose CSV File] [Template]                      │  │
│  └───────────────────────────────────────────────────┘  │
│  ──────────── OR ADD MANUALLY ────────────             │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌─────────────────────┐ │
│  │ Select Item               │  │ Staged Entries (3)  │ │
│  │ Packing: Bale (#101)      │  │                     │ │
│  │                           │  │ [Entry Card 1]      │ │
│  │ Quantity (Units)         │  │ [Entry Card 2]      │ │
│  │ Avg Cost (USD/Unit)      │  │ [Entry Card 3]      │ │
│  │                           │  │                     │ │
│  │ [+ Add to List]          │  │ Total Units: 150    │ │
│  │                           │  │ [Finalize & Save]   │ │
│  └──────────────────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  Saved Entries (2025-01-15)                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Item    │ Qty │ Weight │ Serials │ Action        │  │
│  ├─────────┼─────┼────────┼─────────┼───────────────┤  │
│  │ Item 1  │ 100 │ 450 kg │ #1-#100 │ [Delete]      │  │
│  │ Item 2  │ 50  │ 225 kg │ #101-   │ [Delete]      │  │
│  │         │     │        │ #150    │               │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 **PRODUCTION SUMMARY MODAL**

When user clicks "Finalize & Save", a summary modal opens:

### **Modal Structure:**

**Header:**
- **Title:** "Confirm Production ({count} entries)"
- **Icon:** CheckCircle icon (emerald-500)
- **Close Button:** X icon

**Body:**
- **Description:** "Please review the staged items before saving. Compare with yesterday's output to ensure consistency."
- **Comparison Table:**
  - **Columns:** Item, Qty (Today), Yesterday, Variance
  - **Rows:** One per staged entry
  - **Variance:** Shows difference (green if positive, red if negative)

**Processing State:**
- Shows loading spinner
- Text: "Processing production entries..."
- Prevents interaction

**Footer:**
- **Cancel Button:** Closes modal
- **Save & Continue Button:** Processes entries

---

**End of Structure Guide**
