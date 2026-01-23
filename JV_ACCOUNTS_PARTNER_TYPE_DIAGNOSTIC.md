# JV Accounts Partner Type Diagnostic

## 🔍 **ISSUE IDENTIFIED**

The accounts used in your Journal Vouchers are **Partners**, not **Accounts**. The balance sheet calculation only includes Partners with specific PartnerTypes. If these Partners have the wrong type (or are not in the recognized categories), they **will NOT be included in the balance sheet**, causing the discrepancy.

---

## 📋 **ACCOUNTS TO CHECK**

Based on your JV transactions, these are the Partners that need verification:

1. **USMAN INTL AC** (appears in every transaction)
2. **ALI WALI AC**
3. **ETS SAYA AMEEN**
4. **YOUNUS MALI**
5. **SHAHZAD MALAYSIA AC**
6. **ASHRAF JORDEN AC**
7. **AMEEN SENEGAL AC**

---

## 🎯 **BALANCE SHEET INCLUSION RULES**

### **Partners Included in Balance Sheet:**

#### **1. Customers (PartnerType.CUSTOMER)**
- **Positive Balance** → **Assets** (Accounts Receivable / Debtors)
- **Negative Balance** → **Liabilities** (Customer Advances)

#### **2. Suppliers/Vendors/Agents**
- **PartnerType.SUPPLIER**
- **PartnerType.VENDOR**
- **PartnerType.FREIGHT_FORWARDER**
- **PartnerType.CLEARING_AGENT**
- **PartnerType.COMMISSION_AGENT**

**Balance Rules:**
- **Negative Balance** → **Liabilities** (Accounts Payable / Creditors)
- **Positive Balance** → **Assets** (Advances to Suppliers)

**Note:** SUB_SUPPLIER is **EXCLUDED** from balance sheet

#### **3. Partners NOT Included:**
- Any PartnerType not listed above
- Partners with unrecognized types
- These will cause balance sheet discrepancies!

---

## 🔧 **HOW TO CHECK PARTNER TYPES**

### **Method 1: Check in Setup**

1. Go to **Setup > Business Partners**
2. Search for each partner name:
   - USMAN INTL AC
   - ALI WALI AC
   - ETS SAYA AMEEN
   - YOUNUS MALI
   - SHAHZAD MALAYSIA AC
   - ASHRAF JORDEN AC
   - AMEEN SENEGAL AC
3. Check the **"Type"** field for each partner
4. Verify if the type matches their role:
   - If they're suppliers → Should be **SUPPLIER** or **VENDOR**
   - If they're customers → Should be **CUSTOMER**
   - If they're agents → Should be **FREIGHT_FORWARDER**, **CLEARING_AGENT**, or **COMMISSION_AGENT**

### **Method 2: Check Balance Sheet Logic**

The balance sheet code filters partners like this:

```typescript
// Customers (Assets)
const customers = state.partners.filter(p => 
    p.type === PartnerType.CUSTOMER && p.balance > 0
);

// Suppliers (Liabilities)
const negativeSuppliers = state.partners.filter(p => 
    supplierLikeTypes.includes(p.type) && 
    p.type !== PartnerType.SUB_SUPPLIER &&
    p.balance < 0
);

// Supplier Advances (Assets)
const positiveSuppliers = state.partners.filter(p => 
    supplierLikeTypes.includes(p.type) && 
    p.type !== PartnerType.SUB_SUPPLIER &&
    p.balance > 0
);
```

**If a partner's type is NOT in these filters, it won't be included in the balance sheet!**

---

## 🐛 **COMMON ISSUES**

### **Issue 1: Wrong PartnerType**
- Partner is set as **CUSTOMER** but should be **SUPPLIER**
- Partner is set as **SUPPLIER** but should be **VENDOR**
- Partner has an unrecognized type

**Solution:** Change PartnerType in Setup > Business Partners

### **Issue 2: Should Be Account, Not Partner**
- These might be internal accounts (like "USMAN INTL AC") that should be **Accounts** in Chart of Accounts, not Partners

**Solution:** 
- Create these as **Accounts** in Setup > Chart of Accounts
- Set appropriate AccountType (ASSET, LIABILITY, etc.)
- Update JV entries to use Account IDs instead of Partner IDs

### **Issue 3: Missing from Balance Sheet**
- Partner has correct type but balance is 0
- Partner is SUB_SUPPLIER (excluded from balance sheet)
- Partner type is not recognized

**Solution:** Check partner type and balance

