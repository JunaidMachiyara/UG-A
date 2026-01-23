# Finished Goods Production - Add to Cart Loop Process
## Technical Implementation Specification

---

## 📋 **OVERVIEW**

The Finished Goods Production module implements a **staging/cart-based workflow** where users can add multiple production entries to a temporary cart before finalizing and saving them to the database. This allows batch production entry with validation, serial number tracking, and review before commit.

---

## 🔄 **PROCESS FLOW DIAGRAM**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Production Date: [YYYY-MM-DD]                       │  │
│  │  Item: [Dropdown - Select Item]                       │  │
│  │  Quantity: [Number Input]                             │  │
│  │  Production Price: [Number Input - Optional]         │  │
│  │  [Add to Cart] Button                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│              handleStageProduction()                         │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              STAGED PRODUCTION CART                   │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │ Item Name | Qty | Weight | Price | Serial    │   │  │
│  │  │ [Remove]  |     |        |       |           │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
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
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 **TECHNICAL IMPLEMENTATION**

### **1. STATE MANAGEMENT**

#### **Component State Variables**
**Location:** `components/DataEntry.tsx` (lines 150-158)

```typescript
// Production form state
const [prodDate, setProdDate] = useState<string>(new Date().toISOString().split('T')[0]);
const [prodItemId, setProdItemId] = useState<string>('');
const [prodQty, setProdQty] = useState<string>('');
const [prodAvgCost, setProdAvgCost] = useState<string>('');

// Staging/Cart state
const [stagedProds, setStagedProds] = useState<ProductionEntry[]>([]);
const [showProdSummary, setShowProdSummary] = useState<boolean>(false);

// Serial number tracking (temporary, session-based)
const [tempSerialTracker, setTempSerialTracker] = useState<Record<string, number>>({});

// Processing state (prevents double-submission)
const [isProcessingProduction, setIsProcessingProduction] = useState<boolean>(false);
```

**State Purpose:**
- `prodDate`: Production date (defaults to today)
- `prodItemId`: Selected item ID from dropdown
- `prodQty`: Quantity to produce (string for input validation)
- `prodAvgCost`: Production price override (optional, string for input)
- `stagedProds`: **Cart array** - holds all production entries before finalization
- `tempSerialTracker`: Tracks serial numbers for current session (before save)
- `isProcessingProduction`: Prevents multiple simultaneous finalizations

---

### **2. AUTO-POPULATE PRODUCTION PRICE**

**Location:** `components/DataEntry.tsx` (lines 160-172)

```typescript
useEffect(() => {
    if (prodItemId) {
        const item = state.items.find(i => i.id === prodItemId);
        if (item && item.avgCost !== undefined && item.avgCost !== null) {
            setProdAvgCost(item.avgCost.toString());
        } else {
            setProdAvgCost('');
        }
    } else {
        setProdAvgCost('');
    }
}, [prodItemId, state.items]);
```

**Behavior:**
- When user selects an item, automatically populates `prodAvgCost` field with item's `avgCost`
- If item has no `avgCost`, field remains empty
- User can override the auto-populated value
- Clears when no item is selected

---

### **3. SERIAL NUMBER TRACKING**

**Location:** `components/DataEntry.tsx` (lines 63-80)

```typescript
// Helper function to get the next available serial number for an item
const getNextSerialNumber = (itemId: string): number => {
    // Check tempSerialTracker first (for current session)
    if (tempSerialTracker[itemId]) {
        return tempSerialTracker[itemId];
    }
    
    // Find the highest serial number used in ALL productions for this item
    const itemProductions = state.productions.filter(p => 
        p.itemId === itemId && p.serialEnd
    );
    if (itemProductions.length > 0) {
        const maxSerial = Math.max(...itemProductions.map(p => p.serialEnd || 0));
        return maxSerial + 1;
    }
    
    // Fall back to item's nextSerial or 1
    const item = state.items.find(i => i.id === itemId);
    return item?.nextSerial || 1;
};
```

