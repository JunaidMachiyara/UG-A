# Multi-Factory Authentication System

## 🎉 Phase 1 Complete!

Your UG-A inventory app now supports multiple factories with role-based access control.

---

## 🚀 First Time Setup

1. **Start the app** - Run `npm run dev`
2. **Initial Setup Wizard** will appear automatically
3. **Click "Initialize System"** to create:
   - 3 Factories: MAAZ, TALHA, AL ANWAR
   - 1 Super Admin user

4. **Default Login Credentials:**
   ```
   Username: admin
   Password: admin123
   ```
   **⚠️ CHANGE THIS PASSWORD IMMEDIATELY!**

---

## 👥 User Roles

### Super Admin
- **Access:** All factories (can switch between them)
- **Permissions:** Full access to everything
- **Can:** Create users, manage factories, delete data

### Factory Admin
- **Access:** One specific factory only
- **Permissions:** Full access to assigned factory
- **Can:** Edit/delete with password confirmation

### Division User
- **Access:** Specific divisions within a factory
- **Permissions:** View-only access
- **Can:** View data, generate reports

### Data Entry (Inventory)
- **Access:** One factory
- **Permissions:** Sales, Purchase, Production modules
- **Cannot:** Delete transactions

### Data Entry (Accounting)
- **Access:** One factory
- **Permissions:** Accounting, Ledger, Vouchers
- **Cannot:** Delete transactions

---

## 🏭 Managing Factories

**Access:** Admin → Factories (Super Admin only)

### Add New Factory:
1. Click "Add Factory"
2. Enter:
   - Factory Name (e.g., "NEW FACTORY")
   - Factory Code (e.g., "NFT")
   - Location (e.g., "Abu Dhabi, UAE")
3. Click "Create Factory"

### Edit Factory:
- Click "Edit" next to any factory
- Update details
- Save changes

---

## 👨‍💼 Managing Users

**Access:** Admin → Users (Super Admin only)

### Create New User:
1. Click "Add User"
2. Fill in:
   - **Username:** Login ID (e.g., "john.doe")
   - **Password:** Secure password
   - **Display Name:** Full name
   - **Role:** Select appropriate role
   - **Factory Assignment:** Choose factory
   - **Status:** Active/Inactive
3. Click "Create User"

### Edit User:
- Click "Edit" next to any user
- Update details (leave password blank to keep current)
- Save changes

---

## 🔐 How It Works

### Login Process:
1. User enters username + password
2. System validates credentials
3. Loads user's assigned factory
4. Shows only data for that factory

### Super Admin Benefits:
- See data from all factories
- Switch between factories using dropdown in sidebar
- Current factory shown in header badge
- Can manage users and factories

### Automatic Data Tagging:
- When a user creates any record (sales, purchase, etc.)
- System **automatically** adds `factoryId` field
- No manual selection needed
- Data is filtered by factory on load

---

## 📊 What's Been Implemented

✅ Login system (username + password, no email)
✅ Factory management (MAAZ, TALHA, AL ANWAR + new)
✅ User management with roles
✅ Role-based permissions
✅ Factory switcher for Super Admin
✅ Auto-tagging with factoryId (ready for Phase 2)
✅ Initial setup wizard
✅ Session persistence (stays logged in)

---

## 🔄 Next Steps (Phase 2)

These will be implemented when you're ready:

1. **Auto-Filter Data by Factory**
   - Dashboard shows only current factory data
   - Reports filtered by factory
   - All queries filtered automatically

2. **Migration Tool**
   - Add factoryId to existing data
   - Assign records to specific factories

3. **Advanced Permissions**
   - Division-level access
   - Custom permission sets
   - Password-protected delete for Factory Admins

---

## 🔒 Security Notes

1. **Change default admin password immediately!**
2. **Firebase API keys are client-side** - safe to expose
3. **Security enforced by Firestore Rules** (not by hiding keys)
4. **Sessions stored in localStorage** - logout when done

---

## 🆘 Troubleshooting

### Can't login?
- Check username spelling (case-insensitive)
- Verify password
- Check browser console (F12) for errors

### Don't see factories?
- Run initial setup wizard
- Check Firebase console for 'factories' collection

### Super Admin can't switch factories?
- Ensure user role is 'SUPER_ADMIN'
- Check that multiple factories exist

---

## 📝 Technical Details

**Files Added:**
- `/context/AuthContext.tsx` - Authentication logic
- `/components/Login.tsx` - Login screen
- `/components/FactoryManagement.tsx` - Factory CRUD
- `/components/UserManagement.tsx` - User CRUD
- `/components/InitialSetup.tsx` - Setup wizard

**Files Modified:**
- `/types.ts` - Added Factory, User, Role types
- `/App.tsx` - Auth routing
- `/components/Layout.tsx` - Factory indicator, logout
- `/components/AdminModule.tsx` - Quick links

**Firebase Collections:**
- `factories` - Factory master data
- `users` - User credentials + assignments

---

**Ready to use! Login with admin/admin123 to get started! 🎉**
