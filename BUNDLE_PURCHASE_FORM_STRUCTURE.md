# Bundle Purchase Form - Complete Structure Guide
## For New App Construction

**Module:** Data Entry > Purchase > Bundle Purchase > New Bundle Purchase (Stock Lot)

---

## 📋 **OVERVIEW**

The Bundle Purchase form allows users to record purchases of pre-sorted finished goods (Stock Lots) from suppliers. Unlike Original Purchase (which buys raw materials), Bundle Purchase buys finished goods that are already graded/sorted. The form supports purchasing multiple finished goods items in a single transaction using a cart-based system.

**Key Difference from Original Purchase:**
- **Original Purchase:** Buys raw materials (used clothing) that need to be processed
- **Bundle Purchase:** Buys finished goods (already sorted/graded items) ready for sale

---

## 🏗️ **FORM STRUCTURE**

The form is divided into **6 main sections**:

1. **Header & Title**
2. **Basic Purchase Information & Supplier**
3. **Logistics & Destination**
4. **Add to Cart Block** (Multi-Item Entry) ⭐ **KEY SECTION**
5. **Item Cart Display**
6. **Additional Costs Section**
7. **Summary & Finalize**

---

## 📝 **SECTION-BY-SECTION BREAKDOWN**

### **SECTION 1: HEADER & TITLE**

**Purpose:** Form identification

**Components:**
- **Title:** "New Bundle Purchase (Stock Lot)"
- **Icon:** Layers icon (blue)
- **Layout:** Left-aligned, bold text

**Note:** Unlike Original Purchase, Bundle Purchase does NOT have a mode toggle (Create/Manage). It's always in "Create New" mode.

---

### **SECTION 2: BASIC PURCHASE INFORMATION & SUPPLIER**

**Purpose:** Core purchase identification, supplier, and currency

**Layout:** 2-column grid (Left: Core Info, Right: Logistics)

#### **LEFT COLUMN: Core Information**

##### **2.1 Date**
- **Type:** Date Picker
- **Default Value:** Today's date
- **Format:** YYYY-MM-DD
- **Required:** Yes
- **Purpose:** Purchase transaction date
- **Layout:** First field in 2-column grid

##### **2.2 Batch Number**
- **Type:** Text Input (Editable)
- **Default Value:** Auto-generated (e.g., "101")
- **Auto-Generation Logic:** Finds highest existing bundle batch number and adds 1
- **Starting Sequence:** Begins at 101 (shorter sequence than Original Purchase which starts at 11001)
- **Editable:** Yes (user can change)
- **Required:** Yes
- **Display:** Monospace font, bold
- **Layout:** Second field in 2-column grid (next to Date)

##### **2.3 Supplier**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only partners with type = "SUPPLIER"
- **Required:** Yes
- **Quick Add:** Available (opens modal to add new supplier)
- **Auto-Population:** When supplier selected, auto-populates currency from supplier's default currency
- **Layout:** Full width below Date/Batch grid

##### **2.4 Currency & Exchange Rate**
- **Layout:** 2-column grid
- **Currency Field:**
  - **Type:** Dropdown
  - **Options:** All currencies from Setup (e.g., USD, AED, EUR, GBP)
  - **Default:** Supplier's default currency (if available) or USD
  - **Auto-Update:** Updates when supplier changes
- **Exchange Rate Field:**
  - **Type:** Number Input
  - **Default:** Auto-populated from currency setup (e.g., 3.67 for AED)
  - **Editable:** Yes (user can override)
  - **Step:** Allows decimal precision
  - **Auto-Update:** Updates when currency changes

---

### **SECTION 3: LOGISTICS & DESTINATION**

**Purpose:** Track container and destination information

**Layout:** Right column of 2-column grid, gray background box with border

**Fields:**

#### **3.1 Container Number**
- **Type:** Text Input
- **Required:** No (Optional)
- **Placeholder:** "e.g. MSCU1234567"
- **Purpose:** Track container/shipment number
- **Validation:** Checks for duplicates (warns if same container number exists in both Original Purchases and Bundle Purchases)