---

## ✅ **DIAGNOSTIC CHECKLIST**

For each partner (USMAN INTL AC, ALI WALI AC, etc.):

- [ ] **Check PartnerType:**
  - Is it CUSTOMER, SUPPLIER, VENDOR, or an Agent type?
  - Or is it something else (unrecognized)?

- [ ] **Check Balance:**
  - What is the current balance?
  - Is it positive or negative?

- [ ] **Check Balance Sheet Inclusion:**
  - If CUSTOMER with positive balance → Should appear in Assets (Debtors)
  - If CUSTOMER with negative balance → Should appear in Liabilities (Customer Advances)
  - If SUPPLIER/VENDOR with negative balance → Should appear in Liabilities (Creditors)
  - If SUPPLIER/VENDOR with positive balance → Should appear in Assets (Advances to Suppliers)
  - If type is unrecognized → **WILL NOT APPEAR** (causes discrepancy!)

- [ ] **Verify Should Be Account:**
  - Is this an internal account that should be in Chart of Accounts?
  - Should it be an Account (ASSET/LIABILITY) instead of a Partner?

---

## 🔧 **HOW TO FIX**

### **Fix 1: Change PartnerType**

1. Go to **Setup > Business Partners**
2. Find the partner (e.g., "USMAN INTL AC")
3. Click **Edit**
4. Change **Type** to correct PartnerType:
   - If supplier → **SUPPLIER** or **VENDOR**
   - If customer → **CUSTOMER**
   - If agent → Appropriate agent type
5. **Save**
6. **Recalculate Balance Sheet** (refresh page)

### **Fix 2: Convert Partner to Account**

If these should be Accounts instead of Partners:

1. **Create Account:**
   - Go to **Setup > Chart of Accounts**
   - Click **Add Account**
   - Enter name (e.g., "USMAN INTL AC")
   - Set **AccountType**:
     - If it's money owed to you → **ASSET**
     - If it's money you owe → **LIABILITY**
   - Set **Code** (e.g., "2010")
   - **Save**

2. **Update JV Entries:**
   - Go to **Accounting > View/Update Vouchers**
   - Find JV entries using the old Partner ID
   - **Edit** each JV
   - Change account selection from Partner to the new Account
   - **Save**

3. **Delete Old Partner** (optional):
   - After all JVs are updated
   - Go to **Setup > Business Partners**
   - Delete the old partner entry

### **Fix 3: Verify Balance Sheet Calculation**

After fixing PartnerTypes:

1. Go to **Reports > Balance Sheet**
2. Check if partners now appear in correct sections:
   - Assets (if positive balance)
   - Liabilities (if negative balance)
3. Verify **Total Assets = Total Liabilities + Equity**

---

## 📊 **EXPECTED BEHAVIOR**

### **If Partner is SUPPLIER/VENDOR:**
- **Negative Balance** (we owe them) → **Liabilities** (Creditors)
- **Positive Balance** (they owe us - advance) → **Assets** (Advances to Suppliers)

### **If Partner is CUSTOMER:**
- **Positive Balance** (they owe us) → **Assets** (Debtors)
- **Negative Balance** (we owe them - advance) → **Liabilities** (Customer Advances)

### **If Partner Type is Unrecognized:**
- **NOT INCLUDED** in balance sheet → **CAUSES DISCREPANCY!**

---

## 🎯 **NEXT STEPS**

1. **Check Partner Types:**
   - Go to Setup > Business Partners
   - Verify PartnerType for each JV account
   - Note any with unrecognized types

2. **Check Balances:**
   - Note current balance for each partner
   - Verify if positive or negative

3. **Verify Balance Sheet Inclusion:**
   - Check if partners appear in Balance Sheet
   - If missing, that's the cause of discrepancy!

4. **Fix PartnerTypes:**
   - Change to correct PartnerType
   - Or convert to Account if appropriate

5. **Recalculate:**
   - Refresh Balance Sheet
   - Verify it balances

---

## 💡 **RECOMMENDATION**

Based on the account names (ending with "AC" - likely "Account"), these might be **internal accounts** that should be:

1. **Accounts** in Chart of Accounts (not Partners)
2. Set as **LIABILITY** accounts (if you owe them) or **ASSET** accounts (if they owe you)

**Action:**
1. Check if "USMAN INTL AC" and others should be Accounts
2. If yes, create them as Accounts and update JV entries
3. This will ensure they're properly included in the balance sheet

---

**End of Diagnostic Guide**
