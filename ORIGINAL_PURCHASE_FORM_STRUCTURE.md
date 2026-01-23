# Original Purchase Form - Complete Structure Guide
## For New App Construction

---

## 📋 **OVERVIEW**

The Original Purchase form allows users to record purchases of raw materials (used clothing) from suppliers. The form supports purchasing multiple original types in a single transaction using a cart-based system. This document describes all sections, fields, and their purposes without coding or accounting logic.

---

## 🏗️ **FORM STRUCTURE**

The form is divided into **7 main sections**:

1. **Header & Mode Toggle**
2. **Basic Purchase Information**
3. **Supplier & Currency Information**
4. **Logistics & Destination**
5. **Add to Cart Block** (Multi-Original Type Entry)
6. **Purchase Cart Display**
7. **Additional Costs Section**
8. **Summary & Submit**

---

## 📝 **SECTION-BY-SECTION BREAKDOWN**

### **SECTION 1: HEADER & MODE TOGGLE**

**Purpose:** Navigation between creating new purchases and managing existing ones

**Fields:**
- **Title:** "New Raw Material Purchase" (when creating) or "Edit Purchase" (when editing)
- **Mode Toggle Buttons:**
  - **"Create New" Button:** Switches to create mode (shows form)
  - **"Manage Existing" Button:** Switches to manage mode (shows list of purchases)

**Behavior:**
- Default mode: "Create New"
- When in "Manage Existing" mode, shows a table list of all purchases
- When editing, shows "Cancel Edit" button

---

### **SECTION 2: BASIC PURCHASE INFORMATION**

**Purpose:** Core purchase identification and date

**Fields:**

#### **2.1 Batch Number**
- **Type:** Text Input (Editable)
- **Default Value:** Auto-generated (e.g., "11001")
- **Auto-Generation Logic:** Finds highest existing batch number and adds 1
- **Editable:** Yes (user can change)
- **Required:** Yes
- **Display:** Monospace font, bold
- **Helper Text:** "Auto-generated (Editable)"

#### **2.2 Date**
- **Type:** Date Picker
- **Default Value:** Today's date
- **Format:** YYYY-MM-DD
- **Required:** Yes
- **Purpose:** Purchase transaction date

---

### **SECTION 3: SUPPLIER & CURRENCY INFORMATION**

**Purpose:** Identify supplier and set transaction currency

**Fields:**

#### **3.1 Supplier**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only partners with type = "SUPPLIER"
- **Required:** Yes
- **Quick Add:** Available (opens modal to add new supplier)
- **Auto-Population:** When supplier selected, auto-populates currency from supplier's default currency

#### **3.2 Currency & Exchange Rate**
- **Layout:** Two-column grid in gray background box
- **Currency Field:**
  - **Type:** Dropdown
  - **Options:** All currencies from Setup (e.g., USD, AED, EUR, GBP)
  - **Default:** Supplier's default currency (if available) or USD
  - **Auto-Update:** Updates when supplier changes
- **Exchange Rate Field:**
  - **Type:** Number Input
  - **Default:** Auto-populated from currency setup (e.g., 3.67 for AED)
  - **Editable:** Yes (user can override)
  - **Step:** 0.0001 (allows decimal precision)
  - **Auto-Update:** Updates when currency changes

---

### **SECTION 4: LOGISTICS & DESTINATION**

**Purpose:** Track container and destination information

**Layout:** Gray background box with border, titled "Logistics & Destination"

**Fields:**

#### **4.1 Container Number**
- **Type:** Text Input
- **Required:** No (Optional)
- **Placeholder:** "e.g. MSCU1234567"
- **Purpose:** Track container/shipment number
- **Validation:** Checks for duplicates (warns if same container number exists)

#### **4.2 Division**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** All divisions from Setup
- **Required:** No (Optional)
- **Quick Add:** Available
- **Purpose:** Factory division assignment

#### **4.3 Sub-Division**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only sub-divisions belonging to selected Division
- **Required:** No (Optional)
- **Disabled:** Yes (until Division is selected)
- **Quick Add:** Available (pre-fills divisionId)
- **Purpose:** Sub-division within division

---

### **SECTION 5: ADD TO CART BLOCK** ⭐ **KEY SECTION**

**Purpose:** Add multiple original types to purchase cart before finalizing

**Layout:** Grid layout with multiple fields

