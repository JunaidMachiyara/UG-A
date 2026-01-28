# Container Off Loading Form - Complete Structure Guide
## For New App Construction

**Module:** Container Off-Loading

---

## 📋 **OVERVIEW**

The Container Off Loading form allows users to track the arrival and off-loading of containers from both Original Purchases (raw materials) and Bundle Purchases (finished goods). It reconciles invoiced weights against received weights, manages warehouse assignments, and automatically creates production entries for Bundle Purchases. The form uses a **filter-based selection system** to find containers and supports **dual input modes** depending on purchase type.

**Key Purpose:**
- Track container arrivals and off-loading operations
- Reconcile invoiced weight vs. received weight (detect shortages/excess)
- Assign warehouses to received containers
- Create production entries for Bundle Purchases (finished goods)
- Update purchase status from "In Transit" to "Arrived"
- Maintain logistics tracking records

**Key Difference from Other Forms:**
- **Original Purchase:** Records purchase of raw materials (creates container shipment)
- **Bundle Purchase:** Records purchase of finished goods (creates container shipment)
- **Container Off Loading:** Records arrival and off-loading of containers (reconciles weights, updates status)
- **Logistics Module:** Views and edits logistics entries (read-only/update mode)

---

## 🔍 **FILTER-BASED CONTAINER SELECTION SYSTEM** ⭐ **KEY FEATURE**

The Container Off Loading form uses a sophisticated **filter and selection system** to locate containers from both Original Purchases and Bundle Purchases. Containers are unified into a single "Shipment" list, with placeholder entries created for purchases that don't yet have logistics entries.

