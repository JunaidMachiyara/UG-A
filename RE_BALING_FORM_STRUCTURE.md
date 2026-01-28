# Re-baling Form - Complete Structure Guide
## For New App Construction

**Module:** Data Entry > Production > Re-baling

---

## 📋 **OVERVIEW**

The Re-baling form allows users to record the conversion of finished goods into different finished goods. This is a transformation process where existing finished goods inventory is consumed and new finished goods are produced. The form uses a **dual-cart workflow** where users add items to consume (left side) and items to produce (right side) before finalizing the transaction.

**Key Purpose:**
- Convert finished goods into different finished goods
- Track consumption and production in a single transaction
- Calculate weight differences (gain/loss)
- Create accounting entries (FG Inventory, Re-baling Gain/Loss)
- Update item stock quantities and serial numbers
- Support multiple items on both consume and produce sides

**Key Difference from Other Forms:**
- **Original Opening:** Consumes raw materials (moves to WIP)
- **Finished Goods Production:** Converts WIP to finished goods (moves to Finished Goods Inventory)
- **Re-baling:** Converts finished goods to different finished goods (FG-to-FG transformation)
- **Bundle Purchase:** Buys finished goods (adds to finished goods inventory)

---

## 🔄 **DUAL-CART LOOP PROCESS** ⭐ **KEY FEATURE**

The Re-baling form uses a **dual-cart workflow** that allows users to add multiple items to consume (left cart) and multiple items to produce (right cart) before finalizing. This loop process is the core of the form's functionality.