#### **3.2 Division**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** All divisions from Setup
- **Required:** No (Optional)
- **Quick Add:** Available
- **Purpose:** Factory division assignment

#### **3.3 Sub-Division**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only sub-divisions belonging to selected Division
- **Required:** No (Optional)
- **Disabled:** Yes (until Division is selected)
- **Quick Add:** Available (pre-fills divisionId)
- **Purpose:** Sub-division within division
- **Layout:** Second field in 2-column grid (next to Division)

---

### **SECTION 4: ADD TO CART BLOCK** ⭐ **KEY SECTION**

**Purpose:** Add multiple finished goods items to purchase cart before finalizing

**Layout:** Section with title "Item Details (Cart)", followed by input row and cart table

#### **4.1 Input Row (12-Column Grid Layout)**

**Background:** Light gray (slate-100) with padding and rounded corners

##### **4.1.1 Item Selection (Column Span: 5)**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only finished goods items
  - **Filter:** Excludes items where `category === 'Raw Material'`
  - **Shows:** All other items (finished goods)
- **Required:** Yes (to add to cart)
- **Quick Add:** Available (opens modal to add new item)
- **Format Options:**
  - **Display Format:** "Code - Name - Category - Package Size" (e.g., "ITEM-001 - Men's T-Shirts - Men's Wear - 45kg Bale")
  - **Selected Format:** "Code - Name - Package Size" (e.g., "ITEM-001 - Men's T-Shirts - 45kg Bale")
- **Search Fields:** Code, Name, Category (allows searching by any of these)
- **Purpose:** Select finished goods item to purchase

##### **4.1.2 Quantity Input (Column Span: 2)**
- **Type:** Number Input
- **Label:** None (placeholder shows "Qty")
- **Required:** Yes (to add to cart)
- **Placeholder:** "Qty"
- **Purpose:** Quantity of items to purchase (in units)
- **Validation:** Must be > 0
- **Note:** Units depend on item's packing type (Bale, Sack, Box, Bag, or Kg)

##### **4.1.3 Rate Input (Column Span: 3)**
- **Type:** Number Input
- **Label:** None (placeholder shows currency)
- **Placeholder:** "Rate ({currency})" (e.g., "Rate (AED)")
- **Required:** Yes (to add to cart)
- **Purpose:** Price per unit in supplier's currency
- **Validation:** Must be > 0
- **Display:** Shows selected currency in placeholder

##### **4.1.4 Add Item Button (Column Span: 2)**
- **Type:** Button
- **Label:** "Add Item"
- **Color:** Blue background, white text
- **Disabled When:** 
  - Item not selected
  - Quantity not entered or <= 0
  - Rate not entered or <= 0
- **Action:** 
  - Validates required fields
  - Calculates totals
  - Adds item to cart
  - Clears all input fields (ready for next entry)

---

### **SECTION 5: ITEM CART DISPLAY**

**Purpose:** Review all items added to cart before finalizing

**Layout:** Table with header and rows, bordered container

**Display Conditions:**
- Always visible (even when empty)
- Shows "No items added" message when cart is empty

**Table Structure:**

#### **5.1 Table Header**
- **Background:** Light gray (slate-50)
- **Text:** Bold, slate-600 color
- **Border:** Bottom border (slate-200)

**Columns:**

1. **Item** (Left-aligned)
   - Shows: Item name (e.g., "Men's T-Shirts")
   - Format: Regular font
   - Source: Looks up item name from itemId

2. **Qty** (Right-aligned)
   - Shows: Quantity purchased
   - Format: Regular font, no decimals
   - Purpose: Number of units

3. **Rate ({currency})** (Right-aligned)
   - Shows: Rate per unit in foreign currency
   - Format: Monospace, 2 decimal places
   - Example: "12.50" (if AED currency)

4. **Total ({currency})** (Right-aligned)
   - Shows: Total cost for this item in foreign currency
   - Format: Monospace, medium font weight, 2 decimal places
   - Calculation: Quantity × Rate

