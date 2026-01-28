# Data Entry > Purchase > Original Purchase — Submit Button Functionality (Technical Reference)
## For AI Model Training & New App Development

**Module Path:** Data Entry → Purchase → Original Purchase  
**Primary Files:**
- `d:\UG-A-Cursor\components\DataEntry.tsx`
- `d:\UG-A-Cursor\context\DataContext.tsx`
- `d:\UG-A-Cursor\types.ts`

---

## ✅ What “Submit” Means in This App (Important)

In this module, the “Submit” flow is **two-stage**:

1. **Form Submit (UI submit):** validates minimum inputs and opens a **Review/Print modal** (does **not** save yet).
2. **Save & Exit (final submit):** builds the `Purchase` object and calls `addPurchase(newPurchase)` which:
   - saves the purchase document to Firestore (`purchases` collection)
   - posts balanced double-entry ledger entries to Firestore (`ledger` collection) via `postTransaction()`

So: **the real persistence + accounting happens on “Save & Exit”, not on the `<form onSubmit>`**.

---

## 🧠 Terms & Concepts Used (copy these into your other app)

- **Cart-based transaction**: user builds a list of `PurchaseOriginalItem` rows (each is one Original Type line).
- **Pre-submit validation**: client-side checks before allowing user to reach the review modal.
- **Review/Print gate**: a modal that renders the printable invoice and provides “Print Invoice” + “Save & Exit”.
- **Normalization**: converting empty strings → `undefined` for optional IDs (Firestore data hygiene).
- **FCY / Base currency (USD)**:
  - FCY = supplier currency (or chosen transaction currency)
  - USD = base currency used for balancing ledger (`debit`/`credit`)
- **FX conversion**: \( USD = \frac{FCY}{exchangeRate} \) because exchange rate is stored as **1 USD = X FCY**.
- **Landed cost**: material cost (USD) + additional costs (USD); costs are **capitalized** into inventory.
- **Voucher / Transaction ID**: a synthetic ID used to group ledger entries (`PI-{batchNumber}`).
- **Double-entry validation**: debits must equal credits per transactionId (reporting-only entries excluded).
- **Reporting-only entries**: ledger rows flagged `isReportingOnly: true` for analytics only; do not affect balances.
- **Batch write**: Firestore `writeBatch()` used to write many ledger rows efficiently.

---

## 🧾 Data Structures (What the Submit Flow Produces)

### `PurchaseOriginalItem` (cart line)
Defined in `types.ts`.

- **Key fields**:
  - `originalTypeId`, `originalProductId?`, `subSupplierId?`
  - `weightPurchased` (Kg)
  - `qtyPurchased` (Units, derived from packing size)
  - `costPerKgFCY`, `discountPerKgFCY?`, `surchargePerKgFCY?`
  - `totalCostFCY`, `totalCostUSD`

### `PurchaseAdditionalCost`
- `costType`: Freight | Clearing | Commission | Other
- `providerId`: partner who will be credited (for “Other”, provider is supplier)
- `amountFCY`, `amountUSD`, `exchangeRate`

### `Purchase` (final payload)
- `items: PurchaseOriginalItem[]` (multi-type purchase)
- **Legacy compatibility fields** still populated from the first cart item:
  - `originalTypeId`, `originalType`, `originalProductId?`
- `totalCostFCY` (sum of items net FCY)
- `totalLandedCost` (USD)
- `landedCostPerKg` (USD/kg)
- Logistics fields: `containerNumber?`, `divisionId?`, `subDivisionId?`
- Status: default `'In Transit'`

---

## 1) Add-to-Cart Stage (Line Item Computation)

### Purpose
Convert user inputs (weight, price, discount/surcharge) into a fully-computed cart line.

### Inputs (per line)
- **Original Type** (`purOriginalTypeId`)
- **Original Product** (optional)
- **Sub Supplier** (optional)
- **Weight (Kg)** (`purWeight`)
- **Gross price / Kg** (`purPrice`) in FCY
- **Discount / Kg** (optional)
- **Surcharge / Kg** (optional)
- **Exchange Rate** (`purExchangeRate`) from Setup (used for USD conversion)

### Derived computations
- **Packing size**: from Original Type definition
- **Units**: \( qtyPurchased = \frac{weight}{packingSize} \)
- **Net FCY rate/kg**: \( netRate = gross - discount + surcharge \)
- **Line total FCY**: \( totalFCY = weight \times netRate \)
- **Line total USD**: \( totalUSD = \frac{totalFCY}{exchangeRate} \)

Implementation reference:

```520:574:d:\UG-A-Cursor\components\DataEntry.tsx
// --- Purchase Cart Functions ---
const handleAddToPurCart = () => {
    if (!purOriginalTypeId || !purWeight || !purPrice) {
        alert('Please fill in Original Type, Weight, and Price');
        return;
    }
    const weight = parseFloat(purWeight);
    const grossPricePerKgFCY = parseFloat(purPrice);
    const discountPerKg = purItemDiscount ? parseFloat(purItemDiscount) : 0;
    const surchargePerKg = purItemSurcharge ? parseFloat(purItemSurcharge) : 0;
    // ... packing size → qty, net rate → totals ...
    const totalCostUSD = totalCostFCY / purExchangeRate;
    const newItem: PurchaseOriginalItem = { /* computed line */ };
    setPurCart([...purCart, newItem]);
    // Clear item fields...
};
```

---

## 2) “Submit” (Form Submit) = Pre-Submit Validation + Open Summary Modal

### Trigger
The form uses `onSubmit={handlePreSubmitPurchase}`.

### What it checks
- Supplier must be selected
- Cart must have at least one item
- Container number must not be duplicated across:
  - existing original purchases (excluding the one being edited)
  - bundle purchases

### What it does NOT do
- Does not write to Firestore
- Does not create ledger entries
- Does not update inventory

Implementation reference:

```1640:1660:d:\UG-A-Cursor\components\DataEntry.tsx
const handlePreSubmitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purSupplier || purCart.length === 0) {
        alert('Please select Supplier and add at least one Original Type to cart');
        return;
    }
    // Validation for Container Number
    if (purContainer) {
        const isDuplicateOriginal = state.purchases.some(p => p.containerNumber === purContainer && p.id !== purEditingId);
        const isDuplicateBundle = state.bundlePurchases.some(p => p.containerNumber === purContainer);
        if (isDuplicateOriginal || isDuplicateBundle) {
            alert('Duplicate Container Number found! Please verify.');
            return;
        }
    }
    setPurPrinted(false);
    setShowPurSummary(true);
};
```

### Why this design is used
- Provides a **human confirmation step** (review invoice details)
- Enables print rendering (`window.print()`)
- Reduces accidental saves because users see totals and costs before committing

---

## 3) Final Submit = “Save & Exit” Builds Purchase Payload

### Trigger
Button inside modal:
- “Save & Exit” calls `handleFinalPurchaseSave()`

### Edit vs Create mode
- If `purEditingId` exists → update flow (not covered here)
- Else → create new purchase and call `addPurchase(newPurchase)`

### Core steps in create flow

#### A) Aggregate totals from cart
- `totalWeight = sum(item.weightPurchased)`
- `totalQty = sum(item.qtyPurchased)`
- `totalMaterialCostFCY = sum(item.totalCostFCY)`
- `totalMaterialCostUSD = sum(item.totalCostUSD)`

#### B) Aggregate additional costs
- `totalAdditionalCostUSD = sum(additionalCosts.amountUSD)`

#### C) Landed cost
- `totalLandedCostUSD = totalMaterialCostUSD + totalAdditionalCostUSD`
- `landedCostPerKg = totalLandedCostUSD / totalWeight`

#### D) Normalize optional fields
Empty strings for optional IDs become `undefined` so Firestore stays clean:
- `originalProductId: item.originalProductId || undefined`
- `subSupplierId: item.subSupplierId || undefined`

#### E) Build `Purchase` object
Important fields:
- `status: 'In Transit'`
- `items: normalizedCart`
- legacy fields set from first cart item

Implementation reference (key area):

```1667:1755:d:\UG-A-Cursor\components\DataEntry.tsx
const handleFinalPurchaseSave = () => {
    if (purEditingId) { handleUpdatePurchase(); return; }
    if (purCart.length === 0) { alert('Cart is empty!'); return; }
    const totalWeight = purCart.reduce((sum, item) => sum + item.weightPurchased, 0);
    const totalQty = purCart.reduce((sum, item) => sum + item.qtyPurchased, 0);
    const totalMaterialCostFCY = purCart.reduce((sum, item) => sum + item.totalCostFCY, 0);
    const totalMaterialCostUSD = purCart.reduce((sum, item) => sum + item.totalCostUSD, 0);
    const totalAdditionalCostUSD = additionalCosts.reduce((sum, c) => sum + c.amountUSD, 0);
    const totalLandedCostUSD = totalMaterialCostUSD + totalAdditionalCostUSD;
    const normalizedCart = purCart.map(item => ({
        ...item,
        originalProductId: item.originalProductId || undefined,
        subSupplierId: item.subSupplierId || undefined
    }));
    const newPurchase: Purchase = {
        id: Math.random().toString(36).substr(2, 9),
        batchNumber: purBatch,
        status: 'In Transit',
        date: purDate,
        supplierId: purSupplier,
        items: normalizedCart,
        // legacy fields from first item...
        containerNumber: purContainer,
        divisionId: purDivision,
        subDivisionId: purSubDivision,
        qtyPurchased: totalQty,
        weightPurchased: totalWeight,
        currency: purCurrency,
        exchangeRate: purExchangeRate,
        totalCostFCY: totalMaterialCostFCY,
        additionalCosts,
        totalLandedCost: totalLandedCostUSD,
        landedCostPerKg: totalLandedCostUSD / totalWeight,
        factoryId: state.currentFactory?.id || ''
    };
    addPurchase(newPurchase);
    // Reset form fields...
};
```

