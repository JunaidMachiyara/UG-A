# Employee Accounts Generation Guide

This guide explains how to automatically generate 700 Employee Advance Accounts (codes 1400-2099) with parent account 1130.

## Two Methods Available

### Method 1: CSV Import (Recommended for Bulk Editing)

This method generates a CSV file that you can edit in Excel/LibreOffice to add actual employee names before importing.

#### Steps:

1. **Generate the CSV template:**
   ```bash
   npm run generate:employee-accounts-csv
   ```
   This creates `scripts/employee-accounts-template.csv` with 700 placeholder accounts.

2. **Edit the CSV file:**
   - Open `scripts/employee-accounts-template.csv` in Excel/LibreOffice
   - Replace "Employee 001", "Employee 002", etc. with actual employee names
   - Example: Change `"Employee Advance - Employee 001"` to `"Employee Advance - John Smith"`
   - Save the file

3. **Import via Admin Panel:**
   - Go to: **Admin > Import/Export**
   - Select: **Accounts** from the dropdown
   - Click: **Choose File** and select `scripts/employee-accounts-template.csv`
   - Click: **Import Data**
   - The system will create all 700 accounts with parent account 1130

#### CSV Format:
```csv
code,name,type,balance,currency,parentAccountCode
1400,"Employee Advance - Employee 001",ASSET,0,USD,1130
1401,"Employee Advance - Employee 002",ASSET,0,USD,1130
...
```

---

### Method 2: Direct Firebase Import (Faster, but requires manual name updates)

This method directly creates the accounts in Firebase, but you'll need to update employee names manually in the UI.

#### Prerequisites:
- Firebase Admin SDK must be configured
- `firebase-service-account.json` must exist in project root
- You need your Factory ID

#### Steps:

1. **Find your Factory ID:**
   - Open the app in browser
   - Check the browser console or Firebase console
   - Or check the URL/state when logged in

2. **Run the generation script:**
   ```bash
   npm run generate:employee-accounts <FACTORY_ID>
   ```
   Example:
   ```bash
   npm run generate:employee-accounts factory-abc123
   ```

3. **Update employee names:**
   - Go to: **Setup > Chart of Accounts**
   - Find accounts like "1400 - Employee Advance - Employee 001"
   - Edit each account name to match actual employee names
   - Or use CSV export/import to bulk update names

---

## Account Details

- **Code Range:** 1400-2099 (700 accounts)
- **Parent Account:** 1130 - Employee Advances
- **Account Type:** ASSET
- **Default Balance:** 0
- **Currency:** USD

## Notes

- Both methods will skip accounts that already exist (by code)
- The CSV import now supports `parentAccountCode` column
- You can mix both methods: create some manually, then use CSV for the rest
- After creating accounts, link them to employees in HR module (the system will auto-link when you create employees)

## Troubleshooting

### "Parent account 1130 not found"
- Make sure account "1130 - Employee Advances" exists in your Chart of Accounts
- Create it manually in Setup > Chart of Accounts if missing

### "Account code already exists"
- The script will skip existing accounts automatically
- Check which codes are already used in Setup > Chart of Accounts

### CSV Import fails
- Make sure the CSV file is saved as UTF-8 encoding
- Check that all required columns are present
- Verify parentAccountCode is "1130" for all rows