5. **Action** (Center-aligned)
   - Shows: Trash icon (red)
   - Action: Removes item from cart
   - Hover: Darker red

**Table Body:**
- **Empty State:** Shows "No items added" message (centered, italic, gray)
- **Rows:** Each cart item displayed as a row
- **Hover Effect:** Light gray background on hover
- **Border:** Bottom border between rows (slate-100)

**Note:** Unlike Original Purchase, Bundle Purchase cart does NOT show a totals footer row in the table. Totals are shown in the Summary section instead.

---

### **SECTION 6: ADDITIONAL COSTS SECTION**

**Purpose:** Add freight, clearing, commission, and other charges

**Layout:** Section with border-top separator, titled "Landed Cost / Additional Charges" with anchor icon

**Structure:** Same as Original Purchase Additional Costs section

**Fields (5-column grid):**

#### **6.1 Charge Type**
- **Type:** Dropdown
- **Options:** 
  - "Freight"
  - "Clearing"
  - "Commission"
  - "Other"
- **Default:** "Freight"
- **Behavior:** When changed, clears provider/custom name fields

#### **6.2 Provider/Agent OR Custom Name**
- **Type:** Conditional Input
  - **If "Other":** Text input for custom name (e.g., "VAT", "Custom Duty")
  - **If Not "Other":** Dropdown Selector (EntitySelector) for partner
- **Options (for non-Other):**
  - Freight: Freight Forwarders
  - Clearing: Clearing Agents
  - Commission: Commission Agents
- **Required:** Yes (to add cost)
- **Quick Add:** Available (for partner selection)
- **Helper Text (for Other):** "This will be recorded as payable to the supplier"

#### **6.3 Currency**
- **Type:** Dropdown
- **Options:** All currencies from Setup
- **Default:** USD or supplier's currency
- **Purpose:** Currency for this additional cost

#### **6.4 Amount**
- **Type:** Number Input
- **Placeholder:** "0.00"
- **Required:** Yes (to add cost)
- **Purpose:** Cost amount in selected currency

#### **6.5 Add Cost Button**
- **Type:** Button
- **Label:** "Add Cost"
- **Color:** Dark gray/black background
- **Disabled When:**
  - Provider not selected (or custom name empty for "Other")
  - Amount not entered
- **Action:** Adds cost to additional costs list

**Costs List Display:**
- Shows all added costs below the input form
- Each cost shows:
  - Cost Type (e.g., "Freight")
  - Provider Name (or custom name for "Other")
  - Amount in FCY with currency symbol
  - Exchange Rate
  - Amount in USD (bold, blue)
  - Remove button (X icon, red)

---

### **SECTION 7: SUMMARY & FINALIZE**

**Purpose:** Show totals and finalize purchase

**Layout:** Blue background box with border, 3-column flex layout

#### **7.1 Left Column: Cost Breakdown**

##### **7.1.1 Total Items Cost**
- **Label:** "Total Items Cost:"
- **Value:** Sum of all cart items' totalUSD
- **Format:** Bold, slate-800 color
- **Display:** "Total Items Cost: $X,XXX.XX"

##### **7.1.2 Total Additional Cost**
- **Label:** "Total Additional Cost:"
- **Value:** Sum of all additional costs' amountUSD
- **Format:** Bold, slate-800 color
- **Display:** "Total Additional Cost: $X,XXX.XX"

#### **7.2 Middle Column: Grand Total**

##### **7.2.1 Grand Total Label**
- **Text:** "GRAND TOTAL (USD)" (uppercase)
- **Format:** Small text, gray (slate-400), bold

##### **7.2.2 Grand Total Amount**
- **Value:** Total Items Cost + Total Additional Cost
- **Format:** Large text (2xl), monospace, bold, blue-800 color
- **Display:** "$X,XXX.XX"
- **Calculation:** `bpCart.reduce((s,i) => s + i.totalUSD, 0) + additionalCosts.reduce((s,c) => s + c.amountUSD, 0)`