### UX behavior after calling `addPurchase()`
Immediately resets form fields and closes modal (optimistic UX), while Firestore writes complete asynchronously.

---

## 4) `addPurchase()` = Persistence + Accounting Posting

### Primary responsibilities
1. **Guards** (block save if Firestore/factory/supplier missing)
2. **Ensure qtyPurchased** is correct (multi-item vs legacy single-item)
3. **Save Purchase document** to Firestore `purchases`
4. **Create ledger entries** for the purchase invoice (transactionId `PI-*`)
5. **Post ledger** via `postTransaction()` (double-entry validation + Firebase write + local state update)

Implementation reference:

```2323:2594:d:\UG-A-Cursor\context\DataContext.tsx
const addPurchase = (purchase: Purchase) => {
    if (!isFirestoreLoaded) { alert('⚠️ Firebase not loaded yet...'); return; }
    if (!currentFactory?.id) { alert('⚠️ System Error: No factory selected...'); return; }
    if (!purchase.supplierId) { alert('⚠️ System Error: No supplier selected...'); return; }

    const purchaseWithFactory = { ...purchase, factoryId: currentFactory?.id || '' };
    // qtyPurchased handling (multi-item vs legacy)
    // save purchase with addDoc('purchases', ...)
    // buildPurchaseEntries() (inventory/supplier/additional-cost providers)
    // postTransaction(entries)
};
```

---

## 5) Ledger Posting Model (How Submit Creates Correct Accounting)

### Transaction ID convention
- `transactionId = PI-{batchNumber}`  
Example: `PI-11001`

### Material cost entry (base)
- **Debit**: Inventory - Raw Materials (USD) — increases inventory asset
- **Credit**: Supplier partner account (USD) — increases Accounts Payable / supplier liability

Material cost USD:
- \( materialCostUSD = \frac{totalCostFCY}{exchangeRate} \)

### Additional costs are **capitalized**
For each additional cost line:
- **Debit**: Inventory - Raw Materials (USD) — capitalized cost increases inventory value
- **Credit**: Cost Provider partner account (USD) — payable to freight/clearing/commission/supplier (“Other”)

### Sub-supplier “reporting-only” entries
If any cart line has `subSupplierId`, system adds:
- a **credit entry** to that sub-supplier partner account
- marked `isReportingOnly: true`
These are excluded from double-entry validation and do not affect balances.

---

## 6) `postTransaction()` = The Accounting Engine

### What it guarantees (critical for “Submit works perfectly”)

#### A) Double-entry validation per transactionId
For each transactionId group:
- excludes `isReportingOnly` rows
- validates:
  - `sum(debit) == sum(credit)` within tolerance \(0.01\)
  - at least one debit entry and one credit entry exist

Implementation reference:

```1287:1441:d:\UG-A-Cursor\context\DataContext.tsx
const postTransaction = async (entries: Omit<LedgerEntry, 'id'>[]) => {
    // Group by transactionId
    // Filter out reporting-only for balance validation
    // Validate debits == credits and has both sides
    // Batch write to Firestore ledger
    dispatch({ type: 'POST_TRANSACTION', payload: { entries: entriesWithFactory } });
    // Update partner balances in Firebase (after dispatch)
};
```

#### B) Efficient Firestore persistence (batch writes)
- writes ledger entries in batches of 500 using `writeBatch()`
- assigns `createdAt` timestamps
- replaces `undefined` with `null` for Firestore compatibility

#### C) Local state updated immediately
After writing (or even if write fails), it dispatches:
- `POST_TRANSACTION` to update local ledger + balances in memory.

#### D) Partner balance persistence
After dispatch, it updates `partners.balance` in Firebase so balances remain correct across refresh.

---

## 🧩 Why This Submit Flow Is Reliable (Design Reasons)

- **Separation of concerns**:
  - UI builds a complete `Purchase` payload with derived totals
  - DataContext performs persistence + accounting
- **Normalization** prevents malformed optional fields from polluting Firestore
- **Double-entry validation** blocks unbalanced vouchers at the posting boundary
- **Batch write strategy** scales to many ledger rows (cart lines + costs)
- **Reporting-only entries** allow analytics without breaking accounting integrity

---

## ⚠️ Implementation Notes for Your New App (Practical)

- Keep the same architecture: **UI builder → domain payload → service layer posting**.
- Treat “Submit” as a **two-step commit** (review step reduces errors).
- Use a strict “posting API” like `postTransaction()` that refuses unbalanced data.
- Store both:
  - **presentation currency** (FCY + exchangeRate + fcyAmount)
  - **base currency** (USD debit/credit) for balancing
- Decide whether you want optimistic UI (reset immediately) or blocking UI (wait for Firestore).

---

**End of Document**