### **Filter System Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                    FILTER BAR                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Status Filter: [In Transit | Arrived | Cleared]    │  │
│  │  Supplier Filter: [All Suppliers | Specific]        │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         SHIPMENT UNIFICATION LOGIC                     │  │
│  │  1. Scan all Purchases (Original)                    │  │
│  │     • Skip if no containerNumber                     │  │
│  │     • Check for existing LogisticsEntry              │  │
│  │     • If exists: Use LogisticsEntry                  │  │
│  │     • If not: Create PLACEHOLDER-ORIG-{id}           │  │
│  │                                                  │  │
│  │  2. Scan all BundlePurchases                        │  │
│  │     • Skip if no containerNumber                     │  │
│  │     • Check for existing LogisticsEntry              │  │
│  │     • If exists: Use LogisticsEntry                  │  │
│  │     • If not: Create PLACEHOLDER-BUN-{id}            │  │
│  │                                                  │  │
│  │  3. Apply Filters                                    │  │
│  │     • Filter by status (In Transit/Arrived/Cleared) │  │
│  │     • Filter by supplier (if selected)               │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         CONTAINER SELECTOR DROPDOWN                   │  │
│  │  Display: "{containerNumber} ({Type}) - {status}"   │  │
│  │  Example: "MSCU1234567 (Original) - In Transit"     │  │
│  │           "ABC7890123 (Bundle) - Arrived"            │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│              Selected Container Loaded                      │
│              Form Fields Populated                          │
└─────────────────────────────────────────────────────────────┘
```

### **Placeholder vs. Real Entry Logic:**

- **Placeholder Entry:** Created when a Purchase/BundlePurchase exists but no LogisticsEntry has been created yet
  - ID Format: `PLACEHOLDER-ORIG-{purchaseId}` or `PLACEHOLDER-BUN-{purchaseId}`
  - Status: Inherited from purchase status (or defaults to "In Transit")
  - Invoiced Weight: From purchase (`weightPurchased` for Original, calculated for Bundle)
  - Received Weight: 0 (if status is "In Transit") or purchase weight (if "Arrived"/"Cleared")

- **Real Entry:** Existing LogisticsEntry found in `state.logisticsEntries`
  - ID: Actual Firebase document ID
  - Status: From LogisticsEntry (takes precedence over purchase status)
  - All fields: From LogisticsEntry

---

## 📝 **FORM STRUCTURE**

### **SECTION 1: FILTER BAR**

**Layout:** Horizontal bar at top of form, 4-column grid (responsive)

**Fields:**

#### **1.1 Status Filter**
- **Type:** Dropdown Select
- **Options:** 
  - `"In Transit"` (default)
  - `"Arrived"`
  - `"Cleared"`
- **Purpose:** Filter containers by logistics status
- **Behavior:** Changes `filterStatus` state, triggers `filteredShipments` recalculation

#### **1.2 Supplier Filter**
- **Type:** EntitySelector Dropdown
- **Options:** All partners with `type === 'SUPPLIER'`
- **Placeholder:** "All Suppliers"
- **Purpose:** Filter containers by supplier
- **Behavior:** Optional filter, can be cleared to show all suppliers

#### **1.3 Container Selector**
- **Type:** EntitySelector Dropdown (2-column span)
- **Options:** `filteredShipments` mapped to display format
- **Display Format:** `"{containerNumber} ({purchaseType}) - {status}"`
  - Example: `"MSCU1234567 (Original) - In Transit"`
  - Example: `"ABC7890123 (Bundle) - Arrived"`
- **Placeholder:** "Select Container..."
- **Purpose:** Select container to off-load
- **Behavior:** 
  - On selection, sets `selectedContainerId`
  - Triggers `activeShipment` calculation
  - Populates form fields via `useEffect`

---

### **SECTION 2: CONTAINER DETAILS PANEL**

**Layout:** Gray background box, 4-column grid, displayed when `activeShipment` is selected

**Fields (Read-Only Display):**

#### **2.1 Supplier**
- **Source:** Looked up from purchase's `supplierId` → `state.partners`
- **Display:** Partner name

#### **2.2 Batch / Type**
- **Source:** 
  - Original Purchase: `batchNumber` + `originalType`
  - Bundle Purchase: `batchNumber` + "Bundle Purchase (Stock Lot)"
- **Display:** `"{batchNumber} - {type}"`

#### **2.3 Division / Sub-Division**
- **Source:** Looked up from purchase's `divisionId` and `subDivisionId`
- **Display:** `"{division} / {subDivision}"` or `"-"` if not set

#### **2.4 Invoiced Weight**
- **Source:** `activeShipment.invoicedWeight`
- **Display:** Large, bold, monospace font: `"{weight} Kg"`
- **Purpose:** Reference weight from purchase/invoice

---

### **SECTION 3: OFF-LOADING INPUTS**

**Layout:** 2-column grid (responsive), left column for inputs, right column for summary

#### **3.1 Arrival Date**
- **Type:** Date Input
- **Default:** Today's date (`new Date().toISOString().split('T')[0]`)
- **Required:** Yes (implicitly, must be set)
- **Purpose:** Record when container arrived/off-loaded
- **Storage:** Saved to `LogisticsEntry.arrivalDate`

#### **3.2 Warehouse Assignment**
- **Type:** EntitySelector Dropdown
- **Options:** All warehouses from `state.warehouses`
- **Placeholder:** "Select Warehouse..."
- **Required:** Yes (validated before save)
- **Auto-Population:** 
  - If `activeShipment.warehouseId` exists, uses that
  - Otherwise, defaults to first warehouse in list (if available)
- **Purpose:** Assign container to warehouse location
- **Storage:** Saved to `LogisticsEntry.warehouseId`

---

### **SECTION 4: WEIGHT RECONCILIATION (DUAL MODE)** ⭐ **KEY FEATURE**

The form displays different input modes depending on the purchase type:

#### **4.1 Original Purchase Mode** (Raw Materials)

**Layout:** Blue background box with scale icon

**Field:**

##### **Received Weight (Kg)**
- **Type:** Number Input
- **Placeholder:** "0.00"
- **Required:** Yes (must be > 0)
- **Validation:** 
  - Must be a valid number
  - Must be greater than 0
  - Alert shown if invalid: "Please enter a valid received weight (must be greater than 0)"
- **Display:** Large, bold text (text-2xl), blue-themed
- **Purpose:** Enter actual weight received for raw materials
- **Storage:** Saved to `LogisticsEntry.receivedWeight`
- **Calculation:** 
  - `shortageKg = invoicedWeight - receivedWeight`
  - Can be negative (shortage) or positive (excess)

---

#### **4.2 Bundle Purchase Mode** (Finished Goods)

**Layout:** White box with "Bundle Tally Sheet" header

**Fields:**

##### **Tally Item Selection**
- **Type:** EntitySelector Dropdown
- **Options:** All items from `state.items`
- **Placeholder:** "Item..."
- **Purpose:** Select finished good item to tally

##### **Tally Quantity**
- **Type:** Number Input
- **Placeholder:** "Qty"
- **Width:** Fixed width (w-24)
- **Purpose:** Enter quantity of items tallied

##### **Add to Tally Button**
- **Type:** Button with Plus icon
- **Disabled:** When `tallyItemId` or `tallyQty` is empty
- **Action:** Calls `handleAddTally()`
- **Behavior:**
  - Validates item and quantity
  - Calculates weight: `weight = qty * itemDef.weightPerUnit`
  - Adds to `tallyList` array
  - Clears input fields

##### **Tally List Display**
- **Layout:** Scrollable list (max-h-40), shows all tallied items
- **Display Format:** `"{itemName} x {qty}"` + `"{weight} kg"` + Remove button
- **Remove Action:** Removes item from `tallyList`
- **Empty State:** Shows "No items tallied" message

**Tally Calculation:**
- **Total Received Weight:** Sum of all `tallyList[].weight`
- **Validation:** Must have at least one item in tally list
- **Storage:** Saved to `LogisticsEntry.tallyItems` array
- **Format:** `[{ itemId: string, qty: number, weight: number }]`

---

### **SECTION 5: RECONCILIATION SUMMARY**

**Layout:** Right column, gray background box, flex column layout

**Display Fields:**

#### **5.1 Invoiced Weight**
- **Label:** "Invoiced Weight:"
- **Value:** `activeShipment.invoicedWeight.toLocaleString() + " Kg"`
- **Display:** Monospace font, medium weight

#### **5.2 Received Weight**
- **Label:** "Received Weight:"
- **Value:** 
  - Original Purchase: `parseFloat(receivedWeight || '0').toLocaleString() + " Kg"`
  - Bundle Purchase: `tallyList.reduce((acc, curr) => acc + curr.weight, 0).toLocaleString() + " Kg"`
- **Display:** Monospace font, bold, blue color (`text-blue-700`)

#### **5.3 Shortage/Excess**
- **Label:** "Excess:" (if positive) or "Shortage:" (if negative)
- **Value:** `shortageDiff.toLocaleString() + " Kg"`
- **Calculation:** `shortageDiff = currentReceived - invoicedWeight`
- **Display:** 
  - Large text (text-lg)
  - Green if excess (`text-emerald-600`)
  - Red if shortage (`text-red-600`)
  - Shows "+" prefix if positive
- **Border:** Top border separator

---

### **SECTION 6: FINALIZE BUTTON**

**Layout:** Full-width button at bottom of summary panel

**Button:**
- **Text:** "Finalize Off-Loading"
- **Icon:** Truck icon
- **Color:** Emerald green (`bg-emerald-600`, `hover:bg-emerald-700`)
- **Action:** Calls `handleSave()` async function
- **Validation:** 
  - Checks `activeShipment` exists
  - Checks `warehouseId` is set
  - Original Purchase: Validates `receivedWeight > 0`
  - Bundle Purchase: Validates `tallyList.length > 0`

---

## 🔄 **COMPLETE WORKFLOW**

### **Workflow Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER OPENS FORM                           │
│  • Default filter: "In Transit"                             │
│  • Container selector shows filtered containers             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              USER SELECTS CONTAINER                           │
│  • Selects from dropdown                                    │
│  • System loads activeShipment                               │
│  • Form fields auto-populate (if existing entry)            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│         USER ENTERS OFF-LOADING DATA                         │
│                                                              │
│  IF Original Purchase:                                      │
│    • Enter Arrival Date                                     │
│    • Select Warehouse                                       │
│    • Enter Received Weight (Kg)                             │
│                                                              │
│  IF Bundle Purchase:                                        │
│    • Enter Arrival Date                                     │
│    • Select Warehouse                                       │
│    • Tally Items (add multiple items)                       │
│      - Select Item                                          │
│      - Enter Quantity                                       │
│      - Click Add                                            │
│      - Repeat for all items                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│            USER REVIEWS RECONCILIATION                        │
│  • Invoiced Weight displayed                                │
│  • Received Weight calculated                               │
│  • Shortage/Excess shown (color-coded)                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│         USER CLICKS "FINALIZE OFF-LOADING"                    │
│                                                              │
│  VALIDATION:                                                 │
│  • Container selected? ✓                                     │
│  • Warehouse selected? ✓                                     │
│  • Original: Received weight > 0? ✓                         │
│  • Bundle: Tally list not empty? ✓                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              DATA PREPARATION                                 │
│                                                              │
│  1. Calculate finalReceivedWeight:                          │
│     • Original: parseFloat(receivedWeight)                   │
│     • Bundle: sum(tallyList[].weight)                       │
│                                                              │
│  2. Calculate shortage:                                     │
│     • shortage = invoicedWeight - finalReceivedWeight        │
│                                                              │
│  3. Prepare tallyItems (Bundle only):                       │
│     • Map tallyList to { itemId, qty, weight }              │
│                                                              │
│  4. Determine entry ID:                                     │
│     • If placeholder: Generate new ID                        │
│     • If existing: Use existing ID                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│         CREATE LOGISTICS ENTRY                               │
│                                                              │
│  LogisticsEntry Object:                                      │
│  {                                                           │
│    id: (new or existing),                                   │
│    purchaseId: activeShipment.purchaseId,                    │
│    purchaseType: activeShipment.purchaseType,                │
│    containerNumber: activeShipment.containerNumber,         │
│    arrivalDate: arrivalDate,                                │
│    status: 'Arrived',                                       │
│    warehouseId: warehouseId,                                 │
│    invoicedWeight: activeShipment.invoicedWeight,           │
│    receivedWeight: finalReceivedWeight,                     │
│    shortageKg: shortage,                                    │
│    tallyItems: finalTallyItems (Bundle only)                │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│      BUNDLE PURCHASE: CREATE PRODUCTION ENTRIES              │
│                                                              │
│  IF purchaseType === 'BUNDLE':                              │
│    • Map tallyList to ProductionEntry[]                     │
│    • Each entry:                                            │
│      - id: `PROD-OFF-{entry.id}-{itemId}-{random}`         │
│      - date: arrivalDate                                    │
│      - itemId: tally.itemId                                 │
│      - itemName: item.name                                  │
│      - packingType: item.packingType                        │
│      - qtyProduced: tally.qty                              │
│      - weightProduced: tally.weight                         │
│    • Call addProduction(productionEntries)                  │
│    • This increases finished goods inventory                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              SAVE TO DATABASE                                 │
│                                                              │
│  saveLogisticsEntry(entry):                                 │
│  1. Check if entry exists (by purchaseId + purchaseType)    │
│  2. If exists: Update Firebase document                     │
│  3. If new: Create Firebase document                        │
│  4. Dispatch to local state                                 │
│  5. Update purchase status (if Original + Arrived)          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              SUCCESS & CLEANUP                                │
│                                                              │
│  • Change filter to "Arrived"                               │
│  • Show success alert                                       │
│  • Reset form fields                                        │
│  • Clear container selection                                │
│  • Container now visible in "Arrived" filter                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **DATA STRUCTURES**

### **LogisticsEntry Interface**

```typescript
interface LogisticsEntry {
    id: string;                    // Firebase document ID (or placeholder ID)
    purchaseId: string;             // Links to Purchase or BundlePurchase
    purchaseType: 'ORIGINAL' | 'BUNDLE';
    containerNumber: string;        // Container/shipment number
    status: 'In Transit' | 'Arrived' | 'Cleared';
    