### **Process Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Transaction Date: [YYYY-MM-DD]                     │  │
│  │  [Consumed: XXX Kg] [Produced: XXX Kg] [Gain/Loss] │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────┐  ┌─────────────────────────┐ │
│  │  ITEMS TO CONSUME        │  │  ITEMS TO PRODUCE       │ │
│  │  ┌────────────────────┐  │  │  ┌──────────────────┐ │ │
│  │  │ Item: [Dropdown]   │  │  │  │ Item: [Dropdown] │ │ │
│  │  │ Qty: [Input]       │  │  │  │ Qty: [Input]     │ │ │
│  │  │ [Add] Button       │  │  │  │ [Add] Button     │ │ │
│  │  └────────────────────┘  │  │  └──────────────────┘ │ │
│  │                          │  │                        │ │
│  │  CONSUME CART:           │  │  PRODUCE CART:         │ │
│  │  ┌────────────────────┐  │  │  ┌──────────────────┐ │ │
│  │  │ Item 1 [Remove]    │  │  │  │ Item 1 [Remove]  │ │ │
│  │  │ Item 2 [Remove]    │  │  │  │ Item 2 [Remove]  │ │ │
│  │  │ ...                │  │  │  │ ...              │ │ │
│  │  └────────────────────┘  │  │  └──────────────────┘ │ │
│  └──────────────────────────┘  └─────────────────────────┘ │
│                          ↓                                  │
│            handleFinalizeRebaling()                         │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              DATABASE & ACCOUNTING                     │  │
│  │  • Create Production Entries (isRebaling: true)      │  │
│  │  • Consumed: Negative qtyProduced                     │  │
│  │  • Produced: Positive qtyProduced                     │  │
│  │  • Create Ledger Entries                              │  │
│  │  • Update Item Stock Quantities                       │  │
│  │  • Update Serial Numbers (for produced items)         │  │
│  │  • Calculate Re-baling Gain/Loss                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│                    Carts Cleared                            │
│                    Form Ready for Next Transaction          │
└─────────────────────────────────────────────────────────────┘
```

### **Loop Process Steps:**

1. **User Sets Date:**
   - Selects transaction date (defaults to today)
   - Metrics update in real-time

2. **Add Items to Consume (Left Side):**
   - Selects item from dropdown
   - Enters quantity
   - Clicks "Add" button
   - Item added to consume cart
   - Form cleared (ready for next item)
   - Weight metrics update

3. **Add Items to Produce (Right Side):**
   - Selects item from dropdown
   - Enters quantity
   - Clicks "Add" button
   - Item added to produce cart
   - Serial numbers calculated (if tracked item)
   - Form cleared (ready for next item)
   - Weight metrics update

4. **Repeat Steps 2-3:**
   - User can add multiple items to both carts
   - Each entry is independent
   - Serial numbers auto-increment per item (produce side only)
   - Real-time weight calculations

5. **Review Metrics:**
   - See total consumed weight
   - See total produced weight
   - See gain/loss difference
   - Review both carts

6. **Click "Finalize Re-baling Transaction":**
   - Validates both carts have entries
   - Creates production entries:
     - Consumed items: Negative `qtyProduced` with `isRebaling: true`
     - Produced items: Positive `qtyProduced` with `isRebaling: true`
   - Saves to database
   - Creates ledger entries
   - Updates stock quantities
   - Clears both carts
   - Shows success message

7. **Loop Continues:**
   - Form ready for next transaction
   - Process repeats from Step 1

---

## 🏗️ **FORM STRUCTURE**

The form is divided into **4 main sections**:

1. **Transaction Date & Metrics** (Top Section)
2. **Items to Consume** (Left Column - 1/2 width) ⭐ **CONSUME CART**
3. **Items to Produce** (Right Column - 1/2 width) ⭐ **PRODUCE CART**
4. **Finalize Button** (Bottom Section)

---

## 📝 **SECTION-BY-SECTION BREAKDOWN**

### **SECTION 1: TRANSACTION DATE & METRICS**

**Purpose:** Set transaction date and display real-time weight metrics

**Layout:** Flex layout, justify-between, top section

#### **1.1 Transaction Date**

- **Type:** Date Picker
- **Default Value:** Today's date
- **Format:** YYYY-MM-DD
- **Required:** Yes
- **Purpose:** Re-baling transaction date
- **Layout:** Left side, width: 192px (w-48)
- **Style:** Small text, uppercase label

#### **1.2 Real-Time Metrics**

**Layout:** Flex layout, gap-4, right side

**1.2.1 Consumed Weight**
- **Label:** "Consumed:"
- **Value:** `{rbConsumedWeight.toFixed(1)} Kg`
- **Calculation:** Sum of all items in consume cart: `rbConsumeList.reduce((acc, curr) => acc + curr.weight, 0)`
- **Style:** Amber background (amber-50), amber text (amber-700), rounded border
- **Layout:** Badge-style display

**1.2.2 Produced Weight**
- **Label:** "Produced:"
- **Value:** `{rbProducedWeight.toFixed(1)} Kg`
- **Calculation:** Sum of all items in produce cart: `rbProduceList.reduce((acc, curr) => acc + curr.weight, 0)`
- **Style:** Blue background (blue-50), blue text (blue-700), rounded border
- **Layout:** Badge-style display

**1.2.3 Gain/Loss Difference**
- **Label:** "Gain:" or "Loss:"
- **Value:** `{Math.abs(rbDifference).toFixed(1)} Kg`
- **Calculation:** `rbConsumedWeight - rbProducedWeight`
- **Style:** 
  - If positive (loss): Red background (red-50), red text (red-600), red border
  - If negative (gain): Emerald background (emerald-50), emerald text (emerald-600), emerald border
- **Layout:** Badge-style display
- **Behavior:** Updates in real-time as items are added/removed

---

### **SECTION 2: ITEMS TO CONSUME** ⭐ **CONSUME CART**

**Purpose:** Add finished goods items to consume in the re-baling transaction

**Layout:** Left column (1/2 width), flex column, border-right separator

#### **2.1 Section Header**

- **Icon:** ArrowRight icon (amber-500)
- **Title:** "Items to Consume" (bold, slate-800)
- **Layout:** Flex, items-center, gap-2, margin bottom

#### **2.2 Add to Consume Form**

**Layout:** Gray background box (slate-50), border, padding, rounded corners, margin bottom

**2.2.1 Select Item**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** All items from system (`state.items`)
- **Required:** Yes (to add to cart)
- **Quick Add:** Available (opens modal to add new item)
- **Format Options:**
  - **Display Format:** "Code - Name - Category - Package Size"
  - **Selected Format:** "Code - Name - Package Size"
- **Search Fields:** Code, Name, Category
- **Purpose:** Select finished goods item to consume
- **Layout:** Full width, margin bottom

**2.2.2 Quantity Input & Add Button Row**

**Layout:** Flex layout, gap-2

**2.2.2.1 Quantity Input**
- **Type:** Number Input
- **Label:** "Qty" (small text, uppercase, slate-500)
- **Required:** Yes (to add to cart)
- **Placeholder:** "0"
- **Purpose:** Quantity of units to consume
- **Validation:** Must be > 0
- **Layout:** Flex-1 (takes remaining space)
- **Style:** Small text, white background

**2.2.2.2 Add Button**
- **Type:** Button
- **Label:** "Add"
- **Color:** Dark gray/black background (slate-800), white text
- **Disabled When:**
  - Item not selected (`!rbConsumeId`)
  - Quantity not entered (`!rbConsumeQty`)
- **Action:**
  - Calls `handleAddConsume()`
  - Validates required fields
  - Calculates weight (qty × item.weightPerUnit)
  - Creates consume entry object
  - Adds to `rbConsumeList` cart
  - Clears form fields (Item, Quantity)
  - Updates weight metrics
- **Layout:** Margin-top: 5 (mt-5), padding horizontal/vertical
- **Style:** Small text, medium font weight, hover effect

#### **2.3 Consume Cart Display**

**Layout:** Scrollable list (flex-1, overflow-y-auto), space-y-2

**Empty State:**
- **Text:** "No items to consume" (centered, gray, italic, small text)
- **Layout:** Centered, padding vertical

**Entry Cards (When Cart Has Items):**

Each entry displays as a card:

**2.3.1 Entry Card Layout**
- **Background:** White
- **Border:** Slate-100 border
- **Padding:** Medium (p-3)
- **Layout:** Flex, justify-between, items-center
- **Style:** Small text (text-sm)

**2.3.2 Entry Card Content**

**Left Side:**
- **Item Name:** (medium font, slate-700)
- **Item Details:** (small text, slate-400)
  - **Format:** "{qty} {packingType} • {weight} Kg"
  - **Example:** "10 Bales • 450 Kg"

**Right Side:**
- **Remove Button:**
  - **Icon:** X icon
  - **Style:** Gray by default (slate-300), red on hover (red-500)
  - **Action:** Removes entry from `rbConsumeList` array
  - **Size:** 16px

**2.3.3 Entry Card Example:**
```
┌─────────────────────────────────────────┐
│ Men's T-Shirts                    [✕]   │
│ 10 Bales • 450 Kg                       │
└─────────────────────────────────────────┘
```

---

### **SECTION 3: ITEMS TO PRODUCE** ⭐ **PRODUCE CART**

**Purpose:** Add finished goods items to produce in the re-baling transaction

**Layout:** Right column (1/2 width), flex column, padding left

#### **3.1 Section Header**

- **Icon:** Factory icon (blue-500)
- **Title:** "Items to Produce" (bold, slate-800)
- **Layout:** Flex, items-center, gap-2, margin bottom

#### **3.2 Add to Produce Form**

**Layout:** Gray background box (slate-50), border, padding, rounded corners, margin bottom

**3.2.1 Select Item**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** All items from system (`state.items`)
- **Required:** Yes (to add to cart)
- **Quick Add:** Available (opens modal to add new item)
- **Format Options:**
  - **Display Format:** "Code - Name - Category - Package Size"
  - **Selected Format:** "Code - Name - Package Size"
- **Search Fields:** Code, Name, Category
- **Purpose:** Select finished goods item to produce
- **Layout:** Full width, margin bottom

**3.2.2 Quantity Input & Add Button Row**

**Layout:** Flex layout, gap-2

**3.2.2.1 Quantity Input**
- **Type:** Number Input
- **Label:** "Qty" (small text, uppercase, slate-500)
- **Required:** Yes (to add to cart)
- **Placeholder:** "0"
- **Purpose:** Quantity of units to produce
- **Validation:** Must be > 0
- **Layout:** Flex-1 (takes remaining space)
- **Style:** Small text, white background

**3.2.2.2 Add Button**
- **Type:** Button
- **Label:** "Add"
- **Color:** Blue background (blue-600), white text
- **Disabled When:**
  - Item not selected (`!rbProduceId`)
  - Quantity not entered (`!rbProduceQty`)
- **Action:**
  - Calls `handleAddProduce()`
  - Validates required fields
  - Calculates weight (qty × item.weightPerUnit)
  - Calculates serial numbers (if tracked item)
  - Creates produce entry object
  - Adds to `rbProduceList` cart
  - Clears form fields (Item, Quantity)
  - Updates `tempSerialTracker`
  - Updates weight metrics
- **Layout:** Margin-top: 5 (mt-5), padding horizontal/vertical
- **Style:** Small text, medium font weight, hover effect

#### **3.3 Produce Cart Display**

**Layout:** Scrollable list (flex-1, overflow-y-auto), space-y-2

**Empty State:**
- **Text:** "No items produced" (centered, gray, italic, small text)
- **Layout:** Centered, padding vertical

**Entry Cards (When Cart Has Items):**

Each entry displays as a card:

**3.3.1 Entry Card Layout**
- **Background:** White
- **Border:** Slate-100 border
- **Padding:** Medium (p-3)
- **Layout:** Flex, justify-between, items-center
- **Style:** Small text (text-sm)

**3.3.2 Entry Card Content**

**Left Side:**
- **Item Name:** (medium font, slate-700)
- **Item Details:** (small text, slate-400)
  - **Format:** "{qty} {packingType} • {weight} Kg"
  - **Serial Range:** (if tracked item) Shows "#{serialStart}-#{serialEnd}" (blue badge)
  - **Example:** "5 Bales • 225 Kg #101-#105"

**Right Side:**
- **Remove Button:**
  - **Icon:** X icon
  - **Style:** Gray by default (slate-300), red on hover (red-500)
  - **Action:** Removes entry from `rbProduceList` array
  - **Size:** 16px

**3.3.3 Entry Card Example:**
```
┌─────────────────────────────────────────┐
│ Women's Dresses                    [✕]   │
│ 5 Bales • 225 Kg #101-#105              │
└─────────────────────────────────────────┘
```

---

### **SECTION 4: FINALIZE BUTTON**

**Purpose:** Finalize the re-baling transaction and save to database

**Layout:** Full width, border-top separator, margin top, padding top

#### **4.1 Finalize Re-baling Transaction Button**

- **Type:** Button
- **Label:** "Finalize Re-baling Transaction"
- **Color:** Dark gray/black background (slate-900), white text
- **Disabled When:**
  - Consume cart is empty (`rbConsumeList.length === 0`)
  - Produce cart is empty (`rbProduceList.length === 0`)
- **Action:**
  - Calls `handleFinalizeRebaling()`
  - Validates both carts have entries
  - Creates production entries:
    - Consumed items: Negative `qtyProduced` with `isRebaling: true`
    - Produced items: Positive `qtyProduced` with `isRebaling: true`
  - Saves to database via `addProduction()`
  - Creates ledger entries
  - Updates stock quantities
  - Clears both carts
  - Clears `tempSerialTracker`
  - Shows success message
- **Style:** Full width, bold font, large padding, rounded corners, shadow, hover effect, disabled state (slate-300)

---

## 🔄 **DUAL-CART LOOP PROCESS - DETAILED WORKFLOW**

### **Step 1: User Sets Date**

User selects transaction date:
- Defaults to today
- Metrics update in real-time

### **Step 2: Add Items to Consume**

User adds items to consume cart:

**2.1 User Input:**
- Selects item from dropdown
- Enters quantity

**2.2 Click "Add" Button:**
- Validates: Item selected, Quantity > 0
- Calculates weight: `qty × item.weightPerUnit`
- Creates entry:
  ```typescript
  {
      id: Math.random().toString(36).substr(2, 9),
      itemId: item.id,
      itemName: item.name,
      qty: qty,
      weight: qty * item.weightPerUnit,
      packingType: item.packingType
  }
  ```
- Adds to `rbConsumeList` array
- Clears form fields
- Updates consumed weight metric

### **Step 3: Add Items to Produce**

User adds items to produce cart:

**3.1 User Input:**
- Selects item from dropdown
- Enters quantity

**3.2 Click "Add" Button:**
- Validates: Item selected, Quantity > 0
- Calculates weight: `qty × item.weightPerUnit`
- Calculates serial numbers (if tracked item):
  - Gets next serial from `tempSerialTracker` OR existing productions OR item.nextSerial
  - `serialStart` = next number
  - `serialEnd` = serialStart + qty - 1
  - Updates `tempSerialTracker[itemId]` = serialEnd + 1
- Creates entry:
  ```typescript
  {
      id: Math.random().toString(36).substr(2, 9),
      itemId: item.id,
      itemName: item.name,
      qty: qty,
      weight: qty * item.weightPerUnit,
      packingType: item.packingType,
      serialStart: serialStart, // If tracked
      serialEnd: serialEnd       // If tracked
  }
  ```
- Adds to `rbProduceList` array
- Clears form fields
- Updates produced weight metric

### **Step 4: Repeat Steps 2-3**

User can add multiple items:
- Each entry is independent
- Serial numbers auto-increment per item (produce side only)
- Real-time weight calculations
- Can remove entries from either cart

### **Step 5: Review Metrics**

User reviews transaction:
- Total consumed weight
- Total produced weight
- Gain/loss difference
- Both carts visible

### **Step 6: Finalize Transaction**

User clicks "Finalize Re-baling Transaction":

**6.1 Validation:**
- Both carts must have at least one entry

**6.2 Create Production Entries:**

**Consumed Items:**
```typescript
rbConsumeList.forEach(c => {
    entries.push({
        id: `rb-out-${c.itemId}-${transactionId}`,
        date: rbDate,
        itemId: c.itemId,
        itemName: c.itemName,
        packingType: c.packingType,
        qtyProduced: -Math.abs(c.qty), // Negative quantity
        weightProduced: c.weight,
        isRebaling: true, // Mark as re-baling
        factoryId: state.currentFactory?.id || ''
    });
});
```

**Produced Items:**
```typescript
rbProduceList.forEach(p => {
    entries.push({
        id: `rb-in-${p.itemId}-${transactionId}`,
        date: rbDate,
        itemId: p.itemId,
        itemName: p.itemName,
        packingType: p.packingType,
        qtyProduced: Math.abs(p.qty), // Positive quantity
        weightProduced: p.weight,
        serialStart: p.serialStart, // If tracked
        serialEnd: p.serialEnd,     // If tracked
        isRebaling: true, // Mark as re-baling
        factoryId: state.currentFactory?.id || ''
    });
});
```

**6.3 Save to Database:**
- Calls `addProduction(entries)`
- Saves all entries to Firebase
- Creates ledger entries (via accounting logic)
- Updates item stock quantities
- Updates serial numbers

**6.4 Clear Carts:**
- Clears `rbConsumeList` array
- Clears `rbProduceList` array
- Clears `tempSerialTracker`
- Shows success message

### **Step 7: Loop Continues**

Form ready for next transaction:
- Date remains selected
- Form fields cleared
- Both carts empty
- Process repeats from Step 1

---

## 📊 **DATA STRUCTURE**

### **Consume Entry Object:**

```typescript
interface ConsumeEntry {
    id: string;                    // Unique identifier (random string)
    itemId: string;                // Item ID (links to Item)
    itemName: string;              // Item name (denormalized)
    qty: number;                   // Quantity to consume (units)
    weight: number;                // Total weight (kg) = qty × weightPerUnit
    packingType: PackingType;      // Bale, Sack, Kg, Box, Bag
}
```

### **Produce Entry Object:**

```typescript
interface ProduceEntry {
    id: string;                    // Unique identifier (random string)
    itemId: string;                // Item ID (links to Item)
    itemName: string;              // Item name (denormalized)
    qty: number;                   // Quantity to produce (units)
    weight: number;                // Total weight (kg) = qty × weightPerUnit
    packingType: PackingType;      // Bale, Sack, Kg, Box, Bag
    serialStart?: number;          // Start serial number (if tracked)
    serialEnd?: number;            // End serial number (if tracked)
}
```

### **Cart State:**

```typescript
// Consume cart
const rbConsumeList: ConsumeEntry[] = [
    {
        id: "abc123",
        itemId: "ITEM-001",
        itemName: "Men's T-Shirts",
        qty: 10,
        weight: 450,  // 10 × 45kg
        packingType: PackingType.BALE
    },
    // ... more entries
];