#### **7.3 Right Column: Finalize Button**

##### **7.3.1 Finalize Purchase Button**
- **Type:** Button
- **Label:** "Finalize Purchase"
- **Color:** Emerald green background, white text
- **Size:** Large (px-8 py-3)
- **Style:** Bold, rounded corners, shadow
- **Disabled When:**
  - Supplier not selected
  - Cart is empty (no items added)
- **Action:** 
  - Validates required fields
  - Checks for duplicate container number
  - Saves bundle purchase to database
  - Resets form
  - Shows success message

---

## 🛒 **ADD TO CART BLOCK - DETAILED WORKFLOW**

### **Step-by-Step Process:**

1. **Select Item**
   - User selects from dropdown (only finished goods shown)
   - Dropdown shows: "Code - Name - Category - Package Size"
   - Can search by code, name, or category
   - Quick Add available if item doesn't exist

2. **Enter Quantity**
   - User enters quantity in units
   - Units depend on item's packing type:
     - Bale, Sack, Box, Bag: Number of units
     - Kg: Weight in kilograms
   - Must be positive number

3. **Enter Rate**
   - User enters price per unit
   - Currency shown in placeholder (e.g., "Rate (AED)")
   - Must be positive number

4. **Click "Add Item"**
   - System validates: Item, Quantity, Rate are required
   - System validates: Quantity > 0, Rate > 0
   - System calculates:
     - **Total FCY:** Quantity × Rate (in foreign currency)
     - **Total USD:** Total FCY / Exchange Rate
   - Creates cart item object with all details
   - Adds to cart array
   - Clears all input fields (ready for next item)

5. **Repeat Steps 1-4** for additional items

6. **Review Cart**
   - Cart table shows all added items
   - User can remove items if needed
   - Totals calculated automatically

---

## 📊 **CART ITEM DATA STRUCTURE**

Each item in the cart contains:

- **id:** Unique identifier (random string)
- **itemId:** ID of selected finished goods item
- **qty:** Quantity in units (user input)
- **rateFCY:** Rate per unit in foreign currency (user input)
- **totalFCY:** Total cost in foreign currency (calculated: qty × rateFCY)
- **totalUSD:** Total cost in USD (calculated: totalFCY / exchangeRate)

---

## 🔄 **AUTO-POPULATION & DEPENDENCIES**

### **When Supplier Changes:**
- Currency auto-populates from supplier's default currency
- Exchange rate auto-updates based on currency

### **When Currency Changes:**
- Exchange rate auto-updates from currency setup
- User can manually override exchange rate

### **When Batch Number Auto-Generates:**
- Finds highest existing bundle batch number
- Adds 1 to generate next number
- Starting sequence: 101 (shorter than Original Purchase)
- User can edit if needed

### **When Item Added to Cart:**
- All input fields clear automatically
- Ready for next item entry
- Cart totals update in real-time

---

## ✅ **VALIDATION RULES**

### **Before Adding to Cart:**
- ✅ Item must be selected (finished goods only)
- ✅ Quantity must be entered and > 0
- ✅ Rate must be entered and > 0
- ⚠️ Item must NOT be "Raw Material" category

### **Before Finalizing:**
- ✅ Supplier must be selected
- ✅ Cart must have at least 1 item
- ✅ Batch Number must be entered
- ✅ Date must be entered
- ⚠️ Container Number: Optional (but warns if duplicate)
- ⚠️ Division/Sub-Division: Optional
- ⚠️ Additional Costs: Optional

---

## 🎯 **KEY FEATURES**

### **1. Multi-Item Support**
- Can add multiple finished goods items to single purchase
- Each item tracked separately with its own pricing
- Supports different quantities and rates per item

### **2. Finished Goods Only**
- Filtered to exclude raw materials
- Only shows items that are already processed/graded
- Items must exist in Setup > Items

### **3. Simple Pricing**
- Rate per unit (not per kg like Original Purchase)
- No discount/surcharge per item (simpler than Original Purchase)
- Total calculated as: Quantity × Rate