    // Dates
    arrivalDate?: string;           // Unload Date (YYYY-MM-DD)
    etd?: string;                   // Estimated Time Departure
    eta?: string;                   // Estimated Time Arrival
    portStorage?: string;           // Port storage date
    doValidation?: string;          // D/o VLD date
    groundDate?: string;            // Ground date
    
    // Locations
    warehouseId?: string;           // Assigned warehouse
    
    // Weights
    invoicedWeight: number;         // Weight from purchase/invoice (Kg)
    receivedWeight: number;         // Actual weight received (Kg)
    shortageKg: number;             // Invoiced - Received (can be negative for excess)
    
    // Documentation & Clearing
    documentStatus?: 'Pending' | 'Submitted' | 'Received';
    freightForwarderId?: string;
    clearingAgentId?: string;
    clearingBillNo?: string;
    clearingAmount?: number;
    
    // Only for Bundle Purchases
    tallyItems?: {                  // Array of tallied items
        itemId: string;
        qty: number;
        weight: number;             // Calculated: qty * itemDef.weightPerUnit
    }[];
}
```

### **Tally List State (Bundle Purchases)**

```typescript
type TallyListItem = {
    id: string;                     // Temporary ID for React key
    itemId: string;                 // Item ID from state.items
    qty: number;                    // Quantity tallied
    weight: number;                  // Calculated weight (qty * weightPerUnit)
};

