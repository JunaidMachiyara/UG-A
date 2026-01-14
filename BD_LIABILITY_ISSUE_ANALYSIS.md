# BD Entry Issue: Both Accounts are Liabilities

## Problem Identified

When you create a BD entry to DECREASE a liability account (MOHAMMAD), and the Discrepancy account is also a LIABILITY:

**BD Entry Created:**
- Debit: MOHAMMAD (liability) → $32,367.46
- Credit: Discrepancy (liability) → $32,367.46

**Balance Calculations:**
- For liability accounts: `balance = Credit - Debit`
- MOHAMMAD: Debit $32,367.46 → balance decreases by $32,367.46
- Discrepancy: Credit $32,367.46 → balance increases by $32,367.46

**Balance Sheet Calculation:**
- Line 1688: `regularLiabilitiesTotal = sum(Math.abs(all liability balances))`
- Line 1700: `discrepancyAdjustment = discrepancyBalance` (actual balance, not abs)
- Line 1708: `totalLiabilities = regularLiabilitiesTotal + ... + discrepancyAdjustment`

## The Issue

If MOHAMMAD had a **NEGATIVE balance** before the BD entry:

**Before BD Entry:**
- MOHAMMAD balance: -$32,367.46 (negative)
- Math.abs(-$32,367.46) = $32,367.46 in regularLiabilitiesTotal
- Discrepancy balance: $0
- discrepancyAdjustment: $0

**After BD Entry (Debit MOHAMMAD $32,367.46):**
- MOHAMMAD balance: -$32,367.46 - $32,367.46 = **-$64,734.92** (more negative!)
- Math.abs(-$64,734.92) = $64,734.92 in regularLiabilitiesTotal
- Change: +$32,367.46 (INCREASE in liabilities!)

**After BD Entry (Credit Discrepancy $32,367.46):**
- Discrepancy balance: $0 + $32,367.46 = $32,367.46
- discrepancyAdjustment: $32,367.46
- Change: +$32,367.46

**Total Change:**
- regularLiabilitiesTotal: +$32,367.46 (because MOHAMMAD became more negative)
- discrepancyAdjustment: +$32,367.46
- **Total: +$64,734.92** (DOUBLE!)

## Root Cause

The problem is that when a liability account has a **negative balance**, using `Math.abs()` in the Balance Sheet causes:
- Negative balance (-$32,367.46) shows as positive (+$32,367.46)
- When you Debit it (making it more negative), Math.abs() makes it show as even MORE positive
- This creates a double-counting effect

## Solution

The BD entry logic for DECREASE on liability accounts should be **REVERSED** when the discrepancy account is also a liability:

**Current Logic (WRONG for liability-to-liability):**
- Debit MOHAMMAD (decreases liability)
- Credit Discrepancy (increases liability)
- Net effect: Both sides increase in Balance Sheet (double-counting)

**Correct Logic (for liability-to-liability DECREASE):**
- Credit MOHAMMAD (increases liability balance, but we want to decrease it, so this is wrong)
- OR: Debit Discrepancy (decreases discrepancy)
- OR: Use a different account type for the offset

Actually, the real issue is: **You cannot DECREASE a liability using another liability account** without causing balance sheet issues when Math.abs() is used.

## Recommended Fix

When DECREASING a liability account using BD:
- If Discrepancy is LIABILITY: Use EQUITY account (Owner's Capital) instead
- OR: Change the logic to Debit Discrepancy (decrease discrepancy) instead of Credit