### **4. Multi-Currency Support**
- Supplier currency for item costs
- Different currencies for additional costs
- Automatic conversion to USD for accounting

### **5. Cart Management**
- Add multiple items
- Remove individual items
- View items in table
- Clear cart on finalize

---

## 📋 **FORM FIELD SUMMARY TABLE**

| Section | Field Name | Type | Required | Default | Auto-Populated From |
|---------|-----------|------|----------|---------|-------------------|
| Basic Info | Date | Date | Yes | Today | System date |
| Basic Info | Batch Number | Text | Yes | Auto (101+) | Previous bundle purchases |
| Supplier | Supplier | Dropdown | Yes | - | - |
| Supplier | Currency | Dropdown | Yes | USD | Supplier default |
| Supplier | Exchange Rate | Number | Yes | 1.0 | Currency setup |
| Logistics | Container Number | Text | No | - | - |
| Logistics | Division | Dropdown | No | - | - |
| Logistics | Sub-Division | Dropdown | No | - | Selected Division |
| Add to Cart | Item | Dropdown | Yes* | - | - |
| Add to Cart | Quantity | Number | Yes* | - | - |
| Add to Cart | Rate | Number | Yes* | - | - |
| Additional Costs | Charge Type | Dropdown | Yes* | Freight | - |
| Additional Costs | Provider/Name | Dropdown/Text | Yes* | - | - |
| Additional Costs | Currency | Dropdown | Yes* | USD | - |
| Additional Costs | Amount | Number | Yes* | - | - |

*Required only when adding to cart/cost list

---

## 🔍 **DIFFERENCES FROM ORIGINAL PURCHASE**

### **1. Item Type**
- **Original Purchase:** Raw materials (Original Types)
- **Bundle Purchase:** Finished goods (Items)

### **2. Pricing Structure**
- **Original Purchase:** Price per Kg, with Discount/Surcharge per Kg
- **Bundle Purchase:** Rate per Unit, no discount/surcharge per item

### **3. Quantity Input**
- **Original Purchase:** Weight in Kg (converts to units)
- **Bundle Purchase:** Quantity in Units (direct input)

### **4. Batch Number Sequence**
- **Original Purchase:** Starts at 11001
- **Bundle Purchase:** Starts at 101

### **5. Cart Display**
- **Original Purchase:** Shows weight, price/kg, discount, surcharge, totals
- **Bundle Purchase:** Shows quantity, rate, total (simpler)

### **6. Sub-Supplier Support**
- **Original Purchase:** Supports sub-suppliers per item
- **Bundle Purchase:** No sub-supplier support

### **7. Original Product Support**
- **Original Purchase:** Supports Original Products (sub-classification)
- **Bundle Purchase:** No product sub-classification

---

## 🎨 **UI/UX DESIGN NOTES**

### **Visual Hierarchy:**
- **Primary Actions:** Blue buttons (Add Item), Green button (Finalize Purchase)
- **Secondary Actions:** Red buttons (Remove)
- **Information Boxes:** Gray backgrounds with borders
- **Summary Box:** Blue background for emphasis

### **Form Layout:**
- **Grid System:** 2-column grid for basic info, 12-column grid for cart input
- **Responsive:** Adapts to screen size
- **Spacing:** Consistent padding and margins
- **Grouping:** Related fields grouped in boxes

### **Feedback:**
- **Disabled States:** Gray background when disabled
- **Required Fields:** Visual indicators
- **Validation:** Alerts for missing/invalid data
- **Totals:** Real-time calculation and display

### **Accessibility:**
- **Labels:** Clear, descriptive labels
- **Placeholders:** Helpful placeholder text
- **Empty States:** Clear message when cart is empty
- **Error Messages:** Clear validation feedback

---

## 🔍 **EDGE CASES & SPECIAL BEHAVIORS**

### **1. Empty Cart**
- Submit button disabled
- Cart table shows "No items added" message
- User must add at least one item