const [tallyList, setTallyList] = useState<TallyListItem[]>([]);
```

### **Shipment Unification Logic**

The form creates a unified list of shipments from two sources:

1. **Original Purchases** (`state.purchases`):
   - Filtered to only include purchases with `containerNumber`
   - Checked for existing `LogisticsEntry` (by `purchaseId` + `purchaseType: 'ORIGINAL'`)
   - If exists: Use `LogisticsEntry`
   - If not: Create placeholder with `invoicedWeight = purchase.weightPurchased`

2. **Bundle Purchases** (`state.bundlePurchases`):
   - Filtered to only include purchases with `containerNumber`
   - Checked for existing `LogisticsEntry` (by `purchaseId` + `purchaseType: 'BUNDLE'`)
   - If exists: Use `LogisticsEntry`
   - If not: Create placeholder with `invoicedWeight = sum(items[].qty * itemDef.weightPerUnit)`

---

## 🔢 **KEY CALCULATIONS**

### **1. Received Weight Calculation**

**Original Purchase:**
```typescript
finalReceivedWeight = parseFloat(receivedWeight);
```

**Bundle Purchase:**
```typescript
finalReceivedWeight = tallyList.reduce((acc, curr) => acc + curr.weight, 0);
// Where curr.weight = curr.qty * itemDef.weightPerUnit
```

### **2. Shortage/Excess Calculation**

```typescript
shortageKg = invoicedWeight - receivedWeight;
// Positive = shortage (received less than invoiced)
// Negative = excess (received more than invoiced)
```

### **3. Tally Item Weight Calculation**

```typescript
const itemDef = state.items.find(i => i.id === tallyItemId);
const weight = qty * (itemDef?.weightPerUnit || 0);
```

### **4. Current Received Weight (Live Display)**

```typescript
const currentReceived = activeShipment?.purchaseType === 'ORIGINAL' 
    ? parseFloat(receivedWeight || '0')
    : tallyList.reduce((acc, curr) => acc + curr.weight, 0);