#### **5.1 Original Type Selection**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** All Original Types from Setup (e.g., "KSA Mix", "UK Mix")
- **Required:** Yes (to add to cart)
- **Quick Add:** Available (opens modal to add new original type)
- **Behavior:** 
  - When selected, filters Original Products dropdown
  - Clears Original Product selection when changed

#### **5.2 Sub Supplier Selection**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered to show only:
  - Partners with type = "SUB_SUPPLIER"
  - That belong to the selected main Supplier (parentSupplierId matches)
- **Required:** No (Optional)
- **Disabled:** Yes (until main Supplier is selected)
- **Purpose:** Track sub-supplier for composite purchases

#### **5.3 Original Product Selection**
- **Type:** Dropdown Selector (EntitySelector)
- **Options:** Filtered Original Products that belong to selected Original Type
- **Required:** No (Optional)
- **Disabled:** Yes (until Original Type is selected)
- **Quick Add:** Available (pre-fills originalTypeId)
- **Purpose:** Sub-classification of original type (e.g., "Mixed Rags" under "KSA Mix")

#### **5.4 Weight Input**
- **Type:** Number Input
- **Label:** "Weight (Kg)"
- **Required:** Yes (to add to cart)
- **Placeholder:** "0.00"
- **Purpose:** Weight purchased in kilograms
- **Validation:** Must be > 0

#### **5.5 Price per Kg Input**
- **Type:** Number Input
- **Label:** "Price per Kg ({currency})" (shows selected currency)
- **Required:** Yes (to add to cart)
- **Placeholder:** "0.00"
- **Display:** Bold font
- **Purpose:** Gross price per kilogram in supplier's currency
- **Validation:** Must be > 0

#### **5.6 Discount per Kg**
- **Type:** Number Input
- **Label:** "Discount/Kg ({currency})"
- **Required:** No (Optional)
- **Placeholder:** "0.00"
- **Layout:** In gray background box with 3 columns
- **Purpose:** Discount amount per kilogram (reduces price)

#### **5.7 Surcharge per Kg**
- **Type:** Number Input
- **Label:** "Surcharge/Kg ({currency})"
- **Required:** No (Optional)
- **Placeholder:** "0.00"
- **Layout:** In gray background box with 3 columns
- **Purpose:** Surcharge amount per kilogram (increases price)

#### **5.8 Add to Cart Button**
- **Type:** Button
- **Label:** "Add to Cart" (with Plus icon)
- **Location:** Right column of 3-column grid
- **Disabled When:** 
  - Original Type not selected
  - Weight not entered or <= 0
  - Price not entered or <= 0
- **Action:** 
  - Validates required fields
  - Calculates quantities and costs
  - Adds item to cart
  - Clears all item fields (ready for next entry)

---

### **SECTION 6: PURCHASE CART DISPLAY**

**Purpose:** Review all items added to cart before finalizing

**Layout:** Table with header and rows

**Display Conditions:**
- Only shows when cart has items (`purCart.length > 0`)
- Header shows: "Purchase Cart (X type(s))" where X = number of items

**Table Columns:**

1. **Original Type** (Left-aligned)
   - Shows: Combined name (e.g., "KSA Mix - Mixed Rags" or just "KSA Mix")
   - Format: Bold/Medium font

2. **Sub Supplier** (Left-aligned)
   - Shows: Sub supplier name if assigned, or "-" if none
   - Format: Medium font

3. **Weight (Kg)** (Right-aligned)
   - Shows: Weight purchased for this item
   - Format: Monospace, 2 decimal places

4. **Price/Kg** (Right-aligned)
   - Shows: Gross price per kg in foreign currency
   - Format: Monospace, 2 decimal places

5. **Discount** (Right-aligned)
   - Shows: Discount per kg (if any) with minus sign
   - Format: Monospace, green color, 2 decimal places
   - Shows "-" if no discount

6. **Surcharge** (Right-aligned)
   - Shows: Surcharge per kg (if any) with plus sign
   - Format: Monospace, orange color, 2 decimal places
   - Shows "-" if no surcharge

7. **Total ({currency})** (Right-aligned)
   - Shows: Total cost for this item in foreign currency
   - Format: Monospace, bold, 2 decimal places
   - Calculation: (Weight × (Price - Discount + Surcharge))

8. **Total (USD)** (Right-aligned)
   - Shows: Total cost converted to USD
   - Format: Monospace, bold, blue color, 2 decimal places
   - Calculation: Total FCY / Exchange Rate

9. **Remove Button** (Right-aligned)
   - Icon: X (red)
   - Action: Removes item from cart
   - Hover: Darker red

