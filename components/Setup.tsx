
import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { useData } from '../context/DataContext';
import { Plus, Trash2, Edit2, Search, ChevronDown, ChevronUp, Upload, FileSpreadsheet, Users, Building, Package, CreditCard, Briefcase, Calendar, Box, Layers, Tag, Grid, X, Download } from 'lucide-react';
import { PartnerType, AccountType, PackingType } from '../types';
import { EXCHANGE_RATES, INITIAL_ACCOUNTS } from '../constants';
import { EntitySelector } from './EntitySelector';

// --- Types for Generic CRUD ---

export interface SelectOption {
    label: string;
    value: string | number;
}

export interface FieldDef {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'date';
    // Options can be simple strings or {label, value} objects. Function receives all data AND current form data for filtering.
    options?: (string | SelectOption)[] | ((data: any[], formData: any) => (string | SelectOption)[]); 
    required?: boolean;
    defaultValue?: any | ((data: any[]) => any); 
    placeholder?: string;
    readOnly?: boolean; 
    compute?: (formData: any, allData: any[]) => any; 
    hidden?: (formData: any) => boolean;
    disabled?: boolean | ((formData: any) => boolean); // Support disabled condition
}

export interface ColumnDef {
    header: string;
    key: string;
    render?: (row: any) => React.ReactNode;
}

export interface CrudConfig {
    title: string;
    entityKey: string;
    columns: ColumnDef[];
    fields: FieldDef[];
    onSave: (data: any) => void;
    onUpdate?: (id: string, data: any) => void | Promise<void>;
    onDelete: (id: string) => void;
}

// --- Generic Form Component (Exported for Reuse) ---

