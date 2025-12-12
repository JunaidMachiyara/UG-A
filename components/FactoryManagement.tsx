import React, { useState, useEffect } from 'react';
import { Factory, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { Building2, Plus, Edit2, Save, X, CheckCircle, XCircle } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export const FactoryManagement: React.FC = () => {
    const { refreshFactories, currentUser } = useAuth();
    
    // Security: Only Super Admin can access this page
    if (currentUser?.role !== UserRole.SUPER_ADMIN) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-red-600">
                <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                <p>Only Super Administrators can access Factory Management.</p>
            </div>
        );
    }
    const [factories, setFactories] = useState<Factory[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        location: '',
        isActive: true
    });

    useEffect(() => {
        loadFactories();
    }, []);

    const loadFactories = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'factories'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Factory));
            setFactories(data);
        } catch (error) {
            console.error('Failed to load factories:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (editingId) {
                // Update existing factory
                await updateDoc(doc(db, 'factories', editingId), {
                    ...formData,
                    updatedDate: new Date().toISOString()
                });
            } else {
                // Create new factory
                await addDoc(collection(db, 'factories'), {
                    ...formData,
                    createdDate: new Date().toISOString()
                });
            }

            await loadFactories();
            await refreshFactories();
            resetForm();
        } catch (error) {
            console.error('Failed to save factory:', error);
            alert('Failed to save factory');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (factory: Factory) => {
        setFormData({
            name: factory.name,
            code: factory.code,
            location: factory.location,
            isActive: factory.isActive
        });
        setEditingId(factory.id);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            code: '',
            location: '',
            isActive: true
        });
        setEditingId(null);
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Building2 size={32} />
                        <div>
                            <h2 className="text-2xl font-bold">Factory Management</h2>
                            <p className="text-indigo-100">Manage factory locations</p>
                        </div>
                    </div>
                    {!showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Add Factory
                        </button>
                    )}
                </div>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white rounded-lg border-2 border-indigo-200 p-6">
                    <h3 className="font-bold text-lg mb-4">
                        {editingId ? 'Edit Factory' : 'Add New Factory'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Factory Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g., MAAZ, TALHA, AL ANWAR"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Factory Code *
                                </label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase"
                                    placeholder="e.g., MAZ, TLH, ANW"
                                    maxLength={5}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Location *
                                </label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="e.g., Dubai, Sharjah"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Status
                                </label>
                                <select
                                    value={formData.isActive ? 'active' : 'inactive'}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                {saving ? 'Saving...' : (editingId ? 'Update Factory' : 'Create Factory')}
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

            {/* Factory List */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Factory Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {factories.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No factories found. Click "Add Factory" to create one.
                                    </td>
                                </tr>
                            ) : (
                                factories.map((factory) => (
                                    <tr key={factory.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-indigo-600">{factory.code}</span>
                                        </td>
                                        <td className="px-6 py-4 font-semibold">{factory.name}</td>
                                        <td className="px-6 py-4 text-gray-600">{factory.location}</td>
                                        <td className="px-6 py-4">
                                            {factory.isActive ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                                                    <CheckCircle size={14} />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
                                                    <XCircle size={14} />
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleEdit(factory)}
                                                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                                            >
                                                <Edit2 size={16} />
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
