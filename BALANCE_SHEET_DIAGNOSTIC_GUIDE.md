# Balance Sheet Discrepancy Investigation Guide

## 🔍 **CURRENT ISSUE**

**Balance Sheet Status:**
- **Total Assets:** $13,440,656.831
- **Total Liabilities & Equity:** $13,152,636.081
- **Discrepancy:** **$288,020.75** (Assets > Liabilities & Equity)

**Balance Discrepancy Account:** -$5,966,774.70 (already included in Equity)

---

## 📋 **INVESTIGATION STEPS**

### **STEP 1: Export Day Book for All Dates**

The Day Book export already includes diagnostic columns to identify unbalanced transactions:

1. **Go to:** Reports > Day Book
2. **Set Date Range:**
   - Change "Entry Date" filter to cover a wider range
   - Or export multiple dates separately
3. **Click:** "Export Excel" button
4. **Review the Excel file:**
   - **"Summary" Sheet:** Shows list of all unbalanced transactions
   - **"Daybook" Sheet:** Shows all entries with columns:
     - `Is Balanced` (Yes/NO - UNBALANCED)
     - `Imbalance Amount` (shows amount if unbalanced)
     - `Transaction Total Debit`
     - `Transaction Total Credit`
     - `Transaction Balance`

**What to Look For:**
- Transactions marked as "NO - UNBALANCED"
- Any transaction where `Transaction Balance` ≠ 0
- Check the "Summary" sheet for a quick list of problematic transactions

---

### **STEP 2: Check Recent Journal Vouchers**

Based on the Day Book image, you have several Journal Vouchers (JV-1049 through JV-1055) entered on 01/20/2026. While they appear balanced individually, verify:

1. **Export Day Book for 01/20/2026** (already visible)
2. **Check each JV transaction:**
   - JV-1049: $30,000.00 / $30,000.00 ✅
   - JV-1050: $22,000.00 / $22,000.00 ✅
   - JV-1051: $33,000.00 / $33,000.00 ✅
   - JV-1052: $63,065.75 / $63,065.75 ✅
   - JV-1053: $79,955.00 / $79,955.00 ✅
   - JV-1054: $30,000.00 / $30,000.00 ✅
   - JV-1055: $30,000.00 / $30,000.00 ✅

**Note:** All visible JVs appear balanced. The issue might be:
- A transaction entered on a different date
- A transaction that was edited/corrupted after creation
- A calculation error in balance sheet aggregation

---

### **STEP 3: Check All Transaction Types**

The balance sheet discrepancy could come from any transaction type:

1. **Journal Vouchers (JV)** - Manual entries
2. **Receipt Vouchers (RV)** - Money received
3. **Payment Vouchers (PV)** - Money paid
4. **Expense Vouchers (EV)** - Expenses
5. **Purchase Bills (PB)** - Purchases
6. **Sales Invoices** - Sales
7. **Production Entries** - Production transactions
8. **Balance Discrepancy (BD)** - Adjustments

**Action:** Export Day Book with "Voucher Type: All Types" for a date range covering the last few days.

---

### **STEP 4: Verify Balance Sheet Calculation**

The balance sheet calculation includes:

**Assets:**
- All Asset accounts (sum of balances)
- Positive customer balances (Accounts Receivable)
- Positive supplier balances (Advances to Suppliers)

**Liabilities:**
- Regular liability accounts (excluding codes 2030-2099)
- Other Payable accounts (codes 2030-2099)
- Negative supplier balances (Accounts Payable)
- Negative customer balances (Customer Advances)

**Equity:**
- All Equity accounts (including Balance Discrepancy)
- Net Income (Revenue - Expenses)

**Potential Issues:**
1. **Partner Balance Calculation:** Check if customer/supplier balances are calculated correctly
2. **Account Balance Calculation:** Verify account balances match ledger entries
3. **Net Income Calculation:** Ensure revenue and expense accounts are included correctly

---

### **STEP 5: Check for Orphaned Entries**