### **2. Duplicate Container Number**
- Warning shown if container number already exists (in either Original or Bundle purchases)
- User can proceed or change container number

### **3. Missing Exchange Rate**
- Falls back to constant rates if not in setup
- User can manually enter rate

### **4. Raw Material Items**
- Filtered out from item dropdown
- Only finished goods shown
- Prevents purchasing raw materials as bundles

### **5. Item Not Found**
- If item is deleted from Setup, cart item will show "Unknown"
- System handles gracefully

### **6. Currency Mismatch**
- Item costs in supplier currency
- Additional costs can be in different currencies
- All converted to USD for final totals

---

## 🎯 **USER WORKFLOW SUMMARY**

1. **Enter Basic Info:** Date (auto), Batch Number (auto)
2. **Select Supplier:** Auto-populates currency
3. **Set Logistics:** Container, Division, Sub-Division (optional)
4. **Add Items to Cart:**
   - Select Item (finished goods only)
   - Enter Quantity
   - Enter Rate
   - Click "Add Item"
   - Repeat for more items
5. **Review Cart:** Check items, remove if needed
6. **Add Additional Costs:** Freight, Clearing, etc. (optional)
7. **Review Summary:** Check totals (Items Cost, Additional Cost, Grand Total)
8. **Finalize:** Click "Finalize Purchase"
9. **Confirm:** Success message, form resets

---

## 💡 **DESIGN RECOMMENDATIONS FOR NEW APP**

### **1. Form Simplicity**
- Bundle Purchase is simpler than Original Purchase
- Fewer fields per item (no discount/surcharge)
- Cleaner cart display

### **2. Item Filtering**
- Clearly show only finished goods
- Hide raw materials from selection
- Provide clear indication of what can be purchased

### **3. Cart System**
- Make cart visible and prominent
- Show real-time totals
- Allow easy item removal
- Display item details clearly

### **4. Validation**
- Validate before adding to cart
- Show clear error messages
- Disable finalize when invalid
- Provide helpful hints

### **5. Auto-Population**
- Auto-fill currency from supplier
- Auto-generate batch numbers
- Allow manual overrides

### **6. Summary Display**
- Show breakdown clearly
- Highlight grand total
- Make finalize button prominent

---

## 📊 **COMPARISON: ORIGINAL vs BUNDLE PURCHASE**

| Aspect | Original Purchase | Bundle Purchase |
|--------|------------------|-----------------|
| **Item Type** | Raw Materials (Original Types) | Finished Goods (Items) |
| **Pricing** | Per Kg | Per Unit |
| **Discount/Surcharge** | Per item | Not supported |
| **Sub-Supplier** | Supported | Not supported |
| **Original Product** | Supported | Not supported |
| **Weight Input** | Yes (Kg) | No (Units only) |
| **Batch Sequence** | 11001+ | 101+ |
| **Cart Complexity** | More fields | Simpler |
| **Use Case** | Buy raw materials to process | Buy pre-sorted stock lots |

---

## 🔄 **DATA FLOW**

### **Input → Cart → Save:**

1. **User Input:**
   - Selects item, enters quantity and rate
   - Clicks "Add Item"

2. **Cart Processing:**
   - Validates inputs
   - Calculates totals
   - Adds to cart array

3. **Finalization:**
   - Validates supplier and cart
   - Checks container duplicates
   - Creates BundlePurchase object
   - Saves to database
   - Creates ledger entries
   - Updates inventory

---

## 📦 **BUNDLE PURCHASE DATA STRUCTURE**

### **BundlePurchase Object:**
```typescript
{
  id: string;                    // Unique identifier
  batchNumber: string;          // User-editable batch number
  date: string;                 // Purchase date
  supplierId: string;           // Supplier partner ID
  containerNumber?: string;     // Optional container tracking
  divisionId?: string;          // Optional division
  subDivisionId?: string;       // Optional sub-division
  factoryId: string;            // Factory assignment
  currency: Currency;            // Supplier currency
  exchangeRate: number;          // Exchange rate to USD
  items: BundlePurchaseItem[];   // Array of purchased items
  additionalCosts: PurchaseAdditionalCost[]; // Additional charges
  totalAmountFCY: number;        // Total in foreign currency
  totalAmountUSD: number;       // Total in USD
}
```

