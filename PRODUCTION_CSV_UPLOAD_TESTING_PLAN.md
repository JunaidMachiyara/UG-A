# Production CSV Upload - Testing Plan

## 🎯 **Objective**
Verify that CSV upload for Production creates balanced ledger entries and correctly reflects in the Balance Sheet.

---

## 📋 **PRE-TEST CHECKS** (Before Testing)

### 1. **Check Current Balance Sheet**
- Go to: **Reports > Financial Statements > Balance Sheet**
- Note down:
  - **Total Assets** = $__________
  - **Total Liabilities & Equity** = $__________
  - **Balance Sheet Difference** = $__________ (should be close to $0)
  - **Inventory - Finished Goods** = $__________
  - **Production Gain** (or **Capital**) = $__________
  - **Work in Progress** = $__________ (if exists)

### 2. **Check Original Opening Stock**
- Go to: **Data Entry > Purchases > Original Opening**
- Note down:
  - **Total Original Opening entries** = __________
  - **Total WIP Balance** (if WIP account exists) = $__________
- **Purpose**: To know if WIP should be consumed or Capital should be credited

### 3. **Check Required Accounts Exist**
- Go to: **Setup > Chart of Accounts**
- Verify these accounts exist:
  - ✅ **Inventory - Finished Goods** (Account Code: 105)
  - ✅ **Work in Progress** (if you have Original Opening stock)
  - ✅ **Production Gain** OR **Capital** / **Owner's Capital** (Account Code: 301)

### 4. **Check Browser Console**
- Open Browser Console (F12)
- Clear console
- **Purpose**: To see production creation logs

---

## 🧪 **TEST SCENARIOS**

### **TEST 1: Production WITHOUT Original Opening Stock**
**Scenario**: Upload production when there's NO Original Opening stock (no WIP to consume)

**Steps:**
1. Note current Balance Sheet values (from Pre-Test)
2. Create a CSV with 1-2 production items:
   ```
   Production Date,Item ID,Quantity,Production Price
   2025-12-31,ITEM-XXXX,100,10.50
   ```
3. Go to: **Data Entry > Purchases > Produced Production**
4. Click **"Upload CSV"** and select your CSV file
5. Click **"Finalize & Save"**
6. Wait for success message

**What to Check:**

#### ✅ **A. Browser Console (F12)**
Look for these log messages:
```
🟢 addProduction called with: [array of productions]
📦 Item found: [item name] avgCost: [value]
💰 Calculations: {
  finishedGoodsValue: [value],
  wipValueConsumed: 0,  ← Should be 0 (no WIP)
  capitalCredit: [same as finishedGoodsValue],  ← Should equal finishedGoodsValue
  wipBalance: 0
}
📊 Posting [X] ledger entries in batch...
✅ Successfully posted [X] ledger entries
```

#### ✅ **B. Ledger Entries**
Go to: **Accounting > General Ledger**
- Filter by: **Transaction Type = Production**
- Find entries with **Transaction ID = PROD-[id]**
- **Expected Entries:**
  1. **DEBIT**: Inventory - Finished Goods = $[production value]
  2. **CREDIT**: Production Gain (or Capital) = $[same value]
  3. **NO WIP entry** (because no Original Opening)

#### ✅ **C. Balance Sheet Changes**
Go to: **Reports > Financial Statements > Balance Sheet**
- **Expected Changes:**
  - **Inventory - Finished Goods** increased by $[production value]
  - **Production Gain** (or **Capital**) increased by $[same value]
  - **Total Assets** increased by $[production value]
  - **Total Equity** increased by $[same value]
  - **Balance Sheet Difference** = Should remain the same (or improve if it was unbalanced)

#### ✅ **D. Production List**
Go to: **Data Entry > Purchases > Produced Production**
- Verify your production entry appears in the list
- Check: Date, Item, Quantity, Weight match CSV

---