```

### **5. Shortage Difference (Live Display)**

```typescript
const shortageDiff = activeShipment 
    ? currentReceived - activeShipment.invoicedWeight 
    : 0;
```

---

## ✅ **VALIDATION RULES**

### **Form-Level Validation:**

1. **Container Selection:**
   - Must select a container from dropdown
   - Error: "Please select a container to off-load."

2. **Warehouse Assignment:**
   - Must select a warehouse
   - Error: "Please select a warehouse destination."

3. **Original Purchase - Received Weight:**
   - Must be a valid number
   - Must be greater than 0
   - Error: "Please enter a valid received weight (must be greater than 0)"

4. **Bundle Purchase - Tally List:**
   - Must have at least one item in tally list
   - Error: "Please tally at least one item before finalizing."

### **Data Integrity:**

- **Placeholder Handling:** Placeholder entries are converted to real entries on save (new ID generated)
- **Existing Entry Update:** If `LogisticsEntry` already exists, it is updated (not duplicated)
- **Purchase Status Update:** Original Purchases with status "In Transit" are updated to "Arrived" on off-loading

---

## 🎨 **UI/UX DESIGN NOTES**

### **Visual Hierarchy:**

- **Primary Actions:** Emerald green button ("Finalize Off-Loading")
- **Information Boxes:** Gray backgrounds (`bg-slate-50`) with borders
- **Input Sections:** 
  - Original Purchase: Blue-themed box (`bg-blue-50`, `border-blue-100`)
  - Bundle Purchase: White box with slate header (`bg-slate-100`)
- **Summary Panel:** Gray background, right column, flex layout

### **Status Indicators:**

- **Shortage:** Red text (`text-red-600`)
- **Excess:** Green text (`text-emerald-600`)
- **Received Weight:** Blue, bold (`text-blue-700`, `font-bold`)
- **Invoiced Weight:** Slate, medium (`text-slate-800`, `font-medium`)

### **Responsive Design:**

- Filter bar: 1 column on mobile, 4 columns on desktop
- Form inputs: 1 column on mobile, 2 columns on desktop
- Details panel: 2 columns on mobile, 4 columns on desktop

### **User Feedback:**

- **Success Alert:** Shows after successful save, includes instruction to check "Arrived" filter
- **Error Alerts:** Shown for validation failures
- **Auto-Filter Change:** Filter automatically changes to "Arrived" after successful save
- **Form Reset:** Form clears after successful save (but filter remains on "Arrived")

### **Accessibility:**

- Labels are clearly associated with inputs
- Button states (disabled/enabled) are visually distinct
- Color coding for shortage/excess provides visual feedback
- Icons provide additional context (Container, Truck, Scale, CheckCircle)

---

## 🔗 **INTEGRATION WITH OTHER MODULES**

### **1. Original Purchase Module**

- **Link:** `LogisticsEntry.purchaseId` → `Purchase.id`
- **Relationship:** One Purchase can have one LogisticsEntry
- **Status Update:** Purchase status updated to "Arrived" when off-loaded

### **2. Bundle Purchase Module**

- **Link:** `LogisticsEntry.purchaseId` → `BundlePurchase.id`
- **Relationship:** One BundlePurchase can have one LogisticsEntry
- **Production Creation:** Off-loading creates `ProductionEntry[]` for tallied items

### **3. Production Module**

- **Link:** Bundle Purchase off-loading creates production entries
- **Purpose:** Increases finished goods inventory
- **Entry Format:** `id: "PROD-OFF-{logisticsId}-{itemId}-{random}"`

### **4. Logistics Module**

- **Link:** `LogisticsEntry` records are viewable/editable in Logistics Module
- **Purpose:** Logistics Module provides full logistics tracking (ETD, ETA, clearing, etc.)
- **Relationship:** Container Off Loading creates/updates LogisticsEntry records

### **5. Warehouse Management**

- **Link:** `LogisticsEntry.warehouseId` → `Warehouse.id`
- **Purpose:** Tracks which warehouse received the container
- **Display:** Warehouse name shown in Logistics Module

---

## 📋 **FORM FIELD SUMMARY TABLE**

| Section | Field Name | Type | Required | Default | Auto-Populated From |
|---------|-----------|------|----------|---------|-------------------|
| Filter | Status Filter | Dropdown | No | "In Transit" | - |
| Filter | Supplier Filter | Dropdown | No | - | - |
| Filter | Container Selector | Dropdown | Yes* | - | Filtered shipments |
| Details | Supplier | Display | - | - | Purchase supplierId |
| Details | Batch / Type | Display | - | - | Purchase batchNumber, originalType |
| Details | Division / Sub-Division | Display | - | - | Purchase divisionId, subDivisionId |
| Details | Invoiced Weight | Display | - | - | Purchase weightPurchased / calculated |
| Inputs | Arrival Date | Date | Yes* | Today | System date |
| Inputs | Warehouse | Dropdown | Yes* | First warehouse | Existing entry / default |
| Original | Received Weight (Kg) | Number | Yes* | - | Existing entry |
| Bundle | Tally Item | Dropdown | Yes* | - | - |
| Bundle | Tally Quantity | Number | Yes* | - | - |
| Bundle | Tally List | Display | Yes* | - | Existing entry |

*Required only when finalizing off-loading

---

## 🔄 **STATUS TRANSITIONS**

### **Container Status Flow:**

```
In Transit → Arrived → Cleared
     ↓           ↓
  (Off-load)  (Clearing)