### **BundlePurchaseItem Object:**
```typescript
{
  id: string;           // Unique identifier for cart
  itemId: string;       // Finished goods item ID
  qty: number;          // Quantity in units
  rateFCY: number;      // Rate per unit (foreign currency)
  totalFCY: number;     // Total cost (foreign currency)
  totalUSD: number;     // Total cost (USD)
}
```

---

## 🎯 **KEY CALCULATIONS**

### **Per Item:**
- **Total FCY:** `qty × rateFCY`
- **Total USD:** `totalFCY / exchangeRate`

### **Cart Totals:**
- **Total Items Cost FCY:** Sum of all items' totalFCY
- **Total Items Cost USD:** Sum of all items' totalUSD
- **Total Additional Costs USD:** Sum of all additional costs' amountUSD
- **Grand Total USD:** Total Items Cost USD + Total Additional Costs USD

---

## 🔍 **SPECIAL CONSIDERATIONS**

### **1. Item Category Filtering**
- Only items where `category !== 'Raw Material'` are shown
- This ensures only finished goods can be purchased as bundles
- Raw materials must be purchased via Original Purchase

### **2. Inventory Impact**
- Bundle purchases increase finished goods inventory
- Items are added to stock immediately
- No production process needed (already finished goods)

### **3. Container Number Validation**
- Checks against both Original Purchases and Bundle Purchases
- Prevents duplicate container numbers across purchase types
- Warning shown but user can proceed

### **4. Batch Number Sequence**
- Separate sequence from Original Purchase
- Starts at 101 (vs 11001 for Original)
- Auto-increments independently

---

## 💡 **DESIGN RECOMMENDATIONS FOR NEW APP**

### **1. Clear Distinction**
- Make it clear this is for finished goods only
- Visual distinction from Original Purchase form
- Clear labeling of "Stock Lot" purchase

### **2. Simplified Interface**
- Fewer fields than Original Purchase
- Focus on essential information
- Streamlined workflow

### **3. Item Selection**
- Clear search/filter for items
- Show item details in dropdown
- Quick add for missing items

### **4. Cart Visibility**
- Always show cart (even when empty)
- Clear empty state message
- Easy item removal

### **5. Summary Clarity**
- Break down costs clearly
- Highlight grand total
- Show currency conversions

### **6. Validation Feedback**
- Clear error messages
- Disable actions when invalid
- Guide user to fix issues

---

## 🎨 **VISUAL LAYOUT STRUCTURE**

```
┌─────────────────────────────────────────────────────────┐
│  New Bundle Purchase (Stock Lot)                         │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │ Date             │  │ Container Number           │ │
│  │ Batch #          │  │ Division                   │ │
│  │ Supplier         │  │ Sub-Division               │ │
│  │ Currency | Rate  │  └────────────────────────────┘ │
│  └──────────────────┘                                  │
├─────────────────────────────────────────────────────────┤
│  Item Details (Cart)                                     │
│  ┌───────────────────────────────────────────────────┐ │
│  │ [Item Selector] [Qty] [Rate] [Add Item Button]  │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Item        │ Qty │ Rate │ Total │ Action        │ │
│  ├─────────────┼─────┼──────┼───────┼───────────────┤ │
│  │ Item Name   │ 10  │ 12.50│ 125.00│ [Remove]      │ │
│  └───────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  Landed Cost / Additional Charges                      │
│  [Charge Type] [Provider] [Currency] [Amount] [Add]   │
│  [Cost List Display]                                   │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐ │
│  │ Total Items Cost: $XXX.XX                         │ │
│  │ Total Additional Cost: $XXX.XX                    │ │
│  │                    GRAND TOTAL: $XXX.XX          │ │
│  │                    [Finalize Purchase]           │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

**End of Structure Guide**