**Footer Row (Totals):**
- **Background:** Light blue
- **Border:** Top border (2px, blue)
- **Columns:**
  - First column: "TOTALS" label
  - Weight column: Sum of all weights
  - Total FCY column: Sum of all foreign currency totals
  - Total USD column: Sum of all USD totals
  - Format: Bold, blue color

---

### **SECTION 7: ADDITIONAL COSTS SECTION**

**Purpose:** Add freight, clearing, commission, and other charges

**Layout:** Gray background box with border, titled "Landed Cost / Additional Charges"

**Fields (5-column grid):**

#### **7.1 Charge Type**
- **Type:** Dropdown
- **Options:** 
  - "Freight"
  - "Clearing"
  - "Commission"
  - "Other"
- **Default:** "Freight"
- **Behavior:** When changed, clears provider/custom name fields

#### **7.2 Provider/Agent OR Custom Name**
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

#### **7.3 Currency**
- **Type:** Dropdown
- **Options:** All currencies from Setup
- **Default:** USD or supplier's currency
- **Purpose:** Currency for this additional cost

#### **7.4 Amount**
- **Type:** Number Input
- **Placeholder:** "0.00"
- **Required:** Yes (to add cost)
- **Purpose:** Cost amount in selected currency

#### **7.5 Add Cost Button**
- **Type:** Button
- **Label:** "Add Cost"
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

### **SECTION 8: SUMMARY & SUBMIT**

**Purpose:** Show totals and finalize purchase

**Layout:** Blue background box with border

**Summary Display:**

#### **8.1 Material Cost**
- **Label:** "Material Cost:"
- **Display:** 
  - Foreign Currency amount (if not USD)
  - USD amount (always shown)
- **Calculation:** Sum of all cart items' totalCostUSD
- **Format:** Bold, monospace

#### **8.2 Additional Costs**
- **Label:** "Additional Costs:"
- **Display:**
  - Foreign Currency amount (if not USD)
  - USD amount (always shown)
- **Calculation:** Sum of all additional costs' amountUSD
- **Format:** Bold, monospace

#### **8.3 Total Landed Cost**
- **Label:** "Total Landed Cost:" (bold, larger font)
- **Display:**
  - Foreign Currency amount (if not USD)
  - USD amount (always shown)
- **Calculation:** Material Cost USD + Additional Costs USD
- **Format:** Bold, monospace, blue color, larger font
- **Border:** Top border separating from other totals

**Additional Display:**
- **Cost per Kg:** Shows calculated landed cost per kilogram
- **Format:** Small text, gray, below totals

---

### **SECTION 9: CSV UPLOAD SECTION**

**Purpose:** Bulk upload purchases via CSV file

**Layout:** Gray background box with border

**Components:**

#### **9.1 Choose CSV File Button**
- **Type:** File Input (hidden) with styled label
- **Accept:** .csv files only
- **Action:** Opens file picker, parses CSV, adds items to cart

#### **9.2 Download Template Button**
- **Type:** Button
- **Label:** "Download Template"
- **Action:** Downloads CSV template file with headers

**Helper Text:**
- Explains CSV format requirements
- Lists required and optional fields

---

### **SECTION 10: SUBMIT BUTTON**

**Purpose:** Finalize and save purchase

**Type:** Submit Button
**Label:** "Review & Submit" (with FileText icon)
**Disabled When:**
- Supplier not selected
- Cart is empty (no items added)
**Action:** 
- Shows review summary modal
- User can print/verify
- Then saves to database

---

## 🛒 **ADD TO CART BLOCK - DETAILED WORKFLOW**

### **Step-by-Step Process:**

1. **Select Original Type**
   - User selects from dropdown
   - Original Product dropdown becomes enabled
   - Sub Supplier dropdown becomes enabled (if supplier selected)

2. **Select Sub Supplier (Optional)**
   - Only shows sub-suppliers belonging to selected main supplier
   - Can be left empty

3. **Select Original Product (Optional)**
   - Only shows products belonging to selected original type
   - Can be left empty

4. **Enter Weight**
   - User enters weight in kilograms
   - Must be positive number

5. **Enter Price per Kg**
   - User enters gross price per kilogram
   - Currency shown in label (e.g., "Price per Kg (AED)")
   - Must be positive number

6. **Enter Discount (Optional)**
   - User can enter discount per kg
   - Reduces the effective price

7. **Enter Surcharge (Optional)**
   - User can enter surcharge per kg
   - Increases the effective price