```

- **In Transit:** Container is on the way, not yet arrived
- **Arrived:** Container has arrived and been off-loaded (via Container Off Loading form)
- **Cleared:** Container has cleared customs (updated in Logistics Module)

### **Purchase Status Update (Original Purchases Only):**

When an Original Purchase container is off-loaded:
- If purchase status is "In Transit", it is updated to "Arrived"
- This update happens in `saveLogisticsEntry` function
- Bundle Purchases do not trigger purchase status updates

---

## 🎯 **EDGE CASES & SPECIAL SCENARIOS**

### **1. Placeholder Entries**

- **Scenario:** Purchase exists but no LogisticsEntry created yet
- **Handling:** Form creates placeholder entry for display
- **On Save:** Placeholder ID is replaced with new Firebase document ID

### **2. Existing LogisticsEntry**

- **Scenario:** LogisticsEntry already exists (e.g., from CSV import)
- **Handling:** Form uses existing entry, updates it on save
- **ID Preservation:** Existing ID is kept (not regenerated)

### **3. Missing Container Number**

- **Scenario:** Purchase has no `containerNumber`
- **Handling:** Purchase is skipped in shipment unification (not shown in list)

### **4. Bundle Purchase Without Items**

- **Scenario:** BundlePurchase has no items (edge case)
- **Handling:** `invoicedWeight` defaults to 0 for placeholder

### **5. Tally Item Not Found**

- **Scenario:** Item in tally list no longer exists in `state.items`
- **Handling:** Item name shows as "Unknown" in production entry

### **6. Warehouse Deleted**

- **Scenario:** Selected warehouse is deleted from system
- **Handling:** Form shows warehouse ID (not name) if warehouse not found

### **7. Multiple Containers Same Number**

- **Scenario:** Multiple purchases have same container number (shouldn't happen, but possible)
- **Handling:** Each purchase gets its own LogisticsEntry (distinguished by `purchaseId`)

---

## 💾 **DATABASE OPERATIONS**

### **Firebase Collections:**

1. **`logisticsEntries` Collection:**
   - Stores `LogisticsEntry` documents
   - Document ID: Auto-generated or existing ID
   - Fields: All `LogisticsEntry` fields (except `id` stored as document ID)

### **Save Logic:**

```typescript
saveLogisticsEntry(entry):
  1. Check if entry exists:
     - Query by purchaseId + purchaseType + factoryId
     - Check local state first
     - Check Firebase if not in local state
  
  2. If exists:
     - Update existing document
     - Preserve document ID
  
  3. If new:
     - Create new document
     - Generate new document ID
  
  4. Update local state:
     - Dispatch SAVE_LOGISTICS_ENTRY action
  
  5. Update purchase status (if applicable):
     - If Original Purchase + status "Arrived"
     - Update Purchase document status