export const GenericForm: React.FC<{ 
    config: CrudConfig; 
    data: any[]; 
    onCancel: () => void; 
    onSuccess: () => void;
    initialOverrides?: any; // NEW: Allow pre-filling fields
}> = ({ config, data, onCancel, onSuccess, initialOverrides }) => {
    // Use ref to track the original ID from initialOverrides
    const originalIdRef = React.useRef<string | undefined>(initialOverrides?.id);
    
    const [formData, setFormData] = useState<any>(() => {
        // Calculate default values dynamically on mount
        const initialData: any = {};
        config.fields.forEach(field => {
            if (field.defaultValue !== undefined) {
                if (typeof field.defaultValue === 'function') {
                    initialData[field.name] = field.defaultValue(data);
                } else {
                    initialData[field.name] = field.defaultValue;
                }
            }
        });
        // Apply overrides - CRITICAL: Preserve the ID when editing
        if (initialOverrides) {
            console.log('📝 Initializing form with overrides:', initialOverrides.id ? `EDIT mode (ID: ${initialOverrides.id})` : 'NEW mode', initialOverrides);
            Object.assign(initialData, initialOverrides);
            // Ensure ID is always preserved when editing - CRITICAL FIX
            if (initialOverrides.id) {
                initialData.id = initialOverrides.id;
                console.log('✅ ID preserved in formData:', initialData.id);
            } else {
                console.log('⚠️ No ID in initialOverrides - this is a NEW entry');
            }
        } else {
            console.log('📝 Initializing form for NEW entry (no overrides)');
        }
        console.log('📋 Final initialData:', initialData);
        return initialData;
    });

    // CRITICAL: Preserve ID when initialOverrides changes (e.g., when editing)
    useEffect(() => {
        if (initialOverrides?.id && formData.id !== initialOverrides.id) {
            console.log('🔄 Restoring ID from initialOverrides:', initialOverrides.id);
            setFormData(prev => ({ ...prev, id: initialOverrides.id }));
        }
    }, [initialOverrides?.id]);

    const handleChange = (fieldName: string, value: any) => {
        let updatedData = { ...formData, [fieldName]: value };

        // CRITICAL: Always preserve the ID if it exists
        if (formData.id) {
            updatedData.id = formData.id;
        } else if (originalIdRef.current) {
            updatedData.id = originalIdRef.current;
        }

        // Process computed fields
        config.fields.forEach(field => {
            if (field.compute) {
                updatedData[field.name] = field.compute(updatedData, data);
            }
        });

        setFormData(updatedData);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // CRITICAL CHECK: If we have original ID but formData lost it, restore it
        if (originalIdRef.current && !formData.id) {
            console.warn('⚠️ ID was lost from formData, restoring from originalIdRef:', originalIdRef.current);
            const restoredFormData = { ...formData, id: originalIdRef.current };
            setFormData(restoredFormData);
            // Use the restored data for the rest of the function
            const finalFormData = restoredFormData;
            
            // Continue with validation and save using restored data
            for (const field of config.fields) {
                const isHidden = field.hidden ? field.hidden(finalFormData) : false;
                if (!isHidden && field.required && !finalFormData[field.name]) {
                    alert(`${field.label} is required`);
                    return;
                }
            }
            
            // Use finalFormData for the rest of the logic
            if (finalFormData.id && config.onUpdate) {
                const existingEntity = data.find((item: any) => item.id === finalFormData.id);
                if (!existingEntity) {
                    alert(`Error: Cannot find entity with ID ${finalFormData.id}. This might be a duplicate.`);
                    return;
                }
                try {
                    await config.onUpdate(finalFormData.id, finalFormData);
                    onSuccess();
                } catch (error) {
                    return;
                }
                return;
            }
        }
        
        // Basic validation for visible fields only
        for (const field of config.fields) {
            const isHidden = field.hidden ? field.hidden(formData) : false;
            if (!isHidden && field.required && !formData[field.name]) {
                alert(`${field.label} is required`);
                return;
            }
        }
        
        // Check for duplicate code/ID when adding new or editing (if code changed)
        if (config.entityKey === 'items') {
            const newCode = formData.code;
            const existingItem = data.find(item => 
                item.code === newCode && item.id !== formData.id
            );
            if (existingItem) {
                alert(`❌ Item Code "${newCode}" already exists! Please use a unique code.`);
                return;
            }
        }
        
        // Check for duplicate partner name when adding new (not when editing)
        if (config.entityKey === 'partners' && !formData.id) {
            const existingPartner = data.find((p: any) => 
                p.name === formData.name && p.type === formData.type
            );
            if (existingPartner) {
                alert(`❌ Partner "${formData.name}" (${formData.type}) already exists! Please edit the existing partner instead.`);
                return;
            }
        }
        
        // Normalize number fields - preserve negative values
        const normalizedFormData = { ...formData };
        config.fields.forEach(field => {
            if (field.type === 'number' && normalizedFormData[field.name] !== undefined) {
                const value = normalizedFormData[field.name];
                // Allow empty, null, undefined to become 0, but preserve negative numbers
                if (value === '' || value === null || value === undefined) {
                    normalizedFormData[field.name] = 0;
                } else if (typeof value === 'string') {
                    // Handle string values (including negative signs)
                    if (value === '-') {
                        // User is typing negative, keep as is temporarily
                        normalizedFormData[field.name] = 0; // Will be handled on next keystroke
                    } else {
                        const parsed = parseFloat(value);
                        if (!isNaN(parsed)) {
                            normalizedFormData[field.name] = parsed; // Preserves negative
                        }
                    }
                }
                // If it's already a number (including negative), keep it as is
            }
        });
        
        // DEBUG: Log form state
        console.log('🔍 Form Save - formData:', normalizedFormData);
        console.log('🔍 Form Save - formData.id:', normalizedFormData.id, 'has onUpdate:', !!config.onUpdate, 'entityKey:', config.entityKey);
        console.log('🔍 Form Save - originalIdRef.current:', originalIdRef.current);
        console.log('🔍 Form Save - initialOverrides?.id:', initialOverrides?.id);
        
        // CRITICAL: Determine if we're editing or creating
        const isEditing = !!(normalizedFormData.id || originalIdRef.current || initialOverrides?.id);
        const editId = normalizedFormData.id || originalIdRef.current || initialOverrides?.id;
        
        console.log('🔍 Form Save - isEditing:', isEditing, 'editId:', editId);
        
        // If editing (has id in formData, ref, or initialOverrides), call onUpdate, otherwise call onSave
        if (isEditing && editId && config.onUpdate) {
            // Use the editId for the update
            const finalId = editId;
            
            // CRITICAL: Verify we're actually editing, not creating a duplicate
            const existingEntity = data.find((item: any) => item.id === finalId);
            if (!existingEntity) {
                alert(`Error: Cannot find entity with ID ${finalId}. This might be a duplicate.`);
                console.error('❌ Entity not found with ID:', finalId, 'Available IDs:', data.map((d: any) => d.id).slice(0, 5));
                return;
            }
            console.log('✅ Updating existing entity:', finalId, existingEntity.name || existingEntity.code);
            
            // Ensure formData has the ID
            const formDataWithId = { ...normalizedFormData, id: finalId };
            
            // Call onUpdate and wait for it to complete
            try {
                await config.onUpdate(finalId, formDataWithId);
                console.log('✅ Update successful');
                onSuccess();
            } catch (error) {
                // Error already handled in onUpdate, don't call onSuccess
                console.error('❌ Update failed:', error);
                return;
            }
        } else if (isEditing && editId && !config.onUpdate) {
            // If editing but no onUpdate handler, still try to save (will create duplicate)
            alert('Update functionality not available for this entity. Please delete and recreate.');
            console.error('❌ No onUpdate handler but formData has ID:', editId);
            return;
        } else {
            // Creating new - make sure no ID is set
            console.log('➕ Creating new entity (no ID in formData, ref, or initialOverrides)');
            const newData = { ...normalizedFormData };
            delete newData.id; // Remove any ID for new entries
            config.onSave({ ...newData, id: Math.random().toString(36).substr(2, 9) });
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSave} className="space-y-4">
            {/* Hidden field to preserve ID when editing */}
            {formData.id && (
                <input type="hidden" value={formData.id} />
            )}
            {config.fields.map((field) => {
                const isHidden = field.hidden ? field.hidden(formData) : false;
                if (isHidden) return null;

                // Calculate options - this will re-run on every render when formData changes
                // IMPORTANT: Options function receives (formData, allData) - formData first, then data array
                const resolvedOptions = typeof field.options === 'function' 
                    ? field.options(formData, data) 
                    : field.options;
                
                // Map options to {id, name} for EntitySelector
                // Filter out any info-only options (value === '__info__')
                const entityOptions = resolvedOptions
                    ?.filter(opt => {
                        if (typeof opt === 'string') return true;
                        return opt.value !== '__info__';
                    })
                    ?.map(opt => 
                        typeof opt === 'string' 
                            ? { id: opt, name: opt } 
                            : { id: String(opt.value), name: opt.label }
                    );

                return (
                    <div key={field.name}>
                        <label className="block text-sm font-medium text-slate-600 mb-1">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.type === 'select' && entityOptions ? (
                            <EntitySelector 
                                key={`${field.name}-${JSON.stringify(formData.type)}-${entityOptions.length}`} // Force re-render when type or options change
                                entities={entityOptions}
                                selectedId={String(formData[field.name] || '')}
                                onSelect={(id) => handleChange(field.name, id)}
                                placeholder={field.name === 'parentAccountId' && !formData.type 
                                    ? '⚠️ Select Type first to see parent accounts' 
                                    : `Select ${field.label}...`}
                                disabled={field.readOnly || (typeof field.disabled === 'function' ? field.disabled(formData) : field.disabled || false)}
                            />
                        ) : (
                            <input
                                type={field.type}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 border-slate-300"
                                value={formData[field.name] ?? ''}
                                onChange={e => {
                                    let value = e.target.value;
                                    if (field.type === 'number') {
                                        // Allow negative values - don't convert empty to 0 immediately
                                        if (value === '' || value === '-') {
                                            // Allow user to type negative sign
                                            handleChange(field.name, value);
                                            return;
                                        }
                                        const parsed = parseFloat(value);
                                        if (!isNaN(parsed)) {
                                            value = parsed;
                                        } else {
                                            // If invalid, keep the string value to allow user to continue typing
                                            value = value;
                                        }
                                    }
                                    handleChange(field.name, value);
                                }}
                                placeholder={field.placeholder}
                                required={field.required}
                                disabled={field.readOnly}
                                step={field.name === 'balance' ? 'any' : undefined}
                            />
                        )}
                        {/* Show hint for Account Type = LIABILITY in Chart of Accounts */}
                        {field.name === 'type' && formData[field.name] === 'LIABILITY' && config.entityKey === 'accounts' && (
                            <p className="text-[10px] text-red-600 mt-1">2030-2099: AVAILABLE (70 codes) Reserved for Other Payables</p>
                        )}
                        {/* Show hint for Parent Account field */}
                        {field.name === 'parentAccountId' && config.entityKey === 'accounts' && formData.type && (
                            <p className="text-[10px] text-slate-500 mt-1">
                                💡 <strong>Creating a child account?</strong> Select a parent account from the list above, or choose "(None - Top Level Account)" to create a parent account.
                                {(() => {
                                    const sameTypeAccounts = data.filter((a: any) => 
                                        a && a.type === formData.type && a.id !== formData.id && (!a.parentAccountId || a.parentAccountId === '')
                                    );
                                    if (sameTypeAccounts.length === 0) {
                                        return ' No parent accounts of this type exist yet. Create a parent account first (leave Parent Account as "None"), then create child accounts.';
                                    }
                                    return '';
                                })()}
                            </p>
                        )}
                    </div>
                );
            })}
            <div className="flex gap-3 pt-4">
                <button 
                    type="button" 
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 bg-white"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                    Save Record
                </button>
            </div>
        </form>
    );
};

