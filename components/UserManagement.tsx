import React, { useState, useEffect } from 'react';
import { User, UserRole, Factory, PermissionModule } from '../types';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Edit2, Save, X, Key, Shield, CheckSquare } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export const UserManagement: React.FC = () => {
    const { currentUser, refreshUser } = useAuth();
    
    // Security: Only Super Admin can access this page
    if (currentUser?.role !== UserRole.SUPER_ADMIN) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-red-600">
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p>Only Super Administrators can access User Management.</p>
            </div>
        );
    }
    const [users, setUsers] = useState<User[]>([]);
    const [factories, setFactories] = useState<Factory[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        displayName: '',
        role: UserRole.DATA_ENTRY_INVENTORY,
        factoryId: '',
        allowedModules: [] as PermissionModule[],
        isActive: true
    });

    useEffect(() => {
        loadUsers();
        loadFactories();
    }, []);

    const loadUsers = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'users'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setUsers(data);
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    };

    const loadFactories = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'factories'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Factory));
            setFactories(data.filter(f => f.isActive));
        } catch (error) {
            console.error('Failed to load factories:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const userData = {
                ...formData,
                ...(editingId ? { updatedDate: new Date().toISOString() } : { createdDate: new Date().toISOString() })
            };

            if (editingId) {
                // Don't update password if it's empty (editing mode)
                const updateData: any = { ...userData };
                if (!formData.password) {
                    delete updateData.password;
                }
                await updateDoc(doc(db, 'users', editingId), updateData);
                
                // If we updated the currently logged-in user, refresh their session
                if (currentUser && editingId === currentUser.id) {
                    await refreshUser();
                    alert('Your permissions have been updated. Please refresh the page to see the changes.');
                }
            } else {
                await addDoc(collection(db, 'users'), userData);
            }

            await loadUsers();
            resetForm();
        } catch (error) {
            console.error('Failed to save user:', error);
            alert('Failed to save user');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (user: User) => {
        setFormData({
            username: user.username,
            password: '', // Don't show existing password
            displayName: user.displayName,
            role: user.role,
            factoryId: user.factoryId,
            allowedModules: user.allowedModules || [],
            isActive: user.isActive
        });
        setEditingId(user.id);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            username: '',
            password: '',
            displayName: '',
            role: UserRole.DATA_ENTRY_INVENTORY,
            factoryId: '',
            allowedModules: [],
            isActive: true
        });
        setEditingId(null);
        setShowForm(false);
    };

    const getRoleName = (role: UserRole): string => {
        const roleNames = {
            [UserRole.SUPER_ADMIN]: 'Super Admin',
            [UserRole.FACTORY_ADMIN]: 'Factory Admin',
            [UserRole.MODULE_USER]: 'Module User',
            [UserRole.DATA_ENTRY_INVENTORY]: 'Data Entry (Inventory)',
            [UserRole.DATA_ENTRY_ACCOUNTING]: 'Data Entry (Accounting)'
        };
        return roleNames[role];
    };

    const getRoleBadgeColor = (role: UserRole): string => {
        const colors = {
            [UserRole.SUPER_ADMIN]: 'bg-purple-100 text-purple-800',
            [UserRole.FACTORY_ADMIN]: 'bg-blue-100 text-blue-800',
            [UserRole.MODULE_USER]: 'bg-green-100 text-green-800',
            [UserRole.DATA_ENTRY_INVENTORY]: 'bg-amber-100 text-amber-800',
            [UserRole.DATA_ENTRY_ACCOUNTING]: 'bg-cyan-100 text-cyan-800'
        };
        return colors[role];
    };

    const toggleModule = (module: PermissionModule) => {
        setFormData(prev => ({
            ...prev,
            allowedModules: prev.allowedModules.includes(module)
                ? prev.allowedModules.filter(m => m !== module)
                : [...prev.allowedModules, module]
        }));
    };

    const availableModules = [
        { value: PermissionModule.DASHBOARD, label: 'Dashboard' },
        { value: PermissionModule.DATA_ENTRY, label: 'Data Entry' },
        { value: PermissionModule.SALES, label: 'Sales' },
        { value: PermissionModule.PURCHASES, label: 'Purchases' },
        { value: PermissionModule.PRODUCTION, label: 'Production' },
        { value: PermissionModule.ACCOUNTING, label: 'Accounting' },
        { value: PermissionModule.LOGISTICS, label: 'Logistics' },
        { value: PermissionModule.HR, label: 'HR & Fleet' },
        { value: PermissionModule.REPORTS, label: 'Reports' },
        { value: PermissionModule.CUSTOMS, label: 'Customs' },
        { value: PermissionModule.SETUP, label: 'Setup' },
        { value: PermissionModule.POSTING, label: 'Posting' },
        { value: PermissionModule.OFFLOADING, label: 'Container Offloading' },
        { value: PermissionModule.CHAT, label: 'Chat' }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users size={32} />
                        <div>
                            <h2 className="text-2xl font-bold">User Management</h2>
                            <p className="text-blue-100">Manage user accounts and permissions</p>
                        </div>
                    </div>
                    {!showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Add User
                        </button>
                    )}
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <Shield size={20} />
                        {editingId ? 'Edit User' : 'Create New User'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Username (Login ID) *
                                </label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., admin, user01"
                                    required
                                    disabled={!!editingId} // Can't change username when editing
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Password {editingId && '(leave blank to keep current)'}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Key className="text-gray-400" size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter password"
                                        required={!editingId}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Display Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.displayName}
                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., John Smith"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Role *
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                >
                                    <option value={UserRole.DATA_ENTRY_INVENTORY}>Data Entry (Inventory)</option>
                                    <option value={UserRole.DATA_ENTRY_ACCOUNTING}>Data Entry (Accounting)</option>
                                    <option value={UserRole.MODULE_USER}>Module User</option>
                                    <option value={UserRole.FACTORY_ADMIN}>Factory Admin</option>
                                    <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Factory Assignment *
                                </label>
                                <select
                                    value={formData.factoryId}
                                    onChange={(e) => setFormData({ ...formData, factoryId: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    required
                                >
                                    <option value="">Select Factory</option>
                                    {factories.map(factory => (
                                        <option key={factory.id} value={factory.id}>
                                            {factory.name} ({factory.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Status
                                </label>
                                <select
                                    value={formData.isActive ? 'active' : 'inactive'}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        {/* Module Selection for MODULE_USER */}
                        {formData.role === UserRole.MODULE_USER && (
                            <div className="col-span-2 bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                <label className="block text-sm font-semibold text-green-900 mb-3">
                                    <div className="flex items-center gap-2">
                                        <CheckSquare size={18} />
                                        Select Allowed Modules (Module User Access)
                                    </div>
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {availableModules.map(module => (
                                        <label
                                            key={module.value}
                                            className="flex items-center gap-2 p-2 bg-white border border-green-200 rounded hover:bg-green-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.allowedModules.includes(module.value)}
                                                onChange={() => toggleModule(module.value)}
                                                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                            />
                                            <span className="text-sm text-gray-700">{module.label}</span>
                                        </label>
                                    ))}
                                </div>
                                {formData.allowedModules.length === 0 && (
                                    <p className="text-xs text-red-600 mt-2">⚠️ Please select at least one module</p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 col-span-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                {saving ? 'Saving...' : (editingId ? 'Update User' : 'Create User')}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                disabled={saving}
                                className="px-6 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 flex items-center gap-2"
                            >
                                <X size={18} />
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* User List */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Username</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Display Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Factory</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        No users found. Click "Add User" to create one.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => {
                                    const factory = factories.find(f => f.id === user.factoryId);
                                    return (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-semibold text-blue-600">{user.username}</span>
                                            </td>
                                            <td className="px-6 py-4 font-medium">{user.displayName}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${getRoleBadgeColor(user.role)}`}>
                                                    {getRoleName(user.role)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-semibold">{factory?.name || 'Unknown'}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.isActive ? (
                                                    <span className="text-green-600 font-semibold">Active</span>
                                                ) : (
                                                    <span className="text-gray-500">Inactive</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleEdit(user)}
                                                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                                                >
                                                    <Edit2 size={16} />
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h4 className="font-bold text-blue-900 mb-2">Role Permissions:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <strong>Super Admin:</strong> Full access to all factories, can switch between them, create users/factories</li>
                    <li>• <strong>Factory Admin:</strong> Full access to one factory, can edit/delete, reset data (no user/factory management)</li>
                    <li>• <strong>Module User:</strong> Access only to selected modules (Logistics, HR, Sales, etc.) in their factory</li>
                    <li>• <strong>Data Entry (Inventory):</strong> Sales, Purchase, Production, Logistics entry only (cannot delete)</li>
                    <li>• <strong>Data Entry (Accounting):</strong> Accounting vouchers and ledger entry only (cannot delete)</li>
                </ul>
                <div className="mt-3 pt-3 border-t border-blue-300">
                    <p className="text-xs text-blue-700">
                        <strong>💡 Note:</strong> When you update a user's permissions, they need to refresh the page or log out and log back in for the changes to take effect.
                    </p>
                </div>
            </div>
        </div>
    );
};