Orphaned entries (ledger entries where accountId doesn't match any account) can cause discrepancies:

1. **Go to:** Admin > System Diagnostics
2. **Check for:**
   - Orphaned ledger entries
   - Missing account references
   - Balance calculation errors

---

### **STEP 6: Verify Transaction Validation**

The system should validate all transactions before saving:

**Journal Voucher Validation:**
- ✅ Checks that debits = credits (within 0.01 tolerance)
- ✅ Requires at least one debit and one credit entry
- ✅ Validates exchange rates

**If a transaction was saved despite being unbalanced, it could be:**
- A bug in validation logic
- A transaction edited after creation
- A transaction imported from CSV without validation

---

## 🔧 **QUICK DIAGNOSTIC ACTIONS**

### **Action 1: Export Full Day Book**

1. Go to Reports > Day Book
2. Set Entry Date to a date range (e.g., last 7 days)
3. Set Voucher Type to "All Types"
4. Click "Export Excel"
5. Open the Excel file
6. Check the "Summary" sheet for unbalanced transactions
7. Review the "Daybook" sheet and filter by "Is Balanced" = "NO - UNBALANCED"

### **Action 2: Check Balance Sheet Components**

1. Go to Reports > Balance Sheet
2. Click on each major component to see ledger details:
   - Total Assets
   - Total Liabilities
   - Total Equity
3. Verify the calculations match expected values

### **Action 3: Recalculate Account Balances**

1. Go to Admin > System Diagnostics
2. Look for "Recalculate Account Balances" or similar utility
3. Run the recalculation to ensure all balances are up-to-date

---

## 🐛 **COMMON CAUSES OF BALANCE SHEET DISCREPANCIES**

### **1. Unbalanced Transaction**
- A transaction where debits ≠ credits
- **Solution:** Find and correct the unbalanced transaction

### **2. Missing Entry**
- A transaction missing a debit or credit entry
- **Solution:** Add the missing entry or delete the incomplete transaction

### **3. Wrong Account Type**
- An account assigned to wrong category (Asset vs Liability)
- **Solution:** Check account setup and correct account types

### **4. Partner Balance Calculation Error**
- Customer/Supplier balances calculated incorrectly
- **Solution:** Verify partner balance calculation logic

### **5. Currency Conversion Error**
- Exchange rate errors causing rounding issues
- **Solution:** Check exchange rates and currency conversions

### **6. Orphaned Entries**
- Ledger entries referencing deleted accounts
- **Solution:** Clean up orphaned entries or restore missing accounts

### **7. Balance Sheet Calculation Bug**
- Error in how balance sheet aggregates accounts
- **Solution:** Review balance sheet calculation logic

---

## 📊 **EXPECTED BEHAVIOR**

**In Double-Entry Accounting:**
- Every transaction must have: **Total Debits = Total Credits**
- Balance Sheet must have: **Total Assets = Total Liabilities + Equity**

**If Balance Sheet is out:**
- There's either an unbalanced transaction
- Or a calculation error in balance sheet aggregation

---

## ✅ **NEXT STEPS**

1. **Export Day Book Excel** for recent dates (including 01/20/2026 and surrounding dates)
2. **Review the "Summary" sheet** for unbalanced transactions
3. **Identify the problematic transaction(s)**
4. **Correct the unbalanced transaction(s)** using Accounting > Edit Voucher
5. **Re-check Balance Sheet** after corrections

---

## 🔍 **DETAILED INVESTIGATION**

If the quick actions don't reveal the issue, perform a detailed investigation:

### **Check All Recent Transactions**

1. Export Day Book for each day from 01/14/2026 to 01/20/2026
2. Check each transaction's balance status
3. Look for any transaction with `Is Balanced` = "NO - UNBALANCED"

### **Verify Account Balances**

1. Go to Setup > Chart of Accounts
2. Check each account's balance
3. Verify balances match ledger entries

### **Check Partner Balances**

1. Go to Setup > Business Partners
2. Check customer and supplier balances
3. Verify balances are calculated correctly

### **Review Balance Sheet Logic**

The balance sheet calculation code is in `components/ReportsModuleV2.tsx` (BalanceSheet component). Key areas to verify:

1. **Asset Calculation:** Lines 1487-1584
2. **Liability Calculation:** Lines 1542-1627
3. **Equity Calculation:** Lines 1647-1690
4. **Partner Balance Handling:** Lines 1576-1627

---

## 💡 **RECOMMENDATION**

**Immediate Action:**
1. Export Day Book Excel for date range: 01/14/2026 to 01/20/2026
2. Review the "Summary" sheet for unbalanced transactions
3. If found, correct them using Accounting > Edit Voucher
4. Re-check Balance Sheet

**If no unbalanced transactions found:**
- The issue might be in balance sheet calculation logic
- Or in how partner balances are aggregated
- Check Admin > System Diagnostics for balance recalculation utility

---

**End of Investigation Guide**
