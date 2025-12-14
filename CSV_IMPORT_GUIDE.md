# CSV Import Guide - Required vs Optional Fields

## ✅ REQUIRED FIELDS (Cannot be blank)

### All Entities:
- **id** - Unique identifier (required)
- **name** - Name of the entity (required)

### Entity-Specific Required Fields:

1. **Partners**
   - `type` - Partner type (CUSTOMER, SUPPLIER, etc.)

2. **SubDivisions**
   - `divisionId` - Must reference an existing Division ID

3. **OriginalTypes**
   - `packingType` - Packing type (Bale, Sack, Kg, Box, Bag)
   - `packingSize` - Standard weight in Kg (numeric)

4. **OriginalProducts**
   - `originalTypeId` - Must reference an existing OriginalType ID

5. **Accounts**
   - `type` - Account type (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)

---

## ⚪ OPTIONAL FIELDS (Can be left blank)

### 1. Divisions
- `location` - Location/HQ (can be blank, defaults to empty string)

### 2. SubDivisions
- All fields shown are required (id, name, divisionId)

### 3. OriginalTypes
- All fields shown are required (id, name, packingType, packingSize)

### 4. OriginalProducts
- All fields shown are required (id, name, originalTypeId)

### 5. Categories
- Only `id` and `name` are required (all other fields don't exist)

### 6. Sections
- Only `id` and `name` are required (all other fields don't exist)

### 7. Logos
- Only `id` and `name` are required (all other fields don't exist)

### 8. Warehouses
- `location` - Location/Address (can be blank)

### 9. Items
- `code` - Item code (defaults to id if blank)
- `category` - Category ID/Name (defaults to empty string)
- `section` - Section ID/Name (defaults to empty string)
- `packingType` - Defaults to 'Kg' if blank
- `weightPerUnit` - Defaults to 0 if blank
- `avgCost` - Defaults to 0 if blank
- `salePrice` - Defaults to 0 if blank
- `stockQty` - Defaults to 0 if blank
- `openingStock` - Defaults to 0 if blank

### 10. Partners
- `country` - Country (defaults to empty string)
- `defaultCurrency` - Currency code (defaults to 'USD')
- `balance` - Opening balance (defaults to 0, handled separately)
- `divisionId` - Division ID (optional)
- `subDivisionId` - SubDivision ID (optional)
- `contact` - Contact person (optional)
- `phone` - Phone number (optional)
- `email` - Email address (optional)
- `creditLimit` - Credit limit for customers (optional)
- `taxId` - Tax ID for suppliers/vendors (optional)
- `commissionRate` - Commission rate (optional)
- `parentSupplier` - Parent supplier for sub-suppliers (optional)
- `licenseNumber` - License number (optional)
- `scacCode` - SCAC code (optional)

### 11. Accounts
- `code` - Account code (defaults to id if blank)
- `balance` - Opening balance (defaults to 0)
- `description` - Description (defaults to empty string)
- `currency` - Currency code (defaults to 'USD')

---

## 📝 Summary

**You can leave ANY field blank EXCEPT:**
- `id` and `name` (required for all entities)
- `type` (required for Partners and Accounts)
- `divisionId` (required for SubDivisions)
- `packingType` and `packingSize` (required for OriginalTypes)
- `originalTypeId` (required for OriginalProducts)

**All other fields have defaults or are optional!**

---

## 💡 Tips

1. **Blank cells are OK** - The system will use defaults
2. **Empty strings are OK** - Just leave the cell empty in Excel/CSV
3. **Numeric defaults** - Blank numeric fields default to 0
4. **String defaults** - Blank text fields default to empty string or specified defaults
5. **Validation** - The system will show errors if required fields are missing