8. **Click "Add to Cart"**
   - System validates: Original Type, Weight, Price are required
   - System calculates:
     - **Quantity (Units):** Weight / Packing Size (from Original Type)
     - **Net Price per Kg:** Price - Discount + Surcharge
     - **Total Cost FCY:** Weight × Net Price per Kg
     - **Total Cost USD:** Total Cost FCY / Exchange Rate
   - Creates cart item object with all details
   - Adds to cart array
   - Clears all input fields (ready for next item)

9. **Repeat Steps 1-8** for additional original types

10. **Review Cart**
    - Cart table shows all added items
    - User can remove items if needed
    - Totals calculated automatically

---

## 📊 **CART ITEM DATA STRUCTURE**

Each item in the cart contains:

- **id:** Unique identifier (random string)
- **originalTypeId:** ID of selected original type
- **originalType:** Display name (e.g., "KSA Mix - Mixed Rags")
- **originalProductId:** Optional - ID of selected product
- **subSupplierId:** Optional - ID of selected sub supplier
- **weightPurchased:** Weight in kilograms (user input)
- **qtyPurchased:** Quantity in units (calculated: weight / packing size)
- **costPerKgFCY:** Gross price per kg (user input)
- **discountPerKgFCY:** Discount per kg (user input, optional)
- **surchargePerKgFCY:** Surcharge per kg (user input, optional)
- **totalCostFCY:** Net total in foreign currency (calculated)
- **totalCostUSD:** Net total in USD (calculated)

---

## 🔄 **AUTO-POPULATION & DEPENDENCIES**

### **When Supplier Changes:**
- Currency auto-populates from supplier's default currency
- Exchange rate auto-updates based on currency
- Sub Supplier dropdown filters to show only sub-suppliers of this supplier

### **When Original Type Changes:**
- Original Product dropdown filters to show only products of this type
- Original Product selection clears (if previously selected)

### **When Currency Changes:**
- Exchange rate auto-updates from currency setup
- User can manually override exchange rate

### **When Batch Number Auto-Generates:**
- Finds highest existing batch number
- Adds 1 to generate next number
- User can edit if needed

---

## ✅ **VALIDATION RULES**

### **Before Adding to Cart:**
- ✅ Original Type must be selected
- ✅ Weight must be entered and > 0
- ✅ Price must be entered and > 0
- ⚠️ Sub Supplier: Optional
- ⚠️ Original Product: Optional
- ⚠️ Discount: Optional (defaults to 0)
- ⚠️ Surcharge: Optional (defaults to 0)

### **Before Submitting:**
- ✅ Supplier must be selected
- ✅ Cart must have at least 1 item
- ✅ Batch Number must be entered
- ✅ Date must be entered
- ⚠️ Container Number: Optional (but warns if duplicate)
- ⚠️ Division/Sub-Division: Optional
- ⚠️ Additional Costs: Optional

---

## 🎯 **KEY FEATURES**

### **1. Multi-Original Type Support**
- Can add multiple original types to single purchase
- Each type tracked separately with its own pricing
- Supports different sub-suppliers per type
- Supports different products per type

### **2. Composite Purchase Support**
- Main supplier for overall purchase
- Sub-suppliers for individual items
- Tracks which item belongs to which sub-supplier

### **3. Flexible Pricing**
- Gross price per kg
- Item-level discount
- Item-level surcharge
- Net price calculated automatically

### **4. Multi-Currency Support**
- Supplier currency for material costs
- Different currencies for additional costs
- Automatic conversion to USD for accounting

### **5. Quantity Calculation**
- Automatically calculates units from weight
- Uses packing size from Original Type definition
- Formula: Units = Weight (Kg) / Packing Size (Kg per unit)

### **6. Cart Management**
- Add multiple items
- Remove individual items
- View totals in real-time
- Clear cart on submit

---

## 📋 **FORM FIELD SUMMARY TABLE**