// Produce cart
const rbProduceList: ProduceEntry[] = [
    {
        id: "def456",
        itemId: "ITEM-002",
        itemName: "Women's Dresses",
        qty: 5,
        weight: 225,  // 5 × 45kg
        packingType: PackingType.BALE,
        serialStart: 101,
        serialEnd: 105
    },
    // ... more entries
];
```

### **Production Entry (After Finalization):**

```typescript
// Consumed items become production entries with negative qtyProduced
{
    id: "rb-out-ITEM-001-transactionId",
    date: "2025-01-15",
    itemId: "ITEM-001",
    itemName: "Men's T-Shirts",
    packingType: PackingType.BALE,
    qtyProduced: -10,  // Negative (consumed)
    weightProduced: 450,
    isRebaling: true,  // Mark as re-baling
    factoryId: "FACTORY-001"
}

// Produced items become production entries with positive qtyProduced
{
    id: "rb-in-ITEM-002-transactionId",
    date: "2025-01-15",
    itemId: "ITEM-002",
    itemName: "Women's Dresses",
    packingType: PackingType.BALE,
    qtyProduced: 5,   // Positive (produced)
    weightProduced: 225,
    serialStart: 101,
    serialEnd: 105,
    isRebaling: true,  // Mark as re-baling
    factoryId: "FACTORY-001"
}
```

---

## 🎯 **KEY CALCULATIONS**

### **Weight Calculations:**

**Consumed Weight:**
```typescript
rbConsumedWeight = rbConsumeList.reduce((acc, curr) => acc + curr.weight, 0)
```

**Produced Weight:**
```typescript
rbProducedWeight = rbProduceList.reduce((acc, curr) => acc + curr.weight, 0)
```

**Gain/Loss Difference:**
```typescript
rbDifference = rbConsumedWeight - rbProducedWeight
// Positive = Loss (consumed more than produced)
// Negative = Gain (produced more than consumed)
```

### **Serial Number Calculation:**

Same logic as Finished Goods Production:
- Only for tracked items (Bale, Sack, Box, Bag)
- NOT for items with `packingType === 'Kg'`
- Uses `tempSerialTracker` for session tracking
- Falls back to existing productions or item.nextSerial

### **Value Calculations (Accounting):**

**Consumed Value:**
```typescript
totalConsumedValue = consumedItems.reduce((sum, prod) => {
    const item = state.items.find(i => i.id === prod.itemId);
    return sum + Math.abs(prod.qtyProduced) * (item?.avgCost || 0);
}, 0);
```

**Produced Value:**
```typescript
totalProducedValue = producedItems.reduce((sum, prod) => {
    const item = state.items.find(i => i.id === prod.itemId);
    return sum + prod.qtyProduced * (item?.avgCost || 0);
}, 0);
```

**Re-baling Gain/Loss:**
```typescript
rebalingGainLoss = totalProducedValue - totalConsumedValue
// Positive = Gain (produced value > consumed value)
// Negative = Loss (consumed value > produced value)
```

---

## ✅ **VALIDATION RULES**

### **Before Adding to Consume Cart:**

- ✅ **Item:** Must be selected
- ✅ **Quantity:** Must be entered and > 0
- ✅ **Item Must Exist:** Item must be in system

### **Before Adding to Produce Cart:**

- ✅ **Item:** Must be selected
- ✅ **Quantity:** Must be entered and > 0
- ✅ **Item Must Exist:** Item must be in system

### **Before Finalizing:**

- ✅ **Consume Cart:** Must have at least one entry (`rbConsumeList.length > 0`)
- ✅ **Produce Cart:** Must have at least one entry (`rbProduceList.length > 0`)

---

## 🔍 **SERIAL NUMBER TRACKING**

### **Serial Number Logic:**

- **Only for Produce Side:** Serial numbers are calculated only for items being produced
- **Not for Consume Side:** Consumed items don't get serial numbers
- **Same Logic as Production:** Uses same `getNextSerialNumber()` function
- **Session Tracking:** Uses `tempSerialTracker` for current session
- **Auto-Increment:** Serial numbers auto-increment per item

### **Serial Number Display:**

- **In Produce Cart:** Shows "#{serialStart}-#{serialEnd}" (blue badge)
- **Not Tracked:** No serial display for Kg items
- **After Finalization:** Serial numbers saved to production entries

---

## 🔄 **ACCOUNTING IMPACT**

### **When Re-baling is Finalized:**

**1. Production Entries Created:**
- Consumed items: Negative `qtyProduced` with `isRebaling: true`
- Produced items: Positive `qtyProduced` with `isRebaling: true`

**2. Ledger Entries Created:**

**Entry 1: Credit Finished Goods Inventory (Consumed)**
```
Account: Inventory - Finished Goods
Debit: 0
Credit: totalConsumedValue
Narration: "Re-baling: Consumed {item names and quantities}"
```

**Entry 2: Debit Finished Goods Inventory (Produced)**
```
Account: Inventory - Finished Goods
Debit: totalProducedValue
Credit: 0
Narration: "Re-baling: Produced {item names and quantities}"
```

**Entry 3: Re-baling Gain/Loss (if difference exists)**
```
Account: Production Gain
Debit: |rebalingGainLoss| (if negative/loss)
Credit: rebalingGainLoss (if positive/gain)
Narration: "Re-baling Gain" or "Re-baling Loss"
```

**3. Inventory Impact:**
- Consumed items: Stock quantities decrease
- Produced items: Stock quantities increase
- Serial numbers updated (for produced tracked items)

**4. Balance Sheet Impact:**
- Finished Goods Inventory: Net change = producedValue - consumedValue
- Production Gain: Increases (if gain) or decreases (if loss)

---

## 🎨 **UI/UX DESIGN NOTES**

### **Visual Hierarchy:**

- **Primary Actions:** Dark gray button (Add Consume), Blue button (Add Produce), Black button (Finalize)
- **Secondary Actions:** Red buttons (Remove)
- **Information Boxes:** Gray backgrounds with borders
- **Dual Carts:** Side-by-side layout for easy comparison

### **Form Layout:**

- **Grid System:** 2-column grid (1/2 left, 1/2 right)
- **Responsive:** Adapts to screen size
- **Spacing:** Consistent padding and margins
- **Grouping:** Related fields grouped logically

### **Feedback:**

- **Disabled States:** Gray background when disabled
- **Required Fields:** Visual indicators
- **Real-Time Metrics:** Updates as items added/removed
- **Empty States:** Clear messages when carts are empty
- **Gain/Loss Display:** Color-coded (green for gain, red for loss)

### **Accessibility:**

- **Labels:** Clear, descriptive labels
- **Placeholders:** Helpful placeholder text
- **Empty States:** Clear messages when no data
- **Visual Indicators:** Icons and colors for clarity

---

## 🔍 **EDGE CASES & SPECIAL BEHAVIORS**

### **1. Empty Carts**

- Finalize button disabled
- Carts show "No items to consume" / "No items produced" messages
- User must add at least one item to each cart

### **2. Weight Difference**

- Positive difference = Loss (consumed more than produced)
- Negative difference = Gain (produced more than consumed)
- Displayed in real-time with color coding

### **3. Serial Number Conflicts**

- Temp tracker prevents conflicts within session
- Database check prevents conflicts across sessions
- Auto-increments correctly (produce side only)

### **4. Same Item in Both Carts**

- Allowed (can consume and produce same item)
- Treated as separate entries
- Net effect calculated in accounting

### **5. Stock Validation**

- **No Stock Check:** System allows adding items regardless of stock quantity
- **User Responsibility:** User must ensure sufficient stock exists
- **Accounting Handles:** Negative stock handled by accounting system

### **6. Multiple Items**

- Can add multiple items to both carts
- Each item tracked independently
- Serial numbers per item (produce side)

### **7. Transaction ID**

- Generated once per transaction: `Math.random().toString(36).substr(2, 9)`
- Used in all production entry IDs
- Links consumed and produced items together

---

## 💡 **DESIGN RECOMMENDATIONS FOR NEW APP**

### **1. Dual-Cart System**

- Make both carts visible side-by-side
- Show real-time weight calculations
- Display gain/loss prominently
- Allow easy item removal
- Provide clear visual separation

### **2. Real-Time Metrics**

- Update metrics as items added/removed
- Color-code gain/loss
- Show totals clearly
- Provide visual feedback

### **3. Serial Number Tracking**

- Auto-calculate serials (produce side only)
- Show next serial in UI
- Prevent conflicts
- Update in real-time

### **4. Validation & Feedback**

- Validate before adding to carts
- Show clear error messages
- Disable finalize when invalid
- Provide confirmation before finalization

### **5. Accounting Integration**

- Ensure proper ledger entries
- Handle gain/loss correctly
- Update stock quantities
- Track serial numbers

---

## 📊 **COMPARISON: RE-BALING vs PRODUCTION**

| Aspect | Finished Goods Production | Re-baling |
|--------|-------------------------|-----------|
| **Source** | Work in Progress (WIP) | Finished Goods Inventory |
| **Destination** | Finished Goods Inventory | Finished Goods Inventory |
| **Type** | WIP → FG | FG → FG |
| **Consume Side** | No (consumes WIP internally) | Yes (consumes FG explicitly) |
| **Produce Side** | Yes (produces FG) | Yes (produces FG) |
| **Serial Numbers** | Yes (for produced items) | Yes (for produced items only) |
| **Accounting** | WIP Consumption, Production Gain | FG Credit/Debit, Re-baling Gain/Loss |
| **isRebaling Flag** | false | true |
| **qtyProduced Sign** | Always positive | Negative (consume), Positive (produce) |

---

## 🎯 **USER WORKFLOW SUMMARY**

### **Re-baling Transaction:**

1. **Select Transaction Date** (defaults to today)
2. **Add Items to Consume:**
   - Select item from dropdown
   - Enter quantity
   - Click "Add" button
   - Repeat for more items
3. **Add Items to Produce:**
   - Select item from dropdown
   - Enter quantity
   - Click "Add" button
   - Repeat for more items
4. **Review Metrics:**
   - Check consumed weight
   - Check produced weight
   - Review gain/loss
5. **Review Carts:**
   - Remove items if needed
   - Verify quantities
6. **Click "Finalize Re-baling Transaction"**
7. **Confirm:** Success message, carts cleared

---

## 📋 **FORM FIELD SUMMARY TABLE**

| Section | Field Name | Type | Required | Default | Auto-Populated From |
|---------|-----------|------|----------|---------|-------------------|
| Date | Transaction Date | Date | Yes | Today | System date |
| Consume | Item | Dropdown | Yes* | - | - |
| Consume | Quantity | Number | Yes* | - | - |
| Produce | Item | Dropdown | Yes* | - | - |
| Produce | Quantity | Number | Yes* | - | - |

*Required only when adding to cart

---

## 🎨 **VISUAL LAYOUT STRUCTURE**

```
┌─────────────────────────────────────────────────────────┐
│  Transaction Date: [YYYY-MM-DD]                        │
│  [Consumed: XXX Kg] [Produced: XXX Kg] [Gain/Loss]   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌─────────────────────┐ │
│  │ Items to Consume         │  │ Items to Produce     │ │
│  │                          │  │                      │ │
│  │ [Select Item]            │  │ [Select Item]        │ │
│  │ [Qty] [Add]             │  │ [Qty] [Add]         │ │
│  │                          │  │                      │ │
│  │ Consume Cart:            │  │ Produce Cart:         │ │
│  │ ┌────────────────────┐  │  │ ┌──────────────────┐ │ │
│  │ │ Item 1 [Remove]   │  │  │ │ Item 1 [Remove]  │ │ │
│  │ │ 10 Bales • 450 Kg │  │  │ │ 5 Bales • 225 Kg │ │ │
│  │ │                    │  │  │ │ #101-#105        │ │ │
│  │ │ Item 2 [Remove]   │  │  │ │ Item 2 [Remove]  │ │ │
│  │ │ ...                │  │  │ │ ...              │ │ │
│  │ └────────────────────┘  │  │ └──────────────────┘ │ │
│  └──────────────────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  [Finalize Re-baling Transaction]                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 **ACCOUNTING FLOW SUMMARY**

### **Re-baling Transaction Accounting:**

1. **Identify Transaction:**
   - Check if `isRebaling === true` in production entries

2. **Separate Entries:**
   - Consumed items: `qtyProduced < 0`
   - Produced items: `qtyProduced > 0`

3. **Calculate Values:**
   - Consumed value = sum of (|qty| × item.avgCost) for consumed items
   - Produced value = sum of (qty × item.avgCost) for produced items
   - Gain/Loss = producedValue - consumedValue

4. **Create Ledger Entries:**
   - Credit FG Inventory (consumed)
   - Debit FG Inventory (produced)
   - Debit/Credit Production Gain (gain/loss)

5. **Update Stock:**
   - Decrease consumed items' stock
   - Increase produced items' stock
   - Update serial numbers (produced items)

---

**End of Structure Guide**
