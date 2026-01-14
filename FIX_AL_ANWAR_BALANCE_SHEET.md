# Fix Al Anwar Factory Balance Sheet - Step-by-Step Guide

## ⚠️ **IMPORTANT: DO NOT DELETE DATA**
Deleting all data for Al Anwar factory will cause permanent data loss. Use the tools below to fix the balance sheet instead.

---

## 📋 **Step 1: Identify the Problem**

### **Option A: Use Admin Module Diagnostic (Easiest)**

1. **Switch to Al Anwar Factory**
   - Click factory selector in top-right
   - Select "AL ANWAR"

2. **Run Diagnostic**
   - Go to: **Admin** → Scroll to "Diagnostic: What System Missed"
   - Click: **"Run Diagnostic: What System Missed"**
   - Review the report for:
     - ❌ Purchases without ledger entries
     - ⚠️ Unbalanced transactions (debits ≠ credits)
     - ❌ Sales invoices without ledger entries
     - 💰 Balance Discrepancy account breakdown
     - ⚠️ Missing accounts/partners

3. **Note the Issues**
   - Write down which transactions are unbalanced
   - Note the exact discrepancy amount
   - Check if purchases are missing ledger entries

### **Option B: Use Diagnostic Script (Advanced)**

1. **Find Al Anwar Factory ID**
   - Open browser console (F12)
   - Switch to Al Anwar factory
   - Look for factory ID in console logs
   - OR check Firebase Console → `factories` collection

2. **Run Script**
   ```bash
   node scripts/check-balance-discrepancy.js <AL_ANWAR_FACTORY_ID>
   ```

3. **Review Output**
   - Shows exact discrepancy amount
   - Lists all account balances
   - Shows Assets vs Liabilities + Equity

---

## 🔧 **Step 2: Fix the Issues**

### **Fix 1: Missing Purchase Ledger Entries**

If diagnostic shows purchases without ledger entries:

1. Go to: **Admin** → "Fix Missing Purchase Ledger Entries"
2. Click: **"Fix Missing Purchase Ledger Entries"** button
3. System will:
   - Find purchases without ledger entries
   - Create balanced accounting entries
   - Fix the balance sheet automatically

### **Fix 2: Unbalanced Transactions**

If diagnostic shows unbalanced transactions:

1. Go to: **Accounting** → **General Ledger**
2. Search for the unbalanced transaction ID (from diagnostic)
3. **Option A: Delete the transaction**
   - Click "X" button next to the transaction
   - Confirm deletion
   - Re-enter the transaction correctly

4. **Option B: Edit the transaction**
   - Click "Edit" button
   - Adjust debits/credits to balance
   - Save

### **Fix 3: Balance Sheet Discrepancy**

If balance sheet is still out of balance after fixes above:

1. **Calculate Discrepancy Amount**
   - Go to: **Reports** → **Financial Statements** → **Balance Sheet**
   - Note: `Total Assets` vs `Total Liabilities + Equity`
   - Difference = Discrepancy Amount

2. **Create Balance Discrepancy Voucher**
   - Go to: **Accounting** → **Create Voucher**
   - Select: **"BD"** (Balance Discrepancy)
   - **Select Account/Partner:**
     - If Assets > Liabilities + Equity: Select an Asset account to DECREASE
     - If Assets < Liabilities + Equity: Select an Asset account to INCREASE
   - **Adjustment Type:**
     - If Assets > Liabilities + Equity: Choose **"DECREASE"**
     - If Assets < Liabilities + Equity: Choose **"INCREASE"**
   - **Amount:** Enter the discrepancy amount
   - **Reason:** "Balance Sheet Correction - Al Anwar Factory"
   - **Date:** Today's date
   - Click **"Post Voucher"**

3. **Alternative: Adjust Multiple Accounts**
   - If you know which accounts are wrong, adjust them individually
   - Use Balance Discrepancy (BD) for each account
   - Total adjustments should equal the discrepancy

---

## ✅ **Step 3: Verify the Fix**

1. **Check Balance Sheet**
   - Go to: **Reports** → **Financial Statements** → **Balance Sheet**
   - Verify: `Total Assets = Total Liabilities + Equity`
   - If balanced: ✅ **SUCCESS!**

2. **Re-run Diagnostic**
   - Go to: **Admin** → "Run Diagnostic: What System Missed"
   - Should show: ✅ **NO ISSUES FOUND!**

3. **Check General Ledger**
   - Go to: **Accounting** → **General Ledger**
   - Verify all transactions are balanced
   - Check Balance Discrepancy account entries

---

## 🎯 **Common Scenarios**

### **Scenario 1: Missing Purchase Entries**
- **Symptom:** Diagnostic shows purchases without ledger entries
- **Fix:** Use "Fix Missing Purchase Ledger Entries" utility
- **Result:** Balance sheet should balance automatically

### **Scenario 2: Unbalanced Transactions**
- **Symptom:** Diagnostic shows unbalanced transactions
- **Fix:** Delete or edit unbalanced transactions
- **Result:** Balance sheet should balance after fixing

### **Scenario 3: General Imbalance**
- **Symptom:** Balance sheet out of balance, but no obvious issues
- **Fix:** Use Balance Discrepancy (BD) voucher to adjust
- **Result:** Balance sheet balances, discrepancy goes to Discrepancy account

### **Scenario 4: Multiple Issues**
- **Symptom:** Multiple problems found
- **Fix:** Fix in order:
  1. Missing purchase entries
  2. Unbalanced transactions
  3. Balance sheet discrepancy
- **Result:** Balance sheet should balance after all fixes

---

## 📞 **Need Help?**

If the balance sheet is still out of balance after following these steps:

1. **Run Diagnostic Again**
   - Check for new issues
   - Note any remaining problems

2. **Check Specific Accounts**
   - Go to: **Reports** → **General Ledger**
   - Filter by account
   - Check for unusual entries

3. **Review Recent Transactions**
   - Check Day Book for recent entries
   - Verify all transactions are balanced

---

## ⚠️ **IMPORTANT REMINDERS**

- ✅ **DO NOT DELETE DATA** - Use the tools to fix instead
- ✅ **Always verify** after making changes
- ✅ **Keep notes** of what you fixed
- ✅ **Use Balance Discrepancy** for final adjustments
- ✅ **Re-run diagnostic** to confirm fixes

---

## 🔄 **Quick Reference**

| Issue | Tool | Location |
|-------|------|----------|
| Missing Purchase Entries | Fix Missing Purchase Ledger Entries | Admin Module |
| Unbalanced Transactions | Delete/Edit Transaction | Accounting → General Ledger |
| Balance Sheet Discrepancy | Balance Discrepancy (BD) | Accounting → Create Voucher → BD |
| Diagnostic Check | Run Diagnostic | Admin Module |

---

**Last Updated:** 2026-01-10
**For:** Al Anwar Factory Balance Sheet Fix