```

### **Production Entry Creation (Bundle Purchases):**

```typescript
IF purchaseType === 'BUNDLE':
  FOR EACH item in tallyList:
    CREATE ProductionEntry {
      id: `PROD-OFF-{logisticsId}-{itemId}-{random}`,
      date: arrivalDate,
      itemId: item.itemId,
      itemName: item.name,
      packingType: item.packingType,
      qtyProduced: item.qty,
      weightProduced: item.weight
    }
  
  CALL addProduction(productionEntries[])
  // This increases finished goods inventory
```

---

## 🔍 **ACCOUNTING IMPACT**

### **Container Off Loading (General):**

- **No Direct Ledger Entries:** Container Off Loading does not create ledger entries
- **Purpose:** Tracks logistics and inventory reconciliation only

### **Bundle Purchase Off Loading (Production Entries):**

- **Inventory Impact:** Creates `ProductionEntry[]` which increases finished goods inventory
- **Accounting:** Production entries may trigger accounting logic (depending on production settings)
- **Stock Update:** Finished goods stock quantities increase by tallied quantities

### **Purchase Status Update:**

- **Original Purchase:** Status change from "In Transit" to "Arrived" (no accounting impact)
- **Purpose:** Tracks purchase lifecycle, may affect reporting

---

## 🚀 **PERFORMANCE CONSIDERATIONS**

### **Optimizations:**

1. **Memoized Calculations:**
   - `allShipments`: Memoized based on purchases, bundlePurchases, logisticsEntries, items
   - `filteredShipments`: Memoized based on filters and allShipments
   - `activeShipment`: Memoized based on allShipments and selectedContainerId
   - `activePurchaseDetails`: Memoized based on activeShipment and related lookups

2. **Efficient Filtering:**
   - Filters applied after shipment unification (single pass)
   - Supplier lookup cached in memoized calculations

3. **Lazy Loading:**
   - Form fields only rendered when `activeShipment` is selected
   - Details panel conditionally rendered

### **Potential Improvements:**

- **Pagination:** If many containers, consider paginating filtered list
- **Debouncing:** Filter inputs could be debounced for large datasets
- **Virtual Scrolling:** Container selector dropdown could use virtual scrolling for many items

---

## 📝 **IMPLEMENTATION NOTES FOR NEW APP**

### **Required State Management:**

```typescript
// Filters
const [filterStatus, setFilterStatus] = useState<'In Transit' | 'Arrived' | 'Cleared'>('In Transit');
const [filterSupplier, setFilterSupplier] = useState('');
const [selectedContainerId, setSelectedContainerId] = useState('');