// --- Quick Add Modal (Exported for Reuse) ---
export const QuickAddModal: React.FC<{
    config: CrudConfig | null;
    initialOverrides?: any;
    isOpen: boolean;
    onClose: () => void;
    data: any[];
}> = ({ config, initialOverrides, isOpen, onClose, data }) => {
    if (!isOpen || !config) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">{initialOverrides ? 'Edit' : 'Add New'} {config.title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="p-6">
                    <GenericForm 
                        config={config} 
                        data={data} 
                        onCancel={onClose} 
                        onSuccess={onClose} 
                        initialOverrides={initialOverrides}
                    />
                </div>
            </div>
        </div>
    );
};

// --- Generic CRUD Component ---

const CrudManager: React.FC<{ config: CrudConfig; data: any[] }> = ({ config, data }) => {
    const [isOpen, setIsOpen] = useState(false); // Collapsible card
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntity, setEditingEntity] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = data.filter(item => 
        Object.values(item).some(val => 
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div 
                className="p-4 bg-slate-50 flex justify-between items-center cursor-pointer select-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    {config.title} <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{data.length}</span>
                </h3>
                {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </div>
            
            {isOpen && (
                <div className="p-4">
                    <div className="flex justify-between items-center mb-4 gap-4">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search..." 
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                console.log('➕ Add New button clicked - clearing editingEntity');
                                setEditingEntity(null); // CRITICAL: Clear any editing state
                                setIsModalOpen(true); 
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Plus size={16} /> Add New
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-y border-slate-200">
                                <tr>
                                    {config.columns.map((col, idx) => (
                                        <th key={idx} className="px-4 py-3">{col.header}</th>
                                    ))}
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.length === 0 ? (
                                    <tr><td colSpan={config.columns.length + 1} className="p-4 text-center text-slate-500">No records found.</td></tr>
                                ) : (
                                    filteredData.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50 group">
                                            {config.columns.map((col, idx) => (
                                                <td key={idx} className="px-4 py-3">
                                                    {col.render ? col.render(row) : row[col.key]}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => {
                                                            console.log('✏️ Edit button clicked for row:', row.id, row);
                                                            // CRITICAL: Ensure the full row object with ID is passed
                                                            setEditingEntity({ ...row }); // Create a copy to ensure ID is preserved
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="text-slate-400 hover:text-blue-500 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => config.onDelete(row.id)}
                                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            <QuickAddModal 
                config={config}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingEntity(null);
                }}
                data={data}
                initialOverrides={editingEntity ? { ...editingEntity } : undefined} // Ensure ID is preserved
            />
        </div>
    );
};

// --- Sub-Modules ---

const HRModule: React.FC = () => {
    const { state, addEmployee, deleteEntity } = useData();
    const [activeTab, setActiveTab] = useState<'employees' | 'attendance'>('employees');

    const empConfig: CrudConfig = {
        title: 'Employee Register',
        entityKey: 'employees',
        columns: [
            { header: 'Name', key: 'name', render: (r) => <div className="font-medium text-slate-800">{r.name}</div> },
            { header: 'Passport', key: 'passportNumber' },
            { header: 'Role', key: 'role', render: (r) => r.role || '-' },
            { header: 'Visa Expiry', key: 'visaRenewalDate', render: (r) => r.visaRenewalDate || '-' },
            { header: 'Status', key: 'status', render: (r) => <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status || 'Active'}</span> },
        ],
        fields: [
            { name: 'name', label: 'Full Name', type: 'text', required: true },
            { name: 'passportNumber', label: 'Passport Number', type: 'text', required: true },
            { name: 'role', label: 'Designation', type: 'text', required: false },
            { name: 'basicSalary', label: 'Basic Salary (USD)', type: 'number', required: false },
            { name: 'status', label: 'Status', type: 'select', options: ['Active', 'On Leave', 'Terminated'], required: false },
            { name: 'joinDate', label: 'Join Date', type: 'date', required: false },
            { name: 'passportExpiry', label: 'Passport Expiry', type: 'date', required: false },
            { name: 'visaDate', label: 'Visa Issue Date', type: 'date', required: false },
            { 
                name: 'visaRenewalDate', 
                label: 'Visa Renewal (Auto +2 Yrs)', 
                type: 'date', 
                required: false,
                readOnly: true,
                compute: (formData) => {
                    if (formData.visaDate) {
                        try {
                            const date = new Date(formData.visaDate);
                            date.setFullYear(date.getFullYear() + 2);
                            return date.toISOString().split('T')[0];
                        } catch (e) {
                            return '';
                        }
                    }
                    return '';
                }
            },
            { name: 'reference', label: 'Reference', type: 'text', required: false },
        ],
        onSave: (data) => addEmployee(data),
        onDelete: (id) => deleteEntity('employees', id)
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <Users className="text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">HR Management</h2>
                <div className="flex gap-2 ml-auto">
                    <button onClick={() => setActiveTab('employees')} className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'employees' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}>Employees</button>
                    <button onClick={() => setActiveTab('attendance')} className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'attendance' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}>Attendance</button>
                </div>
            </div>

            {activeTab === 'employees' ? (
                <CrudManager config={empConfig} data={state.employees} />
            ) : (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-lg">
                    <Calendar className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-slate-500">Attendance Grid Mockup</p>
                    <div className="mt-4 grid grid-cols-7 gap-2 max-w-lg mx-auto opacity-50">
                        {Array.from({length: 14}).map((_, i) => (
                            <div key={i} className="h-10 border border-slate-200 bg-slate-50 rounded flex items-center justify-center text-xs">Day {i+1}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const DataImporter: React.FC = () => {
    const { cleanupOrphanedLedger, markSubSupplierEntriesAsReportingOnly } = useData();
    
    return (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 mb-6 text-white shadow-lg">
            <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-lg">
                    <FileSpreadsheet size={24} className="text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-lg">Bulk Data Import & Utilities</h3>
                    <p className="text-blue-100 text-sm opacity-90">Upload CSV files to import data or cleanup orphaned records.</p>
                </div>
                <div className="ml-auto flex gap-2">
                    <button 
                        onClick={() => {
                            if (confirm('This will mark all existing sub-supplier ledger entries as reporting-only.\n\nThis will prevent them from affecting the Balance Sheet.\n\nContinue?')) {
                                markSubSupplierEntriesAsReportingOnly();
                            }
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
                        title="Mark existing sub-supplier entries as reporting-only (fixes Balance Sheet)"
                    >
                        <FileSpreadsheet size={16} /> Fix Sub-Suppliers
                    </button>
                    <button 
                        onClick={() => {
                            if (confirm('This will delete all ledger entries for purchases/invoices that no longer exist. Continue?')) {
                                cleanupOrphanedLedger();
                            }
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <Trash2 size={16} /> Cleanup Ledger
                    </button>
                    <button className="bg-white text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors">
                        <Upload size={16} /> Upload CSV
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Hook for Configurations (Exported for Reuse) ---
export const useSetupConfigs = () => {
    const { 
        state, 
        addPartner,
        updatePartner,
        addItem,
        updateItem,
        addAccount, 
        deleteEntity, 
        addDivision,
        addSubDivision,
        addLogo,
        addPort,
        addWarehouse,
        addOriginalType,
        addOriginalProduct,
        addCategory,
        addSection
    } = useData();

    const partnerConfig: CrudConfig = {
        title: 'Business Partners',
        entityKey: 'partners',
        columns: [
            { header: 'Code', key: 'code', render: (r) => r.code ? <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">{r.code}</span> : <span className="text-xs text-slate-400 italic">-</span> },
            { header: 'Name', key: 'name' },
            { header: 'Type', key: 'type', render: (r) => <span className="text-xs font-mono bg-slate-100 px-1 rounded">{r.type}</span> },
            { header: 'Division', key: 'divisionId', render: (r) => state.divisions.find(d => d.id === r.divisionId)?.name || '-' },
            { header: 'Currency', key: 'defaultCurrency', render: (r) => <span className="font-mono text-xs">{r.defaultCurrency || 'USD'}</span> },
            { header: 'Balance', key: 'balance', render: (r) => <span className={r.balance < 0 ? 'text-red-500' : 'text-emerald-600'}>{r.balance}</span> },
            { 
                header: 'In Use', 
                key: 'id', 
                render: (r) => {
                    const ledgerCount = state.ledger.filter(e => e.accountId === r.id).length;
                    const usedInJV1002 = state.ledger.some(e => e.accountId === r.id && e.transactionId === 'JV-1002');
                    if (ledgerCount > 0) {
                        return (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                    {ledgerCount} entry{ledgerCount !== 1 ? 'ies' : 'y'}
                                </span>
                                {usedInJV1002 && (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded" title="Used in JV-1002">
                                        JV-1002
                                    </span>
                                )}
                            </div>
                        );
                    }
                    return <span className="text-xs text-slate-400 italic">Unused</span>;
                }
            }
        ],
        fields: [
            { name: 'type', label: 'Partner Type', type: 'select', options: Object.values(PartnerType), required: true },
            { name: 'code', label: 'Partner Code', type: 'text', placeholder: 'e.g., FSK-001, CUST-100', required: false },
            { name: 'name', label: 'Company Name', type: 'text', required: true },
            { 
                name: 'divisionId', 
                label: 'Division', 
                type: 'select', 
                options: () => state.divisions.map(d => ({ label: d.name, value: d.id })),
                required: false 
            },
            { 
                name: 'subDivisionId', 
                label: 'Sub-Division', 
                type: 'select', 
                options: (_, formData) => state.subDivisions
                    .filter(sd => sd.divisionId === formData.divisionId)
                    .map(sd => ({ label: sd.name, value: sd.id })),
                required: false,
                hidden: (data) => !data.divisionId
            },
            { name: 'defaultCurrency', label: 'Default Currency', type: 'select', options: () => state.currencies.length > 0 ? state.currencies.map(c => c.code) : ['USD'], required: true, defaultValue: 'USD' },
            { name: 'contact', label: 'Contact Person', type: 'text' },
            { name: 'phone', label: 'Phone', type: 'text' },
            { name: 'email', label: 'Email', type: 'text' },
            { name: 'country', label: 'Country', type: 'text' },
            { 
                name: 'creditLimit', 
                label: 'Credit Limit (USD)', 
                type: 'number', 
                hidden: (data) => data.type !== PartnerType.CUSTOMER
            },
            { 
                name: 'taxId', 
                label: 'Tax ID / TRN', 
                type: 'text', 
                hidden: (data) => ![PartnerType.SUPPLIER, PartnerType.VENDOR].includes(data.type)
            },
            { 
                name: 'parentSupplierId', 
                label: 'Parent Supplier', 
                type: 'select', 
                options: (formData: any, allData: any[]) => allData.filter((p: any) => p.type === PartnerType.SUPPLIER).map((p: any) => ({ label: p.name, value: p.id })),
                hidden: (data) => data.type !== PartnerType.SUB_SUPPLIER,
                placeholder: 'Select main supplier (required for sub-supplier)'
            },
            { 
                name: 'commissionRate', 
                label: 'Commission Rate (%)', 
                type: 'number', 
                hidden: (data) => data.type !== PartnerType.COMMISSION_AGENT
            },
             { 
                name: 'licenseNumber', 
                label: 'License Number', 
                type: 'text', 
                hidden: (data) => data.type !== PartnerType.CLEARING_AGENT
            },
             { 
                name: 'scacCode', 
                label: 'SCAC Code', 
                type: 'text', 
                hidden: (data) => data.type !== PartnerType.FREIGHT_FORWARDER
            },
            { name: 'balance', label: 'Opening Balance (USD)', type: 'number', placeholder: 'Positive for Receivable, Negative for Payable', defaultValue: 0 }
        ],
        onSave: (data) => addPartner(data),
        onUpdate: async (id, data) => {
            // Remove id from data before updating (id should not be updated)
            const { id: _, ...updateData } = data;
            try {
                await updatePartner(id, updateData);
                console.log('✅ Partner updated successfully:', id);
            } catch (error) {
                console.error('❌ Error updating partner:', error);
                alert('Failed to update partner. Please try again.');
                throw error; // Prevent onSuccess from being called
            }
        },
        onDelete: (id) => deleteEntity('partners', id)
    };

    const divisionConfig: CrudConfig = {
        title: 'Divisions (Business Units)',
        entityKey: 'divisions',
        columns: [
            { header: 'Code', key: 'code', render: (r) => r.code ? <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">{r.code}</span> : <span className="text-xs text-slate-400 italic">-</span> },
            { header: 'Name', key: 'name' },
            { header: 'Location/HQ', key: 'location' }
        ],
        fields: [
            { name: 'code', label: 'Code (Optional)', type: 'text', placeholder: 'e.g. DIV-001' },
            { name: 'name', label: 'Division Name', type: 'text', required: true },
            { name: 'location', label: 'Location/HQ', type: 'text', required: false }
        ],
        onSave: (data) => addDivision(data),
        onDelete: (id) => deleteEntity('divisions', id)
    };

    const subDivisionConfig: CrudConfig = {
        title: 'Sub-Divisions',
        entityKey: 'subDivisions',
        columns: [
            { header: 'Code', key: 'code', render: (r) => r.code ? <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">{r.code}</span> : <span className="text-xs text-slate-400 italic">-</span> },
            { header: 'Name', key: 'name' },
            { header: 'Parent Division', key: 'divisionId', render: (r) => state.divisions.find(d => d.id === r.divisionId)?.name || r.divisionId }
        ],
        fields: [
            { name: 'code', label: 'Code (Optional)', type: 'text', placeholder: 'e.g. SUBDIV-001' },
            { name: 'name', label: 'Sub-Division Name', type: 'text', required: true },
            { 
                name: 'divisionId', 
                label: 'Parent Division', 
                type: 'select', 
                options: () => state.divisions.map(d => ({ label: d.name, value: d.id })),
                required: true 
            }
        ],
        onSave: (data) => addSubDivision(data),
        onDelete: (id) => deleteEntity('subDivisions', id)
    };

    const logoConfig: CrudConfig = {
        title: 'Brand Logos',
        entityKey: 'logos',
        columns: [ { header: 'Brand Name', key: 'name' } ],
        fields: [ { name: 'name', label: 'Brand Name', type: 'text', required: true } ],
        onSave: (data) => addLogo(data),
        onDelete: (id) => deleteEntity('logos', id)
    };

    const portConfig: CrudConfig = {
        title: 'Ports of Destination',
        entityKey: 'ports',
        columns: [ { header: 'Port Name', key: 'name' }, { header: 'Code', key: 'code' }, { header: 'Country', key: 'country' } ],
        fields: [
            { name: 'name', label: 'Port Name', type: 'text', required: true },
            { name: 'code', label: 'Port Code', type: 'text', required: false },
            { name: 'country', label: 'Country', type: 'text', required: false }
        ],
        onSave: (data) => addPort(data),
        onDelete: (id) => deleteEntity('ports', id)
    };

    const itemConfig: CrudConfig = {
        title: 'Inventory Items (Finished Goods)',
        entityKey: 'items',
        columns: [
            { header: 'Code', key: 'code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Category', key: 'category' },
            { header: 'Packing', key: 'packingType' },
            { header: 'Weight', key: 'weightPerUnit', render: (r) => `${r.weightPerUnit} kg` },
            { header: 'Stock', key: 'stockQty' }
        ],
        fields: [
            { 
                name: 'code', 
                label: 'Item Code', 
                type: 'text', 
                required: true, 
                defaultValue: (data: any[]) => `ITEM-${1001 + data.length}` 
            },
            { name: 'name', label: 'Item Name', type: 'text', required: true },
            { 
                name: 'category', 
                label: 'Category', 
                type: 'select', 
                options: () => state.categories.map(c => c.name), 
                required: true 
            },
            { 
                name: 'section', 
                label: 'Section (Optional)', 
                type: 'select', 
                options: () => state.sections.map(s => s.name), 
                required: false 
            },
            { name: 'packingType', label: 'Packing Type', type: 'select', options: Object.values(PackingType), required: true },
            { name: 'weightPerUnit', label: 'Package Size (Kg)', type: 'number', required: true },
            { name: 'avgCost', label: 'Avg Production Price (Per Unit)', type: 'number', placeholder: 'Can be negative for waste/garbage' },
            { name: 'salePrice', label: 'Avg Sale Price', type: 'number' },
            { name: 'stockQty', label: 'Opening Stock Qty', type: 'number', placeholder: 'For Opening Balance Only' }
        ],
        onSave: (data) => addItem(data, data.stockQty),
        onUpdate: (id, data) => updateItem(id, data),
        onDelete: (id) => deleteEntity('items', id)
    };

     const warehouseConfig: CrudConfig = {
        title: 'Warehouses',
        entityKey: 'warehouses',
        columns: [
            { header: 'Name', key: 'name' },
            { header: 'Location', key: 'location' }
        ],
        fields: [
            { name: 'name', label: 'Warehouse Name', type: 'text', required: true },
            { name: 'location', label: 'Location/Address', type: 'text', required: false },
        ],
        onSave: (data) => addWarehouse(data),
        onDelete: (id) => deleteEntity('warehouses', id)
    };

    const categoryConfig: CrudConfig = {
        title: 'Product Categories',
        entityKey: 'categories',
        columns: [{ header: 'Name', key: 'name' }],
        fields: [{ name: 'name', label: 'Category Name', type: 'text', required: true }],
        onSave: (data) => addCategory(data),
        onDelete: (id) => deleteEntity('categories', id)
    };

    const sectionConfig: CrudConfig = {
        title: 'Factory Sections',
        entityKey: 'sections',
        columns: [{ header: 'Name', key: 'name' }],
        fields: [{ name: 'name', label: 'Section Name', type: 'text', required: true }],
        onSave: (data) => addSection(data),
        onDelete: (id) => deleteEntity('sections', id)
    };

    const originalTypeConfig: CrudConfig = {
        title: 'Original Types',
        entityKey: 'originalTypes',
        columns: [
            { header: 'Code', key: 'code', render: (r) => r.code ? <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">{r.code}</span> : <span className="text-xs font-mono text-slate-400">{r.id.substring(0, 8)}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Packing', key: 'packingType' },
            { header: 'Size (Kg)', key: 'packingSize' }
        ],
        fields: [
            { name: 'code', label: 'Code (Optional)', type: 'text', placeholder: 'e.g. OT-001' },
            { name: 'name', label: 'Type Name (e.g. KSA Mix)', type: 'text', required: true },
            { name: 'packingType', label: 'Packing', type: 'select', options: Object.values(PackingType), required: true },
            { name: 'packingSize', label: 'Standard Weight (Kg)', type: 'number', required: true }
        ],
        onSave: (data) => addOriginalType(data),
        onDelete: (id) => deleteEntity('originalTypes', id)
    };

    const originalProductConfig: CrudConfig = {
        title: 'Original Products',
        entityKey: 'originalProducts',
        columns: [
            { header: 'Code', key: 'code', render: (r) => r.code ? <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">{r.code}</span> : <span className="text-xs font-mono text-slate-400">{r.id.substring(0, 8)}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Parent Type', key: 'originalTypeId', render: (r) => state.originalTypes.find(ot => ot.id === r.originalTypeId)?.name || r.originalTypeId }
        ],
        fields: [
            { name: 'code', label: 'Code (Optional)', type: 'text', placeholder: 'e.g. OP-001' },
            { 
                name: 'originalTypeId', 
                label: 'Original Type', 
                type: 'select', 
                options: () => state.originalTypes.map(ot => ({ label: ot.name, value: ot.id })),
                required: true 
            },
            { name: 'name', label: 'Product Name', type: 'text', required: true }
        ],
        onSave: (data) => addOriginalProduct(data),
        onDelete: (id) => deleteEntity('originalProducts', id)
    };

    return {
        partnerConfig,
        divisionConfig,
        subDivisionConfig,
        logoConfig,
        portConfig,
        itemConfig,
        warehouseConfig,
        categoryConfig,
        sectionConfig,
        originalTypeConfig,
        originalProductConfig
    };
};

// --- Currency Manager ---
const CurrencyManager: React.FC<{ data: any[] }> = ({ data }) => {
    const { addCurrency, updateCurrency, deleteEntity } = useData();
    const [showForm, setShowForm] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [editingCurrency, setEditingCurrency] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        symbol: '',
        exchangeRate: 1,
        isBaseCurrency: false
    });

    const resetForm = () => {
        setFormData({ code: '', name: '', symbol: '', exchangeRate: 1, isBaseCurrency: false });
        setEditingCurrency(null);
        setShowForm(false);
    };

    const handleSave = () => {
        if (!formData.code || !formData.name || !formData.symbol || formData.exchangeRate <= 0) {
            alert('Please fill all required fields');
            return;
        }

        if (editingCurrency) {
            updateCurrency(editingCurrency.id, formData);
        } else {
            addCurrency({ ...formData, id: Math.random().toString(36).substr(2, 9) });
        }
        resetForm();
    };

    const handleEdit = (currency: any) => {
        setEditingCurrency(currency);
        setFormData({
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            exchangeRate: currency.exchangeRate,
            isBaseCurrency: currency.isBaseCurrency
        });
        setShowForm(true);
    };

    return (
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <div 
                className="flex justify-between items-center mb-4 cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    Currency Management
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </h3>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowForm(!showForm);
                    }} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    {showForm ? 'Cancel' : '+ Add Currency'}
                </button>
            </div>

            {isExpanded && (
                <div>
                    {/* Search Box */}
                    {data.length > 0 && (
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search currencies..." 
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}

                    {showForm && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Currency Code *</label>
                            <input
                                type="text"
                                placeholder="USD, EUR, GBP..."
                                maxLength={3}
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                className="w-full border border-slate-300 rounded-lg p-2 uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Symbol *</label>
                            <input
                                type="text"
                                placeholder="$, €, £..."
                                value={formData.symbol}
                                onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Currency Name *</label>
                            <input
                                type="text"
                                placeholder="US Dollar, Euro..."
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Exchange Rate (1 USD = ?) *</label>
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={formData.exchangeRate}
                                onChange={e => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) })}
                                className="w-full border border-slate-300 rounded-lg p-2"
                            />
                        </div>
                        <div className="flex items-center">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isBaseCurrency}
                                    onChange={e => setFormData({ ...formData, isBaseCurrency: e.target.checked })}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm font-medium text-slate-700">Base Currency (USD)</span>
                            </label>
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
                        {editingCurrency ? 'Update Currency' : 'Add Currency'}
                    </button>
                </div>
            )}

            {data.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    <p>No currencies configured. Add currencies to enable multi-currency transactions.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="text-left p-3 text-sm font-semibold text-slate-700">Code</th>
                                <th className="text-left p-3 text-sm font-semibold text-slate-700">Name</th>
                                <th className="text-left p-3 text-sm font-semibold text-slate-700">Symbol</th>
                                <th className="text-right p-3 text-sm font-semibold text-slate-700">Rate (1 USD =)</th>
                                <th className="text-center p-3 text-sm font-semibold text-slate-700">Base</th>
                                <th className="text-right p-3 text-sm font-semibold text-slate-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data
                                .filter(currency => 
                                    currency.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    currency.symbol.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((currency, idx) => (
                                <tr key={currency.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                    <td className="p-3 font-mono text-sm font-bold text-slate-800">{currency.code}</td>
                                    <td className="p-3 text-sm text-slate-700">{currency.name}</td>
                                    <td className="p-3 text-sm font-medium text-slate-700">{currency.symbol}</td>
                                    <td className="p-3 text-right font-mono text-sm text-slate-800">{currency.exchangeRate.toFixed(4)}</td>
                                    <td className="p-3 text-center">
                                        {currency.isBaseCurrency && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">BASE</span>}
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                        <button onClick={() => handleEdit(currency)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                                        {!currency.isBaseCurrency && (
                                            <button onClick={() => confirm(`Delete ${currency.name}?`) && deleteEntity('currencies', currency.id)} className="text-red-600 hover:text-red-800 font-medium text-sm">Delete</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
                </div>
            )}
        </div>
    );
};

// --- Chart of Accounts Manager with Bulk Import ---
const ChartOfAccountsManager: React.FC<{ data: any[] }> = ({ data }) => {
    const { addAccount, updateAccount, deleteEntity } = useData();
    const [isImporting, setIsImporting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const handleBulkImport = async () => {
        if (!confirm(`Import ${INITIAL_ACCOUNTS.length} professional accounts into this factory?\n\nThis will add:\n• Assets (1000-1999)\n• Liabilities (2000-2999)\n• Equity (3000-3999)\n• Revenue (4000-4999)\n• Expenses (5000-5999)`)) {
            return;
        }

        setIsImporting(true);
        let imported = 0;
        let skipped = 0;
        const existingCodes = new Set(data.map(a => a.code)); // Track codes we've seen

        for (const account of INITIAL_ACCOUNTS) {
            try {
                // Check if account code already exists
                if (!existingCodes.has(account.code)) {
                    addAccount({
                        ...account,
                        id: undefined, // Let Firebase generate new ID
                        currency: 'USD', // Default currency
                        balance: account.balance || 0 // Ensure balance is set
                    });
                    existingCodes.add(account.code); // Mark as imported
                    imported++;
                    
                    // Small delay to avoid overwhelming Firebase
                    if (imported % 20 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } else {
                    skipped++;
                }
            } catch (error) {
                console.error(`Failed to import account ${account.code}:`, error);
            }
        }

        setIsImporting(false);
        alert(`✅ Successfully imported ${imported} accounts!\n${skipped > 0 ? `Skipped ${skipped} existing accounts.` : ''}`);
    };

    const accountConfig: CrudConfig = {
        title: 'Chart of Accounts',
        entityKey: 'accounts',
        columns: [
            { header: 'Code', key: 'code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Type', key: 'type' },
            { header: 'Balance', key: 'balance', render: (r) => <span>${(r.balance || 0).toFixed(2)}</span> }
        ],
        fields: [
            { name: 'type', label: 'Type', type: 'select', options: Object.values(AccountType), required: true },
            { 
                name: 'code', 
                label: 'GL Code', 
                type: 'text', 
                required: true, 
                placeholder: 'Enter code (e.g., 3400) or leave blank for auto',
                compute: (formData, allData) => {
                    // If user manually entered a code, keep it
                    if (formData.code && formData.code.trim() !== '') {
                        return formData.code;
                    }
                    // Otherwise auto-generate based on type
                    if (!formData.type) return '';
                    let prefix = '1';
                    switch(formData.type) {
                        case AccountType.ASSET: prefix = '1'; break;
                        case AccountType.LIABILITY: prefix = '2'; break;
                        case AccountType.EQUITY: prefix = '3'; break;
                        case AccountType.REVENUE: prefix = '4'; break;
                        case AccountType.EXPENSE: prefix = '5'; break;
                    }
                    const existingCodes = allData
                        .filter(a => a.code.startsWith(prefix))
                        .map(a => parseInt(a.code))
                        .filter(n => !isNaN(n))
                        .sort((a, b) => b - a);
                    const nextCode = existingCodes.length > 0 ? existingCodes[0] + 1 : parseInt(prefix + '001');
                    return nextCode.toString();
                }
            },
            { name: 'name', label: 'Account Name', type: 'text', required: true },
            { 
                name: 'parentAccountId', 
                label: 'Parent Account (Optional - for grouping)', 
                type: 'select', 
                options: (formData, allData) => {
                    // Check if type is selected (handle both string and enum values)
                    // Debug: Log to see what we're getting
                    console.log('🔍 Parent Account Options - formData:', formData, 'type:', formData?.type, 'hasType:', !!formData?.type);
                    
                    const accountType = formData?.type;
                    const hasType = accountType && accountType !== '' && accountType !== null && accountType !== undefined;
                    
                    // If no type selected, show hint message
                    if (!hasType) {
                        console.log('⚠️ No type selected, showing hint message');
                        return [{ label: '⚠️ Select Type first to see parent accounts', value: '' }];
                    }
                    
                    console.log('✅ Type selected:', accountType, 'proceeding to filter accounts');
                    
                    // Always include "(None - Top Level Account)" as first option
                    const baseOptions = [{ label: '(None - Top Level Account)', value: '' }];
                    
                    // Filter accounts by same type and factory, exclude current account (if editing)
                    const sameTypeAccounts = allData.filter((a: any) => {
                        if (!a) return false;
                        // Compare types (handle both string and enum)
                        const aType = a.type;
                        const typeMatches = aType === accountType || String(aType) === String(accountType);
                        return typeMatches && 
                               a.id !== formData.id &&
                               (!a.parentAccountId || a.parentAccountId === ''); // Only show accounts that are not already children
                    });
                    
                    // Map to options format
                    const parentOptions = sameTypeAccounts.map((a: any) => ({ 
                        label: `${a.code} - ${a.name}`, 
                        value: a.id 
                    }));
                    
                    // Return options (even if empty, user can still select "None")
                    return [...baseOptions, ...parentOptions];
                },
                required: false,
                hidden: false, // Always show the field
                disabled: (formData) => !formData || !formData.type // Disable until type is selected
            },
            { 
                name: 'currency', 
                label: 'Currency (for Bank/Cash accounts)', 
                type: 'select', 
                options: Object.keys(EXCHANGE_RATES),
                defaultValue: 'USD'
            },
            { name: 'balance', label: 'Opening Balance (Read-only - calculated from ledger)', type: 'number', defaultValue: 0, readOnly: true }
        ],
        onSave: (data) => addAccount(data),
        onUpdate: async (id: string, data: any) => {
            try {
                await updateAccount(id, data);
                setEditingAccountId(null);
                setShowForm(false);
            } catch (error: any) {
                alert(`Failed to update account: ${error.message || error}`);
                throw error;
            }
        },
        onDelete: (id) => deleteEntity('accounts', id)
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-slate-600 hover:text-slate-800"
                    >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <h3 className="text-xl font-bold text-slate-800">Chart of Accounts</h3>
                </div>
                <div className="flex gap-2">
                    {data.length < 50 && (
                        <button
                            onClick={handleBulkImport}
                            disabled={isImporting}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            <Download size={16} />
                            {isImporting ? 'Importing...' : `Import 166 Accounts`}
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <Plus size={16} />
                        Add Manual
                    </button>
                </div>
            </div>

            {isExpanded && (
                <>
                    {/* Search Box */}
                    {data.length > 0 && (
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search accounts by code, name, or type..." 
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}

                    {data.length === 0 && !isImporting && (
                        <div className="text-center py-8 text-slate-500">
                    <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No Chart of Accounts found</p>
                    <p className="text-sm mt-2">Click "Import 166 Accounts" to load the professional accounting structure</p>
                </div>
            )}

            {(showForm || editingAccountId) && (
                <div className="mb-4 border-t pt-4">
                    <GenericForm 
                        config={accountConfig} 
                        data={data} 
                        initialOverrides={editingAccountId ? data.find(a => a.id === editingAccountId) : undefined}
                        onCancel={() => {
                            setShowForm(false);
                            setEditingAccountId(null);
                        }} 
                        onSuccess={() => {
                            setShowForm(false);
                            setEditingAccountId(null);
                        }} 
                    />
                </div>
            )}

            {data.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Code</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Name</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Type</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Balance</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {data
                                .filter(account => 
                                    account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    account.type.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((account) => (
                                <tr key={account.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 font-mono text-xs">{account.code}</td>
                                    <td className="px-4 py-2 text-sm">{account.name}</td>
                                    <td className="px-4 py-2 text-sm">{account.type}</td>
                                    <td className="px-4 py-2 text-sm text-right">${account.balance || 0}</td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingAccountId(account.id);
                                                    setShowForm(false);
                                                }}
                                                className="text-blue-600 hover:text-blue-800"
                                                title="Edit account"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => deleteEntity('accounts', account.id)}
                                                className="text-red-600 hover:text-red-800"
                                                title="Delete account"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-4 text-sm text-slate-600">
                        Total: {data.filter(account => 
                            account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            account.type.toLowerCase().includes(searchTerm.toLowerCase())
                        ).length} of {data.length} accounts
                    </div>
                </div>
            )}
                </>
            )}
        </div>
    );
};

// --- Main Setup Component ---

export const SetupModule: React.FC = () => {
    const { state } = useData();
    const configs = useSetupConfigs();

    // Export CSV for Categories or Sections
    const handleExportCSV = (data: { id: string; name: string }[], filename: string) => {
        if (!data || data.length === 0) {
            alert('No data to export');
            return;
        }
        const csv = Papa.unparse(data.map(({ id, name }) => ({ ID: id, Name: name })));
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <DataImporter />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Partners & Structure</h2>
                    </div>
                    <CrudManager config={configs.divisionConfig} data={state.divisions} />
                    <CrudManager config={configs.subDivisionConfig} data={state.subDivisions} />
                    <CrudManager config={configs.logoConfig} data={state.logos} />
                    <CrudManager config={configs.partnerConfig} data={state.partners} />
                    <HRModule />
                    
                    <div className="flex items-center gap-2 mb-2 mt-8">
                        <Box className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Raw Material Classifications</h2>
                    </div>
                    <CrudManager config={configs.originalTypeConfig} data={state.originalTypes} />
                    <CrudManager config={configs.originalProductConfig} data={state.originalProducts} />
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Package className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Finished Goods & Operations</h2>
                    <button
                        className="ml-auto flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        onClick={() => handleExportCSV(state.categories, 'categories_export.csv')}
                        title="Export Categories to CSV"
                    >
                        <Download size={14} /> Export Categories
                    </button>
                    </div>
                    <CrudManager config={configs.categoryConfig} data={state.categories} />
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-600">Export Sections:</span>
                        <button
                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                            onClick={() => handleExportCSV(state.sections, 'sections_export.csv')}
                            title="Export Sections to CSV"
                        >
                            <Download size={14} /> Export Sections
                        </button>
                    </div>
                    <CrudManager config={configs.sectionConfig} data={state.sections} />
                    <CrudManager config={configs.itemConfig} data={state.items} />
                    <CrudManager config={configs.warehouseConfig} data={state.warehouses} />
                    
                    <div className="flex items-center gap-2 mb-2 mt-8">
                        <CreditCard className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Financials</h2>
                    </div>
                    <CurrencyManager data={state.currencies} />
                    <ChartOfAccountsManager data={state.accounts} />
                </div>
            </div>
        </div>
    );
};