| Section | Field Name | Type | Required | Default | Auto-Populated From |
|---------|-----------|------|----------|---------|-------------------|
| Basic Info | Batch Number | Text | Yes | Auto (11001+) | Previous purchases |
| Basic Info | Date | Date | Yes | Today | System date |
| Supplier | Supplier | Dropdown | Yes | - | - |
| Supplier | Currency | Dropdown | Yes | USD | Supplier default |
| Supplier | Exchange Rate | Number | Yes | 1.0 | Currency setup |
| Logistics | Container Number | Text | No | - | - |
| Logistics | Division | Dropdown | No | - | - |
| Logistics | Sub-Division | Dropdown | No | - | Selected Division |
| Add to Cart | Original Type | Dropdown | Yes* | - | - |
| Add to Cart | Sub Supplier | Dropdown | No | - | Selected Supplier |
| Add to Cart | Original Product | Dropdown | No | - | Selected Original Type |
| Add to Cart | Weight (Kg) | Number | Yes* | - | - |
| Add to Cart | Price per Kg | Number | Yes* | - | - |
| Add to Cart | Discount/Kg | Number | No | 0 | - |
| Add to Cart | Surcharge/Kg | Number | No | 0 | - |
| Additional Costs | Charge Type | Dropdown | Yes* | Freight | - |
| Additional Costs | Provider/Name | Dropdown/Text | Yes* | - | - |
| Additional Costs | Currency | Dropdown | Yes* | USD | - |
| Additional Costs | Amount | Number | Yes* | - | - |

*Required only when adding to cart/cost list

---

## 🎨 **UI/UX DESIGN NOTES**

### **Visual Hierarchy:**
- **Primary Actions:** Green/Blue buttons (Add to Cart, Review & Submit)
- **Secondary Actions:** Gray buttons (Cancel, Remove)
- **Information Boxes:** Gray backgrounds with borders
- **Summary Box:** Blue background for emphasis

### **Form Layout:**
- **Grid System:** 2-column grid for most fields
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
- **Helper Text:** Additional guidance where needed
- **Error Messages:** Clear validation feedback

---

## 🔍 **EDGE CASES & SPECIAL BEHAVIORS**

### **1. Empty Cart**
- Submit button disabled
- Cart table hidden
- User must add at least one item

### **2. Duplicate Container Number**
- Warning shown if container number already exists
- User can proceed or change container number

### **3. Missing Exchange Rate**
- Falls back to constant rates if not in setup
- User can manually enter rate

### **4. Sub-Supplier Filtering**
- Only shows sub-suppliers of selected main supplier
- Disabled until main supplier selected

### **5. Original Product Filtering**
- Only shows products of selected original type
- Disabled until original type selected

### **6. Currency Mismatch**
- Material costs in supplier currency
- Additional costs can be in different currencies
- All converted to USD for final totals

---

## 📦 **CSV UPLOAD FORMAT**

**Required Columns:**
- Original Type ID (or Name)
- Weight (Kg)
- Price per Kg

**Optional Columns:**
- Original Product ID
- Sub Supplier ID
- Discount per Kg
- Surcharge per Kg
- Batch Number
- Container Number
- Division ID
- Sub-Division ID

**Behavior:**
- Parses CSV file
- Validates each row
- Adds valid rows to cart
- Shows errors for invalid rows

---

## 🎯 **USER WORKFLOW SUMMARY**

1. **Select Mode:** Create New or Manage Existing
2. **Enter Basic Info:** Batch Number (auto), Date
3. **Select Supplier:** Auto-populates currency
4. **Set Logistics:** Container, Division, Sub-Division (optional)
5. **Add Items to Cart:**
   - Select Original Type
   - Select Sub Supplier (optional)
   - Select Original Product (optional)
   - Enter Weight
   - Enter Price
   - Enter Discount/Surcharge (optional)
   - Click "Add to Cart"
   - Repeat for more items
6. **Review Cart:** Check items, remove if needed
7. **Add Additional Costs:** Freight, Clearing, etc. (optional)
8. **Review Summary:** Check totals
9. **Submit:** Click "Review & Submit"
10. **Confirm:** Review modal, then save

---

## 💡 **DESIGN RECOMMENDATIONS FOR NEW APP**

### **1. Form Organization**
- Group related fields in visual containers
- Use clear section headers
- Maintain consistent spacing

### **2. Cart System**
- Make cart visible and prominent
- Show real-time totals
- Allow easy item removal
- Display item details clearly

### **3. Validation**
- Validate before adding to cart
- Show clear error messages
- Disable submit when invalid
- Provide helpful hints

### **4. Auto-Population**
- Auto-fill from related selections
- Allow manual overrides
- Show what was auto-filled

### **5. User Guidance**
- Clear labels and placeholders
- Helper text for complex fields
- Tooltips for calculations
- Progress indicators

### **6. Responsive Design**
- Mobile-friendly layout
- Touch-friendly buttons
- Readable on all screen sizes

---

**End of Structure Guide**