### **TEST 2: Production WITH Original Opening Stock**
**Scenario**: Upload production when Original Opening stock exists (WIP should be consumed)

**Steps:**
1. Ensure you have Original Opening entries (from Pre-Test Check #2)
2. Note current WIP balance
3. Create a CSV with production items
4. Upload CSV and finalize

**What to Check:**

#### ✅ **A. Browser Console (F12)**
Look for:
```
📊 WIP account found. Creating production entries with WIP consumption.
💰 Calculations: {
  finishedGoodsValue: [value],
  wipValueConsumed: [value > 0],  ← Should be > 0 if Original Opening exists
  capitalCredit: [value],  ← Should be finishedGoodsValue - wipValueConsumed
  wipBalance: [value > 0]
}
```

#### ✅ **B. Ledger Entries**
Go to: **Accounting > General Ledger**
- Find entries with **Transaction ID = PROD-[id]**
- **Expected Entries:**
  1. **DEBIT**: Inventory - Finished Goods = $[full production value]
  2. **CREDIT**: Work in Progress = $[WIP consumed value]
  3. **CREDIT**: Production Gain (or Capital) = $[remainder value]
  4. **Total Credits** = **Total Debit** (balanced!)

#### ✅ **C. Balance Sheet Changes**
- **Inventory - Finished Goods** increased by $[full production value]
- **Work in Progress** decreased by $[WIP consumed value]
- **Production Gain** (or **Capital**) increased by $[remainder value]
- **Total Assets** increased by $[full production value]
- **Total Equity** increased by $[remainder value only]
- **Balance Sheet Difference** = Should remain balanced

#### ✅ **D. WIP Balance Verification**
- **Work in Progress** balance should decrease by the amount consumed
- If WIP was fully consumed, remainder goes to Capital

---

### **TEST 3: Bulk CSV Upload (Multiple Items)**
**Scenario**: Upload CSV with 10+ production items

**Steps:**
1. Create CSV with multiple items (different dates, items, quantities)
2. Upload and finalize
3. Verify all entries are created

**What to Check:**
- ✅ All production entries appear in the list
- ✅ Each production has corresponding ledger entries
- ✅ Balance Sheet totals match sum of all productions
- ✅ No errors in console

---

### **TEST 4: Verify Double-Entry Accounting**
**Scenario**: Ensure every production has BOTH debit and credit entries

**Steps:**
1. Go to: **Admin > Transaction Integrity Diagnostic**
2. Click **"Find Productions Missing Credit Entries"**
3. Check results

**Expected Result:**
- ✅ **0 productions missing credit entries**
- ✅ All productions have balanced debit/credit entries

---

## 🔍 **VERIFICATION CHECKLIST**

After each test, verify:

### ✅ **1. Ledger Entry Verification**
- [ ] Every production has a **DEBIT** entry (Finished Goods)
- [ ] Every production has a **CREDIT** entry (WIP or Capital/Production Gain)
- [ ] Total Debits = Total Credits for each production
- [ ] Transaction IDs match: `PROD-[same-id]` for all entries of one production

### ✅ **2. Balance Sheet Verification**
- [ ] **Inventory - Finished Goods** increased by correct amount
- [ ] **Production Gain/Capital** increased (or WIP decreased if consumed)
- [ ] **Total Assets** = **Total Liabilities & Equity** (balanced)
- [ ] Balance Sheet difference is acceptable (< $1.00)

### ✅ **3. Account Balance Verification**
- [ ] Go to: **Accounting > Chart of Accounts**
- [ ] Check **Inventory - Finished Goods** balance matches ledger sum
- [ ] Check **Production Gain/Capital** balance matches ledger sum
- [ ] Check **Work in Progress** balance (if applicable) matches ledger sum

### ✅ **4. Production List Verification**
- [ ] All CSV entries appear in production list
- [ ] Quantities, dates, items match CSV
- [ ] No duplicate entries

---

## 🚨 **TROUBLESHOOTING**

### **Issue: No Ledger Entries Created**
**Check:**
- Browser console for errors
- Verify required accounts exist (Finished Goods, Capital/Production Gain)
- Check if `addProduction` was called (look for log: `🟢 addProduction called`)

### **Issue: Only Debit Entry Created (No Credit)**
**Check:**
- Browser console for error: `❌ CRITICAL ERROR: Cannot create production entry`
- Verify Production Gain or Capital account exists
- Check account names match exactly

### **Issue: Balance Sheet Not Updating**
**Check:**
- Refresh the page (F5)
- Check if ledger entries have correct `accountId` matching account document IDs
- Run: **Admin > Balance Sheet Deep Diagnostic**

### **Issue: WIP Not Being Consumed**
**Check:**
- Verify Original Opening entries exist
- Check WIP account balance > 0
- Check console log: `wipValueConsumed` should be > 0
- Verify Original Opening entries have correct `factoryId`

---

## 📊 **EXPECTED RESULTS SUMMARY**

| Test Scenario | Debit Entry | Credit Entry 1 | Credit Entry 2 | Balance Sheet Impact |
|--------------|-------------|----------------|----------------|---------------------|
| **No Original Opening** | Finished Goods ($X) | Production Gain/Capital ($X) | - | Assets +$X, Equity +$X |
| **With Original Opening** | Finished Goods ($X) | WIP ($Y) | Production Gain/Capital ($X-$Y) | Assets +$X, Equity +($X-$Y), WIP -$Y |
| **Bulk Upload** | Multiple entries | Multiple entries | Multiple entries | Sum of all entries |

---

## ✅ **SUCCESS CRITERIA**

The test is **SUCCESSFUL** if:
1. ✅ All ledger entries are created (debit + credit)
2. ✅ Balance Sheet shows correct changes
3. ✅ Total Assets = Total Liabilities & Equity (balanced)
4. ✅ No errors in browser console
5. ✅ All production entries appear in the list
6. ✅ Account balances match ledger calculations

---

## 📝 **TEST RESULTS TEMPLATE**

```
Test Date: __________
Tester: __________

Test 1: Production WITHOUT Original Opening
- CSV Items: __________
- Production Value: $__________
- Ledger Entries Created: [ ] Yes [ ] No
- Balance Sheet Updated: [ ] Yes [ ] No
- Issues Found: __________

Test 2: Production WITH Original Opening
- CSV Items: __________
- Production Value: $__________
- WIP Consumed: $__________
- Capital Credited: $__________
- Ledger Entries Created: [ ] Yes [ ] No
- Balance Sheet Updated: [ ] Yes [ ] No
- Issues Found: __________

Overall Result: [ ] PASS [ ] FAIL
Notes: __________
```

---

## 🎯 **QUICK VERIFICATION COMMANDS**

### Check Ledger Entries in Console:
```javascript
// In browser console (F12)
state.ledger.filter(e => e.transactionId?.startsWith('PROD-')).forEach(e => {
  console.log(`${e.transactionId}: ${e.accountName} - Debit: $${e.debit}, Credit: $${e.credit}`);
});
```

### Check Production Entries:
```javascript
// In browser console
state.productions.filter(p => p.date === '2025-12-31').forEach(p => {
  console.log(`${p.itemName}: ${p.qtyProduced} units, Value: $${(p.qtyProduced * (p.productionPrice || 0))}`);
});
```

### Check Account Balances:
```javascript
// In browser console
const fgAccount = state.accounts.find(a => a.name.includes('Finished Goods'));
const capitalAccount = state.accounts.find(a => a.name.includes('Capital') || a.name.includes('Production Gain'));
console.log('Finished Goods Balance:', fgAccount?.balance);
console.log('Capital/Production Gain Balance:', capitalAccount?.balance);
```

---

**Last Updated**: Current Date
**Version**: 1.0