**Serial Number Logic:**
1. **Priority 1:** Check `tempSerialTracker` (current session's staged entries)
2. **Priority 2:** Check existing productions in database (find max `serialEnd`)
3. **Priority 3:** Use item's `nextSerial` property
4. **Fallback:** Start at 1

**Serial Number Application:**
- Only applies to **tracked items** (Bale, Sack, Box, Bag)
- Does NOT apply to items with `packingType === 'Kg'`
- `serialStart` = calculated next number
- `serialEnd` = `serialStart + qty - 1`
- Updates `tempSerialTracker` after each addition

**Example:**
- Item has existing productions with max `serialEnd = 100`
- User adds 5 units to cart → `serialStart = 101`, `serialEnd = 105`
- User adds 3 more units → `serialStart = 106`, `serialEnd = 108`
- After finalization, item's `nextSerial` becomes 109

---

### **4. ADD TO CART PROCESS**

**Location:** `components/DataEntry.tsx` (lines 2575-2615)

#### **Function: `handleStageProduction`**

```typescript
const handleStageProduction = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation: Check required fields
    if (!prodItemId || !prodQty) return;
    
    // Find item in system
    const item = state.items.find(i => i.id === prodItemId);
    if (!item) return;
    
    // Parse and validate quantity
    const qty = parseFloat(prodQty);
    if (isNaN(qty) || qty <= 0) return;

    // SERIAL NUMBER CALCULATION
    let serialStart: number | undefined;
    let serialEnd: number | undefined;

    // Apply Serial Logic for Bale, Sack, Box, Bag (not Kg)
    if (item.packingType !== PackingType.KG) {
        const startNum = getNextSerialNumber(item.id);
        serialStart = startNum;
        serialEnd = startNum + qty - 1;
        // Update temp tracker for next addition
        setTempSerialTracker(prev => ({ 
            ...prev, 
            [item.id]: (serialEnd || 0) + 1 
        }));
    }

    // PRODUCTION PRICE CALCULATION
    // Priority: prodAvgCost (user input) > item.avgCost (from Setup)
    const avgCostValue = prodAvgCost 
        ? parseFloat(prodAvgCost) 
        : (item.avgCost || 0);
    const productionPrice = isNaN(avgCostValue) 
        ? (item.avgCost || 0) 
        : avgCostValue;

    // CREATE PRODUCTION ENTRY OBJECT
    const newEntry: ProductionEntry = {
        id: Math.random().toString(36).substr(2, 9), // Temporary ID
        date: prodDate,
        itemId: item.id,
        itemName: item.name,
        packingType: item.packingType,
        qtyProduced: qty,
        weightProduced: qty * item.weightPerUnit, // Auto-calculated
        serialStart,
        serialEnd,
        factoryId: state.currentFactory?.id || '',
        productionPrice: productionPrice
    };
    
    // ADD TO CART (stagedProds array)
    setStagedProds([...stagedProds, newEntry]);
    
    // CLEAR FORM FIELDS
    setProdItemId('');
    setProdQty('');
    setProdAvgCost(''); // Clear avgCost field after adding to list
};
```

#### **Step-by-Step Process:**

1. **Form Validation**
   - Checks `prodItemId` and `prodQty` are not empty
   - Validates item exists in system
   - Validates quantity is a positive number

2. **Serial Number Calculation** (if applicable)
   - Checks if item is tracked (not `PackingType.KG`)
   - Calculates `serialStart` using `getNextSerialNumber()`
   - Calculates `serialEnd = serialStart + qty - 1`
   - Updates `tempSerialTracker` for next addition

3. **Production Price Resolution**
   - **Priority 1:** User-entered `prodAvgCost` (if provided)
   - **Priority 2:** Item's `avgCost` from Setup
   - **Fallback:** 0 (will be handled during finalization)

4. **Production Entry Creation**
   - Generates temporary ID (random string)
   - Sets production date
   - Links to item (ID and name)
   - Calculates weight: `qty × item.weightPerUnit`
   - Sets serial numbers (if tracked)
   - Sets factory ID from current factory
   - Sets production price

5. **Add to Cart**
   - Appends new entry to `stagedProds` array
   - Uses spread operator to maintain immutability

6. **Form Reset**
   - Clears item selection
   - Clears quantity
   - Clears production price (so next item can auto-populate)

---

### **5. CART DISPLAY & MANAGEMENT**

**Location:** `components/DataEntry.tsx` (UI rendering section)

#### **Cart Display Features:**
- Shows all staged production entries in a table
- Displays: Item Name, Quantity, Weight (kg), Production Price, Serial Range
- Allows removal of individual entries from cart
- Shows total count and summary

#### **Remove from Cart:**
```typescript
const handleRemoveFromCart = (index: number) => {
    const updated = stagedProds.filter((_, i) => i !== index);
    setStagedProds(updated);
    // Note: Serial numbers are NOT recalculated when removing
    // This is intentional - user should re-add if they want correct serials
};
```

**Important:** Removing items from cart does NOT recalculate serial numbers. This prevents serial number conflicts if user removes and re-adds items.

---

### **6. FINALIZATION PROCESS**

**Location:** `components/DataEntry.tsx` (lines 2617-2673)

#### **Function: `handleFinalizeProduction`**

```typescript
const handleFinalizeProduction = async () => {
    // Validation: Check cart is not empty
    if (stagedProds.length === 0) {
        return;
    }
    
    // Prevent multiple simultaneous finalizations
    if (isProcessingProduction) {
        return;
    }
    
    // Set processing flag
    setIsProcessingProduction(true);
    
    try {
        // Clear any previous skipped items (from window object)
        delete (window as any).__skippedProductionItems;
        
        // Call backend function to save productions
        await addProduction(stagedProds);
        
        // SUCCESS: Clear cart and reset state
        setStagedProds([]);
        setTempSerialTracker({});
        setShowProdSummary(false);
        
        // Check for skipped items (items with invalid prices)
        const skippedItems = (window as any).__skippedProductionItems;
        if (skippedItems && skippedItems.length > 0) {
            // Show warning about skipped items
            const skippedList = skippedItems.slice(0, 10).map((s: any) => 
                `  • ${s.itemName} (Qty: ${s.qty}) - ${s.reason}`
            ).join('\n');
            const moreCount = skippedItems.length > 10 
                ? `\n  ... and ${skippedItems.length - 10} more items` 
                : '';
            
            alert(`✅ Production Saved Successfully!\n\n⚠️ However, ${skippedItems.length} item(s) were skipped due to invalid prices:\n\n${skippedList}${moreCount}\n\nPlease update the production prices (avgCost) in Setup > Items for these items and re-upload them.`);
            
            delete (window as any).__skippedProductionItems;
        } else {
            alert("✅ Production Saved Successfully!");
        }
    } catch (error: any) {
        console.error('❌ Error saving production:', error);
        
        // Check for skipped items even on error
        const skippedItems = (window as any).__skippedProductionItems;
        if (skippedItems && skippedItems.length > 0) {
            // Show error with skipped items info
            const skippedList = skippedItems.slice(0, 5).map((s: any) => 
                `  • ${s.itemName} - ${s.reason}`
            ).join('\n');
            alert(`❌ Error saving production: ${error.message || 'Unknown error'}\n\n⚠️ ${skippedItems.length} item(s) were also skipped due to invalid prices:\n${skippedList}${skippedItems.length > 5 ? `\n  ... and ${skippedItems.length - 5} more` : ''}\n\nPlease check the browser console (F12) for details.`);
            delete (window as any).__skippedProductionItems;
        } else {
            alert(`❌ Error saving production: ${error.message || 'Unknown error'}\n\nPlease check the browser console (F12) for details.`);
        }
        
        // Don't clear stagedProds on error so user can retry
    } finally {
        setIsProcessingProduction(false);
    }
};
```

#### **Finalization Steps:**

1. **Pre-Flight Checks**
   - Validates cart is not empty
   - Prevents double-submission with `isProcessingProduction` flag

2. **Clear Previous State**
   - Clears any previous skipped items from window object

3. **Backend Call**
   - Calls `addProduction(stagedProds)` from DataContext
   - This is an async operation that:
     - Saves to Firebase
     - Creates ledger entries
     - Updates item stock

4. **Success Handling**
   - Clears cart (`setStagedProds([])`)
   - Resets serial tracker
   - Hides summary
   - Shows success message
   - If items were skipped (invalid prices), shows warning

5. **Error Handling**
   - Catches and displays errors
   - Shows skipped items info if any
   - **Does NOT clear cart** on error (allows retry)

---

### **7. BACKEND PROCESSING**

**Location:** `context/DataContext.tsx` (lines 3517-4020)

#### **Function: `addProduction`**

This function handles the actual database operations and accounting.

#### **7.1 Save to Firebase**

```typescript
// Batch writes for performance (Firebase limit: 500 operations per batch)
const BATCH_SIZE = 500;
const productionSavePromises: Promise<void>[] = [];

for (let i = 0; i < productionsWithFactory.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const batchProductions = productionsWithFactory.slice(i, i + BATCH_SIZE);
    
    batchProductions.forEach(prod => {
        const { id, ...prodData } = prod;
        
        // Remove undefined fields (Firebase doesn't allow undefined)
        const cleanedData = Object.fromEntries(
            Object.entries(prodData).filter(([_, value]) => value !== undefined)
        );
        
        // Store original ID for ledger entry matching
        const cleanedDataWithId = { 
            ...cleanedData, 
            originalId: id, 
            createdAt: serverTimestamp() 
        };
        
        const prodRef = doc(collection(db, 'productions'));
        batch.set(prodRef, cleanedDataWithId);
    });
    
    await batch.commit();
}
```

**Key Points:**
- Uses Firebase batch writes (max 500 per batch)
- Removes undefined fields (Firebase requirement)
- Stores `originalId` for ledger entry matching
- Adds `createdAt` timestamp

#### **7.2 Account Validation**

```typescript
// Find required accounts
const fgInvId = state.accounts.find(a => 
    a.name.includes('Inventory - Finished Goods')
)?.id;

const wipId = state.accounts.find(a => 
    a.name.includes('Work in Progress')
)?.id;

let productionGainId = state.accounts.find(a => 
    a.name.includes('Production Gain')
)?.id;

// Validate Finished Goods account exists
if (!fgInvId) {
    throw new Error('Required account not found: Inventory - Finished Goods');
}

// Fallback to Capital if Production Gain not found
if (!productionGainId) {
    productionGainId = state.accounts.find(a => 
        a.name.includes('Capital') || 
        a.name.includes('Owner\'s Capital') ||
        a.code === '301'
    )?.id;
}
```

#### **7.3 Ledger Entry Creation**

**For Each Production Entry:**

```typescript
productionsWithFactory.forEach(prod => {
    const item = state.items.find(i => i.id === prod.itemId);
    if (!item) {
        // Skip and track
        skippedItems.push({
            itemName: prod.itemName || prod.itemId,
            reason: 'Item not found in system',
            qty: prod.qtyProduced
        });
        return;
    }
    
    // Calculate production value
    const productionPrice = prod.productionPrice || item.avgCost || 0;
    const finishedGoodsValue = prod.qtyProduced * productionPrice;
    
    // Skip if invalid price
    if (productionPrice === undefined || productionPrice === null || 
        isNaN(productionPrice) || finishedGoodsValue === 0) {
        skippedItems.push({
            itemName: prod.itemName,
            reason: 'Invalid production price',
            qty: prod.qtyProduced
        });
        return; // Production entry still saved, but no ledger entry
    }
    
    // WIP Consumption (FIFO)
    let wipValueConsumed = 0;
    if (wipId && totalWipBalance > 0) {
        const availableWip = Math.max(0, totalWipBalance - cumulativeWipConsumedInBatch);
        if (availableWip > 0) {
            wipValueConsumed = Math.min(availableWip, Math.abs(finishedGoodsValue));
            cumulativeWipConsumedInBatch += wipValueConsumed;
        }
    }
    
    // Capital Credit = Finished Goods Value - WIP Consumed
    const capitalCredit = finishedGoodsValue - wipValueConsumed;
    
    // Create ledger entries
    const transactionId = `PROD-${prod.id}`;
    const entries: Omit<LedgerEntry, 'id'>[] = [
        // Debit: Inventory - Finished Goods
        {
            date: prod.date,
            transactionId,
            transactionType: TransactionType.PRODUCTION,
            accountId: fgInvId,
            accountName: 'Inventory - Finished Goods',
            currency: 'USD',
            exchangeRate: 1,
            fcyAmount: Math.abs(finishedGoodsValue),
            debit: finishedGoodsValue >= 0 ? finishedGoodsValue : 0,
            credit: finishedGoodsValue < 0 ? Math.abs(finishedGoodsValue) : 0,
            narration: `Production: ${prod.itemName} (${prod.qtyProduced} units, ${totalKg}kg)`,
            factoryId: prod.factoryId
        }
    ];
    
    // Credit: Work in Progress (if consumed)
    if (wipId && wipValueConsumed > 0) {
        entries.push({
            date: prod.date,
            transactionId,
            transactionType: TransactionType.PRODUCTION,
            accountId: wipId,
            accountName: 'Work in Progress',
            currency: 'USD',
            exchangeRate: 1,
            fcyAmount: wipValueConsumed,
            debit: 0,
            credit: wipValueConsumed,
            narration: `WIP Consumption for ${prod.itemName}`,
            factoryId: prod.factoryId
        });
    }
    
    // Credit: Production Gain / Capital (remainder)
    if (capitalCredit !== 0 && productionGainId) {
        entries.push({
            date: prod.date,
            transactionId,
            transactionType: TransactionType.PRODUCTION,
            accountId: productionGainId,
            accountName: 'Production Gain',
            currency: 'USD',
            exchangeRate: 1,
            fcyAmount: Math.abs(capitalCredit),
            debit: capitalCredit < 0 ? Math.abs(capitalCredit) : 0,
            credit: capitalCredit > 0 ? capitalCredit : 0,
            narration: `Production Gain for ${prod.itemName}`,
            factoryId: prod.factoryId
        });
    }
    
    allLedgerEntries.push(...entries);
});

// Post all ledger entries in batch
if (allLedgerEntries.length > 0) {
    postTransaction(allLedgerEntries);
}
```

#### **7.4 Stock Updates**

**Location:** `context/DataContext.tsx` (reducer: `ADD_PRODUCTION`)

```typescript
case 'ADD_PRODUCTION': {
    const updatedItems = state.items.map(item => {
        // Aggregate all production entries for this item
        const itemProductions = action.payload.filter(p => p.itemId === item.id);
        if (itemProductions.length > 0) {
            const totalQtyChange = itemProductions.reduce(
                (sum, p) => sum + p.qtyProduced, 
                0
            );
            const maxSerialEnd = Math.max(
                ...itemProductions
                    .filter(p => p.serialEnd !== undefined)
                    .map(p => p.serialEnd || 0),
                0
            );
            const isTracked = item.packingType !== PackingType.KG;
            
            return {
                ...item,
                stockQty: item.stockQty + totalQtyChange,
                nextSerial: (maxSerialEnd > 0 && isTracked) 
                    ? maxSerialEnd + 1 
                    : item.nextSerial
            };
        }
        return item;
    });
    
    return {
        ...state,
        items: updatedItems,
        productions: [...state.productions, ...action.payload]
    };
}
```

**Stock Update Logic:**
- Aggregates all productions for each item
- Updates `stockQty` by adding total quantity produced
- Updates `nextSerial` to `maxSerialEnd + 1` (for tracked items only)
- Updates local state immediately
- Firebase update happens separately

---

## 📊 **DATA STRUCTURES**

### **ProductionEntry Interface**

```typescript
interface ProductionEntry {
    id: string;                    // Temporary ID (random string) before save
    date: string;                  // Production date (YYYY-MM-DD)
    itemId: string;                // Item ID (links to Item)
    itemName: string;              // Item name (denormalized)
    packingType: PackingType;      // Bale, Sack, Kg, Box, Bag
    factoryId: string;             // Factory assignment
    qtyProduced: number;           // Quantity produced (units)
    weightProduced: number;         // Total weight (kg) = qty × weightPerUnit
    serialStart?: number;           // Start serial number (if tracked)
    serialEnd?: number;             // End serial number (if tracked)
    isRebaling?: boolean;           // Flag for re-baling operations
    productionPrice?: number;        // Production price per unit (override)
}
```

### **Staged Production Cart**

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

### **Temp Serial Tracker**

```typescript
// Tracks next serial number per item for current session
const tempSerialTracker: Record<string, number> = {
    "ITEM-001": 111,  // Next serial for ITEM-001
    "ITEM-002": 56,   // Next serial for ITEM-002
    // ...
};
```

---

## 🔍 **VALIDATION RULES**

### **Frontend Validation (Before Adding to Cart)**

1. **Required Fields:**
   - ✅ `prodItemId` must be selected
   - ✅ `prodQty` must be provided and > 0

2. **Item Validation:**
   - ✅ Item must exist in `state.items`
   - ✅ Item must have valid `weightPerUnit`

3. **Quantity Validation:**
   - ✅ Must be a valid number
   - ✅ Must be > 0
   - ✅ Parsed as float (allows decimals)

4. **Production Price:**
   - ⚠️ Optional (can be empty)
   - ⚠️ If provided, must be valid number
   - ⚠️ Falls back to item's `avgCost` if not provided

### **Backend Validation (During Finalization)**

1. **Item Existence:**
   - ❌ If item not found → Production entry skipped, error logged

2. **Production Price Validation:**
   - ❌ If `productionPrice` is `undefined`, `null`, or `NaN` → Ledger entry skipped
   - ❌ If `finishedGoodsValue === 0` → Ledger entry skipped
   - ⚠️ Production entry still saved to Firebase (for inventory tracking)
   - ⚠️ User notified of skipped items

3. **Account Validation:**
   - ❌ If "Inventory - Finished Goods" account missing → **Throws error, stops all processing**
   - ⚠️ If "Production Gain" missing → Falls back to "Capital" account
   - ⚠️ If "Work in Progress" missing → Production continues without WIP consumption

---

## 🎯 **KEY FEATURES**

### **1. Batch Entry Support**
- User can add multiple items to cart before finalizing
- All entries processed in single transaction
- Serial numbers tracked across batch

### **2. Serial Number Management**
- Automatic serial number calculation
- Session-based tracking (tempSerialTracker)
- Prevents conflicts with existing productions
- Only for tracked items (Bale, Sack, Box, Bag)

### **3. Production Price Override**
- User can override item's default `avgCost`
- Auto-populates from item's `avgCost` when item selected
- Falls back to item's `avgCost` if not provided

### **4. Error Handling**
- Graceful handling of missing items
- Skips invalid prices (but saves production entry)
- Shows detailed error messages
- Allows retry on error (cart not cleared)

### **5. Performance Optimization**
- Firebase batch writes (500 per batch)
- Parallel batch processing
- Efficient state updates

---

## 🐛 **EDGE CASES & GOTCHAS**

### **1. Serial Number Conflicts**
**Issue:** If user removes item from cart and re-adds, serial numbers don't recalculate.

**Solution:** User should clear cart and re-add all items if they want correct serials.

**Better Solution (for redesign):** Recalculate serials when removing from cart.

### **2. Invalid Production Prices**
**Issue:** Items with missing/invalid prices still create production entries but no ledger entries.

**Behavior:**
- Production entry saved to Firebase ✅
- Stock quantity updated ✅
- Ledger entry NOT created ❌
- User notified via alert ⚠️

**Impact:** Balance sheet may be incomplete, but inventory tracking continues.

### **3. WIP Consumption Logic**
**Issue:** WIP consumed using simplified FIFO (not true FIFO by date).

**Current Logic:**
- Consumes WIP up to production value
- Tracks cumulative consumption across batch
- May not match actual WIP consumption order

**Better Solution (for redesign):** Implement true FIFO by date.

### **4. Negative Production Values**
**Support:** System supports negative values (e.g., garbage items with negative cost).

**Behavior:**
- Creates credit entry for Finished Goods
- Handles negative WIP consumption
- Handles negative capital credit

### **5. Re-baling Flag**
**Special Case:** If `isRebaling === true`, different accounting logic applies.

**Accounting:**
- Consumed items: Credit Finished Goods
- Produced items: Debit Finished Goods
- Gain/Loss: Recorded in Production Gain

---

## 📝 **CSV UPLOAD SUPPORT**

**Location:** `components/DataEntry.tsx` (lines 2675-2802)

The system also supports CSV upload which follows the same cart-based workflow:

1. **CSV Parsing:** Parses CSV file using PapaParse
2. **Validation:** Validates each row
3. **Staging:** Adds parsed entries to `stagedProds` cart
4. **Finalization:** User clicks "Finalize & Save" (same as manual entry)

**CSV Format:**
```csv
Production Date,Item ID,Quantity,Production Price
2025-01-15,ITEM-001,10,12.50
2025-01-15,ITEM-002,5,15.00
```

**CSV Processing:**
- Finds items by code or ID
- Validates quantity
- Uses Production Price from CSV (or item's avgCost)
- Calculates serial numbers
- Adds to cart (same as manual entry)

---

## 🔄 **COMPLETE LOOP SUMMARY**

### **User Workflow:**

1. **Select Production Date** (defaults to today)
2. **Select Item** from dropdown
   - Production Price auto-populates
3. **Enter Quantity**
4. **Optionally Override Production Price**
5. **Click "Add to Cart"**
   - Entry added to `stagedProds`
   - Serial numbers calculated (if tracked)
   - Form cleared
6. **Repeat Steps 2-5** for more items
7. **Review Cart** (table display)
8. **Click "Finalize & Save"**
   - Validates cart
   - Calls `addProduction()`
   - Saves to Firebase
   - Creates ledger entries
   - Updates stock
   - Shows success/error message
   - Clears cart

### **System Workflow:**

1. **Frontend:**
   - Form input → Validation → Add to cart
   - Cart management → Finalization trigger

2. **Backend:**
   - Save productions to Firebase (batch writes)
   - Validate accounts
   - Calculate WIP consumption (FIFO)
   - Create ledger entries (double-entry)
   - Update item stock quantities
   - Update serial numbers

3. **State Updates:**
   - Local state updated immediately
   - Firebase listeners update on save
   - UI reflects changes

---

## 🎨 **UI/UX CONSIDERATIONS**

### **Form Design:**
- Clean, simple form
- Auto-population reduces typing
- Clear validation feedback
- Disabled submit when cart empty

### **Cart Display:**
- Table format for easy review
- Shows all relevant information
- Remove button for each entry
- Summary totals

### **Feedback:**
- Success message on save
- Error messages with details
- Skipped items warning
- Processing indicator

---

## 🚀 **PERFORMANCE OPTIMIZATIONS**

1. **Batch Writes:** Firebase batch writes (500 per batch)
2. **Parallel Processing:** Multiple batches processed in parallel
3. **State Updates:** Efficient React state updates
4. **Serial Tracking:** In-memory tracking (no database queries)
5. **Debouncing:** Not applicable (manual trigger)

---

## 📚 **REFERENCES**

- **Component:** `components/DataEntry.tsx`
- **Context:** `context/DataContext.tsx`
- **Types:** `types.ts` (ProductionEntry interface)
- **Constants:** `constants.ts` (PackingType enum)

---

**End of Technical Specification**