// Form State
const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().split('T')[0]);
const [warehouseId, setWarehouseId] = useState('');
const [receivedWeight, setReceivedWeight] = useState('');

// Bundle Purchase Tally
const [tallyItemId, setTallyItemId] = useState('');
const [tallyQty, setTallyQty] = useState('');
const [tallyList, setTallyList] = useState<TallyListItem[]>([]);
```

### **Required Derived Data:**

```typescript
// Shipment unification (memoized)
const allShipments = useMemo(() => {
  // Combine purchases and bundlePurchases into unified list
  // Create placeholders for purchases without LogisticsEntry
}, [purchases, bundlePurchases, logisticsEntries, items]);

// Filtered shipments (memoized)
const filteredShipments = useMemo(() => {
  // Apply status and supplier filters
}, [allShipments, filterStatus, filterSupplier, ...]);

// Active shipment (memoized)
const activeShipment = useMemo(() => {
  return allShipments.find(s => s.id === selectedContainerId);
}, [allShipments, selectedContainerId]);
```

### **Required Functions:**

1. **`handleAddTally()`:** Add item to tally list (Bundle Purchases)
2. **`handleSave()`:** Finalize off-loading, save LogisticsEntry, create production entries

### **Required Context/API:**

- `useData()` hook providing:
  - `state.purchases`
  - `state.bundlePurchases`
  - `state.logisticsEntries`
  - `state.items`
  - `state.warehouses`
  - `state.partners`
  - `state.divisions`
  - `state.subDivisions`
  - `saveLogisticsEntry(entry: LogisticsEntry)`
  - `addProduction(entries: ProductionEntry[])`

---

## 🎓 **SUMMARY**

The Container Off Loading form is a critical logistics tracking module that:

1. **Unifies containers** from both Original Purchases and Bundle Purchases into a single interface
2. **Reconciles weights** between invoiced and received amounts
3. **Manages warehouse assignments** for received containers
4. **Creates production entries** for Bundle Purchases (finished goods inventory)
5. **Updates purchase status** for Original Purchases (In Transit → Arrived)
6. **Uses filter-based selection** to locate containers efficiently
7. **Supports dual input modes** (weight input for Original, tally sheet for Bundle)

The form is designed for warehouse operations staff to record container arrivals and reconcile physical receipts against purchase invoices, ensuring accurate inventory tracking and logistics management.

---

**End of Document**
